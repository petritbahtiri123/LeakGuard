# LeakGuard Codex Memory

LeakGuard uses one optional prompt-time hook to point at reusable playbooks without injecting their bodies or persisting task data.

## Active behavior

- `.codex/config.toml` enables `[features] hooks = true`.
- `.codex/hooks.json` configures only `UserPromptSubmit`.
- `.codex/hooks/user_prompt_playbook_router.cjs` requires a route-specific failure fingerprint, returns at most one playbook pointer, and caps added context at 600 characters.
- The hook is dependency-free, fails open, and does not store prompts, tool input, output, logs, or secrets.

There is no session-start context injection and no post-tool reproduction capture. Agents load `docs/codex-playbooks/INDEX.md` or a full playbook only when the current task requires it.

## Adding a route

Prefer improving the index or using the `leakguard-playbook-promoter` skill after a verified recurring fix. Add automatic routing only for a narrow fingerprint with:

- a product/surface identifier;
- an action or object;
- explicit failure language.

Generic keyword pairs are too noisy. Tests must include a true match and an incidental-background non-match.

## Safety

- Never persist prompts, transcripts, raw command output, clipboard data, filenames, paths, or secrets.
- Inject only a short pointer, never a full playbook.
- Hooks fail open and must not block legitimate work.
- Do not add services, telemetry, analytics, or remote processing.

## Validation

```powershell
node tests/codex_hooks.test.mjs
npm run validate:codex-memory
```
