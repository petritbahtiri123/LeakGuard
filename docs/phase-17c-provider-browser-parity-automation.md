# Phase 17C Provider/Browser Parity Automation

## Scope

Phase 17C increases compatibility confidence for LeakGuard's existing local-only browser extension paths. It does not add product features, detector rules, permissions, dependencies, telemetry, backend calls, cloud verification, or live-provider automation.

The automation strategy keeps Phase 17B P0 leak-prevention checks intact and layers parity assertions around synthetic provider fixtures, adapter contracts, browser smoke coverage, scanner parity, typed, paste, contenteditable, file picker, file drop, rebuilt file handoff, and fail-closed behavior. Live-provider selectors are intentionally not used when they would be brittle; provider-specific behavior is covered through adapter contract fixtures and synthetic protected-site pages.

## Provider/Browser Parity Matrix

| Provider/fixture | Browser | Typed input | Paste input | Contenteditable input | File picker | File drop | Pending attach behavior | Rebuilt file handoff | OCR/image path | Expected fail-closed behavior | Test script |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| generic synthetic textarea provider | Chrome full QA | sanitized submission | sanitized submission | N/A | covered through generic protected-site input | N/A | no pending attach | PDF/DOCX/XLSX/image checks shared by harness | scanner OCR plus protected-site image OCR opt-in | raw marker sweep across page, submissions, uploads, input files, overlays, panels, downloads, and JSON reports | `node tests/browser/extension_qa_harness.test.mjs` |
| generic synthetic textarea provider | Firefox smoke | sanitized typed prompt path | covered by prompt redaction smoke | N/A | scanner file input smoke | not covered in Firefox smoke | no pending attach | no raw upload asserted through scanner/download smoke; full rebuilt handoff remains Chrome-only | OCR worker probe and scanner smoke; full protected-site OCR is documented as Chrome full QA | raw marker sweep for prompt, refresh, scanner preview/download/report | `npm run smoke:firefox` |
| generic synthetic textarea provider | Edge smoke | sanitized composer smoke | sanitized paste smoke | N/A | scanner file input smoke | not covered in Edge smoke | no pending attach | no raw upload asserted through scanner smoke; full rebuilt handoff remains Chrome full QA | OCR worker probe smoke only | protected-site basics and raw marker smoke | `npm run smoke:edge` |
| generic synthetic contenteditable provider | Chrome full QA | sanitized submission | sanitized submission or fail-closed rewrite verification | contenteditable rewrite guarded | N/A | N/A | no pending attach | N/A | N/A | blocked rewrite must leave no raw secret in editor, textarea, modal, overlay, panel, page text, or submissions | `node tests/browser/extension_qa_harness.test.mjs` |
| generic synthetic contenteditable provider | Firefox smoke | not practical in current smoke harness | not practical in current smoke harness | not practical in current smoke harness | N/A | N/A | no pending attach | N/A | N/A | documented limitation; covered by Chrome full QA and shared content code | `npm run smoke:firefox` |
| generic synthetic file-input provider | Chrome full QA | N/A | N/A | N/A | sanitized rebuilt outputs captured by filename, MIME, bytes | N/A | generic adapter path has pending attach disabled | `.redacted.png`, `.redacted.pdf`, `.redacted.docx`, `.redacted.xlsx` | protected-site `.redacted.png` OCR path covered when opt-in is enabled | unsupported or unsafe source files block raw upload and keep raw markers out of UI/captures | `node tests/browser/extension_qa_harness.test.mjs` |
| generic synthetic file-input provider | Firefox smoke | N/A | N/A | N/A | scanner input and download smoke | not covered | generic adapter path has pending attach disabled | scanner redacted text and JSON report smoke; protected-site rebuilt handoff documented as Chrome full QA | OCR worker probe and scanner text/source scan; full OCR image workflow is Chrome full QA | no raw marker in scanner preview, redacted download, JSON report, prompt, or refreshed page | `npm run smoke:firefox` |
| generic synthetic drag/drop provider | Chrome full QA | N/A | N/A | N/A | N/A | sanitized rebuilt PDF handoff or fail-closed block before provider drop handler observes raw file | no pending attach | drop PDF `.redacted.pdf` captured when supported; otherwise fail-closed | N/A | raw dropped file must not reach provider uploads or page handlers | `node tests/browser/extension_qa_harness.test.mjs` |
| generic synthetic drag/drop provider | Firefox smoke | N/A | N/A | N/A | N/A | documented limitation | no pending attach | not covered in Firefox smoke | N/A | covered indirectly by shared code plus Chrome P0 harness | `npm run smoke:firefox` |
| ChatGPT/OpenAI adapter contract fixture | Chrome full QA plus static contract | synthetic generic path for browser behavior | synthetic generic path for browser behavior | synthetic generic path for browser behavior | adapter registry and generic upload selectors | direct drop replay disabled | pending attach remains disabled for ChatGPT/OpenAI | generic file-input harness covers rebuilt file handoff | scanner/protected-site OCR uses generic path | unsupported hostnames must not receive ChatGPT/OpenAI special adapter behavior | `node tests/adapter_contracts.test.js`; `node tests/browser/extension_qa_harness.test.mjs` |
| Gemini adapter contract fixture | Chrome full QA plus static contract | synthetic generic path for browser behavior | synthetic generic path for browser behavior | synthetic contenteditable path covers editor risk without live Gemini selectors | adapter registry and Gemini upload/file-input selectors | direct drop replay disabled; raw drop replay must not occur | Gemini pending attach remains enabled and trusted-activation gated | generic file-input harness covers rebuilt file handoff | scanner/protected-site OCR uses generic path | unsupported or unsafe attach must remain blocked; no raw file/text in captures | `node tests/adapter_contracts.test.js`; `node tests/browser/extension_qa_harness.test.mjs` |
| Grok adapter contract fixture | Chrome full QA plus static contract | synthetic generic path for browser behavior | synthetic generic path for browser behavior | synthetic generic path for browser behavior | adapter registry and Grok upload/file-input selectors | direct drop replay supported by contract, still sanitized/fail-closed by protected-site drop gate | Grok pending attach remains enabled and trusted-activation gated | generic file-input harness covers rebuilt file handoff | scanner/protected-site OCR uses generic path | pending attach gates must not leak raw file/text | `node tests/adapter_contracts.test.js`; `node tests/browser/extension_qa_harness.test.mjs` |
| Claude adapter contract fixture | Chrome full QA plus static contract | synthetic generic path for browser behavior | synthetic generic path for browser behavior | synthetic generic path for browser behavior | adapter registry and Claude upload/file-input selectors | direct drop replay disabled | pending attach remains disabled | generic file-input harness covers rebuilt file handoff | scanner/protected-site OCR uses generic path | unsupported hostnames must not receive Claude special adapter behavior | `node tests/adapter_contracts.test.js`; `node tests/browser/extension_qa_harness.test.mjs` |
| X adapter contract fixture | Chrome full QA plus static contract | synthetic generic path for browser behavior | synthetic generic path for browser behavior | synthetic generic path for browser behavior | adapter registry and X/Twitter upload/file-input selectors | direct drop replay disabled | pending attach remains disabled | generic file-input harness covers rebuilt file handoff | scanner/protected-site OCR uses generic path | unsupported hostnames must not receive X special adapter behavior | `node tests/adapter_contracts.test.js`; `node tests/browser/extension_qa_harness.test.mjs` |

## Automated Checks

- Synthetic provider typed input submits sanitized values and reuses placeholders where expected.
- Synthetic provider pasted input submits sanitized values.
- Synthetic contenteditable rewrites either submit sanitized content or fail closed without raw text in the editor, textarea, modal, overlay, panel, page text, or submissions.
- File picker handoff receives sanitized rebuilt outputs for `.redacted.png`, `.redacted.pdf`, `.redacted.docx`, and `.redacted.xlsx` in Chrome full QA.
- File drop handoff receives sanitized rebuilt output or fails closed before provider page handlers observe raw files.
- Pending attach gates remain enabled only for Gemini and Grok and disabled for ChatGPT/OpenAI, Claude, and X.
- Gemini and Grok pending attach behavior remains stable through adapter contract assertions and Chrome protected-site fail-closed checks.
- The adapter registry resolves expected adapters for supported hostnames.
- Unsupported hostnames resolve to the generic driver and do not receive special adapter behavior.
- Raw marker sweep remains active across provider page text, submissions, uploads, input files, modal text, panel text, overlay text, downloads, and JSON reports.

## Browser Coverage

Chrome is the full QA target for Phase 17C. It runs the browser QA harness against local synthetic protected-site pages and validates protected-site management, typed/paste/contenteditable interception, rebuilt file handoff, scanner downloads, OCR/image paths, raw marker sweeps, refresh/session safety, secure reveal, file drop handoff, and fail-closed failure injection.

Firefox is smoke plus targeted parity where practical. The Firefox smoke validates extension load, popup and protected-site management, prompt redaction, secure reveal, refresh safety, OCR runtime probes, scanner basic text/source scan, scanner redacted download, scanner JSON report sanitization, and protected-site removal. Firefox does not currently run the full protected-site rebuilt-file handoff or drag/drop harness because the existing WebDriver path is intentionally smaller and less reliable for those synthetic DataTransfer flows.

Edge is smoke only when Microsoft Edge is installed or `EDGE_BIN`/`MSEDGE_BIN` is set. It reuses the Chromium smoke path and verifies extension load, protected-site basics, composer redaction, secure reveal, user-managed protected site behavior, OCR runtime probes, and scanner basics. It does not claim full rebuilt-file handoff parity; that remains Chrome full QA.

## Scanner Parity Coverage

Chrome full QA opens the scanner, runs basic text/source scan, verifies redacted downloads, verifies sanitized JSON reports, checks PDF/DOCX/XLSX regenerated scanner downloads, covers OCR/image redacted PNG download, and sweeps raw markers from downloads and JSON reports.

Firefox smoke opens the scanner, runs a basic text/source scan, verifies the redacted download path, verifies the JSON report remains sanitized, and probes OCR runtime readiness. Full OCR image workflow and regenerated PDF/DOCX/XLSX scanner download parity are documented as Chrome full QA because they are higher-cost browser automation paths.

Edge smoke opens the scanner through the shared Chromium smoke path and validates basic scanner behavior and OCR runtime probes where the browser is available.

## Rebuilt-File Parity Coverage

Chrome full QA captures filename, MIME, size, and bytes for:

- image `.redacted.png`
- PDF `.redacted.pdf`
- DOCX `.redacted.docx`
- XLSX `.redacted.xlsx`

The same harness verifies that captured bytes do not contain raw synthetic markers and that extracted text, where practical, contains placeholders. Firefox smoke verifies no raw upload/no raw marker behavior through prompt and scanner flows, but does not claim full protected-site rebuilt-file upload parity. Edge smoke verifies protected-site basics and scanner basics when supported.

## Fail-Closed Behavior

Expected fail-closed behavior means raw files or raw text do not reach provider handlers, submissions, UI overlays, modal text, panel text, downloads, JSON reports, or extension-owned scanner output. Unsupported legacy Office files, image-only or encrypted/malformed PDFs, failed rewrite verification, and unsupported protected-site handoff paths must block raw upload and surface only sanitized or generic local status text.

Phase 17C keeps Gemini/Firefox bridge behavior and pending attach lifecycle unchanged unless a parity test exposes a real bug. The current automation documents limitations instead of faking live-provider coverage.
