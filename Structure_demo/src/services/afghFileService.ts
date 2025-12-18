/**
 * AFGH File Encryption Service - Hybrid KEM-DEM
 * 
 * Flow: File → CHUNK → ENCRYPT each chunk → Store
 * 
 * KEM: AFGH Level 2 encrypts secret S
 * DEM: AES-256-GCM encrypts chunks with key derived from S
 */

import { afghService } from "./afghService";
import { chunkingService, ChunkMetadata, ChunkProgressCallback } from "./chunkingService";
import type {
    AFGHKeyPair,
    AFGHPublicKey,
    AFGHFileEnvelope,
    SharedAFGHFileEnvelope,
    Level2Ciphertext,
    EncryptedChunkAFGH,
    ReEncryptionKey,
    G2Element,
} from "../types/afgh";
import { AFGHError, AFGHErrorCode } from "../types/afgh";

export type FileProgressCallback = (
    progress: number,
    phase: string,
    detail: string
) => void;

class AFGHFileService {
    private readonly CHUNK_SIZE = 1024 * 1024; // 1 MB
    private readonly AES_KEY_LENGTH = 256;
    private readonly AES_IV_LENGTH = 12;
    private readonly PBKDF2_ITERATIONS = 100000;

    /**
     * Encrypt a file using AFGH KEM-DEM hybrid encryption
     * Flow: Chunk first → Then encrypt each chunk
     */
    async encryptFile(
        file: File,
        ownerKeyPair: AFGHKeyPair,
        onProgress?: FileProgressCallback
    ): Promise<AFGHFileEnvelope> {
        try {
            onProgress?.(0, "Initializing", "Preparing encryption...");

            // Step 1: CHUNK the file first (before encryption)
            onProgress?.(5, "Chunking", "Splitting file into chunks...");
            const chunkedFile = await chunkingService.chunkFile(
                file,
                this.CHUNK_SIZE,
                (p, curr, total) => onProgress?.(5 + p * 0.2, "Chunking", `Chunk ${curr}/${total}`)
            );

            // Step 2: Generate random secret S (G2 element)
            onProgress?.(25, "KEM", "Generating secret...");
            const secret_S = afghService.generateRandomG2Element();

            // Step 3: Generate random salt for KDF
            const kdfSalt = crypto.getRandomValues(new Uint8Array(16));

            // Step 4: Derive symmetric key K_sym from S using PBKDF2
            onProgress?.(30, "KEM", "Deriving keys...");
            const K_sym = await this.deriveKeyFromSecret(secret_S, kdfSalt);

            // Step 5: Generate random file key K_file
            const K_file = await this.generateAESKey();

            // Step 6: Wrap K_file with K_sym
            const { wrappedKey, iv: wrapIV } = await this.wrapKey(K_file, K_sym);

            // Step 7: Encrypt secret S with AFGH Level 2
            onProgress?.(35, "KEM", "AFGH Level 2 encryption...");
            const publicKey = afghService.extractPublicKey(ownerKeyPair);
            const kemCiphertext = await afghService.encryptLevel2(secret_S, publicKey);

            // Step 8: Encrypt each chunk with AES-GCM using K_file
            onProgress?.(40, "DEM", "Encrypting chunks...");
            const encryptedChunks = await this.encryptChunks(
                chunkedFile.chunks,
                K_file,
                (p) => onProgress?.(40 + p * 0.55, "DEM", `Encrypting chunks...`)
            );

            // Step 9: Build file envelope
            onProgress?.(95, "Finalizing", "Building envelope...");
            const envelope: AFGHFileEnvelope = {
                fileId: chunkedFile.fileId,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || "application/octet-stream",
                kemCiphertext,
                wrappedFileKey: this.arrayBufferToBase64(wrappedKey),
                wrapKeyIV: this.uint8ArrayToBase64(wrapIV),
                kdfSalt,
                chunks: encryptedChunks,
                metadata: {
                    ownerId: ownerKeyPair.userId,
                    uploadedAt: new Date().toISOString(),
                    chunkSize: this.CHUNK_SIZE,
                    totalChunks: encryptedChunks.length,
                    kemAlgorithm: "AFGH-BLS12-381",
                    demAlgorithm: "AES-256-GCM",
                },
            };

            onProgress?.(100, "Complete", "File encrypted successfully");
            console.log(`[AFGHFile] Encrypted: ${file.name}, ${encryptedChunks.length} chunks`);
            return envelope;

        } catch (error) {
            throw new AFGHError(
                `File encryption failed: ${error}`,
                AFGHErrorCode.CURVE_OPERATION_FAILED,
                error
            );
        }
    }

    /**
     * Decrypt a file envelope for the owner
     */
    async decryptFileOwner(
        envelope: AFGHFileEnvelope,
        ownerKeyPair: AFGHKeyPair,
        onProgress?: FileProgressCallback
    ): Promise<{ data: ArrayBuffer; fileName: string; mimeType: string }> {
        try {
            onProgress?.(0, "Initializing", "Starting decryption...");

            // Step 1: Decrypt secret S using AFGH Level 2
            onProgress?.(10, "KEM", "AFGH Level 2 decryption...");
            const secret_S = await afghService.decryptLevel2(
                envelope.kemCiphertext,
                ownerKeyPair.secretKey2,
                ownerKeyPair.publicKey1
            );

            // Step 2: Derive K_sym from S
            onProgress?.(20, "KEM", "Deriving keys...");
            const K_sym = await this.deriveKeyFromSecret(
                secret_S,
                envelope.kdfSalt || new Uint8Array(16)
            );

            // Step 3: Unwrap K_file
            onProgress?.(30, "KEM", "Unwrapping file key...");
            const K_file = await this.unwrapKey(
                this.base64ToArrayBuffer(envelope.wrappedFileKey),
                K_sym,
                this.base64ToUint8Array(envelope.wrapKeyIV)
            );

            // Step 4: Decrypt all chunks
            onProgress?.(40, "DEM", "Decrypting chunks...");
            const decryptedChunks = await this.decryptChunks(
                envelope.chunks,
                K_file,
                (p) => onProgress?.(40 + p * 0.55, "DEM", `Decrypting chunks...`)
            );

            // Step 5: Reassemble file
            onProgress?.(95, "Finalizing", "Reassembling file...");
            const data = this.concatenateArrayBuffers(decryptedChunks);

            onProgress?.(100, "Complete", "File decrypted successfully");
            return {
                data,
                fileName: envelope.fileName,
                mimeType: envelope.mimeType,
            };

        } catch (error) {
            throw new AFGHError(
                `File decryption failed: ${error}`,
                AFGHErrorCode.DECRYPTION_FAILED,
                error
            );
        }
    }

    /**
     * Create a share by re-encrypting for recipient (executed by HSM/proxy)
     */
    async shareFile(
        envelope: AFGHFileEnvelope,
        reEncryptionKey: ReEncryptionKey,
        ownerPublicKey: AFGHPublicKey,
        recipientId: string,
        permissions: "read" | "read-write" = "read"
    ): Promise<SharedAFGHFileEnvelope> {
        try {
            // Re-encrypt the KEM ciphertext
            const reEncryptedKEM = await afghService.reEncrypt(
                envelope.kemCiphertext,
                reEncryptionKey,
                ownerPublicKey
            );

            const sharedEnvelope: SharedAFGHFileEnvelope = {
                ...envelope,
                kemCiphertext: reEncryptedKEM,
                recipientId,
                shareId: crypto.randomUUID(),
                permissions,
            };

            console.log(`[AFGHFile] Shared: ${envelope.fileName} → ${recipientId}`);
            return sharedEnvelope;

        } catch (error) {
            throw new AFGHError(
                `File sharing failed: ${error}`,
                AFGHErrorCode.RE_ENCRYPTION_FAILED,
                error
            );
        }
    }

    /**
     * Decrypt a shared file envelope for the recipient
     */
    async decryptSharedFile(
        sharedEnvelope: SharedAFGHFileEnvelope,
        recipientKeyPair: AFGHKeyPair,
        onProgress?: FileProgressCallback
    ): Promise<{ data: ArrayBuffer; fileName: string; mimeType: string }> {
        try {
            onProgress?.(0, "Initializing", "Starting decryption...");

            // Step 1: Decrypt secret S using AFGH Level 1
            onProgress?.(10, "KEM", "AFGH Level 1 decryption...");
            const secret_S = await afghService.decryptLevel1(
                sharedEnvelope.kemCiphertext,
                recipientKeyPair.secretKey2
            );

            // Step 2: Derive K_sym from S
            onProgress?.(20, "KEM", "Deriving keys...");
            const K_sym = await this.deriveKeyFromSecret(
                secret_S,
                sharedEnvelope.kdfSalt || new Uint8Array(16)
            );

            // Step 3: Unwrap K_file
            onProgress?.(30, "KEM", "Unwrapping file key...");
            const K_file = await this.unwrapKey(
                this.base64ToArrayBuffer(sharedEnvelope.wrappedFileKey),
                K_sym,
                this.base64ToUint8Array(sharedEnvelope.wrapKeyIV)
            );

            // Step 4: Decrypt all chunks
            onProgress?.(40, "DEM", "Decrypting chunks...");
            const decryptedChunks = await this.decryptChunks(
                sharedEnvelope.chunks,
                K_file,
                (p) => onProgress?.(40 + p * 0.55, "DEM", `Decrypting chunks...`)
            );

            // Step 5: Reassemble file
            onProgress?.(95, "Finalizing", "Reassembling file...");
            const data = this.concatenateArrayBuffers(decryptedChunks);

            onProgress?.(100, "Complete", "Shared file decrypted successfully");
            return {
                data,
                fileName: sharedEnvelope.fileName,
                mimeType: sharedEnvelope.mimeType,
            };

        } catch (error) {
            throw new AFGHError(
                `Shared file decryption failed: ${error}`,
                AFGHErrorCode.DECRYPTION_FAILED,
                error
            );
        }
    }

    // Private helper methods

    private async encryptChunks(
        chunks: ChunkMetadata[],
        fileKey: CryptoKey,
        onProgress?: (progress: number) => void
    ): Promise<EncryptedChunkAFGH[]> {
        const encryptedChunks: EncryptedChunkAFGH[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const iv = crypto.getRandomValues(new Uint8Array(this.AES_IV_LENGTH));

            const encryptedData = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                fileKey,
                chunk.data
            );

            encryptedChunks.push({
                chunkIndex: chunk.index,
                encryptedData: this.arrayBufferToBase64(encryptedData),
                iv: this.uint8ArrayToBase64(iv),
                hash: chunk.hash,
                originalSize: chunk.size,
            });

            onProgress?.((i + 1) / chunks.length * 100);
        }

        return encryptedChunks;
    }

    private async decryptChunks(
        chunks: EncryptedChunkAFGH[],
        fileKey: CryptoKey,
        onProgress?: (progress: number) => void
    ): Promise<ArrayBuffer[]> {
        const sortedChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
        const decryptedChunks: ArrayBuffer[] = [];

        for (let i = 0; i < sortedChunks.length; i++) {
            const chunk = sortedChunks[i];
            const encryptedData = this.base64ToArrayBuffer(chunk.encryptedData);
            const iv = this.base64ToUint8Array(chunk.iv);

            const decryptedData = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                fileKey,
                encryptedData
            );

            decryptedChunks.push(decryptedData);
            onProgress?.((i + 1) / sortedChunks.length * 100);
        }

        return decryptedChunks;
    }

    private async generateAESKey(): Promise<CryptoKey> {
        return crypto.subtle.generateKey(
            { name: "AES-GCM", length: this.AES_KEY_LENGTH },
            true,
            ["encrypt", "decrypt"]
        );
    }

    private async deriveKeyFromSecret(
        secret: G2Element,
        salt: Uint8Array
    ): Promise<CryptoKey> {
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            secret,
            "PBKDF2",
            false,
            ["deriveBits", "deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: this.PBKDF2_ITERATIONS,
                hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-KW", length: this.AES_KEY_LENGTH },
            false,
            ["wrapKey", "unwrapKey"]
        );
    }

    private async wrapKey(
        keyToWrap: CryptoKey,
        wrappingKey: CryptoKey
    ): Promise<{ wrappedKey: ArrayBuffer; iv: Uint8Array }> {
        const wrappedKey = await crypto.subtle.wrapKey("raw", keyToWrap, wrappingKey, "AES-KW");
        return { wrappedKey, iv: new Uint8Array(0) };
    }

    private async unwrapKey(
        wrappedKey: ArrayBuffer,
        unwrappingKey: CryptoKey,
        _iv: Uint8Array
    ): Promise<CryptoKey> {
        return crypto.subtle.unwrapKey(
            "raw",
            wrappedKey,
            unwrappingKey,
            "AES-KW",
            { name: "AES-GCM", length: this.AES_KEY_LENGTH },
            true,
            ["encrypt", "decrypt"]
        );
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    private uint8ArrayToBase64(array: Uint8Array): string {
        return btoa(String.fromCharCode(...array));
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    private base64ToUint8Array(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    private concatenateArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
        const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const buffer of buffers) {
            result.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
        }
        return result.buffer;
    }

    serializeEnvelope(envelope: AFGHFileEnvelope): string {
        return JSON.stringify({
            ...envelope,
            kemCiphertext: {
                U: this.uint8ArrayToBase64(envelope.kemCiphertext.U),
                V: this.uint8ArrayToBase64(envelope.kemCiphertext.V),
                level: envelope.kemCiphertext.level,
            },
            kdfSalt: envelope.kdfSalt ? this.uint8ArrayToBase64(envelope.kdfSalt) : undefined,
        });
    }

    deserializeEnvelope(data: string): AFGHFileEnvelope {
        const parsed = JSON.parse(data);
        return {
            ...parsed,
            kemCiphertext: {
                U: this.base64ToUint8Array(parsed.kemCiphertext.U),
                V: this.base64ToUint8Array(parsed.kemCiphertext.V),
                level: parsed.kemCiphertext.level,
            },
            kdfSalt: parsed.kdfSalt ? this.base64ToUint8Array(parsed.kdfSalt) : undefined,
        };
    }
}

export const afghFileService = new AFGHFileService();
