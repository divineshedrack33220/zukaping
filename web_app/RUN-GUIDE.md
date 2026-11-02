# Zukaping Web App — Run Guide

React + TypeScript PWA that mirrors the Zukaping Flutter app and talks to the same Go backend.

Location: `C:\Users\hp\Desktop\zukaping\web_app`

## Requirements

- Node.js 18+ (tested with Node 26) and npm
- A Go backend on `http://127.0.0.1:8080` and MongoDB on `127.0.0.1:27017`. The dev
  server proxies `/api` and `/ws` to it; `vite.config.ts` falls back to the hosted
  service when you set `DEV_API_TARGET`.
- Docker is not an option on this machine (no WSL2), so the backend and MongoDB run
  natively from `C:\Users\hp\devtools`.

## Run it

Double-click `run.bat` (or run it from a terminal). It brings the whole stack up and
then serves the app:

1. `mongod` - skipped if `127.0.0.1:27017` already listens
2. `backend\server.exe` - compiled on first use if missing; skipped if `:8080` already listens
3. `npm install` (first time only) and `npm run dev`

MongoDB and the API open as minimised windows; closing a window stops that service.
Their data lives in `C:\Users\hp\devtools\mongodb-data` - a small local database, not
your production data. The API reads secrets from `backend\.env` (see
`backend\.env.example`) and refuses to start without `JWT_SECRET` and `MONGODB_URI`,
so `run.bat` warns and continues without the API if that file is missing.

To run only the web app while the services are already up:

```bash
cd C:\Users\hp\Desktop\zukaping\web_app
npm install      # first time only
npm run dev
```

Open http://localhost:3000

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npx tsc --noEmit` | Type-check only |

## Screens / routes

| Route | Screen |
| --- | --- |
| `/` , `/chats` | Chat list |
| `/chat/:chatId` | Conversation (REST history + WebSocket) |
| `/feed` | Feed of posts (`GET /feed`) |
| `/nearby` | Nearby people (`GET /users/nearby`) |
| `/create-post` | Create post (`POST /post`) |
| `/profile` | Own profile (`GET /me`) |
| `/edit-profile` | Edit profile (`PUT /me`) |
| `/group-join` | Join a group by invite code |
| `/login`, `/signup` | Auth screens |

## Backend configuration

Development uses relative URLs (`/api`, `/ws`), so **no CORS setup is needed** — Vite proxies them.

`vite.config.ts` proxies to `http://127.0.0.1:8080` by default, which is what `run.bat`
starts. To point the dev proxy at a hosted backend instead, set `DEV_API_TARGET`:

```bash
DEV_API_TARGET=https://lemon16.onrender.com npm run dev
```

For production builds, set environment variables (see `.env.example`):

```env
VITE_API_URL=https://lemon16.onrender.com/api
VITE_WS_URL=wss://lemon16.onrender.com/ws
```

## Auth

- `POST /api/login`, `POST /api/signup`, `POST /api/google-auth`
- The JWT is attached as `Authorization: Bearer <token>` by an axios interceptor.
- **Remember me** checked → `localStorage`; unchecked → `sessionStorage`.
  `AuthProvider` is the only place that writes the token.

## PWA

- `public/manifest.json` — name, icons (incl. maskable), standalone display
- `public/service-worker.js` — precaches the shell, network-first for navigation,
  never caches `/api` or `/ws`
- The service worker registers **only in production** (`import.meta.env.PROD`),
  so development is never cached.

## Deploying

```bash
npm run build
```

Upload `dist/` to Netlify, Vercel, Cloudflare Pages, Nginx, etc.
Make sure the host rewrites unknown paths to `index.html` (SPA routing) and sets
`VITE_API_URL` / `VITE_WS_URL` at build time.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `node` / `npm` not found | Install Node.js; on this machine it lives at `C:\Program Files\nodejs` |
| `npm.ps1 cannot be loaded` in PowerShell | Use `npm.cmd` or `cmd /c npm ...` |
| API returns 503 | `zukaping.onrender.com` is suspended — use the lemon16 mirror |
| First request is slow | Render free instances sleep; the client retries automatically (45 s timeout) |
| Blank page after a deploy | Check the browser console and that `dist/index.html` is served |
| PWA won't install | Serve over HTTPS (or localhost) and confirm manifest + icons load |

## Notes

- The Flutter app in `mobile_app/` is untouched and keeps using the same backend.
- Timestamps from the Go backend are Unix **seconds**; `src/utils/time.ts` normalises them.
