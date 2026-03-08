# NoteSync

A Markdown note-taking Electron app with real-time sync to a self-hosted Docker server.

## Quick Start

### Deploy the Server

No need to clone the repository. Just create a `docker-compose.yml` file anywhere on your machine or server with the following content:

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
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
volumes:
  shuki-data:
    driver: local
```

Then run:

```bash
docker-compose up --build -d
```

Docker will automatically pull the source code from GitHub and build the server image.

### Get your API Key

On first start, the server generates a secure API key. Retrieve it from the logs:

```bash
docker-compose logs shuki-server
```

Look for:

```
================================================
SHUKI Server Ready!
Your API Key: a3f9...c821
Add this key to your Shuki app to connect.
================================================
```

The server runs on port **3000** by default. All notes and the API key are stored in the Docker volume `shuki-data` and persist across restarts.

### Connect the Electron App

1. Open the Shuki Electron app
2. Enter your Server URL: `http://your-server-ip:3000`
3. Enter your API Key from the Docker logs
4. Click Connect

### 3. Build for Production

```bash
cd electron-app
npm run build
```

Distributables are output to `electron-app/release/`.

## Development

### Server (local, no Docker)

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:3000`. API key is saved to `./data/apikey.txt`.

### Electron App

```bash
cd electron-app
npm install
npm run dev
```

Opens the app in development mode with hot reload (Vite on port 5173).

## Environment Variables

### Server

| Variable    | Default  | Description                     |
| ----------- | -------- | ------------------------------- |
| `PORT`      | `3000`   | Server port                     |
| `DATA_PATH` | `/data`  | Path for database, images, key  |

## API Endpoints

All endpoints (except `/api/health`) require `Authorization: Bearer <API_KEY>`.

| Method   | Endpoint              | Description               |
| -------- | --------------------- | ------------------------- |
| `GET`    | `/api/health`         | Server health + storage   |
| `GET`    | `/api/notes`          | List all notes            |
| `GET`    | `/api/notes/:id`      | Get single note           |
| `POST`   | `/api/notes`          | Create note               |
| `PUT`    | `/api/notes/:id`      | Update note               |
| `DELETE` | `/api/notes/:id`      | Delete note               |
| `POST`   | `/api/images`         | Upload image              |
| `GET`    | `/api/images/:file`   | Serve image               |
| `GET`    | `/api/stats`          | Server statistics         |

## Keyboard Shortcuts

| Shortcut              | Action              |
| --------------------- | ------------------- |
| `Ctrl/Cmd + N`        | New note            |
| `Ctrl/Cmd + S`        | Force save/sync     |
| `Ctrl/Cmd + F`        | Search              |
| `Ctrl/Cmd + ,`        | Settings            |
| `Ctrl/Cmd + Shift + P`| Toggle preview      |

## Architecture

- **Electron App**: React + Vite + TypeScript, Tailwind CSS, Zustand state management, better-sqlite3 local cache
- **Server**: Express + TypeScript, Socket.IO, better-sqlite3, multer for images
- **Sync**: Debounced auto-save with REST API + WebSocket real-time updates. Offline-first with background retry.

## License

MIT
