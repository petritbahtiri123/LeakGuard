# LeakGuard Codex Fast Context

Use this as the smallest current context for routine Codex tasks. Escalate to `docs/REPO_MAP.md`, `docs/BUG_PLAYBOOK.md`, or deeper docs only when the task crosses modules or the narrow path fails.

## Project
LeakGuard is a local-only browser extension that redacts likely secrets, sensitive identity data, and public IPv4/network details before supported prompts or files reach protected AI/chat composers.

Core placeholders:
- `[PWM_1]`
- `[NET_1]`
- `[PUB_HOST_1]`

## Non-Negotiable Rules
- No backend calls, telemetry, analytics, tracking, cloud verification, remote model calls, or remote secret processing.
- Preserve placeholder stability, reuse, ordering, trusted-placeholder pass-through, and right-to-left redaction safety.
- Trusted `[PWM_N]` placeholders must pass through and must never be re-redacted.
- Raw secrets must not persist in storage, DOM, logs, exports, reports, audit records, or debug output.
- Debug output is metadata-only: lengths, counts, booleans, safe reason codes, placeholder counts, stages, and categories.
- Unsupported or unsafe protected file flows fail closed. After LeakGuard consumes or sanitizes a file, do not allow raw fallback upload.
- Preserve Chrome/Firefox MV3 compatibility and no inline JavaScript.
- Do not edit `dist/`, `node_modules/`, `ai/models/`, generated artifacts, or `package-lock.json` unless explicitly required.

## Before Changing Code
1. Check module ownership below or in `docs/REPO_MAP.md`.
2. Check runtime script order impact when adding/moving/removing runtime files.
3. Add focused tests before behavior changes.
4. Preserve fail-closed behavior.
5. Preserve regex/provider -> entropy/context -> Onix -> redaction policy.
6. Run focused tests first; run `npm test` when practical or when behavior crosses modules.

## Current Lifecycle
```text
regex/provider deterministic rules
  -> entropy/context fallback
  -> Onix gray-zone classifier
  -> final redaction policy
```

- Regex/provider rules are first authority.
- Entropy is fallback only; do not lower global entropy controls to catch one missed secret.
- Onix runs after deterministic findings and candidate gating. It handles gray-zone leftover cases and cannot downgrade deterministic findings.
- Emails globally redact.
- Usernames remain context-aware unless product policy changes.

## Current Module Map
Shared detection:
- `src/shared/detector.js`: deterministic orchestrator, overlap resolution, trusted placeholder handling, labelled/natural-language ranges, email redaction, entropy fallback call.
- `src/shared/entropy.js`: entropy scoring helpers used by fallback and candidate scoring.
- `src/shared/patterns.js`: regexes, keyword lists, deterministic provider registry, suppressions, dataset categories.
- `src/shared/aiCandidateGate.js`: leftover candidate extraction for Onix; skips deterministic ranges and clean placeholders.
- `src/shared/detection/*`: provider, enterprise, header, URL userinfo, structured metadata, and context helper modules.
- `src/shared/runtime_scripts.js`: canonical content/background runtime script order.

Content/runtime:
- `src/content/content.js`: final content orchestration script. Keep it as wiring/coordinator, not a dumping ground.
- `src/content/files/*`: focused file extraction, transfer policy, session cache, OCR broker, attach pipeline, and pending sanitized handoff helpers.
- `src/content/file_handoff_*.js`: shared handoff state, flow, and pending handoff helpers.
- `src/content/adapters/*`: site-specific adapter contracts and host matching.
- `src/content/diagnostics/contentDebugFacade.js`: content debug API that routes through safe metadata.
- `src/content/diagnostics/debugLogger.js`: raw-safe debug sanitizer.
- `src/content/diagnostics/safeSnapshots.js`: safe snapshot/download-name helpers; do not use it to log raw names or paths.
- `src/content/bootstrap/eventBindings.js`: bootstrap event binding helpers.

Background:
- `src/background/core.js`: final background orchestration script and message handling.
- `src/background/protectedSiteRegistry.js`: protected-site registry and dynamic content script registration.
- `src/background/auditLog.js`: metadata-only audit summaries.

AI/Onix:
- `ai/scripts/generate_dataset.py`: deterministic synthetic dataset generation, 50,000 default records.
- `ai/scripts/evaluate_model.py`: independent synthetic plus held-out real-sanitized evaluation.
- `ai/scripts/features.py`: feature extraction for training/evaluation.
- `ai/dataset/generated/*`: generated/labeled training pool output.
- `ai/dataset/test/*`: held-out eval packs only; do not copy exact holdout text into training.
- `ai/models/*`: generated model artifacts; do not touch unless explicitly requested.

## Runtime Script Order
- Dependencies must load before consumers.
- Keep `src/shared/runtime_scripts.js`, `manifests/base.json`, `manifests/firefox.json`, and `src/background/service_worker.js` aligned.
- New runtime modules must be added to all required static and dynamic lists.
- `src/content/content.js` stays last in content scripts.
- `src/background/core.js` stays last in background scripts.
- Guard tests: `node tests/runtime_script_order.test.js`, `node tests/runtime_script_order_contract.test.js`, `node tests/build_targets.test.js`, `node tests/security.test.js`.

## Playbook Router
- Secret missed: `docs/codex-playbooks/detector-bug.md`
- Safe text over-redacted: `docs/codex-playbooks/false-positive.md`
- File handling or fail-closed issue: `docs/codex-playbooks/file-handoff-fail-closed.md`
- Diagnostics/debugging change: `docs/codex-playbooks/debug-safety.md`
- Onix dataset, training, or eval change: `docs/codex-playbooks/onix-training-eval.md`
- Browser QA failure: `docs/codex-playbooks/browser-qa.md`
- Release build protected file-input handoff failure: `docs/codex-playbooks/release-build-file-input-handoff.md`
- Allow Once popup loop: `docs/codex-playbooks/allow-once-popup-loop.md`
- Gemini drag/drop issue: `docs/codex-playbooks/gemini-drag-drop-file-ingestion.md`
- Firefox Add-ons submission: `docs/codex-playbooks/firefox-addon-submission.md`

## Focused Commands
Core:
- `npm test`
- `npm run docs:check-links`
- `npm run smoke:chrome`
- `npm run smoke:firefox`
- `npm run test:browser-gates`
- `npm run qa:browser:full`
- `npm run test:nightly`
- `git diff --check`

Focused:
- `node tests/runtime_script_order.test.js`
- `node tests/runtime_script_order_contract.test.js`
- `node tests/security.test.js`
- `node tests/detector.test.js`
- `node tests/adversarial_redaction.test.js`
- `node tests/natural_language_context.test.js`
- `node tests/ai_candidate_gate.test.js`
- `node tests/onix_dataset.test.js`
- `node tests/file_scanner.test.js`
- `node tests/file_extractors.test.js`
- `node tests/content_file_drop_interception.test.js`
- `node tests/typed_interception.test.js`
- `node tests/protected_sites.test.js`
- `node tests/build_targets.test.js`

AI:
- `npm run prepare:build`
- `ai\.venv\Scripts\python.exe ai\scripts\evaluate_model.py`
- `ai\.venv\Scripts\python.exe -m py_compile ai\scripts\generate_dataset.py ai\scripts\evaluate_model.py ai\scripts\features.py`

JS syntax:
- `node --check <touched-js-file>`
