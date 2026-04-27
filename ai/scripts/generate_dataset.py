#!/usr/bin/env python3
"""Generate a small synthetic LeakGuard classifier dataset."""

from __future__ import annotations

import base64
import argparse
import json
import random
import string
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dataset" / "generated" / "initial_dataset.jsonl"
RANDOM_SEED = 20260424
DEFAULT_RECORD_COUNT = 2000
RANDOM = random.Random(RANDOM_SEED)


def token(alphabet: str, length: int) -> str:
    return "".join(RANDOM.choice(alphabet) for _ in range(length))


def b64url(length: int) -> str:
    raw = bytes(RANDOM.getrandbits(8) for _ in range(length))
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def jwt() -> str:
    header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    payload = b64url(42)
    signature = b64url(32)
    return f"{header}.{payload}.{signature}"


def private_key() -> str:
    body = "\n".join(token(string.ascii_letters + string.digits + "+/", 64) for _ in range(3))
    return f"-----BEGIN SYNTHETIC PRIVATE KEY-----\n{body}\n-----END SYNTHETIC PRIVATE KEY-----"


def aws_access_key_id() -> str:
    return f"AKIA-SYNTH-{token(string.ascii_uppercase + string.digits, 12)}"


def aws_secret_access_key() -> str:
    return f"aws-secret-synth-{token(string.ascii_letters + string.digits + '/+=', 24)}"


def github_pat() -> str:
    return f"ghp-synthetic-{token(string.ascii_letters + string.digits, 30)}"


def stripe_secret_key() -> str:
    return f"sk-live-synthetic-{token(string.ascii_letters + string.digits, 24)}"


def bearer_token() -> str:
    return token(string.ascii_letters + string.digits + "-_", 52)


def basic_auth_header() -> str:
    credential = f"user_{token(string.ascii_lowercase, 5)}:{token(string.ascii_letters + string.digits + '!@#$', 24)}"
    return base64.b64encode(credential.encode("utf-8")).decode("ascii")


def add(records: list[dict], text: str, label: str, source: str = "synthetic") -> None:
    records.append({"text": text, "label": label, "source": source})


def random_secret_record() -> tuple[str, str]:
    alnum = string.ascii_letters + string.digits
    factories = [
        lambda: f"password=Summer2026!{token(alnum, 8)}",
        lambda: f"db_password=Pg-{token(alnum, 18)}!",
        lambda: f"api_key=lg_test_key_{token(alnum, 32)}",
        lambda: f"PAYMENT_SECRET_KEY=lg_payment_secret_{token(alnum, 38)}",
        lambda: f"Authorization: Bearer {bearer_token()}",
        lambda: f"jwt={jwt()}",
        lambda: f"DATABASE_URL=postgres://app:{token(alnum + '-_', 20)}@db.internal:5432/app",
        lambda: f"MYSQL_URL=mysql://root:{token(alnum + '!@#', 18)}@localhost:3306/reporting",
        lambda: f"AWS_SECRET_ACCESS_KEY={aws_secret_access_key()}",
        lambda: f"GITHUB_TOKEN={github_pat()}",
        lambda: f"client_secret=GOCSPX-{token(alnum + '-_', 36)}",
        lambda: f"private_key={private_key()}",
        lambda: f"temporary credential: {aws_access_key_id()} / {aws_secret_access_key()}",
        lambda: f"curl -H 'Authorization: Bearer {bearer_token()}' https://api.internal.example/v1",
    ]
    return RANDOM.choice(factories)(), "SECRET"


def random_not_secret_record() -> tuple[str, str]:
    hex_chars = "0123456789abcdef"
    factories = [
        lambda: f"region={RANDOM.choice(['eu-central-1', 'us-east-1', 'us-west-2', 'ap-southeast-1'])}",
        lambda: f"version={RANDOM.randint(0, 4)}.{RANDOM.randint(0, 20)}.{RANDOM.randint(0, 50)}",
        lambda: f"username=user_{RANDOM.randint(1, 9999)}",
        lambda: f"api_version=v{RANDOM.randint(1, 5)}",
        lambda: f"token_limit={RANDOM.choice([1024, 2048, 4096, 8192, 16384])}",
        lambda: f"build_id={token(hex_chars, 12)}",
        lambda: "Authorization: Bearer <token>",
        lambda: "GITHUB_TOKEN=ghp-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        lambda: "AWS_SECRET_ACCESS_KEY=<your-secret-here>",
        lambda: "Use ${API_KEY} from your local environment",
        lambda: "JWT format is header.payload.signature",
        lambda: "password_policy=min-16-chars",
    ]
    return RANDOM.choice(factories)(), "NOT_SECRET"


def random_unsure_record() -> tuple[str, str]:
    alnum = string.ascii_letters + string.digits
    factories = [
        lambda: f"session_token_example={token(alnum, 12)}",
        lambda: f"example_api_key=replace-me-{RANDOM.randint(1, 9999)}",
        lambda: f"password_note=stored in vault item {RANDOM.randint(1, 9999)}",
        lambda: "stripe_secret_key documentation section",
        lambda: "github_pat example format",
        lambda: "aws access key id docs",
        lambda: "Bearer token placeholder",
        lambda: "Authorization header must not be empty",
        lambda: "private_key_rotation_days=30",
    ]
    return RANDOM.choice(factories)(), "UNSURE"


def extend_records(records: list[dict], count: int) -> None:
    if count < len(records):
        del records[count:]
        return

    factories = (random_secret_record, random_not_secret_record, random_unsure_record)
    while len(records) < count:
        text, label = factories[len(records) % len(factories)]()
        add(records, text, label)


def build_records(count: int = DEFAULT_RECORD_COUNT) -> list[dict]:
    RANDOM.seed(RANDOM_SEED)
    records: list[dict] = []
    hex_chars = "0123456789abcdef"
    alnum = string.ascii_letters + string.digits
    secret_suffixes = ("prod", "stage", "dev", "backup", "ci", "local")

    for suffix in secret_suffixes:
        add(records, f"password=Summer2026!{suffix}", "SECRET")
        add(records, f"db_password=Pg-{token(alnum, 18)}!", "SECRET")
        add(records, f"api_key=lg_test_key_{token(alnum, 32)}", "SECRET")
        add(records, f"PAYMENT_SECRET_KEY=lg_payment_secret_{token(alnum, 38)}", "SECRET")
        add(records, f"Authorization: Bearer {bearer_token()}", "SECRET")
        add(records, f"jwt={jwt()}", "SECRET")
        add(records, f"DATABASE_URL=postgres://app:{token(alnum + '-_', 20)}@db.internal:5432/app", "SECRET")
        add(records, f"MYSQL_URL=mysql://root:{token(alnum + '!@#', 18)}@localhost:3306/reporting", "SECRET")
        add(records, f"AWS_SECRET_ACCESS_KEY={aws_secret_access_key()}", "SECRET")
        add(records, f"GITHUB_TOKEN={github_pat()}", "SECRET")
        add(records, f"client_secret=GOCSPX-{token(alnum + '-_', 36)}", "SECRET")
        add(records, f"private_key={private_key()}", "SECRET")

    hard_secret_factories = [
        lambda: f"Bearer {bearer_token()}",
        lambda: f"Authorization: Basic {basic_auth_header()}",
        lambda: github_pat(),
        lambda: stripe_secret_key(),
        lambda: aws_access_key_id(),
        lambda: jwt(),
        lambda: private_key(),
        lambda: f"curl -H 'Authorization: Bearer {bearer_token()}' https://api.internal.example/v1",
        lambda: f"stripe charge failed with key {stripe_secret_key()}",
        lambda: f"deploy token {github_pat()} expires after rotation",
        lambda: f"temporary credential: {aws_access_key_id()} / {aws_secret_access_key()}",
    ]
    for _ in range(5):
        for factory in hard_secret_factories:
            add(records, factory(), "SECRET")

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
        "Bearer token is required in the Authorization header",
        "example_api_key=replace_me",
        "AWS_SECRET_ACCESS_KEY=<your-secret-here>",
        "password=changeme",
        "password=example",
        "DATABASE_URL=postgres://user:password@localhost:5432/app",
        "JWT format is header.payload.signature",
        "Authorization: Bearer <token>",
        "Authorization: Basic <base64-credentials>",
        "GITHUB_TOKEN=ghp-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "STRIPE_SECRET_KEY=sk-live-synthetic-xxxxxxxxxxxxxxxxxxxxxxxx",
        "AWS_ACCESS_KEY_ID=AKIA-SYNTH-XXXXXXXXXXXX",
        "PRIVATE_KEY=-----BEGIN PRIVATE KEY----- example only -----END PRIVATE KEY-----",
        "Use ${API_KEY} from your local environment",
        "Set password to <password> in the example below",
        "The token value should be copied from your vault",
        "Never commit AWS_SECRET_ACCESS_KEY to source control",
        "Docs: Authorization: Bearer <token>",
        "JWT examples use header.payload.signature placeholders",
        "mask token as xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx in logs",
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
        "Bearer token placeholder",
        "Authorization header must not be empty",
        "stripe_secret_key documentation section",
        "github_pat example format",
        "aws access key id docs",
    ]
    for value in confusers:
        add(records, value, "UNSURE")

    for index in range(40):
        add(records, f"session_token_example={token(alnum, 12)}", "UNSURE")
        add(records, f"example_api_key=replace-me-{index}", "UNSURE")
        add(records, f"password_note=stored in vault item {index}", "UNSURE")

    context_contrasts = [
        (f"Please rotate this: AWS_SECRET_ACCESS_KEY={aws_secret_access_key()}", "SECRET"),
        ("The docs say AWS_SECRET_ACCESS_KEY should never be committed", "NOT_SECRET"),
        ("Authorization: Bearer <token>", "NOT_SECRET"),
        (f"Authorization: Bearer {bearer_token()}", "SECRET"),
        (f"Incident note included leaked token {bearer_token()}", "SECRET"),
        ("Incident note says the token must be rotated after exposure", "NOT_SECRET"),
        (f"Use this GitHub PAT for the deploy test: {github_pat()}", "SECRET"),
        ("Use a GitHub PAT with repo scope for the deploy test", "NOT_SECRET"),
        (f"Stripe live key found in chat: {stripe_secret_key()}", "SECRET"),
        ("Stripe live keys start with sk_live_ in examples", "NOT_SECRET"),
        (f"JWT from the failing request: {jwt()}", "SECRET"),
        ("JWT format is header.payload.signature", "NOT_SECRET"),
        (f"Basic auth header copied from prod: Authorization: Basic {basic_auth_header()}", "SECRET"),
        ("Basic auth examples should use Authorization: Basic <credentials>", "NOT_SECRET"),
        (f"Please revoke this access key id: {aws_access_key_id()}", "SECRET"),
        ("AWS access key IDs often begin with AKIA in documentation", "NOT_SECRET"),
    ]
    for text, label in context_contrasts:
        add(records, text, label)

    extend_records(records, count)
    RANDOM.shuffle(records)
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a synthetic LeakGuard classifier dataset.")
    parser.add_argument(
        "--count",
        type=int,
        default=DEFAULT_RECORD_COUNT,
        help=f"number of records to write (default: {DEFAULT_RECORD_COUNT})",
    )
    args = parser.parse_args()
    if args.count <= 0:
        raise SystemExit("--count must be greater than 0")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    records = build_records(args.count)
    with OUTPUT.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, sort_keys=True) + "\n")
    print(f"Wrote {len(records)} records to {OUTPUT}")


if __name__ == "__main__":
    main()
