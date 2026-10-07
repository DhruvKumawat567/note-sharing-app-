-- Complete PostgreSQL Schema for Note-Sharing POC Application

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS share_links (
  id VARCHAR(64) PRIMARY KEY,
  note_id VARCHAR(64) NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(128) UNIQUE NOT NULL,
  share_type VARCHAR(32) NOT NULL, -- 'ONE_TIME' or 'TIME_BASED'
  access_type VARCHAR(32) NOT NULL, -- 'PUBLIC' or 'PASSWORD_PROTECTED'
  password_hash TEXT,              -- bcrypt hash if access_type = 'PASSWORD_PROTECTED'
  plain_password VARCHAR(128),     -- saved for owner's reference in dashboard
  expires_at TIMESTAMP WITH TIME ZONE, -- for TIME_BASED expiration
  is_revoked BOOLEAN DEFAULT FALSE NOT NULL, -- owner force revocation
  is_used BOOLEAN DEFAULT FALSE NOT NULL,    -- for ONE_TIME links
  used_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0 NOT NULL,     -- view counter incremented atomically
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for lightning fast lookups & concurrency performance
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_note_id ON share_links(note_id);
CREATE INDEX IF NOT EXISTS idx_share_links_user_id ON share_links(user_id);
