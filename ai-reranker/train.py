"""
Train a GradientBoosting classifier on labelled Kide.app event data.

Usage:
    python train.py [--data data/labelled_events.csv] [--out models/]

The labelled CSV must have columns matching the raw event fields consumed by
feature_engineering.compute_features(), plus a `label` column with values:
    BUY | MAYBE | SKIP

The script:
  1. Reads the CSV
  2. Transforms each row into the feature vector
  3. Trains a GradientBoostingClassifier (3-class)
  4. Evaluates with stratified k-fold cross-validation
  5. Saves the model + metadata to disk (joblib)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_predict

# Local
from feature_engineering import FEATURE_NAMES, compute_features

LABEL_MAP = {"BUY": 0, "MAYBE": 1, "SKIP": 2}
LABEL_NAMES = ["BUY", "MAYBE", "SKIP"]


def load_data(csv_path: str) -> tuple[np.ndarray, np.ndarray]:
    """Load CSV → feature matrix X and label vector y."""
    df = pd.read_csv(csv_path)

    if "label" not in df.columns:
        print("ERROR: CSV must have a 'label' column with BUY/MAYBE/SKIP values.")
        sys.exit(1)

    # Normalise labels
    df["label"] = df["label"].str.strip().str.upper()
    unknown = set(df["label"].unique()) - set(LABEL_MAP.keys())
    if unknown:
        print(f"WARNING: Unknown labels will be dropped: {unknown}")
        df = df[df["label"].isin(LABEL_MAP.keys())]

    print(f"Loaded {len(df)} labelled events from {csv_path}")
    print(f"  Label distribution: {df['label'].value_counts().to_dict()}")

    X_rows: list[list[float]] = []
    for _, row in df.iterrows():
        X_rows.append(compute_features(row.to_dict()))

    X = np.array(X_rows, dtype=np.float64)
    y = np.array([LABEL_MAP[lbl] for lbl in df["label"]], dtype=np.int32)

    # Replace any remaining NaN/inf
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    return X, y


def train(X: np.ndarray, y: np.ndarray) -> GradientBoostingClassifier:
    """Train and evaluate a GradientBoostingClassifier."""
    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        min_samples_leaf=5,
        random_state=42,
    )

    # Cross-validation evaluation
    n_splits = min(5, min(np.bincount(y)))
    if n_splits >= 2:
        print(f"\nRunning {n_splits}-fold stratified cross-validation...")
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        y_pred_cv = cross_val_predict(model, X, y, cv=cv)
        print("\nCross-validation Classification Report:")
        print(classification_report(y, y_pred_cv, target_names=LABEL_NAMES))
        print("Confusion Matrix:")
        print(confusion_matrix(y, y_pred_cv))
    else:
        print(f"\nSkipping cross-validation (not enough samples per class, min={n_splits})")

    # Train on full dataset for deployment
    print("\nTraining final model on all data...")
    model.fit(X, y)

    # Feature importance
    importances = model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    print("\nTop 10 feature importances:")
    for i, idx in enumerate(sorted_idx[:10]):
        print(f"  {i+1}. {FEATURE_NAMES[idx]:30s} {importances[idx]:.4f}")

    return model


def save_model(model: GradientBoostingClassifier, out_dir: str) -> str:
    """Save model + metadata to out_dir/."""
    os.makedirs(out_dir, exist_ok=True)

    version = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    model_path = os.path.join(out_dir, f"model_{version}.joblib")
    meta_path = os.path.join(out_dir, f"model_{version}_meta.json")
    # Also save as "latest" for easy loading
    latest_model = os.path.join(out_dir, "model_latest.joblib")
    latest_meta = os.path.join(out_dir, "model_latest_meta.json")

    joblib.dump(model, model_path)
    joblib.dump(model, latest_model)

    meta = {
        "version": version,
        "n_estimators": model.n_estimators,
        "max_depth": model.max_depth,
        "learning_rate": model.learning_rate,
        "n_features": len(FEATURE_NAMES),
        "feature_names": FEATURE_NAMES,
        "label_names": LABEL_NAMES,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    for path in (meta_path, latest_meta):
        with open(path, "w") as f:
            json.dump(meta, f, indent=2)

    print(f"\nModel saved to: {model_path}")
    print(f"Metadata saved to: {meta_path}")
    print(f"Latest symlinks updated.")

    return version


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Kide event reranker model")
    parser.add_argument("--data", default="data/labelled_events.csv", help="Path to labelled CSV")
    parser.add_argument("--out", default="models/", help="Output directory for model files")
    args = parser.parse_args()

    if not Path(args.data).exists():
        print(f"ERROR: Data file not found: {args.data}")
        print("Create a labelled CSV with columns matching event features + a 'label' column.")
        print("See data/sample_labelled_events.csv for the expected format.")
        sys.exit(1)

    X, y = load_data(args.data)
    model = train(X, y)
    save_model(model, args.out)
    print("\nDone! Start the inference server with: python serve.py")


if __name__ == "__main__":
    main()
