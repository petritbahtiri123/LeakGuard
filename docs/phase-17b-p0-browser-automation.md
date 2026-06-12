# Phase 17B P0 Browser Automation

Purpose: add high-value browser-path leak-prevention automation for the P0 gaps identified in `docs/phase-17a-testing-gap-analysis.md`. This phase does not add product features, detector rules, permissions, dependencies, remote calls, live provider selectors, or Gemini/Firefox bridge behavior.

## Automated P0 Gaps

- Synthetic provider coverage: `tests/browser/extension_qa_harness.test.mjs` now uses a local synthetic provider page with textarea input, contenteditable input, file picker upload, drag/drop upload, provider-side submission capture, and provider-like upload artifact capture.
- Input interception: the browser QA harness exercises typed and paste flows for textarea and contenteditable composers. Each flow clicks through the local redaction modal, submits through the synthetic provider button, and verifies the provider submission contains placeholders rather than raw secrets.
- Protected-site file picker handoff: the harness verifies rebuilt output handoff for `.redacted.png`, `.redacted.pdf`, `.redacted.docx`, and `.redacted.xlsx`. It checks file name, MIME, size, bytes, extracted text when applicable, placeholder content, and no raw upload of the original file.
- file drop handoff: the harness dispatches a synthetic drag/drop upload to the local provider drop zone. It verifies a sanitized `.redacted.pdf` when the browser exposes the synthetic file to the extension extraction path, and otherwise verifies fail-closed blocking with no raw upload.
- Failure injection: the harness selects malformed PDF/DOCX/XLSX, image-only PDF, and unsupported `.doc`, `.docm`, `.xls`, and `.xlsm` files. It verifies no raw original upload, no unsafe rebuilt output, and no raw marker in the synthetic provider page/capture state.
- Scanner downloads: the harness captures scanner downloads for `.redacted.txt`, `.redacted.png`, `.redacted.pdf`, `.redacted.docx`, `.redacted.xlsx`, and JSON reports. It sweeps downloaded artifacts for raw markers and verifies placeholder/redacted output where applicable.
- Raw marker sweep: the harness includes a reusable raw marker sweep helper for strings, JSON-like objects, captured file artifacts, and downloaded bytes. Browser capture sweeps include provider upload records, submissions, input file state, modal/overlay text, panel text, and scanner download artifacts.
- No raw upload: protected-site picker, drop, rebuilt-output, and blocked-failure cases assert that the synthetic provider never records the original raw file name or raw marker after LeakGuard protection starts.

## Reload/Session Cache

The reload/session cache coverage keeps the existing deterministic page reload safety check and runs it after protected-site handoff/failure flows. It verifies the reloaded protected page does not retain raw synthetic prompt text or file-capture state in the page.

Full `chrome.storage.session` raw-value sweeping is intentionally deferred because normal placeholder reveal state may contain raw prompt secrets by design inside extension-private session storage. The deterministic raw-free file extraction session-cache coverage remains in `tests/content_file_extraction_pipeline.test.js`, which verifies raw extracted file text and raw file names are not cached, blocked/unsupported files are not cached, unsafe cache fields are refused, and the cache avoids persistent storage APIs.

## Browser and Runtime Limitations

- Phase 17B uses local synthetic provider pages instead of live Gemini, Grok, ChatGPT/OpenAI, Claude, or X pages.
- Browser QA runs primarily against the Chrome unpacked extension target through `npm run qa:browser`; that command also runs Edge and Firefox smoke coverage, but the new P0 matrix is hosted in the Chromium QA harness.
- The synthetic drop path proves LeakGuard's browser event path blocks raw provider delivery on a local provider fixture. In Chromium, page-created synthetic drop `File` objects may be unavailable to the extension extraction broker, so sanitized drop handoff can fail closed in the harness. Live provider DOM parity remains Phase 17C work.
- Forced regeneration failure is covered through malformed, image-only, unsupported, and blocked file families where no special runtime hook is required. No test-only runtime hook was added.

## Exact Commands

- `node tests/browser/extension_qa_harness.test.mjs`
- `npm run qa:browser`
- `npm run smoke:chrome`
- `npm run smoke:firefox`
- `npm run lint:unused`
- `npm run deadcode`
- `npm test`
- `npm run build:all`
- `npm run package:release`
- `npm run bench:file-extraction`
- `git diff --check`

## Deferred to Phase 17C

- Live-provider or provider-parity fixtures for Gemini, Grok, ChatGPT/OpenAI, Claude, and X beyond the synthetic provider, including sanitized drop handoff with browser-native provider file objects.
- Sanitized Chrome contenteditable paste submission for rich editors. Phase 17B verifies the P0 fail-closed path with no raw submission when rewrite verification cannot prove the final editor value.
- Firefox-specific file picker/drop parity for the full Phase 17B matrix.
- Edge-specific file handoff parity beyond the existing smoke path.
- Release zip/XPI raw marker sweeps beyond existing build/security/productization checks.
