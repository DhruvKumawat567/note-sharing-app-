import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

interface DatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
}

// In-Memory Data Store for serverless fallback when external DB / PGlite WASM is unavailable
interface InMemUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

interface InMemNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface InMemShareLink {
  id: string;
  note_id: string;
  user_id: string;
  token: string;
  share_type: string;
  access_type: string;
  password_hash: string | null;
  plain_password: string | null;
  expires_at: string | null;
  is_revoked: boolean;
  is_used: boolean;
  used_at: string | null;
  view_count: number;
  created_at: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __MEM_DB__: {
    users: InMemUser[];
    notes: InMemNote[];
    share_links: InMemShareLink[];
  } | undefined;
  // eslint-disable-next-line no-var
  var __DB_CLIENT__: DatabaseClient | undefined;
}

if (!globalThis.__MEM_DB__) {
  globalThis.__MEM_DB__ = {
    users: [
      {
        id: 'demo-user-poc',
        email: 'demo@peacockindia.in',
        name: 'Peacock Evaluator',
        password_hash: bcrypt.hashSync('Password123!', 10),
        created_at: new Date().toISOString(),
      },
    ],
    notes: [
      {
        id: 'sample-note-1',
        user_id: 'demo-user-poc',
        title: 'Production AWS Secrets (Demo Note)',
        content: 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nREGION=ap-south-1',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    share_links: [
      {
        id: 'sample-link-1',
        note_id: 'sample-note-1',
        user_id: 'demo-user-poc',
        token: 'sample-demo-token-12345',
        share_type: 'TIME_BASED',
        access_type: 'PUBLIC',
        password_hash: null,
        plain_password: null,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        is_revoked: false,
        is_used: false,
        used_at: null,
        view_count: 3,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  };
}

function executeInMemoryQuery<T = any>(sql: string, params: any[] = []): QueryResult<T> {
  const mem = globalThis.__MEM_DB__!;
  const normalized = sql.trim().replace(/\s+/g, ' ');

  // 1. SELECT users by email
  if (normalized.includes('FROM users WHERE email = $1')) {
    const email = String(params[0]).toLowerCase();
    const found = mem.users.filter((u) => u.email.toLowerCase() === email);
    return { rows: found as T[], rowCount: found.length };
  }

  // 2. SELECT users by id
  if (normalized.includes('FROM users WHERE id = $1')) {
    const id = params[0];
    const found = mem.users.filter((u) => u.id === id);
    return { rows: found as T[], rowCount: found.length };
  }

  // 3. INSERT INTO users
  if (normalized.startsWith('INSERT INTO users')) {
    const [id, email, name, password_hash] = params;
    const newUser: InMemUser = {
      id,
      email: email.toLowerCase(),
      name,
      password_hash,
      created_at: new Date().toISOString(),
    };
    mem.users.push(newUser);
    return { rows: [newUser] as T[], rowCount: 1 };
  }

  // 4. SELECT notes list for user
  if (normalized.includes('FROM notes n') && normalized.includes('WHERE n.user_id = $1')) {
    const userId = params[0];
    const userNotes = mem.notes
      .filter((n) => n.user_id === userId)
      .map((n) => {
        const links = mem.share_links.filter((sl) => sl.note_id === n.id);
        const totalViews = links.reduce((sum, l) => sum + l.view_count, 0);
        return {
          id: n.id,
          title: n.title,
          content: n.content,
          created_at: n.created_at,
          updated_at: n.updated_at,
          total_links: links.length,
          total_views: totalViews,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { rows: userNotes as T[], rowCount: userNotes.length };
  }

  // 5. INSERT INTO notes
  if (normalized.startsWith('INSERT INTO notes')) {
    const [id, user_id, title, content] = params;
    const newNote: InMemNote = {
      id,
      user_id,
      title,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mem.notes.push(newNote);
    return { rows: [newNote] as T[], rowCount: 1 };
  }

  // 6. SELECT single note by id and user_id
  if (normalized.includes('FROM notes WHERE id = $1 AND user_id = $2')) {
    const [id, user_id] = params;
    const found = mem.notes.filter((n) => n.id === id && n.user_id === user_id);
    return { rows: found as T[], rowCount: found.length };
  }

  // 7. DELETE FROM notes
  if (normalized.startsWith('DELETE FROM notes')) {
    const [id, user_id] = params;
    const idx = mem.notes.findIndex((n) => n.id === id && n.user_id === user_id);
    if (idx !== -1) {
      mem.notes.splice(idx, 1);
      mem.share_links = mem.share_links.filter((sl) => sl.note_id !== id);
      return { rows: [{ id }] as T[], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 8. INSERT INTO share_links
  if (normalized.startsWith('INSERT INTO share_links')) {
    const [id, note_id, user_id, token, share_type, access_type, password_hash, plain_password, expires_at] = params;
    const newLink: InMemShareLink = {
      id,
      note_id,
      user_id,
      token,
      share_type,
      access_type,
      password_hash: password_hash || null,
      plain_password: plain_password || null,
      expires_at: expires_at || null,
      is_revoked: false,
      is_used: false,
      used_at: null,
      view_count: 0,
      created_at: new Date().toISOString(),
    };
    mem.share_links.push(newLink);
    return { rows: [newLink] as T[], rowCount: 1 };
  }

  // 9. SELECT share_links for a note
  if (normalized.includes('FROM share_links WHERE note_id = $1 AND user_id = $2')) {
    const [note_id, user_id] = params;
    const found = mem.share_links
      .filter((sl) => sl.note_id === note_id && sl.user_id === user_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { rows: found as T[], rowCount: found.length };
  }

  // 10. SELECT share_link by token (JOIN notes)
  if (normalized.includes('FROM share_links sl JOIN notes n ON sl.note_id = n.id WHERE sl.token = $1')) {
    const token = params[0];
    const link = mem.share_links.find((sl) => sl.token === token);
    if (!link) return { rows: [], rowCount: 0 };
    const note = mem.notes.find((n) => n.id === link.note_id);
    if (!note) return { rows: [], rowCount: 0 };

    const joined = {
      id: link.id,
      note_id: link.note_id,
      token: link.token,
      share_type: link.share_type,
      access_type: link.access_type,
      password_hash: link.password_hash,
      plain_password: link.plain_password,
      expires_at: link.expires_at,
      is_revoked: link.is_revoked,
      is_used: link.is_used,
      view_count: link.view_count,
      created_at: link.created_at,
      title: note.title,
      content: note.content,
      note_created_at: note.created_at,
    };
    return { rows: [joined] as T[], rowCount: 1 };
  }

  // 11. Atomic UPDATE share_links for ONE_TIME
  if (normalized.includes('UPDATE share_links SET is_used = TRUE')) {
    const token = params[0];
    const link = mem.share_links.find((sl) => sl.token === token);
    if (!link) return { rows: [], rowCount: 0 };

    // Check conditions
    if (link.is_used || link.is_revoked) return { rows: [], rowCount: 0 };
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return { rows: [], rowCount: 0 };

    // Atomic CAS
    link.is_used = true;
    link.used_at = new Date().toISOString();
    link.view_count += 1;

    return { rows: [{ view_count: link.view_count }] as T[], rowCount: 1 };
  }

  // 12. Atomic UPDATE share_links for TIME_BASED
  if (normalized.includes('UPDATE share_links SET view_count = view_count + 1')) {
    const token = params[0];
    const link = mem.share_links.find((sl) => sl.token === token);
    if (!link) return { rows: [], rowCount: 0 };

    if (link.is_revoked) return { rows: [], rowCount: 0 };
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return { rows: [], rowCount: 0 };

    link.view_count += 1;
    return { rows: [{ view_count: link.view_count }] as T[], rowCount: 1 };
  }

  // 13. Revoke share link
  if (normalized.includes('UPDATE share_links SET is_revoked = TRUE WHERE id = $1 AND user_id = $2')) {
    const [id, user_id] = params;
    const link = mem.share_links.find((sl) => sl.id === id && sl.user_id === user_id);
    if (!link) return { rows: [], rowCount: 0 };

    link.is_revoked = true;
    return {
      rows: [
        {
          id: link.id,
          note_id: link.note_id,
          token: link.token,
          is_revoked: link.is_revoked,
          view_count: link.view_count,
        },
      ] as T[],
      rowCount: 1,
    };
  }

  // DDL / Ignored statements
  return { rows: [], rowCount: 0 };
}

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
  if (globalThis.__DB_CLIENT__) return globalThis.__DB_CLIENT__;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // 1. External PostgreSQL (Neon, Supabase, RDS, local)
    try {
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('supabase')
          ? { rejectUnauthorized: false }
          : undefined,
      });
      globalThis.__DB_CLIENT__ = {
        async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
          const res = await pool.query(sql, params);
          return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
        },
      };
      return globalThis.__DB_CLIENT__;
    } catch (pgErr) {
      console.warn('PostgreSQL Pool connection failed, falling back:', pgErr);
    }
  }

  // 2. Try Embedded PGlite if supported in this environment
  if (!process.env.VERCEL) {
    try {
      const { PGlite } = await import('@electric-sql/pglite');
      const pglite = new PGlite();
      globalThis.__DB_CLIENT__ = {
        async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
          const res = await pglite.query(sql, params);
          return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
        },
      };
      return globalThis.__DB_CLIENT__;
    } catch {
      // Fall through to in-memory store
    }
  }

  // 3. Bulletproof in-memory engine (never crashes on Vercel Serverless)
  globalThis.__DB_CLIENT__ = {
    async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
      return executeInMemoryQuery<T>(sql, params);
    },
  };

  return globalThis.__DB_CLIENT__;
}

let initialized = false;

export async function ensureDatabase(): Promise<void> {
  if (initialized) return;
  const client = await getClient();

  if (process.env.DATABASE_URL) {
    const statements = SCHEMA_DDL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        console.error('Error running DDL:', err);
      }
    }

    try {
      const demoUser = await client.query("SELECT id FROM users WHERE email = 'demo@peacockindia.in'");
      if (demoUser.rows.length === 0) {
        const demoHash = await bcrypt.hash('Password123!', 10);
        await client.query(
          "INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)",
          ['demo-user-poc', 'demo@peacockindia.in', 'Peacock Evaluator', demoHash]
        );
      }
    } catch {
      // Ignored
    }
  }

  initialized = true;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
  await ensureDatabase();
  const client = await getClient();
  return client.query<T>(sql, params);
}
