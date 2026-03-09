export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface Folder {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface ServerConfig {
  url: string;
  apiKey: string;
}

export interface ServerStatus {
  connected: boolean;
  clients: number;
  storage: {
    free: number;
    total: number;
    path: string;
  };
  lastSync: string | null;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline' | 'auth_error';

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
  autoSaveInterval: number;
  serverUrl: string;
  apiKey: string;
  offlineOnly: boolean;
  editorMode: 'rich' | 'markdown';
}

export interface ShortcutConfig {
  id: string;
  label: string;
  keys: string;
  defaultKeys: string;
}

export interface SyncQueueItem {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  payload: string;
  createdAt: string;
}

declare global {
  interface Window {
    electronAPI?: {
      store: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
      };
      db: {
        getNotes: () => Promise<Array<{
          id: string; title: string; content: string; tags: string;
          folder_id: string | null;
          created_at: string; updated_at: string; synced: number;
        }>>;
        getNote: (id: string) => Promise<{
          id: string; title: string; content: string; tags: string;
          folder_id: string | null;
          created_at: string; updated_at: string; synced: number;
        } | undefined>;
        saveNote: (note: { id: string; title: string; content: string; tags: string[]; folderId?: string | null; updatedAt: string; synced: boolean }) => Promise<boolean>;
        deleteNote: (id: string) => Promise<boolean>;
        getPendingNotes: () => Promise<Array<{
          id: string; title: string; content: string; tags: string;
          folder_id: string | null;
          created_at: string; updated_at: string; synced: number;
        }>>;
        markSynced: (id: string) => Promise<boolean>;
        clearCache: () => Promise<boolean>;
        getFolders: () => Promise<Array<{
          id: string; name: string; sort_order: number;
          created_at: string; updated_at: string; synced: number;
        }>>;
        saveFolder: (folder: { id: string; name: string; sortOrder: number; synced: boolean }) => Promise<boolean>;
        deleteFolder: (id: string) => Promise<boolean>;
        markFolderSynced: (id: string) => Promise<boolean>;
        addToSyncQueue: (action: string, entityType: string, entityId: string, payload: string) => Promise<boolean>;
        getSyncQueue: () => Promise<Array<{
          id: number; action: string; entity_type: string;
          entity_id: string; payload: string; created_at: string;
        }>>;
        removeSyncQueueItem: (id: number) => Promise<boolean>;
        clearSyncQueue: () => Promise<boolean>;
      };
      images: {
        save: (buffer: ArrayBuffer, filename: string) => Promise<string>;
        getPath: () => Promise<string>;
        list: () => Promise<string[]>;
        delete: (filename: string) => Promise<boolean>;
        read: (filename: string) => Promise<ArrayBuffer | null>;
      };
    };
  }
}
