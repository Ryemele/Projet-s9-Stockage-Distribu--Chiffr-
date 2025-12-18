/**
 * Client-side Chunking Service
 * 
 * Splits files into chunks BEFORE encryption for efficient distributed storage.
 * Each chunk is identified by its SHA-256 hash for deduplication.
 */

export interface ChunkMetadata {
    index: number;
    hash: string;
    size: number;
    data: ArrayBuffer;
}

export interface ChunkedFile {
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    chunks: ChunkMetadata[];
    totalChunks: number;
    chunkSize: number;
    checksum: string;
}

export type ChunkProgressCallback = (
    progress: number,
    currentChunk: number,
    totalChunks: number,
    status: string
) => void;

class ChunkingService {
    private readonly DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1 MB

    async chunkFile(
        file: File,
        chunkSize: number = this.DEFAULT_CHUNK_SIZE,
        onProgress?: ChunkProgressCallback
    ): Promise<ChunkedFile> {
        const fileId = crypto.randomUUID();
        const totalChunks = Math.ceil(file.size / chunkSize);
        const chunks: ChunkMetadata[] = [];

        console.log(`[Chunking] Starting: ${file.name}, ${totalChunks} chunks`);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const blob = file.slice(start, end);
            const data = await blob.arrayBuffer();

            const hash = await this.computeHash(data);

            chunks.push({
                index: i,
                hash,
                size: data.byteLength,
                data,
            });

            if (onProgress) {
                const progress = ((i + 1) / totalChunks) * 100;
                onProgress(progress, i + 1, totalChunks, `Chunking: ${i + 1}/${totalChunks}`);
            }
        }

        const fileBuffer = await file.arrayBuffer();
        const fileChecksum = await this.computeHash(fileBuffer);

        console.log(`[Chunking] Complete: ${chunks.length} chunks, checksum: ${fileChecksum.slice(0, 16)}...`);

        return {
            fileId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            chunks,
            totalChunks,
            chunkSize,
            checksum: fileChecksum,
        };
    }

    async reassembleChunks(
        chunks: ChunkMetadata[],
        expectedChecksum?: string,
        onProgress?: ChunkProgressCallback
    ): Promise<ArrayBuffer> {
        const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);

        for (let i = 0; i < sortedChunks.length; i++) {
            if (sortedChunks[i].index !== i) {
                throw new Error(`Missing chunk at index ${i}`);
            }
        }

        const totalSize = sortedChunks.reduce((sum, c) => sum + c.size, 0);
        const result = new Uint8Array(totalSize);

        let offset = 0;
        for (let i = 0; i < sortedChunks.length; i++) {
            const chunk = sortedChunks[i];
            result.set(new Uint8Array(chunk.data), offset);
            offset += chunk.size;

            if (onProgress) {
                const progress = ((i + 1) / sortedChunks.length) * 100;
                onProgress(progress, i + 1, sortedChunks.length, `Reassembling: ${i + 1}/${sortedChunks.length}`);
            }
        }

        if (expectedChecksum) {
            const actualChecksum = await this.computeHash(result.buffer);
            if (actualChecksum !== expectedChecksum) {
                throw new Error("Checksum mismatch: file integrity compromised");
            }
        }

        return result.buffer;
    }

    async verifyChunk(chunk: ChunkMetadata): Promise<boolean> {
        const computedHash = await this.computeHash(chunk.data);
        return computedHash === chunk.hash;
    }

    async computeHash(data: ArrayBuffer): Promise<string> {
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    getChunkSize(): number {
        return this.DEFAULT_CHUNK_SIZE;
    }

    estimateChunks(fileSize: number, chunkSize?: number): number {
        return Math.ceil(fileSize / (chunkSize || this.DEFAULT_CHUNK_SIZE));
    }
}

export const chunkingService = new ChunkingService();
