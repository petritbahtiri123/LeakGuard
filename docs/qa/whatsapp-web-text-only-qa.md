# WhatsApp Web Text Protected-Site QA

Use only a controlled test chat, such as a self-chat or a test account. Do not use real credentials, private files, customer data, or production secrets.

## Scope

- Target: `https://web.whatsapp.com/*`
- Supported in this checklist: message composer text. Supported image attach/paste and Phase 3A text-document attach paths have separate QA checklists.
- Unsupported in this text checklist: videos, arbitrary files, multi-file upload, file fallback insertion, and PDF/DOCX/XLSX WhatsApp attach.
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
11. Try a PDF, DOCX, or XLSX attachment.
12. Confirm LeakGuard blocks the raw attachment safely and does not attempt sanitized handoff or text fallback insertion.

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
- Single supported text-document attach is covered by `docs/qa/whatsapp-web-text-document-attach-qa.md`.
- PDF/DOCX/XLSX attachment attempts remain blocked.
- Multi-file attachment attempts remain blocked.

## Root Cause Notes

- WhatsApp Web is a real messaging surface, so risk-gated interception is not enough. WhatsApp text sends now own non-empty send attempts and use the verified replay path even when quick analysis finds no issue.
- WhatsApp previously shared the file handoff adapter shape used by AI/chat surfaces. That could allow broad sanitized file handoff or sanitized text fallback behavior that is not supported for WhatsApp.
- The WhatsApp adapter keeps generic file support disabled: no pending attach, no trusted attach button, no upload trigger resolution, no PDF/DOCX/XLSX handoff, and no multi-file handoff.
- The shared file handoff flow has a WhatsApp hard stop for generic handoff so future callers cannot accidentally insert sanitized file text into a WhatsApp message.
