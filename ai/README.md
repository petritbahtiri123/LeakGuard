# LeakGuard Local AI Assist

The `ai/` folder contains the offline data, training, evaluation, and ONNX export workflow for LeakGuard's optional local AI assist layer. The classifier is a helper for uncertain heuristic spans only. It does not replace the deterministic detector and it cannot downgrade a high-confidence deterministic match.

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
python scripts/generate_initial_dataset.py --count 10000
python scripts/train_classifier.py
python scripts/evaluate_model.py
python scripts/export_onnx.py
```

The generated dataset is written to:

```text
dataset/generated/initial_dataset.jsonl
```

`npm run build:*` commands run `scripts/prepare-build.mjs` first. `npm run build:all` runs that setup once and then packages every browser target. The setup step installs missing npm dependencies, creates `ai/.venv` when needed, installs Python training dependencies, generates 10,000 synthetic examples, trains the classifier, runs an independent held-out evaluation, and exports the ONNX model before packaging the extension.

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

`npm run prepare:build` should create or refresh `dataset/generated/initial_dataset.jsonl` with 10,000 records, train the sklearn model, run the independent evaluation, and export the ONNX model. The generated model metadata should show a 7,500 / 2,500 internal train-validation split:

```text
models/leakguard_secret_classifier.training.json
```

`scripts/evaluate_model.py` evaluates a deterministic independent synthetic test set with more than 2,000 stratified records, then appends `dataset/test/*.jsonl` held-out records. It does not evaluate on `dataset/generated` or `dataset/labeled` training data. The script prints a classification report, confusion matrix, false positives, and false negatives, then fails if `SECRET` recall drops below `0.98`, `NOT_SECRET` recall drops below `0.95`, or `UNSURE` recall drops below `0.80`.

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

The AI classifier can only upgrade a match's risk. It must never override or downgrade a high-confidence deterministic match. The browser integration only calls AI for uncertain deterministic spans, then applies:

- `confidence >= 0.85`: treat as secret
- `0.60 <= confidence < 0.85`: warn the user
- `< 0.60`: let the deterministic result stand

All processing stays local. The ONNX model is loaded in the extension with packaged `onnxruntime-web` browser assets.
