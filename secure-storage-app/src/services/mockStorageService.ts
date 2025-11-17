/**
 * Mock Storage Service
 *
 * This service simulates secure key storage operations for UI testing purposes.
 * In production, key management will be handled by pyUmbrel on the gateway/backend.
 *
 * Currently stores data in localStorage for simplicity.
 */

import type { MockKeyPair } from './mockCryptoService';

interface StoredKeyPair {
  email: string;
  keyPair: MockKeyPair;
  encryptedData: string; // Simulated encrypted storage
  iv: string; // Simulated IV
  timestamp: string;
}

class MockStorageService {
  private readonly STORAGE_KEY = 'mock_keypairs';
  private readonly PASSWORD_KEYS_KEY = 'mock_password_keys';

  /**
   * Initialize storage (simulated)
   */
  async init(): Promise<void> {
    console.log('[MockStorage] Initializing mock storage...');
    // Nothing to do for localStorage
  }

  /**
   * Derive a key from password (simulated)
   */
  async deriveKeyFromPassword(
    password: string,
    salt?: Uint8Array
  ): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    console.log('[MockStorage] Deriving mock password key...');

    // Generate or use provided salt
    const actualSalt = salt || crypto.getRandomValues(new Uint8Array(16));

    // Simulate key derivation delay
    await this.delay(300);

    // Create a mock CryptoKey (for compatibility)
    const keyData = new TextEncoder().encode(password + actualSalt.join(','));
    const key = await crypto.subtle.importKey(
      'raw',
      keyData.slice(0, 32), // Use first 32 bytes
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return { key, salt: actualSalt };
  }

  /**
   * Encrypt and store a key pair
   */
  async storeKeyPair(
    email: string,
    keyPair: MockKeyPair,
    passwordKey: CryptoKey
  ): Promise<void> {
    console.log('[MockStorage] Storing mock key pair for:', email);

    // Simulate encryption
    const encryptedData = btoa(JSON.stringify(keyPair));
    const iv = this.generateIV();

    const storedData: StoredKeyPair = {
      email,
      keyPair,
      encryptedData,
      iv,
      timestamp: new Date().toISOString()
    };

    const allKeyPairs = this.getAllStoredKeyPairs();
    allKeyPairs[email] = storedData;

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allKeyPairs));
    console.log('[MockStorage] Key pair stored successfully');
  }

  /**
   * Retrieve and decrypt a key pair
   */
  async getKeyPair(email: string, passwordKey: CryptoKey): Promise<MockKeyPair | null> {
    console.log('[MockStorage] Retrieving mock key pair for:', email);

    const allKeyPairs = this.getAllStoredKeyPairs();
    const stored = allKeyPairs[email];

    if (!stored) {
      console.log('[MockStorage] No key pair found for:', email);
      return null;
    }

    // Simulate decryption delay
    await this.delay(300);

    console.log('[MockStorage] Key pair retrieved successfully');
    return stored.keyPair;
  }

  /**
   * Check if a key pair exists for an email
   */
  hasKeyPair(email: string): boolean {
    const allKeyPairs = this.getAllStoredKeyPairs();
    return email in allKeyPairs;
  }

  /**
   * Delete a key pair
   */
  deleteKeyPair(email: string): void {
    console.log('[MockStorage] Deleting key pair for:', email);
    const allKeyPairs = this.getAllStoredKeyPairs();
    delete allKeyPairs[email];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allKeyPairs));
  }

  /**
   * Clear all stored key pairs (for testing)
   */
  clearAll(): void {
    console.log('[MockStorage] Clearing all stored key pairs');
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.PASSWORD_KEYS_KEY);
  }

  // Helper methods

  private getAllStoredKeyPairs(): Record<string, StoredKeyPair> {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  }

  private generateIV(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public utility methods for compatibility

  arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  base64ToArray(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const mockStorageService = new MockStorageService();
