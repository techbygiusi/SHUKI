import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { initLocalDb, LocalDatabase } from './localDb';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let localDb: LocalDatabase;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin' ? true : true,
    backgroundColor: '#FAFAF8',
    webPreferences: {
      preload: path.join(__dirname, '..', 'main', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  localDb = await initLocalDb(app.getPath('userData'));
  createWindow();

  // IPC Handlers
  ipcMain.handle('store:get', (_e, key: string) => store.get(key));
  ipcMain.handle('store:set', (_e, key: string, value: unknown) => store.set(key, value));
  ipcMain.handle('store:delete', (_e, key: string) => store.delete(key));

  // Local DB operations
  ipcMain.handle('db:getNotes', () => localDb.getAllNotes());
  ipcMain.handle('db:getNote', (_e, id: string) => localDb.getNote(id));
  ipcMain.handle('db:saveNote', (_e, note: { id: string; title: string; content: string; tags: string[]; updatedAt: string; synced: boolean }) => {
    localDb.saveNote(note);
    return true;
  });
  ipcMain.handle('db:deleteNote', (_e, id: string) => {
    localDb.deleteNote(id);
    return true;
  });
  ipcMain.handle('db:getPendingNotes', () => localDb.getPendingNotes());
  ipcMain.handle('db:markSynced', (_e, id: string) => {
    localDb.markSynced(id);
    return true;
  });
  ipcMain.handle('db:clearCache', () => {
    localDb.clearAll();
    return true;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
