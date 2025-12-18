/**
 * Security Middleware
 * 
 * Production-grade security features:
 * - Advanced rate limiting
 * - Input validation
 * - Security headers
 * - Audit logging
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import logger, { auditLogger } from '../utils/logger';
import { ValidationError, AuthenticationError, ErrorCode } from '../utils/errors';

// Rate limiter configurations
export const rateLimiters = {
    // General API rate limit
    general: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        message: { error: { code: 'AUTH_005', message: 'Too many requests' } },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
        },
        handler: (req, res) => {
            auditLogger.log('RATE_LIMITED', 'anonymous', { ip: req.ip, path: req.path });
            res.status(429).json({ error: { code: 'AUTH_005', message: 'Too many requests. Please try again later.' } });
        },
    }),

    // Strict rate limit for authentication
    auth: rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: { error: { code: 'AUTH_005', message: 'Too many login attempts' } },
        skipSuccessfulRequests: true,
        keyGenerator: (req) => {
            return `auth:${req.ip}:${req.body?.email || 'unknown'}`;
        },
        handler: (req, res) => {
            auditLogger.authFailure(req.body?.email || 'unknown', req.ip || '', 'rate_limited');
            res.status(429).json({ error: { code: 'AUTH_005', message: 'Too many login attempts. Account temporarily locked.' } });
        },
    }),

    // Upload rate limit (per user)
    upload: rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50,
        message: { error: { code: 'AUTH_005', message: 'Upload limit exceeded' } },
        keyGenerator: (req) => {
            return `upload:${(req as any).user?.id || req.ip}`;
        },
    }),

    // Download rate limit
    download: rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 100,
        keyGenerator: (req) => {
            return `download:${(req as any).user?.id || req.ip}`;
        },
    }),

    // Share rate limit (sensitive operation)
    share: rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 20,
        keyGenerator: (req) => {
            return `share:${(req as any).user?.id || req.ip}`;
        },
    }),
};

// Security headers configuration
export const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "https://localhost:3000"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

// Input validation rules
export const validators = {
    // Auth validators
    register: [
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password')
            .isLength({ min: 12 })
            .withMessage('Password must be at least 12 characters')
            .matches(/[A-Z]/).withMessage('Password must contain uppercase')
            .matches(/[a-z]/).withMessage('Password must contain lowercase')
            .matches(/[0-9]/).withMessage('Password must contain number')
            .matches(/[^A-Za-z0-9]/).withMessage('Password must contain special character'),
        body('name').trim().isLength({ min: 2, max: 100 }).escape(),
    ],

    login: [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty(),
    ],

    // File validators
    fileId: [
        param('id').isUUID().withMessage('Invalid file ID format'),
    ],

    upload: [
        body('fileName').trim().isLength({ min: 1, max: 255 }).escape(),
        body('fileSize').isInt({ min: 1, max: 5 * 1024 * 1024 * 1024 }).withMessage('File too large'),
        body('mimeType').matches(/^[a-z]+\/[a-z0-9\-\+\.]+$/i).withMessage('Invalid MIME type'),
    ],

    // Share validators
    share: [
        body('recipientEmail').isEmail().normalizeEmail(),
        body('permissions').isIn(['read', 'read-write']),
        body('expiresAt').optional().isISO8601(),
    ],

    // Pagination
    pagination: [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('sortBy').optional().isIn(['name', 'size', 'createdAt', 'updatedAt']),
        query('order').optional().isIn(['asc', 'desc']),
    ],
};

// Validation middleware factory
export function validate(validations: ValidationChain[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const details = errors.array().reduce((acc, err: any) => {
                acc[err.path] = err.msg;
                return acc;
            }, {} as Record<string, string>);

            logger.warn('Validation failed', {
                requestId: (req as any).requestId,
                path: req.path,
                errors: details,
            });

            throw new ValidationError('Validation failed', details, { requestId: (req as any).requestId });
        }
        next();
    };
}

// IP whitelist/blacklist middleware
export function ipFilter(options: { whitelist?: string[]; blacklist?: string[] }) {
    return (req: Request, res: Response, next: NextFunction) => {
        const clientIp = req.ip || req.headers['x-forwarded-for'] as string;

        if (options.blacklist?.includes(clientIp)) {
            auditLogger.log('IP_BLOCKED', 'anonymous', { ip: clientIp, reason: 'blacklist' });
            return res.status(403).json({ error: { message: 'Access denied' } });
        }

        if (options.whitelist && !options.whitelist.includes(clientIp)) {
            auditLogger.log('IP_BLOCKED', 'anonymous', { ip: clientIp, reason: 'not_in_whitelist' });
            return res.status(403).json({ error: { message: 'Access denied' } });
        }

        next();
    };
}

// Request sanitization
export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
    // Remove null bytes
    const sanitize = (obj: any): any => {
        if (typeof obj === 'string') {
            return obj.replace(/\0/g, '');
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }
        if (obj && typeof obj === 'object') {
            return Object.fromEntries(
                Object.entries(obj).map(([k, v]) => [k, sanitize(v)])
            );
        }
        return obj;
    };

    req.body = sanitize(req.body);
    req.query = sanitize(req.query);
    req.params = sanitize(req.params);

    next();
}

// Sensitive data masking for logs
export function maskSensitiveData(data: any): any {
    const sensitiveFields = ['password', 'token', 'secretKey', 'privateKey', 'apiKey', 'authorization'];

    const mask = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;

        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => {
                if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
                    return [key, '***REDACTED***'];
                }
                if (typeof value === 'object') {
                    return [key, mask(value)];
                }
                return [key, value];
            })
        );
    };

    return mask(data);
}

// CORS configuration for production
export const corsConfig = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
            'http://localhost:5173',
            'https://localhost:5173',
        ];

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    maxAge: 86400,
};
