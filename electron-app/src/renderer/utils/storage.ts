import { Note, Folder, AppSettings, SyncQueueItem } from '../types';

const api = window.electronAPI;

const KEYS = {
  settings: 'shuki:settings',
  shortcuts: 'shuki:shortcuts',
  server: 'shuki:server',
  ui: 'shuki:ui',
  notes: 'shuki:notes',
  folders: 'shuki:folders',
  syncQueue: 'shuki:syncQueue',
};

function isElectron(): boolean {
  return !!api;
}

// --- localStorage helpers for browser/dev mode ---
function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable
  }
}

// --- Settings ---
export async function loadSettings(): Promise<Partial<AppSettings>> {
  if (isElectron()) {
    const settings = await api!.store.get('settings');
    return (settings as Partial<AppSettings>) || {};
  }
  return lsGet<Partial<AppSettings>>(KEYS.settings) || {};
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  if (isElectron()) {
    const current = (await api!.store.get('settings')) || {};
    await api!.store.set('settings', { ...(current as object), ...settings });
  }
  // Always save to localStorage too (for dev mode and as backup)
  const current = lsGet<Partial<AppSettings>>(KEYS.settings) || {};
  lsSet(KEYS.settings, { ...current, ...settings });
}

// --- UI State (last note, folder, sidebar) ---
export interface UIState {
  activeNoteId?: string | null;
  activeFolderId?: string | null;
  collapsedFolders?: string[];
  sidebarWidth?: number;
}

export async function loadUIState(): Promise<UIState> {
  if (isElectron()) {
    const state = await api!.store.get('ui');
    return (state as UIState) || {};
  }
  return lsGet<UIState>(KEYS.ui) || {};
}

export async function saveUIState(state: Partial<UIState>): Promise<void> {
  if (isElectron()) {
    const current = (await api!.store.get('ui')) || {};
    await api!.store.set('ui', { ...(current as object), ...state });
  }
  const current = lsGet<UIState>(KEYS.ui) || {};
  lsSet(KEYS.ui, { ...current, ...state });
}

// --- Notes ---
export async function loadNotesFromLocal(): Promise<Note[]> {
  if (isElectron()) {
    const rows = await api!.db.getNotes();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      tags: JSON.parse(r.tags),
      folderId: r.folder_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      synced: r.synced === 1,
    }));
  }
  return lsGet<Note[]>(KEYS.notes) || [];
}

export async function saveNoteLocal(note: Note): Promise<void> {
  if (isElectron()) {
    await api!.db.saveNote({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags,
      folderId: note.folderId,
      updatedAt: note.updatedAt,
      synced: note.synced,
    });
  } else {
    const notes = lsGet<Note[]>(KEYS.notes) || [];
    const idx = notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) notes[idx] = note;
    else notes.push(note);
    lsSet(KEYS.notes, notes);
  }
}

export async function deleteNoteLocal(id: string): Promise<void> {
  if (isElectron()) {
    await api!.db.deleteNote(id);
  } else {
    const notes = lsGet<Note[]>(KEYS.notes) || [];
    lsSet(KEYS.notes, notes.filter((n) => n.id !== id));
  }
}

export async function getPendingNotes(): Promise<Note[]> {
  if (isElectron()) {
    const rows = await api!.db.getPendingNotes();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      tags: JSON.parse(r.tags),
      folderId: r.folder_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      synced: false,
    }));
  }
  const notes = lsGet<Note[]>(KEYS.notes) || [];
  return notes.filter((n) => !n.synced);
}

export async function markNoteSynced(id: string): Promise<void> {
  if (isElectron()) {
    await api!.db.markSynced(id);
  } else {
    const notes = lsGet<Note[]>(KEYS.notes) || [];
    const note = notes.find((n) => n.id === id);
    if (note) {
      note.synced = true;
      lsSet(KEYS.notes, notes);
    }
  }
}

export async function clearLocalCache(): Promise<void> {
  if (isElectron()) {
    await api!.db.clearCache();
  } else {
    lsSet(KEYS.notes, []);
    lsSet(KEYS.folders, []);
    lsSet(KEYS.syncQueue, []);
  }
}

// --- Folders ---
export async function loadFoldersFromLocal(): Promise<Folder[]> {
  if (isElectron()) {
    const rows = await api!.db.getFolders();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      synced: r.synced === 1,
    }));
  }
  return lsGet<Folder[]>(KEYS.folders) || [];
}

export async function saveFolderLocal(folder: Folder): Promise<void> {
  if (isElectron()) {
    await api!.db.saveFolder({
      id: folder.id,
      name: folder.name,
      sortOrder: folder.sortOrder,
      synced: folder.synced,
    });
  } else {
    const folders = lsGet<Folder[]>(KEYS.folders) || [];
    const idx = folders.findIndex((f) => f.id === folder.id);
    if (idx >= 0) folders[idx] = folder;
    else folders.push(folder);
    lsSet(KEYS.folders, folders);
  }
}

export async function deleteFolderLocal(id: string): Promise<void> {
  if (isElectron()) {
    await api!.db.deleteFolder(id);
  } else {
    const folders = lsGet<Folder[]>(KEYS.folders) || [];
    lsSet(KEYS.folders, folders.filter((f) => f.id !== id));
    // Unassign notes
    const notes = lsGet<Note[]>(KEYS.notes) || [];
    for (const note of notes) {
      if (note.folderId === id) note.folderId = null;
    }
    lsSet(KEYS.notes, notes);
  }
}

export async function markFolderSynced(id: string): Promise<void> {
  if (isElectron()) {
    await api!.db.markFolderSynced(id);
  } else {
    const folders = lsGet<Folder[]>(KEYS.folders) || [];
    const folder = folders.find((f) => f.id === id);
    if (folder) {
      folder.synced = true;
      lsSet(KEYS.folders, folders);
    }
  }
}

// --- Sync Queue ---
export async function addToSyncQueue(action: string, entityType: string, entityId: string, payload: object): Promise<void> {
  if (isElectron()) {
    await api!.db.addToSyncQueue(action, entityType, entityId, JSON.stringify(payload));
  } else {
    const queue = lsGet<SyncQueueItem[]>(KEYS.syncQueue) || [];
    queue.push({
      id: Date.now(),
      action,
      entityType,
      entityId,
      payload: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
    });
    lsSet(KEYS.syncQueue, queue);
  }
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  if (isElectron()) {
    const rows = await api!.db.getSyncQueue();
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      payload: r.payload,
      createdAt: r.created_at,
    }));
  }
  return lsGet<SyncQueueItem[]>(KEYS.syncQueue) || [];
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  if (isElectron()) {
    await api!.db.removeSyncQueueItem(id);
  } else {
    const queue = lsGet<SyncQueueItem[]>(KEYS.syncQueue) || [];
    lsSet(KEYS.syncQueue, queue.filter((q) => q.id !== id));
  }
}

export async function clearSyncQueue(): Promise<void> {
  if (isElectron()) {
    await api!.db.clearSyncQueue();
  } else {
    lsSet(KEYS.syncQueue, []);
  }
}

// --- Shortcuts ---
export async function loadShortcuts(): Promise<Record<string, string> | null> {
  if (isElectron()) {
    const shortcuts = await api!.store.get('shortcuts');
    if (shortcuts) return shortcuts as Record<string, string>;
  }
  return lsGet<Record<string, string>>(KEYS.shortcuts) || null;
}

export async function saveShortcuts(shortcuts: Record<string, string>): Promise<void> {
  if (isElectron()) {
    await api!.store.set('shortcuts', shortcuts);
  }
  lsSet(KEYS.shortcuts, shortcuts);
}

// --- Images ---
export async function saveImageLocal(buffer: ArrayBuffer, filename: string): Promise<string> {
  if (isElectron()) {
    return await api!.images.save(buffer, filename);
  }
  // Browser fallback: create a blob URL
  const blob = new Blob([buffer]);
  return URL.createObjectURL(blob);
}

export async function getImagesPath(): Promise<string> {
  if (isElectron()) {
    return await api!.images.getPath();
  }
  return '';
}

export async function listLocalImages(): Promise<string[]> {
  if (isElectron()) {
    return await api!.images.list();
  }
  return [];
}

export async function deleteLocalImage(filename: string): Promise<void> {
  if (isElectron()) {
    await api!.images.delete(filename);
  }
}

// --- Image cleanup ---
export async function cleanupOrphanedImages(allNotes: { content: string }[]): Promise<void> {
  if (!isElectron()) return;
  try {
    const filenames = await listLocalImages();
    const allContent = allNotes.map((n) => n.content).join('\n');
    for (const filename of filenames) {
      const basePath = await getImagesPath();
      const fullPath = `${basePath}/${filename}`;
      // Check if this image is referenced by any note
      if (!allContent.includes(filename) && !allContent.includes(encodeURIComponent(fullPath))) {
        await deleteLocalImage(filename);
      }
    }
  } catch {
    // Silently fail cleanup
  }
}

// --- Reset all settings ---
export async function resetAllSettings(): Promise<void> {
  if (isElectron()) {
    await api!.store.delete('settings');
    await api!.store.delete('shortcuts');
    await api!.store.delete('ui');
  }
  localStorage.removeItem(KEYS.settings);
  localStorage.removeItem(KEYS.shortcuts);
  localStorage.removeItem(KEYS.ui);
  localStorage.removeItem(KEYS.server);
}

// --- Clear all local data (notes, images, settings, cache) ---
export async function clearAllLocalData(): Promise<void> {
  // Clear localStorage
  for (const key of Object.values(KEYS)) {
    localStorage.removeItem(key);
  }

  if (isElectron()) {
    // Clear electron-store data
    await api!.store.delete('settings');
    await api!.store.delete('shortcuts');
    await api!.store.delete('ui');
    await api!.store.delete('windowBounds');

    // Clear local database
    await api!.db.clearCache();

    // Clear sync queue
    await api!.db.clearSyncQueue();

    // Clear image cache directory
    await api!.images.clearCache();
  }
}
