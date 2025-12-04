/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * Service de stockage AFGH dans IndexedDB
 *
 * Stocke les paires de clés AFGH chiffrées avec le mot de passe utilisateur
 */

import type { AFGHKeyPair } from "../types/afgh";

interface StoredAFGHKeyPair {
  id: string;
  userId: string;
  encryptedKeyPair: string; // JSON chiffré de la paire de clés
  iv: string; // IV pour le déchiffrement
  createdAt: string;
}

class AFGHStorageService {
  private readonly DB_NAME = "AFGHSecureStorage";
  private readonly DB_VERSION = 1;
  private readonly STORE_KEYPAIRS = "afgh_keypairs";

  private db: IDBDatabase | null = null;

  /**
   * Initialise IndexedDB
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Créer le store pour les paires de clés
        if (!db.objectStoreNames.contains(this.STORE_KEYPAIRS)) {
          const store = db.createObjectStore(this.STORE_KEYPAIRS, {
            keyPath: "id",
          });
          store.createIndex("userId", "userId", { unique: true });
        }
      };
    });
  }

  /**
   * Stocke une paire de clés chiffrée
   */
  async storeEncryptedKeyPair(
    userId: string,
    encryptedKeyPair: string,
    iv: string
  ): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.STORE_KEYPAIRS],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORE_KEYPAIRS);

      const data: StoredAFGHKeyPair = {
        id: `afgh_keypair_${userId}`,
        userId,
        encryptedKeyPair,
        iv,
        createdAt: new Date().toISOString(),
      };

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère une paire de clés chiffrée
   */
  async getEncryptedKeyPair(
    userId: string
  ): Promise<{ encryptedKeyPair: string; iv: string } | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.STORE_KEYPAIRS],
        "readonly"
      );
      const store = transaction.objectStore(this.STORE_KEYPAIRS);
      const request = store.get(`afgh_keypair_${userId}`);

      request.onsuccess = () => {
        const result = request.result as StoredAFGHKeyPair | undefined;
        if (result) {
          resolve({
            encryptedKeyPair: result.encryptedKeyPair,
            iv: result.iv,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime une paire de clés
   */
  async deleteKeyPair(userId: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.STORE_KEYPAIRS],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORE_KEYPAIRS);
      const request = store.delete(`afgh_keypair_${userId}`);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Vérifie si une paire de clés existe
   */
  async hasKeyPair(userId: string): Promise<boolean> {
    const keyPair = await this.getEncryptedKeyPair(userId);
    return keyPair !== null;
  }

  /**
   * Réinitialise tout
   */
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.STORE_KEYPAIRS],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORE_KEYPAIRS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Utilitaires de chiffrement/déchiffrement de la paire de clés
   */

  /**
   * Chiffre une paire de clés AFGH avec un mot de passe
   */
  async encryptKeyPair(
    keyPair: AFGHKeyPair,
    passwordKey: CryptoKey
  ): Promise<{ encryptedKeyPair: string; iv: string }> {
    // Sérialiser la paire de clés
    const keyPairData = {
      userId: keyPair.userId,
      secretKey1: this.arrayToBase64(keyPair.secretKey1),
      secretKey2: this.arrayToBase64(keyPair.secretKey2),
      publicKey1: this.arrayToBase64(keyPair.publicKey1),
      publicKey2: this.arrayToBase64(keyPair.publicKey2),
      createdAt: keyPair.createdAt,
      curveType: keyPair.curveType,
    };

    const keyPairJSON = JSON.stringify(keyPairData);
    const keyPairBytes = new TextEncoder().encode(keyPairJSON);

    // Générer IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Chiffrer avec AES-GCM
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      passwordKey,
      keyPairBytes
    );

    return {
      encryptedKeyPair: this.arrayToBase64(new Uint8Array(encryptedBuffer)),
      iv: this.arrayToBase64(iv),
    };
  }

  /**
   * Déchiffre une paire de clés AFGH
   */
  async decryptKeyPair(
    encryptedKeyPair: string,
    iv: string,
    passwordKey: CryptoKey
  ): Promise<AFGHKeyPair> {
    const encryptedBytes = this.base64ToArray(encryptedKeyPair);
    const ivBytes = this.base64ToArray(iv);

    // Déchiffrer
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        // @ts-ignore - Uint8Array type compatibility issue
        iv: new Uint8Array(
          ivBytes.buffer,
          ivBytes.byteOffset,
          ivBytes.byteLength
        ),
      },
      passwordKey,
      encryptedBytes
    );

    const keyPairJSON = new TextDecoder().decode(decryptedBuffer);
    const keyPairData = JSON.parse(keyPairJSON);

    // Reconstituer la paire de clés
    return {
      userId: keyPairData.userId,
      secretKey1: this.base64ToArray(keyPairData.secretKey1),
      secretKey2: this.base64ToArray(keyPairData.secretKey2),
      publicKey1: this.base64ToArray(keyPairData.publicKey1),
      publicKey2: this.base64ToArray(keyPairData.publicKey2),
      createdAt: keyPairData.createdAt,
      curveType: keyPairData.curveType,
    };
  }

  /**
   * Dérive une clé depuis un mot de passe avec PBKDF2
   */
  async deriveKeyFromPassword(
    password: string,
    salt?: Uint8Array
  ): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    const keySalt = salt || crypto.getRandomValues(new Uint8Array(16));

    const passwordKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        // @ts-ignore - Uint8Array type compatibility issue
        salt: new Uint8Array(
          keySalt.buffer,
          keySalt.byteOffset,
          keySalt.byteLength
        ),
        iterations: 100000,
        hash: "SHA-256",
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    return { key, salt: keySalt };
  }

  // Utilitaires d'encodage
  private arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  private base64ToArray(base64: string): Uint8Array {
    return new Uint8Array(
      atob(base64)
        .split("")
        .map((c) => c.charCodeAt(0))
    );
  }
}

export const afghStorageService = new AFGHStorageService();
