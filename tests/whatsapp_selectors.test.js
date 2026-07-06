const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/whatsapp/whatsappSelectors.js"));

function createElement({ tagName = "input", accept = "", ariaLabel = "", disabled = false, scope = true } = {}) {
  return {
    tagName: tagName.toUpperCase(),
    type: tagName === "input" ? "file" : "",
    accept,
    disabled,
    clicked: 0,
    attributes: {
      accept,
      "aria-label": ariaLabel,
      disabled: disabled ? "" : undefined
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === "accept") this.accept = String(value);
    },
    removeAttribute(name) {
      delete this.attributes[name];
      if (name === "disabled") this.disabled = false;
    },
    closest(selector) {
      return scope && selector ? {} : null;
    },
    click() {
      this.clicked += 1;
    }
  };
}

function createSelectors(elements, overrides = {}) {
  const documentElement = {};
  const selectors = globalThis.PWM.WhatsAppSelectors.createWhatsAppSelectors({
    documentRef: {
      documentElement,
      body: documentElement,
      querySelectorAll(selector) {
        if (selector === "input[type='file']") {
          return elements.filter((element) => element.tagName === "INPUT");
        }
        if (selector.includes("aria-label")) {
          return elements.filter((element) => element.tagName !== "INPUT");
        }
        return [];
      }
    },
    setTimeoutFn: (callback) => {
      callback();
      return 1;
    },
    clearTimeoutFn: () => {},
    MutationObserverRef: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        this.callback();
      }
      disconnect() {}
    },
    isFileInputElement: (element) => element?.tagName === "INPUT" && element.type === "file",
    fileInputAcceptsHandoffFiles: (input, files) => {
      const accept = String(input?.accept || "").toLowerCase();
      return files.every((file) => accept === "*" || accept === "*/*" || accept.includes(file.ext));
    },
    isSupportedWhatsAppAttachImageFile: (file) => String(file?.type || "").startsWith("image/"),
    isWhatsAppHandoffContext: () => true,
    ...overrides
  });
  return selectors;
}

function testDocumentInputGateRequiresNonImageFiles() {
  const selectors = createSelectors([]);

  assert.strictEqual(selectors.shouldUseWhatsAppDocumentInputForFiles([{ type: "image/png" }]), false);
  assert.strictEqual(selectors.shouldUseWhatsAppDocumentInputForFiles([{ type: "application/pdf" }]), true);
}

async function testResolveUsesExistingOrDisabledScopedInput() {
  const pdf = { type: "application/pdf", ext: ".pdf" };
  const existing = createElement({ accept: ".pdf" });
  const selectors = createSelectors([existing]);

  assert.strictEqual(await selectors.resolveWhatsAppDocumentDropInputForHandoff({}, {}, [pdf]), existing);

  const disabled = createElement({ accept: ".pdf", disabled: true });
  const disabledSelectors = createSelectors([disabled]);
  assert.strictEqual(await disabledSelectors.resolveWhatsAppDocumentDropInputForHandoff({}, {}, [pdf]), disabled);
  assert.strictEqual(disabled.disabled, false);
}

async function testResolveClicksAttachThenDocumentMenu() {
  const pdf = { type: "application/pdf", ext: ".pdf" };
  const attach = createElement({ tagName: "button", ariaLabel: "Attach" });
  const menu = createElement({ tagName: "button", ariaLabel: "Document" });
  const input = createElement({ accept: ".pdf" });
  let inputVisible = false;
  const selectors = createSelectors([attach, menu, input], {
    documentRef: {
      documentElement: {},
      body: {},
      querySelectorAll(selector) {
        if (selector === "input[type='file']") return inputVisible ? [input] : [];
        if (selector.includes("aria-label")) return [attach, menu];
        return [];
      }
    }
  });
  menu.click = () => {
    menu.clicked += 1;
    inputVisible = true;
  };

  assert.strictEqual(await selectors.resolveWhatsAppDocumentDropInputForHandoff({}, {}, [pdf]), input);
  assert.strictEqual(attach.clicked, 1);
  assert.strictEqual(menu.clicked, 1);
}

testDocumentInputGateRequiresNonImageFiles();
testResolveUsesExistingOrDisabledScopedInput().then(() =>
  testResolveClicksAttachThenDocumentMenu()
).then(() => {
  console.log("PASS WhatsApp selectors");
});
