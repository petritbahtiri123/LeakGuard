# WhatsApp Web Drag/Drop File QA

## Safe Test Setup

- Use only synthetic QA files with fake secrets.
- Confirm LeakGuard is enabled for `https://web.whatsapp.com/`.
- Open a disposable WhatsApp Web chat or the local WhatsApp-like E2E fixture.
- Keep DevTools open only for metadata-only checks. Do not log raw file contents or real secrets.
- For every case, confirm the raw file preview never appears before the sanitized preview.

## Single-File Drop

1. Drop one supported text-like file, such as `.txt`, `.env`, `.json`, `.log`, `.md`, or `.csv`.
2. Expected: LeakGuard consumes the raw drop, sanitizes locally, and WhatsApp preview receives only the sanitized file.
3. Confirm placeholders such as `[PWM_1]` appear in the sanitized file content.
4. Confirm the original raw secret text is not visible in the preview, composer, page, logs, or file-event state.

## Two-File Drop

1. Drop two supported files together.
2. Expected: both files sanitize independently.
3. Expected: preview order matches input order.
4. Expected: no partial preview appears while processing.

## Five-File Drop

1. Drop five supported files together.
2. Use a mixed batch when possible: text-like, PDF, DOCX, XLSX, and another text-like file.
3. Expected: all five files sanitize locally.
4. Expected: preview order matches input order.
5. Expected: only sanitized `File` objects reach WhatsApp.

## Mixed Supported Files

Use combinations of:

- PNG, JPG, JPEG, WEBP
- TXT, ENV, JSON, LOG, MD, CSV
- PDF
- DOCX
- XLSX

Expected: every supported file is sanitized through the same extraction/redaction/rebuild or image OCR/redaction pipeline used by attach-button flow.

## Six-File Block

1. Drop six supported files together.
2. Expected: LeakGuard blocks before reading any file.
3. Expected: WhatsApp shows no raw preview and receives no files.
4. Expected: failure reason is metadata-only.

## Unsupported File Block

1. Drop an unsupported file, such as `.gif`, `.exe`, `.zip`, `.doc`, `.xls`, or `.bin`.
2. Expected: LeakGuard blocks the operation.
3. Expected: no raw preview, no sanitized preview, no send, and no file-event handoff.

## One Failed File Blocks All

1. Drop a batch with at least one valid supported file and one file expected to fail extraction or rebuild, such as a malformed PDF or malformed DOCX.
2. Expected: LeakGuard blocks the whole batch.
3. Expected: no partial sanitized preview and no partial file handoff.

## Raw Preview Must Never Appear

For every drag/drop case:

- `rawPreviewSeen` must remain false in the QA fixture.
- `rawPreviewBeforeSanitized` must remain false.
- No original filename containing unsafe text should appear in user-visible state.
- Raw file content must not appear in the composer, preview, sent messages, logs, debug output, or fixture file events.

## Attach-Button Regression

Repeat attach-button checks for:

- One supported image.
- One supported text-like file.
- PDF, DOCX, and XLSX.
- Two supported files.
- Five supported files.
- Six files blocked before read.
- Unsupported file blocked.
- One failed file in a batch blocks all.

## Clipboard Paste Regression

Repeat clipboard checks for:

- Text and multiline text redaction.
- Supported clipboard image paste.
- Unsupported clipboard image paste blocked.
- No raw image preview before sanitized handoff.
