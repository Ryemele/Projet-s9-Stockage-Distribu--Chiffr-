/**
 * Streaming Upload/Download Service
 * 
 * Handles large files efficiently with streaming and backpressure.
 * Features: Chunked streaming, progress tracking, memory-efficient processing
 */

import { Transform, Readable, pipeline } from 'stream';
import { promisify } from 'util';
import crypto from 'crypto';
import logger from './logger';
import { Metrics } from './logger';

const pipelineAsync = promisify(pipeline);

// Chunk transformer for streaming
class ChunkTransformer extends Transform {
    private chunkSize: number;
    private buffer: Buffer = Buffer.alloc(0);
    private chunkIndex: number = 0;
    private totalBytes: number = 0;
    private onProgress?: (processed: number, chunkIndex: number) => void;

    constructor(options: {
        chunkSize: number;
        onProgress?: (processed: number, chunkIndex: number) => void;
    }) {
        super({ objectMode: true });
        this.chunkSize = options.chunkSize;
        this.onProgress = options.onProgress;
    }

    _transform(data: Buffer, _encoding: string, callback: (error?: Error | null, data?: any) => void): void {
        this.buffer = Buffer.concat([this.buffer, data]);
        this.totalBytes += data.length;

        while (this.buffer.length >= this.chunkSize) {
            const chunk = this.buffer.slice(0, this.chunkSize);
            this.buffer = this.buffer.slice(this.chunkSize);

            const hash = crypto.createHash('sha256').update(chunk).digest('hex');

            this.push({
                index: this.chunkIndex,
                data: chunk,
                hash,
                size: chunk.length,
            });

            this.chunkIndex++;
            this.onProgress?.(this.totalBytes, this.chunkIndex);
        }

        callback();
    }

    _flush(callback: (error?: Error | null, data?: any) => void): void {
        if (this.buffer.length > 0) {
            const hash = crypto.createHash('sha256').update(this.buffer).digest('hex');

            this.push({
                index: this.chunkIndex,
                data: this.buffer,
                hash,
                size: this.buffer.length,
            });

            this.chunkIndex++;
        }

        callback();
    }

    getStats(): { totalChunks: number; totalBytes: number } {
        return { totalChunks: this.chunkIndex, totalBytes: this.totalBytes };
    }
}

// Encryption transformer
class EncryptionTransformer extends Transform {
    private cipher: crypto.Cipher | null = null;
    private algorithm: string = 'aes-256-gcm';
    private key: Buffer;
    private ivLength: number = 12;

    constructor(key: Buffer) {
        super({ objectMode: true });
        this.key = key;
    }

    _transform(chunk: { index: number; data: Buffer; hash: string; size: number }, _encoding: string, callback: (error?: Error | null, data?: any) => void): void {
        try {
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

            const encrypted = Buffer.concat([
                cipher.update(chunk.data),
                cipher.final(),
            ]);

            const authTag = cipher.getAuthTag();

            this.push({
                ...chunk,
                data: encrypted,
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64'),
                encrypted: true,
            });

            callback();
        } catch (error: any) {
            callback(error);
        }
    }
}

// Decryption transformer
class DecryptionTransformer extends Transform {
    private algorithm: string = 'aes-256-gcm';
    private key: Buffer;

    constructor(key: Buffer) {
        super({ objectMode: true });
        this.key = key;
    }

    _transform(chunk: { data: Buffer; iv: string; authTag: string }, _encoding: string, callback: (error?: Error | null, data?: any) => void): void {
        try {
            const iv = Buffer.from(chunk.iv, 'base64');
            const authTag = Buffer.from(chunk.authTag, 'base64');

            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);

            const decrypted = Buffer.concat([
                decipher.update(chunk.data),
                decipher.final(),
            ]);

            this.push({
                ...chunk,
                data: decrypted,
                encrypted: false,
            });

            callback();
        } catch (error: any) {
            callback(error);
        }
    }
}

// Parallel chunk processor
export class ParallelProcessor<T, R> {
    private concurrency: number;
    private queue: { item: T; resolve: (value: R) => void; reject: (error: Error) => void }[] = [];
    private active: number = 0;

    constructor(
        private processor: (item: T) => Promise<R>,
        options: { concurrency?: number } = {}
    ) {
        this.concurrency = options.concurrency || 4;
    }

    async process(item: T): Promise<R> {
        return new Promise((resolve, reject) => {
            this.queue.push({ item, resolve, reject });
            this.processQueue();
        });
    }

    async processAll(items: T[]): Promise<R[]> {
        const results: R[] = new Array(items.length);

        await Promise.all(
            items.map(async (item, index) => {
                results[index] = await this.process(item);
            })
        );

        return results;
    }

    private async processQueue(): Promise<void> {
        while (this.active < this.concurrency && this.queue.length > 0) {
            const task = this.queue.shift()!;
            this.active++;

            try {
                const result = await this.processor(task.item);
                task.resolve(result);
            } catch (error: any) {
                task.reject(error);
            } finally {
                this.active--;
                this.processQueue();
            }
        }
    }
}

// Content-Defined Chunking (CDC) using Rabin fingerprinting
export class ContentDefinedChunker {
    private minSize: number;
    private maxSize: number;
    private targetSize: number;
    private mask: number;

    constructor(options: {
        minSize?: number;
        maxSize?: number;
        targetSize?: number;
    } = {}) {
        this.minSize = options.minSize || 256 * 1024;       // 256 KB min
        this.maxSize = options.maxSize || 4 * 1024 * 1024;   // 4 MB max
        this.targetSize = options.targetSize || 1024 * 1024; // 1 MB target

        // Calculate mask based on target size
        this.mask = this.calculateMask(this.targetSize);
    }

    private calculateMask(targetSize: number): number {
        const bits = Math.floor(Math.log2(targetSize));
        return (1 << bits) - 1;
    }

    async *chunk(stream: Readable): AsyncGenerator<{ data: Buffer; hash: string; boundary: 'content' | 'size' }> {
        let buffer = Buffer.alloc(0);
        let hash = 0;
        const window = 48; // Sliding window size

        for await (const data of stream) {
            buffer = Buffer.concat([buffer, data]);

            while (buffer.length >= this.minSize) {
                let cutPoint = -1;
                let boundaryType: 'content' | 'size' = 'content';

                // Look for content-defined boundary
                for (let i = this.minSize; i < Math.min(buffer.length, this.maxSize); i++) {
                    // Simple rolling hash (Rabin-like)
                    hash = ((hash << 1) + buffer[i]) & 0x7fffffff;

                    if ((hash & this.mask) === 0) {
                        cutPoint = i + 1;
                        break;
                    }
                }

                // Force cut at max size
                if (cutPoint === -1 && buffer.length >= this.maxSize) {
                    cutPoint = this.maxSize;
                    boundaryType = 'size';
                }

                if (cutPoint > 0) {
                    const chunk = buffer.slice(0, cutPoint);
                    buffer = buffer.slice(cutPoint);
                    hash = 0;

                    const chunkHash = crypto.createHash('sha256').update(chunk).digest('hex');
                    yield { data: chunk, hash: chunkHash, boundary: boundaryType };
                } else {
                    break;
                }
            }
        }

        // Emit remaining data
        if (buffer.length > 0) {
            const chunkHash = crypto.createHash('sha256').update(buffer).digest('hex');
            yield { data: buffer, hash: chunkHash, boundary: 'size' };
        }
    }
}

// Streaming upload handler
export async function handleStreamingUpload(
    inputStream: Readable,
    encryptionKey: Buffer,
    options: {
        chunkSize?: number;
        onProgress?: (progress: { bytes: number; chunks: number; percent: number }) => void;
        useCDC?: boolean;
    } = {}
): Promise<{
    chunks: { index: number; hash: string; size: number; iv: string; authTag: string }[];
    totalSize: number;
    checksum: string;
}> {
    const startTime = Date.now();
    const chunkSize = options.chunkSize || 1024 * 1024;
    const chunks: any[] = [];
    let totalSize = 0;
    const hashStream = crypto.createHash('sha256');

    if (options.useCDC) {
        // Use Content-Defined Chunking
        const cdcChunker = new ContentDefinedChunker();
        let index = 0;

        for await (const { data, hash } of cdcChunker.chunk(inputStream)) {
            const iv = crypto.randomBytes(12);
            const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
            const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
            const authTag = cipher.getAuthTag();

            hashStream.update(data);
            totalSize += data.length;

            chunks.push({
                index: index++,
                hash,
                size: data.length,
                encryptedSize: encrypted.length,
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64'),
                data: encrypted,
            });

            options.onProgress?.({
                bytes: totalSize,
                chunks: chunks.length,
                percent: 0, // Unknown for streams
            });
        }
    } else {
        // Fixed-size chunking with streaming
        const chunkTransformer = new ChunkTransformer({
            chunkSize,
            onProgress: (bytes, chunkCount) => {
                options.onProgress?.({ bytes, chunks: chunkCount, percent: 0 });
            },
        });

        const encryptTransformer = new EncryptionTransformer(encryptionKey);

        // Collect encrypted chunks
        const collector = new Transform({
            objectMode: true,
            transform(chunk, _, callback) {
                hashStream.update(chunk.data);
                totalSize += chunk.size;
                chunks.push({
                    index: chunk.index,
                    hash: chunk.hash,
                    size: chunk.size,
                    iv: chunk.iv,
                    authTag: chunk.authTag,
                    data: chunk.data,
                });
                callback();
            },
        });

        await pipelineAsync(inputStream, chunkTransformer, encryptTransformer, collector);
    }

    const checksum = hashStream.digest('hex');
    const duration = Date.now() - startTime;

    logger.info('Streaming upload complete', {
        chunks: chunks.length,
        totalSize,
        duration,
        throughput: `${(totalSize / duration * 1000 / 1024 / 1024).toFixed(2)} MB/s`,
    });

    Metrics.encryptionDuration(duration);

    // Remove data from chunk metadata before returning
    return {
        chunks: chunks.map(c => ({ ...c, data: undefined })),
        totalSize,
        checksum,
    };
}

export { ChunkTransformer, EncryptionTransformer, DecryptionTransformer };
