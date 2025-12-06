// fix_bob_account.js - Delete Bob's account completely so he can re-register properly
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('[fix_bob_account] Deleting Bob\'s account from database...');

// Delete Bob from users table
db.run(`DELETE FROM users WHERE email = ?`, ['bob@test.com'], function (err) {
    if (err) {
        console.error('Error deleting Bob from users:', err);
        db.close();
        process.exit(1);
    }
    console.log(`[fix_bob_account] Deleted ${this.changes} user record(s) for bob@test.com`);

    // Also delete any shares involving Bob
    db.run(`DELETE FROM shares WHERE shared_by = ? OR shared_with = ?`, ['bob@test.com', 'bob@test.com'], function (err) {
        if (err) {
            console.error('Error deleting Bob\'s shares:', err);
        } else {
            console.log(`[fix_bob_account] Deleted ${this.changes} share record(s) involving bob@test.com`);
        }

        console.log('[fix_bob_account] Bob\'s account has been completely removed.');
        console.log('[fix_bob_account] Bob can now re-register with a fresh account that will generate matching keys.');

        db.close();
    });
});
