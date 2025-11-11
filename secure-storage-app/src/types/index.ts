// User types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  publicKey?: string; // For end-to-end encryption
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
