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
        const email = `random-${Date.now()}@test.com`;
        console.log(`1. Registering user: ${email}...`);

        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password: 'Password123!',
                name: 'Random Tester',
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
        const fileSize = Math.floor(Math.random() * 1024 * 1024) + 1024; // 1KB to 1MB
        const randomBuffer = crypto.randomBytes(fileSize);
        const fileName = `random-${Date.now()}.bin`;
        const fileHash = crypto.createHash('sha256').update(randomBuffer).digest('hex');

        console.log(`   File: ${fileName}`);
        console.log(`   Size: ${fileSize} bytes`);
        console.log(`   Hash: ${fileHash}`);

        // 3. Upload
        console.log('3. Uploading file...');
        const boundary = '----WebKitFormBoundaryRandom';

        // Construct multipart body manually for Node.js fetch
        const pre = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
        const post = `\r\n--${boundary}--`;

        const bodyBuffer = Buffer.concat([
            Buffer.from(pre),
            randomBuffer,
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

        // 4. Download & Verify
        console.log('4. Downloading and verifying...');
        const downRes = await fetch(`${API_URL}/files/${upData.id}/download`, {
            headers: { 'Authorization': `Bearer ${token}` },
            agent
        });

        if (!downRes.ok) throw new Error(`Download failed: ${downRes.status}`);

        const downBuffer = Buffer.from(await downRes.arrayBuffer());
        const downHash = crypto.createHash('sha256').update(downBuffer).digest('hex');

        console.log(`   Downloaded Size: ${downBuffer.length} bytes`);
        console.log(`   Downloaded Hash: ${downHash}`);

        if (fileHash === downHash) {
            console.log('SUCCESS: File integrity verified!');
        } else {
            console.error('FAILURE: Hash mismatch!');
            process.exit(1);
        }

    } catch (err) {
        console.error('TEST FAILED:', err);
        process.exit(1);
    }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
run();
