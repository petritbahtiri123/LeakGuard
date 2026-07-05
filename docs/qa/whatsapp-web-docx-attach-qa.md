# WhatsApp Web DOCX Attach QA

Use this checklist for WhatsApp Web DOCX document support. The single-file path supports one DOCX selected from the attach button and handed to WhatsApp only as a rebuilt sanitized `.redacted.docx` file. Phase 4 also supports 2-5 sanitized multi-file attach for supported DOCX files, XLSX files, PDFs, text documents, and images.

## Test Setup

1. Build or load the current unpacked extension.
2. Open `https://web.whatsapp.com/` in a browser profile with LeakGuard enabled.
3. Confirm WhatsApp text send protection still redacts typed and multiline text before starting attachment checks.
4. Confirm single text-document attach, single PDF attach, and single image attach/paste still work in the same build.
5. Use only fake LGQA values. Do not use real credentials, customer files, private documents, or private filenames.

## Safe WhatsApp Test Chat

Use a private test chat, a self-chat, or a dedicated QA group with no real recipients. Do not run these checks in a production or customer conversation.

## Supported DOCX Attach-Button Test

Create a DOCX with a safe name such as `lgqa-wa-docx.docx` and this text content:

```text
LGQA_WA_DOCX_1
OPENAI_API_KEY=sk-proj-LGQAFakeOpenAIKey1234567890
GITHUB_TOKEN=ghp_LGQAFakeGithubToken1234567890
DATABASE_URL=postgres://admin:FakePass123@db.example.com:5432/customerdb
```

Expected sanitized DOCX text:

```text
LGQA_WA_DOCX_1
OPENAI_API_KEY=[PWM_1]
GITHUB_TOKEN=[PWM_2]
DATABASE_URL=postgres://admin:[PWM_3]@db.example.com:5432/customerdb
```

Steps:

1. Click the WhatsApp attach button.
2. Select exactly one DOCX.
3. Confirm LeakGuard shows local DOCX extraction/redaction/rebuild status.
4. Confirm no WhatsApp preview appears before LeakGuard finishes.
5. Confirm WhatsApp receives only the rebuilt `.redacted.docx` file.
6. Confirm the raw fake secret strings never appear in the preview, composer, page text, debug UI, or error UI.
7. Send from the WhatsApp preview only after the sanitized DOCX preview appears.

## Blocked DOCX Cases

Try each DOCX one at a time:

- Malformed DOCX.
- Encrypted or unreadable DOCX.
- Image-only DOCX with no extractable text.
- DOCX rebuild failure injection, if available.

Expected:

- LeakGuard blocks the selection.
- WhatsApp does not show a raw preview.
- No file is sent.
- No extracted text is inserted into the WhatsApp composer.
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

Select two or more files, including combinations of supported DOCX files, XLSX files, PDFs, text documents, and images.

Expected:

- 2-5 supported files are sanitized locally and assigned back to WhatsApp only as sanitized `File` objects in input order.
- 6+ files are blocked before read.
- Any unsupported or failing file blocks the whole batch all-or-nothing, with no partial handoff.

## Raw DOCX Confirmation

For every pass and block case, confirm:

- The original selected DOCX is consumed or cleared before WhatsApp can preview it.
- WhatsApp receives a sanitized DOCX `File` object only after LeakGuard finishes rebuilding it.
- If sanitized handoff cannot be verified, the flow blocks.
- LeakGuard never inserts extracted DOCX text into the WhatsApp composer as fallback.

## Regression Checks

After DOCX attach checks, verify these still work:

- WhatsApp typed text redaction.
- WhatsApp multiline text redaction.
- WhatsApp clipboard image paste for PNG, JPG/JPEG, or WEBP.
- WhatsApp attach-button image support for exactly one PNG, JPG/JPEG, or WEBP.
- WhatsApp attach-button text-document support for exactly one `.txt`, `.env`, `.json`, `.log`, `.md`, or `.csv`.
- WhatsApp attach-button PDF support for exactly one rebuilt sanitized PDF.
- WhatsApp attach-button XLSX support for exactly one rebuilt sanitized XLSX.
- WhatsApp attach-button multi-file support for 2-5 supported sanitized files.

## Still Out Of Scope

- Raw direct file input passthrough.
