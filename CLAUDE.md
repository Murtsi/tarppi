# Kide Sniper — Claude Code Instructions

## Project Overview
Kidehiiri is a ticket automation tool for [Kide.app](https://kide.app). It monitors event availability and adds tickets to the shopping cart the moment they go on sale. It also includes an AI-powered event scorer that classifies events as BUY / MAYBE / SKIP using a heuristic engine + optional ML reranker.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite → deployed to Vercel
- **Backend**: Express 5 + TypeScript (ESM) → deployed to Railway
- **AI Reranker**: Python 3.12 + FastAPI + scikit-learn → deployed to Railway (optional)
- **HTTP Client**: `axios` (backend), native `fetch` (frontend + backend reranker client)
- **Build**: Vite (frontend), tsc (backend), Docker (ai-reranker)

## Project Structure
```
kidehiiri/
├── frontend/                # React UI (Vercel)
│   ├── src/
│   │   ├── App.tsx          # Main app — Sniper + Scorer tabs
│   │   ├── App.css          # All styles
│   │   ├── components/
│   │   │   └── CityPicker.tsx
│   │   └── lib/
│   │       ├── translations.ts    # EN + FI i18n
│   │       └── kide/
│   │           ├── api.ts         # API client (calls backend)
│   │           └── types.ts       # Frontend type definitions
│   ├── index.html
│   ├── vite.config.ts
│   ├── vercel.json
│   └── package.json
│
├── backend/                 # Express API (Railway)
│   ├── src/
│   │   ├── index.ts         # Server entry point
│   │   ├── kide-api.ts      # Kide.app HTTP client
│   │   ├── headers.ts       # Browser header spoofing
│   │   ├── deobfuscator.ts  # Anti-bot value extraction
│   │   ├── scorer.ts        # Heuristic scoring engine
│   │   ├── ai-reranker.ts   # ML reranker HTTP client
│   │   ├── types.ts         # All backend types
│   │   └── routes/
│   │       ├── scan.ts      # /api/scan — fetch + score + rerank
│   │       ├── score.ts     # /api/score — score pre-extracted events
│   │       ├── event.ts     # /api/event
│   │       ├── reserve.ts   # /api/reserve
│   │       ├── validate.ts  # /api/validate-token
│   │       └── deobfuscate.ts
│   ├── Procfile
│   ├── railway.json
│   └── package.json
│
├── ai-reranker/             # Python ML service (Railway, optional)
│   ├── feature_engineering.py  # 25-feature transform pipeline
│   ├── train.py                # Model training + evaluation
│   ├── serve.py                # FastAPI inference server
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/
│   │   └── sample_labelled_events.csv
│   └── ARCHITECTURE.md
│
├── .github/
│   └── copilot-instructions.md
├── CLAUDE.md                # This file
└── README.md
```

## Kide.app API Endpoints
```
GET  https://api.kide.app/api/products/:id          # Fetch product + variants
GET  https://api.kide.app/api/products?city=...      # Listing by city
POST https://api.kide.app/api/reservations          # Add to cart (auth required)
GET  https://api.kide.app/api/authentication/user   # Validate token
```

## Key Patterns

### Error Handling
```typescript
try {
  const result = await kideApi.addToCart(token, variantId, qty);
  return { success: true, data: result };
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return { success: false, error: 'token_expired' };
    if (error.response?.status === 409) return { success: false, error: 'already_reserved' };
  }
  return { success: false, error: 'unknown' };
}
```

### Frontend API Calls (all go through backend)
```typescript
const result = await apiCall<ScanResponse>('/api/scan', { city, productType: 1 })
```

### Scorer Flow
```
Kide Listing → mapToEventFeatures() → scoreEvents() → rerankEvents() → ScanResponse
                (scan.ts)              (scorer.ts)     (ai-reranker.ts)
```

### AI Reranker Integration
The backend reranker client (`ai-reranker.ts`) calls the Python FastAPI service at `AI_RERANKER_URL`. If the service is down, events keep their heuristic scores only — `ai_score` remains `undefined`.

## Types (key ones)

### AiScore
```typescript
type AiScore = {
  label: 'BUY' | 'MAYBE' | 'SKIP'
  buy_probability: number
  maybe_probability: number
  skip_probability: number
  model_version: string
}
```

### ScoredEvent (includes ai_score)
```typescript
type ScoredEvent = {
  event_id: string
  name: string
  organiser?: string
  resell_score: number           // heuristic 0-100
  decision: 'BUY' | 'MAYBE' | 'SKIP'  // heuristic label
  feature_breakdown: { popularity, demand, pricing, timing, organiser }
  ai_score?: AiScore             // ML label + probabilities (optional)
  // ... more fields
}
```

## Development Commands
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# AI Reranker
cd ai-reranker && pip install -r requirements.txt
python train.py --data data/sample_labelled_events.csv
python serve.py
```

## Coding Standards
- **TypeScript strict mode** — no `any`, all API responses typed
- **Error handling** — always handle network failures gracefully
- **No hardcoded secrets** — token in app state / localStorage only
- **Token safety** — never log full tokens: `token.slice(0,4) + '...' + token.slice(-4)`
- **Logging** — structured logs with `[module]` prefix
- **Use `const`/`let`** — never `var`

## Git Repository Policy

This project has **two GitHub remotes** with different visibility rules:

### `origin` → `Murtsi/kidehiiri` (PRIVATE)
- Contains the **full monorepo**: `frontend/`, `backend/`, `ai-reranker/`
- **Push everything here** — secrets, backend logic, deobfuscation, anti-bot, scoring algorithms, API keys, internal routes, scraper code, etc.
- This repo is never visible to the public.
- Default push target for all commits.

### `public` → `Murtsi/Kidehiiri-public` (PUBLIC)
- Contains **frontend/ only** — deployed via `git subtree split --prefix=frontend`
- Intended as a learning resource for people who want to build similar tools.
- **NEVER push** any of the following here:
  - Backend source code (`backend/`, `ai-reranker/`)
  - Deobfuscation / anti-bot logic (`deobfuscator.ts`, `headers.ts`)
  - Kide.app API implementation details (header spoofing, reservation body format)
  - Scorer algorithms or heuristic weights
  - Secret phrase hashes or admin routes
  - Railway / infrastructure config
  - Environment variables or API keys
- When pushing to public, **always** use:
  ```bash
  git subtree split --prefix=frontend -b public-deploy
  git push public public-deploy:main --force
  git branch -D public-deploy
  ```
- Ensure the frontend code itself is sanitized — no comments or types that reveal backend architecture, endpoint implementations, or anti-bot strategies.

## What NOT to Suggest
- Don't store tokens in plaintext files
- Don't suggest intervals below 200ms (rate limiting risk)
- Don't automate checkout/payment
- Don't use `var` or `any` type
