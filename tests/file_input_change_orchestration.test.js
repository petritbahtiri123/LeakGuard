const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileInputChangeOrchestration.js"));

function createFileInput(files = []) {
  return {
    tagName: "INPUT",
    type: "file",
    files
  };
}

function createEvent(target, type = "change") {
  const calls = {
    preventDefault: 0,
    stopPropagation: 0,
    stopImmediatePropagation: 0
  };
  return {
    type,
    target,
    defaultPrevented: false,
    calls,
    preventDefault() {
      calls.preventDefault += 1;
      this.defaultPrevented = true;
    },
    stopPropagation() {
      calls.stopPropagation += 1;
    },
    stopImmediatePropagation() {
      calls.stopImmediatePropagation += 1;
    }
  };
}

function createHarness(overrides = {}) {
  const calls = {
    clears: [],
    consumes: [],
    debug: [],
    inserts: [],
    suppressions: [],
    transactions: []
  };
  const fileInputProcessingSignatures = new WeakMap();
  const sanitizedFileInputHandoffs = new WeakSet();
  const transactions = new WeakMap();
  const composer = { tagName: "TEXTAREA" };
  const sourceFile = { name: "secrets.txt", type: "text/plain" };
  const fileInput = createFileInput([sourceFile]);
  const selectedTransfer = { files: [sourceFile], types: ["Files"], items: [] };
  const inputInterception = {
    shouldHandleFileInputChange: () => true,
    createSelectedTransfer: () => selectedTransfer,
    hasSelectedFiles: (files) => Array.from(files || []).length > 0,
    shouldContinueWithoutComposer: () => true
  };

  const orchestration =
    globalThis.PWM.FileInputChangeOrchestration.createFileInputChangeOrchestration({
      clearLocalFileInputSelection: (target) => calls.clears.push(target),
      consumeInterceptionEvent: (event) => {
        calls.consumes.push(event);
        event.defaultPrevented = true;
      },
      contentDebugEvents: {
        FILE_HANDOFF_PENDING_DUPLICATE_SUPPRESSED: "file-input:duplicate-suppressed"
      },
      dateNow: () => 1000,
      debugReveal: (label, details) => calls.debug.push({ label, details }),
      describeFileInputForDebug: (target, label) => ({ label, type: target?.type || "" }),
      fileInputProcessingSignatures,
      findComposer: () => composer,
      getCurrentHandoffDriverId: () => "chatgpt",
      getFileInputInterception: () => inputInterception,
      getFileListMetadataSignature: (files) =>
        Array.from(files || []).map((file) => file.name || "").join("|"),
      getFirefoxFileInputTransaction: (target) => transactions.get(target) || null,
      getSanitizedFileInputHandoffSuppression: () => null,
      hideBadgeSoon: (delayMs) => calls.hideBadgeSoon = delayMs,
      isExtensionRuntimeAvailable: () => true,
      isFirefoxProtectedFileInputEvent: () => false,
      isFirefoxRuntime: () => false,
      isGeminiHost: () => false,
      isModalOpen: () => false,
      isPotentialWhatsAppMultiFileAttach: () => false,
      isProtectedFileDropDriver: () => false,
      isSupportedWhatsAppDocxAttach: () => false,
      isSupportedWhatsAppImageAttach: () => false,
      isSupportedWhatsAppPdfAttach: () => false,
      isSupportedWhatsAppTextDocumentAttach: () => false,
      isSupportedWhatsAppXlsxAttach: () => false,
      isWhatsAppHost: () => false,
      markFirefoxFileInputTransactionReplaced: (target, files) => {
        calls.markedReplaced = { target, files };
      },
      maybeHandleLocalFileInsert: async (...args) => {
        calls.inserts.push(args);
        return { handled: true, ok: true };
      },
      programmaticInputSuppressMs: 500,
      resolveLocalFileTransferPolicy: () => ({ action: "redact" }),
      sanitizedFileInputHandoffs,
      setBadge: (message) => calls.badge = message,
      setFirefoxFileInputTransaction: (target, transaction) => {
        calls.transactions.push({ target, transaction });
        transactions.set(target, transaction);
        return transaction;
      },
      shouldFailClosedProtectedUnsupportedFileTransfer: () => false,
      shouldSuppressFirefoxFileInputEvent: () => false,
      shouldUseContentFileExtractionPipeline: () => false,
      suppressSanitizedFileInputHandoffEvent: (event, suppression) => {
        calls.suppressions.push({ event, suppression });
      },
      ...overrides
    });

  return {
    calls,
    composer,
    fileInput,
    fileInputProcessingSignatures,
    inputInterception,
    orchestration,
    sanitizedFileInputHandoffs,
    selectedTransfer,
    sourceFile,
    transactions
  };
}

async function testWhatsAppEmptyProcessingEventIsSuppressed() {
  const { calls, fileInput, fileInputProcessingSignatures, orchestration } = createHarness({
    isWhatsAppHost: () => true
  });
  fileInput.files = [];
  fileInputProcessingSignatures.set(fileInput, "previous");
  const event = createEvent(fileInput);

  const result = await orchestration.maybeHandleFileInputChange(event);

  assert.deepStrictEqual(result, {
    handled: true,
    ok: true,
    strategy: "whatsapp-empty-processing-event-suppressed"
  });
  assert.deepStrictEqual(calls.consumes, [event]);
  assert.strictEqual(calls.debug[0].label, "file-input:whatsapp-empty-processing-event-suppressed");
}

async function testSanitizedHandoffSuppressionShortCircuits() {
  const suppression = { reason: "sanitized-handoff" };
  const { calls, fileInput, orchestration } = createHarness({
    getSanitizedFileInputHandoffSuppression: () => suppression
  });
  const event = createEvent(fileInput);

  const result = await orchestration.maybeHandleFileInputChange(event);

  assert.strictEqual(result.strategy, "sanitized-file-handoff-suppressed");
  assert.deepStrictEqual(calls.suppressions, [{ event, suppression }]);
  assert.deepStrictEqual(calls.inserts, []);
}

async function testDuplicateRawFileInputEventIsSuppressed() {
  const { calls, fileInput, fileInputProcessingSignatures, orchestration } = createHarness();
  fileInputProcessingSignatures.set(fileInput, "secrets.txt");
  const event = createEvent(fileInput);

  const result = await orchestration.maybeHandleFileInputChange(event);

  assert.strictEqual(result.strategy, "duplicate-file-input-event-suppressed");
  assert.deepStrictEqual(calls.consumes, [event]);
  assert.deepStrictEqual(calls.inserts, []);
}

async function testNormalFileInputDelegatesAndClearsProcessingSignature() {
  const { calls, composer, fileInput, fileInputProcessingSignatures, orchestration, selectedTransfer } =
    createHarness();
  const event = createEvent(fileInput);

  const result = await orchestration.maybeHandleFileInputChange(event);

  assert.deepStrictEqual(result, { handled: true, ok: true });
  assert.deepStrictEqual(calls.inserts, [[event, composer, selectedTransfer, "file-input"]]);
  assert.strictEqual(fileInputProcessingSignatures.has(fileInput), false);
}

async function testOwnedFileInputStopsPropagationBeforeAsyncInsert() {
  let releaseInsert;
  const insertGate = new Promise((resolve) => {
    releaseInsert = resolve;
  });
  const { calls, fileInput, orchestration } = createHarness({
    maybeHandleLocalFileInsert: async (...args) => {
      calls.inserts.push(args);
      await insertGate;
      return { handled: true, ok: true };
    }
  });
  const event = createEvent(fileInput);

  const resultPromise = orchestration.maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(event.calls.stopPropagation, 1);
  assert.strictEqual(event.calls.stopImmediatePropagation, 1);
  assert.strictEqual(event.__PWM_FILE_INPUT_PROPAGATION_STOPPED__, true);
  assert.strictEqual(calls.inserts.length, 1);
  releaseInsert();
  const result = await resultPromise;

  assert.deepStrictEqual(result, { handled: true, ok: true });
}

async function testRawInputEventStopsWithoutStartingInsert() {
  const { calls, fileInput, orchestration } = createHarness();
  const event = createEvent(fileInput, "input");

  const result = await orchestration.maybeHandleFileInputChange(event);

  assert.deepStrictEqual(result, {
    handled: true,
    ok: true,
    strategy: "raw-file-input-event-suppressed"
  });
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(event.calls.stopPropagation, 1);
  assert.strictEqual(event.calls.stopImmediatePropagation, 1);
  assert.strictEqual(calls.inserts.length, 0);
  assert.strictEqual(calls.debug[0].label, "file-input:raw-input-event-suppressed");
}

async function testFirefoxProtectedInputTracksReplacementState() {
  const {
    calls,
    fileInput,
    orchestration
  } = createHarness({
    isFirefoxProtectedFileInputEvent: () => true
  });
  const event = createEvent(fileInput);

  const result = await orchestration.maybeHandleFileInputChange(event);

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(calls.consumes, [event]);
  assert.deepStrictEqual(calls.clears, [fileInput]);
  assert.strictEqual(calls.transactions[0].transaction.state, "processing");
  assert.strictEqual(calls.transactions.at(-1).transaction.state, "replaced");
  assert.strictEqual(calls.badge, "LeakGuard replaced the selected file with a sanitized copy.");
  assert.strictEqual(calls.hideBadgeSoon, 3200);
}

(async () => {
  await testWhatsAppEmptyProcessingEventIsSuppressed();
  await testSanitizedHandoffSuppressionShortCircuits();
  await testDuplicateRawFileInputEventIsSuppressed();
  await testNormalFileInputDelegatesAndClearsProcessingSignature();
  await testOwnedFileInputStopsPropagationBeforeAsyncInsert();
  await testRawInputEventStopsWithoutStartingInsert();
  await testFirefoxProtectedInputTracksReplacementState();
  console.log("PASS file input change orchestration");
})();
