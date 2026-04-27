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
python scripts/generate_initial_dataset.py --count 2000
python scripts/train_classifier.py
python scripts/evaluate_model.py
python scripts/export_onnx.py
```

The generated dataset is written to:

```text
dataset/generated/initial_dataset.jsonl
```

`npm run build:*` commands run `scripts/prepare-build.mjs` first. That setup step installs missing npm dependencies, creates `ai/.venv` when needed, installs Python training dependencies, generates 2000 synthetic examples, trains the classifier, and exports the ONNX model before packaging the extension.

Training merges `dataset/generated/*.jsonl` and `dataset/labeled/*.jsonl`, trains a small scikit-learn logistic regression model, and writes:

```text
models/leakguard_secret_classifier.joblib
models/leakguard_secret_classifier.features.json
```

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
