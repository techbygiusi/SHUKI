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
  const {
    settings, setSettings, serverStatus, setServerStatus,
    notes, settingsTab, setSettingsTab, shortcuts, setShortcuts,
  } = useStore();

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
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) parts.push(key);
      if (parts.length < 2) return;
      const combo = parts.join('+');
      const conflict = shortcuts.find((s) => s.id !== recordingId && s.keys === combo);
      if (conflict) { toast.error(`Conflicts with "${conflict.label}"`); return; }
      const updated = shortcuts.map((s) => s.id === recordingId ? { ...s, keys: combo } : s);
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
    if (!apiKey.trim()) {
      setServerUpdateStatus('error');
      setServerUpdateMsg('Please enter your API key');
      return;
    }
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
      setServerUpdateMsg('Invalid API key — please check your Docker logs');
    } else if (result.errorType === 'network') {
      setServerUpdateStatus('error');
      setServerUpdateMsg('Cannot reach server — check the URL and your network');
    } else if (result.errorType === 'server') {
      setServerUpdateStatus('error');
      setServerUpdateMsg('Server error — try again or check server logs');
    } else {
      setServerUpdateStatus('error');
      setServerUpdateMsg('Server error — try again or check server logs');
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
    { id: 'server'    as const, label: 'Server'    },
    { id: 'general'   as const, label: 'General'   },
    { id: 'about'     as const, label: 'About'     },
  ];

  return (
    <div
      className="h-screen overflow-y-auto fade-in"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 32px 80px' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}>
              Settings
            </h1>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginTop: 2,
            }}>
              Preferences &amp; configuration
            </p>
          </div>
          <WarmButton variant="ghost" onClick={onClose}>← Back</WarmButton>
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          display: 'flex',
          gap: 2,
          marginBottom: 24,
          padding: 4,
          borderRadius: 11,
          backgroundColor: 'var(--bg-sidebar)',
          border: '1px solid var(--border)',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: settingsTab === tab.id ? 500 : 400,
                backgroundColor: settingsTab === tab.id ? 'var(--bg-active)' : 'transparent',
                color: settingsTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                border: settingsTab === tab.id ? '1px solid var(--border)' : '1px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            TAB: SHORTCUTS
        ══════════════════════════════════════ */}
        {settingsTab === 'shortcuts' && (
          <Card>
            <SectionHeading>Keyboard shortcuts</SectionHeading>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14, fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
              Click a shortcut to reassign it.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {shortcuts.map((shortcut) => {
                const isRecording = recordingId === shortcut.id;
                return (
                  <div
                    key={shortcut.id}
                    onClick={() => setRecordingId(isRecording ? null : shortcut.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      backgroundColor: isRecording ? 'rgba(193,127,58,0.08)' : 'transparent',
                      border: isRecording ? '1px solid var(--accent)' : '1px solid transparent',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { if (!isRecording) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { if (!isRecording) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {shortcut.label}
                    </span>
                    <kbd style={{
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: isRecording ? 'var(--accent)' : 'var(--bg-hover)',
                      color: isRecording ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      letterSpacing: '0.02em',
                      transition: 'all 0.12s',
                    }}>
                      {isRecording ? 'Press keys…' : shortcut.keys}
                    </kbd>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <WarmButton variant="ghost" onClick={resetShortcuts}>Reset to defaults</WarmButton>
            </div>
          </Card>
        )}

        {/* ══════════════════════════════════════
            TAB: SERVER
        ══════════════════════════════════════ */}
        {settingsTab === 'server' && (
          <>
            {/* Status overview */}
            <Card>
              <SectionHeading>Server status</SectionHeading>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: serverStatus.connected ? 0 : 14 }}>
                <InfoCell label="Status">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: serverStatus.connected ? '#6EE7A0' : '#F87171',
                      boxShadow: `0 0 0 2px ${serverStatus.connected ? 'rgba(110,231,160,0.25)' : 'rgba(248,113,113,0.25)'}`,
                    }} />
                    {serverStatus.connected ? 'Connected' : 'Offline'}
                  </span>
                </InfoCell>
                <InfoCell label="Connected clients">
                  {String(serverStatus.clients ?? '—')}
                </InfoCell>
                <InfoCell label="Free storage">
                  {formatBytes(serverStatus.storage?.free ?? 0)}
                </InfoCell>
                <InfoCell label="Last sync">
                  {formatTimeAgo(serverStatus.lastSync)}
                </InfoCell>
                <InfoCell label="Server URL">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {settings.serverUrl || '—'}
                    </span>
                    {settings.serverUrl && (
                      <InlineAction onClick={() => { navigator.clipboard.writeText(settings.serverUrl); toast.success('URL copied'); }}>
                        Copy
                      </InlineAction>
                    )}
                  </span>
                </InfoCell>
                <InfoCell label="Storage path">
                  {serverStatus.storage?.path || '—'}
                </InfoCell>
              </div>
              {!serverStatus.connected && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  backgroundColor: 'rgba(248,113,113,0.08)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(248,113,113,0.18)',
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                }}>
                  Working offline — changes will sync when the server is available.
                </div>
              )}
            </Card>

            {/* Configuration */}
            <Card>
              <SectionHeading>Configuration</SectionHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <FieldGroup label="Server URL">
                  <WarmInput
                    type="url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://localhost:3000"
                  />
                </FieldGroup>

                <FieldGroup label="API key">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <WarmInput
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <WarmButton variant="ghost" onClick={() => setShowApiKey(!showApiKey)}>
                      {showApiKey ? 'Hide' : 'Show'}
                    </WarmButton>
                    <WarmButton variant="ghost" onClick={() => { navigator.clipboard.writeText(apiKey); toast.success('API key copied'); }}>
                      Copy
                    </WarmButton>
                  </div>
                </FieldGroup>

                {serverUpdateMsg && (
                  <StatusBanner type={serverUpdateStatus === 'error' ? 'error' : 'success'}>
                    {serverUpdateMsg}
                  </StatusBanner>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <WarmButton
                    variant="primary"
                    onClick={handleServerUpdate}
                    disabled={serverUpdateStatus === 'checking'}
                  >
                    {serverUpdateStatus === 'checking' ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Checking…
                      </>
                    ) : 'Update connection'}
                  </WarmButton>
                  <WarmButton
                    variant="ghost"
                    onClick={() => {
                      checkServerHealth(settings.serverUrl, settings.apiKey).then((result) => {
                        setServerStatus({ connected: result.ok, ...(result.data ? { clients: result.data.clients, storage: result.data.storage } : {}) });
                        toast.success(result.ok ? 'Server reachable' : 'Server unreachable');
                      });
                    }}
                  >
                    Reconnect
                  </WarmButton>
                  <WarmButton
                    variant="danger"
                    onClick={() => {
                      setSettings({ serverUrl: '', apiKey: '', offlineOnly: true });
                      saveSettings({ serverUrl: '', apiKey: '', offlineOnly: true });
                      setServerUrl('');
                      setApiKey('');
                      setServerStatus({ connected: false });
                      toast.success('Disconnected from server');
                    }}
                  >
                    Disconnect
                  </WarmButton>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ══════════════════════════════════════
            TAB: GENERAL
        ══════════════════════════════════════ */}
        {settingsTab === 'general' && (
          <>
            <Card>
              <SectionHeading>Appearance</SectionHeading>

              <FieldGroup label="Theme" style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['light', 'dark', 'system'] as ThemeMode[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 8,
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        textTransform: 'capitalize',
                        backgroundColor: settings.theme === t ? 'var(--accent)' : 'transparent',
                        color: settings.theme === t ? '#fff' : 'var(--text-secondary)',
                        border: settings.theme === t ? '1px solid transparent' : '1px solid var(--border)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup label={`Editor font size — ${settings.fontSize}px`} style={{ marginBottom: 18 }}>
                <input
                  type="range" min={12} max={24} value={settings.fontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </FieldGroup>

              <FieldGroup label={`Auto-save interval — ${(settings.autoSaveInterval / 1000).toFixed(1)}s`}>
                <input
                  type="range" min={500} max={5000} step={250} value={settings.autoSaveInterval}
                  onChange={(e) => handleAutoSaveChange(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </FieldGroup>
            </Card>

            <Card>
              <SectionHeading>Data</SectionHeading>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14, fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                Export your notes or clear the local cache.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <WarmButton variant="primary" onClick={handleExportNotes}>
                  Export all notes (ZIP)
                </WarmButton>
                <WarmButton variant="ghost" onClick={handleClearCache}>
                  Clear local cache
                </WarmButton>
              </div>
            </Card>

            <Card>
              <SectionHeading>Reset</SectionHeading>
              <p style={{ fontSize: '0.82rem', marginBottom: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Reset all settings, shortcuts, and UI preferences to their defaults. This will reload the app.
              </p>
              <WarmButton
                variant="danger"
                onClick={async () => { await resetAllSettings(); window.location.reload(); }}
              >
                Reset all settings to defaults
              </WarmButton>
            </Card>
          </>
        )}

        {/* ══════════════════════════════════════
            TAB: ABOUT
        ══════════════════════════════════════ */}
        {settingsTab === 'about' && (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 0 32px' }}>
              {/* Logo mark */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 18,
                background: 'linear-gradient(135deg, #2C2420 0%, #3D302A 100%)',
                marginBottom: 20,
                boxShadow: '0 4px 20px rgba(44,36,32,0.20)',
              }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  fontWeight: 600,
                  color: '#D4975A',
                  letterSpacing: '0.04em',
                }}>S</span>
              </div>

              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.6rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}>
                SH<span style={{ color: 'var(--accent)' }}>U</span>KI
              </h2>

              <p style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                marginBottom: 20,
              }}>
                Your notes, your server, your peace of mind.
              </p>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 14px',
                borderRadius: 999,
                backgroundColor: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginBottom: 24,
              }}>
                <span>v1.0.0</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span>Self-hosted notes with real-time sync</span>
              </div>

              <div style={{ marginBottom: 0 }}>
                <a
                  href="https://github.com/techbygiusi/shuki"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* GitHub icon */}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  GitHub repository
                </a>
              </div>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Design primitives
───────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-sidebar)',
      borderRadius: 12,
      border: '1px solid var(--border)',
      padding: '22px 24px',
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '0.6rem',
      fontWeight: 500,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 16,
      fontFamily: 'var(--font-ui)',
    }}>
      {children}
    </h2>
  );
}

function FieldGroup({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={{
        display: 'block',
        fontSize: '0.78rem',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        marginBottom: 7,
        fontFamily: 'var(--font-ui)',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function WarmInput({
  type = 'text',
  value,
  onChange,
  placeholder,
  style,
}: {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '9px 13px',
        borderRadius: 8,
        fontSize: '0.85rem',
        outline: 'none',
        backgroundColor: 'var(--bg)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        fontFamily: 'var(--font-ui)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        ...style,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = 'var(--accent)';
        e.target.style.boxShadow = '0 0 0 3px rgba(193,127,58,0.10)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = 'var(--border)';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'danger';

function WarmButton({
  variant = 'ghost',
  onClick,
  disabled,
  children,
}: {
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 18px',
    borderRadius: 8,
    fontSize: '0.82rem',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-ui)',
    border: 'none',
    transition: 'opacity 0.15s, background 0.12s',
    opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap' as const,
  };

  const styles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      backgroundColor: hovered ? 'var(--accent-hover)' : 'var(--accent)',
      color: '#fff',
    },
    ghost: {
      backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid var(--border)',
    },
    danger: {
      backgroundColor: hovered ? '#c0392b' : '#E05252',
      color: '#fff',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...base, ...styles[variant] }}
    >
      {children}
    </button>
  );
}

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 14px',
      backgroundColor: 'var(--bg)',
      borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: '0.6rem',
        fontWeight: 500,
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.88rem',
        fontWeight: 500,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
      }}>
        {children}
      </div>
    </div>
  );
}

function InlineAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'none',
        border: 'none',
        fontSize: '0.72rem',
        color: hovered ? 'var(--accent-hover)' : 'var(--accent)',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'var(--font-ui)',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function StatusBanner({ type, children }: { type: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: '0.82rem',
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      backgroundColor: type === 'error'
        ? 'rgba(248,113,113,0.10)'
        : 'rgba(110,231,160,0.10)',
      color: type === 'error' ? '#E05252' : '#3D8B62',
      border: `1px solid ${type === 'error' ? 'rgba(248,113,113,0.25)' : 'rgba(110,231,160,0.25)'}`,
    }}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Utilities
───────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
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
