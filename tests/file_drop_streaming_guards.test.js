const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/diagnostics/safeSnapshots.js"));
require(path.join(repoRoot, "src/content/files/fileAttachPipeline.js"));

function testFileAttachPipelineStreamingPlanGeminiPending() {
  const plan = globalThis.PWM.FileAttachPipeline.classifyStreamingAttachPlan({
    context: "drop",
    isGeminiDrop: true,
    streamResultAction: "redacted",
    hasSanitizedFile: true
  });

  assert.strictEqual(plan.shouldContinueStreamingAttach, true);
  assert.deepStrictEqual(plan.preparingStatus, {
    processingStatus: "Preparing sanitized upload...",
    processingProgress: "Complete",
    processingBlocking: true
  });
  assert.deepStrictEqual(plan.pendingAttach, {
    shouldAttempt: true,
    provider: "gemini",
    detailsStage: "gemini:streaming-pending-user-upload-input",
    strategy: "gemini-streaming-pending-sanitized-file-handoff",
    queueFailureReason: "gemini_pending_queue_failed",
    queueFailureTitle: "Raw file upload blocked",
    queueFailureMessage: "LeakGuard sanitized the large file but could not queue Gemini pending attach."
  });
}

function testFileAttachPipelineStreamingPlanGrokPending() {
  const plan = globalThis.PWM.FileAttachPipeline.classifyStreamingAttachPlan({
    context: "drop",
    isGrokDrop: true,
    streamResultAction: "redacted",
    hasSanitizedFile: true
  });

  assert.strictEqual(plan.shouldContinueStreamingAttach, true);
  assert.deepStrictEqual(plan.pendingAttach, {
    shouldAttempt: true,
    provider: "grok",
    detailsStage: "grok:streaming-pending-user-upload-input",
    strategy: "grok-streaming-pending-sanitized-file-handoff",
    queueFailureReason: "grok_pending_queue_failed",
    queueFailureTitle: "Raw file upload blocked",
    queueFailureMessage: "LeakGuard sanitized the large file but could not queue Grok pending attach."
  });
}

function testFileAttachPipelineStreamingPlanGenericAttachStrategies() {
  const plan = globalThis.PWM.FileAttachPipeline.classifyStreamingAttachPlan({
    context: "drop",
    streamResultAction: "redacted",
    hasSanitizedFile: true
  });

  assert.strictEqual(plan.shouldContinueStreamingAttach, true);
  assert.strictEqual(plan.pendingAttach.shouldAttempt, false);
  assert.deepStrictEqual(plan.genericAttach, {
    shouldAttempt: true,
    fileStrategy: "streaming-sanitized-file-handoff",
    textStrategy: "streaming-sanitized-text-fallback",
    defaultSuccessStrategy: "streaming-sanitized-file-handoff",
    failureReason: "streaming_sanitized_handoff_failed",
    skipFallbackReason: "firefox_gemini_file_input_replacement_failed",
    failureTitle: "Raw file upload blocked",
    failureMessage: "LeakGuard blocked raw file upload. Sanitized streaming file handoff failed."
  });
  assert.deepStrictEqual(plan.dispositionOptions, {
    forceDmzAttached: true,
    forceAttachedBadge: true
  });
}

function testFileAttachPipelineStreamingPlanBlockedAndFailedLabelsRemainStable() {
  const blockedPlan = globalThis.PWM.FileAttachPipeline.classifyStreamingAttachPlan({
    streamResultAction: "blocked",
    hasSanitizedFile: false
  });
  const failedPlan = globalThis.PWM.FileAttachPipeline.classifyStreamingAttachPlan({
    streamResultAction: "failed",
    hasSanitizedFile: false
  });
  const missingFilePlan = globalThis.PWM.FileAttachPipeline.classifyStreamingAttachPlan({
    streamResultAction: "redacted",
    hasSanitizedFile: false
  });

  assert.deepStrictEqual(blockedPlan.blockedResult, {
    shouldBlock: true,
    reason: "streaming_file_blocked"
  });
  assert.deepStrictEqual(failedPlan.failedResult, {
    shouldBlock: true,
    reason: "streaming_file_redaction_failed",
    title: "Raw file upload blocked",
    message: "LeakGuard blocked raw file upload because streaming redaction failed."
  });
  assert.strictEqual(missingFilePlan.failedResult.shouldBlock, true);
  assert.strictEqual(missingFilePlan.shouldContinueStreamingAttach, false);
}

function testFileAttachPipelineStreamingPlanReturnsPlainDataOnly() {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, "browser");
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const originalPwmKeys = Object.keys(globalThis.PWM).sort();

  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      get() {
        throw new Error("streaming plan must not access document");
      }
    });
    Object.defineProperty(globalThis, "browser", {
      configurable: true,
      get() {
        throw new Error("streaming plan must not access browser");
      }
    });
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      get() {
        throw new Error("streaming plan must not access chrome");
      }
    });

    const plan = globalThis.PWM.FileAttachPipeline.classifyStreamingAttachPlan({
      context: "drop",
      isGeminiDrop: true,
      streamResultAction: "redacted",
      hasSanitizedFile: true
    });
    const serialized = JSON.stringify(plan);

    assert.deepStrictEqual(JSON.parse(serialized), plan);
    assert.strictEqual(serialized.includes("function"), false);
    assert.deepStrictEqual(Object.keys(globalThis.PWM).sort(), originalPwmKeys);
  } finally {
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      delete globalThis.document;
    }
    if (originalBrowser) {
      Object.defineProperty(globalThis, "browser", originalBrowser);
    } else {
      delete globalThis.browser;
    }
    if (originalChrome) {
      Object.defineProperty(globalThis, "chrome", originalChrome);
    } else {
      delete globalThis.chrome;
    }
  }
}

testFileAttachPipelineStreamingPlanGeminiPending();
testFileAttachPipelineStreamingPlanGrokPending();
testFileAttachPipelineStreamingPlanGenericAttachStrategies();
testFileAttachPipelineStreamingPlanBlockedAndFailedLabelsRemainStable();
testFileAttachPipelineStreamingPlanReturnsPlainDataOnly();

console.log("PASS file drop streaming guard regressions");
