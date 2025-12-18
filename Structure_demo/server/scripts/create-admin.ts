/**
 * Migration script to add role column and create admin user
 * Run: npx ts-node scripts/create-admin.ts
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    const db = await open({
        filename: path.join(__dirname, '../database.sqlite'),
        driver: sqlite3.Database
    });

    console.log('Adding role column if not exists...');

    // Check if role column exists
    const tableInfo = await db.all('PRAGMA table_info(users)');
    const hasRole = tableInfo.some((col: any) => col.name === 'role');

    if (!hasRole) {
        await db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
        console.log('✅ Role column added');
    } else {
        console.log('ℹ️ Role column already exists');
    }

    // Create admin user
    const adminEmail = 'admin@securebox.local';
    const adminPassword = 'Admin@SecureBox123!';

    const existingAdmin = await db.get('SELECT * FROM users WHERE email = ?', [adminEmail]);

    if (existingAdmin) {
        // Update existing user to admin
        await db.run('UPDATE users SET role = ? WHERE email = ?', ['admin', adminEmail]);
        console.log(`✅ User ${adminEmail} updated to admin role`);
    } else {
        // Create new admin user
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        const userId = uuidv4();
        const createdAt = new Date().toISOString();

        await db.run(
            'INSERT INTO users (id, email, password_hash, name, public_key, created_at, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, adminEmail, hashedPassword, 'Admin', '{}', createdAt, 'admin']
        );

        console.log('✅ Admin user created:');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
    }

    // List all users with roles
    console.log('\n📋 All users:');
    const users = await db.all('SELECT id, email, name, role FROM users');
    users.forEach((u: any) => {
        console.log(`   ${u.email} - ${u.role || 'user'}`);
    });

    await db.close();
    console.log('\n✅ Done!');
}

main().catch(console.error);
