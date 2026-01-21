/* eslint-disable @typescript-eslint/no-explicit-any */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { EncryptedFile, User, KeyPair } from "../types";

interface SecureStorageDB extends DBSchema {
  files: {
    key: string;
    value: EncryptedFile;
    indexes: { "by-user": string };
  };
  users: {
    key: string;
    value: User;
    indexes: { "by-email": string };
  };
  keys: {
    key: string;
    value: { userId: string; keyPair: KeyPair };
  };
  shares: {
    key: string;
    value: { id: string; fileId: string; recipientEmail: string; rk: string };
    indexes: { "by-recipient": string };
  };
}

class DBService {
  private dbPromise: Promise<IDBPDatabase<SecureStorageDB>>;

  constructor() {
    this.dbPromise = openDB<SecureStorageDB>("secure-storage-db", 1, {
      upgrade(db) {
        // Files store
        const fileStore = db.createObjectStore("files", { keyPath: "id" });
        fileStore.createIndex("by-user", "userId");

        // Users store
        const userStore = db.createObjectStore("users", { keyPath: "id" });
        userStore.createIndex("by-email", "email", { unique: true });

        // Keys store
        db.createObjectStore("keys", { keyPath: "userId" });

        // Shares store
        const shareStore = db.createObjectStore("shares", { keyPath: "id" });
        shareStore.createIndex("by-recipient", "recipientEmail");
      },
    });
  }

  // User Operations
  async addUser(user: User): Promise<void> {
    const db = await this.dbPromise;
    await db.put("users", user);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = await this.dbPromise;
    return db.getFromIndex("users", "by-email", email);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const db = await this.dbPromise;
    return db.get("users", id);
  }

  // Key Operations
  async saveKeys(userId: string, keyPair: KeyPair): Promise<void> {
    const db = await this.dbPromise;
    await db.put("keys", { userId, keyPair });
  }

  async getKeys(userId: string): Promise<KeyPair | undefined> {
    const db = await this.dbPromise;
    const result = await db.get("keys", userId);
    return result?.keyPair;
  }

  // File Operations
  async addFile(file: EncryptedFile): Promise<void> {
    const db = await this.dbPromise;
    await db.put("files", file);
  }

  async getFilesByUser(userId: string): Promise<EncryptedFile[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex("files", "by-user", userId);
  }

  async getFile(id: string): Promise<EncryptedFile | undefined> {
    const db = await this.dbPromise;
    return db.get("files", id);
  }

  async deleteFile(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete("files", id);
  }

  // Share Operations
  async addShare(share: {
    id: string;
    fileId: string;
    recipientEmail: string;
    rk: string;
  }): Promise<void> {
    const db = await this.dbPromise;
    await db.put("shares", share);
  }

  async getSharesForUser(email: string): Promise<any[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex("shares", "by-recipient", email);
  }
}

export const dbService = new DBService();
(window as any).dbService = dbService;
