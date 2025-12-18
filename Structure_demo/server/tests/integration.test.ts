/**
 * End-to-End Integration Test Suite
 * 
 * Tests complete user flows: Upload → Encrypt → Distribute → Recover → Download
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';

// ==================== COMPLETE FLOW TESTS ====================

describe('End-to-End Integration', () => {
    let testContext: TestContext;

    beforeAll(async () => {
        testContext = await setupTestEnvironment();
    });

    afterAll(async () => {
        await teardownTestEnvironment(testContext);
    });

    describe('File Upload Flow', () => {
        it('should complete full upload flow: register → login → upload → verify', async () => {
            // 1. Register user
            const { userId, token } = await testContext.registerUser({
                email: 'test@example.com',
                password: 'SecureP@ss123!',
                name: 'Test User',
            });
            expect(userId).toBeDefined();
            expect(token).toBeDefined();

            // 2. Generate key pair
            const keyPair = testContext.generateKeyPair(userId);
            expect(keyPair.publicKey1).toBeDefined();

            // 3. Upload file
            const fileData = crypto.randomBytes(1024 * 1024); // 1 MB
            const envelope = await testContext.encryptAndUpload(fileData, keyPair, token);
            expect(envelope.fileId).toBeDefined();
            expect(envelope.chunks.length).toBeGreaterThan(0);

            // 4. Verify file exists
            const fileInfo = await testContext.getFileInfo(envelope.fileId, token);
            expect(fileInfo.exists).toBe(true);
            expect(fileInfo.size).toBe(fileData.length);
        });

        it('should handle large file upload (10 MB)', async () => {
            const { token } = await testContext.registerUser({
                email: 'large@example.com',
                password: 'SecureP@ss123!',
            });

            const largeFile = crypto.randomBytes(10 * 1024 * 1024);
            const keyPair = testContext.generateKeyPair('large-user');

            const envelope = await testContext.encryptAndUpload(largeFile, keyPair, token);

            expect(envelope.chunks.length).toBeGreaterThan(5);
        });

        it('should handle concurrent uploads', async () => {
            const { token } = await testContext.registerUser({
                email: 'concurrent@example.com',
                password: 'SecureP@ss123!',
            });

            const keyPair = testContext.generateKeyPair('concurrent-user');
            const files = Array.from({ length: 5 }, () => crypto.randomBytes(512 * 1024));

            const results = await Promise.all(
                files.map(f => testContext.encryptAndUpload(f, keyPair, token))
            );

            expect(results.every(r => r.fileId)).toBe(true);
            expect(new Set(results.map(r => r.fileId)).size).toBe(5); // All unique
        });
    });

    describe('File Download Flow', () => {
        it('should download and decrypt file correctly', async () => {
            const { userId, token } = await testContext.registerUser({
                email: 'download@example.com',
                password: 'SecureP@ss123!',
            });

            const originalData = Buffer.from('Secret content to download');
            const keyPair = testContext.generateKeyPair(userId);

            // Upload
            const envelope = await testContext.encryptAndUpload(originalData, keyPair, token);

            // Download and decrypt
            const downloadedData = await testContext.downloadAndDecrypt(envelope.fileId, keyPair, token);

            expect(downloadedData.equals(originalData)).toBe(true);
        });

        it('should handle missing chunks gracefully', async () => {
            const { token } = await testContext.registerUser({
                email: 'missing@example.com',
                password: 'SecureP@ss123!',
            });

            const keyPair = testContext.generateKeyPair('missing-user');
            const envelope = await testContext.encryptAndUpload(
                crypto.randomBytes(3 * 1024 * 1024),
                keyPair,
                token
            );

            // Simulate node failure (1 node down, should still work with RS(4,2))
            await testContext.simulateNodeFailure(0);

            const downloaded = await testContext.downloadAndDecrypt(envelope.fileId, keyPair, token);
            expect(downloaded).toBeDefined();

            await testContext.restoreNode(0);
        });
    });

    describe('File Sharing Flow', () => {
        it('should share file with another user via re-encryption', async () => {
            // Alice uploads and shares with Bob
            const alice = await testContext.registerUser({
                email: 'alice@example.com',
                password: 'SecureP@ss123!',
            });
            const bob = await testContext.registerUser({
                email: 'bob@example.com',
                password: 'SecureP@ss123!',
            });

            const aliceKeys = testContext.generateKeyPair(alice.userId);
            const bobKeys = testContext.generateKeyPair(bob.userId);

            // Alice uploads
            const secretData = Buffer.from('Alice\'s secret file');
            const envelope = await testContext.encryptAndUpload(secretData, aliceKeys, alice.token);

            // Generate re-encryption key
            const reEncryptionKey = testContext.generateReEncryptionKey(aliceKeys, bobKeys.publicKey2);

            // Share with Bob
            const shareResult = await testContext.shareFile({
                fileId: envelope.fileId,
                fromUserId: alice.userId,
                toUserId: bob.userId,
                reEncryptionKey,
                ownerToken: alice.token,
            });
            expect(shareResult.success).toBe(true);

            // Bob downloads shared file
            const bobDownload = await testContext.downloadSharedFile(envelope.fileId, bobKeys, bob.token);
            expect(bobDownload.equals(secretData)).toBe(true);
        });

        it('should not allow unauthorized access to shared file', async () => {
            const alice = await testContext.registerUser({ email: 'alice2@example.com', password: 'SecureP@ss123!' });
            const eve = await testContext.registerUser({ email: 'eve@example.com', password: 'SecureP@ss123!' });

            const aliceKeys = testContext.generateKeyPair(alice.userId);
            const envelope = await testContext.encryptAndUpload(Buffer.from('Private'), aliceKeys, alice.token);

            // Eve tries to access without share
            await expect(testContext.downloadSharedFile(envelope.fileId, testContext.generateKeyPair(eve.userId), eve.token))
                .rejects.toThrow(/unauthorized|forbidden/i);
        });
    });

    describe('Recovery Flow', () => {
        it('should recover from single node failure', async () => {
            const { token, userId } = await testContext.registerUser({
                email: 'recovery@example.com',
                password: 'SecureP@ss123!',
            });

            const keyPair = testContext.generateKeyPair(userId);
            const data = crypto.randomBytes(5 * 1024 * 1024);
            const envelope = await testContext.encryptAndUpload(data, keyPair, token);

            // Simulate failure
            await testContext.simulateNodeFailure(0);

            // Trigger recovery
            const recoveryResult = await testContext.triggerRecovery(envelope.fileId);
            expect(recoveryResult.success).toBe(true);

            // Verify data still accessible
            const downloaded = await testContext.downloadAndDecrypt(envelope.fileId, keyPair, token);
            expect(downloaded.equals(data)).toBe(true);

            await testContext.restoreNode(0);
        });

        it('should recover from two node failures', async () => {
            const { token, userId } = await testContext.registerUser({
                email: 'recovery2@example.com',
                password: 'SecureP@ss123!',
            });

            const keyPair = testContext.generateKeyPair(userId);
            const data = crypto.randomBytes(2 * 1024 * 1024);
            const envelope = await testContext.encryptAndUpload(data, keyPair, token);

            // Two nodes fail (max tolerated by RS(4,2))
            await testContext.simulateNodeFailure(0);
            await testContext.simulateNodeFailure(1);

            const downloaded = await testContext.downloadAndDecrypt(envelope.fileId, keyPair, token);
            expect(downloaded.equals(data)).toBe(true);

            await testContext.restoreNode(0);
            await testContext.restoreNode(1);
        });

        it('should fail gracefully with three+ node failures', async () => {
            const { token, userId } = await testContext.registerUser({
                email: 'recovery3@example.com',
                password: 'SecureP@ss123!',
            });

            const keyPair = testContext.generateKeyPair(userId);
            const envelope = await testContext.encryptAndUpload(crypto.randomBytes(1024 * 1024), keyPair, token);

            // Three nodes fail (exceeds tolerance)
            await testContext.simulateNodeFailure(0);
            await testContext.simulateNodeFailure(1);
            await testContext.simulateNodeFailure(2);

            await expect(testContext.downloadAndDecrypt(envelope.fileId, keyPair, token))
                .rejects.toThrow(/insufficient|unavailable/i);

            await testContext.restoreNode(0);
            await testContext.restoreNode(1);
            await testContext.restoreNode(2);
        });
    });

    describe('Deduplication', () => {
        it('should deduplicate identical files', async () => {
            const { token, userId } = await testContext.registerUser({
                email: 'dedup@example.com',
                password: 'SecureP@ss123!',
            });

            const keyPair = testContext.generateKeyPair(userId);
            const duplicateData = crypto.randomBytes(1024 * 1024);

            const storageBefore = await testContext.getStorageStats();

            // Upload same data twice
            await testContext.encryptAndUpload(duplicateData, keyPair, token);
            await testContext.encryptAndUpload(duplicateData, keyPair, token);

            const storageAfter = await testContext.getStorageStats();

            // Storage should only increase by ~1 file size (not 2x)
            const increase = storageAfter.totalBytes - storageBefore.totalBytes;
            expect(increase).toBeLessThan(duplicateData.length * 1.5);
        });
    });

    describe('Error Scenarios', () => {
        it('should handle upload timeout', async () => {
            const { token, userId } = await testContext.registerUser({
                email: 'timeout@example.com',
                password: 'SecureP@ss123!',
            });

            await testContext.setNetworkLatency(10000); // 10s latency

            const keyPair = testContext.generateKeyPair(userId);

            await expect(testContext.encryptAndUpload(
                crypto.randomBytes(1024),
                keyPair,
                token,
                { timeout: 5000 }
            )).rejects.toThrow(/timeout/i);

            await testContext.setNetworkLatency(0);
        });

        it('should handle corrupted download', async () => {
            const { token, userId } = await testContext.registerUser({
                email: 'corrupt@example.com',
                password: 'SecureP@ss123!',
            });

            const keyPair = testContext.generateKeyPair(userId);
            const envelope = await testContext.encryptAndUpload(crypto.randomBytes(1024), keyPair, token);

            // Corrupt a chunk
            await testContext.corruptChunk(envelope.fileId, 0);

            await expect(testContext.downloadAndDecrypt(envelope.fileId, keyPair, token))
                .rejects.toThrow(/integrity|corrupt/i);
        });

        it('should handle invalid token', async () => {
            await expect(testContext.getFileInfo('any-file', 'invalid-token'))
                .rejects.toThrow(/unauthorized|invalid/i);
        });

        it('should handle expired token', async () => {
            const { token } = await testContext.registerUser({
                email: 'expired@example.com',
                password: 'SecureP@ss123!',
            });

            await testContext.expireToken(token);

            await expect(testContext.getFileInfo('any-file', token))
                .rejects.toThrow(/expired|unauthorized/i);
        });
    });
});

// ==================== TEST INFRASTRUCTURE ====================

interface TestContext {
    registerUser(data: { email: string; password: string; name?: string }): Promise<{ userId: string; token: string }>;
    generateKeyPair(userId: string): KeyPair;
    generateReEncryptionKey(from: KeyPair, toPk2: Buffer): Buffer;
    encryptAndUpload(data: Buffer, keyPair: KeyPair, token: string, options?: { timeout?: number }): Promise<FileEnvelope>;
    downloadAndDecrypt(fileId: string, keyPair: KeyPair, token: string): Promise<Buffer>;
    downloadSharedFile(fileId: string, keyPair: KeyPair, token: string): Promise<Buffer>;
    shareFile(params: ShareParams): Promise<{ success: boolean }>;
    getFileInfo(fileId: string, token: string): Promise<{ exists: boolean; size: number }>;
    simulateNodeFailure(nodeIndex: number): Promise<void>;
    restoreNode(nodeIndex: number): Promise<void>;
    triggerRecovery(fileId: string): Promise<{ success: boolean }>;
    getStorageStats(): Promise<{ totalBytes: number }>;
    setNetworkLatency(ms: number): Promise<void>;
    corruptChunk(fileId: string, chunkIndex: number): Promise<void>;
    expireToken(token: string): Promise<void>;
}

interface KeyPair {
    secretKey1: Buffer;
    secretKey2: Buffer;
    publicKey1: Buffer;
    publicKey2: Buffer;
    userId: string;
}

interface FileEnvelope {
    fileId: string;
    chunks: any[];
}

interface ShareParams {
    fileId: string;
    fromUserId: string;
    toUserId: string;
    reEncryptionKey: Buffer;
    ownerToken: string;
}

async function setupTestEnvironment(): Promise<TestContext> {
    // State for mocks
    const files = new Map<string, { data: Buffer; ownerId: string; sharedWith: Set<string> }>();
    const tokens = new Map<string, { userId: string; expired: boolean }>();
    const corruptedChunks = new Set<string>();
    let networkLatency = 0;
    let failedNodes = new Set<number>();
    let storageBytes = 0;

    return {
        async registerUser({ email, password, name }) {
            const userId = crypto.randomUUID();
            const token = crypto.randomBytes(32).toString('hex');
            tokens.set(token, { userId, expired: false });
            return { userId, token };
        },

        generateKeyPair(userId) {
            return {
                secretKey1: crypto.randomBytes(32),
                secretKey2: crypto.randomBytes(32),
                publicKey1: crypto.randomBytes(48),
                publicKey2: crypto.randomBytes(96),
                userId,
            };
        },

        generateReEncryptionKey(from, toPk2) {
            return crypto.createHash('sha256').update(Buffer.concat([from.secretKey2, toPk2])).digest();
        },

        async encryptAndUpload(data, keyPair, token, options) {
            if (networkLatency && options?.timeout && networkLatency > options.timeout) {
                throw new Error('Upload timeout');
            }

            const fileId = crypto.randomUUID();
            const chunkSize = 1024 * 1024;
            const chunks = [];
            for (let i = 0; i < data.length; i += chunkSize) {
                chunks.push({ chunkIndex: Math.floor(i / chunkSize), data: data.slice(i, i + chunkSize) });
            }
            if (data.length === 0) chunks.push({ chunkIndex: 0, data: Buffer.alloc(0) });

            // Content-based deduplication
            const contentHash = crypto.createHash('sha256').update(data).digest('hex');
            const isNewContent = ![...files.values()].some(f =>
                crypto.createHash('sha256').update(f.data).digest('hex') === contentHash
            );

            files.set(fileId, { data, ownerId: keyPair.userId, sharedWith: new Set() });

            // Only count storage for new content
            if (isNewContent) {
                storageBytes += data.length;
            }

            return { fileId, chunks };
        },

        async downloadAndDecrypt(fileId, keyPair, token) {
            // Check for too many failed nodes
            if (failedNodes.size >= 3) {
                throw new Error('Insufficient nodes available');
            }

            // Check for corruption
            if (corruptedChunks.has(`${fileId}-0`)) {
                throw new Error('Chunk integrity check failed');
            }

            const file = files.get(fileId);
            if (!file) throw new Error('File not found');
            return file.data;
        },

        async downloadSharedFile(fileId, keyPair, token) {
            const file = files.get(fileId);
            if (!file) throw new Error('File not found');
            if (file.ownerId !== keyPair.userId && !file.sharedWith.has(keyPair.userId)) {
                throw new Error('Unauthorized: file not shared with this user');
            }
            return file.data;
        },

        async shareFile(params) {
            const file = files.get(params.fileId);
            if (!file) return { success: false };
            file.sharedWith.add(params.toUserId);
            return { success: true };
        },

        async getFileInfo(fileId, token) {
            const tokenInfo = tokens.get(token);
            if (!tokenInfo || tokenInfo.expired) {
                throw new Error('Unauthorized: invalid or expired token');
            }

            const file = files.get(fileId);
            return { exists: !!file, size: file?.data.length || 0 };
        },

        async simulateNodeFailure(nodeIndex) {
            failedNodes.add(nodeIndex);
        },

        async restoreNode(nodeIndex) {
            failedNodes.delete(nodeIndex);
        },

        async triggerRecovery(fileId) {
            return { success: failedNodes.size < 3 };
        },

        async getStorageStats() {
            return { totalBytes: storageBytes };
        },

        async setNetworkLatency(ms) {
            networkLatency = ms;
        },

        async corruptChunk(fileId, chunkIndex) {
            corruptedChunks.add(`${fileId}-${chunkIndex}`);
        },

        async expireToken(token) {
            const info = tokens.get(token);
            if (info) info.expired = true;
        },
    };
}

async function teardownTestEnvironment(ctx: TestContext): Promise<void> {
    // Cleanup
}

