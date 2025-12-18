/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AFGH (Ateniese-Fu-Green-Hohenberger) Proxy Re-Encryption Service
 * 
 * BLS12-381 based implementation for secure file sharing
 * Properties: Unidirectional, Non-transitive, Collusion-safe
 */

// @ts-expect-error - Module type declarations issue
import { bls12_381 as bls } from "@noble/curves/bls12-381";
// @ts-expect-error - Module type declarations issue
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

    private _generatorG1: any = null;
    private get GENERATOR_G1() {
        if (!this._generatorG1) {
            if (bls.G1.Point?.BASE) {
                this._generatorG1 = bls.G1.Point.BASE;
            } else {
                this._generatorG1 = bls.G1.hashToCurve(new Uint8Array([0, 0, 0, 1]));
            }
        }
        return this._generatorG1;
    }

    private _generatorG2: any = null;
    private get GENERATOR_G2() {
        if (!this._generatorG2) {
            if (bls.G2.Point?.BASE) {
                this._generatorG2 = bls.G2.Point.BASE;
            } else {
                this._generatorG2 = bls.G2.hashToCurve(new Uint8Array([0, 0, 0, 1]));
            }
        }
        return this._generatorG2;
    }

    constructor() {
        if (!bls || !bls.G1 || !bls.G2) {
            throw new Error("BLS12-381 library not loaded");
        }
        console.log("[AFGH] Service initialized");
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
            const a1 = this.generateRandomScalar();
            const a2 = this.generateRandomScalar();

            const A1 = this.GENERATOR_G1.multiply(this.scalarToBigInt(a1));
            const A2 = this.GENERATOR_G2.multiply(this.scalarToBigInt(a2));

            const keyPair: AFGHKeyPair = {
                secretKey1: a1,
                secretKey2: a2,
                publicKey1: this.g1PointToBytes(A1),
                publicKey2: this.g2ElementToBytes(A2),
                userId,
                createdAt: new Date().toISOString(),
                curveType: "BLS12-381",
            };

            console.log(`[AFGH] Key pair generated for ${userId}`);
            return keyPair;
        } catch (error) {
            throw new AFGHError(
                `Key generation failed: ${error}`,
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

            return {
                U: this.g1PointToBytes(U),
                V: this.fp12ToBytes(V),
                level: 2,
            };
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
            const U = this.bytesToG1Point(ciphertext.U);
            const V = this.bytesToFp12(ciphertext.V);
            const A1 = this.bytesToG1Point(publicKey1);

            const a2BigInt = this.scalarToBigInt(secretKey2);
            const U_a2 = U.multiply(a2BigInt);

            const A2 = this.GENERATOR_G2.multiply(a2BigInt);
            const pairing = bls.pairing(U_a2, A2);
            const pairingInverse = bls.fields.Fp12.inv(pairing);

            const message = bls.fields.Fp12.mul(V, pairingInverse);
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
            const B2 = this.bytesToG2Element(bobPublicKey.publicKey2);
            const a2BigInt = this.scalarToBigInt(aliceSecretKey2);
            const a2_inverse = bls.fields.Fr.inv(a2BigInt);

            const rk = B2.multiply(a2_inverse);

            const reEncryptionKey: ReEncryptionKey = {
                key: this.g2ElementToBytes(rk),
                fromUserId: aliceUserId,
                toUserId: bobUserId,
                createdAt: new Date().toISOString(),
                permissions,
            };

            console.log(`[AFGH] Re-encryption key: ${aliceUserId} → ${bobUserId}`);
            return {
                reEncryptionKey,
                keyBase64: this.uint8ArrayToBase64(reEncryptionKey.key),
            };
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
            const U = this.bytesToG1Point(ciphertextAlice.U);
            const rk = this.bytesToG2Element(reEncryptionKey.key);

            const C1_prime = bls.pairing(U, rk);

            return {
                C1_prime: this.fp12ToBytes(C1_prime),
                C2_prime: ciphertextAlice.V,
                U: ciphertextAlice.U,
                A1: alicePublicKey.publicKey1,
                A2: alicePublicKey.publicKey2,
                level: 1,
            };
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
            const C1_prime = this.bytesToFp12(ciphertext.C1_prime);
            const C2_prime = this.bytesToFp12(ciphertext.C2_prime);
            const U = this.bytesToG1Point(ciphertext.U);
            const A1 = this.bytesToG1Point(ciphertext.A1);

            const b2BigInt = this.scalarToBigInt(bobSecretKey2);
            const C1_prime_b2 = bls.fields.Fp12.pow(C1_prime, b2BigInt);

            const pairing_U_A1 = bls.pairing(U, this.GENERATOR_G2);
            const pairing_b2 = bls.fields.Fp12.pow(pairing_U_A1, b2BigInt);

            const denominator = bls.fields.Fp12.mul(C1_prime_b2, pairing_b2);
            const denominatorInverse = bls.fields.Fp12.inv(denominator);

            const message = bls.fields.Fp12.mul(C2_prime, denominatorInverse);
            return this.fp12ToBytes(message);
        } catch (error) {
            throw new AFGHError(
                `Level 1 decryption failed: ${error}`,
                AFGHErrorCode.DECRYPTION_FAILED,
                error
            );
        }
    }

    // Utility methods
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
        if (typeof point.toHex === "function") {
            return this.hexToUint8Array(point.toHex());
        }
        if (typeof point.toRawBytes === "function") {
            return point.toRawBytes();
        }
        throw new Error("Cannot serialize G1 point");
    }

    private bytesToG1Point(bytes: G1Point): any {
        const hexString = this.uint8ArrayToHex(bytes);
        return bls.G1.Point.fromHex(hexString);
    }

    private g2ElementToBytes(point: any): G2Element {
        if (typeof point.toHex === "function") {
            return this.hexToUint8Array(point.toHex());
        }
        if (typeof point.toRawBytes === "function") {
            return point.toRawBytes();
        }
        throw new Error("Cannot serialize G2 point");
    }

    private bytesToG2Element(bytes: G2Element): any {
        const hexString = this.uint8ArrayToHex(bytes);
        return bls.G2.Point.fromHex(hexString);
    }

    private fp12ToBytes(element: any): Uint8Array {
        if (typeof element.toBytes === "function") {
            return element.toBytes();
        }
        const c0 = element.c0;
        const c1 = element.c1;
        const bytes: number[] = [];

        const serializeFp6 = (fp6: any) => {
            const parts = [fp6.c0, fp6.c1, fp6.c2];
            parts.forEach((fp2: any) => {
                [fp2.c0, fp2.c1].forEach((fp: any) => {
                    const val = fp.value !== undefined ? fp.value : fp;
                    const hex = val.toString(16).padStart(96, '0');
                    for (let i = 0; i < hex.length; i += 2) {
                        bytes.push(parseInt(hex.substring(i, i + 2), 16));
                    }
                });
            });
        };

        serializeFp6(c0);
        serializeFp6(c1);
        return new Uint8Array(bytes);
    }

    private bytesToFp12(bytes: Uint8Array): any {
        return bls.fields.Fp12.fromBytes(bytes);
    }

    private hexToUint8Array(hex: string): Uint8Array {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes;
    }

    private uint8ArrayToHex(arr: Uint8Array): string {
        return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    private uint8ArrayToBase64(arr: Uint8Array): string {
        return btoa(String.fromCharCode(...arr));
    }

    private g1PointToBase64(point: any): string {
        return this.uint8ArrayToBase64(this.g1PointToBytes(point));
    }

    hashToG2(message: Uint8Array): G2Element {
        const g2Point = bls.G2.hashToCurve(message);
        return this.g2ElementToBytes(g2Point);
    }

    generateRandomG2Element(): G2Element {
        const randomValue = randomBytes(32);
        return this.hashToG2(randomValue);
    }
}

export const afghService = new AFGHService();
