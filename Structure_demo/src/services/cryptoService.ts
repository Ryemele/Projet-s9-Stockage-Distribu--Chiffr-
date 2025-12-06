import { bls12_381 } from '@noble/curves/bls12-381.js';
import { randomBytes, bytesToHex } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

// Type definitions for our keys and ciphertexts
export interface KeyPair {
  publicKey: {
    u1: Uint8Array; // Point on G1
    u2: Uint8Array; // Point on G2 (Adapted for Type 3 pairing)
  };
  privateKey: {
    u1: bigint;
    u2: bigint;
  };
  email: string;
}

export interface ReEncryptionKey {
  rk: Uint8Array; // Point on G2
}

export interface FileEnvelope {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  encryptedData: string; // Base64 of AES-GCM ciphertext
  encryptionMetadata: {
    type: 'level2' | 're-encrypted';
    u: string; // Base64
    v: string; // Base64
    // For re-encrypted:
    c1_prime?: string;
    c2_prime?: string;
    a1?: string;
    a2?: string;
  };
  timestamp: string;
}

export type ProgressCallback = (progress: number, message: string) => void;

// Helper to convert Fp12 (GT) to bytes for KDF
function gtToBytes(gtElement: any): Uint8Array {
  const str = JSON.stringify(gtElement, (_, v) => typeof v === 'bigint' ? v.toString() : v);
  return sha256(new TextEncoder().encode(str));
}

class CryptoService {
  private G1 = bls12_381.G1;
  private G2 = bls12_381.G2;
  private Fr = bls12_381.fields.Fr; // Scalar field

  // Generate random scalar in Fr
  private randomScalar(): bigint {
    const bytes = randomBytes(32);
    const num = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
    return num % this.Fr.ORDER;
  }

  async generateKeyPair(email: string): Promise<KeyPair> {
    const u1 = this.randomScalar();
    const u2 = this.randomScalar();

    const U1 = this.G1.Point.BASE.multiply(u1);
    const U2 = this.G2.Point.BASE.multiply(u2); // Adapted to G2 for Type 3 pairing

    return {
      publicKey: {
        u1: U1.toBytes(),
        u2: U2.toBytes(),
      },
      privateKey: { u1, u2 },
      email
    };
  }

  // KDF: GT element -> AES Key
  private async kdf(gtElement: any): Promise<CryptoKey> {
    const keyMaterial = gtToBytes(gtElement);
    return await window.crypto.subtle.importKey(
      'raw',
      keyMaterial as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt File (Level 2 KEM-DEM)
  async encryptFile(
    file: File,
    keyPair: KeyPair,
    onProgress?: ProgressCallback
  ): Promise<FileEnvelope> {
    onProgress?.(10, "Generating session key...");

    // 1. Generate ephemeral k
    const k = this.randomScalar();

    // 2. Calculate U = g^k (in G1)
    const U = this.G1.Point.BASE.multiply(k);

    // 3. Calculate V = M * e(A1, A2)^k
    const A1 = this.G1.Point.fromHex(bytesToHex(keyPair.publicKey.u1));
    const A2 = this.G2.Point.fromHex(bytesToHex(keyPair.publicKey.u2));

    // Compute Z_factor = e(A1, A2)^k
    const pairingResult = bls12_381.pairing(A1, A2);
    const Z_factor = bls12_381.fields.Fp12.pow(pairingResult, k);

    // Generate M (Session Key Seed)
    const m_scalar = this.randomScalar();
    const gen_pairing = bls12_381.pairing(this.G1.Point.BASE, this.G2.Point.BASE);
    const M = bls12_381.fields.Fp12.pow(gen_pairing, m_scalar);

    // V = M * Z_factor
    const V = bls12_381.fields.Fp12.mul(M, Z_factor);

    // Derive AES key from M
    const aesKey = await this.kdf(M);

    onProgress?.(30, "Encrypting file content...");
    const fileBuffer = await file.arrayBuffer();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      fileBuffer
    );

    // Combine IV + Ciphertext
    const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedContent), iv.length);

    return {
      fileId: `file_${Date.now()}`,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      encryptedData: this.arrayBufferToBase64(combined.buffer as ArrayBuffer),
      encryptionMetadata: {
        type: 'level2',
        u: this.arrayBufferToBase64(U.toBytes().buffer as ArrayBuffer),
        v: JSON.stringify(V, (_, v) => typeof v === 'bigint' ? v.toString() : v)
      },
      timestamp: new Date().toISOString()
    };
  }

  // Generate Re-Encryption Key
  generateReEncryptionKey(skA: KeyPair['privateKey'], pkB: KeyPair['publicKey']): ReEncryptionKey {
    // Adapted Scheme for Correctness:
    // rk = B2^(a1 * a2) = g2^(b2 * a1 * a2)
    const B2 = this.G2.Point.fromHex(bytesToHex(pkB.u2));
    const scalar = bls12_381.fields.Fr.mul(skA.u1, skA.u2); // a1 * a2

    const rk = B2.multiply(scalar);
    return { rk: rk.toBytes() };
  }

  // Re-Encrypt
  reEncrypt(
    envelope: FileEnvelope,
    rk: ReEncryptionKey,
    pkA: KeyPair['publicKey']
  ): FileEnvelope {
    if (envelope.encryptionMetadata.type !== 'level2') {
      throw new Error("Can only re-encrypt level 2 ciphertexts");
    }

    const U = this.G1.Point.fromHex(bytesToHex(this.base64ToUint8Array(envelope.encryptionMetadata.u)));
    const V = JSON.parse(envelope.encryptionMetadata.v, (_, v) => {
      if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
      return v;
    });
    const RK = this.G2.Point.fromHex(bytesToHex(rk.rk));

    // C1' = e(U, rk)
    const C1_prime = bls12_381.pairing(U, RK);

    // C2' = V
    const C2_prime = V;

    return {
      ...envelope,
      encryptionMetadata: {
        type: 're-encrypted',
        u: envelope.encryptionMetadata.u,
        v: envelope.encryptionMetadata.v,
        c1_prime: JSON.stringify(C1_prime, (_, v) => typeof v === 'bigint' ? v.toString() : v),
        c2_prime: JSON.stringify(C2_prime, (_, v) => typeof v === 'bigint' ? v.toString() : v),
        a1: this.arrayBufferToBase64(pkA.u1.buffer as ArrayBuffer),
        a2: this.arrayBufferToBase64(pkA.u2.buffer as ArrayBuffer)
      }
    };
  }

  // Decrypt
  async decryptFile(
    envelope: FileEnvelope,
    keyPair: KeyPair,
    onProgress?: ProgressCallback
  ): Promise<{ data: ArrayBuffer; fileName: string; mimeType: string }> {
    onProgress?.(10, "Processing envelope...");

    let M: any; // Fp12 element

    if (envelope.encryptionMetadata.type === 'level2') {
      // Direct decryption (Level 2)
      // M = V / e(U, A2)^a1

      const U = this.G1.Point.fromHex(bytesToHex(this.base64ToUint8Array(envelope.encryptionMetadata.u)));
      const V = JSON.parse(envelope.encryptionMetadata.v, (_, v) => {
        if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
        return v;
      });

      const A2 = this.G2.Point.BASE.multiply(keyPair.privateKey.u2);

      // Denom = e(U, A2)^a1
      const pairingVal = bls12_381.pairing(U, A2);
      const denom = bls12_381.fields.Fp12.pow(pairingVal, keyPair.privateKey.u1);

      // M = V * (1/denom)
      const denomInv = bls12_381.fields.Fp12.inv(denom);
      M = bls12_381.fields.Fp12.mul(V, denomInv);

    } else if (envelope.encryptionMetadata.type === 're-encrypted') {
      // Re-encrypted decryption
      // M = V / (C1')^(1/b2)

      const V = JSON.parse(envelope.encryptionMetadata.v, (_, v) => {
        if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
        return v;
      });

      const C1_prime = JSON.parse(envelope.encryptionMetadata.c1_prime!, (_, v) => {
        if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
        return v;
      });

      // Bob computes Mask = (C1')^(1/b2)
      const b2_inv = this.invertScalar(keyPair.privateKey.u2);
      const Mask = bls12_381.fields.Fp12.pow(C1_prime, b2_inv);

      // M = V / Mask
      const MaskInv = bls12_381.fields.Fp12.inv(Mask);
      M = bls12_381.fields.Fp12.mul(V, MaskInv);
    }

    // Derive Key and Decrypt
    const aesKey = await this.kdf(M);

    onProgress?.(60, "Decrypting content...");
    const encryptedBytes = this.base64ToUint8Array(envelope.encryptedData);
    const iv = encryptedBytes.slice(0, 12);
    const data = encryptedBytes.slice(12);

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        data
      );

      return {
        data: decrypted,
        fileName: envelope.fileName,
        mimeType: envelope.mimeType
      };
    } catch (e) {
      throw new Error("Decryption failed. Invalid key or corrupted data.");
    }
  }

  // Helpers
  private invertScalar(n: bigint): bigint {
    return bls12_381.fields.Fr.inv(n);
  }

  public arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  public serializeEnvelope(envelope: FileEnvelope): string {
    return btoa(JSON.stringify(envelope, (_, v) => {
      if (typeof v === 'bigint') return v.toString() + 'n';
      if (v instanceof Uint8Array) return Array.from(v);
      return v;
    }));
  }

  public deserializeEnvelope(data: string): FileEnvelope {
    return JSON.parse(atob(data), (_, v) => {
      if (typeof v === 'string' && /^\d+n$/.test(v)) return BigInt(v.slice(0, -1));
      if (Array.isArray(v) && v.every(item => typeof item === 'number')) return new Uint8Array(v);
      return v;
    });
  }
}

export const cryptoService = new CryptoService();
