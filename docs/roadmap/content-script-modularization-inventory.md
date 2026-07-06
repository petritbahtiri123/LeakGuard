# Content Script Modularization Inventory

Status: in progress for `docs/roadmap/content-script-modularization-plan.md`.

## Baseline Snapshot

- Source: `src/content/content.js`
- Current size after M1-M7 extractions: 12,623 lines, 403 top-level function declarations.
- Net `content.js` change in this branch so far: 253 insertions, 404 deletions.
- Runtime behavior goal: no behavior changes; extracted modules preserve existing file, WhatsApp, composer, and adapter gates.

## Extracted Function-To-Module Map

| Plan phase | New module | Content-script functions now delegated |
| --- | --- | --- |
| M1 | `src/content/files/fileTypeSupport.js` | WhatsApp image/text/PDF/DOCX/XLSX support checks and multi-file support predicates |
| M2 | `src/content/files/sanitizedFileBatchProcessor.js` | Multi-file item summaries, blocked-before-processing summaries, per-file sanitized batch processing |
| M3 | `src/content/files/fileHandoffVerification.js` | WhatsApp sanitized batch type, count, order, identity, and raw-original verification |
| M4 | `src/content/files/fileDropInterception.js` | Synchronous file drag ownership for dragenter/dragover |
| M4 | `src/content/files/fileInputInterception.js` | File-input preflight, selected-transfer creation, selected-file checks, composer fallback gate |
| M5 | `src/content/whatsapp/whatsappCapabilities.js` | WhatsApp clipboard image paste, sanitized drop, handoff context, and multi-file capability gates |
| M6 | `src/content/composer/replayVerification.js` | Composer verification candidate collection, rewrite matching, and replay verification glue over `RewriteVerificationText` |

## Current Event-Flow Map

- Text typing: still routed primarily by `content.js`; low-level composer helpers remain in `content/composer_helpers.js`.
- Text paste: still routed by `content.js`; replay verification now delegates through `content/composer/replayVerification.js`.
- Clipboard image paste: WhatsApp capability gate moved to `content/whatsapp/whatsappCapabilities.js`; processing and handoff still route through `content.js`.
- File input attach: preflight moved to `content/files/fileInputInterception.js`; processing, UI, and handoff still route through `content.js`.
- Drag/drop: drag ownership moved to `content/files/fileDropInterception.js`; drop policy, UI, and handoff still route through `content.js`.
- Multi-file: support classification, batch processing, summaries, and verification moved to files modules; final UI/handoff orchestration still routes through `content.js`.
- Replay/send: rewrite matching moved to `content/composer/replayVerification.js`; send replay orchestration remains in `content.js`.
- Failure UI: still owned by `content.js`.

## Focused Tests

- `node tests/content_file_type_support.test.js`
- `node tests/sanitized_file_batch_processor.test.js`
- `node tests/file_handoff_verification.test.js`
- `node tests/file_interception_modules.test.js`
- `node tests/whatsapp_capabilities.test.js`
- `node tests/replay_verification.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/typed_interception.test.js`
- `node tests/adapter_contracts.test.js`
- `node tests/runtime_script_order.test.js`
- `node tests/runtime_script_order_contract.test.js`
- `node tests/build_targets.test.js`

## Remaining Large Clusters

- File UI overlays, pending attach prompts, and failure modal orchestration.
- WhatsApp text insertion, send replay, image-send bypass, and exact composer-state acceptance.
- Gemini/Grok upload discovery, pending attach, and Firefox bridge behavior.
- Generic file handoff discovery, safe activation, and sanitized fallback ordering.
- Submit/beforeinput/paste orchestration and transactional rewrite flows.
- Status panel, badge, policy modal, audit, and reveal wiring.
