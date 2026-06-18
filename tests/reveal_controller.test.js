const assert = require("assert");
const path = require("path");

require(path.join(__dirname, "../src/content/rehydration/placeholderRehydrator.js"));
require(path.join(__dirname, "../src/content/rehydration/revealController.js"));

const RevealController = globalThis.PWM.RevealController;

class FakeSpan {
  constructor() {
    this.className = "";
    this.dataset = {};
    this.textContent = "";
    this.tabIndex = -1;
    this.attributes = {};
    this.listeners = new Map();
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  addEventListener(name, callback) {
    this.listeners.set(name, callback);
  }

  dispatch(name, event) {
    const callback = this.listeners.get(name);
    assert.ok(callback, `expected ${name} listener`);
    callback(event);
  }
}

class FakeDocument {
  createElement(tagName) {
    assert.strictEqual(tagName, "span");
    return new FakeSpan();
  }
}

function createEvent(overrides = {}) {
  return {
    key: "",
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    ...overrides
  };
}

function createSpan(options = {}) {
  const calls = [];
  const errors = [];
  const span = RevealController.createSecretSpan("[PWM_2]", {
    document: new FakeDocument(),
    placeholderSessionIndex: (placeholder) => (placeholder === "[PWM_2]" ? 2 : null),
    openReveal: (placeholder) => {
      calls.push(placeholder);
      if (options.rejectReveal) {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve();
    },
    onRevealError: (placeholder, error) => {
      errors.push({ placeholder, message: error?.message || String(error) });
    }
  });
  return { span, calls, errors };
}

function createTypedSpan(placeholder = "[PRIVATE_IP_4]", overrides = {}) {
  const calls = [];
  const span = RevealController.createSecretSpan(placeholder, {
    document: new FakeDocument(),
    openReveal: (clickedPlaceholder) => {
      calls.push(clickedPlaceholder);
      return Promise.resolve();
    },
    ...overrides
  });
  return { span, calls };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function testRendersPlaceholderTextOnly() {
  const rawSecret = "sk-live-secret-value";
  const span = RevealController.createSecretSpan("[PWM_2]", {
    document: new FakeDocument(),
    placeholderSessionIndex: () => 2,
    openReveal: () => Promise.resolve(),
    rawSecret
  });

  assert.strictEqual(span.textContent, "[PWM_2]");
  assert.strictEqual(span.textContent.includes(rawSecret), false);
}

function testStableAttributesAndClasses() {
  const { span } = createSpan();

  assert.strictEqual(span.className, "pwm-secret");
  assert.strictEqual(span.dataset.pwmTone, "amber");
  assert.strictEqual(span.tabIndex, 0);
  assert.strictEqual(span.getAttribute("role"), "button");
  assert.strictEqual(
    span.getAttribute("aria-label"),
    "LeakGuard redacted sensitive content. Open secure reveal in LeakGuard."
  );
}

function testTypedPlaceholderUsesTrailingIndexForTone() {
  const { span } = createTypedSpan("[PRIVATE_IP_4]");

  assert.strictEqual(span.textContent, "[PRIVATE_IP_4]");
  assert.strictEqual(span.dataset.pwmTone, "rose");
}

function testEnterpriseTypedPlaceholderActivatesWithOriginalPlaceholder() {
  const { span, calls } = createTypedSpan("[AZURE_RG_1]");
  const click = createEvent();
  const enter = createEvent({ key: "Enter" });

  assert.strictEqual(span.className, "pwm-secret");
  assert.strictEqual(span.textContent, "[AZURE_RG_1]");
  assert.strictEqual(span.dataset.pwmTone, "aqua");

  span.dispatch("click", click);
  span.dispatch("keydown", enter);

  assert.deepStrictEqual(calls, ["[AZURE_RG_1]", "[AZURE_RG_1]"]);
  assert.strictEqual(click.defaultPrevented, true);
  assert.strictEqual(click.propagationStopped, true);
  assert.strictEqual(enter.defaultPrevented, true);
  assert.strictEqual(enter.propagationStopped, true);
}

function testTypedPlaceholderWithoutIndexUsesFallbackTone() {
  const { span } = createTypedSpan("[PRIVATE_IP_X]");

  assert.strictEqual(span.textContent, "[PRIVATE_IP_X]");
  assert.strictEqual(span.dataset.pwmTone, "aqua");
}

function testClickActivationCallsInjectedRevealAndStopsEvent() {
  const { span, calls } = createSpan();
  const event = createEvent();

  span.dispatch("click", event);

  assert.deepStrictEqual(calls, ["[PWM_2]"]);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(event.propagationStopped, true);
}

function testKeyboardActivationCallsInjectedRevealForEnterAndSpace() {
  const { span, calls } = createSpan();
  const enter = createEvent({ key: "Enter" });
  const space = createEvent({ key: " " });

  span.dispatch("keydown", enter);
  span.dispatch("keydown", space);

  assert.deepStrictEqual(calls, ["[PWM_2]", "[PWM_2]"]);
  assert.strictEqual(enter.defaultPrevented, true);
  assert.strictEqual(enter.propagationStopped, true);
  assert.strictEqual(space.defaultPrevented, true);
  assert.strictEqual(space.propagationStopped, true);
}

function testNonActivationKeysDoNotCallReveal() {
  const { span, calls } = createSpan();
  const event = createEvent({ key: "Escape" });

  span.dispatch("keydown", event);

  assert.deepStrictEqual(calls, []);
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(event.propagationStopped, false);
}

async function testRevealErrorsDelegateToInjectedHandler() {
  const { span, errors } = createSpan({ rejectReveal: true });

  span.dispatch("click", createEvent());
  await flushPromises();

  assert.deepStrictEqual(errors, [{ placeholder: "[PWM_2]", message: "boom" }]);
}

async function run() {
  testRendersPlaceholderTextOnly();
  testStableAttributesAndClasses();
  testTypedPlaceholderUsesTrailingIndexForTone();
  testEnterpriseTypedPlaceholderActivatesWithOriginalPlaceholder();
  testTypedPlaceholderWithoutIndexUsesFallbackTone();
  testClickActivationCallsInjectedRevealAndStopsEvent();
  testKeyboardActivationCallsInjectedRevealForEnterAndSpace();
  testNonActivationKeysDoNotCallReveal();
  await testRevealErrorsDelegateToInjectedHandler();

  console.log("PASS reveal controller span activation regressions");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
