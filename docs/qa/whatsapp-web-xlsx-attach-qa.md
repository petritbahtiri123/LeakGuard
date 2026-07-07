# WhatsApp Web XLSX Attach QA

Use this checklist for WhatsApp Web XLSX document support. The single-file path supports one XLSX selected from the attach button and handed to WhatsApp only as a rebuilt sanitized `.redacted.xlsx` file. The multi-file path supports sanitized files for supported XLSX files, DOCX files, PDFs, text documents, and images within the protected-site small/large batch caps.

## Test Setup

1. Build or load the current unpacked extension.
2. Open `https://web.whatsapp.com/` in a browser profile with LeakGuard enabled.
3. Confirm WhatsApp text send protection still redacts typed and multiline text before starting attachment checks.
4. Confirm single text-document attach, single PDF attach, single DOCX attach, and single image attach/paste still work in the same build.
5. Use only fake LGQA values. Do not use real credentials, customer files, private spreadsheets, or private filenames.

## Safe WhatsApp Test Chat

Use a private test chat, a self-chat, or a dedicated QA group with no real recipients. Do not run these checks in a production or customer conversation.

## Supported XLSX Attach-Button Test

Create an XLSX with a safe name such as `lgqa-wa-xlsx.xlsx` and these cell values:

```text
Sheet1!A1 = LGQA_WA_XLSX_1
Sheet1!A2 = OPENAI_API_KEY
Sheet1!B2 = sk-proj-LGQAFakeOpenAIKey1234567890
Sheet1!A3 = GITHUB_TOKEN
Sheet1!B3 = ghp_LGQAFakeGithubToken1234567890
Sheet1!A4 = DATABASE_URL
Sheet1!B4 = postgres://admin:FakePass123@db.example.com:5432/customerdb
```

Expected sanitized workbook text:

```text
Sheet1!A1 = LGQA_WA_XLSX_1
Sheet1!A2 = OPENAI_API_KEY
Sheet1!B2 = [PWM_1]
Sheet1!A3 = GITHUB_TOKEN
Sheet1!B3 = [PWM_2]
Sheet1!A4 = DATABASE_URL
Sheet1!B4 = postgres://admin:[PWM_3]@db.example.com:5432/customerdb
```

Steps:

1. Click the WhatsApp attach button.
2. Select exactly one XLSX.
3. Confirm LeakGuard consumes or clears the original input before WhatsApp can preview it.
4. Confirm LeakGuard shows local XLSX extraction/redaction/rebuild status.
5. Confirm no WhatsApp preview appears before LeakGuard finishes.
6. Confirm WhatsApp receives only the rebuilt `.redacted.xlsx` file.
7. Confirm the raw fake secret strings never appear in the preview, composer, page text, debug UI, or error UI.
8. Send from the WhatsApp preview only after the sanitized XLSX preview appears.

## Blocked XLSX Cases

Try each XLSX one at a time:

- Encrypted XLSX.
- Malformed XLSX.
- Unsupported XLSX compression or unsupported workbook structure.
- XLSX with no extractable spreadsheet text.
- XLSX rebuild failure injection, if available.

Expected:

- LeakGuard blocks the selection.
- WhatsApp does not show a raw preview.
- No file is sent.
- No extracted text is inserted into the WhatsApp composer.
- No raw original filename or raw fake secret appears in the block UI.

## Unsupported Files

Try unsupported files such as:

- `.xls`
- `.xlsm`
- `.exe`
- `.bin`
- `.gif`
- `.svg`
- `.zip`

Expected: blocked fail-closed with no raw preview, no send, and no raw filename or raw content in UI/debug summaries.

## Multi-File

Select two or more files, including combinations of supported XLSX files, DOCX files, PDFs, text documents, and images.

Expected:

- In-cap supported files are sanitized locally and assigned back to WhatsApp only as sanitized `File` objects in input order.
- Over-cap batches are blocked before read.
- Any unsupported or failing file blocks the whole batch all-or-nothing, with no partial handoff.

## Raw XLSX Confirmation

For every pass and block case, confirm:

- The original selected XLSX is consumed or cleared before WhatsApp can preview it.
- WhatsApp receives a sanitized XLSX `File` object only after LeakGuard finishes rebuilding it.
- If sanitized handoff cannot be verified, the flow blocks.
- LeakGuard never inserts extracted XLSX text into the WhatsApp composer as fallback.

## Regression Checks

After XLSX attach checks, verify these still work:

- WhatsApp typed text redaction.
- WhatsApp multiline text redaction.
- WhatsApp clipboard image paste for PNG, JPG/JPEG, or WEBP.
- WhatsApp attach-button image support for exactly one PNG, JPG/JPEG, or WEBP.
- WhatsApp attach-button text-document support for canonical LeakGuard text-like files, including `Dockerfile` and `Makefile`; unsupported extensionless files remain blocked.
- WhatsApp attach-button PDF support for exactly one rebuilt sanitized PDF.
- WhatsApp attach-button DOCX support for exactly one rebuilt sanitized DOCX.
- WhatsApp attach-button multi-file support for in-cap supported sanitized files.
- WhatsApp drag/drop supports single-file and in-cap multi-file sanitized handoff for canonical supported types; see `docs/qa/whatsapp-web-drag-drop-qa.md`.

## Still Out Of Scope

- Raw direct file input passthrough.
- Legacy XLS, XLSM, macros, formulas as executable content, charts, styles, comments, hidden sheets, metadata, custom XML, calc chains, media, and layout-preserving workbook reconstruction.
