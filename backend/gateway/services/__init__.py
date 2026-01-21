"""
Backend Services for Distributed Encrypted Storage

This module provides:
- ChunkService: File chunking and reconstruction
- ErasureService: Reed-Solomon RS(4,2) erasure coding
- NodeManager: Storage cluster management
- RecoveryService: Automatic file recovery
"""

from .chunk_service import chunk_service, ChunkService, Chunk, ChunkedFile
from .erasure_service import erasure_service, ErasureService, Shard, EncodedData
from .node_manager import node_manager, NodeManager, StorageNode, ChunkPlacement
from .recovery_service import recovery_service, RecoveryService, FileRecoveryStatus, RecoveryResult

__all__ = [
    # Chunk Service
    "chunk_service",
    "ChunkService",
    "Chunk",
    "ChunkedFile",

    # Erasure Service
    "erasure_service",
    "ErasureService",
    "Shard",
    "EncodedData",

    # Node Manager
    "node_manager",
    "NodeManager",
    "StorageNode",
    "ChunkPlacement",

    # Recovery Service
    "recovery_service",
    "RecoveryService",
    "FileRecoveryStatus",
    "RecoveryResult",
]
