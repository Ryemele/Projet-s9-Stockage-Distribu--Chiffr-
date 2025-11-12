/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { type AxiosInstance } from "axios";
import type {
  User,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  EncryptedFile,
  FileShare,
} from "../types";

/**
 * API Service - Handles all HTTP requests to the backend
 * This is a mock implementation that uses localStorage for demonstration
 * In production, replace with actual API calls
 */

class ApiService {
  private api: AxiosInstance;
  private readonly USE_MOCK = true; // Set to false when backend is ready

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
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
  }

  // ==================== Auth APIs ====================

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    if (this.USE_MOCK) {
      return this.mockLogin(credentials);
    }
    const response = await this.api.post<AuthResponse>(
      "/auth/login",
      credentials
    );
    return response.data;
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    if (this.USE_MOCK) {
      return this.mockRegister(credentials);
    }
    const response = await this.api.post<AuthResponse>(
      "/auth/register",
      credentials
    );
    return response.data;
  }

  async logout(): Promise<void> {
    if (this.USE_MOCK) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      return;
    }
    await this.api.post("/auth/logout");
  }

  async getCurrentUser(): Promise<User> {
    if (this.USE_MOCK) {
      const userStr = localStorage.getItem("currentUser");
      if (!userStr) throw new Error("Not authenticated");
      return JSON.parse(userStr);
    }
    const response = await this.api.get<User>("/auth/me");
    return response.data;
  }

  // ==================== File APIs ====================

  // Overload signatures
  async uploadFile(
    encryptedData: Blob,
    metadata: {
      name: string;
      size: number;
      mimeType: string;
      iv: string;
      salt: string;
    }
  ): Promise<EncryptedFile>;
  async uploadFile(afghEnvelope: any): Promise<EncryptedFile>;

  // Implementation
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
    // AFGH envelope format (single parameter)
    if (!metadata && typeof dataOrEnvelope === 'object' && 'fileId' in dataOrEnvelope) {
      if (this.USE_MOCK) {
        // Mock: Save AFGH envelope to localStorage
        const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const files = JSON.parse(localStorage.getItem("mockFiles") || "[]");

        const newFile: EncryptedFile = {
          id: dataOrEnvelope.fileId,
          name: dataOrEnvelope.fileName,
          size: dataOrEnvelope.fileSize,
          mimeType: dataOrEnvelope.mimeType,
          uploadedAt: new Date().toISOString(),
          userId: user.id,
          encryptedDataUrl: JSON.stringify(dataOrEnvelope), // Store the entire envelope
          iv: Array.from(dataOrEnvelope.wrapKeyIV).map((b: number) => b.toString(16).padStart(2, '0')).join(''),
          salt: dataOrEnvelope.kdfSalt ? Array.from(dataOrEnvelope.kdfSalt).map((b: number) => b.toString(16).padStart(2, '0')).join('') : ''
        };

        files.push(newFile);
        localStorage.setItem("mockFiles", JSON.stringify(files));
        console.log('[API Mock] File saved to localStorage:', newFile.id);

        return newFile;
      }

      // Real API call for AFGH
      const response = await this.api.post<EncryptedFile>(
        "/files/upload",
        dataOrEnvelope
      );
      return response.data;
    }

    // Old format (Blob + metadata)
    if (this.USE_MOCK) {
      return this.mockUploadFile(dataOrEnvelope as Blob, metadata!);
    }

    const formData = new FormData();
    formData.append("file", dataOrEnvelope as Blob);
    formData.append("metadata", JSON.stringify(metadata));

    const response = await this.api.post<EncryptedFile>(
      "/files/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return response.data;
  }

  async getFiles(): Promise<EncryptedFile[]> {
    if (this.USE_MOCK) {
      return this.mockGetFiles();
    }
    const response = await this.api.get<EncryptedFile[]>("/files");
    return response.data;
  }

  async getFile(fileId: string): Promise<EncryptedFile> {
    if (this.USE_MOCK) {
      return this.mockGetFile(fileId);
    }
    const response = await this.api.get<EncryptedFile>(`/files/${fileId}`);
    return response.data;
  }

  async downloadFile(fileId: string): Promise<Blob> {
    if (this.USE_MOCK) {
      return this.mockDownloadFile(fileId);
    }
    const response = await this.api.get(`/files/${fileId}/download`, {
      responseType: "blob",
    });
    return response.data;
  }

  async deleteFile(fileId: string): Promise<void> {
    if (this.USE_MOCK) {
      return this.mockDeleteFile(fileId);
    }
    await this.api.delete(`/files/${fileId}`);
  }

  // ==================== Sharing APIs ====================

  async shareFile(
    fileId: string,
    email: string,
    encryptedKey: string
  ): Promise<FileShare> {
    if (this.USE_MOCK) {
      return this.mockShareFile(fileId, email, encryptedKey);
    }
    const response = await this.api.post<FileShare>(`/files/${fileId}/share`, {
      email,
      encryptedKey,
    });
    return response.data;
  }

  async getSharedFiles(): Promise<FileShare[]> {
    if (this.USE_MOCK) {
      return this.mockGetSharedFiles();
    }
    const response = await this.api.get<FileShare[]>("/files/shared");
    return response.data;
  }

  async getUserPublicKey(email: string): Promise<string> {
    if (this.USE_MOCK) {
      return this.mockGetUserPublicKey(email);
    }
    const response = await this.api.get<{ publicKey: string }>(
      `/users/${email}/public-key`
    );
    return response.data.publicKey;
  }

  // ==================== Mock Implementations ====================

  private mockLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = JSON.parse(localStorage.getItem("mockUsers") || "[]");
        const user = users.find((u: any) => u.email === credentials.email);

        if (!user || user.password !== credentials.password) {
          reject(new Error("Invalid credentials"));
          return;
        }

        const token = "mock-token-" + Date.now();
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
      }, 500);
    });
  }

  private mockRegister(
    credentials: RegisterCredentials
  ): Promise<AuthResponse> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = JSON.parse(localStorage.getItem("mockUsers") || "[]");

        if (users.find((u: any) => u.email === credentials.email)) {
          reject(new Error("Email already exists"));
          return;
        }

        const newUser = {
          id: "user-" + Date.now(),
          email: credentials.email,
          name: credentials.name,
          password: credentials.password,
          createdAt: new Date().toISOString(),
          publicKey: "",
        };

        users.push(newUser);
        localStorage.setItem("mockUsers", JSON.stringify(users));

        const token = "mock-token-" + Date.now();
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
      }, 500);
    });
  }

  private mockUploadFile(
    encryptedData: Blob,
    metadata: any
  ): Promise<EncryptedFile> {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const files = JSON.parse(localStorage.getItem("mockFiles") || "[]");

        // Convert blob to base64 for storage
        const reader = new FileReader();
        reader.readAsDataURL(encryptedData);
        reader.onloadend = () => {
          const base64data = reader.result as string;

          const newFile: EncryptedFile = {
            id: "file-" + Date.now(),
            name: metadata.name,
            size: metadata.size,
            mimeType: metadata.mimeType,
            uploadedAt: new Date().toISOString(),
            userId: user.id,
            encryptedDataUrl: base64data,
            iv: metadata.iv,
            salt: metadata.salt,
          };

          files.push(newFile);
          localStorage.setItem("mockFiles", JSON.stringify(files));

          resolve(newFile);
        };
      }, 1000);
    });
  }

  private mockGetFiles(): Promise<EncryptedFile[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const files = JSON.parse(localStorage.getItem("mockFiles") || "[]");
        const userFiles = files.filter(
          (f: EncryptedFile) => f.userId === user.id
        );
        resolve(userFiles);
      }, 300);
    });
  }

  private mockGetFile(fileId: string): Promise<EncryptedFile> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const files = JSON.parse(localStorage.getItem("mockFiles") || "[]");
        const file = files.find((f: EncryptedFile) => f.id === fileId);
        if (!file) {
          reject(new Error("File not found"));
          return;
        }
        resolve(file);
      }, 300);
    });
  }

  private mockDownloadFile(fileId: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        const files = JSON.parse(localStorage.getItem("mockFiles") || "[]");
        const file = files.find((f: EncryptedFile) => f.id === fileId);

        if (!file) {
          reject(new Error("File not found"));
          return;
        }

        // Convert base64 back to blob
        const response = await fetch(file.encryptedDataUrl);
        const blob = await response.blob();
        resolve(blob);
      }, 500);
    });
  }

  private mockDeleteFile(fileId: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const files = JSON.parse(localStorage.getItem("mockFiles") || "[]");
        const updatedFiles = files.filter(
          (f: EncryptedFile) => f.id !== fileId
        );
        localStorage.setItem("mockFiles", JSON.stringify(updatedFiles));
        resolve();
      }, 300);
    });
  }

  private mockShareFile(
    fileId: string,
    email: string,
    encryptedKey: string
  ): Promise<FileShare> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const shares = JSON.parse(localStorage.getItem("mockShares") || "[]");

        const newShare: FileShare = {
          id: "share-" + Date.now(),
          fileId,
          sharedBy: user.id,
          sharedWith: email,
          sharedAt: new Date().toISOString(),
          encryptedKey,
          permissions: "read",
        };

        shares.push(newShare);
        localStorage.setItem("mockShares", JSON.stringify(shares));
        resolve(newShare);
      }, 500);
    });
  }

  private mockGetSharedFiles(): Promise<FileShare[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const shares = JSON.parse(localStorage.getItem("mockShares") || "[]");
        const userShares = shares.filter(
          (s: FileShare) => s.sharedWith === user.email
        );
        resolve(userShares);
      }, 300);
    });
  }

  private mockGetUserPublicKey(email: string): Promise<string> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = JSON.parse(localStorage.getItem("mockUsers") || "[]");
        const user = users.find((u: any) => u.email === email);

        if (!user || !user.publicKey) {
          reject(new Error("User not found or public key not available"));
          return;
        }

        resolve(user.publicKey);
      }, 300);
    });
  }
}

export const apiService = new ApiService();
