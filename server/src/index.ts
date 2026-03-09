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
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SHUKI - Server is online</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #F7F3EE; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    background: #FDFAF7; max-width: 480px; width: 100%; border-radius: 16px;
    box-shadow: 0 4px 24px rgba(80,50,20,0.10); padding: 40px 32px 32px;
  }
  h1 { color: #C17F3A; font-size: 1.5rem; margin-bottom: 4px; }
  .version { color: #7A6A55; font-size: 0.85rem; margin-bottom: 24px; }
  .status { font-size: 1.1rem; margin-bottom: 28px; padding: 12px 16px; border-radius: 10px; color: #166534; background: #dcfce7; }
  h2 { color: #C17F3A; font-size: 1.1rem; margin-bottom: 16px; }
  .steps { list-style: none; counter-reset: step; }
  .steps li { counter-increment: step; margin-bottom: 14px; padding-left: 32px; position: relative; line-height: 1.5; font-size: 0.95rem; color: #2C2416; }
  .steps li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 22px; height: 22px; background: #C17F3A; color: #fff; font-weight: 700; font-size: 0.75rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .url-block { background: #EDE8E0; border-radius: 8px; padding: 10px 14px; font-family: monospace; font-size: 0.85rem; margin: 8px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; word-break: break-all; }
  .url-block input { flex: 1; background: none; border: none; font-family: monospace; font-size: 0.85rem; color: #2C2416; outline: none; }
  .url-block button { flex-shrink: 0; background: #C17F3A; border: none; border-radius: 6px; padding: 6px 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer; color: #fff; }
  .url-block button:hover { opacity: 0.85; }
  footer { text-align: center; margin-top: 28px; color: #7A6A55; font-size: 0.75rem; letter-spacing: 0.05em; }
</style>
</head>
<body>
<div class="card">
  <h1>SHUKI</h1>
  <div class="version">v1.0.0</div>
  <div class="status">\\u2705 Server is online</div>
  <h2>Connect with the Shuki App</h2>
  <ol class="steps">
    <li>Open Shuki</li>
    <li>Enter this server URL:
      <div class="url-block">
        <input type="text" id="url" readonly />
        <button id="copy-btn">Copy</button>
      </div>
    </li>
    <li>Enter your API Key <span style="color:#7A6A55;font-size:0.8rem">(found in Docker logs)</span></li>
    <li>Click <strong>Connect</strong></li>
  </ol>
  <footer>SHUKI &mdash; Self-hosted notes server</footer>
</div>
<script>
  document.getElementById('url').value = window.location.origin;
  document.getElementById('copy-btn').addEventListener('click', function() {
    navigator.clipboard.writeText(window.location.origin);
    this.textContent = 'Copied!';
    var btn = this;
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
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
