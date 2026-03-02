# Kidehiiri — Backend

Express 5 + TypeScript REST API that proxies Kide.app/Tiketti.fi requests, handles anti-bot deobfuscation, and runs the heuristic event scorer.

## Quick Start

```bash
npm install
cp .env.example .env    # Fill in your values
npm run dev             # http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `ALLOWED_ORIGIN` | Yes | Frontend URL for CORS (e.g. `https://your-app.vercel.app`) |
| `AI_RERANKER_URL` | No | Python ML service URL (graceful fallback if missing) |
| `DATABASE_URL` | No | PostgreSQL connection string (needed for Tiketti + training pipeline) |
| `ADMIN_USERNAME` | No | Admin panel login |
| `ADMIN_PASSWORD` | No | Admin panel password |
| `JWT_SECRET` | No | Secret for admin JWT tokens |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/event` | — | Fetch Kide event + ticket variants |
| POST | `/api/validate-token` | — | Validate a Kide bearer token |
| POST | `/api/reserve` | — | Add Kide tickets to cart |
| POST | `/api/scan` | — | Scan city events, score + AI rerank (45s cache) |
| POST | `/api/score` | — | Heuristic score a batch of events |
| POST | `/api/deobfuscate` | — | Refresh anti-bot header values |
| GET | `/api/tiketti/events` | Admin | List Tiketti events from DB |
| POST | `/api/tiketti/event` | — | Fetch Tiketti event details |
| POST | `/api/tiketti/reserve` | — | Add Tiketti tickets to cart |
| GET | `/health` | — | Health check |

## Architecture

```
src/
├── index.ts           # Server entry, CORS, routes
├── kide-api.ts        # Kide.app HTTP client (spoofed headers)
├── tiketti-api.ts     # Tiketti.fi HTTP client
├── headers.ts         # Browser header generation
├── deobfuscator.ts    # Anti-bot value extraction
├── scorer.ts          # Adaptive weighted scoring engine
├── ai-reranker.ts     # ML reranker client (calls Python service)
├── poller.ts          # Background event data polling
├── db.ts              # PostgreSQL client
├── types.ts           # All TypeScript types
├── routes/
│   ├── scan.ts        # Fetch + filter + score + rerank
│   ├── event.ts       # Event detail proxy
│   ├── reserve.ts     # Cart action proxy
│   ├── validate.ts    # Token validation
│   ├── score.ts       # Batch scoring
│   ├── tiketti.ts     # Tiketti endpoints
│   ├── deobfuscate.ts # Anti-bot refresh
│   ├── auth.ts        # Admin JWT auth
│   └── admin.ts       # Admin panel routes
└── scrapers/
    └── tiketti.ts     # Tiketti.fi scraper
```

## Deployment (Railway)

1. Connect this repo to [Railway](https://railway.app)
2. Set environment variables (see above)
3. Railway uses the `Procfile` for startup
4. Deploy

## Security Notes

- Bearer tokens are **never** logged in full (first/last 4 chars only)
- CORS locked to `ALLOWED_ORIGIN`
- Admin routes protected by JWT
- All input validated with Zod schemas
- Error responses use consistent `{ success: false, error: string }` shape

## License

MIT
