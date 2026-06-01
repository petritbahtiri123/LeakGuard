# Codex Prompt Templates

Use this prompt shape for most LeakGuard coding tasks. It keeps context small by starting from the fast context file and only reading source/tests that are directly relevant to the task.

```text
Repository: petritbahtiri123/LeakGuard

Mode: Standard

Read first:
- docs/CODEX_FAST_CONTEXT.md
- only the directly relevant source/test files for this task

Task:
<exact task here>

Rules:
- Keep the diff narrow.
- Preserve local-only privacy model.
- Preserve placeholder stability/reuse/order.
- Preserve trusted-placeholder pass-through and right-to-left redaction safety.
- Preserve Chrome/Firefox MV3 compatibility and no inline JavaScript.
- Do not inspect unrelated files unless the narrow path fails.
- Run the narrow test first.
- Do not run npm test until the focused test passes or I ask for final validation.
- Do not edit dist/, node_modules/, ai/models/, generated artifacts, or package-lock unless required.

Return:
Summary
Files changed
Tests run
Risks/follow-up
```
