import React, { useState } from 'react';
import { checkServerHealth } from '../utils/sync';

interface Props {
  onComplete: (config: { serverUrl: string; apiKey: string; offlineOnly: boolean }) => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleConnect = async () => {
    const url = serverUrl.replace(/\/+$/, '');
    if (!url || !apiKey) {
      setErrorMsg('Please enter both server URL and API key');
      setStatus('error');
      return;
    }

    setStatus('checking');
    setErrorMsg('');

    const result = await checkServerHealth(url, apiKey);
    if (result.ok) {
      setStatus('success');
      setTimeout(() => onComplete({ serverUrl: url, apiKey, offlineOnly: false }), 800);
    } else {
      setStatus('error');
      setErrorMsg('Could not connect to server. Check URL and API key.');
    }
  };

  return (
    <div
      className="h-screen flex items-center justify-center p-8 fade-in"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-md p-8"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: '#F5C842' }}>
            <span className="text-2xl">&#9998;</span>
          </div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Welcome to SHUKI
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Connect to your self-hosted server or use offline mode
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Server URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://notes.myserver.com"
              className="w-full px-4 py-3 rounded-btn text-sm outline-none transition-all"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#F5C842')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key from Docker logs"
              className="w-full px-4 py-3 rounded-btn text-sm outline-none transition-all"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#F5C842')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {status === 'error' && (
            <div className="text-sm px-3 py-2 rounded-btn" style={{ backgroundColor: '#fee', color: '#c33' }}>
              {errorMsg}
            </div>
          )}

          {status === 'success' && (
            <div className="text-sm px-3 py-2 rounded-btn" style={{ backgroundColor: '#efe', color: '#363' }}>
              Connected successfully!
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={status === 'checking'}
            className="w-full py-3 rounded-btn text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#F5C842', color: '#1A1A1A' }}
          >
            {status === 'checking' ? 'Connecting...' : 'Connect'}
          </button>

          <div className="relative flex items-center my-4">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
            <span className="px-3 text-xs" style={{ color: 'var(--text-secondary)' }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          </div>

          <button
            onClick={() => onComplete({ serverUrl: '', apiKey: '', offlineOnly: true })}
            className="w-full py-3 rounded-btn text-sm font-medium transition-all hover:opacity-80"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            Use Offline Only
          </button>
        </div>
      </div>
    </div>
  );
}
