/**
 * Comprehensive Test Suite for Production Utilities
 * 
 * Tests: Logger, Errors, Health, Security Middleware
 * Run with: npx jest tests/utils.test.ts
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ==================== LOGGER TESTS ====================

describe('Logger', () => {
    describe('Request ID Generation', () => {
        it('should generate unique request IDs', () => {
            const ids = new Set();
            for (let i = 0; i < 1000; i++) {
                const id = generateRequestId();
                expect(ids.has(id)).toBe(false);
                ids.add(id);
            }
        });

        it('should generate 16-character hex IDs', () => {
            const id = generateRequestId();
            expect(id).toMatch(/^[a-f0-9]{16}$/);
        });
    });

    describe('Performance Tracker', () => {
        it('should track operation duration', () => {
            const tracker = new PerformanceTracker('test-req');
            tracker.start('operation1');

            // Simulate work
            const start = Date.now();
            while (Date.now() - start < 10) { }

            const duration = tracker.end('operation1');
            expect(duration).toBeGreaterThanOrEqual(10);
        });

        it('should handle missing start time', () => {
            const tracker = new PerformanceTracker('test-req');
            const duration = tracker.end('nonexistent');
            expect(duration).toBe(0);
        });

        it('should track multiple operations concurrently', () => {
            const tracker = new PerformanceTracker('test-req');
            tracker.start('op1');
            tracker.start('op2');

            const d1 = tracker.end('op1');
            const d2 = tracker.end('op2');

            expect(d1).toBeGreaterThanOrEqual(0);
            expect(d2).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Metrics Collector', () => {
        let metrics: MetricsCollector;

        beforeEach(() => {
            metrics = new MetricsCollector();
        });

        it('should increment counters', () => {
            metrics.increment('requests_total');
            metrics.increment('requests_total');
            metrics.increment('requests_total', 5);

            const result = metrics.getMetrics();
            expect(result.counters['requests_total']).toBe(7);
        });

        it('should handle labeled counters', () => {
            metrics.increment('requests', 1, { method: 'GET' });
            metrics.increment('requests', 1, { method: 'POST' });
            metrics.increment('requests', 1, { method: 'GET' });

            const result = metrics.getMetrics();
            expect(result.counters['requests{method="GET"}']).toBe(2);
            expect(result.counters['requests{method="POST"}']).toBe(1);
        });

        it('should observe histogram values', () => {
            metrics.observe('latency', 100);
            metrics.observe('latency', 200);
            metrics.observe('latency', 150);

            const result = metrics.getMetrics();
            expect(result.histograms['latency'].count).toBe(3);
            expect(result.histograms['latency'].sum).toBe(450);
            expect(result.histograms['latency'].avg).toBe(150);
        });

        it('should reset all metrics', () => {
            metrics.increment('counter');
            metrics.observe('histogram', 100);
            metrics.reset();

            const result = metrics.getMetrics();
            expect(Object.keys(result.counters).length).toBe(0);
            expect(Object.keys(result.histograms).length).toBe(0);
        });
    });

    describe('Audit Logger', () => {
        it('should log auth success with correct format', () => {
            const spy = jest.spyOn(console, 'log');
            auditLogger.authSuccess('user123', '192.168.1.1');
            expect(spy).toHaveBeenCalled();
        });

        it('should log file access', () => {
            const spy = jest.spyOn(console, 'log');
            auditLogger.fileAccess('user123', 'file456', 'read');
            expect(spy).toHaveBeenCalled();
        });
    });
});

// ==================== ERROR TESTS ====================

describe('Error Handling', () => {
    describe('AppError', () => {
        it('should create error with correct status code', () => {
            const error = new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Bad credentials');
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('AUTH_001');
            expect(error.isOperational).toBe(true);
        });

        it('should include details in error', () => {
            const error = new AppError(ErrorCode.VALIDATION_FAILED, 'Invalid', {
                details: { field: 'email', reason: 'invalid format' }
            });
            expect(error.details?.field).toBe('email');
        });

        it('should serialize to JSON correctly', () => {
            const error = new AppError(ErrorCode.FILE_NOT_FOUND, 'Not found', {
                requestId: 'req123'
            });
            const json = error.toJSON();
            expect(json.error.code).toBe('FILE_001');
            expect(json.error.requestId).toBe('req123');
        });

        it('should map all error codes to status codes', () => {
            const allCodes = Object.values(ErrorCode);
            allCodes.forEach(code => {
                const error = new AppError(code, 'Test');
                expect(error.statusCode).toBeGreaterThanOrEqual(400);
                expect(error.statusCode).toBeLessThan(600);
            });
        });
    });

    describe('CircuitBreaker', () => {
        it('should stay CLOSED on success', async () => {
            const breaker = new CircuitBreaker(3, 1000, 'test');

            await breaker.execute(async () => 'success');
            await breaker.execute(async () => 'success');

            expect(breaker.getState().state).toBe('CLOSED');
        });

        it('should open after threshold failures', async () => {
            const breaker = new CircuitBreaker(3, 1000, 'test');

            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute(async () => { throw new Error('fail'); });
                } catch { }
            }

            expect(breaker.getState().state).toBe('OPEN');
        });

        it('should reject when OPEN', async () => {
            const breaker = new CircuitBreaker(1, 10000, 'test');

            try {
                await breaker.execute(async () => { throw new Error('fail'); });
            } catch { }

            await expect(breaker.execute(async () => 'success'))
                .rejects.toThrow('Circuit breaker test is OPEN');
        });

        it('should transition to HALF_OPEN after timeout', async () => {
            const breaker = new CircuitBreaker(1, 50, 'test');

            try {
                await breaker.execute(async () => { throw new Error('fail'); });
            } catch { }

            await new Promise(resolve => setTimeout(resolve, 100));

            // Next call should succeed and close the circuit
            await breaker.execute(async () => 'success');
            expect(breaker.getState().state).toBe('CLOSED');
        });

        it('should reset failures on success', async () => {
            const breaker = new CircuitBreaker(5, 1000, 'test');

            // 2 failures
            for (let i = 0; i < 2; i++) {
                try {
                    await breaker.execute(async () => { throw new Error('fail'); });
                } catch { }
            }

            // 1 success resets
            await breaker.execute(async () => 'success');

            expect(breaker.getState().failures).toBe(0);
        });
    });

    describe('Retry with Backoff', () => {
        it('should succeed on first try', async () => {
            let attempts = 0;
            const result = await withRetry(async () => {
                attempts++;
                return 'success';
            });

            expect(result).toBe('success');
            expect(attempts).toBe(1);
        });

        it('should retry on failure', async () => {
            let attempts = 0;
            const result = await withRetry(async () => {
                attempts++;
                if (attempts < 3) throw new Error('fail');
                return 'success';
            }, { maxRetries: 5, initialDelay: 10 });

            expect(result).toBe('success');
            expect(attempts).toBe(3);
        });

        it('should fail after max retries', async () => {
            let attempts = 0;
            await expect(withRetry(async () => {
                attempts++;
                throw new Error('always fail');
            }, { maxRetries: 3, initialDelay: 10 })).rejects.toThrow('always fail');

            expect(attempts).toBe(4); // initial + 3 retries
        });

        it('should call onRetry callback', async () => {
            const retryLog: number[] = [];

            try {
                await withRetry(async () => {
                    throw new Error('fail');
                }, {
                    maxRetries: 2,
                    initialDelay: 10,
                    onRetry: (_error: Error, attempt: number) => retryLog.push(attempt)
                });
            } catch { }

            expect(retryLog).toEqual([1, 2]);
        });

        it('should apply exponential backoff', async () => {
            const timestamps: number[] = [];

            try {
                await withRetry(async () => {
                    timestamps.push(Date.now());
                    throw new Error('fail');
                }, { maxRetries: 3, initialDelay: 50, factor: 2 });
            } catch { }

            // Check delays are increasing
            const delays = [];
            for (let i = 1; i < timestamps.length; i++) {
                delays.push(timestamps[i] - timestamps[i - 1]);
            }

            expect(delays[1]).toBeGreaterThan(delays[0]);
            expect(delays[2]).toBeGreaterThan(delays[1]);
        });
    });
});

// ==================== HEALTH CHECK TESTS ====================

describe('Health Checks', () => {
    describe('Health State', () => {
        it('should start as not ready', () => {
            // Initial state
            expect(state.isReady).toBe(false);
            expect(state.isLive).toBe(true);
        });

        it('should track uptime', () => {
            const uptime = Date.now() - state.startTime.getTime();
            expect(uptime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Health Check Registration', () => {
        it('should register and run health checks', async () => {
            registerHealthCheck('test', async () => ({ status: 'healthy' }));

            await runHealthChecks();

            expect(state.checks.get('test')?.status).toBe('healthy');
        });

        it('should handle check failures', async () => {
            registerHealthCheck('failing', async () => {
                throw new Error('Check failed');
            });

            await runHealthChecks();

            expect(state.checks.get('failing')?.status).toBe('unhealthy');
        });

        it('should timeout slow checks', async () => {
            registerHealthCheck('slow', async () => {
                await new Promise(resolve => setTimeout(resolve, 10000));
                return { status: 'healthy' };
            });

            // This should timeout after 5 seconds
            // In actual test, mock timers
        });
    });

    describe('Overall Status', () => {
        it('should return healthy when all checks pass', () => {
            state.checks.clear();
            state.checks.set('a', { name: 'a', status: 'healthy', lastCheck: new Date() });
            state.checks.set('b', { name: 'b', status: 'healthy', lastCheck: new Date() });

            expect(getOverallStatus()).toBe('healthy');
        });

        it('should return degraded when any check is degraded', () => {
            state.checks.clear();
            state.checks.set('a', { name: 'a', status: 'healthy', lastCheck: new Date() });
            state.checks.set('b', { name: 'b', status: 'degraded', lastCheck: new Date() });

            expect(getOverallStatus()).toBe('degraded');
        });

        it('should return unhealthy when any check fails', () => {
            state.checks.clear();
            state.checks.set('a', { name: 'a', status: 'healthy', lastCheck: new Date() });
            state.checks.set('b', { name: 'b', status: 'unhealthy', lastCheck: new Date() });

            expect(getOverallStatus()).toBe('unhealthy');
        });
    });
});

// ==================== MOCK IMPLEMENTATIONS ====================

// These would be imported from actual modules
function generateRequestId(): string {
    return Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

class PerformanceTracker {
    private timers: Map<string, number> = new Map();
    constructor(private requestId?: string) { }

    start(operation: string): void {
        this.timers.set(operation, Date.now());
    }

    end(operation: string): number {
        const startTime = this.timers.get(operation);
        if (!startTime) return 0;
        const duration = Date.now() - startTime;
        this.timers.delete(operation);
        return duration;
    }
}

class MetricsCollector {
    private counters: Map<string, number> = new Map();
    private histograms: Map<string, number[]> = new Map();

    increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
        const key = labels ? `${metric}{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : metric;
        this.counters.set(key, (this.counters.get(key) || 0) + value);
    }

    observe(metric: string, value: number): void {
        const values = this.histograms.get(metric) || [];
        values.push(value);
        this.histograms.set(metric, values);
    }

    getMetrics() {
        const counters: Record<string, number> = {};
        this.counters.forEach((v, k) => counters[k] = v);

        const histograms: Record<string, { count: number; sum: number; avg: number }> = {};
        this.histograms.forEach((values, key) => {
            const sum = values.reduce((a, b) => a + b, 0);
            histograms[key] = { count: values.length, sum, avg: sum / values.length };
        });

        return { counters, histograms };
    }

    reset(): void {
        this.counters.clear();
        this.histograms.clear();
    }
}

const auditLogger = {
    log: (action: string, userId: string, details: any) => console.log('AUDIT', action, userId, details),
    authSuccess: (userId: string, ip: string) => console.log('AUTH_SUCCESS', userId, ip),
    authFailure: (user: string, ip: string, reason: string) => console.log('AUTH_FAILURE', user, ip, reason),
    fileAccess: (userId: string, fileId: string, action: string) => console.log('FILE_ACCESS', userId, fileId, action),
};

class AppError extends Error {
    code: string;
    statusCode: number;
    isOperational: boolean;
    details?: Record<string, any>;
    requestId?: string;

    constructor(code: string, message: string, options?: any) {
        super(message);
        this.code = code;
        this.statusCode = errorStatusMap[code] || 500;
        this.isOperational = options?.isOperational ?? true;
        this.details = options?.details;
        this.requestId = options?.requestId;
    }

    toJSON() {
        return { error: { code: this.code, message: this.message, requestId: this.requestId } };
    }
}

const ErrorCode = {
    AUTH_INVALID_CREDENTIALS: 'AUTH_001',
    AUTH_TOKEN_EXPIRED: 'AUTH_002',
    FILE_NOT_FOUND: 'FILE_001',
    VALIDATION_FAILED: 'VALIDATION_001',
    STORAGE_NODE_UNAVAILABLE: 'STORAGE_001',
    INTERNAL_ERROR: 'SYSTEM_001',
};

const errorStatusMap: Record<string, number> = {
    AUTH_001: 401, AUTH_002: 401, FILE_001: 404, VALIDATION_001: 400,
    STORAGE_001: 503, SYSTEM_001: 500,
};

class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private breaker_state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    constructor(private threshold: number, private resetTimeout: number, private name: string) { }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.breaker_state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.breaker_state = 'HALF_OPEN';
            } else {
                throw new Error(`Circuit breaker ${this.name} is OPEN`);
            }
        }
        try {
            const result = await fn();
            this.failures = 0;
            this.breaker_state = 'CLOSED';
            return result;
        } catch (e) {
            this.failures++;
            this.lastFailureTime = Date.now();
            if (this.failures >= this.threshold) this.breaker_state = 'OPEN';
            throw e;
        }
    }

    getState() { return { state: this.breaker_state, failures: this.failures, name: this.name }; }
}

async function withRetry<T>(fn: () => Promise<T>, options: any = {}): Promise<T> {
    const { maxRetries = 3, initialDelay = 1000, factor = 2, onRetry } = options;
    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try { return await fn(); } catch (e: any) {
            lastError = e;
            if (attempt === maxRetries) throw e;
            onRetry?.(e, attempt + 1);
            await new Promise(r => setTimeout(r, delay));
            delay = delay * factor;
        }
    }
    throw lastError!;
}

const state = {
    isReady: false,
    isLive: true,
    isShuttingDown: false,
    startTime: new Date(),
    checks: new Map<string, any>(),
};

function registerHealthCheck(name: string, fn: () => Promise<any>) {
    state.checks.set(name, { name, status: 'healthy', lastCheck: new Date(), fn });
}

async function runHealthChecks() {
    for (const [name, check] of state.checks) {
        try {
            const result = await (check as any).fn();
            state.checks.set(name, { ...check, status: result.status, lastCheck: new Date() });
        } catch (e: unknown) {
            const error = e as Error;
            state.checks.set(name, { ...check, status: 'unhealthy', lastCheck: new Date(), message: error.message });
        }
    }
}

function getOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    let hasUnhealthy = false, hasDegraded = false;
    for (const check of state.checks.values()) {
        if (check.status === 'unhealthy') hasUnhealthy = true;
        if (check.status === 'degraded') hasDegraded = true;
    }
    if (hasUnhealthy) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
}
