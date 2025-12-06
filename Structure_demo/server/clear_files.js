const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

async function clearFiles() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    // Show current files
    const files = await db.all('SELECT id, name, iv FROM files');
    console.log('Current files:');
    files.forEach(f => {
        console.log(`  - ${f.name}: iv = ${f.iv?.substring(0, 50)}...`);
    });

    // Delete all files
    await db.run('DELETE FROM files');
    console.log('\nAll files deleted from database.');

    // Also delete physical files
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
        const uploadedFiles = fs.readdirSync(uploadsDir);
        uploadedFiles.forEach(f => {
            const filePath = path.join(uploadsDir, f);
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
                console.log(`Deleted: ${f}`);
            }
        });
    }

    await db.close();
    console.log('Done!');
}

clearFiles().catch(console.error);
