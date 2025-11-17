/**
 * Mock Crypto Service
 *
 * This service simulates encryption/decryption operations for UI testing purposes.
 * In production, this will be replaced by pyUmbrel-based encryption on the gateway/backend.
 *
 * Features simulated:
 * - File encryption (currently just returns the file as-is)
 * - File decryption (currently just returns the file as-is)
 * - Progress callbacks for UI feedback
 */

export interface MockKeyPair {
  publicKey: string;
  privateKey: string;
  email: string;
}

export interface MockFileEnvelope {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  encryptedData: string; // Base64 encoded file data
  timestamp: string;
}

export interface ProgressCallback {
  (progress: number, message: string): void;
}

class MockCryptoService {
  /**
   * Generate a mock key pair for a user
   */
  async generateKeyPair(email: string): Promise<MockKeyPair> {
    console.log('[MockCrypto] Generating mock key pair for:', email);

    // Simulate key generation delay
    await this.delay(500);

    return {
      publicKey: `mock_public_key_${email}_${Date.now()}`,
      privateKey: `mock_private_key_${email}_${Date.now()}`,
      email
    };
  }

  /**
   * Encrypt a file (mock - currently just converts to base64)
   */
  async encryptFile(
    file: File,
    keyPair: MockKeyPair,
    onProgress?: ProgressCallback
  ): Promise<MockFileEnvelope> {
    console.log('[MockCrypto] Starting mock encryption for:', file.name);

    onProgress?.(10, 'Initializing encryption...');
    await this.delay(300);

    onProgress?.(30, 'Reading file...');
    const fileData = await this.fileToArrayBuffer(file);
    await this.delay(300);

    onProgress?.(60, 'Encrypting data...');
    const base64Data = this.arrayBufferToBase64(fileData);
    await this.delay(500);

    onProgress?.(90, 'Finalizing...');
    await this.delay(200);

    const envelope: MockFileEnvelope = {
      fileId: this.generateFileId(),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      encryptedData: base64Data,
      timestamp: new Date().toISOString()
    };

    onProgress?.(100, 'Encryption complete!');
    console.log('[MockCrypto] Encryption complete. File ID:', envelope.fileId);

    return envelope;
  }

  /**
   * Decrypt a file (mock - currently just converts from base64)
   */
  async decryptFile(
    envelope: MockFileEnvelope,
    keyPair: MockKeyPair,
    onProgress?: ProgressCallback
  ): Promise<{ data: ArrayBuffer; fileName: string; mimeType: string }> {
    console.log('[MockCrypto] Starting mock decryption for:', envelope.fileName);

    onProgress?.(10, 'Initializing decryption...');
    await this.delay(300);

    onProgress?.(40, 'Decrypting data...');
    await this.delay(500);

    onProgress?.(70, 'Verifying integrity...');
    const data = this.base64ToArrayBuffer(envelope.encryptedData);
    await this.delay(300);

    onProgress?.(100, 'Decryption complete!');
    console.log('[MockCrypto] Decryption complete');

    return {
      data,
      fileName: envelope.fileName,
      mimeType: envelope.mimeType
    };
  }

  /**
   * Serialize envelope to base64 string (for storage/transmission)
   */
  serializeEnvelope(envelope: MockFileEnvelope): string {
    return btoa(JSON.stringify(envelope));
  }

  /**
   * Deserialize envelope from base64 string
   */
  deserializeEnvelope(serialized: string): MockFileEnvelope {
    return JSON.parse(atob(serialized));
  }

  // Helper methods

  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const mockCryptoService = new MockCryptoService();
