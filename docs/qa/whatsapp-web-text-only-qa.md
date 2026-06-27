# WhatsApp Web Text-Only Protected-Site QA

Use only a controlled test chat, such as a self-chat or a test account. Do not use real credentials, private files, customer data, or production secrets.

## Scope

- Target: `https://web.whatsapp.com/*`
- Supported in this phase: message composer text only.
- Unsupported in this phase: attachments, files, images, videos, documents, and file fallback insertion.
- Expected fail-closed behavior: if LeakGuard cannot detect the composer, extract text, redact, rewrite, verify, or replay the send safely, nothing is sent.

## Manual Checklist

1. Open `https://web.whatsapp.com/`.
2. Open a controlled test chat.
3. Type `LGQA_WHATSAPP_TEXT_1 my password is SuperFakePassword123456789!`.
4. Click Send once.
5. Confirm the sent message is `LGQA_WHATSAPP_TEXT_1 my password is [PWM_1]`.
6. Confirm `SuperFakePassword123456789!` never appears in the sent message.
7. Repeat with Enter-to-send using `LGQA_WHATSAPP_TEXT_2 my password is SuperFakePassword123456789!`.
8. Confirm only the sanitized message is sent.
9. Type `LGQA_WHATSAPP_PLACEHOLDER_1 my password is [PWM_2]`.
10. Click Send once and confirm `[PWM_2]` remains unchanged with no redaction loop.
11. Try a file/image/document attachment.
12. Confirm LeakGuard blocks or ignores the raw attachment safely and does not attempt sanitized handoff or text fallback insertion.

## Browser QA Contract

Automated browser QA metadata tracks these required cases:

- First click sends sanitized text.
- Enter sends sanitized text.
- Raw fake secret is never sent.
- Trusted `[PWM_1]` and `[PWM_2]` placeholders do not loop.
- Redaction failure blocks send.
- Composer-not-found blocks send.
- Rewrite verification failure blocks send.
- Programmatic replay does not recurse.
- Second-click retry is not accepted as success.
- Attachment attempt remains unsupported and blocked.

## Root Cause Notes

- WhatsApp Web is a real messaging surface, so risk-gated interception is not enough. WhatsApp text sends now own non-empty send attempts and use the verified replay path even when quick analysis finds no issue.
- WhatsApp previously shared the file handoff adapter shape used by AI/chat surfaces. That could allow sanitized file handoff or sanitized text fallback behavior that is not supported for WhatsApp in this phase.
- The WhatsApp adapter is now text-only: no file input assignment, no pending attach, no trusted attach button, and no upload trigger resolution.
- The shared file handoff flow has a WhatsApp hard stop so future callers cannot accidentally insert sanitized file text into a WhatsApp message.
