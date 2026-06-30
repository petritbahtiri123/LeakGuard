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
    this.id = "";
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
    const key = String(name);
    const text = String(value);
    this.attributes.set(key, text);
    if (key === "id") this.id = text;
    if (key === "class") this.className = text;
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

  clickEvent() {
    const event = new FakeEvent("click", { bubbles: true, cancelable: true, target: this });
    this.dispatchEvent(event);
    return event;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  contains(node) {
    if (node === this) return true;
    return this.childNodes.some((child) => child.contains?.(node));
  }

  matches(selector) {
    return matchesFakeSelector(this, selector);
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches?.(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    let found = null;
    walk(this, (node) => {
      if (!found && node !== this && node.matches?.(selector)) {
        found = node;
      }
    });
    return found;
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

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }
}

function walk(node, visitor) {
  if (!node) return;
  visitor(node);
  (node.childNodes || []).forEach((child) => walk(child, visitor));
}

function matchesFakeSelector(element, selector) {
  if (!element) return false;
  const selectors = String(selector || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (selectors.length > 1) {
    return selectors.some((part) => matchesFakeSelector(element, part));
  }
  const single = selectors[0] || String(selector || "").trim();
  if (!single) return false;
  if (single.startsWith("form ")) {
    return Boolean(element.closest("form")) && matchesFakeSelector(element, single.slice(5));
  }
  if (single === "form") return element.tagName === "FORM";
  if (single === "textarea") return element.tagName === "TEXTAREA";
  if (single === "button") return element.tagName === "BUTTON";
  if (single === ".pwm-modal-backdrop") return String(element.className || "").split(/\s+/).includes("pwm-modal-backdrop");
  if (single === ".pwm-modal") return String(element.className || "").split(/\s+/).includes("pwm-modal");
  if (/^\[contenteditable/.test(single)) return element.getAttribute("contenteditable") === "true";
  if (single === "button#send-button") return element.tagName === "BUTTON" && element.id === "send-button";
  if (single === "button[data-testid='send-button']") {
    return element.tagName === "BUTTON" && element.getAttribute("data-testid") === "send-button";
  }
  if (single === "button[data-testid*='send']") {
    return element.tagName === "BUTTON" && /send/i.test(element.getAttribute("data-testid") || "");
  }
  if (single === "button[aria-label*='send' i]") {
    return element.tagName === "BUTTON" && /send/i.test(element.getAttribute("aria-label") || "");
  }
  return false;
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

  const placeholderRegex =
    /\[(GCP_PROJECT_NUMBER|FILE_SHARE|AWS_ENDPOINT|CLOUD_ENDPOINT|INTERNAL_ENDPOINT)_\d+\]/g;
  let placeholderMatch;
  while ((placeholderMatch = placeholderRegex.exec(normalizedText)) !== null) {
    findings.push({
      type: placeholderMatch[1],
      severity: "high",
      method: ["placeholder-trust", "context"],
      raw: placeholderMatch[0],
      start: placeholderMatch.index,
      end: placeholderMatch.index + placeholderMatch[0].length
    });
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
    refreshes: 0,
    submits: 0,
    ownedClicks: 0,
    requestSubmitters: []
  };
  const composer = new FakeElement(document, "textarea");
  composer.selectionStart = 0;
  composer.selectionEnd = 0;
  const form = options.withForm ? new FakeElement(document, "form") : null;
  const defaultSendButton = new FakeElement(document, "button");
  defaultSendButton.setAttribute("id", "send-button");
  defaultSendButton.setAttribute("aria-label", "Send");
  defaultSendButton.textContent = "Send";
  defaultSendButton.addEventListener("click", (event) => {
    if (!event.defaultPrevented) calls.submits += 1;
  });
  if (form) {
    form.requestSubmit = (submitter) => {
      calls.requestSubmitters.push(submitter || null);
      calls.submits += 1;
    };
    document.body.appendChild(form);
    form.append(composer, defaultSendButton);
  } else {
    document.body.append(composer, defaultSendButton);
  }

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
    queueMicrotask,
    Node: { ELEMENT_NODE: 1 },
    SEND_BUTTON_SELECTORS: [
      "form button[data-testid='send-button']",
      "form button[data-testid*='send']",
      "form button[aria-label*='send' i]",
      "form button#send-button",
      "button[data-testid='send-button']",
      "button[data-testid*='send']",
      "button#send-button",
      "button[aria-label*='send' i]"
    ],
    FALLBACK_SEND_KEY_SUPPRESS_MS: 300,
    extensionRuntimeAvailable: true,
    modalOpen: false,
    bypassNextSubmit: false,
    bypassNextSendButtonClick: false,
    fallbackSendKeySuppressionUntil: 0,
    fallbackSendKeySuppressionInput: null,
    lastTypedPromptText: "",
    typedScanGeneration: 0,
    activeRiskEditor: null,
    editorRiskState: new WeakMap(),
    PLACEHOLDER_TOKEN_REGEX: /\[PWM_\d+\]/g,
    ANY_PLACEHOLDER_TOKEN_REGEX:
      /\[(?:PWM_\d+|NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?|[A-Z][A-Z0-9_]*_\d+)\]/g,
    PlaceholderFamilies: {
      isTypedPlaceholderFamily: (family) =>
        [
          "GCP_PROJECT_NUMBER",
          "FILE_SHARE",
          "AWS_ENDPOINT",
          "CLOUD_ENDPOINT",
          "INTERNAL_ENDPOINT"
        ].includes(String(family || "").toUpperCase())
    },
    buildRiskFingerprint,
    normalizeComposerText,
    normalizeVisiblePlaceholders: normalizeComposerText,
    spliceSelectionText,
    isSanitizedFileHandoffEvent: () => false,
    isGeminiHost: () => false,
    maybeHandleGeminiEditorPaste: async () => false,
    dataTransferHasFiles: () => false,
    maybeHandleLocalFileInsert: async () => false,
    maybeHandleChatGptLargeTextPaste: async () => false,
    findComposer: () => composer,
    isVisible: () => true,
    normalizeTarget: (target) => target,
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
      defaultAction: options.defaultAction || "redact",
      liveTypedRedaction: options.liveTypedRedaction === true
    }),
    getActivePolicy: () => ({
      allowUserOverride: true,
      allowProtectionPause: true,
      protectionPauseMaxMinutes: 15,
      defaultAction: options.defaultAction || "redact",
      liveTypedRedaction: options.liveTypedRedaction === true
    }),
    resolveDecisionAction: (action) => (action === "redact" ? "redact" : "cancel"),
    handleDestinationPolicy: async () => ({ blocked: false }),
    shouldForceDestinationRedaction: () => false,
    isProtectionPauseActiveAfterPolicy: () => Boolean(options.paused),
    handleHttpSecretPolicy: async () => false,
    shouldAutoRedactTypedSecrets: () => false,
    isWhatsAppHost: () => false,
    shouldOwnWhatsAppTextSend: () => false,
    shouldBypassWhatsAppSanitizedImageSend: () => false,
    markWhatsAppTextSendPending: () => true,
    createWhatsAppVerifiedSendOptions: () => ({}),
    clearWhatsAppTextSendPending: () => {},
    blockWhatsAppTextSend: async () => {},
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      return {
        redactedText: text
          .replaceAll("wayland.dev", "[PWM_1]")
          .replaceAll("other.dev", "[PWM_2]")
          .replaceAll("8.8.8.8", "[PUB_HOST_1]")
      };
    },
    applyComposerText: async (input, text, options = {}) => {
      calls.rewrites.push({ input, insertedText: text, context: "input", options });
      input.value = text;
      input.selectionStart = options.caretOffset ?? text.length;
      input.selectionEnd = options.caretOffset ?? text.length;
      return { ok: true, actual: text };
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
    applySubmitRedactionTransactionally: async (input, _originalText, redactedText) => {
      calls.rewrites.push({ context: "submit-redaction" });
      input.value = redactedText;
      input.selectionStart = redactedText.length;
      input.selectionEnd = redactedText.length;
      return true;
    },
    queueVerifiedComposerSend: (_input, expectedText, context, send) => {
      calls.rewrites.push({ insertedText: expectedText, context });
      send();
    },
    consumeInterceptionEvent: (event) => {
      if (event.type === "click") calls.ownedClicks += 1;
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
      "let whatsAppBypassSanitizedImageSubmitUntil = 0;",
      extractFunctionSource(contentSource, "getEditorRiskState"),
      extractFunctionSource(contentSource, "clearEditorRiskState"),
      extractFunctionSource(contentSource, "noteActiveRiskEditor"),
      extractFunctionSource(contentSource, "clearAllRiskSessionState"),
      extractFunctionSource(contentSource, "getRiskFingerprintForFindings"),
      extractFunctionSource(contentSource, "analysisNeedsEventOwnership"),
      extractFunctionSource(contentSource, "isKnownSanitizedPlaceholderToken"),
      extractFunctionSource(contentSource, "analysisHasOnlySanitizedPlaceholderFindings"),
      extractFunctionSource(contentSource, "closeModal"),
      extractFunctionSource(contentSource, "appendFindingRow"),
      extractFunctionSource(contentSource, "showDecisionModal"),
      extractFunctionSource(contentSource, "showMessageModal"),
      extractFunctionSource(contentSource, "promptForSensitiveContentDecision"),
      extractFunctionSource(contentSource, "getPasteTransfer"),
      extractFunctionSource(contentSource, "getPastedPlainText"),
      extractFunctionSource(contentSource, "isLiveTypedRedactionEnabled"),
      extractFunctionSource(contentSource, "findSendButton"),
      extractFunctionSource(contentSource, "isPreferredSubmitterForForm"),
      extractFunctionSource(contentSource, "dispatchSubmitEventWithBypass"),
      extractFunctionSource(contentSource, "clickSendButtonWithBypass"),
      extractFunctionSource(contentSource, "submitComposer"),
      extractFunctionSource(contentSource, "replayVerifiedSend"),
      extractFunctionSource(contentSource, "maybeHandlePaste"),
      extractFunctionSource(contentSource, "maybeHandleSubmit"),
      extractFunctionSource(contentSource, "findSendButtonClickTarget"),
      extractFunctionSource(contentSource, "createSyntheticSubmitInterceptionEvent"),
      extractFunctionSource(contentSource, "markFallbackSendKeyRedactionPending"),
      extractFunctionSource(contentSource, "clearFallbackSendKeyRedactionPending"),
      extractFunctionSource(contentSource, "maybeConsumeSuppressedFallbackSendKeyEvent"),
      extractFunctionSource(contentSource, "maybeHandleSendButtonClick"),
      extractFunctionSource(contentSource, "maybeHandleFallbackSendKey"),
      extractFunctionSource(contentSource, "maybeHandleTypedSecrets"),
      "return { maybeHandlePaste, maybeHandleSubmit, maybeHandleSendButtonClick, maybeHandleFallbackSendKey, maybeHandleTypedSecrets, showDecisionModal, showMessageModal, submitComposer };"
    ].join("\n")
  );

  return {
    ...factory(...Object.values(dependencies)),
    calls,
    composer,
    form,
    defaultSendButton,
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

function createEnterEvent(target) {
  return new FakeEvent("keydown", {
    bubbles: true,
    cancelable: true,
    target,
    key: "Enter"
  });
}

async function testSensitivePasteAutoRedactsWithoutDecisionModal() {
  const harness = createHarness();
  const { calls, composer, document } = harness;

  const suspicious = "username=wayland.dev";
  const pastePromise = harness.maybeHandlePaste(createPasteEvent(suspicious, composer));

  await waitForMicrotasks();
  assert.strictEqual(countDecisionModals(document), 0, "suspicious paste should not open a decision modal");
  assert.strictEqual(findButtonByText(document, "Allow once"), null, "strict modal should not expose Allow once");
  await pastePromise;

  assert.strictEqual(calls.redactions.length, 1, "suspicious paste should request redaction automatically");
  assert.strictEqual(composer.value, "username=[PWM_1]", "suspicious paste should be rewritten automatically");
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

async function testBlockDefaultActionFailsClosedWithoutDecisionModal() {
  const harness = createHarness({ defaultAction: "block" });
  const { calls, composer, document } = harness;
  const pastePromise = harness.maybeHandlePaste(createPasteEvent("username=wayland.dev", composer));

  await waitForMicrotasks();
  assert.strictEqual(countDecisionModals(document), 0, "blocked default action should not open a decision modal");
  await pastePromise;

  assert.strictEqual(calls.redactions.length, 0, "blocked default action should not request redaction");
  assert.strictEqual(composer.value, "", "blocked default action should keep raw paste out of the composer");
}

async function testTypedScanWarnsWithoutLiveRewriteByDefault() {
  const harness = createHarness();
  const { calls, composer, document } = harness;

  composer.value = "username=wayland.dev";
  composer.selectionStart = composer.value.length;
  composer.selectionEnd = composer.value.length;
  const scanPromise = harness.maybeHandleTypedSecrets();

  await waitForMicrotasks();
  assert.strictEqual(countDecisionModals(document), 0, "typed sensitive content should not open a decision modal");
  await scanPromise;

  assert.strictEqual(calls.redactions.length, 0, "default typed scan should not request live redaction");
  assert.strictEqual(composer.value, "username=wayland.dev", "default typed scan should leave the composer user-authored");
  assert.ok(calls.refreshes >= 0, "default typed scan may refresh outside-composer warning state");
}

async function testTypedScanAutoRedactsWhenLiveTypedRedactionEnabled() {
  const harness = createHarness({ liveTypedRedaction: true });
  const { calls, composer, document } = harness;

  composer.value = "username=wayland.dev";
  composer.selectionStart = composer.value.length;
  composer.selectionEnd = composer.value.length;
  const scanPromise = harness.maybeHandleTypedSecrets();

  await waitForMicrotasks();
  assert.strictEqual(countDecisionModals(document), 0, "live typed redaction should not open a decision modal");
  await scanPromise;

  assert.strictEqual(calls.redactions.length, 1, "enabled live typed redaction should request redaction automatically");
  assert.strictEqual(composer.value, "username=[PWM_1]", "enabled live typed redaction should rewrite automatically");
}

async function testSubmitStillRedactsWhenLiveTypedRedactionDisabled() {
  const harness = createHarness({ liveTypedRedaction: false });
  const { calls, composer } = harness;
  composer.value = "username=wayland.dev";

  const submit = new FakeEvent("submit", {
    bubbles: true,
    cancelable: true,
    target: composer
  });

  await harness.maybeHandleSubmit(submit);

  assert.strictEqual(submit.defaultPrevented, true, "submit should still be owned when typed live redaction is disabled");
  assert.strictEqual(calls.redactions.length, 1, "submit should still request redaction");
  assert.ok(
    calls.rewrites.some((rewrite) => rewrite.context === "submit-redaction"),
    "submit should still use transactional redaction"
  );
  assert.strictEqual(calls.submits, 1, "submit should continue after exact verified redaction");
}

async function testSubmitAllowsSanitizedPlaceholderOnlyContent() {
  const harness = createHarness();
  const { calls, composer, document } = harness;
  composer.value = [
    "GCP project_number: [GCP_PROJECT_NUMBER_1]",
    "FILE_SHARE=[FILE_SHARE_1]",
    "AZURE_KEYVAULT=[CLOUD_ENDPOINT_1]",
    "AWS_PRIVATE_API=[AWS_ENDPOINT_1]",
    "INTERNAL_URL=[INTERNAL_ENDPOINT_1]"
  ].join("\n");

  const submit = new FakeEvent("submit", {
    bubbles: true,
    cancelable: true,
    target: composer
  });

  await harness.maybeHandleSubmit(submit);

  assert.strictEqual(submit.defaultPrevented, true, "sanitized submit should be owned before host handlers");
  assert.strictEqual(calls.redactions.length, 0, "sanitized placeholders should not be redacted again");
  assert.strictEqual(calls.submits, 1, "sanitized placeholder-only content should be sent");
  assert.strictEqual(countDecisionModals(document), 0, "sanitized placeholder-only submit should not open a modal");
}

async function testClickedFormSubmitterIsReplayedAfterVerifiedRedaction() {
  const harness = createHarness({ withForm: true });
  const { calls, composer, form, document } = harness;
  const secondary = document.createElement("button");
  secondary.setAttribute("aria-label", "Send alternate");
  secondary.textContent = "Send alternate";
  form.appendChild(secondary);
  composer.value = "username=wayland.dev";

  const submit = new FakeEvent("submit", {
    bubbles: true,
    cancelable: true,
    target: form,
    leakGuardSendButton: secondary
  });

  await harness.maybeHandleSubmit(submit);

  assert.strictEqual(submit.defaultPrevented, true, "risky submit should be intercepted before provider submit");
  assert.strictEqual(calls.redactions.length, 1, "submit should request exactly one redaction");
  assert.strictEqual(composer.value, "username=[PWM_1]", "submit should rewrite before replay");
  assert.strictEqual(calls.submits, 1, "verified submit should be replayed once");
  assert.deepStrictEqual(
    calls.requestSubmitters,
    [secondary],
    "form requestSubmit should replay the originally clicked send button"
  );
}

async function testNonSubmitFormButtonIsNotUsedAsRequestSubmitter() {
  const harness = createHarness({ withForm: true });
  const { calls, composer, form, document } = harness;
  const nonSubmit = document.createElement("button");
  nonSubmit.setAttribute("type", "button");
  nonSubmit.setAttribute("aria-label", "Send alternate");
  nonSubmit.textContent = "Send alternate";
  form.appendChild(nonSubmit);
  composer.value = "username=wayland.dev";

  const submit = new FakeEvent("submit", {
    bubbles: true,
    cancelable: true,
    target: form,
    leakGuardSendButton: nonSubmit
  });

  await harness.maybeHandleSubmit(submit);

  assert.strictEqual(calls.submits, 1, "verified submit should still replay once");
  assert.deepStrictEqual(
    calls.requestSubmitters,
    [null],
    "non-submit buttons must not be passed to form.requestSubmit as submitters"
  );
}

async function testPreferredSubmitterRequestSubmitThrowFallsBackToSameButtonClick() {
  const harness = createHarness({ withForm: true });
  const { calls, composer, form, document } = harness;
  const secondary = document.createElement("button");
  secondary.setAttribute("aria-label", "Send alternate");
  secondary.textContent = "Send alternate";
  let fallbackClicks = 0;
  secondary.addEventListener("click", (event) => {
    fallbackClicks += 1;
    if (!event.defaultPrevented) calls.submits += 1;
  });
  form.appendChild(secondary);
  form.requestSubmit = (submitter) => {
    calls.requestSubmitters.push(submitter || null);
    if (submitter === secondary) {
      throw new Error("preferred submitter rejected");
    }
    calls.submits += 1;
  };
  composer.value = "username=wayland.dev";

  const submit = new FakeEvent("submit", {
    bubbles: true,
    cancelable: true,
    target: form,
    leakGuardSendButton: secondary
  });

  await harness.maybeHandleSubmit(submit);

  assert.deepStrictEqual(
    calls.requestSubmitters,
    [secondary],
    "requestSubmit should first try the original submit button"
  );
  assert.strictEqual(fallbackClicks, 1, "failed preferred requestSubmit should fall back to clicking the same button");
  assert.strictEqual(calls.submits, 1, "fallback click should submit exactly once");
}

async function testClickedSendButtonReplayUsesProviderVisibleClickAfterVerifiedRedaction() {
  const harness = createHarness({ withForm: true });
  const { calls, composer, defaultSendButton, form } = harness;
  form.requestSubmit = (submitter) => {
    calls.requestSubmitters.push(submitter || null);
  };
  defaultSendButton.listeners.set("click", []);
  let guardPromise = null;
  let providerClicks = 0;
  defaultSendButton.addEventListener("click", (event) => {
    guardPromise = harness.maybeHandleSendButtonClick(event);
    if (!event.defaultPrevented) {
      providerClicks += 1;
      calls.submits += 1;
    }
  });
  composer.value = "username=wayland.dev";

  const click = defaultSendButton.clickEvent();
  await guardPromise;
  await waitForMicrotasks();
  await waitForMicrotasks();

  assert.strictEqual(click.defaultPrevented, true, "raw click should be intercepted before provider submit");
  assert.strictEqual(calls.redactions.length, 1, "click should trigger exactly one redaction request");
  assert.strictEqual(composer.value, "username=[PWM_1]", "click should rewrite before replay");
  assert.strictEqual(providerClicks, 1, "verified replay should reach the provider-visible click handler once");
  assert.strictEqual(calls.submits, 1, "verified click replay should submit exactly once");
  assert.deepStrictEqual(
    calls.requestSubmitters,
    [],
    "click-originated replay should not rely on isolated requestSubmit for provider-visible submission"
  );
}

async function testNativeSubmitterReplayUsesProviderVisibleClickAfterVerifiedRedaction() {
  const harness = createHarness({ withForm: true });
  const { calls, composer, defaultSendButton, form } = harness;
  form.requestSubmit = (submitter) => {
    calls.requestSubmitters.push(submitter || null);
  };
  defaultSendButton.listeners.set("click", []);
  form.addEventListener("submit", (event) => {
    if (!event.defaultPrevented) calls.submits += 1;
  });
  composer.value = "username=wayland.dev";

  const submit = new FakeEvent("submit", {
    bubbles: true,
    cancelable: true,
    target: form,
    submitter: defaultSendButton
  });

  await harness.maybeHandleSubmit(submit);

  assert.strictEqual(submit.defaultPrevented, true, "native submitter event should be intercepted before provider submit");
  assert.strictEqual(calls.redactions.length, 1, "native submitter should trigger exactly one redaction request");
  assert.strictEqual(composer.value, "username=[PWM_1]", "native submitter should rewrite before replay");
  assert.strictEqual(calls.submits, 1, "verified native submitter replay should submit exactly once");
  assert.deepStrictEqual(
    calls.requestSubmitters,
    [],
    "native submitter replay should not rely on isolated requestSubmit for provider-visible submission"
  );
}

async function testNativeSubmitWithoutSubmitterReplayUsesVisibleSendButtonAfterVerifiedRedaction() {
  const harness = createHarness({ withForm: true });
  const { calls, composer, defaultSendButton, form } = harness;
  form.requestSubmit = (submitter) => {
    calls.requestSubmitters.push(submitter || null);
  };
  defaultSendButton.listeners.set("click", []);
  form.addEventListener("submit", (event) => {
    if (!event.defaultPrevented) calls.submits += 1;
  });
  composer.value = "username=wayland.dev";

  const submit = new FakeEvent("submit", {
    bubbles: true,
    cancelable: true,
    target: form
  });

  await harness.maybeHandleSubmit(submit);

  assert.strictEqual(submit.defaultPrevented, true, "native submit should be intercepted before provider submit");
  assert.strictEqual(calls.redactions.length, 1, "native submit should trigger exactly one redaction request");
  assert.strictEqual(composer.value, "username=[PWM_1]", "native submit should rewrite before replay");
  assert.strictEqual(calls.submits, 1, "verified native submit replay should submit exactly once");
  assert.deepStrictEqual(
    calls.requestSubmitters,
    [],
    "native submit replay should use the visible send button when no submitter is exposed"
  );
}

async function testFallbackEnterFormlessComposerRedactsAndClicksOnce() {
  const harness = createHarness();
  const { calls, composer, defaultSendButton } = harness;
  defaultSendButton.listeners.set("click", []);
  defaultSendButton.addEventListener("click", (event) => {
    harness.maybeHandleSendButtonClick(event).catch((error) => {
      throw error;
    });
    if (!event.defaultPrevented) calls.submits += 1;
  });
  composer.value = "username=wayland.dev";

  const enter = createEnterEvent(composer);
  await harness.maybeHandleFallbackSendKey(enter);

  assert.strictEqual(enter.defaultPrevented, true, "Enter should be intercepted before raw provider send");
  assert.strictEqual(calls.redactions.length, 1, "Enter should trigger exactly one redaction request");
  assert.strictEqual(composer.value, "username=[PWM_1]", "Enter should submit-time redact before replay");
  assert.strictEqual(calls.submits, 1, "Enter replay should submit once without a second user click");
  assert.strictEqual(calls.ownedClicks, 0, "programmatic replay click should not be treated as a fresh user click");
}

async function testFallbackEnterFormComposerRedactsAndRequestSubmitsOnce() {
  const harness = createHarness({ withForm: true });
  const { calls, composer, defaultSendButton } = harness;
  composer.value = "username=wayland.dev";

  const enter = createEnterEvent(composer);
  await harness.maybeHandleFallbackSendKey(enter);

  assert.strictEqual(enter.defaultPrevented, true, "form Enter should be intercepted before raw provider submit");
  assert.strictEqual(calls.redactions.length, 1, "form Enter should trigger exactly one redaction request");
  assert.strictEqual(composer.value, "username=[PWM_1]", "form Enter should submit-time redact before replay");
  assert.strictEqual(calls.submits, 1, "form Enter replay should submit once");
  assert.deepStrictEqual(
    calls.requestSubmitters,
    [defaultSendButton],
    "form Enter replay should use requestSubmit with the resolved send button"
  );
}

async function testFallbackEnterSanitizedPlaceholderOnlyDoesNotLoop() {
  const harness = createHarness();
  const { calls, composer, defaultSendButton } = harness;
  defaultSendButton.listeners.set("click", []);
  defaultSendButton.addEventListener("click", (event) => {
    harness.maybeHandleSendButtonClick(event).catch((error) => {
      throw error;
    });
    if (!event.defaultPrevented) calls.submits += 1;
  });
  composer.value = "GCP project_number: [GCP_PROJECT_NUMBER_1]";

  const enter = createEnterEvent(composer);
  await harness.maybeHandleFallbackSendKey(enter);

  assert.strictEqual(enter.defaultPrevented, true, "placeholder-only Enter should still be owned before host send");
  assert.strictEqual(calls.redactions.length, 0, "trusted placeholder normalization should not request redaction");
  assert.strictEqual(calls.submits, 1, "placeholder-only Enter replay should submit once");
  assert.strictEqual(calls.ownedClicks, 0, "placeholder-only replay should not loop through click interception");
}

async function testLegacyDecisionModalButtonsConsumeClicks() {
  const harness = createHarness();
  const { document, showDecisionModal } = harness;
  const modalPromise = showDecisionModal(analyzeInteractionText("username=wayland.dev").findings, "paste");

  await waitForMicrotasks();
  const redactButton = findButtonByText(document, "Redact");
  assert.ok(redactButton, "expected Redact button");

  const click = redactButton.clickEvent();
  const decision = await modalPromise;

  assert.strictEqual(click.defaultPrevented, true, "modal action click should prevent host default behavior");
  assert.strictEqual(click.propagationStopped, true, "modal action click should stop host propagation");
  assert.strictEqual(
    click.immediatePropagationStopped,
    true,
    "modal action click should stop immediate host propagation"
  );
  assert.deepStrictEqual(decision, { action: "redact" });
  assert.strictEqual(countDecisionModals(document), 0, "decision modal should close after action click");
}

async function testMessageModalCloseButtonConsumesClicks() {
  const harness = createHarness();
  const { document, showMessageModal } = harness;
  const modalPromise = showMessageModal("Sensitive content blocked", "Nothing raw was sent.");

  await waitForMicrotasks();
  const closeButton = findButtonByText(document, "Close");
  assert.ok(closeButton, "expected Close button");

  const click = closeButton.clickEvent();
  await modalPromise;

  assert.strictEqual(click.defaultPrevented, true, "message modal close click should prevent host default behavior");
  assert.strictEqual(click.propagationStopped, true, "message modal close click should stop host propagation");
  assert.strictEqual(
    click.immediatePropagationStopped,
    true,
    "message modal close click should stop immediate host propagation"
  );
  assert.strictEqual(countDecisionModals(document), 0, "message modal should close after Close click");
}

async function run() {
  await testSensitivePasteAutoRedactsWithoutDecisionModal();
  await testPausedBrowserInteractionKeepsRawTextWithoutPrompt();
  await testBlockDefaultActionFailsClosedWithoutDecisionModal();
  await testTypedScanWarnsWithoutLiveRewriteByDefault();
  await testTypedScanAutoRedactsWhenLiveTypedRedactionEnabled();
  await testSubmitStillRedactsWhenLiveTypedRedactionDisabled();
  await testSubmitAllowsSanitizedPlaceholderOnlyContent();
  await testClickedFormSubmitterIsReplayedAfterVerifiedRedaction();
  await testNonSubmitFormButtonIsNotUsedAsRequestSubmitter();
  await testPreferredSubmitterRequestSubmitThrowFallsBackToSameButtonClick();
  await testClickedSendButtonReplayUsesProviderVisibleClickAfterVerifiedRedaction();
  await testNativeSubmitterReplayUsesProviderVisibleClickAfterVerifiedRedaction();
  await testNativeSubmitWithoutSubmitterReplayUsesVisibleSendButtonAfterVerifiedRedaction();
  await testFallbackEnterFormlessComposerRedactsAndClicksOnce();
  await testFallbackEnterFormComposerRedactsAndRequestSubmitsOnce();
  await testFallbackEnterSanitizedPlaceholderOnlyDoesNotLoop();
  await testLegacyDecisionModalButtonsConsumeClicks();
  await testMessageModalCloseButtonConsumesClicks();
  console.log("PASS content strict protection browser interaction regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
