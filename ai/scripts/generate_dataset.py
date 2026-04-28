#!/usr/bin/env python3
"""Generate synthetic LeakGuard classifier training data."""

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
DEFAULT_RECORD_COUNT = 10000
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
    prefix = RANDOM.choice(["AKIA", "ASIA"])
    return f"{prefix}-SYNTH-{token(string.ascii_uppercase + string.digits, 12)}"


def aws_secret_access_key() -> str:
    return f"aws-secret-synth-{token(string.ascii_letters + string.digits + '/+=', 24)}"


def github_pat() -> str:
    return f"ghp-synthetic-{token(string.ascii_letters + string.digits, 30)}"


def stripe_secret_key() -> str:
    return f"sk-live-synthetic-{token(string.ascii_letters + string.digits, 24)}"


def openai_key() -> str:
    return f"sk-synthetic-{token(string.ascii_letters + string.digits, 48)}"


def slack_bot_token() -> str:
    return f"xoxb-synthetic-{token(string.digits, 12)}-{token(string.digits, 12)}-{token(string.ascii_letters + string.digits, 24)}"


def webhook_secret() -> str:
    return f"https://hooks.example.invalid/services/T00000000/B00000000/{token(string.ascii_letters + string.digits, 24)}"


def azure_connection_string() -> str:
    return (
        "DefaultEndpointsProtocol=https;"
        f"AccountName=acct{token(string.ascii_lowercase + string.digits, 8)};"
        f"AccountKey={base64.b64encode(bytes(RANDOM.getrandbits(8) for _ in range(48))).decode('ascii')};"
        "EndpointSuffix=core.windows.net"
    )


def gcp_api_key() -> str:
    return f"AIzaSySynthetic{token(string.ascii_letters + string.digits + '-_', 28)}"


def high_entropy_secret(length: int = 40) -> str:
    return token(string.ascii_letters + string.digits + "-_=+/", length)


def medium_alnum() -> str:
    return token(string.ascii_letters + string.digits, RANDOM.randint(10, 20))


def invalid_base64_like() -> str:
    return f"{token(string.ascii_letters + string.digits + '+/', RANDOM.randint(18, 26))}==="


def borderline_entropy_value() -> str:
    chunks = [
        token(string.ascii_lowercase, 4),
        token(string.digits, 4),
        token(string.ascii_uppercase, 3),
    ]
    RANDOM.shuffle(chunks)
    return "".join(chunks)


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
        lambda: f"OPENAI_API_KEY={openai_key()}",
        lambda: f"SLACK_BOT_TOKEN={slack_bot_token()}",
        lambda: f"SENDGRID_API_KEY=SG.synthetic.{high_entropy_secret(38)}",
        lambda: f"TWILIO_AUTH_TOKEN={token('0123456789abcdef', 32)}",
        lambda: f"AZURE_STORAGE_CONNECTION_STRING={azure_connection_string()}",
        lambda: f"GOOGLE_API_KEY={gcp_api_key()}",
        lambda: f"WEBHOOK_URL={webhook_secret()}",
        lambda: f"vault write secret/prod/api token={high_entropy_secret(44)}",
        lambda: f"kubernetes.io/service-account-token: {bearer_token()}",
        lambda: f"terraform var client_secret = \"{high_entropy_secret(36)}\"",
        lambda: f"ci secret masked incorrectly: {high_entropy_secret(48)}",
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
        lambda: "OPENAI_API_KEY=sk-synthetic-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        lambda: "SLACK_BOT_TOKEN=xoxb-<workspace>-<bot>-<token>",
        lambda: "SENDGRID_API_KEY=SG.<redacted>",
        lambda: "TWILIO_AUTH_TOKEN=<twilio-auth-token>",
        lambda: "AZURE_STORAGE_CONNECTION_STRING=<connection-string>",
        lambda: "GOOGLE_API_KEY=AIzaSy<redacted>",
        lambda: "WEBHOOK_URL=https://hooks.example.invalid/services/...",
        lambda: "vault write secret/prod/api token=<token>",
        lambda: "kubernetes.io/service-account-token is mounted automatically",
        lambda: "terraform variable client_secret should come from CI secrets",
        lambda: "secret_santa=true",
        lambda: "token_limit=4096",
        lambda: "password_hint=ask-admin",
        lambda: "password=changeme",
        lambda: "password=test123",
        lambda: "example_token=replace-me",
        lambda: "api_version=v1",
        lambda: "username=admin",
        lambda: "region=eu-central-1",
        lambda: "debug=true",
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
        lambda: "prod incident mentions a leaked token but value was removed",
        lambda: "client_secret found in screenshot; verify before redaction",
        lambda: "vault secret path secret/data/payments/prod",
        lambda: "pipeline masked the credential as ***",
        lambda: "possible webhook URL in the log excerpt",
        lambda: "service-account-token warning in Kubernetes docs",
        lambda: "oauth client secret must be rotated after review",
        lambda: "terraform sensitive variable client_secret appeared in the diff summary",
        lambda: "partially masked token sk-abc****xyz",
        lambda: f"partially masked token sk-{token(string.ascii_lowercase, 3)}****{token(string.ascii_lowercase, 3)}",
        lambda: f"short random string seen in log: {medium_alnum()}",
        lambda: f"borderline entropy value: {borderline_entropy_value()}",
        lambda: f"config candidate api_token={medium_alnum()}",
        lambda: f"config candidate session={medium_alnum()}",
        lambda: f"mixed alphanumeric without prefix: {medium_alnum()}",
        lambda: f"base64-like invalid padding: {invalid_base64_like()}",
        lambda: f"example_token={medium_alnum()}",
        lambda: "suspicious config value auth_code=asdfgh1234",
        lambda: "safe-looking config key secret_mode=optional",
        lambda: "borderline config password_mode=manual",
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

    enterprise_secret_factories = [
        lambda: f"OPENAI_API_KEY={openai_key()}",
        lambda: f"SLACK_BOT_TOKEN={slack_bot_token()}",
        lambda: f"SENDGRID_API_KEY=SG.synthetic.{high_entropy_secret(38)}",
        lambda: f"TWILIO_AUTH_TOKEN={token('0123456789abcdef', 32)}",
        lambda: f"AZURE_STORAGE_CONNECTION_STRING={azure_connection_string()}",
        lambda: f"GOOGLE_API_KEY={gcp_api_key()}",
        lambda: f"WEBHOOK_URL={webhook_secret()}",
        lambda: f"REDIS_URL=redis://:{high_entropy_secret(28)}@cache.internal:6379/0",
        lambda: f"RABBITMQ_URL=amqps://svc:{high_entropy_secret(30)}@mq.internal/prod",
        lambda: f"vault kv put secret/prod/payments api_token={high_entropy_secret(44)}",
        lambda: f"kubectl create secret generic app --from-literal=token={bearer_token()}",
        lambda: f"terraform.tfvars: client_secret = \"{high_entropy_secret(36)}\"",
        lambda: f"github actions env DEPLOY_TOKEN={github_pat()}",
        lambda: f"helm values oauth.clientSecret: {high_entropy_secret(42)}",
        lambda: f"observability export OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer {bearer_token()}",
    ]
    for _ in range(10):
        for factory in enterprise_secret_factories:
            add(records, factory(), "SECRET")

    hard_secret_examples = [
        lambda: f"AWS_ACCESS_KEY_ID={aws_access_key_id()}",
        lambda: f"aws access key id leaked: {aws_access_key_id()}",
        lambda: f"export AWS_ACCESS_KEY_ID={aws_access_key_id()}",
        lambda: f"access_key_id: {aws_access_key_id()}",
        lambda: f"Authorization: Bearer {bearer_token()}",
        lambda: f"GITHUB_TOKEN={github_pat()}",
        lambda: f"SLACK_BOT_TOKEN={slack_bot_token()}",
        lambda: f"api_secret={base64.b64encode(bytes(RANDOM.getrandbits(8) for _ in range(36))).decode('ascii')}",
        lambda: f"client_secret={high_entropy_secret(36)}",
    ]
    for _ in range(40):
        for factory in hard_secret_examples:
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
        "OPENAI_API_KEY=sk-synthetic-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "SLACK_BOT_TOKEN=xoxb-<workspace>-<bot>-<token>",
        "SENDGRID_API_KEY=SG.<redacted>",
        "TWILIO_AUTH_TOKEN=<twilio-auth-token>",
        "AZURE_STORAGE_CONNECTION_STRING=<connection-string>",
        "GOOGLE_API_KEY=AIzaSy<redacted>",
        "WEBHOOK_URL=https://hooks.example.invalid/services/...",
        "REDIS_URL=redis://:<password>@cache.internal:6379/0",
        "RABBITMQ_URL=amqps://user:<password>@mq.internal/prod",
        "vault kv put secret/prod/payments api_token=<token>",
        "kubectl create secret generic app --from-literal=token=<token>",
        "terraform.tfvars should not contain client_secret values",
        "github actions secrets are referenced as ${{ secrets.DEPLOY_TOKEN }}",
        "helm values should use existingSecret instead of clientSecret",
        "OTEL_EXPORTER_OTLP_HEADERS supports Authorization=Bearer <token>",
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
        "password_required=true",
        "secretary_email=office@example.com",
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
        "vault secret path secret/data/payments/prod",
        "prod secret rotation playbook",
        "masked password appeared as ********",
        "redacted token value was [REDACTED]",
        "oauth client secret rotation ticket",
        "kubernetes service account token docs",
        "webhook secret validation failed without showing the secret",
        "terraform sensitive variable marked true",
        "github actions deploy token stored in org secrets",
    ]
    for value in confusers:
        add(records, value, "UNSURE")

    enterprise_ambiguous_notes = [
        "prod secret rotation playbook mentions Slack bot token without the value",
        "Azure storage key was rotated after incident; value removed from ticket",
        "terraform sensitive variable client_secret appeared in the diff summary",
        "Kubernetes service account token warning in audit log",
        "pipeline masked DEPLOY_TOKEN as ***",
        "possible webhook URL in screenshot; verify manually",
        "client_secret found in screenshot; verify before redaction",
        "oauth client secret must be rotated after review",
        "vault path may contain a secret reference but no value",
        "incident summary says token was exposed but omits the token",
        "masked credential in log output appeared as [REDACTED]",
        "configuration review mentions api_key field with value removed",
    ]
    for _ in range(12):
        for value in enterprise_ambiguous_notes:
            add(records, value, "UNSURE")

    ambiguous_token_shapes = [
        lambda: "partially masked token sk-abc****xyz",
        lambda: f"partially masked token sk-{token(string.ascii_lowercase, 3)}****{token(string.ascii_lowercase, 3)}",
        lambda: f"short random string seen in log: {medium_alnum()}",
        lambda: f"borderline entropy value: {borderline_entropy_value()}",
        lambda: f"config candidate api_token={medium_alnum()}",
        lambda: f"config candidate session={medium_alnum()}",
        lambda: f"mixed alphanumeric without prefix: {medium_alnum()}",
        lambda: f"base64-like invalid padding: {invalid_base64_like()}",
        lambda: f"example_token={medium_alnum()}",
        lambda: "suspicious config value auth_code=asdfgh1234",
        lambda: "config note maybe token asdfgh1234 but no provider prefix",
        lambda: "safe-looking config key secret_mode=optional",
        lambda: "borderline config password_mode=manual",
        lambda: f"temporary-looking value candidate={medium_alnum()}",
        lambda: f"masked credential candidate {token(string.ascii_lowercase, 4)}****{token(string.ascii_lowercase, 4)}",
    ]
    for _ in range(35):
        for factory in ambiguous_token_shapes:
            add(records, factory(), "UNSURE")

    hard_false_positive_traps = [
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
    ]
    for _ in range(35):
        for value in hard_false_positive_traps:
            add(records, value, "NOT_SECRET")

    enterprise_safe_guidance = [
        "terraform variable client_secret should be marked sensitive and supplied by CI",
        "client_secret should be stored in the enterprise vault",
        "DEPLOY_TOKEN must be configured as a GitHub Actions secret",
        "Slack bot token should be rotated from the admin console",
        "Azure storage connection strings should be loaded from Key Vault",
        "webhook secrets should never be pasted into tickets",
    ]
    for _ in range(8):
        for value in enterprise_safe_guidance:
            add(records, value, "NOT_SECRET")

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
        (f"PagerDuty note pasted live webhook: {webhook_secret()}", "SECRET"),
        ("PagerDuty webhook examples should use https://hooks.example.invalid/services/...", "NOT_SECRET"),
        (f"Slack bot token in deployment log: {slack_bot_token()}", "SECRET"),
        ("Slack bot token format starts with xoxb- in documentation", "NOT_SECRET"),
        (f"Azure storage connection string from prod: {azure_connection_string()}", "SECRET"),
        ("Azure connection string must be pulled from Key Vault", "NOT_SECRET"),
        (f"Terraform plan leaked client_secret={high_entropy_secret(36)}", "SECRET"),
        ("Terraform variable client_secret is marked sensitive", "UNSURE"),
        (f"GitHub Actions output printed DEPLOY_TOKEN={github_pat()}", "SECRET"),
        ("GitHub Actions should read deploy token from secrets.DEPLOY_TOKEN", "NOT_SECRET"),
        (f"Kubernetes secret manifest data token: {bearer_token()}", "SECRET"),
        ("Kubernetes Secret manifest should use stringData with placeholders in docs", "NOT_SECRET"),
        (f"Masked log failed and showed password {high_entropy_secret(30)}", "SECRET"),
        ("Masked log showed password as ***", "UNSURE"),
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
