import 'server-only'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.join(process.cwd(), '.data')
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

const DB_PATH = path.join(DB_DIR, 'life-os.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
    runMigrations(_db)
  }
  return _db
}

// Safe column additions — SQLite doesn't support IF NOT EXISTS on ALTER TABLE
function runMigrations(db: Database.Database): void {
  const columnMigrations = [
    `ALTER TABLE settings ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'`,
    `ALTER TABLE settings ADD COLUMN ollama_base_url TEXT NOT NULL DEFAULT 'http://localhost:11434'`,
    // Pages / navigation config (JSON)
    `ALTER TABLE settings ADD COLUMN pages_config TEXT NOT NULL DEFAULT '{}'`,
    // Google Drive integration
    `ALTER TABLE settings ADD COLUMN google_drive_enabled INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN google_access_token TEXT`,
    `ALTER TABLE settings ADD COLUMN google_refresh_token TEXT`,
    `ALTER TABLE settings ADD COLUMN google_token_expiry INTEGER`,
    `ALTER TABLE settings ADD COLUMN google_drive_folder_id TEXT`,
    `ALTER TABLE settings ADD COLUMN google_drive_email TEXT`,
    // project_files: track which backend stored the file
    `ALTER TABLE project_files ADD COLUMN storage_backend TEXT NOT NULL DEFAULT 'local'`,
    `ALTER TABLE project_files ADD COLUMN drive_file_id TEXT`,
    // ── Document Files (Google Drive / local) ───────────────────────────────
    `CREATE TABLE IF NOT EXISTS document_files (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      name            TEXT NOT NULL,
      mime_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
      size            INTEGER NOT NULL DEFAULT 0,
      category        TEXT NOT NULL DEFAULT 'general',
      storage_backend TEXT NOT NULL DEFAULT 'drive',
      storage_path    TEXT,
      drive_file_id   TEXT,
      drive_view_link TEXT,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    // ── Password Vault ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS vault_items (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL,
      type           TEXT NOT NULL DEFAULT 'website'
                       CHECK(type IN ('website','email','credit_card','bank','other')),
      name           TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      favicon TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS project_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS project_folders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS project_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      folder_id TEXT,
      user_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES project_folders(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
  ]
  for (const sql of columnMigrations) {
    try { db.exec(sql) } catch { /* column already exists — ignore */ }
  }

  // Recreate investments table without CHECK constraint so any type string is allowed
  const hasOldConstraint = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='investments'`)
    .get() as { sql: string } | undefined
  if (hasOldConstraint?.sql?.includes('CHECK(type IN')) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE investments_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'other',
        ticker TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        buy_price REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'SGD',
        country TEXT NOT NULL DEFAULT 'SG',
        notes TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      INSERT OR IGNORE INTO investments_new SELECT * FROM investments;
      DROP TABLE investments;
      ALTER TABLE investments_new RENAME TO investments;
      PRAGMA foreign_keys = ON;
    `)
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      event TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 2048,
      context_window_size INTEGER NOT NULL DEFAULT 20,
      tools TEXT NOT NULL DEFAULT '[]',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      openai_api_key TEXT,
      openai_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
      default_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      default_temperature REAL NOT NULL DEFAULT 0.7,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      mood TEXT,
      entry_date TEXT NOT NULL DEFAULT (date('now')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','on_hold','cancelled')),
      due_date TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('stock','etf','bond','crypto','fixed_deposit','real_estate','cash','other')),
      ticker TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      buy_price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'SGD',
      country TEXT NOT NULL DEFAULT 'SG' CHECK(country IN ('SG','IN','US','OTHER')),
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS investment_snapshots (
      id TEXT PRIMARY KEY,
      investment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      value REAL NOT NULL,
      period TEXT NOT NULL,
      period_type TEXT NOT NULL DEFAULT 'monthly' CHECK(period_type IN ('monthly','yearly')),
      snapshot_date TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS liabilities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'loan' CHECK(type IN ('loan','mortgage','credit_card','other')),
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'SGD',
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)
}
