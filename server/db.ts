import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Visibility = 'public' | 'unlisted' | 'secret';

export interface PasteRow {
  id: string;
  title: string;
  description: string;
  content: string;
  language: string;
  visibility: Visibility;
  tags: string;
  favorite: number;
  views: number;
  forks: number;
  source_id: string | null;
  expires_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

function migrate(db: Database.Database) {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current < 2) {
    const columns = db.prepare(`SELECT name FROM pragma_table_info('pastes')`).all() as { name: string }[];
    const hasLegacy = columns.length > 0 && !columns.some((column) => column.name === 'description');
    db.transaction(() => {
      if (hasLegacy) db.exec('ALTER TABLE pastes RENAME TO pastes_legacy');
      db.exec(`
        CREATE TABLE IF NOT EXISTS pastes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL,
          language TEXT NOT NULL DEFAULT 'Plain Text',
          visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'secret')),
          tags TEXT NOT NULL DEFAULT '[]',
          favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
          views INTEGER NOT NULL DEFAULT 0,
          forks INTEGER NOT NULL DEFAULT 0,
          source_id TEXT REFERENCES pastes(id) ON DELETE SET NULL,
          expires_at TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      if (hasLegacy) {
        db.exec(`
          INSERT INTO pastes (id, title, content, language, visibility, views, created_at, updated_at)
          SELECT id, title, content, language,
            CASE WHEN visibility = 'public' THEN 'public' ELSE 'unlisted' END,
            views, created_at, updated_at
          FROM pastes_legacy;
          DROP TABLE pastes_legacy;
        `);
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS revisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          paste_id TEXT NOT NULL REFERENCES pastes(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          content TEXT NOT NULL,
          language TEXT NOT NULL,
          visibility TEXT NOT NULL,
          tags TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(paste_id, version)
        );
        CREATE TABLE IF NOT EXISTS activity_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          paste_id TEXT,
          type TEXT NOT NULL,
          detail TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS view_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          paste_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_pastes_created_at ON pastes(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pastes_visibility ON pastes(visibility);
        CREATE INDEX IF NOT EXISTS idx_pastes_language ON pastes(language);
        CREATE INDEX IF NOT EXISTS idx_revisions_paste ON revisions(paste_id, version DESC);
        CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_events(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_views_created ON view_events(created_at DESC);
        PRAGMA user_version = 2;
      `);
    })();
  }
}

export function createDatabase(filename = process.env.DATABASE_PATH || './data/pastebin.db') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}
