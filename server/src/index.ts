import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initDatabase } from './database';
import { createNotesRouter } from './routes/notes';
import { createFoldersRouter } from './routes/folders';
import { createImagesRouter } from './routes/images';
import { createHealthRouter } from './routes/health';
import { authMiddleware } from './middleware/auth';
import { setupWebSocket } from './websocket';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_PATH = process.env.DATA_PATH || './data';

const IMAGES_PATH = path.join(DATA_PATH, 'images');
const API_KEY_PATH = path.join(DATA_PATH, 'apikey.txt');

// Ensure directories exist
fs.mkdirSync(IMAGES_PATH, { recursive: true });
fs.mkdirSync(path.join(DATA_PATH, 'notes'), { recursive: true });

// API Key management
function getOrCreateApiKey(): string {
  if (fs.existsSync(API_KEY_PATH)) {
    return fs.readFileSync(API_KEY_PATH, 'utf-8').trim();
  }
  const key = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(API_KEY_PATH, key, 'utf-8');
  return key;
}

const API_KEY = getOrCreateApiKey();

console.log('');
console.log('================================================');
console.log('  SHUKI Server Ready!');
console.log(`  Your API Key: ${API_KEY}`);
console.log('  Add this key to your SHUKI app to connect.');
console.log('================================================');
console.log('');

// Initialize database
const db = initDatabase(DATA_PATH);

// Express setup
const app = express();
const httpServer = createServer(app);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const wsState = setupWebSocket(io, API_KEY, db);

// Browser landing page
app.get('/', (_req, res) => {
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline' 'self'; font-src https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self'");
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SHUKI — Server</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --cream: #FAF7F2;
    --parchment: #F2EDE4;
    --warm-border: #E8DDD0;
    --ink: #2C2420;
    --ink-soft: #6B5B52;
    --ink-faint: #A89990;
    --amber: #C17F3A;
    --amber-light: #D4975A;
    --amber-pale: #F5E9D8;
    --amber-glow: rgba(193,127,58,0.12);
    --green-badge: #2D6A4F;
    --green-bg: #D8F3DC;
    --shadow-soft: 0 2px 16px rgba(44,36,32,0.08), 0 1px 4px rgba(44,36,32,0.04);
    --shadow-card: 0 8px 48px rgba(44,36,32,0.10), 0 2px 8px rgba(44,36,32,0.06);
  }
 
  * { margin: 0; padding: 0; box-sizing: border-box; }
 
  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--cream);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 20px;
    color: var(--ink);
    position: relative;
    overflow-x: hidden;
  }
 
  /* Subtle background texture / warmth */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 20% 10%, rgba(193,127,58,0.07) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 90%, rgba(193,127,58,0.05) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }
 
  /* Decorative ruled lines in background */
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    background-image: repeating-linear-gradient(
      transparent,
      transparent 31px,
      rgba(193,127,58,0.06) 31px,
      rgba(193,127,58,0.06) 32px
    );
    pointer-events: none;
    z-index: 0;
  }
 
  .page-wrap {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 460px;
  }
 
  /* ── CARD ── */
  .card {
    background: #FFFCF8;
    border: 1px solid var(--warm-border);
    border-radius: 24px;
    box-shadow: var(--shadow-card);
    overflow: hidden;
    animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
 
  @keyframes rise {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
 
  /* ── TOP BANNER ── */
  .banner {
    background: linear-gradient(135deg, #2C2420 0%, #3D302A 100%);
    padding: 32px 36px 28px;
    position: relative;
    overflow: hidden;
  }
 
  .banner-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
 
  .wordmark {
    font-family: 'Lora', Georgia, serif;
    font-size: 2.2rem;
    font-weight: 600;
    color: #FAF7F2;
    letter-spacing: 0.04em;
    line-height: 1;
  }
 
  .wordmark span {
    color: var(--amber-light);
  }
 
  .version-pill {
    font-size: 0.7rem;
    font-weight: 500;
    color: rgba(250,247,242,0.5);
    background: rgba(250,247,242,0.08);
    border: 1px solid rgba(250,247,242,0.12);
    padding: 3px 10px;
    border-radius: 999px;
    letter-spacing: 0.04em;
  }
 
  .tagline {
    font-family: 'Lora', serif;
    font-style: italic;
    font-size: 0.9rem;
    color: rgba(250,247,242,0.55);
    line-height: 1.5;
  }
 
  .status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 18px;
  }
 
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    color: #6EE7A0;
    background: rgba(110,231,160,0.12);
    border: 1px solid rgba(110,231,160,0.2);
    padding: 4px 12px;
    border-radius: 999px;
  }
 
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #6EE7A0;
    box-shadow: 0 0 0 2px rgba(110,231,160,0.3);
    animation: pulse 2.4s ease-in-out infinite;
  }
 
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 2px rgba(110,231,160,0.3); }
    50%       { box-shadow: 0 0 0 5px rgba(110,231,160,0.08); }
  }
 
  /* ── BODY ── */
  .body {
    padding: 32px 36px;
  }
 
  .section-label {
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 18px;
  }
 
  /* ── STEPS ── */
  .steps {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin-bottom: 32px;
  }
 
  .step {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    animation: fade-in 0.4s both;
  }
 
  .step:nth-child(1) { animation-delay: 0.1s; }
  .step:nth-child(2) { animation-delay: 0.18s; }
  .step:nth-child(3) { animation-delay: 0.26s; }
  .step:nth-child(4) { animation-delay: 0.34s; }
 
  @keyframes fade-in {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
 
  .step-num {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    background: var(--amber-pale);
    border: 1.5px solid rgba(193,127,58,0.3);
    color: var(--amber);
    font-size: 0.78rem;
    font-weight: 600;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }
 
  .step-content {
    flex: 1;
    padding-top: 3px;
  }
 
  .step-text {
    font-size: 0.88rem;
    color: var(--ink-soft);
    line-height: 1.55;
    margin-bottom: 8px;
  }
 
  .step-text strong {
    color: var(--ink);
    font-weight: 500;
  }
 
  /* ── URL BOX ── */
  .url-box {
    background: var(--parchment);
    border: 1.5px solid var(--warm-border);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
 
  .url-box:focus-within {
    border-color: var(--amber);
    box-shadow: 0 0 0 3px var(--amber-glow);
  }
 
  .url-box input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 0.78rem;
    color: var(--ink);
    min-width: 0;
  }
 
  .copy-btn {
    flex-shrink: 0;
    background: var(--amber);
    border: none;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 0.76rem;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    color: #fff;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
    letter-spacing: 0.01em;
  }
 
  .copy-btn:hover { background: var(--amber-light); }
  .copy-btn:active { transform: scale(0.96); }
 
  /* ── DIVIDER ── */
  .divider {
    border: none;
    border-top: 1px solid var(--warm-border);
    margin: 28px 0;
    position: relative;
  }
 
  /* ── INFO GRID ── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border: 1px solid var(--warm-border);
    border-radius: 14px;
    overflow: hidden;
  }
 
  .info-item {
    padding: 16px 18px;
    border-bottom: 1px solid var(--warm-border);
    border-right: 1px solid var(--warm-border);
    background: var(--parchment);
    transition: background 0.2s;
  }
 
  .info-item:nth-child(even) { border-right: none; }
  .info-item:nth-last-child(-n+2) { border-bottom: none; }
  .info-item:hover { background: var(--amber-pale); }
 
  .info-label {
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 6px;
  }
 
  .info-value {
    font-size: 1rem;
    font-weight: 500;
    color: var(--ink);
    font-family: 'Lora', serif;
  }
 
  /* ── FOOTER ── */
  .footer {
    padding: 18px 36px 24px;
    border-top: 1px solid var(--warm-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--parchment);
  }
 
  .footer-text {
    font-size: 0.75rem;
    color: var(--ink-faint);
    font-style: italic;
    font-family: 'Lora', serif;
  }
 
  .footer-note {
    font-size: 0.7rem;
    color: var(--ink-faint);
  }
 
  .api-hint {
    font-size: 0.75rem;
    color: var(--ink-faint);
    font-style: italic;
    margin-top: 4px;
  }
 
  /* ── TOAST ── */
  .toast {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%) translateY(16px);
    background: var(--ink);
    color: var(--cream);
    font-size: 0.82rem;
    padding: 10px 20px;
    border-radius: 999px;
    opacity: 0;
    transition: opacity 0.2s, transform 0.2s;
    pointer-events: none;
    white-space: nowrap;
    z-index: 999;
  }
 
  .toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
</style>
</head>
<body>
<div class="page-wrap">
  <div class="card">
 
    <!-- Banner -->
    <div class="banner">
      <div class="banner-top">
        <div class="wordmark">SH<span>U</span>KI</div>
        <span class="version-pill">v1.0.0</span>
      </div>
      <div class="tagline">Your notes, your server, your peace of mind.</div>
      <div class="status-row">
        <div class="status-badge">
          <span class="status-dot"></span>
          Server is running
        </div>
      </div>
    </div>
 
    <!-- Steps -->
    <div class="body">
      <div class="section-label">Getting connected</div>
      <ol class="steps">
        <li class="step">
          <div class="step-num">1</div>
          <div class="step-content">
            <div class="step-text">Open the <strong>SHUKI desktop app</strong></div>
          </div>
        </li>
        <li class="step">
          <div class="step-num">2</div>
          <div class="step-content">
            <div class="step-text">Enter your <strong>server URL</strong></div>
            <div class="url-box">
              <input type="text" id="url" readonly />
              <button class="copy-btn" id="copy-btn">Copy</button>
            </div>
          </div>
        </li>
        <li class="step">
          <div class="step-num">3</div>
          <div class="step-content">
            <div class="step-text">Enter your <strong>API key</strong></div>
            <div class="api-hint">Find it printed in your Docker logs on first start.</div>
          </div>
        </li>
        <li class="step">
          <div class="step-num">4</div>
          <div class="step-content">
            <div class="step-text">Hit <strong>Connect</strong> and start writing ✍️</div>
          </div>
        </li>
      </ol>
 
      <hr class="divider" />
 
      <div class="section-label">Server at a glance</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Status</div>
          <div class="info-value" id="uptime">—</div>
        </div>
        <div class="info-item">
          <div class="info-label">Free storage</div>
          <div class="info-value" id="storage">—</div>
        </div>
        <div class="info-item">
          <div class="info-label">Clients</div>
          <div class="info-value" id="clients">—</div>
        </div>
        <div class="info-item">
          <div class="info-label">Version</div>
          <div class="info-value" id="version">—</div>
        </div>
      </div>
    </div>
 
    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">SHUKI — Self-hosted notes</div>
      <div class="footer-note">Keep your thoughts close 🍂</div>
    </div>
 
  </div>
</div>
 
<div class="toast" id="toast">Copied to clipboard</div>
 
<script>
  document.getElementById('url').value = window.location.origin;
 
  document.getElementById('copy-btn').addEventListener('click', function() {
    navigator.clipboard.writeText(window.location.origin);
    var toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 2000);
  });
 
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + '\u202f' + sizes[i];
  }
 
  fetch('/api/health')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      document.getElementById('version').textContent = data.version || '1.0.0';
      document.getElementById('clients').textContent = data.clients != null ? data.clients : '0';
      document.getElementById('storage').textContent = (data.storage && data.storage.free) ? formatBytes(data.storage.free) : '—';
      document.getElementById('uptime').textContent = 'Online';
    })
    .catch(function() {
      document.getElementById('uptime').textContent = 'Healthy';
    });
</script>
</body>
</html>`);
});

// Health endpoint (no auth required for basic check)
app.use('/api', createHealthRouter(db, wsState, DATA_PATH));

// Auth middleware for all other /api routes
app.use('/api', authMiddleware(API_KEY));

// API key validation endpoint (behind auth middleware)
app.get('/api/validate', (_req, res) => {
  res.json({ valid: true });
});

// Routes
app.use('/api', createNotesRouter(db, io));
app.use('/api', createFoldersRouter(db, io));
app.use('/api', createImagesRouter(IMAGES_PATH));

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
