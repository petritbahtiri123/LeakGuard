# Codex Cost Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make routine LeakGuard agent work cheaper by eliminating unconditional context and low-value hook work, consolidating instructions, and adding conservative change-aware validation.

**Architecture:** Keep one small prompt-time playbook router and one compact mandatory policy surface. Add a dependency-free selector that maps changed paths to focused commands and escalates uncertain or security-sensitive changes to the existing full suite; CI and release gates remain authoritative.

**Tech Stack:** Markdown, Node.js ESM/CommonJS, JSON, npm scripts, Git.

## Global Constraints

- Do not change product runtime behavior, manifests, permissions, CSP, redaction, policy, adapters, file processing, or model artifacts.
- Preserve local-only processing, fail-closed unsafe protected flows, no raw-data persistence, one-action send behavior, placeholder stability, metadata-only diagnostics, and runtime script order.
- Preserve the existing user-owned `.codex/config.toml` change and align tooling with `hooks = true`.
- Do not add dependencies or edit `package-lock.json`, `dist/`, `node_modules/`, `ai/models/`, or generated artifacts.
- Do not push directly to `main` unless explicitly requested.
- Keep full CI, browser, nightly, and release commands available and authoritative.

---

### Task 1: Make playbook routing precise and remove high-frequency hooks

**Files:**
- Create: `tests/codex_hooks.test.mjs`
- Modify: `.codex/hooks.json`
- Modify: `.codex/hooks/user_prompt_playbook_router.cjs`
- Modify: `scripts/validate-codex-memory.mjs`
- Delete: `.codex/hooks/session_start_playbook_index.cjs`
- Delete: `.codex/hooks/session_start_playbook_index.py`
- Delete: `.codex/hooks/user_prompt_playbook_router.py`
- Delete: `.codex/hooks/post_tool_repro_capture.cjs`
- Delete: `.codex/hooks/post_tool_repro_capture.py`
- Delete: `docs/codex-runs/.gitkeep`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: hook JSON on stdin with `prompt`, `user_prompt`, `input`, or string message content.
- Produces: `{continue:true}` or one `UserPromptSubmit` `additionalContext` string of at most 600 characters.

- [ ] **Step 1: Add failing hook behavior tests**

Create `tests/codex_hooks.test.mjs` using `spawnSync(process.execPath, [routerPath], { input: JSON.stringify(payload) })`. Cover these exact cases:

```js
const context = (payload) => runRouter(payload).hookSpecificOutput?.additionalContext;
assert.equal(context({ prompt: "Optimize agent hooks; prior notes mention Gemini drag and drop." }), undefined);
assert.match(context({ prompt: "Gemini file drop duplicates content in the editor" }), /gemini-drag-drop-file-ingestion\.md/);
assert.match(context({ prompt: "Allow Once popup reopens for the same finding" }), /allow-once-popup-loop\.md/);
assert.match(context({ prompt: "Firefox Add-ons rejects data_collection_permissions" }), /firefox-addon-submission\.md/);
assert.ok(JSON.stringify(runRouter({ prompt: "Gemini file drop freezes the editor" })).length < 900);
```

Also assert `.codex/hooks.json` contains only `UserPromptSubmit`, references only the CJS router, and has no `SessionStart` or `PostToolUse` entries.

- [ ] **Step 2: Run the hook tests and confirm failure**

Run: `node tests/codex_hooks.test.mjs`

Expected: FAIL because incidental Gemini keywords still route and obsolete hooks remain configured.

- [ ] **Step 3: Narrow the router and hook wiring**

Change the router to use route-specific `required` groups and issue terms. The route data must follow this shape:

```js
const ROUTES = [
  { name: "Allow Once popup loop", path: "docs/codex-playbooks/allow-once-popup-loop.md", required: [["allow once"], ["popup", "modal"], ["reopen", "loop", "same finding", "suppress"]] },
  { name: "Gemini drag/drop file ingestion", path: "docs/codex-playbooks/gemini-drag-drop-file-ingestion.md", required: [["gemini"], ["drag", "drop", "file ingestion"], ["fail", "freeze", "duplicate", "wrong place", "miss"]] },
  { name: "Firefox Add-ons submission", path: "docs/codex-playbooks/firefox-addon-submission.md", required: [["firefox"], ["addon", "add-ons"], ["reject", "submission", "source zip", "data_collection_permissions"]] }
];
```

A route matches only when every required group has a term match. Return the first strongest single match, cap at `MAX_CONTEXT_CHARS = 600`, and retain fail-open behavior. Rewrite `.codex/hooks.json` so it contains only the current `UserPromptSubmit` command.

- [ ] **Step 4: Remove unused capture and Python paths**

Delete the listed unused hook scripts and `docs/codex-runs/.gitkeep`. Remove the `.gitkeep` exception, but retain the JSON ignore rule so existing legacy local captures stay out of Git status:

```gitignore
!/docs/codex-runs/.gitkeep
```

Do not delete ignored local JSON files from the user's filesystem; they are local state and not required for the patch.

- [ ] **Step 5: Update memory validation**

Make `scripts/validate-codex-memory.mjs` require only:

```js
const requiredFiles = [
  ".codex/config.toml",
  ".codex/hooks.json",
  ".codex/hooks/user_prompt_playbook_router.cjs",
  "docs/codex-playbooks/INDEX.md",
  ".agents/skills/leakguard-playbook-promoter/SKILL.md"
];
```

Validate `hooks = true`, exactly one `UserPromptSubmit` event, no other hook event, a Node command referencing the active router, and `MAX_CONTEXT_CHARS = 600`. Remove run-directory scanning and capture-script checks.

- [ ] **Step 6: Run focused hook validation**

Run:

```powershell
node --check .codex/hooks/user_prompt_playbook_router.cjs
node --check scripts/validate-codex-memory.mjs
node tests/codex_hooks.test.mjs
npm run validate:codex-memory
```

Expected: all commands pass.

- [ ] **Step 7: Commit the hook cleanup**

```powershell
git add .codex/hooks.json .codex/hooks scripts/validate-codex-memory.mjs tests/codex_hooks.test.mjs .gitignore docs/codex-runs/.gitkeep
git commit -m "chore: reduce Codex hook overhead"
```

---

### Task 2: Add conservative change-aware validation

**Files:**
- Create: `scripts/run-changed-tests.mjs`
- Create: `tests/run_changed_tests.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `selectValidationCommands(files: string[]): string[]` for unit tests and CLI use.
- CLI: `node scripts/run-changed-tests.mjs [--base <git-ref>] [--files <comma-separated-paths>]`.

- [ ] **Step 1: Add failing selector tests**

Create table-driven tests for these mappings:

```js
[
  [["docs/guide.md"], ["npm run docs:check-links"]],
  [["AGENTS.md"], ["npm run validate:codex-memory", "npm run docs:check-links"]],
  [[".codex/hooks.json"], ["node tests/codex_hooks.test.mjs", "npm run validate:codex-memory"]],
  [["src/shared/detector.js"], ["node tests/detector.test.js"]],
  [["src/content/files/fileDropOrchestration.js"], ["node tests/content_file_drop_interception.test.js"]],
  [["src/shared/runtime_scripts.js"], ["npm test", "node tests/runtime_script_order.test.js", "node tests/runtime_script_order_contract.test.js", "node tests/build_targets.test.js", "node tests/security.test.js"]],
  [["package.json"], ["npm test"]],
  [["src/unknown/new-module.js"], ["npm test"]],
  [[], []]
]
```

Assert commands are deduplicated and preserve stable order.

- [ ] **Step 2: Run selector tests and confirm failure**

Run: `node tests/run_changed_tests.test.mjs`

Expected: FAIL because the selector module does not exist.

- [ ] **Step 3: Implement the explicit selector**

Export `selectValidationCommands`. Normalize backslashes to forward slashes. Use ordered rules for governance/docs, detector/detection, composer/input, files, diagnostics, policy, runtime/build/security, and tests. Any unmatched `src/`, `scripts/`, `tests/`, manifest, dependency, or root configuration path must add `npm test`.

The CLI file discovery order must be:

1. `--files` when present, for deterministic tests and manual use.
2. `git diff --name-only <base>...HEAD` plus working-tree and staged paths when `--base` is present.
3. `git diff --name-only`, `git diff --cached --name-only`, and untracked paths from `git ls-files --others --exclude-standard` otherwise.

Print the selected paths and commands, then run each command through `spawnSync` with inherited stdio. Exit on the first failure. Print `No changed files require validation.` for an empty selection.

- [ ] **Step 4: Add npm entry points and remove duplicate fast tests**

Add:

```json
"test:changed": "node scripts/run-changed-tests.mjs"
```

Change only:

```json
"test:fast": "npm test"
```

Keep `test:ci`, browser, nightly, and release scripts otherwise unchanged.

- [ ] **Step 5: Run selector validation**

Run:

```powershell
node --check scripts/run-changed-tests.mjs
node tests/run_changed_tests.test.mjs
node scripts/run-changed-tests.mjs --files docs/CODEX_MEMORY.md
node scripts/run-changed-tests.mjs --files src/shared/runtime_scripts.js
```

For the runtime-order example, use a dry-run environment switch implemented for tests (`LEAKGUARD_CHANGED_TESTS_DRY_RUN=1`) so the command list is verified without executing the full suite. Expected: focused docs validation for the first example and full-suite escalation plus guards for the second.

- [ ] **Step 6: Commit the selector**

```powershell
git add scripts/run-changed-tests.mjs tests/run_changed_tests.test.mjs package.json
git commit -m "test: add change-aware validation"
```

---

### Task 3: Consolidate repository guidance

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/CODEX_FAST_CONTEXT.md`
- Modify: `docs/CODEX_CONTEXT_ROUTER.md`
- Modify: `docs/CODEX_MEMORY.md`
- Modify: `docs/CODEX_PROMPT_TEMPLATES.md`
- Modify: `docs/BUG_PLAYBOOK.md`

**Interfaces:**
- `AGENTS.md`: mandatory policy and routing entry point.
- `CODEX_FAST_CONTEXT.md`: compact module and command map.
- `CODEX_CONTEXT_ROUTER.md`: escalation and validation matrix.
- Other files: details referenced only when relevant.

- [ ] **Step 1: Add governance assertions**

Extend `tests/codex_hooks.test.mjs` to assert that `AGENTS.md` contains all of these phrases or equivalent explicit rules:

```text
FAST
fail closed
one user action
raw secrets
git status
user-owned changes
test:changed
npm test
clean worktree
main
Summary
Files changed
Tests run
Risks/follow-up
```

Also assert `AGENTS.md` is at most 4,500 characters and does not duplicate the full runtime module map.

- [ ] **Step 2: Run governance tests and confirm failure**

Run: `node tests/codex_hooks.test.mjs`

Expected: FAIL because the current root guide exceeds the size cap and lacks explicit git/main/change-aware rules.

- [ ] **Step 3: Rewrite the root guide as the compact policy surface**

Organize `AGENTS.md` under these headings only:

```text
# LeakGuard Agent Guide
## Start Small
## Security Invariants
## Change Discipline
## Progressive Validation
## Git Safety
## Final Response
```

Keep mandatory rules concise. Point to the fast context and router instead of copying module maps, lifecycle explanation, playbook lists, and command catalogs.

- [ ] **Step 4: Assign one owner to repeated guidance**

Update the listed docs so:

- `CODEX_FAST_CONTEXT.md` owns the short lifecycle, module map, and common focused commands;
- `CODEX_CONTEXT_ROUTER.md` owns FAST/STANDARD/DEEP reads and full-suite escalation criteria;
- `CODEX_MEMORY.md` describes the single prompt router, current config key, 600-character cap, and no persistence;
- `CODEX_PROMPT_TEMPLATES.md` points to the router and `npm run test:changed` without copying all invariants;
- `BUG_PLAYBOOK.md` retains bug-routing detail but points to the context router for final validation policy.

Do not remove any security invariant unless it remains in `AGENTS.md` or its clearly linked owner.

- [ ] **Step 5: Validate guidance**

Run:

```powershell
node tests/codex_hooks.test.mjs
npm run validate:codex-memory
npm run docs:check-links
git diff --check
```

Expected: all commands pass.

- [ ] **Step 6: Commit the guidance consolidation**

```powershell
git add AGENTS.md docs/CODEX_FAST_CONTEXT.md docs/CODEX_CONTEXT_ROUTER.md docs/CODEX_MEMORY.md docs/CODEX_PROMPT_TEMPLATES.md docs/BUG_PLAYBOOK.md tests/codex_hooks.test.mjs
git commit -m "docs: consolidate cost-aware agent guidance"
```

---

### Task 4: Final verification and evidence

**Files:**
- No planned file changes.

**Interfaces:**
- Verifies the complete governance patch and confirms product runtime isolation.

- [ ] **Step 1: Run focused tooling checks**

```powershell
node --check .codex/hooks/user_prompt_playbook_router.cjs
node --check scripts/validate-codex-memory.mjs
node --check scripts/run-changed-tests.mjs
node tests/codex_hooks.test.mjs
node tests/run_changed_tests.test.mjs
npm run validate:codex-memory
npm run docs:check-links
```

Expected: all commands pass.

- [ ] **Step 2: Exercise the change-aware command on the actual patch**

Run: `npm run test:changed`

Expected: governance, hook, selector, and documentation checks run; no product build or model preparation is selected.

- [ ] **Step 3: Verify patch scope and whitespace**

```powershell
git diff --check HEAD~3..HEAD
git diff --name-only HEAD~3..HEAD
git status --short
```

Expected: only governance, hook, test-selection, test, package script, and specification/plan files appear. The pre-existing `.codex/config.toml` modification remains visible and uncommitted unless it was intentionally included with explicit confirmation.

- [ ] **Step 4: Record measured savings for handoff**

Report:

- removed unconditional context cap: 2,000 characters per session;
- reduced conditional router cap: 1,200 to 600 characters;
- removed per-tool file creation;
- deleted unused hook implementations;
- removed three repeated tests from every `test:fast` run;
- root guidance size before and after;
- exact commands run and whether broader suites were intentionally skipped.

- [ ] **Step 5: Final commit only if verification required adjustments**

If verification caused no edits, do not create an empty commit. If it required a narrow correction, stage only that correction and commit with:

```powershell
git commit -m "chore: finalize Codex workflow validation"
```
