import { create } from 'zustand';
import { Note, Folder, AppSettings, ServerStatus, ThemeMode, SyncState, ShortcutConfig } from '../types';

const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  { id: 'newNote', label: 'New Note', keys: 'Ctrl+N', defaultKeys: 'Ctrl+N' },
  { id: 'newFolder', label: 'New Folder', keys: 'Ctrl+Shift+N', defaultKeys: 'Ctrl+Shift+N' },
  { id: 'save', label: 'Save / Force Sync', keys: 'Ctrl+S', defaultKeys: 'Ctrl+S' },
  { id: 'search', label: 'Search Notes', keys: 'Ctrl+F', defaultKeys: 'Ctrl+F' },
  { id: 'settings', label: 'Open Settings', keys: 'Ctrl+,', defaultKeys: 'Ctrl+,' },
  { id: 'toggleDark', label: 'Toggle Dark Mode', keys: 'Ctrl+Shift+D', defaultKeys: 'Ctrl+Shift+D' },
  { id: 'toggleMarkdown', label: 'Toggle Markdown Mode', keys: 'Ctrl+Shift+M', defaultKeys: 'Ctrl+Shift+M' },
  { id: 'gallery', label: 'Open Image Gallery', keys: 'Ctrl+Shift+G', defaultKeys: 'Ctrl+Shift+G' },
];

interface AppState {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  activeFolderId: string | null;
  searchQuery: string;

  serverStatus: ServerStatus;
  settings: AppSettings;
  isOnboarding: boolean;
  showSettings: boolean;
  settingsTab: 'shortcuts' | 'server' | 'general' | 'about';

  editorMode: 'rich' | 'markdown';
  sidebarWidth: number;
  syncState: SyncState;
  pendingChanges: number;
  syncMessage: string;
  showGallery: boolean;
  shortcuts: ShortcutConfig[];

  contextMenu: { x: number; y: number; type: 'note' | 'folder'; targetId: string } | null;

  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  removeNote: (id: string) => void;
  setActiveNoteId: (id: string | null) => void;
  setActiveFolderId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setServerStatus: (status: Partial<ServerStatus>) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  setIsOnboarding: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setSettingsTab: (tab: 'shortcuts' | 'server' | 'general' | 'about') => void;
  setEditorMode: (mode: 'rich' | 'markdown') => void;
  setSyncState: (state: SyncState) => void;
  setPendingChanges: (count: number) => void;
  setSyncMessage: (msg: string) => void;
  setShowGallery: (v: boolean) => void;
  setShortcuts: (shortcuts: ShortcutConfig[]) => void;
  setContextMenu: (menu: { x: number; y: number; type: 'note' | 'folder'; targetId: string } | null) => void;

  setFolders: (folders: Folder[]) => void;
  addFolder: (folder: Folder) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  removeFolder: (id: string) => void;

  getActiveNote: () => Note | undefined;
  getFilteredNotes: () => Note[];
}

export const useStore = create<AppState>((set, get) => ({
  notes: [],
  folders: [],
  activeNoteId: null,
  activeFolderId: null,
  searchQuery: '',

  serverStatus: {
    connected: false,
    clients: 0,
    storage: { free: 0, total: 0, path: '' },
    lastSync: null,
  },

  settings: {
    theme: 'system' as ThemeMode,
    fontSize: 16,
    autoSaveInterval: 1500,
    serverUrl: '',
    apiKey: '',
    offlineOnly: false,
    editorMode: 'rich' as const,
  },

  isOnboarding: true,
  showSettings: false,
  settingsTab: 'shortcuts',
  editorMode: 'rich',
  sidebarWidth: 260,
  syncState: 'disconnected',
  pendingChanges: 0,
  syncMessage: '',
  showGallery: false,
  shortcuts: DEFAULT_SHORTCUTS,
  contextMenu: null,

  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  removeNote: (id) =>
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
    })),
  setActiveNoteId: (id) => set({ activeNoteId: id }),
  setActiveFolderId: (id) => set({ activeFolderId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setServerStatus: (status) =>
    set((s) => ({ serverStatus: { ...s.serverStatus, ...status } })),
  setSettings: (settings) =>
    set((s) => ({ settings: { ...s.settings, ...settings } })),
  setIsOnboarding: (v) => set({ isOnboarding: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  setSyncState: (state) => set({ syncState: state }),
  setPendingChanges: (count) => set({ pendingChanges: count }),
  setSyncMessage: (msg) => set({ syncMessage: msg }),
  setShowGallery: (v) => set({ showGallery: v }),
  setShortcuts: (shortcuts) => set({ shortcuts }),
  setContextMenu: (menu) => set({ contextMenu: menu }),

  setFolders: (folders) => set({ folders }),
  addFolder: (folder) => set((s) => ({ folders: [...s.folders, folder] })),
  updateFolder: (id, updates) =>
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),
  removeFolder: (id) =>
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      activeFolderId: s.activeFolderId === id ? null : s.activeFolderId,
      notes: s.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
    })),

  getActiveNote: () => {
    const s = get();
    return s.notes.find((n) => n.id === s.activeNoteId);
  },
  getFilteredNotes: () => {
    const s = get();
    let filtered = s.notes;
    if (s.activeFolderId) {
      filtered = filtered.filter((n) => n.folderId === s.activeFolderId);
    }
    if (s.searchQuery.trim()) {
      const q = s.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return filtered;
  },
}));
