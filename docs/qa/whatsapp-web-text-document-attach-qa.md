# WhatsApp Web Text Document Attach QA

Use this checklist for Phase 3A WhatsApp Web document support. This phase supports exactly one text-based document selected from the attach button: `.txt`, `.env`, `.json`, `.log`, `.md`, and `.csv`.

## Test Setup

1. Build or load the current unpacked extension.
2. Open `https://web.whatsapp.com/` in a browser profile with LeakGuard enabled.
3. Confirm WhatsApp text send protection still redacts typed and multiline text before starting attachment checks.
4. Use only the fake LGQA values below. Do not use real credentials, customer files, or private filenames.

## Safe WhatsApp Test Chat

Use a private test chat, a self-chat, or a dedicated QA group with no real recipients. Do not run these checks in a production or customer conversation.

## Supported Attach-Button Documents

Create local files with safe names such as:

- `lgqa-wa-doc.txt`
- `lgqa-wa-doc.env`
- `lgqa-wa-doc.json`
- `lgqa-wa-doc.log`
- `lgqa-wa-doc.md`
- `lgqa-wa-doc.csv`

Example `.env` body:

```text
LGQA_WA_DOC_ENV_1=true
OPENAI_API_KEY=sk-proj-LGQAFakeOpenAIKey1234567890
GITHUB_TOKEN=ghp_LGQAFakeGithubToken1234567890
DATABASE_URL=postgres://admin:FakePass123@db.example.com:5432/customerdb
```

Expected sanitized content:

```text
LGQA_WA_DOC_ENV_1=true
OPENAI_API_KEY=[PWM_1]
GITHUB_TOKEN=[PWM_2]
DATABASE_URL=postgres://admin:[PWM_3]@db.example.com:5432/customerdb
```

For each supported file:

1. Click the WhatsApp attach button.
2. Select exactly one supported text document.
3. Confirm LeakGuard shows local scanning/redaction status.
4. Confirm WhatsApp preview receives only the sanitized document.
5. Confirm the raw secret strings never appear in the preview, composer, page text, debug UI, or error UI.
6. Send from the WhatsApp preview only after sanitized preview appears.

## Blocked Document Types

Try each file type one at a time:

- `.pdf`
- `.docx`
- `.xlsx`

Expected:

- LeakGuard blocks the selection.
- WhatsApp does not show a raw preview.
- No file is sent.
- No raw original filename or raw fake secret appears in the block UI.

## Unsupported Files

Try unsupported files such as:

- `.exe`
- `.bin`
- `.gif`
- `.svg`
- `.zip`

Expected: blocked fail-closed with no raw preview, no send, and no raw filename or raw content in UI/debug summaries.

## Multi-File

Select two or more files, including combinations of supported text documents and supported images.

Expected: blocked fail-closed. Phase 3A does not support multi-file WhatsApp attach.

## Raw Document Confirmation

For every pass and block case, confirm:

- The original selected file is consumed or cleared before WhatsApp can preview it.
- WhatsApp receives a sanitized `File` object only after LeakGuard finishes redaction.
- If sanitized handoff cannot be verified, the flow blocks.
- LeakGuard never inserts extracted document text into the WhatsApp composer as fallback.

## Regression Checks

After document attach checks, verify these still work:

- WhatsApp typed text redaction.
- WhatsApp multiline text redaction.
- WhatsApp clipboard image paste.
- WhatsApp attach-button image support for exactly one PNG, JPG/JPEG, or WEBP.

## Still Out Of Scope

- PDF attach support on WhatsApp.
- DOCX attach support on WhatsApp.
- XLSX attach support on WhatsApp.
- Multi-file WhatsApp attach.
- Raw direct file input passthrough.
