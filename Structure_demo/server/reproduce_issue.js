const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Ignore self-signed certs
const agent = new https.Agent({
    rejectUnauthorized: false
});

const API_URL = 'https://localhost:3000/api';

async function run() {
    try {
        // 1. Register
        const email = `reproduce-${Date.now()}@test.com`;
        console.log(`1. Registering user: ${email}...`);

        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password: 'Password123!',
                name: 'Reproduction Tester',
                publicKey: 'mock-pk',
                keyDerivationSalt: 'mock-salt'
            }),
            agent
        });

        if (!regRes.ok) throw new Error(`Register failed: ${regRes.status}`);
        const { token } = await regRes.json();
        console.log('   Registered successfully.');

        // 2. Generate Random File
        console.log('2. Generating random file...');
        const fileSize = 1024;
        const randomBuffer = crypto.randomBytes(fileSize);
        const fileName = `reproduce-${Date.now()}.bin`;

        // 3. Mock Encryption Metadata (Large)
        const mockMetadata = {
            type: 'level2',
            u: Buffer.alloc(100).toString('base64'), // Mock U point
            v: JSON.stringify({
                c0: BigInt('12345678901234567890').toString(),
                c1: BigInt('98765432109876543210').toString()
            }) // Mock V (Fp12)
        };

        const metadata = {
            name: fileName,
            size: fileSize,
            mimeType: 'application/octet-stream',
            iv: JSON.stringify(mockMetadata), // This is what frontend does
            salt: 'unused'
        };

        // 4. Upload
        console.log('3. Uploading file with large metadata...');
        const boundary = '----WebKitFormBoundaryReproduction';

        // Construct multipart body manually
        const pre = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
        const mid = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${JSON.stringify(metadata)}`;
        const post = `\r\n--${boundary}--`;

        const bodyBuffer = Buffer.concat([
            Buffer.from(pre),
            randomBuffer,
            Buffer.from(mid),
            Buffer.from(post)
        ]);

        const upRes = await fetch(`${API_URL}/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: bodyBuffer,
            agent
        });

        if (!upRes.ok) {
            const text = await upRes.text();
            throw new Error(`Upload failed: ${upRes.status} ${text}`);
        }
        const upData = await upRes.json();
        console.log('   Upload successful:', upData.id);

    } catch (err) {
        console.error('REPRODUCTION FAILED:', err);
        process.exit(1);
    }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
run();
