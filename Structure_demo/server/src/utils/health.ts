/**
 * Health & Graceful Shutdown
 * 
 * Kubernetes-ready health endpoints and graceful shutdown handling.
 * Features: Liveness, Readiness, Startup probes, Connection draining
 */

import { Router, Request, Response } from 'express';
import { Server } from 'http';
import logger, { metrics } from '../utils/logger';

// Health state
interface HealthState {
    isReady: boolean;
    isLive: boolean;
    isShuttingDown: boolean;
    startTime: Date;
    checks: Map<string, HealthCheck>;
}

interface HealthCheck {
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    lastCheck: Date;
    message?: string;
    responseTime?: number;
}

const state: HealthState = {
    isReady: false,
    isLive: true,
    isShuttingDown: false,
    startTime: new Date(),
    checks: new Map(),
};

// Health check functions
type HealthCheckFn = () => Promise<{ status: 'healthy' | 'unhealthy' | 'degraded'; message?: string }>;

const healthChecks: Map<string, HealthCheckFn> = new Map();

export function registerHealthCheck(name: string, checkFn: HealthCheckFn): void {
    healthChecks.set(name, checkFn);
    state.checks.set(name, {
        name,
        status: 'healthy',
        lastCheck: new Date(),
    });
}

// Run all health checks
async function runHealthChecks(): Promise<void> {
    for (const [name, checkFn] of healthChecks) {
        const startTime = Date.now();
        try {
            const result = await Promise.race([
                checkFn(),
                new Promise<{ status: 'unhealthy'; message: string }>((_, reject) =>
                    setTimeout(() => reject(new Error('Health check timeout')), 5000)
                ),
            ]);

            state.checks.set(name, {
                name,
                status: result.status,
                lastCheck: new Date(),
                message: result.message,
                responseTime: Date.now() - startTime,
            });
        } catch (error: any) {
            state.checks.set(name, {
                name,
                status: 'unhealthy',
                lastCheck: new Date(),
                message: error.message,
                responseTime: Date.now() - startTime,
            });
        }
    }
}

// Determine overall health status
function getOverallStatus(): 'healthy' | 'unhealthy' | 'degraded' {
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const check of state.checks.values()) {
        if (check.status === 'unhealthy') hasUnhealthy = true;
        if (check.status === 'degraded') hasDegraded = true;
    }

    if (hasUnhealthy) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
}

// Health router
export const healthRouter = Router();

// Kubernetes liveness probe
// Returns 200 if the process is running (even if dependencies are down)
healthRouter.get('/live', (_req: Request, res: Response) => {
    if (!state.isLive || state.isShuttingDown) {
        return res.status(503).json({
            status: 'unhealthy',
            reason: state.isShuttingDown ? 'shutting_down' : 'not_live',
        });
    }

    res.json({
        status: 'healthy',
        uptime: Date.now() - state.startTime.getTime(),
    });
});

// Kubernetes readiness probe
// Returns 200 only if ready to accept traffic
healthRouter.get('/ready', async (_req: Request, res: Response) => {
    if (state.isShuttingDown) {
        return res.status(503).json({
            status: 'unhealthy',
            reason: 'shutting_down',
        });
    }

    await runHealthChecks();
    const overallStatus = getOverallStatus();

    const response = {
        status: overallStatus,
        checks: Object.fromEntries(state.checks),
        timestamp: new Date().toISOString(),
    };

    if (overallStatus === 'unhealthy') {
        state.isReady = false;
        return res.status(503).json(response);
    }

    state.isReady = true;
    res.json(response);
});

// Detailed health check (for monitoring)
healthRouter.get('/health', async (_req: Request, res: Response) => {
    await runHealthChecks();

    const overallStatus = getOverallStatus();
    const uptime = Date.now() - state.startTime.getTime();

    const response = {
        status: overallStatus,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime,
        timestamp: new Date().toISOString(),
        checks: Object.fromEntries(state.checks),
        system: {
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            pid: process.pid,
            nodeVersion: process.version,
        },
    };

    res.status(overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503).json(response);
});

// Metrics endpoint (Prometheus format)
healthRouter.get('/metrics', (_req: Request, res: Response) => {
    const allMetrics = metrics.getMetrics();

    let output = '';

    // Counters
    for (const [name, value] of Object.entries(allMetrics.counters)) {
        output += `# TYPE ${name.split('{')[0]} counter\n`;
        output += `${name} ${value}\n`;
    }

    // Histograms
    for (const [name, stats] of Object.entries(allMetrics.histograms)) {
        const baseName = name.split('{')[0];
        output += `# TYPE ${baseName} histogram\n`;
        output += `${baseName}_count${name.includes('{') ? name.substring(name.indexOf('{')) : ''} ${stats.count}\n`;
        output += `${baseName}_sum${name.includes('{') ? name.substring(name.indexOf('{')) : ''} ${stats.sum}\n`;
    }

    // System metrics
    const mem = process.memoryUsage();
    output += `# TYPE process_memory_heap_bytes gauge\n`;
    output += `process_memory_heap_bytes ${mem.heapUsed}\n`;
    output += `# TYPE process_memory_rss_bytes gauge\n`;
    output += `process_memory_rss_bytes ${mem.rss}\n`;
    output += `# TYPE process_uptime_seconds gauge\n`;
    output += `process_uptime_seconds ${process.uptime()}\n`;

    res.set('Content-Type', 'text/plain');
    res.send(output);
});

// Graceful shutdown handler
export class GracefulShutdown {
    private server: Server | null = null;
    private shutdownTimeout: number;
    private connections: Set<any> = new Set();

    constructor(options: { shutdownTimeout?: number } = {}) {
        this.shutdownTimeout = options.shutdownTimeout || 30000;
    }

    register(server: Server): void {
        this.server = server;

        // Track connections
        server.on('connection', (conn) => {
            this.connections.add(conn);
            conn.on('close', () => this.connections.delete(conn));
        });

        // Register signal handlers
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGUSR2', () => this.shutdown('SIGUSR2')); // nodemon
    }

    async shutdown(signal: string): Promise<void> {
        if (state.isShuttingDown) return;

        logger.info(`Graceful shutdown initiated`, { signal });
        state.isShuttingDown = true;
        state.isReady = false;

        // Give load balancer time to stop sending traffic
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Close server to stop accepting new connections
        if (this.server) {
            this.server.close((err) => {
                if (err) {
                    logger.error('Error closing server', { error: err.message });
                } else {
                    logger.info('Server closed, no longer accepting connections');
                }
            });
        }

        // Wait for existing connections to drain
        const drainStart = Date.now();
        while (this.connections.size > 0 && Date.now() - drainStart < this.shutdownTimeout) {
            logger.info(`Waiting for ${this.connections.size} connections to close`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Force close remaining connections
        if (this.connections.size > 0) {
            logger.warn(`Forcing close of ${this.connections.size} remaining connections`);
            for (const conn of this.connections) {
                conn.destroy();
            }
        }

        // Cleanup tasks
        await this.cleanup();

        logger.info('Graceful shutdown complete');
        process.exit(0);
    }

    private async cleanup(): Promise<void> {
        // Add cleanup tasks here (close DB connections, flush logs, etc.)
        try {
            // Example: close database connections
            // await db.close();

            // Flush logging buffers
            await new Promise(resolve => setTimeout(resolve, 500));

            logger.info('Cleanup complete');
        } catch (error) {
            logger.error('Cleanup error', { error });
        }
    }

    getState(): { isShuttingDown: boolean; activeConnections: number } {
        return {
            isShuttingDown: state.isShuttingDown,
            activeConnections: this.connections.size,
        };
    }
}

// Default health checks
export function setupDefaultHealthChecks(dependencies: {
    checkDatabase?: () => Promise<boolean>;
    checkStorageNodes?: () => Promise<{ online: number; total: number }>;
    checkRedis?: () => Promise<boolean>;
}): void {
    // Database health check
    if (dependencies.checkDatabase) {
        registerHealthCheck('database', async () => {
            try {
                const isHealthy = await dependencies.checkDatabase!();
                return { status: isHealthy ? 'healthy' : 'unhealthy' };
            } catch (error: any) {
                return { status: 'unhealthy', message: error.message };
            }
        });
    }

    // Storage nodes health check
    if (dependencies.checkStorageNodes) {
        registerHealthCheck('storage_nodes', async () => {
            try {
                const { online, total } = await dependencies.checkStorageNodes!();
                if (online === total) return { status: 'healthy', message: `${online}/${total} nodes online` };
                if (online >= 4) return { status: 'degraded', message: `${online}/${total} nodes online` };
                return { status: 'unhealthy', message: `${online}/${total} nodes online` };
            } catch (error: any) {
                return { status: 'unhealthy', message: error.message };
            }
        });
    }

    // Redis health check
    if (dependencies.checkRedis) {
        registerHealthCheck('redis', async () => {
            try {
                const isHealthy = await dependencies.checkRedis!();
                return { status: isHealthy ? 'healthy' : 'degraded', message: isHealthy ? 'Connected' : 'Disconnected' };
            } catch (error: any) {
                return { status: 'degraded', message: error.message };
            }
        });
    }

    // Memory health check
    registerHealthCheck('memory', async () => {
        const mem = process.memoryUsage();
        const heapUsedMB = mem.heapUsed / 1024 / 1024;
        const heapTotalMB = mem.heapTotal / 1024 / 1024;
        const usagePercent = (heapUsedMB / heapTotalMB) * 100;

        if (usagePercent > 90) {
            return { status: 'unhealthy', message: `Heap usage: ${usagePercent.toFixed(1)}%` };
        }
        if (usagePercent > 75) {
            return { status: 'degraded', message: `Heap usage: ${usagePercent.toFixed(1)}%` };
        }
        return { status: 'healthy', message: `Heap usage: ${usagePercent.toFixed(1)}%` };
    });
}

export const gracefulShutdown = new GracefulShutdown();
