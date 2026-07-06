const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/adapters/geminiUploadDiscovery.js"));

function createElement({
  tagName = "button",
  type = "",
  ariaLabel = "",
  title = "",
  text = "",
  className = "",
  role = "menuitem",
  disabled = false,
  attrs = {}
} = {}) {
  return {
    tagName: tagName.toUpperCase(),
    type,
    ariaLabel,
    title,
    textContent: text,
    className,
    disabled,
    attributes: {
      "aria-label": ariaLabel,
      role,
      class: className,
      ...attrs
    },
    dispatches: [],
    clicked: 0,
    getAttribute(name) {
      return this.attributes[name] || "";
    },
    matches(selector) {
      if (selector === ".cdk-overlay-container, .cdk-overlay-pane, mat-action-list") return false;
      if (selector === "button") return this.tagName === "BUTTON";
      if (selector === "[role='menuitem']") return this.getAttribute("role") === "menuitem";
      if (selector === "input[type='file']") return this.type === "file";
      return false;
    },
    querySelectorAll() {
      return [];
    },
    dispatchEvent(event) {
      this.dispatches.push(event.type);
      return true;
    },
    click() {
      this.clicked += 1;
    }
  };
}

function createDiscovery(elements = [], overrides = {}) {
  const documentRef = {
    querySelectorAll(selector) {
      if (selector === "*") return [];
      return elements.filter((element) => element.matches?.(selector));
    }
  };
  const details = {};
  const discovery = globalThis.PWM.GeminiUploadDiscovery.createGeminiUploadDiscovery({
    documentRef,
    isGeminiHost: () => true,
    isFileInputElement: (element) => element?.type === "file",
    normalizeTarget: (target) => target || null,
    describeElementForDebug: (element, source = "") => ({
      source,
      ariaLabel: element?.ariaLabel || element?.getAttribute?.("aria-label") || "",
      title: element?.title || "",
      textSnippet: element?.textContent || "",
      role: element?.getAttribute?.("role") || ""
    }),
    createGeminiUploadMenuEvent: (type) => ({ type }),
    isSafeGeminiUploadMenuButton: (element) => !element?.disabled,
    isGeminiUploadMenuButtonVisible: (element) => !element?.hidden,
    hasGeminiUploadMenuIntent: (element) => /upload|attach|files/i.test(element?.ariaLabel || element?.textContent || ""),
    isUnsafeGeminiUploadMenuButton: () => false,
    isGeminiSourceUploadIcon: () => false,
    ...overrides
  });
  return { discovery, details };
}

function testOverlayDiscoveryPrefersUploadFilesAndRejectsDrive() {
  const drive = createElement({ ariaLabel: "Drive" });
  const upload = createElement({ ariaLabel: "Upload files. Documents, data, code files" });
  const { discovery, details } = createDiscovery([drive, upload]);

  assert.strictEqual(discovery.discoverGeminiUploadOverlayItem(details), upload);
  assert.strictEqual(details.overlayItemCount, 2);
  assert.strictEqual(details.selectedOverlayItem.ariaLabel, upload.ariaLabel);
}

function testHiddenSelectorActivationDispatchesTrustedSequence() {
  const trigger = createElement({
    tagName: "button",
    className: "hidden-local-file-image-selector-button",
    attrs: {
      xapfileselectortrigger: ""
    }
  });
  const { discovery } = createDiscovery([trigger]);

  assert.strictEqual(discovery.activateGeminiHiddenFileSelectorTriggerSafely(trigger), true);
  assert.deepStrictEqual(trigger.dispatches, ["pointerdown", "mousedown", "mouseup"]);
  assert.strictEqual(trigger.clicked, 1);
}

function run() {
  testOverlayDiscoveryPrefersUploadFilesAndRejectsDrive();
  testHiddenSelectorActivationDispatchesTrustedSequence();
  console.log("PASS Gemini upload discovery");
}

run();
