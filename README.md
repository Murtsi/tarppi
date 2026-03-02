<<<<<<< HEAD
<p align="center">
  <img src="public/banner.svg" alt="Kidehiiri" width="700" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&style=flat-square" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&style=flat-square" />
  <img src="https://img.shields.io/badge/Vite-7-646cff?logo=vite&style=flat-square" />
  <img src="https://img.shields.io/badge/AI-Koneoppiminen-ff6b6b?style=flat-square" />
</p>

---

## Mikä on Kidehiiri?

**Kidehiiri** on automaattinen lippuostaja [Kide.app](https://kide.app)-tapahtumiin. Se seuraa lippujen myyntiä reaaliajassa ja lisää ne ostoskoriin heti, kun ne tulevat saataville — nopeammin kuin käsin ikinä ehdit.

Sovellus sisältää myös **tekoälypohjaisen tapahtumapisteyttäjän**, joka analysoi tulevia tapahtumia ja kertoo mitkä niistä kannattaa napata.

> **Huom:** Kidehiiri hoitaa vain seurannan ja koriin lisäämisen. Maksaminen on aina sinun käsissäsi.

---

## Ominaisuudet

### Lippuostaja

Selkeä 4-vaiheinen ohjattu toiminto vie sinut alusta loppuun:

| Vaihe | Kuvaus |
|-------|--------|
| **1. Tapahtuma** | Liitä tapahtuman URL ja valitse lipputyyppi suoraan |
| **2. Asetukset** | Säädä pollausväli ja varaläpitila |
| **3. Yhteenveto** | Tarkista asetukset ennen seurannan käynnistämistä |
| **4. Seuranta** | Reaaliaikainen loki näyttää kaiken mitä tapahtuu |

- Automaattinen tokenin validointi ja vanhenemistarkistus
- Reaaliaikainen pollaus — reagoi heti kun liput tulevat myyntiin
- **Varaläpitila** — jos valittua lippua ei saa, botti kokeilee automaattisesti muita saatavilla olevia lippuja
- Toimii sekä tietokoneella että puhelimella

### AI-tapahtumapisteyttäjä

Tekoäly analysoi Kide.app-tapahtumia usean eri tekijän perusteella ja pisteyttää ne asteikolla 0–100:

- **Suosio** — kuinka paljon kiinnostusta tapahtuma herättää
- **Kysyntä** — lippujen saatavuus suhteessa kysyntään
- **Hinnoittelu** — onko hinta kohdallaan
- **Ajoitus** — myynnin ajankohta ja tapahtumapäivä
- **Järjestäjä** — tunnettuus ja historia

Pisteytyksen lisäksi koneoppimismalli luokittelee jokaisen tapahtuman kolmeen kategoriaan:

| Luokitus | Merkitys |
|----------|----------|
| 🟢 **BUY** | Kannattaa napata heti |
| 🟡 **MAYBE** | Seuraamisen arvoinen |
| 🔴 **SKIP** | Ei todennäköisesti kiinnosta |

Jokainen tapahtuma näyttää myös **AI-luottamuspalkin**, joka kertoo kuinka varma malli on ennusteestaan.

### Käyttöliittymä

- **Tumma teema** sulavailla animaatioilla
- **Mobiilioptimioitu** — toimii saumattomasti puhelimella
- **Suomi + englanti** — kielivalinta yhdellä klikkauksella
- **Saavutettava** — näppäimistönavigaatio, fokusindikaattorit, reduced-motion-tuki

---

## Teknologia

| | |
|---|---|
| **Käyttöliittymä** | React 19 + TypeScript 5.9 (strict mode) |
| **Rakennustyökalu** | Vite 7 — salamannopea kehitysympäristö |
| **Tyylit** | Puhdas CSS custom propertiesilla — ei UI-kirjastoja |
| **Tekoäly** | Heuristinen pisteytysmoottori + koneoppimismalli (scikit-learn) |
| **Kielituki** | Oma i18n-ratkaisu suomeksi ja englanniksi |
| **Julkaisu** | Vercel (frontend) — automaattinen CI/CD |

### Tekoälystä tarkemmin

Tapahtumapisteyttäjä toimii kahdessa vaiheessa:

1. **Heuristinen analyysi** — sääntöpohjainen moottori laskee pisteet viiden eri tekijän perusteella
2. **Koneoppiminen** — ML-malli (Random Forest) on koulutettu aiemmilla tapahtumadatalla ja uudelleenluokittelee tapahtumat BUY/MAYBE/SKIP-kategorioihin

Malli oppii jatkuvasti uusista tapahtumista ja parantaa ennusteitaan ajan myötä. Jos ML-palvelu ei ole saatavilla, sovellus näyttää silti heuristiset pisteet — toiminta ei koskaan keskeydy.

---

## Pika-aloitus

```bash
npm install
cp .env.example .env    # Aseta backend-palvelimen osoite
npm run dev             # → http://localhost:5173
```

## Ympäristömuuttujat

| Muuttuja | Kuvaus |
|----------|--------|
| `VITE_API_URL` | Backend-palvelimen osoite |

## Julkaisu (Vercel)

1. Yhdistä tämä repo [Verceliin](https://vercel.com)
2. Valitse framework: **Vite**
3. Aseta `VITE_API_URL` ympäristömuuttujiin
4. Deploy — valmis!

---

## Projektin rakenne

```
src/
├── App.tsx              # Pääsovellus — lippuostaja + pisteyttäjä
├── App.css              # Responsiiviset tyylit
├── components/
│   ├── CityPicker.tsx   # Kaupunkivalitsin haulla
│   ├── ErrorBoundary.tsx
│   └── Logo.tsx         # SVG-logot
└── lib/
    ├── translations.ts  # Suomi + englanti -käännökset
    └── kide/
        ├── api.ts       # API-kutsujen hallinta
        ├── types.ts     # Tyyppimäärittelyt
        └── kide-cities.json
```

---

<p align="center">
  <sub>Tehty Suomessa 🇫🇮</sub>
</p>

## Miten se toimii?

1. **Kaikki API-kutsut kulkevat backendin kautta** — selain ei koskaan ota suoraan yhteyttä kide.app:iin
2. Sovellus kyselee backendiä valitulla aikavälillä
3. Kun lippuja ilmestyy, backend lisää ne käyttäjän kide.app-ostoskoriin
4. Käyttäjä viimeistelee ostoksen itse kide.app:ssa

## Backend

Tämä frontend vaatii erillisen backend-palvelimen toimiakseen.

## Lisenssi
=======
# Kidehiiri

Automatic ticket buying bot for [kide.app](https://kide.app). Monitors event availability and adds tickets to your cart the moment they go on sale. Includes an AI-powered event scorer that classifies events as BUY / MAYBE / SKIP.

## Repository Layout

This project is designed to be published as **two separate repos**:

| Repo | Visibility | Contents | Deploy |
|------|-----------|----------|--------|
| `kidehiiri` | **Public** | `frontend/` | Vercel |
| `kidehiiri-backend` | **Private** | `backend/` + `ai-reranker/` | Railway |

### Splitting into two repos

# 1. Create the public frontend repo
mkdir kidehiiri-public
cp -r frontend/* kidehiiri-public/
cp frontend/.env.example kidehiiri-public/
cd kidehiiri-public
git init && git add . && git commit -m "init"
# Push to github.com/you/kidehiiri (public)

# 2. Create the private backend repo
cp -r backend/* kidehiiri-private/
cp -r ai-reranker kidehiiri-private/
cp backend/.env.example kidehiiri-private/
cd kidehiiri-private
git init && git add . && git commit -m "init"
# Push to github.com/you/kidehiiri-backend (private)
```

Each sub-folder has its own README with full setup instructions.

## Architecture

```
kidehiiri/

### Frontend (Vercel)
- React 19 + TypeScript + Vite
- Mobile-first responsive design
- Calls backend API — never hits kide.app directly
- Proxies all Kide.app API calls (avoids CORS + bot detection)
- Server-side deobfuscation of anti-bot values
- Heuristic event scorer (adaptive weighted: popularity, demand, pricing, timing, organiser)
- Optional AI reranker integration (calls Python microservice)
- Realistic header spoofing with rotating User-Agents
- CORS-locked to your Vercel domain

### AI Reranker (Railway — optional)
- Python FastAPI microservice
- GradientBoosting classifier (scikit-learn) trained on labelled events
- Consumes heuristic features, outputs BUY/MAYBE/SKIP with probabilities
- Backend falls back gracefully if service is unavailable

## Quick Start

### Prerequisites
- Node.js 20+
- npm or bun
- Python 3.12+ (only for AI reranker)

### Backend

```bash
cd backend
npm install
cp .env.example .env    # Edit ALLOWED_ORIGIN
npm run dev             # Starts on port 3000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env    # Edit VITE_API_URL
npm run dev             # Starts on port 5173
```

### AI Reranker (optional)

```bash
cd ai-reranker
pip install -r requirements.txt
python train.py --data data/sample_labelled_events.csv
python serve.py         # Starts on port 8100
```

Set `AI_RERANKER_URL=http://localhost:8100` in the backend environment.

## API Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/event` | `{ eventUrl }` | Fetch event + ticket variants |
| POST | `/api/validate-token` | `{ token }` | Validate a Kide.app bearer token |
| POST | `/api/reserve` | `{ variantId, authorizationToken, amount }` | Add tickets to cart |
| POST | `/api/scan` | `{ city, productType? }` | Scan city events, score + AI rerank |
| POST | `/api/score` | `{ events }` | Score a batch of events (heuristic) |
| POST | `/api/deobfuscate` | `{}` | Refresh anti-bot header values |
| GET | `/health` | — | Health check |

## Deployment

### Frontend → Vercel

1. Connect your GitHub repo to Vercel
2. Set root directory to `frontend`
3. Set environment variable: `VITE_API_URL=https://your-app.up.railway.app`
4. Deploy

### Backend → Railway

1. Connect your GitHub repo to Railway
2. Set root directory to `backend`
3. Set environment variables:
   - `PORT=3000`
   - `ALLOWED_ORIGIN=https://your-app.vercel.app`
   - `AI_RERANKER_URL=https://your-reranker.up.railway.app` (optional)
4. Deploy

### AI Reranker → Railway (optional)

1. Add a new Railway service from the same repo
2. Set root directory to `ai-reranker`
3. Uses the included Dockerfile
4. Set `PORT=8100`
5. Deploy

## Environment Variables

### Frontend (`frontend/.env`)
```
VITE_API_URL=https://your-railway-app.up.railway.app
```

### Backend (`backend/.env`)
```
PORT=3000
ALLOWED_ORIGIN=https://your-app.vercel.app
AI_RERANKER_URL=http://localhost:8100
```

## How It Works

### Sniper
1. **User inputs**: Event URL, bearer token, ticket quantity, poll interval
2. **Frontend** sends requests to the **backend** API
3. **Backend** proxies requests to kide.app with spoofed browser headers
4. **Monitoring loop** polls for ticket availability every N milliseconds
5. When tickets become available → immediately adds to cart
6. User completes checkout manually on kide.app

### AI Scorer
1. User selects a Finnish city
2. Backend fetches all events from Kide.app
3. Heuristic scorer evaluates popularity, demand, pricing, timing, organiser
4. AI reranker (if available) classifies events with ML model
5. Frontend shows events grouped by BUY / MAYBE / SKIP with probabilities

## Anti-Bot Handling

Kide.app uses an obfuscated JavaScript file (`body.js`) that rotates two values:
- An `extraId` hash (32-char hex)
- An `X-Requested-Token-xxx` header key

The backend's deobfuscator module:
1. Fetches kide.app's HTML to find the current `body.js` version
2. Downloads and parses the obfuscated script
3. Deobfuscates using AST transformation
4. Extracts the current hash and header key
5. Caches the result for 60 seconds

## Security

- Bearer tokens are **never** logged in full (only first/last chars)
- Tokens are stored in `localStorage` on the client
- Backend CORS is locked to the Vercel frontend domain
- All kide.app traffic goes through the backend — the browser never hits kide.app APIs directly

## Technologies

| | Frontend | Backend | AI Reranker |
|---|---|---|---|
| Framework | React 19 | Express 5 | FastAPI |
| Language | TypeScript 5.9 | TypeScript 5.9 | Python 3.12 |
| Build | Vite 7 | tsc | Docker |
| Deploy | Vercel | Railway | Railway |

## License
>>>>>>> f870beea45bb615720c5e7b1358b479d7b735663

MIT
