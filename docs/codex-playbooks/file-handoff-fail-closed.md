# File Handoff And Fail-Closed Playbook

Use when protected-site file paste, drag/drop, file input selection, scanner extraction, sanitized handoff, pending attach, regenerated document output, image OCR, or fallback behavior fails.

## First Move
Identify the exact entry path and add a focused regression before changing behavior:

- `node tests/content_file_drop_interception.test.js`
- `node tests/file_scanner.test.js`
- `node tests/file_extractors.test.js`
- `node tests/content_file_extraction_pipeline.test.js`
- `node tests/file_drop_streaming_guards.test.js`
- `node tests/file_debug_metadata.test.js`

## Module Owners
- `src/content/files/*`: protected-site extraction, transfer policy, session cache, OCR broker, attach pipeline, and pending sanitized handoff helpers.
- `src/content/file_handoff_*.js`: shared handoff state, pending flow, and handoff sequencing.
- `src/content/adapters/*`: site-specific upload/attach contracts.
- `src/shared/fileScanner.js`, `src/shared/fileExtractors.js`, `src/shared/streamingFileRedactor.js`: scanner/extractor/redaction core.
- `src/content/content.js`: final orchestration only.

## Fail-Closed Rules
- No raw fallback after LeakGuard consumes, scans, streams, redacts, or sanitizes a file.
- Unsupported or unsafe protected file flows fail closed.
- Sanitized handoff failure blocks raw upload.
- Gemini/Grok pending attach must not replay raw files.
- Image redaction remains file-only where required; do not insert raw image text or claim visual safety when boxes are unsafe.
- Do not read streamed sanitized files back into memory unless an explicit user fallback requires it.
- Debug, reports, audit, and QA output must not include raw file names, paths, contents, snippets, or secret values.

## Triage Questions
- Which site and browser?
- Which path: paste, drop, file input, pending attach, scanner, regenerated document, image OCR?
- Did LeakGuard consume the event or file?
- Was a sanitized `File`/`Blob` created?
- Did handoff fail, fallback fail, or verification fail?
- Is this a product security risk or a UI/harness issue?

## Validation
Run the narrow path first:

```bash
node tests/content_file_drop_interception.test.js
node tests/file_scanner.test.js
node tests/file_extractors.test.js
node tests/security.test.js
```

Add `node tests/runtime_script_order.test.js` and `node tests/build_targets.test.js` when adding or moving runtime modules.
