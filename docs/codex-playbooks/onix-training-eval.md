# Onix Training And Evaluation Playbook

Use when changing Onix dataset generation, feature extraction, training, evaluation, model export, AI candidate gating, or gray-zone classifier behavior.

## Lifecycle
Preserve:

```text
regex/provider deterministic rules
  -> entropy/context fallback
  -> Onix gray-zone classifier
  -> final redaction policy
```

Onix is after deterministic detection and entropy/context fallback. It handles gray-zone leftovers only and cannot downgrade deterministic findings.

## Data Rules
- Eval-first for real-sanitized cases.
- Use no real secrets.
- Use synthetic/fake or real-sanitized text only.
- Keep `ai/dataset/test/*` as held-out evaluation data.
- Do not copy exact holdout text into generated or labeled training data.
- Do not commit private paths, private domains, non-example email domains, real phone numbers, customer names, or live-looking credentials.
- Retrain only after curated failure patterns justify it.

## Module Owners
- `ai/scripts/generate_dataset.py`: generated training records, 50,000 default.
- `ai/scripts/evaluate_model.py`: independent synthetic plus held-out real-sanitized metrics.
- `ai/scripts/features.py`: classifier feature extraction.
- `ai/scripts/train_classifier.py`: local sklearn training.
- `ai/scripts/export_onnx.py`: generated ONNX export.
- `src/shared/aiCandidateGate.js`: candidate extraction and safe-value gating.
- `src/shared/transformOutboundPromptWithAi.js`: deterministic plus Onix merge policy.
- `ai/models/*`: generated artifacts; do not touch unless retraining/export is explicitly in scope.

## Metrics To Report
When Onix behavior changes, report:

- synthetic evaluation metrics
- real-sanitized evaluation metrics
- email recall
- gray-zone secret recall
- normal-text false-positive rate
- notable false positives/false negatives using synthetic-safe descriptions

## Validation
Windows commands:

```powershell
node tests/onix_dataset.test.js
node tests/ai_candidate_gate.test.js
npm run prepare:build
ai\.venv\Scripts\python.exe ai\scripts\evaluate_model.py
ai\.venv\Scripts\python.exe -m py_compile ai\scripts\generate_dataset.py ai\scripts\evaluate_model.py ai\scripts\features.py
```

Use the Unix venv path on non-Windows:

```bash
ai/.venv/bin/python ai/scripts/evaluate_model.py
```

Run `npm test` before claiming a behavior-affecting Onix change is complete.
