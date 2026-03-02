# GitHub Copilot Instructions — Kidehiiri

## Project Purpose
Kidehiiri is a web-based ticket automation tool for [kide.app](https://kide.app). It monitors event availability and adds tickets to the shopping cart the moment they go on sale. Users provide their own Bearer token. The app handles polling + cart — the user handles checkout. It also features an AI event scorer.

## Architecture
- **Frontend** (`frontend/`): React 19 + TypeScript + Vite → Vercel
- **Backend** (`backend/`): Express 5 + TypeScript (ESM) → Railway
- **AI Reranker** (`ai-reranker/`): Python FastAPI + scikit-learn → Railway (optional)

The frontend never hits kide.app directly — all API calls go through the backend proxy.

## Kide.app API Knowledge

### Base URL
```
https://api.kide.app/api
```

### Key Endpoints
```typescript
GET /products/:productId              // Product details + variants (no auth)
GET /products?city=Helsinki&...       // Listing by city
GET /authentication/user              // Validate bearer token (auth required)
POST /reservations                    // Add to cart (auth required)
// Body: { "toCreate": [{ "inventoryId": string, "quantity": number }] }
```

## Coding Conventions

### TypeScript
- Strict mode enabled — no implicit `any`
- All Kide API responses fully typed in `backend/src/types.ts`
- Frontend mirrors types in `frontend/src/lib/kide/types.ts`
- Use `type` over `interface` for pure data shapes
- Use `const`/`let`, never `var`

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

### Scorer / AI Reranker Flow
```
/api/scan request
  → fetchAllProducts(city)     // kide-api.ts
  → mapToEventFeatures()       // routes/scan.ts
  → scoreEvents(features)      // scorer.ts (heuristic)
  → rerankEvents(scored)       // ai-reranker.ts (ML, graceful fallback)
  → ScanResponse               // events with feature_breakdown + ai_score
```

## File Ownership
| Concern | File |
|---|---|
| Kide HTTP calls | `backend/src/kide-api.ts` |
| Heuristic scoring | `backend/src/scorer.ts` |
| AI reranker client | `backend/src/ai-reranker.ts` |
| All backend types | `backend/src/types.ts` |
| Backend routes | `backend/src/routes/*.ts` |
| Server entry | `backend/src/index.ts` |
| Frontend app | `frontend/src/App.tsx` |
| Frontend API client | `frontend/src/lib/kide/api.ts` |
| Frontend types | `frontend/src/lib/kide/types.ts` |
| Translations (EN/FI) | `frontend/src/lib/translations.ts` |
| ML feature engineering | `ai-reranker/feature_engineering.py` |
| ML model training | `ai-reranker/train.py` |
| ML inference server | `ai-reranker/serve.py` |

## What to Prioritize
1. **Speed** — cart action should have minimal overhead
2. **Reliability** — retry on network errors, not on 4xx
3. **UX clarity** — status messages, score badges, AI confidence bars
4. **Token safety** — never log full tokens

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
- Don't store tokens in plaintext files (use `localStorage`)
- Don't suggest intervals below 200ms (rate limiting risk)
- Don't automate checkout/payment step
- Don't use `var` or `any`
