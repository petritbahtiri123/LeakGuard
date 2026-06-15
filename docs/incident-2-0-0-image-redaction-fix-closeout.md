# LeakGuard 2.0.x Image Redaction Incident Fix Closeout

Date: 2026-06-15
Status: patched candidate validated on home Windows dev machine

## Confirmed root cause

The local confirmed root cause was an output-validation gap in the protected-site visual image redaction path: a redactor result that reported success but produced an empty or invalid generated PNG `File` could be treated as safe for upload by the content file extraction pipeline. Real providers commonly reject zero-byte or malformed synthetic files, matching the rollout symptom where protected-site image redaction appeared to fail during image uploads.

The patch makes the image path fail closed unless the generated replacement is a usable `.redacted.png` file with MIME `image/png` and non-zero size. The lower-level image redactor now reports `image_redaction_empty_output` if canvas export returns an empty blob.

## Exact affected path

1. Protected-site image upload enters `ContentFileExtractionPipeline.processFileForAdapterHandoff()`.
2. OCR and box mapping produce an image redaction request.
3. `ImageRedactor.createRedactedPng()` creates a PNG blob.
4. The pipeline converts the blob/result file into `sanitizedFile` and marks it safe for file-only upload.
5. Before this patch, non-null was enough at the pipeline boundary; after this patch, the generated file must be non-empty, `image/png`, and named `*.redacted.png`.

## Environment validation

`npm run validate:codex-release-env` passed on the home Windows dev machine after repairing local environment diagnostics and stale dependencies:

- Node: `v24.16.0`
- npm: `11.16.0`
- Python: `Python 3.14.6`
- pip: `pip 26.1.2`
- Proxy variables: `HTTP_PROXY=`, `HTTPS_PROXY=`, `NO_PROXY=`
- pip dry-run resolution for `ai/requirements.txt`: passed
- `ai/.venv` build imports: `joblib`, `numpy`, `scipy`, `sklearn`, `skl2onnx` passed
- Chrome executable: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Edge executable: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
- Firefox executable: `C:\Program Files\Mozilla Firefox\firefox.exe`
- Browser preflight: passed

Local setup notes:

- `npm ci` was run because `node_modules` had stale `sharp@0.34.5` while `package-lock.json` and `package.json` require `sharp@0.35.0`.
- `scripts/validate-codex-cloud-release-env.mjs` was corrected for Windows `.cmd` execution, Windows browser install paths, `ai/.venv` import checks, and Windows browser version probe behavior. This changed validation tooling only, not extension runtime behavior.

## Package hash and size

Final Chrome release candidate:

- Path: `C:\Users\bajra\OneDrive\Documents\Development\LeakGuard\LeakGuard\artifacts\release\leakguard-chrome-v2.0.0.zip`
- Size: `8024141` bytes
- SHA256: `45535A6D285E8BD8246DB44890550E933509980A2C0A7F5C3C2DF1192E011D1B`

Other package sizes from release artifact validation:

- `leakguard-chrome-enterprise-v2.0.0.zip`: `8024173` bytes
- `leakguard-firefox-v2.0.0.zip`: `8024278` bytes
- `leakguard-firefox-enterprise-v2.0.0.zip`: `8024288` bytes

## Full gate results

Passed:

- `npm run validate:codex-release-env`
- `npm run build:all`
- `npm run package:release`
- `npm run test:ci`
- `npm run test:release-gates`
- `npm run test:browser-gates`
- `npm run test:release-artifacts`
- `git diff --check`

Release gates rebuilt all targets, repackaged all release zips, passed release artifact/store-readiness checks, and passed the file extraction pipeline benchmark.

Browser gates passed:

- Chrome smoke
- Firefox smoke
- Edge smoke
- Chrome extension QA harness
- Protected-site PDF/DOCX/XLSX/image handoff
- Protected-site file drop handoff
- Scanner downloads, including image OCR redacted PNG
- OCR WASM, Tesseract core, English traineddata, and synthetic OCR recognition proofs

## Focused image tests

Passed:

- `node tests/scanner_ocr.test.js`
- `node tests/content_file_extraction_pipeline.test.js`
- `node tests/release_artifacts.test.js`
- `node tests/browser/extension_qa_harness.test.mjs`

The focused scanner OCR suite now also covers:

- small, medium, and large PNG images with fake secrets produce non-empty flattened `.redacted.png`
- output dimensions are preserved
- clean images across different sizes produce zero findings
- clean images can still generate safe PNG handoff output, preserving user workflow

## Headed unpacked Chrome QA

Passed with `LEAKGUARD_CHROME_HEADLESS=0` against `dist/chrome`.

Verified by the headed Chrome extension QA harness:

- extension loaded in clean temporary Chrome profile
- scanner opened
- scanner synthetic image OCR produced `.redacted.png`
- generated `.redacted.png` was non-empty `image/png`
- scanner JSON/report paths were sanitized
- protected-site generic image picker produced redacted image handoff
- protected-site generic file drop handoff passed
- failure injection paths failed closed
- no raw fake secret appeared in page/upload/report/debug-visible harness outputs

Chrome reported: `Chrome/149.0.7827.114`.

## Headed packaged Chrome QA

Passed with `LEAKGUARD_CHROME_HEADLESS=0` against the packaged Chrome release candidate.

Method:

1. Extracted `artifacts/release/leakguard-chrome-v2.0.0.zip` into a temporary directory.
2. Temporarily swapped only generated `dist/chrome` with the extracted package contents.
3. Ran `node tests/browser/extension_qa_harness.test.mjs` headed.
4. Restored the original built `dist/chrome`.

Verified:

- packaged extension loaded in clean temporary Chrome profile
- scanner synthetic image OCR produced `.redacted.png`
- generated `.redacted.png` was non-empty `image/png`
- protected-site image picker handoff passed
- protected-site file drop handoff passed
- failure injection paths failed closed
- no raw fake marker was visible in page/upload/report/debug-visible harness outputs

Chrome reported: `Chrome/149.0.7827.114`.

## Live provider result

Not run in this validation pass. No QA/test ChatGPT or Gemini provider accounts were provided for this local run, and no real personal images or real secrets were used.

Provider-specific release claims should remain limited to the local synthetic protected-site harness evidence until a QA/test-account smoke is run:

- ChatGPT fake image upload: not tested live
- Gemini fake image upload: not tested live

The Gemini drag/drop prior-art playbook was reviewed before validation. The current evidence comes from the generic protected-site adapter harness and synthetic file drop handoff, not from a live Gemini DOM session.

## Raw leak assessment

No raw pass-through was observed in automated or headed Chrome validation.

Evidence:

- scanner OCR tests assert raw synthetic secrets are absent from redacted text and sanitized reports
- content file extraction pipeline tests assert invalid/empty redacted image outputs fail closed without raw fallback
- Chrome browser QA harness asserts protected-site image OCR handoff and file drop handoff do not expose raw fake markers
- malformed/unsupported/encrypted inputs fail closed without raw preview/status leakage
- generated redacted image files are non-empty PNGs named `*.redacted.png`

## Store artifact identity caveat

The exact original Chrome Web Store 2.0.0 uploaded zip is still unavailable in this checkout. This closeout validates a newly built patched `leakguard-chrome-v2.0.0.zip` candidate from the current branch. Do not claim this hash matches any previously uploaded 2.0.0 Store artifact.

## Final go/no-go

GO for Chrome hotfix release candidate from the local build/package/browser validation performed here.

Scope of GO:

- Chrome package produced and hashed
- full CI, release gates, browser gates, release artifact checks passed
- headed unpacked Chrome QA passed
- headed packaged Chrome QA passed
- no raw fake secret leakage observed in scanner, protected-site picker/drop, report, or debug-visible harness outputs

Remaining caveat:

- live ChatGPT/Gemini provider smoke was not run in this pass because QA/test accounts were not available.
