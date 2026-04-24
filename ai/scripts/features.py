#!/usr/bin/env python3
"""Feature extraction shared by LeakGuard's local AI training scripts."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Iterable

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import CountVectorizer


SECRET_KEYWORDS = (
    "api_key",
    "apikey",
    "authorization",
    "bearer",
    "client_secret",
    "connection_string",
    "database_url",
    "db_password",
    "jwt",
    "password",
    "private_key",
    "secret",
    "session",
    "token",
)

NUMERIC_FEATURES = (
    "length",
    "entropy",
    "has_digit",
    "has_upper",
    "has_lower",
    "has_symbol",
    "class_variety",
    "looks_base64",
    "looks_hex",
    "looks_jwt",
    "has_secret_keyword",
    "has_safe_keyword",
    "has_assignment",
    "left_secret_context",
    "right_secret_context",
)

SAFE_KEYWORDS = (
    "api_version",
    "region",
    "secret_santa",
    "token_limit",
    "username",
    "version",
)


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def read_jsonl(path: Path) -> list[dict]:
    records = []
    if not path.exists():
        return records
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                records.append(json.loads(stripped))
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_number}: invalid JSONL: {exc}") from exc
    return records


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def load_records_from_dirs(paths: Iterable[Path]) -> list[dict]:
    records: list[dict] = []
    for base in paths:
        if not base.exists():
            continue
        for path in sorted(base.glob("*.jsonl")):
            records.extend(read_jsonl(path))
    return records


def shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    counts = {}
    for char in text:
        counts[char] = counts.get(char, 0) + 1
    length = len(text)
    return -sum((count / length) * math.log2(count / length) for count in counts.values())


def split_context(text: str) -> tuple[str, str, str]:
    match = re.search(r"[:=]\s*", text)
    if not match:
        return "", text, ""
    return text[: match.start()], text[match.end() :], text[match.start() : match.end()]


def keyword_present(text: str, keywords: tuple[str, ...]) -> bool:
    normalized = text.lower()
    return any(re.search(rf"(^|[^a-z0-9]){re.escape(keyword)}([^a-z0-9]|$)", normalized) for keyword in keywords)


def numeric_features(text: str) -> list[float]:
    value = str(text or "")
    left, right, _separator = split_context(value)
    target = right or value
    classes = {
        "digit": bool(re.search(r"\d", target)),
        "upper": bool(re.search(r"[A-Z]", target)),
        "lower": bool(re.search(r"[a-z]", target)),
        "symbol": bool(re.search(r"[^A-Za-z0-9]", target)),
    }

    looks_base64 = bool(re.fullmatch(r"[A-Za-z0-9+/_-]{20,}={0,2}", target))
    looks_hex = bool(re.fullmatch(r"[A-Fa-f0-9]{24,}", target))
    looks_jwt = bool(re.fullmatch(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", target))

    return [
        float(len(target)),
        shannon_entropy(target),
        float(classes["digit"]),
        float(classes["upper"]),
        float(classes["lower"]),
        float(classes["symbol"]),
        float(sum(classes.values())),
        float(looks_base64),
        float(looks_hex),
        float(looks_jwt),
        float(keyword_present(value, SECRET_KEYWORDS)),
        float(keyword_present(value, SAFE_KEYWORDS)),
        float(bool(re.search(r"[:=]", value))),
        float(keyword_present(left, SECRET_KEYWORDS)),
        float(keyword_present(right, SECRET_KEYWORDS)),
    ]


def fit_vectorizer(texts: list[str]) -> CountVectorizer:
    vectorizer = CountVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1, max_features=2048)
    vectorizer.fit(texts)
    return vectorizer


def transform_texts(texts: list[str], vectorizer: CountVectorizer):
    char_features = vectorizer.transform(texts)
    numeric = sparse.csr_matrix(np.asarray([numeric_features(text) for text in texts], dtype=np.float32))
    return sparse.hstack([char_features, numeric], format="csr")


def feature_spec(vectorizer: CountVectorizer) -> dict:
    vocabulary = vectorizer.vocabulary_
    ordered = [ngram for ngram, index in sorted(vocabulary.items(), key=lambda item: item[1])]
    return {
        "version": 1,
        "char_ngram_range": list(vectorizer.ngram_range),
        "char_analyzer": vectorizer.analyzer,
        "char_vocabulary": ordered,
        "numeric_features": list(NUMERIC_FEATURES),
        "labels": ["NOT_SECRET", "SECRET", "UNSURE"],
    }
