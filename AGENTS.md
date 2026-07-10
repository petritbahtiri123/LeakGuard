# LeakGuard Agent Guide

## Start Small

Use the minimum context needed. Start in FAST mode with `docs/CODEX_FAST_CONTEXT.md` and directly relevant source/tests. Use `docs/CODEX_CONTEXT_ROUTER.md` to escalate:

- STANDARD for cross-module runtime, policy, file handoff, AI-assist, or build behavior.
- DEEP only for release, privacy, architecture, store, enterprise, or public product claims.

Do not scan the repository, reread documents, or load long research/history by default. Check the nearest source owner or `docs/REPO_MAP.md` only when FAST context does not resolve ownership. Read one matching playbook, not the whole playbook directory.

## Security Invariants

- Processing stays local: no backend secret handling, telemetry, analytics, cloud verification, remote models, or raw-data network calls.
- Raw secrets must not persist in storage, DOM, logs, exports, reports, audit records, debug output, filenames, or exceptions.
- Unsafe protected-site flows fail closed. Never replay a raw file after LeakGuard consumes or sanitizes it.
- Normal protected send, paste, drop, or attach flow must complete from one user action; do not add duplicate-action fallbacks.
- Preserve detection order: deterministic rules, entropy/context fallback, Onix gray-zone classification, final redaction policy.
- Preserve placeholder stability, reuse, ordering, trusted-placeholder pass-through, and right-to-left redaction safety.
- Diagnostics remain metadata-only. Preserve consumer/enterprise policy, Chrome/Firefox MV3 compatibility, CSP, and runtime script order.
- Do not weaken protected-site validation, secure reveal boundaries, detector thresholds, or enterprise fail-closed behavior.

## Change Discipline

- Keep patches narrow. Add a focused failing test before behavior changes. Avoid unrelated refactors, new dependencies, speculative abstractions, or configuration flags.
- Check runtime order before adding, moving, or removing runtime files. Keep `src/content/content.js` and `src/background/core.js` last in their respective lists.
- Do not edit `dist/`, `node_modules/`, `ai/models/`, generated artifacts, or `package-lock.json` unless explicitly required.
- Use synthetic secret fixtures only. Never place real secrets or private data in tests, prompts, or artifacts.
- Product runtime behavior must not change during agent-tooling or documentation cleanup.

## Progressive Validation

1. Run syntax checks and the narrowest owned test first.
2. Run `npm run test:changed` for routine local validation.
3. Run `npm test` when changes cross modules, touch shared security/policy/runtime/build/dependencies, change unknown code, or when focused evidence is insufficient.
4. Run browser, nightly, and release gates only at their documented boundaries or when the affected surface requires them.

Do not rerun unchanged commands without new evidence. Summarize failures instead of pasting full logs.

## Git Safety

- Run `git status --short` before editing. Preserve user-owned changes and unrelated work; never reset, clean, overwrite, stage, or commit them.
- Work on a feature branch. Do not push directly to `main` unless the user explicitly requests it.
- Release validation requires a clean worktree unless the user explicitly approves and documents an exception.
- Before committing, verify the staged scope and run `git diff --check`.

## Final Response

Use these headings:

- Summary
- Files changed
- Tests run
- Risks/follow-up

State skipped broad validation and the reason. Confirm whether runtime, manifest, permission, CSP, telemetry, network, policy, redaction, or model behavior changed.
