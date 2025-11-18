/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * Service AFGH File Encryption - KEM/DEM Hybride
 *
 * Architecture Hybride:
 * - KEM (Key Encapsulation Mechanism): AFGH pour chiffrer un secret S
 * - DEM (Data Encapsulation Mechanism): AES-256-GCM pour chiffrer les données
 *
 * Flux de chiffrement:
 * 1. Générer une clé AES K_file aléatoire
 * 2. Générer un secret S dans G2 (AFGH)
 * 3. Chiffrer S avec AFGH niveau 2 → (U, V)
 * 4. Dériver K_sym = KDF(S)
 * 5. Wrapper K_file avec K_sym → wrappedKey
 * 6. Chiffrer les chunks du fichier avec K_file
 *
 * Avantages:
 * - Performance: AES-GCM est accéléré matériellement
 * - Flexibilité: AFGH ne chiffre qu'un petit secret
 * - Sécurité: Combinaison des garanties AFGH + AES
 */

import { afghService } from "./afghService";
import type {
  AFGHKeyPair,
  AFGHPublicKey,
  AFGHFileEnvelope,
  SharedAFGHFileEnvelope,
  EncryptedChunkAFGH,
  ReEncryptionKey,
  Level2Ciphertext,
  Level1Ciphertext,
  G2Element,
} from "../types/afgh";
import { AFGHError, AFGHErrorCode } from "../types/afgh";

/**
 * Service de chiffrement de fichiers avec AFGH
 */
class AFGHFileService {
  // === Configuration ===
  private readonly CHUNK_SIZE = 1024 * 1024; // 1 MB
  // private readonly MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB // unused
  private readonly AES_KEY_LENGTH = 256; // bits
  private readonly AES_IV_LENGTH = 12; // bytes (96 bits pour GCM)
  private readonly PBKDF2_ITERATIONS = 100000;
  private readonly PBKDF2_SALT_LENGTH = 16; // bytes

  /**
   * ========================================
   * 1. CHIFFREMENT DE FICHIER (Propriétaire)
   * ========================================
   */

  /**
   * Chiffre un fichier complet avec AFGH (approche hybride KEM-DEM)
   *
   * @param file - Fichier à chiffrer
   * @param ownerKeyPair - Paire de clés AFGH du propriétaire
   * @param progressCallback - Callback pour suivre la progression
   * @returns Enveloppe de fichier chiffré
   */
  async encryptFile(
    file: File,
    ownerKeyPair: AFGHKeyPair,
    progressCallback?: (progress: number, status: string) => void
  ): Promise<AFGHFileEnvelope> {
    try {
      console.log(
        `[AFGH File] Encrypting file: ${file.name} (${file.size} bytes)`
      );
      progressCallback?.(0, "Starting encryption...");

      // === PHASE 1: Génération des clés ===
      progressCallback?.(5, "Generating encryption keys...");

      // 1.1. Générer une clé AES-256 aléatoire pour le fichier
      const fileKey = await this.generateAESKey();

      // 1.2. Générer un secret S aléatoire dans G2
      const secret_S = afghService.generateRandomG2Element();

      // === PHASE 2: KEM - Encapsuler S avec AFGH ===
      progressCallback?.(10, "Encapsulating secret with AFGH...");

      // 2.1. Chiffrer S avec AFGH niveau 2
      const ownerPublicKey = afghService.extractPublicKey(ownerKeyPair);
      const kemCiphertext: Level2Ciphertext = await afghService.encryptLevel2(
        secret_S,
        ownerPublicKey
      );

      // 2.2. Dériver K_sym depuis S avec PBKDF2
      const salt = crypto.getRandomValues(
        new Uint8Array(this.PBKDF2_SALT_LENGTH)
      );
      const K_sym = await this.deriveKeyFromSecret(secret_S, salt);

      // 2.3. Wrapper K_file avec K_sym
      const fileKeyRaw = await crypto.subtle.exportKey("raw", fileKey);
      const wrapKeyIV = crypto.getRandomValues(
        new Uint8Array(this.AES_IV_LENGTH)
      );

      const wrappedFileKeyBuffer = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: wrapKeyIV,
        },
        K_sym,
        fileKeyRaw as ArrayBuffer
      );

      const wrappedFileKey = this.arrayBufferToBase64(wrappedFileKeyBuffer);
      const wrapKeyIVBase64 = this.uint8ArrayToBase64(wrapKeyIV);

      // === PHASE 3: DEM - Chiffrer les chunks ===
      progressCallback?.(20, "Encrypting file chunks...");

      const chunks = await this.encryptFileChunks(
        file,
        fileKey,
        (chunkProgress) => {
          const totalProgress = 20 + Math.round(chunkProgress * 0.7);
          progressCallback?.(
            totalProgress,
            `Encrypting chunks... ${chunkProgress}%`
          );
        }
      );

      // === PHASE 4: Construction de l'enveloppe ===
      progressCallback?.(95, "Creating file envelope...");

      const envelope: AFGHFileEnvelope = {
        fileId: crypto.randomUUID(),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        kemCiphertext: kemCiphertext,
        wrappedFileKey: wrappedFileKey,
        wrapKeyIV: wrapKeyIVBase64,
        kdfSalt: salt, // Store salt for decryption
        chunks: chunks,
        metadata: {
          ownerId: ownerKeyPair.userId,
          uploadedAt: new Date().toISOString(),
          chunkSize: this.CHUNK_SIZE,
          totalChunks: chunks.length,
          kemAlgorithm: "AFGH-BLS12-381",
          demAlgorithm: "AES-256-GCM",
        },
      };

      progressCallback?.(100, "Encryption complete!");
      console.log(
        `[AFGH File] File encrypted successfully: ${envelope.fileId}`
      );

      return envelope;
    } catch (error) {
      throw new AFGHError(
        `File encryption failed: ${error}`,
        AFGHErrorCode.CURVE_OPERATION_FAILED,
        error
      );
    }
  }

  /**
   * ========================================
   * 2. DÉCHIFFREMENT DE FICHIER (Propriétaire)
   * ========================================
   */

  /**
   * Déchiffre un fichier pour le propriétaire
   *
   * @param envelope - Enveloppe de fichier chiffré
   * @param ownerKeyPair - Paire de clés du propriétaire
   * @param progressCallback - Callback de progression
   * @returns Fichier déchiffré
   */
  async decryptFileOwner(
    envelope: AFGHFileEnvelope,
    ownerKeyPair: AFGHKeyPair,
    progressCallback?: (progress: number, status: string) => void
  ): Promise<{ data: ArrayBuffer; fileName: string; mimeType: string }> {
    try {
      console.log(`[AFGH File] Decrypting file as owner: ${envelope.fileId}`);
      progressCallback?.(0, "Starting decryption...");

      // === PHASE 1: Déchiffrer S avec AFGH ===
      progressCallback?.(10, "Decrypting secret with AFGH...");

      const secret_S = await afghService.decryptLevel2(
        envelope.kemCiphertext,
        ownerKeyPair.secretKey2,
        ownerKeyPair.publicKey1
      );

      // === PHASE 2: Dériver K_sym et unwrap K_file ===
      progressCallback?.(20, "Unwrapping file key...");

      const wrapKeyIV = this.base64ToUint8Array(envelope.wrapKeyIV);
      const salt = envelope.kdfSalt || new Uint8Array(this.PBKDF2_SALT_LENGTH);
      const K_sym = await this.deriveKeyFromSecret(secret_S, salt);

      const wrappedFileKeyBuffer = this.base64ToArrayBuffer(
        envelope.wrappedFileKey
      );
      const fileKeyRaw = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          // @ts-expect-error - Uint8Array type compatibility issue
          iv: new Uint8Array(
            wrapKeyIV.buffer,
            wrapKeyIV.byteOffset,
            wrapKeyIV.byteLength
          ),
        },
        K_sym,
        wrappedFileKeyBuffer
      );

      const fileKey = await crypto.subtle.importKey(
        "raw",
        fileKeyRaw as ArrayBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );

      // === PHASE 3: Déchiffrer les chunks ===
      progressCallback?.(30, "Decrypting file chunks...");

      const fileData = await this.decryptFileChunks(
        envelope.chunks,
        fileKey,
        (chunkProgress) => {
          const totalProgress = 30 + Math.round(chunkProgress * 0.65);
          progressCallback?.(
            totalProgress,
            `Decrypting chunks... ${chunkProgress}%`
          );
        }
      );

      progressCallback?.(100, "Decryption complete!");
      console.log(`[AFGH File] File decrypted successfully`);

      return {
        data: fileData,
        fileName: envelope.fileName,
        mimeType: envelope.mimeType,
      };
    } catch (error) {
      throw new AFGHError(
        `Owner decryption failed: ${error}`,
        AFGHErrorCode.DECRYPTION_FAILED,
        error
      );
    }
  }

  /**
   * ========================================
   * 3. PARTAGE DE FICHIER (Re-chiffrement)
   * ========================================
   */

  /**
   * Crée un partage sécurisé pour un destinataire
   *
   * Cette opération est effectuée par le HSM (ou côté client pour démo)
   *
   * @param envelope - Enveloppe du fichier à partager
   * @param reEncryptionKey - Clé de re-chiffrement rk_{owner→recipient}
   * @param ownerPublicKey - Clé publique du propriétaire
   * @param recipientId - ID du destinataire
   * @param sharePermissions - Permissions accordées
   * @returns Enveloppe partagée pour le destinataire
   */
  async shareFile(
    envelope: AFGHFileEnvelope,
    reEncryptionKey: ReEncryptionKey,
    ownerPublicKey: AFGHPublicKey,
    recipientId: string,
    sharePermissions: "read" | "read-write" = "read"
  ): Promise<SharedAFGHFileEnvelope> {
    try {
      console.log(
        `[AFGH File] Sharing file ${envelope.fileId} with ${recipientId}`
      );

      // === Re-chiffrer le KEM ===
      const reEncryptedKEM: Level1Ciphertext = await afghService.reEncrypt(
        envelope.kemCiphertext,
        reEncryptionKey,
        ownerPublicKey
      );

      // === Construire l'enveloppe partagée ===
      const sharedEnvelope: SharedAFGHFileEnvelope = {
        fileId: envelope.fileId,
        fileName: envelope.fileName,
        fileSize: envelope.fileSize,
        mimeType: envelope.mimeType,
        kemCiphertext: reEncryptedKEM, // Chiffré niveau 1
        wrappedFileKey: envelope.wrappedFileKey, // Reste inchangé
        wrapKeyIV: envelope.wrapKeyIV,
        chunks: envelope.chunks,
        metadata: envelope.metadata,
        recipientId: recipientId,
        shareId: crypto.randomUUID(),
        permissions: sharePermissions,
      };

      console.log(
        `[AFGH File] File shared successfully: ${sharedEnvelope.shareId}`
      );
      return sharedEnvelope;
    } catch (error) {
      throw new AFGHError(
        `File sharing failed: ${error}`,
        AFGHErrorCode.RE_ENCRYPTION_FAILED,
        error
      );
    }
  }

  /**
   * ========================================
   * 4. DÉCHIFFREMENT DE FICHIER PARTAGÉ (Destinataire)
   * ========================================
   */

  /**
   * Déchiffre un fichier partagé pour le destinataire
   *
   * @param sharedEnvelope - Enveloppe partagée
   * @param recipientKeyPair - Paire de clés du destinataire
   * @param progressCallback - Callback de progression
   * @returns Fichier déchiffré
   */
  async decryptSharedFile(
    sharedEnvelope: SharedAFGHFileEnvelope,
    recipientKeyPair: AFGHKeyPair,
    progressCallback?: (progress: number, status: string) => void
  ): Promise<{ data: ArrayBuffer; fileName: string; mimeType: string }> {
    try {
      console.log(
        `[AFGH File] Decrypting shared file as recipient: ${sharedEnvelope.fileId}`
      );
      progressCallback?.(0, "Starting decryption...");

      // === PHASE 1: Déchiffrer S avec AFGH niveau 1 ===
      progressCallback?.(10, "Decrypting secret with AFGH...");

      const secret_S = await afghService.decryptLevel1(
        sharedEnvelope.kemCiphertext,
        recipientKeyPair.secretKey2
      );

      // === PHASE 2: Dériver K_sym et unwrap K_file ===
      progressCallback?.(20, "Unwrapping file key...");

      const wrapKeyIV = this.base64ToUint8Array(sharedEnvelope.wrapKeyIV);
      const salt = sharedEnvelope.kdfSalt || new Uint8Array(this.PBKDF2_SALT_LENGTH);
      const K_sym = await this.deriveKeyFromSecret(secret_S, salt);

      const wrappedFileKeyBuffer = this.base64ToArrayBuffer(
        sharedEnvelope.wrappedFileKey
      );
      const fileKeyRaw = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          // @ts-expect-error - Uint8Array type compatibility issue
          iv: new Uint8Array(
            wrapKeyIV.buffer,
            wrapKeyIV.byteOffset,
            wrapKeyIV.byteLength
          ),
        },
        K_sym,
        wrappedFileKeyBuffer
      );

      const fileKey = await crypto.subtle.importKey(
        "raw",
        fileKeyRaw as ArrayBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );

      // === PHASE 3: Déchiffrer les chunks ===
      progressCallback?.(30, "Decrypting file chunks...");

      const fileData = await this.decryptFileChunks(
        sharedEnvelope.chunks,
        fileKey,
        (chunkProgress) => {
          const totalProgress = 30 + Math.round(chunkProgress * 0.65);
          progressCallback?.(
            totalProgress,
            `Decrypting chunks... ${chunkProgress}%`
          );
        }
      );

      progressCallback?.(100, "Decryption complete!");
      console.log(`[AFGH File] Shared file decrypted successfully`);

      return {
        data: fileData,
        fileName: sharedEnvelope.fileName,
        mimeType: sharedEnvelope.mimeType,
      };
    } catch (error) {
      throw new AFGHError(
        `Shared file decryption failed: ${error}`,
        AFGHErrorCode.DECRYPTION_FAILED,
        error
      );
    }
  }

  /**
   * ========================================
   * 5. UTILITAIRES - CHIFFREMENT DE CHUNKS
   * ========================================
   */

  /**
   * Chiffre les chunks d'un fichier avec AES-GCM
   */
  private async encryptFileChunks(
    file: File,
    fileKey: CryptoKey,
    progressCallback?: (progress: number) => void
  ): Promise<EncryptedChunkAFGH[]> {
    const chunks: EncryptedChunkAFGH[] = [];
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      // Lire le chunk
      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);
      const chunkBuffer = await chunkBlob.arrayBuffer();

      // Hash AVANT chiffrement (intégrité du contenu original)
      const hashBuffer = await crypto.subtle.digest("SHA-256", chunkBuffer);
      const hash = this.arrayBufferToBase64(hashBuffer);

      // Chiffrer le chunk
      const iv = crypto.getRandomValues(new Uint8Array(this.AES_IV_LENGTH));
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        fileKey,
        chunkBuffer
      );

      chunks.push({
        chunkIndex: i,
        encryptedData: this.arrayBufferToBase64(encryptedBuffer),
        iv: this.uint8ArrayToBase64(iv),
        hash: hash,
        originalSize: chunkBuffer.byteLength,
      });

      // Progression
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      progressCallback?.(progress);
    }

    return chunks;
  }

  /**
   * Déchiffre les chunks d'un fichier
   */
  private async decryptFileChunks(
    chunks: EncryptedChunkAFGH[],
    fileKey: CryptoKey,
    progressCallback?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    const decryptedChunks: ArrayBuffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Déchiffrer
      const encryptedBuffer = this.base64ToArrayBuffer(chunk.encryptedData);
      const iv = this.base64ToUint8Array(chunk.iv);

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          // @ts-expect-error - Uint8Array type compatibility issue
          iv: new Uint8Array(iv.buffer, iv.byteOffset, iv.byteLength),
        },
        fileKey,
        encryptedBuffer
      );

      // Vérifier l'intégrité (hash du contenu original)
      const hashBuffer = await crypto.subtle.digest("SHA-256", decryptedBuffer);
      const hash = this.arrayBufferToBase64(hashBuffer);

      if (hash !== chunk.hash) {
        throw new AFGHError(
          `Chunk ${i} integrity check failed`,
          AFGHErrorCode.CHUNK_INTEGRITY_FAILED
        );
      }

      decryptedChunks.push(decryptedBuffer);

      // Progression
      const progress = Math.round(((i + 1) / chunks.length) * 100);
      progressCallback?.(progress);
    }

    // Concaténer tous les chunks
    return this.concatenateArrayBuffers(decryptedChunks);
  }

  /**
   * ========================================
   * 6. UTILITAIRES - CRYPTOGRAPHIE
   * ========================================
   */

  /**
   * Génère une clé AES-256 aléatoire
   */
  private async generateAESKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: this.AES_KEY_LENGTH,
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Dérive une clé symétrique depuis le secret S avec PBKDF2
   */
  private async deriveKeyFromSecret(
    secret_S: G2Element,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    // Importer le secret comme matériel de clé
    const secretKeyMaterial = await crypto.subtle.importKey(
      "raw",
      // @ts-ignore - Uint8Array type compatibility issue
      new Uint8Array(secret_S.buffer, secret_S.byteOffset, secret_S.byteLength),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    // Dériver la clé AES
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        // @ts-ignore - Uint8Array type compatibility issue
        salt: new Uint8Array(salt.buffer, salt.byteOffset, salt.byteLength),
        iterations: this.PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      secretKeyMaterial,
      {
        name: "AES-GCM",
        length: this.AES_KEY_LENGTH,
      },
      false, // non-extractable
      ["encrypt", "decrypt"]
    );

    return derivedKey;
  }

  /**
   * ========================================
   * 7. UTILITAIRES - ENCODAGE
   * ========================================
   */

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
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

  private uint8ArrayToBase64(array: Uint8Array): string {
    // Convert directly without using buffer.slice
    let binary = "";
    for (let i = 0; i < array.length; i++) {
      binary += String.fromCharCode(array[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    return new Uint8Array(this.base64ToArrayBuffer(base64));
  }

  private concatenateArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of buffers) {
      result.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    return result.buffer;
  }

  /**
   * ========================================
   * 8. UTILITAIRES - SERIALIZATION
   * ========================================
   */

  /**
   * Sérialise une enveloppe AFGH pour le stockage
   * Convertit tous les Uint8Array en base64
   */
  serializeEnvelope(envelope: AFGHFileEnvelope): string {
    // Explicitly construct the serialized object to avoid issues with spread operator
    const serialized = {
      fileId: envelope.fileId,
      fileName: envelope.fileName,
      fileSize: envelope.fileSize,
      mimeType: envelope.mimeType,
      kemCiphertext: {
        U: this.uint8ArrayToBase64(envelope.kemCiphertext.U),
        V: this.uint8ArrayToBase64(envelope.kemCiphertext.V),
        level: envelope.kemCiphertext.level,
      },
      wrappedFileKey: envelope.wrappedFileKey,
      wrapKeyIV: envelope.wrapKeyIV,
      kdfSalt: envelope.kdfSalt
        ? this.uint8ArrayToBase64(envelope.kdfSalt)
        : undefined,
      chunks: envelope.chunks,
      metadata: envelope.metadata,
    };

    return JSON.stringify(serialized);
  }

  /**
   * Désérialise une enveloppe AFGH depuis le stockage
   * Convertit tous les base64 en Uint8Array
   */
  deserializeEnvelope(serialized: string): AFGHFileEnvelope {
    const parsed = JSON.parse(serialized);

    console.log('[AFGH File] Deserializing envelope, kemCiphertext.U type:', typeof parsed.kemCiphertext.U);
    console.log('[AFGH File] kemCiphertext.U value (first 20 chars):', parsed.kemCiphertext.U?.substring?.(0, 20));

    const U = this.base64ToUint8Array(parsed.kemCiphertext.U);
    const V = this.base64ToUint8Array(parsed.kemCiphertext.V);

    console.log('[AFGH File] Deserialized U:', U.length, 'bytes, is Uint8Array:', U instanceof Uint8Array);
    console.log('[AFGH File] Deserialized V:', V.length, 'bytes, is Uint8Array:', V instanceof Uint8Array);

    return {
      ...parsed,
      kemCiphertext: {
        U,
        V,
        level: parsed.kemCiphertext.level,
      },
      kdfSalt: parsed.kdfSalt
        ? this.base64ToUint8Array(parsed.kdfSalt)
        : undefined,
    };
  }
}

// Export singleton
export const afghFileService = new AFGHFileService();
