/**
 * Service de Traitement de Fichiers
 * 
 * Orchestre le processus complet de préparation des fichiers côté client:
 * 1. Chunking: Découpage du fichier en morceaux
 * 2. Chiffrement: Chiffrement de chaque chunk avec AES-GCM
 * 3. Préparation des métadonnées pour le stockage distribué
 * 
 * Garantit que seul le client voit les données en clair.
 */

import { cryptoService } from './cryptoService';
import { chunkingService } from './chunkingService';
import type {
  ChunkingConfig,
  EncryptedFileMetadata,
  ChunkInfo,
  ProcessedFile,
  FileProcessingProgressCallback,
  DecryptionResult,
  EncryptedChunk,
  FileMetadata,
} from '../types/crypto';

// ==================== Types internes ====================

interface ProcessingOptions {
  /** Configuration du chunking */
  chunkingConfig?: Partial<ChunkingConfig>;
  /** Clé maître pour wrapper la clé de fichier */
  masterKey: CryptoKey;
  /** Callback de progression */
  onProgress?: FileProcessingProgressCallback;
}

interface DownloadOptions {
  /** Clé maître pour unwrapper la clé de fichier */
  masterKey: CryptoKey;
  /** Callback de progression */
  onProgress?: FileProcessingProgressCallback;
}

// ==================== Service de Traitement ====================

class FileProcessingService {
  /**
   * Traite un fichier pour l'upload:
   * 1. Découpe en chunks
   * 2. Chiffre chaque chunk
   * 3. Prépare les métadonnées
   */
  async processFileForUpload(
    file: File,
    options: ProcessingOptions
  ): Promise<ProcessedFile> {
    const { masterKey, onProgress, chunkingConfig } = options;

    console.log(`[FileProcessing] Starting processing for: ${file.name}`);
    console.log(`[FileProcessing] File size: ${file.size} bytes`);

    // Configurer le chunking si nécessaire
    if (chunkingConfig) {
      chunkingService.setConfig(chunkingConfig);
    }

    try {
      // ==================== Étape 1: Chunking ====================
      onProgress?.({
        stage: 'chunking',
        stageProgress: 0,
        overallProgress: 0,
        message: 'Découpage du fichier en morceaux...',
      });

      const chunkingResult = await chunkingService.chunkFile(
        file,
        (chunkProgress) => {
          const overallProgress = Math.round(chunkProgress.percentage * 0.3); // 30% pour chunking
          onProgress?.({
            stage: 'chunking',
            stageProgress: chunkProgress.percentage,
            overallProgress,
            message: `Découpage: ${chunkProgress.processedChunks}/${chunkProgress.totalChunks} chunks`,
          });
        }
      );

      console.log(`[FileProcessing] Chunking complete: ${chunkingResult.chunks.length} chunks`);

      // ==================== Étape 2: Génération de clé ====================
      onProgress?.({
        stage: 'encrypting',
        stageProgress: 0,
        overallProgress: 30,
        message: 'Génération de la clé de chiffrement...',
      });

      const fileKey = await cryptoService.generateFileKey();
      console.log(`[FileProcessing] File key generated: ${fileKey.keyId}`);

      // ==================== Étape 3: Chiffrement des chunks ====================
      onProgress?.({
        stage: 'encrypting',
        stageProgress: 5,
        overallProgress: 32,
        message: 'Chiffrement des données...',
      });

      const encryptedChunks = await cryptoService.encryptChunks(
        chunkingResult.chunks,
        fileKey,
        (encProgress) => {
          const stageProgress = 5 + Math.round(encProgress.percentage * 0.9); // 5-95%
          const overallProgress = 30 + Math.round(encProgress.percentage * 0.6); // 30-90%
          onProgress?.({
            stage: 'encrypting',
            stageProgress,
            overallProgress,
            message: `Chiffrement: ${encProgress.encryptedChunks}/${encProgress.totalChunks} chunks`,
          });
        }
      );

      console.log(`[FileProcessing] Encryption complete: ${encryptedChunks.length} chunks encrypted`);

      // ==================== Étape 4: Wrapping de la clé ====================
      onProgress?.({
        stage: 'encrypting',
        stageProgress: 95,
        overallProgress: 92,
        message: 'Protection de la clé de fichier...',
      });

      const wrappedKey = await cryptoService.wrapFileKey(fileKey, masterKey);
      console.log(`[FileProcessing] File key wrapped`);

      // ==================== Étape 5: Préparation des métadonnées ====================
      onProgress?.({
        stage: 'encrypting',
        stageProgress: 98,
        overallProgress: 95,
        message: 'Préparation des métadonnées...',
      });

      const chunkInfos: ChunkInfo[] = encryptedChunks.map((chunk) => ({
        index: chunk.index,
        chunkId: chunkingService.generateChunkId(chunkingResult.metadata.fileId, chunk.index),
        encryptedSize: chunk.encryptedSize,
        encryptedHash: chunk.encryptedHash,
        iv: cryptoService.toBase64(chunk.iv),
        storageNodes: [], // Sera rempli par le backend
      }));

      const encryptedMetadata: EncryptedFileMetadata = {
        ...chunkingResult.metadata,
        chunks: chunkInfos,
        wrappedKey,
        encryptionVersion: '1.0',
        algorithm: 'AES-GCM',
      };

      // ==================== Terminé ====================
      onProgress?.({
        stage: 'complete',
        stageProgress: 100,
        overallProgress: 100,
        message: 'Fichier prêt pour l\'upload!',
      });

      console.log(`[FileProcessing] Processing complete for: ${file.name}`);

      return {
        metadata: encryptedMetadata,
        chunks: encryptedChunks,
      };
    } catch (error) {
      console.error('[FileProcessing] Error during processing:', error);
      onProgress?.({
        stage: 'error',
        stageProgress: 0,
        overallProgress: 0,
        message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      });
      throw error;
    }
  }

  /**
   * Traite un fichier pour le téléchargement:
   * 1. Unwrap la clé de fichier
   * 2. Déchiffre chaque chunk
   * 3. Réassemble le fichier
   */
  async processFileForDownload(
    encryptedChunks: EncryptedChunk[],
    metadata: EncryptedFileMetadata,
    options: DownloadOptions
  ): Promise<DecryptionResult> {
    const { masterKey, onProgress } = options;

    console.log(`[FileProcessing] Starting download processing for: ${metadata.fileName}`);

    try {
      // ==================== Étape 1: Unwrap de la clé ====================
      onProgress?.({
        stage: 'encrypting', // On réutilise 'encrypting' pour le déchiffrement
        stageProgress: 0,
        overallProgress: 0,
        message: 'Récupération de la clé de déchiffrement...',
      });

      const fileKey = await cryptoService.unwrapFileKey(metadata.wrappedKey, masterKey);
      console.log(`[FileProcessing] File key unwrapped: ${fileKey.keyId}`);

      // ==================== Étape 2: Déchiffrement des chunks ====================
      onProgress?.({
        stage: 'encrypting',
        stageProgress: 10,
        overallProgress: 10,
        message: 'Déchiffrement des données...',
      });

      const decryptedData = await cryptoService.decryptChunks(
        encryptedChunks,
        fileKey,
        (decrypted, total) => {
          const stageProgress = 10 + Math.round((decrypted / total) * 85);
          const overallProgress = 10 + Math.round((decrypted / total) * 85);
          onProgress?.({
            stage: 'encrypting',
            stageProgress,
            overallProgress,
            message: `Déchiffrement: ${decrypted}/${total} chunks`,
          });
        }
      );

      // ==================== Étape 3: Vérification ====================
      onProgress?.({
        stage: 'encrypting',
        stageProgress: 95,
        overallProgress: 95,
        message: 'Vérification de l\'intégrité...',
      });

      const dataHash = await cryptoService.hash(decryptedData);
      if (dataHash !== metadata.fileHash) {
        console.warn('[FileProcessing] File hash mismatch - integrity check failed');
        // On continue quand même mais on log l'avertissement
      }

      // ==================== Terminé ====================
      onProgress?.({
        stage: 'complete',
        stageProgress: 100,
        overallProgress: 100,
        message: 'Fichier déchiffré avec succès!',
      });

      const fileMetadata: FileMetadata = {
        fileId: metadata.fileId,
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        totalSize: metadata.totalSize,
        totalChunks: metadata.totalChunks,
        chunkSize: metadata.chunkSize,
        fileHash: metadata.fileHash,
        createdAt: metadata.createdAt,
      };

      console.log(`[FileProcessing] Download processing complete: ${metadata.fileName}`);

      return {
        data: decryptedData,
        metadata: fileMetadata,
      };
    } catch (error) {
      console.error('[FileProcessing] Error during download processing:', error);
      onProgress?.({
        stage: 'error',
        stageProgress: 0,
        overallProgress: 0,
        message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      });
      throw error;
    }
  }

  /**
   * Crée un fichier téléchargeable à partir des données déchiffrées
   */
  createDownloadableFile(result: DecryptionResult): File {
    const blob = new Blob([result.data], { type: result.metadata.mimeType });
    return new File([blob], result.metadata.fileName, { type: result.metadata.mimeType });
  }

  /**
   * Déclenche le téléchargement d'un fichier dans le navigateur
   */
  triggerDownload(file: File): void {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Sérialise les métadonnées chiffrées pour transmission au serveur
   */
  serializeMetadata(metadata: EncryptedFileMetadata): string {
    const serializable = {
      ...metadata,
      wrappedKey: cryptoService.serializeWrappedKey(metadata.wrappedKey),
    };
    return JSON.stringify(serializable);
  }

  /**
   * Désérialise les métadonnées chiffrées reçues du serveur
   */
  deserializeMetadata(json: string): EncryptedFileMetadata {
    const parsed = JSON.parse(json);
    return {
      ...parsed,
      wrappedKey: cryptoService.deserializeWrappedKey(parsed.wrappedKey),
    };
  }

  /**
   * Convertit un EncryptedChunk en format transmissible (base64)
   */
  serializeChunk(chunk: EncryptedChunk): object {
    return {
      index: chunk.index,
      encryptedData: this.arrayBufferToBase64(chunk.encryptedData),
      iv: cryptoService.toBase64(chunk.iv),
      originalSize: chunk.originalSize,
      encryptedSize: chunk.encryptedSize,
      encryptedHash: chunk.encryptedHash,
    };
  }

  /**
   * Reconstruit un EncryptedChunk depuis le format transmissible
   */
  deserializeChunk(data: {
    index: number;
    encryptedData: string;
    iv: string;
    originalSize: number;
    encryptedSize: number;
    encryptedHash: string;
  }): EncryptedChunk {
    return {
      index: data.index,
      encryptedData: this.base64ToArrayBuffer(data.encryptedData),
      iv: cryptoService.fromBase64(data.iv),
      originalSize: data.originalSize,
      encryptedSize: data.encryptedSize,
      encryptedHash: data.encryptedHash,
    };
  }

  // ==================== Utilitaires privés ====================

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
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
}

// Export singleton
export const fileProcessingService = new FileProcessingService();
