# LeakGuard Codex Memory

Do not inject full transcripts, full logs, or all playbooks into Codex context. This system saves tokens by routing to compact indexes and loading full details only when needed.

## Purpose

LeakGuard keeps a repo-local Codex memory system for recurring bug and workflow patterns. The goal is reproducibility without dumping large transcripts into context.

## How Hooks Save Tokens

- `SessionStart` reads only `docs/codex-playbooks/INDEX.md` and caps injected context at 2000 characters.
- `UserPromptSubmit` scores known issue patterns and injects only short playbook pointers, capped at 1200 characters.
- `PostToolUse` writes compact reproducibility metadata to `docs/codex-runs/` and does not inject command output back into context.

Hooks are enabled by `.codex/config.toml`:

```toml
[features]
codex_hooks = true
```

Hook wiring lives in `.codex/hooks.json`.

## How Playbooks Work

Playbooks live under `docs/codex-playbooks/`. `INDEX.md` is the routing surface. Full playbooks are read only when the current prompt matches a known recurring issue.

Each playbook should be short, practical, and focused on:

- problem fingerprint
- expected behavior
- likely root cause
- safe implementation direction
- files likely involved
- verification and regression tests
- rollback

## Promoting a Solved Issue

Use the repo-local skill:

```text
Use leakguard-playbook-promoter to save this as a reusable playbook
```

The skill converts a verified fix into one compact playbook and updates `docs/codex-playbooks/INDEX.md`. If a fix is not verified, mark the playbook as draft.

## Disabling Hooks

Set hooks off in a higher-precedence user or session Codex config, or change the repo config locally:

```toml
[features]
codex_hooks = false
```

You can also temporarily move or edit `.codex/hooks.json`, but avoid committing unrelated local disablement unless that is the intended repo change.

## Safety Rules

- Do not add secrets, tokens, private data, raw secret samples, or transcripts to playbooks.
- Do not print full logs from hooks.
- Keep hook `additionalContext` hard-capped.
- Hooks must fail open unless an explicit security policy requires blocking.
- Keep scripts simple and dependency-free.
- Use git-root or script-relative paths so Codex can start from subdirectories.
- Do not change extension runtime behavior for memory-only updates.

## What Not To Do

- Do not load all playbooks at startup.
- Do not copy `docs/codex-runs/` content into prompts.
- Do not store raw command output beyond compact previews.
- Do not route broad categories that cause noisy false matches.
- Do not add remote services, telemetry, or cloud processing.

## Validation

Run:

```bash
npm run validate:codex-memory
```

This checks required files and parses `.codex/hooks.json`.
