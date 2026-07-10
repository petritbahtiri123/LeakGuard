# Codex Context and Validation Router

Start FAST. Escalate only when scope or evidence requires it.

## Context modes

### FAST

For a focused bug, test, refactor, or internal documentation change, read:

- `docs/CODEX_FAST_CONTEXT.md`;
- directly relevant source and tests;
- one matching playbook when applicable.

### STANDARD

For cross-module behavior, runtime loading, policy, protected-site file handoff, AI assist, builds, or diagnostics, also read:

- `docs/REPO_MAP.md`;
- `docs/BUG_PLAYBOOK.md`;
- the relevant architecture or playbook file.

### DEEP

Only for release, privacy, public architecture, store listings, enterprise claims, or product-scope alignment, also read the relevant subset of:

- `deep-research-report.md`;
- `PRIVACY_POLICY.md`;
- `README.md`;
- `docs/NON_GOALS.md`;
- `docs/AI_ASSIST.md`;
- release/store documentation.

Do not load all DEEP documents when only one claim surface is involved.

## Validation ladder

| Change | First validation | Escalation |
|---|---|---|
| Agent hooks/config | hook test, memory validator, syntax | docs links if guidance changed |
| Documentation only | `npm run docs:check-links` | DEEP claim review only for public/release/privacy text |
| Known single module | owned focused test, `npm run test:changed` | `npm test` if shared behavior or evidence is uncertain |
| Detector/redaction | detector or break-pack test | adversarial tests, then `npm test` for shared behavior |
| File/composer/policy | owned tests | `npm test` when flow crosses modules or security boundaries |
| Runtime/manifest/CSP/build | runtime-order, build-target, security guards | `npm test`, then relevant browser build/smoke |
| Dependency or unknown code | `npm test` | build/browser gates as affected |
| Release candidate | documented release gates on a clean worktree | browser/nightly matrix and artifact validation |

`npm run test:changed` is a local selector, not a CI replacement. Full CI, browser, nightly, and release commands remain authoritative at their boundaries.

## Full-suite triggers

Run `npm test` when any of these apply:

- behavior spans multiple owners;
- shared security, redaction, policy, runtime loading, build, or dependency files changed;
- a changed code path is unknown to the selector;
- focused tests fail outside the intended assertion;
- the task requests final or release-grade validation.

Do not run full suites merely because a Markdown file, isolated hook, or known focused test changed.

## Playbook routing

Use `docs/codex-playbooks/INDEX.md` as the index. Read the full playbook only when the current task—not quoted background—matches its fingerprint. Verify present source/DOM evidence before applying old fixes.
