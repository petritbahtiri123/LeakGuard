# LeakGuard File Scanner Plan

## Goal

Add a local-only File Scanner module that lets users scan text-like files before pasting, uploading, or sharing them with AI tools. Phase 1 should reuse LeakGuard's existing deterministic detection and redaction pipeline, avoid new heavy dependencies, and preserve the current prompt redaction behavior.

The scanner must not upload files, call external APIs, emit telemetry, or persist file contents unless the user explicitly exports a redacted copy or report.

## Launch Implementation Status

The launch implementation now covers Phase 1B and Phase 1C for text-based files:

- `src/shared/fileScanner.js` validates local text files, rejects oversized/binary/invalid UTF-8 inputs, runs deterministic scanning, and builds sanitized reports.
- `src/scanner/scanner.html`, `src/scanner/scanner.css`, and `src/scanner/scanner.js` provide the extension-owned File Scanner page.
- The popup opens the scanner page without adding host permissions or content-script injection.
- Redacted text copies and sanitized JSON findings reports are generated only after explicit user clicks.
- PDF, DOCX, image OCR, and visual redaction remain deferred.

## Existing Architecture

LeakGuard currently uses one shared source tree and packages browser-specific extension builds through `scripts/build-extension.mjs`.

- `manifests/base.json`: declares the popup, options page, built-in content scripts, permissions, CSP, and web-accessible AI model/runtime assets.
- `scripts/build-extension.mjs`: copies `src/background`, `src/content`, `src/popup`, `src/options`, `src/ui`, `src/shared`, `src/compat`, icons, config, AI model files, and selected ONNX Runtime assets into each `dist/*` target.
- `scripts/build-all.mjs`: builds Chrome, Chrome enterprise, Firefox, and Firefox enterprise targets.
- `src/background/core.js`: handles protected-site state, dynamic content-script registration, secure reveal staging, policy loading, and popup/options messages.
- `src/content/content.js`: intercepts protected AI-site composers, runs scan/redaction decisions, updates the in-page status UI, and stages secure reveal requests.
- `src/popup/*`: extension popup for current-site state, protected-site management, and secure reveal.
- `src/options/*`: extension options page for protected-site management.
- `src/ui/reveal_panel.*`: extension-owned reveal panel UI.
- `tests/*`: Node-based regression tests for detector behavior, redaction, transforms, build targets, productization wiring, security properties, and enterprise policy.

## Existing Detection And Redaction Modules

Deterministic detection:

- `src/shared/detector.js`
  - Exposes `PWM.Detector`.
  - Main synchronous path is `new Detector().scan(text)`.
  - AI-assisted path is `scanWithAiAssist(text, options)`.
  - Finding objects include fields such as `id`, `type`, `placeholderType`, `category`, `raw`, `start`, `end`, `score`, `severity`, `method`, and detector-specific metadata.
- `src/shared/patterns.js`
  - Defines high-signal secret patterns, assignment heuristics, placeholder suppression, and type mapping.
- `src/shared/ipDetection.js`, `src/shared/ipClassification.js`, `src/shared/networkHierarchy.js`
  - Detect and classify public/private IPv4 hosts and networks.
- `src/shared/aiCandidateGate.js`, `src/shared/ai/classifier.js`
  - Optional local ONNX classifier assist. This is already packaged locally and should remain optional for file scanning.

Redaction and placeholder mapping:

- `src/shared/placeholders.js`
  - Exposes `PWM.PlaceholderManager`.
  - Maintains placeholder counters, fingerprint-to-placeholder mappings, raw secret mappings, structured network objects, and public/private export state.
  - Supports canonical placeholder normalization via `normalizeVisiblePlaceholders`.
- `src/shared/placeholderAllocator.js`
  - Allocates semantic network placeholders for public IP/network findings.
- `src/shared/redactor.js`
  - Exposes `PWM.Redactor`.
  - Redacts deterministic findings with `new Redactor(manager).redact(text, findings)`.
  - Handles known secret reuse.
- `src/shared/transformOutboundPrompt.js`
  - Exposes `PWM.transformOutboundPrompt`.
  - Combines secret findings with public IP/network redaction and returns `redactedText`, `replacements`, `findings`, `networkReplacements`, and `changed`.
  - This is the preferred Phase 1 file-scan pipeline entry point because it preserves the same prompt redaction semantics.
- `src/shared/transformOutboundPromptWithAi.js`
  - Exposes `PWM.transformOutboundPromptWithAi`.
  - Runs deterministic findings, local AI candidate classification, then calls `transformOutboundPrompt`.
  - Phase 1 should start without AI assist unless a later setting explicitly enables it for files.

## Best Integration Point

Add a dedicated extension page, not a content-script UI.

Recommended route:

- Add `src/scanner/scanner.html`, `src/scanner/scanner.css`, and `src/scanner/scanner.js`.
- Add a scanner-specific shared module, `src/shared/fileScanner.js`, for testable file type validation and text scan orchestration.
- Link to the scanner from the popup and/or options page.
- Add the new `scanner` directory to `assetDirs` in `scripts/build-extension.mjs` so it is copied into `dist/*`.

Reasons:

- Extension pages can use `<input type="file">`, the browser File API, Blob downloads, and local DOM rendering without injecting anything into host pages.
- The page remains covered by the existing extension-page CSP: `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';`.
- It does not require broader host permissions.
- It avoids coupling file scanning to protected-site composer interception.
- It keeps prompt redaction behavior stable because the scanner can reuse shared modules without changing `src/content/content.js`.

The popup opens the separate scanner page with `browser.tabs.create({ url: browser.runtime.getURL("scanner/scanner.html") })`. No background message is needed for the launch implementation.

## Files To Add Or Change

Phase 1A, architecture only:

- Add `docs/FILE_SCANNER_PLAN.md`.
- No runtime code changes required.

Phase 1B, text scanner MVP:

- Add `src/shared/fileScanner.js`
  - Supported extension and MIME sniffing helpers.
  - File size validation.
  - Safe text decoding helper.
  - `scanTextFile({ fileName, mimeType, size, text, mode })`.
- Add `src/scanner/scanner.html`
  - Extension-owned page with file input, scan summary, findings list, and preview.
- Add `src/scanner/scanner.css`
  - Page styling consistent with popup/options, but more workspace-oriented.
- Add `src/scanner/scanner.js`
  - Reads selected files locally with the File API.
  - Calls `PWM.FileScanner.scanTextFile`.
  - Renders results.
- Change `scripts/build-extension.mjs`
  - Add `"scanner"` to `assetDirs`.
- Change `manifests/base.json`
  - Add scanner page scripts only inside `scanner.html`; no manifest page declaration is strictly required unless adding a command or options link.
  - Do not add host permissions.
- Change `src/popup/popup.html`, `src/popup/popup.js`, and maybe `src/popup/popup.css`
  - Add an "Open File Scanner" action.
  - Prefer a background message if centralizing extension page opening.
- Optionally change `src/options/options.html`, `src/options/options.js`, and `src/options/options.css`
  - Add a secondary link to the scanner.

Phase 1C, export redacted copy/report:

- Extend `src/scanner/scanner.js`
  - Create redacted-copy downloads with `Blob`, `URL.createObjectURL`, `<a download>`, then `URL.revokeObjectURL`.
  - Create JSON report downloads the same way.
- Extend `src/shared/fileScanner.js`
  - Add `buildFindingsReport(scanResult)` helper if useful.
- Add tests under `tests/file_scanner.test.js`.
- Add `tests/fixtures/file_scanner/` for small text fixtures if needed.
- Update `scripts/run-tests.mjs` to include the new scanner test.
- Update `docs/RELEASE_QA_CHECKLIST.md` with manual scanner QA.
- Update `docs/PRIVACY_POLICY.md` to mention local file scanning and no file persistence.
- Update `docs/CHROME_WEB_STORE_LISTING.md` only when the feature is ready for release.

Phase 2:

- Add PDF/DOCX extraction modules only after dependency evaluation.
- Candidate files:
  - `src/shared/fileExtractors/pdf.js`
  - `src/shared/fileExtractors/docx.js`
  - Scanner UI updates to label extracted text as a detection report, not a safe redacted artifact.

Phase 3:

- Add OCR/image scanning behind a separate implementation path.
- Candidate files:
  - `src/shared/fileExtractors/ocr.js`
  - `src/shared/imageRedactionPlan.js` or a later image-specific redaction module.
  - Scanner UI warnings for OCR confidence and visual redaction limitations.

## Phase 1 Data Structures

Use a file-scan-specific result shape that preserves existing finding details but does not expose raw values in exported reports by default.

```js
const scanInput = {
  fileId: "local-generated-id",
  fileName: "example.env",
  extension: ".env",
  mimeType: "text/plain",
  sizeBytes: 1234,
  text: "API_KEY=...",
  mode: "hide_public"
};
```

```js
const scanResult = {
  scanId: "scan_2026-04-29T15-00-00Z_ab12cd",
  scannedAt: "2026-04-29T15:00:00.000Z",
  file: {
    name: "example.env",
    extension: ".env",
    type: "text/plain",
    sizeBytes: 1234,
    textBytesRead: 1234,
    truncated: false
  },
  summary: {
    findingsCount: 3,
    highCount: 2,
    mediumCount: 1,
    categories: {
      credential: 2,
      network: 1
    },
    changed: true
  },
  findings: [
    {
      id: "assignment_0001",
      category: "credential",
      type: "API_KEY",
      severity: "high",
      start: 8,
      end: 48,
      line: 1,
      column: 9,
      length: 40,
      placeholder: "[PWM_1]",
      method: ["assignment", "pattern"],
      preview: "API_KEY=[PWM_1]"
    }
  ],
  redactedPreview: "API_KEY=[PWM_1]\n...",
  redactedText: "API_KEY=[PWM_1]\n...",
  reportWarnings: []
};
```

Exported JSON report should omit `raw` by default:

```js
const exportedReport = {
  version: 1,
  product: "LeakGuard",
  localOnly: true,
  file: scanResult.file,
  summary: scanResult.summary,
  findings: scanResult.findings,
  redactedPreview: scanResult.redactedPreview,
  generatedAt: scanResult.scannedAt
};
```

The internal in-memory result may temporarily hold existing transform replacements that include `raw`, but rendering/export should sanitize by default. A later "include raw values" report option should not be part of the MVP.

Line/column mapping should be computed after detection from `start` offsets. Keep it in `src/shared/fileScanner.js` so it is unit-testable.

## Placeholder Mapping Strategy

Use a file-scan-specific `PlaceholderManager` instance per scanned file or per scan batch.

Recommended MVP behavior:

- Create a fresh `new PlaceholderManager()` for each file scan.
- Do not reuse the active prompt/session placeholder map from `sessionMapStore`.
- Do not write file-scan mappings to `chrome.storage.session` or `chrome.storage.local`.
- Keep mappings only in memory for the current scanner page session, needed to render the redacted preview and export redacted text.
- If scanning multiple files at once, either:
  - Preferred: one manager per file for isolated reports and no cross-file correlation.
  - Optional later: one manager per scan batch if users want consistent placeholders across a selected set.

Reasoning:

- Prompt redaction mappings are tied to protected-site sessions and secure reveal. File scanner output should not affect prompt placeholder counters or reveal state.
- File scans may involve local documents that should not be recoverable through the existing popup reveal flow.
- Per-file managers keep the exported redacted copy deterministic within a file but minimize accidental cross-file linkage.

Use `transformOutboundPrompt(text, { manager, findings, mode: "hide_public" })` after deterministic scanning:

1. `const detector = new Detector();`
2. `const findings = detector.scan(text);`
3. `const result = transformOutboundPrompt(text, { manager, findings, mode: "hide_public" });`
4. Build UI/report findings from `result.findings` or `result.replacements`.

## File Type Handling

Phase 1 supported extensions:

- `.txt`
- `.env`
- `.log`
- `.json`
- `.yaml`
- `.yml`
- `.xml`
- `.csv`
- `.md`
- `.ini`
- `.conf`
- `.ps1`
- `.sh`
- `.py`
- `.js`
- `.ts`
- `.html`
- `.css`

MVP detection rules:

- Accept supported extensions even when MIME type is empty or generic, because browsers often report local code/config files as `""` or `application/octet-stream`.
- Accept known text MIME families such as `text/*`, `application/json`, `application/xml`, `application/x-yaml`, and common script/config MIME aliases.
- Reject unsupported binary-looking extensions.
- Reject files with a high NUL-byte ratio or failed UTF-8 decoding.
- Use `File.text()` for MVP. If memory pressure becomes a problem, move to chunked reads in a later iteration.

Recommended MVP limit:

- Current max supported text-file size: 50 MB per file.
- Hard stop: reject larger files with clear UI copy.
- Rationale: current release keeps file protection text-only, blocks files above the local streaming limit, and uses streaming/chunked redaction for protected composer upload paths above 4 MiB. The extension-owned scanner still scans locally and should remain conservative about UI responsiveness and memory growth.
- Later configurable limit: 5-10 MiB with chunked scanning and cross-chunk boundary handling.

## Dependency Strategy

Phase 1:

- No new dependencies.
- Use browser File API, `Blob`, object URLs for downloads, and existing shared LeakGuard modules.
- Do not add parsing libraries for JSON/YAML/XML; scan raw text.
- Do not add syntax highlighters; render preview as escaped text in `<pre>`.

Phase 2:

- Evaluate `pdfjs-dist` for text extraction from PDFs.
- Evaluate `mammoth` for DOCX text extraction.
- Gate these behind separate scanner extraction modules and measure size before merging.
- Avoid claiming visual PDF redaction. The output should be "text detection report from extracted text" only.
- Consider disabled-by-default or separate build flags if dependency size is material.

Phase 3:

- Evaluate `tesseract.js` separately for OCR scanning.
- Treat OCR as high-risk for false confidence.
- Initial image feature should report OCR text findings only.
- Visual redaction with bounding boxes should be a separate, later feature with strong QA because missed text regions create false safety.

## Extension Size Impact And Mitigation

Current relevant size context:

- LeakGuard already packages local ONNX Runtime Web and a small ONNX classifier model for AI assist.
- Recent build-size mitigation trims ONNX Runtime sidecars to the required runtime assets.
- Phase 1 should add only small HTML/CSS/JS files and tests. Expected size impact should be well under 100 KiB before minification, excluding screenshots/fixtures.

Mitigation plan:

- Keep Phase 1 scanner page separate from content scripts so protected AI pages do not load scanner UI code.
- Put file scanner orchestration in `src/shared/fileScanner.js`, but load it only from `scanner/scanner.html` and Node tests. Do not add it to content-script `js` in `manifests/base.json`.
- Add `scanner` to `assetDirs` so the files are packaged, but do not add scanner modules as web-accessible resources.
- Keep PDF/DOCX/OCR modules out of Phase 1.
- If Phase 2/3 dependencies are adopted, isolate them in `src/scanner/vendor` or a dedicated copied folder and lazy-load only from the scanner page.
- Measure every target after adding dependencies with the same `dist/*` size checks used during ONNX runtime trimming.

## Security Considerations

Local-only processing:

- Read files only through explicit user selection in an extension page.
- Never upload file contents.
- Never call external APIs.
- Never emit telemetry or analytics.
- Do not add network permissions.

Persistence:

- Do not store raw file text, raw findings, or redacted output in extension storage.
- Keep scan state in memory in `scanner.js`.
- Exports happen only after an explicit user click.
- JSON reports should not include raw secret values by default.

Object URLs and downloads:

- Use `URL.createObjectURL(new Blob(...))` only for user-triggered exports.
- Revoke object URLs after the download click, preferably in a `setTimeout(..., 0)` or after the click completes.
- Do not create object URLs for preview rendering.

Large files:

- Enforce the Phase 1 max file size before reading contents.
- Show a clear rejection state for oversized files.
- Avoid scanning files repeatedly on every UI render.
- Use a worker later if scan latency becomes noticeable, but avoid worker complexity in MVP unless manual QA shows UI blocking.

Text handling:

- Render file previews and findings with `textContent`, not `innerHTML`.
- Escape file names by relying on DOM text APIs.
- Detect and reject binary-looking content.
- Normalize CRLF/LF only for line/column calculations if needed; keep original text for redacted copy.

Prompt redaction isolation:

- Do not modify `src/content/content.js` interception flow for Phase 1.
- Do not share file scan placeholders with secure reveal.
- Do not register file-scan raw values in `sessionMapStore`.

Policy:

- Enterprise policy does not need to control Phase 1 unless product requirements later ask for it.
- If enterprise controls are added later, they should be metadata-only settings such as enable/disable scanner or max file size, not file content logging.

## Test Plan

Unit tests for file type detection:

- Add `tests/file_scanner.test.js`.
- Verify all Phase 1 extensions are accepted.
- Verify unsupported binary extensions such as `.png`, `.jpg`, `.pdf`, `.docx`, `.zip`, `.exe` are rejected in Phase 1.
- Verify generic or empty MIME types are accepted only when extension is supported.
- Verify text MIME types are accepted for supported file names.
- Verify case-insensitive extension handling.

Unit tests for text scan pipeline:

- Load shared modules in the same style as `tests/break_pack.test.js` and `tests/ip_transform.test.js`.
- Scan `.env` text containing API keys/passwords and assert redacted output hides raw values.
- Scan JSON with credentials and assert placeholder output preserves JSON structure around values.
- Scan public IP examples and assert network placeholders follow existing `transformOutboundPrompt` behavior.
- Assert exported report findings omit `raw`.
- Assert line/column calculations match expected offsets.
- Assert oversized files return a controlled rejection result without scanning.

Regression tests for existing prompt redaction:

- Keep `tests/detector.test.js`, `tests/break_pack.test.js`, `tests/ip_transform.test.js`, `tests/typed_interception.test.js`, `tests/transform_with_ai.test.js`, and `tests/adversarial_redaction.test.js` unchanged.
- Add scanner tests to `scripts/run-tests.mjs`.
- Add productization checks only after scanner UI is wired.
- Run full `npm test` after Phase 1B/1C changes.

Manual QA test files:

- `sample.env`: API keys, DB URLs, bearer token.
- `sample.json`: nested credentials and harmless placeholders.
- `sample.md`: prose plus one secret and one public IP.
- `sample.log`: repeated token values to verify placeholder reuse within the file.
- `sample.csv`: tokens in cells.
- `large.txt`: just over the MVP max size to verify rejection.
- `binary-renamed.txt`: binary-like content with NUL bytes to verify rejection.

Manual QA workflow:

- Open scanner from popup/options.
- Select one supported file.
- Confirm file name, type, findings count, finding categories, and redacted preview.
- Export redacted copy and verify raw secret values are absent.
- Export JSON report and verify raw secret values are absent.
- Select unsupported and oversized files and verify controlled errors.
- Re-test protected ChatGPT prompt redaction to confirm no behavior regression.

## Implementation Roadmap

### Phase 1A: Architecture Only

- Land this plan.
- Decide final scanner entry point: popup action only, options link, or both.
- Confirm current file size cap and streaming policy: protected composer text-file paths stream above 4 MiB up to 50 MB, and files above 50 MB are blocked.
- Confirm whether Phase 1 uses deterministic-only scanning or also local AI assist. Recommendation: deterministic-only for MVP.

### Phase 1B: Text Scanner MVP

- Add `src/shared/fileScanner.js`.
- Add scanner extension page files under `src/scanner/`.
- Add scanner directory to `scripts/build-extension.mjs`.
- Wire popup "Open File Scanner" action.
- Read a single local file with File API.
- Validate extension, MIME, binary-looking content, and size.
- Run deterministic detector plus `transformOutboundPrompt`.
- Render file name, file type, findings count, finding category/type, and redacted preview.
- Add unit tests for file type handling and text scan pipeline.

### Phase 1C: Export Redacted Copy And Report

- Add redacted-copy download.
- Add sanitized JSON findings report download.
- Add object URL cleanup.
- Add manual QA fixtures and checklist updates.
- Update privacy/store docs only once the feature is release-ready.

### Phase 2: PDF/DOCX Detection

- Evaluate `pdfjs-dist` and `mammoth` with size measurements.
- Extract text only.
- Run existing detection/redaction against extracted text.
- Present a detection report and extracted-text redacted preview.
- Do not claim safe PDF/DOCX visual redaction.
- Add dependency only if the size and maintenance tradeoff is acceptable.

### Phase 3: OCR And Image Redaction

- Evaluate `tesseract.js` separately.
- Start with OCR detection reports only.
- Clearly label OCR as best-effort and high-risk for missed text.
- Add image redaction with bounding boxes only after separate design, tests, and visual QA.
- Keep OCR assets lazy-loaded and scanner-only.

## Safe First Steps

The safe first implementation steps are:

1. Add `src/shared/fileScanner.js` with pure helper functions and Node tests.
2. Add scanner page shell under `src/scanner/`, loaded only as an extension page.
3. Add build copy support for `scanner`.
4. Wire a popup button to open the scanner page.

These steps are low-risk because they do not change composer interception, protected-site matching, secure reveal storage, or prompt redaction behavior.
