const https = require('https');
const crypto = require('crypto');

// Ignore self-signed certs
const agent = new https.Agent({
    rejectUnauthorized: false
});

const API_URL = 'https://localhost:3000/api';

async function run() {
    try {
        // 1. Register
        const email = `bug-repro-${Date.now()}@test.com`;
        console.log(`1. Registering user: ${email}...`);

        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password: 'Password123!',
                name: 'Bug Repro',
                publicKey: 'mock-pk',
                keyDerivationSalt: 'mock-salt'
            }),
            agent
        });

        if (!regRes.ok) throw new Error(`Register failed: ${regRes.status}`);
        const { token } = await regRes.json();
        console.log('   Registered successfully.');

        // 2. Upload with INCORRECT Content-Type (missing boundary)
        console.log('2. Uploading file with missing boundary in header...');
        const boundary = '----WebKitFormBoundaryBug';
        const fileName = 'bug.txt';
        const fileContent = 'This is a bug test';

        const pre = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: text/plain\r\n\r\n`;
        const post = `\r\n--${boundary}--`;

        const bodyBuffer = Buffer.concat([
            Buffer.from(pre),
            Buffer.from(fileContent),
            Buffer.from(post)
        ]);

        const upRes = await fetch(`${API_URL}/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                // SIMULATING THE BUG: Setting Content-Type without boundary
                'Content-Type': 'multipart/form-data'
            },
            body: bodyBuffer,
            agent
        });

        if (!upRes.ok) {
            const text = await upRes.text();
            console.log(`   EXPECTED FAILURE: ${upRes.status} ${text}`);
            if (upRes.status === 400 || upRes.status === 500) {
                console.log('   SUCCESS: Bug reproduced!');
            } else {
                console.log('   WARNING: Failed with unexpected status code.');
            }
        } else {
            console.error('   FAILURE: Upload succeeded unexpectedly!');
            process.exit(1);
        }

    } catch (err) {
        console.error('TEST FAILED:', err);
        process.exit(1);
    }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
run();
