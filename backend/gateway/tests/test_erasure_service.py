"""
Tests for Reed-Solomon Erasure Coding Service

Tests cover:
- Encoding/decoding with all shards present
- Recovery with missing data shards
- Recovery with missing parity shards
- Edge cases (small data, large data)
- Failure when too many shards missing
"""

import pytest
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.erasure_service import erasure_service, ErasureService, Shard


class TestErasureServiceEncoding:
    """Tests for RS encoding"""

    def test_creates_correct_number_of_shards(self):
        """Should create 6 shards (4 data + 2 parity) with RS(4,2)"""
        data = b"Test data for erasure encoding"
        encoded = erasure_service.encode(data)

        assert len(encoded.shards) == 6
        assert encoded.data_shards == 4
        assert encoded.parity_shards == 2

    def test_data_shards_are_marked_correctly(self):
        """First 4 shards should be data, last 2 should be parity"""
        data = b"Test data"
        encoded = erasure_service.encode(data)

        for shard in encoded.shards[:4]:
            assert shard.is_data == True
            assert shard.index < 4

        for shard in encoded.shards[4:]:
            assert shard.is_data == False
            assert shard.index >= 4

    def test_shards_have_equal_size(self):
        """All shards should have the same size"""
        data = b"x" * 1000
        encoded = erasure_service.encode(data)

        sizes = set(s.size for s in encoded.shards)
        assert len(sizes) == 1

    def test_checksum_is_computed(self):
        """Checksum should be SHA256 hex string"""
        data = b"Test data"
        encoded = erasure_service.encode(data)

        assert len(encoded.checksum) == 64
        assert all(c in "0123456789abcdef" for c in encoded.checksum)


class TestErasureServiceDecoding:
    """Tests for RS decoding"""

    def test_decode_with_all_shards(self):
        """Should recover original data when all shards present"""
        original = b"Test data for complete recovery"
        encoded = erasure_service.encode(original)

        recovered = erasure_service.decode(encoded, encoded.shards)

        assert recovered == original

    def test_decode_with_one_missing_data_shard(self):
        """Should recover with 1 missing data shard"""
        original = b"Recovery test with one missing shard"
        encoded = erasure_service.encode(original)

        # Remove first data shard
        shards_with_missing = [None] + encoded.shards[1:]

        recovered = erasure_service.decode(encoded, shards_with_missing)

        assert recovered == original

    def test_decode_with_two_missing_data_shards(self):
        """Should recover with 2 missing data shards (max tolerance)"""
        original = b"Recovery test with two missing shards"
        encoded = erasure_service.encode(original)

        # Remove first two data shards
        shards_with_missing = [None, None] + encoded.shards[2:]

        recovered = erasure_service.decode(encoded, shards_with_missing)

        assert recovered == original

    def test_decode_with_missing_parity_shards(self):
        """Should recover when only parity shards are missing"""
        original = b"Only parity shards missing"
        encoded = erasure_service.encode(original)

        # Remove both parity shards (indices 4 and 5)
        shards_with_missing = encoded.shards[:4] + [None, None]

        recovered = erasure_service.decode(encoded, shards_with_missing)

        assert recovered == original

    def test_decode_fails_with_three_missing(self):
        """Should fail when more than 2 shards are missing"""
        original = b"Too many missing"
        encoded = erasure_service.encode(original)

        # Remove 3 shards (more than parity count)
        shards_with_missing = [None, None, None] + encoded.shards[3:]

        with pytest.raises(ValueError, match="Need at least"):
            erasure_service.decode(encoded, shards_with_missing)

    def test_decode_verifies_checksum(self):
        """Should verify checksum after decode"""
        original = b"Data with checksum verification"
        encoded = erasure_service.encode(original)

        # Corrupt the expected checksum
        encoded.checksum = "0" * 64

        with pytest.raises(ValueError, match="integrity"):
            erasure_service.decode(encoded, encoded.shards)


class TestErasureServiceEdgeCases:
    """Edge case tests"""

    def test_minimum_data_size(self):
        """Should handle single byte of data"""
        original = b"x"
        encoded = erasure_service.encode(original)
        recovered = erasure_service.decode(encoded, encoded.shards)

        assert recovered == original

    def test_empty_data(self):
        """Should handle empty data"""
        original = b""
        encoded = erasure_service.encode(original)
        recovered = erasure_service.decode(encoded, encoded.shards)

        assert recovered == original

    def test_large_data(self):
        """Should handle 1MB of data"""
        original = os.urandom(1024 * 1024)
        encoded = erasure_service.encode(original)
        recovered = erasure_service.decode(encoded, encoded.shards)

        assert recovered == original

    def test_data_not_divisible_by_shard_count(self):
        """Should handle data size not divisible by 4"""
        original = b"x" * 1001  # 1001 not divisible by 4
        encoded = erasure_service.encode(original)
        recovered = erasure_service.decode(encoded, encoded.shards)

        assert recovered == original


class TestCanRecover:
    """Tests for recovery possibility check"""

    def test_can_recover_with_all_shards(self):
        """Should indicate recovery possible with all shards"""
        shards = [Shard(id=f"s{i}", index=i, is_data=i < 4, data=b"x", size=1) for i in range(6)]

        result = erasure_service.can_recover(shards)

        assert result["can_recover"] == True
        assert result["available"] == 6
        assert result["required"] == 4

    def test_can_recover_with_minimum_shards(self):
        """Should indicate recovery possible with exactly 4 shards"""
        shards = [
            Shard(id="s0", index=0, is_data=True, data=b"x", size=1),
            Shard(id="s1", index=1, is_data=True, data=b"x", size=1),
            Shard(id="s2", index=2, is_data=True, data=b"x", size=1),
            Shard(id="s3", index=3, is_data=True, data=b"x", size=1),
            None,
            None
        ]

        result = erasure_service.can_recover(shards)

        assert result["can_recover"] == True
        assert result["available"] == 4

    def test_cannot_recover_with_too_few_shards(self):
        """Should indicate recovery impossible with < 4 shards"""
        shards = [
            Shard(id="s0", index=0, is_data=True, data=b"x", size=1),
            None,
            None,
            None,
            None,
            None
        ]

        result = erasure_service.can_recover(shards)

        assert result["can_recover"] == False
        assert result["available"] == 1


class TestCustomConfiguration:
    """Tests for custom RS configurations"""

    def test_rs_3_2_configuration(self):
        """Should work with RS(3,2) configuration"""
        service = ErasureService(data_shards=3, parity_shards=2)

        original = b"Custom RS(3,2) test"
        encoded = service.encode(original)

        assert len(encoded.shards) == 5  # 3 data + 2 parity
        assert encoded.data_shards == 3
        assert encoded.parity_shards == 2

        recovered = service.decode(encoded, encoded.shards)
        assert recovered == original

    def test_rs_2_1_configuration(self):
        """Should work with RS(2,1) configuration"""
        service = ErasureService(data_shards=2, parity_shards=1)

        original = b"Minimal RS(2,1)"
        encoded = service.encode(original)

        assert len(encoded.shards) == 3

        # Should recover with one missing
        shards_with_missing = [None] + encoded.shards[1:]
        recovered = service.decode(encoded, shards_with_missing)

        assert recovered == original


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
