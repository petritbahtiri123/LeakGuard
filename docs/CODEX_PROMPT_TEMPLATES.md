# Codex Prompt Template

Most tasks need only this shape:

```text
Mode: FAST
Read: docs/CODEX_FAST_CONTEXT.md and directly relevant source/tests only.
Task: <exact outcome>
Constraints: keep the diff narrow and preserve AGENTS.md security invariants.
Validation: run the focused test, then npm run test:changed. Escalate via docs/CODEX_CONTEXT_ROUTER.md.
Return: Summary; Files changed; Tests run; Risks/follow-up.
```

Use STANDARD or DEEP only when `docs/CODEX_CONTEXT_ROUTER.md` requires it. Do not paste repository maps, playbooks, transcripts, or full logs into a task prompt; point to the owning file instead.
