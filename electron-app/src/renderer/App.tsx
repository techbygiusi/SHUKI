import React, { useEffect, useCallback, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useStore } from './store/useStore';
import {
  loadSettings, saveSettings, loadNotesFromLocal, saveNoteLocal, deleteNoteLocal,
  getPendingNotes, markNoteSynced, loadFoldersFromLocal, saveFolderLocal, deleteFolderLocal,
  markFolderSynced, addToSyncQueue, getSyncQueue, removeSyncQueueItem, loadShortcuts,
} from './utils/storage';
import {
  initApi, initSocket, checkServerHealth, fetchNotes, fetchFolders,
  syncNote, disconnectSocket, getApi, deleteFolderOnServer, deleteNoteOnServer,
  syncFolder,
} from './utils/sync';
import { applyTheme, watchSystemTheme } from './utils/theme';
import Onboarding from './components/Onboarding';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Settings from './components/Settings';
import Gallery from './components/Gallery';
import { Note, Folder } from './types';

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default function App() {
  const {
    settings, setSettings, isOnboarding, setIsOnboarding,
    notes, setNotes, addNote, updateNote, removeNote,
    folders, setFolders, addFolder, updateFolder, removeFolder,
    activeNoteId, setActiveNoteId, showSettings, setShowSettings,
    showGallery, setShowGallery,
    setServerStatus, editorMode, setEditorMode,
    syncState, setSyncState, setPendingChanges,
    shortcuts, setShortcuts,
  } = useStore();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      const saved = await loadSettings();
      if (saved.serverUrl || saved.offlineOnly) {
        setSettings(saved);
        setIsOnboarding(false);
      }
      if (saved.theme) applyTheme(saved.theme);
      if (saved.editorMode) setEditorMode(saved.editorMode);

      // Load custom shortcuts
      const customShortcuts = await loadShortcuts();
      if (customShortcuts) {
        const updated = shortcuts.map((s) => ({
          ...s,
          keys: customShortcuts[s.id] || s.keys,
        }));
        setShortcuts(updated);
      }
    })();
  }, []);

  // Apply theme changes
  useEffect(() => {
    applyTheme(settings.theme);
    const cleanup = watchSystemTheme(() => {
      if (settings.theme === 'system') applyTheme('system');
    });
    return cleanup;
  }, [settings.theme]);

  // Load local notes & folders
  useEffect(() => {
    if (!isOnboarding) {
      loadNotesFromLocal().then(setNotes);
      loadFoldersFromLocal().then(setFolders);
    }
  }, [isOnboarding]);

  // Connect to server
  useEffect(() => {
    if (isOnboarding || settings.offlineOnly || !settings.serverUrl) {
      setSyncState('offline');
      return;
    }

    const api = initApi(settings.serverUrl, settings.apiKey);

    // Fetch and merge
    Promise.all([
      fetchNotes(api).catch(() => null),
      fetchFolders(api).catch(() => null),
    ]).then(async ([serverNotes, serverFolders]) => {
      if (serverNotes) {
        const localNotes = await loadNotesFromLocal();
        const merged = mergeNotes(localNotes, serverNotes);
        setNotes(merged);
        for (const n of merged) await saveNoteLocal(n);
      }
      if (serverFolders) {
        const localFolders = await loadFoldersFromLocal();
        const merged = mergeFolders(localFolders, serverFolders);
        setFolders(merged);
        for (const f of merged) await saveFolderLocal(f);
      }
      setServerStatus({ connected: true, lastSync: new Date().toISOString() });
      setSyncState('synced');
    }).catch(() => {
      setServerStatus({ connected: false });
      setSyncState('offline');
    });

    // WebSocket
    const sock = initSocket(
      settings.serverUrl,
      settings.apiKey,
      (note: Note) => {
        updateNote(note.id, note);
        saveNoteLocal({ ...note, synced: true });
      },
      (data: { id: string }) => {
        removeNote(data.id);
        deleteNoteLocal(data.id);
      },
      (count: number) => {
        setServerStatus({ clients: count });
      },
      (folder: Folder) => {
        updateFolder(folder.id, folder);
        saveFolderLocal({ ...folder, synced: true });
      },
      (data: { id: string }) => {
        removeFolder(data.id);
        deleteFolderLocal(data.id);
      },
    );

    sock.on('connect', () => {
      setServerStatus({ connected: true });
      setSyncState('synced');
      syncPendingChanges();
    });
    sock.on('disconnect', () => {
      setServerStatus({ connected: false });
      setSyncState('offline');
    });

    // Health check every 30s
    const healthInterval = setInterval(async () => {
      const result = await checkServerHealth(settings.serverUrl, settings.apiKey);
      setServerStatus({
        connected: result.ok,
        ...(result.data ? { clients: result.data.clients, storage: result.data.storage } : {}),
      });
      if (result.ok) {
        syncPendingChanges();
      } else {
        setSyncState('offline');
      }
    }, 30000);

    return () => {
      clearInterval(healthInterval);
      disconnectSocket();
    };
  }, [isOnboarding, settings.serverUrl, settings.apiKey, settings.offlineOnly]);

  // Update pending changes count
  useEffect(() => {
    const updatePending = async () => {
      const pending = await getPendingNotes();
      const queue = await getSyncQueue();
      setPendingChanges(pending.length + queue.length);
      if (pending.length + queue.length > 0 && syncState === 'synced') {
        setSyncState('pending');
      }
    };
    updatePending();
    const interval = setInterval(updatePending, 5000);
    return () => clearInterval(interval);
  }, [syncState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const key = e.key.toUpperCase();

      const combo = [
        mod ? 'Ctrl' : '',
        shift ? 'Shift' : '',
        e.altKey ? 'Alt' : '',
        !['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key) ? key : '',
      ].filter(Boolean).join('+');

      const shortcutMap: Record<string, () => void> = {
        newNote: () => handleNewNote(),
        newFolder: () => handleNewFolder(),
        save: () => handleForceSave(),
        search: () => document.getElementById('search-input')?.focus(),
        settings: () => setShowSettings(true),
        toggleDark: () => {
          const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
          setSettings({ theme: newTheme });
          saveSettings({ theme: newTheme });
          applyTheme(newTheme);
        },
        toggleMarkdown: () => {
          const newMode = editorMode === 'rich' ? 'markdown' : 'rich';
          setEditorMode(newMode);
          saveSettings({ editorMode: newMode });
        },
        gallery: () => setShowGallery(true),
      };

      for (const sc of shortcuts) {
        if (sc.keys === combo && shortcutMap[sc.id]) {
          e.preventDefault();
          shortcutMap[sc.id]();
          return;
        }
      }

      // Fallback for comma key which may not normalize
      if (mod && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorMode, settings.theme, shortcuts]);

  const handleNewNote = useCallback(() => {
    const state = useStore.getState();
    const note: Note = {
      id: generateId(),
      title: 'Untitled',
      content: '',
      tags: [],
      folderId: state.activeFolderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
    };
    addNote(note);
    saveNoteLocal(note);
    setActiveNoteId(note.id);
    addToSyncQueue('upsert', 'note', note.id, note);
  }, []);

  const handleNewFolder = useCallback((): string => {
    const state = useStore.getState();
    const folder: Folder = {
      id: generateId(),
      name: 'New Folder',
      sortOrder: state.folders.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
    };
    addFolder(folder);
    saveFolderLocal(folder);
    addToSyncQueue('upsert', 'folder', folder.id, folder);
    return folder.id;
  }, []);

  const handleNoteChange = useCallback((id: string, updates: Partial<Note>) => {
    const now = new Date().toISOString();
    updateNote(id, { ...updates, updatedAt: now, synced: false });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const state = useStore.getState();
      const note = state.notes.find((n) => n.id === id);
      if (!note) return;

      const updated = { ...note, ...updates, updatedAt: now, synced: false };
      await saveNoteLocal(updated);

      const api = getApi();
      if (api && !state.settings.offlineOnly) {
        try {
          setSyncState('syncing');
          await syncNote(api, updated);
          updateNote(id, { synced: true });
          await saveNoteLocal({ ...updated, synced: true });
          setServerStatus({ lastSync: new Date().toISOString() });
          setSyncState('synced');
        } catch {
          await addToSyncQueue('upsert', 'note', id, updated);
          setSyncState('pending');
        }
      } else {
        await addToSyncQueue('upsert', 'note', id, updated);
      }
    }, settings.autoSaveInterval);
  }, [settings.autoSaveInterval, settings.offlineOnly]);

  const handleDeleteNote = useCallback(async (id: string) => {
    removeNote(id);
    await deleteNoteLocal(id);
    const api = getApi();
    if (api && !settings.offlineOnly) {
      try {
        await deleteNoteOnServer(api, id);
      } catch {
        await addToSyncQueue('delete', 'note', id, {});
      }
    } else {
      await addToSyncQueue('delete', 'note', id, {});
    }
  }, [settings.offlineOnly]);

  const handleDeleteFolder = useCallback(async (id: string) => {
    removeFolder(id);
    await deleteFolderLocal(id);
    const api = getApi();
    if (api && !settings.offlineOnly) {
      try {
        await deleteFolderOnServer(api, id);
      } catch {
        await addToSyncQueue('delete', 'folder', id, {});
      }
    } else {
      await addToSyncQueue('delete', 'folder', id, {});
    }
  }, [settings.offlineOnly]);

  const handleRenameFolder = useCallback(async (id: string, name: string) => {
    const now = new Date().toISOString();
    updateFolder(id, { name, updatedAt: now, synced: false });
    const state = useStore.getState();
    const folder = state.folders.find((f) => f.id === id);
    if (folder) {
      const updated = { ...folder, name, updatedAt: now, synced: false };
      await saveFolderLocal(updated);
      const api = getApi();
      if (api && !settings.offlineOnly) {
        try {
          await syncFolder(api, updated);
          updateFolder(id, { synced: true });
          await saveFolderLocal({ ...updated, synced: true });
        } catch {
          await addToSyncQueue('upsert', 'folder', id, updated);
        }
      } else {
        await addToSyncQueue('upsert', 'folder', id, updated);
      }
    }
  }, [settings.offlineOnly]);

  const handleMoveNote = useCallback(async (noteId: string, folderId: string | null) => {
    const now = new Date().toISOString();
    updateNote(noteId, { folderId, updatedAt: now, synced: false });
    const state = useStore.getState();
    const note = state.notes.find((n) => n.id === noteId);
    if (note) {
      const updated = { ...note, folderId, updatedAt: now, synced: false };
      await saveNoteLocal(updated);
      const api = getApi();
      if (api && !settings.offlineOnly) {
        try {
          await syncNote(api, updated);
          updateNote(noteId, { synced: true });
          await saveNoteLocal({ ...updated, synced: true });
        } catch {
          await addToSyncQueue('upsert', 'note', noteId, updated);
        }
      } else {
        await addToSyncQueue('upsert', 'note', noteId, updated);
      }
    }
  }, [settings.offlineOnly]);

  const handleDuplicateNote = useCallback(async (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const dup: Note = {
      ...note,
      id: generateId(),
      title: `${note.title} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
    };
    addNote(dup);
    await saveNoteLocal(dup);
    setActiveNoteId(dup.id);
    await addToSyncQueue('upsert', 'note', dup.id, dup);
  }, [notes]);

  const handleForceSave = useCallback(async () => {
    await syncPendingChanges();
    toast.success('Sync triggered');
  }, []);

  async function syncPendingChanges() {
    const api = getApi();
    const state = useStore.getState();
    if (!api || state.settings.offlineOnly) return;

    setSyncState('syncing');

    // Sync pending notes
    const pending = await getPendingNotes();
    for (const note of pending) {
      try {
        await syncNote(api, note);
        await markNoteSynced(note.id);
        updateNote(note.id, { synced: true });
      } catch {
        // Will retry
      }
    }

    // Process sync queue
    const queue = await getSyncQueue();
    for (const item of queue) {
      try {
        if (item.entityType === 'note') {
          if (item.action === 'delete') {
            await deleteNoteOnServer(api, item.entityId);
          } else {
            const payload = JSON.parse(item.payload) as Note;
            await syncNote(api, payload);
          }
        } else if (item.entityType === 'folder') {
          if (item.action === 'delete') {
            await deleteFolderOnServer(api, item.entityId);
          } else {
            const payload = JSON.parse(item.payload) as Folder;
            await syncFolder(api, payload);
          }
        }
        await removeSyncQueueItem(item.id);
      } catch {
        // Will retry next cycle
      }
    }

    const remaining = await getSyncQueue();
    const pendingRemaining = await getPendingNotes();
    if (remaining.length + pendingRemaining.length === 0) {
      setSyncState('synced');
      setServerStatus({ lastSync: new Date().toISOString() });
    } else {
      setSyncState('pending');
    }
  }

  const handleOnboardingComplete = useCallback(async (config: { serverUrl: string; apiKey: string; offlineOnly: boolean }) => {
    const newSettings = { ...settings, ...config };
    setSettings(newSettings);
    await saveSettings(newSettings);
    setIsOnboarding(false);
  }, [settings]);

  if (isOnboarding) {
    return (
      <>
        <Onboarding onComplete={handleOnboardingComplete} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (showSettings) {
    return (
      <>
        <Settings onClose={() => setShowSettings(false)} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (showGallery) {
    return (
      <>
        <Gallery
          onClose={() => setShowGallery(false)}
          onOpenNote={(id) => { setActiveNoteId(id); setShowGallery(false); }}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }

  const activeNote = notes.find((n) => n.id === activeNoteId);

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Sidebar
        onNewNote={handleNewNote}
        onNewFolder={handleNewFolder}
        onDeleteNote={handleDeleteNote}
        onDeleteFolder={handleDeleteFolder}
        onRenameFolder={handleRenameFolder}
        onMoveNote={handleMoveNote}
        onDuplicateNote={handleDuplicateNote}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeNote ? (
          <Editor
            note={activeNote}
            onChange={handleNoteChange}
            folders={folders}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            <div className="text-center fade-in">
              <p className="text-lg font-display italic">Select a note or create a new one</p>
              <p className="text-sm mt-2">Ctrl/Cmd + N to create a new note</p>
            </div>
          </div>
        )}
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
          },
        }}
      />
    </div>
  );
}

function mergeNotes(local: Note[], server: Note[]): Note[] {
  const map = new Map<string, Note>();
  for (const n of local) map.set(n.id, n);
  for (const n of server) {
    const existing = map.get(n.id);
    if (!existing || new Date(n.updatedAt) >= new Date(existing.updatedAt)) {
      map.set(n.id, { ...n, synced: true });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function mergeFolders(local: Folder[], server: Folder[]): Folder[] {
  const map = new Map<string, Folder>();
  for (const f of local) map.set(f.id, f);
  for (const f of server) {
    const existing = map.get(f.id);
    if (!existing || new Date(f.updatedAt) >= new Date(existing.updatedAt)) {
      map.set(f.id, { ...f, synced: true });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}
