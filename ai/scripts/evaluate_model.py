#!/usr/bin/env python3
"""Evaluate LeakGuard's local secret classifier on independent held-out data."""

from __future__ import annotations

import base64
import random
import re
import string
from collections import defaultdict

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
FAIL_UNSURE_RECALL_BELOW = 0.80
FAIL_EMAIL_RECALL_BELOW = 0.99
FAIL_GRAY_ZONE_SECRET_RECALL_BELOW = 0.95
FAIL_NORMAL_TEXT_FP_RATE_ABOVE = 0.03
EMAIL_REGEX = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)


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


def medium_alnum(random_source: random.Random) -> str:
    return token(random_source, string.ascii_letters + string.digits, random_source.randint(10, 20))


def invalid_base64_like(random_source: random.Random) -> str:
    return f"{token(random_source, string.ascii_letters + string.digits + '+/', random_source.randint(18, 26))}==="


def borderline_entropy_value(random_source: random.Random) -> str:
    chunks = [
        token(random_source, string.ascii_lowercase, 4),
        token(random_source, string.digits, 4),
        token(random_source, string.ascii_uppercase, 3),
    ]
    random_source.shuffle(chunks)
    return "".join(chunks)


def add(
    records: list[dict],
    text: str,
    label: str,
    source: str,
    category: str | None = None,
    layer_hint: str | None = None,
    action: str | None = None,
    provider: str | None = None,
) -> None:
    record = {
        "text": text,
        "label": label,
        "source": source,
        "category": category or infer_category(text, label),
        "action": action or {"SECRET": "redact", "NOT_SECRET": "keep", "UNSURE": "warn"}[label],
    }
    if layer_hint:
        record["layer_hint"] = layer_hint
    if provider:
        record["provider"] = provider
    records.append(record)


def infer_category(text: str, label: str) -> str:
    normalized = str(text or "").lower()
    if EMAIL_REGEX.search(text):
        return "email"
    if any(word in normalized for word in ["username", "login", "samaccountname", "service_account", "principal"]):
        return "identity"
    if any(word in normalized for word in ["tenant_id", "subscription_id", "object_id", "principal_id", "aws_account_id"]):
        return "metadata_sensitive" if label == "SECRET" else "metadata_safe"
    if any(word in normalized for word in ["password", "secret", "token", "api_key", "client_secret"]):
        if label == "SECRET":
            return "credential_context"
        if label == "UNSURE":
            return "unknown_or_ambiguous"
    return "normal_text_safe" if label == "NOT_SECRET" else "secret"


def infer_source_type(record: dict) -> str:
    explicit = str(record.get("source_type") or "").strip()
    if explicit:
        return explicit
    source = str(record.get("source") or "").strip()
    if source == "independent_synthetic_eval":
        return "synthetic"
    return "heldout_synthetic"


def independent_secret(random_source: random.Random) -> str:
    factories = [
        lambda: "password=Welcome2026",
        lambda: "pwd=Qwerty123",
        lambda: "token=blue-team-prod",
        lambda: "client_secret=manual-rotation-needed",
        lambda: "username=svc-backup",
        lambda: "login=svc-prod-deploy",
        lambda: f"Contact eval.user{random_source.randint(100, 999)}@example.com for access.",
        lambda: "tenant_id used for production admin login: 72f988bf-86f1-41af-91ab-2d7cd011db47",
        lambda: "vault path for prod secrets: secret/data/prod/database",
        lambda: "admin portal: https://internal-admin.corp.local",
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
        "password policy requires rotation every 90 days",
        "temporary password process requires helpdesk approval",
        "example_token=replace-me",
        "api_version=v1",
        "display_name=admin",
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
        "Azure tenant_id is a UUID used to identify a directory.",
        "The architecture document references a subscription_id field.",
        "The example path is /docs/examples/config.",
        "Normal paragraph about incident response.",
        "Clean placeholder [PWM_1] should remain trusted.",
        "debug=true enables verbose logging locally",
    ]
    variable_traps = [
        lambda: f"api_version=v{random_source.randint(1, 9)}",
        lambda: f"display_name=user_{random_source.randint(1000, 9999)}",
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
        lambda: "incident says credential leaked but value was removed",
        lambda: "masked DEPLOY_TOKEN appeared as ***",
        lambda: "redacted API key shown as [REDACTED]",
        lambda: "client_secret field mentioned in diff summary",
        lambda: "vault secret path secret/data/payments/prod",
        lambda: "webhook URL may be present in the attached image",
        lambda: "service account token warning without raw value",
        lambda: "partially masked token sk-abc****xyz",
        lambda: f"partially masked token sk-{token(random_source, string.ascii_lowercase, 3)}****{token(random_source, string.ascii_lowercase, 3)}",
        lambda: f"short random string seen in log: {medium_alnum(random_source)}",
        lambda: f"borderline entropy value: {borderline_entropy_value(random_source)}",
        lambda: f"config candidate api_token={medium_alnum(random_source)}",
        lambda: f"config candidate session={medium_alnum(random_source)}",
        lambda: f"mixed alphanumeric without prefix: {medium_alnum(random_source)}",
        lambda: f"base64-like invalid padding: {invalid_base64_like(random_source)}",
        lambda: f"example_token={medium_alnum(random_source)}",
        lambda: "suspicious config value auth_code=asdfgh1234",
        lambda: "safe-looking config key secret_mode=optional",
        lambda: "borderline config password_mode=manual",
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
            text = generators[label](random_source)
            category = infer_category(text, label)
            layer_hint = "onix_gray_zone" if label == "SECRET" and category in {
                "credential_context",
                "email",
                "identity",
                "metadata_sensitive",
            } else None
            add(
                records,
                text,
                label,
                "independent_synthetic_eval",
                category=category,
                layer_hint=layer_hint,
            )

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
            category = str(record.get("category") or infer_category(text, label)).strip()
            normalized.append(
                {
                    "text": text,
                    "label": label,
                    "source": str(record.get("source") or "unknown").strip(),
                    "source_type": infer_source_type(record),
                    "sanitized": bool(record.get("sanitized", False)),
                    "difficulty": str(record.get("difficulty") or "").strip(),
                    "category": category,
                    "layer_hint": str(record.get("layer_hint") or "").strip(),
                    "action": str(record.get("action") or "").strip(),
                    "reason": str(record.get("reason") or "").strip(),
                    "provider": str(record.get("provider") or "").strip(),
                }
            )

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


def secret_precision_recall(labels: list[str], predictions: list[str], indices: list[int]) -> tuple[float, float, int, int]:
    true_positive = sum(labels[index] == "SECRET" and predictions[index] == "SECRET" for index in indices)
    false_positive = sum(labels[index] != "SECRET" and predictions[index] == "SECRET" for index in indices)
    false_negative = sum(labels[index] == "SECRET" and predictions[index] != "SECRET" for index in indices)
    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
    recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
    return precision, recall, false_positive, false_negative


def print_group_breakdown(
    title: str,
    records: list[dict],
    labels: list[str],
    predictions: list[str],
    key_name: str,
) -> None:
    groups: dict[str, list[int]] = defaultdict(list)
    for index, record in enumerate(records):
        groups[str(record.get(key_name) or "unknown")].append(index)

    print(f"{title}:")
    for group in sorted(groups):
        indices = groups[group]
        precision, recall, false_positive, false_negative = secret_precision_recall(labels, predictions, indices)
        print(
            f"  {group}: count={len(indices)} "
            f"secret_precision={precision:.4f} secret_recall={recall:.4f} "
            f"secret_fp={false_positive} secret_fn={false_negative}"
        )


def print_provider_category_breakdown(records: list[dict], labels: list[str], predictions: list[str]) -> None:
    groups: dict[str, list[int]] = defaultdict(list)
    for index, record in enumerate(records):
        provider = record.get("provider") or record.get("source") or "unknown"
        category = record.get("category") or "unknown"
        groups[f"{provider}/{category}"].append(index)

    print("Provider/category breakdown:")
    for group in sorted(groups):
        indices = groups[group]
        precision, recall, false_positive, false_negative = secret_precision_recall(labels, predictions, indices)
        print(
            f"  {group}: count={len(indices)} "
            f"secret_precision={precision:.4f} secret_recall={recall:.4f} "
            f"secret_fp={false_positive} secret_fn={false_negative}"
        )


def recall_for_indices(labels: list[str], predictions: list[str], indices: list[int]) -> float:
    positives = [index for index in indices if labels[index] == "SECRET"]
    if not positives:
        return 1.0
    true_positive = sum(predictions[index] == "SECRET" for index in positives)
    return true_positive / len(positives)


def print_focus_metrics(records: list[dict], labels: list[str], predictions: list[str]) -> dict[str, float]:
    email_indices = [
        index
        for index, record in enumerate(records)
        if EMAIL_REGEX.search(record["text"]) and labels[index] == "SECRET"
    ]
    gray_zone_secret_indices = [
        index
        for index, record in enumerate(records)
        if record.get("layer_hint") == "onix_gray_zone" and labels[index] == "SECRET"
    ]
    normal_text_indices = [
        index
        for index, record in enumerate(records)
        if record.get("category") == "normal_text_safe" and labels[index] == "NOT_SECRET"
    ]
    normal_text_false_positives = sum(predictions[index] == "SECRET" for index in normal_text_indices)
    normal_text_fp_rate = (
        normal_text_false_positives / len(normal_text_indices) if normal_text_indices else 0.0
    )

    metrics = {
        "email_recall": recall_for_indices(labels, predictions, email_indices),
        "gray_zone_secret_recall": recall_for_indices(labels, predictions, gray_zone_secret_indices),
        "normal_text_fp_rate": normal_text_fp_rate,
    }
    print(f"Email recall: {metrics['email_recall']:.4f} ({len(email_indices)} SECRET email records)")
    print(
        f"Gray-zone SECRET recall: {metrics['gray_zone_secret_recall']:.4f} "
        f"({len(gray_zone_secret_indices)} SECRET gray-zone records)"
    )
    print(
        "Normal-text false positives: "
        f"{normal_text_false_positives}/{len(normal_text_indices)} ({normal_text_fp_rate:.4f})"
    )
    return metrics


def print_source_type_metrics(
    title: str,
    source_type: str,
    records: list[dict],
    labels: list[str],
    predictions: list[str],
) -> dict[str, float | int]:
    indices = [index for index, record in enumerate(records) if record.get("source_type") == source_type]
    if not indices:
        print(f"{title}: count=0")
        return {
            "count": 0,
            "secret_precision": 0.0,
            "secret_recall": 0.0,
            "false_positives": 0,
            "false_negatives": 0,
        }

    precision, recall, false_positive, false_negative = secret_precision_recall(labels, predictions, indices)
    label_counts = {label: sum(labels[index] == label for index in indices) for label in LABELS}
    print(
        f"{title}: count={len(indices)} "
        + " ".join(f"{label}={label_counts[label]}" for label in LABELS)
        + f" secret_precision={precision:.4f} secret_recall={recall:.4f} "
        + f"false_positives={false_positive} false_negatives={false_negative}"
    )
    if false_positive:
        print(f"{title} false positives:")
        for index in indices:
            if labels[index] != "SECRET" and predictions[index] == "SECRET":
                print(f"  actual={labels[index]} predicted={predictions[index]} text={records[index]['text']}")
    if false_negative:
        print(f"{title} false negatives:")
        for index in indices:
            if labels[index] == "SECRET" and predictions[index] != "SECRET":
                print(f"  actual={labels[index]} predicted={predictions[index]} text={records[index]['text']}")
    return {
        "count": len(indices),
        "secret_precision": precision,
        "secret_recall": recall,
        "false_positives": false_positive,
        "false_negatives": false_negative,
    }


def labels_for_indices(values: list[str], indices: list[int]) -> list[str]:
    return [values[index] for index in indices]


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
    print_group_breakdown("Category breakdown", records, labels, predictions, "category")
    print_provider_category_breakdown(records, labels, predictions)
    print_group_breakdown("Source-type breakdown", records, labels, predictions, "source_type")
    focus_metrics = print_focus_metrics(records, labels, predictions)
    synthetic_metrics = print_source_type_metrics(
        "Synthetic eval metrics",
        "synthetic",
        records,
        labels,
        predictions,
    )
    real_sanitized_metrics = print_source_type_metrics(
        "Real-sanitized eval metrics",
        "real_sanitized",
        records,
        labels,
        predictions,
    )
    _ = synthetic_metrics, real_sanitized_metrics

    gating_indices = [
        index for index, record in enumerate(records) if record.get("source_type") != "real_sanitized"
    ]
    gating_labels = labels_for_indices(labels, gating_indices)
    gating_predictions = labels_for_indices(predictions, gating_indices)
    print(
        "Gate thresholds apply to synthetic and existing held-out eval records; "
        "real-sanitized eval is report-only until deliberately promoted into training."
    )

    secret_recall = recall_score(
        gating_labels,
        gating_predictions,
        labels=["SECRET"],
        average="macro",
        zero_division=0,
    )
    not_secret_recall = recall_score(
        gating_labels,
        gating_predictions,
        labels=["NOT_SECRET"],
        average="macro",
        zero_division=0,
    )
    unsure_recall = recall_score(
        gating_labels,
        gating_predictions,
        labels=["UNSURE"],
        average="macro",
        zero_division=0,
    )
    print(f"SECRET recall: {secret_recall:.4f}")
    print(f"NOT_SECRET recall: {not_secret_recall:.4f}")
    print(f"UNSURE recall: {unsure_recall:.4f}")

    failures = []
    if secret_recall < FAIL_SECRET_RECALL_BELOW:
        failures.append(f"SECRET recall {secret_recall:.4f} < {FAIL_SECRET_RECALL_BELOW:.2f}")
    if not_secret_recall < FAIL_NOT_SECRET_RECALL_BELOW:
        failures.append(f"NOT_SECRET recall {not_secret_recall:.4f} < {FAIL_NOT_SECRET_RECALL_BELOW:.2f}")
    if unsure_recall < FAIL_UNSURE_RECALL_BELOW:
        failures.append(f"UNSURE recall {unsure_recall:.4f} < {FAIL_UNSURE_RECALL_BELOW:.2f}")
    if focus_metrics["email_recall"] < FAIL_EMAIL_RECALL_BELOW:
        failures.append(f"Email recall {focus_metrics['email_recall']:.4f} < {FAIL_EMAIL_RECALL_BELOW:.2f}")
    if focus_metrics["gray_zone_secret_recall"] < FAIL_GRAY_ZONE_SECRET_RECALL_BELOW:
        failures.append(
            f"Gray-zone SECRET recall {focus_metrics['gray_zone_secret_recall']:.4f} "
            f"< {FAIL_GRAY_ZONE_SECRET_RECALL_BELOW:.2f}"
        )
    if focus_metrics["normal_text_fp_rate"] > FAIL_NORMAL_TEXT_FP_RATE_ABOVE:
        failures.append(
            f"Normal-text false-positive rate {focus_metrics['normal_text_fp_rate']:.4f} "
            f"> {FAIL_NORMAL_TEXT_FP_RATE_ABOVE:.2f}"
        )
    if failures:
        raise SystemExit("; ".join(failures))


if __name__ == "__main__":
    main()
