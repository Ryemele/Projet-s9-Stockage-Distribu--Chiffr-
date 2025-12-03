/**
 * Service de Chunking Côté Client
 * 
 * Découpe les fichiers en morceaux (chunks) pour:
 * - Permettre un upload progressif
 * - Faciliter la distribution sur plusieurs nœuds de stockage
 * - Permettre la reprise en cas d'échec
 * - Optimiser la mémoire pour les gros fichiers
 */

import { cryptoService } from './cryptoService';
import type {
  Chunk,
  ChunkingConfig,
  ChunkingProgressCallback,
  ChunkingResult,
  FileMetadata,
} from '../types/crypto';

// ==================== Utilitaires ====================

/**
 * Génère un identifiant unique pour un fichier
 */
function generateFileId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `file_${timestamp}_${randomPart}`;
}

/**
 * Génère un identifiant unique pour un chunk
 */
function generateChunkId(fileId: string, chunkIndex: number): string {
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${fileId}_chunk_${chunkIndex}_${randomPart}`;
}

// ==================== Service de Chunking ====================

class ChunkingService {
  private config: ChunkingConfig = {
    chunkSize: 1024 * 1024, // 1 Mo par défaut
    maxParallelChunks: 3,
  };

  /**
   * Configure le service de chunking
   */
  setConfig(config: Partial<ChunkingConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ChunkingService] Config updated:', this.config);
  }

  /**
   * Obtient la configuration actuelle
   */
  getConfig(): ChunkingConfig {
    return { ...this.config };
  }

  /**
   * Calcule le nombre de chunks pour un fichier
   */
  calculateChunkCount(fileSize: number): number {
    return Math.ceil(fileSize / this.config.chunkSize);
  }

  /**
   * Découpe un fichier en chunks
   */
  async chunkFile(
    file: File,
    onProgress?: ChunkingProgressCallback
  ): Promise<ChunkingResult> {
    console.log(`[ChunkingService] Starting chunking for: ${file.name}`);
    console.log(`[ChunkingService] File size: ${file.size} bytes`);
    console.log(`[ChunkingService] Chunk size: ${this.config.chunkSize} bytes`);

    const totalChunks = this.calculateChunkCount(file.size);
    console.log(`[ChunkingService] Total chunks: ${totalChunks}`);

    const fileId = generateFileId();
    const chunks: Chunk[] = [];

    onProgress?.({
      phase: 'chunking',
      processedChunks: 0,
      totalChunks,
      percentage: 0,
    });

    // Calculer d'abord le hash du fichier complet
    onProgress?.({
      phase: 'reading',
      processedChunks: 0,
      totalChunks,
      percentage: 0,
    });

    const fileBuffer = await this.fileToArrayBuffer(file);
    const fileHash = await cryptoService.hash(fileBuffer);

    onProgress?.({
      phase: 'chunking',
      processedChunks: 0,
      totalChunks,
      percentage: 5,
    });

    // Découper le fichier en chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, file.size);
      
      // Extraire la portion du buffer
      const chunkData = fileBuffer.slice(start, end);
      
      // Calculer le hash du chunk
      const chunkHash = await cryptoService.hash(chunkData);

      const chunk: Chunk = {
        index: i,
        data: chunkData,
        size: chunkData.byteLength,
        hash: chunkHash,
      };

      chunks.push(chunk);

      // Reporter la progression
      const percentage = Math.round(5 + ((i + 1) / totalChunks) * 95);
      onProgress?.({
        phase: 'chunking',
        processedChunks: i + 1,
        totalChunks,
        percentage,
      });
    }

    // Créer les métadonnées
    const metadata: FileMetadata = {
      fileId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      totalSize: file.size,
      totalChunks,
      chunkSize: this.config.chunkSize,
      fileHash,
      createdAt: new Date().toISOString(),
    };

    console.log(`[ChunkingService] Chunking complete. ${totalChunks} chunks created.`);

    return {
      chunks,
      metadata,
    };
  }

  /**
   * Découpe un fichier en utilisant un stream pour les très gros fichiers
   * Plus efficace en mémoire car ne charge pas tout le fichier d'un coup
   */
  async chunkFileStream(
    file: File,
    onProgress?: ChunkingProgressCallback,
    onChunk?: (chunk: Chunk) => Promise<void>
  ): Promise<FileMetadata> {
    console.log(`[ChunkingService] Starting stream chunking for: ${file.name}`);

    const totalChunks = this.calculateChunkCount(file.size);
    const fileId = generateFileId();

    // Pour le hash du fichier complet, on utilise un hash incrémental
    // Note: Web Crypto API ne supporte pas le hashing incrémental,
    // donc on calcule les hashes des chunks individuellement
    const chunkHashes: string[] = [];

    onProgress?.({
      phase: 'chunking',
      processedChunks: 0,
      totalChunks,
      percentage: 0,
    });

    // Traiter chunk par chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, file.size);
      
      // Lire uniquement cette portion du fichier
      const blob = file.slice(start, end);
      const chunkData = await blob.arrayBuffer();
      
      // Calculer le hash du chunk
      const chunkHash = await cryptoService.hash(chunkData);
      chunkHashes.push(chunkHash);

      const chunk: Chunk = {
        index: i,
        data: chunkData,
        size: chunkData.byteLength,
        hash: chunkHash,
      };

      // Permettre au callback de traiter le chunk immédiatement
      // (ex: chiffrer et uploader)
      if (onChunk) {
        await onChunk(chunk);
      }

      const percentage = Math.round(((i + 1) / totalChunks) * 100);
      onProgress?.({
        phase: 'chunking',
        processedChunks: i + 1,
        totalChunks,
        percentage,
      });
    }

    // Calculer un hash global basé sur les hashes des chunks
    // (approximation car on ne peut pas hasher incrémentalement avec Web Crypto)
    const encoder = new TextEncoder();
    const combinedHashes = encoder.encode(chunkHashes.join(''));
    const fileHash = await cryptoService.hash(combinedHashes.buffer);

    const metadata: FileMetadata = {
      fileId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      totalSize: file.size,
      totalChunks,
      chunkSize: this.config.chunkSize,
      fileHash,
      createdAt: new Date().toISOString(),
    };

    console.log(`[ChunkingService] Stream chunking complete. ${totalChunks} chunks processed.`);

    return metadata;
  }

  /**
   * Réassemble les chunks en un seul fichier
   */
  reassembleChunks(chunks: Chunk[], metadata: FileMetadata): ArrayBuffer {
    console.log(`[ChunkingService] Reassembling ${chunks.length} chunks...`);

    // Trier par index
    const sorted = [...chunks].sort((a, b) => a.index - b.index);

    // Vérifier qu'on a tous les chunks
    if (sorted.length !== metadata.totalChunks) {
      throw new Error(
        `Missing chunks: got ${sorted.length}, expected ${metadata.totalChunks}`
      );
    }

    // Vérifier les indices
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].index !== i) {
        throw new Error(`Invalid chunk index at position ${i}`);
      }
    }

    // Calculer la taille totale
    const totalSize = sorted.reduce((sum, chunk) => sum + chunk.size, 0);
    
    if (totalSize !== metadata.totalSize) {
      console.warn(
        `[ChunkingService] Size mismatch: got ${totalSize}, expected ${metadata.totalSize}`
      );
    }

    // Combiner les chunks
    const combined = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of sorted) {
      combined.set(new Uint8Array(chunk.data), offset);
      offset += chunk.size;
    }

    console.log(`[ChunkingService] Reassembly complete: ${totalSize} bytes`);
    return combined.buffer;
  }

  /**
   * Crée un objet File à partir des chunks réassemblés
   */
  chunksToFile(chunks: Chunk[], metadata: FileMetadata): File {
    const buffer = this.reassembleChunks(chunks, metadata);
    const blob = new Blob([buffer], { type: metadata.mimeType });
    return new File([blob], metadata.fileName, { type: metadata.mimeType });
  }

  /**
   * Génère l'ID d'un chunk
   */
  generateChunkId(fileId: string, chunkIndex: number): string {
    return generateChunkId(fileId, chunkIndex);
  }

  // ==================== Utilitaires privés ====================

  private async fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
}

// Export singleton
export const chunkingService = new ChunkingService();
