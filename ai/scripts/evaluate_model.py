#!/usr/bin/env python3
"""Evaluate LeakGuard's local secret classifier on held-out JSONL files."""

from __future__ import annotations

import joblib
from sklearn.metrics import classification_report, confusion_matrix

from features import load_records_from_dirs, repo_root, transform_texts


ROOT = repo_root()
DATASET_ROOT = ROOT / "dataset"
MODEL_PATH = ROOT / "models" / "leakguard_secret_classifier.joblib"


def main() -> None:
    if not MODEL_PATH.exists():
        raise SystemExit("Model not found. Run python scripts/train_classifier.py first.")

    records = load_records_from_dirs([DATASET_ROOT / "test"])
    if not records:
        raise SystemExit("No held-out test records found in ai/dataset/test/*.jsonl.")

    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    vectorizer = bundle["vectorizer"]

    texts = [str(record.get("text", "")) for record in records]
    labels = [str(record.get("label", "")).upper() for record in records]
    features = transform_texts(texts, vectorizer)
    predictions = model.predict(features)

    print(classification_report(labels, predictions, labels=["SECRET", "NOT_SECRET", "UNSURE"]))
    print("Confusion matrix labels: SECRET, NOT_SECRET, UNSURE")
    print(confusion_matrix(labels, predictions, labels=["SECRET", "NOT_SECRET", "UNSURE"]))


if __name__ == "__main__":
    main()

