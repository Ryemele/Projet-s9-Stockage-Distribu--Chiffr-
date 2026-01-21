"""
Node Manager Service

Manages the cluster of storage nodes (MinIO):
- Tracks node health via heartbeats
- Distributes shards across nodes
- Handles node failures and re-replication
- Provides node selection for uploads
"""

import asyncio
import aiohttp
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Callable, Any
import logging

from .erasure_service import Shard

logger = logging.getLogger(__name__)

# Configuration
HEARTBEAT_INTERVAL = 10  # seconds
NODE_TIMEOUT = 30  # seconds before marking offline
REPLICATION_FACTOR = 2  # Store each shard on 2 nodes


@dataclass
class StorageNode:
    """Represents a storage node in the cluster"""
    id: str
    url: str
    port: int
    status: str = "offline"  # online, offline, degraded
    last_heartbeat: datetime = field(default_factory=lambda: datetime.min)
    chunks_stored: int = 0
    storage_used: int = 0
    latency: float = 0.0  # milliseconds


@dataclass
class ChunkPlacement:
    """Tracks where a chunk/shard is stored"""
    chunk_id: str
    shard_index: int
    node_id: str
    node_url: str
    stored: bool = False
    verified: bool = False


class NodeManager:
    """Orchestrates storage cluster operations"""

    def __init__(self):
        self.nodes: Dict[str, StorageNode] = {}
        self._monitoring = False
        self._monitor_task: Optional[asyncio.Task] = None
        self.listeners: List[Callable[[str, Any], None]] = []
        logger.info("[NodeManager] Initialized")

    def register_node(self, node_id: str, url: str, port: int) -> None:
        """Register a storage node"""
        node = StorageNode(
            id=node_id,
            url=url,
            port=port,
            status="offline",
            last_heartbeat=datetime.min
        )
        self.nodes[node_id] = node
        logger.info(f"[NodeManager] Registered node: {node_id} at {url}:{port}")

    def register_minio_nodes(self, minio_endpoints: List[Dict[str, Any]]) -> None:
        """Register MinIO nodes from configuration"""
        for endpoint in minio_endpoints:
            self.register_node(
                node_id=endpoint.get("id", f"minio-{endpoint['port']}"),
                url=endpoint.get("url", "http://localhost"),
                port=endpoint.get("port", 9000)
            )

    def register_default_nodes(self) -> None:
        """Register default MinIO nodes for development (4-node cluster)"""
        # Based on docker-compose configuration
        base_port = 9000
        for i in range(1, 5):  # minio1 to minio4
            self.register_node(
                node_id=f"minio{i}",
                url="http://localhost",
                port=base_port
            )
        logger.info("[NodeManager] Registered 4 default MinIO nodes")

    async def start_monitoring(self) -> None:
        """Start monitoring node health"""
        if self._monitoring:
            return

        self._monitoring = True
        logger.info("[NodeManager] Starting health monitoring")
        await self._check_all_nodes()

        self._monitor_task = asyncio.create_task(self._monitoring_loop())

    async def stop_monitoring(self) -> None:
        """Stop health monitoring"""
        self._monitoring = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        logger.info("[NodeManager] Monitoring stopped")

    async def _monitoring_loop(self) -> None:
        """Background loop for health checks"""
        while self._monitoring:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            await self._check_all_nodes()

    async def _check_all_nodes(self) -> None:
        """Check health of all nodes"""
        tasks = [self._check_node(node) for node in self.nodes.values()]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _check_node(self, node: StorageNode) -> None:
        """Check single node health via MinIO health endpoint"""
        start_time = datetime.now()

        try:
            async with aiohttp.ClientSession() as session:
                # MinIO health check endpoint
                url = f"{node.url}:{node.port}/minio/health/live"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status == 200:
                        latency = (datetime.now() - start_time).total_seconds() * 1000
                        was_offline = node.status == "offline"

                        node.status = "online"
                        node.last_heartbeat = datetime.now()
                        node.latency = latency

                        if was_offline:
                            logger.info(f"[NodeManager] Node {node.id} came online ({latency:.0f}ms)")
                            self._emit("node:online", {"node_id": node.id})
                    else:
                        self._mark_node_offline(node)
        except Exception as e:
            logger.debug(f"[NodeManager] Health check failed for {node.id}: {e}")
            self._mark_node_offline(node)

    def _mark_node_offline(self, node: StorageNode) -> None:
        """Mark a node as offline"""
        if node.status != "offline":
            logger.warning(f"[NodeManager] Node {node.id} is OFFLINE")
            node.status = "offline"
            self._emit("node:offline", {"node_id": node.id})

    def get_online_nodes(self) -> List[StorageNode]:
        """Get list of online nodes"""
        return [n for n in self.nodes.values() if n.status == "online"]

    def get_all_nodes(self) -> List[StorageNode]:
        """Get all registered nodes"""
        return list(self.nodes.values())

    def select_nodes_for_shards(self, shard_count: int) -> List[StorageNode]:
        """
        Select nodes for storing shards.
        Uses least-loaded preference with latency as tiebreaker.
        """
        online = self.get_online_nodes()

        if len(online) < shard_count:
            raise ValueError(f"Not enough online nodes: need {shard_count}, have {len(online)}")

        # Sort by storage used (least loaded first) then by latency
        sorted_nodes = sorted(online, key=lambda n: (n.storage_used, n.latency))
        return sorted_nodes[:shard_count]

    async def store_shard(self, node: StorageNode, shard: Shard, minio_client) -> ChunkPlacement:
        """Store a shard on a specific node using MinIO client"""
        from io import BytesIO

        bucket_name = "file-shards"
        object_name = f"shard_{shard.id}"

        try:
            # Ensure bucket exists
            if not minio_client.bucket_exists(bucket_name):
                minio_client.make_bucket(bucket_name)

            # Upload shard data
            data_stream = BytesIO(shard.data)
            minio_client.put_object(
                bucket_name,
                object_name,
                data_stream,
                length=shard.size,
                metadata={
                    "shard_index": str(shard.index),
                    "is_data": str(shard.is_data),
                    "node_id": node.id
                }
            )

            logger.info(f"[NodeManager] Stored shard {shard.id[:8]}... on {node.id}")

            return ChunkPlacement(
                chunk_id=shard.id,
                shard_index=shard.index,
                node_id=node.id,
                node_url=f"{node.url}:{node.port}",
                stored=True,
                verified=True
            )
        except Exception as e:
            logger.error(f"[NodeManager] Failed to store shard on {node.id}: {e}")
            raise

    async def retrieve_shard(self, node_url: str, shard_id: str, minio_client) -> bytes:
        """Retrieve a shard from MinIO"""
        bucket_name = "file-shards"
        object_name = f"shard_{shard_id}"

        try:
            response = minio_client.get_object(bucket_name, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except Exception as e:
            logger.error(f"[NodeManager] Failed to retrieve shard {shard_id}: {e}")
            raise

    async def delete_shard(self, shard_id: str, minio_client) -> None:
        """Delete a shard from MinIO"""
        bucket_name = "file-shards"
        object_name = f"shard_{shard_id}"

        try:
            minio_client.remove_object(bucket_name, object_name)
        except Exception as e:
            logger.error(f"[NodeManager] Failed to delete shard {shard_id}: {e}")
            raise

    async def distribute_shards(
        self,
        shards: List[Shard],
        minio_client
    ) -> List[ChunkPlacement]:
        """
        Distribute shards across nodes with replication.
        Each shard is stored on multiple nodes for fault tolerance.
        """
        online = self.get_online_nodes()

        if len(online) < 2:
            raise ValueError(f"Not enough online nodes: need at least 2, have {len(online)}")

        placements = []

        for i, shard in enumerate(shards):
            # Select nodes for this shard (primary and secondary for replication)
            primary_idx = i % len(online)
            secondary_idx = (i + 1) % len(online)

            nodes_to_store = [online[primary_idx]]
            if REPLICATION_FACTOR > 1 and len(online) > 1:
                nodes_to_store.append(online[secondary_idx])

            # Store on selected nodes
            for node in nodes_to_store:
                try:
                    placement = await self.store_shard(node, shard, minio_client)
                    placements.append(placement)
                except Exception as e:
                    logger.warning(f"[NodeManager] Failed to store shard {i} on {node.id}: {e}")

        unique_nodes = len(set(p.node_id for p in placements))
        logger.info(f"[NodeManager] Distributed {len(shards)} shards ({len(placements)} copies) across {unique_nodes} nodes")

        return placements

    async def collect_shards(
        self,
        placements: List[ChunkPlacement],
        minio_client
    ) -> List[Optional[Shard]]:
        """
        Collect shards from nodes with replica fallback.
        Each shard may exist on multiple nodes - try each until successful.
        """
        # Group placements by shard index
        shard_placements: Dict[int, List[ChunkPlacement]] = {}
        for p in placements:
            if p.shard_index not in shard_placements:
                shard_placements[p.shard_index] = []
            shard_placements[p.shard_index].append(p)

        # Determine max shard index
        if not shard_placements:
            return []

        max_index = max(shard_placements.keys()) + 1
        shards: List[Optional[Shard]] = [None] * max_index

        # Collect each shard
        for shard_index, replicas in shard_placements.items():
            for placement in replicas:
                try:
                    data = await self.retrieve_shard(
                        placement.node_url,
                        placement.chunk_id,
                        minio_client
                    )
                    shards[shard_index] = Shard(
                        id=placement.chunk_id,
                        index=shard_index,
                        is_data=shard_index < 4,  # RS(4,2)
                        data=data,
                        size=len(data)
                    )
                    logger.info(f"[NodeManager] Retrieved shard {shard_index} from {placement.node_id}")
                    break  # Got the shard, no need for other replicas
                except Exception as e:
                    logger.warning(f"[NodeManager] Failed to get shard {shard_index} from {placement.node_id}: {e}")

        retrieved = len([s for s in shards if s is not None])
        logger.info(f"[NodeManager] Retrieved {retrieved}/{max_index} shards")

        return shards

    def on(self, callback: Callable[[str, Any], None]) -> None:
        """Add event listener"""
        self.listeners.append(callback)

    def _emit(self, event: str, data: Any) -> None:
        """Emit event to all listeners"""
        for callback in self.listeners:
            try:
                callback(event, data)
            except Exception as e:
                logger.error(f"[NodeManager] Event listener error: {e}")

    def get_cluster_status(self) -> Dict[str, Any]:
        """Get cluster status summary"""
        all_nodes = self.get_all_nodes()
        online = self.get_online_nodes()

        return {
            "total_nodes": len(all_nodes),
            "online_nodes": len(online),
            "offline_nodes": len(all_nodes) - len(online),
            "total_chunks": sum(n.chunks_stored for n in online),
            "total_storage": sum(n.storage_used for n in online),
            "healthy": len(online) >= 4  # Need at least k nodes for RS(4,2)
        }


# Singleton instance
node_manager = NodeManager()
