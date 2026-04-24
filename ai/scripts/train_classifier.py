#!/usr/bin/env python3
"""Train LeakGuard's small local secret classifier."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

from features import feature_spec, fit_vectorizer, load_records_from_dirs, repo_root, transform_texts, write_json


ROOT = repo_root()
DATASET_ROOT = ROOT / "dataset"
MODEL_ROOT = ROOT / "models"
MODEL_PATH = MODEL_ROOT / "leakguard_secret_classifier.joblib"
SPEC_PATH = MODEL_ROOT / "leakguard_secret_classifier.features.json"


def load_training_records() -> list[dict]:
    records = load_records_from_dirs([DATASET_ROOT / "generated", DATASET_ROOT / "labeled"])
    normalized = []
    for record in records:
        text = str(record.get("text", "")).strip()
        label = str(record.get("label", "")).strip().upper()
        if not text or label not in {"SECRET", "NOT_SECRET", "UNSURE"}:
            continue
        normalized.append({"text": text, "label": label})
    if not normalized:
        raise SystemExit("No training records found. Run python scripts/generate_dataset.py first.")
    return normalized


def main() -> None:
    records = load_training_records()
    texts = [record["text"] for record in records]
    labels = [record["label"] for record in records]

    stratify = labels if len(set(labels)) > 1 else None
    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts,
        labels,
        test_size=0.25,
        random_state=20260424,
        stratify=stratify,
    )

    vectorizer = fit_vectorizer(train_texts)
    train_x = transform_texts(train_texts, vectorizer)
    test_x = transform_texts(test_texts, vectorizer)

    model = LogisticRegression(max_iter=1000, class_weight="balanced", solver="lbfgs")
    model.fit(train_x, train_labels)

    predictions = model.predict(test_x)
    print(classification_report(test_labels, predictions, labels=["SECRET", "NOT_SECRET", "UNSURE"]))

    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "vectorizer": vectorizer,
            "feature_spec": feature_spec(vectorizer),
            "labels": list(model.classes_),
        },
        MODEL_PATH,
    )
    write_json(SPEC_PATH, feature_spec(vectorizer))

    metadata_path = MODEL_ROOT / "leakguard_secret_classifier.training.json"
    metadata_path.write_text(
        json.dumps(
            {
                "training_records": len(train_texts),
                "validation_records": len(test_texts),
                "labels": list(model.classes_),
                "n_features": int(train_x.shape[1]),
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Saved model to {MODEL_PATH}")
    print(f"Saved feature spec to {SPEC_PATH}")


if __name__ == "__main__":
    main()
