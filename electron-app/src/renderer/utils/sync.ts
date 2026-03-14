import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import { Note, Folder } from '../types';

let apiClient: AxiosInstance | null = null;
let socket: Socket | null = null;

// Image cache: filename -> blob URL
const imageCache = new Map<string, string>();

export function initApi(serverUrl: string, apiKey: string): AxiosInstance {
  apiClient = axios.create({
    baseURL: serverUrl,
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 10000,
  });
  return apiClient;
}

export function getApi(): AxiosInstance | null {
  return apiClient;
}

export function clearApi(): void {
  apiClient = null;
}

export function initSocket(
  serverUrl: string,
  apiKey: string,
  onNoteUpdated: (note: Note) => void,
  onNoteDeleted: (data: { id: string }) => void,
  onClientsCount: (count: number) => void,
  onFolderUpdated?: (folder: Folder) => void,
  onFolderDeleted?: (data: { id: string }) => void,
): Socket {
  if (socket) socket.disconnect();

  socket = io(serverUrl, {
    auth: { token: apiKey },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  });

  socket.on('note:updated', onNoteUpdated);
  socket.on('note:deleted', onNoteDeleted);
  socket.on('clients:count', onClientsCount);
  if (onFolderUpdated) socket.on('folder:updated', onFolderUpdated);
  if (onFolderDeleted) socket.on('folder:deleted', onFolderDeleted);

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export type HealthErrorType = 'auth' | 'network' | 'server' | 'unknown';

export interface HealthResult {
  ok: boolean;
  data?: { status: string; clients: number; storage: { free: number; total: number; path: string }; version: string };
  errorType?: HealthErrorType;
}

/**
 * Check server reachability AND validate API key.
 * First hits /api/health (no auth) to verify server is up,
 * then hits /api/validate (auth required) to verify the API key.
 */
export async function checkServerHealth(serverUrl: string, apiKey: string): Promise<HealthResult> {
  try {
    // Check basic reachability
    const healthRes = await axios.get(`${serverUrl}/api/health`, { timeout: 10000 });

    // Validate API key against authenticated endpoint
    if (apiKey) {
      try {
        await axios.get(`${serverUrl}/api/validate`, {
          timeout: 10000,
          headers: { Authorization: `Bearer ${apiKey}` },
        });
      } catch (authErr: unknown) {
        if (axios.isAxiosError(authErr)) {
          if (authErr.response?.status === 401 || authErr.response?.status === 403) {
            return { ok: false, errorType: 'auth' };
          }
          if (authErr.response && authErr.response.status >= 500) {
            return { ok: false, errorType: 'server' };
          }
        }
        return { ok: false, errorType: 'unknown' };
      }
    }

    return { ok: true, data: healthRes.data };
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (!err.response) {
        return { ok: false, errorType: 'network' };
      }
      if (err.response.status >= 500) {
        return { ok: false, errorType: 'server' };
      }
    }
    return { ok: false, errorType: 'network' };
  }
}

export async function fetchNotes(api: AxiosInstance): Promise<Note[]> {
  const res = await api.get('/api/notes');
  return res.data.map((n: Record<string, unknown>) => ({
    id: n.id as string,
    title: n.title as string,
    content: n.content as string,
    tags: (n.tags as string[]) || [],
    folderId: (n.folderId as string | null) || null,
    createdAt: n.createdAt as string,
    updatedAt: n.updatedAt as string,
    synced: true,
  }));
}

export async function fetchFolders(api: AxiosInstance): Promise<Folder[]> {
  const res = await api.get('/api/folders');
  return res.data.map((f: Record<string, unknown>) => ({
    id: f.id as string,
    name: f.name as string,
    sortOrder: (f.sortOrder as number) || 0,
    createdAt: f.createdAt as string,
    updatedAt: f.updatedAt as string,
    synced: true,
  }));
}

export async function syncNote(api: AxiosInstance, note: Note): Promise<Note> {
  const res = await api.put(`/api/notes/${note.id}`, {
    title: note.title,
    content: note.content,
    tags: note.tags,
    folderId: note.folderId,
  });
  return { ...res.data, synced: true };
}

export async function createNoteOnServer(api: AxiosInstance, note: Note): Promise<Note> {
  const res = await api.post('/api/notes', {
    id: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags,
    folderId: note.folderId,
  });
  return { ...res.data, synced: true };
}

export async function deleteNoteOnServer(api: AxiosInstance, id: string): Promise<void> {
  await api.delete(`/api/notes/${id}`);
}

export async function syncFolder(api: AxiosInstance, folder: Folder): Promise<Folder> {
  const res = await api.put(`/api/folders/${folder.id}`, {
    name: folder.name,
    sortOrder: folder.sortOrder,
  });
  return { ...res.data, synced: true };
}

export async function createFolderOnServer(api: AxiosInstance, folder: Folder): Promise<Folder> {
  const res = await api.post('/api/folders', {
    id: folder.id,
    name: folder.name,
    sortOrder: folder.sortOrder,
  });
  return { ...res.data, synced: true };
}

export async function deleteFolderOnServer(api: AxiosInstance, id: string): Promise<void> {
  await api.delete(`/api/folders/${id}`);
}

// --- Image sync ---

/**
 * Upload an image to the server.
 * Returns { url, filename } from the server.
 */
export async function uploadImageToServer(
  api: AxiosInstance,
  imageData: ArrayBuffer | Blob,
  filename: string
): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  const blob = imageData instanceof Blob ? imageData : new Blob([imageData]);
  formData.append('image', blob, filename);

  const res = await api.post('/api/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return res.data;
}

/**
 * Fetch an image from the server and return a blob URL.
 * Results are cached in memory.
 */
export async function fetchImageFromServer(
  serverUrl: string,
  apiKey: string,
  filename: string
): Promise<string> {
  const cached = imageCache.get(filename);
  if (cached) return cached;

  const res = await axios.get(`${serverUrl}/api/images/${filename}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    responseType: 'blob',
    timeout: 30000,
  });

  const blobUrl = URL.createObjectURL(res.data as Blob);
  imageCache.set(filename, blobUrl);
  return blobUrl;
}

export function getCachedImageUrl(filename: string): string | null {
  return imageCache.get(filename) || null;
}

export function clearImageCache(): void {
  for (const url of imageCache.values()) {
    URL.revokeObjectURL(url);
  }
  imageCache.clear();
}

export interface ServerImageMeta {
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

/**
 * Fetch the list of all images from the server.
 */
export async function fetchImageList(api: AxiosInstance): Promise<ServerImageMeta[]> {
  const res = await api.get('/api/images');
  return res.data as ServerImageMeta[];
}

/**
 * Check if an axios error is an auth error (401/403).
 */
export function isAuthError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    return err.response?.status === 401 || err.response?.status === 403;
  }
  return false;
}

/**
 * Check if an axios error is a network error (no response).
 */
export function isNetworkError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    return !err.response;
  }
  return false;
}
