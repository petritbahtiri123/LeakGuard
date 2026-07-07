# Content Script Modularization Inventory

Status: current progress record for `docs/roadmap/content-script-modularization-plan.md`.

## Baseline Snapshot

- Source: `src/content/content.js`
- Current size after the M8 local-file attach preflight extraction: 8,990 lines, 474 function declarations.
- Latest M8 `content.js` slice: 43 insertions, 33 deletions, moving local-file image/text size classification, large-payload hard block, text-fallback skip selection, and attach preflight plan/status into `content/files/localFileAttachPreflightOrchestration.js`.
- Runtime behavior goal: no behavior changes; extracted modules preserve existing file, WhatsApp, composer, and adapter gates.
- Remaining plan focus: Phase M8 final shrink. `content.js` still owns several large orchestration functions and should keep moving toward initialization, adapter resolution, event routing, module calls, and fail-closed UI only.

## Extracted Function-To-Module Map

| Plan phase | New module | Content-script functions now delegated |
| --- | --- | --- |
| M1 | `src/content/files/fileTypeSupport.js` | WhatsApp image/text/PDF/DOCX/XLSX support checks and multi-file support predicates |
| M1/M8 | `src/content/files/fileTransferPolicy.js` | Local text size classification, unsupported transfer policy decisions, and single-file local transfer fail-closed/pass-through UI gate |
| M2 | `src/content/files/sanitizedFileBatchProcessor.js` | Multi-file item summaries, blocked-before-processing summaries, per-file sanitized batch processing |
| M2/M8 | `src/content/files/multiFileInsertOrchestration.js` | Multi-file protected upload event ownership, pre-read blocks, local batch processing coordination, pending Gemini/Grok queue fallback, and sanitized batch handoff orchestration |
| M2/M8 | `src/content/files/streamingFileInsertOrchestration.js` | Single-file streaming-required local redaction, Gemini/Grok pending attach queueing, generic sanitized handoff fallback, and streaming fail-closed outcomes |
| M2/M8 | `src/content/files/localFileReadOrchestration.js` | Single-file local file read, content-extraction read handoff, sanitized-handoff suppression, streaming-required delegation, file-input scan metadata, and read/scan fail-closed outcomes |
| M2/M8 | `src/content/files/localFileAttachPreflightOrchestration.js` | Single-file local image/text size classification, large-payload hard block, text-fallback skip selection, attach preflight planning, and optimization status display |
| M2/M8 | `src/content/files/localFileSanitizationOrchestration.js` | Single-file local analysis/redaction, ready content-extraction result handling, sanitized file creation, redaction progress UI, and sanitization fail-closed outcomes |
| M2/M8 | `src/content/files/sanitizedFileInsertOrchestration.js` | Non-streaming single-file sanitized local attach payload setup, Gemini/Grok/generic pending attach fallback, image file-only handoff flags, WhatsApp sanitized image markers, and fail-closed outcomes |
| M3 | `src/content/files/fileHandoffVerification.js` | WhatsApp sanitized batch type, count, order, identity, and raw-original verification |
| M4 | `src/content/files/fileDropInterception.js` | Synchronous file drag ownership for dragenter/dragover |
| M4 | `src/content/files/fileInputInterception.js` | File-input preflight, selected-transfer creation, selected-file checks, composer fallback gate |
| M4 | `src/content/files/fileInputPreparation.js` | File-input accept checks, transfer assignment, and sanitized handoff preparation |
| M4 | `src/content/files/fileProcessingUi.js` | Protected-file progress, failure, and blocked-file UI message preparation |
| M5 | `src/content/whatsapp/whatsappCapabilities.js` | WhatsApp clipboard image paste, sanitized drop, handoff context, and multi-file capability gates |
| M5 | `src/content/whatsapp/whatsappSelectors.js` | WhatsApp document selectors, attach targets, and DOM probes |
| M5 | `src/content/whatsapp/whatsappTextFlow.js` | WhatsApp typed-secret and paste state helpers |
| M6 | `src/content/composer/replayVerification.js` | Composer verification candidate collection, rewrite matching, and replay verification glue over `RewriteVerificationText` |
| M8 support | `src/content/ui/contentStatusUi.js` | Protected-site status panel and badge rendering helpers |
| M8 support | `src/content/ui/contentModalUi.js` | Decision, message, and Gemini large-text confirmation modal rendering helpers |
| Adapter cleanup | `src/content/adapters/grokFileHandoff.js` | Grok upload discovery, pending file input, and sanitized handoff helpers |
| Adapter cleanup | `src/content/adapters/geminiUploadDiscovery.js` | Gemini upload menu, hidden selector, and safe activation discovery helpers |
| Adapter cleanup | `src/content/adapters/geminiFileHandoff.js` | Gemini Firefox bridge, pending user attach, ghost ingress, and sanitized upload handoff helpers |
| Handoff cleanup | `src/content/files/fileHandoffDiscovery.js` | Generic adapter upload trigger and file-input discovery helpers |
| Handoff cleanup | `src/content/files/sanitizedFileHandoff.js` | Sanitized single-file and batch handoff assignment helpers |

## Current Event-Flow Map

- Text typing: WhatsApp typed-secret state helpers delegate through `content/whatsapp/whatsappTextFlow.js`; submit/send orchestration still routes through `content.js`.
- Text paste: WhatsApp paste state helpers delegate through `content/whatsapp/whatsappTextFlow.js`; transactional paste orchestration still routes through `content.js`.
- Clipboard image paste: WhatsApp capability gates live in `content/whatsapp/whatsappCapabilities.js`; processing and final image handoff still route through `content.js`.
- File input attach: preflight, input preparation, support checks, unsupported transfer policy gate, single-file read/error routing, local size/preflight planning, streaming handoff orchestration, single-file sanitization/result creation, non-streaming sanitized file attach orchestration, batch processing, multi-file orchestration, verification, and sanitized assignment are delegated; high-level file-event routing and delegated-flow sequencing still run through `content.js`.
- Drag/drop: drag ownership is delegated to `content/files/fileDropInterception.js`; drop orchestration still routes through `content.js`.
- Multi-file: support classification, batch processing, all-or-nothing flow ownership, pending Gemini/Grok handoff fallback, verification, and sanitized batch assignment are delegated; `content.js` keeps the wrapper call from local file insert routing.
- Replay/send: rewrite matching delegates through `content/composer/replayVerification.js`; beforeinput, submit, fallback key, and click send orchestration remain in `content.js`.
- Failure/status UI: panel, badge, modal, and file-processing UI helpers are delegated; fail-closed decision routing remains in `content.js`.
- Gemini/Grok handoff: adapter-specific discovery and sanitized handoff helpers are delegated; `content.js` still coordinates when those paths are attempted.

## Focused Tests

- `node tests/content_file_type_support.test.js`
- `node tests/file_transfer_policy_gate.test.js`
- `node tests/sanitized_file_batch_processor.test.js`
- `node tests/file_handoff_verification.test.js`
- `node tests/file_interception_modules.test.js`
- `node tests/file_input_preparation.test.js`
- `node tests/file_processing_ui.test.js`
- `node tests/content_status_ui.test.js`
- `node tests/content_modal_ui.test.js`
- `node tests/whatsapp_capabilities.test.js`
- `node tests/whatsapp_selectors.test.js`
- `node tests/whatsapp_text_flow.test.js`
- `node tests/replay_verification.test.js`
- `node tests/grok_file_handoff.test.js`
- `node tests/gemini_upload_discovery.test.js`
- `node tests/gemini_file_handoff.test.js`
- `node tests/file_handoff_discovery.test.js`
- `node tests/sanitized_file_handoff.test.js`
- `node tests/multi_file_insert_orchestration.test.js`
- `node tests/streaming_file_insert_orchestration.test.js`
- `node tests/local_file_read_orchestration.test.js`
- `node tests/local_file_attach_preflight_orchestration.test.js`
- `node tests/local_file_sanitization_orchestration.test.js`
- `node tests/sanitized_file_insert_orchestration.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/typed_interception.test.js`
- `node tests/adapter_contracts.test.js`
- `node tests/runtime_script_order.test.js`
- `node tests/runtime_script_order_contract.test.js`
- `node tests/build_targets.test.js`
- `node tests/security.test.js`

## Remaining Large Clusters

- `maybeHandleLocalFileInsert` remaining file-event routing, WhatsApp attach gates, local transfer policy handoff, and calls into delegated read/preflight/sanitization/attach flows.
- `maybeHandleBeforeInput`, `maybeHandlePaste`, `maybeHandleSubmit`, `maybeHandleFallbackSendKey`, and `maybeHandleTypedSecrets`.
- WhatsApp image-send bypass, send replay, and exact composer-state acceptance.
- `maybeHandleGeminiEditorPaste` and the remaining Gemini/Grok orchestration wrappers.
- File input/drop orchestration after interception and before sanitized handoff.
- Policy, audit, reveal, and status wiring that should stay thin but still lives in `content.js`.
