# Browser QA Playbook

Use when Chrome, Edge, Firefox, extension smoke, or browser QA harness checks fail.

## First Move
Capture the safe failure coordinates:

- browser
- site or built-in/user-managed target
- command
- failure code
- stage
- input path: typed, paste, drop, file input, scanner, reveal, popup, policy
- canary ID or fixture ID

Do not print raw secrets, raw prompts, raw file names, raw paths, screenshots containing private data, or full page text.

## Triage
1. Distinguish product security risk from UI/harness flake.
2. Check whether the raw canary leaked, redaction failed, rewrite verification failed, or a UI assertion missed a control.
3. Use safe JSON reports and canary IDs.
4. If runtime loading failed, check script order:
   - `src/shared/runtime_scripts.js`
   - `manifests/base.json`
   - `manifests/firefox.json`
   - `src/background/service_worker.js`
5. If file flow failed, use `file-handoff-fail-closed.md`.
6. If debug/report content is unsafe, use `debug-safety.md`.

## Validation
Run the failing command first, then the closest static guards:

```bash
npm run smoke:chrome
npm run smoke:firefox
node tests/browser_qa_assertions.test.js
node tests/security.test.js
node tests/build_targets.test.js
node tests/runtime_script_order.test.js
```

For full browser gates:

```bash
npm run qa:browser
```

Only summarize relevant safe failure lines in final responses.

## Fast And Full Matrix

Use the fast command for release/browser gates:

```bash
npm run qa:browser
```

Use the opt-in full matrix when hardening browser coverage or before broad file-flow releases:

```bash
npm run qa:browser:full
```

Both commands write sanitized JSON to `artifacts/browser-qa/browser-qa-report.json`.

Fast matrix:
- Text inputs: typed text and paste text through the local protected QA page.
- File inputs: `.env`, `.json`, `.log`, PDF, DOCX, XLSX, PNG OCR/redaction.
- File drop: PDF drag/drop sanitized handoff or fail-closed block.
- Controls: debug metadata-only checks, sanitized handoff checks, unsupported/malformed fail-closed checks.

Full matrix adds browser-path file input coverage for:
- Text: canonical `FileTypeRegistry.SUPPORTED_TEXT_EXTENSIONS`, plus basename-only `Dockerfile` and `Makefile`.
- Documents: `.pdf`, `.docx`, `.xlsx`.
- Images: `.png`, `.jpg`, `.jpeg`, `.webp`.
- Unsupported/unsafe controls: `.gif`, `.bmp`, `.ico`, `.svg`, unknown binary, malformed PDF/DOCX/XLSX, encrypted PDF, image-only PDF, legacy/macro Office formats.

Current follow-ups:
- Text drag/drop is not a real harness path yet; keep it documented until the local fixture can exercise it without synthetic flake.
- `.tf`, `.tfvars`, and `.properties` are not in `FileTypeRegistry.SUPPORTED_TEXT_EXTENSIONS`; add registry support and unit coverage before adding them to the browser supported matrix.

Safe failure output should name the stage, failure code, and canary IDs without raw values, for example:

```text
FILE_INPUT_REDACTION_FAILED: Chrome / local protected QA page / file input / sanitized handoff failed. Secret canaries checked: LGQA_SECRET_ENV, LGQA_EMAIL_ENV. Safety assessment: real security risk.
```
