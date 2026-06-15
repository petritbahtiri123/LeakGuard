# LeakGuard 2.0.0 Image Redaction Release Investigation

Date: 2026-06-15
Status: investigation report updated after minimal 2.0.x patch; release remains NO-GO pending headed Chrome/package validation
Primary severity: P1 unless field evidence proves raw image exposure; current code paths examined are designed to block raw image upload when redacted image generation/handoff is unavailable.

## Summary

LeakGuard 2.0.0 introduced a new architecture-wide image OCR and visual redaction path for protected-site uploads. The previously restored stable Chrome package available in this checkout is `release/leakguard-chrome-v1.7.0.zip`, whose manifest version is 1.7.0 and whose package does not contain `content/files/contentFileExtractionPipeline.js`, `shared/imageRedactor.js`, `shared/scannerOcr.js`, `content/protected_site_ocr_broker.html`, or `content/files/protectedSiteOcrBroker.js`. Therefore, the 2.0.0 rollback restored behavior by removing the newly introduced image redaction path rather than returning to an older working protected-site image-redaction implementation.

The strongest local root-cause hypothesis is a release-readiness mismatch between the newly added protected-site OCR/broker/image-redaction pipeline and real headed provider upload paths. Unit coverage exercises mocked OCR/redactor and pipeline outputs, but it does not prove that a Web Store packaged extension can load the sandbox broker, start the OCR worker, decode images, create a non-empty PNG, and complete synthetic File/DataTransfer handoff in live providers. A second confirmed issue already present in recent history was blocked image metadata retaining raw secret-bearing filenames until commit `b2fa28d` changed blocked image metadata names to blank values.

## Incident severity

- P1: image redaction fails but raw upload should be blocked. This is the default classification from static and unit-level investigation.
- P1: protected-site image handoff broken. This remains likely until headed Web Store/unpacked provider QA proves otherwise.
- P0: raw image/file leak. Not confirmed in this environment; must be escalated if real rollout logs or manual QA show original image bytes reaching page handlers/provider upload after LeakGuard interception.
- P2: scanner image output issue. Not reproduced by `node tests/scanner_ocr.test.js`; headed scanner download still requires manual validation.
- P3: provider-specific UI friction. Possible for ChatGPT, Gemini, Grok, Claude, X, OpenAI, and generic adapter paths because synthetic file acceptance is site/DOM dependent.

## Release/build context

| Field | Value |
| --- | --- |
| Current branch | `work` |
| Current commit | `3a034c03249cb12ef195c0125e23bddfaf849c57` |
| Package version | `2.0.0` |
| Manifest version | `2.0.0` in `manifests/base.json` |
| Rollback version | `1.7.0` |
| Restored/published zip available in checkout | `release/leakguard-chrome-v1.7.0.zip` (3,655,778 bytes), manifest version 1.7.0 |
| Firefox 1.7 zip available | `release/leakguard-firefox-v1.7.0.zip` (3,655,914 bytes) |
| Exact 2.0.0 zip uploaded | Not present in this checkout under `artifacts/` or `release/`; must be supplied from Chrome Web Store submission records before final RCA sign-off |
| Exact currently restored/published zip | Locally available rollback candidate: `release/leakguard-chrome-v1.7.0.zip`; Chrome Web Store production artifact must be verified by store dashboard checksum |
| Chrome version | Not available in this container (`google-chrome`, `chromium`, and `microsoft-edge` commands missing) |
| OS | Ubuntu 24.04.4 LTS container on Linux 6.12.47 x86_64 |
| Installed source tested | No Web Store or unpacked headed browser install was available in this container |
| 1.7.0 to 2.0.0 settings migration | Not manually reproduced; unit coverage says absent protected-site OCR setting defaults enabled in current code, but task expectations require default-off verification before forward fix |

## Reproduction matrix

| Path | Local result | Status |
| --- | --- | --- |
| Scanner PNG/JPG upload | `node tests/scanner_ocr.test.js` passed mocked/local scanner regressions | Partial; headed UI not exercised |
| Scanner `.redacted.png` download | Covered by scanner OCR regression tests; no headed download validation | Partial |
| Protected-site generic file picker | Not executed headed; pipeline unit tests pass | Blocked by no browser |
| Protected-site generic drag/drop | Not executed headed | Blocked by no browser |
| ChatGPT image upload | Not executed; no QA/test account/browser | Blocked |
| Gemini image upload | Not executed; no QA/test account/browser | Blocked |
| Grok image upload | Not executed; no QA/test account/browser | Blocked |
| Claude image upload | Not executed; no QA/test account/browser | Blocked |
| X image upload | Not executed; no QA/test account/browser | Blocked |
| Generic adapter image upload | Not executed headed; adapter contract requires separate browser harness | Blocked |
| Web Store installed build | Not available | Blocked |
| Unpacked `dist/chrome` | `dist/chrome` absent because build preparation failed on pip/proxy setup | Blocked |

## Exact failure mode

No headed runtime failure mode could be captured in this container. The following failure modes remain open and must be explicitly checked with the actual 2.0.0 Store package and an unpacked `dist/chrome` build:

- extension console errors
- background service worker errors
- content-script errors
- OCR worker errors
- sandbox/broker errors
- CSP/WASM errors
- web-accessible-resource blocked resource errors
- `createImageBitmap` decode errors
- canvas/OffscreenCanvas export errors
- file handoff adapter errors
- pending attach timeout
- provider DOM upload rejection
- MIME/type/filename mismatch
- empty blob or zero-byte file
- raw upload correctly blocked with no redacted fallback
- scanner-only works but protected-site fails
- generic harness works but live provider fails

Local static findings that can explain real-use failure risk:

1. Protected-site image processing depends on `PWM.isProtectedSiteOcrEnabled`; if unavailable it returns false and blocks image redaction.
2. Protected-site OCR depends on injecting a hidden sandbox iframe for `content/protected_site_ocr_broker.html` and posting image bytes through a `MessageChannel`.
3. The sandbox page depends on loading `../shared/ocr/ocrRuntime.js`, creating a worker for `shared/ocr/ocrWorker.js`, loading tesseract core JS/WASM and `eng.traineddata.gz`, and returning OCR layout boxes.
4. Visual redaction depends on browser image decode/canvas APIs (`createImageBitmap`, `OffscreenCanvas` or DOM canvas, `convertToBlob` or `toBlob`).
5. Handoff depends on provider acceptance of generated `File` objects and synthetic `DataTransfer`/input bridges.

## Image redaction architecture map

1. User selects or drops a local image on a protected AI site.
2. Content script snapshots local `File`/`DataTransfer` data before page handlers can upload the original.
3. File type routing classifies supported `image/png`, `image/jpeg`, and `image/webp` inputs as `image_metadata`.
4. `contentFileExtractionPipeline.processFileForAdapterHandoff()` checks `isProtectedSiteOcrEnabled()` before image OCR.
5. If OCR is disabled or unavailable, the protected-site image path returns a blocked result instead of a text fallback or raw upload.
6. If OCR is enabled, the pipeline reads image bytes, prepares metadata extraction, and invokes `runProtectedSiteImageOcr()`.
7. Protected-site OCR uses `ProtectedSiteOcrBroker` when present; otherwise it uses `OcrRuntime` directly in tests/scanner contexts.
8. `ProtectedSiteOcrBroker` appends a hidden sandbox iframe for `content/protected_site_ocr_broker.html` and sends image bytes to the iframe via `MessageChannel`.
9. The broker page loads `shared/ocr/ocrRuntime.js`, validates request shape/MIME/language, and calls `OcrRuntime.recognizeImageBytes()`.
10. `OcrRuntime` starts `shared/ocr/ocrWorker.js`; the worker loads local tesseract core JS/WASM and English traineddata.
11. OCR returns text plus layout boxes. `ScannerOcr.redactionBoxesForOcrFindings()` maps detector findings onto high/medium-confidence word or line boxes.
12. `ImageRedactor.createRedactedPng()` validates MIME, bytes, dimensions, and boxes, decodes the image with browser APIs, draws black rectangles, and exports a flattened PNG blob/file.
13. The pipeline creates a sanitized image `File` named `*.redacted.png`, type `image/png`, marks `fileOnlyUpload` and `skipTextFallback`, and returns `safeForUpload: true`.
14. `content.js` wraps the sanitized file in the file attach pipeline and attempts adapter-specific or generic handoff.
15. If handoff fails or times out, LeakGuard should fail closed with raw image upload blocked and no raw OCR text or original file in persistent debug/report/storage.

## Settings/migration findings

- Current policy code defaults protected-site OCR to enabled if the storage key is absent or storage access fails.
- The option storage key is `pwm:protectedSiteOcrEnabled`.
- Unit coverage verifies local persistence and opt-out behavior for protected-site OCR.
- The incident prompt requires `protectedSiteOcrEnabled default false`; this conflicts with current docs/code/tests that say default-on. This must be resolved as a release decision because default-on increases real-use exposure to unproven image handoff paths, while default-off makes protected-site image redaction appear non-functional unless the user opts in.
- Scanner image OCR is independent of the protected-site OCR setting and should continue to work when protected-site OCR is disabled.
- Upgrade from 1.7.0 to 2.0.0 was not reproduced in a real browser profile. Because 1.7.0 had no protected-site OCR storage key in the available package, current 2.0.0 code treats upgraded profiles like new installs and enables protected-site OCR by default.

## Manifest/CSP/WAR findings

- `manifests/base.json` declares MV3 extension page CSP with `'wasm-unsafe-eval'` and a sandbox CSP with `worker-src 'self' blob:`.
- The sandbox page list includes `content/protected_site_ocr_broker.html`.
- Web-accessible OCR resources include `shared/ocr/ocrWorker.js`, `shared/ocr/ocrWasmProbe.wasm`, tesseract core JS/WASM, English traineddata, the synthetic OCR fixture, and broker page/script.
- The build copies all `src/shared`, `src/content`, and other runtime asset directories into `dist`, so source assets should be included in unpacked builds if `prepare:build` succeeds.
- `tests/release_artifacts.test.js` expects OCR assets and broker files in release artifacts, but could not run here because `dist/chrome` does not exist.
- No remote OCR loads are present in the inspected OCR runtime path.
- No recommendation is made to weaken CSP or add permissions before headed runtime evidence proves a CSP/WAR load failure.

## Adapter compatibility findings

| Adapter | Current risk | Required validation |
| --- | --- | --- |
| ChatGPT | Synthetic generated PNG may be rejected by hidden input/drop UI, or pending attach may timeout | Verify accepts `File`, MIME `image/png`, `.redacted.png`, UI preview, no raw original exposure |
| Gemini | Highest risk because code contains extensive Gemini-specific upload selectors/bridges and image uploader menu handling | Verify DataTransfer/input bridge, image upload menu path, Firefox/Chrome differences, pending attach completion |
| Grok | Provider DOM may reject synthetic drops/files | Verify adapter accepts generated PNG and fail-closed on timeout |
| Claude | Provider DOM may reject synthetic drops/files | Verify adapter accepts generated PNG and fail-closed on timeout |
| X | Provider media upload may enforce filename/MIME/event semantics | Verify adapter accepts generated PNG and never receives original |
| OpenAI | Separate adapter from ChatGPT may diverge | Verify file picker/drop contracts |
| Generic | Baseline synthetic `DataTransfer` support varies by browser/page | Verify generated file insertion, event sequence, and fail-closed behavior |

## Browser/profile findings

Not executed in this environment. Required matrix:

- Clean Chrome stable profile, unpacked `dist/chrome`.
- Existing Chrome stable profile upgraded from 1.7.0 to 2.0.0.
- Web Store installed 2.0.0 package, then rollback 1.7.0 package.
- Chrome stable vs Edge stable if Edge support is claimed.
- Optional Firefox profile for parity, though the incident is Chrome Store focused.

## Raw leak assessment

- Static pipeline behavior blocks supported images when protected-site OCR is disabled, OCR fails, boxes are unsafe, redaction fails, or image file creation fails.
- The protected-site image result intentionally uses `fileOnlyUpload` and `skipTextFallback` when a redacted PNG is ready, avoiding raw OCR text insertion into composers.
- Recent history confirms one raw-metadata issue: blocked image metadata could include raw secret-bearing filenames before commit `b2fa28d`; current code blanks blocked image metadata names.
- No local evidence confirms raw original image bytes are uploaded after interception, but headed provider QA must inspect page handlers, preview chips, network panel, and extension debug snapshots to close this P0 question.

## Why automation missed it

Likely gaps:

1. Tests mocked OCR/redactor success instead of proving full packaged broker/worker/tesseract/canvas runtime in a real extension page.
2. Release artifact tests were not enough to prove Chrome Web Store uploaded zip identity and headed provider behavior.
3. Browser harness did not require successful protected-site image file picker and drag/drop redacted PNG handoff across generic and real provider pages.
4. Tests focused on pipeline fail-closed and scanner regressions, but product expectation was redacted image upload success in real providers.
5. Migration/default setting behavior was not validated from a true 1.7.0 Web Store profile to 2.0.0.
6. Headless or unit tests may accept fail-closed as pass while real users see image redaction as entirely non-functional.
7. The actual 2.0.0 uploaded zip is not present locally, so package drift/missing asset cannot be ruled out.

## Root cause hypothesis

Most likely root cause cluster: protected-site image redaction depended on multiple new 2.0.0-only runtime components that were not validated end-to-end in the exact Web Store package and live provider DOMs. The failure could be any one of:

- sandbox broker unavailable or blocked
- OCR worker/tesseract assets missing or blocked in the uploaded package
- WASM/CSP/runtime load failure
- image decode/canvas export failure in content/sandbox context
- generated PNG `File` creation or zero-byte blob
- provider-specific rejection of synthetic `File`/`DataTransfer` handoff
- default setting mismatch causing images to be blocked rather than redacted

## Confirmed root cause, if found

A local root cause is now confirmed: the protected-site image pipeline accepted a successful redactor response without validating that the resulting `.redacted.png` replacement was usable by real upload surfaces. Empty or invalid generated PNG files could proceed as safe handoff candidates and then fail in provider upload flows. The patch now requires a non-empty generated file with MIME `image/png` and a `.redacted.png` filename before protected-site image upload is considered safe.

Confirmed local facts remain:

- 1.7.0 rollback package lacks the 2.0.0 protected-site image OCR/redaction architecture.
- Current source has a protected-site image path that can produce `.redacted.png` in unit tests when OCR/redactor are mocked and enabled.
- Current source fails closed when protected-site OCR is disabled, visual redaction is unavailable, or generated PNG output is empty/invalid.
- Current local test/build environment cannot produce or inspect `dist/chrome` because `prepare:build` attempts pip installs and the proxy blocks dependency fetches.

## Minimal fix plan

Do not implement broad fixes until the headed RCA is complete. Minimal safe plan:

1. Recover the exact 2.0.0 Chrome Web Store zip and record SHA256.
2. Run headed Web Store and unpacked `dist/chrome` tests with a synthetic image containing a fake key.
3. Capture extension page console, content console, service worker console, broker iframe console, and provider DOM/upload events.
4. If asset/package missing: add a release artifact regression checking exact required OCR/image assets inside the generated zip and Web Store candidate checksum.
5. If sandbox/WASM/CSP blocked: patch only the specific local resource/CSP issue proven by console errors; do not add remote loads or weaken CSP beyond local WASM needs.
6. If canvas/image output broken: patch `ImageRedactor` narrowly and add a real PNG fixture test asserting non-empty `image/png`, `.redacted.png`, and changed bytes.
7. If adapter handoff broken: patch only the proven adapter contract and add a browser harness/provider-contract test for generated PNG file handoff.
8. If setting default mismatch is the root cause: decide default-off vs default-on explicitly, update policy/options/docs/tests together, and preserve scanner independence.

## Regression tests required

After root cause is known, add the smallest failing-before/passing-after tests:

- Release artifact test: generated zip contains `content/protected_site_ocr_broker.html`, broker page script, OCR worker, tesseract JS/WASM, traineddata, image redactor, scanner OCR, and content pipeline; verify manifest WAR includes only required OCR assets.
- Browser harness test: supported fake image dropped/selected on generic protected page yields a non-empty `image/png` `*.redacted.png` sanitized file and never passes original file to page handlers.
- Adapter contract test: generated PNG handoff completes for the affected provider adapter with pending attach completion and UI preview/chip detection.
- Migration test: 1.7.0 profile with no `pwm:protectedSiteOcrEnabled` key upgrades to the intended default and options UI shows the intended state.
- Raw safety test: failed OCR/redaction/handoff keeps sanitized file null, raw OCR text absent from result/debug/report/storage, and original file unavailable to page handlers.

## Rollback/forward-fix recommendation

Keep rollback to 1.7.0 published until a 2.0.x candidate passes headed Web Store-package QA for scanner image output, protected-site generic file picker/drop, and at least ChatGPT plus Gemini image upload with synthetic fixtures. A forward fix should be a patch release only after one concrete root cause is confirmed; do not ship architecture-wide adapter rewrites or detector changes as part of this incident response.

## Go/no-go for patched 2.0.x release

NO-GO in this environment after the minimal patch. The generated PNG validation fix is implemented, but Chrome release still requires clean build/artifact and headed browser validation.

Go requires:

- exact 2.0.0 uploaded zip identified and compared with patched candidate
- successful release artifact gates
- successful headed unpacked Chrome tests
- successful headed Web Store-installed tests or equivalent Store-package install
- generic protected file picker and drag/drop pass
- ChatGPT and Gemini pass with synthetic image fixtures or are explicitly disabled/fail-closed with accurate release notes
- no P0 raw image/file leak evidence
- no raw OCR text or raw filenames in persistent storage/debug/report metadata
