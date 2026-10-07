# 🔒 NoteVault — Secure Note-Sharing POC Application

> **POC Task Submission for Peacock India — MERN/PERN Stack Developer Assessment**

NoteVault is a secure note-sharing web application built with **Next.js 16**, **TypeScript**, **PostgreSQL**, and **Tailwind CSS**. It allows users to store confidential notes and generate expiring, revocable share links with fine-grained security policies: **One-time self-destruct**, **Time-based expiry**, **Public access**, and **Dynamic cryptographic password protection**.

---

## 🚀 Live Demo & Deliverables

- **Live Application:** `[YOUR_DEPLOYED_URL_HERE]` (e.g. `https://notevault-poc.vercel.app`)
- **GitHub Repository:** `[YOUR_GITHUB_REPO_URL_HERE]` (e.g. `https://github.com/your-username/note-sharing-app`)
- **Demo & Explanation Video:** `[YOUR_LOOM_OR_GOOGLE_DRIVE_VIDEO_LINK_HERE]`
- **Test Credentials:**
  - **Email:** `demo@peacockindia.in`
  - **Password:** `Password123!`

---

## 🛠 Tech Stack

| Domain | Technology | Description |
|---|---|---|
| **Frontend** | **Next.js 16 (App Router)** + **React 19** | Modern server/client architecture with streaming SSR |
| **Styling** | **Tailwind CSS 4** + Glassmorphism | Dark-themed, responsive design with polished typography & micro-interactions |
| **Icons** | **Lucide React** | Clean, accessible iconography |
| **Backend** | **Next.js Route Handlers** (REST API) | Type-safe JSON APIs for auth, notes, sharing, and unlock |
| **Database** | **PostgreSQL** + **PGlite** (Embedded WASM fallback) | Standard PostgreSQL supporting ACID transactions, row-level locks & atomic updates |
| **Security** | **Bcrypt.js**, **Jose (JWT)**, Node **Crypto** | Cryptographic hashing, HTTP-only cookie sessions, and secure random byte generation |
| **Rate Limiter** | In-Memory Sliding Window | Prevents brute-force dictionary attacks against password-protected notes |

---

## 🗄 Database Schema

The database consists of three relational tables with indexes designed for fast token lookups and high-concurrency access:

```mermaid
erDiagram
    USERS {
        VARCHAR(64) id PK
        VARCHAR(255) email UK
        VARCHAR(255) name
        TEXT password_hash
        TIMESTAMPTZ created_at
    }

    NOTES {
        VARCHAR(64) id PK
        VARCHAR(64) user_id FK
        VARCHAR(255) title
        TEXT content
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    SHARE_LINKS {
        VARCHAR(64) id PK
        VARCHAR(64) note_id FK
        VARCHAR(64) user_id FK
        VARCHAR(128) token UK "cryptographic url-safe token"
        VARCHAR(32) share_type "ONE_TIME | TIME_BASED"
        VARCHAR(32) access_type "PUBLIC | PASSWORD_PROTECTED"
        TEXT password_hash "bcrypt hash"
        VARCHAR(128) plain_password "owner reference"
        TIMESTAMPTZ expires_at "expiry timestamp"
        BOOLEAN is_revoked "default false"
        BOOLEAN is_used "default false"
        TIMESTAMPTZ used_at
        INTEGER view_count "default 0"
        TIMESTAMPTZ created_at
    }

    USERS ||--o{ NOTES : creates
    NOTES ||--o{ SHARE_LINKS : has
    USERS ||--o{ SHARE_LINKS : creates
```

### PostgreSQL DDL:
```sql
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
  share_type VARCHAR(32) NOT NULL,          -- 'ONE_TIME' | 'TIME_BASED'
  access_type VARCHAR(32) NOT NULL,         -- 'PUBLIC' | 'PASSWORD_PROTECTED'
  password_hash TEXT,                       -- bcrypt hash
  plain_password VARCHAR(128),              -- plain key for creator reference
  expires_at TIMESTAMP WITH TIME ZONE,      -- timestamp for time-based expiry
  is_revoked BOOLEAN DEFAULT FALSE NOT NULL,-- instant revoke flag
  is_used BOOLEAN DEFAULT FALSE NOT NULL,   -- consumed flag for one-time links
  used_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0 NOT NULL,    -- atomic view counter
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_note_id ON share_links(note_id);
CREATE INDEX IF NOT EXISTS idx_share_links_user_id ON share_links(user_id);
```

---

## 🔒 Security & Architecture Explanations

### 1. Share Link Generation Flow
1. When a user submits a note via `/notes/new`, the server generates a cryptographically secure random token using `crypto.randomBytes(24).toString('base64url')` (high entropy, URL-safe, non-guessable).
2. The token is mapped uniquely to the note in the `share_links` table with the requested share parameters.
3. The resulting link `https://domain.com/share/[token]` is generated and returned with 1-click copy support.

### 2. Password / Key Generation Logic
- For **Password-Protected** links, NoteVault automatically creates a high-entropy dynamic access key:
  ```ts
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  // Generates 12 random characters formatted into readable groups: Ab4k-Tm9x-R2wQ
  ```
- The plaintext access key is hashed using **bcrypt (salt rounds = 10)** before saving to `password_hash`.
- The plaintext key is returned once to the creator so they can securely share it with the recipient.

### 3. Expiry Logic
- **Time-Based Links:** The creator selects a duration (10 min, 1 hr, 24 hr, 7 days, or custom date/time). `expires_at` is set to `NOW() + interval`. Whenever access is requested, the system verifies `expires_at > NOW()`. If expired, access is blocked and HTTP `410 Gone` with status `EXPIRED` is returned.
- **One-Time Links:** The link expires after the very first successful view or unlock. It is immediately marked `is_used = TRUE` and `used_at = NOW()`. Subsequent attempts return HTTP `410 Gone` with status `ALREADY_USED`.

### 4. Invalidate / Revoke Logic
- At any time, the note owner can view their share links in `/notes/[id]` and click **Revoke Link**.
- This executes an authenticated query:
  ```sql
  UPDATE share_links
  SET is_revoked = TRUE
  WHERE id = $1 AND user_id = $2
  RETURNING *;
  ```
- Any subsequent access attempts immediately encounter `is_revoked = true` and receive HTTP `403 Forbidden` (`REVOKED`). The note content is never exposed once revoked.

### 5. View Count Logic
- **Public View:** Increments count on view.
- **Password-Protected View:** Increments count **only upon correct password submission**.
- **Wrong Password:** Count does **NOT** increase.
- **Expired / Revoked / Consumed Link:** Count does **NOT** increase.
- Increments are executed directly in SQL via atomic updates: `SET view_count = view_count + 1`.

---

## 💡 Technical Answers to Evaluation Questions

### Q1: How do you prevent two users from using a one-time link at the same time? (Race-Condition Handling)
> **Answer:**
> We eliminate race conditions at the **database layer** using an **atomic compare-and-swap update** with row-level locks:
> ```sql
> UPDATE share_links
> SET is_used = TRUE,
>     used_at = NOW(),
>     view_count = view_count + 1
> WHERE token = $1 
>   AND is_used = FALSE 
>   AND is_revoked = FALSE
>   AND (expires_at IS NULL OR expires_at > NOW())
> RETURNING view_count;
> ```
> **How it works:**
> When two requests arrive at the exact same millisecond:
> 1. PostgreSQL acquires an exclusive row lock on the row matching `token = $1`.
> 2. The **first transaction** succeeds because `is_used` is `FALSE`. The database updates `is_used = TRUE` and returns `rowCount = 1`.
> 3. The **second transaction** evaluates the `WHERE` clause after the first commit. Since `is_used` is now `TRUE`, the condition `is_used = FALSE` fails, and PostgreSQL returns `rowCount = 0`.
> 4. Our backend checks `if (updateRes.rows.length === 0)`: the second request is immediately rejected with HTTP `410 ALREADY_USED`.
> 
> This eliminates any need for fragile application-level mutexes or memory locks.

---

### Q2: How do you update view count safely?
> **Answer:**
> We avoid the classic **read-modify-write hazard** (where two threads read `count = 5`, compute `5 + 1 = 6`, and write back `6` instead of `7`).
> Instead, we use **atomic in-database increments**:
> ```sql
> UPDATE share_links 
> SET view_count = view_count + 1 
> WHERE token = $1 AND is_revoked = FALSE
> RETURNING view_count;
> ```
> PostgreSQL's write-ahead log and MVCC guarantee that every simultaneous commit increments the integer accurately without losing counts.

---

### Q3: How would this work if 1 million people opened the link?
> **Answer:**
> To handle 1,000,000 concurrent visitors:
> 1. **For One-Time Links:** 999,999 requests will be rejected as soon as the first request consumes the link. To protect the primary database from being hammered, we would cache the `is_used = TRUE` status in a high-throughput cache like **Redis / Cloudflare KV**.
> 2. **For Public Time-Based Links:**
>    - **Edge Caching / CDN:** The note content is static. Cache the decrypted note at the CDN edge (Cloudflare / CloudFront) with a short TTL.
>    - **Buffered View Counts:** Instead of hitting PostgreSQL on every view, increment counters in Redis via `HINCRBY` and flush in batches (e.g. every 5 seconds) to PostgreSQL.
>    - **Connection Pooling:** Use **PgBouncer** or serverless pooling (Neon / Supabase connection pooling) to prevent database connection exhaustion.
>    - **Read Replicas:** Route read queries to read replicas while keeping writes on the primary DB.

---

### Q4: How would you prevent brute-force attempts on password-protected links?
> **Answer:**
> NoteVault implements multiple layers of defense:
> 1. **Sliding-Window Rate Limiting (`rate-limit.ts`):**
>    - We track failed attempts keyed by `${client_ip}:${token}`.
>    - Users are allowed **maximum 5 failed attempts per 60-second window**.
>    - On the 5th failed attempt, the IP is locked out for 60 seconds with HTTP `429 Too Many Requests` and a `Retry-After` countdown.
> 2. **High-Entropy Dynamic Passwords:**
>    - Passwords use a 12-character alphanumeric key space ($56^{12} \approx 9.2 \times 10^{20}$ combinations), making random guessing practically impossible even over millions of tries.
> 3. **Bcrypt Hashing Delay:**
>    - Bcrypt computation takes ~70ms on the CPU per comparison, intentionally slowing down offline/online automated brute-force attacks.

---

## 💻 Local Setup Instructions

### Prerequisites
- **Node.js** v18+ (tested on Node v25 / v20)
- **npm** or **pnpm**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/note-sharing-app.git
   cd note-sharing-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Database Configuration:**
   - **Zero-Config Mode (Default):** Runs immediately using embedded PostgreSQL (`PGlite`) with persistent storage in `.pgdata/`. No external PostgreSQL installation required!
   - **External PostgreSQL Mode (Optional):** Create a `.env` file in the root:
     ```env
     DATABASE_URL="postgresql://username:password@localhost:5432/notesharing"
     JWT_SECRET="your-super-secure-jwt-secret-min-32-chars!"
     ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

5. **Open in Browser:**
   Visit [http://localhost:3000](http://localhost:3000)

6. **Log in with seeded demo credentials:**
   - **Email:** `demo@peacockindia.in`
   - **Password:** `Password123!`
   *(Or click "Use demo credentials" on the `/login` screen)*

---

## 🧪 Automated Testing

Run the automated end-to-end verification suite:
```bash
node test-e2e.js
```
This tests:
- User authentication and session cookies
- Note creation & token generation
- One-time link expiration after first view
- Password-protected unlock & wrong password handling
- Brute-force rate limiting
- Force revocation
- Concurrent race-condition safety (5 simultaneous requests)

---

## 📂 Project Directory Structure

```
note-sharing-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # Login, Register, Logout, Me API
│   │   │   ├── notes/         # Notes CRUD & Share link creation
│   │   │   └── share/         # Token retrieval, Password unlock, Revoke API
│   │   ├── login/             # Login Page
│   │   ├── register/          # Registration Page
│   │   ├── notes/new/         # Create Note & Share Link Page
│   │   ├── notes/[id]/        # Note Details & Share Management Page
│   │   ├── share/[token]/     # Public Shared Note Access Page
│   │   ├── layout.tsx         # Root layout with dark theme & navbar
│   │   ├── page.tsx           # Home page / Notes dashboard
│   │   └── globals.css        # Tailwind styling & glassmorphism
│   ├── components/
│   │   ├── Navbar.tsx         # Responsive navigation bar
│   │   ├── Badge.tsx          # Status, Type, and Access badges
│   │   └── CopyButton.tsx     # 1-click clipboard copy component
│   └── lib/
│       ├── db.ts              # PostgreSQL database client & auto-seeder
│       ├── schema.sql         # PostgreSQL schema definition
│       ├── auth.ts            # Bcrypt hashing & JWT session handling
│       ├── rate-limit.ts      # Sliding-window brute-force rate limiter
│       ├── token.ts           # Secure token & dynamic password generators
│       └── types.ts           # TypeScript interfaces
├── test-e2e.js                # Automated E2E test suite
├── package.json
└── README.md
```
