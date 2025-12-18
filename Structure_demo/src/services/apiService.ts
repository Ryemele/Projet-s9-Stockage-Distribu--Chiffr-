/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { type AxiosInstance } from "axios";
import { cryptoService } from "./cryptoService";
import { dbService } from "./dbService";
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
 * API Service
 *
 * Handles HTTP requests to the backend API.
 * Includes a local storage fallback using IndexedDB (via dbService) for development.
 */
class ApiService {
  private api: AxiosInstance;
  private readonly USE_LOCAL_STORAGE = false; // Toggle for local development

  // Rate Limiting State
  private rateLimits: Record<string, number[]> = {};
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS = 20; // 20 requests per minute

  constructor() {
    this.api = axios.create({
      baseURL: "/api",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Attach auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // ==================== Rate Limiting ====================

  private checkRateLimit(action: string): boolean {
    const now = Date.now();
    if (!this.rateLimits[action]) {
      this.rateLimits[action] = [];
    }

    // Filter out old requests
    this.rateLimits[action] = this.rateLimits[action].filter(
      (timestamp) => now - timestamp < this.RATE_LIMIT_WINDOW
    );

    if (this.rateLimits[action].length >= this.MAX_REQUESTS) {
      return false;
    }

    this.rateLimits[action].push(now);
    return true;
  }

  // ==================== Auth APIs ====================

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    if (!this.checkRateLimit('login')) {
      throw new Error("Too many login attempts. Please try again later.");
    }

    if (this.USE_LOCAL_STORAGE) {
      return this.localLogin(credentials);
    }
    const response = await this.api.post<AuthResponse>(
      "/auth/login",
      credentials
    );
    return response.data;
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    if (!this.checkRateLimit('register')) {
      throw new Error("Too many registration attempts. Please try again later.");
    }

    // Sanitize inputs
    const sanitizedCredentials = {
      ...credentials,
      email: sanitizationService.sanitize(credentials.email),
      name: sanitizationService.sanitize(credentials.name)
    };

    if (!sanitizationService.isValidEmail(sanitizedCredentials.email)) {
      throw new Error("Invalid email format");
    }

    if (this.USE_LOCAL_STORAGE) {
      return this.localRegister(sanitizedCredentials);
    }
    try {
      const response = await this.api.post<AuthResponse>(
        "/auth/register",
        sanitizedCredentials
      );
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (this.USE_LOCAL_STORAGE) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      return;
    }
    await this.api.post("/auth/logout");
  }

  async getCurrentUser(): Promise<User> {
    if (this.USE_LOCAL_STORAGE) {
      const userStr = localStorage.getItem("currentUser");
      if (!userStr) throw new Error("Not authenticated");
      return JSON.parse(userStr);
    }
    const response = await this.api.get<User>("/auth/me");
    return response.data;
  }

  // ==================== File APIs ====================

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
      throw new Error("Upload rate limit exceeded.");
    }

    // Envelope format (single parameter)
    if (!metadata && typeof dataOrEnvelope === 'object' && 'fileId' in dataOrEnvelope) {
      // Sanitize file name
      dataOrEnvelope.fileName = sanitizationService.sanitizeFileName(dataOrEnvelope.fileName);

      if (this.USE_LOCAL_STORAGE) {
        const user = JSON.parse(localStorage.getItem("currentUser") || "{}");

        const newFile: EncryptedFile = {
          id: dataOrEnvelope.fileId,
          name: dataOrEnvelope.fileName,
          size: dataOrEnvelope.fileSize,
          mimeType: dataOrEnvelope.mimeType,
          uploadedAt: new Date().toISOString(),
          userId: user.id,
          encryptedDataUrl: cryptoService.serializeEnvelope(dataOrEnvelope),
          iv: dataOrEnvelope.timestamp,
          salt: ''
        };

        await dbService.addFile(newFile);
        return newFile;
      }

      // Use distributed upload for node-based storage
      const response = await this.api.post<any>(
        "/distributed/upload",
        {
          encryptedData: dataOrEnvelope.encryptedData,
          fileName: dataOrEnvelope.fileName,
          mimeType: dataOrEnvelope.mimeType,
          size: dataOrEnvelope.fileSize,
          encryptionMetadata: dataOrEnvelope.encryptionMetadata
        }
      );

      // Map the distributed response to EncryptedFile format
      const file = response.data.file;
      return {
        id: file.id,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        uploadedAt: new Date().toISOString(),
        userId: '',
        encryptedDataUrl: `/api/distributed/download/${file.id}`,
        iv: dataOrEnvelope.encryptionMetadata?.iv || '',
        salt: dataOrEnvelope.encryptionMetadata?.salt || ''
      };
    }

    // Legacy format (Blob + metadata)
    if (this.USE_LOCAL_STORAGE) {
      return this.localUploadFile(dataOrEnvelope as Blob, metadata!);
    }

    const formData = new FormData();
    formData.append("file", dataOrEnvelope as Blob);
    formData.append("metadata", JSON.stringify(metadata));

    const response = await this.api.post<EncryptedFile>(
      "/files/upload",
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  }

  async getFiles(): Promise<EncryptedFile[]> {
    if (this.USE_LOCAL_STORAGE) {
      return this.localGetFiles();
    }
    const response = await this.api.get<EncryptedFile[]>("/files");
    return response.data;
  }

  async getFile(fileId: string): Promise<EncryptedFile> {
    if (this.USE_LOCAL_STORAGE) {
      return this.localGetFile(fileId);
    }
    const response = await this.api.get<EncryptedFile>(`/files/${fileId}`);
    return response.data;
  }

  async downloadFile(fileId: string): Promise<Blob> {
    if (this.USE_LOCAL_STORAGE) {
      return this.localDownloadFile(fileId);
    }
    // Use distributed download endpoint for files stored on storage nodes
    const response = await this.api.get(`/distributed/download/${fileId}`, {
      responseType: "blob",
    });
    return response.data;
  }

  async deleteFile(fileId: string): Promise<void> {
    if (this.USE_LOCAL_STORAGE) {
      return this.localDeleteFile(fileId);
    }
    await this.api.delete(`/files/${fileId}`);
  }

  // ==================== Sharing APIs ====================

  async shareFile(
    fileId: string,
    email: string,
    encryptedKey: string
  ): Promise<FileShare> {
    if (!this.checkRateLimit('share')) {
      throw new Error("Share rate limit exceeded.");
    }

    // Sanitize email
    const sanitizedEmail = sanitizationService.sanitize(email);

    if (this.USE_LOCAL_STORAGE) {
      return this.localShareFile(fileId, sanitizedEmail, encryptedKey);
    }
    const response = await this.api.post<FileShare>(`/files/${fileId}/share`, {
      email: sanitizedEmail,
      encryptedKey,
    });
    return response.data;
  }

  async getSharedFiles(): Promise<FileShare[]> {
    if (this.USE_LOCAL_STORAGE) {
      return this.localGetSharedFiles();
    }
    const response = await this.api.get<FileShare[]>("/files/shared");
    return response.data;
  }

  async getUserPublicKey(email: string): Promise<string | { publicKey1: string; publicKey2: string }> {
    const sanitizedEmail = sanitizationService.sanitize(email);

    if (this.USE_LOCAL_STORAGE) {
      return this.localGetUserPublicKey(sanitizedEmail);
    }
    const response = await this.api.get<{ publicKey: string | { publicKey1: string; publicKey2: string } }>(
      `/users/${sanitizedEmail}/public-key`
    );
    return response.data.publicKey;
  }

  // ==================== Local Storage Implementations (Now using DBService) ====================

  private localLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        const user = await dbService.getUserByEmail(credentials.email);

        if (!user || (user as any).password !== credentials.password) {
          reject(new Error("Invalid credentials"));
          return;
        }

        const token = "local-token-" + Date.now();
        const authUser: User = {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          publicKey: user.publicKey,
        };

        localStorage.setItem("authToken", token);
        localStorage.setItem("currentUser", JSON.stringify(authUser));

        resolve({ user: authUser, token });
      } catch (e) {
        reject(e);
      }
    });
  }

  private localRegister(
    credentials: RegisterCredentials
  ): Promise<AuthResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        const existingUser = await dbService.getUserByEmail(credentials.email);

        if (existingUser) {
          reject(new Error("Email already exists"));
          return;
        }

        const newUser = {
          id: "user-" + Date.now(),
          email: credentials.email,
          name: credentials.name,
          password: credentials.password,
          createdAt: new Date().toISOString(),
          publicKey: credentials.publicKey || "",
        };

        await dbService.addUser(newUser);

        const token = "local-token-" + Date.now();
        const authUser: User = {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          createdAt: newUser.createdAt,
          publicKey: newUser.publicKey,
        };

        localStorage.setItem("authToken", token);
        localStorage.setItem("currentUser", JSON.stringify(authUser));

        resolve({ user: authUser, token });
      } catch (e) {
        reject(e);
      }
    });
  }

  private localUploadFile(
    encryptedData: Blob,
    metadata: any
  ): Promise<EncryptedFile> {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const user = JSON.parse(localStorage.getItem("currentUser") || "{}");

        const reader = new FileReader();
        reader.readAsDataURL(encryptedData);
        reader.onloadend = async () => {
          const base64data = reader.result as string;

          const newFile: EncryptedFile = {
            id: "file-" + Date.now(),
            name: sanitizationService.sanitizeFileName(metadata.name),
            size: metadata.size,
            mimeType: metadata.mimeType,
            uploadedAt: new Date().toISOString(),
            userId: user.id,
            encryptedDataUrl: base64data,
            iv: metadata.iv,
            salt: metadata.salt,
          };

          await dbService.addFile(newFile);
          resolve(newFile);
        };
      }, 500);
    });
  }

  private localGetFiles(): Promise<EncryptedFile[]> {
    return new Promise(async (resolve) => {
      const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (!user.id) {
        resolve([]);
        return;
      }
      const userFiles = await dbService.getFilesByUser(user.id);
      resolve(userFiles);
    });
  }

  private localGetFile(fileId: string): Promise<EncryptedFile> {
    return new Promise(async (resolve, reject) => {
      const file = await dbService.getFile(fileId);
      if (!file) {
        reject(new Error("File not found"));
        return;
      }
      resolve(file);
    });
  }

  private localDownloadFile(fileId: string): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
      const file = await dbService.getFile(fileId);

      if (!file) {
        reject(new Error("File not found"));
        return;
      }

      const response = await fetch(file.encryptedDataUrl);
      const blob = await response.blob();
      resolve(blob);
    });
  }

  private localDeleteFile(fileId: string): Promise<void> {
    return new Promise(async (resolve) => {
      await dbService.deleteFile(fileId);
      resolve();
    });
  }

  private localShareFile(
    fileId: string,
    email: string,
    encryptedKey: string
  ): Promise<FileShare> {
    return new Promise(async (resolve) => {
      const user = JSON.parse(localStorage.getItem("currentUser") || "{}");

      const newShare: FileShare = {
        id: "share-" + Date.now(),
        fileId,
        sharedBy: user.id,
        sharedWith: email,
        sharedAt: new Date().toISOString(),
        encryptedKey,
        permissions: "read",
      };

      // In a real app we'd store this in a shares table
      // For now, we can store it in dbService if we add a store, or just mock it
      // I added a 'shares' store to dbService
      await dbService.addShare({
        id: newShare.id,
        fileId: newShare.fileId,
        recipientEmail: newShare.sharedWith,
        rk: newShare.encryptedKey
      });

      resolve(newShare);
    });
  }

  private localGetSharedFiles(): Promise<FileShare[]> {
    return new Promise(async (resolve) => {
      const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (!user.email) {
        resolve([]);
        return;
      }

      // We need to map the DB share format back to FileShare type
      // The DB store has { id, fileId, recipientEmail, rk }
      // We need to fetch the file details too?
      // For simplicity in this mock, we'll just return what we have

      const dbShares = await dbService.getSharesForUser(user.email);

      const shares: FileShare[] = dbShares.map(s => ({
        id: s.id,
        fileId: s.fileId,
        sharedBy: "unknown", // We didn't store who shared it in the simplified DB model
        sharedWith: s.recipientEmail,
        sharedAt: new Date().toISOString(),
        encryptedKey: s.rk,
        permissions: "read"
      }));

      resolve(shares);
    });
  }

  private localGetUserPublicKey(email: string): Promise<string | { publicKey1: string; publicKey2: string }> {
    return new Promise(async (resolve, reject) => {
      const user = await dbService.getUserByEmail(email);

      if (!user || !user.publicKey) {
        reject(new Error("User not found or public key not available"));
        return;
      }

      resolve(user.publicKey);
    });
  }
}

export const apiService = new ApiService();
