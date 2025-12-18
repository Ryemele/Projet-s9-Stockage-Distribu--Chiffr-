/**
 * Production Error Handling
 * 
 * Centralized error classes with proper typing and handling.
 * Features: Error codes, HTTP status mapping, error serialization
 */

// Error codes enum
export const ErrorCode = {
    // Authentication errors (1xxx)
    AUTH_INVALID_CREDENTIALS: 'AUTH_001',
    AUTH_TOKEN_EXPIRED: 'AUTH_002',
    AUTH_TOKEN_INVALID: 'AUTH_003',
    AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_004',
    AUTH_RATE_LIMITED: 'AUTH_005',

    // File errors (2xxx)
    FILE_NOT_FOUND: 'FILE_001',
    FILE_UPLOAD_FAILED: 'FILE_002',
    FILE_DOWNLOAD_FAILED: 'FILE_003',
    FILE_TOO_LARGE: 'FILE_004',
    FILE_TYPE_NOT_ALLOWED: 'FILE_005',
    FILE_CORRUPTED: 'FILE_006',

    // Encryption errors (3xxx)
    CRYPTO_KEY_GENERATION_FAILED: 'CRYPTO_001',
    CRYPTO_ENCRYPTION_FAILED: 'CRYPTO_002',
    CRYPTO_DECRYPTION_FAILED: 'CRYPTO_003',
    CRYPTO_RE_ENCRYPTION_FAILED: 'CRYPTO_004',
    CRYPTO_INVALID_KEY: 'CRYPTO_005',

    // Storage errors (4xxx)
    STORAGE_NODE_UNAVAILABLE: 'STORAGE_001',
    STORAGE_INSUFFICIENT_NODES: 'STORAGE_002',
    STORAGE_CHUNK_NOT_FOUND: 'STORAGE_003',
    STORAGE_RECOVERY_FAILED: 'STORAGE_004',
    STORAGE_QUOTA_EXCEEDED: 'STORAGE_005',

    // Validation errors (5xxx)
    VALIDATION_FAILED: 'VALIDATION_001',
    VALIDATION_MISSING_FIELD: 'VALIDATION_002',
    VALIDATION_INVALID_FORMAT: 'VALIDATION_003',

    // System errors (9xxx)
    INTERNAL_ERROR: 'SYSTEM_001',
    DATABASE_ERROR: 'SYSTEM_002',
    EXTERNAL_SERVICE_ERROR: 'SYSTEM_003',
    CONFIGURATION_ERROR: 'SYSTEM_004',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

// HTTP status code mapping
const errorStatusMap: Record<string, number> = {
    AUTH_001: 401,
    AUTH_002: 401,
    AUTH_003: 401,
    AUTH_004: 403,
    AUTH_005: 429,
    FILE_001: 404,
    FILE_002: 500,
    FILE_003: 500,
    FILE_004: 413,
    FILE_005: 415,
    FILE_006: 422,
    CRYPTO_001: 500,
    CRYPTO_002: 500,
    CRYPTO_003: 500,
    CRYPTO_004: 500,
    CRYPTO_005: 400,
    STORAGE_001: 503,
    STORAGE_002: 503,
    STORAGE_003: 404,
    STORAGE_004: 500,
    STORAGE_005: 507,
    VALIDATION_001: 400,
    VALIDATION_002: 400,
    VALIDATION_003: 400,
    SYSTEM_001: 500,
    SYSTEM_002: 500,
    SYSTEM_003: 502,
    SYSTEM_004: 500,
};

// Base application error
export class AppError extends Error {
    public readonly code: ErrorCodeType;
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly details?: Record<string, any>;
    public readonly requestId?: string;

    constructor(
        code: ErrorCodeType,
        message: string,
        options?: {
            cause?: Error;
            details?: Record<string, any>;
            requestId?: string;
            isOperational?: boolean;
        }
    ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = errorStatusMap[code] || 500;
        this.isOperational = options?.isOperational ?? true;
        this.details = options?.details;
        this.requestId = options?.requestId;

        if (options?.cause) {
            this.cause = options.cause;
        }

        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            error: {
                code: this.code,
                message: this.message,
                statusCode: this.statusCode,
                details: this.details,
                requestId: this.requestId,
                ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
            },
        };
    }
}

// Specific error classes
export class AuthenticationError extends AppError {
    constructor(message: string, code: ErrorCodeType = ErrorCode.AUTH_INVALID_CREDENTIALS, options?: { requestId?: string }) {
        super(code, message, { ...options, isOperational: true });
        this.name = 'AuthenticationError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, any>, options?: { requestId?: string }) {
        super(ErrorCode.VALIDATION_FAILED, message, { ...options, details, isOperational: true });
        this.name = 'ValidationError';
    }
}

export class FileError extends AppError {
    constructor(code: ErrorCodeType, message: string, options?: { details?: Record<string, any>; requestId?: string }) {
        super(code, message, { ...options, isOperational: true });
        this.name = 'FileError';
    }
}

export class CryptoError extends AppError {
    constructor(code: ErrorCodeType, message: string, options?: { cause?: Error; requestId?: string }) {
        super(code, message, { ...options, isOperational: true });
        this.name = 'CryptoError';
    }
}

export class StorageError extends AppError {
    constructor(code: ErrorCodeType, message: string, options?: { details?: Record<string, any>; requestId?: string }) {
        super(code, message, { ...options, isOperational: true });
        this.name = 'StorageError';
    }
}

// Circuit Breaker implementation
export class CircuitBreaker {
    private failures: number = 0;
    private lastFailureTime: number = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    constructor(
        private readonly threshold: number = 5,
        private readonly resetTimeout: number = 30000,
        private readonly name: string = 'default'
    ) { }

    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new StorageError(
                    ErrorCode.STORAGE_NODE_UNAVAILABLE,
                    `Circuit breaker ${this.name} is OPEN`
                );
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
        }
    }

    getState(): { state: string; failures: number; name: string } {
        return { state: this.state, failures: this.failures, name: this.name };
    }
}

// Retry with exponential backoff
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelay?: number;
        maxDelay?: number;
        factor?: number;
        onRetry?: (error: Error, attempt: number) => void;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        factor = 2,
        onRetry,
    } = options;

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            if (attempt === maxRetries) {
                throw error;
            }

            onRetry?.(error, attempt + 1);

            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * factor, maxDelay);
        }
    }

    throw lastError!;
}

// Express error handling middleware
import { Request, Response, NextFunction } from 'express';
import logger from './logger';

export function errorHandlerMiddleware(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    const requestId = (req as any).requestId;

    if (err instanceof AppError) {
        logger.error('Application error', {
            requestId,
            code: err.code,
            message: err.message,
            statusCode: err.statusCode,
            details: err.details,
            stack: err.stack,
        });

        res.status(err.statusCode).json(err.toJSON());
    } else {
        // Unexpected error
        logger.error('Unexpected error', {
            requestId,
            message: err.message,
            stack: err.stack,
        });

        const internalError = new AppError(
            ErrorCode.INTERNAL_ERROR,
            process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred'
                : err.message,
            { requestId, isOperational: false }
        );

        res.status(500).json(internalError.toJSON());
    }
}

// Async handler wrapper
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
