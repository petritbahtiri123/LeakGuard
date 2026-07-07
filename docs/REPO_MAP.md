# Repo Map

This is the current module ownership map for Codex and other AI agents. Prefer this file over older phase plans and audits when deciding where to make changes.

## Architecture Lifecycle
LeakGuard's detection and redaction flow is:

```text
regex/provider deterministic rules
  -> entropy/context fallback
  -> Onix gray-zone classifier
  -> final redaction policy
```

- Regex/provider rules are the first authority. Do not route known provider/header/URL/structured cases around the deterministic layer.
- Entropy is a fallback for suspicious leftover values, not a reason to lower global false-positive controls.
- Onix runs after deterministic findings and candidate gating. It handles gray-zone leftover cases and cannot downgrade deterministic findings.
- Emails globally redact. Usernames remain context-aware unless product policy changes.
- Trusted `[PWM_N]` placeholders must pass through and must never be re-redacted.
- Unsupported or unsafe protected file flows fail closed. After LeakGuard consumes or sanitizes a file, raw upload must not be replayed.
- Debug output must be metadata-only.

## Root And Build
- `package.json`: npm scripts and dependencies.
- `scripts/run-tests.mjs`: ordered Node regression suite.
- `scripts/prepare-build.mjs`: prepares local build assets and checks local Onix classifier state before tests/builds.
- `scripts/build-all.mjs`: builds all Chrome/Firefox consumer/enterprise targets.
- `scripts/build-extension.mjs`: copies runtime assets, manifests, config, AI model, OCR assets, and ONNX runtime into `dist/`.
- `src/shared/runtime_scripts.js`: canonical runtime script order for content and background.
- `manifests/base.json`: Chrome MV3 base manifest and static content script order.
- `manifests/firefox.json`: Firefox background script overlay.
- `src/background/service_worker.js`: Chrome service worker `importScripts()` order.
- `dist/`: generated extension builds; do not edit by default.

## Shared Detection
- `src/shared/detector.js`: deterministic detector orchestrator, overlap resolution, trusted-placeholder handling, sensitive headers, URL credential ranges, structured assignments, natural-language disclosures, email redaction, identity contexts, and entropy fallback call.
- `src/shared/entropy.js`: entropy scoring helpers used by fallback and candidate scoring.
- `src/shared/patterns.js`: regexes, keyword lists, suppression constants, provider registry, placeholder family mapping, and Onix dataset categories.
- `src/shared/aiCandidateGate.js`: extracts leftover candidate windows for Onix after deterministic ranges are reserved.
- `src/shared/detection/*`: modular deterministic helpers. Provider detectors live under `providers/*`; enterprise/internal metadata detectors live under `enterprise/*`; headers, URL userinfo, structured metadata, context windows, and scoring helpers live beside them.
- `src/shared/knownSecretReuse.js`: shared known-raw-secret reuse logic used by redaction paths.
- `src/shared/redactor.js`: right-to-left secret placeholder replacement.
- `src/shared/transformOutboundPrompt.js`: prompt redaction plus public IP/network pseudonymization.
- `src/shared/transformOutboundPromptWithAi.js`: deterministic transform plus optional Onix assist.

## Shared Files, Network, Policy
- `src/shared/fileLimits.js`: shared file-size constants.
- `src/shared/fileTypeRegistry.js`: supported file type and MIME registry.
- `src/shared/fileExtractors.js`: document/image/text extraction routing.
- `src/shared/fileScanner.js`: local scanner orchestration and raw-free report shaping.
- `src/shared/streamingFileRedactor.js`: chunked local text-file redaction.
- `src/shared/pdfRedactor.js`, `src/shared/docxRedactor.js`, `src/shared/xlsxRedactor.js`, `src/shared/imageRedactor.js`: regenerated sanitized output helpers.
- `src/shared/ocr/*` and `src/shared/scannerOcr.js`: local packaged OCR runtime assets and scanner/protected-site OCR helpers.
- `src/shared/ipClassification.js`, `src/shared/ipDetection.js`, `src/shared/networkHierarchy.js`, `src/shared/placeholderAllocator.js`: public/private IP and network placeholder flow.
- `src/shared/placeholders.js`, `src/shared/placeholders/families.js`, `src/shared/sessionMapStore.js`: placeholder families, session mapping, trusted placeholder state, and private/public export boundaries.
- `src/shared/policy.js`: consumer/enterprise policy decisions.
- `src/shared/protected_sites.js`: protected-site normalization and matching.

## Content Runtime
- `src/content/content.js`: final content orchestration script. It should wire modules, coordinate protected composer behavior, and stay the last content script rather than accumulating new feature logic.
- `src/content/composer_helpers.js`: textarea/contenteditable text IO, selection, rewrite, and beforeinput helpers.
- `src/content/input/rewriteVerificationText.js`: rewrite verification text helpers.
- `src/content/composer/chatgptComposerSync.js`: ChatGPT composer sync helper.
- `src/content/file_drag_guard.js`: early file drag/drop guard.
- `src/content/file_paste_helpers.js`: paste/file helper messages and file extraction glue.
- `src/content/file_handoff_state.js`, `src/content/file_handoff_pending.js`, `src/content/file_handoff_flow.js`: shared sanitized handoff state, pending flow, and handoff sequencing.
- `src/content/files/contentFileExtractionPipeline.js`: protected-site file extraction pipeline.
- `src/content/files/fileAttachPipeline.js`: protected-site file attach pipeline orchestration.
- `src/content/files/multiFileInsertOrchestration.js`: multi-file protected upload event ownership, batch coordination, and sanitized handoff routing.
- `src/content/files/fileTransferPolicy.js`: file transfer policy decisions and the single-file local transfer fail-closed/pass-through gate.
- `src/content/files/fileExtractionSessionCache.js`: in-memory file extraction session cache.
- `src/content/files/pendingSanitizedFileHandoff.js`: pending sanitized file handoff helpers.
- `src/content/files/protectedSiteOcrBroker.js`: protected-site OCR broker integration.
- `src/content/adapters/*`: site-specific adapter definitions, host matching, diagnostics, and fallback writing.
- `src/content/diagnostics/debugLogger.js`: safe debug sanitizer.
- `src/content/diagnostics/fileDebugMetadata.js`: safe file debug metadata.
- `src/content/diagnostics/safeSnapshots.js`: safe snapshot and filename helpers; avoid raw debug use.
- `src/content/diagnostics/contentDebugFacade.js`: content debug facade that routes diagnostics through safe metadata.
- `src/content/bootstrap/eventBindings.js`: bootstrap event binding helpers.
- `src/content/rehydration/*`: placeholder rehydration, response observer, and reveal controller.

## Background Runtime
- `src/background/core.js`: final background orchestration script, message handling, private placeholder state, reveal staging, policy enforcement, downloads, and audit integration.
- `src/background/protectedSiteRegistry.js`: protected-site registry, permission checks, managed/user-site merge, dynamic content script registration, and registration sync.
- `src/background/auditLog.js`: metadata-only audit event normalization, retention, and summaries.
- `src/compat/browser_api.js`: Chrome/Firefox browser API wrapper.
- `src/compat/platform.js`: platform detection helpers.

## AI/Onix
- `ai/scripts/generate_dataset.py`: deterministic synthetic training dataset generation. Default target is 50,000 records.
- `ai/scripts/evaluate_model.py`: independent synthetic plus held-out `ai/dataset/test/*.jsonl` evaluation, including real-sanitized metrics.
- `ai/scripts/features.py`: feature extraction shared by training/evaluation.
- `ai/scripts/train_classifier.py`: local sklearn model training from generated/labeled training data.
- `ai/scripts/export_onnx.py`: ONNX export.
- `ai/dataset/generated/*`: generated training data output.
- `ai/dataset/labeled/*`: optional manually reviewed training data.
- `ai/dataset/test/*`: held-out eval packs only. Do not copy exact holdout text into training.
- `ai/models/*`: generated model artifacts; do not change unless the task explicitly targets model regeneration.

## Runtime Script Order Rules
- Dependencies must load before consumers.
- `src/shared/runtime_scripts.js`, `manifests/base.json`, `manifests/firefox.json`, and `src/background/service_worker.js` must stay aligned.
- Dynamic content script registration must use `RuntimeScripts.contentScripts`.
- New runtime modules must be added to all required static and dynamic script lists.
- `src/content/content.js` must remain final in the content script list.
- `src/background/core.js` must remain final in the background script list.

Guard tests:
- `node tests/runtime_script_order.test.js`
- `node tests/runtime_script_order_contract.test.js`
- `node tests/build_targets.test.js`
- `node tests/security.test.js`

## Modularization Status
Major modularization is mostly complete. Future work should be small, focused, and test-backed.

Completed areas:
- Protected-site registry extracted to `src/background/protectedSiteRegistry.js`.
- Background audit summaries extracted to `src/background/auditLog.js`.
- Content debug routed through `src/content/diagnostics/contentDebugFacade.js`, `debugLogger.js`, `fileDebugMetadata.js`, and `safeSnapshots.js`.
- Runtime script order regression tests added.
- Detection helpers split under `src/shared/detection/*`.
- File extraction and handoff logic moved into focused `src/content/files/*` and `src/content/file_handoff_*.js` modules.
- Site adapters split under `src/content/adapters/*`.
- Response rehydration split under `src/content/rehydration/*`.
- Onix dataset/eval/training pipeline expanded with generated, labeled, and held-out test data documentation and tests.

Avoid broad rewrites. Do not use old line counts or older phase plans as current ownership facts.

## High-Risk Regression Areas
- Detector lifecycle order: regex/provider before entropy fallback before Onix before final redaction.
- Sensitive headers: keep names and separators visible while replacing full sensitive values.
- Placeholder trust: preserve only trusted placeholders known by the active session/public state.
- Known-secret reuse: repeated raw secrets must reuse placeholders across headers, assignments, prose, file content, and typed flows.
- Composer rewrites: verify final composer text before submission.
- File handoff: no raw replay after sanitization/consumption; unsupported or unsafe protected flows fail closed.
- Debug/audit/report output: metadata-only, no raw text, file names/paths, full class names, IDs, URLs with credentials, snippets, or stacks containing secrets.
- Browser compatibility: MV3 manifests, CSP, and wrapper APIs must keep Chrome and Firefox targets working.
- Local-only processing: AI assist, OCR, file scanning, reveal, and audit data must not send secrets to remote services.

## Test Ownership
- `tests/detector.test.js`: deterministic patterns, suppression, natural-language/labelled findings, placeholder formatting.
- `tests/detection/*.test.js`: provider, enterprise, structured metadata, placeholder family, live payload, and URL userinfo contracts.
- `tests/onix_dataset.test.js`: Onix dataset size/schema, held-out separation, lifecycle order, global email policy, and safe training data checks.
- `tests/ai_candidate_gate.test.js`, `tests/transform_with_ai.test.js`, `tests/ai_assist.test.js`: local Onix candidate and assist behavior.
- `tests/break_pack.test.js`: end-to-end regressions for headers, URLs, repeated secrets, and safe literals.
- `tests/placeholder_trust.test.js`: trusted placeholder preservation and remapping behavior.
- `tests/natural_language_context.test.js`: prose and labelled disclosure boundaries.
- `tests/ip_transform.test.js`, `tests/ip_child_first_audit.test.js`: IP/CIDR pseudonymization and hierarchy behavior.
- `tests/composer_helpers.test.js`, `tests/typed_interception.test.js`: textarea/contenteditable rewrite and typed interception behavior.
- `tests/content_file_drop_interception.test.js`, `tests/file_drop_payload_shape.test.js`, `tests/file_drop_streaming_guards.test.js`: protected-site file ingress and fail-closed behavior.
- `tests/file_scanner.test.js`, `tests/file_extractors.test.js`, `tests/file_type_registry.test.js`: scanner, extraction, and file type behavior.
- `tests/debug_logger.test.js`, `tests/file_debug_metadata.test.js`, `tests/security.test.js`: metadata-only debug and static security guards.
- `tests/protected_sites.test.js`, `tests/enterprise_policy.test.js`, `tests/background_audit_log.test.js`: protected-site, policy, and audit behavior.
- `tests/runtime_script_order.test.js`, `tests/runtime_script_order_contract.test.js`, `tests/build_targets.test.js`: runtime script order, manifests, and packaging.
- `tests/browser/*.mjs`, `tests/browser_qa_assertions.test.js`: browser smoke and browser QA report safety.
- `tests/synthetic_pack.test.js`, `tests/adversarial_redaction.test.js`, `tests/extreme_redaction_matrix.test.js`: broad synthetic/adversarial redaction coverage.

## Command Matrix
Core:
- `npm test`
- `npm run docs:check-links`
- `npm run smoke:chrome`
- `npm run smoke:firefox`
- `git diff --check`

Focused:
- `node tests/runtime_script_order.test.js`
- `node tests/runtime_script_order_contract.test.js`
- `node tests/security.test.js`
- `node tests/detector.test.js`
- `node tests/adversarial_redaction.test.js`
- `node tests/natural_language_context.test.js`
- `node tests/ai_candidate_gate.test.js`
- `node tests/onix_dataset.test.js`
- `node tests/file_scanner.test.js`
- `node tests/file_extractors.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/typed_interception.test.js`
- `node tests/protected_sites.test.js`
- `node tests/build_targets.test.js`

AI:
- `npm run prepare:build`
- `ai\.venv\Scripts\python.exe ai\scripts\evaluate_model.py`
- `ai\.venv\Scripts\python.exe -m py_compile ai\scripts\generate_dataset.py ai\scripts\evaluate_model.py ai\scripts\features.py`

JS syntax:
- `node --check <touched-js-file>`
