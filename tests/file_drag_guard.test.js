const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.join(__dirname, "..");
const guardSource = fs.readFileSync(path.join(repoRoot, "src/content/file_drag_guard.js"), "utf8");

function createEventTarget() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, listener, capture) {
      listeners[type] = listeners[type] || [];
      listeners[type].push({ listener, capture });
    }
  };
}

function createDataTransfer({ files = true } = {}) {
  if (!files) {
    return {
      types: ["text/plain"],
      files: [],
      items: [],
      dropEffect: "none"
    };
  }

  return {
    types: ["Files"],
    files: [],
    items: [{ kind: "file", type: "text/plain" }],
    dropEffect: "none"
  };
}

function createEvent({ dataTransfer = createDataTransfer(), sanitized = false } = {}) {
  let defaultPrevented = false;
  const calls = {
    preventDefault: 0,
    stopPropagation: 0,
    stopImmediatePropagation: 0
  };
  const event = {
    dataTransfer,
    get defaultPrevented() {
      return defaultPrevented;
    },
    preventDefault() {
      calls.preventDefault += 1;
      defaultPrevented = true;
    },
    stopPropagation() {
      calls.stopPropagation += 1;
    },
    stopImmediatePropagation() {
      calls.stopImmediatePropagation += 1;
    }
  };

  if (sanitized) {
    Object.defineProperty(event, "__PWM_SANITIZED_FILE_HANDOFF__", {
      value: true,
      configurable: true
    });
  }

  return { event, calls };
}

function createSandbox() {
  const windowTarget = createEventTarget();
  const documentTarget = createEventTarget();
  const sandbox = {
    window: windowTarget,
    document: documentTarget,
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  sandbox.Array = Array;
  sandbox.Number = Number;
  sandbox.String = String;
  sandbox.Boolean = Boolean;
  sandbox.WeakSet = WeakSet;

  vm.runInNewContext(guardSource, sandbox, {
    filename: "file_drag_guard.js"
  });

  return { sandbox, windowTarget, documentTarget };
}

function dispatch(target, type, event) {
  for (const entry of target.listeners[type] || []) {
    entry.listener(event);
  }
}

async function testDragoverPreventsFileDragBeforeRuntimeLoads() {
  const { windowTarget } = createSandbox();
  const { event, calls } = createEvent({
    dataTransfer: createDataTransfer()
  });

  dispatch(windowTarget, "dragover", event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.preventDefault, 1);
  assert.strictEqual(calls.stopPropagation, 1);
  assert.strictEqual(calls.stopImmediatePropagation, 0);
  assert.strictEqual(event.dataTransfer.dropEffect, "copy");
}

async function testDropConsumesRawFileAndDelegatesOnce() {
  const { sandbox, windowTarget, documentTarget } = createSandbox();
  const delegatedEvents = [];
  sandbox.__PWM_FILE_DRAG_GUARD__.setDropHandler((event) => {
    delegatedEvents.push(event);
  });
  const { event, calls } = createEvent({
    dataTransfer: createDataTransfer()
  });

  dispatch(windowTarget, "drop", event);
  dispatch(documentTarget, "drop", event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.preventDefault, 2);
  assert.strictEqual(calls.stopPropagation, 2);
  assert.strictEqual(calls.stopImmediatePropagation, 2);
  assert.deepStrictEqual(delegatedEvents, [event]);
}

async function testNonFileDragIsIgnored() {
  const { windowTarget } = createSandbox();
  const { event, calls } = createEvent({
    dataTransfer: createDataTransfer({ files: false })
  });

  dispatch(windowTarget, "dragover", event);
  dispatch(windowTarget, "drop", event);

  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(calls.preventDefault, 0);
  assert.strictEqual(calls.stopPropagation, 0);
  assert.strictEqual(calls.stopImmediatePropagation, 0);
}

async function testSanitizedHandoffIsIgnored() {
  const { windowTarget } = createSandbox();
  const { event, calls } = createEvent({
    dataTransfer: createDataTransfer(),
    sanitized: true
  });

  dispatch(windowTarget, "dragover", event);
  dispatch(windowTarget, "drop", event);

  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(calls.preventDefault, 0);
  assert.strictEqual(calls.stopPropagation, 0);
  assert.strictEqual(calls.stopImmediatePropagation, 0);
}

(async () => {
  await testDragoverPreventsFileDragBeforeRuntimeLoads();
  await testDropConsumesRawFileAndDelegatesOnce();
  await testNonFileDragIsIgnored();
  await testSanitizedHandoffIsIgnored();
  console.log("PASS early file drag guard regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
