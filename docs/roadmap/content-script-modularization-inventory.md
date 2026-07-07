# Content Script Modularization Inventory

Status: current progress record for `docs/roadmap/content-script-modularization-plan.md`.

## Baseline Snapshot

- Source: `src/content/content.js`
- Current size after the M8 Gemini file-handoff discovery extraction: 7,421 lines, 482 function declarations.
- Latest M8 `content.js` slice: 21 insertions, 223 deletions, moving Gemini file-input scoring/discovery, handoff/overlay summaries, ghost-ingress file-input detection, and attachment indicator wait/count helpers into `content/adapters/geminiFileHandoff.js` while leaving compatibility delegates in `content.js`.
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
| M2/M8 | `src/content/files/localFileInsertOrchestration.js` | Single-file local insert eligibility, WhatsApp unsupported attach blocking, multi-file delegation, transfer policy short-circuiting, event ownership, file-input clearing/logging, and read/preflight/sanitization/attach sequencing |
| M3 | `src/content/files/fileHandoffVerification.js` | WhatsApp sanitized batch type, count, order, identity, and raw-original verification |
| M4 | `src/content/files/fileDropInterception.js` | Synchronous file drag ownership for dragenter/dragover |
| M4/M8 | `src/content/files/fileDropOrchestration.js` | Drop event routing, Firefox/Gemini unavailable-file blocking, WhatsApp unsupported drop blocking, unsupported transfer policy branches, Gemini raw pass-through, raw drop ownership, Gemini drop-session hashing, and local insert delegation |
| M4 | `src/content/files/fileInputInterception.js` | File-input preflight, selected-transfer creation, selected-file checks, composer fallback gate |
| M4/M8 | `src/content/files/fileInputChangeOrchestration.js` | File-input change routing, sanitized redispatch suppression, Firefox transaction state, duplicate raw-event suppression, composer fallback gating, selected transfer creation, and local insert delegation |
| M4 | `src/content/files/fileInputPreparation.js` | File-input accept checks, transfer assignment, and sanitized handoff preparation |
| M4 | `src/content/files/fileProcessingUi.js` | Protected-file progress, failure, and blocked-file UI message preparation |
| M5 | `src/content/whatsapp/whatsappCapabilities.js` | WhatsApp clipboard image paste, sanitized drop, handoff context, and multi-file capability gates |
| M5 | `src/content/whatsapp/whatsappSelectors.js` | WhatsApp document selectors, attach targets, and DOM probes |
| M5 | `src/content/whatsapp/whatsappTextFlow.js` | WhatsApp typed-secret and paste state helpers |
| M6 | `src/content/composer/replayVerification.js` | Composer verification candidate collection, rewrite matching, and replay verification glue over `RewriteVerificationText` |
| M6/M8 | `src/content/composer/chatgptLargePasteOrchestration.js` | ChatGPT large pasted-text hard block, sanitized text-file handoff, verified composer text fallback, and fail-closed paste handling |
| M6/M8 | `src/content/composer/geminiEditorPasteOrchestration.js` | Gemini editor pasted-text size gating, pause-aware decision flow, safe editor insertion, optimization cleanup, and fail-closed paste handling |
| M6/M8 | `src/content/composer/fallbackSendKeyOrchestration.js` | Enter-send fallback ownership, WhatsApp text-send guards, policy/redaction branches, normalized replay, and verified send queueing |
| M6/M8 | `src/content/composer/typedSecretScanOrchestration.js` | Delayed typed-secret scan generation, stale composer guards, placeholder normalization, policy/redaction branches, and live rewrite failure handling |
| M6/M8 | `src/content/composer/beforeInputOrchestration.js` | Beforeinput paste delegation, programmatic rewrite suppression, synchronous typed-event ownership, live typed policy/redaction branches, and placeholder normalization |
| M6/M8 | `src/content/composer/submitOrchestration.js` | Submit modal/bypass gates, WhatsApp sanitized-image send bypass, composer/submitter replay selection, text-send ownership, policy/redaction branches, and verified send queueing |
| M6/M8 | `src/content/composer/sendButtonClickOrchestration.js` | Send-button modal/backdrop gates, click bypass state, WhatsApp fail-closed checks, sanitized-image click bypass, safe text ownership, and synthetic submit routing |
| M6/M8 | `src/content/composer/pasteOrchestration.js` | General paste gates, Gemini editor delegation, WhatsApp file-paste fail-closed checks, local file paste routing, duplicate WhatsApp text suppression, large-paste handoff, policy/redaction branches, and transactional paste decisions |
| M8 support | `src/content/ui/contentStatusUi.js` | Protected-site status panel and badge rendering helpers |
| M8 support | `src/content/ui/contentModalUi.js` | Decision, message, and Gemini large-text confirmation modal rendering helpers |
| Adapter cleanup | `src/content/adapters/grokFileHandoff.js` | Grok upload discovery, pending file input, and sanitized handoff helpers |
| Adapter cleanup | `src/content/adapters/geminiUploadDiscovery.js` | Gemini upload-menu button predicates/finder, upload menu, hidden selector, and safe activation discovery helpers |
| Adapter cleanup | `src/content/adapters/geminiFileHandoff.js` | Gemini file-input scoring/discovery, handoff/overlay summaries, attachment indicators, Firefox bridge, pending user attach, ghost ingress, and sanitized upload handoff helpers |
| Handoff cleanup | `src/content/files/fileHandoffDiscovery.js` | Generic adapter upload trigger and file-input discovery helpers |
| Handoff cleanup | `src/content/files/sanitizedFileHandoff.js` | Sanitized single-file and batch handoff assignment helpers |

## Current Event-Flow Map

- Text typing: WhatsApp typed-secret state helpers delegate through `content/whatsapp/whatsappTextFlow.js`; beforeinput typed interception delegates through `content/composer/beforeInputOrchestration.js`; delayed typed-secret scan orchestration delegates through `content/composer/typedSecretScanOrchestration.js`.
- Text paste: WhatsApp paste state helpers delegate through `content/whatsapp/whatsappTextFlow.js`; ChatGPT large-paste sanitized file handoff and verified text fallback delegate through `content/composer/chatgptLargePasteOrchestration.js`; Gemini editor paste decision/insertion delegates through `content/composer/geminiEditorPasteOrchestration.js`; general transactional paste orchestration delegates through `content/composer/pasteOrchestration.js`.
- Clipboard image paste: WhatsApp capability gates live in `content/whatsapp/whatsappCapabilities.js`; file paste processing delegates through `content/files/localFileInsertOrchestration.js`.
- File input attach: preflight, input preparation, change-event routing, support checks, unsupported transfer policy gate, single-file insert routing, single-file read/error routing, local size/preflight planning, streaming handoff orchestration, single-file sanitization/result creation, non-streaming sanitized file attach orchestration, batch processing, multi-file orchestration, verification, and sanitized assignment are delegated.
- Drag/drop: drag ownership is delegated to `content/files/fileDropInterception.js`; drop routing delegates through `content/files/fileDropOrchestration.js`.
- Multi-file: support classification, batch processing, all-or-nothing flow ownership, pending Gemini/Grok handoff fallback, verification, and sanitized batch assignment are delegated; `content/files/localFileInsertOrchestration.js` owns the wrapper call from local file insert routing.
- Replay/send: rewrite matching delegates through `content/composer/replayVerification.js`; Enter-send fallback orchestration delegates through `content/composer/fallbackSendKeyOrchestration.js`; submit orchestration delegates through `content/composer/submitOrchestration.js`; click send orchestration delegates through `content/composer/sendButtonClickOrchestration.js`.
- Failure/status UI: panel, badge, modal, and file-processing UI helpers are delegated; fail-closed decision routing remains in `content.js`.
- Gemini/Grok handoff: adapter-specific upload-menu, file-input/pending-input discovery, attachment indicators, and sanitized handoff helpers are delegated; `content.js` still coordinates when those paths are attempted.

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
- `node tests/local_file_insert_orchestration.test.js`
- `node tests/file_drop_orchestration.test.js`
- `node tests/file_input_change_orchestration.test.js`
- `node tests/chatgpt_large_paste_orchestration.test.js`
- `node tests/gemini_editor_paste_orchestration.test.js`
- `node tests/fallback_send_key_orchestration.test.js`
- `node tests/typed_secret_scan_orchestration.test.js`
- `node tests/before_input_orchestration.test.js`
- `node tests/submit_orchestration.test.js`
- `node tests/send_button_click_orchestration.test.js`
- `node tests/paste_orchestration.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/typed_interception.test.js`
- `node tests/adapter_contracts.test.js`
- `node tests/runtime_script_order.test.js`
- `node tests/runtime_script_order_contract.test.js`
- `node tests/build_targets.test.js`
- `node tests/security.test.js`

## Remaining Large Clusters

- Policy, audit, reveal, and status wiring that should stay thin but still lives in `content.js`.
