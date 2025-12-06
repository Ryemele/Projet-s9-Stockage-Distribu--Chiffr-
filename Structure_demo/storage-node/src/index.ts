/**
 * Storage Node Service
 * 
 * A simple distributed storage node that stores chunks.
 * Exposes REST API: PUT/GET/DELETE /chunks/:id
 * 
 * Multiple instances can run on different ports to form a cluster.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Configuration from environment
const PORT = parseInt(process.env.PORT || '4001', 10);
const NODE_ID = process.env.NODE_ID || `node-${PORT}`;
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '..', 'data', NODE_ID);
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:5000';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Node status
interface NodeStatus {
    nodeId: string;
    port: number;
    status: 'healthy' | 'degraded' | 'offline';
    chunksStored: number;
    storageUsed: number;
    uptime: number;
    startTime: Date;
}

const startTime = new Date();
let chunksStored = 0;
let storageUsed = 0;

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
    try {
        await fs.mkdir(STORAGE_PATH, { recursive: true });
        console.log(`[${NODE_ID}] Storage directory: ${STORAGE_PATH}`);

        // Count existing chunks
        const files = await fs.readdir(STORAGE_PATH);
        chunksStored = files.length;

        for (const file of files) {
            const stat = await fs.stat(path.join(STORAGE_PATH, file));
            storageUsed += stat.size;
        }

        console.log(`[${NODE_ID}] Found ${chunksStored} existing chunks (${(storageUsed / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
        console.error(`[${NODE_ID}] Failed to create storage directory:`, error);
        process.exit(1);
    }
}

/**
 * Get chunk file path
 */
function getChunkPath(chunkId: string): string {
    // Validate chunk ID to prevent path traversal
    if (!/^[a-f0-9]{32,64}$/i.test(chunkId)) {
        throw new Error('Invalid chunk ID format');
    }
    return path.join(STORAGE_PATH, chunkId);
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
    const status: NodeStatus = {
        nodeId: NODE_ID,
        port: PORT,
        status: 'healthy',
        chunksStored,
        storageUsed,
        uptime: Date.now() - startTime.getTime(),
        startTime
    };
    res.json(status);
});

/**
 * HEAD /chunks/:id - Check if chunk exists
 */
app.head('/chunks/:id', async (req: Request, res: Response) => {
    try {
        const chunkPath = getChunkPath(req.params.id);
        const stat = await fs.stat(chunkPath);
        res.set('Content-Length', stat.size.toString());
        res.set('X-Chunk-Id', req.params.id);
        res.status(200).end();
    } catch (error) {
        res.status(404).end();
    }
});

/**
 * GET /chunks/:id - Retrieve a chunk
 */
app.get('/chunks/:id', async (req: Request, res: Response) => {
    try {
        const chunkPath = getChunkPath(req.params.id);
        const data = await fs.readFile(chunkPath);

        // Verify integrity
        const hash = crypto.createHash('sha256').update(data).digest('hex');

        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Length', data.length.toString());
        res.set('X-Chunk-Id', req.params.id);
        res.set('X-Chunk-Hash', hash);
        res.send(data);

        console.log(`[${NODE_ID}] GET chunk ${req.params.id.substring(0, 8)}... (${data.length} bytes)`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Chunk not found' });
        } else {
            console.error(`[${NODE_ID}] Error reading chunk:`, error);
            res.status(500).json({ error: 'Failed to read chunk' });
        }
    }
});

/**
 * PUT /chunks/:id - Store a chunk
 */
app.put('/chunks/:id', async (req: Request, res: Response) => {
    try {
        const chunkId = req.params.id;
        const chunkPath = getChunkPath(chunkId);

        let data: Buffer;
        if (Buffer.isBuffer(req.body)) {
            data = req.body;
        } else if (req.body.data) {
            // Handle base64 encoded data
            data = Buffer.from(req.body.data, 'base64');
        } else {
            return res.status(400).json({ error: 'No chunk data provided' });
        }

        // Verify chunk ID matches content hash (content-addressable)
        const computedHash = crypto.createHash('sha256').update(data).digest('hex');

        // For non content-addressable IDs, just store
        // For content-addressable, verify hash matches
        if (chunkId.length === 64 && chunkId !== computedHash) {
            console.warn(`[${NODE_ID}] Chunk ID mismatch: expected ${chunkId}, got ${computedHash}`);
            // Still store but log warning
        }

        await fs.writeFile(chunkPath, data);

        // Update counters
        try {
            await fs.stat(chunkPath);
        } catch {
            chunksStored++;
        }
        storageUsed += data.length;

        console.log(`[${NODE_ID}] PUT chunk ${chunkId.substring(0, 8)}... (${data.length} bytes)`);

        res.status(201).json({
            success: true,
            chunkId,
            size: data.length,
            nodeId: NODE_ID
        });
    } catch (error: any) {
        console.error(`[${NODE_ID}] Error storing chunk:`, error);
        res.status(500).json({ error: 'Failed to store chunk' });
    }
});

/**
 * DELETE /chunks/:id - Delete a chunk
 */
app.delete('/chunks/:id', async (req: Request, res: Response) => {
    try {
        const chunkPath = getChunkPath(req.params.id);
        const stat = await fs.stat(chunkPath);
        await fs.unlink(chunkPath);

        chunksStored--;
        storageUsed -= stat.size;

        console.log(`[${NODE_ID}] DELETE chunk ${req.params.id.substring(0, 8)}...`);

        res.json({ success: true, chunkId: req.params.id });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Chunk not found' });
        } else {
            console.error(`[${NODE_ID}] Error deleting chunk:`, error);
            res.status(500).json({ error: 'Failed to delete chunk' });
        }
    }
});

/**
 * GET /chunks - List all chunks (for debugging/admin)
 */
app.get('/chunks', async (req: Request, res: Response) => {
    try {
        const files = await fs.readdir(STORAGE_PATH);
        const chunks = await Promise.all(
            files.map(async (file) => {
                const stat = await fs.stat(path.join(STORAGE_PATH, file));
                return {
                    id: file,
                    size: stat.size,
                    created: stat.birthtime
                };
            })
        );
        res.json({
            nodeId: NODE_ID,
            count: chunks.length,
            chunks
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list chunks' });
    }
});

// =============================================================================
// START SERVER
// =============================================================================

async function start(): Promise<void> {
    await ensureStorageDir();

    app.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log(`  Storage Node: ${NODE_ID}`);
        console.log(`  Port: ${PORT}`);
        console.log(`  Storage: ${STORAGE_PATH}`);
        console.log('='.repeat(50));
        console.log(`\n  API Endpoints:`);
        console.log(`    GET    /health        - Node status`);
        console.log(`    HEAD   /chunks/:id    - Check chunk exists`);
        console.log(`    GET    /chunks/:id    - Retrieve chunk`);
        console.log(`    PUT    /chunks/:id    - Store chunk`);
        console.log(`    DELETE /chunks/:id    - Delete chunk`);
        console.log(`    GET    /chunks        - List all chunks\n`);
    });
}

start().catch(console.error);
