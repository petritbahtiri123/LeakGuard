# Local AI Assist

LeakGuard includes an optional local AI assist layer for suspicious text that remains after deterministic detection. It is a helper only:

- deterministic high-confidence matches stay authoritative
- deterministic findings are not classified again by AI
- the full prompt is never sent to the classifier
- AI only receives small candidate context windows such as `key=value` or `key: value`
- AI can add a finding for suspicious leftover text
- AI cannot downgrade deterministic findings
- no network calls are made by the classifier

The browser loads the packaged ONNX model from `ai/models/leakguard_secret_classifier.onnx` and uses local ONNX Runtime files packaged from the installed `onnxruntime-web` dependency.

## AI Candidate Gate

The AI assist pipeline runs after deterministic detection.

```text
prompt text
  -> deterministic detector
  -> deterministic finding ranges are reserved
  -> AI candidate gate extracts suspicious leftover chunks only
  -> local ONNX classifier evaluates candidate.contextText only
  -> AI findings are merged with deterministic findings
  -> transformOutboundPrompt() performs the normal placeholder replacement
```

This keeps the synchronous redaction path stable. `transformOutboundPrompt()` remains synchronous. The async wrapper is `transformOutboundPromptWithAi()`.

### Candidate Sources

`src/shared/aiCandidateGate.js` extracts candidate values from:

- assignment values such as `key=value`
- colon values such as `key: value`
- JSON-style quoted values such as `"key": "value"`
- bare suspicious token-like values with length `>= 12`
- URL credential password segments such as `scheme://user:password@host`

Candidates that overlap deterministic finding ranges are skipped. Clean placeholders such as `[PWM_1]` are skipped.

### Safe Values

The candidate gate suppresses obvious safe values before AI classification:

- booleans such as `true` and `false`
- pure numbers
- semver/version strings such as `1.2.3` and `v1.2.3`
- region-like strings such as `eu-central-1`
- common safe keys such as `version`, `api_version`, `region`, `debug`, `environment`, `token_limit`, `secret_santa`, `password_hint`, `jira_key`, `ticket_id`, `commit_sha`, `build_id`, and `image_tag`

### Scoring And Policy Thresholds

Each candidate receives a score from `0` to `100` using:

- entropy from `calculateEntropy()`
- candidate length
- character class variety from `countClassVariety()`
- token-like structure
- secret keyword context boosts
- safe keyword/context penalties
- `looksStructuredLikeSecret()` where useful

Policy thresholds:

```text
score >= 60  -> AI candidate in consumer and enterprise/strict modes
score >= 40  -> AI candidate only in enterprise/strict modes
score < 40   -> ignored
```

Classifier handling in `transformOutboundPromptWithAi()`:

- `SECRET` with confidence `>= 0.80` creates a high-severity AI finding
- `UNSURE` creates a medium-severity AI finding only in enterprise/strict mode when candidate score is `>= 60`
- `NOT_SECRET` does not create a finding

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

Expected: LeakGuard should redact or block according to the normal high-confidence deterministic flow. AI must not downgrade this and must not classify the deterministic range again.

```text
password=Summer2026!
```

### Suspicious leftover candidate

Expected: deterministic detection may ignore this in consumer mode depending on score, but enterprise/strict mode should allow the AI candidate gate to evaluate the small context chunk `note=abc123def456`. The classifier must not receive the full prompt.

```text
region=eu-central-1
debug=true
version=1.2.3
build_id=12345
note=abc123def456
```

### Safe confusers

Expected: these should not become AI candidates and should not be redacted as high-confidence secrets.

```text
region=eu-central-1
version=1.2.3
username=admin
secret_santa=true
token_limit=4096
password_hint=ask-admin
build_id=12345
```

### Realistic mixed block

Expected: deterministic secrets are detected first, safe config values are left alone where possible, and suspicious leftover candidates are classified locally only when they pass the policy threshold. The decision modal must never display raw secret fragments.

```text
DATABASE_URL=postgres://app:ProdDbPass2026!@db.internal:5432/app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prodPayload1234567890.prodSignature1234567890
api_key=lg_test_key_51NqProdSecretValue9876543210ABCD
region=eu-central-1
token_limit=4096
secret_santa=true
note=abc123def456
```

## Node Debugging

The shared files attach themselves to `globalThis.PWM`, so Node debug scripts must load the same dependencies used by the tests before calling the transformer. The transform path needs a `PlaceholderManager`.

A minimal local debug load order is:

```js
import "../src/shared/placeholders.js";
import "../src/shared/entropy.js";
import "../src/shared/patterns.js";
import "../src/shared/detector.js";
import "../src/shared/ipClassification.js";
import "../src/shared/ipDetection.js";
import "../src/shared/networkHierarchy.js";
import "../src/shared/placeholderAllocator.js";
import "../src/shared/sessionMapStore.js";
import "../src/shared/redactor.js";
import "../src/shared/ai/classifier.js";
import "../src/shared/aiCandidateGate.js";
import "../src/shared/transformOutboundPrompt.js";
import "../src/shared/transformOutboundPromptWithAi.js";
```

For Node-only testing, mock `PWM.LeakGuardAiClassifier.classify()` because the real ONNX runtime and browser-relative model URLs are expected in the extension runtime.

Example assertion targets:

```text
candidate.contextText === "note=abc123def456"
candidate.contextText !== fullPrompt
result.redactedText does not include "abc123def456"
```

Temporary debug scripts should not be committed. Keep ad-hoc scripts under an ignored local folder such as `scripts/local-debug/` if needed.

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
./venv/bin/python scripts/generate_initial_dataset.py --count 2000
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

The normal build commands run this preparation automatically. `npm run build:chrome`, `npm run build:firefox`, and `npm run build:all` install missing npm dependencies, prepare `ai/.venv`, generate 2000 synthetic examples, train the local classifier, export ONNX, and then package the extension.
