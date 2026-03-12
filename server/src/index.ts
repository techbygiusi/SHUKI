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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #F5F5F5;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: #111827;
  }
  .card {
    background: #FFFFFF;
    max-width: 480px;
    width: 100%;
    border-radius: 20px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    padding: 48px;
  }
  .header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 6px;
  }
  .wordmark {
    font-family: 'Inter', sans-serif;
    font-size: 2rem;
    font-weight: 700;
    color: #C17F3A;
  }
  .version-pill {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6B7280;
    background: #F3F4F6;
    padding: 2px 10px;
    border-radius: 999px;
  }
  .status-pill {
    display: block;
    width: fit-content;
    margin: 12px auto 0;
    text-align: center;
    font-size: 0.875rem;
    font-weight: 500;
    color: #065F46;
    background: #D1FAE5;
    padding: 6px 16px;
    border-radius: 999px;
    margin-bottom: 28px;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    display: inline-block;
    margin-right: 6px;
  }
  .divider {
    border: none;
    border-top: 1px solid #F3F4F6;
    margin: 24px 0;
  }
  .section-heading {
    font-family: 'Inter', sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9CA3AF;
    margin-bottom: 16px;
  }
  .steps {
    list-style: none;
    counter-reset: step;
  }
  .steps li {
    counter-increment: step;
    margin-bottom: 14px;
    padding-left: 40px;
    position: relative;
    line-height: 1.6;
    font-size: 0.9rem;
    color: #111827;
  }
  .steps li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 1px;
    width: 28px;
    height: 28px;
    background: #C17F3A;
    color: #fff;
    font-weight: 700;
    font-size: 0.85rem;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .url-block {
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    padding: 12px 16px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.8rem;
    margin: 8px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    word-break: break-all;
  }
  .url-block input {
    flex: 1;
    background: none;
    border: none;
    font-family: inherit;
    font-size: inherit;
    color: #111827;
    outline: none;
  }
  .url-block button {
    flex-shrink: 0;
    background: #C17F3A;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    color: #fff;
    font-family: 'Inter', sans-serif;
    transition: opacity 0.15s;
  }
  .url-block button:hover { opacity: 0.85; }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 12px;
  }
  .info-item {
    padding: 8px 0;
  }
  .info-item .label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9CA3AF;
    margin-bottom: 4px;
  }
  .info-item .value {
    font-size: 0.9rem;
    font-weight: 700;
    color: #111827;
  }
  footer {
    text-align: center;
    margin-top: 32px;
    color: #9CA3AF;
    font-size: 0.8rem;
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <span class="wordmark">SHUKI</span>
    <span class="version-pill">v1.0.0</span>
  </div>
  <div class="status-pill"><span class="status-dot"></span>Server online</div>

  <hr class="divider" />

  <div class="section-heading">Connect the app</div>
  <ol class="steps">
    <li>Open the SHUKI desktop app</li>
    <li>Enter this server URL:
      <div class="url-block">
        <input type="text" id="url" readonly />
        <button id="copy-btn">Copy</button>
      </div>
    </li>
    <li>Enter your API Key <span style="color:#9CA3AF;font-size:0.8rem">(found in Docker logs)</span></li>
    <li>Click <strong>Connect</strong></li>
  </ol>

  <hr class="divider" />

  <div class="section-heading">Server info</div>
  <div class="info-grid">
    <div class="info-item">
      <div class="label">Uptime</div>
      <div class="value" id="uptime">—</div>
    </div>
    <div class="info-item">
      <div class="label">Free Storage</div>
      <div class="value" id="storage">—</div>
    </div>
    <div class="info-item">
      <div class="label">Connected Clients</div>
      <div class="value" id="clients">—</div>
    </div>
    <div class="info-item">
      <div class="label">Version</div>
      <div class="value" id="version">—</div>
    </div>
  </div>

  <footer>SHUKI — Self-hosted notes server</footer>
</div>
<script>
  document.getElementById('url').value = window.location.origin;
  document.getElementById('copy-btn').addEventListener('click', function() {
    navigator.clipboard.writeText(window.location.origin);
    this.textContent = 'Copied!';
    var btn = this;
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  });

  function formatUptime(seconds) {
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  fetch('/api/health')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      document.getElementById('version').textContent = data.version || '1.0.0';
      document.getElementById('clients').textContent = data.clients || '0';
      if (data.storage && data.storage.free) {
        document.getElementById('storage').textContent = formatBytes(data.storage.free);
      }
      document.getElementById('uptime').textContent = 'Online';
    })
    .catch(function() {
      document.getElementById('uptime').textContent = 'Error';
    });
</script>
</body>
</html>`);
});

// Health endpoint (no auth required for basic check)
app.use('/api', createHealthRouter(db, wsState, DATA_PATH));

// Auth middleware for all other /api routes
app.use('/api', authMiddleware(API_KEY));

// Routes
app.use('/api', createNotesRouter(db, io));
app.use('/api', createFoldersRouter(db, io));
app.use('/api', createImagesRouter(IMAGES_PATH));

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
