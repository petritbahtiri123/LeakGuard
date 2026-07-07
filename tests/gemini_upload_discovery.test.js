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
  hidden = false,
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
    hidden,
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
      if (selector === 'button[aria-label="Open upload file menu"]') {
        return this.tagName === "BUTTON" && this.getAttribute("aria-label") === "Open upload file menu";
      }
      if (selector === "button.upload-card-button") {
        return this.tagName === "BUTTON" && /\bupload-card-button\b/.test(this.className);
      }
      if (selector === "mat-icon.upload-icon") {
        return this.tagName === "MAT-ICON" && /\bupload-icon\b/.test(this.className);
      }
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
      role: element?.getAttribute?.("role") || "",
      className: element?.className || ""
    }),
    createGeminiUploadMenuEvent: (type) => ({ type }),
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

function testFindGeminiUploadMenuButtonPrefersExplicitSafeButton() {
  const send = createElement({ ariaLabel: "Send message", className: "mat-mdc-icon-button" });
  const uploadTools = createElement({ ariaLabel: "Upload & tools", className: "mat-mdc-icon-button" });
  const explicit = createElement({ ariaLabel: "Open upload file menu", className: "upload-card-button open" });
  const { discovery } = createDiscovery([send, uploadTools, explicit]);

  assert.strictEqual(discovery.isSafeGeminiUploadMenuButton(send), false);
  assert.strictEqual(discovery.isSafeGeminiUploadMenuButton(uploadTools), true);
  assert.strictEqual(discovery.findGeminiUploadMenuButton(), explicit);
  assert.strictEqual(discovery.describeGeminiUploadMenuDiscovery().selected.ariaLabel, explicit.ariaLabel);
}

function testFindGeminiUploadMenuButtonUsesSourceIconFallback() {
  const icon = createElement({
    tagName: "mat-icon",
    text: "add_2",
    className: "mat-icon upload-icon"
  });
  const { discovery } = createDiscovery([icon]);

  assert.strictEqual(discovery.isGeminiSourceUploadIcon(icon), true);
  assert.strictEqual(discovery.findGeminiUploadMenuButton(), icon);
}

function testFindGeminiUploadMenuButtonRejectsHiddenButton() {
  const hidden = createElement({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button",
    hidden: true
  });
  const { discovery } = createDiscovery([hidden]);

  assert.strictEqual(discovery.isGeminiUploadMenuButtonVisible(hidden), false);
  assert.strictEqual(discovery.findGeminiUploadMenuButton(), null);
}

function run() {
  testOverlayDiscoveryPrefersUploadFilesAndRejectsDrive();
  testHiddenSelectorActivationDispatchesTrustedSequence();
  testFindGeminiUploadMenuButtonPrefersExplicitSafeButton();
  testFindGeminiUploadMenuButtonUsesSourceIconFallback();
  testFindGeminiUploadMenuButtonRejectsHiddenButton();
  console.log("PASS Gemini upload discovery");
}

run();
