const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/adapters/grokFileHandoff.js"));

function createElement({
  tagName = "button",
  type = "",
  accept = "",
  multiple = false,
  disabled = false,
  ariaLabel = "",
  title = "",
  text = "",
  className = "",
  role = ""
} = {}) {
  return {
    tagName: tagName.toUpperCase(),
    type,
    accept,
    multiple,
    disabled,
    ariaLabel,
    title,
    textContent: text,
    className,
    attributes: {
      "aria-label": ariaLabel,
      title,
      role
    },
    dispatches: [],
    getAttribute(name) {
      return this.attributes[name] || "";
    },
    closest() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    dispatchEvent(event) {
      this.dispatches.push(event.type);
      return true;
    }
  };
}

function createHandoff(elements = [], overrides = {}) {
  const debugEvents = [];
  const documentElement = {
    querySelectorAll(selector) {
      if (selector === "input[type='file']") {
        return elements.filter((element) => element.type === "file");
      }
      return elements.filter((element) => element.type !== "file");
    }
  };
  const deps = {
    documentRef: {
      documentElement,
      querySelectorAll: documentElement.querySelectorAll.bind(documentElement)
    },
    isGrokHost: () => true,
    isFileInputElement: (element) => element?.type === "file",
    normalizeTarget: (target) => target || null,
    describeElementForDebug: (element) => ({
      ariaLabel: element?.ariaLabel || element?.getAttribute?.("aria-label") || "",
      title: element?.title || "",
      textSnippet: element?.textContent || "",
      className: element?.className || "",
      role: element?.getAttribute?.("role") || ""
    }),
    describeFileInputForDebug: (input, source) => ({
      source,
      accept: input?.accept || "",
      multiple: Boolean(input?.multiple)
    }),
    describeFileForDebug: (file) => ({ name: file?.name || "" }),
    debugReveal: (label, payload) => debugEvents.push({ label, payload }),
    createGeminiUploadMenuEvent: (type) => ({ type }),
    createSanitizedFileHandoffDetails: () => ({}),
    createSanitizedDataTransferForHandoff: (file) => ({ files: [file] }),
    handOffSanitizedFileInput: (input, transfer) => {
      input.files = transfer.files;
      return true;
    },
    logSanitizedFileHandoffFailure: () => {},
    clearPendingGrokSanitizedFileHandoff: (reason) => {
      debugEvents.push({ label: "cleared", payload: { reason } });
    },
    showFileProcessingSuccess: () => {},
    setBadge: () => {},
    hideBadgeSoon: () => {},
    refreshBadgeFromCurrentInput: () => {},
    suppressStaleHandoffErrorAfterSuccess: () => false,
    dispatchSanitizedFileEvent: () => false,
    shouldUseFirefoxTextFallbackForFileHandoff: () => false,
    ...overrides
  };
  return {
    handoff: globalThis.PWM.GrokFileHandoff.createGrokFileHandoff(deps),
    debugEvents
  };
}

function testUploadTargetDetectionUsesSafeAttachIntent() {
  const uploadButton = createElement({ ariaLabel: "Attach files" });
  const sendButton = createElement({ ariaLabel: "Send message" });
  const { handoff } = createHandoff();

  assert.strictEqual(handoff.isLikelyGrokUploadClickTarget(uploadButton), true);
  assert.strictEqual(handoff.isLikelyGrokUploadClickTarget(sendButton), false);
}

async function testPendingAttachAssignsSanitizedFileToDiscoveredInput() {
  const input = createElement({
    tagName: "input",
    type: "file",
    accept: ".txt",
    multiple: true
  });
  const sanitizedFile = { name: "safe.txt" };
  const { handoff, debugEvents } = createHandoff([input]);

  assert.strictEqual(await handoff.performPendingGrokUserAttach({ type: "click" }, null, sanitizedFile), true);
  assert.deepStrictEqual(input.files, [sanitizedFile]);
  assert.ok(debugEvents.some((entry) => entry.label === "grok-pending-user-attach-assigned"));
  assert.ok(debugEvents.some((entry) => entry.label === "cleared" && entry.payload.reason === "assigned"));
}

async function run() {
  testUploadTargetDetectionUsesSafeAttachIntent();
  await testPendingAttachAssignsSanitizedFileToDiscoveredInput();
  console.log("PASS Grok file handoff");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
