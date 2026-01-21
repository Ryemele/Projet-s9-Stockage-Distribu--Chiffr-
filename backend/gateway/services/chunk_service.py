"""
Chunk Service - Handles file chunking and reconstruction

Features:
- Splits files into fixed-size chunks (1MB default)
- Content-addressable storage (chunk ID = SHA256 hash)
- Integrity verification via checksums
- Efficient reconstruction from chunks
"""

import hashlib
from dataclasses import dataclass
from typing import List, Optional, Callable

# Default chunk size: 1MB
CHUNK_SIZE = 1024 * 1024


@dataclass
class Chunk:
    """Represents a single chunk of a file"""
    id: str           # SHA256 hash of chunk data (content-addressable)
    index: int        # Position in original file
    size: int         # Size in bytes
    data: bytes       # Raw chunk data


@dataclass
class ChunkedFile:
    """Result of chunking a file"""
    file_id: str
    file_name: str
    file_size: int
    mime_type: str
    total_chunks: int
    chunks: List[Chunk]
    checksum: str     # SHA256 of entire file


class ChunkService:
    """Service for splitting and reassembling files"""

    def __init__(self, chunk_size: int = CHUNK_SIZE):
        self.chunk_size = chunk_size

    def chunk_file(
        self,
        file_data: bytes,
        file_name: str,
        mime_type: str,
        file_id: str,
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> ChunkedFile:
        """
        Split a file buffer into chunks.

        Args:
            file_data: Raw file bytes
            file_name: Original file name
            mime_type: MIME type of the file
            file_id: Unique identifier for the file
            progress_callback: Optional callback for progress updates (0-100)

        Returns:
            ChunkedFile with all chunks
        """
        chunks = []
        total_size = len(file_data)
        total_chunks = (total_size + self.chunk_size - 1) // self.chunk_size

        # Calculate file checksum
        file_checksum = hashlib.sha256(file_data).hexdigest()

        for i in range(total_chunks):
            start = i * self.chunk_size
            end = min(start + self.chunk_size, total_size)
            chunk_data = file_data[start:end]

            # Chunk ID is SHA256 of chunk content (content-addressable)
            chunk_id = hashlib.sha256(chunk_data).hexdigest()

            chunks.append(Chunk(
                id=chunk_id,
                index=i,
                size=len(chunk_data),
                data=chunk_data
            ))

            if progress_callback:
                progress = int((i + 1) / total_chunks * 100)
                progress_callback(progress)

        print(f'[ChunkService] File "{file_name}" split into {total_chunks} chunks')

        return ChunkedFile(
            file_id=file_id,
            file_name=file_name,
            file_size=total_size,
            mime_type=mime_type,
            total_chunks=total_chunks,
            chunks=chunks,
            checksum=file_checksum
        )

    def reconstruct_file(
        self,
        chunks: List[Chunk],
        expected_checksum: Optional[str] = None,
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> bytes:
        """
        Reconstruct file from chunks.

        Args:
            chunks: List of chunks to reassemble
            expected_checksum: Optional checksum for verification
            progress_callback: Optional callback for progress updates

        Returns:
            Reconstructed file data

        Raises:
            ValueError: If chunks are missing or checksum fails
        """
        # Sort chunks by index
        sorted_chunks = sorted(chunks, key=lambda c: c.index)

        # Verify we have all chunks (no gaps)
        for i, chunk in enumerate(sorted_chunks):
            if chunk.index != i:
                raise ValueError(f"Missing chunk at index {i}")

        # Concatenate all chunks
        file_data = b''.join(chunk.data for chunk in sorted_chunks)

        if progress_callback:
            progress_callback(100)

        # Verify checksum if provided
        if expected_checksum:
            actual_checksum = hashlib.sha256(file_data).hexdigest()
            if actual_checksum != expected_checksum:
                raise ValueError("File integrity check failed: checksum mismatch")

        print(f'[ChunkService] Reconstructed file from {len(chunks)} chunks')
        return file_data

    def verify_chunk(self, chunk: Chunk) -> bool:
        """Verify a single chunk's integrity"""
        computed_id = hashlib.sha256(chunk.data).hexdigest()
        return computed_id == chunk.id

    def get_chunk_size(self) -> int:
        """Get configured chunk size"""
        return self.chunk_size

    def calculate_chunk_count(self, file_size: int) -> int:
        """Calculate how many chunks a file will produce"""
        return (file_size + self.chunk_size - 1) // self.chunk_size


# Singleton instance with default 1MB chunk size
chunk_service = ChunkService()
