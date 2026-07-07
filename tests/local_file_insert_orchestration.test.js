const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/localFileInsertOrchestration.js"));

function createHarness(overrides = {}) {
  const calls = {
    blocks: [],
    clears: [],
    consumes: [],
    failProcessing: [],
    inserts: [],
    logs: [],
    multiFiles: [],
    preflights: [],
    processingSites: [],
    reads: [],
    sanitizations: [],
    transferPolicies: []
  };
  const input = { tagName: "TEXTAREA" };
  const dataTransfer = { files: [{ name: "secrets.txt", type: "text/plain" }] };
  const localTransferFiles = overrides.localTransferFiles || dataTransfer.files;
  const localFile = {
    handled: true,
    ok: true,
    text: "API_KEY=LeakGuardInsertSecret123456",
    file: {
      name: "secrets.txt",
      type: "text/plain",
      sizeBytes: 128
    }
  };
  const localFileRead = overrides.localFileRead || {
    done: false,
    localFile,
    contentExtractionResult: null
  };
  const attachPreflight = overrides.attachPreflight || {
    done: false,
    imageRedactionMode: false,
    sizeInfo: { zone: "fast", bytes: 128 },
    shouldSkipTextFallback: false,
    preflightPlan: { mode: "direct" },
    optimizedStatus: false
  };
  const sanitization = overrides.sanitization || {
    ok: true,
    analysis: { findings: [{ raw: "LeakGuardInsertSecret123456" }] },
    result: { redactedText: "API_KEY=[PWM_1]" },
    sanitizedFile: { name: "secrets-redacted.txt", type: "text/plain" }
  };
  const insertResult = overrides.insertResult || { handled: true, ok: true, source: "insert" };

  const orchestration =
    globalThis.PWM.LocalFileInsertOrchestration.createLocalFileInsertOrchestration({
      blockWhatsAppFileAttachment: async (event) => {
        calls.blocks.push(event);
        return { handled: true, ok: false, reason: "whatsapp_file_attachments_unsupported" };
      },
      clearLocalFileInputSelection: (target) => calls.clears.push(target),
      consumeInterceptionEvent: (event) => {
        calls.consumes.push(event);
        event.defaultPrevented = true;
      },
      createSanitizedTextFile: () => ({}),
      dataTransferHasFiles: () => true,
      describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "" }),
      fileAttachPipeline: {
        createProcessingStageControls: ({ site }) => {
          calls.processingSites.push(site);
          return {
            failProcessing: (reason, title) => calls.failProcessing.push({ reason, title }),
            hideProcessing: (reason) => calls.hideProcessing = reason,
            showProcessingSuccess: (details) => calls.showProcessingSuccess = details
          };
        }
      },
      getCurrentHandoffDriverId: () => "chatgpt",
      getLocalFileAttachPreflightOrchestration: () => ({
        prepareLocalFileAttachPreflight: async (args) => {
          calls.preflights.push(args);
          return attachPreflight;
        }
      }),
      getLocalFileReadOrchestration: () => ({
        readLocalFileForInsert: async (args) => {
          calls.reads.push(args);
          return localFileRead;
        }
      }),
      getLocalFileSanitizationOrchestration: () => ({
        sanitizeLocalFileForAttach: async (args) => {
          calls.sanitizations.push(args);
          return sanitization;
        }
      }),
      getLocalFileTransferPolicyGate: () => ({
        maybeHandleLocalFileTransferPolicy: async (...args) => {
          calls.transferPolicies.push(args);
          return overrides.transferPolicyResult ?? null;
        }
      }),
      getSanitizedFileInsertOrchestration: () => ({
        handleSanitizedLocalFileAttach: async (args) => {
          calls.inserts.push(args);
          return insertResult;
        }
      }),
      hideFileProcessingOverlay: () => {},
      isExtensionRuntimeAvailable: () => true,
      isFirefoxRuntime: () => false,
      isGeminiHost: () => false,
      isModalOpen: () => false,
      isPotentialWhatsAppMultiFileAttach: () => false,
      isProtectedFileDropDriver: () => false,
      isSupportedWhatsAppClipboardImagePaste: () => false,
      isSupportedWhatsAppDocxAttach: () => false,
      isSupportedWhatsAppImageAttach: () => false,
      isSupportedWhatsAppPdfAttach: () => false,
      isSupportedWhatsAppTextDocumentAttach: () => false,
      isSupportedWhatsAppXlsxAttach: () => false,
      isWhatsAppHost: () => false,
      listLocalTransferFiles: () => localTransferFiles,
      logFileInterception: (label, details) => calls.logs.push({ label, details }),
      maybeHandleMultiFileInsert: async (...args) => {
        calls.multiFiles.push(args);
        return overrides.multiFileResult ?? null;
      },
      readLocalTextFileFromDataTransfer: async () => localFile,
      resolveLocalFileTransferPolicy: (transfer) => ({ transfer }),
      shouldUseContentFileExtractionPipeline: () => false,
      showFileProcessingError: () => {},
      showFileProcessingSuccess: () => {},
      whatsappFileAttachBlockTitle: "WhatsApp file upload blocked",
      whatsappFileAttachUnsupportedReason: "whatsapp_file_attachments_unsupported",
      ...overrides
    });

  return { calls, dataTransfer, input, insertResult, localFile, orchestration };
}

async function testUnsupportedWhatsAppFileBlocksBeforeRead() {
  const { calls, dataTransfer, input, orchestration } = createHarness({
    isWhatsAppHost: () => true
  });
  const event = { defaultPrevented: false, target: { tagName: "DIV" } };

  const result = await orchestration.maybeHandleLocalFileInsert(event, input, dataTransfer, "paste");

  assert.deepStrictEqual(result, {
    handled: true,
    ok: false,
    reason: "whatsapp_file_attachments_unsupported"
  });
  assert.deepStrictEqual(calls.failProcessing, [
    {
      reason: "whatsapp_file_attachments_unsupported",
      title: "WhatsApp file upload blocked"
    }
  ]);
  assert.deepStrictEqual(calls.blocks, [event]);
  assert.deepStrictEqual(calls.reads, []);
  assert.deepStrictEqual(calls.consumes, []);
}

async function testMultiFileDelegationShortCircuitsSingleFileStages() {
  const multiFileResult = { handled: true, ok: true, source: "multi" };
  const { calls, dataTransfer, input, orchestration } = createHarness({
    multiFileResult
  });
  const event = { defaultPrevented: false, target: { tagName: "DIV" } };

  const result = await orchestration.maybeHandleLocalFileInsert(event, input, dataTransfer, "drop");

  assert.strictEqual(result, multiFileResult);
  assert.strictEqual(calls.multiFiles.length, 1);
  assert.deepStrictEqual(calls.transferPolicies, []);
  assert.deepStrictEqual(calls.reads, []);
  assert.deepStrictEqual(calls.consumes, []);
}

async function testTransferPolicyShortCircuitsBeforeConsumingEvent() {
  const transferPolicyResult = { handled: true, ok: false, reason: "unsupported_file" };
  const { calls, dataTransfer, input, orchestration } = createHarness({
    transferPolicyResult
  });
  const event = { defaultPrevented: false, target: { tagName: "DIV" } };

  const result = await orchestration.maybeHandleLocalFileInsert(event, input, dataTransfer, "drop");

  assert.strictEqual(result, transferPolicyResult);
  assert.strictEqual(calls.transferPolicies.length, 1);
  assert.deepStrictEqual(calls.consumes, []);
  assert.deepStrictEqual(calls.reads, []);
}

async function testSupportedClipboardImagePasteContinuesAfterConsume() {
  const { calls, dataTransfer, input, insertResult, orchestration } = createHarness({
    isSupportedWhatsAppClipboardImagePaste: () => true,
    isWhatsAppHost: () => true
  });
  const event = { defaultPrevented: true, target: { tagName: "DIV" } };

  const result = await orchestration.maybeHandleLocalFileInsert(event, input, dataTransfer, "paste");

  assert.strictEqual(result, insertResult);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.preflights.length, 1);
  assert.strictEqual(calls.sanitizations.length, 1);
  assert.strictEqual(calls.inserts.length, 1);
  assert.deepStrictEqual(calls.blocks, []);
}

async function testSuccessfulFileInputPipelineClearsSupportedAttachSelection() {
  const fileInput = { tagName: "INPUT", type: "file" };
  const { calls, dataTransfer, input, insertResult, orchestration } = createHarness({
    isSupportedWhatsAppTextDocumentAttach: () => true
  });
  const event = { defaultPrevented: false, target: fileInput };

  const result = await orchestration.maybeHandleLocalFileInsert(event, input, dataTransfer, "file-input");

  assert.strictEqual(result, insertResult);
  assert.deepStrictEqual(calls.consumes, [event]);
  assert.deepStrictEqual(calls.clears, [fileInput]);
  assert.deepStrictEqual(calls.processingSites, ["chatgpt"]);
  assert.strictEqual(calls.logs[0].label, "file input intercepted");
  assert.deepStrictEqual(calls.preflights[0].attachModes, {
    textDocument: true,
    pdf: false,
    docx: false,
    xlsx: false
  });
  assert.strictEqual(calls.inserts[0].sanitizedFile.name, "secrets-redacted.txt");
}

(async () => {
  await testUnsupportedWhatsAppFileBlocksBeforeRead();
  await testMultiFileDelegationShortCircuitsSingleFileStages();
  await testTransferPolicyShortCircuitsBeforeConsumingEvent();
  await testSupportedClipboardImagePasteContinuesAfterConsume();
  await testSuccessfulFileInputPipelineClearsSupportedAttachSelection();
  console.log("PASS local file insert orchestration");
})();
