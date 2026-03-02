"""
FastAPI inference server for the Kide event reranker model.

Endpoints:
    POST /scoreEvent   — Score a single event
    POST /scoreEvents  — Score a batch of events
    POST /retrain      — Fetch latest training data and retrain model
    GET  /health       — Health check + model version

Expects the model to be pre-trained via train.py and saved as
models/model_latest.joblib.
"""

import asyncio
import json
import os
import subprocess
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiohttp
import joblib
import numpy as np
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from feature_engineering import FEATURE_NAMES, compute_features

# ─── Config ──────────────────────────────────────────────────────────────────

MODEL_DIR = os.environ.get("MODEL_DIR", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "model_latest.joblib")
META_PATH = os.path.join(MODEL_DIR, "model_latest_meta.json")
PORT = int(os.environ.get("PORT", "8100"))

# Backend URL for fetching training CSV (self-training pipeline)
BACKEND_URL = os.environ.get("AI_RERANKER_BACKEND_URL", "http://localhost:3000")
MIN_SAMPLES_FOR_RETRAIN = int(os.environ.get("MIN_SAMPLES_FOR_RETRAIN", "50"))

# Internal API key for service-to-service auth with the backend
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")

LABEL_NAMES = ["BUY", "MAYBE", "SKIP"]

# ─── App ─────────────────────────────────────────────────────────────────────

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup: load model + start cron
    try:
        get_model()
        print(f"Model loaded: version={_model_version}")
    except HTTPException:
        print(f"WARNING: No model found at {MODEL_PATH}. "
              "Requests will fail until a model is available.")

    # Weekly auto-retrain: every Sunday at 03:00 UTC
    scheduler.add_job(
        auto_retrain_job,
        CronTrigger(day_of_week="sun", hour=3, minute=0),
        id="weekly_retrain",
        replace_existing=True,
    )
    scheduler.start()
    print("[scheduler] Weekly auto-retrain cron started (Sun 03:00 UTC)")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Kide Reranker",
    description="ML reranking service for Kidehiiri event scoring",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Model loading ──────────────────────────────────────────────────────────

_model = None
_model_version = "unknown"


def get_model():
    """Lazy-load the model on first request."""
    global _model, _model_version

    if _model is not None:
        return _model

    if not Path(MODEL_PATH).exists():
        raise HTTPException(
            status_code=503,
            detail=f"Model not found at {MODEL_PATH}. Run train.py first.",
        )

    _model = joblib.load(MODEL_PATH)

    if Path(META_PATH).exists():
        with open(META_PATH) as f:
            meta = json.load(f)
            _model_version = meta.get("version", "unknown")

    return _model




# ─── Request / Response schemas ──────────────────────────────────────────────

class EventInput(BaseModel):
    """A single event for scoring. Accepts any fields from ScoredEvent."""
    # Allow arbitrary extra fields from the event JSON
    model_config = {"extra": "allow"}

    # Core identifiers (optional — not used by model but passed through)
    id: str | None = None
    name: str | None = None

    # The model uses these via compute_features()
    likes_total: float | None = None
    base_price_eur: float | None = None
    max_price_eur: float | None = None
    availability_pct: float | None = None
    hours_since_published: float | None = None
    start_time: str | None = None
    sales_start_time: str | None = None
    sales_status: str | None = None
    organiser: str | None = None
    organiser_id: str | None = None
    resell_score: float | None = None
    feature_breakdown: dict[str, float] | None = None


class AiScoreResponse(BaseModel):
    """ML model output for a single event."""
    label: str  # BUY | MAYBE | SKIP
    buy_probability: float
    maybe_probability: float
    skip_probability: float
    model_version: str


class BatchRequest(BaseModel):
    events: list[EventInput]


class BatchResponse(BaseModel):
    scores: list[AiScoreResponse]
    model_version: str


# ─── Scoring logic ───────────────────────────────────────────────────────────

def score_event(event_dict: dict[str, Any]) -> AiScoreResponse:
    """Run a single event through feature engineering + model inference."""
    model = get_model()

    features = compute_features(event_dict)
    X = np.array([features], dtype=np.float64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    probas = model.predict_proba(X)[0]  # [p_BUY, p_MAYBE, p_SKIP]
    predicted_class = int(np.argmax(probas))

    return AiScoreResponse(
        label=LABEL_NAMES[predicted_class],
        buy_probability=round(float(probas[0]), 4),
        maybe_probability=round(float(probas[1]), 4),
        skip_probability=round(float(probas[2]), 4),
        model_version=_model_version,
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.post("/scoreEvent", response_model=AiScoreResponse)
async def score_single(event: EventInput):
    """Score a single event and return AI classification."""
    return score_event(event.model_dump())


@app.post("/scoreEvents", response_model=BatchResponse)
async def score_batch(req: BatchRequest):
    """Score a batch of events. More efficient than calling /scoreEvent N times."""
    model = get_model()

    if not req.events:
        return BatchResponse(scores=[], model_version=_model_version)

    # Vectorised scoring for efficiency
    rows = []
    for ev in req.events:
        features = compute_features(ev.model_dump())
        rows.append(features)

    X = np.array(rows, dtype=np.float64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    all_probas = model.predict_proba(X)  # shape: (N, 3)

    scores: list[AiScoreResponse] = []
    for probas in all_probas:
        predicted_class = int(np.argmax(probas))
        scores.append(AiScoreResponse(
            label=LABEL_NAMES[predicted_class],
            buy_probability=round(float(probas[0]), 4),
            maybe_probability=round(float(probas[1]), 4),
            skip_probability=round(float(probas[2]), 4),
            model_version=_model_version,
        ))

    return BatchResponse(scores=scores, model_version=_model_version)


@app.get("/health")
async def health():
    """Health check — also tells callers if model is loaded."""
    model_loaded = _model is not None
    return {
        "status": "ok" if model_loaded else "no_model",
        "model_version": _model_version if model_loaded else None,
        "n_features": len(FEATURE_NAMES),
    }


# ─── Retrain logic ───────────────────────────────────────────────────────────

_retrain_lock = asyncio.Lock()
_last_retrain: str | None = None


async def fetch_training_csv() -> str | None:
    """Fetch the training CSV from the backend's export endpoint."""
    url = f"{BACKEND_URL}/api/admin/export-csv"
    headers = {}
    if INTERNAL_API_KEY:
        headers["X-Internal-Api-Key"] = INTERNAL_API_KEY
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 404:
                    print("[retrain] No training data available yet")
                    return None
                if resp.status != 200:
                    print(f"[retrain] Backend returned {resp.status}")
                    return None
                csv_text = await resp.text()
                if not csv_text.strip():
                    return None
                return csv_text
    except Exception as e:
        print(f"[retrain] Failed to fetch CSV: {e}")
        return None


async def check_min_samples() -> bool:
    """Check if the backend has enough new labels to justify retraining."""
    url = f"{BACKEND_URL}/api/admin/stats"
    headers = {}
    if INTERNAL_API_KEY:
        headers["X-Internal-Api-Key"] = INTERNAL_API_KEY
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return False
                data = await resp.json()
                new_labels = data.get("labels", {}).get("new_since_last_train", 0)
                total_labels = data.get("labels", {}).get("total", 0)
                print(f"[retrain] Labels: {total_labels} total, {new_labels} new since last train")
                return total_labels >= MIN_SAMPLES_FOR_RETRAIN
    except Exception as e:
        print(f"[retrain] Failed to check stats: {e}")
        return False


async def mark_labels_used() -> None:
    """Tell the backend to mark all training labels as used after successful retrain."""
    url = f"{BACKEND_URL}/api/admin/mark-labels-used"
    headers = {}
    if INTERNAL_API_KEY:
        headers["X-Internal-Api-Key"] = INTERNAL_API_KEY
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    print("[retrain] Labels marked as used in training")
                else:
                    print(f"[retrain] Failed to mark labels used: HTTP {resp.status}")
    except Exception as e:
        print(f"[retrain] Failed to mark labels used: {e}")


def run_training(csv_path: str) -> bool:
    """Run train.py as a subprocess with the given CSV data."""
    try:
        result = subprocess.run(
            ["python", "train.py", "--data", csv_path, "--out", MODEL_DIR],
            capture_output=True,
            text=True,
            timeout=300,  # 5 min max
        )
        print("[retrain] train.py stdout:")
        for line in result.stdout.strip().split("\n"):
            print(f"  {line}")
        if result.returncode != 0:
            print(f"[retrain] train.py failed (exit {result.returncode}):")
            for line in result.stderr.strip().split("\n"):
                print(f"  {line}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print("[retrain] train.py timed out (5 min)")
        return False
    except Exception as e:
        print(f"[retrain] train.py error: {e}")
        return False


def reload_model() -> None:
    """Hot-reload the model from disk after retraining."""
    global _model, _model_version
    _model = None  # Force re-load on next request
    try:
        get_model()
        print(f"[retrain] Model hot-reloaded: version={_model_version}")
    except HTTPException:
        print("[retrain] WARNING: Could not reload model after training")


async def do_retrain(force: bool = False) -> dict:
    """Execute the full retrain pipeline."""
    global _last_retrain

    if _retrain_lock.locked():
        return {"success": False, "error": "Retrain already in progress"}

    async with _retrain_lock:
        # Check if we have enough samples (unless forced)
        if not force:
            has_enough = await check_min_samples()
            if not has_enough:
                return {
                    "success": False,
                    "error": f"Not enough training data (minimum: {MIN_SAMPLES_FOR_RETRAIN})",
                }

        # Fetch CSV
        csv_text = await fetch_training_csv()
        if not csv_text:
            return {"success": False, "error": "No training data available"}

        # Count rows
        lines = csv_text.strip().split("\n")
        n_rows = len(lines) - 1  # minus header
        print(f"[retrain] Got {n_rows} training rows")

        if n_rows < 3:
            return {"success": False, "error": f"Too few rows ({n_rows}), need at least 3"}

        # Write to temp file and train
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, dir=MODEL_DIR
        ) as f:
            f.write(csv_text)
            tmp_path = f.name

        try:
            success = run_training(tmp_path)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        if not success:
            return {"success": False, "error": "Training subprocess failed"}

        # Hot-reload the new model
        reload_model()

        # Tell the backend to mark labels as used in training
        await mark_labels_used()

        _last_retrain = datetime.now(timezone.utc).isoformat()

        return {
            "success": True,
            "training_rows": n_rows,
            "model_version": _model_version,
            "retrained_at": _last_retrain,
        }


async def auto_retrain_job():
    """Scheduled job: auto-retrain if enough new labels exist."""
    print("[scheduler] Running auto-retrain check...")
    result = await do_retrain(force=False)
    if result.get("success"):
        print(f"[scheduler] Auto-retrain complete: {result}")
    else:
        print(f"[scheduler] Auto-retrain skipped: {result.get('error')}")


@app.post("/retrain")
async def retrain_endpoint(force: bool = False):
    """
    Trigger model retraining.
    Fetches training CSV from the backend, runs train.py, and hot-reloads.

    Query params:
        force=true — skip minimum sample check
    """
    result = await do_retrain(force=force)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Retrain failed"))

    return result


# ─── Entrypoint ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    print(f"Starting Kide Reranker on port {PORT}...")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
