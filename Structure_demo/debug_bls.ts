import { bls12_381 } from '@noble/curves/bls12-381.js';
const p = bls12_381.G1.Point.BASE;
const bytes = p.toBytes();
console.log('Bytes:', bytes);
try {
    const p2 = bls12_381.G1.Point.fromHex(bytes);
    console.log('fromHex(bytes) success');
} catch (e) {
    console.log('fromHex(bytes) failed:', e.message);
}
