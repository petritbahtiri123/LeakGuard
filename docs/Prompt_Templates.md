
## Replace your default Codex prompt with this

Your current `CODEX_PROMPT_TEMPLATES.md` tells Codex to read `AGENTS.md`, `REPO_MAP.md`, `BUG_PLAYBOOK.md`, `package.json`, and `scripts/run-tests.mjs` before editing. That is safe but expensive. :contentReference[oaicite:4]{index=4}

Use this instead:

```text
Repository: petritbahtiri123/LeakGuard

Mode: FAST

Read first:
- docs/CODEX_FAST_CONTEXT.md
- only the directly relevant source/test files for this task

Task:
<exact task here>

Rules:
- Keep the diff narrow.
- Preserve local-only privacy model.
- Preserve placeholder stability/reuse/order.
- Do not inspect unrelated files unless the narrow path fails.
- Run the narrow test first.
- Do not run npm test until the focused test passes or I ask for final validation.
- Do not edit dist/, node_modules/, ai/models/, generated artifacts, or package-lock unless required.

Return:
Summary
Files changed
Tests run
Risks/follow-up