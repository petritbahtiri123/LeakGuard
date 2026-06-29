# WhatsApp Web Clipboard Image Paste QA

Use this checklist for Phase 1 WhatsApp file/image support. This phase supports clipboard image paste only; the WhatsApp attach button, document uploads, multi-file uploads, and non-image files remain unsupported and must fail closed.

## Harmless test screenshot

1. Open a local page or note that contains only harmless text, for example: `LeakGuard QA screenshot - no real secrets`.
2. Take a small screenshot with the OS screenshot tool.
3. Copy the screenshot to the clipboard instead of saving/uploading a file.
4. Do not use a screenshot containing real credentials, private chat content, account numbers, or production data.

## Safe WhatsApp test chat

1. Open `https://web.whatsapp.com/` in a browser with the LeakGuard extension loaded.
2. Select a safe test chat, such as your own test account, a dedicated QA group, or another consenting tester.
3. Do not test in a production/customer chat.
4. Confirm normal WhatsApp text typing and paste still work before image testing.

## Expected sanitized image behavior

1. Paste the copied screenshot into the WhatsApp message composer.
2. LeakGuard must intercept and consume the original paste before WhatsApp can accept the raw clipboard image.
3. LeakGuard should show local image/OCR redaction progress.
4. If OCR/redaction succeeds, WhatsApp should receive only the sanitized/redacted image.
5. The WhatsApp image preview should appear only after LeakGuard has finished and handed off the sanitized image.
6. Confirm the preview/file name is synthetic/safe and does not expose an original local filename or raw clipboard metadata.
7. Send only after verifying the preview is the sanitized image expected for the test.

## Expected fail-closed behavior if OCR is unavailable

1. Temporarily test with OCR unavailable or disabled, or use the QA build/failure injection path if available.
2. Paste a PNG/JPG/WEBP image into the WhatsApp composer.
3. LeakGuard must block the paste and show a clear raw image upload blocked/fail-closed message.
4. WhatsApp must not show a raw image preview.
5. Nothing should be sent or queued in WhatsApp.

## Raw preview exclusion

For every PNG, JPG/JPEG, and WEBP clipboard-image paste test, confirm:

- The raw image never appears in WhatsApp preview before LeakGuard finishes.
- If LeakGuard fails OCR/redaction, no WhatsApp preview appears at all.
- Unsupported GIF, BMP, SVG, documents, attach-button files, and multi-file pastes remain blocked.

## Text regression checks

1. Paste normal harmless text into WhatsApp; it should still work.
2. Paste text containing a fake test secret, such as `OPENAI_API_KEY=sk-proj-LeakGuardQaFakeSecret1234567890`; LeakGuard should rewrite/redact it before send.
3. Send a harmless single-line text message.
4. Send a harmless multiline text message.
5. Confirm text rewrite verification still blocks unsafe sends if redaction cannot be verified.
