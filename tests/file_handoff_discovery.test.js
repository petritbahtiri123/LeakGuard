const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileHandoffDiscovery.js"));

function createElement({
  tagName = "input",
  type = "",
  accept = "",
  multiple = false,
  disabled = false,
  ariaLabel = "",
  text = "",
  role = "",
  className = ""
} = {}) {
  return {
    tagName: tagName.toUpperCase(),
    type,
    accept,
    multiple,
    disabled,
    ariaLabel,
    textContent: text,
    className,
    attributes: {
      accept,
      "aria-label": ariaLabel,
      role,
      class: className
    },
    files: [],
    getAttribute(name) {
      return this.attributes[name] || "";
    },
    matches(selector) {
      if (selector === "input[type='file']") return this.type === "file";
      if (selector === "[data-upload]") return Boolean(this.attributes["data-upload"]);
      return false;
    },
    closest() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    dispatchEvent(event) {
      this.lastEvent = event.type;
      return true;
    }
  };
}

function createDiscovery(elements = [], overrides = {}) {
  const debugEvents = [];
  const documentRef = {
    querySelectorAll(selector) {
      if (selector === "*") return [];
      if (selector === "input[type='file']") return elements.filter((element) => element.type === "file");
      return elements.filter((element) => element.matches?.(selector));
    }
  };
  const discovery = globalThis.PWM.FileHandoffDiscovery.createFileHandoffDiscovery({
    documentRef,
    isFileInputElement: (element) => element?.type === "file",
    normalizeTarget: (target) => target || null,
    fileInputAcceptsHandoffFiles: (input, files) => {
      if (!input || !files.length) return true;
      return files.length <= 1 || input.multiple === true;
    },
    isWhatsAppHandoffContext: () => false,
    describeElementForDebug: (element) => ({
      ariaLabel: element?.ariaLabel || "",
      title: element?.title || "",
      textSnippet: element?.textContent || "",
      className: element?.className || "",
      role: element?.getAttribute?.("role") || ""
    }),
    describeFileInputForDebug: (input, source) => ({ source, accept: input?.accept || "" }),
    describeFileForDebug: (file) => ({ name: file?.name || "" }),
    describeFileHandoffAdapter: (adapter) => ({ id: adapter?.id || "" }),
    debugReveal: (label, payload) => debugEvents.push({ label, payload }),
    createGeminiUploadMenuEvent: (type) => ({ type }),
    createSanitizedFileHandoffDetails: () => ({}),
    createSanitizedDataTransferForHandoff: (file) => ({ files: [file] }),
    handOffSanitizedFileInput: (input, transfer) => {
      input.files = transfer.files;
      return true;
    },
    logSanitizedFileHandoffFailure: () => {},
    clearPendingSanitizedFileHandoff: (adapter, reason) => {
      debugEvents.push({ label: "cleared", payload: { adapter: adapter?.id, reason } });
    },
    isFileHandoffAdapterPendingAttachEnabled: () => true,
    ...overrides
  });
  return { discovery, debugEvents };
}

function testResolveFileInputPrefersCompatibleMultipleInput() {
  const single = createElement({ type: "file" });
  const multiple = createElement({ type: "file", multiple: true });
  const { discovery } = createDiscovery([single, multiple]);

  assert.strictEqual(
    discovery.resolveFileInputForHandoff({ target: null }, null, { expectedFiles: [{ name: "a" }, { name: "b" }] }),
    multiple
  );
}

function testGenericUploadIntentRejectsUnsafeSendTarget() {
  const attach = createElement({ tagName: "button", ariaLabel: "Attach file" });
  const send = createElement({ tagName: "button", ariaLabel: "Send message" });
  const adapter = { id: "chatgpt", uploadButtonSelectors: [] };
  const { discovery } = createDiscovery();

  assert.strictEqual(discovery.isLikelyGenericUploadClickTarget(adapter, attach), true);
  assert.strictEqual(discovery.isLikelyGenericUploadClickTarget(adapter, send), false);
}

async function testGenericPendingAttachAssignsAndClears() {
  const input = createElement({ type: "file" });
  const adapter = { id: "chatgpt", pendingAttachEnabled: true };
  const sanitizedFile = { name: "safe.txt" };
  const { discovery, debugEvents } = createDiscovery([input]);

  assert.strictEqual(await discovery.attachGenericPendingWithTrustedActivation(adapter, { sanitizedFile }), true);
  assert.deepStrictEqual(input.files, [sanitizedFile]);
  assert.ok(debugEvents.some((entry) => entry.label === "cleared" && entry.payload.reason === "assigned"));
}

async function run() {
  testResolveFileInputPrefersCompatibleMultipleInput();
  testGenericUploadIntentRejectsUnsafeSendTarget();
  await testGenericPendingAttachAssignsAndClears();
  console.log("PASS file handoff discovery");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
