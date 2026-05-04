const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");

require(path.join(repoRoot, "src/content/file_paste_helpers.js"));

const { dataTransferHasFiles } = globalThis.PWM.FilePasteHelpers;

function extractFunctionSource(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `expected to find function ${name}`);

  const start = match.index;
  const openBrace = source.indexOf("{", start);
  assert.notStrictEqual(openBrace, -1, `expected ${name} to have a body`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Could not extract function ${name}`);
}

function createDataTransfer({ files = true, exposeFiles = true } = {}) {
  const file = {
    name: "secrets.env",
    type: "text/plain",
    size: 42
  };

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
    files: exposeFiles ? [file] : [],
    items: [
      {
        kind: "file",
        getAsFile: () => file
      }
    ],
    dropEffect: "none"
  };
}

function createEvent({
  dataTransfer = createDataTransfer(),
  target = { tagName: "SPAN" },
  sanitized = false,
  defaultPrevented: initialDefaultPrevented = false
} = {}) {
  let defaultPrevented = initialDefaultPrevented;
  const calls = {
    preventDefault: 0,
    stopPropagation: 0,
    stopImmediatePropagation: 0
  };
  const event = {
    dataTransfer,
    target,
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

function createHarness(overrides = {}) {
  const calls = {
    reads: [],
    redactions: [],
    createdFiles: [],
    handoffs: [],
    badges: [],
    hideBadgeSoon: 0,
    refreshBadge: 0,
    modals: []
  };
  const activeElement = { tagName: "TEXTAREA" };
  const dependencies = {
    extensionRuntimeAvailable: true,
    modalOpen: false,
    fileDragGuard: null,
    rawFileDropInterceptions: new WeakSet(),
    dataTransferHasFiles,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text: "API_KEY=LeakGuardDropApiKey1234567890",
        file: {
          name: "secrets.env",
          type: "text/plain"
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = { name: file.name, type: file.type, text };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    },
    analyzeText: (text) => ({
      normalizedText: text,
      secretFindings: [{ raw: "LeakGuardDropApiKey1234567890" }]
    }),
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      return {
        redactedText: text.replace("LeakGuardDropApiKey1234567890", "[PWM_1]")
      };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return true;
    },
    setBadge: (...args) => calls.badges.push(args),
    hideBadgeSoon: () => {
      calls.hideBadgeSoon += 1;
    },
    refreshBadgeFromCurrentInput: () => {
      calls.refreshBadge += 1;
    },
    showMessageModal: async (...args) => {
      calls.modals.push(args);
    },
    findComposer: () => null,
    document: { activeElement }
  };
  Object.assign(dependencies, overrides);

  const factory = new Function(
    ...Object.keys(dependencies),
    [
      extractFunctionSource(contentSource, "consumeInterceptionEvent"),
      extractFunctionSource(contentSource, "dataTransferLooksLikeFiles"),
      extractFunctionSource(contentSource, "isSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "maybeHandleLocalFileInsert"),
      extractFunctionSource(contentSource, "maybeHandleDrop"),
      extractFunctionSource(contentSource, "maybeHandleFileDrag"),
      "return { maybeHandleDrop, maybeHandleFileDrag };"
    ].join("\n\n")
  );
  const handlers = factory(...Object.values(dependencies));

  return {
    ...handlers,
    calls,
    activeElement
  };
}

async function testFileDragoverIsAcceptedWithoutComposerTarget() {
  const { maybeHandleFileDrag } = createHarness({
    findComposer: () => {
      throw new Error("dragover should not require composer detection");
    }
  });
  const dataTransfer = createDataTransfer({ exposeFiles: false });
  const { event, calls } = createEvent({
    dataTransfer,
    target: { tagName: "MAT-ICON" }
  });

  maybeHandleFileDrag(event);

  assert.strictEqual(calls.preventDefault, 1);
  assert.strictEqual(calls.stopPropagation, 1);
  assert.strictEqual(calls.stopImmediatePropagation, 0);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(dataTransfer.dropEffect, "copy");
}

async function testFileDragoverIsAcceptedWithoutHelperLoaded() {
  const { maybeHandleFileDrag } = createHarness({
    dataTransferHasFiles: undefined
  });
  const dataTransfer = createDataTransfer({ exposeFiles: false });
  const { event, calls } = createEvent({
    dataTransfer,
    target: { tagName: "P" }
  });

  maybeHandleFileDrag(event);

  assert.strictEqual(calls.preventDefault, 1);
  assert.strictEqual(calls.stopPropagation, 1);
  assert.strictEqual(calls.stopImmediatePropagation, 0);
  assert.strictEqual(dataTransfer.dropEffect, "copy");
}

async function testFileDropIsHandledWithoutComposerTarget() {
  const dropTarget = { tagName: "MAT-ICON" };
  const findComposerCalls = [];
  const { maybeHandleDrop, calls, activeElement } = createHarness({
    findComposer: (target) => {
      findComposerCalls.push(target);
      return null;
    }
  });
  const dataTransfer = createDataTransfer();
  const { event, calls: eventCalls } = createEvent({
    dataTransfer,
    target: dropTarget
  });

  await maybeHandleDrop(event);

  assert.deepStrictEqual(findComposerCalls, [dropTarget, activeElement]);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.reads[0], dataTransfer);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].input, null);
  assert.strictEqual(calls.handoffs[0].context, "drop");
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes("LeakGuardDropApiKey"), false);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

async function testFileDropIsBlockedWithoutHelperLoaded() {
  const { maybeHandleDrop, calls } = createHarness({
    dataTransferHasFiles: undefined,
    readLocalTextFileFromDataTransfer: undefined
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "P" }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
}

async function testFileDropIsConsumedBeforeComposerLookup() {
  const findComposerCalls = [];
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: (target) => {
      findComposerCalls.push(target);
      assert.strictEqual(event.defaultPrevented, true);
      return null;
    }
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "P" }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(findComposerCalls.length, 2);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.preventDefault, 2);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

async function testDuplicateDropListenerDoesNotDoubleHandleSameEvent() {
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: () => null
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "DIV" }
  });

  await maybeHandleDrop(event);
  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

async function testFileDropHandlesEarlierPreventDefaultWithoutComposerTarget() {
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: () => null
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "DIV" },
    defaultPrevented: true
  });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].input, null);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

async function testNonFileDragoverIsIgnored() {
  const dataTransfer = createDataTransfer({ files: false });
  const drag = createEvent({ dataTransfer });
  const drop = createEvent({ dataTransfer });
  const { maybeHandleDrop, maybeHandleFileDrag, calls } = createHarness();

  maybeHandleFileDrag(drag.event);
  await maybeHandleDrop(drop.event);

  assert.strictEqual(drag.calls.preventDefault, 0);
  assert.strictEqual(drop.calls.preventDefault, 0);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(dataTransfer.dropEffect, "none");
}

async function testSanitizedFileHandoffDropIsIgnored() {
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: () => {
      throw new Error("sanitized handoff drops should bypass interception");
    }
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    sanitized: true
  });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 0);
}

async function testComposerTargetDropStillPassesComposer() {
  const dropTarget = { tagName: "TEXTAREA" };
  const composer = { tagName: "TEXTAREA", id: "prompt-textarea" };
  const findComposerCalls = [];
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: (target) => {
      findComposerCalls.push(target);
      return target === dropTarget ? composer : null;
    }
  });
  const { event } = createEvent({
    dataTransfer: createDataTransfer(),
    target: dropTarget
  });

  await maybeHandleDrop(event);

  assert.deepStrictEqual(findComposerCalls, [dropTarget]);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].input, composer);
  assert.strictEqual(calls.handoffs[0].context, "drop");
}

(async () => {
  await testFileDragoverIsAcceptedWithoutComposerTarget();
  await testFileDragoverIsAcceptedWithoutHelperLoaded();
  await testFileDropIsHandledWithoutComposerTarget();
  await testFileDropIsBlockedWithoutHelperLoaded();
  await testFileDropIsConsumedBeforeComposerLookup();
  await testDuplicateDropListenerDoesNotDoubleHandleSameEvent();
  await testFileDropHandlesEarlierPreventDefaultWithoutComposerTarget();
  await testNonFileDragoverIsIgnored();
  await testSanitizedFileHandoffDropIsIgnored();
  await testComposerTargetDropStillPassesComposer();
  console.log("PASS content file drop interception regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
