# LeakGuard Detection Research Report

Source: repo inspection of the current LeakGuard tree.

## Executive Summary

LeakGuard is already built around the right privacy model for a browser-side AI prompt guard: deterministic-first detection, session-scoped placeholders, local-only redaction, protected-site interception, and optional local AI assist for leftover suspicious candidates. The core implementation lives in `src/shared/*`, with browser orchestration in `src/background/core.js` and `src/content/content.js`.

The highest-value work is not a broad rewrite. Keep the deterministic path authoritative, preserve placeholder stability, and focus future changes on narrow gaps: sensitive context ranges, trusted placeholder handling, known raw secret reuse, URL/header edge cases, and natural-language secret disclosures. Recent v1.3.0 work already moved in this direction; this report should be used as a practical handoff, not as a claim that all listed ideas are complete.

## Current Architecture

LeakGuard's detection and redaction path is local-only. It must not add backend calls, telemetry, cloud scanning, remote verification, or remote secret processing.

Key files verified in this repo:

| Area | Files |
|---|---|
| Deterministic patterns and scoring | `src/shared/patterns.js`, `src/shared/entropy.js`, `src/shared/detector.js` |
| Redaction and placeholder reuse | `src/shared/redactor.js`, `src/shared/placeholders.js`, `src/shared/transformOutboundPrompt.js` |
| Placeholder/session state | `src/shared/sessionMapStore.js`, `src/background/core.js` |
| Network/IP pseudonymization | `src/shared/ipDetection.js`, `src/shared/ipClassification.js`, `src/shared/networkHierarchy.js`, `src/shared/placeholderAllocator.js` |
| Optional local AI assist | `src/shared/aiCandidateGate.js`, `src/shared/ai/classifier.js`, `src/shared/transformOutboundPromptWithAi.js`, `ai/models/*` |
| Browser interception | `src/content/content.js`, `src/content/composer_helpers.js` |
| Policy and protected sites | `src/shared/policy.js`, `src/shared/protected_sites.js`, `config/policy.*.json` |

## Strengths To Preserve

- Deterministic-first detection with explicit provider patterns, assignment/context rules, entropy and structure checks, and false-positive suppression.
- Session-scoped placeholders such as `[PWM_1]`, `[NET_1]`, and `[PUB_HOST_1]`, with raw secrets kept out of persistent storage and UI surfaces.
- Trusted placeholder handling: existing placeholders should be preserved only when they are known to the active session/state.
- Known raw secret reuse: repeated secrets should reuse the same placeholder and avoid partial outputs such as `ApiKey[PWM_N]`.
- Sensitive HTTP header behavior: preserve names, separators, and auth schemes while redacting full intended values, for example `Authorization: Bearer [PWM_N]`.
- URL credential handling: preserve URL shape while redacting username/password separately where possible.
- Optional local AI assist that only scores leftover suspicious candidates and does not replace deterministic findings.

## Practical Recommendations

### 1. Keep Placeholder Trust Explicit

Treat placeholder syntax and placeholder trust as separate signals. A visible token that merely looks like `[PWM_7]` should not be considered safe unless the active `PlaceholderManager` or trusted public state knows it.

Actionable checks:

- Preserve known placeholders unchanged.
- Treat unknown placeholder-like tokens in sensitive contexts as candidates.
- Reserve visible placeholder indices so replacement numbering stays stable and a fake `[PWM_7]` is not redacted back to `[PWM_7]`.
- Continue testing trusted placeholder tails, unknown placeholder-like tokens, and adjacent placeholders in `tests/placeholder_trust.test.js` and `tests/typed_interception.test.js`.

### 2. Prefer Full Intended Ranges

For headers, labelled values, URL credentials, and repeated raw secrets, the redactor should prefer the full intended secret range over suffix-only entropy findings.

Likely files:

- `src/shared/detector.js`
- `src/shared/redactor.js`
- `src/shared/transformOutboundPrompt.js`
- `tests/detector.test.js`
- `tests/break_pack.test.js`

Acceptance examples:

- `X-API-Key: ApiKeyHeader1234567890` becomes `X-API-Key: [PWM_N]`.
- `Again same key: ApiKeyHeader1234567890` reuses the same placeholder.
- No raw prefix or suffix remains next to `[PWM_N]`.

### 3. Expand Natural-Language Detection Carefully

Natural-language disclosures are useful, but they are noisier than provider-specific patterns. Keep them context-bound and deny-list-aware.

Good candidate contexts:

- `this is my secret ...`
- `here is my password ...`
- `my db password is ...`
- `real value: ...`
- `token -> ...`
- `again same key: ...`

False-positive controls should continue to suppress examples, templates, password policy discussion, regex help, validators, generators, and benign keys such as `password_hint`, `secret_santa`, `token_limit`, `api_version`, `build_id`, `region`, and `environment`.

Recommended tests:

- `tests/natural_language_context.test.js`
- `tests/detector.test.js`
- `tests/break_pack.test.js`
- `tests/ai_candidate_gate.test.js` if local AI candidate extraction changes

### 4. Keep AI Assist Optional And Local

The local AI path should remain a narrow assist layer for leftover suspicious candidates. Deterministic findings should stay authoritative, and the full prompt should not be sent to a model or service.

Likely files:

- `src/shared/aiCandidateGate.js`
- `src/shared/ai/classifier.js`
- `src/shared/transformOutboundPromptWithAi.js`
- `docs/AI_ASSIST.md`
- `tests/ai_candidate_gate.test.js`
- `tests/transform_with_ai.test.js`
- `tests/ai_assist.test.js`

Do not add remote verification, cloud model calls, analytics, or telemetry.

## Recommended Regression Focus

| Risk | Recommended tests |
|---|---|
| Fake placeholder laundering | `tests/placeholder_trust.test.js`, `tests/typed_interception.test.js` |
| Trusted placeholder plus secret tail | `tests/placeholder_trust.test.js`, `tests/detector.test.js` |
| Header value range too short | `tests/detector.test.js`, `tests/break_pack.test.js` |
| Known secret reuse leaves raw prefix/suffix | `tests/break_pack.test.js`, `tests/detector.test.js` |
| Natural-language false positives | `tests/natural_language_context.test.js` |
| Composer rewrite mismatch | `tests/composer_helpers.test.js`, `tests/typed_interception.test.js` |
| Local AI candidate drift | `tests/ai_candidate_gate.test.js`, `tests/transform_with_ai.test.js` |
| Policy or protected-site regressions | `tests/protected_sites.test.js`, `tests/enterprise_policy.test.js` |
| Build/package security drift | `tests/security.test.js`, `tests/productization.test.js`, `tests/build_targets.test.js` |

## Implementation Handoff

### Likely Files To Inspect

Start with the owning files for the behavior being changed:

- `src/shared/detector.js`
- `src/shared/patterns.js`
- `src/shared/redactor.js`
- `src/shared/placeholders.js`
- `src/shared/transformOutboundPrompt.js`
- `src/shared/sessionMapStore.js`
- `src/background/core.js`
- `src/content/content.js`
- `src/content/composer_helpers.js`
- `src/shared/aiCandidateGate.js` only when candidate extraction changes

### Recommended Test Files

- `tests/detector.test.js`
- `tests/break_pack.test.js`
- `tests/placeholder_trust.test.js`
- `tests/natural_language_context.test.js`
- `tests/typed_interception.test.js`
- `tests/composer_helpers.test.js`
- `tests/ai_candidate_gate.test.js` when local AI candidate behavior changes

### Safe Order Of Changes

1. Reproduce the gap with the narrowest existing test file.
2. Add or update a focused regression test using synthetic secrets only.
3. Patch the smallest owning module, usually `detector.js`, `redactor.js`, or `placeholders.js`.
4. Run the focused test file with `node tests/<file>.test.js`.
5. Run `npm test` for behavior changes.
6. Update docs only when behavior, commands, or ownership guidance changed.

### Acceptance Criteria

- Sensitive values are redacted over the full intended range.
- Known repeated raw secrets reuse the same placeholder.
- Trusted placeholders pass through; unknown placeholder-like tokens do not become a bypass.
- Placeholder ordering remains deterministic and stable.
- Raw secrets are not persisted to local storage, DOM, logs, exported docs, or audit records.
- No backend calls, telemetry, cloud scanning, remote secret processing, or remote verification are introduced.
- Chrome and Firefox MV3 compatibility is preserved.
- Focused regressions and the full test suite pass for code changes.

## Commands

Commands verified against `package.json`:

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

No docs-only validation command is currently defined in `package.json`.

## Related Docs

- `docs/REPO_MAP.md`: file ownership and test ownership.
- `docs/BUG_PLAYBOOK.md`: narrow validation commands for likely regressions.
- `docs/DETECTION_ENHANCEMENTS.md`: current trust-aware placeholder and redaction hardening notes.
- `docs/AI_ASSIST.md`: local AI assist constraints.
- `docs/CODEX_PROMPT_TEMPLATES.md`: reusable task prompts.
- `docs/CODEX_CHANGELOG.md`: short handoff log for Codex-made changes.
