import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';

interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

interface DatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
}

let dbClient: DatabaseClient | null = null;
let initialized = false;

const SCHEMA_DDL = `
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
  share_type VARCHAR(32) NOT NULL,
  access_type VARCHAR(32) NOT NULL,
  password_hash TEXT,
  plain_password VARCHAR(128),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_revoked BOOLEAN DEFAULT FALSE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_note_id ON share_links(note_id);
CREATE INDEX IF NOT EXISTS idx_share_links_user_id ON share_links(user_id);
`;

async function getClient(): Promise<DatabaseClient> {
  if (dbClient) return dbClient;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // External PostgreSQL (Neon, Supabase, RDS, local postgres)
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('supabase')
        ? { rejectUnauthorized: false }
        : undefined,
    });
    dbClient = {
      async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
        const res = await pool.query(sql, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      },
    };
  } else {
    // Embedded WASM PostgreSQL engine with persistent file store
    const dataDir = path.join(process.cwd(), '.pgdata');
    const pglite = new PGlite(dataDir);
    dbClient = {
      async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
        const res = await pglite.query(sql, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      },
    };
  }

  return dbClient;
}

export async function ensureDatabase(): Promise<void> {
  if (initialized) return;
  const client = await getClient();
  const statements = SCHEMA_DDL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await client.query(stmt);
    } catch (err) {
      console.error('Error running initial DDL statement:', err);
    }
  }

  // Seed demo evaluator account if not exists
  try {
    const demoUser = await client.query("SELECT id FROM users WHERE email = 'demo@peacockindia.in'");
    if (demoUser.rows.length === 0) {
      const bcrypt = await import('bcryptjs');
      const demoHash = await bcrypt.default.hash('Password123!', 10);
      await client.query(
        "INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)",
        ['demo-user-poc', 'demo@peacockindia.in', 'Peacock Evaluator', demoHash]
      );
      console.log('Demo evaluator account seeded: demo@peacockindia.in / Password123!');
    }
  } catch (seedErr) {
    console.error('Seed user check error:', seedErr);
  }

  initialized = true;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
  await ensureDatabase();
  const client = await getClient();
  return client.query<T>(sql, params);
}

