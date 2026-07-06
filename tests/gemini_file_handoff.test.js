const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/adapters/geminiFileHandoff.js"));

function createFileInput() {
  return {
    type: "file",
    files: [],
    events: [],
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    }
  };
}

function createHandoff(overrides = {}) {
  const calls = {
    clears: [],
    debug: [],
    failures: [],
    successes: []
  };
  const input = createFileInput();
  const deps = {
    documentRef: {
      body: {},
      documentElement: {},
      addEventListener() {},
      removeEventListener() {}
    },
    windowRef: {
      addEventListener() {},
      removeEventListener() {}
    },
    locationRef: { hostname: "gemini.google.com" },
    DataTransferRef: class {
      constructor() {
        this.files = [];
        this.items = {
          add: (file) => this.files.push(file)
        };
      }
    },
    MutationObserverRef: null,
    setTimeoutFn: (callback) => {
      callback();
      return 0;
    },
    clearTimeoutFn: () => {},
    isGeminiHost: () => true,
    isFirefoxRuntime: () => true,
    isFileInputElement: (candidate) => candidate?.type === "file",
    canUseSyntheticDataTransferFileList: () => true,
    shouldUseFirefoxTextFallbackForFileHandoff: () => false,
    createSanitizedFileHandoffDetails: () => ({}),
    createSanitizedDataTransferForHandoff: (file) => ({
      files: Array.isArray(file) ? file.filter(Boolean) : [file].filter(Boolean)
    }),
    handOffSanitizedFileInput: (targetInput, transfer) => {
      targetInput.files = transfer.files;
      targetInput.dispatchEvent({ type: "input" });
      targetInput.dispatchEvent({ type: "change" });
      return true;
    },
    findGeminiFileInput: () => ({ discovery: { fileInputCount: 1, openShadowRootCount: 0 }, fileInput: input }),
    discoverGeminiFileHandoffElements: () => ({ fileInput: input, fileInputCount: 1, openShadowRootCount: 0 }),
    findGeminiUploadFilesMenuItem: () => null,
    findGeminiUploadMenuButton: () => null,
    openGeminiUploadMenuSafely: () => false,
    openGeminiUploadFilesMenuItemSafely: () => false,
    waitForGeminiUploadFilesMenuItem: async () => null,
    findGeminiHiddenFileSelectorTrigger: () => null,
    activateGeminiHiddenFileSelectorTriggerSafely: () => false,
    findGeminiFileDataInputFromEvent: () => null,
    findGeminiFileDataInputInMutations: () => null,
    isAllowedGeminiUploadMenuOpener: () => false,
    shouldQueueFirefoxGeminiPendingSanitizedFileHandoff: () => false,
    queuePendingSanitizedFileHandoff: () => false,
    getFileHandoffAdapterById: () => ({ id: "gemini" }),
    hasPendingGeminiSanitizedFileHandoff: () => false,
    suppressStaleHandoffErrorAfterSuccess: () => false,
    listLocalTransferFiles: (transfer) => Array.from(transfer?.files || []),
    describeFileForDebug: (file) => ({ name: file?.name || "" }),
    describeFileInputForDebug: () => ({ source: "test" }),
    describeElementForDebug: () => ({}),
    describeGeminiUploadMenuDiscovery: () => ({}),
    describeGeminiOverlayExposure: () => ({}),
    describeSanitizedFileOrBatchForDebug: (files) => ({ fileCount: Array.from(files || []).length }),
    debugReveal: (label, payload) => calls.debug.push({ label, payload }),
    debugFileAttachMetadata: (label, payload) => calls.debug.push({ label, payload }),
    assignSafeFileAttachErrorMetadata: () => {},
    logSanitizedFileHandoffFailure: (details) => calls.failures.push(details),
    clearPendingGeminiSanitizedFileHandoff: (reason) => calls.clears.push(reason),
    clearPendingGeminiGhostIngressClickInterceptor: () => {},
    showFileProcessingSuccess: (message, payload) => calls.successes.push({ message, payload }),
    setBadge: () => {},
    hideBadgeSoon: () => {},
    refreshBadgeFromCurrentInput: () => {},
    countGeminiAttachmentIndicators: () => 0,
    waitForGeminiAttachmentIndicators: async () => 0,
    ...overrides
  };
  return {
    handoff: globalThis.PWM.GeminiFileHandoff.createGeminiFileHandoff(deps),
    calls,
    input
  };
}

async function testFirefoxBridgeAssignsSanitizedFileOnly() {
  const rawFile = { name: "raw.env" };
  const sanitizedFile = { name: "safe.env" };
  const { handoff, input } = createHandoff();

  const result = await handoff.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile },
    { event: { type: "drop", dataTransfer: { files: [rawFile] } }, input: null }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(input.files.length, 1);
  assert.strictEqual(input.files[0], sanitizedFile);
  assert.strictEqual(input.files.includes(rawFile), false);
}

async function testPendingUserAttachClearsAfterVerifiedAssignment() {
  const sanitizedFiles = [{ name: "one.txt" }, { name: "two.txt" }];
  const { handoff, calls, input } = createHandoff();

  assert.strictEqual(await handoff.performPendingGeminiUserAttach({ type: "click" }, null, sanitizedFiles), true);
  assert.deepStrictEqual(input.files, sanitizedFiles);
  assert.deepStrictEqual(input.events, ["input", "change"]);
  assert.deepStrictEqual(calls.clears, ["assigned"]);
  assert.strictEqual(calls.failures.length, 0);
}

async function run() {
  await testFirefoxBridgeAssignsSanitizedFileOnly();
  await testPendingUserAttachClearsAfterVerifiedAssignment();
  console.log("PASS Gemini file handoff");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
