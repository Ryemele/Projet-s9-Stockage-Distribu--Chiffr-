-- Schéma complet pour le stockage distribué chiffré
-- Créé pour l'intégration Frontend-Gateway-MinIO

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- TABLE USERS
-- =====================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    public_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- TABLE FOLDERS
-- =====================
CREATE TABLE IF NOT EXISTS folders (
    folder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT 'blue',
    parent_folder_id UUID REFERENCES folders(folder_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- TABLE TEAMS
-- =====================
CREATE TABLE IF NOT EXISTS teams (
    team_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    settings TEXT
);

-- =====================
-- TABLE TEAM_MEMBERS
-- =====================
CREATE TABLE IF NOT EXISTS team_members (
    member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- TABLE FILES
-- =====================
CREATE TABLE IF NOT EXISTS files (
    file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(folder_id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(team_id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT NOT NULL,
    total_chunks INTEGER NOT NULL DEFAULT 1,
    is_chunked INTEGER DEFAULT 0,
    checksum VARCHAR(64),
    encryption_key_wrapped TEXT,
    iv TEXT,
    salt TEXT,
    starred INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- TABLE CHUNKS
-- =====================
CREATE TABLE IF NOT EXISTS chunks (
    chunk_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    minio_node INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(file_id, chunk_index)
);

-- =====================
-- TABLE SHARES
-- =====================
CREATE TABLE IF NOT EXISTS shares (
    share_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    shared_with_email TEXT NOT NULL,
    encrypted_key TEXT,
    permissions TEXT NOT NULL DEFAULT 'read',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(file_id, shared_with_email)
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_shares_file ON shares(file_id);
CREATE INDEX IF NOT EXISTS idx_shares_recipient ON shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================
-- Message de confirmation
-- =====================
DO $$
BEGIN
    RAISE NOTICE 'Database schema initialized successfully!';
END $$;