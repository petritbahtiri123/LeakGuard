# WhatsApp Web Text Protected-Site QA

Use only a controlled test chat, such as a self-chat or a test account. Do not use real credentials, private files, customer data, or production secrets.

## Scope

- Target: `https://web.whatsapp.com/*`
- Supported in this checklist: message composer text. Supported image attach/paste, single-file document attach, and Phase 4 multi-file attach paths have separate QA checklists.
- Unsupported in this text checklist: videos, arbitrary files, clipboard document/multi-file paste, 6+ file batches, unsupported or failing multi-file batches, and file fallback insertion.
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
11. Confirm XLSX attach QA is covered separately in `docs/qa/whatsapp-web-xlsx-attach-qa.md`.

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
- Single supported PDF attach is covered by `docs/qa/whatsapp-web-pdf-attach-qa.md`.
- Single supported DOCX attach is covered by `docs/qa/whatsapp-web-docx-attach-qa.md`.
- Single supported XLSX attach is covered by `docs/qa/whatsapp-web-xlsx-attach-qa.md`.
- WhatsApp supports canonical LeakGuard text-like attach files, including `Dockerfile` and `Makefile`.
- WhatsApp supports 2-5 sanitized multi-file attach for supported types.
- WhatsApp blocks 6+ files before read.
- WhatsApp blocks unsupported extensionless and MIME-only unsupported attach files.
- WhatsApp blocks unsupported or failing multi-file batches all-or-nothing.
- WhatsApp drag/drop supports 1-5 sanitized files for canonical supported types; see `docs/qa/whatsapp-web-drag-drop-qa.md`.

## Root Cause Notes

- WhatsApp Web is a real messaging surface, so risk-gated interception is not enough. WhatsApp text sends now own non-empty send attempts and use the verified replay path even when quick analysis finds no issue.
- WhatsApp previously shared the file handoff adapter shape used by AI/chat surfaces. That could allow broad sanitized file handoff or sanitized text fallback behavior that is not supported for WhatsApp.
- The WhatsApp adapter keeps generic file support disabled: no pending attach, no trusted attach button, no upload trigger resolution, no raw drag/drop passthrough, and no generic multi-file handoff. Only narrow sanitized image, text-document, PDF, DOCX, XLSX, 2-5 supported multi-file attach-button, and 1-5 supported drag/drop handoff capabilities are enabled.
- The shared file handoff flow has a WhatsApp hard stop for generic handoff so future callers cannot accidentally insert sanitized file text into a WhatsApp message.
