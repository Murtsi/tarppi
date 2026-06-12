# Tärppi Frontend

React 19 + TypeScript + Vite UI for Tärppi. This folder is the only code that may be pushed to the public frontend repository.

## Required Backend URL

Production builds require `VITE_API_URL`. Without it, the app shows a clear backend setup state instead of posting to Vercel `/api/*` and hanging.

```bash
VITE_API_URL=https://your-backend.up.railway.app
```

Local development can use:

```bash
VITE_API_URL=http://localhost:3000
```

## Scripts

```bash
npm install
npm test
npm run build
npm run dev
```

## Deployment

Vercel project settings:

- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment: `VITE_API_URL=https://your-backend.up.railway.app`

The UI checks `${VITE_API_URL}/health` on load and only scans after the backend responds.

## Public Repo Rule

Use only the frontend subtree for the public remote:

```bash
git subtree split --prefix=frontend -b public-deploy
git push public public-deploy:main --force
git branch -D public-deploy
```

Do not include `backend/`, `ai-reranker/`, Railway config, anti-bot/deobfuscation code, scoring internals, or secrets in the public repo.
