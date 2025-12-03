/**
 * Types pour le chiffrement et le chunking côté client
 * 
 * Architecture:
 * 1. Le fichier est découpé en chunks
 * 2. Chaque chunk est chiffré avec AES-GCM
 * 3. Une clé de fichier unique est générée pour chaque fichier
 * 4. Les métadonnées permettent de reconstituer le fichier
 */

// ==================== Configuration ====================

export interface ChunkingConfig {
  /** Taille d'un chunk en octets (par défaut 1 Mo) */
  chunkSize: number;
  /** Nombre maximum de chunks en parallèle */
  maxParallelChunks: number;
}

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  chunkSize: 1024 * 1024, // 1 Mo
  maxParallelChunks: 3,
};

// ==================== Chunks ====================

export interface Chunk {
  /** Index du chunk dans le fichier (0-based) */
  index: number;
  /** Données brutes du chunk */
  data: ArrayBuffer;
  /** Taille en octets */
  size: number;
  /** Hash SHA-256 du chunk en clair (pour vérification) */
  hash: string;
}

export interface EncryptedChunk {
  /** Index du chunk dans le fichier */
  index: number;
  /** Données chiffrées (AES-GCM) */
  encryptedData: ArrayBuffer;
  /** Vecteur d'initialisation unique pour ce chunk */
  iv: Uint8Array;
  /** Taille du chunk en clair */
  originalSize: number;
  /** Taille du chunk chiffré */
  encryptedSize: number;
  /** Hash SHA-256 des données chiffrées */
  encryptedHash: string;
}

// ==================== Clés de chiffrement ====================

export interface FileEncryptionKey {
  /** Clé AES-GCM pour chiffrer les chunks */
  key: CryptoKey;
  /** Clé exportée en format raw (pour stockage/partage) */
  rawKey: Uint8Array;
  /** Identifiant unique de la clé */
  keyId: string;
}

export interface WrappedFileKey {
  /** Clé de fichier chiffrée avec la clé maître de l'utilisateur */
  wrappedKey: ArrayBuffer;
  /** IV utilisé pour wrapper la clé */
  iv: Uint8Array;
  /** ID de la clé */
  keyId: string;
}

// ==================== Métadonnées de fichier ====================

export interface FileMetadata {
  /** ID unique du fichier */
  fileId: string;
  /** Nom original du fichier */
  fileName: string;
  /** Type MIME */
  mimeType: string;
  /** Taille totale du fichier en clair */
  totalSize: number;
  /** Nombre total de chunks */
  totalChunks: number;
  /** Taille d'un chunk (sauf le dernier potentiellement) */
  chunkSize: number;
  /** Hash SHA-256 du fichier complet en clair */
  fileHash: string;
  /** Date de création */
  createdAt: string;
}

export interface EncryptedFileMetadata extends FileMetadata {
  /** Informations sur chaque chunk chiffré */
  chunks: ChunkInfo[];
  /** Clé de fichier wrappée */
  wrappedKey: WrappedFileKey;
  /** Version du schéma de chiffrement */
  encryptionVersion: string;
  /** Algorithme utilisé */
  algorithm: 'AES-GCM';
}

export interface ChunkInfo {
  /** Index du chunk */
  index: number;
  /** ID unique du chunk (pour stockage distribué) */
  chunkId: string;
  /** Taille chiffrée */
  encryptedSize: number;
  /** Hash des données chiffrées */
  encryptedHash: string;
  /** IV en base64 */
  iv: string;
  /** IDs des nœuds où le chunk est stocké */
  storageNodes?: string[];
}

// ==================== Callbacks de progression ====================

export interface ChunkingProgress {
  /** Phase actuelle */
  phase: 'reading' | 'chunking' | 'hashing';
  /** Nombre de chunks traités */
  processedChunks: number;
  /** Nombre total de chunks */
  totalChunks: number;
  /** Progression en pourcentage (0-100) */
  percentage: number;
}

export interface EncryptionProgress {
  /** Phase actuelle */
  phase: 'generating-key' | 'encrypting' | 'finalizing';
  /** Nombre de chunks chiffrés */
  encryptedChunks: number;
  /** Nombre total de chunks */
  totalChunks: number;
  /** Progression en pourcentage (0-100) */
  percentage: number;
}

export interface FileProcessingProgress {
  /** Étape globale */
  stage: 'chunking' | 'encrypting' | 'uploading' | 'complete' | 'error';
  /** Progression de l'étape en cours (0-100) */
  stageProgress: number;
  /** Progression globale (0-100) */
  overallProgress: number;
  /** Message descriptif */
  message: string;
}

export type ChunkingProgressCallback = (progress: ChunkingProgress) => void;
export type EncryptionProgressCallback = (progress: EncryptionProgress) => void;
export type FileProcessingProgressCallback = (progress: FileProcessingProgress) => void;

// ==================== Résultats ====================

export interface ChunkingResult {
  /** Chunks créés */
  chunks: Chunk[];
  /** Métadonnées du fichier */
  metadata: FileMetadata;
}

export interface EncryptionResult {
  /** Chunks chiffrés */
  encryptedChunks: EncryptedChunk[];
  /** Métadonnées complètes avec infos de chiffrement */
  metadata: EncryptedFileMetadata;
}

export interface ProcessedFile {
  /** Métadonnées chiffrées complètes */
  metadata: EncryptedFileMetadata;
  /** Chunks chiffrés prêts à être uploadés */
  chunks: EncryptedChunk[];
}

// ==================== Décryptage ====================

export interface DecryptionResult {
  /** Données décryptées du fichier */
  data: ArrayBuffer;
  /** Métadonnées du fichier */
  metadata: FileMetadata;
}
