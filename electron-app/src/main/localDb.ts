import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

export interface LocalNote {
  id: string;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
  synced: number;
}

export interface LocalDatabase {
  getAllNotes: () => LocalNote[];
  getNote: (id: string) => LocalNote | undefined;
  saveNote: (note: { id: string; title: string; content: string; tags: string[]; updatedAt: string; synced: boolean }) => void;
  deleteNote: (id: string) => void;
  getPendingNotes: () => LocalNote[];
  markSynced: (id: string) => void;
  clearAll: () => void;
}

function rowsToNotes(db: SqlJsDatabase, sql: string, params?: unknown[]): LocalNote[] {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const results: LocalNote[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as LocalNote;
    results.push(row);
  }
  stmt.free();
  return results;
}

export async function initLocalDb(userDataPath: string): Promise<LocalDatabase> {
  const dbPath = path.join(userDataPath, 'shuki-local.db');

  const SQL = await initSqlJs();

  let db: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);

  function persist() {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  // Persist initial schema creation
  persist();

  return {
    getAllNotes() {
      return rowsToNotes(db, 'SELECT * FROM notes ORDER BY updated_at DESC');
    },
    getNote(id: string) {
      const results = rowsToNotes(db, 'SELECT * FROM notes WHERE id = ?', [id]);
      return results[0];
    },
    saveNote(note) {
      const now = note.updatedAt || new Date().toISOString();
      db.run(
        `INSERT INTO notes (id, title, content, tags, updated_at, synced)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           tags = excluded.tags,
           updated_at = excluded.updated_at,
           synced = excluded.synced`,
        [note.id, note.title, note.content, JSON.stringify(note.tags), now, note.synced ? 1 : 0]
      );
      persist();
    },
    deleteNote(id: string) {
      db.run('DELETE FROM notes WHERE id = ?', [id]);
      persist();
    },
    getPendingNotes() {
      return rowsToNotes(db, 'SELECT * FROM notes WHERE synced = 0');
    },
    markSynced(id: string) {
      db.run('UPDATE notes SET synced = 1 WHERE id = ?', [id]);
      persist();
    },
    clearAll() {
      db.run('DELETE FROM notes');
      persist();
    },
  };
}
