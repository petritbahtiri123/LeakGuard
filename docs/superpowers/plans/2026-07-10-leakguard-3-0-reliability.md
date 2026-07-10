# LeakGuard 3.0.0 Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate three evidence-backed reliability failures while preserving LeakGuard's local-only, verified, fail-closed security boundary.

**Architecture:** Keep each change at its current owner: background state serialization in `core.js`, object-identity cache authorization in the extraction cache, and verified Enter replay policy in the fallback-key orchestrator. Add no dependency, generic retry engine, selector guess, permission, manifest capability, telemetry, network call, or raw-data fallback.

**Tech Stack:** Chrome/Firefox MV3 JavaScript, Node `assert` regression tests, Playwright E2E, existing npm build and benchmark scripts.

## Global Constraints

- Processing stays local: no backend secret handling, telemetry, analytics, cloud verification, remote models, or raw-data network calls.
- Raw secrets must not persist in storage, DOM, logs, exports, reports, audit records, debug output, filenames, or exceptions.
- Unsafe protected-site flows fail closed; never replay a raw file after LeakGuard consumes or sanitizes it.
- One user action completes supported send and upload flows; do not add a second-click workaround or duplicate send/upload replay.
- Preserve deterministic detection order, placeholder stability/reuse/order, trusted-placeholder pass-through, and right-to-left redaction safety.
- Preserve enterprise policy, consumer defaults, Chrome/Firefox MV3 compatibility, CSP, permissions, and runtime script order.
- Do not edit `dist/`, `node_modules/`, `ai/models/`, generated artifacts, or `package-lock.json`.
- Use synthetic secrets only.

---

### Task 1: Isolate extraction-cache entries by file object

**Files:**
- Modify: `tests/content_file_extraction_pipeline.test.js`
- Modify: `src/content/files/fileExtractionSessionCache.js`

**Interfaces:**
- Consumes: `FileExtractionSessionCache.get(file)`, `.set(file, result)`, `.clear()`, `.getFileSignature(file)`, and `.debugSnapshot()`.
- Produces: the same public API, with cache hits authorized by the same object identity rather than metadata equality.

- [ ] **Step 1: Write the failing collision regression**

Add this test beside the existing cache reuse tests and call it from `run()` after `testSameFileSignatureReusesSafeCachedResult()`:

```js
async function testDistinctFilesWithIdenticalMetadataDoNotShareCachedContent() {
  ExtractionCache.clear();
  const secondSecret = RAW_SECRET.replace("ContentPipelineSecret", "ContentPipelineSecond");
  const firstFile = new TestFile([makePdf(`alpha-marker ${RAW_SECRET}`)], "collision.pdf", {
    type: "application/pdf",
    lastModified: 777
  });
  const secondFile = new TestFile([makePdf(`bravo-marker ${secondSecret}`)], "collision.pdf", {
    type: "application/pdf",
    lastModified: 777
  });

  assert.strictEqual(firstFile.size, secondFile.size, "fixture metadata must collide exactly");
  assert.strictEqual(
    ExtractionCache.getFileSignature(firstFile),
    ExtractionCache.getFileSignature(secondFile),
    "metadata signature must reproduce the old collision"
  );

  const first = await processFileForAdapterHandoff({ file: firstFile, context: "drop" });
  const second = await processFileForAdapterHandoff({ file: secondFile, context: "drop" });

  assert.strictEqual(first.metadata.cache.status, "miss");
  assert.strictEqual(second.metadata.cache.status, "miss");
  assert.ok(first.sanitizedText.includes("alpha-marker"));
  assert.ok(second.sanitizedText.includes("bravo-marker"));
  assert.strictEqual(second.sanitizedText.includes("alpha-marker"), false);
  assert.strictEqual(second.sanitizedText.includes(secondSecret), false);
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node tests/content_file_extraction_pipeline.test.js`

Expected: FAIL because the second file reports a cache hit and contains `alpha-marker`.

- [ ] **Step 3: Implement opaque object-identity cache tokens**

Keep the bounded `Map`, add a `WeakMap` from file objects to opaque tokens, and use metadata signatures only inside safe debug metadata:

```js
  const cache = new Map();
  let fileIdentityTokens = new WeakMap();

  function getFileIdentityToken(file, create = false) {
    if (!file || (typeof file !== "object" && typeof file !== "function")) return null;
    let token = fileIdentityTokens.get(file) || null;
    if (!token && create) {
      token = Object.freeze({});
      fileIdentityTokens.set(file, token);
    }
    return token;
  }
```

Update `get(file)` to use `getFileIdentityToken(file)` as the `Map` key. Update `set(file, result, options)` to use `getFileIdentityToken(file, true)` as the key and retain `getFileSignature(file)` only as `meta.key`. Update `clear()` to run both:

```js
  function clear() {
    cache.clear();
    fileIdentityTokens = new WeakMap();
  }
```

Do not store the `File` object in the `Map`, token, result, snapshot, or diagnostics.

- [ ] **Step 4: Run GREEN and cache safety checks**

Run:

```powershell
node tests/content_file_extraction_pipeline.test.js
node tests/security.test.js
node --check src/content/files/fileExtractionSessionCache.js
```

Expected: all commands exit 0; same-object cache reuse remains a hit, the collision test is a miss, and snapshots contain no raw values.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/content/files/fileExtractionSessionCache.js tests/content_file_extraction_pipeline.test.js
git diff --cached --check
git commit -m "fix: isolate file extraction cache entries"
```

### Task 2: Serialize background redaction state per tab

**Files:**
- Modify: `tests/security.test.js`
- Modify: `src/background/core.js`

**Interfaces:**
- Consumes: existing `redactForTab(tabId, url, text, findings, options)` callers.
- Produces: unchanged `redactForTab` result shape; introduces internal `queueTabStateMutation(tabId, mutation)` and `performRedactionForTab(...)` ownership.

- [ ] **Step 1: Write failing queue behavior and wiring regressions**

Add this test after `testSessionStorageFallbackIsEphemeralOnly()` and call it from `run()`:

```js
async function testBackgroundRedactionMutationsSerializePerTab() {
  const { sandbox } = createBackgroundSecuritySandbox();
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = sandbox.queueTabStateMutation(11, async () => {
    events.push("first:start");
    await firstGate;
    events.push("first:end");
  });
  const second = sandbox.queueTabStateMutation(11, async () => {
    events.push("second:start");
  });
  const otherTab = sandbox.queueTabStateMutation(12, async () => {
    events.push("other:start");
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.ok(events.includes("first:start"));
  assert.ok(events.includes("other:start"), "different tabs should remain concurrent");
  assert.strictEqual(events.includes("second:start"), false, "same-tab mutation must wait");

  releaseFirst();
  await Promise.all([first, second, otherTab]);
  assert.ok(events.indexOf("second:start") > events.indexOf("first:end"));

  await assert.rejects(
    sandbox.queueTabStateMutation(11, async () => {
      throw new Error("synthetic queue failure");
    }),
    /synthetic queue failure/
  );
  assert.strictEqual(await sandbox.queueTabStateMutation(11, async () => "recovered"), "recovered");

  const redactSource = extractFunctionSource(backgroundSource, "redactForTab");
  assert.ok(redactSource.includes("queueTabStateMutation"));
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node tests/security.test.js`

Expected: FAIL because `sandbox.queueTabStateMutation` does not exist.

- [ ] **Step 3: Implement per-tab promise serialization**

Add an internal queue near the background session-state helpers:

```js
const tabStateMutationQueues = new Map();

function queueTabStateMutation(tabId, mutation) {
  const key = typeof tabId === "number" ? tabId : "unknown-tab";
  const previous = tabStateMutationQueues.get(key) || Promise.resolve();
  const queued = previous.catch(() => {}).then(() => mutation());
  tabStateMutationQueues.set(key, queued);
  void queued
    .finally(() => {
      if (tabStateMutationQueues.get(key) === queued) tabStateMutationQueues.delete(key);
    })
    .catch(() => {});
  return queued;
}
```

Rename the current implementation to `performRedactionForTab(...)`, then preserve the public internal entry point as:

```js
function redactForTab(tabId, url, text, findings, options = {}) {
  return queueTabStateMutation(tabId, () =>
    performRedactionForTab(tabId, url, text, findings, options)
  );
}
```

The queue must contain no text, findings, manager state, or raw values.

- [ ] **Step 4: Run GREEN and background safety checks**

Run:

```powershell
node tests/security.test.js
node tests/background_audit_log.test.js
node tests/enterprise_policy.test.js
node --check src/background/core.js
```

Expected: all commands exit 0; same-tab operations serialize, different tabs remain concurrent, and a rejected mutation does not poison later work.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- src/background/core.js tests/security.test.js
git diff --cached --check
git commit -m "fix: serialize tab redaction state"
```

### Task 3: Recover verified Enter sends through the composer form

**Files:**
- Modify: `tests/fallback_send_key_orchestration.test.js`
- Modify: `src/content/composer/fallbackSendKeyOrchestration.js`

**Interfaces:**
- Consumes: existing `findSendButton`, `replayVerifiedSend`, `isWhatsAppHost`, and `blockWhatsAppTextSend` dependencies.
- Produces: internal `replayFallbackSend(input)`; no dependency or payload-shape change.

- [ ] **Step 1: Write failing form-fallback and retained WhatsApp regressions**

Add and invoke these tests:

```js
async function testVerifiedEnterUsesFormFallbackWhenButtonIsMissing() {
  const { orchestration, calls, input } = createHarness({
    findSendButton: () => null
  });

  await orchestration.maybeHandleFallbackSendKey(createEnterEvent(input));

  assert.deepStrictEqual(calls.replays, [{ target: input, form: null, sendButton: null }]);
  assert.deepStrictEqual(calls.blocks, []);
}

async function testWhatsAppMissingReplayButtonStillBlocks() {
  const { orchestration, calls, input } = createHarness({
    findSendButton: () => null,
    isWhatsAppHost: () => true,
    shouldOwnWhatsAppTextSend: () => true
  });

  await orchestration.maybeHandleFallbackSendKey(createEnterEvent(input));

  assert.deepStrictEqual(calls.replays, []);
  assert.deepStrictEqual(calls.blocks, ["replay_button_not_found"]);
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node tests/fallback_send_key_orchestration.test.js`

Expected: FAIL because non-WhatsApp replay is skipped when `findSendButton()` returns null.

- [ ] **Step 3: Centralize the safe replay decision**

Add this helper inside `createFallbackSendKeyOrchestration`:

```js
    function replayFallbackSend(input) {
      const button = findSendButton(input);
      if (!button && isWhatsAppHost()) {
        void blockWhatsAppTextSend("replay_button_not_found");
        return false;
      }
      replayVerifiedSend(input, null, button);
      return true;
    }
```

Replace each duplicated callback body with the helper. The two concrete call shapes are:

```js
        queueVerifiedComposerSend(input, normalized.text, "submit", () => {
          replayFallbackSend(input);
        }, verifiedSendOptions);

        queueVerifiedComposerSend(input, result.redactedText, "submit", () => {
          replayFallbackSend(input);
        }, verifiedSendOptions);
```

Apply the `normalized.text` form to both normalization branches and the `result.redactedText` form to all three redaction branches. Do not change the protection-paused path, queue ownership, or WhatsApp behavior.

- [ ] **Step 4: Run GREEN and interception checks**

Run:

```powershell
node tests/fallback_send_key_orchestration.test.js
node tests/typed_interception.test.js
node tests/submit_orchestration.test.js
node tests/send_button_click_orchestration.test.js
node --check src/content/composer/fallbackSendKeyOrchestration.js
```

Expected: all commands exit 0; replay occurs once through the form-capable function and WhatsApp still blocks a missing replay button.

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- src/content/composer/fallbackSendKeyOrchestration.js tests/fallback_send_key_orchestration.test.js
git diff --cached --check
git commit -m "fix: recover verified enter replay"
```

### Task 4: Publish the concise 3.0.0 reliability record

**Files:**
- Create: `docs/RELEASE_3_0_0_RELIABILITY.md`
- Modify: `docs/RELEASE_QA_CHECKLIST.md`

**Interfaces:**
- Consumes: the completed inventory and final commit/test evidence.
- Produces: a durable internal release record and a discoverable manual-QA link; no product claim that 3.0.0 is already releasable.

- [ ] **Step 1: Write the release reliability document**

Create a compact document with these exact sections:

```markdown
# LeakGuard 3.0.0 Reliability Pass

## Release status
## Failure-path inventory
## Recovery paths implemented
## Blocks intentionally retained
## Known reliability gaps
## Manual QA before 3.0.0
## Validation evidence
## Rollback
```

The inventory table must include one row for every requested area: text submit, paste handling, drag/drop, clipboard image, image attach, PDF, DOCX, XLSX, text-like files, multi-file handoff, ChatGPT, OpenAI, Gemini, Claude, Grok, X, WhatsApp, generic adapter, background/service-worker/state, and options/policy. Use only these labels: `security-required block`, `unsupported-input block`, `recoverable product defect`, `adapter/platform fragility`, `test-only fixture behavior`, and `unclear / needs investigation`.

State that package and manifest identity remain `2.2.1`, authenticated live-site QA is outstanding, and this pass does not itself declare 3.0.0 release-ready.

- [ ] **Step 2: Link the record from release QA**

Add one bullet under `## Before Packaging` in `docs/RELEASE_QA_CHECKLIST.md`:

```markdown
- Review [RELEASE_3_0_0_RELIABILITY.md](RELEASE_3_0_0_RELIABILITY.md) and complete its 3.0.0 reliability/manual-QA gates before changing release identity.
```

- [ ] **Step 3: Validate documentation and patch hygiene**

Run:

```powershell
npm run docs:check-links
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 4: Commit Task 4**

```powershell
git add -- docs/RELEASE_3_0_0_RELIABILITY.md docs/RELEASE_QA_CHECKLIST.md docs/superpowers/plans/2026-07-10-leakguard-3-0-reliability.md
git diff --cached --check
git commit -m "docs: record 3.0 reliability gates"
```

### Task 5: Release-grade verification and independent review

**Files:**
- Verify only; modify files only for a reviewer-confirmed defect.

**Interfaces:**
- Consumes: all Task 1-4 commits.
- Produces: fresh verification evidence and a whole-branch review verdict.

- [ ] **Step 1: Run change-aware and full validation**

```powershell
npm run test:changed
npm test
npm run test:e2e:text
npm run test:e2e:files
npm run test:e2e:images
npm run test:e2e -- --grep @multi
npm run build:chrome
npm run build:firefox
npm run smoke:chrome
npm run smoke:firefox
npm run bench:hotpaths
npm run bench:file-extraction
npm run docs:check-links
git diff --check
git status --short
```

Expected: every command exits 0, no generated `dist/` or artifact files are staged, and the worktree is clean after committed source/docs changes.

Execution evidence (2026-07-11): after the changes were committed, `npm run test:changed` correctly found no uncommitted files requiring selection and the full `npm test` suite passed. An initial `npm run test:e2e:text` invocation reached 82 of 84 selected scenarios before an external 10-minute shell ceiling stopped it; the broad selection was caused by the parent WhatsApp `@text` tag also matching file and image descendants. The superseding full `npm run test:e2e` completed with 106 passed and the intentionally manual `@live` diagnostic skipped, covering all text, file, image, and multi-file cases in one run. Both browser builds and smoke suites, both isolated performance benchmarks, the documentation link check, diff checks, and final clean-worktree check passed. The redundant overlapping tag-specific E2E commands were not rerun separately.

- [ ] **Step 2: Review requirements and security invariants**

Confirm from the final diff that:

- cache authorization uses object identity and no raw `File` is retained in the bounded `Map`;
- same-tab redactions serialize, cross-tab redactions remain concurrent, and queue rejection recovers;
- verified Enter replay is single-owner and WhatsApp retains its block;
- no manifest, permission, CSP, telemetry, network, policy, detector, redaction, OCR, or model behavior changed;
- the release record distinguishes local evidence from outstanding authenticated QA.

- [ ] **Step 3: Dispatch whole-branch code review and resolve findings**

Generate a review package from the branch merge base to `HEAD`, dispatch the `requesting-code-review` reviewer with the design, plan, and package paths, fix every Critical or Important issue, rerun the covering focused tests, and re-review until both specification compliance and code quality are approved.

- [ ] **Step 4: Record final branch evidence**

Run:

```powershell
git branch --show-current
git log --oneline --decorate main..HEAD
git diff --stat main...HEAD
git status --short
```

Expected: branch is `codex/leakguard-3.0-reliability`, commits are intentional and scoped, and the worktree is clean.
