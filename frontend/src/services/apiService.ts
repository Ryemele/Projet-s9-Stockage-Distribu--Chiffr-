/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { type AxiosInstance } from "axios";
import { cryptoService } from "./cryptoService";
import { sanitizationService } from "./sanitizationService";
import type {
  User,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  EncryptedFile,
  FileShare,
} from "../types";

/**
 * API Service - Handles all HTTP requests to the backend gateway
 * Uses real backend with distributed storage and erasure coding
 */

// Cluster status response type
export interface ClusterStatus {
  total_nodes: number;
  online_nodes: number;
  offline_nodes: number;
  healthy: boolean;
  erasure_coding: {
    data_shards: number;
    parity_shards: number;
    fault_tolerance: number;
  };
  can_accept_uploads: boolean;
}

// File recovery status type
export interface FileRecoveryStatus {
  file_id: string;
  filename: string;
  status: 'healthy' | 'degraded' | 'critical';
  available_shards: number;
  required_shards: number;
  total_shards: number;
  can_recover: boolean;
}

// Shared file info type
export interface SharedFileInfo {
  fileId: string;
  filename: string;
  size: number;
  mimeType: string;
  isOwner: boolean;
  sharedBy: string;
  sharedByName: string;
  shareId: string;
  encryptedKey: string; // Re-encrypted envelope JSON
  permissions: 'read' | 'read-write';
  sharedAt: string;
}

class ApiService {
  private api: AxiosInstance;

  // Rate Limiting State
  private rateLimits: Record<string, number[]> = {};
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS = 30; // 30 requests per minute

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle errors globally
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("authToken");
          localStorage.removeItem("currentUser");
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== Rate Limiting ====================

  private checkRateLimit(action: string): boolean {
    const now = Date.now();
    if (!this.rateLimits[action]) {
      this.rateLimits[action] = [];
    }

    this.rateLimits[action] = this.rateLimits[action].filter(
      (timestamp) => now - timestamp < this.RATE_LIMIT_WINDOW
    );

    if (this.rateLimits[action].length >= this.MAX_REQUESTS) {
      return false;
    }

    this.rateLimits[action].push(now);
    return true;
  }

  // ==================== Helpers ====================

  private adaptUser(backendUser: any): User {
    return {
      id: backendUser.user_id || backendUser.id,
      email: backendUser.email,
      name: backendUser.name,
      createdAt: backendUser.created_at || backendUser.createdAt,
      publicKey: backendUser.public_key || backendUser.publicKey,
    };
  }

  private adaptFile(backendFile: any): EncryptedFile {
    return {
      id: backendFile.file_id || backendFile.id,
      name: backendFile.filename || backendFile.name,
      size: backendFile.size_bytes || backendFile.size,
      mimeType: backendFile.mime_type || backendFile.mimeType || 'application/octet-stream',
      uploadedAt: backendFile.created_at || backendFile.uploadedAt,
      userId: backendFile.owner_id || backendFile.userId,
      encryptedDataUrl: '',
      iv: backendFile.iv || '',
      salt: backendFile.salt || '',
      isChunked: backendFile.is_chunked || backendFile.isChunked || false,
      checksum: backendFile.checksum || '',
      starred: backendFile.starred || false,
      folderId: backendFile.folder_id || backendFile.folderId || null,
    };
  }

  // ==================== Auth APIs ====================

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    if (!this.checkRateLimit('login')) {
      throw new Error("Too many login attempts. Please try again later.");
    }

    const response = await this.api.post("/auth/login", credentials);
    const data = response.data;
    const user = this.adaptUser(data.user);

    localStorage.setItem("authToken", data.token);
    localStorage.setItem("currentUser", JSON.stringify(user));

    return { user, token: data.token };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    if (!this.checkRateLimit('register')) {
      throw new Error("Too many registration attempts. Please try again later.");
    }

    // Sanitize inputs
    const sanitizedCredentials = {
      email: sanitizationService.sanitize(credentials.email),
      name: sanitizationService.sanitize(credentials.name),
      password: credentials.password,
      // Convert publicKey object to JSON string for backend storage
      public_key: credentials.publicKey ? JSON.stringify(credentials.publicKey) : undefined,
    };

    if (!sanitizationService.isValidEmail(sanitizedCredentials.email)) {
      throw new Error("Invalid email format");
    }

    const response = await this.api.post("/auth/register", sanitizedCredentials);
    const data = response.data;
    const user = this.adaptUser(data.user);

    localStorage.setItem("authToken", data.token);
    localStorage.setItem("currentUser", JSON.stringify(user));

    return { user, token: data.token };
  }

  async logout(): Promise<void> {
    try {
      await this.api.post("/auth/logout");
    } finally {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get("/auth/me");
    return this.adaptUser(response.data.user || response.data);
  }

  // ==================== Standard File APIs ====================

  async uploadFile(
    dataOrEnvelope: Blob | any,
    metadata?: {
      name: string;
      size: number;
      mimeType: string;
      iv: string;
      salt: string;
    }
  ): Promise<EncryptedFile> {
    if (!this.checkRateLimit('upload')) {
      throw new Error("Upload rate limit exceeded. Please wait.");
    }

    // Envelope format (encrypted file from cryptoService)
    if (!metadata && typeof dataOrEnvelope === 'object' && 'fileId' in dataOrEnvelope) {
      // Sanitize file name
      dataOrEnvelope.fileName = sanitizationService.sanitizeFileName(dataOrEnvelope.fileName);

      // Use distributed upload for erasure-coded storage
      return this.uploadDistributed(dataOrEnvelope);
    }

    // Blob + metadata format (legacy)
    const formData = new FormData();
    // Pass filename to FormData to preserve the original name
    const fileName = metadata?.name ? sanitizationService.sanitizeFileName(metadata.name) : "file";
    formData.append("file", dataOrEnvelope as Blob, fileName);

    const response = await this.api.post("/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return this.adaptFile(response.data.file || response.data);
  }

  async getFiles(): Promise<EncryptedFile[]> {
    const response = await this.api.get("/files");
    const files = Array.isArray(response.data) ? response.data : (response.data.files || []);
    return files.map((f: any) => this.adaptFile(f));
  }

  async getFile(fileId: string): Promise<EncryptedFile> {
    const response = await this.api.get(`/files/${fileId}`);
    return this.adaptFile(response.data.file || response.data);
  }

  async downloadFile(fileId: string): Promise<Blob> {
    // Try distributed download first (for chunked files)
    try {
      const file = await this.getFile(fileId);
      if (file.isChunked) {
        return this.downloadDistributed(fileId);
      }
    } catch {
      // Fall through to standard download
    }

    // Standard download (for non-chunked files)
    const response = await this.api.get(`/files/${fileId}/download`);
    const data = response.data;

    // Handle chunked response
    if (data.chunks && Array.isArray(data.chunks)) {
      const sortedChunks = data.chunks.sort((a: any, b: any) => a.index - b.index);
      const blobParts: BlobPart[] = [];

      for (const chunk of sortedChunks) {
        const binaryString = atob(chunk.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blobParts.push(bytes.buffer as ArrayBuffer);
      }

      return new Blob(blobParts, { type: data.file?.mime_type || 'application/octet-stream' });
    }

    // Handle base64 response
    if (data.data) {
      const binaryString = atob(data.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: data.file?.mime_type || 'application/octet-stream' });
    }

    throw new Error("Unexpected response format");
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.api.delete(`/files/${fileId}`);
  }

  // ==================== Distributed Storage APIs ====================

  /**
   * Upload file with Reed-Solomon erasure coding
   * File is chunked and each chunk is encoded with RS(4,2)
   */
  async uploadDistributed(envelope: any): Promise<EncryptedFile> {
    // Prepare form data for distributed upload
    const formData = new FormData();

    // Convert encrypted data to blob
    const encryptedBytes = cryptoService.base64ToUint8Array(envelope.encryptedData);
    // Create a new ArrayBuffer copy to ensure type compatibility
    const arrayBuffer = new ArrayBuffer(encryptedBytes.length);
    new Uint8Array(arrayBuffer).set(encryptedBytes);
    const encryptedBlob = new Blob([arrayBuffer], { type: envelope.mimeType });

    formData.append("file", encryptedBlob, envelope.fileName);

    // Include encryption metadata for later decryption
    const metadataJson = JSON.stringify({
      encryptionMetadata: envelope.encryptionMetadata,
      originalSize: envelope.fileSize,
    });
    formData.append("encryption_metadata", metadataJson);

    const response = await this.api.post("/files/upload-distributed", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const result = response.data;
    return {
      id: result.file.file_id,
      name: result.file.filename,
      size: result.file.size_bytes,
      mimeType: result.file.mime_type,
      uploadedAt: result.file.created_at,
      userId: result.file.owner_id,
      encryptedDataUrl: '',
      iv: '',
      salt: '',
      isChunked: true,
      checksum: result.file.checksum,
      erasureCoding: result.erasure_coding,
    };
  }

  /**
   * Download file with automatic Reed-Solomon recovery
   */
  async downloadDistributed(fileId: string): Promise<Blob> {
    const response = await this.api.get(`/files/${fileId}/download-distributed`);
    const data = response.data;

    if (!data.data) {
      throw new Error("No data in response");
    }

    // Decode base64 data
    const binaryString = atob(data.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: data.file?.mime_type || 'application/octet-stream' });
  }

  /**
   * Get file recovery status (health of shards across nodes)
   */
  async getFileRecoveryStatus(fileId: string): Promise<FileRecoveryStatus> {
    const response = await this.api.get(`/files/${fileId}/recovery-status`);
    return response.data;
  }

  /**
   * Trigger file recovery if shards are degraded
   */
  async recoverFile(fileId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.api.post(`/files/${fileId}/recover`);
    return response.data;
  }

  // ==================== Cluster APIs ====================

  /**
   * Get cluster health status
   */
  async getClusterStatus(): Promise<ClusterStatus> {
    const response = await this.api.get("/cluster/status");
    return response.data;
  }

  /**
   * Get list of storage nodes
   */
  async getClusterNodes(): Promise<any[]> {
    const response = await this.api.get("/cluster/nodes");
    return response.data.nodes || [];
  }

  // ==================== Sharing APIs ====================

  async shareFile(
    fileId: string,
    email: string,
    encryptedKey: string
  ): Promise<FileShare> {
    if (!this.checkRateLimit('share')) {
      throw new Error("Share rate limit exceeded. Please wait.");
    }

    const sanitizedEmail = sanitizationService.sanitize(email);

    if (!sanitizationService.isValidEmail(sanitizedEmail)) {
      throw new Error("Invalid email format");
    }

    const response = await this.api.post(`/files/${fileId}/share`, {
      email: sanitizedEmail,
      encrypted_key: encryptedKey,
    });

    return response.data;
  }

  async getSharedFiles(): Promise<SharedFileInfo[]> {
    const response = await this.api.get("/files/shared");
    const shares = Array.isArray(response.data) ? response.data : (response.data.shares || []);
    return shares.map((s: any) => ({
      fileId: s.file_id,
      filename: s.filename,
      size: s.size_bytes,
      mimeType: s.mime_type,
      isOwner: s.is_owner,
      sharedBy: s.shared_by,
      sharedByName: s.shared_by_name,
      shareId: s.share_id,
      encryptedKey: s.encrypted_key,
      permissions: s.permissions,
      sharedAt: s.shared_at,
    }));
  }

  async removeShare(shareId: string): Promise<void> {
    await this.api.delete(`/shares/${shareId}`);
  }

  async getUserPublicKey(email: string): Promise<string | { publicKey1: string; publicKey2: string }> {
    const sanitizedEmail = sanitizationService.sanitize(email);
    const response = await this.api.get(`/users/${encodeURIComponent(sanitizedEmail)}/public-key`);
    return response.data.public_key || response.data.publicKey;
  }

  // ==================== User APIs ====================

  async updatePublicKey(publicKey: string | { publicKey1: string; publicKey2: string }): Promise<void> {
    await this.api.put("/auth/public-key", { public_key: publicKey });
  }

  // ==================== File Operations ====================

  async toggleFileStarred(fileId: string): Promise<{ starred: boolean }> {
    const response = await this.api.patch(`/files/${fileId}/starred`);
    return response.data;
  }

  async moveFileToFolder(fileId: string, folderId: string | null): Promise<void> {
    await this.api.patch(`/files/${fileId}/folder`, { folder_id: folderId });
  }

  // ==================== Storage Stats ====================

  async getStorageStats(): Promise<{ used: number; total: number; fileCount: number }> {
    const response = await this.api.get("/storage/stats");
    return {
      used: response.data.used_bytes || response.data.used || 0,
      total: response.data.total_bytes || response.data.total || 10 * 1024 * 1024 * 1024, // 10GB default
      fileCount: response.data.file_count || response.data.fileCount || 0,
    };
  }

  // ==================== Folders ====================

  async getFolders(): Promise<any[]> {
    const response = await this.api.get("/folders");
    return Array.isArray(response.data) ? response.data : (response.data.folders || []);
  }

  async createFolder(name: string, parentId?: string): Promise<any> {
    const response = await this.api.post("/folders", { name, parent_id: parentId });
    return response.data.folder || response.data;
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.api.delete(`/folders/${folderId}`);
  }

  async getFolderFiles(folderId: string): Promise<EncryptedFile[]> {
    const response = await this.api.get(`/folders/${folderId}/files`);
    const files = Array.isArray(response.data) ? response.data : (response.data.files || []);
    return files.map((f: any) => this.adaptFile(f));
  }

  // ==================== Teams ====================

  async getTeams(): Promise<any[]> {
    const response = await this.api.get("/teams");
    return Array.isArray(response.data) ? response.data : (response.data.teams || []);
  }

  async createTeam(name: string, description?: string): Promise<any> {
    const response = await this.api.post("/teams", { name, description });
    return response.data.team || response.data;
  }

  async getTeam(teamId: string): Promise<any> {
    const response = await this.api.get(`/teams/${teamId}`);
    return response.data.team || response.data;
  }

  async updateTeam(teamId: string, data: { name?: string; description?: string }): Promise<any> {
    const response = await this.api.put(`/teams/${teamId}`, data);
    return response.data.team || response.data;
  }

  async deleteTeam(teamId: string): Promise<void> {
    await this.api.delete(`/teams/${teamId}`);
  }

  async getTeamMembers(teamId: string): Promise<any[]> {
    const response = await this.api.get(`/teams/${teamId}/members`);
    return Array.isArray(response.data) ? response.data : (response.data.members || []);
  }

  async addTeamMember(teamId: string, email: string, role: string = 'member'): Promise<any> {
    const response = await this.api.post(`/teams/${teamId}/members`, { email, role });
    return response.data;
  }

  async removeTeamMember(teamId: string, memberId: string): Promise<void> {
    await this.api.delete(`/teams/${teamId}/members/${memberId}`);
  }

  async getTeamFiles(teamId: string): Promise<EncryptedFile[]> {
    const response = await this.api.get(`/teams/${teamId}/files`);
    const files = Array.isArray(response.data) ? response.data : (response.data.files || []);
    return files.map((f: any) => this.adaptFile(f));
  }

  // ==================== Health Check ====================

  async healthCheck(): Promise<{ status: string; minio: boolean }> {
    const response = await this.api.get("/health");
    return response.data;
  }
}

export const apiService = new ApiService();
