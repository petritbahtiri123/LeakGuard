const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/localFileReadOrchestration.js"));

function createHarness(overrides = {}) {
  const calls = {
    badges: [],
    clears: [],
    failProcessing: [],
    hideBadgeSoon: [],
    logs: [],
    modals: [],
    overlays: [],
    reads: [],
    refreshBadge: 0
  };
  const localFile = {
    handled: true,
    ok: true,
    text: "API_KEY=LeakGuardReadSecret123456",
    file: {
      name: "secrets.env",
      type: "text/plain",
      sizeBytes: 128
    }
  };
  const orchestration =
    globalThis.PWM.LocalFileReadOrchestration.createLocalFileReadOrchestration({
      clearLocalFileInputSelection: (input) => calls.clears.push(input),
      debugReveal: () => {},
      describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "" }),
      getFileUnavailableAfterHandoffSuppression: () => null,
      getFirefoxRawFileUploadBlockedMessage: () => "",
      hideBadgeSoon: (delayMs) => calls.hideBadgeSoon.push(delayMs),
      localFileFromContentExtractionResult: () => localFile,
      logFileInterception: (label, details) => calls.logs.push({ label, details }),
      maybeHandleStreamingRequiredLocalFile: async () => null,
      processFileForAdapterHandoff: async () => null,
      readLocalTextFileFromDataTransfer: async (dataTransfer) => {
        calls.reads.push(dataTransfer);
        return localFile;
      },
      refreshBadgeFromCurrentInput: () => {
        calls.refreshBadge += 1;
      },
      setBadge: (message) => calls.badges.push(message),
      showFileProcessingOverlay: (details) => calls.overlays.push(details),
      showMessageModal: async (title, message) => calls.modals.push({ title, message }),
      suppressFileUnavailableAfterHandoff: () => ({ handled: true, ok: true, reason: "suppressed" }),
      ...overrides
    });

  return { orchestration, calls, localFile };
}

async function testSuccessfulReadReturnsLocalFileForLaterStages() {
  const fileInput = { tagName: "INPUT", type: "file" };
  const dataTransfer = { files: [{ name: "secrets.env" }] };
  const { orchestration, calls, localFile } = createHarness();

  const result = await orchestration.readLocalFileForInsert({
    event: { target: fileInput },
    input: { tagName: "TEXTAREA" },
    dataTransfer,
    contentExtractionFile: null,
    context: "file-input",
    processingSite: "chatgpt",
    controls: {
      failProcessing: (reason, title) => calls.failProcessing.push({ reason, title }),
      hideProcessing: () => {},
      showProcessingSuccess: () => {}
    }
  });

  assert.deepStrictEqual(result, {
    done: false,
    localFile,
    contentExtractionResult: null
  });
  assert.deepStrictEqual(calls.reads, [dataTransfer]);
  assert.deepStrictEqual(calls.clears, [fileInput]);
  assert.deepStrictEqual(calls.overlays, [
    {
      site: "chatgpt",
      title: "LeakGuard is scanning this file...",
      status: "Scanning file locally...",
      progress: "In progress",
      blocking: true
    }
  ]);
  assert.strictEqual(calls.logs.length, 1);
  assert.strictEqual(calls.logs[0].label, "file scan result");
  assert.deepStrictEqual(calls.logs[0].details, {
    handled: true,
    ok: true,
    code: "",
    file: { name: "secrets.env", type: "text/plain" },
    textLength: localFile.text.length
  });
}

async function testUnhandledReadFailsClosedWithoutRawFallback() {
  const failedLocalFile = {
    handled: false,
    ok: false,
    code: "file_scan_failed",
    message: "Local scanner could not read this file.",
    file: {
      name: "archive.zip",
      type: "application/zip"
    }
  };
  const { orchestration, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async () => failedLocalFile
  });

  const result = await orchestration.readLocalFileForInsert({
    event: { target: { tagName: "DIV" } },
    input: null,
    dataTransfer: { files: [{ name: "archive.zip" }] },
    contentExtractionFile: null,
    context: "drop",
    processingSite: "chatgpt",
    controls: {
      failProcessing: (reason, title) => calls.failProcessing.push({ reason, title }),
      hideProcessing: () => {},
      showProcessingSuccess: () => {}
    }
  });

  assert.deepStrictEqual(result, {
    done: true,
    value: {
      handled: true,
      ok: false,
      reason: "file_scan_failed"
    }
  });
  assert.deepStrictEqual(calls.failProcessing, [{ reason: "file_scan_failed", title: "Raw file blocked" }]);
  assert.deepStrictEqual(calls.badges, ["Raw file blocked"]);
  assert.deepStrictEqual(calls.hideBadgeSoon, [4200]);
  assert.deepStrictEqual(calls.modals, [
    {
      title: "Raw file blocked",
      message: "Local scanner could not read this file."
    }
  ]);
  assert.strictEqual(calls.refreshBadge, 1);
}

(async () => {
  await testSuccessfulReadReturnsLocalFileForLaterStages();
  await testUnhandledReadFailsClosedWithoutRawFallback();
  console.log("PASS local file read orchestration");
})();
