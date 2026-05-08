---
name: leakguard-playbook-promoter
description: Use after a LeakGuard bug or workflow issue is solved to convert the final fix into a compact reusable playbook and update docs/codex-playbooks/INDEX.md. Trigger for phrases like "promote this fix", "save as playbook", "make this reproducible", "avoid solving this again", or "update local automation memory".
---

# LeakGuard Playbook Promoter

Use this skill after a LeakGuard bug or workflow issue is solved and the user wants the fix saved as reusable local automation memory.

## Workflow

1. Identify the problem fingerprint.
2. Summarize the root cause.
3. List files changed.
4. Capture the final fix strategy.
5. Capture commands and tests run.
6. Define verification steps.
7. Define rollback.
8. Define future trigger keywords.
9. Write or update one markdown playbook under `docs/codex-playbooks/`.
10. Update `docs/codex-playbooks/INDEX.md` with a compact route entry.

## Rules

- Keep playbooks short and operational.
- Do not include secrets, tokens, private data, full transcripts, or full logs.
- Do not include unrelated conversation history.
- Prefer reproducible steps over narrative.
- If the solution is not verified yet, mark playbook status as draft.
- Keep entries scoped to recurring issues likely to save future context.
- Do not change extension runtime behavior while promoting a playbook unless the user explicitly asks for a code fix too.

## Playbook Shape

Use this structure unless a tighter existing playbook pattern applies:

```markdown
# Playbook: <name>

## Problem fingerprint
## Expected behavior
## Likely root cause
## Safe implementation direction
## Files likely involved
## Verification
## Regression tests
## Rollback
## Notes
```
