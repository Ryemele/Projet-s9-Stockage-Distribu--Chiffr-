// fix_file_path.js - Fix the storage path for alice_test.txt
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// The actual file that exists
const actualFilename = '2323ed43-64f8-47da-bd51-455363c9c4ca-alice_test.txt';
const actualPath = path.join(__dirname, 'uploads', actualFilename);

// The file ID in the database
const fileId = '39f2d0bb-190a-4487-9194-8467a46ac312';

console.log('Checking if actual file exists:', actualPath);
if (!fs.existsSync(actualPath)) {
    console.error('ERROR: Actual file does not exist at:', actualPath);
    process.exit(1);
}

console.log('✓ Actual file exists');
console.log('Updating database storage_path for file ID:', fileId);

db.run(
    `UPDATE files SET storage_path = ? WHERE id = ?`,
    [actualPath, fileId],
    function (err) {
        if (err) {
            console.error('Error updating storage path:', err);
            process.exit(1);
        }
        console.log(`✓ Updated ${this.changes} row(s)`);
        console.log('File storage path has been fixed!');

        // Verify
        db.get(`SELECT id, name, storage_path FROM files WHERE id = ?`, [fileId], (err, file) => {
            if (err) {
                console.error('Error verifying:', err);
            } else {
                console.log('\nVerification:');
                console.log(`  File ID: ${file.id}`);
                console.log(`  File Name: ${file.name}`);
                console.log(`  Storage Path: ${file.storage_path}`);
                console.log(`  Exists: ${fs.existsSync(file.storage_path) ? 'YES' : 'NO'}`);
            }
            db.close();
        });
    }
);
