# Phase 8 Gemini Editor/Drop Safety Review

Date: 2026-06-07

Scope: Gemini editor/drop helper cluster before any Phase 8 cleanup, deletion,
or movement. This is a routing and coverage-gap note only. It does not propose
runtime behavior changes.

Prior art:

- `docs/codex-playbooks/gemini-drag-drop-file-ingestion.md`
- `docs/phase-8-source-extraction-test-inventory.md`
- `docs/leakguard-human-review-and-modularization-plan.md`
- `docs/code-quality-audit.md`

## Current Routing Summary

Gemini drag/drop file ingestion now routes through the generic file handoff
drop path:

```text
drop listener
  -> bindEvents() onFileDrop
  -> maybeHandleDrop(event)
  -> maybeHandleLocalFileInsert(event, input, dataTransfer, "drop")
  -> sanitized file/payload creation
  -> Gemini sanitized file handoff, pending attach, sanitized text fallback,
     sanitized download, or fail-closed block
```

Gemini editor paste still has a Gemini-specific route:

```text
paste listener
  -> maybeHandlePaste(event)
  -> maybeHandleGeminiEditorPaste(event)
  -> applyGeminiEditorText(editor, sanitizedText, "gemini-paste", ...)
```

Gemini sanitized file fallback text routes through:

```text
file attach fallback
  -> insertGeminiSanitizedText(payload, event, input)
  -> applyGeminiSanitizedTextFallback(event, input, formattedText, ...)
  -> applyGeminiEditorText(...) or applyPasteDecision(...)
```

`insertGeminiLocalFileText(event, input, redactedText, options)` still exists
in `src/content/content.js`. PR 8C routing proof below classifies it as
test-only/source-shape guarded in the current tree, not production-routed.

## Helper Status

| Helper | Current status | Routing evidence | Deletion/move guidance |
| --- | --- | --- | --- |
| `maybeHandleGeminiEditorDrop` | Legacy removed helper. | Current repo references it only in source-shape tests and historical docs. `testProductionGeminiDropPathDoesNotUseLegacyEditorDropHandler()` asserts active drop routing does not call it. | No production code remains to delete. Keep the source-shape guard until browser drop coverage proves the same routing. |
| `listGeminiDropFiles` | Legacy removed helper. | Current repo references it only in historical docs. | No production code remains to delete. Do not recreate it unless a new evidence-backed Gemini DOM issue requires it. |
| `isSupportedGeminiTextFile` | Legacy removed helper. | Current repo references it only in historical docs. File support now flows through shared/local file transfer policy and scanner helpers. | No production code remains to delete. Keep support/unsupported behavior covered through current file policy tests. |
| `readGeminiTextFile` | Legacy removed helper. | Current repo references it only in historical docs. Reading now routes through local file insert/scanner paths. | No production code remains to delete. Do not add a Gemini-only file reader without a separate safety review. |
| `insertGeminiLocalFileText` | Test-only/source-shape guarded in the current tree. Side-effectful fallback helper remains in `content.js` and test harness extraction. | PR 8C repo-wide search found definition, ESLint harness allowlist, docs, and `tests/content_file_drop_interception.test.js` extraction only; no production caller, dynamic/global export, manifest/load-order reference, or emergency fallback caller. | Do not delete in PR 8C. It is a removable-later candidate only after a follow-up removes or replaces the test harness dependency and preserves the production fallback path below. |
| `maybeHandleGeminiEditorPaste` | Production-routed paste helper. | `maybeHandlePaste()` calls it on Gemini before generic composer paste handling. | Do not merge with drop cleanup. It protects raw paste blocking and Gemini editor rewrite verification. |
| `applyGeminiEditorText` | Production-routed editor writer/fallback core. | Called by Gemini paste and sanitized text fallback paths. | Do not move until dedicated editor-writer tests cover cancellation, raw replacement, multiline preservation, and verification failure. |
| `applyGeminiSanitizedTextFallback` | Production-routed sanitized file text fallback. | Called by `insertGeminiSanitizedText()` and generic `applySanitizedTextFallback()` when on Gemini. | Keep in place until fallback insertion behavior has focused coverage independent of the broad file-drop harness. |
| `tryFirefoxGeminiFileInputBridge` | Production-routed Firefox Gemini file-input bridge. | Injected through `createFileHandoffFlow()` and guarded by tests covering no replay/no picker/open behavior. | Do not change in PR 8B. Future cleanup must preserve no synthetic raw drop replay and no picker opening. |
| `handOffGeminiSanitizedFileUpload` | Production-routed Gemini sanitized upload handoff. | Called by sanitized file attach flow and many focused harness tests. | Do not change in PR 8B. Future cleanup must preserve discovered input handoff, pending attach handoff, and no synthetic drop redispatch. |

## Current Coverage

The large file/drop harness already covers the requested Gemini safety areas:

- Gemini drag/drop supported text file:
  `testGeminiQlEditorDropTextFileIsSanitizedAndHandedOff()`,
  `testLargeGeminiDropUsesSanitizedFileHandoff()`,
  `testGeminiTextLikeFileExtensionsAreSanitized()`
- Gemini unsupported file:
  `testUnsupportedDocumentAndImageFilesPassThroughByDefault()`,
  `testUnsupportedBinaryIsBlockedBeforeGeminiPolicyPassThrough()`,
  `testUnsupportedFileInputWarnsAndKeepsComposerUsable()`
- No synthetic raw drop replay:
  `testProductionGeminiDropPathDoesNotUseLegacyEditorDropHandler()`,
  `testGeminiUploadHandoffDoesNotRedispatchSyntheticDrop()`
- No Firefox picker/open replay:
  `testFirefoxGeminiFileInputBridgeDoesNotReplayOrOpenPicker()`,
  `testFirefoxGeminiItemsOnlyDropExtractsFileAndUsesFileInputBridge()`
- Pending attach cleanup on navigation/invalidation:
  `testUrlChangeClearsPendingGeminiHandoff()`,
  `testExtensionInvalidationClearsPendingGeminiHandoff()`,
  `testGeminiPendingHandoffExpiresAndCleansUp()`
- Fallback insertion behavior:
  `testGeminiDropFallsBackToSanitizedComposerTextWhenNativeUploadUnavailable()`,
  `testFirefoxGeminiTextFallbackPreservesMultilineBlocks()`,
  `testFirefoxGeminiTextFallbackFindsEditorFromParagraphContainer()`,
  `testFirefoxGeminiBlankTextInsertFallsBackToVerifiedRewrite()`,
  `testFirefoxGeminiEmptySanitizedTextDoesNotInsertBlankFallback()`,
  `testGeminiHiddenFileDropUsesSnapshotThenSanitizedTextFallback()`,
  `testGeminiTextFallbackFailureNeverLeaksRawContent()`

## Coverage Gaps Before Future Deletion Or Movement

These are not PR 8B implementation tasks. They are the minimum evidence needed
before future cleanup:

1. `insertGeminiLocalFileText()` removal readiness
   - PR 8C proves no current production caller, but the helper is still
     source-extracted by the broad file/drop harness and allowlisted in ESLint.
   - A future removal PR must either stop extracting it or replace that harness
     dependency with focused coverage of the production fallback path.
   - If retained as an emergency fallback despite no caller, add focused tests
     for cancellation, editor resolution, raw-content replacement, and
     missing-composer failure.

2. Runtime/browser replacement for source-shape routing guards
   - Current guards prove no old helper name, no synthetic drop redispatch, and
     no Firefox picker/open path through source inspection.
   - Browser-level replacements should prove a Gemini drop is consumed once,
     redacted once, and never replayed to page drop handlers with raw files.

3. Direct Gemini unsupported-file browser evidence
   - Current harness coverage is strong, but browser QA should eventually cover
     unsupported Gemini drop/file-input behavior with synthetic files.

4. Pending attach cleanup under route churn
   - Source-shape tests verify cleanup calls on navigation and extension
     invalidation.
   - A future runtime harness should simulate route changes with pending
     sanitized Gemini state and verify no later upload input receives stale
     files.

5. Fallback insertion split
   - Current fallback insertion coverage lives in the broad file/drop harness.
   - Future focused tests should isolate editor resolution, multiline direct
     insertion, verified rewrite fallback, and raw-text absence before moving
     any writer helper.

## Future Cleanup Recommendation

Do not delete or move Gemini editor/drop code in PR 8B. The safe order is:

1. Add focused fallback insertion tests before moving any Gemini editor writer.
2. Add browser/runtime replacements for no-replay and pending cleanup
   source-shape assertions.
3. Only then remove or collapse source-extraction assertions, one small group
   at a time.

Non-negotiable invariants:

- Raw file drops must be consumed before host page ingestion when LeakGuard
  takes responsibility for the transfer.
- Sanitized Gemini drops must not dispatch synthetic raw drop events.
- Firefox Gemini bridge must not open a picker or replay drag/drop events.
- Pending Gemini sanitized files must clear on assignment, cancellation,
  expiration, navigation, and extension invalidation.
- Fallback insertion must never leave raw file content in the editor, modal,
  debug event, storage, or sanitized file metadata.

## PR 8C insertGeminiLocalFileText Routing Proof

Classification: test-only/source-shape guarded in the current repo; removable
later, but not in PR 8C.

Repo-wide evidence checked:

- Production callers: none found outside the function definition.
- Test extraction callers: `tests/content_file_drop_interception.test.js`
  extracts the helper into its generated content-script harness.
- Dynamic/global references: none found. The helper is local to the content
  script closure and is not assigned to `globalThis`, `window`, `PWM`, adapter
  modules, or file handoff modules.
- String-based references: docs, the test extraction, and
  `eslint.config.mjs` mention the name. The ESLint entry is a harness allowlist
  for source-extracted content helpers, not a runtime route.
- Manifest/load-order references: none found. `manifests/base.json` loads
  `content/file_handoff_flow.js` before `content/content.js`; `content.js`
  injects `insertGeminiSanitizedText` into `createFileHandoffFlow()`, not
  `insertGeminiLocalFileText`.
- Emergency fallback references: none found. The production fallback path uses
  `insertGeminiSanitizedText`, `applyGeminiSanitizedTextFallback()`, and
  `applySanitizedTextFallback()` on Gemini.

Current production replacement path for Gemini fallback insertion:

```text
createFileHandoffFlow()
  -> insertSanitizedPayloadText(payload, event, input, context)
  -> insertGeminiSanitizedText(payload, event, input)
  -> applyGeminiSanitizedTextFallback(event, input, formattedText, ...)
  -> applyGeminiEditorText(...) or applyPasteDecision(...)
```

Additional Gemini fallback route:

```text
applySanitizedTextFallback(event, input, redactedText, options)
  -> isGeminiHost()
  -> applyGeminiSanitizedTextFallback(event, input, redactedText, options)
```

Removal recommendation:

- Do not delete `insertGeminiLocalFileText()` in PR 8C.
- Treat it as a removable-later candidate once the test harness no longer
  extracts it and the production replacement path has focused source-shape or
  runtime coverage.
- If removed later, also remove the matching ESLint harness allowlist entry and
  update this review note.
