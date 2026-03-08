import Database from 'better-sqlite3';
import path from 'path';

export function initDatabase(dataPath: string): Database.Database {
  const dbPath = path.join(dataPath, 'shuki.db');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  return db;
}

export interface NoteRow {
  id: string;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
  deleted: number;
}
