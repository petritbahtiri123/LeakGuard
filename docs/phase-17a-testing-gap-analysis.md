# Phase 17A Testing Gap Analysis

Purpose: inventory the current automated test system after the rebuilt-file feature family and identify automation gaps before Phase 17B adds tests. This is an analysis artifact only. It does not propose runtime, detector, adapter, dependency, or product behavior changes.

## Scope and Priority Definitions

- P0: a bug could leak raw user secrets or upload raw files after a failed protection path.
- P1: a bug could break provider compatibility, downloads, fallback behavior, package release, or browser parity.
- P2: a bug could cause polish drift, docs drift, performance uncertainty, or non-critical edge-case gaps.

## Test Entry Point Inventory

### npm scripts

- `npm run lint:unused`: runs ESLint across source, scripts, and tests.
- `npm run deadcode`: runs Knip dead-code analysis.
- `npm test`: runs `lint:unused`, `deadcode`, `prepare:build`, then `node scripts/run-tests.mjs`.
- `npm run qa:browser`: builds Chrome, runs `tests/browser/extension_qa_harness.test.mjs`, `chrome_smoke.test.mjs`, `edge_smoke.test.mjs`, builds Firefox, then runs `firefox_smoke.test.mjs`.
- `npm run test:release`: runs `npm test`, docs link checks, and `qa:browser`.
- `npm run smoke:chrome`: builds Chrome and runs `tests/browser/chrome_smoke.test.mjs`.
- `npm run smoke:edge`: builds Chrome and runs `tests/browser/edge_smoke.test.mjs`.
- `npm run smoke:firefox`: builds Firefox and runs `tests/browser/firefox_smoke.test.mjs`.
- `npm run build`, `build:all`, `build:chrome`, `build:chrome-enterprise`, `build:firefox`, `build:firefox-enterprise`: package the extension targets.
- `npm run release:artifacts`, `package:release`, `release:checksums`, `release:clean`: release artifact generation and checksums.
- `npm run bench:file-extraction`: runs `tests/performance/file-extraction-pipeline-benchmark.mjs`.
- `npm run bench:redaction:profile`: runs the redaction benchmark in profile mode.
- Supporting quality/report scripts: `prepare:build`, `docs:check-links`, `report:licenses`, `report:osv`, `report:sizes`, `scan:repo-secrets`, `spike:ocr-deps`, `icons:export`, `validate:codex-memory`.

### scripts/run-tests.mjs

`scripts/run-tests.mjs` is the default ordered Node suite. It includes detector, placeholder, AI assist, IP transform, composer helpers, response/reveal, typed interception, adapter contracts, content event/file-drop tests, protected sites, enterprise policy, file type/extractor/scanner/OCR/redactor tests, productization, security, synthetic/adversarial packs, redaction benchmarks, browser harness cleanup, and build target tests.

### tests/*.test.js

- Detector and redaction: `detector.test.js`, `natural_language_context.test.js`, `break_pack.test.js`, `adversarial_redaction.test.js`, `synthetic_pack.test.js`.
- Placeholder and session behavior: `placeholder_trust.test.js`, `placeholder_rehydrator.test.js`, `reveal_controller.test.js`, `response_observer.test.js`.
- AI and IP: `ai_candidate_gate.test.js`, `transform_with_ai.test.js`, `ai_assist.test.js`, `ip_transform.test.js`, `ip_child_first_audit.test.js`.
- Composer and interception: `composer_helpers.test.js`, `typed_interception.test.js`, `content_event_bindings.test.js`, `content_allow_once_interaction.test.js`.
- File interception and handoff: `file_paste_helpers.test.js`, `file_drag_guard.test.js`, `file_drop_payload_shape.test.js`, `file_drop_streaming_guards.test.js`, `content_file_drop_interception.test.js`, `content_file_extraction_pipeline.test.js`.
- File scanner, extractors, OCR, and rebuilt outputs: `file_type_registry.test.js`, `file_extractors.test.js`, `file_scanner.test.js`, `streaming_file_redactor.test.js`, `scanner_ocr.test.js`, `pdf_redactor.test.js`, `docx_redactor.test.js`, `xlsx_redactor.test.js`.
- Site policy and adapters: `protected_sites.test.js`, `enterprise_policy.test.js`, `adapter_contracts.test.js`.
- Productization, build, and security: `productization.test.js`, `security.test.js`, `build_targets.test.js`, `debug_logger.test.js`.

### tests/browser/*.mjs

- `extension_qa_harness.test.mjs`: browser QA harness for extension behavior.
- `extension_qa_harness_cleanup.test.mjs`: default-suite cleanup guard for the browser harness.
- `chrome_smoke.test.mjs`: Chrome extension smoke.
- `edge_smoke.test.mjs`: Edge smoke against the Chrome target.
- `firefox_smoke.test.mjs`: Firefox extension smoke.

### tests/performance/*.mjs

- `redaction-benchmark.mjs`: default-suite redaction performance benchmark.
- `redaction-benchmark-flake.test.mjs`: redaction benchmark stability guard.
- `file-extraction-pipeline-benchmark.mjs`: manual benchmark for file extraction and protected-site pipeline throughput.

## Current Coverage Strengths

- Detector and redactor coverage is broad: headers, URL credentials, natural-language disclosures, placeholder trust, known secret reuse, synthetic/adversarial packs, IP/CIDR hierarchy, and right-to-left replacement all have focused tests.
- Rebuilt file coverage exists at the unit/pipeline level for scanner and protected-site paths: text PDFs, DOCX, XLSX, image OCR, `.redacted.png`, `.redacted.pdf`, `.redacted.docx`, `.redacted.xlsx`, `.redacted.txt` fallback, malformed/encrypted/oversized cases, and raw-secret absence in sanitized outputs.
- Security/productization static tests are unusually strong: CSP, no inline JavaScript, no raw page-DOM reveal, session-only private state, audit metadata sanitization, sourceMappingURL/sourcemap stripping, package asset expectations, file capability copy, browser QA script ownership, and rebuilt-output guardrails.
- Adapter contract tests prove the expected providers exist: Gemini, Grok, ChatGPT, OpenAI Chat, Claude, and X. They also prove host routing, selector presence, pending attach gates, and Gemini fallback writer load order.
- Browser entry points exist for Chrome, Firefox, Edge, and a QA harness, but they are smoke-level and are not yet a complete matrix for file upload interception and fail-closed handoff paths.

## Gap Matrix

| Area | Existing coverage | Missing coverage | Risk if missing | Recommended automation | Priority | Suggested test file/script |
|---|---|---|---|---|---|---|
| detector rules | `detector.test.js`, `natural_language_context.test.js`, `break_pack.test.js`, `synthetic_pack.test.js`, `adversarial_redaction.test.js` | Ongoing corpus growth for new labelled prose families and provider-specific examples | Missed secret pattern or false positive drift | Keep adding paired positive/negative fixtures when rules change | P2 | `tests/detector.test.js`, `tests/natural_language_context.test.js` |
| known secret reuse | `placeholder_trust.test.js`, `break_pack.test.js`, `content_file_extraction_pipeline.test.js` | Cross-surface reuse proof from typed text to file handoff in a browser session | Same raw secret could get inconsistent placeholders, making review harder | Add browser harness scenario that types a secret then uploads a file containing it | P1 | `tests/browser/extension_qa_harness.test.mjs` |
| typed input interception | `typed_interception.test.js`, `composer_helpers.test.js` | Provider-specific browser smoke for live composer selectors | Provider DOM drift can bypass typed interception | Add provider fixture pages and run textarea/contenteditable typed send tests | P0 | `tests/browser/provider_interception_matrix.test.mjs` |
| paste interception | `composer_helpers.test.js`, `file_paste_helpers.test.js`, content event tests | End-to-end browser paste into provider-like contenteditable and textarea surfaces | Raw pasted text could submit if rewrite verification regresses | Add browser harness paste cases with raw-secret DOM/storage sweeps | P0 | `tests/browser/provider_interception_matrix.test.mjs` |
| contenteditable interception | `composer_helpers.test.js`, `typed_interception.test.js` | Realistic rich editor fixtures for Gemini/ChatGPT/Claude style DOM | Contenteditable rewrite can silently fail while textarea tests pass | Add Quill-like and nested-contenteditable harness fixtures | P0 | `tests/browser/contenteditable_interception.test.mjs` |
| file drop interception | `content_file_drop_interception.test.js`, `file_drag_guard.test.js`, `file_drop_payload_shape.test.js`, `file_drop_streaming_guards.test.js` | Browser-level drop with native DataTransfer replacement checks per provider | Page may ingest raw file before sanitized handoff or after failure | Add browser drop tests for sanitized handoff, fallback, blocked unsupported/failed paths | P0 | `tests/browser/file_handoff_matrix.test.mjs` |
| file picker/input upload interception | `content_event_bindings.test.js`, content file pipeline tests | Browser-level change/input event tests, including Firefox input transaction behavior | Raw selected file could upload if synthetic replacement fails | Add browser file-input tests with blocked raw upload assertion | P0 | `tests/browser/file_picker_interception.test.mjs` |
| protected-site allow/disable/re-enable/remove flow | `protected_sites.test.js`, `productization.test.js`, browser smokes | Full popup/options browser flow across reload and custom sites | User may believe a site is protected when content scripts are missing | Add browser test for add, disable, re-enable, remove, reload | P1 | `tests/browser/protected_sites_lifecycle.test.mjs` |
| scanner page uploads | `file_scanner.test.js`, `file_extractors.test.js`, `scanner_ocr.test.js`, browser QA harness | Browser scanner UI upload for PDF/DOCX/XLSX/image/text with DOM download button states | Scanner UI could diverge from scanner core | Add scanner-page UI test with synthetic safe fixtures | P1 | `tests/browser/scanner_page_matrix.test.mjs` |
| scanner JSON reports | `file_scanner.test.js`, `file_extractors.test.js`, `security.test.js` | Browser download artifact validation for JSON report content and filename | Report could include raw values or wrong metadata despite core helper passing | Add download capture and raw marker sweep for report JSON | P0 | `tests/browser/scanner_downloads.test.mjs` |
| scanner redacted downloads | Redactor unit tests, `security.test.js`, `file_scanner.test.js` | Browser download artifact validation for `.redacted.txt/.png/.pdf/.docx/.xlsx` | UI download path could bypass sanitized output | Add download capture with raw marker sweep and type/name checks | P0 | `tests/browser/scanner_downloads.test.mjs` |
| local OCR worker and WASM loading | `scanner_ocr.test.js`, `build_targets.test.js`, browser smoke probes | Full scanner UI OCR recognition and protected-site OCR handoff in browser | OCR assets may load in probes but fail through UI/runtime path | Add image OCR browser scenario using packaged synthetic fixture | P1 | `tests/browser/ocr_runtime_matrix.test.mjs` |
| image visual redaction | `scanner_ocr.test.js`, `content_file_extraction_pipeline.test.js`, `security.test.js` | Pixel/artifact-level browser validation of downloaded `.redacted.png` | Raw visual text box could remain visible after UI download | Add PNG download inspection with known box region and raw OCR text sweep | P0 | `tests/browser/scanner_downloads.test.mjs` |
| PDF rebuilt output | `pdf_redactor.test.js`, `content_file_extraction_pipeline.test.js`, `security.test.js` | Browser download/handoff artifact capture | UI or adapter path could hand off text fallback incorrectly or leak original bytes | Add artifact capture and extractor re-read in browser harness | P1 | `tests/browser/file_handoff_matrix.test.mjs` |
| DOCX rebuilt output | `docx_redactor.test.js`, `content_file_extraction_pipeline.test.js`, `security.test.js` | Browser download/handoff artifact capture | UI or adapter path could include unsafe source parts or wrong fallback | Add artifact capture and extractor re-read in browser harness | P1 | `tests/browser/file_handoff_matrix.test.mjs` |
| XLSX rebuilt output | `xlsx_redactor.test.js`, `content_file_extraction_pipeline.test.js`, `security.test.js` | Browser download/handoff artifact capture | UI or adapter path could include formula/media/source XML or wrong fallback | Add artifact capture and extractor re-read in browser harness | P1 | `tests/browser/file_handoff_matrix.test.mjs` |
| protected-site redacted file handoff | `content_file_extraction_pipeline.test.js`, adapter contracts, `security.test.js` | Provider-level browser proof of sanitized file attachment and blocked raw replay | Failed sanitized handoff could allow raw upload | Add provider fixture tests for success, text fallback, download fallback, fail-closed | P0 | `tests/browser/file_handoff_matrix.test.mjs` |
| Gemini adapter | `adapter_contracts.test.js`, Gemini playbook, security static guards | Browser fixture for pending attach, fallback writer, duplicate suppression, drag/drop | Gemini DOM drift can cause raw drop replay or duplicate sanitized content | Add Gemini-like fixture with menu/file-input/pending attach and Quill-like editor | P0 | `tests/browser/gemini_handoff.test.mjs` |
| Grok adapter | `adapter_contracts.test.js`, security static guards | Browser fixture for pending attach and failure cleanup | Raw file could upload if pending attach state drifts | Add Grok-like fixture with pending attach lifecycle | P0 | `tests/browser/grok_handoff.test.mjs` |
| ChatGPT/OpenAI adapter | `adapter_contracts.test.js`, browser smoke likely covers basic page load | Browser fixture for file input and large-paste attachment behavior | Compatibility or large-paste file conversion can regress | Add ChatGPT/OpenAI fixture with upload and generated Plain Text attachment cases | P1 | `tests/browser/chatgpt_openai_handoff.test.mjs` |
| Claude adapter | `adapter_contracts.test.js` | Browser fixture for file input/drop/select behavior | Provider compatibility can break silently | Add Claude-like fixture for upload selector and blocked failure | P1 | `tests/browser/provider_interception_matrix.test.mjs` |
| X adapter | `adapter_contracts.test.js` | Browser fixture for X compose/media selector safety | Provider compatibility can break or false-trigger on media controls | Add X-like fixture for composer and upload controls | P1 | `tests/browser/provider_interception_matrix.test.mjs` |
| Firefox-specific behavior | `build_targets.test.js`, `firefox_smoke.test.mjs`, `qa:browser`, `security.test.js` | Browser parity for file input replacement, protected-site lifecycle, OCR worker path | Firefox MV3 differences can break upload protection | Add Firefox mode to file handoff and protected-site lifecycle harnesses | P1 | `tests/browser/firefox_smoke.test.mjs`, new matrix tests |
| Chrome-specific behavior | `build_targets.test.js`, `chrome_smoke.test.mjs`, `qa:browser` | Chrome-specific DataTransfer/file input and download artifact capture | Chrome may pass static checks but fail native handoff | Add Chrome mode to file handoff/download matrix | P1 | `tests/browser/chrome_smoke.test.mjs`, new matrix tests |
| Edge/browser compatibility if present | `edge_smoke.test.mjs`, `productization.test.js` | Edge is smoke-only and uses Chrome target; no file handoff parity | Edge claims can outpace proven behavior | Keep Edge claim conservative; add file handoff smoke after Chrome/Firefox matrix | P2 | `tests/browser/edge_smoke.test.mjs` |
| service worker/background behavior | `enterprise_policy.test.js`, `protected_sites.test.js`, `security.test.js`, browser smokes | Restart/reload state restoration for active protected sessions and private maps | Session cache/reveal/protection state can become stale | Add browser reload/background restart tests | P1 | `tests/browser/background_session.test.mjs` |
| extension reload/session cache behavior | `security.test.js`, `content_file_extraction_pipeline.test.js` cache tests, browser smokes | Browser reload test for pending file handoff, reveal availability, cache clearing | Stale sanitized or raw metadata could survive unexpectedly | Add reload scenario with cache/reveal/pending attach assertions | P0 | `tests/browser/background_session.test.mjs` |
| CSP/permissions/WAR validation | `security.test.js`, `build_targets.test.js`, `productization.test.js` | Release zip/XPI-level manifest and WAR checks after packaging | Built package could diverge from source build checks | Add release artifact inspection or include package script in release test | P1 | `tests/release_package_contents.test.js` |
| release package contents | `build_targets.test.js`, release scripts, productization docs | Automated zip/XPI artifact content check in default or release suite | Missing assets, extra debug files, or raw fixtures can ship | Add package artifact test after `package:release` in release suite | P1 | `tests/release_package_contents.test.js` |
| sourcemap/sourceMappingURL checks | `build_targets.test.js`, `security.test.js` | Zip/XPI artifact scan after `package:release` | Source maps or sourceMappingURL could ship in final artifacts | Extend release artifact inspection | P1 | `tests/release_package_contents.test.js` |
| raw secret marker sweeps | `security.test.js`, file tests, package build tests | Unified marker sweep across scanner downloads, browser DOM, extension storage, package artifacts | Raw test secrets can persist in user-visible artifacts | Add shared raw marker sweep helper for browser and release artifact tests | P0 | `tests/browser/raw_marker_sweep.test.mjs`, `tests/release_package_contents.test.js` |
| docs/store/privacy consistency | `productization.test.js`, docs link check in `test:release` | Drift checks for new Phase 17 test roadmap and release notes after automation lands | Public claims can exceed tested behavior | Add doc guard when Phase 17B automations become required | P2 | `tests/productization.test.js` |
| performance benchmarks | Redaction benchmark in `npm test`, file extraction benchmark as manual script | Large-file handoff benchmark is outside default/release gate | Slow path or memory use can regress unnoticed | Add budgeted CI-safe file extraction benchmark or nightly profile | P2 | `tests/performance/file-extraction-pipeline-benchmark.mjs` |
| memory/large-file limits | `streaming_file_redactor.test.js`, `file_drop_streaming_guards.test.js`, extractor limit tests | Browser large-file upload memory and cancellation cleanup | Browser may freeze or raw fallback may misfire under large files | Add synthetic large safe file browser test with timeout and memory proxy checks | P1 | `tests/browser/file_handoff_matrix.test.mjs` |
| corrupted/malformed files | `file_extractors.test.js`, `content_file_extraction_pipeline.test.js`, redactor unit tests | Browser drop/select malformed files with raw upload blocked | Core fail-closed can pass while browser event path leaks raw file | Add malformed PDF/DOCX/XLSX/image browser tests | P0 | `tests/browser/file_handoff_matrix.test.mjs` |
| fail-closed behavior | Extractor/pipeline tests, `security.test.js` static assertions, file drop unit tests | Browser-native proof after sanitized attach failure and download fallback failure | Highest-risk raw file upload after failed protection path | Add explicit failure-injection browser harness per adapter | P0 | `tests/browser/file_handoff_matrix.test.mjs` |
| no raw data in logs/storage/reports/debug/audit metadata | `security.test.js`, `debug_logger.test.js`, file scanner/extractor tests, pipeline cache tests | Browser console/storage/download sweep during realistic protected-site and scanner flows | Raw secrets could leak outside core return values | Add browser raw marker sweep after each P0 flow | P0 | `tests/browser/raw_marker_sweep.test.mjs` |

## P0 Gaps

1. Browser-level file drop and file picker fail-closed proof is incomplete. Unit/pipeline tests prove sanitized outputs and blocked results, but Phase 17B should prove the browser event path consumes raw drops/selects before the page can ingest them, including malformed, oversized, OCR failure, adapter failure, fallback failure, and redispatch cases.
2. Provider-like contenteditable paste/typed interception needs browser fixture coverage. Existing DOM helper tests are good, but provider-rich editors can reject writes or normalize content differently.
3. Scanner download artifact validation needs browser capture. Core helpers and static tests assert sanitized data, but the actual UI download path should be swept for raw markers across JSON, TXT, PNG, PDF, DOCX, and XLSX.
4. Protected-site redacted file handoff needs adapter-specific runtime proof for Gemini and Grok pending attach plus generic adapters. The highest-risk condition is sanitized handoff failure followed by raw upload pass-through.
5. Browser raw marker sweeps should cover DOM, console, extension storage, downloads, debug metadata, audit metadata, and package artifacts after the realistic P0 flows.
6. Extension reload/session cache behavior should prove no raw extracted text or stale pending handoff state survives reload, and that protection remains accurate after background restart.

## P1 Gaps

1. Provider compatibility matrix is shallow. Adapter contracts prove IDs/selectors/routing, but not end-to-end provider-like upload and send flows for Gemini, Grok, ChatGPT/OpenAI, Claude, and X.
2. Chrome/Firefox parity is smoke-level for many rebuilt-file paths. Firefox-specific file input transactions, worker loading, downloads, and dynamic protected-site lifecycle need targeted tests.
3. Scanner UI matrix should exercise upload, status text, button availability, and downloaded artifact type/name for text, PDF, DOCX, XLSX, image metadata, and OCR images.
4. Release package artifact inspection should verify final zips/XPI files for required assets, no raw fixture secrets, no sourcemaps/sourceMappingURL, permissions, WAR, and no debug helpers.
5. Browser background/service-worker restart tests should prove protected-site registration, private reveal state, and session storage fallback behavior.
6. Large-file browser behavior should validate timeouts/cancellation/cleanup without freezing or accidental raw upload.

## P2 Gaps

1. Edge remains smoke-level through the Chrome target. Keep public wording conservative until provider/file handoff smoke is added.
2. Performance confidence for file extraction is available through `bench:file-extraction` but not part of the default suite. A budgeted CI-safe benchmark or scheduled run would improve confidence.
3. Docs/store/privacy consistency is guarded today, but Phase 17B should add assertions for the new automation matrix once the tests exist.
4. Detector corpus growth remains ongoing maintenance rather than a rebuilt-file blocker.
5. Non-critical corrupted-file variants, uncommon Office XML edge cases, and cosmetic scanner UI states can follow the P0/P1 browser-path work.

## Recommended Automation Roadmap

1. Phase 17B P0: add a browser raw-marker sweep helper and use it in file drop, file picker, scanner download, and fail-closed handoff tests.
2. Phase 17B P0: add provider fixture pages for contenteditable/textarea paste and typed interception, with explicit rewrite verification before send.
3. Phase 17B P0: add file handoff failure-injection tests for Gemini and Grok pending attach, then generic adapters, proving raw files never reach the page after protection starts.
4. Phase 17C P1: add scanner download artifact capture for JSON, TXT, PNG, PDF, DOCX, XLSX and re-read rebuilt documents with existing extractors.
5. Phase 17C P1: add Chrome/Firefox parity for protected-site lifecycle, file input upload, OCR worker path, downloads, and background reload.
6. Phase 17D P1/P2: add release artifact package inspection and a CI-safe large-file/performance confidence gate.

## Ready for Phase 17B

Ready, with one constraint: Phase 17B should start with P0 browser-path automation before adding more unit-level detector or redactor tests. The current unit/static suite is strong enough to support new browser fixtures without changing runtime behavior.
