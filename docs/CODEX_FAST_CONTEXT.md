# LeakGuard Codex Fast Context

Use this file for normal Codex IDE tasks to reduce repeated context loading.

## Project

Repository: petritbahtiri123/LeakGuard

LeakGuard is a local-only browser extension that detects and redacts likely secrets and public IPv4 network details before text or supported text-file uploads reach protected AI/chat composers.

Core placeholder examples:
- `[PWM_1]`
- `[NET_1]`
- `[PUB_HOST_1]`

## Non-negotiable rules

- Preserve local-only processing.
- Do not add backend calls, telemetry, analytics, tracking, cloud secret verification, remote model calls, or remote secret processing.
- Preserve placeholder stability, reuse, ordering, trusted-placeholder pass-through, and right-to-left redaction safety.
- Raw secrets must not be persisted in local storage, DOM, logs, exports, reports, or audit records.
- Preserve Chrome/Firefox MV3 compatibility.
- Do not add inline JavaScript.
- Do not edit `dist/`, `node_modules/`, `ai/models/`, generated artifacts, or `package-lock.json` unless the task explicitly requires it.
- Keep changes narrow.
- Add focused regression tests for behavior changes.

## Fast routing

### Secret not detected
Inspect:
- `src/shared/patterns.js`
- `src/shared/detector.js`
- `tests/detector.test.js`

Run:
```bash
node tests/detector.test.js