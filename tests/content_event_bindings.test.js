const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/bootstrap/eventBindings.js"));

function extractDynamicContentScripts() {
  const source = fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8");
  const match = /const CONTENT_SCRIPT_FILES = \[([\s\S]*?)\];/.exec(source);
  assert.ok(match, "expected background CONTENT_SCRIPT_FILES list");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function createRoot() {
  const listeners = [];
  return {
    listeners,
    addEventListener(type, handler, options) {
      listeners.push({ type, handler, options });
    }
  };
}

function testBindFileDragRootRegistersListenersInStableOrder() {
  const root = createRoot();
  const eventRoots = new WeakSet();
  const onFileDrag = () => {};
  const onFileDrop = () => {};
  const onDragEnd = () => {};

  const didBind = globalThis.PWM.ContentEventBindings.bindFileDragRoot(root, {
    eventRoots,
    fileDragGuard: null,
    onFileDrag,
    onFileDrop,
    onDragEnd
  });

  assert.strictEqual(didBind, true);
  assert.deepStrictEqual(
    root.listeners.map((listener) => listener.type),
    ["dragenter", "dragover", "drop", "dragend"]
  );
  assert.strictEqual(root.listeners[0].handler, onFileDrag);
  assert.strictEqual(root.listeners[1].handler, onFileDrag);
  assert.strictEqual(root.listeners[2].handler, onFileDrop);
  assert.strictEqual(root.listeners[3].handler, onDragEnd);
  root.listeners.forEach((listener) => {
    assert.deepStrictEqual(listener.options, { capture: true, passive: false });
  });

  assert.strictEqual(
    globalThis.PWM.ContentEventBindings.bindFileDragRoot(root, {
      eventRoots,
      fileDragGuard: null,
      onFileDrag,
      onFileDrop,
      onDragEnd
    }),
    false,
    "already-bound roots should not receive duplicate drag listeners"
  );
  assert.strictEqual(root.listeners.length, 4);
}

function testBindFileDragRootDelegatesToEarlyGuardWhenAvailable() {
  const root = createRoot();
  const eventRoots = new WeakSet();
  const guardCalls = [];
  const fileDragGuard = {
    bind(target) {
      guardCalls.push(target);
    }
  };

  const didBind = globalThis.PWM.ContentEventBindings.bindFileDragRoot(root, {
    eventRoots,
    fileDragGuard,
    onFileDrag: () => {},
    onFileDrop: () => {},
    onDragEnd: () => {}
  });

  assert.strictEqual(didBind, true);
  assert.deepStrictEqual(guardCalls, [root]);
  assert.deepStrictEqual(root.listeners, []);
  assert.strictEqual(
    globalThis.PWM.ContentEventBindings.bindFileDragRoot(root, {
      eventRoots,
      fileDragGuard,
      onFileDrag: () => {},
      onFileDrop: () => {},
      onDragEnd: () => {}
    }),
    false
  );
}

function testContentEventBindingsLoadBeforeContentScript() {
  const manifestScripts = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"))
    .content_scripts[0].js;
  const dynamicScripts = extractDynamicContentScripts();

  [manifestScripts, dynamicScripts].forEach((scripts) => {
    const eventBindingsIndex = scripts.indexOf("content/bootstrap/eventBindings.js");
    const contentIndex = scripts.indexOf("content/content.js");

    assert.ok(eventBindingsIndex > -1, "content event bindings should be loaded");
    assert.ok(contentIndex > -1, "content script should be loaded");
    assert.ok(eventBindingsIndex < contentIndex, "content event bindings should load before content.js");
  });

  assert.deepStrictEqual(
    dynamicScripts,
    manifestScripts,
    "dynamic user-site injection should keep bootstrap helper load order aligned with the manifest"
  );
}

testBindFileDragRootRegistersListenersInStableOrder();
testBindFileDragRootDelegatesToEarlyGuardWhenAvailable();
testContentEventBindingsLoadBeforeContentScript();

console.log("PASS content event binding regressions");
