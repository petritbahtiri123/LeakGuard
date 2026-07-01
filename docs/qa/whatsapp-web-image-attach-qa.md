# WhatsApp Web Image Attach QA

Use this checklist for Phase 2 WhatsApp Web support. This phase supports one attach-button image at a time: PNG, JPG/JPEG, or WEBP only.

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

## Multi-file blocked

Select two or more files, including two supported images.

Expected: LeakGuard blocks the batch, shows a fail-closed message, and WhatsApp does not show a preview.

## Regression checks

1. Paste a PNG/JPG/WEBP image from the clipboard into WhatsApp and confirm the Phase 1 clipboard path still works or fails closed safely.
2. Send a normal text message with synthetic secrets and confirm text redaction still works.
3. Send multiline text with synthetic secrets and confirm line breaks and redaction are preserved.

## Out of scope

Documents, PDFs, DOCX, XLSX, videos, arbitrary files, and WhatsApp multi-file attach remain unsupported in this phase.
