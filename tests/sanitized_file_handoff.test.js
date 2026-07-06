const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/sanitizedFileHandoff.js"));

function createInput() {
  return {
    type: "file",
    files: [],
    events: [],
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    }
  };
}

function createTransfer(files) {
  return {
    files,
    items: {
      add() {}
    }
  };
}

function createHandoff(overrides = {}) {
  const calls = {
    marks: [],
    debug: [],
    logs: [],
    replacements: []
  };
  const handoff = globalThis.PWM.SanitizedFileHandoff.createSanitizedFileHandoff({
    EventRef: class {
      constructor(type) {
        this.type = type;
      }
    },
    isFileInputElement: (input) => input?.type === "file",
    isFirefoxRuntime: () => false,
    canAssignFilesToInput: () => true,
    getCurrentHandoffDriverId: () => "chatgpt",
    isProtectedFileDropDriver: () => false,
    markFirefoxFileInputTransactionReplaced: (...args) => calls.replacements.push(args),
    markSanitizedFileHandoff: (...args) => calls.marks.push(args),
    markUntrackedSanitizedFileInputHandoff: () => {},
    deleteSanitizedFileHandoffMark: () => {},
    assignSafeFileAttachErrorMetadata: () => {},
    describeFileForDebug: (file) => ({ name: file?.name || "" }),
    describeFileInputForDebug: () => ({ source: "test" }),
    debugFileAttachMetadata: (label, payload) => calls.debug.push({ label, payload }),
    debugReveal: (label, payload) => calls.debug.push({ label, payload }),
    logFileInterception: (label, payload) => calls.logs.push({ label, payload }),
    createSanitizedDataTransfer: (files) => createTransfer(files),
    dispatchSanitizedFileEvent: () => false,
    prepareFileInputForSanitizedHandoff: () => () => {},
    resolveFileInputForHandoff: () => null,
    shouldUseWhatsAppDocumentInputForFiles: () => false,
    resolveWhatsAppDocumentDropInputForHandoff: async () => null,
    verifyWhatsAppSanitizedMultiFileAttach: () => false,
    ...overrides
  });
  return { handoff, calls };
}

function testSingleInputAssignmentDispatchesInputAndChange() {
  const input = createInput();
  const files = [{ name: "safe.txt" }];
  const details = {};
  const { handoff, calls } = createHandoff();

  assert.strictEqual(handoff.handOffSanitizedFileInput(input, createTransfer(files), { details }), true);
  assert.deepStrictEqual(input.files, files);
  assert.deepStrictEqual(input.events, ["input", "change"]);
  assert.strictEqual(details.inputFilesAssignmentSucceeded, true);
  assert.strictEqual(calls.marks.length, 1);
}

async function testBatchHandoffUsesResolvedInput() {
  const input = createInput();
  const files = [{ name: "one.txt" }, { name: "two.txt" }];
  const { handoff } = createHandoff({
    resolveFileInputForHandoff: () => input
  });

  assert.strictEqual(await handoff.handOffSanitizedFileBatch({ type: "drop" }, null, files, "drop"), true);
  assert.deepStrictEqual(input.files, files);
}

async function testBatchHandoffUsesPreparedFallbackRestore() {
  const input = createInput();
  const files = [{ name: "one.txt" }, { name: "two.txt" }];
  let restored = false;
  const { handoff } = createHandoff({
    resolveFileInputForHandoff: (event, sourceInput, options = {}) => (options.allowIncompatible ? input : null),
    prepareFileInputForSanitizedHandoff: () => () => {
      restored = true;
    },
    verifyWhatsAppSanitizedMultiFileAttach: () => ({ ok: true, assignedCount: 2 })
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "drop" }, null, files, "drop", {
      originalFiles: files,
      verifyWhatsAppBatch: true
    }),
    true
  );
  assert.deepStrictEqual(input.files, files);
  assert.strictEqual(restored, true);
}

async function run() {
  testSingleInputAssignmentDispatchesInputAndChange();
  await testBatchHandoffUsesResolvedInput();
  await testBatchHandoffUsesPreparedFallbackRestore();
  console.log("PASS sanitized file handoff");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
