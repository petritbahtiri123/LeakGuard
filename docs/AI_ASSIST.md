# Local AI Assist

LeakGuard includes an optional local AI assist layer for uncertain deterministic findings. It is a helper only:

- deterministic high-confidence matches stay authoritative
- AI can upgrade a medium-confidence finding to high confidence
- AI can leave a medium-confidence finding as a warning
- AI cannot downgrade a high-confidence deterministic finding
- no network calls are made by the classifier

The browser loads the packaged ONNX model from `ai/models/leakguard_secret_classifier.onnx` and uses local ONNX Runtime files packaged from the installed `@xenova/transformers` dependency stack.

## Browser Smoke Test

Build and load Chrome:

```bash
npm run build:chrome
```

Then open `chrome://extensions`, enable Developer mode, choose `Load unpacked`, and select:

```text
dist/chrome
```

Open a protected site such as `https://chatgpt.com/`, paste the samples below into the composer, and verify the expected behavior before sending anything.

### High-confidence deterministic secret

Expected: LeakGuard should redact or block according to the normal high-confidence deterministic flow. AI must not downgrade this.

```text
password=Summer2026!
```

### Uncertain token-like value

Expected: this should be handled as an uncertain deterministic span. If the local AI score is `>= 0.85`, it is upgraded to high confidence. If it is between `0.60` and `0.85`, the softer review warning is shown.

```text
auth=abcdefghijklmnop
```

### Safe confusers

Expected: these should not be redacted as high-confidence secrets.

```text
region=eu-central-1
version=1.2.3
username=admin
secret_santa=true
token_limit=4096
password_hint=ask-admin
```

### Realistic mixed block

Expected: secrets are detected, safe config values are left alone where possible, and the decision modal never displays raw secret fragments.

```text
DATABASE_URL=postgres://app:ProdDbPass2026!@db.internal:5432/app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prodPayload1234567890.prodSignature1234567890
api_key=lg_test_key_51NqProdSecretValue9876543210ABCD
region=eu-central-1
token_limit=4096
secret_santa=true
```

## Disable AI Assist

AI assist is controlled by `aiAssistEnabled`.

Consumer default:

```json
{
  "aiAssistEnabled": true
}
```

Enterprise managed policy can set:

```json
{
  "aiAssistEnabled": false
}
```

When disabled, LeakGuard uses only the deterministic regex, entropy, context, and public IP/CIDR detection pipeline.

## Train The Model

Install the Python training dependencies:

```bash
cd ai
python -m venv venv
./venv/bin/python -m pip install -r requirements.txt
```

Generate synthetic training data:

```bash
./venv/bin/python scripts/generate_dataset.py
```

Add manually reviewed JSONL files to:

```text
ai/dataset/labeled/
```

Each row must include:

```json
{"text":"api_key=lg_test_key_example","label":"SECRET"}
{"text":"region=eu-central-1","label":"NOT_SECRET"}
{"text":"password_hint=ask-admin","label":"UNSURE"}
```

Train:

```bash
./venv/bin/python scripts/train_classifier.py
```

Evaluate:

```bash
./venv/bin/python scripts/evaluate_model.py
```

Export ONNX:

```bash
./venv/bin/python scripts/export_onnx.py
```

Rebuild the extension after export:

```bash
cd ..
npm run build:all
```
