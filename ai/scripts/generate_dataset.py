#!/usr/bin/env python3
"""Generate a small synthetic LeakGuard classifier dataset."""

from __future__ import annotations

import base64
import json
import random
import secrets
import string
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dataset" / "generated" / "initial_dataset.jsonl"
RANDOM = random.Random(20260424)


def token(alphabet: str, length: int) -> str:
    return "".join(RANDOM.choice(alphabet) for _ in range(length))


def b64url(length: int) -> str:
    raw = secrets.token_bytes(length)
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def jwt() -> str:
    header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    payload = b64url(42)
    signature = b64url(32)
    return f"{header}.{payload}.{signature}"


def private_key() -> str:
    body = "\n".join(token(string.ascii_letters + string.digits + "+/", 64) for _ in range(3))
    return f"-----BEGIN PRIVATE KEY-----\n{body}\n-----END PRIVATE KEY-----"


def add(records: list[dict], text: str, label: str, source: str = "synthetic") -> None:
    records.append({"text": text, "label": label, "source": source})


def build_records() -> list[dict]:
    records: list[dict] = []
    hex_chars = "0123456789abcdef"
    alnum = string.ascii_letters + string.digits
    secret_suffixes = ("prod", "stage", "dev", "backup", "ci", "local")

    for suffix in secret_suffixes:
        add(records, f"password=Summer2026!{suffix}", "SECRET")
        add(records, f"db_password=Pg-{token(alnum, 18)}!", "SECRET")
        add(records, f"api_key=lg_test_key_{token(alnum, 32)}", "SECRET")
        add(records, f"PAYMENT_SECRET_KEY=lg_payment_secret_{token(alnum, 38)}", "SECRET")
        add(records, f"Authorization: Bearer {token(alnum + '-_', 48)}", "SECRET")
        add(records, f"jwt={jwt()}", "SECRET")
        add(records, f"DATABASE_URL=postgres://app:{token(alnum + '-_', 20)}@db.internal:5432/app", "SECRET")
        add(records, f"MYSQL_URL=mysql://root:{token(alnum + '!@#', 18)}@localhost:3306/reporting", "SECRET")
        add(records, f"AWS_SECRET_ACCESS_KEY={token(string.ascii_letters + string.digits + '/+=', 40)}", "SECRET")
        add(records, f"GITHUB_TOKEN=ghp_{token(alnum, 36)}", "SECRET")
        add(records, f"client_secret=GOCSPX-{token(alnum + '-_', 36)}", "SECRET")
        add(records, f"private_key={private_key()}", "SECRET")

    safe_values = [
        "region=eu-central-1",
        "region=us-east-1",
        "version=1.2.3",
        "version=v2026.04.24",
        "username=admin",
        "username=petrit",
        "secret_santa=true",
        "api_version=v1",
        "api_version=2024-10-01",
        "token_limit=4096",
        "timeout_seconds=60",
        "feature_token_budget=8192",
        "password_hint=ask-admin",
        "password_policy=min-16-chars",
        "client_secret_rotation_days=90",
        "auth_method=oauth",
        "connection_name=reporting-db",
        "database_host=db.example.local",
    ]
    for value in safe_values:
        add(records, value, "NOT_SECRET")

    for index in range(70):
        add(records, f"region={RANDOM.choice(['eu-central-1', 'us-west-2', 'ap-southeast-1'])}", "NOT_SECRET")
        add(records, f"version={RANDOM.randint(0, 4)}.{RANDOM.randint(0, 20)}.{RANDOM.randint(0, 50)}", "NOT_SECRET")
        add(records, f"username=user_{index}", "NOT_SECRET")
        add(records, f"api_version=v{RANDOM.randint(1, 5)}", "NOT_SECRET")
        add(records, f"token_limit={RANDOM.choice([1024, 2048, 4096, 8192, 16384])}", "NOT_SECRET")
        add(records, f"build_id={token(hex_chars, 12)}", "NOT_SECRET")

    confusers = [
        "password_hint=ask-admin",
        "password_required=true",
        "secret_santa=true",
        "secretary_email=office@example.com",
        "token_limit=4096",
        "tokenizer_model=cl100k_base",
        "authored_by=admin",
        "authorization_required=false",
        "private_key_rotation_days=30",
        "db_password_policy=rotate-every-90-days",
    ]
    for value in confusers:
        add(records, value, "UNSURE")

    for index in range(40):
        add(records, f"session_token_example={token(alnum, 12)}", "UNSURE")
        add(records, f"example_api_key=replace-me-{index}", "UNSURE")
        add(records, f"password_note=stored in vault item {index}", "UNSURE")

    RANDOM.shuffle(records)
    return records


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    records = build_records()
    with OUTPUT.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, sort_keys=True) + "\n")
    print(f"Wrote {len(records)} records to {OUTPUT}")


if __name__ == "__main__":
    main()
