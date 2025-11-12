// User types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  publicKey?: string | { publicKey1: string; publicKey2: string }; // For end-to-end encryption (AFGH)
  keyDerivationSalt?: string; // Salt for PBKDF2
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  masterKey: CryptoKey | null; // Master encryption key derived from password
}

// File types
export interface EncryptedFile {
  id: string;
  name: string; // Encrypted filename
  size: number; // Size of encrypted file
  mimeType: string;
  uploadedAt: string;
  userId: string;
  encryptedDataUrl: string; // URL to encrypted file data
  iv: string; // Initialization vector (base64)
  salt: string; // Salt for key derivation (base64)
}

export interface DecryptedFileMetadata {
  id: string;
  name: string; // Original filename
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface FileShare {
  id: string;
  fileId: string;
  sharedBy: string;
  sharedWith: string;
  sharedAt: string;
  encryptedKey: string; // File key encrypted with recipient's public key
  permissions: 'read' | 'write';
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  publicKey?: { publicKey1: string; publicKey2: string }; // AFGH public key
  keyDerivationSalt?: string; // PBKDF2 salt
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Upload/Download types
export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number; // 0-100
  status: 'encrypting' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export interface DownloadProgress {
  fileId: string;
  progress: number; // 0-100
  status: 'downloading' | 'decrypting' | 'completed' | 'failed';
  error?: string;
}

// Crypto types
export interface EncryptionResult {
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  salt: Uint8Array;
}

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

// Enhanced crypto types for chunked encryption
export interface EncryptedChunk {
  chunkIndex: number;
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  hash: string; // SHA-256 hash for integrity
}

export interface FileEncryptionEnvelope {
  fileId: string;
  fileName: string; // Original filename
  fileSize: number; // Original file size
  mimeType: string;
  chunks: EncryptedChunk[];
  wrappedKey: string; // AES key encrypted with password-derived key (base64)
  keyMetadata: {
    algorithm: string;
    wrappedKeyAlgorithm: string; // "PBKDF2-AES-GCM" pour propriétaire, "RSA-OAEP" pour partage
    keyWrapIV?: string; // IV used for wrapping file key (base64)
  };
  metadata: {
    uploadedAt: string;
    chunkSize: number;
    totalChunks: number;
  };
}

export interface KeyWrappingResult {
  wrappedKey: string; // Base64 encoded
  algorithm: string;
  publicKeyThumbprint: string; // For key identification
}

export interface ShareEncryptionResult {
  recipientId: string;
  wrappedKey: string; // File key re-encrypted with recipient's public key
  shareId: string;
  permissions: 'read' | 'write';
}

// RSA key storage format
export interface StoredKeyPair {
  publicKey: string; // Base64 encoded SPKI format
  privateKey: string; // Base64 encoded PKCS8 format (encrypted with master key)
  thumbprint: string; // SHA-256 hash of public key for identification
  createdAt: string;
}
