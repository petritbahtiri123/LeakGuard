# Incident: 2.0.0 Image Entry Path Regression

## Summary

Manual QA reported protected-site image redaction working for drag/drop but not for copy-paste image or upload-button/file-picker paths. The shared image redaction pipeline was healthy; the risky divergence was entry-path routing before the pipeline.

## Entry Path Map

### Drag/drop

- `maybeHandleDrop()` snapshots `event.dataTransfer` before async work.
- `maybeHandleLocalFileInsert(..., "drop")` consumes the raw event and routes supported files through `processFileForAdapterHandoff()`.
- Image OCR/redaction returns a non-empty `image/png` `sanitizedFile` named `*.redacted.png`.
- Drag/drop uses adapter/native file handoff and skips text fallback for image redaction.

### Upload button / file picker

- `maybeHandleFileInputChange()` runs in capture phase for `input` and `change`.
- Raw file-input events are consumed before page handlers when the file is protected or extractable.
- `maybeHandleLocalFileInsert(..., "file-input")` routes image files through the same content extraction pipeline and assigns the sanitized file back via a `DataTransfer` bridge.
- Chrome generic file-input image OCR handoff passes in the browser QA harness; real provider upload buttons still need headed manual validation because host UI code may reject synthetic file-input redispatches differently.

### Clipboard paste

- `maybeHandlePaste()` checks `clipboardData`/`dataTransfer` for file items before plain-text paste handling.
- File-bearing paste events route to `maybeHandleLocalFileInsert(..., "paste")`.
- Regression root cause: clipboard image `File` objects can have no useful filename, so extension-only image routing treated valid `image/png` clipboard files as unsupported before OCR/redaction.
- Fix: unnamed/no-extension files with supported image MIME (`image/png`, `image/jpeg`, `image/webp`) now route to image metadata/OCR handling. Named MIME mismatches such as `upload.bin` with `image/png` remain unsupported.

## Root Cause

The image extraction router only recognized planned image handling by extension (`.png`, `.jpg`, `.jpeg`, `.webp`). Drag/drop and most file picker files include a filename extension, but clipboard images may arrive as unnamed MIME-only `File` objects. That caused copy-paste images to bypass the image OCR/redacted-PNG pipeline.

## Minimal Fix

- Added MIME-only image routing only when the filename has no extension.
- Preserved extension-first behavior for named files.
- Preserved fail-closed behavior for unsupported or mismatched named files.
- Did not change detector rules, text redaction, PDF/DOCX/XLSX extraction, permissions, CSP, or remote behavior.

## Regression Coverage

- `tests/file_extractors.test.js`: unnamed/no-extension clipboard images with supported image MIME route to safe image metadata extraction; named MIME mismatches remain unsupported.
- `tests/content_file_drop_interception.test.js`: clipboard image paste can route through the content extraction pipeline and hand off a sanitized `image/png` `*.redacted.png` file without OCR text fallback or raw file handoff.

## Raw Leak Assessment

The fix does not introduce raw image fallback. If OCR/redaction cannot produce a valid non-empty `image/png` redacted file, protected-site image handling remains fail-closed through the existing blocked result path.

## Manual Validation Needed

- Headed Chrome clean profile.
- Generic protected page: drag/drop image, file picker image, clipboard image paste.
- ChatGPT: upload button image and image paste if a QA account is available.
- Gemini: upload button image and image paste if a QA account is available.

## Chrome Hotfix Signal

Automated unit and Chrome browser harness coverage is green for the generic protected file-input image path. Go/no-go for Chrome hotfix still depends on headed manual validation against real provider upload and paste surfaces.
