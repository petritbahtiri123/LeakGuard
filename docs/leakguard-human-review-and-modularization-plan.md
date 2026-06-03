# LeakGuard Human Review And Modularization Plan

Date: 2026-06-01

This report is a behavior-preserving review plan. It does not recommend a large immediate refactor, deletion pass, or runtime behavior change. The safest path is to keep the current security and privacy invariants intact while moving reviewable pieces out of `src/content/content.js` in small, reversible PRs.

Evidence used:
- Context routing docs: `docs/CODEX_FAST_CONTEXT.md`, `docs/CODEX_CONTEXT_ROUTER.md`, `docs/REPO_MAP.md`, `docs/BUG_PLAYBOOK.md`
- Release and store docs: `docs/CHROME_WEB_STORE_LISTING.md`, `docs/FIREFOX_AMO_CHECKLIST.md`, `docs/STORE_ASSETS_CHECKLIST.md`, `docs/PRIVACY_POLICY.md`, `docs/RELEASE_QA_CHECKLIST.md`, `docs/RELEASE_PROVENANCE_CHECKLIST.md`
- Architecture docs: `docs/file-handoff-architecture.md`, `docs/THREAT_MODEL.md`, `docs/BROWSER_COMPATIBILITY_MATRIX.md`, `docs/deep-research-report.md`, `docs/code-quality-audit.md`
- Source hotspots: `src/content/content.js`, `src/content/*handoff*`, `src/content/composer_helpers.js`, `src/background/core.js`, `src/shared/*`, `manifests/*.json`, build/package scripts, and focused tests

## 1. Current Human-Review Checklist

| Item | Why a human should review it | Exact files or directories involved | Risk | Suggested reviewer action |
| --- | --- | --- | --- | --- |
| Browser store metadata and screenshots | Store copy and screenshots are public claims; automation cannot detect misleading visual context, private browser data, or unsupported-file overclaims. | `docs/CHROME_WEB_STORE_LISTING.md`, `docs/FIREFOX_AMO_CHECKLIST.md`, `docs/STORE_ASSETS_CHECKLIST.md`, screenshots kept outside `dist/` | High | Capture fresh release-build screenshots with synthetic data only. Verify no real tabs, profiles, domains, prompts, paths, emails, or credentials are visible. |
| Chrome Web Store compliance | Chrome reviewers will examine permission justifications, host access, local-only claims, file handling claims, and package contents. | `manifests/base.json`, `manifests/chrome.json`, `docs/CHROME_WEB_STORE_LISTING.md`, `scripts/package-extension.mjs`, `dist/chrome` after build | High | Re-check current Chrome policy immediately before submission. Confirm permissions and optional host permissions match the listing text. |
| Firefox Add-ons compliance | AMO has Firefox-specific manifest metadata and data collection declarations that can change. | `manifests/firefox.json`, `manifests/firefox-enterprise.json`, `docs/FIREFOX_AMO_CHECKLIST.md`, `dist/firefox` after build | High | Verify `browser_specific_settings.gecko`, `data_collection_permissions.required: ["none"]`, source package content, and reviewer notes against current AMO guidance. |
| Permission review | Permissions are security-sensitive public commitments. `storage`, `scripting`, `activeTab`, and `downloads` each need current justification. | `manifests/base.json`, `docs/CHROME_WEB_STORE_LISTING.md`, `tests/productization.test.js`, `tests/build_targets.test.js` | High | Confirm each permission is still needed and the description is accurate. Pay special attention to `downloads`, which supports sanitized file fallback/export. |
| `host_permissions` and `optional_host_permissions` review | Built-in host access is broad across supported AI sites, and optional `https://*/*` / `http://*/*` needs a clear user-driven story. | `manifests/base.json`, `src/shared/protected_sites.js`, `src/background/core.js`, `docs/PROTECTED_SITES_GUIDE.md`, `docs/CHROME_WEB_STORE_LISTING.md` | High | Confirm built-in site list exactly matches tested support: ChatGPT, OpenAI Chat, Gemini, Claude, Grok, and X. Confirm optional access is only requested for user-managed exact-origin protection. |
| Privacy policy and data collection declarations | These are legal/store-facing claims, and the docs still contain contact TODOs. | `docs/PRIVACY_POLICY.md`, `docs/STORE_ASSETS_CHECKLIST.md`, `docs/FIREFOX_AMO_CHECKLIST.md`, `README.md`, `docs/NON_GOALS.md` | High | Fill in support, privacy, and security contacts. Have a human/legal reviewer confirm local-only, no telemetry, no backend, session storage, file handling, and unsupported-format language. |
| Enterprise policy documentation | Enterprise wording can easily overclaim force install, removal prevention, SIEM integration, or full DLP. | `docs/ENTERPRISE_DEPLOYMENT.md`, `docs/MANAGED_POLICY_SCHEMA.md`, `config/managed_policy_schema.json`, `manifests/*-enterprise.json`, `src/shared/policy.js`, `src/background/core.js` | Medium | Keep "in-extension policy support" separate from browser-managed deployment controls. Confirm defaults and examples match shipped schema and tests. |
| Build artifacts and package contents | Generated packages can include sourcemaps, debug helpers, local reports, private transcripts, or stale release files. | `scripts/build-extension.mjs`, `scripts/package-extension.mjs`, `scripts/clean-release-artifacts.mjs`, `dist/`, `release/`, `artifacts/`, root `LeakGuard-firefox.zip` | High | For release candidates, rebuild from a recorded commit, inspect package file lists, confirm no sourcemaps/debug helpers, and keep future package archives outside source diffs. |
| Generated files that must not be committed | The repo currently ignores `dist/`, `node_modules/`, and `artifacts/`, but tracked legacy release archives exist. New generated output should not be added casually. | `.gitignore`, `dist/`, `artifacts/`, `release/`, `LeakGuard-firefox.zip`, `ai/models/`, `package-lock.json` | Medium | Do not add new generated artifacts unless the release process explicitly requires it. Treat existing tracked archives as release-history evidence, not a model for future routine diffs. |
| Manual UX review on ChatGPT, Gemini, Claude, Grok, and x.com | Site DOMs and upload flows change without notice, and the most critical code is site-specific. | `docs/qa/cross-site-manual-checklist.md`, `docs/RELEASE_QA_CHECKLIST.md`, `src/content/content.js`, `src/content/composer_helpers.js`, `src/content/overlay.css` | High | Run manual Chrome and Firefox checks for typing, paste, large paste, upload button, drag/drop, secure reveal, and final raw-secret sweep on all built-in sites where login/access is available. Add x.com to the manual matrix if it remains a built-in protected host. |
| Manual false positive / false negative review | Detector behavior is heuristic and user-facing; automated cases cannot cover all real prompt shapes. | `src/shared/detector.js`, `src/shared/patterns.js`, `tests/manual_detection_paste_block.txt`, `tests/detector.test.js`, `tests/break_pack.test.js` | High | Use synthetic but realistic prompts covering headers, URLs, natural-language secrets, safe docs placeholders, emails, public IPs, and private IP controls. Record surprising cases before changing rules. |
| Debug log raw-secret review | Developer diagnostics are useful but risky. Release builds strip content-script debug artifacts, but source/dev paths still need manual raw-free review. | `src/content/content.js`, `src/shared/ai/classifier.js`, `scripts/build-extension.mjs`, `tests/build_targets.test.js`, `tests/security.test.js` | High | In dev builds, enable `pwm:debug` with synthetic values and inspect Console output. Verify debug payloads contain lengths, placeholders, hashes, stages, and metadata only. Then confirm release build stripping still passes. |
| Local-only network review | Network regressions would violate LeakGuard's core model. AI assist should load only packaged model/runtime assets. | `src/shared/ai/classifier.js`, `manifests/base.json`, `docs/THREAT_MODEL.md`, `docs/AI_ASSIST.md`, browser DevTools Network | High | During manual QA, keep DevTools Network open and verify no LeakGuard backend, telemetry, cloud secret verification, or remote model request exists. Extension URL fetches for packaged assets are expected. |
| File handling and unsupported-format messaging | The release explicitly supports text files only; unsupported-file UX must not imply protection. | `src/shared/fileScanner.js`, `src/shared/streamingFileRedactor.js`, `src/content/file_paste_helpers.js`, `src/content/content.js`, `docs/FILE_UPLOAD_SCANNING_GUIDE.md`, `docs/file-handoff-architecture.md` | High | Manually test supported UTF-8 text, invalid UTF-8, over-limit files, PDF, DOCX, images, archives, executables, and binary files. Confirm raw upload blocks only in the promised fail-closed paths. |
| Release provenance and supply-chain review | Package trust depends on reproducibility from source and known dependency state. | `docs/RELEASE_PROVENANCE_CHECKLIST.md`, `package.json`, `package-lock.json`, `scripts/generate-license-report.mjs`, `scripts/generate-osv-report.mjs`, `scripts/repository-secret-scan.mjs` | Medium | Record commit, build command, Node/npm versions, package hashes, license/OSV results, secret scan result, and final QA owner/date. |

## 2. Current Code Complexity Map

Top-level metrics from the current tree:

| Area | Size signal |
| --- | --- |
| `src/content/content.js` | 11,480 lines, about 675 function/arrow sites, 17 observer references, 51 listener references, 191 debug references |
| `tests/content_file_drop_interception.test.js` | 11,127 lines; useful coverage, but hard to review as one file |
| `src/shared/detector.js` | 3,541 lines, about 137 function/class/method declarations |
| `src/background/core.js` | 1,409 lines, about 117 function/arrow sites |
| `src/content/composer_helpers.js` | 852 lines; already a useful extraction target |
| Existing file handoff modules | `file_handoff_state.js` 722 lines, `file_handoff_flow.js` 411, `file_handoff_pending.js` 190, `file_drag_guard.js` 355, `file_paste_helpers.js` 287 |

| File path | Function or area | Approximate size / complexity | Why it is risky | Likely bugs | Safe to modularize? | Suggested target module |
| --- | --- | --- | --- | --- | --- | --- |
| `src/content/content.js` | Overall content runtime | 11,480 lines combining bootstrap, policy, UI, input interception, site adapters, file handoff, rehydration, and diagnostics | One change can cross event timing, security boundaries, browser compatibility, and site-specific selectors. | Raw send after failed rewrite, duplicate events, missed composer, modal loops, leaked debug payloads, Firefox/Chrome drift. | Yes, but only incrementally. | `src/content/bootstrap.js`, `src/content/runtime/runtimeMessenger.js`, `src/content/input/*`, `src/content/ui/*` |
| `src/content/content.js` | `maybeHandleLocalFileInsert()` | 524 lines starting at line 9632 | Central fail-closed file ingress path. It handles transfer policy, event consumption, file read, streaming, redaction, adapter handoff, fallback, messaging, and cleanup. | Raw file pass-through after attempted sanitization, duplicate sanitized upload, huge text insertion, missing cleanup on cancel/error. | Yes, after tests are pinned. | `src/content/files/fileAttachPipeline.js` |
| `src/content/content.js` | Paste/beforeinput/drop/file-input flow | `maybeHandleBeforeInput()` 217 lines, `maybeHandlePaste()` 171, `maybeHandleDrop()` 74, `maybeHandleFileInputChange()` 120 | Browser event ordering differs by site and browser. File, text, and generated attachment paths overlap. | Raw paste lands before rewrite, selection/caret loss, double insertion, missed Firefox event shape. | Yes, staged. | `src/content/input/beforeInputInterceptor.js`, `pasteInterceptor.js`, `dropInterceptor.js` |
| `src/content/content.js` | Submit/send/typed rewrite flow | `maybeHandleSubmit()` 183 lines, `maybeHandleFallbackSendKey()` 219, `maybeHandleTypedSecrets()` 236 | This is the last protection boundary before send. It mixes policy, analysis, redaction, modal decisions, and rewrite verification. | Send proceeds with raw secret, Allow Once reopens, policy order bug, stale analysis after editor changed. | Partially; keep policy order stable. | `src/content/input/submitGuard.js`, `typedScanController.js` |
| `src/content/content.js` | Rewrite verification | `evaluateComposerVerificationCandidates()` 160, `verifyComposerRewriteSafe()` 68, `applyComposerText()` 111, `rewriteComposerTransactionally()` 70 | Correctness depends on multiple DOM text views and raw-secret absence. | False failure modal, accepting partial rewrite, line-collapse bugs, raw+placeholder duplicate. | Yes, as pure-ish verifier plus DOM writer wrapper. | `src/content/input/rewriteVerifier.js`, `editorWriter.js` |
| `src/content/content.js` and existing `src/content/file_handoff_*` | File handoff state and flow | Current split exists, but high-level orchestration remains in `content.js`; state module is 722 lines | State uses TTLs, WeakMaps, metadata signatures, pending transaction suppression, and browser-specific fallbacks. | Reprocessing sanitized files, expired suppression not pruned, pending attach memory state surviving navigation. | Yes, but preserve globals/load order. | `src/content/files/pendingAttachQueue.js`, `fileHandoffState.js`, `fileHandoffFlow.js` |
| `src/content/content.js` | Site adapter definitions and host matching | `FILE_HANDOFF_ADAPTERS` starts near line 4529; host helpers and adapter metadata are in the same file | Provider-specific selectors, unsafe-click rules, and pending gates are easy to drift. | Enabling pending attach for an unproven adapter, clicking unsafe controls, wrong site driver selected. | Yes, after interface contract tests. | `src/content/adapters/{chatgpt,gemini,claude,grok,x,openai}Adapter.js` |
| `src/content/content.js` | Gemini handlers | Gemini editor, file picker, ghost ingress, Firefox bridge, upload menu discovery, and pending attach span roughly lines 4995-7295 and 8360-9386 | Gemini has Quill/contenteditable behavior, hidden controls, Firefox-specific file availability issues, and trusted activation constraints. | Duplicated content, collapsed line breaks, raw file picker opening, missed hidden input, frozen editor. | Carefully; adapter-specific extraction is useful. | `src/content/adapters/geminiAdapter.js`, `src/content/files/geminiFileBridge.js` |
| `src/content/content.js` | Grok handlers | Upload button discovery, pending input discovery, pending handoff, and file upload handoff around lines 7295-8181 and 9396-9448 | Similar to Gemini but not identical; shared pending logic could hide provider differences. | Pending prompt drift, failed file input discovery, duplicate handoff, raw upload after fallback confusion. | Yes, after table-driven Gemini/Grok coverage. | `src/content/adapters/grokAdapter.js`, `src/content/files/pendingAttachQueue.js` |
| `src/content/content.js` | Response rehydration and reveal trigger | `rehydrateTree()` 31 lines, `startRehydrationObserver()` 42, placeholder span/reveal helpers around lines 11079-11308 | Mutation observer scans page DOM and wraps known placeholders while avoiding forms/editors/modal UI. | CPU churn on busy pages, hydrating editor text, unknown placeholder trust bug, raw reveal leaking to page if boundary regresses. | Yes, high benefit. | `src/content/rehydration/responseObserver.js`, `placeholderRehydrator.js`, `revealController.js` |
| `src/content/content.js` | In-page UI and modals | Badge/status panel/decision/message/large text/pending attach overlays spread across lines 1103-3266 | UI state is mixed with security decisions and async file paths. | Modal blocked by host page, stale button state, Allow Once modal loop, duplicate pending prompt events. | Yes, low-risk extraction if behavior-neutral. | `src/content/ui/{statusPanel,modalController,fileProcessingOverlay}.js` |
| `src/background/core.js` | Background message router and session state | 1,409 lines; `openPopupView()` 275, `getProtectedSiteOverview()` 180, `redactForTab()` 54 | Owns private placeholder state, reveal requests, protected-site permissions, audit metadata, and downloads. | Raw state in wrong storage, reveal to wrong sender/session, audit including raw URL/secret, dynamic script mismatch. | Yes, after content split starts. | `src/background/{messageRouter,sessionStore,protectedSites,policyStore,revealStore,auditStore}.js` |
| `src/shared/detector.js` | Deterministic detector | 3,541 lines; largest scans: structured assignments 159, sensitive headers 94, natural language 88, AI candidates 78 | Security-sensitive heuristics with many suppression exceptions and overlap rules. | False positives on docs/examples, false negatives for headers/URLs/prose, raw suffix leaks, trusted placeholder mistakes. | Only surgically. | `src/shared/detector/*` later, or leave until content risk is reduced |
| `src/shared/knownSecretReuse.js`, `src/shared/redactor.js`, `src/shared/transformOutboundPrompt.js` | Placeholder reuse and replacement | Shared helper now exists; redactor is 90 lines, transform 252, helper 208 | This path enforces repeated raw secret reuse and right-to-left/non-overlapping replacement behavior. | Raw prefixes/suffixes, different placeholders for same secret, overlap replacement corruption. | Do not refactor early. | Keep `knownSecretReuse.js`; add tests before any change |
| `src/shared/placeholders.js`, `src/shared/sessionMapStore.js` | Placeholder/session map handling | 575 lines + 63 lines | Background-owned raw mapping and public placeholder state are core privacy boundaries. | Raw mapping persistence, unknown placeholder trust, visible index instability. | Not first. | `src/shared/placeholders.js` should remain stable |
| `src/shared/fileScanner.js`, `src/shared/streamingFileRedactor.js` | Scanner/download and streaming redaction | 512 + 277 lines | File support claims and fail-closed size/encoding behavior depend on these. | Invalid UTF-8 bypass, chunk boundary leak, report includes raw data, over-limit behavior drift. | Yes for constants/helpers only. | `src/shared/fileLimits.js`, later `src/shared/files/*` |
| `src/shared/policy.js`, `src/shared/protected_sites.js` | Policy/config handling | 670 + 266 lines | Consumer/enterprise behavior, user-managed sites, and destination policy order. | Allow Once when disabled, strict fail-closed missed, site matching drift. | Only with focused tests. | `src/shared/policy/*` later |
| `scripts/build-extension.mjs`, `tests/build_targets.test.js` | Build/package validation | 414 + 430 lines | Release build strips debug helpers and sourcemaps, merges manifests, packages AI runtime assets. | Debug artifacts shipped, wrong Firefox background shape, wrong enterprise schema, stale source maps. | Yes for readability later. | Keep tests as guardrails before script cleanup |

## 3. Modularization Plan

The roadmap should be implemented as small PRs with no runtime behavior changes unless a PR explicitly says otherwise. Keep the current content-script global/IIFE loading model unless a separate build-system PR proves a module/bundler migration is safe for Chrome and Firefox MV3.

### Current status after PR 4F

As of PR 4F, PR 1 through PR 3 are substantially implemented. PR 4 is partially implemented through small behavior-preserving slices:
- PR 4A added the `src/content/files/fileAttachPipeline.js` shell.
- PR 4B pinned file attach behavior with focused regression coverage.
- PR 4C extracted `runSanitizedPayloadHandoffOrder()`.
- PR 4D extracted `classifyPostHandoffResult()`.
- PR 4E extracted `classifyFileAttachDisposition()`.
- PR 4F extracted `classifyPendingAttachFallbackDecision()`.

`maybeHandleLocalFileInsert()` still remains in `src/content/content.js` and still owns the dangerous side effects: event consumption, raw blocking, file reads, streaming redaction, fallback insertion, pending attach queueing, browser/file-input behavior, and UI, badge, overlay, and fail-closed side effects.

PR 5 response rehydration extraction has not started. PR 6 debug logger extraction has not started. PR 7 dead-code removal has not started and should remain blocked until production call-graph evidence, focused coverage, and manual browser QA are stronger.

Next safe step: do not start PR 5 yet. Continue PR 4 only if another small pure helper exists; otherwise pause PR 4 and run a manual browser QA / human review checkpoint before moving more side-effectful file attach code.

### PR 1: Extract constants, labels, and lightweight helpers only

Goal:
- Reduce repeated literals without moving control flow.
- Create stable homes for file limits/messages, adapter ids, debug event names, and safe metadata helpers.

Files touched:
- `src/content/content.js`
- `src/shared/fileScanner.js`
- `src/shared/streamingFileRedactor.js`
- `src/content/file_paste_helpers.js`
- Maybe `src/content/file_handoff_state.js`

New files/modules proposed:
- `src/shared/fileLimits.js`
- `src/content/files/fileMessages.js` only if content-only copy cannot live in shared code
- `src/content/adapters/adapterIds.js`
- `src/content/diagnostics/debugEvents.js`

What must not change:
- Placeholder tokens, ordering, and reuse
- Supported/unsupported file thresholds
- Fail-closed fallback order
- Current `FILE_HANDOFF_PENDING_ATTACH_ENABLED` behavior
- Chrome/Firefox manifest load order

Suggested tests to run:
- `node --check src/content/content.js`
- `node tests/file_paste_helpers.test.js`
- `node tests/file_scanner.test.js`
- `node tests/streaming_file_redactor.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/security.test.js`

Manual QA required:
- One supported text-file upload/drop on Chrome
- One unsupported file warning on Chrome
- One Firefox Gemini supported text-file drop if available

Rollback risk:
- Low. This should be literal movement only.

Expected benefit:
- Reduces threshold/message drift and makes later file pipeline extraction easier to review.

### PR 2: Extract pure utility functions with no browser DOM dependency

Goal:
- Move testable pure helpers out of `content.js` before touching DOM event code.

Files touched:
- `src/content/content.js`
- `src/content/composer_helpers.js`
- `src/content/file_handoff_state.js`
- tests that already extract source snippets

New files/modules proposed:
- `src/content/input/rewriteVerificationText.js`
- `src/content/files/fileTransferPolicy.js`
- `src/content/adapters/hostMatching.js`
- `src/content/diagnostics/safeSnapshots.js`

What must not change:
- Text normalization semantics
- Trusted placeholder handling
- File classification outcome
- Site driver selection for every built-in host
- Debug payload raw-free property

Suggested tests to run:
- `node tests/composer_helpers.test.js`
- `node tests/typed_interception.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/security.test.js`
- `node tests/productization.test.js`

Manual QA required:
- Paste and typed redaction on ChatGPT or another accessible protected site
- Confirm in-page status panel still selects the right protected site

Rollback risk:
- Low to medium. Pure extraction is safe, but source-extraction tests may need careful updates.

Expected benefit:
- Creates unit-testable seams for later DOM and adapter work.

### PR 3: Extract site adapters behind stable interfaces

Goal:
- Move adapter metadata, selectors, unsafe-click predicates, and provider-specific actions out of `content.js` while keeping the same adapter interface.

Files touched:
- `src/content/content.js`
- `tests/content_file_drop_interception.test.js`
- `tests/typed_interception.test.js`
- `manifests/base.json` only if load order changes

New files/modules proposed:
- `src/content/adapters/index.js`
- `src/content/adapters/chatgptAdapter.js`
- `src/content/adapters/openaiAdapter.js`
- `src/content/adapters/geminiAdapter.js`
- `src/content/adapters/claudeAdapter.js`
- `src/content/adapters/grokAdapter.js`
- `src/content/adapters/xAdapter.js`

What must not change:
- Built-in host list
- Provider ids and debug labels
- Pending attach remains enabled only for Gemini and Grok
- Unsafe controls remain blocked
- No raw drop replay or unsafe upload `click()` behavior

Suggested tests to run:
- `node tests/content_file_drop_interception.test.js`
- `node tests/typed_interception.test.js`
- `node tests/security.test.js`
- `node tests/build_targets.test.js`
- `node tests/productization.test.js`

Manual QA required:
- One smoke path per accessible built-in site: ChatGPT, Gemini, Claude, Grok, and x.com
- Firefox Gemini upload/drop path if available

Rollback risk:
- Medium. Adapter extraction touches site-specific behavior and manifest script ordering.

Expected benefit:
- Site changes become localized and reviewable. New provider support can be blocked behind adapter-level evidence.

### PR 4: Extract file attach pipeline

Goal:
- Move `maybeHandleLocalFileInsert()` orchestration into a dedicated file pipeline module after PR 1-3 reduce dependency sprawl.

Files touched:
- `src/content/content.js`
- `src/content/file_handoff_flow.js`
- `src/content/file_handoff_state.js`
- `src/content/file_handoff_pending.js`
- `src/content/file_paste_helpers.js`
- `src/shared/fileScanner.js`
- `src/shared/streamingFileRedactor.js`

New files/modules proposed:
- `src/content/files/fileAttachPipeline.js`
- `src/content/files/fileSanitizer.js`
- `src/content/files/pendingAttachQueue.js`
- `src/content/files/fileProcessingOverlayController.js`

What must not change:
- Raw ingress is consumed before page handlers for supported files
- Supported files never upload raw after LeakGuard attempts sanitization
- Streaming files are not read back into memory except explicit user fallback
- Gemini/Grok pending attach remains memory-only and trusted-action gated
- Duplicate sanitized handoff suppression TTL and matching behavior

Suggested tests to run:
- `node tests/file_paste_helpers.test.js`
- `node tests/streaming_file_redactor.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/security.test.js`
- `npm test` if the extraction touches shared redaction or policy paths

Manual QA required:
- Supported small text file paste/drop/select
- 5 MB and 25 MB streaming file where feasible
- Unsupported file warning
- Failed handoff path blocks raw upload
- Gemini/Grok pending attach where access is available

Rollback risk:
- High. This is the most security-sensitive extraction and should be kept as a dedicated PR.

Expected benefit:
- The highest-risk 524-line function becomes a traceable state machine with explicit stages.

### PR 5: Extract response rehydration pipeline

Goal:
- Move placeholder hydration, response observer, and reveal controller out of `content.js`.

Files touched:
- `src/content/content.js`
- `src/content/overlay.css`
- `src/popup/popup.js` only if reveal messaging names change, preferably not

New files/modules proposed:
- `src/content/rehydration/placeholderTokenizer.js`
- `src/content/rehydration/placeholderRehydrator.js`
- `src/content/rehydration/responseObserver.js`
- `src/content/rehydration/revealController.js`

What must not change:
- Raw reveal values never enter page DOM
- Unknown placeholders remain unavailable
- Editable composers, forms, modals, and already hydrated nodes are skipped
- Placeholder session count/trust gating remains conservative

Suggested tests to run:
- `node tests/security.test.js`
- `node tests/placeholder_trust.test.js`
- `node tests/typed_interception.test.js`
- `node tests/content_allow_once_interaction.test.js`

Manual QA required:
- Redact, submit or render placeholder text, click placeholder, reveal in popup, hide, and confirm raw value never appears in page DOM.

Rollback risk:
- Medium. Mutation observer behavior can cause subtle page performance and DOM bugs.

Expected benefit:
- Response hydration becomes auditable independently from input interception.

### PR 6: Extract debug and diagnostic logging helpers

Goal:
- Normalize safe debug events and make troubleshooting easier without increasing raw-data exposure.

Files touched:
- `src/content/content.js`
- `scripts/build-extension.mjs`
- `tests/build_targets.test.js`
- `tests/security.test.js`
- focused content tests that assert debug labels

New files/modules proposed:
- `src/content/diagnostics/debugLogger.js`
- `src/content/diagnostics/eventSnapshot.js`
- `src/content/diagnostics/filePipelineEvents.js`

What must not change:
- Release builds strip or disable high-risk debug helpers
- Debug snapshots remain redacted/metadata-only
- No raw prompt, raw secret, file content, or full URL logging

Suggested tests to run:
- `node tests/security.test.js`
- `node tests/build_targets.test.js`
- `node tests/typed_interception.test.js`
- `node tests/content_file_drop_interception.test.js`

Manual QA required:
- Enable `pwm:debug` in dev build with synthetic secrets and inspect logs.
- Build release target and verify no debug console paths remain.

Rollback risk:
- Low to medium. The release sanitizer depends on function names and banned strings, so update it deliberately.

Expected benefit:
- Easier incident debugging with consistent event names, adapter ids, stages, and session correlation.

### PR 7: Remove proven-dead code only after coverage and proof

Goal:
- Delete only code with documented production-call absence, replacement coverage, and manual QA proof.

Files touched:
- Candidate-specific only; likely `src/content/content.js` and matching tests/docs.

New files/modules proposed:
- None unless an internal removal note is useful.

What must not change:
- Gemini drag/drop behavior
- Firefox fallback behavior
- File handoff fail-closed sequencing
- Existing tests that encode security invariants

Suggested tests to run:
- Candidate-dependent focused tests
- Always include `node tests/content_file_drop_interception.test.js`, `node tests/typed_interception.test.js`, and `node tests/security.test.js` for content-script deletions
- Run `npm test` before merging any deletion PR

Manual QA required:
- Manual path for any removed site-specific fallback, especially Gemini file/drop.

Rollback risk:
- Medium to high. Production call absence is not enough in host-DOM fallback code.

Expected benefit:
- Reduces audit noise only after safety is proven.

## 4. Proposed Target Architecture

The example layout mostly fits the repo, but the current codebase already started a global/IIFE extraction pattern under `src/content/file_handoff_*` and `src/content/composer_helpers.js`. Continue that pattern first. Do not introduce a bundler or ES module graph as part of this cleanup unless a separate build-target PR proves Chrome and Firefox packaging, script ordering, CSP, and AMO behavior.

Suggested target:

```text
src/content/
  content.js                  # thin bootstrap/orchestrator after extraction
  bootstrap.js
  runtime/
    runtimeMessenger.js
    publicStateController.js
  adapters/
    index.js
    hostMatching.js
    chatgptAdapter.js
    openaiAdapter.js
    geminiAdapter.js
    claudeAdapter.js
    grokAdapter.js
    xAdapter.js
  input/
    beforeInputInterceptor.js
    pasteInterceptor.js
    dropInterceptor.js
    submitGuard.js
    typedScanController.js
    editorWriter.js
    rewriteVerifier.js
  files/
    fileAttachPipeline.js
    fileTransferPolicy.js
    fileSanitizer.js
    fileHandoffFlow.js
    fileHandoffState.js
    pendingAttachQueue.js
    fileProcessingOverlayController.js
  rehydration/
    placeholderTokenizer.js
    placeholderRehydrator.js
    responseObserver.js
    revealController.js
  ui/
    statusPanel.js
    badgeController.js
    modalController.js
    pendingAttachPrompt.js
  diagnostics/
    debugLogger.js
    eventSnapshot.js
    safeTextSummary.js

src/background/
  service_worker.js
  core.js                     # thin message-router bootstrap after extraction
  messageRouter.js
  sessionStore.js
  revealStore.js
  protectedSites.js
  policyStore.js
  auditStore.js
  downloads.js

src/shared/
  detector.js                 # keep stable until content modularization lands
  redactor.js
  transformOutboundPrompt.js
  knownSecretReuse.js
  placeholders.js
  entropy.js
  fileLimits.js
  fileScanner.js
  streamingFileRedactor.js
  policy.js
  protected_sites.js
  constants.js
```

Fit notes:
- `composer_helpers.js`, `file_paste_helpers.js`, `file_handoff_state.js`, `file_handoff_pending.js`, and `file_handoff_flow.js` are proof that behavior-neutral extraction is already viable.
- `content.js` should become the composition root, not disappear. It can wire global dependencies, bind events, and start observers.
- Background extraction should come after content extraction. `src/background/core.js` is smaller than `content.js`, but it owns raw placeholder state and reveal authorization, so the privacy blast radius is high.
- Shared detector modules should not be split early. The detector is large, but its overlap/suppression behavior is more fragile than its current file size suggests.

## 5. Performance Review

| File/function | Why it may hurt performance | How to measure it | Safe optimization idea | Before or after modularization |
| --- | --- | --- | --- | --- |
| `src/content/content.js` `startRehydrationObserver()` / `rehydrateTree()` | Observes `document.body` subtree and may walk added subtrees looking for placeholders on busy chat pages. | DevTools Performance on long chats; count observer callbacks and nodes scanned; add temporary metadata-only counters in dev. | Batch observer work with a microtask/idle queue; skip subtrees by cheap text/selector checks before `TreeWalker`; keep current form/editor skip list. | After PR 5, unless a measured regression appears first. |
| `scheduleInputScan()` / `maybeHandleTypedSecrets()` | Typed scanning can repeatedly run detector and optional AI assist on editor text. | Measure scan frequency, text length, detector time, and policy time with synthetic typing and long prompts. | Debounce by unchanged text hash/length; cap scan on huge composer text until paste/file path handles it; preserve submit-time guard. | After PR 2 or PR 3. |
| `maybeHandlePaste()` / `maybeHandleBeforeInput()` | Paste and beforeinput paths can both examine the same content and interact with file handling. | Log stage labels with event type, text length, dataTransfer file count, and consumed flag using safe snapshots. | Add an event transaction id and avoid duplicate analysis once the same event/payload was consumed. | After PR 2. |
| `maybeHandleLocalFileInsert()` | Reads, classifies, redacts, creates sanitized files, and tries multiple handoff/fallback strategies. | File sizes: small, 2-4 MiB, 5 MiB, 25 MiB, 50 MiB; record redaction time, handoff time, fallback path, and UI responsiveness. | Make explicit pipeline stages; avoid reading streamed sanitized files unless user explicitly chooses text fallback; keep progress updates bounded. | PR 4. |
| `src/shared/detector.js` scan methods | Large regex/entropy loops across many detectors can be expensive on large duplicate text. | Existing `npm run bench:redaction:profile`; add profiles for detector stage times on synthetic large files. | Keep duplicate-heavy caches and repeated-line fast paths; only add more caching with exact-output tests. | Before modularization only if benchmark shows a blocker; otherwise later. |
| `src/shared/knownSecretReuse.js` | Scans plain text for known raw values while avoiding placeholder tokens and occupied ranges. | Profile `known_secret_collect_ms` from `transformOutboundPrompt()` with duplicate-heavy and long no-match prompts. | Preserve sorted range checks; consider indexing known secrets by first character/length only if tests prove identical output. | Later; do not touch early. |
| Gemini upload discovery and shadow-root traversal | `collectRootsWithOpenShadow()`, upload menu scans, hidden selector discovery, and MutationObservers can run around user upload actions. | On Gemini, record number of roots/candidates scanned and wait durations for upload/drop flows. | Cache recent safe upload targets per navigation/session with TTL and invalidation on navigation. | After PR 3. |
| Grok pending input discovery | Similar pending attach search loops can re-run until timeout. | Record observer duration, candidates, and pending outcome for upload/drop. | Share pending queue shell while keeping Grok-specific predicates separate. | PR 4, after PR 3. |
| `src/background/core.js` storage reads/writes | `getProtectedSiteOverview()`, state updates, audit events, and dynamic script sync can hit extension storage repeatedly. | Instrument metadata-only timing in background for popup open, redaction, site add/remove. | Cache policy summary per URL for short windows; batch audit trimming; do not cache raw placeholder state outside session store. | Later, after content split. |
| Debug logging | `content.js` has many debug references in dev source. Console logging large snapshots can slow pages and risk raw leakage if wrong. | Dev-only profiling with `pwm:debug=1`; compare release package strings via build tests. | Central safe logger with per-event sampling and strict redacted snapshot schema. | PR 6. |
| Tests and harness size | `tests/content_file_drop_interception.test.js` is over 11k lines and source-extraction heavy, making refactor feedback slower and harder to localize. | Test runtime and failure localization during extraction PRs. | Split by pipeline area after behavior-preserving extraction: pending attach, file drop, Gemini bridge, generic adapters. | After PR 4, not before. |

## 6. Debuggability Review

Troubleshooting is currently hardest where one user action crosses multiple boundaries: site DOM event, content script interception, background redaction, placeholder state, file handoff, fallback UI, and host editor verification.

Recommended improvements:
- Add a central `debugLogger` facade with a strict safe payload schema: no raw prompt, raw secret, selected file content, full URL, or raw reveal value.
- Include `adapterId`, `browserFamily`, `eventType`, `pipelineStage`, `sessionHash`, `navigationHash`, `payloadKind`, `textLength`, `fileCount`, `sizeBucket`, `findingCount`, and `outcome` where applicable.
- Use consistent event namespaces:
  - `input:*`
  - `rewrite:*`
  - `file-policy:*`
  - `file-handoff:*`
  - `pending-attach:*`
  - `rehydration:*`
  - `reveal:*`
  - `policy:*`
- Give every file pipeline stage a label: `ingress-consumed`, `classified`, `read-started`, `redaction-started`, `sanitized-file-created`, `direct-handoff-attempted`, `pending-queued`, `text-fallback-attempted`, `download-fallback-attempted`, `blocked`.
- Add one dev-only command path to enable/disable debug per site, preferably documented in `docs/TROUBLESHOOTING.md`. Keep release stripping intact.
- Add safe redacted diagnostic snapshots that summarize composer state with placeholder counts, text length, line count, and hashes, not text.
- Keep `sessionHash` stable only within a browser session and non-reversible. It should correlate events without being a tracking identifier across sessions.

Do not add broad logging before PR 6. The next small safe step is to catalog existing debug labels and decide canonical names.

## 7. Dead-Code And Duplication Review

No code should be deleted from this pass. These are candidates for later proof, not removal instructions.

| Candidate | Why it looks duplicated or dead | Proof needed before removal or consolidation | Tests that would protect removal | Later cleanup PR? |
| --- | --- | --- | --- | --- |
| `src/content/content.js` `maybeHandleGeminiEditorDrop()` plus `listGeminiDropFiles()`, `isSupportedGeminiTextFile()`, `readGeminiTextFile()` | `rg` shows the main `drop` binding routes to `maybeHandleDrop()`, not `maybeHandleGeminiEditorDrop()`. Existing audit also flagged this as candidate stale Gemini path. | Production call graph, harness review, manual Chrome/Firefox Gemini drop smoke, and confirmation no test depends on it as an intended fallback. | `node tests/content_file_drop_interception.test.js`, browser Gemini drag/drop QA. | PR 7 only. |
| Gemini and Grok pending attach state machines | Clear/attempt/queue flows are parallel but provider-specific. | Table-driven tests proving identical lifecycle requirements and distinct provider discovery/click predicates. | `tests/content_file_drop_interception.test.js` split into pending-attach cases. | PR 4 or PR 7, after adapter extraction. |
| `FILE_HANDOFF_ADAPTERS` `supportsPendingAttach` vs `pendingAttachEnabled` | All adapters declare `supportsPendingAttach: true`, but only Gemini/Grok are enabled. This is intentional but easy to misread. | Test that non-Gemini/Grok pending attach remains disabled and generic queue refuses unsupported adapters clearly. | `node tests/content_file_drop_interception.test.js`, `node tests/security.test.js`. | PR 1 or PR 3 rename/clarify only. |
| Host matching helpers vs adapter host lists | `isChatGptHost()`, `isGeminiHost()`, adapter `hosts`, and current driver resolution can drift. | Host matrix tests for every built-in URL and exact expected adapter id. | `node tests/productization.test.js`, new host-matching unit tests, build target tests. | PR 2 or PR 3. |
| File size/message constants | Constants and fallback messages appear in shared scanner, streaming redactor, file paste helpers, and content fallbacks. Some are already exported, but emergency fallbacks still need review. | Confirm all current values are identical and determine which fallback literals are required when dependencies are missing. | `file_scanner`, `file_paste_helpers`, `streaming_file_redactor`, `content_file_drop_interception`. | PR 1. |
| Multiple pending prompt debug labels | `showPendingSanitizedAttachPrompt()` emits overlapping labels for prompt display paths. | Confirm no external workflow depends on old labels. Keep aliases temporarily if tests rely on them. | `typed_interception`, `content_file_drop_interception`, debug label assertions. | PR 6. |
| Silent `catch {}` blocks in `content.js` | Some are justified for hostile DOM probes, but others may hide cleanup or assignment failures. | Categorize each catch as selector-probe, event-dispatch, cleanup, assignment, or security-critical. | Focused content tests plus manual debug review. | PR 6, not deletion. |
| Source-extraction-heavy tests | Several tests assert source strings or extracted function bodies. They guard security invariants but are hard to maintain. | Only replace after behavior harness coverage proves the same invariants. | Existing tests plus new runtime harness tests. | After PR 4. |
| Tracked release packages | `git ls-files` shows root `LeakGuard-firefox.zip` and several `release/*.zip`/`.xpi` archives are tracked. They are not dead code, but they are future artifact-hygiene risk. | Release owner decides historical artifact policy. Do not delete without release/provenance decision. | Release provenance checklist, package rebuild/hashes. | Separate release-hygiene PR, not modularization. |

## 8. Final Recommendation

Top 5 human-review items before release:
1. Complete privacy/support/security contact TODOs and review privacy/store copy.
2. Re-check Chrome Web Store and Firefox AMO permission/data-collection declarations against current store rules.
3. Run live manual QA on ChatGPT, Gemini, Claude, Grok, and x.com in Chrome and Firefox where access is available.
4. Inspect release package contents for sourcemaps, debug helpers, private files, stale generated artifacts, and manifest drift.
5. Review debug logs with synthetic secrets and verify no raw values appear in console, DOM, extension storage, exports, or audit records.

Top 5 modularization PRs:
1. Extract constants/messages/ids only.
2. Extract pure utility functions with no DOM dependency.
3. Extract site adapters behind a stable interface.
4. Extract the file attach pipeline.
5. Extract response rehydration and reveal controller.

Top 5 performance risks:
1. Broad response rehydration observer on busy chat DOMs.
2. Repeated typed/paste scans on large composer text.
3. Large file redaction and handoff fallback sequencing.
4. Gemini/Grok upload discovery and pending attach observers.
5. Detector regex/entropy/known-secret reuse cost on huge or duplicate-heavy inputs.

Top 5 "do not touch yet" areas:
1. Placeholder format, reuse, ordering, trusted-placeholder pass-through, and right-to-left replacement behavior.
2. Gemini/Firefox hidden upload, ghost ingress, and file-input bridge behavior.
3. File handoff fail-closed fallback order.
4. Background raw placeholder/session/reveal state boundaries.
5. Detector overlap/suppression rules for headers, URL credentials, natural-language disclosures, and known-secret reuse.

Safest first PR:
- PR 1: extract constants, labels, and lightweight helpers only. It has the lowest behavioral risk, improves reviewability immediately, and creates a safer base for later adapter and file-pipeline work.
