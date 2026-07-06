const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/ui/contentModalUi.js"));

function createElement(tagName) {
  const children = [];
  return {
    tagName: String(tagName || "").toUpperCase(),
    className: "",
    textContent: "",
    tabIndex: 0,
    parentNode: null,
    isConnected: false,
    children,
    listeners: {},
    setAttribute(name, value) {
      this[name] = String(value);
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
      this.listeners[type] = handler;
    },
    contains(item) {
      return item === this || children.some((child) => child.contains?.(item));
    },
    focus() {
      activeElement = this;
    }
  };
}

let activeElement = null;

function findByText(element, text) {
  if (element.textContent === text) return element;
  for (const child of element.children || []) {
    const found = findByText(child, text);
    if (found) return found;
  }
  return null;
}

function createUi() {
  let modalOpen = false;
  const listeners = [];
  const documentElement = createElement("html");
  const documentRef = {
    documentElement,
    get activeElement() {
      return activeElement;
    },
    createElement
  };
  const ui = globalThis.PWM.ContentModalUi.createContentModalUi({
    documentRef,
    windowRef: {
      addEventListener: (type, handler, capture) => listeners.push(["add", type, handler, capture]),
      removeEventListener: (type, handler, capture) => listeners.push(["remove", type, handler, capture])
    },
    getModalOpen: () => modalOpen,
    setModalOpen: (value) => {
      modalOpen = Boolean(value);
    }
  });
  return { ui, documentElement, listeners, get modalOpen() { return modalOpen; } };
}

function click(element) {
  const event = {
    target: element,
    defaultPrevented: false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    stopImmediatePropagation() {
      this.immediatePropagationStopped = true;
    }
  };
  element.listeners.click(event);
  return event;
}

async function testDecisionModalConsumesActionClick() {
  const harness = createUi();
  const promise = harness.ui.showDecisionModal([{}], "paste");
  const redact = findByText(harness.documentElement, "Redact");

  assert.ok(redact);
  assert.strictEqual(harness.modalOpen, true);
  const event = click(redact);
  const decision = await promise;

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(event.propagationStopped, true);
  assert.strictEqual(event.immediatePropagationStopped, true);
  assert.deepStrictEqual(decision, { action: "redact" });
  assert.strictEqual(harness.documentElement.children.length, 0);
}

async function testMessageModalAndOpenGate() {
  const { ui, documentElement } = createUi();
  const promise = ui.showMessageModal("Blocked", "Nothing raw was sent.");
  assert.deepStrictEqual(await ui.showDecisionModal([{}], "submit"), { action: "cancel" });
  const close = findByText(documentElement, "Close");
  assert.ok(close);
  click(close);
  await promise;
  assert.strictEqual(documentElement.children.length, 0);
}

testDecisionModalConsumesActionClick()
  .then(() => testMessageModalAndOpenGate())
  .then(() => {
    console.log("PASS content modal UI");
  });
