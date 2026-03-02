# AI Reranking Integration — Architecture & Setup

## Overview

The AI reranker is a **Python microservice** that sits alongside the Node.js backend. It consumes the heuristic-scored event features and outputs ML-based BUY/MAYBE/SKIP classifications with probability scores.

```
┌─────────┐     ┌──────────────┐     ┌──────────────────┐
│ Frontend │────▶│ Node Backend │────▶│ Python Reranker  │
│ (React)  │◀────│ (Express)    │◀────│ (FastAPI)        │
└─────────┘     └──────────────┘     └──────────────────┘
                        │                      │
                  Heuristic scorer        ML model (GBM)
                  (scorer.ts)            (scikit-learn)
```

## Data Flow

1. Frontend calls `POST /api/scan` with a city
2. Backend fetches events from Kide.app API
3. Backend scores with heuristic scorer (`scorer.ts`)
4. Backend sends scored events to Python reranker (`POST /scoreEvents`)
5. Reranker runs feature engineering + model inference
6. Backend enriches events with `ai_score` field
7. Backend re-sorts events by AI label/probability
8. Frontend displays events grouped by AI classification

## Files Created/Modified

### New: `ai-reranker/` directory (Python microservice)
| File | Purpose |
|---|---|
| `feature_engineering.py` | Shared feature transforms (25 features) |
| `train.py` | Training script with cross-validation |
| `serve.py` | FastAPI inference server |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Container build for deployment |
| `data/sample_labelled_events.csv` | Example training data (20 rows) |
| `README.md` | Service documentation |

### New: `backend/src/ai-reranker.ts`
HTTP client that calls the Python service. Graceful fallback — if the service is down, events keep heuristic scores only.

### Modified: `backend/src/types.ts`
Added `AiScore` type with `label`, `buy_probability`, `maybe_probability`, `skip_probability`, `model_version`. Added `ai_score?: AiScore` to `ScoredEvent` and `TopEvent`.

### Modified: `backend/src/routes/scan.ts`
After heuristic scoring, calls `rerankEvents()` which:
- Sends events to Python service in batch
- Attaches AI scores
- Re-sorts by AI label group, then buy_probability
- Rebuilds top 10 from reranked order
- Falls back gracefully if service unavailable

### Modified: `frontend/src/lib/kide/types.ts`
Mirrors backend `AiScore` type. Added to `ScoredEvent` and `TopEvent`.

### Modified: `frontend/src/App.tsx`
- Added `effectiveLabel()` helper: uses AI label if available, heuristic otherwise
- Added `AiBadge` component: shows "🤖 BUY (87%)" inline
- Added "AI Grouped" view tab: events grouped into BUY/MAYBE/SKIP sections
- Expanded breakdown shows AI probability bars (BUY/MAYBE/SKIP)
- All views now show AI badge alongside heuristic score
- Graceful degradation when `ai_score` is undefined

### Modified: `frontend/src/App.css`
AI badge styles, group headers, probability bars.

### Modified: `frontend/src/lib/translations.ts`
EN + FI strings for AI view, labels, confidence, model version.

## Environment Variables

| Variable | Default | Where | Description |
|---|---|---|---|
| `AI_RERANKER_URL` | `http://localhost:8100` | Backend | URL of the Python reranker service |
| `PORT` | `8100` | Reranker | Port for the FastAPI server |
| `MODEL_DIR` | `models/` | Reranker | Directory containing trained model files |

## Deployment Checklist

### Local Development
```bash
# 1. Train the model
cd ai-reranker
pip install -r requirements.txt
python train.py --data data/sample_labelled_events.csv

# 2. Start the reranker
python serve.py  # runs on :8100

# 3. Start the backend (separate terminal)
cd ../backend
npm install
AI_RERANKER_URL=http://localhost:8100 npm run dev

# 4. Start the frontend (separate terminal)
cd ../frontend
npm install
npm run dev
```

### Railway / Production
1. Deploy Python reranker as a separate Railway service
2. Set `AI_RERANKER_URL` env var on the backend to point to the reranker service URL
3. Include trained model files in the Docker image (or mount as volume)

### Docker Compose (optional)
```yaml
services:
  reranker:
    build: ./ai-reranker
    ports: ["8100:8100"]
    volumes:
      - ./ai-reranker/models:/app/models

  backend:
    build: ./backend
    ports: ["3000:3000"]
    environment:
      - AI_RERANKER_URL=http://reranker:8100
    depends_on: [reranker]
```

## Iterative Improvement Strategy

### Phase 1: Bootstrap (current)
- Train on 20 sample events (provided)
- Model will overfit — that's OK for testing the pipeline
- Focus: verify end-to-end flow works

### Phase 2: Data Collection
- Add a "feedback" button in the UI: 👍/👎 for each AI classification
- Log feedback to a CSV/database
- Periodically export and retrain

### Phase 3: Feature Expansion
- Add organiser historical sellout rate (scrape from past events)
- Add time-series features (price changes over time)
- Add social media signals

### Phase 4: Model Upgrade
- Try LightGBM or XGBoost for better performance
- Experiment with calibrated classifiers for better probabilities
- A/B test AI vs heuristic-only scoring

## Model Details

- **Algorithm**: `GradientBoostingClassifier` (scikit-learn)
- **Classes**: BUY (0), MAYBE (1), SKIP (2)
- **Features**: 25 (see `feature_engineering.py` for full list)
- **Hyperparameters**: 200 estimators, max_depth=4, lr=0.1, subsample=0.8
- **Evaluation**: Stratified k-fold cross-validation
- **Serialisation**: joblib (model_latest.joblib)
