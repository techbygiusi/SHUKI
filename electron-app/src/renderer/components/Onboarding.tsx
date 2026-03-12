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
    const url = (serverUrl || 'http://localhost:3000').replace(/\/+$/, '');
    if (!apiKey) {
      setErrorMsg('Please enter your API key');
      setStatus('error');
      return;
    }

    setStatus('checking');
    setErrorMsg('');

    const timeout = setTimeout(() => {
      setStatus('error');
      setErrorMsg('Connection timed out (10s). Check your server URL.');
    }, 10000);

    const result = await checkServerHealth(url, apiKey);
    clearTimeout(timeout);

    if (result.ok) {
      setStatus('success');
      setTimeout(() => onComplete({ serverUrl: url, apiKey, offlineOnly: false }), 800);
    } else if (result.errorType === 'auth') {
      setStatus('error');
      setErrorMsg('Invalid API Key — please check your key in the Docker logs');
    } else if (result.errorType === 'network') {
      setStatus('error');
      setErrorMsg('Server not reachable — check the URL');
    } else {
      setStatus('error');
      setErrorMsg('Could not connect to server. Check the URL and make sure the server is running.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: '0.875rem',
    outline: 'none',
    backgroundColor: 'var(--bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    fontFamily: 'var(--font-ui)',
  };

  return (
    <div
      className="h-screen flex items-center justify-center fade-in"
      style={{
        backgroundColor: 'var(--bg)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: 'var(--bg)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-md)',
          padding: 48,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--accent)',
            marginBottom: 8,
          }}>
            SHUKI
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}>
            Connect to your server
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Server URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:3000"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = '')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key from Docker logs"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = '')}
            />
          </div>

          {status === 'error' && (
            <div style={{
              fontSize: '0.875rem',
              color: '#EF4444',
              marginTop: 8,
            }}>
              {errorMsg}
            </div>
          )}

          {status === 'success' && (
            <div style={{
              fontSize: '0.875rem',
              color: '#10B981',
              marginTop: 8,
            }}>
              Connected successfully!
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={status === 'checking'}
            style={{
              width: '100%',
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              opacity: status === 'checking' ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: 'var(--font-ui)',
            }}
          >
            {status === 'checking' && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {status === 'checking' ? 'Connecting...' : 'Connect'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>or</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
          </div>

          <button
            onClick={() => onComplete({ serverUrl: '', apiKey: '', offlineOnly: true })}
            style={{
              width: '100%',
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Use Offline Only
          </button>
        </div>
      </div>
    </div>
  );
}
