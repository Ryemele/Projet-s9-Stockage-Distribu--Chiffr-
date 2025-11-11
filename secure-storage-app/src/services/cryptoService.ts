/* eslint-disable @typescript-eslint/no-unused-vars */
import type { EncryptionResult, KeyPair } from "../types";

/**
 * CryptoService - Handles all client-side encryption/decryption operations
 * Uses Web Crypto API for secure, browser-native cryptography
 */
class CryptoService {
  private readonly ALGORITHM = "AES-GCM";
  private readonly KEY_LENGTH = 256;
  private readonly IV_LENGTH = 12; // 96 bits for AES-GCM
  private readonly SALT_LENGTH = 16; // 128 bits
  private readonly PBKDF2_ITERATIONS = 100000;

  /**
   * Derives a cryptographic key from a password using PBKDF2
   */
  async deriveKeyFromPassword(
    password: string,
    salt?: Uint8Array
  ): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    // Generate or use provided salt
    const keySalt =
      salt || crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));

    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    // Derive AES key from password
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: keySalt as BufferSource,
        iterations: this.PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      passwordKey,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true, // extractable
      ["encrypt", "decrypt"]
    );

    return { key, salt: keySalt };
  }

  /**
   * Encrypts data using AES-GCM
   */
  async encryptData(
    data: ArrayBuffer,
    key: CryptoKey
  ): Promise<EncryptionResult> {
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

    // Encrypt data
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      key,
      data
    );

    // Extract salt from key (we need to store it)
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH)); // In real app, get from key derivation

    return {
      encryptedData,
      iv,
      salt,
    };
  }

  /**
   * Decrypts data using AES-GCM
   */
  async decryptData(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    try {
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv as BufferSource,
        },
        key,
        encryptedData
      );

      return decryptedData;
    } catch (error) {
      throw new Error("Decryption failed. Invalid key or corrupted data.");
    }
  }

  /**
   * Encrypts a file with a unique file encryption key
   */
  async encryptFile(
    file: File
  ): Promise<EncryptionResult & { fileKey: CryptoKey }> {
    // Generate a unique file encryption key
    const fileKey = await crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true, // extractable
      ["encrypt", "decrypt"]
    );

    // Read file as ArrayBuffer
    const fileData = await file.arrayBuffer();

    // Generate IV and salt
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));

    // Encrypt file with file key
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      fileKey,
      fileData
    );

    return {
      encryptedData,
      iv,
      salt,
      fileKey,
    };
  }

  /**
   * Decrypts a file
   */
  async decryptFile(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    return this.decryptData(encryptedData, key, iv);
  }

  /**
   * Generates RSA key pair for asymmetric encryption (for sharing)
   */
  async generateKeyPair(): Promise<KeyPair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    };
  }

  /**
   * Exports a public key to share with others
   */
  async exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey("spki", publicKey);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Imports a public key from base64
   */
  async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return await crypto.subtle.importKey(
      "spki",
      keyData,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
  }

  /**
   * Encrypts a symmetric key with a public key (for sharing)
   */
  async encryptKeyForSharing(
    symmetricKey: CryptoKey,
    publicKey: CryptoKey
  ): Promise<string> {
    // Export symmetric key
    const keyData = await crypto.subtle.exportKey("raw", symmetricKey);

    // Encrypt with public key
    const encryptedKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      keyData
    );

    return this.arrayBufferToBase64(encryptedKey);
  }

  /**
   * Decrypts a shared key with private key
   */
  async decryptSharedKey(
    encryptedKey: string,
    privateKey: CryptoKey
  ): Promise<CryptoKey> {
    const encryptedKeyData = this.base64ToArrayBuffer(encryptedKey);

    // Decrypt with private key
    const keyData = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedKeyData
    );

    // Import as AES key
    return await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Converts ArrayBuffer to Base64 string
   */
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Converts Base64 string to ArrayBuffer
   */
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Converts Uint8Array to Base64
   */
  uint8ArrayToBase64(array: Uint8Array): string {
    return this.arrayBufferToBase64(array.buffer as ArrayBuffer);
  }

  /**
   * Converts Base64 to Uint8Array
   */
  base64ToUint8Array(base64: string): Uint8Array {
    return new Uint8Array(this.base64ToArrayBuffer(base64));
  }

  /**
   * Generates a random encryption key
   */
  async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Exports a key to raw format (for storage)
   */
  async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey("raw", key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Imports a key from raw format
   */
  async importKey(base64Key: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Hashes data using SHA-256
   */
  async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    return this.arrayBufferToBase64(hashBuffer);
  }
}

export const cryptoService = new CryptoService();
