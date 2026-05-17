const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer_helpers.js"));

const {
  buildRiskFingerprint,
  normalizeComposerText,
  spliceSelectionText
} = globalThis.PWM.ComposerHelpers;

const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");

function extractFunctionSource(source, name) {
  const match = source.match(new RegExp(`(?:async\\s+)?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`));
  assert.ok(match, `expected to find function ${name}`);
  return match[0];
}

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.immediatePropagationStopped = false;
    Object.assign(this, options);
  }

  preventDefault() {
    if (this.cancelable !== false) {
      this.defaultPrevented = true;
    }
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.immediatePropagationStopped = true;
  }
}

class FakeElement {
  constructor(document, tagName) {
    this.ownerDocument = document;
    this.tagName = String(tagName || "").toUpperCase();
    this.nodeType = 1;
    this.parentNode = null;
    this.parentElement = null;
    this.childNodes = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.tabIndex = 0;
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  appendChild(node) {
    if (!node) return node;
    node.parentNode = this;
    node.parentElement = this;
    this.childNodes.push(node);
    return node;
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
      node.parentElement = null;
    }
    return node;
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  getAttribute(name) {
    return this.attributes.get(String(name)) || null;
  }

  addEventListener(type, listener) {
    const key = String(type);
    const listeners = this.listeners.get(key) || [];
    listeners.push(listener);
    this.listeners.set(key, listeners);
  }

  removeEventListener(type, listener) {
    const key = String(type);
    const listeners = this.listeners.get(key) || [];
    this.listeners.set(
      key,
      listeners.filter((candidate) => candidate !== listener)
    );
  }

  dispatchEvent(event) {
    event.target = event.target || this;
    event.currentTarget = this;
    const listeners = this.listeners.get(String(event.type)) || [];
    listeners.slice().forEach((listener) => listener.call(this, event));
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new FakeEvent("click", { bubbles: true, cancelable: true, target: this }));
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  contains(node) {
    if (node === this) return true;
    return this.childNodes.some((child) => child.contains?.(node));
  }

  closest(selector) {
    if (selector === "form") return null;
    if (selector.includes(".pwm-modal-backdrop") && this.className.includes("pwm-modal-backdrop")) {
      return this;
    }
    return this.parentElement?.closest?.(selector) || null;
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.documentElement = new FakeElement(this, "html");
    this.body = new FakeElement(this, "body");
    this.documentElement.appendChild(this.body);
    this.activeElement = null;
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }

  addEventListener(type, listener) {
    const key = String(type);
    const listeners = this.listeners.get(key) || [];
    listeners.push(listener);
    this.listeners.set(key, listeners);
  }

  removeEventListener(type, listener) {
    const key = String(type);
    const listeners = this.listeners.get(key) || [];
    this.listeners.set(
      key,
      listeners.filter((candidate) => candidate !== listener)
    );
  }
}

function walk(node, visitor) {
  if (!node) return;
  visitor(node);
  (node.childNodes || []).forEach((child) => walk(child, visitor));
}

function findButtonByText(document, text) {
  let found = null;
  walk(document.documentElement, (node) => {
    if (!found && node.tagName === "BUTTON" && node.textContent === text) {
      found = node;
    }
  });
  return found;
}

function countDecisionModals(document) {
  let count = 0;
  walk(document.documentElement, (node) => {
    if (node.className === "pwm-modal-backdrop") {
      count += 1;
    }
  });
  return count;
}

function waitForMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function analyzeInteractionText(text) {
  const normalizedText = normalizeComposerText(text);
  const findings = [];

  for (const raw of ["wayland.dev", "other.dev", "8.8.8.8"]) {
    const start = normalizedText.indexOf(raw);
    if (start >= 0) {
      findings.push({
        type: raw === "8.8.8.8" ? "PUBLIC_IP" : "USERNAME",
        severity: "medium",
        method: "strict-protection-browser-regression",
        raw,
        start,
        end: start + raw.length
      });
    }
  }

  return {
    originalText: text,
    normalizedText,
    secretFindings: findings.filter((finding) => finding.type !== "PUBLIC_IP"),
    networkFindings: findings.filter((finding) => finding.type === "PUBLIC_IP"),
    findings,
    placeholderNormalized: false
  };
}

function createHarness(options = {}) {
  const document = new FakeDocument();
  const windowListeners = new Map();
  const calls = {
    redactions: [],
    rewrites: [],
    badges: [],
    refreshes: 0
  };
  const composer = new FakeElement(document, "textarea");
  composer.selectionStart = 0;
  composer.selectionEnd = 0;
  document.body.appendChild(composer);

  const window = {
    top: null,
    addEventListener(type, listener) {
      const key = String(type);
      const listeners = windowListeners.get(key) || [];
      listeners.push(listener);
      windowListeners.set(key, listeners);
    },
    removeEventListener(type, listener) {
      const key = String(type);
      const listeners = windowListeners.get(key) || [];
      windowListeners.set(
        key,
        listeners.filter((candidate) => candidate !== listener)
      );
    },
    clearTimeout: clearTimeout,
    setTimeout: setTimeout,
    requestAnimationFrame(callback) {
      return setImmediate(callback);
    }
  };
  window.top = window;

  const dependencies = {
    window,
    document,
    Event: FakeEvent,
    InputEvent: FakeEvent,
    extensionRuntimeAvailable: true,
    modalOpen: false,
    lastTypedPromptText: "",
    typedScanGeneration: 0,
    activeRiskEditor: null,
    editorRiskState: new WeakMap(),
    PLACEHOLDER_TOKEN_REGEX: /\[PWM_\d+\]/g,
    buildRiskFingerprint,
    normalizeComposerText,
    spliceSelectionText,
    isSanitizedFileHandoffEvent: () => false,
    isGeminiHost: () => false,
    maybeHandleGeminiEditorPaste: async () => false,
    dataTransferHasFiles: () => false,
    maybeHandleLocalFileInsert: async () => false,
    maybeHandleChatGptLargeTextPaste: async () => false,
    findComposer: () => composer,
    analyzeText: analyzeInteractionText,
    analyzeTextWithAiAssist: async (text) => analyzeInteractionText(text),
    getInputText: (input) => input.value,
    getSelectionOffsets: (input) => ({
      start: input.selectionStart,
      end: input.selectionEnd
    }),
    setBadge: (message) => calls.badges.push(message),
    hideBadgeSoon: () => {},
    refreshBadgeFromCurrentInput: () => {
      calls.refreshes += 1;
    },
    getPolicyForAction: async () => ({
      allowUserOverride: true,
      allowProtectionPause: true,
      protectionPauseMaxMinutes: 15,
      defaultAction: "redact"
    }),
    getActivePolicy: () => ({
      allowUserOverride: true,
      allowProtectionPause: true,
      protectionPauseMaxMinutes: 15,
      defaultAction: "redact"
    }),
    resolveDecisionAction: (action) => action,
    handleDestinationPolicy: async () => ({ blocked: false }),
    shouldForceDestinationRedaction: () => false,
    isProtectionPauseActiveAfterPolicy: () => Boolean(options.paused),
    handleHttpSecretPolicy: async () => false,
    shouldAutoRedactTypedSecrets: () => false,
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      return {
        redactedText: text
          .replaceAll("wayland.dev", "[PWM_1]")
          .replaceAll("other.dev", "[PWM_2]")
          .replaceAll("8.8.8.8", "[PUB_HOST_1]")
      };
    },
    applyPasteDecision: async (input, originalText, selection, insertedText, context) => {
      calls.rewrites.push({ input, originalText, selection, insertedText, context });
      const next = spliceSelectionText(originalText, selection, insertedText);
      input.value = next.text;
      input.selectionStart = next.caretOffset;
      input.selectionEnd = next.caretOffset;
      return true;
    },
    applyNormalizedComposerRewrite: async (input, text) => ({
      ok: true,
      changed: false,
      text
    }),
    consumeInterceptionEvent: (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },
    handleContentError: (error) => {
      throw error;
    }
  };

  const factory = new Function(
    ...Object.keys(dependencies),
    [
      extractFunctionSource(contentSource, "getEditorRiskState"),
      extractFunctionSource(contentSource, "clearEditorRiskState"),
      extractFunctionSource(contentSource, "noteActiveRiskEditor"),
      extractFunctionSource(contentSource, "clearAllRiskSessionState"),
      extractFunctionSource(contentSource, "getRiskFingerprintForFindings"),
      extractFunctionSource(contentSource, "closeModal"),
      extractFunctionSource(contentSource, "appendFindingRow"),
      extractFunctionSource(contentSource, "showDecisionModal"),
      extractFunctionSource(contentSource, "promptForSensitiveContentDecision"),
      extractFunctionSource(contentSource, "getPasteTransfer"),
      extractFunctionSource(contentSource, "getPastedPlainText"),
      extractFunctionSource(contentSource, "maybeHandlePaste"),
      extractFunctionSource(contentSource, "maybeHandleTypedSecrets"),
      "return { maybeHandlePaste, maybeHandleTypedSecrets };"
    ].join("\n")
  );

  return {
    ...factory(...Object.values(dependencies)),
    calls,
    composer,
    document
  };
}

function createPasteEvent(text, target) {
  return new FakeEvent("paste", {
    bubbles: true,
    cancelable: true,
    target,
    clipboardData: {
      getData(type) {
        return type === "text/plain" || type === "text" ? text : "";
      }
    }
  });
}

async function pasteAndClickDecision(harness, text, decisionText) {
  const { composer, document, maybeHandlePaste } = harness;
  const paste = createPasteEvent(text, composer);
  const pastePromise = maybeHandlePaste(paste);

  await waitForMicrotasks();
  assert.strictEqual(countDecisionModals(document), 1, "suspicious paste should open one decision modal");

  const button = findButtonByText(document, decisionText);
  assert.ok(button, `expected ${decisionText} button`);
  button.click();
  await pastePromise;

  return paste;
}

async function testStrictModalHasNoAllowOnceAndCancelKeepsRawTextOut() {
  const harness = createHarness();
  const { calls, composer, document } = harness;

  const suspicious = "username=wayland.dev";
  const paste = createPasteEvent(suspicious, composer);
  const pastePromise = harness.maybeHandlePaste(paste);

  await waitForMicrotasks();
  assert.strictEqual(countDecisionModals(document), 1, "suspicious paste should open one decision modal");
  assert.strictEqual(findButtonByText(document, "Allow once"), null, "strict modal should not expose Allow once");
  findButtonByText(document, "Cancel").click();
  await pastePromise;

  assert.strictEqual(paste.defaultPrevented, true);
  assert.strictEqual(composer.value, "", "cancelled strict modal should not insert raw paste text");
  assert.strictEqual(calls.redactions.length, 0, "cancel should not request redaction");
  assert.strictEqual(countDecisionModals(document), 0, "modal should close after Cancel");
}

async function testPausedBrowserInteractionKeepsRawTextWithoutPrompt() {
  const harness = createHarness({ paused: true });
  const { calls, composer, document } = harness;
  const suspicious = "username=wayland.dev";
  const paste = createPasteEvent(suspicious, composer);

  await harness.maybeHandlePaste(paste);

  assert.strictEqual(paste.defaultPrevented, true);
  assert.strictEqual(composer.value, suspicious, "paused protection should insert the original raw text");
  assert.strictEqual(calls.redactions.length, 0, "paused protection should not request redaction");
  assert.strictEqual(countDecisionModals(document), 0, "paused protection should not open a decision modal");
}

async function testRedactStillRewritesFromBrowserDecisionModal() {
  const harness = createHarness();
  const { calls, composer } = harness;

  await pasteAndClickDecision(harness, "username=wayland.dev", "Redact");

  assert.strictEqual(calls.redactions.length, 1, "Redact should request redaction");
  assert.strictEqual(composer.value, "username=[PWM_1]", "Redact should rewrite the suspicious value");
}

async function run() {
  await testStrictModalHasNoAllowOnceAndCancelKeepsRawTextOut();
  await testPausedBrowserInteractionKeepsRawTextWithoutPrompt();
  await testRedactStillRewritesFromBrowserDecisionModal();
  console.log("PASS content strict protection browser interaction regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
