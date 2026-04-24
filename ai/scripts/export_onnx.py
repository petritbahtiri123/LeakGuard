#!/usr/bin/env python3
"""Export the trained LeakGuard sklearn classifier to ONNX."""

from __future__ import annotations

import joblib
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

from features import repo_root


ROOT = repo_root()
MODEL_PATH = ROOT / "models" / "leakguard_secret_classifier.joblib"
ONNX_PATH = ROOT / "models" / "leakguard_secret_classifier.onnx"


def main() -> None:
    if not MODEL_PATH.exists():
        raise SystemExit("Model not found. Run python scripts/train_classifier.py first.")

    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    n_features = len(bundle["feature_spec"]["char_vocabulary"]) + len(
        bundle["feature_spec"]["numeric_features"]
    )

    onnx_model = convert_sklearn(
        model,
        initial_types=[("input", FloatTensorType([None, n_features]))],
        options={id(model): {"zipmap": False}},
        target_opset=12,
    )
    ONNX_PATH.parent.mkdir(parents=True, exist_ok=True)
    ONNX_PATH.write_bytes(onnx_model.SerializeToString())
    print(f"Saved ONNX model to {ONNX_PATH}")


if __name__ == "__main__":
    main()

