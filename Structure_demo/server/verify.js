const https = require('https');

// Ignore self-signed certs
const agent = new https.Agent({
    rejectUnauthorized: false
});

const API_URL = 'https://localhost:3000/api';

async function run() {
    try {
        console.log('1. Registering...');
        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `test-${Date.now()}@example.com`,
                password: 'Password123!',
                name: 'Test User',
                publicKey: 'mock-pk',
                keyDerivationSalt: 'mock-salt'
            }),
            agent
        });

        if (!regRes.ok) {
            const text = await regRes.text();
            throw new Error(`Register failed: ${regRes.status} ${text}`);
        }
        const regData = await regRes.json();
        console.log('Registered:', regData.user.email);
        const token = regData.token;

        console.log('2. Uploading...');
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        const content = 'Hello World Content';
        const body =
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--`;

        const upRes = await fetch(`${API_URL}/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: body,
            agent
        });

        if (!upRes.ok) {
            const text = await upRes.text();
            throw new Error(`Upload failed: ${upRes.status} ${text}`);
        }
        const upData = await upRes.json();
        console.log('Uploaded:', upData.name);

        console.log('3. Listing...');
        const listRes = await fetch(`${API_URL}/files`, {
            headers: { 'Authorization': `Bearer ${token}` },
            agent
        });
        const listData = await listRes.json();
        console.log('Files found:', listData.length);

        console.log('SUCCESS: Backend is working!');

    } catch (err) {
        console.error('FAILED:', err);
        process.exit(1);
    }
}

// Patch fetch to use agent (Node fetch doesn't support agent directly in options like this, 
// but we can use a custom dispatcher if using undici, or just use https.request for low level.
// Actually, for Node 18+ fetch, we need to set the dispatcher.
// Let's use simple https.request to be safe and dependency-free for the agent part, 
// OR just use 'process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"' for this test script.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

run();
