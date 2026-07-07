const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileAttachPipeline.js"));
require(path.join(repoRoot, "src/content/files/streamingFileInsertOrchestration.js"));

function file(name, type = "text/plain", extra = {}) {
  return {
    name,
    type,
    size: 5 * 1024 * 1024,
    ...extra
  };
}

function createHarness(overrides = {}) {
  const calls = {
    blockStreaming: [],
    details: [],
    failProcessing: [],
    genericHandoffs: 0,
    hideBadgeSoon: [],
    hideProcessing: [],
    overlays: [],
    pendingQueues: [],
    refreshBadge: 0,
    setBadge: [],
    stream: []
  };
  const geminiAdapter = { id: "gemini" };
  const sanitizedFile = file("large.redacted.env", "text/plain", { size: 128 });
  const sourceFile = file("large.env");
  const localFile = {
    ok: false,
    code: "streaming_required",
    sourceFile,
    file: {
      name: "large.env",
      type: "text/plain",
      sizeBytes: sourceFile.size
    }
  };
  const orchestration =
    globalThis.PWM.StreamingFileInsertOrchestration.createStreamingFileInsertOrchestration({
      fileAttachPipeline: globalThis.PWM.FileAttachPipeline,
      blockStreamingLocalFile: async (event, title, message) => {
        calls.blockStreaming.push({ event, title, message });
        return { handled: true, ok: false, reason: "blocked" };
      },
      createSanitizedFileHandoffDetails: (event, pendingFile, stage) => {
        const details = { stage, file: pendingFile };
        calls.details.push({ event, pendingFile, stage, details });
        return details;
      },
      getFileHandoffAdapterById: (id) => (id === "gemini" ? geminiAdapter : null),
      getFileHandoffAdapterForLocation: () => null,
      getPendingSanitizedAttachPromptMessage: (id) => `Attach sanitized file in ${id}`,
      handOffSanitizedLocalFile: async () => {
        calls.genericHandoffs += 1;
        return false;
      },
      hideBadgeSoon: (delayMs) => calls.hideBadgeSoon.push(delayMs),
      isFileHandoffAdapterPendingAttachEnabled: () => false,
      isFirefoxRuntime: () => false,
      isGeminiHost: () => true,
      isGrokHost: () => false,
      queuePendingSanitizedFileHandoff: (adapter, event, input, pendingFile, details) => {
        calls.pendingQueues.push({ adapter, event, input, pendingFile, details });
        return true;
      },
      refreshBadgeFromCurrentInput: () => {
        calls.refreshBadge += 1;
      },
      setBadge: (message) => calls.setBadge.push(message),
      showFileProcessingError: () => {},
      streamRedactLocalTextFile: async (inputFile, metadata) => {
        calls.stream.push({ inputFile, metadata });
        return {
          action: "redacted",
          sanitizedFile
        };
      },
      updateFileProcessingOverlay: (details) => calls.overlays.push(details),
      ...overrides
    });

  return { orchestration, calls, localFile, sanitizedFile, sourceFile };
}

async function testGeminiStreamingDropQueuesPendingSanitizedFile() {
  const { orchestration, calls, localFile, sanitizedFile, sourceFile } = createHarness();
  const event = { type: "drop" };
  const input = { tagName: "TEXTAREA" };
  const controls = {
    failProcessing: (reason, title) => calls.failProcessing.push({ reason, title }),
    hideProcessing: (reason) => calls.hideProcessing.push(reason),
    showProcessingSuccess: () => {}
  };

  const result = await orchestration.maybeHandleStreamingRequiredLocalFile({
    event,
    input,
    localFile,
    context: "drop",
    processingSite: "gemini",
    controls
  });

  assert.deepStrictEqual(result, {
    handled: true,
    ok: true,
    strategy: "gemini-streaming-pending-sanitized-file-handoff"
  });
  assert.deepStrictEqual(calls.stream, [
    {
      inputFile: sourceFile,
      metadata: localFile.file
    }
  ]);
  assert.strictEqual(calls.pendingQueues.length, 1);
  assert.strictEqual(calls.pendingQueues[0].adapter.id, "gemini");
  assert.strictEqual(calls.pendingQueues[0].pendingFile, sanitizedFile);
  assert.strictEqual(calls.details[0].stage, "gemini:streaming-pending-user-upload-input");
  assert.deepStrictEqual(calls.hideProcessing, ["sanitized"]);
  assert.deepStrictEqual(calls.setBadge, ["Attach sanitized file in gemini"]);
  assert.deepStrictEqual(calls.hideBadgeSoon, [6500]);
  assert.strictEqual(calls.refreshBadge, 1);
  assert.strictEqual(calls.blockStreaming.length, 0);
  assert.strictEqual(calls.genericHandoffs, 0);
  assert.deepStrictEqual(calls.failProcessing, []);
  assert.strictEqual(calls.overlays[0].status, "Stream-redacting large file locally...");
  assert.strictEqual(calls.overlays[1].status, "Preparing sanitized upload...");
}

(async () => {
  await testGeminiStreamingDropQueuesPendingSanitizedFile();
  console.log("PASS streaming file insert orchestration");
})();
