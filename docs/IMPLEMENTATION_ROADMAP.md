# LeakGuard Implementation Roadmap

Updated: 2026-06-21

This roadmap turns the open items from [deep-research-report.md](deep-research-report.md), [DOCUMENTATION_ROADMAP.md](DOCUMENTATION_ROADMAP.md), and [code-quality-audit.md](code-quality-audit.md) into an implementation sequence.

Goal: make LeakGuard more reliable, auditable, and release-ready while preserving the local-only privacy model.

## Ground Rules

- Preserve local-only processing: no backend secret processing, telemetry, cloud scanning, remote model calls, or remote verification.
- Preserve placeholder stability, trusted-placeholder pass-through, same-secret reuse, and right-to-left redaction safety.
- Preserve Chrome/Firefox MV3 compatibility and the restrictive extension-page CSP.
- Do not broaden public claims faster than tests and manual QA support.
- Do not edit `dist/`, `node_modules/`, `ai/models/`, generated package archives, or lock files unless the task explicitly targets them.
- Add focused tests before changing high-risk behavior.

## Phase 0 - Baseline Gates

Purpose: make the current state repeatable before changing architecture.

Status: Done (2026-05-29).

Tasks:

- [x] Run and document `npm run docs:check-links`.
- [x] Run focused static/security checks before release-facing changes:
  - [x] `node tests/security.test.js`
  - [x] `node tests/build_targets.test.js`
  - [x] `node tests/productization.test.js`
- [x] Keep `npm test` as the final source-change gate.
- [x] Add CI execution for `npm run docs:check-links`.

Acceptance criteria:

- [x] Docs link check runs in CI.
- [x] Existing security/build artifact tests stay green.
- [x] No generated artifacts are changed by docs-only work.

Suggested PR: `ci: add documentation link check`

## Phase 1 - Browser Smoke CI

Purpose: prove the extension actually behaves in browsers, not only through static/unit tests.

Status: Complete for the current CI gate slice (Chrome, Firefox, and Edge smoke CI gates added by 2026-05-30).

Tasks:

- [x] Add a minimal smoke harness for Chrome stable.
- [x] Add Firefox stable smoke coverage after Chrome is stable.
- [x] Add Edge smoke coverage before making stronger Edge support claims.
- [x] Smoke the following flows in Chrome:
  - [x] install/load built target
  - [x] popup opens
  - [x] built-in protected site reports active protection
  - [x] user-managed exact-origin site can be added and disabled
  - [x] synthetic secret redacts to `[PWM_N]`
  - [x] secure reveal stays in popup
  - [x] supported text-file scanner flow
  - [x] one supported text-file composer flow where feasible
  - [x] one unsupported file warning
- [x] Repeat or adapt the smoke flow for Firefox.
  - Firefox uses an adapted WebDriver/XPI smoke covering temporary add-on load, built-in protected-site activation, and typed composer redaction.
  - Popup, secure reveal, and scanner browser breadth remain covered by Chrome/Edge until Firefox extension-page smoke is expanded.
- [x] Repeat or adapt the smoke flow for Edge.

Acceptance criteria:

- [x] CI runs at least Chrome smoke before high-risk refactors.
- [x] Firefox smoke is tracked separately if site login or browser constraints block full coverage.
- [x] Edge wording remains conservative until Edge smoke passes.

Suggested PRs:

- `test: add chrome extension smoke harness`
- `test: add firefox extension smoke harness`
- `test: add edge smoke coverage`

## Phase 2 - Supply Chain And Release Provenance

Purpose: make release confidence inspectable.

Status: In progress. Reporting-only CI artifacts and provenance checklist are present; actual per-release notes remain pending until a human release is cut.

Tasks:

- [x] Add OSV dependency scanning as reporting first.
- [x] Add a license report for direct and transitive npm dependencies.
- [x] Generate an SBOM in CI.
- [x] Add a repository secret scan job using synthetic-safe configuration.
- [x] Produce package checksums for generated release artifacts.
- [x] Add a release provenance checklist covering source commit, build command, package/artifact hash, SBOM artifact, dependency scan result, CI reports, QA signoff, and residual risks.
- [ ] Record source commit, build command, package/artifact hash, SBOM artifact, dependency scan result, QA signoff, and residual risks in release notes for each actual release.

Acceptance criteria:

- [x] `npm audit --omit=dev --audit-level=high` remains in CI.
- [x] OSV, SBOM, license, and secret-scan outputs are available in CI artifacts.
- [x] New package archives are published through tagged release artifacts or a release workflow, not routine source diffs.

Suggested PRs:

- `ci: add supply-chain reporting`
- `build: publish release checksums`
- `docs: add release provenance checklist`

## Phase 3 - Runtime Budgets

Purpose: keep the extension fast enough for document-start injection and large-file redaction.

Status: Done for warning-only Phase 3 budgets (runtime size reports, smoke timing logs, and conservative warning thresholds added 2026-05-30).

Tasks:

- [x] Record built target sizes.
- [x] Record ONNX Runtime asset sizes.
- [x] Track content-script init time in smoke tests where practical.
- [x] Keep `tests/performance/redaction-benchmark.mjs` as the redaction baseline.
- [x] Add thresholds for obvious regressions after initial baselines are collected.

Acceptance criteria:

- [x] CI reports bundle and runtime asset size.
- [x] Redaction benchmark output remains visible.
- [x] Regressions beyond agreed thresholds fail or warn before release.

Suggested PRs:

- `test: report extension bundle size budgets`
- `test: add content startup smoke metric`
- `test: enforce redaction performance budgets`

## Phase 4 - Safe Maintainability Refactors

Purpose: reduce review risk in the large security-critical files without changing behavior.

Order matters. Do not start with broad extraction.

### 4A - Add Missing Behavioral Tests

Status: Done (2026-05-29).

Tasks:

- [x] Add tests proving non-Gemini/Grok pending attach remains disabled.
- [x] Add pending prompt cancel/expiry cleanup tests.
- [x] Add exception cleanup tests around local file insert handling.
- [x] Add tests for duplicate suppression around sanitized file handoff.

Acceptance criteria:

- [x] `node tests/content_file_drop_interception.test.js` covers gate refusal, cancel cleanup, expiry cleanup, exception cleanup, and duplicate sanitized handoff suppression.
- [x] No production behavior changes in this subphase unless tests expose a bug.

### 4B - Centralize File Constants And Messages

Status: Done (2026-05-30).

Tasks:

- [x] Centralize duplicated file-size constants and user-facing unsupported/too-large messages.
- [x] Keep `FileScanner` and `StreamingFileRedactor` as the source of truth where practical.
- [x] Preserve emergency fallbacks only for dependency-missing paths.

Acceptance criteria:

- [x] No threshold drift across scanner, paste/drop helpers, streaming redactor, and content script.
- [x] Focused file tests pass:
  - [x] `node tests/file_scanner.test.js`
  - [x] `node tests/file_paste_helpers.test.js`
  - [x] `node tests/streaming_file_redactor.test.js`
  - [x] `node tests/content_file_drop_interception.test.js`

### 4C - Extract Shared Known-Secret Reuse

Tasks:

- [x] Consolidate duplicate known-secret reuse logic in `redactor.js` and `transformOutboundPrompt.js`.
- [x] Preserve current transform overlap semantics unless tests prove a safer correction.

Acceptance criteria:

- [x] Repeated raw secrets reuse the same placeholder.
- [x] No raw prefix/suffix remains beside placeholders.
- [x] Focused tests pass:
  - [x] `node tests/break_pack.test.js`
  - [x] `node tests/placeholder_trust.test.js`
  - [x] `node tests/typed_interception.test.js`

### 4D - Extract File Handoff Submodules

Status: Done (2026-05-31).

Tasks:

- [x] Split file-handoff state, pending attach lifecycle, and fallback sequencing out of `content.js` only after 4A-4C.
- [x] Keep provider-specific selectors and gates intact.
- [x] Preserve fail-closed order:
  1. direct sanitized file handoff
  2. tested pending attach
  3. sanitized text fallback
  4. sanitized download fallback
  5. block raw upload

Acceptance criteria:

- [x] `content.js` becomes smaller without weakening fail-closed behavior.
- [x] Browser smoke and focused file-flow tests pass.

Suggested PR sequence:

- `test: cover pending attach cleanup and gated refusal`
- `refactor: centralize local text file limits`
- `refactor: share known-secret reuse helper`
- `refactor: extract file handoff lifecycle`

## Phase 5 - Enterprise And Store Publication Readiness

Purpose: make public/admin claims safe to publish.

Status: Engineering checklist pass complete for current docs; human contacts, screenshots, legal/product review, and date-sensitive browser-policy rechecks remain pending before publication.

Tasks:

- [x] Add explicit TODO checklist items for missing privacy/support contacts when no correct project contact is locally discoverable.
- [ ] Replace privacy/support contact TODOs with real project contacts before publication.
- [ ] Recheck enterprise docs against current Chrome, Edge, and Firefox policy documentation before publication.
- [x] Update [STORE_ASSETS_CHECKLIST.md](STORE_ASSETS_CHECKLIST.md) to reflect current local-only behavior, unsupported-format limits, Edge wording constraints, enterprise boundaries, and contact TODOs.
- [ ] Complete [STORE_ASSETS_CHECKLIST.md](STORE_ASSETS_CHECKLIST.md) with final screenshots, contacts, release QA, package version, and claim review.
- [x] Update [FIREFOX_AMO_CHECKLIST.md](FIREFOX_AMO_CHECKLIST.md) to reflect current unsupported-file behavior, local-only data declaration, AMO reviewer notes, and contact TODO dependency.
- [ ] Complete [FIREFOX_AMO_CHECKLIST.md](FIREFOX_AMO_CHECKLIST.md) for an actual Firefox package submission.
- [ ] Capture fresh screenshots with synthetic data only.
- [x] Perform an engineering unsafe-claim review across README, privacy policy, Chrome listing, Firefox notes, enterprise docs, and release QA.
- [ ] Record human legal/product review before publication.

Acceptance criteria:

- [x] No reviewed public document claims full DLP, perfect protection, compliance certification, unsupported file support, or remote verification.
- [ ] Store docs and screenshots match actual release behavior for the target release.
- [ ] Human legal/product review is recorded before publication.

Suggested PRs:

- `docs: prepare store submission copy`
- `docs: refresh enterprise deployment examples`

## Phase 6 - Formal Threat Model And Architecture Diagrams

Purpose: turn scattered security notes into a maintained engineering reference.

Status: Done for the current implementation reference (2026-05-31).

Tasks:

- [x] Create a formal threat model covering:
  - assets
  - trust boundaries
  - hostile page assumptions
  - extension UI trust
  - session storage and ephemeral fallback
  - file handoff trust boundaries
  - AI assist boundaries
  - enterprise audit metadata boundaries
- [x] Add architecture diagrams for:
  - prompt redaction
  - placeholder/session state
  - secure reveal
  - file handoff
  - AI candidate gate

Acceptance criteria:

- [x] Threat model links to `SECURITY_REVIEW.md`, `NON_GOALS.md`, and this roadmap.
- [x] Diagrams describe actual current behavior, not aspirational behavior.
- [x] Security tests map to key threat-model invariants.

Suggested PR:

- `docs: add formal threat model`

## Phase 7 - Product Expansion Only After Foundations

Do not start these until Phases 1-6 are stable:

- stronger Edge support claims
- PDF/DOCX extraction research
- OCR or image redaction research
- broader site coverage
- more aggressive natural-language detection
- enterprise integrations beyond managed browser policy

Acceptance criteria:

- Each expansion has a clear non-goal boundary.
- Each expansion starts with tests and public wording review.
- No expansion introduces backend processing, telemetry, cloud scanning, remote model calls, or remote secret verification.

### 7A - Privacy-Preserving Feedback Loop MVP

Status: Scoped for a future GitHub/manual feedback MVP. This roadmap update is docs-only; implementation still requires a later code phase.

Purpose: collect user-initiated feedback without weakening LeakGuard's local-only privacy model.

Implementation target:

- Build the first implementation around a metadata-only GitHub issue/discussion link or a copy-safe-report flow.
- Keep all feedback user-initiated, with review-before-leave-browser as a hard requirement.
- Generate a metadata-only feedback template locally.
- Let the user review, edit, copy, or manually open the target before anything leaves the browser.
- Do not send feedback automatically, in the background, or through a GitHub API call.
- Use the `allowFeedback` managed policy gate before any visible feedback entry point ships, so enterprise and managed deployments can disable or hide feedback UI.

Possible feedback modes:

- GitHub issue or discussion link with user-controlled report text.
- Copy-safe-report button that copies only reviewed metadata.
- `mailto:` feedback link with a metadata-only template.
- Optional later hosted feedback form, only if it remains metadata-only and is separately approved.

Allowed metadata:

- LeakGuard version.
- Browser name and version.
- Extension build/channel.
- Provider or site category.
- Feature area.
- Safe reason codes.
- File count only.
- Blocked count only.
- Adapter name.
- User-written description, with a clear warning not to paste secrets or sensitive content.

Forbidden metadata:

- Prompts or messages.
- File contents.
- Filenames.
- OCR text.
- Secrets or suspected secrets.
- Raw URLs with query strings.
- Raw DOM text.
- Screenshots by default.
- Automatic logs or raw diagnostics.

Explicit non-goals for the MVP:

- No runtime behavior in this docs phase.
- No manifest or permission changes in this docs phase.
- No network calls, telemetry, GitHub API calls, or background sending.
- No backend integration.
- No automatic diagnostics collection.

Security notes:

- No background auto-send.
- No silent telemetry.
- No remote diagnostics by default.
- No host permission expansion for the feedback MVP.
- Before any feedback entry point ships, enterprise and managed deployments must be able to disable or hide feedback UI through managed policy.
- Any future backend must have a privacy policy, rate limiting, abuse protection, and server-side redaction or rejection for unsafe payloads.

Open questions:

- Use GitHub issues, GitHub discussions, or an email alias for the MVP entry point?
- Replace the `TODO-OWNER/TODO-REPO` GitHub feedback URL placeholder with an approved public or private target before surfacing links in UI.
- Should feedback be public or private by default?
- Should feedback live in the popup, options page, or both?
- Should enterprise builds disable feedback entirely by default?
- Should future feedback UI stay hidden by default until `allowFeedback: true`, or should consumer builds enable the gate in a separate reviewed phase?
- Should safe diagnostics be opt-in for each report?

## Validation Matrix

| Change type | Minimum validation |
| --- | --- |
| Docs-only | `npm run docs:check-links` |
| Privacy/store/enterprise docs | docs link check plus cross-review with `README.md`, `PRIVACY_POLICY.md`, `NON_GOALS.md`, and store docs |
| Manifest/build changes | `node tests/build_targets.test.js`, `node tests/security.test.js` |
| Policy changes | `node tests/enterprise_policy.test.js`, `node tests/protected_sites.test.js` |
| Detector/redactor changes | `node tests/detector.test.js`, `node tests/break_pack.test.js`, `node tests/placeholder_trust.test.js` |
| File handoff changes | `node tests/file_scanner.test.js`, `node tests/file_paste_helpers.test.js`, `node tests/streaming_file_redactor.test.js`, `node tests/content_file_drop_interception.test.js` |
| Content-script refactors | focused content tests, browser smoke, then `npm test` |
| Release candidate | `npm test`, `npm run build`, release QA checklist, store assets checklist |

## Done Definition

A roadmap phase is done only when:

- tests or docs checks are automated where practical
- public claims are conservative and current
- generated artifacts are not accidentally committed
- release notes identify residual risk
- the next phase can start without relying on tribal knowledge
