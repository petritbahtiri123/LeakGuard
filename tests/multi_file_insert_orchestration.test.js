const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/fileLimits.js"));
require(path.join(repoRoot, "src/content/files/fileAttachPipeline.js"));
require(path.join(repoRoot, "src/content/files/multiFileInsertOrchestration.js"));

function file(name, type = "text/plain", extra = {}) {
  return {
    name,
    type,
    size: 128,
    ...extra
  };
}

function createEvent() {
  return {
    defaultPrevented: false,
    target: {
      tagName: "INPUT",
      type: "file"
    },
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagationCalled: false,
    stopPropagation() {
      this.stopPropagationCalled = true;
    }
  };
}

function createHarness(overrides = {}) {
  const calls = {
    clearedInputs: [],
    consumed: 0,
    debug: [],
    failProcessing: [],
    hideBadgeSoon: [],
    modals: [],
    processed: 0,
    refreshBadge: 0,
    setBadge: []
  };
  const orchestration = globalThis.PWM.MultiFileInsertOrchestration.createMultiFileInsertOrchestration({
    fileAttachPipeline: globalThis.PWM.FileAttachPipeline,
    batchProcessor: {
      createBlockedBeforeProcessingItems: (files, code) =>
        Array.from(files || []).map((sourceFile, index) => ({
          ok: false,
          status: "blocked",
          code,
          summary: {
            index,
            label: `file-${index + 1}`,
            status: "blocked",
            extension: ".txt",
            mimeCategory: "text",
            sizeBytes: sourceFile.size,
            code
          }
        })),
      createMultiFileStatusSummary: (sanitizedItems, blockedItems) =>
        globalThis.PWM.FileAttachPipeline.createMultiFileStatusSummary({
          sanitizedItems,
          blockedItems
        }),
      formatMultiFileStatusMessage: (summary) => `blocked:${summary.blockedCount}`,
      processLocalFilesForSanitizedBatch: async () => {
        calls.processed += 1;
        return [];
      }
    },
    clearLocalFileInputSelection: (input) => calls.clearedInputs.push(input),
    consumeInterceptionEvent: (event) => {
      calls.consumed += 1;
      event.preventDefault();
      event.stopPropagation();
    },
    debugFileAttachMetadata: (label, payload) => calls.debug.push({ label, payload }),
    getFileHandoffAdapterForLocation: () => null,
    hideBadgeSoon: (delayMs) => calls.hideBadgeSoon.push(delayMs),
    isPotentialWhatsAppMultiFileAttach: () => false,
    isSupportedWhatsAppMultiFileAttach: () => true,
    refreshBadgeFromCurrentInput: () => {
      calls.refreshBadge += 1;
    },
    setBadge: (message) => calls.setBadge.push(message),
    showMessageModal: async (title, message) => calls.modals.push({ title, message }),
    ...overrides
  });

  return { orchestration, calls };
}

async function testBlockedPlanFailsClosedBeforeProcessing() {
  const { orchestration, calls } = createHarness({
    maxSmallFiles: 2
  });
  const event = createEvent();
  const files = [file("one.txt"), file("two.txt"), file("three.txt")];
  const controls = {
    failProcessing: (reason, title) => calls.failProcessing.push({ reason, title }),
    showProcessingSuccess: () => {}
  };

  const result = await orchestration.maybeHandleMultiFileInsert(
    event,
    {},
    files,
    "drop",
    "chatgpt",
    controls
  );

  assert.deepStrictEqual(result, {
    handled: true,
    ok: false,
    reason: "small_file_count_exceeded"
  });
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(event.stopPropagationCalled, true);
  assert.strictEqual(calls.clearedInputs.length, 1);
  assert.strictEqual(calls.processed, 0);
  assert.deepStrictEqual(calls.failProcessing, [
    {
      reason: "small_file_count_exceeded",
      title: "Raw file upload blocked"
    }
  ]);
  assert.strictEqual(calls.modals[0].title, "Raw file upload blocked");
  assert.deepStrictEqual(calls.debug.map((entry) => entry.label), ["file-handoff:multi-file-blocked"]);
  assert.strictEqual(calls.debug[0].payload.reason, "small_file_count_exceeded");
  assert.strictEqual(calls.debug[0].payload.summary.files.length, 3);
}

(async () => {
  await testBlockedPlanFailsClosedBeforeProcessing();
  console.log("PASS multi-file insert orchestration");
})();
