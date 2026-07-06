# WhatsApp Web Image Attach QA

Use this checklist for WhatsApp Web image attach support. The single-file image path supports one attach-button image at a time: PNG, JPG/JPEG, or WEBP only. The multi-file path supports 2-20 small sanitized files for supported images, text documents, PDFs, DOCX files, and XLSX files.

## Test setup

1. Load the Chrome extension build with protected-site OCR available.
2. Open `https://web.whatsapp.com/`.
3. Confirm LeakGuard shows WhatsApp Web as protected.
4. Prepare one PNG, one JPG/JPEG, and one WEBP test image that visibly contains synthetic secrets only.

## Safe WhatsApp test chat

Use a dedicated safe test chat, such as a self-chat or internal QA chat. Do not use a real customer, vendor, or production conversation.

## PNG/JPG/WEBP attach-button test

1. Click WhatsApp's attach button.
2. Select exactly one supported image.
3. Confirm LeakGuard intercepts the selection and shows local scanning/redaction progress.
4. Confirm no WhatsApp preview appears before LeakGuard finishes.
5. If OCR/redaction succeeds, confirm the preview shows the redacted PNG output only.
6. Send only after confirming the preview is sanitized.

## Expected sanitized preview behavior

- WhatsApp receives only a LeakGuard redacted PNG, with a `.redacted.png` style output name where visible.
- The original raw image must not appear in the preview.
- OCR text must not be inserted into the message composer as a fallback.
- The message composer text path should remain unchanged unless the user typed text separately.

## OCR unavailable or failed

If OCR is unavailable, OCR fails, visual boxes are unsafe, or redacted PNG creation fails:

1. LeakGuard blocks the attach.
2. WhatsApp preview does not open.
3. Nothing is sent or queued.
4. The raw image does not appear in the DOM preview or input flow.

## Unsupported image blocked

Try GIF, BMP, SVG, ICO, or another unsupported image type.

Expected: LeakGuard blocks the attach, shows a fail-closed message, and WhatsApp does not show a preview.

## Multi-File

Select two or more files, including two supported images.

Expected:

- 2-20 small supported files are sanitized locally and assigned back to WhatsApp only as sanitized `File` objects in input order.
- 21+ small files or 6+ large files are blocked before read.
- Any unsupported file, OCR failure, or redaction failure blocks the whole batch all-or-nothing, with no partial handoff.

## Regression checks

1. Paste a PNG/JPG/WEBP image from the clipboard into WhatsApp and confirm the Phase 1 clipboard path still works or fails closed safely.
2. Send a normal text message with synthetic secrets and confirm text redaction still works.
3. Send multiline text with synthetic secrets and confirm line breaks and redaction are preserved.
4. Confirm text-document attach still supports canonical LeakGuard text-like files, including `Dockerfile` and `Makefile`, and blocks unsupported extensionless files.

## Out of scope

Videos, arbitrary files, file paste, 21+ small file batches, 6+ large file batches, unsupported mixed batches, and failing image batches remain blocked fail-closed. WhatsApp drag/drop supports 1-20 small sanitized files for canonical supported types. Single text-document, single-PDF, single-DOCX, and single-XLSX attach checks are covered separately.
