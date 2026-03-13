import React, { useState } from 'react';
import { checkServerHealth } from '../utils/sync';

interface Props {
  onComplete: (config: { serverUrl: string; apiKey: string; offlineOnly: boolean }) => void;
  authErrorMessage?: string;
}

export default function Onboarding({ onComplete, authErrorMessage }: Props) {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [startupAuthError, setStartupAuthError] = useState(false);

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
      setStartupAuthError(false);
      setTimeout(() => onComplete({ serverUrl: url, apiKey, offlineOnly: false }), 900);
    } else if (result.errorType === 'auth') {
      setStatus('error');
      setErrorMsg('Invalid API key — please check your Docker logs');
    } else if (result.errorType === 'network') {
      setStatus('error');
      setErrorMsg('Cannot reach server — check the URL and your network');
    } else if (result.errorType === 'server') {
      setStatus('error');
      setErrorMsg('Server error — try again or check server logs');
    } else {
      setStatus('error');
      setErrorMsg('Server error — try again or check server logs');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && status !== 'checking') handleConnect();
  };

  return (
    <div
      className="h-screen flex items-center justify-center fade-in"
      style={{
        backgroundColor: 'var(--bg)',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Warm background rules — same as server landing page */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(193,127,58,0.05) 31px, rgba(193,127,58,0.05) 32px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 70% 60% at 20% 10%, rgba(193,127,58,0.06) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 80% 90%, rgba(193,127,58,0.04) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 420,
        backgroundColor: 'var(--bg-sidebar)',
        borderRadius: 20,
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}>

        {/* Dark banner — mirrors the server landing page */}
        <div style={{
          background: 'linear-gradient(135deg, #2C2420 0%, #3D302A 100%)',
          padding: '28px 32px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{
            position: 'absolute',
            bottom: -20,
            right: -20,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(193,127,58,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.9rem',
              fontWeight: 600,
              color: '#FAF7F2',
              letterSpacing: '0.06em',
            }}>
              SH<span style={{ color: '#D4975A' }}>U</span>KI
            </span>
          </div>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: '0.85rem',
            color: 'rgba(250,247,242,0.5)',
            lineHeight: 1.5,
          }}>
            Your notes, your server, your peace of mind.
          </p>
        </div>

        {/* Form body */}
        <div style={{ padding: '28px 32px 32px' }}>

          <p style={{
            fontSize: '0.6rem',
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 20,
          }}>
            Connect to your server
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Server URL */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
                fontFamily: 'var(--font-ui)',
              }}>
                Server URL
              </label>
              <OnboardInput
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="http://localhost:3000"
              />
            </div>

            {/* API Key */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
                fontFamily: 'var(--font-ui)',
              }}>
                API key
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <OnboardInput
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Paste from Docker logs…"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    flexShrink: 0,
                    padding: '9px 13px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 5,
              }}>
                Found in your Docker logs on first start.
              </p>
            </div>

            {/* Startup auth error banner */}
            {authErrorMessage && status !== 'success' && (
              <div style={{
                padding: '9px 13px',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                backgroundColor: 'rgba(248,113,113,0.09)',
                color: '#C05050',
                border: '1px solid rgba(248,113,113,0.22)',
              }}>
                {authErrorMessage}
              </div>
            )}

            {/* Status messages */}
            {status === 'error' && (
              <div style={{
                padding: '9px 13px',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                backgroundColor: 'rgba(248,113,113,0.09)',
                color: '#C05050',
                border: '1px solid rgba(248,113,113,0.22)',
              }}>
                {errorMsg}
              </div>
            )}

            {status === 'success' && (
              <div style={{
                padding: '9px 13px',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                backgroundColor: 'rgba(110,231,160,0.10)',
                color: '#3D8B62',
                border: '1px solid rgba(110,231,160,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  backgroundColor: '#6EE7A0',
                  flexShrink: 0,
                  boxShadow: '0 0 0 2px rgba(110,231,160,0.3)',
                }} />
                Connected — opening your notes…
              </div>
            )}

            {/* Connect button */}
            <ConnectButton
              status={status}
              onClick={handleConnect}
            />

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
              <span style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
              }}>
                or
              </span>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
            </div>

            {/* Offline button */}
            <OfflineButton onClick={() => onComplete({ serverUrl: '', apiKey: '', offlineOnly: true })} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Primitives
───────────────────────────────────────────────── */

function OnboardInput({
  type = 'text',
  value,
  onChange,
  onKeyDown,
  placeholder,
  style,
}: {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
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

function ConnectButton({
  status,
  onClick,
}: {
  status: 'idle' | 'checking' | 'success' | 'error';
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isDisabled = status === 'checking' || status === 'success';

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '11px 20px',
        borderRadius: 9,
        fontSize: '0.85rem',
        fontWeight: 500,
        backgroundColor: hovered && !isDisabled ? 'var(--accent-hover)' : 'var(--accent)',
        color: '#fff',
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'var(--font-ui)',
        transition: 'background 0.15s, opacity 0.15s',
        letterSpacing: '0.01em',
      }}
    >
      {status === 'checking' && (
        <span
          style={{
            width: 14, height: 14,
            border: '2px solid rgba(255,255,255,0.35)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      )}
      {status === 'checking' ? 'Connecting…' : 'Connect to server'}
    </button>
  );
}

function OfflineButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '10px 20px',
        borderRadius: 9,
        fontSize: '0.82rem',
        fontWeight: 400,
        backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
        color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        transition: 'background 0.12s, color 0.12s',
        fontStyle: 'normal',
      }}
    >
      Use offline only
    </button>
  );
}
