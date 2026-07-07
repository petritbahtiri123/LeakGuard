const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer/sendButtonClickOrchestration.js"));

function createHarness(overrides = {}) {
  const calls = {
    blocks: [],
    bypassUntil: [],
    consumed: 0,
    debug: [],
    imageBypassConsumes: [],
    notes: 0,
    submitEvents: []
  };
  const button = { closest: () => null };
  const input = {
    text: overrides.text ?? "LGQA_WHATSAPP_SAFE_TEXT hello team",
    closest: () => null
  };
  let bypassUntil = 0;
  let now = 1000;

  const orchestration =
    globalThis.PWM.SendButtonClickOrchestration.createSendButtonClickOrchestration({
      analysisNeedsEventOwnership: (analysis) => Boolean((analysis.findings || []).length || analysis.placeholderNormalized),
      analyzeText: (text) => ({
        findings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
        placeholderNormalized: false
      }),
      blockWhatsAppTextSend: async (reason) => calls.blocks.push(reason),
      consumeBypassNextSendButtonClick: () => false,
      consumeInterceptionEvent: (event) => {
        calls.consumed += 1;
        event.defaultPrevented = true;
      },
      consumeRecentWhatsAppSanitizedImageHandoff: (target) => calls.imageBypassConsumes.push(target),
      createSyntheticSubmitInterceptionEvent: (target, options) => ({
        target,
        leakGuardSendButton: options.sendButton,
        leakGuardReplayViaClick: options.replayViaClick
      }),
      debugReveal: (eventName, details) => calls.debug.push({ eventName, details }),
      findComposer: () => input,
      findSendButtonClickTarget: () => button,
      getInputText: (target) => target?.text,
      getWhatsAppBypassSanitizedImageSubmitUntil: () => bypassUntil,
      isExtensionRuntimeAvailable: () => true,
      isModalOpen: () => false,
      isWhatsAppHost: () => true,
      maybeHandleSubmit: async (event) => calls.submitEvents.push(event),
      normalizeTarget: (target) => target,
      noteActiveRiskEditor: () => {
        calls.notes += 1;
      },
      now: () => now,
      setWhatsAppBypassSanitizedImageSubmitUntil: (value) => {
        bypassUntil = value;
        calls.bypassUntil.push(value);
      },
      shouldBypassWhatsAppSanitizedImageSend: () => false,
      shouldOwnWhatsAppTextSend: (text) => String(text || "").startsWith("LGQA_WHATSAPP_SAFE_TEXT"),
      summarizeDebugText: (text) => ({ length: String(text || "").length }),
      ...overrides
    });

  return {
    button,
    calls,
    input,
    orchestration,
    setNow: (value) => {
      now = value;
    }
  };
}

async function testModalBackdropClickPassesThroughWithoutConsume() {
  const backdrop = { closest: (selector) => (selector === ".pwm-modal-backdrop" ? true : null) };
  const { calls, orchestration } = createHarness({
    isModalOpen: () => true,
    normalizeTarget: () => backdrop
  });

  await orchestration.maybeHandleSendButtonClick({ target: backdrop });

  assert.strictEqual(calls.consumed, 0);
  assert.deepStrictEqual(calls.submitEvents, []);
}

async function testWhatsAppMissingComposerBlocksRawClick() {
  const { button, calls, orchestration } = createHarness({
    findComposer: () => null
  });
  const event = { target: button };

  await orchestration.maybeHandleSendButtonClick(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.deepStrictEqual(calls.blocks, ["composer_not_found"]);
}

async function testSafeWhatsAppTextRoutesThroughVerifiedSubmit() {
  const { button, calls, input, orchestration } = createHarness();
  const event = { target: button };

  await orchestration.maybeHandleSendButtonClick(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.consumed, 1);
  assert.strictEqual(calls.submitEvents.length, 1);
  assert.strictEqual(calls.submitEvents[0].target, input);
  assert.strictEqual(calls.submitEvents[0].leakGuardSendButton, button);
  assert.strictEqual(calls.submitEvents[0].leakGuardReplayViaClick, true);
}

async function testSanitizedImageClickBypassDoesNotConsumeClick() {
  const { button, calls, input, orchestration } = createHarness({
    shouldBypassWhatsAppSanitizedImageSend: () => true,
    text: "image caption"
  });
  const event = { target: button };

  await orchestration.maybeHandleSendButtonClick(event);

  assert.strictEqual(event.defaultPrevented, undefined);
  assert.strictEqual(calls.consumed, 0);
  assert.deepStrictEqual(calls.imageBypassConsumes, [input]);
  assert.deepStrictEqual(calls.bypassUntil, [2000]);
  assert.strictEqual(calls.debug[0].eventName, "whatsapp:image-send-click-verification-bypassed");
  assert.deepStrictEqual(calls.submitEvents, []);
}

(async () => {
  await testModalBackdropClickPassesThroughWithoutConsume();
  await testWhatsAppMissingComposerBlocksRawClick();
  await testSafeWhatsAppTextRoutesThroughVerifiedSubmit();
  await testSanitizedImageClickBypassDoesNotConsumeClick();
  console.log("PASS send button click orchestration");
})();
