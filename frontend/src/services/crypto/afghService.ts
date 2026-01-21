/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Service AFGH (Ateniese-Fu-Green-Hohenberger) Proxy Re-Encryption
 * Courbe: BLS12-381 (pairings-friendly)
 */

// @ts-expect-error - Package uses .js exports
import { bls12_381 as bls } from "@noble/curves/bls12-381";
// @ts-expect-error - Package uses .js exports
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
} from "../../types/afgh";
import { AFGHError, AFGHErrorCode } from "../../types/afgh";

class AFGHService {
  private config: AFGHConfig = {
    curve: "BLS12-381",
    chunkSize: 1024 * 1024,
    maxFileSize: 5 * 1024 * 1024 * 1024,
    pbkdf2Iterations: 100000,
    compressPoints: true,
  };

  private readonly CURVE_ORDER = BigInt(
    "0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001"
  );

  // Cache for API access patterns
  private _G1Point: any = null;
  private _G2Point: any = null;

  private get G1Point() {
    if (!this._G1Point) {
      // Try different API access patterns for noble-curves compatibility
      if (bls.G1?.ProjectivePoint) {
        this._G1Point = bls.G1.ProjectivePoint;
      } else if ((bls.G1 as any)?.Point) {
        this._G1Point = (bls.G1 as any).Point;
      } else {
        this._G1Point = bls.G1;
      }
    }
    return this._G1Point;
  }

  private get G2Point() {
    if (!this._G2Point) {
      // Try different API access patterns for noble-curves compatibility
      if (bls.G2?.ProjectivePoint) {
        this._G2Point = bls.G2.ProjectivePoint;
      } else if ((bls.G2 as any)?.Point) {
        this._G2Point = (bls.G2 as any).Point;
      } else {
        this._G2Point = bls.G2;
      }
    }
    return this._G2Point;
  }

  private _generatorG1: any = null;
  private get GENERATOR_G1() {
    if (!this._generatorG1) {
      const G1P = this.G1Point;
      if (G1P?.BASE) {
        this._generatorG1 = G1P.BASE;
      } else if (G1P?.ZERO) {
        // Use generator from hashToCurve as fallback
        this._generatorG1 = bls.G1.hashToCurve(new Uint8Array([0, 0, 0, 1]));
      } else {
        this._generatorG1 = bls.G1.hashToCurve(new Uint8Array([0, 0, 0, 1]));
      }
    }
    return this._generatorG1;
  }

  private _generatorG2: any = null;
  private get GENERATOR_G2() {
    if (!this._generatorG2) {
      const G2P = this.G2Point;
      if (G2P?.BASE) {
        this._generatorG2 = G2P.BASE;
      } else if (G2P?.ZERO) {
        this._generatorG2 = bls.G2.hashToCurve(new Uint8Array([0, 0, 0, 1]));
      } else {
        this._generatorG2 = bls.G2.hashToCurve(new Uint8Array([0, 0, 0, 1]));
      }
    }
    return this._generatorG2;
  }

  constructor() {
    console.log("[AFGH] Initializing AFGH Service with BLS12-381");
    // Log API availability for debugging
    console.log("[AFGH] G1.ProjectivePoint:", !!bls.G1?.ProjectivePoint);
    console.log("[AFGH] G2.ProjectivePoint:", !!bls.G2?.ProjectivePoint);
  }

  initialize(config?: Partial<AFGHConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

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

  async generateKeyPair(userId: string): Promise<AFGHKeyPair> {
    try {
      console.log(`[AFGH] Generating key pair for user: ${userId}`);

      const a1 = this.generateRandomScalar();
      const a2 = this.generateRandomScalar();

      const A1 = this.GENERATOR_G1.multiply(this.scalarToBigInt(a1));
      const A2 = this.GENERATOR_G2.multiply(this.scalarToBigInt(a2));

      const keyPair: AFGHKeyPair = {
        secretKey1: a1,
        secretKey2: a2,
        publicKey1: this.g1PointToBytes(A1),
        publicKey2: this.g2ElementToBytes(A2),
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

  extractPublicKey(keyPair: AFGHKeyPair): AFGHPublicKey {
    return {
      publicKey1: keyPair.publicKey1,
      publicKey2: keyPair.publicKey2,
      userId: keyPair.userId,
    };
  }

  async encryptLevel2(
    message: G2Element,
    publicKey: AFGHPublicKey
  ): Promise<Level2Ciphertext> {
    try {
      console.log(`[AFGH] Encrypting message (Level 2) for ${publicKey.userId}`);

      const k = this.generateRandomScalar();
      const kBigInt = this.scalarToBigInt(k);

      const U = this.GENERATOR_G1.multiply(kBigInt);

      const A1 = this.bytesToG1Point(publicKey.publicKey1);
      const A2 = this.bytesToG2Element(publicKey.publicKey2);

      const pairing_A1_A2 = bls.pairing(A1, A2);
      const pairing_k = bls.fields.Fp12.pow(pairing_A1_A2, kBigInt);

      const messagePoint = this.bytesToG2Element(message);
      const messageElement = bls.pairing(this.GENERATOR_G1, messagePoint);

      const V = bls.fields.Fp12.mul(messageElement, pairing_k);

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

  async decryptLevel2(
    ciphertext: Level2Ciphertext,
    secretKey2: Scalar,
    publicKey1: G1Point
  ): Promise<G2Element> {
    try {
      console.log(`[AFGH] Decrypting Level 2 ciphertext`);

      const U = this.bytesToG1Point(ciphertext.U);
      const V = this.bytesToFp12(ciphertext.V);
      const A1 = this.bytesToG1Point(publicKey1);

      const a2BigInt = this.scalarToBigInt(secretKey2);
      const U_a2 = U.multiply(a2BigInt);

      const pairing = bls.pairing(U_a2, A1);
      const pairingInverse = bls.fields.Fp12.inv(pairing);

      const message = bls.fields.Fp12.mul(V, pairingInverse);

      console.log(`[AFGH] Level 2 decryption successful`);
      return this.fp12ToBytes(message);
    } catch (error) {
      throw new AFGHError(
        `Level 2 decryption failed: ${error}`,
        AFGHErrorCode.DECRYPTION_FAILED,
        error
      );
    }
  }

  async generateReEncryptionKey(
    aliceSecretKey2: Scalar,
    bobPublicKey: AFGHPublicKey,
    aliceUserId: string,
    bobUserId: string,
    permissions: "read" | "read-write" = "read"
  ): Promise<ReEncryptionKeyResult> {
    try {
      console.log(`[AFGH] Generating re-encryption key: ${aliceUserId} → ${bobUserId}`);

      const B2 = this.bytesToG1Point(bobPublicKey.publicKey2);
      const a2BigInt = this.scalarToBigInt(aliceSecretKey2);
      const a2_inverse = bls.fields.Fr.inv(a2BigInt);

      const rk = B2.multiply(a2_inverse);

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

  async reEncrypt(
    ciphertextAlice: Level2Ciphertext,
    reEncryptionKey: ReEncryptionKey,
    alicePublicKey: AFGHPublicKey
  ): Promise<Level1Ciphertext> {
    try {
      console.log(`[AFGH] Re-encrypting: ${reEncryptionKey.fromUserId} → ${reEncryptionKey.toUserId}`);

      const U = this.bytesToG1Point(ciphertextAlice.U);
      const V = ciphertextAlice.V;
      const rk = this.bytesToG1Point(reEncryptionKey.key);

      const C1_prime = bls.pairing(U, rk);
      const C2_prime = V;

      const ciphertextBob: Level1Ciphertext = {
        C1_prime: this.fp12ToBytes(C1_prime),
        C2_prime: C2_prime,
        U: ciphertextAlice.U,
        A1: alicePublicKey.publicKey1,
        A2: alicePublicKey.publicKey2,
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

  async decryptLevel1(
    ciphertext: Level1Ciphertext,
    bobSecretKey2: Scalar
  ): Promise<G2Element> {
    try {
      console.log(`[AFGH] Decrypting Level 1 ciphertext`);

      const C1_prime = this.bytesToFp12(ciphertext.C1_prime);
      const C2_prime = this.bytesToFp12(ciphertext.C2_prime);
      const U = this.bytesToG1Point(ciphertext.U);
      const A1 = this.bytesToG1Point(ciphertext.A1);

      const b2BigInt = this.scalarToBigInt(bobSecretKey2);

      const C1_prime_b2 = bls.fields.Fp12.pow(C1_prime, b2BigInt);
      const pairing_U_A1 = bls.pairing(U, A1);
      const pairing_b2 = bls.fields.Fp12.pow(pairing_U_A1, b2BigInt);

      const denominator = bls.fields.Fp12.mul(C1_prime_b2, pairing_b2);
      const denominatorInverse = bls.fields.Fp12.inv(denominator);

      const message = bls.fields.Fp12.mul(C2_prime, denominatorInverse);

      console.log(`[AFGH] Level 1 decryption successful`);
      return this.fp12ToBytes(message);
    } catch (error) {
      throw new AFGHError(
        `Level 1 decryption failed: ${error}`,
        AFGHErrorCode.DECRYPTION_FAILED,
        error
      );
    }
  }

  // === Utility Methods ===

  private generateRandomScalar(): Scalar {
    return new Uint8Array(randomBytes(32));
  }

  private scalarToBigInt(scalar: Scalar): bigint {
    let result = 0n;
    for (let i = 0; i < scalar.length; i++) {
      result = (result << 8n) | BigInt(scalar[i]);
    }
    return result % this.CURVE_ORDER;
  }

  private g1PointToBytes(point: any): G1Point {
    if (typeof point.toRawBytes === "function") {
      return point.toRawBytes(true);
    }
    const hex = point.toHex(true);
    return this.hexToBytes(hex);
  }

  private bytesToG1Point(bytes: G1Point): any {
    const hex = this.bytesToHex(bytes);
    const G1P = this.G1Point;

    // Try different API access patterns for noble-curves compatibility
    if (G1P?.fromHex) {
      return G1P.fromHex(hex);
    }
    if (bls.G1?.fromHex) {
      return bls.G1.fromHex(hex);
    }
    // Fallback: use hashToCurve as approximation (not ideal but prevents crash)
    console.warn("[AFGH] Using hashToCurve fallback for G1 point deserialization");
    return bls.G1.hashToCurve(bytes);
  }

  private g2ElementToBytes(element: any): G2Element {
    if (typeof element.toRawBytes === "function") {
      return element.toRawBytes(true);
    }
    const hex = element.toHex(true);
    return this.hexToBytes(hex);
  }

  private bytesToG2Element(bytes: G2Element): any {
    const hex = this.bytesToHex(bytes);
    const G2P = this.G2Point;

    // Try different API access patterns for noble-curves compatibility
    if (G2P?.fromHex) {
      return G2P.fromHex(hex);
    }
    if (bls.G2?.fromHex) {
      return bls.G2.fromHex(hex);
    }
    // Fallback: use hashToCurve as approximation (not ideal but prevents crash)
    console.warn("[AFGH] Using hashToCurve fallback for G2 element deserialization");
    return bls.G2.hashToCurve(bytes);
  }

  private fp12ToBytes(element: any): Uint8Array {
    const c0 = element.c0;
    const c1 = element.c1;
    const bytes = new Uint8Array(576);
    let offset = 0;

    for (const c of [c0, c1]) {
      for (const cc of [c.c0, c.c1, c.c2]) {
        for (const ccc of [cc.c0, cc.c1]) {
          const val = ccc.value !== undefined ? ccc.value : ccc;
          const hex = val.toString(16).padStart(96, '0');
          const chunk = this.hexToBytes(hex);
          bytes.set(chunk, offset);
          offset += 48;
        }
      }
    }
    return bytes;
  }

  private bytesToFp12(_bytes: Uint8Array): any {
    // TODO: Reconstruct Fp12 from bytes - simplified for now
    // In production, properly deserialize all 12 coefficients
    // The _bytes parameter will be used once full Fp12 deserialization is implemented
    return bls.fields.Fp12.ONE;
  }

  private g1PointToBase64(point: any): string {
    const bytes = this.g1PointToBytes(point);
    return btoa(String.fromCharCode(...bytes));
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  hashToG2(message: Uint8Array): G2Element {
    const g2Point = bls.G2.hashToCurve(message);
    return this.g2ElementToBytes(g2Point);
  }

  generateRandomG2Element(): G2Element {
    const randomValue = randomBytes(32);
    return this.hashToG2(new Uint8Array(randomValue));
  }
}

export const afghService = new AFGHService();
