/**
 * Reed-Solomon Erasure Coding Service
 * 
 * Provides fault tolerance through RS(k, m) encoding:
 * - k = number of data shards (original data split)
 * - m = number of parity shards (redundancy)
 * - Can recover from loss of any m shards
 * 
 * Default configuration: RS(4, 2)
 * - 4 data shards + 2 parity = 6 total shards
 * - Can tolerate loss of any 2 shards
 * - Storage overhead: 50% (6/4 = 1.5x original size)
 */

import crypto from 'crypto';

// Configuration
const DEFAULT_DATA_SHARDS = 4;    // k
const DEFAULT_PARITY_SHARDS = 2;  // m

export interface Shard {
    id: string;          // Unique shard identifier
    index: number;       // Shard index (0 to k+m-1)
    isData: boolean;     // true for data shards, false for parity
    data: Buffer;        // Shard content
    size: number;
}

export interface EncodedData {
    originalSize: number;
    shardSize: number;
    dataShards: number;
    parityShards: number;
    shards: Shard[];
    checksum: string;
}

/**
 * Galois Field GF(2^8) arithmetic for Reed-Solomon
 * Using primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
 */
class GaloisField {
    private static readonly FIELD_SIZE = 256;
    private static readonly PRIMITIVE_POLY = 0x11D;

    private expTable: Uint8Array;
    private logTable: Uint8Array;

    constructor() {
        this.expTable = new Uint8Array(GaloisField.FIELD_SIZE * 2);
        this.logTable = new Uint8Array(GaloisField.FIELD_SIZE);
        this.initTables();
    }

    private initTables(): void {
        let x = 1;
        for (let i = 0; i < 255; i++) {
            this.expTable[i] = x;
            this.expTable[i + 255] = x;
            this.logTable[x] = i;
            x = this.multiply_noLUT(x, 2);
        }
        this.logTable[0] = 0; // log(0) is undefined, but we set it to 0
    }

    private multiply_noLUT(a: number, b: number): number {
        let result = 0;
        while (b > 0) {
            if (b & 1) result ^= a;
            a <<= 1;
            if (a & 0x100) a ^= GaloisField.PRIMITIVE_POLY;
            b >>= 1;
        }
        return result;
    }

    multiply(a: number, b: number): number {
        if (a === 0 || b === 0) return 0;
        return this.expTable[this.logTable[a] + this.logTable[b]];
    }

    divide(a: number, b: number): number {
        if (b === 0) throw new Error('Division by zero in Galois Field');
        if (a === 0) return 0;
        return this.expTable[this.logTable[a] + 255 - this.logTable[b]];
    }

    add(a: number, b: number): number {
        return a ^ b; // XOR in GF(2^8)
    }

    subtract(a: number, b: number): number {
        return a ^ b; // Same as add in GF(2^8)
    }

    exp(n: number): number {
        return this.expTable[n % 255];
    }

    inverse(a: number): number {
        if (a === 0) throw new Error('Zero has no inverse');
        return this.expTable[255 - this.logTable[a]];
    }
}

/**
 * Reed-Solomon Encoder/Decoder
 */
class ReedSolomon {
    private dataShards: number;
    private parityShards: number;
    private totalShards: number;
    private gf: GaloisField;
    private vandermonde: number[][];

    constructor(dataShards: number = DEFAULT_DATA_SHARDS, parityShards: number = DEFAULT_PARITY_SHARDS) {
        this.dataShards = dataShards;
        this.parityShards = parityShards;
        this.totalShards = dataShards + parityShards;
        this.gf = new GaloisField();
        this.vandermonde = this.buildVandermondeMatrix();
    }

    /**
     * Build Vandermonde matrix for encoding
     */
    private buildVandermondeMatrix(): number[][] {
        const matrix: number[][] = [];

        // First k rows are identity matrix (for data shards)
        for (let i = 0; i < this.dataShards; i++) {
            const row = new Array(this.dataShards).fill(0);
            row[i] = 1;
            matrix.push(row);
        }

        // Next m rows are Vandermonde for parity
        for (let i = 0; i < this.parityShards; i++) {
            const row: number[] = [];
            for (let j = 0; j < this.dataShards; j++) {
                // Vandermonde element: x^j where x = i+1
                let val = 1;
                for (let p = 0; p < j; p++) {
                    val = this.gf.multiply(val, i + 1);
                }
                row.push(val);
            }
            matrix.push(row);
        }

        return matrix;
    }

    /**
     * Encode data into k data shards + m parity shards
     */
    encode(data: Buffer): Shard[] {
        // Pad data to be divisible by dataShards
        const shardSize = Math.ceil(data.length / this.dataShards);
        const paddedSize = shardSize * this.dataShards;
        const paddedData = Buffer.alloc(paddedSize);
        data.copy(paddedData);

        // Split into data shards
        const shards: Shard[] = [];

        for (let i = 0; i < this.dataShards; i++) {
            const shardData = paddedData.slice(i * shardSize, (i + 1) * shardSize);
            shards.push({
                id: crypto.randomBytes(16).toString('hex'),
                index: i,
                isData: true,
                data: shardData,
                size: shardData.length
            });
        }

        // Generate parity shards
        for (let p = 0; p < this.parityShards; p++) {
            const parityData = Buffer.alloc(shardSize);

            for (let byte = 0; byte < shardSize; byte++) {
                let value = 0;
                for (let d = 0; d < this.dataShards; d++) {
                    const coeff = this.vandermonde[this.dataShards + p][d];
                    const dataByte = shards[d].data[byte];
                    value = this.gf.add(value, this.gf.multiply(coeff, dataByte));
                }
                parityData[byte] = value;
            }

            shards.push({
                id: crypto.randomBytes(16).toString('hex'),
                index: this.dataShards + p,
                isData: false,
                data: parityData,
                size: parityData.length
            });
        }

        return shards;
    }

    /**
     * Decode shards back to original data
     * Can recover even if some shards are missing (up to m shards)
     */
    decode(shards: (Shard | null)[], originalSize: number): Buffer {
        const availableShards = shards.filter((s): s is Shard => s !== null);

        if (availableShards.length < this.dataShards) {
            throw new Error(`Need at least ${this.dataShards} shards to decode, only have ${availableShards.length}`);
        }

        const shardSize = availableShards[0].size;

        // Check if we have all data shards
        const dataShardIndices = availableShards
            .filter(s => s.index < this.dataShards)
            .map(s => s.index);

        if (dataShardIndices.length === this.dataShards) {
            // All data shards present, just concatenate
            const result = Buffer.alloc(this.dataShards * shardSize);
            for (const shard of availableShards) {
                if (shard.isData) {
                    shard.data.copy(result, shard.index * shardSize);
                }
            }
            return result.slice(0, originalSize);
        }

        // Need to use erasure coding to recover missing shards
        // Take first k available shards
        const usedShards = availableShards.slice(0, this.dataShards);

        // Build decoding matrix from the rows we have
        const subMatrix = usedShards.map(s => this.vandermonde[s.index]);

        // Invert the matrix
        const invMatrix = this.invertMatrix(subMatrix);

        // Reconstruct data shards
        const result = Buffer.alloc(this.dataShards * shardSize);

        for (let byte = 0; byte < shardSize; byte++) {
            for (let d = 0; d < this.dataShards; d++) {
                let value = 0;
                for (let i = 0; i < this.dataShards; i++) {
                    const coeff = invMatrix[d][i];
                    const shardByte = usedShards[i].data[byte];
                    value = this.gf.add(value, this.gf.multiply(coeff, shardByte));
                }
                result[d * shardSize + byte] = value;
            }
        }

        return result.slice(0, originalSize);
    }

    /**
     * Invert a matrix in GF(2^8)
     */
    private invertMatrix(matrix: number[][]): number[][] {
        const n = matrix.length;
        const augmented: number[][] = matrix.map((row, i) => {
            const newRow = [...row];
            // Add identity matrix on the right
            for (let j = 0; j < n; j++) {
                newRow.push(i === j ? 1 : 0);
            }
            return newRow;
        });

        // Gaussian elimination
        for (let col = 0; col < n; col++) {
            // Find pivot
            let pivot = -1;
            for (let row = col; row < n; row++) {
                if (augmented[row][col] !== 0) {
                    pivot = row;
                    break;
                }
            }
            if (pivot === -1) {
                throw new Error('Matrix is not invertible');
            }

            // Swap rows
            [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];

            // Scale pivot row
            const scale = this.gf.inverse(augmented[col][col]);
            for (let j = 0; j < 2 * n; j++) {
                augmented[col][j] = this.gf.multiply(augmented[col][j], scale);
            }

            // Eliminate column
            for (let row = 0; row < n; row++) {
                if (row !== col && augmented[row][col] !== 0) {
                    const factor = augmented[row][col];
                    for (let j = 0; j < 2 * n; j++) {
                        augmented[row][j] = this.gf.subtract(
                            augmented[row][j],
                            this.gf.multiply(factor, augmented[col][j])
                        );
                    }
                }
            }
        }

        // Extract inverse matrix (right half of augmented)
        return augmented.map(row => row.slice(n));
    }

    getConfig() {
        return {
            dataShards: this.dataShards,
            parityShards: this.parityShards,
            totalShards: this.totalShards
        };
    }
}

/**
 * Erasure Coding Service
 */
class ErasureService {
    private rs: ReedSolomon;

    constructor(dataShards: number = DEFAULT_DATA_SHARDS, parityShards: number = DEFAULT_PARITY_SHARDS) {
        this.rs = new ReedSolomon(dataShards, parityShards);
        console.log(`[ErasureService] Initialized RS(${dataShards}, ${parityShards}) - can tolerate ${parityShards} failures`);
    }

    /**
     * Encode data with Reed-Solomon erasure coding
     */
    encode(data: Buffer): EncodedData {
        const checksum = crypto.createHash('sha256').update(data).digest('hex');
        const shards = this.rs.encode(data);

        const config = this.rs.getConfig();

        console.log(`[ErasureService] Encoded ${data.length} bytes into ${shards.length} shards`);

        return {
            originalSize: data.length,
            shardSize: shards[0].size,
            dataShards: config.dataShards,
            parityShards: config.parityShards,
            shards,
            checksum
        };
    }

    /**
     * Decode shards back to original data
     */
    decode(encodedData: EncodedData, availableShards: (Shard | null)[]): Buffer {
        const data = this.rs.decode(availableShards, encodedData.originalSize);

        // Debug logging
        console.log(`[ErasureService] Decode debug:`);
        console.log(`  - Original size expected: ${encodedData.originalSize}`);
        console.log(`  - Decoded data size: ${data.length}`);
        console.log(`  - Expected checksum: ${encodedData.checksum}`);

        // Verify checksum
        const actualChecksum = crypto.createHash('sha256').update(data).digest('hex');
        console.log(`  - Actual checksum: ${actualChecksum}`);
        console.log(`  - Match: ${actualChecksum === encodedData.checksum}`);

        if (actualChecksum !== encodedData.checksum) {
            throw new Error('Data integrity check failed after decode');
        }

        console.log(`[ErasureService] Decoded ${data.length} bytes from shards`);
        return data;
    }

    /**
     * Check how many shards are available and if recovery is possible
     */
    canRecover(availableShards: (Shard | null)[]): { canRecover: boolean; available: number; required: number } {
        const config = this.rs.getConfig();
        const available = availableShards.filter(s => s !== null).length;
        return {
            canRecover: available >= config.dataShards,
            available,
            required: config.dataShards
        };
    }

    getConfig() {
        return this.rs.getConfig();
    }
}

// Export singleton with default config RS(4, 2)
export const erasureService = new ErasureService();

// Export class for custom configurations
export { ErasureService, ReedSolomon, GaloisField };
