# LeakGuard 2.0.x Image Redaction Incident Fix Closeout

Date: 2026-06-15
Status: patch implemented; clean-environment validation attempted here but blocked by missing browser binaries and pip/proxy build dependency failures

## Confirmed root cause

The local confirmed root cause is an output-validation gap in the protected-site visual image redaction path: a redactor result that reported success but produced an empty or invalid generated PNG `File` could be treated as safe for upload by the content file extraction pipeline. Real providers commonly reject zero-byte or malformed synthetic files, which matches the rollout symptom where protected-site image redaction appeared to fail when users attempted image uploads.

This patch makes the image path fail closed unless the generated replacement is a usable `.redacted.png` file with MIME `image/png` and non-zero size. It also makes the lower-level image redactor report `image_redaction_empty_output` if canvas export returns an empty blob.

## Exact affected path

1. Protected-site image upload enters `ContentFileExtractionPipeline.processFileForAdapterHandoff()`.
2. OCR and box mapping produce an image redaction request.
3. `ImageRedactor.createRedactedPng()` creates a PNG blob.
4. The pipeline converts the blob/result file into `sanitizedFile` and marks it safe for file-only upload.
5. Before this patch, non-null was enough at the pipeline boundary; after this patch, the generated file must be non-empty, `image/png`, and named `*.redacted.png`.

## Clean environment validation result

Validation was attempted in this container on 2026-06-15, but this is not a clean release/browser QA environment:

- Python is available as `Python 3.14.4`, and pip is available as `pip 26.1`.
- `npm ls --depth=0` reports installed Node dependencies for the repo (`eslint`, `globals`, `knip`, `onnxruntime-web`, `sharp`, and `yazl`).
- Proxy environment variables are configured (`HTTP_PROXY`, `HTTPS_PROXY`, `npm_config_http_proxy`, and `npm_config_https_proxy` point at `http://proxy:8080`).
- `npm run build:all`, `npm run test:ci`, and `npm run test:release-gates` are blocked because `prepare:build` creates `ai/.venv` and pip cannot fetch `joblib>=1.3` through the proxy (`Tunnel connection failed: 403 Forbidden`).
- Chrome, Chromium, Edge, and Firefox command-line binaries are not installed in this container, so headed browser gates and manual Chrome QA cannot run here.

## Package hash/size

No patched Chrome package was produced in this environment because `npm run build:all` failed before `dist/chrome` could be created. Consequently, `npm run package:release` failed with `Missing source folder: /workspace/LeakGuard/dist/chrome`.

## Headed Chrome QA result

Not run in this container. Required clean-environment validation remains:

- unpacked `dist/chrome` loads in a clean Chrome profile
- popup/options/scanner open
- scanner image upload produces a non-empty `.redacted.png`
- scanner JSON report excludes raw OCR text/secret
- generic protected-site image picker/drop creates a safe `.redacted.png` or blocks raw upload
- failed/unsupported image paths block raw upload

## Packaged Chrome QA result

Not run in this container because the patched Chrome release zip could not be produced. Packaged Chrome QA remains required after a successful clean build/package run.

## Live provider result

Not run. No QA/test provider accounts or installed Chrome runtime are available in this container. ChatGPT and Gemini image upload smoke tests remain required before those providers should be claimed for the patched Chrome release.

## Store artifact identity result

The exact 2.0.0 Chrome Web Store uploaded zip remains unavailable in this checkout. Local file search found prior rollback/release artifacts such as `release/leakguard-chrome-v1.7.0.zip`, but no `leakguard-chrome-v2.0.0.zip` or exact Store-uploaded 2.0.0 candidate. Do not block the hotfix forever on the unavailable old zip if a newly built patched candidate passes clean release/browser/manual QA, but keep this as a package-drift caveat in release notes.

## Raw leak assessment

No raw pass-through was added. If redacted image generation returns an empty or invalid output, the protected-site path returns `blocked`, clears `sanitizedFile`, clears output name/kind, and preserves the existing fail-closed behavior. The regression suite asserts that the raw synthetic marker and raw image text do not appear in the blocked result.

## Regression tests added

- Scanner/image-redactor regression: empty canvas output is rejected with `image_redaction_empty_output` and no blob is returned.
- Protected-site pipeline regression: empty generated `.redacted.png` is rejected, no sanitized upload is produced, and raw marker data is not exposed in the result.
- Release artifact regression: release packages must include the protected-site OCR broker, content pipeline, scanner OCR, image redactor, and required local OCR assets.

## Commands run in this validation attempt

Passed:

- `node tests/scanner_ocr.test.js`
- `node tests/content_file_extraction_pipeline.test.js`
- `git diff --check`

Blocked by environment:

- `npm run build:all` — pip/proxy failure installing `joblib>=1.3` during `prepare:build`
- `npm run package:release` — `dist/chrome` missing because build failed
- `npm run test:ci` — same pip/proxy `prepare:build` failure after eslint/knip completed
- `npm run test:release-gates` — same pip/proxy `prepare:build` failure
- `npm run test:browser-gates` — Chrome, Edge, and Firefox binaries missing
- `npm run test:release-artifacts` — `dist/chrome` missing
- `node tests/release_artifacts.test.js` — `dist/chrome` missing
- `node tests/browser/extension_qa_harness.test.mjs` — `dist/chrome/manifest.json` missing

## Go/no-go for patched 2.0.x Chrome release

NO-GO from this environment. The code patch remains ready for clean-environment validation, but Chrome release should wait for:

- successful `npm run build:all`
- successful `npm run package:release`
- patched Chrome zip path, size, and SHA256 recorded
- successful `npm run test:ci`
- successful `npm run test:release-gates`
- successful `npm run test:browser-gates`
- successful `npm run test:release-artifacts`
- headed unpacked Chrome QA with fake image fixtures
- headed packaged Chrome QA with fake image fixtures
- ChatGPT and Gemini synthetic image smoke tests if those providers are release claims

Edge claims remain LIMITED until Edge is manually retested. Firefox has no additional claim from this validation attempt.
