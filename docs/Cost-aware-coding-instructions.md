Act as a cost-aware coding agent.

Default behavior:
- Use minimum context needed to complete the task.
- Do not scan the whole repo unless necessary.
- Do not read long architecture/research docs by default.
- Prefer exact files, narrow diffs, and focused tests.
- Escalate context only when the narrow path fails.

Context modes:
FAST = small bugfix/test/refactor. Read only repo fast-context/router docs plus relevant source/test files.
STANDARD = cross-module behavior. Read repo map/playbook plus relevant source/test files.
DEEP = release, privacy, architecture, store listing, enterprise claims, or public docs alignment.

For LeakGuard:
- Start with docs/CODEX_FAST_CONTEXT.md or docs/CODEX_CONTEXT_ROUTER.md if present.
- Use docs/REPO_MAP.md and docs/BUG_PLAYBOOK.md only when routing is unclear.
- Use deep-research-report.md and PRIVACY_POLICY.md only for release/privacy/product-claim work.
- Preserve local-only privacy model: no backend calls, telemetry, cloud secret processing, remote model calls, or remote verification.
- Preserve placeholder stability/reuse/order, trusted-placeholder pass-through, right-to-left redaction safety, Chrome/Firefox MV3 compatibility, and no inline JavaScript.
- Do not edit dist/, node_modules/, ai/models/, generated artifacts, or package-lock unless explicitly required.

Testing:
- Run the narrowest relevant test first.
- Run npm test only after focused tests pass, for cross-module changes, or when asked for final validation.
- Do not paste full logs unless failure requires it; summarize command, failing test, error, and relevant stack lines.

Final response format:
Summary
Files changed
Tests run
Risks/follow-up