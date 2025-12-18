/**
 * Recovery Service
 * 
 * Handles file recovery when storage nodes fail.
 * Uses Reed-Solomon erasure coding to reconstruct missing shards.
 */

import { erasureService, Shard, EncodedData } from './erasureService';
import { nodeManager, ChunkPlacement } from './nodeManager';
import { getDB } from '../db';

interface RecoveryResult {
    success: boolean;
    fileId: string;
    recoveredShards: number;
    missingShards: number;
    totalShards: number;
    newPlacements?: ChunkPlacement[];
    error?: string;
}

interface FileRecoveryStatus {
    fileId: string;
    fileName: string;
    status: 'healthy' | 'degraded' | 'at-risk' | 'unrecoverable';
    availableShards: number;
    requiredShards: number;
    totalShards: number;
    missingNodes: string[];
}

class RecoveryService {
    private readonly RECOVERY_CHECK_INTERVAL = 60000; // 1 minute
    private recoveryTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        console.log('[Recovery] Service initialized');
    }

    /**
     * Start automatic recovery monitoring
     */
    startMonitoring(): void {
        if (this.recoveryTimer) return;

        this.recoveryTimer = setInterval(() => {
            this.checkAndRecover().catch(console.error);
        }, this.RECOVERY_CHECK_INTERVAL);

        console.log('[Recovery] Monitoring started');
    }

    /**
     * Stop recovery monitoring
     */
    stopMonitoring(): void {
        if (this.recoveryTimer) {
            clearInterval(this.recoveryTimer);
            this.recoveryTimer = null;
            console.log('[Recovery] Monitoring stopped');
        }
    }

    /**
     * Check all files and trigger recovery if needed
     */
    async checkAndRecover(): Promise<void> {
        try {
            const db = getDB();
            const files = await db.all(`SELECT id, name FROM files WHERE is_chunked = 1`);

            for (const file of files) {
                const status = await this.getFileRecoveryStatus(file.id);

                if (status.status === 'degraded' || status.status === 'at-risk') {
                    console.log(`[Recovery] File ${file.name} is ${status.status}, attempting recovery...`);
                    await this.recoverFile(file.id);
                }
            }
        } catch (error) {
            console.error('[Recovery] Check failed:', error);
        }
    }

    /**
     * Get recovery status for a specific file
     */
    async getFileRecoveryStatus(fileId: string): Promise<FileRecoveryStatus> {
        const db = getDB();

        const file = await db.get(`SELECT * FROM files WHERE id = ?`, [fileId]);
        if (!file) {
            throw new Error(`File ${fileId} not found`);
        }

        const shards = await db.all(
            `SELECT * FROM shards WHERE file_id = ? ORDER BY shard_index`,
            [fileId]
        );

        const config = erasureService.getConfig();
        const missingNodes: string[] = [];
        let availableCount = 0;

        for (const shard of shards) {
            const node = nodeManager.getAllNodes().find(n => n.id === shard.node_id);
            if (node && node.status === 'online') {
                availableCount++;
            } else {
                missingNodes.push(shard.node_id);
            }
        }

        let status: FileRecoveryStatus['status'];
        if (availableCount >= shards.length) {
            status = 'healthy';
        } else if (availableCount >= config.dataShards) {
            status = availableCount >= config.dataShards + 1 ? 'degraded' : 'at-risk';
        } else {
            status = 'unrecoverable';
        }

        return {
            fileId,
            fileName: file.name,
            status,
            availableShards: availableCount,
            requiredShards: config.dataShards,
            totalShards: shards.length,
            missingNodes,
        };
    }

    /**
     * Recover a file by reconstructing missing shards
     */
    async recoverFile(fileId: string): Promise<RecoveryResult> {
        const db = getDB();

        try {
            console.log(`[Recovery] Starting recovery for file ${fileId}`);

            // Get file and shard info
            const file = await db.get(`SELECT * FROM files WHERE id = ?`, [fileId]);
            if (!file) {
                return { success: false, fileId, recoveredShards: 0, missingShards: 0, totalShards: 0, error: 'File not found' };
            }

            const shardRecords = await db.all(
                `SELECT * FROM shards WHERE file_id = ? ORDER BY shard_index`,
                [fileId]
            );

            // Collect available shards
            const placements: ChunkPlacement[] = shardRecords.map((r: any) => ({
                chunkId: r.shard_id,
                shardIndex: r.shard_index,
                nodeId: r.node_id,
                nodeUrl: r.node_url,
                stored: r.stored === 1,
                verified: r.verified === 1,
            }));

            const shards = await nodeManager.collectShards(placements);

            // Check recovery possibility
            const recovery = erasureService.canRecover(shards);
            if (!recovery.canRecover) {
                return {
                    success: false,
                    fileId,
                    recoveredShards: 0,
                    missingShards: recovery.required - recovery.available,
                    totalShards: shards.length,
                    error: `Not enough shards: need ${recovery.required}, have ${recovery.available}`,
                };
            }

            // Count missing shards
            const missingIndices: number[] = [];
            shards.forEach((shard, index) => {
                if (shard === null) {
                    missingIndices.push(index);
                }
            });

            if (missingIndices.length === 0) {
                return {
                    success: true,
                    fileId,
                    recoveredShards: 0,
                    missingShards: 0,
                    totalShards: shards.length,
                };
            }

            // Reconstruct the original data
            const config = erasureService.getConfig();
            const encodedData: EncodedData = {
                originalSize: file.size,
                shardSize: shardRecords[0]?.size || 0,
                dataShards: config.dataShards,
                parityShards: config.parityShards,
                shards: [],
                checksum: file.checksum,
            };

            const recoveredData = erasureService.decode(encodedData, shards);

            // Re-encode to get missing shards
            const newEncodedData = erasureService.encode(recoveredData);

            // Store recovered shards on healthy nodes
            const healthyNodes = nodeManager.getOnlineNodes();
            const newPlacements: ChunkPlacement[] = [];

            for (const missingIndex of missingIndices) {
                const recoveredShard = newEncodedData.shards[missingIndex];
                if (!recoveredShard) continue;

                // Select a healthy node that doesn't already have this file's shards
                const existingNodeIds = placements.map(p => p.nodeId);
                const availableNode = healthyNodes.find(n => !existingNodeIds.includes(n.id));

                if (availableNode) {
                    const placement = await nodeManager.storeShard(availableNode, recoveredShard);
                    newPlacements.push(placement);

                    // Update database
                    await db.run(
                        `UPDATE shards SET node_id = ?, node_url = ?, stored = 1 WHERE file_id = ? AND shard_index = ?`,
                        [availableNode.id, `${availableNode.url}:${availableNode.port}`, fileId, missingIndex]
                    );
                }
            }

            console.log(`[Recovery] Recovered ${newPlacements.length}/${missingIndices.length} shards for file ${fileId}`);

            return {
                success: true,
                fileId,
                recoveredShards: newPlacements.length,
                missingShards: missingIndices.length - newPlacements.length,
                totalShards: shards.length,
                newPlacements,
            };

        } catch (error: any) {
            console.error(`[Recovery] Failed for file ${fileId}:`, error);
            return {
                success: false,
                fileId,
                recoveredShards: 0,
                missingShards: 0,
                totalShards: 0,
                error: error.message,
            };
        }
    }

    /**
     * Get recovery status for all files
     */
    async getAllFileStatuses(): Promise<FileRecoveryStatus[]> {
        const db = getDB();
        const files = await db.all(`SELECT id FROM files WHERE is_chunked = 1`);

        const statuses: FileRecoveryStatus[] = [];
        for (const file of files) {
            statuses.push(await this.getFileRecoveryStatus(file.id));
        }

        return statuses;
    }

    /**
     * Trigger re-replication for a specific file
     */
    async replicateFile(fileId: string, targetReplication: number = 6): Promise<void> {
        // This would increase replication factor for critical files
        console.log(`[Recovery] Replicating file ${fileId} to ${targetReplication} nodes`);
        // Implementation depends on business requirements
    }
}

export const recoveryService = new RecoveryService();
export { RecoveryService };
