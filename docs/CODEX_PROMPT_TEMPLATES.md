# Codex Prompt Templates

Use these compact prompts to reduce repeated context. Add task-specific details after the template.

## Shared Prefix
```text
Repository: petritbahtiri123/LeakGuard

Before editing:
- Read AGENTS.md, docs/REPO_MAP.md, docs/BUG_PLAYBOOK.md, package.json, and scripts/run-tests.mjs.
- Inspect the relevant source and tests before changing files.

Rules:
- Keep the change narrow and practical.
- Preserve local-only processing: no backend calls, telemetry, remote APIs, cloud secret verification, or remote secret processing.
- Preserve placeholder stability, reuse, ordering, trusted-placeholder pass-through, and right-to-left redactor safety.
- Preserve Chrome/Firefox MV3 compatibility and do not add inline JavaScript.
- Do not touch dist/, node_modules/, ai/models/, generated artifacts, or package-lock unless strictly required.
- Add focused regression tests for behavior changes.

Final output format:
Summary
Files changed
Tests run
Risks/follow-up
```

## Bugfix
```text
Task: Fix <bug summary>.

Reproduce/inspect:
- Start with docs/BUG_PLAYBOOK.md.
- Check <likely files>.
- Run the narrow test first: node tests/<area>.test.js

Acceptance:
- The bug is covered by a regression test.
- Existing safe/example/template suppression and placeholder reuse still pass.
- Run npm test unless this is docs-only.
```

## Redaction Rule
```text
Task: Add or refine deterministic redaction for <provider/value family>.

Likely files:
- src/shared/patterns.js
- src/shared/detector.js
- tests/detector.test.js
- tests/break_pack.test.js when redaction ranges or reuse matter

Rules:
- Prefer provider-specific deterministic patterns over broad generic rules.
- Require realistic token/value length and shape.
- Do not weaken safe/example/template suppression.
- Verify raw prefixes and suffixes do not remain beside [PWM_N].
```

## Feature
```text
Task: Implement <feature>.

Inspect:
- docs/REPO_MAP.md for the owning runtime/shared/UI files.
- Existing nearby tests and UI/CSP patterns.

Rules:
- Keep the first version minimal and local-only.
- Preserve Chrome/Firefox compatibility through src/compat/* and manifests/*.json.
- Add focused tests for the touched boundary.
- Do not claim enterprise-grade status unless QA explicitly approved it.
```

## Tests
```text
Task: Add or improve tests for <behavior>.

Inspect:
- scripts/run-tests.mjs for suite order.
- Existing tests near the behavior.

Rules:
- Prefer focused regression cases over large fixtures.
- Assert both positive behavior and false-positive suppression when relevant.
- For redaction, assert the raw value and raw tails are absent.
```

## Build Failure
```text
Task: Diagnose and fix build/test failure: <command/output>.

Inspect:
- package.json
- scripts/prepare-build.mjs
- scripts/build-extension.mjs
- scripts/build-all.mjs
- manifests/*.json
- tests/build_targets.test.js

Rules:
- Do not commit generated dist/ unless explicitly requested.
- Preserve all four build targets: chrome, chrome-enterprise, firefox, firefox-enterprise.
```

## PR Review
```text
Task: Review the current diff or PR.

Review stance:
- Lead with findings only: bugs, regressions, security/privacy risks, missing tests.
- Include file/line references.
- Check local-only behavior, raw-secret persistence, placeholder reuse, CSP, and Chrome/Firefox compatibility.
- If no issues are found, say so and note residual test gaps.
```

## Docs
```text
Task: Update docs for <topic>.

Rules:
- Docs-only change.
- Keep concise and practical.
- Do not invent features or make enterprise-grade claims.
- Include exact paths and package.json commands when useful.
- Update docs/CODEX_CHANGELOG.md if this is a Codex handoff-worthy change.
```

## Release Prep
```text
Task: Prepare release notes/checklist for <version>.

Inspect:
- package.json
- docs/CODEX_CHANGELOG.md
- docs/RELEASE_QA_CHECKLIST.md
- docs/CHROME_WEB_STORE_LISTING.md
- docs/BUILD_TARGETS.md

Rules:
- Do not build or modify dist/ unless requested.
- State tests/build commands run.
- Do not claim enterprise-grade status unless QA explicitly approved it.
```
