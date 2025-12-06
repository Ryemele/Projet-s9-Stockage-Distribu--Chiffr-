import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Chunk size: 1MB
const CHUNK_SIZE = 1024 * 1024;

export interface Chunk {
    id: string;          // SHA256 hash of chunk data (content-addressable)
    index: number;       // Position in original file
    size: number;        // Size in bytes
    data: Buffer;        // Raw chunk data
}

export interface ChunkedFile {
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    totalChunks: number;
    chunks: Chunk[];
    checksum: string;    // SHA256 of entire file for integrity verification
}

/**
 * ChunkService - Handles file chunking and reconstruction
 * 
 * Features:
 * - Splits files into fixed-size chunks (1MB default)
 * - Content-addressable storage (chunk ID = SHA256 hash)
 * - Integrity verification via checksums
 * - Efficient reconstruction from chunks
 */
class ChunkService {
    private chunkSize: number;

    constructor(chunkSize: number = CHUNK_SIZE) {
        this.chunkSize = chunkSize;
    }

    /**
     * Split a file buffer into chunks
     */
    async chunkFile(
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string,
        fileId: string
    ): Promise<ChunkedFile> {
        const chunks: Chunk[] = [];
        const totalSize = fileBuffer.length;
        const totalChunks = Math.ceil(totalSize / this.chunkSize);

        // Calculate file checksum
        const fileChecksum = crypto
            .createHash('sha256')
            .update(fileBuffer)
            .digest('hex');

        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, totalSize);
            const chunkData = fileBuffer.slice(start, end);

            // Chunk ID is SHA256 of chunk content (content-addressable)
            const chunkId = crypto
                .createHash('sha256')
                .update(chunkData)
                .digest('hex');

            chunks.push({
                id: chunkId,
                index: i,
                size: chunkData.length,
                data: chunkData
            });
        }

        console.log(`[ChunkService] File "${fileName}" split into ${totalChunks} chunks`);

        return {
            fileId,
            fileName,
            fileSize: totalSize,
            mimeType,
            totalChunks,
            chunks,
            checksum: fileChecksum
        };
    }

    /**
     * Reconstruct file from chunks
     */
    async reconstructFile(chunks: Chunk[], expectedChecksum?: string): Promise<Buffer> {
        // Sort chunks by index
        const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);

        // Verify we have all chunks (no gaps)
        for (let i = 0; i < sortedChunks.length; i++) {
            if (sortedChunks[i].index !== i) {
                throw new Error(`Missing chunk at index ${i}`);
            }
        }

        // Concatenate all chunks
        const fileBuffer = Buffer.concat(sortedChunks.map(c => c.data));

        // Verify checksum if provided
        if (expectedChecksum) {
            const actualChecksum = crypto
                .createHash('sha256')
                .update(fileBuffer)
                .digest('hex');

            if (actualChecksum !== expectedChecksum) {
                throw new Error('File integrity check failed: checksum mismatch');
            }
        }

        console.log(`[ChunkService] Reconstructed file from ${chunks.length} chunks`);
        return fileBuffer;
    }

    /**
     * Verify a single chunk's integrity
     */
    verifyChunk(chunk: Chunk): boolean {
        const computedId = crypto
            .createHash('sha256')
            .update(chunk.data)
            .digest('hex');

        return computedId === chunk.id;
    }

    /**
     * Get chunk size configuration
     */
    getChunkSize(): number {
        return this.chunkSize;
    }

    /**
     * Calculate how many chunks a file of given size will produce
     */
    calculateChunkCount(fileSize: number): number {
        return Math.ceil(fileSize / this.chunkSize);
    }
}

// Export singleton instance
export const chunkService = new ChunkService();

// Export class for custom configurations
export { ChunkService };
