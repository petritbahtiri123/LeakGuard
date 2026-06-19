const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
require(path.join(repoRoot, "src/content/files/fileAttachPipeline.js"));
const { createPendingSanitizedFileHandoffManager } = require(path.join(
  repoRoot,
  "src/content/files/pendingSanitizedFileHandoff.js"
));
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");

function createSanitizedFile(name, text = "API_KEY=[PWM_1]") {
  return {
    name,
    type: "text/plain",
    size: text.length,
    async text() {
      return text;
    }
  };
}

function createHarness({ site = "gemini", fileInputs = [], now = 1000 } = {}) {
  const debugEvents = [];
  const prompts = [];
  const timers = [];
  const removedClickHandlers = [];
  const failures = [];
  let clickHandler = null;
  let clock = now;
  const documentRef = {
    documentElement: {},
    addEventListener(type, handler) {
      if (type === "click") clickHandler = handler;
    },
    removeEventListener(type, handler) {
      if (type === "click" && handler === clickHandler) {
        removedClickHandlers.push(handler);
        clickHandler = null;
      }
    }
  };
  const observers = [];
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
    trigger() {
      this.callback();
    }
  }
  const manager = createPendingSanitizedFileHandoffManager({
    documentRef,
    mutationObserverCtor: FakeMutationObserver,
    setTimeoutFn(callback, delay) {
      const timer = { id: timers.length + 1, callback, delay };
      timers.push(timer);
      return timer.id;
    },
    clearTimeoutFn(id) {
      const timer = timers.find((entry) => entry.id === id);
      if (timer) timer.cleared = true;
    },
    debugReveal: (label, payload) => debugEvents.push({ label, payload }),
    isGeminiHost: () => site === "gemini",
    isGrokHost: () => site === "grok",
    getGeminiSessionHash: () => "session-safe",
    discoverGeminiFileHandoffElements: () => ({ fileInput: fileInputs[0] || null, fileInputCount: fileInputs.length, openShadowRootCount: 0 }),
    discoverGrokPendingFileInput: () => ({ fileInput: fileInputs[0] || null, fileInputCount: fileInputs.length, openShadowRootCount: 0 }),
    describeGeminiHandoffDiscovery: (discovery) => ({ fileInputCount: discovery.fileInputCount || 0 }),
    describeGrokPendingInputDiscovery: (discovery) => ({ fileInputCount: discovery.fileInputCount || 0 }),
    describeGeminiOverlayExposure: () => ({ overlayCandidates: [] }),
    describeFileForDebug: (file) => ({ name: "file." + String(file?.name || "").split(".").pop(), type: file?.type || "", size: file?.size || 0 }),
    describeFileInputForDebug: (input) => ({ filesLength: input?.files?.length || 0, multiple: Boolean(input?.multiple) }),
    describeElementForDebug: () => ({ tag: "button" }),
    createSanitizedDataTransferForHandoff(files) {
      const normalized = Array.isArray(files) ? files : [files];
      return { files: normalized };
    },
    handOffSanitizedFileInput(input, transfer) {
      input.files = transfer.files;
      input.events = ["input", "change"];
      return true;
    },
    createSanitizedFileHandoffDetails: () => ({}),
    logSanitizedFileHandoffFailure: (details) => failures.push(details),
    showPendingSanitizedAttachPrompt: (_adapter, pending) => prompts.push(pending),
    getFileHandoffAdapterById: (id) => ({ id }),
    getPendingSanitizedAttachPromptMessage: (id) => `${id} pending`,
    isLikelyGeminiUploadClickTarget: () => true,
    isLikelyGrokUploadClickTarget: () => true,
    setBadge() {},
    hideBadgeSoon() {},
    refreshBadgeFromCurrentInput() {},
    clearPendingSanitizedAttachPrompt() {},
    clearPendingGeminiGhostIngressClickInterceptor() {},
    DateNow: () => clock
  });
  return { manager, debugEvents, prompts, timers, removedClickHandlers, failures, observers, get clickHandler() { return clickHandler; }, advance(ms) { clock += ms; } };
}

function createInput() {
  return { multiple: true, files: [], events: [] };
}

function testGeminiMultiFilePendingQueuesSanitizedOnlyAndRetriesInOrder() {
  const files = [createSanitizedFile("one.env"), createSanitizedFile("two.json"), createSanitizedFile("three.log")];
  const input = createInput();
  const harness = createHarness({ site: "gemini", fileInputs: [input] });
  const queued = harness.manager.queuePendingGeminiSanitizedFileHandoff({ type: "drop", target: {} }, null, files, {});
  assert.strictEqual(queued, true);
  assert.strictEqual(harness.manager.hasPendingGeminiSanitizedFileHandoff(), true);
  const pendingDebug = harness.manager.getPendingGeminiSanitizedFileHandoffDebug();
  assert.deepStrictEqual(pendingDebug.sanitizedFilesDebug.map((item) => item.label), ["file-1", "file-2", "file-3"]);
  assert.strictEqual(JSON.stringify(pendingDebug).includes("one.env"), false);
  assert.strictEqual(JSON.stringify(pendingDebug).includes("API_KEY"), false);
  assert.strictEqual(harness.prompts[0].sanitizedFiles.length, files.length);
  assert.deepStrictEqual(harness.prompts[0].sanitizedFiles.map((file) => file.name), ["file-1.env", "file-2.json", "file-3.log"]);

  const attached = harness.manager.attemptPendingGeminiSanitizedFileHandoff("retry");
  assert.strictEqual(attached, true);
  assert.deepStrictEqual(input.files.map((file) => file.name), ["file-1.env", "file-2.json", "file-3.log"]);
  assert.deepStrictEqual(input.events, ["input", "change"]);
  assert.strictEqual(harness.manager.hasPendingGeminiSanitizedFileHandoff(files), false);
}

function testGrokMultiFilePendingQueuesSanitizedOnlyAndRetriesInOrder() {
  const files = [createSanitizedFile("first.env"), createSanitizedFile("second.md")];
  const input = createInput();
  const harness = createHarness({ site: "grok", fileInputs: [input] });
  const queued = harness.manager.queuePendingGrokSanitizedFileHandoff({ type: "drop", target: {} }, null, files, {});
  assert.strictEqual(queued, true);
  assert.strictEqual(harness.manager.hasPendingGrokSanitizedFileHandoff(), true);
  const attached = harness.manager.attemptPendingGrokSanitizedFileHandoff("retry");
  assert.strictEqual(attached, true);
  assert.deepStrictEqual(input.files.map((file) => file.name), ["file-1.env", "file-2.md"]);
}

function testInvalidOrTooManyFilesNeverQueue() {
  const harness = createHarness({ site: "gemini" });
  assert.strictEqual(
    harness.manager.queuePendingGeminiSanitizedFileHandoff({ type: "drop", target: {} }, null, Array.from({ length: 6 }, (_, index) => createSanitizedFile(`${index}.env`)), {}),
    false
  );
  assert.strictEqual(
    harness.manager.queuePendingGeminiSanitizedFileHandoff({ type: "drop", target: {} }, null, [createSanitizedFile("safe.env"), { name: "raw.env", rawFile: true }], {}),
    false
  );
  assert.strictEqual(
    harness.manager.queuePendingGeminiSanitizedFileHandoff({ type: "drop", target: {} }, null, [createSanitizedFile("safe.env"), { name: "raw.env", originalFile: {} }], {}),
    false
  );
  assert.strictEqual(
    harness.manager.queuePendingGeminiSanitizedFileHandoff({ type: "drop", target: {} }, null, [createSanitizedFile("safe.env"), { name: "raw.env", rawText: "API_KEY=raw" }], {}),
    false
  );
  assert.strictEqual(harness.manager.getPendingGeminiSanitizedFileHandoffDebug(), null);
}

function testExpiredAndReplacedPendingBatchesCleanUp() {
  const first = [createSanitizedFile("first.env"), createSanitizedFile("first.json")];
  const second = [createSanitizedFile("second.env"), createSanitizedFile("second.json")];
  const harness = createHarness({ site: "gemini" });
  assert.strictEqual(harness.manager.queuePendingGeminiSanitizedFileHandoff({ type: "drop", target: {} }, null, first, {}), true);
  assert.strictEqual(harness.manager.queuePendingGeminiSanitizedFileHandoff({ type: "drop", target: {} }, null, second, {}), true);
  assert.strictEqual(harness.manager.hasPendingGeminiSanitizedFileHandoff(first), false);
  assert.strictEqual(harness.manager.hasPendingGeminiSanitizedFileHandoff(), true);
  assert.ok(harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-pending-cleared" && entry.payload.reason === "replaced"));
  const expiry = harness.timers.find((timer) => timer.delay === 60000 && !timer.cleared);
  assert.ok(expiry);
  expiry.callback();
  assert.strictEqual(harness.manager.hasPendingGeminiSanitizedFileHandoff(second), false);
  assert.ok(harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-pending-cleared" && entry.payload.reason === "expired"));
}

function testMissingInputFailsClosedWithoutRawReplay() {
  const files = [createSanitizedFile("one.env"), createSanitizedFile("two.env")];
  const harness = createHarness({ site: "grok", fileInputs: [] });
  assert.strictEqual(harness.manager.queuePendingGrokSanitizedFileHandoff({ type: "drop", target: {} }, null, files, {}), true);
  assert.strictEqual(harness.manager.attemptPendingGrokSanitizedFileHandoff("retry"), false);
  assert.strictEqual(harness.failures.length, 0);
  assert.ok(harness.debugEvents.some((entry) => entry.label === "file-handoff:grok-pending-input-not-found"));
}

function testRawFilenamesAreReplacedWithSafePendingLabels() {
  const rawFilename = "sk-live-raw-token-value.env";
  const files = [createSanitizedFile(rawFilename), createSanitizedFile("safe.log")];
  const input = createInput();
  const harness = createHarness({ site: "gemini", fileInputs: [input] });
  assert.strictEqual(harness.manager.queuePendingGeminiSanitizedFileHandoff({ type: "drop", target: {} }, null, files, {}), true);
  const debugJson = JSON.stringify(harness.manager.getPendingGeminiSanitizedFileHandoffDebug());
  const promptJson = JSON.stringify(harness.prompts[0]);
  assert.strictEqual(debugJson.includes(rawFilename), false);
  assert.strictEqual(promptJson.includes(rawFilename), false);
  assert.deepStrictEqual(harness.prompts[0].sanitizedFiles.map((file) => file.name), ["file-1.env", "file-2.log"]);
  assert.strictEqual(harness.manager.attemptPendingGeminiSanitizedFileHandoff("retry"), true);
  assert.deepStrictEqual(input.files.map((file) => file.name), ["file-1.env", "file-2.log"]);
}

function testContentQueuesOnlyGeminiGrokCleanSanitizedBatchesAfterDirectFailure() {
  assert.ok(contentSource.includes("multi-file-pending-sanitized-file-handoff"));
  assert.ok(contentSource.includes("pendingAdapter.id === \"gemini\" || pendingAdapter.id === \"grok\""));
  assert.ok(contentSource.includes("!blockedItems.length"));
  assert.ok(contentSource.includes("formatMultiFileStatusMessage(statusSummary)"));
  assert.ok(contentSource.includes("formatMultiFileStatusMessage(handoffFailedSummary)"));
  assert.ok(contentSource.includes("sanitizedFiles.length <= MAX_MULTI_FILE_ATTACHMENTS"));
  assert.ok(contentSource.includes("queuePendingSanitizedFileHandoff(pendingAdapter, event, input, sanitizedFiles, details)"));
}

testGeminiMultiFilePendingQueuesSanitizedOnlyAndRetriesInOrder();
testGrokMultiFilePendingQueuesSanitizedOnlyAndRetriesInOrder();
testInvalidOrTooManyFilesNeverQueue();
testExpiredAndReplacedPendingBatchesCleanUp();
testMissingInputFailsClosedWithoutRawReplay();
testRawFilenamesAreReplacedWithSafePendingLabels();
testContentQueuesOnlyGeminiGrokCleanSanitizedBatchesAfterDirectFailure();

console.log("PASS pending multi-file sanitized handoff regressions");
