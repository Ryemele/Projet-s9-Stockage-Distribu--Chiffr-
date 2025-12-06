const https = require('https');
const crypto = require('crypto');

const agent = new https.Agent({ rejectUnauthorized: false });
const API_URL = 'https://localhost:3000/api';

async function testAliceUpload() {
    try {
        // 1. Login as Alice
        console.log('1. Logging in as Alice...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'alice@test.com',
                password: 'Password123!'
            }),
            agent
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status}`);
        }
        const { token } = await loginRes.json();
        console.log('   ✓ Logged in successfully');

        // 2. Generate a small test file
        console.log('2. Creating test file...');
        const fileContent = 'This is a test file for Alice!\nTesting file upload and preview.';
        const fileName = 'alice_test.txt';
        const fileSize = Buffer.byteLength(fileContent);

        // Mock encryption metadata (in real app, frontend would generate this)
        const mockMetadata = {
            type: 'level2',
            u: crypto.randomBytes(48).toString('base64'),
            v: JSON.stringify({ c0: '12345', c1: '67890' })
        };

        const metadata = {
            name: fileName,
            size: fileSize,
            mimeType: 'text/plain',
            iv: JSON.stringify(mockMetadata),
            salt: 'test-salt'
        };

        // 3. Upload file
        console.log('3. Uploading file...');
        const boundary = '----TestBoundary';
        const pre = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: text/plain\r\n\r\n`;
        const mid = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${JSON.stringify(metadata)}`;
        const post = `\r\n--${boundary}--`;

        const body = Buffer.concat([
            Buffer.from(pre),
            Buffer.from(fileContent),
            Buffer.from(mid),
            Buffer.from(post)
        ]);

        const uploadRes = await fetch(`${API_URL}/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: body,
            agent
        });

        if (!uploadRes.ok) {
            const text = await uploadRes.text();
            throw new Error(`Upload failed: ${uploadRes.status} ${text}`);
        }

        const uploadData = await uploadRes.json();
        console.log(`   ✓ File uploaded successfully! ID: ${uploadData.id}`);

        // 4. Verify file appears in list
        console.log('4. Verifying file in list...');
        const listRes = await fetch(`${API_URL}/files`, {
            headers: { 'Authorization': `Bearer ${token}` },
            agent
        });

        if (!listRes.ok) {
            throw new Error(`List files failed: ${listRes.status}`);
        }

        const files = await listRes.json();
        console.log(`   ✓ Found ${files.length} file(s)`);

        const uploadedFile = files.find(f => f.id === uploadData.id);
        if (uploadedFile) {
            console.log(`   ✓ File verified: ${uploadedFile.name}`);
        }

        console.log('\n✅ SUCCESS: Alice can upload and view files!');
        return { token, fileId: uploadData.id, fileName };

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        process.exit(1);
    }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
testAliceUpload().then(result => {
    console.log('\nTest result:', result);
    process.exit(0);
});
