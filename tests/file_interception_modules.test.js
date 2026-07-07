const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileDropInterception.js"));
require(path.join(repoRoot, "src/content/files/fileInputInterception.js"));

function createDragEvent(dataTransfer) {
  const calls = {
    preventDefault: 0,
    stopPropagation: 0,
    stopImmediatePropagation: 0
  };
  return {
    dataTransfer,
    calls,
    preventDefault() {
      calls.preventDefault += 1;
    },
    stopPropagation() {
      calls.stopPropagation += 1;
    },
    stopImmediatePropagation() {
      calls.stopImmediatePropagation += 1;
    }
  };
}

function testFileDropInterceptionClaimsFileDrags() {
  const calls = {
    detected: 0
  };
  const drop = globalThis.PWM.FileDropInterception.createFileDropInterception({
    dataTransferLooksLikeFiles: () => true,
    handleFileDragDetected: () => {
      calls.detected += 1;
    }
  });
  const dataTransfer = {
    dropEffect: "none"
  };
  const event = createDragEvent(dataTransfer);

  const result = drop.maybeHandleFileDrag(event);

  assert.strictEqual(result?.handled, true);
  assert.deepStrictEqual(event.calls, {
    preventDefault: 1,
    stopPropagation: 1,
    stopImmediatePropagation: 1
  });
  assert.strictEqual(dataTransfer.dropEffect, "copy");
  assert.strictEqual(calls.detected, 1);
}

function testFileDropInterceptionIgnoresNonFileDrags() {
  const drop = globalThis.PWM.FileDropInterception.createFileDropInterception({
    dataTransferLooksLikeFiles: () => false,
    handleFileDragDetected: () => {
      throw new Error("non-file drags should not be detected");
    }
  });
  const event = createDragEvent({
    dropEffect: "none"
  });

  assert.strictEqual(drop.maybeHandleFileDrag(event), undefined);
  assert.deepStrictEqual(event.calls, {
    preventDefault: 0,
    stopPropagation: 0,
    stopImmediatePropagation: 0
  });
}

function createFileInputEvent(overrides = {}) {
  return {
    defaultPrevented: false,
    target: {
      tagName: "INPUT",
      type: "file",
      files: []
    },
    ...overrides
  };
}

function testFileInputInterceptionPreflightMatchesFileInputsOnly() {
  const input = globalThis.PWM.FileInputInterception.createFileInputInterception({
    dataTransferHasFiles: () => true
  });

  assert.strictEqual(
    input.shouldHandleFileInputChange(createFileInputEvent(), {
      extensionRuntimeAvailable: true,
      modalOpen: false
    }),
    true
  );
  assert.strictEqual(
    input.shouldHandleFileInputChange(createFileInputEvent({ defaultPrevented: true }), {
      extensionRuntimeAvailable: true,
      modalOpen: false
    }),
    false
  );
  assert.strictEqual(
    input.shouldHandleFileInputChange(createFileInputEvent({ target: { tagName: "TEXTAREA", type: "" } }), {
      extensionRuntimeAvailable: true,
      modalOpen: false
    }),
    false
  );
  assert.strictEqual(
    input.shouldHandleFileInputChange(createFileInputEvent(), {
      extensionRuntimeAvailable: false,
      modalOpen: false
    }),
    false
  );
}

function testFileInputInterceptionBuildsTransfersAndSelectedFileChecks() {
  const sourceFile = {
    name: "one.txt"
  };
  const input = globalThis.PWM.FileInputInterception.createFileInputInterception({
    dataTransferHasFiles: (transfer) => Array.from(transfer.files || []).length > 0
  });

  assert.strictEqual(input.hasSelectedFiles([sourceFile]), true);
  assert.strictEqual(input.hasSelectedFiles([]), false);
  assert.deepStrictEqual(input.createSelectedTransfer([sourceFile]), {
    files: [sourceFile],
    types: ["Files"],
    items: []
  });
}

function testFileInputInterceptionComposerGatePreservesFallbackReasons() {
  const input = globalThis.PWM.FileInputInterception.createFileInputInterception({
    dataTransferHasFiles: () => true
  });

  assert.strictEqual(
    input.shouldContinueWithoutComposer({
      input: null,
      isGeminiHost: false,
      hasContentExtractionFile: false,
      hasFailClosedProtectedUnsupportedFile: false,
      hasSupportedWhatsAppAttach: false,
      hasWhatsAppFileInputSelection: false,
      isFirefoxRuntime: false,
      isProtectedFileDropDriver: false,
      currentHandoffDriverId: ""
    }),
    false
  );
  assert.strictEqual(
    input.shouldContinueWithoutComposer({
      input: null,
      isGeminiHost: false,
      hasContentExtractionFile: true,
      hasFailClosedProtectedUnsupportedFile: false,
      hasSupportedWhatsAppAttach: false,
      hasWhatsAppFileInputSelection: false,
      isFirefoxRuntime: false,
      isProtectedFileDropDriver: false,
      currentHandoffDriverId: ""
    }),
    true
  );
  assert.strictEqual(
    input.shouldContinueWithoutComposer({
      input: null,
      isGeminiHost: false,
      hasContentExtractionFile: false,
      hasFailClosedProtectedUnsupportedFile: false,
      hasSupportedWhatsAppAttach: false,
      hasWhatsAppFileInputSelection: false,
      isFirefoxRuntime: true,
      isProtectedFileDropDriver: true,
      currentHandoffDriverId: "gemini"
    }),
    true
  );
  assert.strictEqual(
    input.shouldContinueWithoutComposer({
      input: null,
      isGeminiHost: false,
      hasContentExtractionFile: false,
      hasFailClosedProtectedUnsupportedFile: false,
      hasSupportedWhatsAppAttach: false,
      hasWhatsAppFileInputSelection: false,
      isFirefoxRuntime: false,
      isProtectedFileDropDriver: true,
      currentHandoffDriverId: "generic"
    }),
    true
  );
}

testFileDropInterceptionClaimsFileDrags();
testFileDropInterceptionIgnoresNonFileDrags();
testFileInputInterceptionPreflightMatchesFileInputsOnly();
testFileInputInterceptionBuildsTransfersAndSelectedFileChecks();
testFileInputInterceptionComposerGatePreservesFallbackReasons();

console.log("PASS file interception modules");
