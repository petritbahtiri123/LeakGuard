# WhatsApp Web Drag/Drop File QA

## Safe Test Setup

- Use only synthetic QA files with fake secrets.
- Confirm LeakGuard is enabled for `https://web.whatsapp.com/`.
- Open a disposable WhatsApp Web chat or the local WhatsApp-like E2E fixture.
- Keep DevTools checks metadata-only. Do not log raw file contents, raw filenames containing secrets, or real secrets.
- File paste remains out of scope. Do not treat document/file paste as supported.

## Supported Drop Types

WhatsApp drag/drop supports the same canonical LeakGuard file families as the WhatsApp attach-button path:

- PNG, JPG, JPEG, WEBP
- canonical text-like files from `FileTypeRegistry`, including `Dockerfile` and `Makefile`
- PDF
- DOCX
- XLSX

## Single-File Drop

1. Drop one supported file.
2. Confirm LeakGuard consumes the raw `drop` before WhatsApp previews it.
3. Confirm LeakGuard scans, extracts, redacts, and rebuilds locally.
4. Expected: WhatsApp preview receives exactly one sanitized `File` object.
5. Expected: no extracted text is inserted into the WhatsApp composer.
6. Expected: no unsafe original filename appears in preview, composer, page state, logs, debug output, or file-event state.

## Two-File Drop

1. Drop two supported files together, such as `Dockerfile` and `Makefile`.
2. Expected: both files are processed independently.
3. Expected: output order matches input order.
4. Expected: WhatsApp receives only sanitized `File` objects.
5. Expected: no raw preview appears before or after sanitized handoff.

## In-Cap Multi-File Drop

1. Drop an in-cap supported multi-file batch.
2. Use a mixed batch when possible: text-like, PDF, DOCX, XLSX, and image or another text-like file.
3. Expected: all files are sanitized locally.
4. Expected: output order matches input order.
5. Expected: WhatsApp receives only the sanitized files in input order.

## Mixed Supported Files

Use combinations of:

- PNG, JPG, JPEG, WEBP
- canonical LeakGuard text-like files, including `Dockerfile` and `Makefile`
- PDF
- DOCX
- XLSX

Expected: one supported file or in-cap supported mixed files succeed only through sanitized file handoff. No raw fallback, partial handoff, extracted-text fallback, or original filename leak is acceptable.

## Over-Cap Block

1. Drop a batch that exceeds the protected-site batch caps, such as twenty-one small supported files or six large supported files.
2. Expected: LeakGuard blocks before reading any file.
3. Expected: WhatsApp shows no raw preview and receives no files.
4. Expected: failure reason is metadata-only.

## Unsupported File Block

1. Drop an unsupported file, such as `.gif`, `.exe`, `.zip`, `.doc`, `.xls`, or `.bin`.
2. Expected: LeakGuard blocks the whole operation before read.
3. Expected: no raw preview, no sanitized preview, no send, and no file-event handoff.

## One Failed File Blocks All

1. Drop a batch with at least one valid supported file and one file expected to fail extraction, OCR, or rebuild, such as a malformed PDF, malformed DOCX, or malformed image.
2. Expected: LeakGuard blocks the whole batch.
3. Expected: no partial sanitized preview and no partial file handoff.
4. Expected: no raw fallback and no extracted-text fallback into WhatsApp.

## Raw Preview Must Never Appear

For every drag/drop case:

- `rawPreviewSeen` must remain false in the QA fixture.
- `rawPreviewBeforeSanitized` must remain false.
- Raw files must never reach WhatsApp preview/input state.
- No original filename containing unsafe text should appear in user-visible state.
- Raw file content must not appear in the composer, preview, sent messages, logs, debug output, or fixture file events.

## Attach-Button Regression

Repeat attach-button checks for:

- One supported image.
- One supported text-like file.
- PDF, DOCX, and XLSX.
- Two supported files.
- In-cap supported multi-file batches.
- Over-cap supported file batches blocked before read.
- Unsupported file blocked.
- One failed file in a batch blocks all.

## Clipboard Paste Regression

Repeat clipboard checks for:

- Text and multiline text redaction.
- Supported clipboard image paste.
- Unsupported clipboard image paste blocked.
- No raw image preview before sanitized handoff.
- File paste remains out of scope.
