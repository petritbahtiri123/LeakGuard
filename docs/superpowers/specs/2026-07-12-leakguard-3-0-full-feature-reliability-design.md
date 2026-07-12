# LeakGuard 3.0 Full-Feature Reliability Design

## Status

This document defines the approved reliability program for the complete documented LeakGuard feature surface. It is a design and release-evidence contract, not a declaration that LeakGuard 3.0 is ready. The package and manifest versions remain unchanged until every required cell passes or the owner explicitly approves a waiver.

The current implementation baseline is commit `bee803b`. The work begins on branch `codex/leakguard-3.0-reliability` from a clean worktree.

## Goal

Prove that every documented supported LeakGuard feature completes safely and correctly across its applicable browser, build-mode, provider, and ingress boundaries. Fix validated product defects and the smallest reliability-gate defects needed to make that evidence repeatable.

Fail-closed behavior remains the final safety boundary, but it is not sufficient evidence for a supported flow. A supported flow passes only when LeakGuard detects, sanitizes, verifies, completes the original action exactly once, and prevents unintended raw delivery.

## Approved decisions

- Scope is the full release matrix, not only the previously known WhatsApp OCR, panel-state, and file-handoff defects.
- Product defects and minimal test/release-gate defects are both in scope.
- An inaccessible authenticated provider cell is not automatically a code defect, but it remains a 3.0 release blocker until tested or explicitly waived by the owner.
- Work is evidence-first and divided into independent, rollback-friendly workstreams.
- Edge remains a limited Chromium smoke boundary; strong Edge provider-parity claims are out of scope unless separately approved.
- No release version change or public release declaration occurs during reliability implementation.

In this document, `owner` means the repository/release owner directing this work. A tester, provider limitation, automated result, or implementation agent cannot create a waiver implicitly.

## Scope model

The authoritative matrix covers every applicable combination of:

1. feature family;
2. user surface and ingress method;
3. built-in or managed provider;
4. Chrome, Firefox, or Edge-smoke boundary;
5. consumer or enterprise build;
6. automated, packaged-browser, or authenticated evidence.

Each matrix cell has exactly one state:

- `PASS`: the promised behavior completed and all safety assertions passed;
- `FAIL`: a LeakGuard assertion failed after the extension loaded;
- `PENDING`: the cell has not been executed or usable evidence was not obtained;
- `NOT APPLICABLE`: current authoritative product scope excludes the combination, with a cited reason;
- `WAIVED`: the owner explicitly accepted the named gap for this release.

Only `PASS`, justified `NOT APPLICABLE`, and owner-approved `WAIVED` cells can satisfy the final matrix. `PENDING` and `FAIL` are release NO-GO.

The matrix is not a blind Cartesian product. A combination is `NOT APPLICABLE` only when an authoritative support boundary excludes it, such as WhatsApp document/file paste, Edge-specific packages, scanned-PDF OCR, or non-English OCR. Site fragility, missing authentication, missing automation, and unavailable test profiles are not `NOT APPLICABLE`.

## Feature families

| Family | Required capability boundary |
| --- | --- |
| Site scope and routing | Built-in protection, exact-origin user-managed sites, enterprise-managed sites, permission grant/revoke/regrant, registration synchronization, reload, enable, disable, and removal. |
| Composer interception | Typing, multiline text, `beforeinput`, text paste, large paste, Enter, send-button click, and form submit without duplicate handling. |
| Decisions and policy | `Redact`, explicit text `Allow once`, `Cancel`, consumer defaults, enterprise destination actions, user-control restrictions, and strict policy failure behavior. |
| Deterministic detection | Credentials, tokens, passwords, headers, URL userinfo, cookies, webhooks, connection strings, structured assignments, prose disclosures, global email redaction, false-positive suppression, and known-secret reuse. |
| Network and enterprise metadata | Public host/CIDR pseudonymization, private network metadata, cloud/provider identifiers, directory identities, internal hosts, paths, and file-share metadata. |
| Local AI assist | Candidate gating, local ONNX inference, deterministic authority, policy disablement, model lifecycle, and no full-prompt or remote inference. |
| Placeholder lifecycle | Stable family allocation, reuse, trusted pass-through, tab/session state, route changes, response hydration, panel counts, popup-only reveal, and truthful reset behavior. |
| Popup, options, and in-page UI | Protection status, site management, pause/resume, scanner launch, reveal, OCR setting, decision modal, progress UI, safe feedback preparation, responsive rendering, and raw-free copy. |
| Extension File Scanner | Supported selection, preview, findings, redacted text, sanitized JSON, size limits, unsupported handling, and raw-free exports. |
| Generated documents | Text PDF, DOCX, and XLSX extraction; sanitized `.redacted.txt`; complete regenerated `.redacted.pdf`, `.redacted.docx`, or `.redacted.xlsx`; truncation fallback; open/search verification; and no original-part copying. |
| Images and OCR | Image metadata, scanner OCR, protected-site OCR setting, English PNG/JPG/JPEG/WEBP coverage, eligible flattened `.redacted.png`, unsafe-box handling, timeout/error diagnostics, and no raw image fallback. |
| Protected file ingress | Attach/select, drop, supported paste, sanitized `File`/`Blob` replacement, streaming, multi-file caps/order, duplicate names, identical metadata, failure isolation, pending handoff, and exactly one upload. |
| WhatsApp specialization | Text typing/paste/send, clipboard image paste, supported attach/drop batches, all-or-nothing batch failure, no document/file paste, no extracted-text fallback, and adapter-specific verification. |
| Diagnostics and audit | Metadata-only debug, reports, errors, audit retention/summaries, policy events, and no raw content, unsafe paths, credential URLs, or secret-bearing stacks. |
| Browser, build, and privacy boundary | Chrome/Firefox consumer and enterprise packages, Edge Chrome-target smoke, MV3/runtime order, restrictive CSP, packaged OCR/model assets, local-only processing, and no telemetry/backend/remote model. |

## Provider and browser boundaries

Authenticated provider coverage includes:

- ChatGPT (`chatgpt.com`);
- legacy OpenAI Chat (`chat.openai.com`) as its own routing/support cell;
- Claude;
- Gemini;
- Grok;
- X;
- WhatsApp Web;
- one user-managed exact-origin site.

Chrome and Firefox require authenticated provider coverage using both consumer and enterprise packages for applicable cells. Enterprise validation includes the packaged enterprise defaults and one strict managed-policy profile exercising destination enforcement, managed sites, restricted controls, strict-load failure, and metadata-only audit behavior.

Edge uses the Chrome consumer target and receives limited packaged smoke coverage. Edge authenticated-provider parity is not a release requirement under this design and must not be presented as full first-class support.

Safari and Firefox Android are not current documented first-class release targets. Their cells are `NOT APPLICABLE` with this scope citation, and no compatibility claim may be inferred from desktop Chrome/Firefox evidence.

## Workstream decomposition

### 1. Matrix and gate foundation

Create the authoritative matrix, normalize evidence fields, identify authoritative support claims, reconcile contradictory release documents, and repair only confirmed gate omissions or duplication. This workstream does not change product runtime behavior.

### 2. Shared detection, transformation, placeholder, session, and policy behavior

Validate deterministic lifecycle order, Onix boundaries, network/metadata transforms, placeholder allocation/reuse/trust, session ownership, route/navigation behavior, reveal mappings, consumer decisions, enterprise policy, and metadata-only audit.

### 3. Extension-owned UI and site lifecycle

Validate popup, options, panel, decision modal, progress UI, scanner launch, reveal, feedback preparation, responsive rendering, custom-site permissions, dynamic registration, refresh, and restart behavior.

### 4. Scanner, extraction, generated output, and scanner OCR

Validate every supported scanner family, unsupported input, size boundary, sanitized export, regenerated document, formula non-execution, image metadata, English OCR, flattened visual output, and open/search raw-value sweep.

### 5. Protected text composer flows

Validate typing, multiline input, paste, large paste, decisions, rewrite verification, Enter, click, form submit, remounts, navigation, placeholder count, and exactly-one-send behavior across shared and provider-specific adapters.

### 6. Protected file and image ingress

Validate attach/select, drop, supported paste, document regeneration, streaming, multi-file order/caps, duplicate filename normalization, identical metadata, pending handoff, protected-site OCR, sanitized output verification, and exactly-one-upload behavior.

### 7. Provider verticals

Run the complete applicable matrix for every built-in provider and the managed generic site. Shared tests prove shared algorithms; provider verticals prove current adapter effectiveness and cannot be replaced by shared fixtures.

### 8. Browser and build parity

Validate Chrome and Firefox consumer/enterprise runtime behavior, Edge limited smoke, release packages, manifests, script order, CSP, permissions, packaged assets, refresh/restart behavior, and managed-policy enforcement.

### 9. Authenticated release evidence and final decision

Complete the human/provider matrix, generated-file inspection, raw-value sweeps, documentation reconciliation, provenance, clean-worktree verification, and strict GO/NO-GO report.

Each workstream produces focused evidence and separate reviewable commits. A workstream may be split further when its owner files or test cycle form independently rejectable changes.

## Reliability contract for supported actions

Every supported action follows this sequence:

1. LeakGuard owns the user event before the host can receive unintended raw content.
2. It resolves the applicable site capability, entry path, build policy, and user decision.
3. Detection and sanitization occur locally in the existing authoritative order.
4. It verifies final composer text or sanitized file identity, content, order, placeholder mappings, and destination state.
5. It completes exactly one send, upload, or handoff from the original action.
6. It refreshes actual background-owned placeholder, panel, and reveal state.
7. It emits metadata-only diagnostics and evidence.

Explicit text `Allow once` is a separate user-authorized one-send feature. It is never an automatic fallback. No file/image path gains raw fallback from this design.

## Failure and recovery behavior

- Recoverable readiness races may retry only within a fixed bounded budget.
- Readiness recovery must not replay file/image bytes, a send, an upload, or a host event.
- Final rewrite, identity, ordering, content, or destination verification failure blocks the action.
- Once LeakGuard owns an unsafe event, exceptions cannot fall through to raw browser handling.
- File-only and image-only paths cannot degrade into composer-text fallback.
- Unsupported pre-ownership pass-through is allowed only where the authoritative capability boundary explicitly permits it and a test proves LeakGuard did not claim or begin sanitization.
- Provider DOM drift requires current evidence and adapter-specific diagnosis; broad selector guessing is forbidden.
- Service-worker or session restart must produce truthful cleared/recovered UI and state rather than stale counts or phantom mappings.
- Authentication or provider availability failures are recorded as `PENDING`, not product failures, but remain release NO-GO.
- Logs, reports, audit data, exceptions, filenames, screenshots, and evidence must not contain raw synthetic secrets or private account data.

## Evidence record

Every executed matrix cell records:

- commit SHA and clean/dirty state;
- built target and package identity;
- browser name and version;
- consumer or enterprise mode and managed-policy profile where applicable;
- provider, route, and authentication precondition;
- feature family and ingress method;
- synthetic fixture identifier and expected sanitized result;
- observed sanitized result;
- raw-value absence assertion;
- send/upload/input/change event counts;
- placeholder, panel, hydration, and reveal state where applicable;
- LeakGuard warning/error diagnostics;
- generated-file open/search result where applicable;
- final status, tester, date, and evidence location.

Evidence uses synthetic values only. Controlled input fixtures necessarily contain raw fake values; generated test output, logs, reports, screenshots, and evidence records must not. Screenshots are optional and must be skipped when they could capture account, contact, chat, bot-check, or private provider data.

## Validation tiers

### Tier 0: focused change validation

Run syntax checks, owned unit/regression tests, `npm run test:changed`, documentation checks where applicable, and `git diff --check`. Tests are written before behavior changes and must reproduce the failure for the correct reason.

### Tier 1: shared regression and deterministic E2E

Run `npm test` plus the account-free Chromium Playwright suite. The Playwright suite is a separately visible required CI gate so its approximately 17-minute runtime and failures are attributable without inflating every local unit-test run.

Confirmed product tests omitted from `scripts/run-tests.mjs` are added to the normal suite only after verifying they are stable and non-duplicative. The current candidates are `chatgpt_composer_sync.test.js`, `debug_logger.test.js`, and `browser_qa_matrix.test.js`.

### Tier 2: nightly browser and release gates

Run Tier 1, release artifact gates, one browser preflight, one Chrome full browser matrix, and each Chrome/Edge/Firefox smoke exactly once. Remove duplicated builds/harness executions without dropping assertions. Nightly evidence must invoke the actual nightly aggregate rather than a differently scoped workflow command.

### Tier 3: browser and enterprise parity

Add missing packaged Firefox coverage for rebuilt file input/drop, protected-site OCR, document/scanner exports, restart/refresh, and permission lifecycle. Add packaged enterprise runtime coverage for managed policy, controls, managed sites, audit, and strict-load failure. Do not claim parity from static build inspection alone.

### Tier 4: release candidate

From a clean commit, build and package all four Chrome/Firefox consumer/enterprise targets, generate checksums, validate artifacts, run size/performance and privacy/security checks, perform raw-marker and remote-code sweeps, and record provenance. Model/dataset evaluation is required when AI model, features, dataset, or candidate-gate behavior changes.

### Tier 5: authenticated human gate

Run every applicable provider cell in Chrome and Firefox consumer and enterprise packages using synthetic fixtures. No authenticated cell may remain `PENDING` unless the owner explicitly records a waiver. A provider login/profile limitation is not a waiver by itself.

## Authenticated provider assertions

All applicable providers verify:

- protected status and in-page panel;
- typing, multiline text, paste, Enter, and send-button behavior;
- `Redact`, explicit text `Allow once`, and `Cancel`;
- exact final sanitized content;
- placeholder count, reuse, hydration, navigation, and reveal;
- exactly one send;
- no unintended raw value;
- no LeakGuard console warning/error.

Providers with applicable file capability also verify:

- attach/select, drop, and supported paste;
- supported text, PDF, DOCX, XLSX, and image/OCR families;
- streaming sizes and hard maximums;
- multi-file order and batch caps;
- different files with identical metadata;
- duplicate filenames with distinct content;
- unsupported, malformed, encrypted, invalid, oversized, and failure-injected inputs;
- exactly one upload/handoff event sequence;
- generated-file open/search raw-value absence.

Provider-specific assertions include:

- ChatGPT temporary chat and large-paste attachment behavior;
- Gemini and Grok pending-attach navigation, readiness, cancellation, and expiry;
- WhatsApp's specialized text, clipboard image paste, attach, drop, batch, and deliberately unsupported file-paste boundaries;
- X, Claude, and legacy OpenAI current authenticated adapter effectiveness;
- managed-site permission grant, reload, revoke/regrant, dynamic registration, and working-panel correspondence.

## Historical comparison strategy

History comparison is diagnostic evidence, not a source of blind reverts.

- `f7af5b5`: pre-modularization baseline;
- `903fe60`: modularization completion marker;
- `3dedaa0`: confirmed release file-input initialization/ownership correction;
- `24460d2`: post-integration baseline with adapter-aligned WhatsApp limits;
- `bee803b`: current full-feature reliability baseline.

Compare these points only when source/package behavior or a failing test indicates a regression. Preserve the modular structure and fix behavior at the current owner.

Known evidence already shows that the WhatsApp broker timeout, route-sensitive placeholder reset, metadata cache authorization, same-tab mutation race, generic handoff verification gap, and missing-button Enter replay predated modularization. Release file-input initialization/ownership is the confirmed modularization/integration regression and remains the primary comparison point when source-mode tests pass but packaged file input fails.

## Gate-repair constraints

Gate work exists to make evidence reproducible, not to redesign CI.

- No new test framework or dependency is introduced.
- Existing scripts, Playwright configuration, browser harnesses, and workflow jobs are reused.
- A gate runs each expensive build/harness once per aggregate unless isolation requires a separate job.
- Command names and release documentation must describe their actual scope.
- Deterministic Playwright remains account-free and synthetic.
- Authenticated automation is not introduced by storing credentials or bypassing provider authentication.
- Gate-only changes must not alter extension runtime, manifests, permissions, CSP, policy, telemetry, network, redaction, or model behavior.

## Security and change constraints

- No raw fallback for text, files, or images after LeakGuard owns or begins sanitizing the event.
- No text fallback for image-only or file-only supported actions.
- No duplicate sends, uploads, dialogs, file pickers, or input/change sequences.
- No infinite retries or speculative selector expansion.
- No manifest, permission, host-permission, CSP, telemetry, analytics, remote verification, remote model, detector-threshold, OCR-model, policy-semantics, or public-privacy change unless a separately reviewed finding proves it unavoidable and the owner explicitly approves it.
- No new dependencies, broad refactors, generated-artifact edits, or package-lock changes without explicit approval.
- Raw secrets never appear in storage, DOM outside intended explicit `Allow once` delivery, logs, reports, audit records, debug data, filenames, exceptions, screenshots, or generated test/evidence artifacts outside controlled synthetic input fixtures.
- Chrome and Firefox MV3 runtime order remains aligned, with `content.js` and `core.js` final in their respective lists.

## Immediate NO-GO conditions

Any of the following stops release progression:

- unintended raw synthetic secret delivery or persistence;
- raw file/image upload after LeakGuard ownership or sanitization begins;
- duplicate send, upload, dialog, picker, or host event;
- a supported feature that only blocks without a proven unsafe/external cause;
- false claims that an unsupported or unverified path is scanned, sanitized, or protected;
- weaker rewrite, file identity, placeholder trust, policy, CSP, local-only, or fail-closed behavior;
- missing authenticated evidence without an explicit owner waiver;
- failed required unit, deterministic E2E, packaged-browser, artifact, privacy, performance, or provenance gate.

## Definition of done

The full-feature reliability program is complete only when:

1. every applicable matrix cell is `PASS`, justified `NOT APPLICABLE`, or explicitly `WAIVED`;
2. no authenticated cell remains `PENDING`;
3. supported actions complete safely from one user action;
4. unsupported and unsafe actions fail closed truthfully;
5. no unintended raw value escapes and no duplicate action occurs;
6. focused, full unit, deterministic E2E, packaged browser, enterprise, artifact, privacy, performance, and authenticated gates pass;
7. Chrome and Firefox consumer/enterprise evidence is current, with Edge claims limited to smoke evidence;
8. generated documents and images open successfully and contain no visible or searchable raw synthetic secret;
9. panel, placeholder, hydration, reveal, session, restart, and audit state is truthful;
10. public and internal support documentation matches the observed matrix;
11. every runtime/gate fix is independently reviewed and rollback-friendly;
12. final provenance identifies the tested commit and packages;
13. the worktree is clean; and
14. the final report records exact tests, live evidence, risks, waivers, rollback commands, remaining blockers, and a strict GO/NO-GO decision.

## Deliverables

- authoritative full-feature matrix and evidence records;
- minimal reliability-gate corrections;
- focused regression tests and small runtime fixes for validated defects;
- Chrome/Firefox consumer and enterprise packaged evidence;
- Edge limited smoke evidence;
- authenticated provider results for all built-ins and one managed site;
- generated-file inspection evidence;
- reconciled release/support documentation;
- final 3.0 reliability report with provenance, risks, rollback, blockers, and GO/NO-GO.

## Rollback

Each product or gate defect is fixed in its own commit or tightly related commit group. Rollback uses `git revert <commit>` rather than destructive history changes. A rollback restores the prior defect and must never be combined with raw replay, weaker verification, broader selectors, or weaker fail-closed behavior.

The design/specification commit is independently revertible and changes no runtime behavior.
