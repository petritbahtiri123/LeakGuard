const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer/pasteOrchestration.js"));

function createPasteEvent(input, overrides = {}) {
  return {
    target: input,
    defaultPrevented: false,
    clipboardData: null,
    ...overrides
  };
}

function createHarness(overrides = {}) {
  const calls = {
    aiAnalyses: [],
    badges: [],
    blocks: [],
    chatGptLargePaste: [],
    consumed: 0,
    files: [],
    hideBadgeSoon: 0,
    localFiles: [],
    notes: 0,
    pasteDecisions: [],
    policies: [],
    prompts: [],
    redactions: [],
    refreshes: 0,
    remembers: []
  };
  const input = {
    value: overrides.originalText ?? "hello ",
    selectionStart: overrides.selectionStart ?? 6,
    selectionEnd: overrides.selectionEnd ?? 6
  };
  const fileTransfer = { files: [{ name: "raw.exe" }] };

  const analyze = (text) => ({
    normalizedText: text,
    secretFindings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
    findings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
    placeholderNormalized: false
  });

  const orchestration =
    globalThis.PWM.PasteOrchestration.createPasteOrchestration({
      analyzeText: analyze,
      analyzeTextWithAiAssist: async (text) => {
        calls.aiAnalyses.push(text);
        return analyze(text);
      },
      applyPasteDecision: async (target, originalText, selection, insertedText, context, metadata) => {
        calls.pasteDecisions.push({ target, originalText, selection, insertedText, context, metadata });
        target.value = `${originalText.slice(0, selection.start)}${insertedText}${originalText.slice(selection.end)}`;
        return true;
      },
      blockWhatsAppFileAttachment: async (event) => calls.blocks.push(event),
      consumeInterceptionEvent: (event) => {
        calls.consumed += 1;
        event.defaultPrevented = true;
      },
      dataTransferHasFiles: () => false,
      findComposer: () => input,
      getInputText: (target) => target.value,
      getPasteTransfer: () => fileTransfer,
      getPastedPlainText: () => "secret=value",
      getPolicyForAction: async () => {
        calls.policies.push("get");
        return { mode: "policy" };
      },
      getSelectionOffsets: (target) => ({
        start: target.selectionStart,
        end: target.selectionEnd
      }),
      handleDestinationPolicy: async (findings, policy) => {
        calls.policies.push({ findings, policy });
        return { blocked: false, reason: "destination_policy" };
      },
      handleHttpSecretPolicy: async () => false,
      hideBadgeSoon: () => {
        calls.hideBadgeSoon += 1;
      },
      isExtensionRuntimeAvailable: () => true,
      isGeminiHost: () => false,
      isModalOpen: () => false,
      isProtectionPauseActiveAfterPolicy: () => false,
      isSanitizedFileHandoffEvent: () => false,
      isSanitizedTextRewriteEvent: () => false,
      isSupportedWhatsAppClipboardImagePaste: () => false,
      isWhatsAppHost: () => false,
      maybeHandleChatGptLargeTextPaste: async (event, target, pasted, quickAnalysis) => {
        calls.chatGptLargePaste.push({ event, target, pasted, quickAnalysis, consumed: calls.consumed });
        return false;
      },
      maybeHandleGeminiEditorPaste: async () => false,
      maybeHandleLocalFileInsert: async (event, target, transfer, context) => {
        calls.localFiles.push({ event, target, transfer, context });
      },
      normalizeClipboardImageDataTransfer: (transfer) => transfer,
      noteActiveRiskEditor: () => {
        calls.notes += 1;
      },
      promptForSensitiveContentDecision: async (...args) => {
        calls.prompts.push(args);
        return "redact";
      },
      refreshBadgeFromCurrentInput: () => {
        calls.refreshes += 1;
      },
      rememberWhatsAppTextPaste: (...args) => calls.remembers.push(args),
      requestRedaction: async (text, findings, requestOptions) => {
        calls.redactions.push({ text, findings, requestOptions });
        return { redactedText: "secret=[PWM_1]" };
      },
      setBadge: (message) => calls.badges.push(message),
      shouldForceDestinationRedaction: () => false,
      shouldSuppressDuplicateWhatsAppTextPaste: () => false,
      ...overrides
    });

  return { calls, fileTransfer, input, orchestration };
}

async function testSanitizedRewriteEventPassesThrough() {
  const { calls, input, orchestration } = createHarness({
    isSanitizedTextRewriteEvent: () => true
  });

  await orchestration.maybeHandlePaste(createPasteEvent(input));

  assert.strictEqual(calls.consumed, 0);
  assert.deepStrictEqual(calls.aiAnalyses, []);
}

async function testUnsupportedWhatsAppFilePasteBlocksWithoutComposer() {
  const { calls, fileTransfer, input, orchestration } = createHarness({
    dataTransferHasFiles: () => true,
    findComposer: () => null,
    isWhatsAppHost: () => true
  });
  const event = createPasteEvent(input);

  await orchestration.maybeHandlePaste(event);

  assert.deepStrictEqual(calls.blocks, [event]);
  assert.deepStrictEqual(calls.localFiles, []);
  assert.strictEqual(fileTransfer.files.length, 1);
}

async function testDuplicateWhatsAppTextPasteIsConsumedBeforeAnalysis() {
  const { calls, input, orchestration } = createHarness({
    shouldSuppressDuplicateWhatsAppTextPaste: () => true
  });
  const event = createPasteEvent(input);

  await orchestration.maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.consumed, 1);
  assert.deepStrictEqual(calls.aiAnalyses, []);
  assert.deepStrictEqual(calls.pasteDecisions, []);
}

async function testRiskyPasteConsumesBeforeAwaitedLargePasteHandling() {
  const { calls, input, orchestration } = createHarness();
  const event = createPasteEvent(input);

  await orchestration.maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.chatGptLargePaste[0].consumed, 1);
  assert.strictEqual(calls.prompts.length, 1);
  assert.deepStrictEqual(calls.pasteDecisions.map((entry) => entry.insertedText), ["secret=[PWM_1]"]);
}

async function testDestinationForceRedactionAuditsReason() {
  const { calls, input, orchestration } = createHarness({
    shouldForceDestinationRedaction: () => true
  });

  await orchestration.maybeHandlePaste(createPasteEvent(input));

  assert.deepStrictEqual(calls.prompts, []);
  assert.deepStrictEqual(calls.redactions.map((entry) => entry.requestOptions), [{ auditReason: "destination_policy" }]);
  assert.deepStrictEqual(calls.badges, ["Destination policy required redaction"]);
  assert.deepStrictEqual(calls.pasteDecisions.map((entry) => entry.insertedText), ["secret=[PWM_1]"]);
}

(async () => {
  await testSanitizedRewriteEventPassesThrough();
  await testUnsupportedWhatsAppFilePasteBlocksWithoutComposer();
  await testDuplicateWhatsAppTextPasteIsConsumedBeforeAnalysis();
  await testRiskyPasteConsumesBeforeAwaitedLargePasteHandling();
  await testDestinationForceRedactionAuditsReason();
  console.log("PASS paste orchestration");
})();
