# Kide Reranker — AI/ML scoring service

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Train the model on sample data
python train.py --data data/sample_labelled_events.csv

# Start the inference server
python serve.py
```

The server runs on `http://localhost:8100` by default (override with `PORT` env var).

## Endpoints

### POST /scoreEvent
Score a single event.

```json
{
  "likes_total": 523,
  "base_price_eur": 25.0,
  "availability_pct": 12.0,
  "sales_status": "selling_fast",
  "organiser": "Osakunta Ry",
  "resell_score": 82.0,
  "feature_breakdown": {
    "popularity": 90,
    "demand": 85,
    "pricing": 70,
    "timing": 80,
    "organiser": 75
  }
}
```

Response:
```json
{
  "label": "BUY",
  "buy_probability": 0.87,
  "maybe_probability": 0.10,
  "skip_probability": 0.03,
  "model_version": "20250101_120000"
}
```

### POST /scoreEvents
Score a batch of events at once (more efficient).

```json
{
  "events": [
    { "likes_total": 523, "base_price_eur": 25.0, ... },
    { "likes_total": 15, "base_price_eur": 5.0, ... }
  ]
}
```

### GET /health
Check if the model is loaded.

## Docker

```bash
docker build -t kide-reranker .
docker run -p 8100:8100 kide-reranker
```

## Retraining

1. Collect/label more events in a CSV matching `data/sample_labelled_events.csv` format
2. Run `python train.py --data your_data.csv`
3. Restart the server (it loads `models/model_latest.joblib` on startup)

## Features Used

The model consumes 25 features derived from Kide event data:
- Raw metrics: likes, prices, availability, publish age
- Derived: log transforms, sold percentage, velocity, time-to-event
- Heuristic sub-scores from the existing scorer engine
- Binary indicators: sales status flags, organiser presence, pricing flags
