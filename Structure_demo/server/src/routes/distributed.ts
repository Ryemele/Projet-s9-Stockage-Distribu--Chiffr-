/**
 * Distributed Storage Routes
 * 
 * Handles file upload/download with chunking and erasure coding.
 * Works with storage nodes for distributed, fault-tolerant storage.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDB } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { chunkService } from '../services/chunkService';
import { erasureService, Shard } from '../services/erasureService';
import { nodeManager, ChunkPlacement } from '../services/nodeManager';

const router = Router();

// Initialize node manager with default nodes
nodeManager.registerDefaultNodes();

/**
 * POST /distributed/upload
 * Upload a file with distributed storage
 * 
 * Body: { encryptedData: base64, fileName, mimeType, size, iv, salt }
 */
router.post('/upload', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        const db = getDB();

        const { encryptedData, fileName, mimeType, size, iv, salt } = req.body;

        if (!encryptedData || !fileName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`[Distributed] Starting distributed upload for "${fileName}"`);

        // Decode base64 encrypted data
        const fileBuffer = Buffer.from(encryptedData, 'base64');
        const fileId = uuidv4();

        // Step 1: Chunk the file
        const chunkedFile = await chunkService.chunkFile(fileBuffer, fileName, mimeType, fileId);
        console.log(`[Distributed] Split into ${chunkedFile.totalChunks} chunks`);

        // Step 2: Combine all chunks into a single buffer for erasure coding
        const combinedBuffer = Buffer.concat(chunkedFile.chunks.map(c => c.data));

        // Step 3: Apply Reed-Solomon erasure coding
        const encodedData = erasureService.encode(combinedBuffer);
        console.log(`[Distributed] RS encoded: ${encodedData.dataShards} data + ${encodedData.parityShards} parity shards`);

        // Step 4: Distribute shards to storage nodes
        let placements: ChunkPlacement[] = [];
        try {
            placements = await nodeManager.distributeShards(encodedData.shards);
            console.log(`[Distributed] Distributed ${placements.length} shards to nodes`);
        } catch (distError: any) {
            console.error(`[Distributed] Failed to distribute to nodes:`, distError.message);
            // Fall back to local storage if nodes aren't available
            console.log(`[Distributed] Falling back to local storage`);
        }

        // Step 5: Save file metadata to database
        await db.run(`
            INSERT INTO files (id, user_id, name, size, mime_type, iv, salt, uploaded_at, checksum, is_chunked, total_chunks, total_shards)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            fileId,
            userId,
            fileName,
            size || fileBuffer.length,
            mimeType || 'application/octet-stream',
            iv || '',
            salt || '',
            new Date().toISOString(),
            chunkedFile.checksum,
            1, // is_chunked = true
            chunkedFile.totalChunks,
            encodedData.shards.length
        ]);

        // Step 6: Save shard placements to database
        for (const placement of placements) {
            await db.run(`
                INSERT INTO shards (id, file_id, shard_index, shard_id, is_data, size, node_id, node_url, stored, verified, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                fileId,
                placement.shardIndex,
                placement.chunkId,
                placement.shardIndex < erasureService.getConfig().dataShards ? 1 : 0,
                encodedData.shardSize,
                placement.nodeId,
                placement.nodeUrl,
                placement.stored ? 1 : 0,
                placement.verified ? 1 : 0,
                new Date().toISOString()
            ]);
        }

        // If no nodes available, store encoded data locally as fallback
        if (placements.length === 0) {
            // Store encoded shards info in encrypted_data_url field for local retrieval
            const localShardData = {
                shards: encodedData.shards.map(s => ({
                    id: s.id,
                    index: s.index,
                    isData: s.isData,
                    data: s.data.toString('base64'),
                    size: s.size
                })),
                originalSize: encodedData.originalSize,
                shardSize: encodedData.shardSize,
                checksum: encodedData.checksum
            };

            await db.run(`UPDATE files SET encrypted_data_url = ? WHERE id = ?`, [
                JSON.stringify(localShardData),
                fileId
            ]);
            console.log(`[Distributed] Stored ${encodedData.shards.length} shards locally`);
        }

        console.log(`[Distributed] Upload complete: ${fileId}`);

        res.status(201).json({
            success: true,
            file: {
                id: fileId,
                name: fileName,
                size: size || fileBuffer.length,
                mimeType,
                isChunked: true,
                totalChunks: chunkedFile.totalChunks,
                totalShards: encodedData.shards.length,
                distributedNodes: placements.length,
                checksum: chunkedFile.checksum
            }
        });

    } catch (error: any) {
        console.error('[Distributed] Upload error:', error);
        res.status(500).json({ error: 'Distributed upload failed: ' + error.message });
    }
});

/**
 * GET /distributed/download/:id
 * Download a file from distributed storage
 */
router.get('/download/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        const fileId = req.params.id;
        const db = getDB();

        // Get file metadata
        const file = await db.get(`SELECT * FROM files WHERE id = ?`, [fileId]);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check access (owner or shared)
        if (file.user_id !== userId) {
            const share = await db.get(
                `SELECT * FROM shares WHERE file_id = ? AND shared_with = ?`,
                [fileId, userId]
            );
            if (!share) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        console.log(`[Distributed] Starting download for "${file.name}"`);

        let fileBuffer: Buffer;

        if (file.is_chunked) {
            // Get shard placements from database
            const shardRecords = await db.all(
                `SELECT * FROM shards WHERE file_id = ? ORDER BY shard_index`,
                [fileId]
            );

            if (shardRecords.length > 0 && shardRecords[0].node_url) {
                // Retrieve from distributed nodes
                const placements: ChunkPlacement[] = shardRecords.map((r: any) => ({
                    chunkId: r.shard_id,
                    shardIndex: r.shard_index,
                    nodeId: r.node_id,
                    nodeUrl: r.node_url,
                    stored: r.stored === 1,
                    verified: r.verified === 1
                }));

                // Collect shards from nodes
                const shards = await nodeManager.collectShards(placements);

                // Check if we can recover
                const recovery = erasureService.canRecover(shards);
                if (!recovery.canRecover) {
                    return res.status(503).json({
                        error: `Cannot recover file: need ${recovery.required} shards, only have ${recovery.available}`
                    });
                }

                // Decode with Reed-Solomon
                const encodedData = {
                    originalSize: file.size,
                    shardSize: shardRecords[0].size,
                    dataShards: erasureService.getConfig().dataShards,
                    parityShards: erasureService.getConfig().parityShards,
                    shards: [],
                    checksum: file.checksum
                };

                fileBuffer = erasureService.decode(encodedData, shards);
                console.log(`[Distributed] Recovered file from distributed nodes`);

            } else if (file.encrypted_data_url) {
                // Retrieve from local storage (fallback)
                const localData = JSON.parse(file.encrypted_data_url);
                const shards: (Shard | null)[] = localData.shards.map((s: any) => ({
                    id: s.id,
                    index: s.index,
                    isData: s.isData,
                    data: Buffer.from(s.data, 'base64'),
                    size: s.size
                }));

                const encodedData = {
                    originalSize: localData.originalSize,
                    shardSize: localData.shardSize,
                    dataShards: erasureService.getConfig().dataShards,
                    parityShards: erasureService.getConfig().parityShards,
                    shards: [],
                    checksum: localData.checksum
                };

                fileBuffer = erasureService.decode(encodedData, shards);
                console.log(`[Distributed] Recovered file from local shards`);
            } else {
                return res.status(500).json({ error: 'No shards available for this file' });
            }
        } else {
            // Non-chunked file - use legacy download
            return res.status(400).json({ error: 'Use /files/:id/download for non-chunked files' });
        }

        // Return the file data
        res.set('Content-Type', file.mime_type || 'application/octet-stream');
        res.set('Content-Length', fileBuffer.length.toString());
        res.set('X-File-Name', file.name);
        res.set('X-File-IV', file.iv || '');
        res.set('X-File-Salt', file.salt || '');
        res.set('X-File-Checksum', file.checksum || '');

        res.send(fileBuffer.toString('base64'));

    } catch (error: any) {
        console.error('[Distributed] Download error:', error);
        res.status(500).json({ error: 'Download failed: ' + error.message });
    }
});

/**
 * GET /distributed/status/:id
 * Get distribution status for a file
 */
router.get('/status/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const fileId = req.params.id;
        const db = getDB();

        const file = await db.get(`SELECT * FROM files WHERE id = ?`, [fileId]);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const shards = await db.all(
            `SELECT * FROM shards WHERE file_id = ?`,
            [fileId]
        );

        const storedCount = shards.filter((s: any) => s.stored).length;
        const verifiedCount = shards.filter((s: any) => s.verified).length;
        const config = erasureService.getConfig();

        res.json({
            fileId,
            fileName: file.name,
            isChunked: file.is_chunked === 1,
            totalShards: shards.length,
            storedShards: storedCount,
            verifiedShards: verifiedCount,
            dataShards: config.dataShards,
            parityShards: config.parityShards,
            canRecover: storedCount >= config.dataShards,
            redundancy: `${config.parityShards} node failures tolerated`,
            shards: shards.map((s: any) => ({
                index: s.shard_index,
                isData: s.is_data === 1,
                nodeId: s.node_id,
                stored: s.stored === 1
            }))
        });

    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get status: ' + error.message });
    }
});

/**
 * GET /distributed/cluster
 * Get cluster status
 */
router.get('/cluster', authenticateToken, async (req: Request, res: Response) => {
    try {
        const status = nodeManager.getClusterStatus();
        const nodes = nodeManager.getAllNodes();

        res.json({
            ...status,
            nodes: nodes.map(n => ({
                id: n.id,
                url: `${n.url}:${n.port}`,
                status: n.status,
                chunksStored: n.chunksStored,
                storageUsed: n.storageUsed,
                latency: n.latency
            })),
            erasureConfig: erasureService.getConfig()
        });

    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get cluster status: ' + error.message });
    }
});

export default router;
