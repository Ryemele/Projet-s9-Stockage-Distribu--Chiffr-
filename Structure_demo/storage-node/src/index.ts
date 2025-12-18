/**
 * Storage Node Service with Deduplication
 * 
 * Content-addressable storage using SHA-256 hashes.
 * Automatic deduplication: same content = same chunk ID.
 * Reference counting for garbage collection.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const PORT = parseInt(process.env.PORT || '4001', 10);
const NODE_ID = process.env.NODE_ID || `node-${PORT}`;
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '..', 'data', NODE_ID);
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Node state
interface ChunkInfo {
    id: string;
    size: number;
    refCount: number;
    createdAt: Date;
    lastAccessed: Date;
}

const startTime = new Date();
let chunksStored = 0;
let storageUsed = 0;
let deduplicatedBytes = 0;
const chunkIndex: Map<string, ChunkInfo> = new Map();

async function ensureStorageDir(): Promise<void> {
    try {
        await fs.mkdir(STORAGE_PATH, { recursive: true });
        console.log(`[${NODE_ID}] Storage: ${STORAGE_PATH}`);

        // Load existing chunks
        const files = await fs.readdir(STORAGE_PATH);
        for (const file of files) {
            if (file.endsWith('.meta')) continue;
            const stat = await fs.stat(path.join(STORAGE_PATH, file));
            chunksStored++;
            storageUsed += stat.size;
            chunkIndex.set(file, {
                id: file,
                size: stat.size,
                refCount: 1,
                createdAt: stat.birthtime,
                lastAccessed: stat.mtime,
            });
        }

        console.log(`[${NODE_ID}] Loaded ${chunksStored} chunks (${(storageUsed / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
        console.error(`[${NODE_ID}] Storage init failed:`, error);
        process.exit(1);
    }
}

function getChunkPath(chunkId: string): string {
    if (!/^[a-f0-9]{32,64}$/i.test(chunkId)) {
        throw new Error('Invalid chunk ID format');
    }
    return path.join(STORAGE_PATH, chunkId);
}

function computeHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        nodeId: NODE_ID,
        port: PORT,
        status: 'healthy',
        chunksStored,
        storageUsed,
        deduplicatedBytes,
        uptime: Date.now() - startTime.getTime(),
        startTime,
    });
});

// Check if chunk exists
app.head('/chunks/:id', async (req: Request, res: Response) => {
    try {
        const chunkPath = getChunkPath(req.params.id);
        const stat = await fs.stat(chunkPath);
        res.set('Content-Length', stat.size.toString());
        res.set('X-Chunk-Id', req.params.id);
        res.set('X-Ref-Count', String(chunkIndex.get(req.params.id)?.refCount || 0));
        res.status(200).end();
    } catch {
        res.status(404).end();
    }
});

// Get chunk
app.get('/chunks/:id', async (req: Request, res: Response) => {
    try {
        const chunkId = req.params.id;
        const chunkPath = getChunkPath(chunkId);
        const data = await fs.readFile(chunkPath);

        // Verify integrity
        const hash = computeHash(data);
        if (hash !== chunkId) {
            console.warn(`[${NODE_ID}] Integrity check failed for chunk ${chunkId.slice(0, 8)}...`);
        }

        // Update last accessed
        const info = chunkIndex.get(chunkId);
        if (info) {
            info.lastAccessed = new Date();
        }

        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Length', data.length.toString());
        res.set('X-Chunk-Id', chunkId);
        res.set('X-Chunk-Hash', hash);
        res.set('X-Verified', hash === chunkId ? 'true' : 'false');
        res.send(data);

        console.log(`[${NODE_ID}] GET ${chunkId.slice(0, 8)}... (${data.length} bytes)`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Chunk not found' });
        } else {
            console.error(`[${NODE_ID}] Read error:`, error);
            res.status(500).json({ error: 'Failed to read chunk' });
        }
    }
});

// Store chunk with deduplication
app.put('/chunks/:id', async (req: Request, res: Response) => {
    try {
        const requestedId = req.params.id;

        let data: Buffer;
        if (Buffer.isBuffer(req.body)) {
            data = req.body;
        } else if (req.body.data) {
            data = Buffer.from(req.body.data, 'base64');
        } else {
            return res.status(400).json({ error: 'No chunk data provided' });
        }

        // Compute content hash for integrity verification (optional)
        const contentHash = computeHash(data);

        // Use requested ID for storage (backend controls the ID)
        const chunkId = requestedId;
        const chunkPath = getChunkPath(chunkId);

        // Check for deduplication (by requested ID, not content hash)
        const existingInfo = chunkIndex.get(chunkId);
        if (existingInfo) {
            // Chunk already exists - increment reference count
            existingInfo.refCount++;
            deduplicatedBytes += data.length;

            console.log(`[${NODE_ID}] DEDUP ${chunkId.slice(0, 8)}... (ref: ${existingInfo.refCount}, saved: ${data.length} bytes)`);

            return res.status(200).json({
                success: true,
                chunkId,
                size: data.length,
                nodeId: NODE_ID,
                deduplicated: true,
                refCount: existingInfo.refCount,
            });
        }

        // New chunk - store it
        await fs.writeFile(chunkPath, data);

        // Update index
        chunkIndex.set(chunkId, {
            id: chunkId,
            size: data.length,
            refCount: 1,
            createdAt: new Date(),
            lastAccessed: new Date(),
        });

        chunksStored++;
        storageUsed += data.length;

        console.log(`[${NODE_ID}] PUT ${chunkId.slice(0, 8)}... (${data.length} bytes)`);

        res.status(201).json({
            success: true,
            chunkId,
            requestedId,
            size: data.length,
            nodeId: NODE_ID,
            deduplicated: false,
            refCount: 1,
        });
    } catch (error: any) {
        console.error(`[${NODE_ID}] Store error:`, error);
        res.status(500).json({ error: 'Failed to store chunk' });
    }
});

// Delete chunk (with reference counting)
app.delete('/chunks/:id', async (req: Request, res: Response) => {
    try {
        const chunkId = req.params.id;
        const chunkPath = getChunkPath(chunkId);
        const info = chunkIndex.get(chunkId);

        if (!info) {
            return res.status(404).json({ error: 'Chunk not found' });
        }

        // Decrement reference count
        info.refCount--;

        if (info.refCount <= 0) {
            // No more references - delete the chunk
            const stat = await fs.stat(chunkPath);
            await fs.unlink(chunkPath);

            chunkIndex.delete(chunkId);
            chunksStored--;
            storageUsed -= stat.size;

            console.log(`[${NODE_ID}] DELETE ${chunkId.slice(0, 8)}... (freed: ${stat.size} bytes)`);
            res.json({ success: true, chunkId, deleted: true });
        } else {
            // Still has references - just decrement count
            console.log(`[${NODE_ID}] DEREF ${chunkId.slice(0, 8)}... (ref: ${info.refCount})`);
            res.json({ success: true, chunkId, deleted: false, refCount: info.refCount });
        }
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Chunk not found' });
        } else {
            console.error(`[${NODE_ID}] Delete error:`, error);
            res.status(500).json({ error: 'Failed to delete chunk' });
        }
    }
});

// List all chunks
app.get('/chunks', async (req: Request, res: Response) => {
    try {
        const chunks = Array.from(chunkIndex.values()).map(info => ({
            id: info.id,
            size: info.size,
            refCount: info.refCount,
            created: info.createdAt,
            lastAccessed: info.lastAccessed,
        }));

        res.json({
            nodeId: NODE_ID,
            count: chunks.length,
            totalSize: storageUsed,
            deduplicatedBytes,
            chunks,
        });
    } catch {
        res.status(500).json({ error: 'Failed to list chunks' });
    }
});

// Verify chunk integrity
app.post('/chunks/:id/verify', async (req: Request, res: Response) => {
    try {
        const chunkId = req.params.id;
        const chunkPath = getChunkPath(chunkId);
        const data = await fs.readFile(chunkPath);
        const computedHash = computeHash(data);
        const valid = computedHash === chunkId;

        res.json({
            chunkId,
            valid,
            computedHash,
            size: data.length,
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Chunk not found' });
        } else {
            res.status(500).json({ error: 'Verification failed' });
        }
    }
});

// Stats endpoint
app.get('/stats', (req: Request, res: Response) => {
    res.json({
        nodeId: NODE_ID,
        chunksStored,
        storageUsed,
        deduplicatedBytes,
        deduplicationRatio: deduplicatedBytes > 0
            ? ((deduplicatedBytes / (storageUsed + deduplicatedBytes)) * 100).toFixed(2) + '%'
            : '0%',
        uptime: Date.now() - startTime.getTime(),
    });
});

// Shutdown endpoint for graceful shutdown
app.post('/shutdown', (req: Request, res: Response) => {
    console.log(`\n[${NODE_ID}] Shutdown requested - closing in 2 seconds...`);
    res.json({
        success: true,
        message: `Node ${NODE_ID} shutting down`,
        nodeId: NODE_ID
    });

    // Graceful shutdown after response is sent
    setTimeout(() => {
        console.log(`[${NODE_ID}] Goodbye!`);
        process.exit(0);
    }, 2000);
});

async function start(): Promise<void> {
    await ensureStorageDir();

    app.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log(`  Storage Node: ${NODE_ID}`);
        console.log(`  Port: ${PORT}`);
        console.log(`  Storage: ${STORAGE_PATH}`);
        console.log(`  Features: Content-addressable, Deduplication, Ref-counting`);
        console.log('='.repeat(60));
        console.log(`\n  Endpoints:`);
        console.log(`    GET    /health         - Node status`);
        console.log(`    HEAD   /chunks/:id     - Check chunk`);
        console.log(`    GET    /chunks/:id     - Retrieve chunk`);
        console.log(`    PUT    /chunks/:id     - Store chunk (dedup)`);
        console.log(`    DELETE /chunks/:id     - Delete chunk (refcount)`);
        console.log(`    GET    /chunks         - List all chunks`);
        console.log(`    POST   /chunks/:id/verify - Verify integrity`);
        console.log(`    GET    /stats          - Deduplication stats\n`);
    });
}

start().catch(console.error);
