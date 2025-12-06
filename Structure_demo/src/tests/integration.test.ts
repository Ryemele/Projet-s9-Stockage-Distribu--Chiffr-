import { cryptoService } from '../services/cryptoService.js';
import { webcrypto } from 'node:crypto';

// Polyfill window and crypto for Node.js environment
if (typeof window === 'undefined') {
    // @ts-ignore
    globalThis.window = globalThis;
}

if (!globalThis.crypto) {
    // @ts-ignore
    globalThis.crypto = webcrypto;
}

// Polyfill File
class MockFile {
    name: string;
    type: string;
    size: number;
    private content: Uint8Array;

    constructor(content: Uint8Array[], name: string, options?: { type: string }) {
        this.content = content[0]; // Simplified for test
        this.name = name;
        this.type = options?.type || '';
        this.size = this.content.length;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.content.buffer;
    }
}

// @ts-ignore
globalThis.File = MockFile;

async function runIntegrationTest() {
    console.log("Starting Integration Test...");

    try {
        // 1. Setup Users
        console.log("\n1. Generating Keys...");
        const aliceKeys = await cryptoService.generateKeyPair("alice@example.com");
        const bobKeys = await cryptoService.generateKeyPair("bob@example.com");
        console.log("Keys generated successfully.");

        // 2. Create a dummy file
        const fileContent = new TextEncoder().encode("Hello, this is a secret message!");
        const file = new File([fileContent], "secret.txt", { type: "text/plain" });

        // 3. Alice Encrypts File
        console.log("\n2. Alice Encrypting File...");
        const envelope = await cryptoService.encryptFile(file, aliceKeys);
        console.log("File encrypted. Envelope created.");
        console.log("Metadata Type:", envelope.encryptionMetadata.type);

        // 4. Verify Alice can decrypt her own file (Level 2)
        console.log("\n3. Verifying Alice's Decryption...");
        const aliceDecrypted = await cryptoService.decryptFile(envelope, aliceKeys);
        const aliceText = new TextDecoder().decode(aliceDecrypted.data);
        if (aliceText === "Hello, this is a secret message!") {
            console.log("SUCCESS: Alice decrypted her own file.");
        } else {
            console.error("FAILURE: Alice failed to decrypt correctly.");
            process.exit(1);
        }

        // 5. Generate Re-Encryption Key (Alice -> Bob)
        console.log("\n4. Generating Re-Encryption Key (Alice -> Bob)...");
        const rk = cryptoService.generateReEncryptionKey(aliceKeys.privateKey, bobKeys.publicKey);
        console.log("Re-encryption key generated.");

        // 6. Proxy Re-Encrypts
        console.log("\n5. Proxy Re-Encrypting...");
        const reEncryptedEnvelope = cryptoService.reEncrypt(envelope, rk, aliceKeys.publicKey);
        console.log("Re-encryption complete.");
        console.log("Metadata Type:", reEncryptedEnvelope.encryptionMetadata.type);

        // 7. Bob Decrypts
        console.log("\n6. Bob Decrypting...");
        const bobDecrypted = await cryptoService.decryptFile(reEncryptedEnvelope, bobKeys);
        const bobText = new TextDecoder().decode(bobDecrypted.data);

        if (bobText === "Hello, this is a secret message!") {
            console.log("SUCCESS: Bob decrypted the re-encrypted file.");
        } else {
            console.error("FAILURE: Bob failed to decrypt correctly.");
            console.error("Expected: Hello, this is a secret message!");
            console.error("Got:", bobText);
            process.exit(1);
        }

        console.log("\nALL TESTS PASSED!");

    } catch (error) {
        console.error("\nTEST FAILED with error:", error);
        process.exit(1);
    }
}

runIntegrationTest();
