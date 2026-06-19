# Phase 12A Protected-Site OCR Plan

> Historical plan note, 2026-06-18: protected-site image OCR is now settings-controlled and enabled by default for supported image uploads, with fail-closed raw-upload blocking when OCR/visual redaction is unsafe. Use `docs/FILE_CAPABILITY_MATRIX.md`, `docs/FILE_UPLOAD_SCANNING_GUIDE.md`, and `docs/RELEASE_QA_CHECKLIST.md` for current behavior.

## Goal

Plan protected-site OCR without changing runtime behavior. This document defines the scope, safety boundaries, lifecycle, adapter expectations, and tests required before any implementation starts.

## Historical State At Plan Time

At the time of this plan, LeakGuard supported local scanner-page OCR for PNG, JPG, JPEG, and WEBP images. Protected-site uploads supported text/source files and PDF/DOCX/XLSX text extraction into sanitized files, while protected-site images remained metadata-only and reported `image_ocr_not_supported`.

Protected-site OCR was disabled until a later implementation phase.

## Scope

Protected-site OCR v1, if implemented later, should be limited to:

- Image files only: PNG, JPG, JPEG, and WEBP.
- English OCR only.
- Local-only processing with packaged OCR assets only.
- Explicit file upload, file drop, or file select actions only.
- Existing protected-site file handoff paths only.
- Output as `.redacted.txt` only.

Protected-site OCR v1 must not include:

- Normal typing, paste text, or composer rewrite OCR paths.
- Scanned-PDF OCR.
- Image redaction, image rebuild, or sanitized image output.
- Provider-specific OCR implementations.
- New browser permissions.
- Remote OCR, CDN model loading, telemetry, backend verification, or cloud secret processing.
- Non-English traineddata.
- Detector rule changes.
- Gemini/Grok pending attach internals changes.

## Recommended Protected-Site OCR UX

Recommended default: protected-site OCR should be disabled by default for image uploads until the user enables it in settings or confirms once.

Rationale:

- OCR reads visual content that users may not expect LeakGuard to parse during upload.
- The protected-site path is closer to live site handoff than the scanner page, so the consent bar should be higher.
- A default-off gate would have preserved the then-current metadata-only behavior and made rollout reversible.
- A one-time confirmation can be offered later, but a settings-backed opt-in is easier to audit and less surprising.

Initial UX recommendation:

- Add a setting such as "Scan image text with local English OCR on protected sites".
- Default it to off.
- When off, protected-site images would have kept the then-current metadata-only behavior and `image_ocr_not_supported` warning.
- When a supported image is uploaded on a protected site and the setting is off, show a non-blocking choice that does not let the raw image silently upload:
  - Enable local English OCR for protected-site image uploads.
  - Continue with metadata-only sanitized `.redacted.txt`.
  - Cancel upload.
- The exact UI should reuse existing protected-site file safety surfaces rather than adding a provider-specific prompt.

## Security Boundaries

Protected-site OCR implementation must preserve these boundaries:

- Raw image bytes stay local and are never sent to protected sites before a safe handoff decision.
- Raw OCR text exists only transiently between OCR recognition and redaction.
- Raw OCR text must not appear in logs, debug snapshots, audit metadata, reports, localStorage, sessionStorage, extension storage, DOM status text, or exception messages.
- Raw extracted document text must remain excluded from logs, debug snapshots, audit metadata, reports, and storage.
- OCR output must pass through the existing detector/redactor before adapter handoff.
- JSON reports and debug metadata must include sanitized/redacted summaries only.
- If OCR is attempted and fails, times out, is cancelled, or cannot be safely redacted, the raw image must not upload silently on protected sites.
- Failure paths must return a blocked or user-action-required result, not a raw-file fallback.
- CSP may continue to allow `'wasm-unsafe-eval'` for packaged WASM, but must not allow `'unsafe-eval'`.
- OCR assets must be extension-local packaged assets only.

## Lifecycle Plan

Protected-site OCR should enter through the existing unified content extraction pipeline, not through adapter-specific OCR logic.

Required lifecycle properties:

- One OCR job per file.
- Jobs are serialized or explicitly cancellable per file handoff event.
- OCR has a fixed timeout using the scanner OCR timeout as the starting reference.
- Worker termination runs on timeout, cancellation, and error.
- UI exposes a user-visible pending/progress state while OCR is running.
- User cancellation clears pending state and worker state.
- Repeated drops/selects do not duplicate jobs or replay raw files.
- The raw image and raw OCR text are not cached.
- Session cache may store only the final sanitized text file result and sanitized metadata, following current cache safety rules.
- Cache keys must not include raw file names when those names contain secrets; reuse existing safe signature behavior.
- OCR warning metadata must be compact and raw-free, for example `ocr_timeout`, `ocr_low_confidence`, or `ocr_image_decode_failed`.

Recommended future implementation units:

- Extend `src/content/files/contentFileExtractionPipeline.js` to route supported images to an opt-in OCR branch before the existing image metadata result.
- Reuse shared scanner OCR validation/runtime helpers where possible without changing scanner-page behavior.
- Add a protected-site OCR policy helper for settings/confirmation decisions.
- Keep OCR lifecycle state close to the file extraction pipeline, not in provider adapters.
- Keep pending trusted attach state memory-only and continue using sanitized file handoff objects.

## Adapter Plan

Generic adapters:

- Receive only sanitized `.redacted.txt` output from the unified pipeline.
- Never receive raw image bytes when OCR is attempted.
- Preserve existing direct handoff, sanitized text fallback, sanitized download fallback, and block behavior.

Gemini and Grok:

- Do not change pending attach internals in v1.
- Preserve pending trusted attach, duplicate sanitized-file suppression, and no raw drop replay guarantees.
- Treat OCR output as another sanitized `.redacted.txt` file from the unified pipeline.

Provider-specific behavior:

- No provider-specific OCR special cases in v1.
- Do not add Gemini/Grok selectors for OCR.
- Do not click site upload controls differently for OCR files.
- Do not change normal typing, beforeinput, or composer text interception paths.

## Test Plan Before Implementation

Add failing tests before implementation starts:

- Protected-site supported image upload with fake secret text OCRs locally and produces a `.redacted.txt` sanitized file.
- Raw image file does not upload when OCR is attempted.
- OCR timeout blocks or fails safely and leaves no raw upload fallback.
- OCR cancellation clears pending/progress state and worker state.
- OCR worker terminates on timeout and error.
- OCR disabled-by-default path would have preserved the then-current metadata-only behavior and `image_ocr_not_supported`.
- Settings or confirmation gate enables OCR only after explicit user action.
- Gemini pending attach behavior remains unchanged for sanitized OCR output.
- Grok pending attach behavior remains unchanged for sanitized OCR output.
- Generic adapter handoff receives only `.redacted.txt` sanitized OCR output.
- No extraction or OCR runs on typing, beforeinput, normal composer paste, or text rewrite paths.
- Raw OCR text is absent from logs, debug metadata, audit metadata, localStorage, sessionStorage, extension storage, DOM status copy, cache snapshots, and JSON reports.
- Low-confidence OCR warns without leaking raw OCR text.
- Corrupted or unsupported images fail safely.
- Oversized images fail safely before OCR.
- Browser QA covers Chrome and Firefox protected-site image OCR opt-in, timeout/failure, and current disabled behavior.

Suggested focused test files:

- `tests/content_file_extraction_pipeline.test.js` for unified pipeline routing, disabled default, safe output names, failure behavior, and no typing path.
- `tests/content_file_drop_interception.test.js` for raw upload blocking, adapter handoff, and pending attach preservation.
- `tests/scanner_ocr.test.js` only for shared OCR helper regressions that are not scanner-page-specific.
- `tests/security.test.js` for static raw-text, storage, permissions, CSP, and no remote OCR gates.
- `tests/browser/extension_qa_harness.test.mjs`, `tests/browser/chrome_smoke.test.mjs`, and `tests/browser/firefox_smoke.test.mjs` for browser-level opt-in and fail-safe coverage.

## Implementation Readiness Checklist

Before Phase 12B implementation, verify:

- Product owner approves default-off or confirmation-gated UX.
- Settings schema and UI copy are approved.
- No new permissions are required.
- OCR size budget remains under warning and review gates.
- Browser QA plan includes Chrome and Firefox.
- Gemini/Grok pending attach behavior has focused regression coverage.
- Rollback path is clear: turn the setting off and preserve current metadata-only image behavior.

## Non-Goals

- Protected-site OCR implementation.
- Scanner OCR changes.
- Detector rule changes.
- Image output reconstruction.
- Scanned-PDF OCR.
- New OCR languages.
- Remote model downloads or remote verification.
