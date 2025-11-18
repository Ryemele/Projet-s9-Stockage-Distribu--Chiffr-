/**
 * Types pour le schéma AFGH (Ateniese-Fu-Green-Hohenberger)
 * Proxy Re-Encryption avec accouplements bilinéaires
 *
 * Référence: "Improved Proxy Re-Encryption Schemes with Applications
 *             to Secure Distributed Storage" (2006)
 */

/**
 * Scalaire dans Zp (entier modulo p)
 * Représenté comme Uint8Array de 32 bytes
 */
export type Scalar = Uint8Array;

/**
 * Point sur la courbe elliptique dans G1
 * Représenté comme Uint8Array (coordonnées compressées)
 */
export type G1Point = Uint8Array;

/**
 * Élément du groupe cible G2 (résultat de l'accouplement)
 * Représenté comme Uint8Array
 */
export type G2Element = Uint8Array;

/**
 * Paire de clés AFGH (structure à 2 composantes)
 *
 * Clé secrète: (a1, a2) - deux scalaires secrets
 * Clé publique: (A1, A2) = (g^a1, g^a2) - deux points sur G1
 */
export interface AFGHKeyPair {
  /** Clé secrète - Composante 1 */
  secretKey1: Scalar;

  /** Clé secrète - Composante 2 */
  secretKey2: Scalar;

  /** Clé publique - Composante 1: A1 = g^a1 */
  publicKey1: G1Point;

  /** Clé publique - Composante 2: A2 = g^a2 */
  publicKey2: G1Point;

  /** Identifiant unique de l'utilisateur */
  userId: string;

  /** Métadonnées */
  createdAt: string;
  curveType: string; // "BLS12-381"
}

/**
 * Clé publique AFGH seule (pour partage)
 */
export interface AFGHPublicKey {
  /** A1 = g^a1 */
  publicKey1: G1Point;

  /** A2 = g^a2 */
  publicKey2: G1Point;

  /** Identifiant utilisateur */
  userId: string;
}

/**
 * Chiffré de niveau 2 (pour le propriétaire)
 *
 * Structure: (U, V)
 * U = g^k
 * V = message · e(A1, A2)^k = message · Z^(a1·a2·k)
 */
export interface Level2Ciphertext {
  /** U = g^k (élément public) */
  U: G1Point;

  /** V = message · Z^(a1·a2·k) (message masqué) */
  V: G2Element;

  /** Type de chiffré */
  level: 2;
}

/**
 * Chiffré de niveau 1 (après re-chiffrement)
 *
 * Structure: (C1', C2', U, A1, A2)
 * C1' = e(U, rk) = Z^(k·b2/a2)
 * C2' = V = message · Z^(a1·a2·k)
 */
export interface Level1Ciphertext {
  /** C1' = Z^(k·b2/a2) */
  C1_prime: G2Element;

  /** C2' = V (message masqué original) */
  C2_prime: G2Element;

  /** U = g^k (nécessaire pour déchiffrement) */
  U: G1Point;

  /** A1 = g^a1 (clé publique du propriétaire - composante 1) */
  A1: G1Point;

  /** A2 = g^a2 (clé publique du propriétaire - composante 2) */
  A2: G2Element;

  /** Type de chiffré */
  level: 1;
}

/**
 * Clé de re-chiffrement (unidirectionnelle)
 *
 * rk_{A→B} = g^(b2/a2)
 * Permet au proxy de transformer CT2_A en CT1_B
 */
export interface ReEncryptionKey {
  /** rk = g^(b2/a2) */
  key: G1Point;

  /** ID du propriétaire (Alice) */
  fromUserId: string;

  /** ID du destinataire (Bob) */
  toUserId: string;

  /** Date de création */
  createdAt: string;

  /** Date d'expiration (optionnelle) */
  expiresAt?: string;

  /** Métadonnées */
  permissions: "read" | "read-write";
}

/**
 * Enveloppe de chiffrement hybride KEM-DEM
 *
 * KEM: AFGH chiffre un secret S
 * DEM: S dérive une clé AES qui chiffre K_file
 * K_file chiffre les chunks du fichier
 */
export interface AFGHFileEnvelope {
  /** Identifiant unique du fichier */
  fileId: string;

  /** Nom du fichier */
  fileName: string;

  /** Taille du fichier (bytes) */
  fileSize: number;

  /** Type MIME */
  mimeType: string;

  // === KEM: Encapsulation AFGH ===

  /** Chiffré niveau 2 pour le propriétaire */
  kemCiphertext: Level2Ciphertext;

  /** Clé de fichier wrappée avec K_sym (dérivée de S) */
  wrappedFileKey: string; // Base64

  /** IV pour le wrapping AES-GCM de K_file */
  wrapKeyIV: string; // Base64

  /** Salt PBKDF2 pour dériver K_sym depuis S */
  kdfSalt?: Uint8Array; // 16 bytes

  // === DEM: Chiffrement des données ===

  /** Chunks chiffrés avec AES-GCM */
  chunks: EncryptedChunkAFGH[];

  // === Métadonnées ===

  metadata: {
    /** ID du propriétaire */
    ownerId: string;

    /** Date d'upload */
    uploadedAt: string;

    /** Taille des chunks */
    chunkSize: number;

    /** Nombre total de chunks */
    totalChunks: number;

    /** Algorithme KEM */
    kemAlgorithm: "AFGH-BLS12-381";

    /** Algorithme DEM */
    demAlgorithm: "AES-256-GCM";
  };
}

/**
 * Chunk chiffré (DEM)
 */
export interface EncryptedChunkAFGH {
  /** Index du chunk */
  chunkIndex: number;

  /** Données chiffrées (Base64) */
  encryptedData: string;

  /** IV pour AES-GCM (Base64) */
  iv: string;

  /** Hash SHA-256 du chunk ORIGINAL en clair (Base64) */
  hash: string;

  /** Taille du chunk original (bytes) */
  originalSize: number;
}

/**
 * Enveloppe partagée (après re-chiffrement)
 */
export interface SharedAFGHFileEnvelope
  extends Omit<AFGHFileEnvelope, "kemCiphertext"> {
  /** Chiffré niveau 1 pour le destinataire */
  kemCiphertext: Level1Ciphertext;

  /** ID du destinataire */
  recipientId: string;

  /** ID du partage */
  shareId: string;

  /** Permissions */
  permissions: "read" | "read-write";
}

/**
 * Résultat de la génération de clé de re-chiffrement
 */
export interface ReEncryptionKeyResult {
  /** Clé de re-chiffrement */
  reEncryptionKey: ReEncryptionKey;

  /** Clé encodée en Base64 (pour transmission) */
  keyBase64: string;
}

/**
 * Paramètres publics du système AFGH
 */
export interface AFGHSystemParams {
  /** Nom de la courbe */
  curveName: "BLS12-381";

  /** Ordre du groupe (nombre premier p) */
  curveOrder: bigint;

  /** Générateur g de G1 (encodé) */
  generator: string; // Base64

  /** Hash algorithm pour KDF */
  hashAlgorithm: "SHA-256";

  /** Taille des chunks (bytes) */
  chunkSize: number;

  /** Taille maximale de fichier (bytes) */
  maxFileSize: number;
}

/**
 * Configuration AFGH
 */
export interface AFGHConfig {
  /** Courbe elliptique à utiliser */
  curve: "BLS12-381";

  /** Taille des chunks (1 MB par défaut) */
  chunkSize: number;

  /** Taille max fichier (5 GB par défaut) */
  maxFileSize: number;

  /** Nombre d'itérations PBKDF2 pour dériver K_sym depuis S */
  pbkdf2Iterations: number;

  /** Activer la compression des points */
  compressPoints: boolean;
}

/**
 * Statistiques de performance AFGH
 */
export interface AFGHPerformanceStats {
  /** Temps de génération de clés (ms) */
  keyGenTime?: number;

  /** Temps de chiffrement (ms) */
  encryptionTime?: number;

  /** Temps de re-chiffrement (ms) */
  reEncryptionTime?: number;

  /** Temps de déchiffrement (ms) */
  decryptionTime?: number;

  /** Nombre d'accouplements calculés */
  pairingCount?: number;
}

/**
 * Erreurs AFGH
 */
export class AFGHError extends Error {
  code: AFGHErrorCode;
  details?: unknown;

  constructor(message: string, code: AFGHErrorCode, details?: unknown) {
    super(message);
    this.name = "AFGHError";
    this.code = code;
    this.details = details;
  }
}

export const AFGHErrorCode = {
  INVALID_KEY_PAIR: "INVALID_KEY_PAIR",
  INVALID_CIPHERTEXT: "INVALID_CIPHERTEXT",
  INVALID_RE_ENCRYPTION_KEY: "INVALID_RE_ENCRYPTION_KEY",
  PAIRING_COMPUTATION_FAILED: "PAIRING_COMPUTATION_FAILED",
  DECRYPTION_FAILED: "DECRYPTION_FAILED",
  RE_ENCRYPTION_FAILED: "RE_ENCRYPTION_FAILED",
  INVALID_PUBLIC_KEY: "INVALID_PUBLIC_KEY",
  CURVE_OPERATION_FAILED: "CURVE_OPERATION_FAILED",
  KEY_DERIVATION_FAILED: "KEY_DERIVATION_FAILED",
  CHUNK_INTEGRITY_FAILED: "CHUNK_INTEGRITY_FAILED",
} as const;

export type AFGHErrorCode = (typeof AFGHErrorCode)[keyof typeof AFGHErrorCode];
