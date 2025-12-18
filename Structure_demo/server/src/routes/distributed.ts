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

        const { encryptedData, fileName, mimeType, size, encryptionMetadata } = req.body;

        if (!encryptedData || !fileName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Store encryption metadata as JSON string in IV field (for frontend decryption)
        const ivField = encryptionMetadata ? JSON.stringify(encryptionMetadata) : '';
        const saltField = encryptionMetadata?.salt || '';

        console.log(`[Distributed] Starting distributed upload for "${fileName}"`);
        console.log(`[Distributed] encryptionMetadata received:`, encryptionMetadata ? 'YES' : 'NO');
        console.log(`[Distributed] ivField to store:`, ivField ? ivField.substring(0, 50) + '...' : 'EMPTY');

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
        console.log(`[Distributed] Upload debug:`);
        console.log(`  - Buffer size: ${fileBuffer.length}`);
        console.log(`  - Combined buffer size: ${combinedBuffer.length}`);
        console.log(`  - Shard size: ${encodedData.shardSize}`);
        console.log(`  - Checksum to store: ${encodedData.checksum}`);

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
            fileBuffer.length, // Use actual encrypted data size, not original file size
            mimeType || 'application/octet-stream',
            ivField,
            saltField,
            new Date().toISOString(),
            encodedData.checksum, // Use RS checksum for decode verification
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
        const userEmail = (req as AuthRequest).user?.email;
        const fileId = req.params.id;
        const db = getDB();

        // Get file metadata
        const file = await db.get(`SELECT * FROM files WHERE id = ?`, [fileId]);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check access (owner or shared)
        if (file.user_id !== userId) {
            // Check if file is shared with this user (by email)
            const share = await db.get(
                `SELECT * FROM shares WHERE file_id = ? AND shared_with = ?`,
                [fileId, userEmail]
            );
            if (!share) {
                console.log(`[Distributed] Access denied: user ${userEmail} not owner and no share found`);
                return res.status(403).json({ error: 'Access denied' });
            }
            console.log(`[Distributed] Access granted via share for ${userEmail}`);
        }

        console.log(`[Distributed] Starting download for "${file.name}"`);
        console.log(`[Distributed] File is_chunked: ${file.is_chunked}, has encrypted_data_url: ${!!file.encrypted_data_url}`);

        let fileBuffer: Buffer;

        if (file.is_chunked) {
            // Get shard placements from database
            const shardRecords = await db.all(
                `SELECT * FROM shards WHERE file_id = ? ORDER BY shard_index`,
                [fileId]
            );

            console.log(`[Distributed] Found ${shardRecords.length} shard records in DB`);

            if (shardRecords.length > 0 && shardRecords[0].node_url) {
                console.log(`[Distributed] Shards have node_url, fetching from nodes...`);

                // Retrieve from distributed nodes
                const placements: ChunkPlacement[] = shardRecords.map((r: any) => ({
                    chunkId: r.shard_id,
                    shardIndex: r.shard_index,
                    nodeId: r.node_id,
                    nodeUrl: r.node_url,
                    stored: r.stored === 1,
                    verified: r.verified === 1
                }));

                console.log(`[Distributed] Placements: ${JSON.stringify(placements.map(p => ({ index: p.shardIndex, node: p.nodeId })))}`);

                // Collect shards from nodes
                const shards = await nodeManager.collectShards(placements);

                const availableShards = shards.filter(s => s !== null).length;
                console.log(`[Distributed] Collected ${availableShards}/${shards.length} shards`);

                // Check if we can recover
                const recovery = erasureService.canRecover(shards);
                console.log(`[Distributed] Recovery check: canRecover=${recovery.canRecover}, available=${recovery.available}, required=${recovery.required}`);

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

        // Return the file data as raw binary (frontend will handle base64 conversion)
        res.set('Content-Type', file.mime_type || 'application/octet-stream');
        res.set('Content-Length', fileBuffer.length.toString());
        res.set('X-File-Name', file.name);
        res.set('X-File-IV', file.iv || '');
        res.set('X-File-Salt', file.salt || '');
        res.set('X-File-Checksum', file.checksum || '');

        res.send(fileBuffer);

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

/**
 * GET /distributed/nodes/:nodeId/chunks
 * Get all chunks stored on a specific node
 */
router.get('/nodes/:nodeId/chunks', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { nodeId } = req.params;
        const db = getDB();

        // Get all shards for this node with file information
        const chunks = await db.all(`
            SELECT s.*, f.name as file_name, f.size as file_size, f.mime_type, f.user_id
            FROM shards s
            JOIN files f ON s.file_id = f.id
            WHERE s.node_id = ?
            ORDER BY s.created_at DESC
        `, [nodeId]);

        res.json({
            nodeId,
            totalChunks: chunks.length,
            chunks: chunks.map((c: any) => ({
                id: c.shard_id,
                shardIndex: c.shard_index,
                fileId: c.file_id,
                fileName: c.file_name,
                fileSize: c.file_size,
                isData: c.is_data === 1,
                size: c.size,
                stored: c.stored === 1,
                verified: c.verified === 1,
                createdAt: c.created_at
            }))
        });

    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get node chunks: ' + error.message });
    }
});

/**
 * GET /distributed/all-chunks
 * Get all chunks across all nodes for admin visualization
 */
router.get('/all-chunks', authenticateToken, async (req: Request, res: Response) => {
    try {
        const db = getDB();

        // Get all shards grouped by node
        const chunks = await db.all(`
            SELECT s.*, f.name as file_name, f.size as file_size, f.mime_type,
                   u.email as owner_email
            FROM shards s
            JOIN files f ON s.file_id = f.id
            LEFT JOIN users u ON f.user_id = u.id
            ORDER BY s.node_id, s.created_at DESC
        `);

        // Group by node
        const nodeChunks: { [key: string]: any[] } = {};
        const nodes = nodeManager.getAllNodes();

        // Initialize all nodes
        nodes.forEach(node => {
            nodeChunks[node.id] = [];
        });

        // Add chunks to their respective nodes
        chunks.forEach((chunk: any) => {
            const nodeId = chunk.node_id;
            if (!nodeChunks[nodeId]) {
                nodeChunks[nodeId] = [];
            }
            nodeChunks[nodeId].push({
                id: chunk.shard_id,
                shardIndex: chunk.shard_index,
                fileId: chunk.file_id,
                fileName: chunk.file_name,
                ownerEmail: chunk.owner_email,
                isData: chunk.is_data === 1,
                size: chunk.size,
                stored: chunk.stored === 1,
                verified: chunk.verified === 1,
                createdAt: chunk.created_at
            });
        });

        res.json({
            totalChunks: chunks.length,
            nodeChunks,
            nodes: nodes.map(n => ({
                id: n.id,
                url: `${n.url}:${n.port}`,
                status: n.status,
                chunksStored: nodeChunks[n.id]?.length || 0
            }))
        });

    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get all chunks: ' + error.message });
    }
});

/**
 * POST /distributed/nodes/:nodeId/control
 * Control a storage node (stop, restart, check)
 */
router.post('/nodes/:nodeId/control', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { nodeId } = req.params;
        const { action } = req.body; // 'stop', 'restart', 'check'

        const nodes = nodeManager.getAllNodes();
        const node = nodes.find(n => n.id === nodeId);

        if (!node) {
            return res.status(404).json({ error: 'Node not found' });
        }

        let result: any = { nodeId, action };

        switch (action) {
            case 'check':
                // Trigger health check
                try {
                    const response = await fetch(`${node.url}:${node.port}/health`, {
                        method: 'GET',
                        signal: AbortSignal.timeout(5000)
                    });
                    if (response.ok) {
                        const data = await response.json();
                        result.status = 'online';
                        result.health = data;
                    } else {
                        result.status = 'degraded';
                    }
                } catch {
                    result.status = 'offline';
                }
                break;

            case 'stop':
                // Send shutdown signal to node
                try {
                    await fetch(`${node.url}:${node.port}/shutdown`, {
                        method: 'POST',
                        signal: AbortSignal.timeout(5000)
                    });
                    result.status = 'stopped';
                    result.message = 'Shutdown signal sent';
                } catch {
                    result.status = 'unknown';
                    result.message = 'Could not reach node';
                }
                break;

            case 'restart':
                // Note: Actual restart requires process management (not possible via HTTP)
                result.message = 'Restart must be done at the OS level. Use the start-nodes script.';
                result.hint = '.\\start-nodes.ps1';
                break;

            default:
                return res.status(400).json({ error: 'Invalid action. Use: check, stop, restart' });
        }

        res.json(result);

    } catch (error: any) {
        res.status(500).json({ error: 'Node control failed: ' + error.message });
    }
});

/**
 * GET /distributed/health
 * Get detailed health info for all nodes
 */
router.get('/health', authenticateToken, async (req: Request, res: Response) => {
    try {
        const nodes = nodeManager.getAllNodes();
        const db = getDB();

        // Get chunk counts per node from database
        const chunkCounts = await db.all(`
            SELECT node_id, COUNT(*) as count, SUM(size) as total_size
            FROM shards
            WHERE stored = 1
            GROUP BY node_id
        `);

        const chunkMap: { [key: string]: { count: number; size: number } } = {};
        chunkCounts.forEach((c: any) => {
            chunkMap[c.node_id] = { count: c.count, size: c.total_size || 0 };
        });

        const healthData = await Promise.all(nodes.map(async (node) => {
            let status = node.status;
            let latency = node.latency;
            let health: any = null;

            try {
                const start = Date.now();
                const response = await fetch(`${node.url}:${node.port}/health`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(3000)
                });
                latency = Date.now() - start;
                if (response.ok) {
                    status = 'online';
                    health = await response.json();
                }
            } catch {
                status = 'offline';
                latency = -1;
            }

            return {
                id: node.id,
                url: `${node.url}:${node.port}`,
                status,
                latency,
                chunksStored: chunkMap[node.id]?.count || 0,
                storageUsed: chunkMap[node.id]?.size || 0,
                health
            };
        }));

        const onlineCount = healthData.filter(n => n.status === 'online').length;

        res.json({
            timestamp: new Date().toISOString(),
            totalNodes: nodes.length,
            onlineNodes: onlineCount,
            offlineNodes: nodes.length - onlineCount,
            healthy: onlineCount >= 4, // Need at least 4 for RS(4,2)
            nodes: healthData
        });

    } catch (error: any) {
        res.status(500).json({ error: 'Health check failed: ' + error.message });
    }
});

export default router;
