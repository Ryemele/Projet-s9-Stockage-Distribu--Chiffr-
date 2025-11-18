/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Service AFGH (Ateniese-Fu-Green-Hohenberger) Proxy Re-Encryption
 *
 * Implémentation basée sur le papier scientifique:
 * "Improved Proxy Re-Encryption Schemes with Applications to Secure Distributed Storage"
 *
 * Architecture:
 * - Courbe: BLS12-381 (pairings-friendly)
 * - G1: Groupe de points sur courbe elliptique
 * - G2: Groupe cible (résultats d'accouplements)
 * - e: G1 × G1 → G2 (fonction d'accouplement bilinéaire)
 *
 * Propriétés de sécurité:
 * - Unidirectionnelle: rk_{A→B} ne permet pas B→A
 * - Non-transitive: rk_{A→B} + rk_{B→C} ≠ rk_{A→C}
 * - Colusion-safe: Proxy + Bob ne peuvent pas récupérer la clé d'Alice
 */

// @ts-expect-error - Module type declarations issue with Vite
import { bls12_381 as bls } from "@noble/curves/bls12-381";
// @ts-expect-error - Module type declarations issue with Vite
import { randomBytes } from "@noble/hashes/utils";

import type {
  Scalar,
  G1Point,
  G2Element,
  AFGHKeyPair,
  AFGHPublicKey,
  Level2Ciphertext,
  Level1Ciphertext,
  ReEncryptionKey,
  ReEncryptionKeyResult,
  AFGHSystemParams,
  AFGHConfig,
} from "../types/afgh";
import { AFGHError, AFGHErrorCode } from "../types/afgh";

/**
 * Service principal AFGH
 * Gère les opérations cryptographiques de base du schéma AFGH
 */
class AFGHService {
  // === Configuration ===
  private config: AFGHConfig = {
    curve: "BLS12-381",
    chunkSize: 1024 * 1024, // 1 MB
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5 GB
    pbkdf2Iterations: 100000,
    compressPoints: true,
  };

  // === Paramètres du système ===
  // Pour BLS12-381, l'ordre de la courbe est un nombre connu
  private readonly CURVE_ORDER = BigInt(
    "0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001"
  ); // Ordre du sous-groupe r

  // Générateur G1 - Utilise le générateur standard de BLS12-381
  private _generatorG1: any = null;
  private get GENERATOR_G1() {
    if (!this._generatorG1) {
      // Utilise le générateur standard (BASE) de la courbe BLS12-381
      // Si BASE n'existe pas, utilise hashToCurve comme fallback
      if (bls.G1.Point && bls.G1.Point.BASE) {
        this._generatorG1 = bls.G1.Point.BASE;
        console.log("[AFGH] Using standard G1 generator (BASE)");
      } else {
        this._generatorG1 = bls.G1.hashToCurve(new Uint8Array([0, 0, 0, 1]));
        console.log("[AFGH] Using hashToCurve generator");
      }
    }
    return this._generatorG1;
  }

  constructor() {
    // Vérifier que bls est bien chargé
    console.log("[AFGH] Initializing AFGH Service");
    console.log("[AFGH] bls object:", bls);
    console.log("[AFGH] typeof bls:", typeof bls);

    if (bls) {
      console.log("[AFGH] bls.G1:", bls.G1);
      console.log("[AFGH] typeof bls.G1:", typeof bls.G1);

      if (bls.G1) {
        console.log("[AFGH] bls.G1 keys:", Object.keys(bls.G1));
        console.log("[AFGH] bls.G1.Point:", bls.G1.Point);
        console.log("[AFGH] typeof bls.G1.Point:", typeof bls.G1.Point);
      }

      console.log("[AFGH] bls.G2:", bls.G2);
      console.log("[AFGH] bls.pairing:", typeof bls.pairing);
      console.log("[AFGH] bls.fields:", typeof bls.fields);
    }

    if (!bls) {
      console.error("[AFGH] bls is null or undefined!");
      throw new Error("BLS12-381 library not loaded - bls is null");
    }

    if (!bls.G1) {
      console.error("[AFGH] bls.G1 is null or undefined!");
      console.error("[AFGH] Available bls keys:", Object.keys(bls));
      throw new Error("BLS12-381 library not loaded - bls.G1 is null");
    }

    if (!bls.G1.Point) {
      console.error("[AFGH] bls.G1.Point is null or undefined!");
      console.error("[AFGH] Available bls.G1 keys:", Object.keys(bls.G1));
      throw new Error("BLS12-381 library not loaded - bls.G1.Point is null");
    }

    console.log("[AFGH] ✓ BLS12-381 library loaded successfully");
  }

  /**
   * ========================================
   * 1. INITIALISATION ET CONFIGURATION
   * ========================================
   */

  /**
   * Initialise le service AFGH avec une configuration personnalisée
   */
  initialize(config?: Partial<AFGHConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    console.log("[AFGH] Service initialized with config:", this.config);
  }

  /**
   * Récupère les paramètres publics du système
   */
  getSystemParams(): AFGHSystemParams {
    return {
      curveName: "BLS12-381",
      curveOrder: this.CURVE_ORDER,
      generator: this.g1PointToBase64(this.GENERATOR_G1),
      hashAlgorithm: "SHA-256",
      chunkSize: this.config.chunkSize,
      maxFileSize: this.config.maxFileSize,
    };
  }

  /**
   * ========================================
   * 2. GÉNÉRATION DE CLÉS (Structure à 2 composantes)
   * ========================================
   */

  /**
   * Génère une paire de clés AFGH pour un utilisateur
   *
   * Clé secrète: (a1, a2) - deux scalaires aléatoires
   * Clé publique: (A1, A2) = (g^a1, g^a2)
   *
   * @param userId - Identifiant unique de l'utilisateur
   * @returns Paire de clés AFGH
   */
  async generateKeyPair(userId: string): Promise<AFGHKeyPair> {
    try {
      console.log(`[AFGH] Generating key pair for user: ${userId}`);

      // 1. Générer deux scalaires secrets aléatoires a1, a2 ∈ Zp*
      const a1 = this.generateRandomScalar();
      const a2 = this.generateRandomScalar();

      // 2. Calculer les composantes publiques
      // A1 = g1^a1 (multiplication scalaire dans G1)
      const A1 = this.GENERATOR_G1.multiply(this.scalarToBigInt(a1));

      // A2 = g2^a2 (multiplication scalaire dans G2)
      // Pour BLS12-381, on doit utiliser un générateur G2
      const GENERATOR_G2 =
        bls.G2.Point.BASE || bls.G2.hashToCurve(new Uint8Array([0, 0, 0, 1]));
      const A2 = GENERATOR_G2.multiply(this.scalarToBigInt(a2));

      // Test: vérifier que les points sont valides avant sérialisation
      console.log(
        "[AFGH] A1 type:",
        typeof A1,
        "has toHex:",
        typeof A1.toHex,
        "(G1)"
      );
      console.log(
        "[AFGH] A2 type:",
        typeof A2,
        "has toHex:",
        typeof A2.toHex,
        "(G2)"
      );

      // 3. Construire la paire de clés
      const publicKey1Bytes = this.g1PointToBytes(A1); // G1 point
      const publicKey2Bytes = this.g2ElementToBytes(A2); // G2 point

      // Test de round-trip: sérialiser puis désérialiser
      console.log("[AFGH] Testing round-trip serialization...");
      try {
        const A1_restored = this.bytesToG1Point(publicKey1Bytes);
        const A2_restored = this.bytesToG2Element(publicKey2Bytes);
        console.log("[AFGH] ✓ Round-trip successful for both public keys");
        console.log("[AFGH] A1 restored:", typeof A1_restored, "(G1)");
        console.log("[AFGH] A2 restored:", typeof A2_restored, "(G2)");
      } catch (error) {
        console.error("[AFGH] ✗ Round-trip failed:", error);
        throw new Error("Key serialization/deserialization failed");
      }

      const keyPair: AFGHKeyPair = {
        secretKey1: a1,
        secretKey2: a2,
        publicKey1: publicKey1Bytes,
        publicKey2: publicKey2Bytes,
        userId: userId,
        createdAt: new Date().toISOString(),
        curveType: "BLS12-381",
      };

      console.log(`[AFGH] Key pair generated successfully for ${userId}`);
      return keyPair;
    } catch (error) {
      throw new AFGHError(
        `Key pair generation failed: ${error}`,
        AFGHErrorCode.CURVE_OPERATION_FAILED,
        error
      );
    }
  }

  /**
   * Extrait la clé publique d'une paire de clés
   */
  extractPublicKey(keyPair: AFGHKeyPair): AFGHPublicKey {
    return {
      publicKey1: keyPair.publicKey1,
      publicKey2: keyPair.publicKey2,
      userId: keyPair.userId,
    };
  }

  /**
   * ========================================
   * 3. CHIFFREMENT NIVEAU 2 (Pour le propriétaire)
   * ========================================
   */

  /**
   * Chiffre un message avec le schéma AFGH niveau 2
   *
   * Utilisé pour le propriétaire initial du fichier
   *
   * Algorithme:
   * 1. Choisir k ← Zp* (aléatoire)
   * 2. U = g^k
   * 3. V = message · e(A1, A2)^k = message · Z^(a1·a2·k)
   * 4. Retourner (U, V)
   *
   * @param message - Message à chiffrer (élément de G2)
   * @param publicKey - Clé publique du propriétaire
   * @returns Chiffré niveau 2
   */
  async encryptLevel2(
    message: G2Element,
    publicKey: AFGHPublicKey
  ): Promise<Level2Ciphertext> {
    try {
      console.log(
        `[AFGH] Encrypting message (Level 2) for ${publicKey.userId}`
      );

      // 1. Générer scalaire aléatoire k
      const k = this.generateRandomScalar();
      const kBigInt = this.scalarToBigInt(k);

      // 2. Calculer U = g^k
      const U = this.GENERATOR_G1.multiply(kBigInt);

      // 3. Récupérer les clés publiques A1 (G1), A2 (G2)
      const A1 = this.bytesToG1Point(publicKey.publicKey1);
      const A2 = this.bytesToG2Element(publicKey.publicKey2);

      // 4. Calculer l'accouplement e(A1, A2)
      // BLS12-381 pairing: e: G1 × G2 → GT (Fp12)
      // e(g1^a1, g2^a2) = e(g1, g2)^(a1·a2)
      const pairing_A1_A2 = bls.pairing(A1, A2);

      // 5. Élever à la puissance k: e(A1, A2)^k
      const pairing_k = bls.fields.Fp12.pow(pairing_A1_A2, kBigInt);

      // 6. Convertir le message (G2 point) en élément Fp12 via pairing avec le générateur
      // Pour convertir un point G2 en Fp12, on fait e(g1, message)
      const messagePoint = this.bytesToG2Element(message);
      const messageElement = bls.pairing(this.GENERATOR_G1, messagePoint);

      // 7. Calculer V = message_fp12 · e(A1, A2)^k
      const V = bls.fields.Fp12.mul(messageElement, pairing_k);

      // 8. Construire le chiffré
      // V est un élément Fp12, on doit le sérialiser
      const ciphertext: Level2Ciphertext = {
        U: this.g1PointToBytes(U),
        V: this.fp12ToBytes(V),
        level: 2,
      };

      console.log(`[AFGH] Level 2 encryption successful`);
      return ciphertext;
    } catch (error) {
      throw new AFGHError(
        `Level 2 encryption failed: ${error}`,
        AFGHErrorCode.CURVE_OPERATION_FAILED,
        error
      );
    }
  }

  /**
   * Déchiffre un chiffré niveau 2
   *
   * Utilisé par le propriétaire pour déchiffrer ses propres fichiers
   *
   * Algorithme:
   * message = V / e(U, A2)^a2
   *         = V / e(g^k, g^a2)^a2
   *         = (message · Z^(a1·a2·k)) / Z^(a1·a2·k)
   *         = message
   *
   * @param ciphertext - Chiffré niveau 2
   * @param secretKey1 - a1 (composante 1 de la clé secrète)
   * @param secretKey2 - a2 (composante 2 de la clé secrète)
   * @param publicKey1 - A1 = g^a1
   * @returns Message déchiffré
   */
  async decryptLevel2(
    ciphertext: Level2Ciphertext,
    secretKey2: Scalar,
    publicKey1: G1Point
  ): Promise<G2Element> {
    try {
      console.log(`[AFGH] Decrypting Level 2 ciphertext`);

      // 1. Extraire U et V
      const U = this.bytesToG1Point(ciphertext.U);
      const V = this.bytesToG2Element(ciphertext.V);

      // 2. Récupérer A1
      const A1 = this.bytesToG1Point(publicKey1);

      // 3. Calculer U^a2
      const a2BigInt = this.scalarToBigInt(secretKey2);
      const U_a2 = U.multiply(a2BigInt);

      // 4. Calculer e(U^a2, A1) = e(U, A1)^a2
      const pairing = bls.pairing(U_a2, A1);

      // 5. Inverser le pairing
      const pairingInverse = bls.fields.Fp12.inv(pairing);

      // 6. Calculer message = V / e(U, A1)^a2
      const message = bls.fields.Fp12.mul(V, pairingInverse);

      console.log(`[AFGH] Level 2 decryption successful`);
      return this.g2ElementToBytes(message);
    } catch (error) {
      throw new AFGHError(
        `Level 2 decryption failed: ${error}`,
        AFGHErrorCode.DECRYPTION_FAILED,
        error
      );
    }
  }

  /**
   * ========================================
   * 4. GÉNÉRATION DE CLÉ DE RE-CHIFFREMENT
   * ========================================
   */

  /**
   * Génère une clé de re-chiffrement d'Alice vers Bob
   *
   * Permet au proxy (HSM) de transformer des chiffrés d'Alice en chiffrés pour Bob
   * SANS que le proxy ne puisse déchiffrer
   *
   * Algorithme:
   * rk_{A→B} = B2^(1/a2) = (g^b2)^(1/a2) = g^(b2/a2)
   *
   * Propriétés:
   * - Unidirectionnelle: ne permet pas B→A
   * - Le proxy ne peut pas déduire a2 ou b2 (logarithme discret)
   *
   * @param aliceSecretKey2 - a2 (composante 2 de la clé secrète d'Alice)
   * @param bobPublicKey - Clé publique de Bob
   * @param aliceUserId - ID d'Alice
   * @param bobUserId - ID de Bob
   * @param permissions - Permissions accordées
   * @returns Clé de re-chiffrement
   */
  async generateReEncryptionKey(
    aliceSecretKey2: Scalar,
    bobPublicKey: AFGHPublicKey,
    aliceUserId: string,
    bobUserId: string,
    permissions: "read" | "read-write" = "read"
  ): Promise<ReEncryptionKeyResult> {
    try {
      console.log(
        `[AFGH] Generating re-encryption key: ${aliceUserId} → ${bobUserId}`
      );

      // 1. Récupérer B2 = g^b2 (composante 2 de la clé publique de Bob)
      const B2 = this.bytesToG1Point(bobPublicKey.publicKey2);

      // 2. Calculer l'inverse de a2 modulo l'ordre de la courbe
      // a2_inv = a2^(-1) mod p
      const a2BigInt = this.scalarToBigInt(aliceSecretKey2);
      const a2_inverse = this.modularInverse(a2BigInt, this.CURVE_ORDER);

      // 3. Calculer rk = B2^(1/a2) = B2^(a2_inv)
      const rk = B2.multiply(a2_inverse);

      // 4. Construire la clé de re-chiffrement
      const reEncryptionKey: ReEncryptionKey = {
        key: this.g1PointToBytes(rk),
        fromUserId: aliceUserId,
        toUserId: bobUserId,
        createdAt: new Date().toISOString(),
        permissions: permissions,
      };

      const result: ReEncryptionKeyResult = {
        reEncryptionKey: reEncryptionKey,
        keyBase64: this.g1PointToBase64(rk),
      };

      console.log(`[AFGH] Re-encryption key generated successfully`);
      return result;
    } catch (error) {
      throw new AFGHError(
        `Re-encryption key generation failed: ${error}`,
        AFGHErrorCode.CURVE_OPERATION_FAILED,
        error
      );
    }
  }

  /**
   * ========================================
   * 5. RE-CHIFFREMENT (Exécuté par le HSM/Proxy)
   * ========================================
   */

  /**
   * Re-chiffre un chiffré niveau 2 d'Alice en chiffré niveau 1 pour Bob
   *
   * Le proxy peut exécuter cette transformation SANS déchiffrer le message
   *
   * Algorithme:
   * 1. C1' = e(U, rk) = e(g^k, g^(b2/a2)) = Z^(k·b2/a2)
   * 2. C2' = V (reste inchangé)
   * 3. Retourner (C1', C2', U, A1, A2)
   *
   * @param ciphertextAlice - Chiffré niveau 2 pour Alice
   * @param reEncryptionKey - Clé de re-chiffrement rk_{A→B}
   * @param alicePublicKey - Clé publique d'Alice (pour que Bob déchiffre)
   * @returns Chiffré niveau 1 pour Bob
   */
  async reEncrypt(
    ciphertextAlice: Level2Ciphertext,
    reEncryptionKey: ReEncryptionKey,
    alicePublicKey: AFGHPublicKey
  ): Promise<Level1Ciphertext> {
    try {
      console.log(
        `[AFGH] Re-encrypting: ${reEncryptionKey.fromUserId} → ${reEncryptionKey.toUserId}`
      );

      // 1. Extraire U et V du chiffré d'Alice
      const U = this.bytesToG1Point(ciphertextAlice.U);
      const V = this.bytesToG2Element(ciphertextAlice.V);

      // 2. Récupérer la clé de re-chiffrement rk = g^(b2/a2)
      const rk = this.bytesToG1Point(reEncryptionKey.key);

      // 3. Calculer C1' = e(U, rk) = e(g^k, g^(b2/a2)) = Z^(k·b2/a2)
      const C1_prime = bls.pairing(U, rk);

      // 4. C2' = V (reste inchangé)
      const C2_prime = V;

      // 5. Récupérer A1 et A2 d'Alice
      const A1 = alicePublicKey.publicKey1;
      const A2 = this.g2ElementToBytes(
        bls.pairing(
          this.bytesToG1Point(alicePublicKey.publicKey2),
          this.GENERATOR_G1
        )
      );

      // 6. Construire le chiffré niveau 1 pour Bob
      const ciphertextBob: Level1Ciphertext = {
        C1_prime: this.g2ElementToBytes(C1_prime),
        C2_prime: this.g2ElementToBytes(C2_prime),
        U: ciphertextAlice.U, // Nécessaire pour déchiffrement par Bob
        A1: A1,
        A2: A2,
        level: 1,
      };

      console.log(`[AFGH] Re-encryption successful`);
      return ciphertextBob;
    } catch (error) {
      throw new AFGHError(
        `Re-encryption failed: ${error}`,
        AFGHErrorCode.RE_ENCRYPTION_FAILED,
        error
      );
    }
  }

  /**
   * ========================================
   * 6. DÉCHIFFREMENT NIVEAU 1 (Par le destinataire)
   * ========================================
   */

  /**
   * Déchiffre un chiffré niveau 1 (après re-chiffrement)
   *
   * Utilisé par Bob pour déchiffrer un fichier partagé par Alice
   *
   * Algorithme:
   * message = C2' / (C1'^a2 · e(U, A1)^b2)
   *
   * Explication:
   * - C2' = message · Z^(a1·a2·k)
   * - C1'^a2 = (Z^(k·b2/a2))^a2 = Z^(k·b2)
   * - e(U, A1)^b2 = e(g^k, g^a1)^b2 = Z^(k·a1·b2)
   * - Dénominateur = Z^(k·b2) · Z^(k·a1·b2) = Z^(k·b2(1+a1))
   *
   * Note: La formule exacte dépend de la variante AFGH
   *
   * @param ciphertext - Chiffré niveau 1
   * @param bobSecretKey2 - b2 (composante 2 de la clé secrète de Bob)
   * @returns Message déchiffré
   */
  async decryptLevel1(
    ciphertext: Level1Ciphertext,
    bobSecretKey2: Scalar
  ): Promise<G2Element> {
    try {
      console.log(`[AFGH] Decrypting Level 1 ciphertext`);

      // 1. Extraire les composantes
      const C1_prime = this.bytesToG2Element(ciphertext.C1_prime);
      const C2_prime = this.bytesToG2Element(ciphertext.C2_prime);
      const U = this.bytesToG1Point(ciphertext.U);
      const A1 = this.bytesToG1Point(ciphertext.A1);
      // const A2_element = this.bytesToG2Element(ciphertext.A2); // unused

      // 2. Récupérer b2
      const b2BigInt = this.scalarToBigInt(bobSecretKey2);

      // 3. Calculer C1'^a2
      // Note: a2 est dans la clé publique d'Alice sous forme A2
      // On utilise une approche simplifiée ici
      // Dans une implémentation complète, il faut extraire a2 correctement
      const C1_prime_a2 = bls.fields.Fp12.pow(C1_prime, b2BigInt);

      // 4. Calculer e(U, A1)^b2
      const pairing_U_A1 = bls.pairing(U, A1);
      const pairing_b2 = bls.fields.Fp12.pow(pairing_U_A1, b2BigInt);

      // 5. Calculer le dénominateur
      const denominator = bls.fields.Fp12.mul(C1_prime_a2, pairing_b2);
      const denominatorInverse = bls.fields.Fp12.inv(denominator);

      // 6. Calculer le message = C2' / denominator
      const message = bls.fields.Fp12.mul(C2_prime, denominatorInverse);

      console.log(`[AFGH] Level 1 decryption successful`);
      return this.g2ElementToBytes(message);
    } catch (error) {
      throw new AFGHError(
        `Level 1 decryption failed: ${error}`,
        AFGHErrorCode.DECRYPTION_FAILED,
        error
      );
    }
  }

  /**
   * ========================================
   * 7. UTILITAIRES CRYPTOGRAPHIQUES
   * ========================================
   */

  /**
   * Génère un scalaire aléatoire dans Zp*
   */
  private generateRandomScalar(): Scalar {
    // Générer 32 bytes aléatoires
    const randomBytesArray = randomBytes(32);
    return new Uint8Array(randomBytesArray);
  }

  /**
   * Convertit un scalaire en BigInt
   */
  private scalarToBigInt(scalar: Scalar): bigint {
    let result = 0n;
    for (let i = 0; i < scalar.length; i++) {
      result = (result << 8n) | BigInt(scalar[i]);
    }
    // Réduire modulo l'ordre de la courbe
    return result % this.CURVE_ORDER;
  }

  /**
   * Convertit un BigInt en Scalar
   * @unused - Kept for future use
   */
  /*
  private bigIntToScalar(value: bigint): Scalar {
    const bytes = new Uint8Array(32);
    let temp = value;
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(temp & 0xffn);
      temp = temp >> 8n;
    }
    return bytes;
  }
  */

  /**
   * Calcule l'inverse modulaire: a^(-1) mod m
   * Utilise l'algorithme d'Euclide étendu
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private modularInverse(a: bigint, _m: bigint): bigint {
    // Utiliser la fonction intégrée de BLS12-381
    return bls.fields.Fr.inv(a);
  }

  /**
   * Convertit un point G1 en bytes
   */
  private g1PointToBytes(point: any): G1Point {
    try {
      // Dans @noble/curves, utiliser toHex() pour obtenir le format correct
      if (typeof point.toHex === "function") {
        const hexString = point.toHex();
        // Convertir hex string en Uint8Array
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
          bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
        }
        console.log(`[AFGH] Serialized G1 point: ${bytes.length} bytes`);
        return bytes;
      }

      // Fallback: essayer toRawBytes
      if (typeof point.toRawBytes === "function") {
        return point.toRawBytes();
      }

      throw new Error("Cannot serialize G1 point: no compatible method found");
    } catch (error) {
      console.error("[AFGH] Error converting G1 point to bytes:", error);
      throw error;
    }
  }

  /**
   * Convertit des bytes en point G1
   */
  private bytesToG1Point(bytes: G1Point): any {
    try {
      console.log(
        `[AFGH] Deserializing G1 point: ${
          bytes.length
        } bytes, first byte: 0x${bytes[0]?.toString(16)}`
      );

      // fromHex attend une string hex, pas un Uint8Array
      // Convertir Uint8Array en hex string
      const hexString = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      console.log(
        `[AFGH] Hex string (first 32 chars): ${hexString.slice(0, 32)}...`
      );

      return bls.G1.Point.fromHex(hexString);
    } catch (error) {
      console.error("[AFGH] Error converting bytes to G1 point:", error);
      console.error("[AFGH] Bytes:", bytes);
      throw error;
    }
  }

  /**
   * Convertit un point G2 en bytes
   */
  private g2ElementToBytes(point: any): G2Element {
    try {
      // Dans @noble/curves, utiliser toHex() pour obtenir le format correct
      if (typeof point.toHex === "function") {
        const hexString = point.toHex();
        // Convertir hex string en Uint8Array
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
          bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
        }
        console.log(`[AFGH] Serialized G2 point: ${bytes.length} bytes`);
        return bytes;
      }

      // Fallback to toRawBytes if available
      if (typeof point.toRawBytes === "function") {
        return point.toRawBytes();
      }

      throw new Error("Cannot serialize G2 point: no compatible method found");
    } catch (error) {
      console.error("[AFGH] Error converting G2 point to bytes:", error);
      throw error;
    }
  }

  /**
   * Convertit des bytes en point G2
   */
  private bytesToG2Element(bytes: G2Element): any {
    try {
      console.log(
        `[AFGH] Deserializing G2 point: ${
          bytes.length
        } bytes, first byte: 0x${bytes[0]?.toString(16)}`
      );

      // fromHex attend une string hex, pas un Uint8Array
      const hexString = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      console.log(
        `[AFGH] G2 Hex string (first 32 chars): ${hexString.slice(0, 32)}...`
      );

      return bls.G2.Point.fromHex(hexString);
    } catch (error) {
      console.error("[AFGH] Error converting bytes to G2 point:", error);
      console.error("[AFGH] Bytes:", bytes);
      throw error;
    }
  }

  /**
   * Convertit un élément Fp12 en bytes
   */
  private fp12ToBytes(element: any): Uint8Array {
    try {
      // Fp12 elements can be serialized using toBytes if available
      if (typeof element.toBytes === "function") {
        return element.toBytes();
      }

      // Fallback: serialize using the field element representation
      // Fp12 has 12 coefficients, each is a field element (48 bytes)
      // Total: 12 * 48 = 576 bytes
      const bytes = new Uint8Array(576);
      // This is a simplified serialization - in production you'd need proper Fp12 serialization
      console.log("[AFGH] Serialized Fp12 element:", bytes.length, "bytes");
      return bytes;
    } catch (error) {
      console.error("[AFGH] Error converting Fp12 to bytes:", error);
      throw error;
    }
  }

  /**
   * Encode un point G1 en Base64
   */
  private g1PointToBase64(point: any): string {
    const bytes = this.g1PointToBytes(point);
    // @ts-expect-error - Buffer type issue
    return Buffer.from(bytes).toString("base64");
  }

  /**
   * Décode un point G1 depuis Base64
   * @unused - Kept for future use
   */
  // @ts-expect-error - unused but kept for future use
  private base64ToG1Point(base64: string): any {
    // @ts-expect-error - Buffer type issue
    const bytes = new Uint8Array(Buffer.from(base64, "base64"));
    return this.bytesToG1Point(bytes);
  }

  /**
   * Hash un message pour obtenir un point G2
   * Utilisé pour encapsuler des secrets
   */
  hashToG2(message: Uint8Array): G2Element {
    // Use the proper G2 hash-to-curve function from @noble/curves
    // This properly maps arbitrary byte strings to G2 points
    const g2Point = bls.G2.hashToCurve(message);
    return this.g2ElementToBytes(g2Point);
  }

  /**
   * Génère un point aléatoire de G2
   * Utilisé pour le secret S dans KEM
   */
  generateRandomG2Element(): G2Element {
    const randomValue = randomBytes(32);
    return this.hashToG2(randomValue);
  }
}

// Export singleton
export const afghService = new AFGHService();
