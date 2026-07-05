# WhatsApp Web Text Document Attach QA

Use this checklist for WhatsApp Web text-document support. The attach-button path supports canonical LeakGuard text-like files from `src/shared/fileTypeRegistry.js`, including extensionless `Dockerfile` and `Makefile`. Phase 5A also supports 2-5 sanitized multi-file attach for supported text documents, PDFs, DOCX files, XLSX files, and images.

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
- `lgqa-wa-doc.md`
- `lgqa-wa-doc.markdown`
- `lgqa-wa-doc.env`
- `lgqa-wa-doc.log`
- `lgqa-wa-doc.json`
- `lgqa-wa-doc.yaml`
- `lgqa-wa-doc.yml`
- `lgqa-wa-doc.pem`
- `lgqa-wa-doc.key`
- `lgqa-wa-doc.toml`
- `lgqa-wa-doc.xml`
- `lgqa-wa-doc.csv`
- `lgqa-wa-doc.ini`
- `lgqa-wa-doc.conf`
- `lgqa-wa-doc.cfg`
- `lgqa-wa-doc.ps1`
- `lgqa-wa-doc.sh`
- `lgqa-wa-doc.bash`
- `lgqa-wa-doc.zsh`
- `lgqa-wa-doc.bat`
- `lgqa-wa-doc.cmd`
- `lgqa-wa-doc.py`
- `lgqa-wa-doc.js`
- `lgqa-wa-doc.jsx`
- `lgqa-wa-doc.ts`
- `lgqa-wa-doc.tsx`
- `lgqa-wa-doc.html`
- `lgqa-wa-doc.css`
- `lgqa-wa-doc.scss`
- `lgqa-wa-doc.java`
- `lgqa-wa-doc.c`
- `lgqa-wa-doc.cpp`
- `lgqa-wa-doc.h`
- `lgqa-wa-doc.hpp`
- `lgqa-wa-doc.cs`
- `lgqa-wa-doc.go`
- `lgqa-wa-doc.rs`
- `lgqa-wa-doc.rb`
- `lgqa-wa-doc.php`
- `lgqa-wa-doc.sql`
- `Dockerfile`
- `Makefile`

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

## Unsupported Files

Try unsupported files such as:

- extensionless files that are not `Dockerfile` or `Makefile`
- MIME-only text files with unsupported names
- `.exe`
- `.bin`
- `.gif`
- `.svg`
- `.zip`

Expected: blocked fail-closed with no raw preview, no send, and no raw filename or raw content in UI/debug summaries.

## Multi-File

Select two or more files, including combinations of supported text documents, supported PDFs, supported DOCX files, supported XLSX files, and supported images.

Expected:

- 2-5 supported files are sanitized locally and assigned back to WhatsApp only as sanitized `File` objects in input order.
- 6+ files are blocked before read.
- Any unsupported or failing file blocks the whole batch all-or-nothing, with no partial handoff.

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
- WhatsApp attach-button PDF support for exactly one rebuilt sanitized PDF.
- WhatsApp attach-button DOCX support for exactly one rebuilt sanitized DOCX.
- WhatsApp attach-button XLSX support for exactly one rebuilt sanitized XLSX.
- WhatsApp attach-button multi-file support for 2-5 supported sanitized files.

## Still Out Of Scope

- Raw direct file input passthrough.
- WhatsApp drag/drop file attach. Keep drag/drop blocked until Phase 5B.
- WhatsApp file paste.
