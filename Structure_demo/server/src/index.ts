import 'dotenv/config';
import express from 'express';
import https from 'https';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import selfsigned from 'selfsigned';
import rateLimit from 'express-rate-limit';
import { initDB } from './db';
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import userRoutes from './routes/users';
import distributedRoutes from './routes/distributed';
import { nodeManager } from './services/nodeManager';

// SECURITY: Check required environment variables
if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable must be set!');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'https://localhost:5173'];

// SECURITY: Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { message: 'Too many authentication attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
        }
    }
}));

// SECURITY: Configure CORS with specific origins
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '100mb' })); // Reduced from 500mb to 100mb
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Apply general rate limiter to all routes
app.use(generalLimiter);

// Routes with specific rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/distributed', distributedRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cluster status (for distributed storage monitoring)
app.get('/cluster', (req, res) => {
    const status = nodeManager.getClusterStatus();
    res.json(status);
});

// Initialize DB and Start Server
const startServer = async () => {
    try {
        await initDB();

        // Initialize node manager and start monitoring
        nodeManager.registerDefaultNodes();
        nodeManager.startMonitoring();
        console.log('Node manager initialized with 6 storage nodes');

        // Generate self-signed certs for HTTPS
        const attrs = [{ name: 'commonName', value: 'localhost' }];
        const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048 });

        const httpsOptions = {
            key: pems.private,
            cert: pems.cert
        };

        https.createServer(httpsOptions, app).listen(PORT, () => {
            console.log(`Secure Server running on https://localhost:${PORT}`);
            console.log(`Distributed storage API: /api/distributed`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

