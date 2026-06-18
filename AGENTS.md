# LeakGuard Agent Guide

## Purpose
LeakGuard is a local-only browser extension that detects and redacts likely secrets, sensitive identity data, and public IPv4/network details before supported text or files reach protected AI/chat composers. It preserves shape with placeholders such as `[PWM_1]`, `[NET_1]`, and `[PUB_HOST_1]`.

## Context Budget
Act as a cost-aware coding agent. Start with the smallest viable context and escalate only when the narrow path is unclear or fails.

- FAST: read `docs/CODEX_FAST_CONTEXT.md`, directly relevant source files, and directly relevant tests.
- STANDARD: also read `docs/REPO_MAP.md` and `docs/BUG_PLAYBOOK.md` for cross-module behavior.
- DEEP: use only for release, privacy, architecture, store listing, enterprise claims, or public documentation alignment. Then read `deep-research-report.md`, `PRIVACY_POLICY.md`, README/store docs, and relevant source.

Do not scan the whole repo unless the task requires it. Do not read long architecture or research docs by default.

## Before Codex Starts
Before changing code, Codex must:

1. Read `AGENTS.md` or `docs/AI_ASSIST.md` when the task touches agent or AI context.
2. Check current module ownership in `docs/REPO_MAP.md` or the nearest relevant source file.
3. Check runtime script order impact before adding, moving, or removing runtime files.
4. Add focused tests before behavior changes.
5. Preserve fail-closed behavior for unsafe protected-site flows.
6. Preserve detection order: regex/provider deterministic rules, then entropy/context fallback, then Onix gray-zone classification, then final redaction policy.
7. Preserve metadata-only debug output.
8. Run focused tests first, then `npm test` when practical or when behavior crosses modules.
9. Report changed files, tests run, risks, and follow-up.

## Detection Lifecycle
Current redaction flow:

```text
regex/provider deterministic rules
  -> entropy/context fallback
  -> Onix gray-zone classifier
  -> final redaction policy
```

- Regex/provider rules are the first authority. Sensitive headers, URL credentials, provider keys, cloud/provider identifiers, structured metadata, natural-language disclosures, and known raw secret reuse must be handled deterministically when possible.
- Entropy is a fallback for suspicious leftover values, not a global aggressive detector.
- Onix runs only after deterministic findings and candidate gating. It handles gray-zone cases and cannot downgrade deterministic findings.
- Emails globally redact. Usernames remain context-aware unless product policy changes.
- Trusted `[PWM_N]` placeholders must pass through and must never be re-redacted.
- Unsupported or unsafe protected file flows must fail closed. After LeakGuard consumes or sanitizes a file, there is no raw fallback upload.
- Debug output must be metadata-only: lengths, counts, booleans, safe reason codes, placeholder counts, stages, and sanitized categories only.

## First Reads
- `docs/CODEX_FAST_CONTEXT.md`: compact current lifecycle, module map, commands, and playbook router.
- `docs/CODEX_CONTEXT_ROUTER.md`: FAST/STANDARD/DEEP routing.
- `docs/REPO_MAP.md`: current module ownership and test ownership.
- `docs/BUG_PLAYBOOK.md`: common bug routing and narrow validation commands.
- `docs/codex-playbooks/INDEX.md`: reusable playbooks for detector, false-positive, file handoff, debug, Onix, browser QA, and submission issues.
- `package.json` and `scripts/run-tests.mjs`: npm commands and full-suite order.

## Code Rules
- Keep fixes narrow. Prefer local helpers over broad rewrites.
- Preserve local-only behavior: no backend calls, telemetry, analytics, tracking, cloud secret verification, remote model calls, or remote secret processing.
- Preserve placeholder stability, reuse, ordering, trusted-placeholder pass-through, and right-to-left redaction safety.
- Prefer full intended value ranges over contained suffix findings, especially for headers, URL credentials, and known repeated secrets.
- Existing trusted placeholders must be preserved; unknown placeholders in sensitive contexts are candidates.
- Raw secrets must not persist in local storage, DOM, logs, exports, reports, audit records, or debug output.
- Preserve Chrome and Firefox MV3 compatibility. Check `src/compat/browser_api.js`, `src/compat/platform.js`, `src/shared/runtime_scripts.js`, `manifests/*.json`, and `src/background/service_worker.js` when touching runtime loading.
- Keep extension UI compatible with MV3 CSP. Do not add inline JavaScript.
- Do not edit `dist/`, `node_modules/`, `ai/models/`, generated artifacts, or `package-lock.json` unless explicitly required.

## Runtime Order Rules
- Dependencies must load before consumers.
- Keep `src/shared/runtime_scripts.js`, `manifests/base.json`, `manifests/firefox.json`, and `src/background/service_worker.js` aligned.
- New runtime modules must be added to every required static and dynamic script list.
- `src/content/content.js` must remain the final content orchestration script.
- `src/background/core.js` must remain the final background orchestration script.
- Guard tests: `node tests/runtime_script_order.test.js`, `node tests/runtime_script_order_contract.test.js`, `node tests/build_targets.test.js`, and `node tests/security.test.js`.

## Commands
- Prepare local AI/build assets: `npm run prepare:build`
- Full tests: `npm test`
- Docs links: `npm run docs:check-links`
- Browser smoke: `npm run smoke:chrome`, `npm run smoke:firefox`
- Build all targets: `npm run build` or `npm run build:all`
- Build one target: `npm run build:chrome`, `npm run build:chrome-enterprise`, `npm run build:firefox`, `npm run build:firefox-enterprise`
- Run one test file: `node tests/<file>.test.js`
- JS syntax on touched JS files: `node --check <file>`
- Whitespace check: `git diff --check`

## Strict Constraints
- Do not weaken CSP, protected-site validation, enterprise fail-closed behavior, secure reveal boundaries, or runtime script-order guards.
- Do not change detector thresholds, retrain Onix, or touch model artifacts unless the user explicitly requests that work.
- Do not collapse structured URL credentials into one placeholder when username/password can be redacted separately.
- Do not claim enterprise-grade status in docs or UI unless QA explicitly approves it.

## Output Format
Final Codex responses for repo work must use these headings:
- Summary
- Files changed
- Tests run
- Risks/follow-up
