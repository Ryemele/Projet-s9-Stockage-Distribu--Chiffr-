"""
Reed-Solomon Erasure Coding Service

Provides fault tolerance through RS(k, m) encoding:
- k = number of data shards (original data split)
- m = number of parity shards (redundancy)
- Can recover from loss of any m shards

Default configuration: RS(4, 2)
- 4 data shards + 2 parity = 6 total shards
- Can tolerate loss of any 2 shards
- Storage overhead: 50% (6/4 = 1.5x original size)
"""

import hashlib
from dataclasses import dataclass
from typing import List, Optional
import uuid

# Configuration
DEFAULT_DATA_SHARDS = 4
DEFAULT_PARITY_SHARDS = 2


@dataclass
class Shard:
    """Represents a single shard of encoded data"""
    id: str
    index: int
    is_data: bool  # True for data shards, False for parity
    data: bytes
    size: int


@dataclass
class EncodedData:
    """Result of RS encoding"""
    original_size: int
    shard_size: int
    data_shards: int
    parity_shards: int
    shards: List[Shard]
    checksum: str


class GaloisField:
    """
    Galois Field GF(2^8) arithmetic for Reed-Solomon
    Using primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
    """
    FIELD_SIZE = 256
    PRIMITIVE_POLY = 0x11D

    def __init__(self):
        self.exp_table = [0] * (self.FIELD_SIZE * 2)
        self.log_table = [0] * self.FIELD_SIZE
        self._init_tables()

    def _init_tables(self):
        x = 1
        for i in range(255):
            self.exp_table[i] = x
            self.exp_table[i + 255] = x
            self.log_table[x] = i
            x = self._multiply_no_lut(x, 2)
        self.log_table[0] = 0

    def _multiply_no_lut(self, a: int, b: int) -> int:
        result = 0
        while b > 0:
            if b & 1:
                result ^= a
            a <<= 1
            if a & 0x100:
                a ^= self.PRIMITIVE_POLY
            b >>= 1
        return result

    def multiply(self, a: int, b: int) -> int:
        if a == 0 or b == 0:
            return 0
        return self.exp_table[self.log_table[a] + self.log_table[b]]

    def divide(self, a: int, b: int) -> int:
        if b == 0:
            raise ValueError("Division by zero in Galois Field")
        if a == 0:
            return 0
        return self.exp_table[self.log_table[a] + 255 - self.log_table[b]]

    def add(self, a: int, b: int) -> int:
        return a ^ b  # XOR in GF(2^8)

    def subtract(self, a: int, b: int) -> int:
        return a ^ b  # Same as add in GF(2^8)

    def exp(self, n: int) -> int:
        return self.exp_table[n % 255]

    def inverse(self, a: int) -> int:
        if a == 0:
            raise ValueError("Zero has no inverse")
        return self.exp_table[255 - self.log_table[a]]


class ReedSolomon:
    """Reed-Solomon Encoder/Decoder"""

    def __init__(self, data_shards: int = DEFAULT_DATA_SHARDS, parity_shards: int = DEFAULT_PARITY_SHARDS):
        self.data_shards = data_shards
        self.parity_shards = parity_shards
        self.total_shards = data_shards + parity_shards
        self.gf = GaloisField()
        self.vandermonde = self._build_vandermonde_matrix()

    def _build_vandermonde_matrix(self) -> List[List[int]]:
        """Build Vandermonde matrix for encoding"""
        matrix = []

        # First k rows are identity matrix (for data shards)
        for i in range(self.data_shards):
            row = [0] * self.data_shards
            row[i] = 1
            matrix.append(row)

        # Next m rows are Vandermonde for parity
        for i in range(self.parity_shards):
            row = []
            for j in range(self.data_shards):
                val = 1
                for _ in range(j):
                    val = self.gf.multiply(val, i + 1)
                row.append(val)
            matrix.append(row)

        return matrix

    def encode(self, data: bytes) -> List[Shard]:
        """Encode data into k data shards + m parity shards"""
        # Pad data to be divisible by data_shards
        shard_size = (len(data) + self.data_shards - 1) // self.data_shards
        padded_size = shard_size * self.data_shards
        padded_data = data + bytes(padded_size - len(data))

        shards = []

        # Create data shards
        for i in range(self.data_shards):
            shard_data = padded_data[i * shard_size:(i + 1) * shard_size]
            shards.append(Shard(
                id=uuid.uuid4().hex,
                index=i,
                is_data=True,
                data=shard_data,
                size=len(shard_data)
            ))

        # Generate parity shards
        for p in range(self.parity_shards):
            parity_data = bytearray(shard_size)

            for byte_idx in range(shard_size):
                value = 0
                for d in range(self.data_shards):
                    coeff = self.vandermonde[self.data_shards + p][d]
                    data_byte = shards[d].data[byte_idx]
                    value = self.gf.add(value, self.gf.multiply(coeff, data_byte))
                parity_data[byte_idx] = value

            shards.append(Shard(
                id=uuid.uuid4().hex,
                index=self.data_shards + p,
                is_data=False,
                data=bytes(parity_data),
                size=shard_size
            ))

        return shards

    def decode(self, shards: List[Optional[Shard]], original_size: int) -> bytes:
        """
        Decode shards back to original data.
        Can recover even if some shards are missing (up to m shards).
        """
        available_shards = [s for s in shards if s is not None]

        if len(available_shards) < self.data_shards:
            raise ValueError(
                f"Need at least {self.data_shards} shards to decode, only have {len(available_shards)}"
            )

        shard_size = available_shards[0].size

        # Check if we have all data shards
        data_shard_indices = [s.index for s in available_shards if s.index < self.data_shards]

        if len(data_shard_indices) == self.data_shards:
            # All data shards present, just concatenate
            result = bytearray(self.data_shards * shard_size)
            for shard in available_shards:
                if shard.is_data:
                    start = shard.index * shard_size
                    result[start:start + shard_size] = shard.data
            return bytes(result[:original_size])

        # Need to use erasure coding to recover missing shards
        used_shards = available_shards[:self.data_shards]

        # Build decoding matrix from the rows we have
        sub_matrix = [self.vandermonde[s.index] for s in used_shards]

        # Invert the matrix
        inv_matrix = self._invert_matrix(sub_matrix)

        # Reconstruct data shards
        result = bytearray(self.data_shards * shard_size)

        for byte_idx in range(shard_size):
            for d in range(self.data_shards):
                value = 0
                for i in range(self.data_shards):
                    coeff = inv_matrix[d][i]
                    shard_byte = used_shards[i].data[byte_idx]
                    value = self.gf.add(value, self.gf.multiply(coeff, shard_byte))
                result[d * shard_size + byte_idx] = value

        return bytes(result[:original_size])

    def _invert_matrix(self, matrix: List[List[int]]) -> List[List[int]]:
        """Invert a matrix in GF(2^8)"""
        n = len(matrix)
        augmented = [row[:] + [1 if i == j else 0 for j in range(n)] for i, row in enumerate(matrix)]

        # Gaussian elimination
        for col in range(n):
            # Find pivot
            pivot = -1
            for row in range(col, n):
                if augmented[row][col] != 0:
                    pivot = row
                    break
            if pivot == -1:
                raise ValueError("Matrix is not invertible")

            # Swap rows
            augmented[col], augmented[pivot] = augmented[pivot], augmented[col]

            # Scale pivot row
            scale = self.gf.inverse(augmented[col][col])
            for j in range(2 * n):
                augmented[col][j] = self.gf.multiply(augmented[col][j], scale)

            # Eliminate column
            for row in range(n):
                if row != col and augmented[row][col] != 0:
                    factor = augmented[row][col]
                    for j in range(2 * n):
                        augmented[row][j] = self.gf.subtract(
                            augmented[row][j],
                            self.gf.multiply(factor, augmented[col][j])
                        )

        # Extract inverse matrix (right half of augmented)
        return [row[n:] for row in augmented]

    def get_config(self):
        return {
            "data_shards": self.data_shards,
            "parity_shards": self.parity_shards,
            "total_shards": self.total_shards
        }


class ErasureService:
    """High-level erasure coding service"""

    def __init__(self, data_shards: int = DEFAULT_DATA_SHARDS, parity_shards: int = DEFAULT_PARITY_SHARDS):
        self.rs = ReedSolomon(data_shards, parity_shards)
        print(f"[ErasureService] Initialized RS({data_shards}, {parity_shards}) - can tolerate {parity_shards} failures")

    def encode(self, data: bytes) -> EncodedData:
        """Encode data with Reed-Solomon erasure coding"""
        checksum = hashlib.sha256(data).hexdigest()
        shards = self.rs.encode(data)
        config = self.rs.get_config()

        print(f"[ErasureService] Encoded {len(data)} bytes into {len(shards)} shards")

        return EncodedData(
            original_size=len(data),
            shard_size=shards[0].size if shards else 0,
            data_shards=config["data_shards"],
            parity_shards=config["parity_shards"],
            shards=shards,
            checksum=checksum
        )

    def decode(self, encoded_data: EncodedData, available_shards: List[Optional[Shard]]) -> bytes:
        """Decode shards back to original data"""
        data = self.rs.decode(available_shards, encoded_data.original_size)

        # Verify checksum
        actual_checksum = hashlib.sha256(data).hexdigest()
        if actual_checksum != encoded_data.checksum:
            raise ValueError("Data integrity check failed after decode")

        print(f"[ErasureService] Decoded {len(data)} bytes from shards")
        return data

    def can_recover(self, available_shards: List[Optional[Shard]]) -> dict:
        """Check if recovery is possible"""
        config = self.rs.get_config()
        available = len([s for s in available_shards if s is not None])
        return {
            "can_recover": available >= config["data_shards"],
            "available": available,
            "required": config["data_shards"]
        }

    def get_config(self):
        return self.rs.get_config()


# Singleton instance with default RS(4, 2) config
erasure_service = ErasureService()
