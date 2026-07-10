# Codex Cost Optimization Design

## Goal

Reduce routine Codex context, hook, and validation cost without weakening LeakGuard's security invariants or release gates. This work changes repository guidance and agent tooling only; it does not change extension runtime behavior.

## Evidence

- `AGENTS.md`, `docs/CODEX_FAST_CONTEXT.md`, `docs/CODEX_CONTEXT_ROUTER.md`, `docs/REPO_MAP.md`, and `docs/BUG_PLAYBOOK.md` repeat many of the same invariants and commands.
- The session-start hook injects up to 2,000 characters on every session, even when no playbook is relevant.
- The prompt router matched Gemini drag/drop terms found only in referenced background conversation, forcing an unrelated playbook read.
- The post-tool hook created 28,066 ignored metadata files totaling about 7.4 MB.
- Three Python hook implementations duplicate the active dependency-free Node implementations and are not invoked by `.codex/hooks.json`.
- `.codex/config.toml` uses the current `hooks = true` feature, while the validator and memory documentation still require `codex_hooks = true`.
- `test:fast` runs `npm test` and then repeats productization, security, and build-target tests already present in `scripts/run-tests.mjs`.
- The repository has no change-aware local validation command.

## Design

### Guidance hierarchy

`AGENTS.md` will become the short mandatory policy surface. It will retain:

- FAST-first context loading and explicit STANDARD/DEEP escalation;
- local-only processing, no raw-data persistence, fail-closed protected flows, one-action send behavior, placeholder safety, metadata-only diagnostics, and runtime-order safety;
- preservation of user-owned changes and generated-file exclusions;
- focused tests first, change-aware validation for routine work, and full-suite escalation rules;
- clean release state and no direct pushes to `main` unless the user explicitly requests them;
- the required final response headings.

`docs/CODEX_FAST_CONTEXT.md` remains the compact operational map. `docs/CODEX_CONTEXT_ROUTER.md` owns context and validation routing. `docs/REPO_MAP.md`, `docs/BUG_PLAYBOOK.md`, playbooks, privacy documents, and release documents are loaded only when their routes apply. Repeated policy prose outside its owning document will be replaced with short references where doing so remains clear.

### Hooks and memory

Remove the session-start hook because it has a guaranteed context cost and duplicates the playbook index already referenced by the guidance hierarchy. Remove post-tool reproduction capture because it produces high-frequency ignored files without contributing to release evidence.

Keep one dependency-free Node `UserPromptSubmit` router. It will:

- require route-specific issue language rather than generic keyword pairs;
- return only the single strongest route;
- cap added context at 600 characters;
- provide a pointer and matched fingerprint, never the playbook body;
- fail open and never store prompt or tool data.

Delete the unused Python hook copies, capture script, and run-directory placeholder. Retain an ignore rule for legacy local capture JSON so existing user files do not flood Git status. Update the validator and memory documentation to describe only the active hook and current `hooks = true` feature.

### Progressive validation

Add a small dependency-free `scripts/run-changed-tests.mjs` command exposed as `npm run test:changed`. It will inspect an explicit base range when supplied and otherwise the working tree plus staged changes. Its mapping will be conservative and understandable:

- agent, hook, and Codex-memory changes run Codex-memory validation and relevant script syntax checks;
- documentation changes run link validation;
- known source areas select their owned focused tests;
- runtime-order, manifest, CSP, security, policy, shared orchestration, dependency, or unknown code changes escalate to `npm test` and the applicable guards;
- an empty diff exits successfully without running a suite.

The selector is a convenience for local agent validation, not a replacement for CI. `npm test`, browser gates, nightly gates, and release gates remain authoritative at their existing boundaries. `test:fast` will stop explicitly rerunning tests already included in `npm test`.

### Git safety

Agents must inspect `git status` before editing and preserve unrelated or user-owned changes. They must not clean, reset, overwrite, or commit unrelated work. Release validation requires a clean worktree unless the user explicitly approves a documented exception. Direct pushes to `main` remain prohibited unless explicitly requested.

The pre-existing `.codex/config.toml` edit is user-owned. Implementation may align surrounding validation and documentation with `hooks = true`, but must not discard the edit or restore the obsolete key.

## Verification

Validation will proceed from narrow to broad:

1. Syntax-check each changed Node script.
2. Run the Codex-memory validator and focused hook fixtures.
3. Exercise the changed-test selector against representative file lists or temporary Git ranges without modifying product files.
4. Run documentation link validation for changed guidance.
5. Run `git diff --check`.
6. Run broader tests only if implementation touches package/test orchestration in a way not covered by the focused checks or if the selector conservatively escalates.

No browser smoke, build, model preparation, or full release suite is required for a tooling-and-documentation-only patch unless evidence reveals runtime coupling.

## Rollback

Revert the governance commit(s). This restores the former hook wiring, duplicate scripts, documentation, and test commands. Because no extension runtime files or generated release artifacts are changed, rollback does not require a product build or data migration.

## Success criteria

- Routine sessions receive no unconditional playbook context.
- Incidental background references do not trigger unrelated playbooks.
- No per-tool metadata files are created.
- Guidance has one clear owner per rule and remains sufficient to preserve security behavior.
- Routine changes have a focused validation path; uncertain and high-risk changes still escalate.
- CI and release-quality gates remain available and authoritative.
- No product runtime, privacy, manifest, permission, CSP, model, or redaction behavior changes.
