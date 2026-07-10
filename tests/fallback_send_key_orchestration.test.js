const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer/fallbackSendKeyOrchestration.js"));

function createEnterEvent(input, overrides = {}) {
  return {
    target: input,
    key: "Enter",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    defaultPrevented: false,
    ...overrides
  };
}

function createHarness(overrides = {}) {
  const calls = {
    aiAnalyses: [],
    badges: [],
    blocks: [],
    clears: [],
    consumed: 0,
    findComposer: 0,
    hideBadgeSoon: 0,
    normalized: [],
    pending: [],
    policies: [],
    prompts: [],
    queued: [],
    redactions: [],
    refreshBadge: 0,
    replays: [],
    rewrites: [],
    whatsappPending: []
  };
  const input = { text: "secret=value" };
  const button = { tagName: "BUTTON" };
  const orchestration =
    globalThis.PWM.FallbackSendKeyOrchestration.createFallbackSendKeyOrchestration({
      analysisHasOnlySanitizedPlaceholderFindings: () => false,
      analysisNeedsEventOwnership: (analysis) => Boolean((analysis.findings || []).length || analysis.placeholderNormalized),
      analyzeText: (text) => ({
        normalizedText: text,
        secretFindings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
        findings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
        placeholderNormalized: false
      }),
      analyzeTextWithAiAssist: async (text) => {
        calls.aiAnalyses.push(text);
        return {
          normalizedText: text,
          secretFindings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
          findings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
          placeholderNormalized: false
        };
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
      clearFallbackSendKeyRedactionPending: (target) => calls.clears.push(target || null),
      clearWhatsAppTextSendPending: (target) => calls.whatsappPending.push({ action: "clear", target }),
      consumeInterceptionEvent: (event) => {
        calls.consumed += 1;
        event.defaultPrevented = true;
      },
      createWhatsAppVerifiedSendOptions: (_target, owns) => ({ owns }),
      findComposer: (target) => {
        calls.findComposer += 1;
        return target || input;
      },
      findSendButton: () => button,
      getActivePolicy: () => ({ mode: "active" }),
      getDestinationPolicyDecision: () => ({ blocked: false, reason: "" }),
      getInputText: (target) => target?.text,
      getPolicyForAction: async () => {
        calls.policies.push("get");
        return { mode: "policy" };
      },
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
      markFallbackSendKeyRedactionPending: (target) => calls.pending.push(target),
      markWhatsAppTextSendPending: (target) => {
        calls.whatsappPending.push({ action: "mark", target });
        return true;
      },
      noteActiveRiskEditor: () => {},
      promptForSensitiveContentDecision: async (...args) => {
        calls.prompts.push(args);
        return "redact";
      },
      queueVerifiedComposerSend: (target, expectedText, context, replay, options) => {
        calls.queued.push({ target, expectedText, context, options });
        replay();
      },
      refreshBadgeFromCurrentInput: () => {
        calls.refreshBadge += 1;
      },
      replayVerifiedSend: (target, form, sendButton) => calls.replays.push({ target, form, sendButton }),
      requestRedaction: async (text, findings, options) => {
        calls.redactions.push({ text, findings, options });
        return { redactedText: "secret=[PWM_1]" };
      },
      setBadge: (message) => calls.badges.push(message),
      shouldForceDestinationRedaction: () => false,
      shouldOwnWhatsAppTextSend: () => false,
      ...overrides
    });

  return { orchestration, calls, input, button };
}

async function testShiftEnterIsIgnoredBeforeComposerLookup() {
  const { orchestration, calls, input } = createHarness();

  await orchestration.maybeHandleFallbackSendKey(createEnterEvent(input, { shiftKey: true }));

  assert.strictEqual(calls.consumed, 0);
  assert.strictEqual(calls.findComposer, 0);
  assert.deepStrictEqual(calls.queued, []);
}

async function testWhatsAppTextExtractionFailureBlocksRawEnter() {
  const { orchestration, calls, input } = createHarness({
    getInputText: () => null,
    isWhatsAppHost: () => true
  });
  const event = createEnterEvent(input);

  await orchestration.maybeHandleFallbackSendKey(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.deepStrictEqual(calls.blocks, ["text_extraction_failed"]);
  assert.deepStrictEqual(calls.queued, []);
}

async function testRiskyTextIsConsumedBeforeAsyncAnalysis() {
  let consumedBeforeAi = false;
  const { orchestration, calls, input } = createHarness({
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
  const event = createEnterEvent(input);

  await orchestration.maybeHandleFallbackSendKey(event);

  assert.strictEqual(consumedBeforeAi, true);
  assert.strictEqual(event.defaultPrevented, true);
  assert.deepStrictEqual(calls.pending, [input]);
  assert.strictEqual(calls.prompts.length, 1);
  assert.strictEqual(calls.rewrites.length, 1);
  assert.deepStrictEqual(calls.queued.map((entry) => entry.expectedText), ["secret=[PWM_1]"]);
  assert.deepStrictEqual(calls.replays, [{ target: input, form: null, sendButton: { tagName: "BUTTON" } }]);
}

async function testDestinationForceRedactionSkipsPromptAndAuditsReason() {
  const { orchestration, calls, input } = createHarness({
    shouldForceDestinationRedaction: () => true
  });

  await orchestration.maybeHandleFallbackSendKey(createEnterEvent(input));

  assert.strictEqual(calls.prompts.length, 0);
  assert.deepStrictEqual(calls.redactions, [
    {
      text: "secret=value",
      findings: [{ raw: "secret" }],
      options: { auditReason: "destination_policy" }
    }
  ]);
  assert.deepStrictEqual(calls.badges, ["Destination policy required redaction"]);
  assert.deepStrictEqual(calls.queued.map((entry) => entry.expectedText), ["secret=[PWM_1]"]);
}

async function testVerifiedEnterUsesFormFallbackWhenButtonIsMissing() {
  const { orchestration, calls, input } = createHarness({
    findSendButton: () => null
  });

  await orchestration.maybeHandleFallbackSendKey(createEnterEvent(input));

  assert.deepStrictEqual(calls.replays, [{ target: input, form: null, sendButton: null }]);
  assert.deepStrictEqual(calls.blocks, []);
}

async function testWhatsAppMissingReplayButtonStillBlocks() {
  const { orchestration, calls, input } = createHarness({
    findSendButton: () => null,
    isWhatsAppHost: () => true,
    shouldOwnWhatsAppTextSend: () => true
  });

  await orchestration.maybeHandleFallbackSendKey(createEnterEvent(input));

  assert.deepStrictEqual(calls.replays, []);
  assert.deepStrictEqual(calls.blocks, ["replay_button_not_found"]);
}

(async () => {
  await testShiftEnterIsIgnoredBeforeComposerLookup();
  await testWhatsAppTextExtractionFailureBlocksRawEnter();
  await testRiskyTextIsConsumedBeforeAsyncAnalysis();
  await testDestinationForceRedactionSkipsPromptAndAuditsReason();
  await testVerifiedEnterUsesFormFallbackWhenButtonIsMissing();
  await testWhatsAppMissingReplayButtonStillBlocks();
  console.log("PASS fallback send key orchestration");
})();
