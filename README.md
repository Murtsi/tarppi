# Kidehiiri

> Automatic ticket tool for [kide.app](https://kide.app) — monitors event sales and snipes tickets to your cart. Includes an AI-powered event scorer.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel)

## Features

### Ticket Sniper
- 5-step wizard: Event → Delay → Keywords → Summary → Monitor
- Real-time polling with configurable interval (200ms–5s)
- Automatic cart action the instant tickets become available
- Token validation with expiry check
- Keyword filtering for specific ticket types

### AI Event Scorer
- Scan events by Finnish city
- Heuristic scoring engine (popularity, demand, pricing, timing, organiser)
- Optional ML reranker (BUY / MAYBE / SKIP with confidence bars)
- Grouped card view with expandable feature breakdowns
- City picker with all Finnish cities

### UI
- Mobile-first responsive design
- Dark theme with smooth animations
- Finnish + English language support
- Accessible (keyboard nav, focus indicators, reduced-motion support)

## Quick Start

```bash
npm install
cp .env.example .env    # Set your backend API URL
npm run dev             # http://localhost:5173
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `https://your-backend.up.railway.app` |

## Deployment (Vercel)

1. Connect this repo to [Vercel](https://vercel.com)
2. Framework preset: **Vite**
3. Set `VITE_API_URL` in environment variables
4. Deploy

The `vercel.json` includes rewrite rules to proxy `/api/*` requests during development.

## Tech Stack

| | |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5.9 (strict) |
| Bundler | Vite 7 |
| Styling | Pure CSS with custom properties |
| i18n | Custom translations (EN + FI) |

## Project Structure

```
src/
├── App.tsx              # Main app — sniper logic, scorer
├── App.css              # Full responsive styles
├── components/
│   ├── CityPicker.tsx   # City selector with search
│   ├── ErrorBoundary.tsx
│   └── Logo.tsx
└── lib/
    ├── translations.ts  # EN + FI strings
    └── kide/
        ├── api.ts       # Backend API client
        ├── types.ts     # Type definitions
        └── kide-cities.json
```

## How It Works

1. **All API calls go through the backend** — the browser never hits kide.app directly
2. The sniper polls the backend at the configured interval
3. When tickets appear, the backend adds them to the user's kide.app cart
4. The user completes checkout manually on kide.app

## Backend

This frontend requires a separate backend API server. See the backend repository for setup instructions.

## License

MIT
