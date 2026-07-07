const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileDropOrchestration.js"));

function createHarness(overrides = {}) {
  const calls = {
    blocks: [],
    clears: [],
    consumes: [],
    dragDetected: [],
    errors: [],
    localInserts: [],
    modals: [],
    notices: [],
    originalHandoffs: [],
    setBadges: [],
    setGeminiHashes: []
  };
  const rawFileDropInterceptions = new WeakSet();
  const localFiles = overrides.localFiles || [{ name: "secrets.txt", type: "text/plain" }];
  const originalTransfer = { files: localFiles, original: true };
  const snapshotTransfer = { files: localFiles, snapshot: true };
  const composer = { tagName: "TEXTAREA" };
  const event = {
    dataTransfer: originalTransfer,
    target: composer
  };

  const orchestration =
    globalThis.PWM.FileDropOrchestration.createFileDropOrchestration({
      blockFirefoxGeminiUnavailableDrop: async (dropEvent) => {
        calls.blocks.push({ type: "firefox-gemini", event: dropEvent });
      },
      blockWhatsAppFileAttachment: async (dropEvent) => {
        calls.blocks.push({ type: "whatsapp", event: dropEvent });
      },
      clearFileDragSession: (options) => calls.clears.push(options || null),
      consumeInterceptionEvent: (dropEvent) => calls.consumes.push(dropEvent),
      dataTransferLooksLikeFiles: () => true,
      documentRef: { activeElement: composer },
      findComposer: () => composer,
      getCurrentHandoffDriver: () => ({ usesDmzOverlay: true }),
      getCurrentHandoffDriverId: () => "chatgpt",
      getGeminiDropSessionHash: () => "gemini-drop-hash",
      getUnsupportedFileBlockedMessage: () => "Unsupported file blocked.",
      getUnsupportedFileBlockedTitle: () => "Unsupported file",
      handOffOriginalLocalFile: (...args) => calls.originalHandoffs.push(args),
      handleFileDragDetected: (dropEvent) => calls.dragDetected.push(dropEvent),
      hideBadgeSoon: (delayMs) => calls.hideBadgeSoon = delayMs,
      hideFileProcessingOverlay: (reason) => calls.hideOverlay = reason,
      isExtensionRuntimeAvailable: () => true,
      isFirefoxDataTransferFileUnavailableSnapshot: () => false,
      isFirefoxRuntime: () => false,
      isGeminiHost: () => false,
      isModalOpen: () => false,
      isPotentialWhatsAppMultiFileAttach: () => false,
      isSanitizedFileHandoffEvent: () => false,
      isSupportedWhatsAppDocxAttach: () => false,
      isSupportedWhatsAppImageAttach: () => false,
      isSupportedWhatsAppPdfAttach: () => false,
      isSupportedWhatsAppTextDocumentAttach: () => false,
      isSupportedWhatsAppXlsxAttach: () => false,
      isWhatsAppHost: () => false,
      listLocalTransferFiles: () => localFiles,
      maybeHandleLocalFileInsert: async (...args) => {
        calls.localInserts.push(args);
        return { handled: true, ok: true };
      },
      rawFileDropInterceptions,
      refreshBadgeFromCurrentInput: () => {
        calls.refreshBadge = (calls.refreshBadge || 0) + 1;
      },
      resolveLocalFileTransferPolicy: () => ({ action: "redact" }),
      setBadge: (message) => calls.setBadges.push(message),
      setLastGeminiDropSessionHash: (hash) => calls.setGeminiHashes.push(hash),
      shouldBlockUnsupportedFileTransfer: () => false,
      shouldFailClosedProtectedUnsupportedFileTransfer: () => false,
      shouldUseContentFileExtractionPipeline: () => false,
      showFileProcessingError: (title, details) => calls.errors.push({ title, details }),
      showMessageModal: async (title, message) => calls.modals.push({ title, message }),
      showUnsupportedFilePassThroughNotice: (policy) => calls.notices.push(policy),
      snapshotLocalFileDataTransfer: () => snapshotTransfer,
      ...overrides
    });

  return { calls, composer, event, localFiles, orchestration, rawFileDropInterceptions, snapshotTransfer };
}

async function testFirefoxGeminiUnavailableDropBlocksBeforeConsuming() {
  const { calls, event, orchestration } = createHarness({
    isFirefoxRuntime: () => true,
    isGeminiHost: () => true,
    isFirefoxDataTransferFileUnavailableSnapshot: () => true
  });

  await orchestration.maybeHandleDrop(event);

  assert.deepStrictEqual(calls.blocks, [{ type: "firefox-gemini", event }]);
  assert.deepStrictEqual(calls.consumes, []);
  assert.deepStrictEqual(calls.localInserts, []);
}

async function testUnsupportedWhatsAppDropBlocksAndClearsSession() {
  const { calls, event, orchestration, rawFileDropInterceptions } = createHarness({
    isWhatsAppHost: () => true
  });

  await orchestration.maybeHandleDrop(event);

  assert.strictEqual(rawFileDropInterceptions.has(event), true);
  assert.deepStrictEqual(calls.blocks, [{ type: "whatsapp", event }]);
  assert.deepStrictEqual(calls.clears, [null]);
  assert.deepStrictEqual(calls.localInserts, []);
}

async function testFailClosedUnsupportedAllowedPolicyConsumesBeforeModal() {
  const { calls, event, orchestration, rawFileDropInterceptions } = createHarness({
    resolveLocalFileTransferPolicy: () => ({ action: "allow", message: "Allowed unsupported file." }),
    shouldBlockUnsupportedFileTransfer: () => true
  });

  await orchestration.maybeHandleDrop(event);

  assert.strictEqual(rawFileDropInterceptions.has(event), true);
  assert.deepStrictEqual(calls.consumes, [event]);
  assert.deepStrictEqual(calls.errors, [
    {
      title: "Unsupported file",
      details: {
        site: "chatgpt",
        reason: "firefox_unsupported_file_blocked"
      }
    }
  ]);
  assert.deepStrictEqual(calls.modals, [
    {
      title: "Unsupported file",
      message: "Unsupported file blocked."
    }
  ]);
  assert.deepStrictEqual(calls.localInserts, []);
}

async function testGeminiAllowedPolicyPassesThroughOriginalFile() {
  const { calls, event, orchestration, snapshotTransfer } = createHarness({
    isGeminiHost: () => true,
    resolveLocalFileTransferPolicy: () => ({ action: "allow", reason: "unsupported" })
  });

  await orchestration.maybeHandleDrop(event);

  assert.deepStrictEqual(calls.consumes, [event]);
  assert.deepStrictEqual(calls.originalHandoffs, [[event, snapshotTransfer, "drop"]]);
  assert.deepStrictEqual(calls.notices, [{ action: "allow", reason: "unsupported" }]);
  assert.deepStrictEqual(calls.clears, [null]);
  assert.deepStrictEqual(calls.localInserts, []);
}

async function testNormalDropConsumesAndDelegatesToLocalInsert() {
  const { calls, composer, event, orchestration, snapshotTransfer } = createHarness({
    isGeminiHost: () => true
  });

  await orchestration.maybeHandleDrop(event);

  assert.deepStrictEqual(calls.consumes, [event]);
  assert.deepStrictEqual(calls.setGeminiHashes, ["gemini-drop-hash"]);
  assert.deepStrictEqual(calls.dragDetected, [event]);
  assert.deepStrictEqual(calls.localInserts, [[event, composer, snapshotTransfer, "drop"]]);
  assert.deepStrictEqual(calls.clears, [{ keepDmzOverlay: true }]);
}

(async () => {
  await testFirefoxGeminiUnavailableDropBlocksBeforeConsuming();
  await testUnsupportedWhatsAppDropBlocksAndClearsSession();
  await testFailClosedUnsupportedAllowedPolicyConsumesBeforeModal();
  await testGeminiAllowedPolicyPassesThroughOriginalFile();
  await testNormalDropConsumesAndDelegatesToLocalInsert();
  console.log("PASS file drop orchestration");
})();
