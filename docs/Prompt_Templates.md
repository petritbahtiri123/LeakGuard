# Prompt Templates

## Bug Fix
```text
Fix <bug> in LeakGuard.
Read first: docs/REPO_MAP.md, docs/BUG_PLAYBOOK.md, <likely files>.
Requirements:
- preserve placeholder behavior and local-only privacy model
- keep change narrow
- add regression tests for <case>
- run node tests/<area>.test.js and npm test
Return: changed files, summary, test result.
```

## Feature Addition
```text
Add <feature> to LeakGuard.
Read first: docs/REPO_MAP.md, relevant source and tests.
Constraints:
- no backend/telemetry/cloud processing
- preserve secure reveal and session-only raw secret storage
- follow existing UI/module patterns
- add focused tests and update docs only if behavior changes
Return: implementation summary and verification.
```

## Refactor
```text
Refactor <area> without changing behavior.
Read first: docs/REPO_MAP.md and tests covering <area>.
Rules:
- no broad rewrites outside <scope>
- preserve public APIs, placeholder semantics, and manifest load order
- keep diffs mechanical and reviewable
- prove behavior with existing tests
Return: rationale, files changed, tests run.
```

## Test Creation
```text
Add tests for <behavior/regression>.
Read first: docs/BUG_PLAYBOOK.md and nearest existing test file.
Rules:
- use synthetic secrets only
- assert both expected placeholders and forbidden raw leaks
- include safe-value controls when false positives are possible
- run the focused test and npm test if code changes
Return: tests added and result.
```
