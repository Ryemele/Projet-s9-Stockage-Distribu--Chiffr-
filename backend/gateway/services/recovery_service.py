"""
Recovery Service

Handles file recovery when storage nodes fail.
Uses Reed-Solomon erasure coding to reconstruct missing shards.

Features:
- Automatic health monitoring
- Recovery status tracking
- Re-replication of missing shards
- Cluster-wide status reporting
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime

from .erasure_service import erasure_service, Shard, EncodedData
from .node_manager import node_manager, ChunkPlacement

logger = logging.getLogger(__name__)

# Configuration
RECOVERY_CHECK_INTERVAL = 60  # seconds


@dataclass
class RecoveryResult:
    """Result of a recovery operation"""
    success: bool
    file_id: str
    recovered_shards: int
    missing_shards: int
    total_shards: int
    new_placements: List[ChunkPlacement] = None
    error: Optional[str] = None


@dataclass
class FileRecoveryStatus:
    """Recovery status for a single file"""
    file_id: str
    file_name: str
    status: str  # healthy, degraded, at-risk, unrecoverable
    available_shards: int
    required_shards: int
    total_shards: int
    missing_nodes: List[str]


class RecoveryService:
    """Service for monitoring and recovering files"""

    def __init__(self):
        self._monitoring = False
        self._monitor_task: Optional[asyncio.Task] = None
        logger.info("[Recovery] Service initialized")

    async def start_monitoring(self) -> None:
        """Start automatic recovery monitoring"""
        if self._monitoring:
            return

        self._monitoring = True
        self._monitor_task = asyncio.create_task(self._monitoring_loop())
        logger.info("[Recovery] Monitoring started")

    async def stop_monitoring(self) -> None:
        """Stop recovery monitoring"""
        self._monitoring = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        logger.info("[Recovery] Monitoring stopped")

    async def _monitoring_loop(self) -> None:
        """Background loop for checking and recovering files"""
        while self._monitoring:
            await asyncio.sleep(RECOVERY_CHECK_INTERVAL)
            try:
                await self.check_and_recover()
            except Exception as e:
                logger.error(f"[Recovery] Check failed: {e}")

    async def check_and_recover(self, db_session=None) -> None:
        """Check all files and trigger recovery if needed"""
        if db_session is None:
            logger.warning("[Recovery] No database session provided")
            return

        try:
            # Get all chunked files from database
            result = db_session.execute(
                "SELECT file_id, filename FROM files WHERE is_chunked = 1"
            )
            files = result.fetchall()

            for file_row in files:
                file_id, file_name = file_row
                status = await self.get_file_recovery_status(file_id, db_session)

                if status.status in ("degraded", "at-risk"):
                    logger.info(f"[Recovery] File {file_name} is {status.status}, attempting recovery...")
                    await self.recover_file(file_id, db_session)
        except Exception as e:
            logger.error(f"[Recovery] Check failed: {e}")

    async def get_file_recovery_status(
        self,
        file_id: str,
        db_session
    ) -> FileRecoveryStatus:
        """Get recovery status for a specific file"""
        # Get file info
        result = db_session.execute(
            "SELECT filename FROM files WHERE file_id = ?",
            (file_id,)
        )
        file_row = result.fetchone()
        if not file_row:
            raise ValueError(f"File {file_id} not found")

        file_name = file_row[0]

        # Get shard placements
        result = db_session.execute(
            "SELECT shard_id, shard_index, node_id FROM shards WHERE file_id = ? ORDER BY shard_index",
            (file_id,)
        )
        shards = result.fetchall()

        config = erasure_service.get_config()
        missing_nodes = []
        available_count = 0

        for shard_row in shards:
            shard_id, shard_index, node_id = shard_row
            node = node_manager.nodes.get(node_id)
            if node and node.status == "online":
                available_count += 1
            else:
                missing_nodes.append(node_id)

        # Determine status
        total_shards = len(shards)
        if available_count >= total_shards:
            status = "healthy"
        elif available_count >= config["data_shards"]:
            status = "degraded" if available_count > config["data_shards"] else "at-risk"
        else:
            status = "unrecoverable"

        return FileRecoveryStatus(
            file_id=file_id,
            file_name=file_name,
            status=status,
            available_shards=available_count,
            required_shards=config["data_shards"],
            total_shards=total_shards,
            missing_nodes=missing_nodes
        )

    async def recover_file(
        self,
        file_id: str,
        db_session,
        minio_client=None
    ) -> RecoveryResult:
        """Recover a file by reconstructing missing shards"""
        try:
            logger.info(f"[Recovery] Starting recovery for file {file_id}")

            # Get file info
            result = db_session.execute(
                "SELECT file_id, filename, size_bytes, checksum FROM files WHERE file_id = ?",
                (file_id,)
            )
            file_row = result.fetchone()
            if not file_row:
                return RecoveryResult(
                    success=False,
                    file_id=file_id,
                    recovered_shards=0,
                    missing_shards=0,
                    total_shards=0,
                    error="File not found"
                )

            file_id, file_name, file_size, checksum = file_row

            # Get shard records
            result = db_session.execute(
                "SELECT shard_id, shard_index, node_id, node_url, stored, verified, size_bytes FROM shards WHERE file_id = ? ORDER BY shard_index",
                (file_id,)
            )
            shard_records = result.fetchall()

            # Build placements
            placements = [
                ChunkPlacement(
                    chunk_id=r[0],
                    shard_index=r[1],
                    node_id=r[2],
                    node_url=r[3],
                    stored=bool(r[4]),
                    verified=bool(r[5])
                )
                for r in shard_records
            ]

            # Collect available shards
            if minio_client:
                shards = await node_manager.collect_shards(placements, minio_client)
            else:
                # Without MinIO client, simulate from database
                shards = [None] * len(shard_records)
                for i, r in enumerate(shard_records):
                    node = node_manager.nodes.get(r[2])
                    if node and node.status == "online":
                        shards[i] = Shard(
                            id=r[0],
                            index=r[1],
                            is_data=r[1] < 4,
                            data=b'',  # Would need actual data
                            size=r[6]
                        )

            # Check recovery possibility
            recovery_status = erasure_service.can_recover(shards)
            if not recovery_status["can_recover"]:
                return RecoveryResult(
                    success=False,
                    file_id=file_id,
                    recovered_shards=0,
                    missing_shards=recovery_status["required"] - recovery_status["available"],
                    total_shards=len(shards),
                    error=f"Not enough shards: need {recovery_status['required']}, have {recovery_status['available']}"
                )

            # Count missing shards
            missing_indices = [i for i, s in enumerate(shards) if s is None]

            if not missing_indices:
                return RecoveryResult(
                    success=True,
                    file_id=file_id,
                    recovered_shards=0,
                    missing_shards=0,
                    total_shards=len(shards)
                )

            # If we have minio_client, actually recover the data
            new_placements = []
            if minio_client and all(s is not None and s.data for s in shards if s):
                config = erasure_service.get_config()
                encoded_data = EncodedData(
                    original_size=file_size,
                    shard_size=shard_records[0][6] if shard_records else 0,
                    data_shards=config["data_shards"],
                    parity_shards=config["parity_shards"],
                    shards=[],
                    checksum=checksum or ""
                )

                # Decode to get original data
                recovered_data = erasure_service.decode(encoded_data, shards)

                # Re-encode to get missing shards
                new_encoded = erasure_service.encode(recovered_data)

                # Store recovered shards
                healthy_nodes = node_manager.get_online_nodes()
                existing_node_ids = [p.node_id for p in placements]

                for missing_idx in missing_indices:
                    recovered_shard = new_encoded.shards[missing_idx]

                    # Find a healthy node that doesn't already have this file's shards
                    available_node = next(
                        (n for n in healthy_nodes if n.id not in existing_node_ids),
                        None
                    )

                    if available_node:
                        placement = await node_manager.store_shard(
                            available_node, recovered_shard, minio_client
                        )
                        new_placements.append(placement)

                        # Update database
                        db_session.execute(
                            "UPDATE shards SET node_id = ?, node_url = ?, stored = 1 WHERE file_id = ? AND shard_index = ?",
                            (available_node.id, f"{available_node.url}:{available_node.port}", file_id, missing_idx)
                        )
                        db_session.commit()

            logger.info(f"[Recovery] Recovered {len(new_placements)}/{len(missing_indices)} shards for file {file_id}")

            return RecoveryResult(
                success=True,
                file_id=file_id,
                recovered_shards=len(new_placements),
                missing_shards=len(missing_indices) - len(new_placements),
                total_shards=len(shards),
                new_placements=new_placements
            )

        except Exception as e:
            logger.error(f"[Recovery] Failed for file {file_id}: {e}")
            return RecoveryResult(
                success=False,
                file_id=file_id,
                recovered_shards=0,
                missing_shards=0,
                total_shards=0,
                error=str(e)
            )

    async def get_all_file_statuses(self, db_session) -> List[FileRecoveryStatus]:
        """Get recovery status for all files"""
        result = db_session.execute(
            "SELECT file_id FROM files WHERE is_chunked = 1"
        )
        files = result.fetchall()

        statuses = []
        for file_row in files:
            try:
                status = await self.get_file_recovery_status(file_row[0], db_session)
                statuses.append(status)
            except Exception as e:
                logger.error(f"[Recovery] Failed to get status for file {file_row[0]}: {e}")

        return statuses

    def get_cluster_health_summary(self) -> Dict[str, Any]:
        """Get overall cluster health summary"""
        cluster_status = node_manager.get_cluster_status()
        config = erasure_service.get_config()

        return {
            **cluster_status,
            "erasure_coding": {
                "data_shards": config["data_shards"],
                "parity_shards": config["parity_shards"],
                "total_shards": config["total_shards"],
                "fault_tolerance": config["parity_shards"]
            },
            "can_accept_uploads": cluster_status["online_nodes"] >= config["data_shards"],
            "timestamp": datetime.now().isoformat()
        }


# Singleton instance
recovery_service = RecoveryService()
