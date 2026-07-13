# Multi-line image OCR recovery design

## Problem

LeakGuard can sanitize a clean, high-contrast single-line image on a protected site, but a readable image containing roughly 10–30 lines can fail with `ocr_box_confidence_too_low`. The current OCR worker returns word boxes when any word boxes exist and discards independently recognized line boxes. Random-looking secret tokens can have low word confidence even when their containing line has medium or high confidence, so LeakGuard blocks without trying the safe, more conservative line geometry.

The recovery must improve supported image uploads without reducing the existing confidence threshold or weakening fail-closed behavior.

## Goals

- Sanitize readable PNG, JPEG, and WEBP images containing approximately 10–30 text lines when every detected sensitive span can be covered by verified geometry.
- Prefer precise word-level redaction.
- Recover from a genuinely low-confidence word box by covering its entire independently recognized medium/high-confidence line.
- Preserve one user action, one sanitized handoff, placeholder stability, and local-only processing.
- Keep genuine low-confidence, unmapped, malformed, unsupported, or unverifiable images blocked.

## Non-goals

- Do not lower or reinterpret the existing OCR confidence thresholds.
- Do not make image dimensions or resolution alone determine confidence eligibility.
- Do not add image preprocessing, upscaling, a second OCR pass, another page-segmentation mode, or a remote model.
- Do not introduce raw upload, OCR-text fallback, duplicate upload, partial multi-file handoff, or a second user action.
- Do not change manifest, permissions, CSP, telemetry, network, policy, detector thresholds, or public privacy behavior.

## Design

### OCR layout

The OCR worker will retain both independently produced word and line boxes in its sanitized layout result. Each box keeps its current text offsets, geometry, kind, confidence bucket, and protected-site eligibility metadata. Fallback whole-image boxes remain scanner-only and ineligible for protected-site upload.

The layout contract will remain additive and local to the existing OCR result: current consumers can continue reading the primary `boxes` collection, while the protected image redaction path can access the verified line candidates. No raw OCR text or secret value will be added to diagnostics.

### Finding-to-box selection

For each detector finding inside OCR text:

1. Map the finding to overlapping word boxes.
2. If all required word boxes are medium/high confidence with valid geometry, merge and use them as today.
3. If word mapping is absent or any required word box is genuinely low/unknown confidence, locate an independently recognized line box whose text offsets fully contain the sensitive finding.
4. Accept that line only when its confidence is medium/high, its geometry is valid, it is not a fallback box, and it is marked safe for protected-site visual redaction.
5. Redact the complete accepted line box. This deliberately favors safe over-redaction over guessing a smaller region.
6. If neither the word path nor the line path safely covers the finding, block the entire image with the existing fail-closed reason family.

Every sensitive finding must receive a verified redaction box before a sanitized PNG can be created. Multi-file batches retain their existing all-or-nothing behavior.

### Handoff and diagnostics

The existing image redactor will receive only validated boxes and will continue producing a flattened `.redacted.png`. WhatsApp and other protected sites will receive only that sanitized file. The original file input remains cleared before asynchronous processing.

Metadata-only warnings may distinguish `ocr_line_boxes_used` from genuine confidence failure. They must not contain OCR text, secret values, filenames containing secrets, or image content.

## Failure behavior

- Low/unknown word confidence plus eligible containing line: redact the whole line and continue.
- Low/unknown word confidence plus low/unknown or missing line: block.
- Line does not fully contain the sensitive text offsets: block.
- Invalid or fallback geometry: block.
- Any sensitive finding remains uncovered: block the whole image or whole multi-file batch.
- OCR, redacted PNG creation, or sanitized handoff fails: preserve the existing raw-image block.

## Testing

Focused tests will be written before production changes and must initially fail for the missing recovery behavior.

- OCR worker retains independently recognized word and line layouts.
- A 10–30 line readable image with a low-confidence secret word and a medium/high-confidence containing line produces an eligible line redaction box.
- Multiple secrets on different lines receive independent verified boxes.
- High-confidence word boxes remain precise and do not expand to line boxes.
- A medium/high-confidence line must fully contain the sensitive finding offsets.
- Genuine low-confidence word and line boxes remain blocked.
- Fallback whole-image boxes remain protected-site ineligible.
- The sanitized PNG handoff contains no raw image, text fallback, partial batch, or duplicate upload.

Validation will run the focused OCR and content-extraction tests first, followed by changed-file validation, Chrome build, WhatsApp image E2E, runtime syntax checks, and `git diff --check`. Firefox is excluded by product direction. Broader E2E is required only if the implementation expands beyond the OCR layout and protected image-redaction mapping described here.

## Rollback

Revert the implementation commit. The previous behavior will return to blocking low-confidence word boxes without line-level recovery; fail-closed protection remains intact in either state.
