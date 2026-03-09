import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { saveSettings, clearLocalCache, saveShortcuts, loadShortcuts, resetAllSettings } from '../utils/storage';
import { checkServerHealth } from '../utils/sync';
import { applyTheme } from '../utils/theme';
import { ThemeMode, ShortcutConfig } from '../types';
import { toast } from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export default function Settings({ onClose }: Props) {
  const { settings, setSettings, serverStatus, setServerStatus, notes, settingsTab, setSettingsTab, shortcuts, setShortcuts } = useStore();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  useEffect(() => {
    if (settings.serverUrl && !settings.offlineOnly) {
      checkServerHealth(settings.serverUrl, settings.apiKey).then((result) => {
        setServerStatus({
          connected: result.ok,
          ...(result.data ? { clients: result.data.clients, storage: result.data.storage } : {}),
        });
      });
    }
  }, []);

  // Health check polling
  useEffect(() => {
    if (settingsTab !== 'server' || settings.offlineOnly || !settings.serverUrl) return;
    const interval = setInterval(() => {
      checkServerHealth(settings.serverUrl, settings.apiKey).then((result) => {
        setServerStatus({
          connected: result.ok,
          ...(result.data ? { clients: result.data.clients, storage: result.data.storage } : {}),
        });
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [settingsTab, settings.serverUrl, settings.apiKey, settings.offlineOnly]);

  // Shortcut recording
  useEffect(() => {
    if (!recordingId) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        parts.push(key);
      }
      if (parts.length < 2) return;
      const combo = parts.join('+');

      // Check for conflicts
      const conflict = shortcuts.find((s) => s.id !== recordingId && s.keys === combo);
      if (conflict) {
        toast.error(`Shortcut conflicts with "${conflict.label}"`);
        return;
      }

      const updated = shortcuts.map((s) =>
        s.id === recordingId ? { ...s, keys: combo } : s
      );
      setShortcuts(updated);
      saveShortcutsToStore(updated);
      setRecordingId(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recordingId, shortcuts]);

  function saveShortcutsToStore(list: ShortcutConfig[]) {
    const map: Record<string, string> = {};
    for (const s of list) map[s.id] = s.keys;
    saveShortcuts(map);
  }

  const handleThemeChange = (theme: ThemeMode) => {
    setSettings({ theme });
    saveSettings({ theme });
    applyTheme(theme);
  };

  const handleFontSizeChange = (size: number) => {
    setSettings({ fontSize: size });
    saveSettings({ fontSize: size });
  };

  const handleAutoSaveChange = (interval: number) => {
    setSettings({ autoSaveInterval: interval });
    saveSettings({ autoSaveInterval: interval });
  };

  const [serverUpdateStatus, setServerUpdateStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [serverUpdateMsg, setServerUpdateMsg] = useState('');

  const handleServerUpdate = async () => {
    const url = serverUrl.replace(/\/+$/, '');
    setServerUpdateStatus('checking');
    setServerUpdateMsg('');
    const result = await checkServerHealth(url, apiKey);
    if (result.ok) {
      setSettings({ serverUrl: url, apiKey, offlineOnly: false });
      saveSettings({ serverUrl: url, apiKey, offlineOnly: false });
      setServerStatus({ connected: true });
      setServerUpdateStatus('success');
      setServerUpdateMsg('\u2705 Connection updated successfully');
      toast.success('Server connection updated');
    } else if (result.errorType === 'auth') {
      setServerUpdateStatus('error');
      setServerUpdateMsg('\u274C Invalid API Key');
    } else if (result.errorType === 'network') {
      setServerUpdateStatus('error');
      setServerUpdateMsg('\u274C Server not reachable \u2014 check the URL');
    } else {
      setServerUpdateStatus('error');
      setServerUpdateMsg('\u274C Could not connect to server');
    }
  };

  const handleExportNotes = async () => {
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();
      for (const note of notes) {
        const filename = `${note.title.replace(/[^a-zA-Z0-9 -]/g, '')}.md`;
        zip.file(filename, `# ${note.title}\n\n${note.content}`);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'shuki-export.zip');
      toast.success(`Exported ${notes.length} notes`);
    } catch {
      toast.error('Failed to export notes');
    }
  };

  const handleClearCache = async () => {
    await clearLocalCache();
    toast.success('Local cache cleared');
  };

  const resetShortcuts = useCallback(() => {
    const reset = shortcuts.map((s) => ({ ...s, keys: s.defaultKeys }));
    setShortcuts(reset);
    saveShortcutsToStore(reset);
    toast.success('Shortcuts reset to defaults');
  }, [shortcuts]);

  const tabs = [
    { id: 'shortcuts' as const, label: 'Shortcuts' },
    { id: 'server' as const, label: 'Server' },
    { id: 'general' as const, label: 'General' },
    { id: 'about' as const, label: 'About' },
  ];

  return (
    <div className="h-screen overflow-y-auto fade-in" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h1>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            &#8592; Back
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: settingsTab === tab.id ? 'var(--bg-card)' : 'transparent',
                color: settingsTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: settingsTab === tab.id ? 'var(--shadow)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {settingsTab === 'shortcuts' && (
          <Card>
            <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Keyboard Shortcuts
            </h2>
            <div className="space-y-1">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg transition-all cursor-pointer"
                  style={{
                    backgroundColor: recordingId === shortcut.id ? 'var(--accent-soft)' : 'transparent',
                    border: recordingId === shortcut.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  }}
                  onClick={() => setRecordingId(recordingId === shortcut.id ? null : shortcut.id)}
                >
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{shortcut.label}</span>
                  <kbd
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{
                      backgroundColor: recordingId === shortcut.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                      color: recordingId === shortcut.id ? '#fff' : 'var(--text-primary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {recordingId === shortcut.id ? 'Press keys...' : shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={resetShortcuts}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Reset to Defaults
            </button>
          </Card>
        )}

        {settingsTab === 'server' && (
          <>
            {/* Server Status Card */}
            <Card>
              <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Server Status
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Status" value={
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: serverStatus.connected ? '#22c55e' : '#ef4444' }} />
                    {serverStatus.connected ? 'Connected' : 'Offline'}
                  </span>
                } />
                <InfoRow label="Server URL" value={
                  <span className="flex items-center gap-1">
                    <span className="truncate">{settings.serverUrl || '—'}</span>
                    {settings.serverUrl && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(settings.serverUrl); toast.success('URL copied'); }}
                        className="text-xs px-1 rounded hover:opacity-80"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        Copy
                      </button>
                    )}
                  </span>
                } />
                <InfoRow label="Connected Clients" value={String(serverStatus.clients)} />
                <InfoRow label="Free Storage" value={formatBytes(serverStatus.storage.free)} />
                <InfoRow label="Last Sync" value={formatTimeAgo(serverStatus.lastSync)} />
                <InfoRow label="Storage Path" value={serverStatus.storage.path || '—'} />
              </div>
              {!serverStatus.connected && (
                <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--text-primary)' }}>
                  Working offline — changes will sync when server is available
                </div>
              )}
            </Card>

            {/* Server Configuration */}
            <Card>
              <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Server Configuration
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Server URL</label>
                  <input
                    type="url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://localhost:3000"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>API Key</label>
                  <div className="flex gap-2">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="px-3 py-2 rounded-xl text-xs"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    >
                      {showApiKey ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(apiKey); toast.success('API key copied'); }}
                      className="px-3 py-2 rounded-xl text-xs"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                {serverUpdateMsg && (
                  <div
                    className="text-sm px-3 py-2 rounded-xl"
                    style={{
                      backgroundColor: serverUpdateStatus === 'error' ? '#fee' : '#efe',
                      color: serverUpdateStatus === 'error' ? '#c33' : '#363',
                    }}
                  >
                    {serverUpdateMsg}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleServerUpdate}
                    disabled={serverUpdateStatus === 'checking'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}
                  >
                    {serverUpdateStatus === 'checking' && (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {serverUpdateStatus === 'checking' ? 'Checking...' : 'Update Connection'}
                  </button>
                  <button
                    onClick={() => {
                      checkServerHealth(settings.serverUrl, settings.apiKey).then((result) => {
                        setServerStatus({ connected: result.ok, ...(result.data ? { clients: result.data.clients, storage: result.data.storage } : {}) });
                        toast.success(result.ok ? 'Server reachable' : 'Server unreachable');
                      });
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  >
                    Reconnect
                  </button>
                  <button
                    onClick={() => {
                      setSettings({ serverUrl: '', apiKey: '', offlineOnly: true });
                      saveSettings({ serverUrl: '', apiKey: '', offlineOnly: true });
                      setServerUrl('');
                      setApiKey('');
                      setServerStatus({ connected: false });
                      toast.success('Disconnected from server');
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                    style={{ backgroundColor: '#ef4444', color: '#fff' }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </Card>
          </>
        )}

        {settingsTab === 'general' && (
          <>
            <Card>
              <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Appearance
              </h2>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Theme</label>
                <div className="flex gap-2">
                  {(['light', 'dark', 'system'] as ThemeMode[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize"
                      style={{
                        backgroundColor: settings.theme === t ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                        color: settings.theme === t ? '#fff' : 'var(--text-primary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Editor Font Size: {settings.fontSize}px
                </label>
                <input type="range" min={12} max={24} value={settings.fontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  className="w-full" style={{ accentColor: 'var(--accent-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Auto-save Interval: {(settings.autoSaveInterval / 1000).toFixed(1)}s
                </label>
                <input type="range" min={500} max={5000} step={250} value={settings.autoSaveInterval}
                  onChange={(e) => handleAutoSaveChange(Number(e.target.value))}
                  className="w-full" style={{ accentColor: 'var(--accent-primary)' }}
                />
              </div>
            </Card>

            <Card>
              <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Data
              </h2>
              <div className="flex gap-3">
                <button onClick={handleExportNotes}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}>
                  Export All Notes (ZIP)
                </button>
                <button onClick={handleClearCache}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  Clear Local Cache
                </button>
              </div>
            </Card>

            <Card>
              <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Reset
              </h2>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                Reset all settings, shortcuts, and UI preferences to their defaults. This will reload the app.
              </p>
              <button
                onClick={async () => {
                  await resetAllSettings();
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
              >
                Reset All Settings to Defaults
              </button>
            </Card>
          </>
        )}

        {settingsTab === 'about' && (
          <Card>
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                style={{ backgroundColor: 'var(--accent-primary)' }}>
                <span className="text-2xl font-bold text-white">S</span>
              </div>
              <h2 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>SHUKI</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                v1.0.0
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Self-hosted note-taking with real-time sync
              </p>
              <a
                href="https://github.com/techbygiusi/shuki"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                GitHub Repository
              </a>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 mb-6" style={{
      backgroundColor: 'var(--bg-card)',
      borderRadius: '16px',
      boxShadow: 'var(--shadow)',
    }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs block" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? 's' : ''} ago`;
}
