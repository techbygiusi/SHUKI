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
      setServerUpdateMsg('Connection updated successfully');
      toast.success('Server connection updated');
    } else if (result.errorType === 'auth') {
      setServerUpdateStatus('error');
      setServerUpdateMsg('Invalid API Key');
    } else if (result.errorType === 'network') {
      setServerUpdateStatus('error');
      setServerUpdateMsg('Server not reachable — check the URL');
    } else {
      setServerUpdateStatus('error');
      setServerUpdateMsg('Could not connect to server');
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
    <div className="h-screen overflow-y-auto fade-in" style={{ backgroundColor: 'var(--bg)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            Settings
          </h1>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Back
          </button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 4,
          marginBottom: 24,
          padding: 4,
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--bg-sidebar)',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: settingsTab === tab.id ? 500 : 400,
                backgroundColor: settingsTab === tab.id ? 'var(--bg-active)' : 'transparent',
                color: settingsTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {settingsTab === 'shortcuts' && (
          <Card>
            <SectionHeading>Keyboard Shortcuts</SectionHeading>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: recordingId === shortcut.id ? 'var(--bg-active)' : 'transparent',
                    border: recordingId === shortcut.id ? '1px solid var(--accent)' : '1px solid transparent',
                  }}
                  onClick={() => setRecordingId(recordingId === shortcut.id ? null : shortcut.id)}
                >
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{shortcut.label}</span>
                  <kbd
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: recordingId === shortcut.id ? 'var(--accent)' : 'var(--bg-hover)',
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
              style={{
                marginTop: 16,
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: 500,
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Reset to Defaults
            </button>
          </Card>
        )}

        {settingsTab === 'server' && (
          <>
            {/* Server Status Card */}
            <Card>
              <SectionHeading>Server Status</SectionHeading>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InfoRow label="Status" value={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: serverStatus.connected ? '#22c55e' : '#ef4444',
                    }} />
                    {serverStatus.connected ? 'Connected' : 'Offline'}
                  </span>
                } />
                <InfoRow label="Server URL" value={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{settings.serverUrl || '—'}</span>
                    {settings.serverUrl && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(settings.serverUrl); toast.success('URL copied'); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '0.75rem',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
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
                <div style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 8,
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--bg-hover)',
                  color: 'var(--text-secondary)',
                }}>
                  Working offline — changes will sync when server is available
                </div>
              )}
            </Card>

            {/* Server Configuration */}
            <Card>
              <SectionHeading>Server Configuration</SectionHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>Server URL</label>
                  <input
                    type="url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://localhost:3000"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: '0.875rem',
                      outline: 'none',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      fontFamily: 'var(--font-ui)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.target.style.borderColor = '')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>API Key</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 8,
                        fontSize: '0.875rem',
                        outline: 'none',
                        backgroundColor: 'var(--bg)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        fontFamily: 'var(--font-ui)',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={(e) => (e.target.style.borderColor = '')}
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        fontSize: '0.75rem',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {showApiKey ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(apiKey); toast.success('API key copied'); }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        fontSize: '0.75rem',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                {serverUpdateMsg && (
                  <div
                    style={{
                      fontSize: '0.875rem',
                      padding: '10px 14px',
                      borderRadius: 8,
                      backgroundColor: serverUpdateStatus === 'error' ? '#FEF2F2' : '#F0FDF4',
                      color: serverUpdateStatus === 'error' ? '#EF4444' : '#10B981',
                    }}
                  >
                    {serverUpdateMsg}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleServerUpdate}
                    disabled={serverUpdateStatus === 'checking'}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      backgroundColor: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: serverUpdateStatus === 'checking' ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'var(--font-ui)',
                    }}
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
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-ui)',
                    }}
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
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      backgroundColor: '#EF4444',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-ui)',
                    }}
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
              <SectionHeading>Appearance</SectionHeading>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>Theme</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['light', 'dark', 'system'] as ThemeMode[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        textTransform: 'capitalize',
                        backgroundColor: settings.theme === t ? 'var(--accent)' : 'transparent',
                        color: settings.theme === t ? '#fff' : 'var(--text-primary)',
                        border: settings.theme === t ? 'none' : '1px solid var(--border)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Editor Font Size: {settings.fontSize}px
                </label>
                <input type="range" min={12} max={24} value={settings.fontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Auto-save Interval: {(settings.autoSaveInterval / 1000).toFixed(1)}s
                </label>
                <input type="range" min={500} max={5000} step={250} value={settings.autoSaveInterval}
                  onChange={(e) => handleAutoSaveChange(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
            </Card>

            <Card>
              <SectionHeading>Data</SectionHeading>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleExportNotes}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}>
                  Export All Notes (ZIP)
                </button>
                <button onClick={handleClearCache}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}>
                  Clear Local Cache
                </button>
              </div>
            </Card>

            <Card>
              <SectionHeading>Reset</SectionHeading>
              <p style={{ fontSize: '0.875rem', marginBottom: 12, color: 'var(--text-secondary)' }}>
                Reset all settings, shortcuts, and UI preferences to their defaults. This will reload the app.
              </p>
              <button
                onClick={async () => {
                  await resetAllSettings();
                  window.location.reload();
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  backgroundColor: '#EF4444',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Reset All Settings to Defaults
              </button>
            </Card>
          </>
        )}

        {settingsTab === 'about' && (
          <Card>
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: 14,
                backgroundColor: 'var(--accent)',
                marginBottom: 16,
              }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>S</span>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>SHUKI</h2>
              <p style={{ fontSize: '0.875rem', marginBottom: 16, color: 'var(--text-secondary)' }}>
                v1.0.0
              </p>
              <p style={{ fontSize: '0.875rem', marginBottom: 16, color: 'var(--text-secondary)' }}>
                Self-hosted note-taking with real-time sync
              </p>
              <a
                href="https://github.com/techbygiusi/shuki"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
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
    <div style={{
      backgroundColor: 'var(--bg-sidebar)',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
      padding: 24,
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 16,
      fontFamily: 'var(--font-ui)',
    }}>
      {children}
    </h2>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        display: 'block',
        marginBottom: 4,
      }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
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
