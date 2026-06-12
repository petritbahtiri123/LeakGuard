# Phase 13A Image Visual Redaction Plan

## Purpose

Phase 13A proves that local English OCR can provide usable word or line bounding boxes, map those boxes to LeakGuard detector findings, and produce a flattened redacted PNG for scanner-page image proof only.

This phase does not wire visual image redaction into protected-site uploads, Gemini/Firefox bridge behavior, pending attach lifecycle, normal user-facing scanner exports, detector rules, permissions, remote calls, or document rebuilds.

## V1 Scope

- Output format: PNG first.
- Input formats: PNG, JPG, JPEG, and WEBP.
- OCR language: English only.
- Entry point: scanner-page proof first.
- Protected-site upload visual redaction: later phase.
- Scanned-image PDF OCR: out of scope.
- DOCX, PDF, and XLSX rebuilds: out of scope.
- Normal user feature exposure: out of scope until the proof passes.

## Bounding-Box Proof

The OCR recognition proof should capture layout data when the local OCR engine exposes it:

- Prefer word boxes when word offsets, confidence, and coordinates are usable.
- Fall back to line boxes only when word boxes are unavailable or unreliable.
- Keep raw text available only inside the scanner OCR recognition boundary needed for detection.
- Production OCR metadata must remain raw-safe: boxes may include offsets, dimensions, confidence buckets, and box kind, but not raw recognized text.

The scanner proof maps detector findings to OCR layout boxes by intersecting finding text offsets with box text offsets. If any finding from OCR text cannot be covered by a usable box, LeakGuard must not generate a redacted image.

## Redacted PNG Proof

A scanner-only helper should accept image bytes or a Blob plus redaction boxes, decode the image locally, draw the original pixels into a canvas, draw solid black rectangles over valid boxes, and export a new flattened PNG Blob or File. It must never mutate the original file and must never rely on HTML/CSS overlays as the redaction artifact.

The helper must fail closed when boxes are missing, malformed, low confidence, outside the image, or when the decoded image exceeds the scanner OCR image limits.

## Security And Privacy

- No backend calls, telemetry, tracking, cloud OCR, remote model calls, or remote verification.
- No new permissions.
- No non-English OCR.
- No raw OCR text in logs, extension storage, audit metadata, report metadata, or visual-redaction metadata.
- If OCR detects a secret but cannot provide a usable bounding box, do not generate a redacted image. Fall back to redacted text output or fail closed with a clear message.

## Validation

Phase 13A proof should cover:

- Synthetic image with a fake API key produces usable bounding boxes.
- Redacted PNG output is generated with a `.redacted.png` filename.
- Output bytes differ from the original image.
- OCR rescanning the redacted PNG does not detect the raw fake secret.
- Missing or low-confidence boxes fail closed.
- Oversized images fail safely.
- Existing `.redacted.txt` OCR export behavior remains unchanged.
- Protected-site upload paths remain unchanged.
