# Phase 8 Source-Extraction Test Inventory

Date: 2026-06-07

> Historical inventory note, 2026-06-18: content modularization has advanced since this inventory. Use `docs/REPO_MAP.md`, `docs/CODEX_FAST_CONTEXT.md`, and runtime order tests for current module ownership and loading rules.

Scope: `tests/content_file_drop_interception.test.js`.

This inventory maps the large source-extraction-heavy file/drop tests before
Gemini, Grok, pending attach, or file handoff code is refactored again. It is
not a deletion plan. No assertion listed here should be removed until equal or
stronger runtime harness coverage exists.

## Source-Extraction-Heavy Sections

The file has three source-heavy patterns:

- Harness assembly extracts content-script functions into local test sandboxes
  with `extractFunctionSource()` and `extractConstSource()`. This lets the test
  execute side-effectful content-script helpers without loading the whole
  extension runtime.
- Source-shape assertions scan extracted production functions for forbidden or
  required strings, such as avoiding synthetic drop replay or preserving
  pending attach cleanup on navigation.
- Static registry checks scan adapter and content-script source to ensure
  provider gates remain explicit.

These patterns are noisy, but they protect security-sensitive file ingress
behavior while `src/content/content.js` still owns Gemini editor fallback,
Firefox bridge, pending attach state, and final raw-file blocking.

## Inventory

| Area | Current assertion group | Security invariant protected | Keep/replace status |
| --- | --- | --- | --- |
| Raw drop blocking | `testFileDropIsBlockedWithoutHelperLoaded()`, `testFileDropIsConsumedBeforeComposerLookup()`, `testGeminiOverHardLimitDropIsBlockedBeforeInsertion()`, `testInvalidUtf8DropBlocksWithoutOriginalHandoff()`, `testFailedScanCannotReachOriginalOrSanitizedHandoff()` | Raw local files must be consumed or blocked before the page or composer can ingest them when LeakGuard cannot safely scan or hand off sanitized content. | Candidate for runtime harness replacement later, but keep current extraction coverage until browser drop tests cover the same fail-closed event ordering. |
| Sanitized payload shape | `testFileAttachPipelineCreatesSanitizedPayloadMetadata()`, `testFileAttachDebugMetadataSchemaFiltersUnsafePayloads()`, `testChatGptAndClaudeUseStructuredSanitizedTextWhenFileAttachUnavailable()`, `testGenericTextFallbackFailureUsesSanitizedDownload()` | Sanitized fallback text, sanitized file metadata, and debug payloads must contain placeholders and safe metadata, never raw file content or raw secret strings. | Candidate for smaller focused unit tests later. Keep current mixed harness coverage until payload schemas are isolated from content-script globals. |
| Fallback order | `testSanitizedPayloadFallbackOrderRemainsStable()`, `testFileAttachPipelineDropUsesInjectedHandoffOnly()`, `testFileAttachPipelineNonDropAttemptsFileBeforeTextFallback()`, `testFileAttachPipelineNonDropFileSuccessSkipsFallback()`, `testGeminiStreamingFileInputFallsBackToSanitizedTextWhenUploadRejected()` | File upload paths must prefer sanitized file handoff where safe, fall back to sanitized text/download only in the intended order, and never fall back to raw upload. | Candidate for smaller focused unit tests later. Keep current coverage for drop-vs-non-drop ordering and Gemini-specific fallback behavior. |
| Streaming no-full-file-read | `testGeminiLargeFileInputWithoutComposerUsesStreamingSanitizedHandoff()`, `testDropOverHardLimitUsesStreamingSanitizedFileHandoff()`, `testChatGptStreamingDropWithoutFileInputFailsClosedWithoutReadingSanitizedText()`, `testGeminiStreamingDropQueuesPendingAfterStreamingWithoutTextFallback()`, `testBackgroundSkipsDuplicateDetectorScanForStreamingChunks()` | Large file paths must stream-redact locally, avoid reading full sanitized files for unsafe fallback, avoid duplicate background detector scans, and stay fail-closed when no safe handoff exists. | Keep as source-extraction for now, especially the `skipBackgroundScan` static check. Replace only after streaming harnesses can observe no full-file-read behavior directly. |
| Gemini pending attach | `testGeminiPendingDropAssignsSanitizedFileWhenInputLaterAppears()`, `testGeminiPendingMutationObserverAssignsWhenInputAppears()`, `testGeminiPendingHandoffStoresSanitizedFileOnly()`, `testGeminiPendingHandoffExpiresAndCleansUp()`, `testGeminiPendingUploadClickThenFiledataInputAssignsSanitizedFile()`, `testGeminiPendingAttachPromptButtonCompletesTrustedAttach()` | Pending Gemini attach must store only sanitized files, wait for trusted user/upload signals, expire and clean up, and assign sanitized content only when a real file input appears. | Candidate for runtime harness replacement later. Keep source extraction until live/browser Gemini attach coverage can prove the same lifecycle and cleanup behavior. |
| Grok pending attach | `testGrokPendingHandoffExpiresAndCleansUp()`, `testGrokPendingUploadClickThenFileInputAssignsSanitizedFile()`, `testGrokPendingAttachPromptButtonAssignsSanitizedFile()`, `testGrokStreamingDropQueuesPendingAfterStreamingWithoutTextFallback()` | Grok pending attach follows the same local-only sanitized-file lifecycle while keeping Grok-specific discovery and click predicates distinct. | Candidate for smaller focused unit tests later, after table-driven lifecycle tests prove which behavior is shared with Gemini and which remains provider-specific. |
| Adapter routing | `testFileHandoffAdapterRegistryCoversSupportedSites()`, `testUnprovenAdaptersKeepPendingAttachFeatureGated()`, `testChatGptPendingAttachRemainsDisabled()`, `testNonGeminiFileInputWithoutComposerStillIgnored()`, `testUserManagedProtectedSiteDropUsesGenericSanitizedHandoff()` | Built-in hosts must resolve to the expected adapter, pending attach must stay enabled only for Gemini/Grok, and generic/user-managed routes must not inherit provider-only behavior. | Keep as source-extraction for now. Later replacement should be a focused adapter contract test plus browser harness coverage for generic routes. |
| Debug raw-safety | `testGeminiPendingDropLogsExposureDiagnosticsWithoutRawContent()`, `testPendingCleanupErrorsClearStateAndLogMetadataOnly()`, `testSanitizedFileHandoffFailureLogsSafeErrorMetadataOnly()`, `testGeminiUploadOverlayFailureLogsMetadataOnly()`, `testGeminiUploadToolsOverlayMissDoesNotReportUnsafeTrigger()` | Diagnostics must preserve useful stage/adapter metadata while excluding raw file content, raw secret values, full unsafe errors, and unsafe trigger details. | Candidate for smaller focused unit tests later. Keep current guards while raw-safe logger migration is still close to file handoff internals. |
| Duplicate suppression | `testDuplicateDropListenerDoesNotDoubleHandleSameEvent()`, `testSanitizedFileInputRedispatchDoesNotRescanSanitizedFile()`, `testSanitizedHandoffSignatureSuppressesDifferentInputRedispatch()`, `testGeminiStreamingPendingAttachRedispatchDoesNotRestream()`, `testGrokStreamingPendingAttachRedispatchDoesNotRestream()`, `testFirefoxFileInputDuplicateEventsShareOneTransaction()` | Sanitized redispatches and duplicate browser events must not rescan, restream, duplicate attach, or reprocess the same sanitized file while still allowing distinct user files later. | Keep as source-extraction for now. Replacement needs runtime transaction tests that can observe repeated events without depending on content-script source strings. |
| Unsupported file behavior | `testUnsupportedDocumentAndImageFilesPassThroughByDefault()`, `testUnsupportedFileInputWarnsAndKeepsComposerUsable()`, `testUnsupportedBinaryIsBlockedBeforeGeminiPolicyPassThrough()`, `testFirefoxProtectedDropBlocksUnsupportedFiles()`, `testDropOverFiftyMiBBlocksBeforeStreaming()` | Unsupported, binary, invalid, and over-limit files must not be falsely represented as protected; protected Firefox/Gemini paths must fail closed where raw file exposure would otherwise occur. | Candidate for runtime harness replacement later. Keep current extraction coverage until browser QA covers unsupported and over-limit files across protected providers. |

## Source-Shape Guards To Keep For Now

These assertions intentionally inspect production source and should not be
weakened during Phase 8 cleanup:

- `testProductionGeminiDropPathDoesNotUseLegacyEditorDropHandler()` keeps
  production drop listeners routed through the active file handoff path rather
  than the removed legacy Gemini editor-drop helper.
- `testFirefoxGeminiFileInputBridgeDoesNotReplayOrOpenPicker()` keeps the
  Firefox Gemini bridge from replaying synthetic drag/drop events or opening a
  picker; it must inject sanitized files through the real upload input.
- `testGeminiUploadHandoffDoesNotRedispatchSyntheticDrop()` keeps Gemini upload
  handoff from re-emitting synthetic drop events.
- `testUrlChangeClearsPendingGeminiHandoff()` and
  `testExtensionInvalidationClearsPendingGeminiHandoff()` keep pending Gemini
  sanitized-file state from surviving navigation or extension invalidation.
- `testBackgroundSkipsDuplicateDetectorScanForStreamingChunks()` keeps the
  streaming redaction path from asking the background detector to rescan chunks.
- `testFileHandoffAdapterRegistryCoversSupportedSites()`,
  `testUnprovenAdaptersKeepPendingAttachFeatureGated()`, and
  `testChatGptPendingAttachRemainsDisabled()` keep provider routing and pending
  attach gates explicit.

## Future Replacement Candidates

Prefer this order when replacing source extraction with less brittle coverage:

1. Add focused adapter contract tests for host routing and pending attach gates.
2. Add focused unit tests around sanitized payload/debug metadata builders once
   those helpers are safely isolated.
3. Add table-driven Gemini/Grok pending attach lifecycle tests before sharing
   pending attach code.
4. Add browser harness cases for raw drop blocking, unsupported file handling,
   duplicate event suppression, and no synthetic Gemini drop replay.
5. Only then remove matching source-shape assertions, one group at a time, with
   the replacement test named in the PR.

## Non-Goals For PR 8A

- No runtime behavior changes.
- No test deletion.
- No weakening of raw blocking, raw-safe logging, pending attach, duplicate
  suppression, or fallback-order assertions.
- No detector/classifier rule changes.
- No background placeholder/session/reveal state changes.
- No Gemini/Firefox bridge behavior changes.
