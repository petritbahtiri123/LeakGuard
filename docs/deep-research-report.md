# LeakGuard Deep Research Report

Updated: 2026-05-29

Scope: current branch review of `main` versus this branch, `docs/DOCUMENTATION_ROADMAP.md`, security/privacy docs, build and policy docs, workflow files, tests, manifests, release artifacts, and the code-quality audit. This is an internal planning document, not release copy.

## Executive Summary

LeakGuard is in a much stronger place than the older report on `main`. The `main` report still reflects the May 5 state and says there is no docs validation command, describes older v1.3/v1.4 work, and does not include the current v1.7 documentation, release-hardening, audit-retention, file-handoff, and compatibility work.

The current branch has already closed several important hardening items:

- private placeholder/reveal fallback now uses ephemeral extension memory instead of `storage.local`
- release builds strip debug helpers, debug console paths, and sourcemap references from packaged content scripts
- audit logging is metadata-only, bounded, and covered by retention tests
- exact-origin custom protected-site grants are tested
- the early file drag guard has teardown coverage
- local text-file scanning and protected composer text-file handoff are documented and tested
- documentation now has a central index, user/admin/release guides, and `npm run docs:check-links`

The remaining work is not one obvious bug. It is an ordered hardening program: browser smoke CI, supply-chain reporting, release artifact hygiene, runtime budgets, maintainability refactors around large security-critical files, and a formal threat model. These are the things that move LeakGuard from "strong local privacy extension" toward a genuinely world-class extension without overclaiming enterprise DLP or perfect protection.

## Current State

| Area | Status | Evidence |
| --- | --- | --- |
| Local-only model | Strong, still the core rule | `README.md`, `docs/NON_GOALS.md`, `docs/PRIVACY_POLICY.md`, `SECURITY_REVIEW.md` |
| Secure reveal | Implemented and regression-tested | `SECURITY_REVIEW.md`, `tests/security.test.js`, `src/background/core.js`, `src/popup/popup.js` |
| Private session fallback | Finished | `src/compat/platform.js`, `src/shared/sessionMapStore.js`, `tests/security.test.js` |
| Release debug stripping | Finished | `scripts/build-extension.mjs`, `tests/build_targets.test.js` |
| Sourcemap release policy | Finished | `tests/build_targets.test.js` |
| Metadata-only audit retention | Finished | `src/background/core.js`, `src/shared/policy.js`, `tests/enterprise_policy.test.js` |
| Exact-origin custom site grants | Finished | `src/shared/protected_sites.js`, `tests/protected_sites.test.js`, `tests/productization.test.js` |
| Text file scanner and composer file handling | Implemented for supported UTF-8 text files | `src/shared/fileScanner.js`, `src/shared/streamingFileRedactor.js`, `docs/FILE_UPLOAD_SCANNING_GUIDE.md`, file-flow tests |
| AI assist | Local, optional, candidate-gated | `docs/AI_ASSIST.md`, `src/shared/aiCandidateGate.js`, `src/shared/transformOutboundPromptWithAi.js`, AI tests |
| Multi-target builds | Chrome/Firefox consumer and enterprise targets exist | `package.json`, `manifests/*.json`, `scripts/build-all.mjs`, `tests/build_targets.test.js` |
| Documentation foundation | Much improved | `docs/README.md`, `docs/DOCUMENTATION_ROADMAP.md`, `scripts/check-doc-links.mjs` |

## Finished Since Main

`main:docs/deep-research-report.md` is now materially stale. The following items have moved from open, partial, or missing to done on this branch:

- Docs validation: `npm run docs:check-links` now exists and checks local markdown links.
- Documentation routing: `docs/README.md` is the central index and the root README points into it.
- User guides: install, protected sites, placeholders/reveal, file upload scanning, browser compatibility, and troubleshooting now exist.
- Admin/release guides: managed policy schema, Firefox AMO checklist, store assets checklist, and versioning policy now exist.
- Enterprise policy: `destinationPolicies`, `managedProtectedSites`, `allowSiteRemoval`, `auditRetentionDays`, and strict-load behavior are documented and covered by policy tests.
- Release hardening: generated builds are checked for no sourcemaps, no `sourceMappingURL`, and no content-script debug logging helpers.
- File handling: supported text files above 4 MiB and up to 50 MB use streaming/chunked redaction in protected composer paths, with fail-closed behavior for oversized or failed sanitized handoff paths.
- Firefox AMO readiness: Firefox manifests include Gecko metadata and no-data-collection declaration, and there is now a checklist distinct from the internal playbook.

## Still Open

| Priority | Gap | Why it matters | Current best next step |
| --- | --- | --- | --- |
| P0 | Browser smoke CI is missing | Local-only and rewrite claims need live browser proof, especially for MV3 lifecycle, Firefox behavior, and file handoff | Add a minimal Chrome/Firefox smoke harness before broad refactors |
| P0 | Release artifacts are committed under `release/` | Binaries in source history make review harder and can drift from source | Move future package publishing to tagged GitHub Releases or CI artifacts |
| P0 | Large security-critical files remain concentrated | `content.js` is about 12.5k lines; `detector.js` about 3.5k; `core.js` about 1.4k | Add tests first, then extract behavior-preserving modules in small PRs |
| P1 | Supply-chain reporting is partial | CI runs `npm audit`, but there is no OSV scan, SBOM, license report, or repo secret scan job | Add reporting-only jobs first, then make gates stricter after tuning |
| P1 | Runtime budgets are not enforced | ONNX Runtime assets and document-start scripts can regress size/startup cost | Track bundle size, ORT asset size, init time, and redaction latency budgets |
| P1 | Formal threat model is missing | Current security notes are good, but scattered | Create a concise threat model with trust boundaries, assets, abuse cases, and non-goals |
| P1 | Edge support is documented as plausible, not proven | Edge can load the Chrome target, but there is no dedicated build or smoke CI | Keep Edge wording conservative until smoke tests pass |
| P2 | Store/privacy release readiness still needs human review | Contact placeholders, screenshots, and legal/store review are not engineering-only tasks | Complete store assets checklist and privacy contact replacement before submission |
| P2 | Natural-language detection remains inherently partial | Broad prose detection is noisy and false-positive-prone | Add paired positive and false-positive tests for every new phrase family |
| P2 | File protection remains text-only | PDF, DOCX, OCR, archive, executable, and binary formats are not protected | Keep docs explicit; do not start binary formats until core hardening lands |

## Areas Needing The Most Care

### 1. Content Script And File Handoff

`src/content/content.js` is the highest-risk file. It handles composer interception, rewrite verification, file paste/drop/select handling, Gemini/Grok pending attach, Firefox-specific behavior, debug paths, and UI state. The code-quality audit calls out the local file insert path and pending attach duplication as the top refactor risks.

Care rule: do not extract this first. Add behavioral tests around cancellation, exception cleanup, non-Gemini/Grok pending-attach refusal, and fail-closed handoff before moving code.

### 2. Release Build And Artifact Hygiene

The build pipeline now strips high-risk debug artifacts, but packaged zips and XPI files still exist under `release/`. That is acceptable for historical evidence, but it should not be the future release model.

Care rule: move toward reproducible CI artifacts with checksums and source commit provenance before adding more package archives.

### 3. Browser Coverage

Chrome and Firefox targets are real. Edge is plausible through Chromium compatibility, but not proven by automated smoke tests. Safari is unsupported.

Care rule: claim only what is tested. Add smoke CI before expanding public browser support language.

### 4. Enterprise Language

Policy hooks are useful, but LeakGuard is still not full DLP. Browser policy is required for force install, hard-removal prevention, incognito/InPrivate controls, and developer-mode restrictions.

Care rule: keep "enterprise deployment support" separate from "enterprise DLP" or compliance claims.

### 5. AI Assist And Detection Claims

AI assist is local and candidate-gated. It should remain behind deterministic detection, receive only candidate context windows, and never become a full-prompt cloud classifier.

Care rule: every AI wording change must stay aligned across `README.md`, `docs/AI_ASSIST.md`, `docs/NON_GOALS.md`, privacy policy, and store copy.

## Do Not Turn These Into Goals

These are intentionally not goals unless the product direction changes:

- backend secret processing
- telemetry or analytics
- cloud scanning
- remote model calls
- remote secret verification or provider liveness checks
- full enterprise DLP
- credential rotation, revocation, or inventory
- repository-history scanning
- screenshot, clipboard-history, malware, endpoint, PDF/DOCX/OCR, or binary-file protection claims

## Recommended Implementation Order

The detailed roadmap lives in [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md). The order matters:

1. Establish no-regression gates for docs, security, build artifacts, and current unit tests.
2. Add browser smoke CI before refactoring `content.js`.
3. Add supply-chain reporting and release provenance.
4. Add runtime size/performance budgets.
5. Refactor large files only behind focused behavioral tests.
6. Refresh enterprise/store/privacy publication material after engineering gates are stable.
7. Create a formal threat model and architecture diagrams.
8. Consider larger product expansions only after the foundation is boring and repeatable.

## Acceptance Criteria For The Hardening Program

LeakGuard is in a strong release posture when:

- `npm test` and `npm run docs:check-links` pass locally and in CI
- build-target tests prove no debug helpers or sourcemaps ship
- browser smoke CI covers Chrome stable, Firefox stable, and eventually Edge
- release artifacts are reproducible from a source commit and published outside normal source diffs
- dependency audit, OSV scan, SBOM, license report, and repo secret scan are available
- runtime size and latency budgets are tracked
- high-risk content/file-handoff refactors land only after focused tests
- public docs avoid perfect-protection, full-DLP, remote-verification, and unsupported-file-format claims
- privacy/store/enterprise docs receive human review before publication

## Validation Notes

This update read the current branch report, `main:docs/deep-research-report.md`, documentation roadmap, privacy/non-goals/security docs, workflow files, package scripts, build-target tests, security tests, enterprise policy tests, and code-quality audit. No runtime behavior was changed.

Recommended validation for this docs-only update:

```bash
npm run docs:check-links
```
