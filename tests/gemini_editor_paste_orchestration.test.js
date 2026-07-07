const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer/geminiEditorPasteOrchestration.js"));

function createPasteEvent(text, editor = { tagName: "DIV" }) {
  return {
    target: { editor },
    clipboardData: {
      getData(type) {
        return type === "text/plain" ? text : "";
      }
    }
  };
}

function createHarness(overrides = {}) {
  const calls = {
    applied: [],
    badges: [],
    blockedPayloads: [],
    clearOptimization: [],
    consumed: 0,
    contentErrors: [],
    destinationPolicies: [],
    hideBadgeSoon: [],
    httpPolicies: [],
    modals: [],
    notedEditors: [],
    optimizationStatus: [],
    prompts: [],
    redactions: [],
    refreshBadge: 0
  };
  const orchestration =
    globalThis.PWM.GeminiEditorPasteOrchestration.createGeminiEditorPasteOrchestration({
      analyzeTextWithAiAssist: async (text) => ({
        normalizedText: text,
        secretFindings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
        findings: String(text || "").includes("secret") ? [{ raw: "secret" }] : []
      }),
      applyGeminiEditorText: async (editor, text, context, options) => {
        calls.applied.push({ editor, text, context, options });
        editor.text = String(text || "");
        return true;
      },
      blockLargeLocalTextPayload: async (event, sizeInfo) => calls.blockedPayloads.push({ event, sizeInfo }),
      classifyLocalTextPayloadSize: () => ({ zone: "optimized", bytes: 1024 }),
      clearLocalPayloadOptimizationStatus: (sizeInfo, cleanup) =>
        calls.clearOptimization.push({ sizeInfo, cleanup }),
      consumeInterceptionEvent: (event) => {
        event.defaultPrevented = true;
        calls.consumed += 1;
      },
      getPolicyForAction: async () => ({ mode: "default" }),
      handleContentError: (error) => calls.contentErrors.push(error),
      handleDestinationPolicy: async (findings, policy) => {
        calls.destinationPolicies.push({ findings, policy });
        return { blocked: false, reason: "destination_policy" };
      },
      handleHttpSecretPolicy: async (policy, findings, onRedact) => {
        calls.httpPolicies.push({ policy, findings, onRedact });
        return false;
      },
      hideBadgeSoon: (delayMs) => calls.hideBadgeSoon.push(delayMs),
      isProtectionPauseActiveAfterPolicy: () => false,
      noteActiveRiskEditor: (editor) => calls.notedEditors.push(editor),
      promptForSensitiveContentDecision: async (findings, context, policy, editor, text) => {
        calls.prompts.push({ findings, context, policy, editor, text });
        return "redact";
      },
      refreshBadgeFromCurrentInput: () => {
        calls.refreshBadge += 1;
      },
      requestRedaction: async (text, findings, options) => {
        calls.redactions.push({ text, findings, options });
        return { redactedText: "alpha [PWM_1] beta" };
      },
      resolveGeminiEditorTarget: (target) => target?.editor || null,
      setBadge: (message) => calls.badges.push(message),
      shouldForceDestinationRedaction: () => false,
      showLocalPayloadOptimizationStatus: (sizeInfo) => calls.optimizationStatus.push(sizeInfo),
      showMessageModal: async (...args) => calls.modals.push(args),
      ...overrides
    });

  return { orchestration, calls };
}

async function testPauseAfterPolicyInsertsNormalizedTextWithoutPrompting() {
  const { orchestration, calls } = createHarness({
    isProtectionPauseActiveAfterPolicy: () => true
  });
  const editor = { tagName: "DIV" };
  const event = createPasteEvent("alpha secret beta", editor);

  const handled = await orchestration.maybeHandleGeminiEditorPaste(event);

  assert.strictEqual(handled, true);
  assert.strictEqual(event.defaultPrevented, true);
  assert.deepStrictEqual(calls.notedEditors, [editor]);
  assert.strictEqual(calls.destinationPolicies.length, 1);
  assert.strictEqual(calls.prompts.length, 0);
  assert.strictEqual(calls.redactions.length, 0);
  assert.deepStrictEqual(calls.badges, ["Protection paused"]);
  assert.strictEqual(calls.applied.length, 1);
  assert.strictEqual(calls.applied[0].text, "alpha secret beta");
  assert.strictEqual(calls.applied[0].context, "gemini-paste");
  assert.deepStrictEqual(calls.applied[0].options, { rawInsertedText: "alpha secret beta" });
  assert.deepStrictEqual(calls.clearOptimization, [
    { sizeInfo: { zone: "optimized", bytes: 1024 }, cleanup: "complete" }
  ]);
}

async function testDestinationForceRedactionSkipsPromptAndAuditsReason() {
  const { orchestration, calls } = createHarness({
    shouldForceDestinationRedaction: () => true
  });
  const editor = { tagName: "DIV" };
  const event = createPasteEvent("alpha secret beta", editor);

  const handled = await orchestration.maybeHandleGeminiEditorPaste(event);

  assert.strictEqual(handled, true);
  assert.strictEqual(calls.prompts.length, 0);
  assert.deepStrictEqual(calls.redactions, [
    {
      text: "alpha secret beta",
      findings: [{ raw: "secret" }],
      options: { auditReason: "destination_policy" }
    }
  ]);
  assert.strictEqual(calls.applied[0].text, "alpha [PWM_1] beta");
}

async function testBlockedPayloadStopsBeforeAnalysis() {
  const blockedSizeInfo = { zone: "blocked", bytes: 8192 };
  const { orchestration, calls } = createHarness({
    analyzeTextWithAiAssist: async () => {
      throw new Error("blocked payload should not be analyzed");
    },
    classifyLocalTextPayloadSize: () => blockedSizeInfo
  });
  const event = createPasteEvent("alpha secret beta");

  const handled = await orchestration.maybeHandleGeminiEditorPaste(event);

  assert.strictEqual(handled, true);
  assert.strictEqual(event.defaultPrevented, true);
  assert.deepStrictEqual(calls.blockedPayloads, [{ event, sizeInfo: blockedSizeInfo }]);
  assert.deepStrictEqual(calls.applied, []);
  assert.deepStrictEqual(calls.redactions, []);
}

async function testInsertionFailureBlocksRawPaste() {
  const { orchestration, calls } = createHarness({
    analyzeTextWithAiAssist: async (text) => ({
      normalizedText: text,
      secretFindings: [],
      findings: []
    }),
    applyGeminiEditorText: async (editor, text, context, options) => {
      calls.applied.push({ editor, text, context, options });
      return false;
    }
  });
  const event = createPasteEvent("safe normalized text");

  const handled = await orchestration.maybeHandleGeminiEditorPaste(event);

  assert.strictEqual(handled, true);
  assert.strictEqual(calls.applied.length, 1);
  assert.deepStrictEqual(calls.clearOptimization, [
    { sizeInfo: { zone: "optimized", bytes: 1024 }, cleanup: "failed" }
  ]);
  assert.deepStrictEqual(calls.badges, ["Raw paste blocked"]);
  assert.deepStrictEqual(calls.modals, [
    ["Raw paste blocked", "LeakGuard blocked raw pasted content because sanitized insertion failed."]
  ]);
  assert.strictEqual(calls.refreshBadge, 1);
}

(async () => {
  await testPauseAfterPolicyInsertsNormalizedTextWithoutPrompting();
  await testDestinationForceRedactionSkipsPromptAndAuditsReason();
  await testBlockedPayloadStopsBeforeAnalysis();
  await testInsertionFailureBlocksRawPaste();
  console.log("PASS Gemini editor paste orchestration");
})();
