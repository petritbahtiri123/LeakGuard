# LeakGuard Implementation Roadmap

Updated: 2026-05-29

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

Status: In progress (Chrome smoke CI gate added 2026-05-29).

Tasks:

- [x] Add a minimal smoke harness for Chrome stable.
- [ ] Add Firefox stable smoke coverage after Chrome is stable.
- [ ] Add Edge smoke coverage before making stronger Edge support claims.
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
- [ ] Repeat or adapt the smoke flow for Firefox.
- [ ] Repeat or adapt the smoke flow for Edge.

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

Tasks:

- Add OSV dependency scanning as reporting first.
- Add a license report for direct and transitive npm dependencies.
- Generate an SBOM in CI.
- Add a repository secret scan job using synthetic-safe configuration.
- Produce package checksums for generated release artifacts.
- Document source commit, build command, package hash, and QA signoff in release notes.

Acceptance criteria:

- `npm audit --omit=dev --audit-level=high` remains in CI.
- OSV, SBOM, license, and secret-scan outputs are available in CI artifacts.
- New package archives are published through tagged release artifacts or a release workflow, not routine source diffs.

Suggested PRs:

- `ci: add supply-chain reporting`
- `build: publish release checksums`
- `docs: add release provenance checklist`

## Phase 3 - Runtime Budgets

Purpose: keep the extension fast enough for document-start injection and large-file redaction.

Tasks:

- Record built target sizes.
- Record ONNX Runtime asset sizes.
- Track content-script init time in smoke tests where practical.
- Keep `tests/performance/redaction-benchmark.mjs` as the redaction baseline.
- Add thresholds for obvious regressions after initial baselines are collected.

Acceptance criteria:

- CI reports bundle and runtime asset size.
- Redaction benchmark output remains visible.
- Regressions beyond agreed thresholds fail or warn before release.

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

Tasks:

- Centralize duplicated file-size constants and user-facing unsupported/too-large messages.
- Keep `FileScanner` and `StreamingFileRedactor` as the source of truth where practical.
- Preserve emergency fallbacks only for dependency-missing paths.

Acceptance criteria:

- No threshold drift across scanner, paste/drop helpers, streaming redactor, and content script.
- Focused file tests pass:
  - `node tests/file_scanner.test.js`
  - `node tests/file_paste_helpers.test.js`
  - `node tests/streaming_file_redactor.test.js`
  - `node tests/content_file_drop_interception.test.js`

### 4C - Extract Shared Known-Secret Reuse

Tasks:

- Consolidate duplicate known-secret reuse logic in `redactor.js` and `transformOutboundPrompt.js`.
- Preserve current transform overlap semantics unless tests prove a safer correction.

Acceptance criteria:

- Repeated raw secrets reuse the same placeholder.
- No raw prefix/suffix remains beside placeholders.
- Focused tests pass:
  - `node tests/break_pack.test.js`
  - `node tests/placeholder_trust.test.js`
  - `node tests/typed_interception.test.js`

### 4D - Extract File Handoff Submodules

Tasks:

- Split file-handoff state, pending attach lifecycle, and fallback sequencing out of `content.js` only after 4A-4C.
- Keep provider-specific selectors and gates intact.
- Preserve fail-closed order:
  1. direct sanitized file handoff
  2. tested pending attach
  3. sanitized text fallback
  4. sanitized download fallback
  5. block raw upload

Acceptance criteria:

- `content.js` becomes smaller without weakening fail-closed behavior.
- Browser smoke and focused file-flow tests pass.

Suggested PR sequence:

- `test: cover pending attach cleanup and gated refusal`
- `refactor: centralize local text file limits`
- `refactor: share known-secret reuse helper`
- `refactor: extract file handoff lifecycle`

## Phase 5 - Enterprise And Store Publication Readiness

Purpose: make public/admin claims safe to publish.

Tasks:

- Replace privacy/support contact placeholders.
- Recheck enterprise docs against current Chrome, Edge, and Firefox policy documentation before publication.
- Complete [STORE_ASSETS_CHECKLIST.md](STORE_ASSETS_CHECKLIST.md).
- Complete [FIREFOX_AMO_CHECKLIST.md](FIREFOX_AMO_CHECKLIST.md).
- Capture fresh screenshots with synthetic data only.
- Review README, privacy policy, Chrome listing, Firefox notes, and release QA together.

Acceptance criteria:

- No public document claims full DLP, perfect protection, compliance certification, unsupported file support, or remote verification.
- Store docs and screenshots match actual release behavior.
- Human legal/product review is recorded before publication.

Suggested PRs:

- `docs: prepare store submission copy`
- `docs: refresh enterprise deployment examples`

## Phase 6 - Formal Threat Model And Architecture Diagrams

Purpose: turn scattered security notes into a maintained engineering reference.

Tasks:

- Create a formal threat model covering:
  - assets
  - trust boundaries
  - hostile page assumptions
  - extension UI trust
  - session storage and ephemeral fallback
  - file handoff trust boundaries
  - AI assist boundaries
  - enterprise audit metadata boundaries
- Add architecture diagrams for:
  - prompt redaction
  - placeholder/session state
  - secure reveal
  - file handoff
  - AI candidate gate

Acceptance criteria:

- Threat model links to `SECURITY_REVIEW.md`, `NON_GOALS.md`, and this roadmap.
- Diagrams describe actual current behavior, not aspirational behavior.
- Security tests map to key threat-model invariants.

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
