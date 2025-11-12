CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    public_key BYTEA NOT NULL -- for envelope encryption (PEM or raw)
);


CREATE TABLE IF NOT EXISTS files (
    file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS chunks (
    chunk_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    offset INT NOT NULL,
    size_bytes INT NOT NULL,
    sha256 TEXT NOT NULL, -- hash of ciphertext (recommended for E2E)
    etag TEXT,
    s3_key TEXT NOT NULL, -- e.g., fileId/chunkIndex or fileId/chunkId
    UNIQUE(file_id, offset)
);


CREATE TABLE IF NOT EXISTS shares (
    file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    grantee_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    enc_file_key BYTEA NOT NULL, -- file symmetric key encrypted with grantee's public key
    perms TEXT[] NOT NULL DEFAULT ARRAY['read'],
    PRIMARY KEY (file_id, grantee_id)
);


CREATE TABLE IF NOT EXISTS events (
    event_id BIGSERIAL PRIMARY KEY,
    file_id UUID,
    user_id UUID,
    type TEXT NOT NULL, -- upload_started, chunk_put, file_committed, share_granted, download
    details JSONB NOT NULL DEFAULT '{}',
    at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id, offset);
CREATE INDEX IF NOT EXISTS idx_events_file ON events(file_id, at DESC);