import { app, BrowserWindow, ipcMain, nativeTheme, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';
import { initLocalDb, LocalDatabase } from './localDb';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let localDb: LocalDatabase;

function getThemeBg(): string {
  const settings = store.get('settings') as Record<string, unknown> | undefined;
  const theme = settings?.theme as string | undefined;
  const isDark = theme === 'dark' || (theme !== 'light' && nativeTheme.shouldUseDarkColors);
  return isDark ? '#1C1814' : '#F7F3EE';
}

function createWindow() {
  const bounds = store.get('windowBounds') as { width?: number; height?: number; x?: number; y?: number } | undefined;

  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: bounds?.width || 1280,
    height: bounds?.height || 800,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    backgroundColor: getThemeBg(),
    autoHideMenuBar: true,
    icon: iconPath,
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

  const saveBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const b = mainWindow.getBounds();
      store.set('windowBounds', { width: b.width, height: b.height, x: b.x, y: b.y });
    }
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getImagesPath(): string {
  const imagesDir = path.join(app.getPath('userData'), 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  return imagesDir;
}

function getImageCachePath(): string {
  const cacheDir = path.join(app.getPath('userData'), 'image-cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

app.whenReady().then(async () => {
  protocol.registerFileProtocol('shuki', (request, callback) => {
    const url = request.url.replace('shuki://', '');
    const decodedPath = decodeURIComponent(url);
    callback({ path: decodedPath });
  });

  // shuki-img:// protocol handler — resolves images from local cache, local images dir, or fetches from server
  protocol.registerBufferProtocol('shuki-img', async (request, callback) => {
    const filename = path.basename(request.url.replace('shuki-img://', ''));
    const mimeType = getMimeType(filename);

    // 1. Check local images directory first
    const localPath = path.join(getImagesPath(), filename);
    if (fs.existsSync(localPath)) {
      const data = fs.readFileSync(localPath);
      callback({ mimeType, data });
      return;
    }

    // 2. Check image cache
    const cachePath = path.join(getImageCachePath(), filename);
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath);
      callback({ mimeType, data });
      return;
    }

    // 3. Fetch from server with auth header
    const settings = store.get('settings') as Record<string, unknown> | undefined;
    const serverUrl = settings?.serverUrl as string | undefined;
    const apiKey = settings?.apiKey as string | undefined;

    if (!serverUrl || !apiKey) {
      callback({ mimeType: 'text/plain', data: Buffer.from('Image not available') });
      return;
    }

    try {
      const url = `${serverUrl}/api/images/${encodeURIComponent(filename)}`;
      const response = await net.fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        callback({ mimeType: 'text/plain', data: Buffer.from('Image fetch failed') });
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);

      // Cache the image for future use
      fs.writeFileSync(cachePath, data);

      callback({ mimeType, data });
    } catch {
      callback({ mimeType: 'text/plain', data: Buffer.from('Image fetch failed') });
    }
  });

  localDb = await initLocalDb(app.getPath('userData'));
  createWindow();

  // Store
  ipcMain.handle('store:get', (_e, key: string) => store.get(key));
  ipcMain.handle('store:set', (_e, key: string, value: unknown) => store.set(key, value));
  ipcMain.handle('store:delete', (_e, key: string) => store.delete(key));

  // Notes
  ipcMain.handle('db:getNotes', () => localDb.getAllNotes());
  ipcMain.handle('db:getNote', (_e, id: string) => localDb.getNote(id));
  ipcMain.handle('db:saveNote', (_e, note: { id: string; title: string; content: string; tags: string[]; folderId?: string | null; updatedAt: string; synced: boolean }) => {
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

  // Folders
  ipcMain.handle('db:getFolders', () => localDb.getAllFolders());
  ipcMain.handle('db:saveFolder', (_e, folder: { id: string; name: string; sortOrder: number; synced: boolean }) => {
    localDb.saveFolder(folder);
    return true;
  });
  ipcMain.handle('db:deleteFolder', (_e, id: string) => {
    localDb.deleteFolder(id);
    return true;
  });
  ipcMain.handle('db:markFolderSynced', (_e, id: string) => {
    localDb.markFolderSynced(id);
    return true;
  });

  // Sync Queue
  ipcMain.handle('db:addToSyncQueue', (_e, action: string, entityType: string, entityId: string, payload: string) => {
    localDb.addToSyncQueue(action, entityType, entityId, payload);
    return true;
  });
  ipcMain.handle('db:getSyncQueue', () => localDb.getSyncQueue());
  ipcMain.handle('db:removeSyncQueueItem', (_e, id: number) => {
    localDb.removeSyncQueueItem(id);
    return true;
  });
  ipcMain.handle('db:clearSyncQueue', () => {
    localDb.clearSyncQueue();
    return true;
  });

  // Images
  ipcMain.handle('images:save', async (_e, buffer: ArrayBuffer, filename: string) => {
    const imagesDir = getImagesPath();
    const filePath = path.join(imagesDir, filename);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return filePath;
  });
  ipcMain.handle('images:getPath', () => getImagesPath());
  ipcMain.handle('images:list', () => {
    const imagesDir = getImagesPath();
    if (!fs.existsSync(imagesDir)) return [];
    return fs.readdirSync(imagesDir).filter(f => /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(f));
  });
  ipcMain.handle('images:delete', (_e, filename: string) => {
    const filePath = path.join(getImagesPath(), path.basename(filename));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  });
  ipcMain.handle('images:read', (_e, filename: string) => {
    const filePath = path.join(getImagesPath(), path.basename(filename));
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
    return null;
  });

  // Image cache
  ipcMain.handle('images:getCachePath', () => getImageCachePath());
  ipcMain.handle('images:clearCache', () => {
    const cacheDir = getImageCachePath();
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(cacheDir, file));
      }
    }
    return true;
  });
  ipcMain.handle('images:cacheImage', (_e, buffer: ArrayBuffer, filename: string) => {
    const cachePath = path.join(getImageCachePath(), path.basename(filename));
    fs.writeFileSync(cachePath, Buffer.from(buffer));
    return cachePath;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
