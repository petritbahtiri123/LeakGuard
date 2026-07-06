const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileProcessingUi.js"));

function createElement(tagName) {
  const children = [];
  const listeners = {};
  const element = {
    tagName: String(tagName || "").toUpperCase(),
    className: "",
    textContent: "",
    dataset: {},
    attributes: {},
    parentNode: null,
    isConnected: false,
    children,
    listeners,
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    append(...items) {
      items.forEach((item) => this.appendChild(item));
    },
    appendChild(item) {
      item.parentNode = this;
      item.isConnected = true;
      children.push(item);
      return item;
    },
    removeChild(item) {
      const index = children.indexOf(item);
      if (index !== -1) children.splice(index, 1);
      item.parentNode = null;
      item.isConnected = false;
      return item;
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    }
  };
  return element;
}

function createUi(overrides = {}) {
  const calls = {
    debug: [],
    metadata: [],
    timeouts: [],
    errors: [],
    actions: []
  };
  const documentElement = createElement("html");
  const documentRef = {
    documentElement,
    createElement
  };
  const ui = globalThis.PWM.FileProcessingUi.createFileProcessingUi({
    documentRef,
    getCurrentHandoffDriverId: () => "gemini",
    setTimeoutFn: (callback, delay) => {
      calls.timeouts.push({ callback, delay });
      return calls.timeouts.length;
    },
    clearTimeoutFn: () => {},
    debugReveal: (label, payload) => calls.debug.push({ label, payload }),
    debugFileAttachMetadata: (label, payload) => calls.metadata.push({ label, payload }),
    contentDebugEvents: {
      FILE_UI_PROCESSING_SHOWN: "file-ui:processing-shown",
      PENDING_ATTACH_PROMPT_SHOWN: "pending-attach-prompt-shown",
      FILE_HANDOFF_PENDING_PROMPT_SHOWN: "file-handoff:pending-prompt-shown",
      FILE_UI_PENDING_PROMPT_SHOWN: "file-ui:pending-prompt-shown"
    },
    geminiPendingMessage: "Large file sanitized. Click Attach sanitized file or Gemini Upload files.",
    grokPendingMessage: "Large file sanitized. Click Attach sanitized file or Grok Upload/Attach.",
    describeSanitizedFileOrBatchForDebug: () => ({ fileCount: 1 }),
    describeFileHandoffAdapter: (adapter) => ({ id: adapter?.id || "" }),
    getFileHandoffAdapterById: (id) => ({ id }),
    getFileHandoffAdapterForLocation: () => ({ id: "gemini" }),
    attachPendingSanitizedFileWithTrustedActivation: async () => calls.actions.push("attach"),
    insertPendingSanitizedFileText: async () => calls.actions.push("insert"),
    downloadPendingSanitizedFile: async () => calls.actions.push("download"),
    cancelPendingSanitizedFileAttach: () => calls.actions.push("cancel"),
    handleContentError: (error) => calls.errors.push(error),
    ...overrides
  });

  return { ui, calls, documentElement };
}

function testFormatsProgressSafely() {
  const { ui } = createUi();

  assert.strictEqual(ui.formatFileProcessingProgress(42.4), "42%");
  assert.strictEqual(ui.formatFileProcessingProgress({ bytesProcessed: 5, totalBytes: 10 }), "50%");
  assert.strictEqual(ui.formatFileProcessingProgress({ chunksProcessed: 2 }), "2 chunks");
  assert.strictEqual(ui.formatFileProcessingProgress("  scanning   locally  "), "scanning locally");
  assert.deepStrictEqual(ui.describeFileProcessingProgress({ processedBytes: 3, bytesTotal: 6 }), {
    text: "50%",
    bytesProcessed: 3,
    totalBytes: 6,
    chunks: 0
  });
}

function testOverlayRenderUpdateSuccessAndHide() {
  const { ui, calls, documentElement } = createUi();

  const overlay = ui.showFileProcessingOverlay({
    site: "gemini",
    title: "Scanning",
    status: "Reading",
    progress: 25
  });

  assert.ok(overlay);
  assert.strictEqual(documentElement.children.includes(overlay), true);
  assert.strictEqual(overlay.dataset.pwmSite, "gemini");
  assert.strictEqual(overlay.dataset.pwmState, "processing");
  assert.strictEqual(overlay.children[0].children[0].textContent, "Scanning");
  assert.strictEqual(overlay.children[0].children[1].textContent, "Reading");
  assert.strictEqual(overlay.children[0].children[2].textContent, "25%");

  ui.updateFileProcessingOverlay({ status: "Writing", progress: "Complete", blocking: false });
  assert.strictEqual(overlay.children[0].children[1].textContent, "Writing");
  assert.strictEqual(overlay.children[0].children[2].textContent, "Complete");
  assert.strictEqual(overlay.dataset.pwmBlocking, "false");

  ui.showFileProcessingSuccess("Sanitized file attached.", { hideAfterMs: 10 });
  assert.strictEqual(overlay.dataset.pwmState, "success");
  assert.strictEqual(calls.timeouts[0].delay, 10);

  ui.hideFileProcessingOverlay("done");
  assert.strictEqual(overlay.isConnected, false);
  assert.ok(calls.metadata.some((entry) => entry.label === "file-ui:processing-hidden"));
}

async function testPendingPromptRendersAndActions() {
  const { ui, calls, documentElement } = createUi();
  const prompt = ui.showPendingSanitizedAttachPrompt("gemini", {
    site: "gemini",
    sanitizedFile: { name: "safe.txt" },
    event: {},
    input: {}
  });

  assert.ok(prompt);
  assert.strictEqual(documentElement.children.includes(prompt), true);
  assert.strictEqual(prompt.dataset.pwmSite, "gemini");
  assert.strictEqual(ui.getPendingSanitizedAttachPromptMessage("grok"), "Large file sanitized. Click Attach sanitized file or Grok Upload/Attach.");

  const actions = prompt.children[0].children[2];
  await actions.children[0].listeners.click({
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {}
  });

  assert.deepStrictEqual(calls.actions, ["attach"]);
  ui.clearPendingSanitizedAttachPrompt("done");
  assert.strictEqual(prompt.isConnected, false);
}

testFormatsProgressSafely();
testOverlayRenderUpdateSuccessAndHide();
testPendingPromptRendersAndActions().then(() => {
  console.log("PASS file processing UI");
});
