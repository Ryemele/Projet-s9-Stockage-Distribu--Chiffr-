"""
Tests for File Chunking Service

Tests cover:
- Chunking files into correct sizes
- Content-addressable storage (hash-based IDs)
- Chunk reassembly
- Integrity verification
- Edge cases
"""

import pytest
import os
import sys
import hashlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.chunk_service import chunk_service, ChunkService, Chunk


class TestBasicChunking:
    """Basic chunking tests"""

    def test_chunks_file_into_correct_count(self):
        """Should split 3MB file into 3 chunks (1MB each)"""
        data = b"x" * (3 * 1024 * 1024)  # 3 MB
        result = chunk_service.chunk_file(data, "test.bin", "application/octet-stream", "file-1")

        assert result.total_chunks == 3
        assert len(result.chunks) == 3

    def test_last_chunk_can_be_smaller(self):
        """Should handle last chunk being smaller than chunk size"""
        data = b"x" * (2 * 1024 * 1024 + 512 * 1024)  # 2.5 MB
        result = chunk_service.chunk_file(data, "test.bin", "application/octet-stream", "file-1")

        assert result.total_chunks == 3
        assert result.chunks[0].size == 1024 * 1024
        assert result.chunks[1].size == 1024 * 1024
        assert result.chunks[2].size == 512 * 1024

    def test_small_file_single_chunk(self):
        """Should create single chunk for small files"""
        data = b"Small file content"
        result = chunk_service.chunk_file(data, "small.txt", "text/plain", "file-1")

        assert result.total_chunks == 1
        assert result.chunks[0].size == len(data)

    def test_empty_file(self):
        """Should handle empty files"""
        data = b""
        result = chunk_service.chunk_file(data, "empty.txt", "text/plain", "file-1")

        assert result.total_chunks == 0
        assert len(result.chunks) == 0

    def test_file_exactly_chunk_size(self):
        """Should handle file exactly equal to chunk size"""
        data = b"x" * (1024 * 1024)  # Exactly 1 MB
        result = chunk_service.chunk_file(data, "exact.bin", "application/octet-stream", "file-1")

        assert result.total_chunks == 1


class TestChunkHashing:
    """Content-addressable storage tests"""

    def test_chunk_id_is_content_hash(self):
        """Chunk ID should be SHA256 of content"""
        data = b"Hello World"
        result = chunk_service.chunk_file(data, "test.txt", "text/plain", "file-1")

        expected_hash = hashlib.sha256(data).hexdigest()
        assert result.chunks[0].id == expected_hash

    def test_identical_chunks_have_same_id(self):
        """Identical content should produce same chunk ID"""
        data = b"x" * (2 * 1024 * 1024)  # Two identical 1MB chunks
        result = chunk_service.chunk_file(data, "test.bin", "application/octet-stream", "file-1")

        # Both chunks have same content, so same ID
        assert result.chunks[0].id == result.chunks[1].id

    def test_different_chunks_have_different_ids(self):
        """Different content should produce different chunk IDs"""
        data = b"A" * (1024 * 1024) + b"B" * (1024 * 1024)
        result = chunk_service.chunk_file(data, "test.bin", "application/octet-stream", "file-1")

        assert result.chunks[0].id != result.chunks[1].id

    def test_file_checksum_computed(self):
        """File checksum should be SHA256 of entire file"""
        data = b"Test file content"
        result = chunk_service.chunk_file(data, "test.txt", "text/plain", "file-1")

        expected_checksum = hashlib.sha256(data).hexdigest()
        assert result.checksum == expected_checksum


class TestChunkReassembly:
    """Chunk reassembly tests"""

    def test_reassemble_preserves_content(self):
        """Reassembled file should match original"""
        original = b"The quick brown fox jumps over the lazy dog" * 100000
        chunked = chunk_service.chunk_file(original, "test.txt", "text/plain", "file-1")

        reassembled = chunk_service.reconstruct_file(chunked.chunks, chunked.checksum)

        assert reassembled == original

    def test_reassemble_out_of_order_chunks(self):
        """Should reassemble correctly regardless of chunk order"""
        original = b"x" * (3 * 1024 * 1024)
        chunked = chunk_service.chunk_file(original, "test.bin", "application/octet-stream", "file-1")

        # Shuffle chunks
        shuffled = [chunked.chunks[2], chunked.chunks[0], chunked.chunks[1]]

        reassembled = chunk_service.reconstruct_file(shuffled, chunked.checksum)

        assert reassembled == original

    def test_reassemble_detects_missing_chunk(self):
        """Should detect missing chunks during reassembly"""
        data = b"x" * (3 * 1024 * 1024)
        chunked = chunk_service.chunk_file(data, "test.bin", "application/octet-stream", "file-1")

        # Remove middle chunk
        incomplete = [chunked.chunks[0], chunked.chunks[2]]

        with pytest.raises(ValueError, match="Missing chunk"):
            chunk_service.reconstruct_file(incomplete)

    def test_reassemble_verifies_checksum(self):
        """Should verify checksum after reassembly"""
        data = b"Test content"
        chunked = chunk_service.chunk_file(data, "test.txt", "text/plain", "file-1")

        # Provide wrong checksum
        with pytest.raises(ValueError, match="checksum"):
            chunk_service.reconstruct_file(chunked.chunks, "wrong_checksum")


class TestChunkVerification:
    """Chunk integrity verification tests"""

    def test_verify_valid_chunk(self):
        """Should verify intact chunk"""
        data = b"Valid chunk data"
        chunk = Chunk(
            id=hashlib.sha256(data).hexdigest(),
            index=0,
            size=len(data),
            data=data
        )

        assert chunk_service.verify_chunk(chunk) == True

    def test_verify_corrupted_chunk(self):
        """Should detect corrupted chunk"""
        original = b"Original data"
        chunk = Chunk(
            id=hashlib.sha256(original).hexdigest(),
            index=0,
            size=len(original),
            data=b"Corrupted data"  # Different content
        )

        assert chunk_service.verify_chunk(chunk) == False


class TestCustomChunkSize:
    """Tests for custom chunk sizes"""

    def test_custom_chunk_size(self):
        """Should respect custom chunk size"""
        service = ChunkService(chunk_size=100)

        data = b"x" * 350  # Should create 4 chunks with size 100
        result = service.chunk_file(data, "test.bin", "application/octet-stream", "file-1")

        assert result.total_chunks == 4
        assert result.chunks[0].size == 100
        assert result.chunks[3].size == 50  # Last chunk

    def test_calculate_chunk_count(self):
        """Should correctly calculate expected chunk count"""
        service = ChunkService(chunk_size=1000)

        assert service.calculate_chunk_count(1000) == 1
        assert service.calculate_chunk_count(1001) == 2
        assert service.calculate_chunk_count(3000) == 3
        assert service.calculate_chunk_count(3001) == 4


class TestProgressCallback:
    """Tests for progress tracking"""

    def test_progress_callback_called(self):
        """Should call progress callback during chunking"""
        progress_values = []

        def callback(progress):
            progress_values.append(progress)

        data = b"x" * (3 * 1024 * 1024)
        chunk_service.chunk_file(data, "test.bin", "application/octet-stream", "file-1", callback)

        assert len(progress_values) == 3
        assert progress_values[-1] == 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
