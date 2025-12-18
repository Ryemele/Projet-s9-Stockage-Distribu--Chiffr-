/**
 * Production Logger Service
 * 
 * Structured logging with Winston for production-grade observability.
 * Features: JSON format, request tracking, performance metrics, log levels
 */

import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Custom log levels with severity
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    return env === 'development' ? 'debug' : 'info';
};

// Production format: JSON with metadata
const productionFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Development format: colorized console output
const developmentFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
        const reqId = requestId ? `[${requestId}]` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level} ${reqId} ${message}${metaStr}`;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: level(),
    levels,
    format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    defaultMeta: { service: 'secure-storage' },
    transports: [
        // Console transport
        new winston.transports.Console(),

        // File transport for errors (production)
        ...(process.env.NODE_ENV === 'production' ? [
            new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
            }),
            new winston.transports.File({
                filename: 'logs/combined.log',
                maxsize: 50 * 1024 * 1024, // 50MB
                maxFiles: 10,
            }),
        ] : []),
    ],
    exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    rejectionHandlers: [
        new winston.transports.File({ filename: 'logs/rejections.log' }),
    ],
});

// Request ID generator
export function generateRequestId(): string {
    return crypto.randomBytes(8).toString('hex');
}

// Create child logger with request context
export function createRequestLogger(requestId: string) {
    return logger.child({ requestId });
}

// Express middleware for request logging
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Attach to request for use in handlers
    (req as any).requestId = requestId;
    (req as any).logger = createRequestLogger(requestId);

    // Log request start
    logger.http('Request started', {
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });

    // Log response on finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';

        logger.log(logLevel, 'Request completed', {
            requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            contentLength: res.get('content-length'),
        });
    });

    next();
}

// Performance tracking
export class PerformanceTracker {
    private timers: Map<string, number> = new Map();
    private requestId?: string;

    constructor(requestId?: string) {
        this.requestId = requestId;
    }

    start(operation: string): void {
        this.timers.set(operation, Date.now());
    }

    end(operation: string, metadata?: Record<string, any>): number {
        const startTime = this.timers.get(operation);
        if (!startTime) {
            logger.warn(`No start time found for operation: ${operation}`, { requestId: this.requestId });
            return 0;
        }

        const duration = Date.now() - startTime;
        this.timers.delete(operation);

        logger.info(`Operation completed: ${operation}`, {
            requestId: this.requestId,
            operation,
            duration,
            ...metadata,
        });

        return duration;
    }
}

// Audit logger for security-sensitive operations
export const auditLogger = {
    log(action: string, userId: string, details: Record<string, any>) {
        logger.info('AUDIT', {
            type: 'audit',
            action,
            userId,
            timestamp: new Date().toISOString(),
            ...details,
        });
    },

    authSuccess(userId: string, ip: string) {
        this.log('AUTH_SUCCESS', userId, { ip });
    },

    authFailure(attemptedUser: string, ip: string, reason: string) {
        this.log('AUTH_FAILURE', attemptedUser, { ip, reason });
    },

    fileAccess(userId: string, fileId: string, action: 'read' | 'write' | 'delete' | 'share') {
        this.log('FILE_ACCESS', userId, { fileId, action });
    },

    reEncryption(fromUserId: string, toUserId: string, fileId: string) {
        this.log('RE_ENCRYPTION', fromUserId, { toUserId, fileId });
    },

    adminAction(adminId: string, action: string, targetId?: string) {
        this.log('ADMIN_ACTION', adminId, { action, targetId });
    },
};

// Metrics collector (Prometheus-compatible structure)
export class MetricsCollector {
    private counters: Map<string, number> = new Map();
    private histograms: Map<string, number[]> = new Map();

    increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
        const key = this.buildKey(metric, labels);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + value);
    }

    observe(metric: string, value: number, labels?: Record<string, string>): void {
        const key = this.buildKey(metric, labels);
        const values = this.histograms.get(key) || [];
        values.push(value);
        this.histograms.set(key, values);
    }

    private buildKey(metric: string, labels?: Record<string, string>): string {
        if (!labels) return metric;
        const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
        return `${metric}{${labelStr}}`;
    }

    getMetrics(): { counters: Record<string, number>; histograms: Record<string, { count: number; sum: number; avg: number }> } {
        const counters: Record<string, number> = {};
        this.counters.forEach((v, k) => counters[k] = v);

        const histograms: Record<string, { count: number; sum: number; avg: number }> = {};
        this.histograms.forEach((values, key) => {
            const sum = values.reduce((a, b) => a + b, 0);
            histograms[key] = {
                count: values.length,
                sum,
                avg: values.length > 0 ? sum / values.length : 0,
            };
        });

        return { counters, histograms };
    }

    reset(): void {
        this.counters.clear();
        this.histograms.clear();
    }
}

// Global metrics instance
export const metrics = new MetricsCollector();

// Pre-defined metrics
export const Metrics = {
    // Request metrics
    requestsTotal: (method: string, path: string, status: number) =>
        metrics.increment('http_requests_total', 1, { method, path, status: String(status) }),
    requestDuration: (method: string, path: string, duration: number) =>
        metrics.observe('http_request_duration_ms', duration, { method, path }),

    // Encryption metrics
    encryptionOps: () => metrics.increment('encryption_operations_total'),
    encryptionDuration: (duration: number) => metrics.observe('encryption_duration_ms', duration),
    encryptionErrors: () => metrics.increment('encryption_errors_total'),

    // Storage metrics
    chunksStored: (nodeId: string) => metrics.increment('chunks_stored_total', 1, { nodeId }),
    chunksDeduplicated: () => metrics.increment('chunks_deduplicated_total'),
    storageBytes: (nodeId: string, bytes: number) => metrics.observe('storage_bytes', bytes, { nodeId }),

    // HSM metrics
    reEncryptionOps: () => metrics.increment('re_encryption_operations_total'),
    reEncryptionDuration: (duration: number) => metrics.observe('re_encryption_duration_ms', duration),
};

export default logger;
