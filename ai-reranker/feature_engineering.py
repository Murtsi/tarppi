"""
Shared feature engineering for training and inference.

Transforms raw Kidehiiri event features into the numeric feature vector
consumed by the GradientBoosting model. All transforms are deterministic
and handle missing/null values gracefully.
"""

import math
from typing import Any

# ─── Feature list (order matters — must match training and inference) ────────

FEATURE_NAMES = [
    # Raw numeric (from Kide API listing)
    "likes_total",
    "base_price_eur",
    "max_price_eur",
    "availability_pct",
    "hours_since_published",
    # Derived
    "log_likes",
    "log_price",
    "price_spread_eur",
    "sold_pct",
    "likes_per_hour",
    "days_until_event",
    "hours_until_sales",
    # Heuristic sub-scores (from existing scorer)
    "heuristic_popularity",
    "heuristic_demand",
    "heuristic_pricing",
    "heuristic_timing",
    "heuristic_organiser",
    "heuristic_total",
    # Binary indicators
    "is_upcoming",
    "is_on_sale",
    "is_selling_fast",
    "is_almost_sold_out",
    "has_organiser",
    "has_price",
    "is_free",
]


def safe_float(val: Any, default: float = 0.0) -> float:
    """Convert a value to float, returning default for None/NaN."""
    if val is None:
        return default
    try:
        f = float(val)
        return default if math.isnan(f) else f
    except (TypeError, ValueError):
        return default


def safe_log(val: float) -> float:
    """log(1 + val) for non-negative values, 0 otherwise."""
    return math.log1p(max(0.0, val))


def compute_features(event: dict[str, Any]) -> list[float]:
    """
    Transform a single event dict into a flat feature vector.

    Accepts the JSON shape returned by the /api/scan endpoint's ScoredEvent,
    or a training CSV row as a dict.
    """
    # ── Raw values ───────────────────────────────────────────────────────
    likes = safe_float(event.get("likes_total"))
    base_price = safe_float(event.get("base_price_eur"))
    max_price = safe_float(event.get("max_price_eur"), base_price)
    availability = safe_float(event.get("availability_pct"), 100.0)
    hours_published = safe_float(event.get("hours_since_published"))

    # ── Derived ──────────────────────────────────────────────────────────
    log_likes = safe_log(likes)
    log_price = safe_log(base_price)
    price_spread = max(0.0, max_price - base_price)
    sold_pct = max(0.0, 100.0 - availability)
    likes_per_hour = (likes / max(1.0, hours_published)) if hours_published > 0 else 0.0

    # Days until event start
    days_until_event = -1.0  # sentinel: unknown
    start_time = event.get("start_time")
    if start_time:
        try:
            from datetime import datetime, timezone

            if isinstance(start_time, str):
                # Handle ISO format with various timezone suffixes
                st = start_time.replace("Z", "+00:00")
                dt = datetime.fromisoformat(st)
            else:
                dt = start_time
            now = datetime.now(timezone.utc)
            if dt.tzinfo is None:
                from datetime import timezone as tz
                dt = dt.replace(tzinfo=tz.utc)
            days_until_event = (dt - now).total_seconds() / 86400.0
        except Exception:
            pass

    # Hours until sales start
    hours_until_sales = -1.0
    sales_start = event.get("sales_start_time")
    if sales_start:
        try:
            from datetime import datetime, timezone

            if isinstance(sales_start, str):
                ss = sales_start.replace("Z", "+00:00")
                dt_sales = datetime.fromisoformat(ss)
            else:
                dt_sales = sales_start
            now = datetime.now(timezone.utc)
            if dt_sales.tzinfo is None:
                from datetime import timezone as tz
                dt_sales = dt_sales.replace(tzinfo=tz.utc)
            hours_until_sales = (dt_sales - now).total_seconds() / 3600.0
        except Exception:
            pass

    # ── Heuristic sub-scores (from scorer breakdown) ────────────────────
    breakdown = event.get("feature_breakdown", {})
    h_popularity = safe_float(breakdown.get("popularity") if isinstance(breakdown, dict) else event.get("heuristic_popularity"))
    h_demand = safe_float(breakdown.get("demand") if isinstance(breakdown, dict) else event.get("heuristic_demand"))
    h_pricing = safe_float(breakdown.get("pricing") if isinstance(breakdown, dict) else event.get("heuristic_pricing"))
    h_timing = safe_float(breakdown.get("timing") if isinstance(breakdown, dict) else event.get("heuristic_timing"))
    h_organiser = safe_float(breakdown.get("organiser") if isinstance(breakdown, dict) else event.get("heuristic_organiser"))
    h_total = safe_float(event.get("resell_score", event.get("heuristic_total")))

    # ── Binary indicators ───────────────────────────────────────────────
    sales_status = str(event.get("sales_status", "")).lower()
    is_upcoming = 1.0 if sales_status == "upcoming" else 0.0
    is_on_sale = 1.0 if sales_status == "on_sale" else 0.0
    is_selling_fast = 1.0 if sales_status in ("selling_fast", "almost_sold_out") else 0.0
    is_almost_sold_out = 1.0 if sales_status == "almost_sold_out" else 0.0
    has_organiser = 1.0 if event.get("organiser") or event.get("organiser_id") else 0.0
    has_price = 1.0 if base_price > 0 else 0.0
    is_free = 1.0 if base_price == 0 and has_price == 0 else 0.0

    return [
        likes,
        base_price,
        max_price,
        availability,
        hours_published,
        log_likes,
        log_price,
        price_spread,
        sold_pct,
        likes_per_hour,
        days_until_event,
        hours_until_sales,
        h_popularity,
        h_demand,
        h_pricing,
        h_timing,
        h_organiser,
        h_total,
        is_upcoming,
        is_on_sale,
        is_selling_fast,
        is_almost_sold_out,
        has_organiser,
        has_price,
        is_free,
    ]
