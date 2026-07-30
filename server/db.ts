import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface PasteRow {
  id: string;
  title: string;
  content: string;
  language: string;
  visibility: 'public' | 'unlisted' | 'private';
  views: number;
  created_at: string;
  updated_at: string;
}

export function createDatabase(filename = process.env.DATABASE_PATH || './data/pastebin.db') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS pastes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'Plain Text',
      visibility TEXT NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'unlisted', 'private')),
      views INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pastes_created_at ON pastes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pastes_visibility ON pastes(visibility);
  `);
  return db;
}

