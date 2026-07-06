const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/ui/contentStatusUi.js"));

function createElement(tagName) {
  const children = [];
  const classes = new Set();
  const element = {
    tagName: String(tagName || "").toUpperCase(),
    className: "",
    textContent: "",
    hidden: false,
    type: "",
    attributes: {},
    children,
    parentNode: null,
    isConnected: false,
    listeners: {},
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
      contains(name) {
        return classes.has(name);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
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
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    querySelector(selector) {
      const wanted = selector.startsWith(".") ? selector.slice(1) : "";
      const queue = [...children];
      while (queue.length) {
        const candidate = queue.shift();
        if (String(candidate.className || "").split(/\s+/).includes(wanted)) return candidate;
        queue.push(...(candidate.children || []));
      }
      return null;
    }
  };
  return element;
}

function createUi(overrides = {}) {
  const appended = [];
  const timeouts = [];
  const calls = { pauses: [], protectedSites: 0, options: 0 };
  const documentElement = createElement("html");
  const originalAppendChild = documentElement.appendChild.bind(documentElement);
  documentElement.appendChild = (child) => {
    appended.push(child);
    return originalAppendChild(child);
  };
  const ui = globalThis.PWM.ContentStatusUi.createContentStatusUi({
    documentRef: {
      documentElement,
      createElement
    },
    windowRef: {
      clearTimeout: () => {},
      setTimeout: (callback, delay) => {
        timeouts.push({ callback, delay });
        return timeouts.length;
      }
    },
    locationRef: { host: "chat.example" },
    getActiveProtection: () => ({ paused: false, allowProtectionPause: true, protectionEnforced: false }),
    getPlaceholderCount: () => 2,
    openProtectedSitesUi: async () => {
      calls.protectedSites += 1;
      return { opened: true };
    },
    openOptionsPage: async () => {
      calls.options += 1;
      return { ok: true };
    },
    setProtectionPaused: async (paused) => {
      calls.pauses.push(paused);
    },
    ...overrides
  });
  return { ui, appended, timeouts, calls };
}

function testBadgeVisibilityAndHideTimer() {
  const { ui, appended, timeouts } = createUi();

  ui.setBadge("Sensitive content detected");
  const badge = appended.find((element) => element.className === "pwm-badge");
  assert.ok(badge);
  assert.strictEqual(badge.textContent, "Sensitive content detected");
  assert.strictEqual(badge.classList.contains("is-visible"), true);

  ui.hideBadgeSoon(25);
  assert.strictEqual(timeouts[0].delay, 25);
  timeouts[0].callback();
  assert.strictEqual(badge.classList.contains("is-visible"), false);
}

async function testStatusPanelRendersRowsAndPauseAction() {
  const { ui, appended, calls } = createUi();

  const panel = ui.updateStatusPanel({
    hasComposer: true,
    detectedCount: 1,
    placeholderNormalized: false
  });
  assert.ok(panel);
  assert.ok(appended.some((element) => element.className === "pwm-panel"));
  assert.strictEqual(panel.querySelector(".pwm-panel-title").textContent, "LeakGuard");
  const values = [];
  const collectValues = (element) => {
    if (String(element.className || "").split(/\s+/).includes("pwm-panel-value")) {
      values.push(element.textContent);
    }
    (element.children || []).forEach(collectValues);
  };
  collectValues(panel);
  assert.deepStrictEqual(values, [
    "Active",
    "chat.example",
    "1 sensitive item detected",
    "2 placeholders active"
  ]);

  const pause = panel.querySelector(".pwm-panel-pause");
  await pause.listeners.click({
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {}
  });
  assert.deepStrictEqual(calls.pauses, [true]);
}

testBadgeVisibilityAndHideTimer();
testStatusPanelRendersRowsAndPauseAction().then(() => {
  console.log("PASS content status UI");
});
