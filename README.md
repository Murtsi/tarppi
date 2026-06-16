# Tärppi Frontend

Small React 19 + TypeScript + Vite app for Tärppi.

## What this folder does

| Area | Purpose |
|---|---|
| App shell | Main UI, Telegram setup, live log, and ticket watch flow |
| Data | Talks to the Railway backend through `VITE_API_URL` |
| Public release | This is the only part that should be pushed to the public repo |

## Environment

```bash
VITE_API_URL=https://your-tarppi-backend.up.railway.app
```

Local development:

```bash
VITE_API_URL=http://localhost:3000
```

If `VITE_API_URL` is missing, the app stops at a backend setup state instead of guessing.

## Scripts

```bash
npm install
npm test
npm run build
npm run dev
```

## Deploy

- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

The app checks `${VITE_API_URL}/health` on load and only continues once the backend answers.

## Public push

```bash
git subtree split --prefix=frontend -b public-deploy
git push public public-deploy:main --force
git branch -D public-deploy
```

Keep `backend/`, `ai-reranker/`, Railway config, anti-bot code, and secrets out of the public repo.
