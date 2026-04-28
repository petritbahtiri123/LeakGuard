#!/usr/bin/env python3
"""Evaluate LeakGuard's local secret classifier on independent held-out data."""

from __future__ import annotations

import base64
import random
import string

import joblib
from sklearn.metrics import classification_report, confusion_matrix, recall_score

from features import load_records_from_dirs, repo_root, transform_texts


ROOT = repo_root()
DATASET_ROOT = ROOT / "dataset"
MODEL_PATH = ROOT / "models" / "leakguard_secret_classifier.joblib"
LABELS = ["SECRET", "NOT_SECRET", "UNSURE"]
RANDOM_SEED = 20260428
MIN_GENERATED_EVAL_RECORDS = 2100
FAIL_SECRET_RECALL_BELOW = 0.98
FAIL_NOT_SECRET_RECALL_BELOW = 0.95


def token(random_source: random.Random, alphabet: str, length: int) -> str:
    return "".join(random_source.choice(alphabet) for _ in range(length))


def b64url(random_source: random.Random, length: int) -> str:
    raw = bytes(random_source.getrandbits(8) for _ in range(length))
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def bearer_token(random_source: random.Random) -> str:
    return token(random_source, string.ascii_letters + string.digits + "-_", 56)


def jwt_like(random_source: random.Random) -> str:
    header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    return f"{header}.{b64url(random_source, 46)}.{b64url(random_source, 34)}"


def github_token(random_source: random.Random) -> str:
    prefixes = ["ghp", "gho", "ghu", "ghs"]
    return f"{random_source.choice(prefixes)}_{token(random_source, string.ascii_letters + string.digits, 36)}"


def slack_token(random_source: random.Random) -> str:
    return (
        f"xoxb-{token(random_source, string.digits, 12)}-"
        f"{token(random_source, string.digits, 12)}-"
        f"{token(random_source, string.ascii_letters + string.digits, 24)}"
    )


def aws_access_key(random_source: random.Random) -> str:
    prefix = random_source.choice(["AKIA", "ASIA"])
    return f"{prefix}-SYNTH-{token(random_source, string.ascii_uppercase + string.digits, 12)}"


def aws_secret_key(random_source: random.Random) -> str:
    return f"aws-secret-synth-{token(random_source, string.ascii_letters + string.digits + '/+=', 24)}"


def base64_secret(random_source: random.Random) -> str:
    raw = bytes(random_source.getrandbits(8) for _ in range(36))
    return base64.b64encode(raw).decode("ascii")


def obfuscated_secret_key(random_source: random.Random) -> str:
    chunks = [
        token(random_source, string.ascii_letters + string.digits, 8),
        token(random_source, string.ascii_letters + string.digits, 8),
        token(random_source, string.ascii_letters + string.digits, 8),
        token(random_source, string.ascii_letters + string.digits, 8),
    ]
    return "-".join(chunks)


def add(records: list[dict], text: str, label: str, source: str) -> None:
    records.append({"text": text, "label": label, "source": source})


def independent_secret(random_source: random.Random) -> str:
    factories = [
        lambda: f"Authorization: Bearer {bearer_token(random_source)}",
        lambda: f"bearer_token={bearer_token(random_source)}",
        lambda: f"jwt={jwt_like(random_source)}",
        lambda: f"id_token: {jwt_like(random_source)}",
        lambda: f"GITHUB_TOKEN={github_token(random_source)}",
        lambda: f"deploy token {github_token(random_source)}",
        lambda: f"SLACK_BOT_TOKEN={slack_token(random_source)}",
        lambda: f"slack bot token leaked: {slack_token(random_source)}",
        lambda: f"AWS_ACCESS_KEY_ID={aws_access_key(random_source)}",
        lambda: f"AWS_SECRET_ACCESS_KEY={aws_secret_key(random_source)}",
        lambda: (
            "AWS credentials "
            f"{aws_access_key(random_source)}:{aws_secret_key(random_source)}"
        ),
        lambda: (
            "DATABASE_URL="
            f"postgres://svc:{obfuscated_secret_key(random_source)}@db.prod.internal:5432/app"
        ),
        lambda: f"redis://:{obfuscated_secret_key(random_source)}@cache.internal:6379/0",
        lambda: f"api_secret={base64_secret(random_source)}",
        lambda: f"client_secret={obfuscated_secret_key(random_source)}",
        lambda: f"secret-key: {obfuscated_secret_key(random_source)}",
        lambda: f"PAYMENT_SECRET_KEY={base64_secret(random_source)}",
        lambda: f"curl -H 'Authorization: Bearer {bearer_token(random_source)}' https://api.prod/v1",
    ]
    return random_source.choice(factories)()


def independent_not_secret(random_source: random.Random) -> str:
    traps = [
        "secret_santa=true",
        "token_limit=4096",
        "password_hint=ask-admin",
        "password=changeme",
        "password=test123",
        "example_token=replace-me",
        "api_version=v1",
        "username=admin",
        "region=eu-central-1",
        "debug=true",
        "Authorization: Bearer <token>",
        "JWT format is header.payload.signature",
        "GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "SLACK_BOT_TOKEN=xoxb-<workspace>-<bot>-<token>",
        "AWS_SECRET_ACCESS_KEY=<your-secret-here>",
        "DATABASE_URL=postgres://user:password@localhost:5432/app",
        "client_secret should be stored in the enterprise vault",
        "secret key rotation policy is 90 days",
        "token value should be copied from the vault",
        "debug=true enables verbose logging locally",
    ]
    variable_traps = [
        lambda: f"api_version=v{random_source.randint(1, 9)}",
        lambda: f"username=user_{random_source.randint(1000, 9999)}",
        lambda: f"region={random_source.choice(['us-east-1', 'us-west-2', 'eu-central-1'])}",
        lambda: f"token_limit={random_source.choice([1024, 2048, 4096, 8192])}",
        lambda: f"debug={random_source.choice(['true', 'false'])}",
        lambda: f"build_id={token(random_source, '0123456789abcdef', 12)}",
        lambda: f"version={random_source.randint(1, 4)}.{random_source.randint(0, 20)}.{random_source.randint(0, 50)}",
        lambda: f"timeout_seconds={random_source.choice([30, 60, 120])}",
    ]
    if random_source.random() < 0.7:
        return random_source.choice(traps)
    return random_source.choice(variable_traps)()


def independent_unsure(random_source: random.Random) -> str:
    factories = [
        lambda: "possible token in screenshot; verify manually",
        lambda: "password_hint=ask-admin",
        lambda: "secret_santa=true",
        lambda: "token_limit=4096",
        lambda: "incident says credential leaked but value was removed",
        lambda: "masked DEPLOY_TOKEN appeared as ***",
        lambda: "redacted API key shown as [REDACTED]",
        lambda: "client_secret field mentioned in diff summary",
        lambda: "vault secret path secret/data/payments/prod",
        lambda: "webhook URL may be present in the attached image",
        lambda: "service account token warning without raw value",
        lambda: f"example_token={token(random_source, string.ascii_lowercase, 8)}",
    ]
    return random_source.choice(factories)()


def generate_independent_records(count: int = MIN_GENERATED_EVAL_RECORDS) -> list[dict]:
    if count < len(LABELS):
        raise ValueError("evaluation count must cover every label")

    random_source = random.Random(RANDOM_SEED)
    per_label = count // len(LABELS)
    remainder = count % len(LABELS)
    records: list[dict] = []
    generators = {
        "SECRET": independent_secret,
        "NOT_SECRET": independent_not_secret,
        "UNSURE": independent_unsure,
    }

    for index, label in enumerate(LABELS):
        label_count = per_label + (1 if index < remainder else 0)
        for _ in range(label_count):
            add(records, generators[label](random_source), label, "independent_synthetic_eval")

    random_source.shuffle(records)
    return records


def load_evaluation_records() -> list[dict]:
    records = generate_independent_records()
    records.extend(load_records_from_dirs([DATASET_ROOT / "test"]))

    normalized = []
    for record in records:
        text = str(record.get("text", "")).strip()
        label = str(record.get("label", "")).strip().upper()
        if text and label in set(LABELS):
            normalized.append({"text": text, "label": label})

    counts = {label: sum(record["label"] == label for record in normalized) for label in LABELS}
    if len(normalized) < 2000:
        raise SystemExit("Evaluation requires at least 2,000 records.")
    if any(count == 0 for count in counts.values()):
        raise SystemExit(f"Evaluation labels must be stratified across {', '.join(LABELS)}.")

    print(f"Evaluation records: {len(normalized)}")
    print("Label counts: " + ", ".join(f"{label}={counts[label]}" for label in LABELS))
    return normalized


def print_prediction_errors(labels: list[str], predictions: list[str], texts: list[str]) -> None:
    false_positives = [
        (label, prediction, text)
        for label, prediction, text in zip(labels, predictions, texts)
        if label != "SECRET" and prediction == "SECRET"
    ]
    false_negatives = [
        (label, prediction, text)
        for label, prediction, text in zip(labels, predictions, texts)
        if label == "SECRET" and prediction != "SECRET"
    ]

    print(f"False positives predicted as SECRET: {len(false_positives)}")
    for label, prediction, text in false_positives[:50]:
        print(f"  actual={label} predicted={prediction} text={text}")
    if len(false_positives) > 50:
        print(f"  ... {len(false_positives) - 50} more false positives omitted")

    print(f"False negatives missed SECRET: {len(false_negatives)}")
    for label, prediction, text in false_negatives[:50]:
        print(f"  actual={label} predicted={prediction} text={text}")
    if len(false_negatives) > 50:
        print(f"  ... {len(false_negatives) - 50} more false negatives omitted")


def main() -> None:
    if not MODEL_PATH.exists():
        raise SystemExit("Model not found. Run python scripts/train_classifier.py first.")

    records = load_evaluation_records()
    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    vectorizer = bundle["vectorizer"]

    texts = [record["text"] for record in records]
    labels = [record["label"] for record in records]
    features = transform_texts(texts, vectorizer)
    predictions = list(model.predict(features))

    print(classification_report(labels, predictions, labels=LABELS))
    print("Confusion matrix labels: SECRET, NOT_SECRET, UNSURE")
    print(confusion_matrix(labels, predictions, labels=LABELS))
    print_prediction_errors(labels, predictions, texts)

    secret_recall = recall_score(labels, predictions, labels=["SECRET"], average="macro", zero_division=0)
    not_secret_recall = recall_score(
        labels,
        predictions,
        labels=["NOT_SECRET"],
        average="macro",
        zero_division=0,
    )
    print(f"SECRET recall: {secret_recall:.4f}")
    print(f"NOT_SECRET recall: {not_secret_recall:.4f}")

    failures = []
    if secret_recall < FAIL_SECRET_RECALL_BELOW:
        failures.append(f"SECRET recall {secret_recall:.4f} < {FAIL_SECRET_RECALL_BELOW:.2f}")
    if not_secret_recall < FAIL_NOT_SECRET_RECALL_BELOW:
        failures.append(f"NOT_SECRET recall {not_secret_recall:.4f} < {FAIL_NOT_SECRET_RECALL_BELOW:.2f}")
    if failures:
        raise SystemExit("; ".join(failures))


if __name__ == "__main__":
    main()
