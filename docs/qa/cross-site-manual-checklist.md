# Cross-Site Manual QA Checklist

Use this checklist for manual LeakGuard verification on protected chat composer sites.

For the focused post-PR 4I file attach checkpoint, use `docs/qa/file-attach-manual-checkpoint-after-pr4i.md`.

For the enterprise/cloud/internal metadata release candidate, review [Enterprise Metadata Release-Candidate Evidence](../ENTERPRISE_METADATA_RELEASE_CANDIDATE_EVIDENCE.md) and record live logged-in provider results in [Enterprise Metadata Live Manual QA Results](ENTERPRISE_METADATA_LIVE_MANUAL_QA_RESULTS.md).

Local evidence refresh commands:

```powershell
npm run docs:check-links
node tests/security.test.js
node tests/productization.test.js
node tests/build_targets.test.js
git diff --check
```

Sites:
- ChatGPT
- Gemini
- Claude
- Grok

Browsers:
- Chrome MV3 build
- Firefox MV3 build

## Ground Rules

- Use only the synthetic values in this document.
- Do not paste real credentials, production hostnames, customer data, or private files.
- Keep DevTools Network open while testing. Expected result: no LeakGuard backend, telemetry, cloud secret verification, or remote model request is made.
- After each redaction, inspect the composer before sending. Expected result: no raw synthetic secret remains in the composer.
- Use a fresh page load when a case says "new session".
- Record browser, site, extension build, test date, pass/fail, and notes.

## Browser Setup

Chrome:
1. Run `npm run build:chrome` if a fresh build is needed.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click "Load unpacked" and select `dist/chrome`.
5. Pin LeakGuard.
6. Add or confirm the tested site is protected in the extension UI.
7. Open DevTools for the tested site and keep Console and Network visible.

Firefox:
1. Run `npm run build:firefox` if a fresh build is needed.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click "Load Temporary Add-on".
4. Select `dist/firefox/manifest.json`.
5. Add or confirm the tested site is protected in the extension UI.
6. Open DevTools for the tested site and keep Console and Network visible.

Repeat every test in both browsers unless the notes say a site-specific path is being tested.

## Synthetic Test Inputs

Single-line secret:

```text
API_KEY=LeakGuardManualApiKey1234567890abcdef
```

Natural-language secret:

```text
My password is ManualPass-1234567890!
```

Public IP and safe controls:

```text
resolver=8.8.8.8
private_ip=192.168.1.10
token_limit=4096
region=eu-central-1
```

Placeholder reuse input:

```text
API_KEY=LeakGuardReuseApiKey1234567890abcdef
Again same key: LeakGuardReuseApiKey1234567890abcdef
Plain repeat: LeakGuardReuseApiKey1234567890abcdef
```

Large paste input:

```text
OPENAI_API_KEY=sk-proj-ManualLargePaste111111111111111111111111111111111111
backup_key=sk-proj-ManualLargePaste111111111111111111111111111111111111
DATABASE_URL=postgres://admin:ManualDbPass123!@db.example.com:5432/app
AWS_SECRET_ACCESS_KEY=ManualAwsSecret1234567890abcdefFAKE
safe_line=0123456789abcdef0123456789abcdef0123456789abcdef
```

For large paste, repeat the `safe_line=...` line until the clipboard content is at least 20 KB.

Supported text file content:

```text
API_KEY=LeakGuardFileApiKey1234567890abcdef
DB_PASSWORD=LeakGuardFileDbPassword123!
Authorization: Bearer LeakGuardFileBearerToken1234567890
resolver=8.8.8.8
private_ip=192.168.1.10
token_limit=4096
```

Suggested file names:
- `leakguard-manual.env`
- `leakguard-manual.txt`
- `leakguard-manual.log`

Generated text attachment behavior input:

```text
Please summarize this redacted attachment and list only placeholders:
API_KEY=LeakGuardGeneratedAttachmentKey1234567890abcdef
DB_PASSWORD=LeakGuardGeneratedAttachmentPass123!
```

Decision modal input:

```text
username=manual.qa@example.invalid
resolver=8.8.8.8
```

Secure reveal input:

```text
API_KEY=LeakGuardRevealApiKey1234567890abcdef
DB_PASSWORD=LeakGuardRevealPassword123!
```

## Site Matrix

For each browser, run all checklist sections on each site:

| Site | URL |
| --- | --- |
| ChatGPT | `https://chatgpt.com/` |
| Gemini | `https://gemini.google.com/` |
| Claude | `https://claude.ai/` |
| Grok | `https://grok.com/` |
| WhatsApp Web | `https://web.whatsapp.com/` |

For WhatsApp Web, use [../WHATSAPP_SUPPORT_MATRIX.md](../WHATSAPP_SUPPORT_MATRIX.md) and the dedicated WhatsApp QA checklists for current support. WhatsApp does not use extracted-text fallback into the composer, supports attach/drop single-file and in-cap multi-file sanitized handoff, blocks over-cap batches before read, and keeps file paste out of scope except clipboard image paste.

## 1. Typing

Steps:
1. Open a new chat.
2. Type `API_KEY=` normally.
3. Type `LeakGuardManualApiKey1234567890abcdef`.
4. Do not press Send until the composer settles.

Expected result:
- LeakGuard intercepts or rewrites before submission.
- Composer shows `API_KEY=[PWM_N]`.
- Raw value `LeakGuardManualApiKey1234567890abcdef` is not visible.
- No duplicate text appears.
- Caret remains usable and typing normal text afterward still works.
- No remote LeakGuard network request appears.

Repeat with:

```text
My password is ManualPass-1234567890!
```

Expected result:
- Password value becomes `[PWM_N]`.
- Label text remains visible.

## 2. Paste

Steps:
1. Copy the single-line secret input.
2. Paste it into the composer.
3. Choose "Redact" if a decision modal appears.

Expected result:
- Raw paste is consumed before the host page commits it.
- Composer shows `API_KEY=[PWM_N]`.
- No raw secret remains in the composer, DOM-visible editor text, or attachment preview.
- The site does not submit the message while the modal is open.

## 3. Large Paste

Steps:
1. Build the large paste input to at least 20 KB.
2. Paste into the composer.
3. Choose "Redact" if prompted.

Expected result:
- ChatGPT: LeakGuard may create a sanitized plain-text attachment handoff for large paste.
- Gemini, Claude, Grok: sanitized text should be inserted or the raw paste should be blocked if safe insertion fails.
- Repeated key uses the same placeholder in all occurrences.
- `DATABASE_URL` password is redacted while URL shape remains readable.
- Safe lines remain visible.
- Browser remains responsive; no multi-second freeze after the modal resolves.

## 4. File Upload Button

Steps:
1. Save the supported text file content as `leakguard-manual.env`.
2. Click the site's file upload or attachment button.
3. Select `leakguard-manual.env`.
4. Wait for LeakGuard processing and site handoff.

Expected result:
- File is read and redacted locally before the site receives it.
- Raw values `LeakGuardFileApiKey1234567890abcdef`, `LeakGuardFileDbPassword123!`, and `LeakGuardFileBearerToken1234567890` are not visible in composer text, file preview, or generated attachment content.
- Public IP `8.8.8.8` is replaced with `[PUB_HOST_N]`.
- Private IP `192.168.1.10` is replaced with `[PRIVATE_IP_N]`; `token_limit=4096` and safe context remain visible.
- Unsupported binary/document files follow current policy: pass through by default, or block in strict mode.

Gemini-specific expected result:
- If Gemini rejects sanitized file upload, LeakGuard inserts sanitized text into the editor instead.
- Sanitized Gemini fallback inserts once, not duplicated.
- Manual typing after insertion still works.

WhatsApp-specific expected result:
- Attach-button single-file and in-cap multi-file batches use sanitized `File` handoff only.
- Unsupported files, failing batches, and over-cap batches block before read with no raw preview and no extracted-text fallback.

## 5. Drag/Drop

Steps:
1. Drag `leakguard-manual.env` over the composer.
2. Observe dragover behavior before releasing.
3. Drop the file.

Expected result:
- File drag is accepted visually and raw file ingestion is blocked before host page handlers receive it.
- Sanitized file or sanitized text is handed off.
- Raw file content never appears in the composer.
- Dragging a non-file item is ignored by LeakGuard.
- A sanitized handoff event is not reprocessed.

Gemini-specific expected result:
- Drop into the Quill/contenteditable editor inserts sanitized content once.
- If upload handoff is unavailable, fallback sanitized text insertion is used.
- The editor does not freeze, duplicate prior content, or move text to the wrong composer.

WhatsApp-specific expected result:
- Drag/drop single-file and in-cap multi-file batches use sanitized `File` handoff only.
- Unsupported files, failing batches, and over-cap batches block before read with no raw preview and no extracted-text fallback.

## 6. Generated Text Attachment Behavior

Steps:
1. Use the generated text attachment behavior input as a pasted large text or `.txt` file upload, depending on the site.
2. Redact when prompted.
3. Ask the site to summarize the attached/pasted content.

Expected result:
- Any attachment or generated text source visible to the site contains placeholders only.
- The model response, attachment chip, file preview, or quoted/generated content does not reveal raw synthetic values.
- Placeholders shown in the generated response match the redacted content.

## 7. Placeholder Reuse

Steps:
1. Paste the placeholder reuse input.
2. Choose "Redact".

Expected result:
- All three occurrences of `LeakGuardReuseApiKey1234567890abcdef` become the same placeholder, for example `[PWM_1]`.
- No raw prefix or suffix remains attached to placeholders.
- Expected shape:

```text
API_KEY=[PWM_N]
Again same key: [PWM_N]
Plain repeat: [PWM_N]
```

## 8. Decisions: Allow Once, Session, Redact, Cancel

Use the decision modal input.

Allow Once:
1. Paste the decision modal input.
2. Choose "Allow once".
3. Continue typing harmless text in the same composer.

Expected result:
- Modal does not reopen for the same risk set.
- Adding a new risky value, such as another public IP, triggers a new decision.
- Allow-once state does not persist after page reload or a new composer session.

Session allow:
1. Choose the session-level allow option if present.
2. Repeat the same input in the same page session.

Expected result:
- Same allowed risk does not repeatedly block in that session.
- New risk still prompts.
- Reloading or starting a fresh browser session clears the expected session-scoped behavior.

Redact:
1. Paste the decision modal input.
2. Choose "Redact".

Expected result:
- `8.8.8.8` becomes `[PUB_HOST_N]`.
- Safe `username=manual.qa@example.invalid` handling follows current severity/policy.
- No raw public IP remains.

Cancel:
1. Paste the decision modal input.
2. Choose "Cancel" or close the modal.

Expected result:
- Host page does not send the prompt.
- Raw risky content is not newly committed by LeakGuard.
- Composer remains editable.

Keyboard behavior:
- Press Enter or Space while a modal button is focused.
- Expected result: the modal consumes the key; the host site does not send the prompt underneath.

## 9. Secure Reveal

Steps:
1. Paste the secure reveal input.
2. Choose "Redact".
3. Open the LeakGuard popup or reveal surface.
4. Reveal each placeholder.

Expected result:
- Reveal works only for placeholders in the active LeakGuard session.
- Raw values are shown only inside the extension-owned reveal surface.
- Raw values are not written back into the site composer.
- Unknown placeholders typed manually, such as `[PWM_99999]`, are not treated as trusted session values.

## 10. Performance and Lag

Steps:
1. Run typing, paste, large paste, upload, and drag/drop cases.
2. Watch input latency, modal opening, and editor responsiveness.
3. Repeat large paste and file drop twice on the same page.

Expected result:
- Normal typing remains responsive.
- Large paste and file handling do not freeze the tab.
- Dragover does not stutter or require precise composer targeting.
- Repeated file drops do not duplicate previous editor content.
- Browser memory does not grow unbounded across repeated runs.

## 11. Final Raw Secret Sweep

After every redaction case, search visible composer text, attachment previews, and generated attachment text for these strings:

```text
LeakGuardManualApiKey1234567890abcdef
ManualPass-1234567890!
LeakGuardReuseApiKey1234567890abcdef
sk-proj-ManualLargePaste111111111111111111111111111111111111
ManualDbPass123!
ManualAwsSecret1234567890abcdefFAKE
LeakGuardFileApiKey1234567890abcdef
LeakGuardFileDbPassword123!
LeakGuardFileBearerToken1234567890
LeakGuardGeneratedAttachmentKey1234567890abcdef
LeakGuardGeneratedAttachmentPass123!
LeakGuardRevealApiKey1234567890abcdef
LeakGuardRevealPassword123!
8.8.8.8
```

Expected result:
- None of the raw secret values remain after redaction.
- `8.8.8.8` is absent when public-network hiding is enabled.
- Safe controls remain readable where expected.

## Result Template

```text
Date:
Tester:
Build:
Browser:
Site:
Protected-site entry:

Typing:
Paste:
Large paste:
File upload button:
Drag/drop:
Generated text attachment behavior:
Placeholder reuse:
Allow once/session/redact/cancel:
Secure reveal:
Performance/lag:
Raw secret sweep:

Failures:
Screenshots/log references:
Notes:
```
