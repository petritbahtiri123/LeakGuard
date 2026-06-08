# LeakGuard Code Quality Audit

Date: 2026-05-20

## Executive Summary

This audit found no obvious safe deletion or behavior bug that should be fixed inside the audit pass. The biggest cleanup opportunity is not a single bad helper; it is the accumulated complexity around `src/content/content.js`, especially local file ingestion, Gemini/Grok pending attach, and fallback sequencing. Those paths are also heavily tested and behavior-critical, so the right approach is staged cleanup: strengthen tests around overlap and cancellation first, then extract shared helpers without changing gates, placeholder formats, provider names, permissions, or fail-closed behavior.

The build target scripts are comparatively clean after the recent build target cleanup. The redaction core has one meaningful duplication risk: known-secret reuse exists in both `redactor.js` and `transformOutboundPrompt.js`, with similar but not identical overlap logic.

## Ranked Findings

| ID | Severity | Risk type | Files | Evidence | Why it matters | Recommended action | Fix risk |
|---|---|---|---|---|---|---|---|
| CQ-01 | high | complexity | `src/content/content.js` | `maybeHandleLocalFileInsert()` is 498 lines (`10531-11028`). It handles transfer policy, raw event consumption, file reading, streaming redaction, Gemini/Grok pending attach, generic handoff, text fallback, download fallback, user messaging, and overlay cleanup. | This is the central fail-closed upload path. A local change can accidentally allow raw file pass-through, read streamed files back into memory, double-process a redispatch, or skip cleanup on error/cancel. | Add focused tests around cancellation/error cleanup first, then extract behavior-preserving subroutines for size/streaming branch, small-file redaction branch, and post-handoff UI cleanup. | high |
| CQ-02 | high | overlap | `src/content/content.js`, `docs/file-handoff-architecture.md` | `FILE_HANDOFF_ADAPTERS` declares `supportsPendingAttach: true` for Gemini, Grok, ChatGPT, Claude, OpenAI Chat, and X (`~5030-5265`), but `FILE_HANDOFF_PENDING_ATTACH_ENABLED` enables only Gemini/Grok (`230-237`) and `queuePendingSanitizedFileHandoff()` only queues Gemini/Grok (`7895-7915`). The architecture doc says pending attach is intentionally enabled only for Gemini/Grok. | The shape invites a future toggle mistake: enabling a non-Gemini/Grok adapter would pass the generic capability check but hit a queue path that returns false. In fail-closed flows this becomes blocked uploads; in maintenance it is easy to misread as implemented generic pending attach. | Keep the current gates unchanged. Add a test that asserts non-Gemini/Grok pending attach remains disabled and that the generic queue refuses unsupported enabled adapters clearly. Consider renaming `supportsPendingAttach` to distinguish "adapter has selectors" from "pending path is implemented". | medium |
| CQ-03 | medium | duplication | `src/content/content.js` | Gemini and Grok pending paths mirror each other: `clearPendingGeminiSanitizedFileHandoff()` (`8334-8380`) vs `clearPendingGrokSanitizedFileHandoff()` (`8670-8715`), `attemptPendingGeminiSanitizedFileHandoff()` (`8476-8554`) vs `attemptPendingGrokSanitizedFileHandoff()` (`8854-8931`), and `queuePendingGeminiSanitizedFileHandoff()` (`8556-8650`) vs `queuePendingGrokSanitizedFileHandoff()` (`8933-9026`). | Duplicate pending state machines increase drift risk in expiry, observer cleanup, click observation, prompt display, and sanitized file assignment. This area controls whether raw uploads stay blocked and sanitized files are attached once. | Do not consolidate first. Add table-driven tests for both providers, then extract only the common pending lifecycle shell while keeping provider-specific discovery and click predicates intact. | high |
| CQ-04 | medium | duplication | `src/shared/redactor.js`, `src/shared/transformOutboundPrompt.js` | Both files define `collectKnownSecretReplacements()`. `redactor.js` uses simple `overlapsAnyRange()` (`6-66`); `transformOutboundPrompt.js` has sorted range helpers and additional overlap rules (`88-259`). | Known raw secret reuse is a core invariant. Drift here can reintroduce raw prefixes/suffixes or cause repeated secrets to receive different placeholders depending on call path. | Extract a shared known-secret reuse helper after running detector, transform, streaming, and typed interception tests. Keep overlap semantics identical to the current transform path unless tests prove otherwise. | medium |
| CQ-05 | resolved | dead-code | `src/content/content.js`, `tests/content_file_drop_interception.test.js` | The stale Gemini editor-drop handler and its drop-only helpers were removed after adding a QA guard that proves production drop handling routes through `maybeHandleDrop()` rather than `maybeHandleGeminiEditorDrop()`. | Keeping this row as historical context only; there is no remaining production code to delete for this candidate. | No action. Continue to rely on `tests/content_file_drop_interception.test.js` for Gemini drop routing coverage. | none |
| CQ-06 | medium | duplication | `src/shared/fileScanner.js`, `src/content/file_paste_helpers.js`, `src/shared/streamingFileRedactor.js`, `src/content/content.js` | File limits/messages are repeated: `LOCAL_TEXT_HARD_BLOCK_BYTES` and `LARGE_TEXT_STREAMING_MAX_BYTES` in `fileScanner.js` (`5-12`), streaming max in `streamingFileRedactor.js` (`7-13`), fallback limits/messages in `content.js` (`176-191`), and file helper warning/read messages in `file_paste_helpers.js` (`4-12`, `121-129`). | Divergence here changes whether a file is scanned, streamed, blocked, or described as unsupported. Size threshold drift is especially risky for fail-closed upload handling. | Centralize exported constants/messages in `FileScanner`/`StreamingFileRedactor` and make content/helper code consume them without hard-coded fallbacks except for dependency-missing emergency defaults. | safe |
| CQ-07 | medium | complexity | `src/content/content.js` | A quick count found 169 `catch` blocks in `content.js`, including 85 silent `catch {}` blocks. Many are around host-controlled DOM selectors and best-effort cleanup, but they are not categorized. | Silent best-effort catches are reasonable for hostile/host DOM APIs, but they also hide cleanup failures in pending attach, observer removal, file input assignment, and fallback flows. | Classify catches into selector-probe, event-dispatch, cleanup, and security-critical assignment. Add safe debug labels for cleanup/assignment failures without logging raw content. | safe |
| CQ-08 | medium | test-gap | `tests/content_file_drop_interception.test.js`, `tests/typed_interception.test.js` | Several tests assert source strings or extract function bodies instead of exercising live behavior, e.g. generic pending wrapper extraction around `215-217`, many `contentSource.includes(...)` assertions in `typed_interception.test.js`, and broad function extraction lists around `1034-1143`. | Static tests are useful for guardrails, but they can pass while ordering, state cleanup, or async interactions break. This matters most for event suppression and pending attach. | Keep static tests, but add behavioral harness tests for non-Gemini/Grok pending-gate refusal, pending prompt cancel cleanup, and exception cleanup in `maybeHandleLocalFileInsert()`. | safe |
| CQ-09 | low | duplication | `src/content/content.js` | Host detection is duplicated between `isChatGptHost()`/`isGeminiHost()`/... (`5004-5024`), adapter `hosts` (`~5030-5265`), and `getCurrentHandoffDriverId()` (`5309-5317`). | Provider names and branches are intentional, but duplicated host matching can drift when domains change. | Do not remove provider names. Consider deriving `getCurrentHandoffDriverId()` from `FILE_HANDOFF_ADAPTERS` after adding tests for every provider host. | medium |
| CQ-10 | low | duplication | `src/content/content.js` | `showPendingSanitizedAttachPrompt()` emits three near-duplicate debug labels when shown (`pending-attach-prompt-shown`, `file-handoff:pending-prompt-shown`, `file-ui:pending-prompt-shown`) in both option-normalization and DOM-append paths (`1893-1904`, `1981-1992`). | Redundant debug events make logs harder to reason about and can hide which prompt path actually ran. | Collapse to one canonical debug event plus optional compatibility alias only if tests/log consumers require it. | safe |

## Safe First Fixes

1. Centralize duplicated file size constants and user-facing file messages behind existing `FileScanner`/`StreamingFileRedactor` exports.
2. Add behavioral tests for non-Gemini/Grok pending attach remaining disabled and fail-closed.
3. Add cleanup tests for pending prompt cancel/expiry and exception paths in `maybeHandleLocalFileInsert()`.
4. Add debug labels to selected cleanup/assignment `catch` blocks that currently swallow errors, with metadata-only payloads.
5. Resolved: `maybeHandleGeminiEditorDrop()` and its drop-only helpers were removed after call-graph proof and a dedicated QA guard.

## Do Not Touch Yet

- Gemini/Grok pending attach gates and provider-specific upload discovery.
- Firefox Gemini file-input bridge, ghost ingress, and hidden selector code.
- Placeholder format, placeholder reuse, trusted-placeholder pass-through, and right-to-left redaction order.
- File handoff fail-closed sequencing: direct sanitized handoff, tested pending attach, sanitized text fallback, sanitized download fallback, then block.
- Site-specific selectors and provider names in adapters/tests.
- Static tests that look brittle but encode important security invariants.

## Suggested Follow-up PR Plan

### PR 1: Safe cleanup

Scope:
- Centralize file constants/messages.
- Add missing behavioral tests for pending gate disabled cases and prompt cancel cleanup.
- Add metadata-only debug labels to selected cleanup catches.

Tests before and after:
- `node --check src/content/content.js`
- `node tests/file_paste_helpers.test.js`
- `node tests/streaming_file_redactor.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/security.test.js`
- `node tests/build_targets.test.js`

### PR 2: Tests around risky overlap

Scope:
- Add table-driven Gemini/Grok pending attach lifecycle tests.
- Add exception/cancel cleanup coverage for `maybeHandleLocalFileInsert()`.
- Add tests proving non-Gemini/Grok pending attach stays gated off.

Tests before and after:
- `node tests/content_file_drop_interception.test.js`
- `node tests/typed_interception.test.js`
- `node tests/security.test.js`
- `npm test`

### PR 3: Behavior-preserving extraction

Scope:
- Extract known-secret reuse into a shared helper.
- Extract common Gemini/Grok pending lifecycle only after PR 2 tests pass.
- Consider deriving host-to-driver lookup from adapters while preserving provider names.

Tests before and after:
- `node tests/detector.test.js`
- `node tests/typed_interception.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/streaming_file_redactor.test.js`
- `node tests/file_paste_helpers.test.js`
- `node tests/security.test.js`
- `npm test`
- `npm run build:all`

## Notes

- No code fixes were applied in this audit.
- Candidate dead code was not removed because production call absence alone is not enough proof for this repo.
- Recent changelog entries already identify pending attach/Gemini/Grok consolidation and shared redaction helper extraction as intentionally deferred risky cleanup areas.
