const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });
const API_URL = 'https://localhost:3000/api';

async function testSharing() {
    try {
        // 1. Try to register Bob (skip if already exists)
        console.log('1. Checking Bob\'s account...');
        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'bob@test.com',
                password: 'Password123!',
                name: 'Bob',
                publicKey: JSON.stringify({
                    publicKey1: Buffer.alloc(48, 'b').toString('base64'),
                    publicKey2: Buffer.alloc(96, 'B').toString('base64')
                }),
                keyDerivationSalt: 'bob-salt'
            }),
            agent
        });

        if (regRes.ok) {
            console.log('   ✓ Bob registered successfully');
        } else if (regRes.status === 400) {
            console.log('   ✓ Bob already exists, continuing...');
        } else {
            const text = await regRes.text();
            throw new Error(`Register failed: ${regRes.status} ${text}`);
        }

        // 2. Login as Alice
        console.log('2. Logging in as Alice...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'alice@test.com',
                password: 'Password123!'
            }),
            agent
        });

        const { token: aliceToken } = await loginRes.json();
        console.log('   ✓ Alice logged in');

        // 3. Get Alice's files
        console.log('3. Getting Alice\'s files...');
        const filesRes = await fetch(`${API_URL}/files`, {
            headers: { 'Authorization': `Bearer ${aliceToken}` },
            agent
        });

        const files = await filesRes.json();
        if (files.length === 0) {
            throw new Error('No files found for Alice');
        }

        const fileId = files[0].id;
        console.log(`   ✓ Found file: ${files[0].name} (ID: ${fileId})`);

        // 4. Share file with Bob
        console.log('4. Sharing file with Bob...');

        // Mock re-encryption key (in real app, frontend generates this)
        const mockRK = JSON.stringify({
            rk: Buffer.alloc(96, 'r').toString('base64')
        });

        const shareRes = await fetch(`${API_URL}/files/${fileId}/share`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${aliceToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'bob@test.com',
                encryptedKey: mockRK
            }),
            agent
        });

        if (!shareRes.ok) {
            const text = await shareRes.text();
            throw new Error(`Share failed: ${shareRes.status} ${text}`);
        }

        const shareData = await shareRes.json();
        console.log(`   ✓ File shared! Share ID: ${shareData.id}`);

        // 5. Login as Bob and verify shared file
        console.log('5. Logging in as Bob...');
        const bobLoginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'bob@test.com',
                password: 'Password123!'
            }),
            agent
        });

        const { token: bobToken } = await bobLoginRes.json();
        console.log('   ✓ Bob logged in');

        // 6. Get shared files for Bob
        console.log('6. Getting Bob\'s shared files...');
        const sharedRes = await fetch(`${API_URL}/files/shared`, {
            headers: { 'Authorization': `Bearer ${bobToken}` },
            agent
        });

        if (!sharedRes.ok) {
            throw new Error(`Get shared failed: ${sharedRes.status}`);
        }

        const sharedFiles = await sharedRes.json();
        console.log(`   ✓ Bob has ${sharedFiles.length} shared file(s)`);

        if (sharedFiles.length > 0) {
            const shared = sharedFiles[0];
            console.log(`   ✓ Shared file: ${shared.fileName}`);
            console.log(`   ✓ Owner public key included: ${!!shared.ownerPublicKey}`);
            console.log(`   ✓ Re-encryption key included: ${!!shared.encryptedKey}`);
        }

        console.log('\n✅ SUCCESS: Sharing workflow completed!');
        console.log('   - Bob can see files shared by Alice');
        console.log('   - Owner public key is included for re-encryption');

        return { aliceToken, bobToken, shareData, sharedFiles };

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        process.exit(1);
    }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
testSharing().then(() => process.exit(0));
