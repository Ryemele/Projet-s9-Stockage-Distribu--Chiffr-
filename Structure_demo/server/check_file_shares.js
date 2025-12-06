// check_file_shares.js - Check what files exist and what shares are active
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('\n=== CHECKING FILES FOR ALICE ===');
db.all(`SELECT id, name, user_id FROM files WHERE user_id = (SELECT id FROM users WHERE email = 'alice@test.com')`, [], (err, files) => {
    if (err) {
        console.error('Error querying files:', err);
    } else {
        console.log(`Found ${files.length} files for Alice:`);
        files.forEach(f => console.log(`  - ID: ${f.id}, Name: ${f.name}`));
    }

    console.log('\n=== CHECKING SHARES FOR BOB ===');
    db.all(`SELECT * FROM shares WHERE shared_with = 'bob@test.com'`, [], (err, shares) => {
        if (err) {
            console.error('Error querying shares:', err);
        } else {
            console.log(`Found ${shares.length} shares for Bob:`);
            shares.forEach(s => console.log(`  - Share ID: ${s.id}, File ID: ${s.file_id}, Shared by: ${s.shared_by}`));

            // Check if file IDs in shares actually exist
            if (shares.length > 0) {
                console.log('\n=== VALIDATING SHARE FILE IDS ===');
                shares.forEach(share => {
                    db.get(`SELECT id, name FROM files WHERE id = ?`, [share.file_id], (err, file) => {
                        if (err) {
                            console.error(`Error checking file ${share.file_id}:`, err);
                        } else if (file) {
                            console.log(`  ✓ Share ${share.id} -> File ${file.id} (${file.name}) EXISTS`);
                        } else {
                            console.log(`  ✗ Share ${share.id} -> File ${share.file_id} MISSING (404 will occur)`);
                        }
                    });
                });
            }
        }

        setTimeout(() => db.close(), 1000);
    });
});
