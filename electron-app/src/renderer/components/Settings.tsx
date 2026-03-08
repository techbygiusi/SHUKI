import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { saveSettings, clearLocalCache } from '../utils/storage';
import { checkServerHealth } from '../utils/sync';
import { applyTheme } from '../utils/theme';
import { ThemeMode } from '../types';
import { toast } from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export default function Settings({ onClose }: Props) {
  const { settings, setSettings, serverStatus, setServerStatus, notes } = useStore();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);

  useEffect(() => {
    // Refresh server status
    if (settings.serverUrl && !settings.offlineOnly) {
      checkServerHealth(settings.serverUrl, settings.apiKey).then((result) => {
        setServerStatus({
          connected: result.ok,
          ...(result.data ? {
            clients: result.data.clients,
            storage: result.data.storage,
          } : {}),
        });
      });
    }
  }, []);

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

  const handleServerUpdate = async () => {
    const url = serverUrl.replace(/\/+$/, '');
    const result = await checkServerHealth(url, apiKey);
    if (result.ok) {
      setSettings({ serverUrl: url, apiKey, offlineOnly: false });
      saveSettings({ serverUrl: url, apiKey, offlineOnly: false });
      setServerStatus({ connected: true });
      toast.success('Server connection updated');
    } else {
      toast.error('Could not connect to server');
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

  return (
    <div className="h-screen overflow-y-auto fade-in" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h1>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-btn text-sm font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            &#8592; Back
          </button>
        </div>

        {/* Server Status Card */}
        {!settings.offlineOnly && (
          <div
            className="p-6 mb-6"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow)',
            }}
          >
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
              <InfoRow label="Server URL" value={settings.serverUrl || '—'} />
              <InfoRow label="Connected Clients" value={String(serverStatus.clients)} />
              <InfoRow label="Free Storage" value={formatBytes(serverStatus.storage.free)} />
              <InfoRow label="Last Sync" value={formatTimeAgo(serverStatus.lastSync)} />
              <InfoRow label="Storage Path" value={serverStatus.storage.path || '—'} />
            </div>
          </div>
        )}

        {/* App Settings */}
        <div
          className="p-6 mb-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Appearance
          </h2>

          {/* Theme */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Theme</label>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  className="px-4 py-2 rounded-btn text-sm font-medium transition-all capitalize"
                  style={{
                    backgroundColor: settings.theme === t ? '#F5C842' : 'var(--bg-secondary)',
                    color: settings.theme === t ? '#1A1A1A' : 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Editor Font Size: {settings.fontSize}px
            </label>
            <input
              type="range"
              min={12}
              max={24}
              value={settings.fontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
          </div>

          {/* Auto-save interval */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Auto-save Interval: {(settings.autoSaveInterval / 1000).toFixed(1)}s
            </label>
            <input
              type="range"
              min={500}
              max={5000}
              step={250}
              value={settings.autoSaveInterval}
              onChange={(e) => handleAutoSaveChange(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
          </div>
        </div>

        {/* Server Configuration */}
        <div
          className="p-6 mb-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow)',
          }}
        >
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
                className="w-full px-3 py-2 rounded-btn text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 rounded-btn text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
            </div>
            <button
              onClick={handleServerUpdate}
              className="px-4 py-2 rounded-btn text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: '#7C5CBF', color: '#fff' }}
            >
              Update Connection
            </button>
          </div>
        </div>

        {/* Data */}
        <div
          className="p-6 mb-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Data
          </h2>
          <div className="flex gap-3">
            <button
              onClick={handleExportNotes}
              className="px-4 py-2 rounded-btn text-sm font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: '#F5C842', color: '#1A1A1A' }}
            >
              Export All Notes (ZIP)
            </button>
            <button
              onClick={handleClearCache}
              className="px-4 py-2 rounded-btn text-sm font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              Clear Local Cache
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div
          className="p-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Keyboard Shortcuts
          </h2>
          <div className="space-y-2 text-sm">
            <ShortcutRow keys="Ctrl/Cmd + N" action="New note" />
            <ShortcutRow keys="Ctrl/Cmd + S" action="Force save / sync" />
            <ShortcutRow keys="Ctrl/Cmd + F" action="Search" />
            <ShortcutRow keys="Ctrl/Cmd + ," action="Settings" />
            <ShortcutRow keys="Ctrl/Cmd + Shift + P" action="Toggle preview" />
          </div>
        </div>
      </div>
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

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span style={{ color: 'var(--text-secondary)' }}>{action}</span>
      <kbd
        className="px-2 py-0.5 rounded text-xs font-mono"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
      >
        {keys}
      </kbd>
    </div>
  );
}
