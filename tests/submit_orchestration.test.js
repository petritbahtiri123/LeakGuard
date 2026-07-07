const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer/submitOrchestration.js"));

function createSubmitEvent(input, overrides = {}) {
  return {
    target: input,
    type: "submit",
    defaultPrevented: false,
    ...overrides
  };
}

function createHarness(overrides = {}) {
  const calls = {
    aiAnalyses: [],
    badges: [],
    blocks: [],
    bypassUntil: [],
    clearAllRisk: 0,
    clears: [],
    consumed: 0,
    debug: [],
    exactChecks: [],
    hideBadgeSoon: 0,
    imageBypassConsumes: [],
    normalized: [],
    pending: [],
    policies: [],
    prompts: [],
    queued: [],
    redactions: [],
    refreshes: 0,
    replays: [],
    rewriteFailures: [],
    rewrites: []
  };
  const form = {
    querySelector: () => null
  };
  const button = { tagName: "BUTTON" };
  const input = {
    text: overrides.text ?? "secret=value",
    closest: (selector) => (selector === "form" ? form : null),
    querySelector: () => null
  };
  let bypassUntil = 0;
  let now = 1000;

  const analyze = (text) => ({
    normalizedText: text,
    secretFindings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
    findings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
    placeholderNormalized: false
  });

  const orchestration =
    globalThis.PWM.SubmitOrchestration.createSubmitOrchestration({
      analysisHasOnlySanitizedPlaceholderFindings: () => false,
      analysisNeedsEventOwnership: (analysis) => Boolean((analysis.findings || []).length || analysis.placeholderNormalized),
      analyzeText: analyze,
      analyzeTextWithAiAssist: async (text) => {
        calls.aiAnalyses.push(text);
        return analyze(text);
      },
      applyNormalizedComposerRewrite: async (target, text) => {
        calls.normalized.push({ target, text });
        target.text = text;
        return { ok: true, text };
      },
      applySubmitRedactionTransactionally: async (target, originalText, redactedText, context, findings) => {
        calls.rewrites.push({ target, originalText, redactedText, context, findings });
        target.text = redactedText;
        return true;
      },
      blockWhatsAppTextSend: async (reason) => calls.blocks.push(reason),
      clearAllRiskSessionState: () => {
        calls.clearAllRisk += 1;
      },
      clearWhatsAppTextSendPending: (target) => calls.clears.push(target),
      collectFailureDetails: (_target, expected, actual, context) => ({ expected, actual, context }),
      consumeInterceptionEvent: (event) => {
        calls.consumed += 1;
        event.defaultPrevented = true;
      },
      consumeRecentWhatsAppSanitizedImageHandoff: (target) => calls.imageBypassConsumes.push(target),
      createWhatsAppVerifiedSendOptions: (_target, owns) => ({ owns }),
      debugReveal: (eventName, details) => calls.debug.push({ eventName, details }),
      ensureExactComposerState: async (target, expected) => {
        calls.exactChecks.push({ target, expected });
        return target.text === expected;
      },
      findComposer: () => input,
      findSendButton: () => button,
      getActivePolicy: () => ({ mode: "active" }),
      getDestinationPolicyDecision: () => ({ blocked: false, reason: "" }),
      getInputText: (target) => target?.text,
      getPolicyForAction: async () => {
        calls.policies.push("get");
        return { mode: "policy" };
      },
      getWhatsAppBypassSanitizedImageSubmitUntil: () => bypassUntil,
      handleDestinationPolicy: async (findings, policy) => {
        calls.policies.push({ findings, policy });
        return { blocked: false, reason: "destination_policy" };
      },
      handleHttpSecretPolicy: async () => false,
      hideBadgeSoon: () => {
        calls.hideBadgeSoon += 1;
      },
      isExtensionRuntimeAvailable: () => true,
      isModalOpen: () => false,
      isProtectionPauseActiveAfterPolicy: () => false,
      isWhatsAppHost: () => false,
      markWhatsAppTextSendPending: (target) => {
        calls.pending.push(target);
        return true;
      },
      now: () => now,
      promptForSensitiveContentDecision: async (...args) => {
        calls.prompts.push(args);
        return "redact";
      },
      queueVerifiedComposerSend: (target, expectedText, context, replay, options) => {
        calls.queued.push({ target, expectedText, context, options });
        replay();
      },
      refreshBadgeFromCurrentInput: () => {
        calls.refreshes += 1;
      },
      replayVerifiedSend: (target, replayForm, sendButton, replayOptions) => {
        calls.replays.push({ target, replayForm, sendButton, replayOptions });
      },
      requestRedaction: async (text, findings, requestOptions) => {
        calls.redactions.push({ text, findings, requestOptions });
        return { redactedText: "secret=[PWM_1]" };
      },
      setBadge: (message) => calls.badges.push(message),
      setWhatsAppBypassSanitizedImageSubmitUntil: (value) => {
        bypassUntil = value;
        calls.bypassUntil.push(value);
      },
      shouldBypassWhatsAppSanitizedImageSend: () => false,
      shouldForceDestinationRedaction: () => false,
      shouldOwnWhatsAppTextSend: () => false,
      showRewriteFailure: async (...args) => calls.rewriteFailures.push(args),
      summarizeDebugText: (text) => ({ length: String(text || "").length }),
      ...overrides
    });

  return {
    button,
    calls,
    form,
    input,
    orchestration,
    setNow: (value) => {
      now = value;
    }
  };
}

async function testModalOpenConsumesSubmit() {
  const { calls, input, orchestration } = createHarness({
    isModalOpen: () => true
  });
  const event = createSubmitEvent(input);

  await orchestration.maybeHandleSubmit(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.consumed, 1);
  assert.deepStrictEqual(calls.aiAnalyses, []);
}

async function testWhatsAppMissingComposerBlocksRawSubmit() {
  const { calls, input, orchestration } = createHarness({
    findComposer: () => null,
    isWhatsAppHost: () => true
  });
  const event = createSubmitEvent(input);

  await orchestration.maybeHandleSubmit(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.deepStrictEqual(calls.blocks, ["composer_not_found"]);
}

async function testWhatsAppSanitizedImageBypassConsumesRecentHandoff() {
  const { calls, input, orchestration } = createHarness({
    isWhatsAppHost: () => true,
    shouldBypassWhatsAppSanitizedImageSend: () => true,
    text: "image caption"
  });
  const event = createSubmitEvent(input);

  await orchestration.maybeHandleSubmit(event);

  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(calls.consumed, 0);
  assert.deepStrictEqual(calls.imageBypassConsumes, [input]);
  assert.deepStrictEqual(calls.bypassUntil, [2000]);
  assert.deepStrictEqual(calls.aiAnalyses, []);
  assert.strictEqual(calls.debug[0].eventName, "whatsapp:image-send-text-verification-bypassed");
}

async function testRiskyTextIsConsumedBeforeAsyncAnalysisAndQueued() {
  let consumedBeforeAi = false;
  const { button, calls, input, form, orchestration } = createHarness({
    analyzeTextWithAiAssist: async (text) => {
      consumedBeforeAi = calls.consumed === 1;
      calls.aiAnalyses.push(text);
      return {
        normalizedText: text,
        secretFindings: [{ raw: "secret" }],
        findings: [{ raw: "secret" }],
        placeholderNormalized: false
      };
    }
  });
  const event = createSubmitEvent(input);

  await orchestration.maybeHandleSubmit(event);

  assert.strictEqual(consumedBeforeAi, true);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.prompts.length, 1);
  assert.deepStrictEqual(calls.rewrites.map((entry) => entry.redactedText), ["secret=[PWM_1]"]);
  assert.deepStrictEqual(calls.queued.map((entry) => entry.expectedText), ["secret=[PWM_1]"]);
  assert.deepStrictEqual(calls.replays[0], {
    target: input,
    replayForm: form,
    sendButton: button,
    replayOptions: { preferButtonClick: true }
  });
}

async function testDestinationForceRedactionAuditsReasonAndSkipsPrompt() {
  const { calls, orchestration } = createHarness({
    shouldForceDestinationRedaction: () => true
  });

  await orchestration.maybeHandleSubmit(createSubmitEvent({ closest: () => null }));

  assert.deepStrictEqual(calls.prompts, []);
  assert.deepStrictEqual(calls.redactions, [
    {
      text: "secret=value",
      findings: [{ raw: "secret" }],
      requestOptions: { auditReason: "destination_policy" }
    }
  ]);
  assert.deepStrictEqual(calls.badges, ["Destination policy required redaction"]);
  assert.deepStrictEqual(calls.queued.map((entry) => entry.expectedText), ["secret=[PWM_1]"]);
}

(async () => {
  await testModalOpenConsumesSubmit();
  await testWhatsAppMissingComposerBlocksRawSubmit();
  await testWhatsAppSanitizedImageBypassConsumesRecentHandoff();
  await testRiskyTextIsConsumedBeforeAsyncAnalysisAndQueued();
  await testDestinationForceRedactionAuditsReasonAndSkipsPrompt();
  console.log("PASS submit orchestration");
})();
