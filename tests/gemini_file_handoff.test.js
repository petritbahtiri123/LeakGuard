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

function createFileInputCandidate({
  name = "",
  accept = "",
  multiple = false,
  hidden = false,
  disabled = false,
  parentElement = null,
  rootHost = null
} = {}) {
  return {
    type: "file",
    name,
    accept,
    multiple,
    hidden,
    disabled,
    parentElement,
    getAttribute(attribute) {
      if (attribute === "name") return name;
      if (attribute === "accept") return accept;
      return "";
    },
    matches(selector) {
      return selector === 'input[type="file"][name="Filedata"]' && name === "Filedata";
    },
    getRootNode() {
      return rootHost ? { host: rootHost } : null;
    }
  };
}

function createGeminiDiscoveryHandoff(overrides = {}) {
  const deps = {
    documentRef: {
      querySelectorAll() {
        return [];
      }
    },
    MutationObserverRef: null,
    setTimeoutFn: (callback) => {
      callback();
      return 0;
    },
    clearTimeoutFn: () => {},
    isGeminiHost: () => true,
    isFirefoxRuntime: () => false,
    isFileInputElement: (candidate) => candidate?.type === "file",
    normalizeTarget: (target) => target || null,
    canUseSyntheticDataTransferFileList: () => true,
    shouldUseFirefoxTextFallbackForFileHandoff: () => false,
    describeFileInputForDebug: (input, source = "") => ({ source, name: input?.name || "" }),
    describeElementForDebug: (element, source = "") => ({
      source,
      ariaLabel: element?.ariaLabel || "",
      textSnippet: element?.textContent || "",
      title: element?.title || ""
    }),
    describeUploadTriggerForDebug: (element, source = "") => ({
      source,
      ariaLabel: element?.ariaLabel || "",
      textSnippet: element?.textContent || "",
      title: element?.title || ""
    }),
    ...overrides
  };
  return globalThis.PWM.GeminiFileHandoff.createGeminiFileHandoff(deps);
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

function testGeminiDiscoveryScoresFiledataAndPrefersAddFilesTrigger() {
  const genericInput = createFileInputCandidate({ accept: "text/plain" });
  const fileDataInput = createFileInputCandidate({ name: "Filedata", multiple: true });
  const addFilesTrigger = { ariaLabel: "Add files" };
  const uploadMenuTrigger = { ariaLabel: "Open upload file menu" };
  const handoff = createGeminiDiscoveryHandoff({
    collectFileHandoffElementsFromRoot: (_root, addInput, addUploadTrigger, _visitedRoots, stats) => {
      stats.openShadowRootCount = 1;
      addInput(genericInput, "document");
      addInput(fileDataInput, "images-files-uploader");
      addUploadTrigger(uploadMenuTrigger, "button", "document");
      addUploadTrigger(addFilesTrigger, "button", "document");
    },
    isSafeGeminiUploadMenuButton: (candidate) => candidate === uploadMenuTrigger
  });

  const discovery = handoff.discoverGeminiFileHandoffElements({ target: null }, null);
  const summary = handoff.describeGeminiHandoffDiscovery(discovery);

  assert.strictEqual(discovery.fileInput, fileDataInput);
  assert.strictEqual(discovery.uploadTrigger, addFilesTrigger);
  assert.strictEqual(discovery.openShadowRootCount, 1);
  assert.ok(handoff.scoreGeminiFileInput(fileDataInput, "images-files-uploader") > handoff.scoreGeminiFileInput(genericInput, "document"));
  assert.strictEqual(summary.selectedFileInput.name, "Filedata");
  assert.strictEqual(summary.uploadTriggerCandidates.length, 2);
}

function testGeminiGhostIngressRecognizesFiledataAndUploaderAncestry() {
  const uploader = { tagName: "images-files-uploader" };
  const fileDataInput = createFileInputCandidate({ name: "Filedata" });
  const nestedInput = createFileInputCandidate({ rootHost: uploader });
  const handoff = createGeminiDiscoveryHandoff();

  assert.strictEqual(handoff.isGeminiGhostIngressFileInput(fileDataInput), true);
  assert.strictEqual(handoff.isWithinGeminiImagesFilesUploader(nestedInput), true);
  assert.strictEqual(handoff.isGeminiGhostIngressFileInput(nestedInput), true);
}

async function testGeminiAttachmentIndicatorsCountAndWaitWithoutObserver() {
  const indicator = {};
  const handoff = createGeminiDiscoveryHandoff({
    documentRef: {
      documentElement: {},
      querySelectorAll(selector) {
        if (selector === "*") return [];
        if (selector === "file-preview") return [indicator];
        return [];
      }
    },
    MutationObserverRef: null
  });

  assert.strictEqual(handoff.countGeminiAttachmentIndicators(), 1);
  assert.strictEqual(await handoff.waitForGeminiAttachmentIndicators(0), 1);
}

async function run() {
  await testFirefoxBridgeAssignsSanitizedFileOnly();
  await testPendingUserAttachClearsAfterVerifiedAssignment();
  testGeminiDiscoveryScoresFiledataAndPrefersAddFilesTrigger();
  testGeminiGhostIngressRecognizesFiledataAndUploaderAncestry();
  await testGeminiAttachmentIndicatorsCountAndWaitWithoutObserver();
  console.log("PASS Gemini file handoff");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
