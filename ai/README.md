# LeakGuard Local AI Assist

The `ai/` folder contains the offline data, training, evaluation, and ONNX export workflow for LeakGuard's optional local AI assist layer, referred to in tests and agent docs as Onix. The classifier is a helper for gray-zone spans only. It does not replace the deterministic detector and it cannot downgrade a high-confidence deterministic match.

Current lifecycle:

```text
regex/provider deterministic rules
  -> entropy/context fallback
  -> Onix gray-zone classifier
  -> final redaction policy
```

Regex/provider rules are first authority. Entropy is fallback. Onix runs after deterministic findings and candidate gating.

## Layout

```text
ai/
  dataset/
    raw/
    generated/
    labeled/
    test/
  scripts/
  models/
```

`raw/` can hold optional source material. `generated/` is produced by scripts. `labeled/` is for manually reviewed JSONL data. `test/` is for held-out JSONL data used only for evaluation. `models/` stores the trained sklearn bundle, feature metadata, and exported ONNX model.

## Commands

Run commands from this directory:

```bash
python -m pip install -r requirements.txt
python scripts/generate_dataset.py --count 50000
python scripts/train_classifier.py
python scripts/evaluate_model.py
python scripts/export_onnx.py
```

The generated dataset is written to:

```text
dataset/generated/initial_dataset.jsonl
```

`npm run build:*` commands run `scripts/prepare-build.mjs` first. `npm run build:all` runs that setup once and then packages every browser target. The setup step installs missing npm dependencies, creates `ai/.venv` when needed, installs Python training dependencies, generates 50,000 synthetic examples by default, trains the classifier, runs an independent held-out evaluation, and exports the ONNX model before packaging the extension. Set `LEAKGUARD_TRAINING_EXAMPLES` to change the generated training count locally.

## Enterprise Training Proof

Run these commands from the repository root after changing AI training data or model generation:

```bash
npm run prepare:build
ai/.venv/bin/python ai/scripts/evaluate_model.py
npm run build
npm test
```

On Windows, use this evaluation command instead:

```powershell
ai\.venv\Scripts\python.exe ai\scripts\evaluate_model.py
```

`npm run prepare:build` should create or refresh `dataset/generated/initial_dataset.jsonl` with 50,000 records, train the sklearn model, run the independent evaluation, and export the ONNX model. The generated model metadata should show a 37,500 / 12,500 internal train-validation split:

```text
models/leakguard_secret_classifier.training.json
```

`scripts/evaluate_model.py` evaluates a deterministic independent synthetic test set with more than 2,000 stratified records, then appends `dataset/test/*.jsonl` held-out records. It does not evaluate on `dataset/generated` or `dataset/labeled` training data. The script prints a classification report, confusion matrix, false positives, false negatives, category breakdowns, provider/category breakdowns, email recall, gray-zone secret recall, and normal-text false positives. It fails if `SECRET` recall drops below `0.98`, `NOT_SECRET` recall drops below `0.95`, `UNSURE` recall drops below `0.80`, email recall drops below `0.99`, gray-zone secret recall drops below `0.95`, or normal-text false-positive rate rises above `0.03`.

Real-sanitized eval packs live in `dataset/test/` with `source_type: "real_sanitized"` and `sanitized: true`. They are included in standalone evaluation and reported separately as an improvement loop, but they are report-only for gate thresholds until a deliberate training promotion is made. Eval-only changes under `dataset/test/` or `scripts/evaluate_model.py` should not retrain the model during `npm run prepare:build`.

Safety rules for data changes:

- Use synthetic/fake or real-sanitized text only.
- Do not commit real secrets, real customer text, private file paths, phone numbers, or non-example email domains.
- Keep `dataset/test/` as held-out evaluation data.
- Do not copy exact held-out real-sanitized text into generated or labeled training data.
- Retrain only after curated failure patterns justify it.
- Report synthetic and real-sanitized metrics when changing Onix behavior.
- Preserve regex/provider -> entropy/context -> Onix -> redaction policy.

Training merges `dataset/generated/*.jsonl` and `dataset/labeled/*.jsonl`, trains a small scikit-learn logistic regression model, and writes:

```text
models/leakguard_secret_classifier.joblib
models/leakguard_secret_classifier.features.json
```

The training script prints an internal random-split validation report from that same training pool. Treat it as a quick sanity check, not the final score. The independent score comes from `scripts/evaluate_model.py`.

ONNX export writes:

```text
models/leakguard_secret_classifier.onnx
```

## Safety Rule

The AI classifier can only upgrade a match's risk. It must never override or downgrade a high-confidence deterministic match. Browser integration and policy behavior are documented in [docs/AI_ASSIST.md](../docs/AI_ASSIST.md).

All processing stays local. The ONNX model is loaded in the extension with packaged `onnxruntime-web` browser assets.

See [docs/codex-playbooks/onix-training-eval.md](../docs/codex-playbooks/onix-training-eval.md) before changing dataset generation, features, training, evaluation, or model export behavior.
