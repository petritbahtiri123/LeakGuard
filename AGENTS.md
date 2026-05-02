# LeakGuard Agent Guide

## Purpose
LeakGuard is a local-only browser extension that detects and redacts likely secrets and sensitive public IPv4 data before text reaches AI chat sites. It preserves URL/text shape with placeholders such as `[PWM_1]`, `[NET_1]`, and `[PUB_HOST_1]`.

## Current Focus
- v1.3.0 hardens deterministic redaction for trust-aware placeholders, sensitive HTTP headers, URL credentials, and natural-language/labelled secret disclosures.
- Sensitive HTTP header names and separators must remain visible while values are redacted as full intended ranges. Examples: `Authorization: Bearer [PWM_N]`, `X-API-Key: [PWM_N]`, `Cookie: sessionid=[PWM_N]`.
- Known raw secret reuse must win over suffix-only entropy or natural-language findings so repeated secrets reuse the same placeholder and never leave raw prefixes such as `ApiKey[PWM_N]`.

## First Reads
- `docs/REPO_MAP.md`: exact file responsibilities and test ownership.
- `docs/BUG_PLAYBOOK.md`: likely bug locations and narrow validation commands.
- `docs/CODEX_PROMPT_TEMPLATES.md`: compact prompts for common future Codex tasks.
- `docs/CODEX_CHANGELOG.md`: short handoff log for AI-made changes.
- `package.json` and `scripts/run-tests.mjs`: npm commands and full-suite order.

## Commands
- Prepare local AI/build assets: `npm run prepare:build`
- Full tests: `npm test`
- Build all targets: `npm run build` or `npm run build:all`
- Build one target: `npm run build:chrome`, `npm run build:chrome-enterprise`, `npm run build:firefox`, `npm run build:firefox-enterprise`
- Run one test file: `node tests/<file>.test.js`
- Export icons: `npm run icons:export`

## Code Rules
- Keep fixes narrow. Prefer local helpers over broad rewrites.
- Preserve local-only behavior: no remote secret processing, backend calls, telemetry, analytics, tracking, or cloud verification.
- Preserve placeholder stability, reuse, ordering, and clean placeholder pass-through.
- Redactor replacements must remain right-to-left safe.
- Prefer full intended value ranges over contained suffix findings, especially for headers, URL credentials, and known repeated secrets.
- Existing trusted placeholders must be preserved; unknown placeholders in sensitive contexts are candidates.
- Raw secrets must not persist in local storage, DOM, logs, exports, or audit records.
- Add focused regression tests for detector, redactor, composer, policy, or build changes.
- Preserve Chrome and Firefox compatibility. Check `src/compat/browser_api.js`, `src/compat/platform.js`, and `manifests/*.json` when touching browser APIs or manifests.
- Keep extension UI compatible with MV3 CSP. Do not add inline JavaScript to HTML files.
- Keep generated `dist/` output out of code patches unless explicitly requested.

## Strict Constraints
- Do not add backend calls, telemetry, tracking, or cloud secret processing.
- Do not weaken CSP, protected-site validation, enterprise fail-closed behavior, or secure reveal boundaries.
- Do not rewrite `PlaceholderManager`, `Redactor`, or detector scoring globally without a clear bug requiring it.
- Do not collapse structured URL credentials into one placeholder when username/password can be redacted separately.
- Do not claim enterprise-grade status in docs or UI unless QA explicitly approves it.
- Do not edit `node_modules/`, `dist/`, or model artifacts unless the task is build/model related.

## Output Format
Final Codex responses for repo work must use these headings:
- Summary
- Files changed
- Tests run
- Risks/follow-up
