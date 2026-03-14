import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },
  db: {
    getNotes: () => ipcRenderer.invoke('db:getNotes'),
    getNote: (id: string) => ipcRenderer.invoke('db:getNote', id),
    saveNote: (note: { id: string; title: string; content: string; tags: string[]; folderId?: string | null; updatedAt: string; synced: boolean }) =>
      ipcRenderer.invoke('db:saveNote', note),
    deleteNote: (id: string) => ipcRenderer.invoke('db:deleteNote', id),
    getPendingNotes: () => ipcRenderer.invoke('db:getPendingNotes'),
    markSynced: (id: string) => ipcRenderer.invoke('db:markSynced', id),
    clearCache: () => ipcRenderer.invoke('db:clearCache'),
    getFolders: () => ipcRenderer.invoke('db:getFolders'),
    saveFolder: (folder: { id: string; name: string; sortOrder: number; synced: boolean }) =>
      ipcRenderer.invoke('db:saveFolder', folder),
    deleteFolder: (id: string) => ipcRenderer.invoke('db:deleteFolder', id),
    markFolderSynced: (id: string) => ipcRenderer.invoke('db:markFolderSynced', id),
    addToSyncQueue: (action: string, entityType: string, entityId: string, payload: string) =>
      ipcRenderer.invoke('db:addToSyncQueue', action, entityType, entityId, payload),
    getSyncQueue: () => ipcRenderer.invoke('db:getSyncQueue'),
    removeSyncQueueItem: (id: number) => ipcRenderer.invoke('db:removeSyncQueueItem', id),
    clearSyncQueue: () => ipcRenderer.invoke('db:clearSyncQueue'),
  },
  images: {
    save: (buffer: ArrayBuffer, filename: string) => ipcRenderer.invoke('images:save', buffer, filename),
    getPath: () => ipcRenderer.invoke('images:getPath'),
    list: () => ipcRenderer.invoke('images:list'),
    delete: (filename: string) => ipcRenderer.invoke('images:delete', filename),
    read: (filename: string) => ipcRenderer.invoke('images:read', filename),
    getCachePath: () => ipcRenderer.invoke('images:getCachePath'),
    clearCache: () => ipcRenderer.invoke('images:clearCache'),
    cacheImage: (buffer: ArrayBuffer, filename: string) => ipcRenderer.invoke('images:cacheImage', buffer, filename),
  },
});
