# LeakGuard Deep Research Report

Updated: 2026-05-03

Scope: repo inspection of the current `main` checkout, the previous `docs/deep-research-report.md`, recent local git history, merged GitHub PRs/commits from roughly 2026-04-21 through 2026-05-02, and the public docs cleanup that added `docs/NON_GOALS.md`.

## 1. Executive Summary

LeakGuard is a local-first browser privacy guard that reduces accidental AI prompt leaks. Its strongest current design choice is that deterministic detection remains authoritative: provider and context patterns, entropy checks, URL/header parsers, public IPv4 handling, placeholder trust, and right-to-left redaction run locally before text reaches protected chat composers.

The current repo supports the v1.3.0 hardening goals in the critical deterministic areas: trust-aware placeholder handling, sensitive HTTP header ranges, URL credential redaction, repeated raw secret placeholder reuse, and targeted natural-language/labelled disclosures. v1.4.0 release prep adds release-facing coverage for local text-file paste/drop/file-select redaction in protected AI composers: supported UTF-8 text files are validated locally, redacted through the background-owned placeholder flow, and replaced with sanitized in-memory `File`/`Blob` objects where browser and site upload flows accept synthetic file handoff. Unsupported files and sanitized handoff failures are blocked fail-closed so raw uploads do not proceed. The optional AI assist is implemented as a local ONNX/classifier layer over leftover suspicious candidates, not as full-prompt cloud AI and not as a replacement for deterministic detection.

LeakGuard should continue to describe itself as local-first risk reduction, not full enterprise DLP. It does not perform remote secret verification, organization-wide discovery, SIEM integration, credential revocation, historical repository scanning, or managed endpoint hardening. The public non-goals list now lives in `docs/NON_GOALS.md`.

## 2. What Changed Since the Old Report

The old report was a practical handoff focused on preserving deterministic detection, placeholder stability, local-only processing, and narrow future hardening. Since then, the repo has moved several recommendations from "guidance" to "implemented and covered by tests."

Recent verified GitHub history:

| PR / commit | Date | Verified change |
|---|---:|---|
| [PR #57](https://github.com/petritbahtiri123/LeakGuard/pull/57), commit `069d618` | 2026-05-01 | v1.3.0 redaction hardening: placeholder trust, sensitive headers, URL credentials, labelled/natural-language ranges, known-secret reuse, package/manifest version bump. |
| [PR #58](https://github.com/petritbahtiri123/LeakGuard/pull/58), commit `854a582` | 2026-05-02 | Provider token coverage refresh for GitLab token families plus Codex guidance/docs cleanup. |
| [PR #59](https://github.com/petritbahtiri123/LeakGuard/pull/59), commit `d3046cd` | 2026-05-02 | Natural-language "real/actual value" detection fix, dynamic protected-site runtime injection aligned with AI assist modules, bounded placeholder rehydration. |
| [PR #49](https://github.com/petritbahtiri123/LeakGuard/pull/49), commit `9f91205` | 2026-04-29 | Local text File Scanner with redacted text export and sanitized JSON report. |
| [PR #41](https://github.com/petritbahtiri123/LeakGuard/pull/41) and [PR #42](https://github.com/petritbahtiri123/LeakGuard/pull/42) | 2026-04-27 | Local AI candidate gate and docs alignment: deterministic ranges reserved, leftover candidates only, classifier receives `candidate.contextText`. |
| [PR #29](https://github.com/petritbahtiri123/LeakGuard/pull/29), [PR #53](https://github.com/petritbahtiri123/LeakGuard/pull/53), related ONNX/build commits | 2026-04-24 to 2026-04-30 | Local ONNX classifier packaging and ONNX Runtime sidecar packaging for extension builds. |
| [PR #21](https://github.com/petritbahtiri123/LeakGuard/pull/21), [PR #26](https://github.com/petritbahtiri123/LeakGuard/pull/26), commit `1ff2d2a` | 2026-04-23 to 2026-04-24 | Firefox support and multi-target Chrome/Firefox consumer/enterprise builds. |
| Public docs cleanup | 2026-05-03 | README AI-assist wording now matches the candidate-gated local architecture, and `docs/NON_GOALS.md` documents public limitations. |

## 3. Current Architecture Snapshot

| Area | Current files |
|---|---|
| Deterministic detection | `src/shared/patterns.js`, `src/shared/entropy.js`, `src/shared/detector.js` |
| Redaction and placeholder reuse | `src/shared/redactor.js`, `src/shared/placeholders.js`, `src/shared/transformOutboundPrompt.js` |
| Placeholder/session state | `src/shared/sessionMapStore.js`, `src/background/core.js` |
| Browser interception | `src/content/content.js`, `src/content/composer_helpers.js` |
| Local file sanitized handoff | `src/content/file_paste_helpers.js`, `src/content/content.js`, `src/shared/fileScanner.js`, `src/background/core.js` |
| Optional local AI assist | `src/shared/aiCandidateGate.js`, `src/shared/ai/classifier.js`, `src/shared/transformOutboundPromptWithAi.js`, `ai/models/*` |
| Public IPv4 and CIDR pseudonymization | `src/shared/ipClassification.js`, `src/shared/ipDetection.js`, `src/shared/networkHierarchy.js`, `src/shared/placeholderAllocator.js` |
| Local file scanner | `src/shared/fileScanner.js`, `src/scanner/scanner.js`, `src/scanner/scanner.html`, `src/scanner/scanner.css` |
| Policy/protected sites | `src/shared/policy.js`, `src/shared/protected_sites.js`, `src/background/core.js`, `config/policy.*.json` |
| Browser build targets | `scripts/build-extension.mjs`, `scripts/build-all.mjs`, `manifests/*.json`, `tests/build_targets.test.js` |

Current `package.json` commands verified:

- `npm run prepare:build`
- `npm test`
- `node tests/<file>.test.js`
- `npm run build`
- `npm run build:all`
- `npm run build:chrome`
- `npm run build:chrome-enterprise`
- `npm run build:firefox`
- `npm run build:firefox-enterprise`
- `npm run icons:export`

No docs-only validation script exists in `package.json`.

## 4. Old Recommendations Status

| Old recommendation | Current status | Evidence path/PR | Remaining work |
|---|---|---|---|
| Keep placeholder trust explicit. | Implemented. Unknown placeholder-like tokens are not trusted automatically, trusted placeholders are preserved, and visible indices are reserved to avoid self-redaction. | `src/shared/placeholders.js`, `src/shared/detector.js`, `tests/placeholder_trust.test.js`, `tests/typed_interception.test.js`, [PR #57](https://github.com/petritbahtiri123/LeakGuard/pull/57). | Keep adding regressions for new placeholder syntaxes and partially redacted rerun cases. |
| Prefer full intended ranges over suffix-only findings. | Implemented for the v1.3.0 target cases verified here: sensitive headers, labelled values, URL credentials, and known repeated secrets avoid raw prefix/suffix leaks. | `src/shared/detector.js`, `src/shared/redactor.js`, `src/shared/transformOutboundPrompt.js`, `tests/break_pack.test.js`, `tests/detector.test.js`, [PR #57](https://github.com/petritbahtiri123/LeakGuard/pull/57). | Continue provider-specific tests when adding new token families or separators. |
| Expand natural-language detection carefully. | Partially implemented. Targeted chat-style examples and deny-list suppressions are tested, but broad natural-language coverage remains inherently noisy and not exhaustive. | `src/shared/detector.js`, `tests/natural_language_context.test.js`, `tests/detector.test.js`, [PR #55](https://github.com/petritbahtiri123/LeakGuard/pull/55), [PR #59](https://github.com/petritbahtiri123/LeakGuard/pull/59). | Broaden examples slowly with paired false-positive tests. Keep deterministic provider/context rules higher confidence than prose heuristics. |
| Keep AI assist optional and local. | Implemented. The async wrapper reserves deterministic ranges, extracts leftover candidates, sends only `candidate.contextText` to the local classifier, and respects the `aiAssistEnabled` policy. README and `docs/AI_ASSIST.md` now use the same candidate-gated description. | `README.md`, `docs/AI_ASSIST.md`, `src/shared/aiCandidateGate.js`, `src/shared/transformOutboundPromptWithAi.js`, `src/shared/ai/classifier.js`, `tests/ai_candidate_gate.test.js`, `tests/transform_with_ai.test.js`, `tests/ai_assist.test.js`, [PR #41](https://github.com/petritbahtiri123/LeakGuard/pull/41), [PR #42](https://github.com/petritbahtiri123/LeakGuard/pull/42). | Keep README, `docs/AI_ASSIST.md`, and `docs/NON_GOALS.md` aligned when AI assist changes. |
| Preserve local-only privacy model. | Implemented in inspected surfaces. File scanner and AI assist use local browser/runtime assets; security tests guard raw secret reveal and storage boundaries. | `README.md`, `docs/AI_ASSIST.md`, `src/shared/fileScanner.js`, `src/shared/ai/classifier.js`, `tests/security.test.js`, `tests/file_scanner.test.js`, [PR #49](https://github.com/petritbahtiri123/LeakGuard/pull/49). | Keep network calls, telemetry, cloud scanning, remote model calls, and remote secret verification out of runtime code. |
| Preserve Chrome/Firefox build targets. | Implemented. The repo exposes four build commands and has a build-target regression file. | `package.json`, `scripts/build-extension.mjs`, `scripts/build-all.mjs`, `manifests/*.json`, `tests/build_targets.test.js`, [PR #21](https://github.com/petritbahtiri123/LeakGuard/pull/21), [PR #26](https://github.com/petritbahtiri123/LeakGuard/pull/26). | Run build-target tests or target builds when manifests, ONNX sidecars, CSP, or browser APIs change. |
| Add local file scanning without changing privacy model. | Implemented for text files. Scanner is extension-owned, local-only, deterministic, size-limited, and exports redacted text plus sanitized JSON reports. | `src/shared/fileScanner.js`, `src/scanner/scanner.js`, `tests/file_scanner.test.js`, [PR #49](https://github.com/petritbahtiri123/LeakGuard/pull/49). | PDF/DOCX/image/OCR scanning remains out of scope and should not be claimed as enabled. |

### Implemented

- Trust-aware placeholder handling for known versus unknown visible placeholders.
- Sensitive HTTP header redaction that preserves names, separators, auth schemes, and cookie attributes where tests cover them.
- URL credential parsing that redacts username and password/token segments separately while preserving URI shape.
- Known raw secret reuse across headers, assignments, labelled prose, and plain repeats.
- Provider-token coverage improvements for GitLab token prefixes and synthetic GitHub/GitLab regressions.
- Optional local AI assist with candidate gating after deterministic detection.
- Local text File Scanner with sanitized report exports.
- Chrome/Firefox consumer and enterprise build target commands.
- Public non-goals page linked from README.
- Repo guidance cleanup in `AGENTS.md`, `docs/REPO_MAP.md`, `docs/BUG_PLAYBOOK.md`, and `docs/CODEX_PROMPT_TEMPLATES.md`.

### Partially Implemented

- Natural-language detection: targeted contexts such as "this is my secret", "my db password is", "real/actual value", and "again same key" are covered, but broad prose remains noisy and should stay conservative.
- Enterprise deployment behavior: policy hooks, destination actions, managed protected sites, and metadata-only audit events exist, but README correctly notes managed browser deployment is still required for force install, hard-removal prevention, incognito/InPrivate handling, and developer-mode restrictions.

### Still Open

- No docs-only validation script in `package.json`.
- No remote/liveness secret verification by design.
- No historical git scanning, CI secret baseline workflow, or credential rotation workflow.
- No enabled PDF/DOCX/image/OCR scanner.
- No claim-ready enterprise DLP posture.

## 5. Industry Standards Comparison

| Reference | What it emphasizes | LeakGuard alignment | Gap / difference |
|---|---|---|---|
| [GitHub Secret Scanning](https://docs.github.com/en/code-security/reference/secret-security/secret-scanning-detection-scope) and [GitHub Secret Protection](https://github.com/security/advanced-security/secret-protection) | Repository and package scanning, push protection, supported provider patterns, partner-program coverage. | LeakGuard similarly values provider-specific high-signal patterns and false-positive control. | LeakGuard acts before prompt submission in browser composers and local files; it does not scan repository history, block git pushes, notify providers, or verify exposed credentials remotely. |
| [detect-secrets](https://github.com/Yelp/detect-secrets) | Baseline generation, audit workflow, plugins, allowlisting. | LeakGuard has suppression/allowlist logic and focused regression suites. | LeakGuard has no reviewed baseline file or audit workflow for repo-wide secret triage. |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | CLI/CI/pre-commit secret scanning for code and git history with configurable rules and ignore fingerprints. | LeakGuard shares deterministic pattern thinking and tests provider token families. | LeakGuard is not a git-history scanner or CI/pre-commit tool. |
| [TruffleHog](https://github.com/trufflesecurity/trufflehog) | Finding, verifying, and analyzing leaked credentials across sources; verified-result workflows. | LeakGuard redacts before user submission and avoids sending raw secrets out for verification. | LeakGuard intentionally does not perform live credential verification because remote verification would conflict with its local-only model. |
| [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) | Centralized storage, provisioning, auditing, rotation, and management of secrets. | LeakGuard can reduce accidental disclosure by redacting prompt text and selected local files. | It is not a secrets manager, vault, rotation system, or access-control plane. |
| [NIST Privacy Framework](https://www.nist.gov/privacy-framework/privacy-framework) and privacy engineering guidance | Data minimization, privacy risk management, system lifecycle thinking. | LeakGuard's local-only redaction, no telemetry, session-scoped raw mappings, and candidate-gated AI assist align with minimization. | It still handles raw secrets transiently in the browser session, so secure reveal and session storage boundaries remain high-risk surfaces. |
| [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) / in-browser inference model | On-device/in-browser inference can improve privacy by avoiding server-side inference. | LeakGuard packages ONNX Runtime Web and model assets locally and classifies candidate windows in the browser. | Local inference still needs packaging, CSP, sidecar assets, performance, and stale-model validation; it is not a cloud LLM replacement. |

## 6. Where LeakGuard Stands Today

### Strengths

- Local-only privacy model with no backend, telemetry, cloud scanning, remote model calls, remote secret processing, or remote secret verification in the inspected runtime design.
- Deterministic detection is authoritative and has focused tests around provider tokens, headers, URL credentials, repeated secrets, placeholders, safe literals, and public IPv4 data.
- Placeholder behavior is mature enough for current v1.3.0 claims: session-known placeholders are preserved, unknown placeholder-like tokens in sensitive contexts are candidates, and known raw secrets reuse placeholders.
- Browser composer safety has explicit interception and rewrite verification coverage for textarea/contenteditable and modal-block states.
- File scanner extends the same local deterministic redaction model to selected text files without storing raw file contents in extension storage.
- Chrome and Firefox consumer/enterprise build targets are represented in commands, manifests, and tests.

### Realistic Limitations

- Detection is heuristic and pattern-driven. It will miss unknown token formats and may suppress or warn on edge cases depending on context.
- Natural-language detection is intentionally limited. It should not be presented as broad semantic understanding.
- AI assist is small, local, optional, and candidate-gated. It should not be marketed as full-prompt AI scanning or cloud-grade classification.
- LeakGuard protects configured browser surfaces and the extension file scanner, not every place a user can paste or upload data.
- Secure reveal requires transient raw-to-placeholder mappings during the active browser session.

### What It Should Not Claim

- Full enterprise DLP.
- Guaranteed prevention of all AI prompt leaks.
- Credential liveness verification.
- Automatic secret rotation or revocation.
- Organization-wide repository, SaaS, endpoint, clipboard, screenshot, PDF, DOCX, or OCR coverage.
- Cloud AI scanning, remote model inference, or remote secret verification.

## 7. Remaining Gaps / What We Are Still Lacking

1. No docs validation command: `package.json` has no docs-only lint, link check, or markdown validation script.
2. No repo-history scanner workflow: LeakGuard can reduce prompt/file leakage but does not replace GitHub Secret Scanning, Gitleaks, detect-secrets, or TruffleHog for source control.
3. No remote verification by design: this is correct for local-only privacy, but it means LeakGuard cannot distinguish live from revoked secrets the way verification-first tools can.
4. Natural-language detection remains partial: tests cover targeted examples and false-positive suppressions, not broad natural prose.
5. File scanner scope is text-only and 2 MiB-limited. README and `docs/NON_GOALS.md` correctly say PDF, DOCX, and image redaction are not enabled.
6. Enterprise posture should remain carefully worded. The repo has enterprise modes/policy hooks, but not enough for an enterprise-grade DLP claim.

## 8. Recommended Next Steps

1. Add a docs-only validation script if docs changes will continue to be frequent, for example a markdown link/style check that does not touch build outputs.
2. Keep README, `docs/AI_ASSIST.md`, `docs/NON_GOALS.md`, and this report aligned when AI assist, scanner scope, or enterprise wording changes.
3. Keep v1.3.0 hardening narrow: add provider-specific tests before expanding generic entropy or prose rules.
4. Add natural-language regressions in pairs: one positive disclosure and one false-positive suppression for each new phrase family.
5. Add file scanner fixtures for tricky text formats already supported, such as `.env`, `.json`, `.yaml`, `.log`, shell, and PowerShell syntax.
6. Keep Chrome/Firefox build-target tests close to any ONNX Runtime, manifest, CSP, or browser API changes.
7. Keep non-goal claims explicit: no remote verification, no cloud AI, no full enterprise DLP, no PDF/DOCX/OCR support yet.

## 9. Implementation Handoff

### Likely Files To Inspect

- `src/shared/detector.js`
- `src/shared/patterns.js`
- `src/shared/redactor.js`
- `src/shared/placeholders.js`
- `src/shared/transformOutboundPrompt.js`
- `src/shared/transformOutboundPromptWithAi.js`
- `src/shared/aiCandidateGate.js`
- `src/shared/sessionMapStore.js`
- `src/background/core.js`
- `src/content/content.js`
- `src/content/composer_helpers.js`
- `src/shared/fileScanner.js`
- `scripts/build-extension.mjs`
- `manifests/*.json`

### Recommended Tests

- `node tests/detector.test.js`
- `node tests/break_pack.test.js`
- `node tests/placeholder_trust.test.js`
- `node tests/natural_language_context.test.js`
- `node tests/ai_candidate_gate.test.js`
- `node tests/transform_with_ai.test.js`
- `node tests/typed_interception.test.js`
- `node tests/composer_helpers.test.js`
- `node tests/file_scanner.test.js`
- `node tests/security.test.js`
- `node tests/build_targets.test.js`
- `npm test` for behavior changes

### Safe Order Of Changes

1. Identify the narrow owner from `docs/REPO_MAP.md` and `docs/BUG_PLAYBOOK.md`.
2. Add or update a focused regression test using synthetic values only.
3. Patch the smallest owning module.
4. Check redacted output for whole raw values and raw prefix/suffix tails, not just placeholder presence.
5. Run the focused test file.
6. Run `npm test` for source/behavior changes.
7. Run build-target tests or target builds only when build scripts, manifests, ONNX assets, or browser APIs change.
8. Keep generated `dist/`, `node_modules/`, `ai/models/`, `package-lock.json`, and build outputs out of routine docs/code patches unless the task explicitly targets them.

### Acceptance Criteria

- Deterministic detection remains authoritative.
- Unknown placeholder-like tokens are not trusted automatically.
- Existing trusted placeholders remain stable and pass through where appropriate.
- Headers, labelled values, URL credentials, and known repeated secrets redact intended full ranges and do not leak raw prefixes/suffixes.
- Same raw secret reuses the same placeholder.
- AI assist remains local, optional, candidate-gated, and deterministic-first.
- File scanner remains local-only and does not export raw secrets in sanitized reports.
- No backend calls, telemetry, cloud scanning, remote model calls, remote secret verification, or remote secret processing are introduced.
- Chrome/Firefox MV3 compatibility and CSP remain intact.

## 10. Validation Notes

Research and verification performed for this report:

- Read `AGENTS.md`, `docs/REPO_MAP.md`, `docs/BUG_PLAYBOOK.md`, `docs/CODEX_PROMPT_TEMPLATES.md`, `docs/Prompt_Templates.md`, `docs/CODEX_CHANGELOG.md`, `package.json`, `scripts/run-tests.mjs`, prior `docs/deep-research-report.md`, `README.md`, `docs/AI_ASSIST.md`, `docs/NON_GOALS.md`, and `docs/DETECTION_ENHANCEMENTS.md`.
- Reviewed local `git log --since='2026-04-21'` and GitHub PR/commit metadata for `petritbahtiri123/LeakGuard`, with special attention to PRs #29, #41, #42, #49, #53, #57, #58, #59, and #60.
- Inspected source and tests for placeholder trust, full-range redaction, repeated secret reuse, natural-language detection, AI candidate gating, file scanner behavior, security constraints, and build target coverage.
- Confirmed `package.json` has no docs-only validation script.
- Did not run `npm test` or full builds because this is a docs-only update and no source, commands, or behavior implementation was changed.

Pre-existing worktree note: local AI model artifacts under `ai/models/` were already modified before this report update and were not touched for this docs-only change.
