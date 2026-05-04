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
    documentElement: null,
    body: null,
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

function createNamedFileDataTransfer(name) {
  const file = { name, type: "application/octet-stream", size: 8 };
  return {
    types: ["Files"],
    files: [file],
    items: [
      {
        kind: "file",
        getAsFile: () => file
      }
    ],
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
      event.__immediateStopped = true;
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
  const documentElementTarget = createEventTarget();
  const bodyTarget = createEventTarget();
  documentTarget.documentElement = documentElementTarget;
  documentTarget.body = bodyTarget;
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

  runGuard(sandbox);

  return { sandbox, windowTarget, documentTarget, documentElementTarget, bodyTarget };
}

function runGuard(sandbox) {
  vm.runInNewContext(guardSource, sandbox, {
    filename: "file_drag_guard.js"
  });
}

function dispatch(target, type, event) {
  event.__immediateStopped = false;
  for (const entry of target.listeners[type] || []) {
    entry.listener(event);
    if (event.__immediateStopped) break;
  }
}

async function testDragoverPreventsFileDragBeforeRuntimeLoads() {
  const { windowTarget, documentElementTarget, bodyTarget } = createSandbox();
  const { event, calls } = createEvent({
    dataTransfer: createDataTransfer()
  });

  dispatch(windowTarget, "dragover", event);
  dispatch(documentElementTarget, "dragover", event);
  dispatch(bodyTarget, "dragover", event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.preventDefault, 3);
  assert.strictEqual(calls.stopPropagation, 3);
  assert.strictEqual(calls.stopImmediatePropagation, 3);
  assert.strictEqual(event.dataTransfer.dropEffect, "copy");
}

async function testDragoverListenersAreExplicitlyNonPassive() {
  const { windowTarget, documentTarget, documentElementTarget, bodyTarget } = createSandbox();
  [windowTarget, documentTarget, documentElementTarget, bodyTarget].forEach((target) => {
    const dragover = target.listeners.dragover?.[0];
    assert.strictEqual(dragover.capture.capture, true);
    assert.strictEqual(dragover.capture.passive, false);
    const dragend = target.listeners.dragend?.[0];
    assert.strictEqual(dragend.capture.capture, true);
    assert.strictEqual(dragend.capture.passive, false);
  });
}

async function testDuplicateInitDoesNotDuplicateListeners() {
  const { sandbox, windowTarget, documentTarget, documentElementTarget, bodyTarget } = createSandbox();
  const before = [windowTarget, documentTarget, documentElementTarget, bodyTarget].map((target) => ({
    dragenter: target.listeners.dragenter?.length || 0,
    dragover: target.listeners.dragover?.length || 0,
    drop: target.listeners.drop?.length || 0,
    dragend: target.listeners.dragend?.length || 0
  }));

  runGuard(sandbox);

  const after = [windowTarget, documentTarget, documentElementTarget, bodyTarget].map((target) => ({
    dragenter: target.listeners.dragenter?.length || 0,
    dragover: target.listeners.dragover?.length || 0,
    drop: target.listeners.drop?.length || 0,
    dragend: target.listeners.dragend?.length || 0
  }));
  assert.deepStrictEqual(after, before);
  assert.strictEqual(Boolean(windowTarget.__LEAKGUARD_FILE_DRAG_GUARD_INIT__?.initialized), true);
}

async function testDropConsumesRawFileAndDelegatesOnce() {
  const { sandbox, windowTarget, documentTarget } = createSandbox();
  const delegatedEvents = [];
  sandbox.__PWM_FILE_DRAG_GUARD__.setDropHandler((event) => {
    assert.strictEqual(event.defaultPrevented, true);
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

async function testDragoverBlocksImmediatelyWithoutDomDiscovery() {
  const { windowTarget, documentTarget } = createSandbox();
  documentTarget.querySelectorAll = () => {
    throw new Error("dragover should not query DOM");
  };
  const dataTransfer = createDataTransfer();
  const { event, calls } = createEvent({ dataTransfer });
  let nativePageHandlerCalls = 0;
  windowTarget.addEventListener("dragover", () => {
    nativePageHandlerCalls += 1;
  });

  dispatch(windowTarget, "dragover", event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.preventDefault, 1);
  assert.strictEqual(calls.stopImmediatePropagation, 1);
  assert.strictEqual(nativePageHandlerCalls, 0);
  assert.strictEqual(dataTransfer.dropEffect, "copy");
}

async function testDragoverDoesNotReadLayoutApis() {
  const { windowTarget } = createSandbox();
  const target = {};
  ["offsetWidth", "offsetHeight"].forEach((property) => {
    Object.defineProperty(target, property, {
      get() {
        throw new Error(`dragover should not read ${property}`);
      }
    });
  });
  target.getClientRects = () => {
    throw new Error("dragover should not call getClientRects");
  };
  target.getBoundingClientRect = () => {
    throw new Error("dragover should not call getBoundingClientRect");
  };
  const { event } = createEvent({ dataTransfer: createDataTransfer() });
  event.target = target;

  dispatch(windowTarget, "dragover", event);

  assert.strictEqual(event.defaultPrevented, true);
}

async function testDragDetectedCallbackRunsOncePerSession() {
  const { sandbox, windowTarget } = createSandbox();
  let dragDetections = 0;
  sandbox.__PWM_FILE_DRAG_GUARD__.setDragHandler(() => {
    dragDetections += 1;
  });
  const first = createEvent({ dataTransfer: createDataTransfer() });
  const second = createEvent({ dataTransfer: createDataTransfer() });

  dispatch(windowTarget, "dragover", first.event);
  dispatch(windowTarget, "dragover", second.event);

  assert.strictEqual(dragDetections, 1);
}

async function testRawDroppedFileCannotReachNativePageHandlers() {
  const { windowTarget } = createSandbox();
  let nativePageHandlerCalls = 0;
  windowTarget.addEventListener("drop", () => {
    nativePageHandlerCalls += 1;
  });
  const { event } = createEvent({
    dataTransfer: createDataTransfer()
  });

  dispatch(windowTarget, "drop", event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(nativePageHandlerCalls, 0);
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

async function testUnsupportedBinaryDropPassesThroughByDefault() {
  const { windowTarget } = createSandbox();
  let nativePageHandlerCalls = 0;
  windowTarget.addEventListener("drop", () => {
    nativePageHandlerCalls += 1;
  });
  const { event, calls } = createEvent({
    dataTransfer: createNamedFileDataTransfer("brief.pdf")
  });

  dispatch(windowTarget, "drop", event);

  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(calls.preventDefault, 0);
  assert.strictEqual(calls.stopImmediatePropagation, 0);
  assert.strictEqual(nativePageHandlerCalls, 1);
}

async function testStrictPolicyResolverBlocksUnknownBinaryDrop() {
  const { sandbox, windowTarget } = createSandbox();
  let nativePageHandlerCalls = 0;
  sandbox.__PWM_FILE_DRAG_GUARD__.setFilePolicyResolver(() => ({
    action: "block",
    reason: "unknown_binary_strict"
  }));
  windowTarget.addEventListener("drop", () => {
    nativePageHandlerCalls += 1;
  });
  const { event } = createEvent({
    dataTransfer: createNamedFileDataTransfer("payload.bin")
  });

  dispatch(windowTarget, "drop", event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(nativePageHandlerCalls, 0);
}

(async () => {
  await testDragoverPreventsFileDragBeforeRuntimeLoads();
  await testDragoverListenersAreExplicitlyNonPassive();
  await testDuplicateInitDoesNotDuplicateListeners();
  await testDropConsumesRawFileAndDelegatesOnce();
  await testDragoverBlocksImmediatelyWithoutDomDiscovery();
  await testDragoverDoesNotReadLayoutApis();
  await testDragDetectedCallbackRunsOncePerSession();
  await testRawDroppedFileCannotReachNativePageHandlers();
  await testNonFileDragIsIgnored();
  await testSanitizedHandoffIsIgnored();
  await testUnsupportedBinaryDropPassesThroughByDefault();
  await testStrictPolicyResolverBlocksUnknownBinaryDrop();
  console.log("PASS early file drag guard regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
