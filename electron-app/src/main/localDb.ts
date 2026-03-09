import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

export interface LocalNote {
  id: string;
  title: string;
  content: string;
  tags: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  synced: number;
}

export interface LocalFolder {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  synced: number;
}

export interface SyncQueueItem {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  payload: string;
  created_at: string;
}

export interface LocalDatabase {
  getAllNotes: () => LocalNote[];
  getNote: (id: string) => LocalNote | undefined;
  saveNote: (note: { id: string; title: string; content: string; tags: string[]; folderId?: string | null; updatedAt: string; synced: boolean }) => void;
  deleteNote: (id: string) => void;
  getPendingNotes: () => LocalNote[];
  markSynced: (id: string) => void;
  clearAll: () => void;
  getAllFolders: () => LocalFolder[];
  saveFolder: (folder: { id: string; name: string; sortOrder: number; synced: boolean }) => void;
  deleteFolder: (id: string) => void;
  markFolderSynced: (id: string) => void;
  addToSyncQueue: (action: string, entityType: string, entityId: string, payload: string) => void;
  getSyncQueue: () => SyncQueueItem[];
  removeSyncQueueItem: (id: number) => void;
  clearSyncQueue: () => void;
}

function rowsToArray<T>(db: SqlJsDatabase, sql: string, params?: unknown[]): T[] {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as T;
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
      folder_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled Folder',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add folder_id to notes if missing
  try {
    db.exec('SELECT folder_id FROM notes LIMIT 1');
  } catch {
    db.run('ALTER TABLE notes ADD COLUMN folder_id TEXT DEFAULT NULL');
  }

  function persist() {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  persist();

  return {
    getAllNotes() {
      return rowsToArray<LocalNote>(db, 'SELECT * FROM notes ORDER BY updated_at DESC');
    },
    getNote(id: string) {
      const results = rowsToArray<LocalNote>(db, 'SELECT * FROM notes WHERE id = ?', [id]);
      return results[0];
    },
    saveNote(note) {
      const now = note.updatedAt || new Date().toISOString();
      db.run(
        `INSERT INTO notes (id, title, content, tags, folder_id, updated_at, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           tags = excluded.tags,
           folder_id = excluded.folder_id,
           updated_at = excluded.updated_at,
           synced = excluded.synced`,
        [note.id, note.title, note.content, JSON.stringify(note.tags), note.folderId ?? null, now, note.synced ? 1 : 0]
      );
      persist();
    },
    deleteNote(id: string) {
      db.run('DELETE FROM notes WHERE id = ?', [id]);
      persist();
    },
    getPendingNotes() {
      return rowsToArray<LocalNote>(db, 'SELECT * FROM notes WHERE synced = 0');
    },
    markSynced(id: string) {
      db.run('UPDATE notes SET synced = 1 WHERE id = ?', [id]);
      persist();
    },
    clearAll() {
      db.run('DELETE FROM notes');
      db.run('DELETE FROM folders');
      db.run('DELETE FROM sync_queue');
      persist();
    },
    getAllFolders() {
      return rowsToArray<LocalFolder>(db, 'SELECT * FROM folders ORDER BY sort_order ASC');
    },
    saveFolder(folder) {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO folders (id, name, sort_order, updated_at, synced)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           sort_order = excluded.sort_order,
           updated_at = excluded.updated_at,
           synced = excluded.synced`,
        [folder.id, folder.name, folder.sortOrder, now, folder.synced ? 1 : 0]
      );
      persist();
    },
    deleteFolder(id: string) {
      db.run('UPDATE notes SET folder_id = NULL WHERE folder_id = ?', [id]);
      db.run('DELETE FROM folders WHERE id = ?', [id]);
      persist();
    },
    markFolderSynced(id: string) {
      db.run('UPDATE folders SET synced = 1 WHERE id = ?', [id]);
      persist();
    },
    addToSyncQueue(action: string, entityType: string, entityId: string, payload: string) {
      db.run(
        'INSERT INTO sync_queue (action, entity_type, entity_id, payload) VALUES (?, ?, ?, ?)',
        [action, entityType, entityId, payload]
      );
      persist();
    },
    getSyncQueue() {
      return rowsToArray<SyncQueueItem>(db, 'SELECT * FROM sync_queue ORDER BY id ASC');
    },
    removeSyncQueueItem(id: number) {
      db.run('DELETE FROM sync_queue WHERE id = ?', [id]);
      persist();
    },
    clearSyncQueue() {
      db.run('DELETE FROM sync_queue');
      persist();
    },
  };
}
