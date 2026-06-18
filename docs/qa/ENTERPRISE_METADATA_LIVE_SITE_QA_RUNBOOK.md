# Enterprise Metadata Live Site QA Runbook

Use this runbook for live logged-in manual QA of enterprise, cloud, and internal metadata detection on real AI sites.

Rules:

- Use only synthetic fixtures from `tests/fixtures/manual/live-site-qa/` or generated files from `artifacts/manual-qa/enterprise-metadata/`.
- Do not use real customer data, internal data, credentials, production hostnames, or private files.
- Keep testing local-only. Do not add backend calls, telemetry, remote verification, or cloud processing.
- Record results in [Enterprise Metadata Live Manual QA Results](ENTERPRISE_METADATA_LIVE_MANUAL_QA_RESULTS.md).

## Prepare Local Upload Fixtures

Run:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/create-enterprise-live-qa-fixtures.ps1
```

Generated files are written under `artifacts/manual-qa/enterprise-metadata/`.

For CSV scanner/upload coverage, select this generated file directly:

```text
artifacts/manual-qa/enterprise-metadata/enterprise_metadata_live_qa.csv
```

## Chrome

1. Run `npm run build:chrome`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Load unpacked `dist/chrome`.
5. Open ChatGPT.
6. Open Gemini.
7. Confirm the LeakGuard badge/status shows the site is protected.
8. Test typed payload from `tests/fixtures/manual/live-site-qa/chatgpt_gemini_typed_paste_payload.txt`.
9. Test paste payload from `tests/fixtures/manual/live-site-qa/chatgpt_gemini_typed_paste_payload.txt`.
10. Test upload/drop generated files from `artifacts/manual-qa/enterprise-metadata/`, including `artifacts/manual-qa/enterprise-metadata/enterprise_metadata_live_qa.csv`.
11. Test image OCR if available using `tests/fixtures/manual/live-site-qa/image_ocr_payload.txt` rendered or screenshotted into a local image.
12. Verify raw metadata does not reach the composer or sent message.
13. Verify harmless values remain visible where the active transform mode allows them.
14. Verify placeholder reveal works.
15. Verify already-redacted text does not get corrupted on rerun.

## Firefox

1. Run `npm run build:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click `Load Temporary Add-on`.
4. Select `dist/firefox/manifest.json`.
5. Repeat the ChatGPT and Gemini tests from the Chrome section.

## Gemini-Specific Checks

- Drag/drop file.
- Fallback insertion.
- Pending attach behavior.
- No raw file replay after sanitized handoff failure.
- Redacted image file-only handoff still works.

## Failure Handling

- If raw metadata appears in composer or sent prompt, copy a sanitized synthetic version into a fixture and add a regression test.
- If placeholder corruption appears, capture before/after text.
- If file upload fails closed, note it separately from leak failure.
- If raw unsupported image upload proceeds, block release.

## Expected Results

See `tests/fixtures/manual/live-site-qa/expected_redaction_notes.md` for expected placeholder families and harmless controls.

Automated release-candidate checks are green locally, but release should wait for live logged-in manual QA on ChatGPT and Gemini at minimum.
