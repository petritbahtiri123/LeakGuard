# LeakGuard 3.0 Full-Feature Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the complete documented LeakGuard feature surface release-verifiable across shared logic, packaged Chrome consumer and enterprise targets, Edge smoke, all built-in authenticated providers, and one managed site without weakening local-only or fail-closed behavior.

**Architecture:** Establish one authoritative release matrix and a schema/completeness test, repair only confirmed gate omissions and duplication, then validate shared features, packaged browsers, and authenticated provider verticals in that order. A live failure stops its current batch and receives a separate focused TDD addendum before execution resumes; no speculative runtime changes are permitted.

**Tech Stack:** Chromium MV3 JavaScript, Node `assert` tests, Playwright Chromium E2E, Chrome/Edge CDP smoke harnesses, GitHub Actions, Markdown evidence records, existing synthetic fixtures and npm scripts.

## Owner scope amendment (2026-07-13)

Firefox is fully excluded from the active reliability and release-evidence scope. Existing Firefox implementation files and standalone developer commands are left untouched unless a Chrome/Edge safety fix necessarily shares code with them, but Firefox builds, packages, smokes, workflows, required matrix rows, authenticated testing, and compatibility claims are not executed or required. Where an earlier completed task below mentions Firefox, this amendment governs all remaining work and the final evidence contract.

## Global Constraints

- Processing stays local: no backend secret handling, telemetry, analytics, cloud verification, remote models, or raw-data network calls.
- Raw secrets must not persist in storage, DOM outside explicit text `Allow once` delivery, logs, exports, reports, audit records, debug output, filenames, exceptions, screenshots, or generated evidence artifacts.
- Controlled input fixtures use synthetic values only; real credentials, private files, account data, contacts, and production identifiers are forbidden.
- Unsafe protected-site flows fail closed. Never replay a raw file or image after LeakGuard consumes, reads, or attempts to sanitize it.
- Supported actions complete from one user action. Do not add second-click workarounds or duplicate send/upload/input/change replay.
- File-only and image-only flows do not gain composer-text fallback.
- Preserve deterministic detection order, placeholder stability/reuse/order, trusted-placeholder pass-through, right-to-left replacement, enterprise policy, consumer defaults, and metadata-only audit behavior.
- Preserve Chrome MV3 compatibility, manifest permissions, host permissions, CSP, runtime script order, local OCR/model behavior, and public privacy behavior unless the owner separately approves a proven unavoidable change. Do not change Firefox runtime files merely to remove it from release scope.
- Do not edit `dist/`, `node_modules/`, `ai/models/`, generated release artifacts, or `package-lock.json`.
- Do not add dependencies, a new test framework, selector registries, generic retry engines, or broad refactors.
- Keep `src/content/content.js` and `src/background/core.js` last in their runtime lists.
- Every authenticated `PENDING` cell remains release NO-GO until executed or explicitly waived by the repository/release owner.

---

### Task 1: Create the authoritative full-feature matrix and completeness gate

**Files:**
- Create: `docs/qa/3.0-full-feature-reliability-matrix.md`
- Create: `tests/full_feature_reliability_matrix.test.js`
- Modify: `package.json`
- Modify: `docs/RELEASE_QA_CHECKLIST.md`

**Interfaces:**
- Consumes: approved design dimensions and the existing release/manual QA documents.
- Produces: stable `FEATURE-*`, `PKG-*`, and `AUTH-*` row IDs; normal validation accepts `PENDING`, while `npm run test:release-matrix` rejects `PENDING` and `FAIL`.

- [ ] **Step 1: Write the matrix contract test first**

Create `tests/full_feature_reliability_matrix.test.js` with this structure:

```js
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const matrixPath = path.join(repoRoot, "docs/qa/3.0-full-feature-reliability-matrix.md");
const matrix = fs.readFileSync(matrixPath, "utf8");
const requireComplete = process.argv.includes("--require-complete");
const allowedStatuses = new Set(["PASS", "FAIL", "PENDING", "NOT APPLICABLE", "WAIVED"]);

const featureIds = [
  "FEATURE-SITE-ROUTING",
  "FEATURE-COMPOSER",
  "FEATURE-DECISIONS-POLICY",
  "FEATURE-DETECTION",
  "FEATURE-NETWORK-METADATA",
  "FEATURE-ONIX",
  "FEATURE-PLACEHOLDERS-REVEAL",
  "FEATURE-UI",
  "FEATURE-SCANNER",
  "FEATURE-GENERATED-DOCUMENTS",
  "FEATURE-IMAGES-OCR",
  "FEATURE-PROTECTED-FILES",
  "FEATURE-WHATSAPP",
  "FEATURE-DIAGNOSTICS-AUDIT",
  "FEATURE-BUILD-PRIVACY"
];
const providers = ["CHATGPT", "OPENAI", "CLAUDE", "GEMINI", "GROK", "X", "WHATSAPP", "MANAGED"];
const browsers = ["CHROME", "FIREFOX"];
const modes = ["CONSUMER", "ENTERPRISE"];
const packageIds = [
  "PKG-CHROME-CONSUMER",
  "PKG-CHROME-ENTERPRISE",
  "PKG-FIREFOX-CONSUMER",
  "PKG-FIREFOX-ENTERPRISE",
  "PKG-EDGE-SMOKE"
];
const authIds = providers.flatMap((provider) =>
  browsers.flatMap((browser) => modes.map((mode) => `AUTH-${provider}-${browser}-${mode}`))
);

function rowFor(id) {
  const line = matrix.split(/\r?\n/).find((candidate) => candidate.startsWith(`| ${id} |`));
  assert.ok(line, `missing reliability matrix row ${id}`);
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  assert.ok(allowedStatuses.has(cells.at(-2)), `${id}: invalid status ${cells.at(-2)}`);
  assert.ok(cells.at(-1), `${id}: missing evidence/blocker detail`);
  return { id, status: cells.at(-2), detail: cells.at(-1) };
}

const rows = [...featureIds, ...packageIds, ...authIds].map(rowFor);
assert.match(matrix, /Exactly one send\/upload\/event sequence/);
assert.match(matrix, /Raw synthetic value absent/);
assert.match(matrix, /Owner-approved waiver/);

if (requireComplete) {
  const incomplete = rows.filter((row) => row.status === "PENDING" || row.status === "FAIL");
  assert.deepStrictEqual(incomplete, [], `release matrix incomplete: ${incomplete.map((row) => row.id).join(", ")}`);
}

console.log(`PASS full-feature reliability matrix contract (${rows.length} required rows)`);
```

- [ ] **Step 2: Verify the test is RED**

Run: `node tests/full_feature_reliability_matrix.test.js`

Expected: FAIL with `ENOENT` because the authoritative matrix does not yet exist.

- [ ] **Step 3: Create the authoritative matrix**

Create `docs/qa/3.0-full-feature-reliability-matrix.md` with:

```markdown
# LeakGuard 3.0 Full-Feature Reliability Matrix

## Rules

- Allowed states: `PASS`, `FAIL`, `PENDING`, `NOT APPLICABLE`, `WAIVED`.
- `PENDING` and `FAIL` are release NO-GO.
- `WAIVED` requires an owner, date, reason, and affected public claim.
- Every run uses synthetic fixtures and records commit, build, browser version, provider route, result, raw-value sweep, action counts, diagnostics, tester, and date.
- Supported behavior must complete safely; blocking alone is not a pass.

## Required assertions

- Raw synthetic value absent.
- Exactly one send/upload/event sequence.
- Placeholder, panel, hydration, and reveal state truthful where applicable.
- Generated files open and contain no visible/searchable raw synthetic value where applicable.
- No LeakGuard console warning/error.
- Owner-approved waiver is the only waiver mechanism.

## Shared feature rows

| ID | Scope | Required evidence | Status | Evidence or blocker |
| --- | --- | --- | --- | --- |
```

Add all 15 `FEATURE-*` rows from the test with status `PENDING`. Add a package table containing all five `PKG-*` rows with status `PENDING`. Add an authenticated table containing every generated `AUTH-*` row with status `PENDING`. Each row's final cell must state the next exact evidence action, not merely “not tested.”

Add one `## Evidence record template` section containing fields for commit, worktree state, build, browser/version, provider/route, feature/ingress, fixture IDs, expected/observed sanitized result, raw sweep, event counts, placeholder state, diagnostics, generated-file inspection, status, tester/date, and evidence link.

- [ ] **Step 4: Make normal validation GREEN and release completion RED**

Run:

```powershell
node tests/full_feature_reliability_matrix.test.js
node tests/full_feature_reliability_matrix.test.js --require-complete
```

Expected: first command PASS; second command FAIL and list every pending required row.

- [ ] **Step 5: Wire the explicit release-only gate**

Add to `package.json` scripts:

```json
"test:release-matrix": "node tests/full_feature_reliability_matrix.test.js --require-complete"
```

Add a `Before Packaging` bullet to `docs/RELEASE_QA_CHECKLIST.md` linking the new matrix and stating that `npm run test:release-matrix` must pass before release identity changes.

- [ ] **Step 6: Validate and commit Task 1**

```powershell
node tests/full_feature_reliability_matrix.test.js
npm run docs:check-links
git diff --check
git add -- package.json docs/RELEASE_QA_CHECKLIST.md docs/qa/3.0-full-feature-reliability-matrix.md tests/full_feature_reliability_matrix.test.js
git diff --cached --check
git commit -m "test: add full-feature release matrix gate"
```

Expected: normal matrix contract and docs checks pass; the explicit completion command remains intentionally red while required evidence is pending.

### Task 2: Add omitted stable product tests to Tier A

**Files:**
- Modify: `scripts/run-tests.mjs`
- Test: `tests/chatgpt_composer_sync.test.js`
- Test: `tests/debug_logger.test.js`
- Test: `tests/browser_qa_matrix.test.js`
- Test: `tests/full_feature_reliability_matrix.test.js`

**Interfaces:**
- Consumes: existing standalone Node tests.
- Produces: Tier A executes all four tests without changing their contracts.

- [ ] **Step 1: Prove each omitted test is independently stable**

```powershell
node tests/chatgpt_composer_sync.test.js
node tests/debug_logger.test.js
node tests/browser_qa_matrix.test.js
node tests/full_feature_reliability_matrix.test.js
```

Expected: all four commands exit 0 twice consecutively. A flaky test is fixed at its own owner before manifest inclusion; it is never hidden or retried in `run-tests.mjs`.

- [ ] **Step 2: Add the tests to their owner-adjacent positions**

Update `scripts/run-tests.mjs`:

```js
  "tests/composer_helpers.test.js",
  "tests/chatgpt_composer_sync.test.js",
  // existing composer tests...
  "tests/content_status_ui.test.js",
  "tests/debug_logger.test.js",
  // existing diagnostics tests...
  "tests/browser_qa_assertions.test.js",
  "tests/browser_qa_matrix.test.js",
  "tests/full_feature_reliability_matrix.test.js",
```

- [ ] **Step 3: Run Tier A and commit Task 2**

```powershell
npm test
git diff --check
git add -- scripts/run-tests.mjs
git diff --cached --check
git commit -m "test: include full feature owners in tier a"
```

Expected: Tier A passes and prints PASS output for all four newly included tests.

### Task 3: Make deterministic Playwright a separate required PR gate

**Files:**
- Modify: `tests/productization.test.js`
- Modify: `.github/workflows/test.yml`
- Modify: `docs/RELEASE_QA_CHECKLIST.md`

**Interfaces:**
- Consumes: existing `npm run build:chrome` and `npm run test:e2e`.
- Produces: a separately visible `deterministic-e2e` PR job; Tier C packaged browser smokes remain outside PR CI.

- [ ] **Step 1: Write the failing workflow contract**

Add to `tests/productization.test.js` and call it from `run()`:

```js
function testDeterministicPlaywrightIsRequiredPrGate() {
  assert.ok(testWorkflow.includes("deterministic-e2e:"), "PR workflow should expose deterministic E2E as its own job");
  assert.ok(testWorkflow.includes("npm run build:chrome"), "PR E2E job should build the Chrome target");
  assert.ok(testWorkflow.includes("npm run test:e2e"), "PR E2E job should run the full deterministic suite");
  assert.ok(!testWorkflow.includes("npm run test:browser-gates"), "PR workflow should leave Tier C to nightly");
}
```

- [ ] **Step 2: Verify RED**

Run: `node tests/productization.test.js`

Expected: FAIL because the current PR workflow runs Tier C and has no separate deterministic E2E job.

- [ ] **Step 3: Split the workflow jobs**

In `.github/workflows/test.yml`, remove Chrome/Firefox/geckodriver/Edge setup and `Run Tier C browser gates` from the existing `test` job. Add this sibling job:

```yaml
  deterministic-e2e:
    name: Deterministic Chromium E2E
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: "22"

      - name: Setup Python
        uses: actions/setup-python@v6
        with:
          python-version: "3.11"

      - name: Setup Chrome
        uses: browser-actions/setup-chrome@v2

      - name: Install dependencies
        run: npm ci

      - name: Build Chrome extension
        run: npm run build:chrome

      - name: Run deterministic full-feature E2E
        run: xvfb-run -a npm run test:e2e
```

- [ ] **Step 4: Reconcile release documentation**

Change the CI section in `docs/RELEASE_QA_CHECKLIST.md` so PR-required evidence is Tier A plus the separate deterministic Playwright job; keep authenticated and Tier C browser tests out of PR CI.

- [ ] **Step 5: Run GREEN and commit Task 3**

```powershell
node tests/productization.test.js
npm run docs:check-links
git diff --check
git add -- .github/workflows/test.yml docs/RELEASE_QA_CHECKLIST.md tests/productization.test.js
git diff --cached --check
git commit -m "ci: require deterministic playwright gate"
```

### Task 4: Deduplicate and align nightly and release commands

**Files:**
- Modify: `tests/productization.test.js`
- Modify: `package.json`
- Modify: `.github/workflows/browser-nightly.yml`
- Modify: `.github/workflows/release-artifacts.yml`
- Modify: `docs/RELEASE_QA_CHECKLIST.md`
- Modify: `docs/phase-17f-ci-nightly-matrix-hardening.md`

**Interfaces:**
- Consumes: `qa:browser:full`, `test:release-gates`, deterministic E2E, and the release-matrix gate.
- Produces: each expensive browser build/harness runs once per aggregate; the named nightly command is what the nightly workflow executes.

- [ ] **Step 1: Update the expected script contract first**

Change `testPhase17fScriptsAndWorkflowsAreTiered()` expectations to:

```js
  assert.strictEqual(
    packageJson.scripts["test:browser-gates"],
    "npm run preflight:browser && npm run qa:browser:full"
  );
  assert.strictEqual(
    packageJson.scripts["test:nightly"],
    "npm run test:fast && npm run test:release-gates && npm run test:e2e && npm run test:browser-gates"
  );
  assert.strictEqual(
    packageJson.scripts["test:release"],
    "npm run docs:check-links && npm run test:nightly && npm run test:release-matrix"
  );
  assert.ok(browserNightlyWorkflow.includes("npm run test:nightly"));
  assert.ok(releaseArtifactsWorkflow.includes("npm run test:e2e"));
  assert.ok(releaseArtifactsWorkflow.includes("npm run test:release-matrix"));
```

Also update `testBrowserQaScriptOwnsFirefoxSmokeCoverage()` so its release/nightly assertions become:

```js
  assert.ok(
    testRelease.includes("npm run test:nightly") && !testRelease.includes("npm run smoke:firefox"),
    "test:release should use the complete nightly aggregate rather than repeating a standalone smoke"
  );
  assert.ok(
    !testWorkflow.includes("npm run test:browser-gates") &&
      browserNightlyWorkflow.includes("npm run test:nightly"),
    "PR CI should use deterministic E2E while browser-nightly owns the complete nightly aggregate"
  );
```

- [ ] **Step 2: Verify RED**

Run: `node tests/productization.test.js`

Expected: FAIL on the old duplicated browser-gate and incomplete nightly/release strings.

- [ ] **Step 3: Replace the package scripts exactly**

```json
"test:browser-gates": "npm run preflight:browser && npm run qa:browser:full",
"test:nightly": "npm run test:fast && npm run test:release-gates && npm run test:e2e && npm run test:browser-gates",
"test:release": "npm run docs:check-links && npm run test:nightly && npm run test:release-matrix"
```

Do not change standalone `smoke:*`, `qa:browser`, or focused E2E commands.

- [ ] **Step 4: Make workflows use the authoritative commands**

In `browser-nightly.yml`, replace the separate Tier A, Tier B, preflight, and Tier C steps with:

```yaml
      - name: Run complete nightly matrix
        run: xvfb-run -a npm run test:nightly
```

In `release-artifacts.yml`, add Chrome setup, deterministic E2E after release gates, and release-matrix completion before checksums:

```yaml
      - name: Setup Chrome
        uses: browser-actions/setup-chrome@v2

      - name: Run deterministic E2E
        run: xvfb-run -a npm run test:e2e

      - name: Require complete full-feature matrix
        run: npm run test:release-matrix
```

- [ ] **Step 5: Reconcile docs and commit Task 4**

Update the two release/tier documents to state the exact new command ownership and that the completion gate intentionally fails while required evidence remains pending.

```powershell
node tests/productization.test.js
node tests/full_feature_reliability_matrix.test.js
npm run docs:check-links
git diff --check
git add -- package.json .github/workflows/browser-nightly.yml .github/workflows/release-artifacts.yml docs/RELEASE_QA_CHECKLIST.md docs/phase-17f-ci-nightly-matrix-hardening.md tests/productization.test.js
git diff --cached --check
git commit -m "ci: align full-feature nightly and release gates"
```

### Task 5: Smoke both consumer and enterprise packages

**Files:**
- Modify: `tests/browser/chrome_smoke.test.mjs`
- Modify: `tests/browser/firefox_smoke.test.mjs`
- Modify: `tests/productization.test.js`
- Modify: `package.json`
- Modify: `docs/BROWSER_COMPATIBILITY_MATRIX.md`

**Interfaces:**
- Consumes: existing smoke implementations and `dist/chrome`, `dist/chrome-enterprise`, `dist/firefox`, and `dist/firefox-enterprise` builds.
- Produces: `--extension-target=chrome-enterprise` and `--extension-target=firefox-enterprise` selection in addition to the current consumer defaults, plus standalone enterprise smoke scripts; no managed policy is synthesized in browser code.

- [ ] **Step 1: Write target-selection contract assertions**

Add to `tests/productization.test.js`:

```js
function testEnterpriseTargetsHavePackagedRuntimeSmoke() {
  assert.strictEqual(
    packageJson.scripts["smoke:chrome-enterprise"],
    "npm run build:chrome-enterprise && node tests/browser/chrome_smoke.test.mjs --extension-target=chrome-enterprise"
  );
  assert.strictEqual(
    packageJson.scripts["smoke:firefox-enterprise"],
    "npm run build:firefox-enterprise && node tests/browser/firefox_smoke.test.mjs --extension-target=firefox-enterprise"
  );
  assert.ok(chromeSmokeSource.includes("--extension-target="));
  assert.ok(firefoxSmokeSource.includes("--extension-target="));
}
```

- [ ] **Step 2: Verify RED**

Run: `node tests/productization.test.js`

Expected: FAIL because enterprise runtime smoke commands and target parsing do not exist.

- [ ] **Step 3: Parameterize Chrome smoke safely**

Replace the hard-coded target declaration with:

```js
const targetArgument = process.argv.find((value) => value.startsWith("--extension-target="));
const extensionTarget = targetArgument ? targetArgument.slice("--extension-target=".length) : "chrome";
assert.ok(["chrome", "chrome-enterprise"].includes(extensionTarget), `Unsupported Chrome smoke target: ${extensionTarget}`);
const extensionDir = path.join(repoRoot, "dist", extensionTarget);
const extensionBuildCommand = `npm run build:${extensionTarget}`;
```

Pass `extensionBuildCommand` to `assertBuiltExtensionExists`. Keep all existing smoke assertions identical.

- [ ] **Step 4: Parameterize Firefox smoke safely**

Use the same pattern with allowed targets `firefox` and `firefox-enterprise`, and update the missing-build error to cite `npm run build:${extensionTarget}`. Keep temporary XPI creation and all existing smoke assertions unchanged.

- [ ] **Step 5: Add scripts and full-browser ownership**

Add:

```json
"smoke:chrome-enterprise": "npm run build:chrome-enterprise && node tests/browser/chrome_smoke.test.mjs --extension-target=chrome-enterprise",
"smoke:firefox-enterprise": "npm run build:firefox-enterprise && node tests/browser/firefox_smoke.test.mjs --extension-target=firefox-enterprise"
```

Set `qa:browser:full` to this exact one-build/one-harness command:

```json
"qa:browser:full": "npm run build:chrome && node tests/browser/extension_qa_harness.test.mjs --full-matrix && node tests/browser/chrome_smoke.test.mjs && node tests/browser/edge_smoke.test.mjs && npm run build:firefox && node tests/browser/firefox_smoke.test.mjs && npm run build:chrome-enterprise && node tests/browser/chrome_smoke.test.mjs --extension-target=chrome-enterprise && npm run build:firefox-enterprise && node tests/browser/firefox_smoke.test.mjs --extension-target=firefox-enterprise"
```

Do not add Edge enterprise or a second harness run.

- [ ] **Step 6: Validate and commit Task 5**

```powershell
node tests/productization.test.js
node tests/browser_qa_matrix.test.js
npm run build:chrome-enterprise
node tests/browser/chrome_smoke.test.mjs --extension-target=chrome-enterprise
npm run build:firefox-enterprise
node tests/browser/firefox_smoke.test.mjs --extension-target=firefox-enterprise
npm run docs:check-links
git diff --check
git add -- package.json docs/BROWSER_COMPATIBILITY_MATRIX.md tests/browser/chrome_smoke.test.mjs tests/browser/firefox_smoke.test.mjs tests/productization.test.js
git diff --cached --check
git commit -m "test: smoke enterprise browser targets"
```

### Task 6: Exclude Firefox gates and close Chrome/Edge release-target parity

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/browser-nightly.yml`
- Modify: `tests/browser_qa_matrix.test.js`
- Modify: `tests/full_feature_reliability_matrix.test.js`
- Modify: `tests/productization.test.js`
- Modify: `docs/qa/3.0-full-feature-reliability-matrix.md`
- Modify: `docs/BROWSER_COMPATIBILITY_MATRIX.md`
- Reuse: existing Chrome consumer/enterprise and Edge smoke harnesses and synthetic fixtures

**Interfaces:**
- Consumes: current Chrome consumer/enterprise smoke targets, Edge Chrome-target smoke, release-matrix schema, and release/nightly aggregate scripts.
- Produces: Chrome/Edge-only active release gates and matrix requirements. Firefox source and standalone developer commands remain untouched but are non-gating and unsupported by this pass.

- [ ] **Step 1: Write failing scope-contract assertions**

Update the focused contract tests so required browser/package/auth rows include Chrome consumer/enterprise and Edge smoke only. Assert that `qa:browser`, `qa:browser:full`, `package:release`, and the nightly workflow do not invoke Firefox build, smoke, packaging, setup, or geckodriver steps. Assert that the compatibility document explicitly says Firefox is excluded and unverified rather than supported.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node tests/full_feature_reliability_matrix.test.js
node tests/browser_qa_matrix.test.js
node tests/productization.test.js
```

Expected: at least one assertion fails because Firefox is still required or invoked.

- [ ] **Step 3: Make the smallest gate and evidence changes**

Remove Firefox from the aggregate browser, nightly, release-package, and required-matrix paths. Keep the Chrome consumer harness exactly once, Chrome consumer smoke exactly once, Edge smoke exactly once, and Chrome enterprise smoke exactly once. Do not delete Firefox runtime, manifests, build scripts, or standalone commands; they are outside this pass and must not be changed speculatively.

Change every Firefox package/auth matrix row to `NOT APPLICABLE` or remove it if the matrix contract no longer requires it, with the owner scope amendment as evidence. Update shared feature rows to require Chrome/Edge evidence only. Do not convert any unexecuted Chrome row to `PASS`.

- [ ] **Step 4: Verify focused Chrome/Edge scope**

```powershell
node tests/full_feature_reliability_matrix.test.js
node tests/browser_qa_matrix.test.js
node tests/productization.test.js
npm run docs:check-links
git diff --check
```

Expected: all commands exit 0 and no focused gate invokes Firefox.

- [ ] **Step 5: Commit Task 6**

```powershell
git add -- package.json .github/workflows/browser-nightly.yml tests/browser_qa_matrix.test.js tests/full_feature_reliability_matrix.test.js tests/productization.test.js docs/qa/3.0-full-feature-reliability-matrix.md docs/BROWSER_COMPATIBILITY_MATRIX.md
git diff --cached --check
git commit -m "ci: focus reliability gates on chrome and edge"
```

### Task 7: Run the complete automated baseline and populate shared/package rows

**Files:**
- Modify: `docs/qa/3.0-full-feature-reliability-matrix.md`
- Create only on failure: a focused addendum whose filename is the lowercased matrix row ID, for example `AUTH-GEMINI-CHROME-CONSUMER` becomes `docs/superpowers/plans/2026-07-12-auth-gemini-chrome-consumer.md`.

**Interfaces:**
- Consumes: Tasks 1-6 and current synthetic fixtures.
- Produces: fresh `FEATURE-*` and `PKG-*` evidence; no speculative runtime edits.

- [ ] **Step 1: Run focused and aggregate gates in order**

```powershell
npm run test:changed
npm test
npm run build:chrome
npm run test:e2e
npm run qa:browser:full
npm run test:release-gates
npm run bench:hotpaths
npm run docs:check-links
git diff --check
```

Expected: every command exits 0. Allow at least 30 minutes for the deterministic E2E command; the current known-good runtime is approximately 17.5 minutes.

- [ ] **Step 2: Record evidence without broad claims**

Update only rows directly proven by the command output. Record exact command, result counts, duration, commit SHA, build target, browser version where emitted, and remaining uncovered assertions. Do not mark authenticated rows from local fixtures.

- [ ] **Step 3: Stop and create a finding addendum for any product failure**

For each failed product assertion:

1. leave the matrix row `FAIL` with the raw-free error and exact command;
2. create a new focused plan named after that matrix ID;
3. identify one source owner and one existing focused test owner from `docs/REPO_MAP.md`;
4. write a RED test that reproduces the observed failure;
5. implement the smallest owner-local fix;
6. run the focused test, `npm run test:changed`, the affected browser slice, and independent review;
7. commit the fix separately;
8. rerun the failed matrix cell before changing its status.

Environment startup failures remain `PENDING` with remediation evidence; they are not product fixes.

- [ ] **Step 4: Commit automated evidence**

```powershell
git add -- docs/qa/3.0-full-feature-reliability-matrix.md
git diff --cached --check
git commit -m "docs: record automated full-feature evidence"
```

### Task 8: Execute authenticated Chrome consumer provider matrix

**Files:**
- Modify: `docs/qa/3.0-full-feature-reliability-matrix.md`
- Reuse: `docs/qa/cross-site-manual-checklist.md`
- Reuse: `tests/fixtures/manual/live-site-qa/full-redaction-matrix/*`

**Interfaces:**
- Consumes: packaged `dist/chrome`, authenticated Chrome profiles, and synthetic fixtures.
- Produces: all eight `AUTH-*-CHROME-CONSUMER` rows.

- [ ] **Step 1: Establish exact test state**

Build/reload `dist/chrome`, record commit and Chrome version, enable file URL access where file chooser automation requires it, and use only the configured QA accounts/chats. Open DevTools Console/Network and confirm the LeakGuard panel before each provider batch.

- [ ] **Step 2: Run every applicable shared assertion**

For ChatGPT, legacy OpenAI Chat, Claude, Gemini, Grok, X, WhatsApp, and the managed site, execute typing, multiline paste, Enter, send click, `Redact`, explicit text `Allow once`, `Cancel`, placeholder count/reuse/hydration/reveal, navigation/remount, and exactly-one-send assertions.

- [ ] **Step 3: Run every applicable file/image assertion**

Exercise attach/select, drop, supported paste, text/PDF/DOCX/XLSX/image OCR, identical metadata, duplicate filenames, streaming sizes, multi-file order/caps, unsupported inputs, forced failure, exactly-one-upload, and generated-file open/search checks wherever the documented adapter capability applies.

Use provider-specific cases for ChatGPT temporary/large paste, Gemini/Grok pending attach, WhatsApp clipboard image/attach/drop/all-or-nothing/no-file-paste, and managed-site permission lifecycle.

- [ ] **Step 4: Record strict results**

Each provider row stays `PENDING` until every applicable assertion is executed. A login/profile limitation remains `PENDING` and release NO-GO. A LeakGuard assertion failure becomes `FAIL` and invokes the Task 7 addendum loop before testing continues on that feature family.

- [ ] **Step 5: Commit Chrome consumer evidence**

```powershell
git add -- docs/qa/3.0-full-feature-reliability-matrix.md
git diff --cached --check
git commit -m "docs: record chrome consumer authenticated matrix"
```

### Task 9: Execute authenticated Chrome enterprise provider matrix

**Files:**
- Modify: `docs/qa/3.0-full-feature-reliability-matrix.md`
- Reuse: `docs/ENTERPRISE_DEPLOYMENT.md`
- Reuse: `docs/MANAGED_POLICY_SCHEMA.md`
- Reuse: `docs/qa/ENTERPRISE_METADATA_LIVE_SITE_QA_RUNBOOK.md`

**Interfaces:**
- Consumes: `dist/chrome-enterprise`, packaged defaults, and one strict managed-policy profile.
- Produces: all eight `AUTH-*-CHROME-ENTERPRISE` rows.

- [ ] **Step 1: Validate packaged enterprise defaults**

Load the enterprise package, verify build identity, policy overview, protected sites, default controls, and metadata-only audit behavior. Record any difference between packaged defaults and recommended strict policy as evidence, not an inferred pass.

- [ ] **Step 2: Validate strict managed policy**

Apply the documented strict profile through browser-managed policy. Verify destination `allow`/`redact`/`block`, managed sites, disallowed override/pause/removal/reveal/feedback/AI controls as configured, strict-load failure, and bounded metadata-only audit.

- [ ] **Step 3: Run provider applicability matrix**

Repeat the full authenticated provider actions under enterprise policy. Where policy deliberately blocks a feature, success requires the documented block, zero raw delivery, zero duplicate action, correct control state, and correct metadata-only audit event.

- [ ] **Step 4: Record and commit enterprise evidence**

```powershell
git add -- docs/qa/3.0-full-feature-reliability-matrix.md
git diff --cached --check
git commit -m "docs: record chrome enterprise authenticated matrix"
```

### Task 10: Complete Chrome live file-cache and multi-file serialization validation

**Files:**
- Modify: `docs/qa/3.0-full-feature-reliability-matrix.md`
- Reuse: `%LOCALAPPDATA%\Temp\leakguard-live-qa`
- Reuse: Chrome consumer package and the existing local live-file QA harness/runbook

**Interfaces:**
- Consumes: Chrome with **Allow access to file URLs** enabled, existing identical-metadata fixtures, and existing same-tab multi-file fixtures.
- Produces: live evidence for cache identity, placeholder isolation, serialized same-tab handoff, raw absence, and exactly-once upload.

- [ ] **Step 1: Validate identical-metadata cache isolation**

Use two different fixture files that share name-independent metadata dimensions used by the former cache key. Process them sequentially in the same Chrome tab. Verify each sanitized output contains only its own expected placeholders/content, neither output reuses the other file's sanitized payload, raw synthetic values are absent from the destination and extension state, and each user action produces exactly one upload.

- [ ] **Step 2: Validate same-tab multi-file serialization**

Select the existing multi-file batch in one action, then repeat the supported concurrent/same-tab scenario from the runbook. Verify stable input order, distinct placeholder mappings per file, no overwrite of pending placeholder state, zero raw destination content, and exactly one upload per accepted sanitized file with no duplicates.

- [ ] **Step 3: Record environment limitations truthfully**

If Chrome cannot expose the file fixture or the extension lacks file-URL access, keep the affected rows `PENDING` with the exact raw-free browser error. Do not convert an environment limitation into a code change. If the product assertion fails after the extension loads, mark the row `FAIL` and route it through Task 11.

- [ ] **Step 4: Commit live file evidence**

```powershell
git add -- docs/qa/3.0-full-feature-reliability-matrix.md
git diff --cached --check
git commit -m "docs: record chrome live file reliability evidence"
```

### Task 11: Close every reproduced defect with focused TDD addenda

**Files:**
- Create: one deterministic addendum path per distinct root cause by lowercasing its matrix row ID; for example `AUTH-GEMINI-CHROME-CONSUMER` maps to `docs/superpowers/plans/2026-07-12-auth-gemini-chrome-consumer.md`.
- Modify: only the source owner and focused tests named in that addendum
- Modify after rerun: `docs/qa/3.0-full-feature-reliability-matrix.md`

**Interfaces:**
- Consumes: `FAIL` rows from Tasks 7-10.
- Produces: independently reviewed fixes and rerun evidence; no batching of unrelated failures.

- [ ] **Step 1: Group failures only by proven root cause**

Do not group by provider name alone. A shared background-state failure may cover providers; two visually similar provider failures remain separate until evidence proves a shared owner.

- [ ] **Step 2: Use the exact owner map**

| Failure family | Source owner | First focused test |
| --- | --- | --- |
| Detection/redaction | `src/shared/detector.js`, relevant `src/shared/detection/*`, `src/shared/redactor.js` | `tests/detector.test.js` or named detection test |
| Placeholder/session/reveal | `src/shared/placeholders*`, `src/background/core.js`, `src/content/rehydration/*` | placeholder/reveal/security owner test |
| Composer send/paste | `src/content/composer/*`, `src/content/input/*` | matching orchestration test plus `typed_interception.test.js` |
| File/image/OCR | `src/content/files/*`, `src/shared/file*`, `src/shared/ocr/*` | matching file/OCR owner test plus file E2E slice |
| Site/adapter | `src/content/adapters/*`, `src/background/protectedSiteRegistry.js` | `adapter_contracts.test.js` or `protected_sites.test.js` |
| Popup/options/UI | `src/popup/*`, `src/options/*`, `src/content/ui/*` | matching UI owner test |
| Enterprise/audit | `src/shared/policy.js`, `src/background/auditLog.js` | `enterprise_policy.test.js`, `background_audit_log.test.js` |
| Runtime/package | runtime lists, manifests, service worker, build scripts | runtime-order/build/security tests |

- [ ] **Step 3: Apply the mandatory RED-GREEN-review loop**

Every addendum contains exact observed failure, exact test fixture, RED command/result, minimal implementation, GREEN command/result, affected E2E/browser gate, security invariants, commit command, and independent review. If root cause is still unknown, investigation continues read-only; production code is not changed.

- [ ] **Step 4: Rerun and update the matrix**

A row moves from `FAIL` to `PASS` only after the original browser/provider cell is rerun successfully. Automated regression success alone is insufficient for an authenticated failure.

### Task 12: Final release-grade verification, provenance, and GO/NO-GO

**Files:**
- Modify: `docs/qa/3.0-full-feature-reliability-matrix.md`
- Modify: `docs/RELEASE_3_0_0_RELIABILITY.md`
- Modify: `docs/RELEASE_QA_CHECKLIST.md`
- Create: `docs/qa/3.0-full-feature-reliability-results.md`

**Interfaces:**
- Consumes: every completed workstream and finding addendum.
- Produces: final provenance and strict GO/NO-GO; no version bump.

- [ ] **Step 1: Run the clean release gates**

From a clean worktree at the exact candidate commit:

```powershell
npm run test:release
npm run report:sizes -- --output-dir artifacts/runtime-budgets
npm run report:licenses -- --output-dir artifacts/supply-chain
npm run report:osv -- --output-dir artifacts/supply-chain
npm run scan:repo-secrets -- --output-dir artifacts/supply-chain
npm audit --omit=dev --audit-level=high
npm run release:checksums
git diff --check
git status --short
```

Expected: every command exits 0, `npm run test:release-matrix` finds no `PENDING` or `FAIL`, and no generated artifacts are staged.

- [ ] **Step 2: Perform independent whole-branch review**

Review the merge-base-to-HEAD diff against the approved design and this plan. Resolve every Critical or Important finding with a focused regression and rerun the affected gate. Re-review until clean.

- [ ] **Step 3: Write the final result**

Record:

- branch, candidate SHA, package hashes, browser versions, build modes, and provider accounts/profiles used;
- every command with exact pass/fail/skip totals and duration;
- every authenticated row and evidence location;
- every fixed root cause and rollback commit;
- every approved waiver;
- raw/duplicate-action sweeps;
- manifest, permission, CSP, telemetry, network, policy, detector, OCR/model, and privacy-change statement;
- remaining blockers; and
- final `GO` only if the completion gate passes, otherwise `NO-GO`.

- [ ] **Step 4: Commit final evidence**

```powershell
git add -- docs/qa/3.0-full-feature-reliability-matrix.md docs/qa/3.0-full-feature-reliability-results.md docs/RELEASE_3_0_0_RELIABILITY.md docs/RELEASE_QA_CHECKLIST.md
git diff --cached --check
git commit -m "docs: record full-feature 3.0 reliability evidence"
git status --short
```

Expected: the worktree is clean. Do not change release identity in this task.
