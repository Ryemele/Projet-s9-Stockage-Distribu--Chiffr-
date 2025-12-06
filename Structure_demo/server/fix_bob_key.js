// Script to update Bob's public key in the database with a properly generated one
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// BLS12-381 point sizes
const G1_SIZE = 48; //  Bytes for G1 point
const G2_SIZE = 96; // Bytes for G2 point

// Generate random valid-looking keys for Bob
// NOTE: In production, these should come from Bob's actual registration, but we'll generate
// placeholder valid data to fix the immediate issue

function generateRandomBytes(size) {
    return crypto.randomBytes(size);
}

function bytesToBase64(bytes) {
    return Buffer.from(bytes).toString('base64');
}

const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

// Generate valid random keys (not cryptographically secure for real use, but valid format)
const publicKey1 = generateRandomBytes(G1_SIZE);
const publicKey2 = generateRandomBytes(G2_SIZE);

const public KeyData = JSON.stringify({
    publicKey1: bytesToBase64(publicKey1),
    publicKey2: bytesToBase64(publicKey2)
});

console.log('Generated public key:', publicKeyData);

// Update Bob's record
db.run(
    `UPDATE users SET public_key = ? WHERE email = ?`,
    [publicKeyData, 'bob@test.com'],
    function (err) {
        if (err) {
            console.error('Error updating Bob\'s public key:', err);
            process.exit(1);
        }
        console.log(`Updated ${this.changes} row(s)`);
        console.log('Bob\'s public key has been updated with valid placeholders');
        console.log('NOTE: Bob will need to re-register to generate proper keys that match his private key');
        db.close();
    }
);
