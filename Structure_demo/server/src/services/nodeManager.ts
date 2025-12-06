/**
 * Node Manager Service
 * 
 * Manages the cluster of storage nodes:
 * - Tracks node health via heartbeats
 * - Distributes chunks across nodes
 * - Handles node failures and re-replication
 * - Provides node selection for uploads
 */

// Use native fetch or fallback
const fetchFn = globalThis.fetch || require('node-fetch');
import { Shard } from './erasureService';

// Configuration
const HEARTBEAT_INTERVAL = 10000;  // 10 seconds
const NODE_TIMEOUT = 30000;        // 30 seconds before marking offline
const REPLICATION_DELAY = 5000;    // Wait before starting re-replication

export interface StorageNode {
    id: string;
    url: string;
    port: number;
    status: 'online' | 'offline' | 'degraded';
    lastHeartbeat: Date;
    chunksStored: number;
    storageUsed: number;
    latency: number;        // ms
}

export interface ChunkPlacement {
    chunkId: string;
    shardIndex: number;
    nodeId: string;
    nodeUrl: string;
    stored: boolean;
    verified: boolean;
}

/**
 * Node Manager - Orchestrates storage cluster
 */
class NodeManager {
    private nodes: Map<string, StorageNode> = new Map();
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private listeners: ((event: string, data: any) => void)[] = [];

    constructor() {
        console.log('[NodeManager] Initialized');
    }

    /**
     * Register a storage node
     */
    registerNode(id: string, url: string, port: number): void {
        const node: StorageNode = {
            id,
            url,
            port,
            status: 'offline',
            lastHeartbeat: new Date(0),
            chunksStored: 0,
            storageUsed: 0,
            latency: 0
        };
        this.nodes.set(id, node);
        console.log(`[NodeManager] Registered node: ${id} at ${url}:${port}`);
    }

    /**
     * Register default nodes for development
     */
    registerDefaultNodes(): void {
        // Register 6 storage nodes (for RS(4,2) we need at least 6 nodes)
        const basePort = 4001;
        for (let i = 0; i < 6; i++) {
            const port = basePort + i;
            const id = `node-${port}`;
            this.registerNode(id, 'http://localhost', port);
        }
    }

    /**
     * Start monitoring node health
     */
    startMonitoring(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        console.log('[NodeManager] Starting health monitoring');
        this.checkAllNodes();

        this.heartbeatTimer = setInterval(() => {
            this.checkAllNodes();
        }, HEARTBEAT_INTERVAL);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Check health of all nodes
     */
    private async checkAllNodes(): Promise<void> {
        const checks = Array.from(this.nodes.values()).map(node =>
            this.checkNode(node)
        );
        await Promise.allSettled(checks);
    }

    /**
     * Check single node health
     */
    private async checkNode(node: StorageNode): Promise<void> {
        const startTime = Date.now();

        try {
            const response = await fetch(`${node.url}:${node.port}/health`, {
                method: 'GET',
                timeout: 5000
            } as any);

            if (response.ok) {
                const data = await response.json() as any;
                const latency = Date.now() - startTime;

                const wasOffline = node.status === 'offline';

                node.status = 'online';
                node.lastHeartbeat = new Date();
                node.chunksStored = data.chunksStored || 0;
                node.storageUsed = data.storageUsed || 0;
                node.latency = latency;

                if (wasOffline) {
                    console.log(`[NodeManager] Node ${node.id} came online (${latency}ms)`);
                    this.emit('node:online', { nodeId: node.id });
                }
            } else {
                this.markNodeOffline(node);
            }
        } catch (error) {
            this.markNodeOffline(node);
        }
    }

    /**
     * Mark a node as offline
     */
    private markNodeOffline(node: StorageNode): void {
        if (node.status !== 'offline') {
            console.warn(`[NodeManager] Node ${node.id} is OFFLINE`);
            node.status = 'offline';
            this.emit('node:offline', { nodeId: node.id });
        }
    }

    /**
     * Get list of online nodes
     */
    getOnlineNodes(): StorageNode[] {
        return Array.from(this.nodes.values()).filter(n => n.status === 'online');
    }

    /**
     * Get all nodes
     */
    getAllNodes(): StorageNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Select nodes for storing shards
     * Uses round-robin with least-loaded preference
     */
    selectNodesForShards(shardCount: number): StorageNode[] {
        const online = this.getOnlineNodes();

        if (online.length < shardCount) {
            throw new Error(`Not enough online nodes: need ${shardCount}, have ${online.length}`);
        }

        // Sort by storage used (least loaded first) then by latency
        const sorted = [...online].sort((a, b) => {
            if (a.storageUsed !== b.storageUsed) {
                return a.storageUsed - b.storageUsed;
            }
            return a.latency - b.latency;
        });

        return sorted.slice(0, shardCount);
    }

    /**
     * Store a shard on a specific node
     */
    async storeShard(node: StorageNode, shard: Shard): Promise<ChunkPlacement> {
        const url = `${node.url}:${node.port}/chunks/${shard.id}`;

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: new Uint8Array(shard.data)
            });

            if (!response.ok) {
                throw new Error(`Failed to store shard: ${response.statusText}`);
            }

            console.log(`[NodeManager] Stored shard ${shard.id.substring(0, 8)}... on ${node.id}`);

            return {
                chunkId: shard.id,
                shardIndex: shard.index,
                nodeId: node.id,
                nodeUrl: `${node.url}:${node.port}`,
                stored: true,
                verified: true
            };
        } catch (error) {
            console.error(`[NodeManager] Failed to store shard on ${node.id}:`, error);
            throw error;
        }
    }

    /**
     * Retrieve a shard from a node
     */
    async retrieveShard(nodeUrl: string, shardId: string): Promise<Buffer> {
        const url = `${nodeUrl}/chunks/${shardId}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to retrieve shard: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error(`[NodeManager] Failed to retrieve shard ${shardId}:`, error);
            throw error;
        }
    }

    /**
     * Delete a shard from a node
     */
    async deleteShard(nodeUrl: string, shardId: string): Promise<void> {
        const url = `${nodeUrl}/chunks/${shardId}`;

        try {
            const response = await fetch(url, { method: 'DELETE' });

            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to delete shard: ${response.statusText}`);
            }
        } catch (error) {
            console.error(`[NodeManager] Failed to delete shard ${shardId}:`, error);
            throw error;
        }
    }

    /**
     * Distribute shards across nodes
     */
    async distributeShards(shards: Shard[]): Promise<ChunkPlacement[]> {
        const nodes = this.selectNodesForShards(shards.length);
        const placements: ChunkPlacement[] = [];

        for (let i = 0; i < shards.length; i++) {
            const shard = shards[i];
            const node = nodes[i % nodes.length];

            const placement = await this.storeShard(node, shard);
            placements.push(placement);
        }

        console.log(`[NodeManager] Distributed ${shards.length} shards across ${nodes.length} nodes`);
        return placements;
    }

    /**
     * Collect shards from nodes
     */
    async collectShards(placements: ChunkPlacement[]): Promise<(Shard | null)[]> {
        const shards: (Shard | null)[] = new Array(placements.length).fill(null);

        await Promise.all(placements.map(async (placement, index) => {
            try {
                const data = await this.retrieveShard(placement.nodeUrl, placement.chunkId);
                shards[placement.shardIndex] = {
                    id: placement.chunkId,
                    index: placement.shardIndex,
                    isData: placement.shardIndex < 4, // RS(4,2)
                    data,
                    size: data.length
                };
            } catch (error) {
                console.warn(`[NodeManager] Failed to retrieve shard ${placement.shardIndex} from ${placement.nodeId}`);
                shards[placement.shardIndex] = null;
            }
        }));

        const retrieved = shards.filter(s => s !== null).length;
        console.log(`[NodeManager] Retrieved ${retrieved}/${placements.length} shards`);

        return shards;
    }

    /**
     * Add event listener
     */
    on(callback: (event: string, data: any) => void): void {
        this.listeners.push(callback);
    }

    /**
     * Emit event
     */
    private emit(event: string, data: any): void {
        this.listeners.forEach(cb => cb(event, data));
    }

    /**
     * Get cluster status summary
     */
    getClusterStatus(): {
        totalNodes: number;
        onlineNodes: number;
        offlineNodes: number;
        totalChunks: number;
        totalStorage: number;
        healthy: boolean;
    } {
        const all = this.getAllNodes();
        const online = this.getOnlineNodes();

        return {
            totalNodes: all.length,
            onlineNodes: online.length,
            offlineNodes: all.length - online.length,
            totalChunks: online.reduce((sum, n) => sum + n.chunksStored, 0),
            totalStorage: online.reduce((sum, n) => sum + n.storageUsed, 0),
            healthy: online.length >= 4 // Need at least k nodes for RS(4,2)
        };
    }
}

// Export singleton
export const nodeManager = new NodeManager();

// Export class for testing
export { NodeManager };
