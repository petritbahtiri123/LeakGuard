const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/sanitizedFileInsertOrchestration.js"));

function createHarness(overrides = {}) {
  const calls = {
    badges: [],
    clearOptimization: [],
    dmzCleanups: [],
    dmzStates: [],
    handoffs: [],
    hideBadgeSoon: [],
    hideProcessing: [],
    markWhatsApp: [],
    overlays: [],
    refreshBadge: 0,
    successes: []
  };
  const sanitizedFile = { name: "image.redacted.png", type: "image/png", size: 128 };
  const localFile = {
    file: {
      name: "image.png",
      type: "image/png",
      sizeBytes: 512
    }
  };
  const analysis = {
    secretFindings: [{ type: "ocr_secret" }]
  };
  const result = {
    redactedText: "",
    replacements: []
  };
  const driver = {
    usesDmzOverlay: true,
    preparePayload: (payloadFile, redactedText, metadata) => ({
      sanitizedFile: payloadFile,
      redactedText,
      metadata
    }),
    handoff: async (payload) => {
      calls.handoffs.push(payload);
      return { ok: true, strategy: "sanitized-file-handoff" };
    },
    insertSanitizedText: async () => {
      throw new Error("image file-only handoff should skip text fallback");
    }
  };
  const fileAttachPipeline = {
    runSanitizedFileAttachFlow: async (options) => {
      assert.strictEqual(options.context, "drop");
      assert.strictEqual(options.allowPendingFallback, true);
      assert.strictEqual(options.defaultSuccessStrategy, "sanitized-file-handoff");
      assert.strictEqual(options.failureReason, "sanitized_file_handoff_failed");
      assert.strictEqual(options.usesDmzOverlay, true);
      await options.tryDropHandoff();
      return {
        action: "success",
        disposition: {
          shouldSetDmzAttached: true,
          dmzStatus: "Sanitized file attached",
          dmzMode: "attached",
          shouldScheduleDmzCleanup: true,
          dmzCleanupDelay: 1200,
          shouldShowAttachedBadge: true,
          shouldHideProcessing: true,
          hideProcessingReason: "attached"
        },
        handoffClassification: {
          handled: true,
          ok: true,
          stage: "file",
          strategy: "sanitized-file-handoff"
        }
      };
    }
  };
  const orchestration =
    globalThis.PWM.SanitizedFileInsertOrchestration.createSanitizedFileInsertOrchestration({
      fileAttachPipeline,
      clearLocalPayloadOptimizationStatus: (sizeInfo, cleanup) => calls.clearOptimization.push({ sizeInfo, cleanup }),
      debugReveal: () => {},
      describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "" }),
      findComposer: (target) => target?.composer || null,
      getCurrentHandoffDriver: () => driver,
      getFileHandoffAdapterForLocation: () => null,
      handOffSanitizedLocalFile: async () => ({ ok: false }),
      hideBadgeSoon: (delayMs) => calls.hideBadgeSoon.push(delayMs),
      hideProcessing: (reason) => calls.hideProcessing.push(reason),
      isFileHandoffAdapterPendingAttachEnabled: () => false,
      isWhatsAppHost: () => true,
      markWhatsAppSanitizedImageHandoff: (input) => calls.markWhatsApp.push(input),
      refreshBadgeFromCurrentInput: () => {
        calls.refreshBadge += 1;
      },
      scheduleDmzOverlayCleanup: (delayMs) => calls.dmzCleanups.push(delayMs),
      setBadge: (message) => calls.badges.push(message),
      setDmzOverlayState: (status, mode) => calls.dmzStates.push({ status, mode }),
      showProcessingSuccess: (status, reason) => calls.successes.push({ status, reason }),
      updateFileProcessingOverlay: (details) => calls.overlays.push(details),
      ...overrides
    });

  return { orchestration, calls, sanitizedFile, localFile, analysis, result };
}

async function testSuccessfulImageAttachAppliesDispositionAndMarksWhatsApp() {
  const { orchestration, calls, sanitizedFile, localFile, analysis, result } = createHarness();
  const composer = { tagName: "DIV" };
  const event = { target: { composer } };
  const sizeInfo = { zone: "fast", bytes: 512 };
  const preflightPlan = {
    optimizedStatus: {
      cleanupOnAttachSuccess: "attach-success"
    },
    handoffStatus: {
      shouldSetDmzReady: true,
      dmzStatus: "Ready",
      dmzMode: "ready",
      processingStatus: "Preparing sanitized upload...",
      processingProgress: "Complete",
      processingBlocking: true
    },
    attachFlowOptions: {
      skipFallbackReason: "skip-text",
      allowPendingFallback: true,
      defaultSuccessStrategy: "sanitized-file-handoff",
      failureReason: "sanitized_file_handoff_failed",
      successStatus: "attached",
      fileStrategy: "sanitized-file-handoff",
      textStrategy: "sanitized-text-fallback"
    }
  };

  const attachResult = await orchestration.handleSanitizedLocalFileAttach({
    event,
    input: null,
    localFile,
    analysis,
    result,
    sanitizedFile,
    context: "drop",
    processingSite: "whatsapp",
    sizeInfo,
    preflightPlan,
    optimizedStatus: true,
    imageRedactionMode: true,
    shouldSkipTextFallback: true,
    attachModes: {
      textDocument: false,
      pdf: false,
      docx: false,
      xlsx: false
    },
    controls: {
      hideProcessing: (reason) => calls.hideProcessing.push(reason),
      showProcessingSuccess: (status, reason) => calls.successes.push({ status, reason }),
      failProcessing: () => {}
    }
  });

  assert.deepStrictEqual(attachResult, {
    handled: true,
    ok: true,
    stage: "file",
    strategy: "sanitized-file-handoff"
  });
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedFile);
  assert.strictEqual(calls.handoffs[0].allowFileOnlyHandoff, true);
  assert.strictEqual(calls.handoffs[0].imageRedactionMode, true);
  assert.deepStrictEqual(calls.clearOptimization, [{ sizeInfo, cleanup: "attach-success" }]);
  assert.deepStrictEqual(calls.dmzStates, [
    { status: "Ready", mode: "ready" },
    { status: "Sanitized file attached", mode: "attached" }
  ]);
  assert.deepStrictEqual(calls.dmzCleanups, [1200]);
  assert.deepStrictEqual(calls.badges, ["LeakGuard attached a sanitized local file."]);
  assert.deepStrictEqual(calls.hideBadgeSoon, [3200]);
  assert.deepStrictEqual(calls.hideProcessing, ["attached"]);
  assert.deepStrictEqual(calls.markWhatsApp, [composer]);
  assert.strictEqual(calls.refreshBadge, 1);
}

(async () => {
  await testSuccessfulImageAttachAppliesDispositionAndMarksWhatsApp();
  console.log("PASS sanitized file insert orchestration");
})();
