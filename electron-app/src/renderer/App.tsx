import React, { useEffect, useCallback, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useStore } from './store/useStore';
import {
  loadSettings, saveSettings, loadNotesFromLocal, saveNoteLocal, deleteNoteLocal,
  getPendingNotes, markNoteSynced, loadFoldersFromLocal, saveFolderLocal, deleteFolderLocal,
  markFolderSynced, addToSyncQueue, getSyncQueue, removeSyncQueueItem, loadShortcuts,
  loadUIState, saveUIState, cleanupOrphanedImages, clearSyncQueue,
} from './utils/storage';
import {
  initApi, initSocket, checkServerHealth, fetchNotes, fetchFolders,
  syncNote, disconnectSocket, getApi, deleteFolderOnServer, deleteNoteOnServer,
  syncFolder, isAuthError, isNetworkError, clearApi, fetchImageList,
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

// Backoff delays for queue retries (network errors)
const BACKOFF_DELAYS = [5000, 10000, 30000, 60000];

export default function App() {
  const {
    settings, setSettings, isOnboarding, setIsOnboarding,
    notes, setNotes, addNote, updateNote, removeNote,
    folders, setFolders, addFolder, updateFolder, removeFolder,
    activeNoteId, setActiveNoteId, activeFolderId, setActiveFolderId,
    showSettings, setShowSettings,
    showGallery, setShowGallery,
    setServerStatus, editorMode, setEditorMode,
    syncState, setSyncState, setPendingChanges, setSyncMessage,
    shortcuts, setShortcuts,
  } = useStore();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInProgressRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authErrorMessageRef = useRef<string>('');

  // Load settings on mount
  useEffect(() => {
    (async () => {
      const saved = await loadSettings();
      if (saved.serverUrl || saved.offlineOnly) {
        setSettings(saved);
        // Don't set isOnboarding to false yet — we validate credentials first
        if (saved.offlineOnly) {
          setIsOnboarding(false);
          setSyncState('disconnected');
        }
        // If serverUrl is set but not offlineOnly, we validate on next effect
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

      // Restore UI state
      const uiState = await loadUIState();
      if (uiState.activeNoteId) setActiveNoteId(uiState.activeNoteId);
      if (uiState.activeFolderId) setActiveFolderId(uiState.activeFolderId);

      // If we have server credentials, validate them before entering app
      if (saved.serverUrl && !saved.offlineOnly) {
        setSyncState('connecting');
        const result = await checkServerHealth(saved.serverUrl, saved.apiKey || '');
        if (result.ok) {
          setIsOnboarding(false);
        } else if (result.errorType === 'auth') {
          // Invalid stored API key — redirect to connect screen
          authErrorMessageRef.current = 'Your API key is no longer valid \u2014 please reconnect';
          setSyncState('auth_error');
          setIsOnboarding(true);
          // Clear invalid saved credentials
          await saveSettings({ serverUrl: '', apiKey: '' });
          setSettings({ serverUrl: '', apiKey: '' });
        } else {
          // Network/server error — still enter app but show offline state
          setIsOnboarding(false);
          setSyncState('offline');
        }
      }
    })();
  }, []);

  // Persist UI state when active note/folder changes
  useEffect(() => {
    saveUIState({ activeNoteId, activeFolderId });
  }, [activeNoteId, activeFolderId]);

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

  // Connect to server and perform full sync
  useEffect(() => {
    if (isOnboarding || settings.offlineOnly || !settings.serverUrl) {
      if (settings.offlineOnly) setSyncState('disconnected');
      return;
    }

    const api = initApi(settings.serverUrl, settings.apiKey);

    // Validate credentials and perform full sync
    (async () => {
      setSyncState('connecting');

      const healthResult = await checkServerHealth(settings.serverUrl, settings.apiKey);

      if (healthResult.errorType === 'auth') {
        setSyncState('auth_error');
        setServerStatus({ connected: false });
        clearApi();
        return;
      }

      if (!healthResult.ok) {
        setServerStatus({ connected: false });
        setSyncState('offline');
        // Don't return — still set up socket for auto-reconnect
      } else {
        setServerStatus({
          connected: true,
          ...(healthResult.data ? { clients: healthResult.data.clients, storage: healthResult.data.storage } : {}),
        });
      }

      // Perform full sync if server is reachable
      if (healthResult.ok) {
        await performFullSync(api);
      }
    })();

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

    sock.on('connect', async () => {
      const state = useStore.getState();
      if (state.syncState === 'auth_error') return;

      setServerStatus({ connected: true });

      // Re-validate credentials on reconnect
      const result = await checkServerHealth(settings.serverUrl, settings.apiKey);
      if (result.errorType === 'auth') {
        setSyncState('auth_error');
        setServerStatus({ connected: false });
        return;
      }

      if (result.ok) {
        // Process pending queue and fetch server changes
        retryCountRef.current = 0;
        await performFullSync(api);
      }
    });

    sock.on('disconnect', () => {
      const state = useStore.getState();
      if (state.syncState !== 'auth_error') {
        setServerStatus({ connected: false });
        setSyncState('offline');
      }
    });

    sock.on('connect_error', (err) => {
      if (err.message === 'Authentication failed') {
        setSyncState('auth_error');
        setServerStatus({ connected: false });
      }
    });

    // Listen for manual retry events from UI
    const handleRetrySync = async () => {
      const state = useStore.getState();
      if (state.syncState === 'auth_error') return;

      setSyncState('connecting');
      const result = await checkServerHealth(settings.serverUrl, settings.apiKey);
      if (result.ok) {
        setServerStatus({ connected: true });
        retryCountRef.current = 0;
        await performFullSync(api);
      } else if (result.errorType === 'auth') {
        setSyncState('auth_error');
        setServerStatus({ connected: false });
      } else {
        setSyncState('offline');
      }
    };
    window.addEventListener('shuki:retry-sync', handleRetrySync);

    // Health check every 30s — only for connectivity detection, not syncing
    const healthInterval = setInterval(async () => {
      const state = useStore.getState();
      if (state.syncState === 'auth_error') return;

      const result = await checkServerHealth(settings.serverUrl, settings.apiKey);
      if (result.errorType === 'auth') {
        setSyncState('auth_error');
        setServerStatus({ connected: false });
        return;
      }

      const wasOffline = !state.serverStatus.connected;
      setServerStatus({
        connected: result.ok,
        ...(result.data ? { clients: result.data.clients, storage: result.data.storage } : {}),
      });

      if (result.ok && wasOffline) {
        // Coming back online — re-validate and sync
        retryCountRef.current = 0;
        await performFullSync(api);
      } else if (!result.ok && state.syncState !== 'offline') {
        setSyncState('offline');
      }
    }, 30000);

    return () => {
      clearInterval(healthInterval);
      disconnectSocket();
      window.removeEventListener('shuki:retry-sync', handleRetrySync);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [isOnboarding, settings.serverUrl, settings.apiKey, settings.offlineOnly]);

  // Update pending changes count on sync state change
  useEffect(() => {
    const updatePending = async () => {
      const pending = await getPendingNotes();
      const queue = await getSyncQueue();
      const total = pending.length + queue.length;
      setPendingChanges(total);
      if (total > 0 && syncState === 'synced') {
        setSyncState('pending');
      }
    };
    updatePending();
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

      if (mod && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorMode, settings.theme, shortcuts]);

  // --- Full sync logic ---
  async function performFullSync(api: ReturnType<typeof initApi>) {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;

    try {
      setSyncState('syncing');
      setSyncMessage('Fetching notes...');

      // Step 1: Fetch all server data
      const [serverNotes, serverFolders] = await Promise.all([
        fetchNotes(api).catch((err) => {
          if (isAuthError(err)) {
            setSyncState('auth_error');
            setServerStatus({ connected: false });
          }
          return null;
        }),
        fetchFolders(api).catch(() => null),
      ]);

      const currentState = useStore.getState();
      if (currentState.syncState === 'auth_error') {
        syncInProgressRef.current = false;
        return;
      }

      // Step 2: Merge notes (server wins for conflicts by updatedAt)
      if (serverNotes) {
        const localNotes = await loadNotesFromLocal();
        const merged = mergeNotes(localNotes, serverNotes);
        setNotes(merged);

        const total = merged.length;
        let count = 0;
        for (const n of merged) {
          count++;
          setSyncMessage(`Syncing ${count} of ${total} notes...`);
          await saveNoteLocal(n);
        }
      }

      // Step 3: Merge folders
      if (serverFolders) {
        const localFolders = await loadFoldersFromLocal();
        const merged = mergeFolders(localFolders, serverFolders);
        setFolders(merged);
        for (const f of merged) await saveFolderLocal(f);
      }

      // Step 4: Sync images from server
      setSyncMessage('Syncing images...');
      try {
        const serverImages = await fetchImageList(api);
        // Cache images that we don't have locally
        if (window.electronAPI) {
          const localImages = await window.electronAPI.images.list();
          const localSet = new Set(localImages);
          for (const img of serverImages) {
            if (!localSet.has(img.filename)) {
              // The shuki-img:// protocol handler will fetch and cache on demand
              // Just ensure we know about the images
            }
          }
        }
      } catch {
        // Image list sync is non-critical, continue
      }

      // Step 5: Push local-only notes to server
      setSyncMessage('Pushing local changes...');
      await syncPendingChanges(api);

      // Step 6: Done
      setServerStatus({ connected: true, lastSync: new Date().toISOString() });
      setSyncState('synced');
      setSyncMessage('');
      retryCountRef.current = 0;
    } catch (err) {
      console.error('[Sync] Full sync failed:', err);
      if (isAuthError(err)) {
        setSyncState('auth_error');
        setServerStatus({ connected: false });
      } else if (isNetworkError(err)) {
        setSyncState('offline');
        setServerStatus({ connected: false });
        scheduleRetry(api);
      } else {
        setSyncState('error');
        setSyncMessage('');
      }
    } finally {
      syncInProgressRef.current = false;
    }
  }

  // --- Queue processing ---
  async function syncPendingChanges(api?: ReturnType<typeof initApi>) {
    const activeApi = api || getApi();
    const state = useStore.getState();
    if (!activeApi || state.settings.offlineOnly || state.syncState === 'auth_error') return;

    // Process pending notes (unsynced in local db)
    const pending = await getPendingNotes();
    for (const note of pending) {
      try {
        await syncNote(activeApi, note);
        await markNoteSynced(note.id);
        updateNote(note.id, { synced: true });
      } catch (err: unknown) {
        if (isAuthError(err)) {
          setSyncState('auth_error');
          setServerStatus({ connected: false });
          return;
        }
        if (isNetworkError(err)) {
          setSyncState('offline');
          scheduleRetry();
          return;
        }
        console.error(`[Sync] Failed to sync note "${note.title}":`, err);
      }
    }

    // Process sync queue items one at a time
    const queue = await getSyncQueue();
    let retries = 0;
    for (const item of queue) {
      try {
        if (item.entityType === 'note') {
          if (item.action === 'delete') {
            await deleteNoteOnServer(activeApi, item.entityId);
          } else {
            const latestNotes = await loadNotesFromLocal();
            const latestNote = latestNotes.find(n => n.id === item.entityId);
            const payload = latestNote || (JSON.parse(item.payload) as Note);
            await syncNote(activeApi, payload);
            await markNoteSynced(item.entityId);
            updateNote(item.entityId, { synced: true });
          }
        } else if (item.entityType === 'folder') {
          if (item.action === 'delete') {
            await deleteFolderOnServer(activeApi, item.entityId);
          } else {
            const payload = JSON.parse(item.payload) as Folder;
            await syncFolder(activeApi, payload);
          }
        }
        await removeSyncQueueItem(item.id);
        retries = 0; // Reset retries on success
      } catch (err: unknown) {
        if (isAuthError(err)) {
          setSyncState('auth_error');
          setServerStatus({ connected: false });
          return;
        }
        if (isNetworkError(err)) {
          setSyncState('offline');
          scheduleRetry();
          return;
        }
        // Server error (500): retry up to 3 times
        retries++;
        if (retries >= 3) {
          console.error(`[Sync] Queue item ${item.id} failed 3 times, skipping:`, err);
          retries = 0;
          // Leave item in queue for next full sync attempt
          continue;
        }
        console.error(`[Sync] Queue item ${item.id} failed (retry ${retries}/3):`, err);
      }
    }

    // Update counts
    const remaining = await getSyncQueue();
    const pendingRemaining = await getPendingNotes();
    const total = remaining.length + pendingRemaining.length;
    setPendingChanges(total);
  }

  // --- Retry with exponential backoff ---
  function scheduleRetry(api?: ReturnType<typeof initApi>) {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    const delayIndex = Math.min(retryCountRef.current, BACKOFF_DELAYS.length - 1);
    const delay = BACKOFF_DELAYS[delayIndex];
    retryCountRef.current++;

    retryTimerRef.current = setTimeout(async () => {
      const state = useStore.getState();
      if (state.syncState === 'auth_error') return;

      const activeApi = api || getApi();
      if (!activeApi) return;

      const result = await checkServerHealth(state.settings.serverUrl, state.settings.apiKey);
      if (result.ok) {
        setServerStatus({ connected: true });
        await performFullSync(activeApi);
      } else if (result.errorType === 'auth') {
        setSyncState('auth_error');
        setServerStatus({ connected: false });
      } else {
        // Still offline, retry again
        setSyncState('offline');
        scheduleRetry(api);
      }
    }, delay);
  }

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
    triggerSync();
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
    triggerSync();
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

      // Cleanup orphaned images after saving
      cleanupOrphanedImages(state.notes);

      const api = getApi();
      if (api && !state.settings.offlineOnly && state.syncState !== 'auth_error') {
        try {
          setSyncState('syncing');
          await syncNote(api, updated);
          updateNote(id, { synced: true });
          await saveNoteLocal({ ...updated, synced: true });
          setServerStatus({ lastSync: new Date().toISOString() });
          setSyncState('synced');
        } catch (err: unknown) {
          if (isAuthError(err)) {
            setSyncState('auth_error');
            setServerStatus({ connected: false });
          } else {
            await addToSyncQueue('upsert', 'note', id, updated);
            if (isNetworkError(err)) {
              setSyncState('offline');
              scheduleRetry();
            } else {
              setSyncState('pending');
            }
          }
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
    triggerSync();
  }, [notes]);

  // Trigger sync — debounced, event-driven (not polling)
  function triggerSync() {
    const state = useStore.getState();
    if (state.settings.offlineOnly || state.syncState === 'auth_error') return;

    const api = getApi();
    if (!api) return;

    // Small delay to batch rapid changes
    setTimeout(async () => {
      const currentState = useStore.getState();
      if (currentState.syncState === 'auth_error') return;
      await syncPendingChanges(api);
      const remaining = await getSyncQueue();
      const pendingRemaining = await getPendingNotes();
      const total = remaining.length + pendingRemaining.length;
      setPendingChanges(total);
      if (total === 0) {
        setSyncState('synced');
        setServerStatus({ lastSync: new Date().toISOString() });
      }
    }, 500);
  }

  const handleForceSave = useCallback(async () => {
    const api = getApi();
    if (api) {
      await syncPendingChanges(api);
    }
    toast.success('Sync triggered');
  }, []);

  const handleOnboardingComplete = useCallback(async (config: { serverUrl: string; apiKey: string; offlineOnly: boolean }) => {
    const newSettings = { ...settings, ...config };
    setSettings(newSettings);
    await saveSettings(newSettings);
    authErrorMessageRef.current = '';

    if (!config.offlineOnly && config.serverUrl) {
      // Clear old sync queue when connecting to a new server
      await clearSyncQueue();
    }

    setIsOnboarding(false);
  }, [settings]);

  if (isOnboarding) {
    return (
      <>
        <Onboarding
          onComplete={handleOnboardingComplete}
          authErrorMessage={authErrorMessageRef.current || undefined}
        />
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
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg)' }}>
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
        {syncState === 'auth_error' && (
          <div
            className="flex items-center justify-between px-4 py-2 text-sm"
            style={{ backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '1px solid #fecaca' }}
          >
            <span>Sync failed: Invalid API Key \u2014 go to Settings to fix</span>
            <button
              onClick={() => { setShowSettings(true); useStore.getState().setSettingsTab('server'); }}
              className="px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: '#991b1b', color: '#fff' }}
            >
              Open Settings
            </button>
          </div>
        )}
        {activeNote ? (
          <Editor
            note={activeNote}
            onChange={handleNoteChange}
            folders={folders}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center fade-in">
              <p className="text-lg font-display italic" style={{ color: 'var(--text-muted)' }}>Select a note or create a new one</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Ctrl/Cmd + N to create a new note</p>
            </div>
          </div>
        )}
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
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
