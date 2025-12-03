/**
 * Service de Chiffrement Côté Client
 * 
 * Utilise la Web Crypto API pour un chiffrement AES-GCM sécurisé.
 * 
 * Algorithme: AES-GCM (256 bits)
 */

import type {
  FileEncryptionKey,
  WrappedFileKey,
  EncryptedChunk,
  Chunk,
  EncryptionProgressCallback,
} from '../types/crypto';

// ==================== Constantes ====================

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // octets (96 bits recommandé pour AES-GCM)
const TAG_LENGTH = 128; // bits

// ==================== Utilitaires ====================

/**
 * Convertit un Uint8Array en ArrayBuffer propre (évite les problèmes de SharedArrayBuffer)
 */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  // Créer un nouvel ArrayBuffer avec une copie des données
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  return buffer;
}

/**
 * Génère un identifiant unique
 */
function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Génère un vecteur d'initialisation aléatoire
 */
function generateIV(): Uint8Array {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Convertit un ArrayBuffer en chaîne hexadécimale
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convertit un Uint8Array en base64
 */
function uint8ArrayToBase64(array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

/**
 * Convertit une chaîne base64 en Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Calcule le hash SHA-256 d'un ArrayBuffer
 */
async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(hashBuffer);
}

// ==================== Service de Chiffrement ====================

class CryptoService {
  /**
   * Génère une nouvelle clé de chiffrement pour un fichier
   */
  async generateFileKey(): Promise<FileEncryptionKey> {
    console.log('[CryptoService] Generating new file encryption key...');
    
    // Générer une clé AES-GCM
    const key = await crypto.subtle.generateKey(
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      true, // extractable pour export/wrap
      ['encrypt', 'decrypt']
    );

    // Exporter la clé en format raw
    const rawKeyBuffer = await crypto.subtle.exportKey('raw', key);
    const rawKey = new Uint8Array(rawKeyBuffer);

    const keyId = generateId();
    
    console.log('[CryptoService] File key generated:', keyId);

    return {
      key,
      rawKey,
      keyId,
    };
  }

  /**
   * Importe une clé depuis son format raw
   */
  async importFileKey(rawKey: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(rawKey),
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Chiffre (wrap) la clé de fichier avec la clé maître de l'utilisateur
   * Permet de stocker la clé de fichier de manière sécurisée
   */
  async wrapFileKey(
    fileKey: FileEncryptionKey,
    masterKey: CryptoKey
  ): Promise<WrappedFileKey> {
    console.log('[CryptoService] Wrapping file key with master key...');
    
    const iv = generateIV();
    
    // Chiffrer la clé raw avec la clé maître
    const wrappedKey = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: toArrayBuffer(iv),
        tagLength: TAG_LENGTH,
      },
      masterKey,
      toArrayBuffer(fileKey.rawKey)
    );

    return {
      wrappedKey: wrappedKey,
      iv,
      keyId: fileKey.keyId,
    };
  }

  /**
   * Déchiffre (unwrap) la clé de fichier avec la clé maître
   */
  async unwrapFileKey(
    wrappedKey: WrappedFileKey,
    masterKey: CryptoKey
  ): Promise<FileEncryptionKey> {
    console.log('[CryptoService] Unwrapping file key...');
    
    // Déchiffrer la clé wrappée
    const rawKeyBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: toArrayBuffer(wrappedKey.iv),
        tagLength: TAG_LENGTH,
      },
      masterKey,
      wrappedKey.wrappedKey
    );

    const rawKey = new Uint8Array(rawKeyBuffer);
    
    // Reconstruire la CryptoKey
    const key = await this.importFileKey(rawKey);

    return {
      key,
      rawKey,
      keyId: wrappedKey.keyId,
    };
  }

  /**
   * Chiffre un seul chunk
   */
  async encryptChunk(
    chunk: Chunk,
    fileKey: FileEncryptionKey
  ): Promise<EncryptedChunk> {
    // Générer un IV unique pour ce chunk
    const iv = generateIV();

    // Chiffrer les données
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: toArrayBuffer(iv),
        tagLength: TAG_LENGTH,
      },
      fileKey.key,
      chunk.data
    );

    // Calculer le hash des données chiffrées
    const encryptedHash = await sha256(encryptedData);

    return {
      index: chunk.index,
      encryptedData,
      iv,
      originalSize: chunk.size,
      encryptedSize: encryptedData.byteLength,
      encryptedHash,
    };
  }

  /**
   * Chiffre plusieurs chunks en parallèle
   */
  async encryptChunks(
    chunks: Chunk[],
    fileKey: FileEncryptionKey,
    onProgress?: EncryptionProgressCallback,
    maxParallel: number = 3
  ): Promise<EncryptedChunk[]> {
    console.log(`[CryptoService] Encrypting ${chunks.length} chunks...`);
    
    const results: EncryptedChunk[] = new Array(chunks.length);
    let completedCount = 0;

    onProgress?.({
      phase: 'encrypting',
      encryptedChunks: 0,
      totalChunks: chunks.length,
      percentage: 0,
    });

    // Traiter les chunks par lots
    for (let i = 0; i < chunks.length; i += maxParallel) {
      const batch = chunks.slice(i, Math.min(i + maxParallel, chunks.length));
      
      const batchResults = await Promise.all(
        batch.map(chunk => this.encryptChunk(chunk, fileKey))
      );

      // Stocker les résultats aux bons indices
      batchResults.forEach((result, batchIndex) => {
        results[i + batchIndex] = result;
      });

      completedCount += batch.length;
      
      onProgress?.({
        phase: 'encrypting',
        encryptedChunks: completedCount,
        totalChunks: chunks.length,
        percentage: Math.round((completedCount / chunks.length) * 100),
      });
    }

    console.log(`[CryptoService] All ${chunks.length} chunks encrypted`);
    return results;
  }

  /**
   * Déchiffre un seul chunk
   */
  async decryptChunk(
    encryptedChunk: EncryptedChunk,
    fileKey: FileEncryptionKey
  ): Promise<Chunk> {
    // Déchiffrer les données
    const data = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: toArrayBuffer(encryptedChunk.iv),
        tagLength: TAG_LENGTH,
      },
      fileKey.key,
      encryptedChunk.encryptedData
    );

    // Calculer le hash pour vérification
    const hash = await sha256(data);

    return {
      index: encryptedChunk.index,
      data,
      size: data.byteLength,
      hash,
    };
  }

  /**
   * Déchiffre plusieurs chunks et les réassemble
   */
  async decryptChunks(
    encryptedChunks: EncryptedChunk[],
    fileKey: FileEncryptionKey,
    onProgress?: (decrypted: number, total: number) => void
  ): Promise<ArrayBuffer> {
    console.log(`[CryptoService] Decrypting ${encryptedChunks.length} chunks...`);
    
    // Trier par index
    const sorted = [...encryptedChunks].sort((a, b) => a.index - b.index);
    
    // Déchiffrer chaque chunk
    const decryptedChunks: ArrayBuffer[] = [];
    
    for (let i = 0; i < sorted.length; i++) {
      const decrypted = await this.decryptChunk(sorted[i], fileKey);
      decryptedChunks.push(decrypted.data);
      onProgress?.(i + 1, sorted.length);
    }

    // Combiner tous les chunks
    const totalSize = decryptedChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(totalSize);
    
    let offset = 0;
    for (const chunk of decryptedChunks) {
      combined.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    console.log(`[CryptoService] File decrypted: ${totalSize} bytes`);
    return combined.buffer;
  }

  /**
   * Dérive une clé maître à partir du mot de passe de l'utilisateur
   * Utilise PBKDF2 avec un sel aléatoire
   */
  async deriveMasterKey(
    password: string,
    salt?: Uint8Array
  ): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    console.log('[CryptoService] Deriving master key from password...');
    
    // Générer ou utiliser le sel fourni
    const keySalt = salt || crypto.getRandomValues(new Uint8Array(32));
    
    // Encoder le mot de passe
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Importer le mot de passe comme clé
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    // Dériver la clé maître
    const masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: toArrayBuffer(keySalt),
        iterations: 100000, // Nombre d'itérations élevé pour la sécurité
        hash: 'SHA-256',
      },
      baseKey,
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    console.log('[CryptoService] Master key derived successfully');
    
    return {
      key: masterKey,
      salt: keySalt,
    };
  }

  // ==================== Utilitaires publics ====================

  /**
   * Calcule le hash SHA-256 d'un ArrayBuffer
   */
  async hash(data: ArrayBuffer): Promise<string> {
    return sha256(data);
  }

  /**
   * Convertit un Uint8Array en base64
   */
  toBase64(data: Uint8Array): string {
    return uint8ArrayToBase64(data);
  }

  /**
   * Convertit une chaîne base64 en Uint8Array
   */
  fromBase64(base64: string): Uint8Array {
    return base64ToUint8Array(base64);
  }

  /**
   * Sérialise une WrappedFileKey pour stockage
   */
  serializeWrappedKey(wrapped: WrappedFileKey): string {
    return JSON.stringify({
      wrappedKey: uint8ArrayToBase64(new Uint8Array(wrapped.wrappedKey)),
      iv: uint8ArrayToBase64(wrapped.iv),
      keyId: wrapped.keyId,
    });
  }

  /**
   * Désérialise une WrappedFileKey
   */
  deserializeWrappedKey(serialized: string): WrappedFileKey {
    const parsed = JSON.parse(serialized);
    const wrappedKeyArray = base64ToUint8Array(parsed.wrappedKey);
    const ivArray = base64ToUint8Array(parsed.iv);
    return {
      wrappedKey: toArrayBuffer(wrappedKeyArray),
      iv: ivArray,
      keyId: parsed.keyId,
    };
  }
}

// Export singleton
export const cryptoService = new CryptoService();
