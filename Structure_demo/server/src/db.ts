import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';

let db: Database;

export const initDB = async () => {
  db = await open({
    filename: path.join(__dirname, '../database.sqlite'),
    driver: sqlite3.Database
  });

  await db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      name TEXT,
      public_key TEXT,
      created_at TEXT
    );

    -- Files table (updated for distributed storage)
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      size INTEGER,
      mime_type TEXT,
      storage_path TEXT,           -- For legacy single-file storage
      iv TEXT,                      -- Encryption metadata
      salt TEXT,
      uploaded_at TEXT,
      encrypted_data_url TEXT,      -- For compatibility with frontend
      checksum TEXT,                -- SHA256 of original file
      is_chunked INTEGER DEFAULT 0, -- 1 if stored as chunks
      total_chunks INTEGER,         -- Total number of data chunks
      total_shards INTEGER,         -- Total shards (data + parity)
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- Shares table
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      file_id TEXT,
      shared_by TEXT,
      shared_with TEXT,
      encrypted_key TEXT,
      permissions TEXT,
      created_at TEXT,
      FOREIGN KEY(file_id) REFERENCES files(id),
      FOREIGN KEY(shared_by) REFERENCES users(id)
    );

    -- Storage nodes registry
    CREATE TABLE IF NOT EXISTS storage_nodes (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      port INTEGER NOT NULL,
      status TEXT DEFAULT 'offline',
      last_heartbeat TEXT,
      chunks_stored INTEGER DEFAULT 0,
      storage_used INTEGER DEFAULT 0,
      created_at TEXT
    );

    -- Shards table - tracks where each shard is stored
    CREATE TABLE IF NOT EXISTS shards (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      shard_index INTEGER NOT NULL,
      shard_id TEXT NOT NULL,       -- Content-addressable ID (SHA256)
      is_data INTEGER NOT NULL,     -- 1 for data shard, 0 for parity
      size INTEGER NOT NULL,
      node_id TEXT,                 -- Which storage node has this shard
      node_url TEXT,
      stored INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 0,
      created_at TEXT,
      FOREIGN KEY(file_id) REFERENCES files(id),
      FOREIGN KEY(node_id) REFERENCES storage_nodes(id)
    );

    -- Index for faster shard lookups
    CREATE INDEX IF NOT EXISTS idx_shards_file_id ON shards(file_id);
    CREATE INDEX IF NOT EXISTS idx_shards_node_id ON shards(node_id);
  `);

  console.log('Database initialized with distributed storage schema');
  return db;
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

