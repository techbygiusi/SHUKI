# SHUKI

> ⚠️ **This project is currently in active development.** Features may be incomplete, APIs may change, and bugs are expected. Contributions and feedback are welcome!

**SHUKI** is a warm, offline-first Markdown note-taking app built with Electron. It syncs your notes in real-time to your own self-hosted Docker server, no third-party cloud, no subscriptions, just your data on your machine.

---

## Screenshots

<img width="2810" height="1368" alt="image" src="https://github.com/user-attachments/assets/ae89414d-718c-4e2c-bfb3-fbe81a87a8db" />

<img width="1814" height="1058" alt="image" src="https://github.com/user-attachments/assets/af8c2ed8-8e1d-4564-ab3e-1aecf3fdce78" />


---

## Features

- 📝 Rich WYSIWYG editor with Markdown toggle
- 🗂️ Folder organization with drag & drop
- 🖼️ Image support with a built-in gallery
- 🔄 Offline-first sync with background retry
- 🔐 Self-hosted — your data never leaves your server
- ⌨️ Fully keyboard-shortcut driven
- 🌗 Light, Dark & System theme support
- 🎨 Text color, highlight, and rich formatting toolbar

---

## Getting Started

### 1. Deploy the Server

You don't need to clone the repository. Just create a `docker-compose.yml` file anywhere on your machine or server:

```yaml
version: '3.8'
services:
  shuki-server:
    build:
      context: https://github.com/techbygiusi/shuki.git#main
      dockerfile: server/Dockerfile
    container_name: shuki-server
    ports:
      - "3000:3000"
    volumes:
      - shuki-data:/data
    environment:
      - PORT=3000
      - DATA_PATH=/data
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 20s

volumes:
  shuki-data:
    driver: local
```

Then start it:

```bash
docker-compose up --build -d
```

Docker pulls the source directly from GitHub and builds the server image automatically. All notes, images, and the API key are stored in the `shuki-data` volume and persist across restarts.

---

### 2. Get Your API Key

On first start, the server generates a secure API key. Retrieve it from the logs:

```bash
docker-compose logs shuki-server
```

Look for output like this:

```
================================================
SHUKI Server Ready!
Your API Key: a3f9...c821
Add this key to your Shuki app to connect.
================================================
```

---

### 3. Download & Connect the App

1. Download the latest installer from [Releases](https://github.com/techbygiusi/shuki/releases)
2. Install and open SHUKI
3. Enter your **Server URL** — e.g. `http://your-server-ip:3000`
4. Enter your **API Key** from the Docker logs
5. Click **Connect**

Your notes will begin syncing immediately.

---

## Build from Source

### Prerequisites

- [Node.js](https://nodejs.org) v18 or newer
- [Git](https://git-scm.com)

### Clone the repository

```bash
git clone https://github.com/techbygiusi/shuki.git
cd shuki
```

### Build the Electron app (Windows)

```powershell
cd electron-app
npm install
npm run build
```

The installer will be output to:

```
electron-app/release/SHUKI Setup 1.0.0.exe
```

### Build the Electron app (macOS / Linux)

```bash
cd electron-app
npm install
npm run build
```

Output will be in `electron-app/release/`.

---

## Development

### Run the server locally (without Docker)

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:3000`. The API key is saved to `./data/apikey.txt` on first start.

### Run the Electron app in dev mode

```bash
cd electron-app
npm install
npm run dev
```

Opens the app in development mode with hot reload (Vite on port 5173).

---

## Environment Variables

| Variable    | Default | Description                          |
|-------------|---------|--------------------------------------|
| `PORT`      | `3000`  | Port the server listens on           |
| `DATA_PATH` | `/data` | Directory for database, images & key |

---

## API Reference

All endpoints except `/api/health` require the header:

```
Authorization: Bearer <API_KEY>
```

| Method   | Endpoint            | Description             |
|----------|---------------------|-------------------------|
| `GET`    | `/api/health`       | Server health & storage |
| `GET`    | `/api/notes`        | List all notes          |
| `GET`    | `/api/notes/:id`    | Get a single note       |
| `POST`   | `/api/notes`        | Create a note           |
| `PUT`    | `/api/notes/:id`    | Update a note           |
| `DELETE` | `/api/notes/:id`    | Delete a note           |
| `POST`   | `/api/images`       | Upload an image         |
| `GET`    | `/api/images/:file` | Serve an image          |
| `GET`    | `/api/stats`        | Server statistics       |

---

## Keyboard Shortcuts

| Shortcut                | Action               |
|-------------------------|----------------------|
| `Ctrl/Cmd + N`          | New note             |
| `Ctrl/Cmd + S`          | Force save & sync    |
| `Ctrl/Cmd + F`          | Search notes         |
| `Ctrl/Cmd + ,`          | Open settings        |
| `Ctrl/Cmd + Shift + P`  | Toggle preview mode  |

> Shortcuts are fully customizable in **Settings → Shortcuts**.

---

## Architecture

```
shuki/
├── electron-app/     # Electron + React + Vite + TypeScript
│   ├── src/
│   │   ├── components/   # UI components (Editor, Sidebar, Settings...)
│   │   ├── store/        # Zustand state management
│   │   └── sync/         # Offline-first sync engine
│   └── electron/         # Main process, IPC, window management
│
└── server/           # Express + TypeScript + better-sqlite3
    ├── src/
    │   ├── routes/       # REST API endpoints
    │   └── sync/         # WebSocket real-time updates
    └── Dockerfile
```

**Sync model:** Notes are saved locally first (sql.js), then synced to the server via REST API. Changes made while offline are queued and replayed automatically when the server becomes reachable again. WebSockets handle real-time updates across multiple connected clients.

---

## Roadmap

- [ ] Multiple fixes
- [ ] Multi-device conflict resolution
- [ ] End-to-end encryption
- [ ] Export to PDF

---

## License

MIT - see [LICENSE](LICENSE) for details.
