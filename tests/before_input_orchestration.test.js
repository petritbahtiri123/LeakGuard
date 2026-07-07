const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer/beforeInputOrchestration.js"));

function createBeforeInputEvent(input, overrides = {}) {
  return {
    target: input,
    inputType: "insertText",
    data: "secret",
    defaultPrevented: false,
    ...overrides
  };
}

function createHarness(overrides = {}) {
  const calls = {
    aiAnalyses: [],
    badges: [],
    consumed: 0,
    hideBadgeSoon: 0,
    lastTypedPromptText: [],
    pasteEvents: [],
    policies: [],
    prompts: [],
    redactions: [],
    refreshes: 0,
    rewrites: []
  };
  const input = {
    value: overrides.originalText ?? "API_KEY=",
    selectionStart: overrides.selectionStart ?? 8,
    selectionEnd: overrides.selectionEnd ?? 8
  };

  const analyze = (text) => {
    const hasSecret = String(text || "").includes("secret");
    return {
      normalizedText: text,
      secretFindings: hasSecret ? [{ raw: "secret", start: String(text).indexOf("secret"), end: String(text).indexOf("secret") + 6 }] : [],
      findings: hasSecret ? [{ raw: "secret", start: String(text).indexOf("secret"), end: String(text).indexOf("secret") + 6 }] : [],
      placeholderNormalized: false
    };
  };

  const orchestration =
    globalThis.PWM.BeforeInputOrchestration.createBeforeInputOrchestration({
      analyzeText: analyze,
      analyzeTextWithAiAssist: async (text) => {
        calls.aiAnalyses.push(text);
        return analyze(text);
      },
      applyTypedInterceptionRewrite: async (target, redactedText, originalText, selection, context) => {
        calls.rewrites.push({ target, redactedText, originalText, selection, context });
        target.value = redactedText;
        return true;
      },
      consumeInterceptionEvent: (event) => {
        calls.consumed += 1;
        event.defaultPrevented = true;
      },
      findComposer: () => input,
      getActivePolicy: () => ({ liveTypedRedaction: true }),
      getBeforeInputData: (event) => event.data,
      getInputText: (target) => target.value,
      getPolicyForAction: async () => {
        calls.policies.push("get");
        return { liveTypedRedaction: true };
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
      isFirefoxRuntime: () => false,
      isLiveTypedRedactionEnabled: (policy) => policy.liveTypedRedaction !== false,
      isModalOpen: () => false,
      isPasteBeforeInput: (event) => event.inputType === "insertFromPaste",
      isProgrammaticInputScanSuppressed: () => false,
      isProtectionPauseActiveAfterPolicy: () => false,
      maybeHandlePaste: async (event) => calls.pasteEvents.push(event),
      normalizeVisiblePlaceholders: (text) => text,
      noteActiveRiskEditor: () => {},
      promptForSensitiveContentDecision: async (...args) => {
        calls.prompts.push(args);
        return "redact";
      },
      refreshBadgeFromCurrentInput: () => {
        calls.refreshes += 1;
      },
      requestRedaction: async (text, findings, requestOptions) => {
        calls.redactions.push({ text, findings, requestOptions });
        return { redactedText: text.replace("secret", "[PWM_1]") };
      },
      selectFindingsOverlappingInsertion: (findings) => findings,
      setBadge: (message) => calls.badges.push(message),
      setLastTypedPromptText: (text) => calls.lastTypedPromptText.push(text),
      shouldAutoRedactTypedSecrets: () => false,
      shouldForceDestinationRedaction: () => false,
      shouldInterceptBeforeInput: () => true,
      spliceSelectionText: (originalText, selection, insertedText) => ({
        text: `${originalText.slice(0, selection.start)}${insertedText}${originalText.slice(selection.end)}`,
        caretOffset: selection.start + insertedText.length
      }),
      ...overrides
    });

  return { calls, input, orchestration };
}

async function testPasteBeforeInputDelegatesToPasteHandler() {
  const { calls, input, orchestration } = createHarness();
  const event = createBeforeInputEvent(input, { inputType: "insertFromPaste" });

  await orchestration.maybeHandleBeforeInput(event);

  assert.deepStrictEqual(calls.pasteEvents, [event]);
  assert.strictEqual(calls.consumed, 0);
  assert.deepStrictEqual(calls.aiAnalyses, []);
}

async function testProgrammaticSuppressedInputReturnsBeforeComposerLookup() {
  let findComposerCalls = 0;
  const { calls, input, orchestration } = createHarness({
    findComposer: () => {
      findComposerCalls += 1;
      return input;
    },
    isProgrammaticInputScanSuppressed: () => true
  });

  await orchestration.maybeHandleBeforeInput(createBeforeInputEvent(input, { isTrusted: false }));

  assert.strictEqual(findComposerCalls, 0);
  assert.strictEqual(calls.consumed, 0);
}

async function testHarmlessTypingStaysUnowned() {
  const { calls, input, orchestration } = createHarness({
    originalText: "hello ",
    selectionStart: 6,
    selectionEnd: 6
  });

  await orchestration.maybeHandleBeforeInput(createBeforeInputEvent(input, { data: "team" }));

  assert.strictEqual(calls.consumed, 0);
  assert.deepStrictEqual(calls.aiAnalyses, []);
  assert.deepStrictEqual(calls.rewrites, []);
}

async function testRiskyTypingIsConsumedBeforeAsyncAnalysis() {
  let consumedBeforeAi = false;
  const { calls, input, orchestration } = createHarness({
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
  const event = createBeforeInputEvent(input);

  await orchestration.maybeHandleBeforeInput(event);

  assert.strictEqual(consumedBeforeAi, true);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.prompts.length, 1);
  assert.deepStrictEqual(calls.rewrites.map((entry) => entry.redactedText), ["API_KEY=[PWM_1]"]);
}

async function testDestinationForceRedactionAuditsReason() {
  const { calls, input, orchestration } = createHarness({
    shouldForceDestinationRedaction: () => true
  });

  await orchestration.maybeHandleBeforeInput(createBeforeInputEvent(input));

  assert.deepStrictEqual(calls.prompts, []);
  assert.deepStrictEqual(calls.redactions.map((entry) => entry.requestOptions), [{ auditReason: "destination_policy" }]);
  assert.deepStrictEqual(calls.badges, ["Destination policy required redaction"]);
  assert.deepStrictEqual(calls.rewrites.map((entry) => entry.redactedText), ["API_KEY=[PWM_1]"]);
}

(async () => {
  await testPasteBeforeInputDelegatesToPasteHandler();
  await testProgrammaticSuppressedInputReturnsBeforeComposerLookup();
  await testHarmlessTypingStaysUnowned();
  await testRiskyTypingIsConsumedBeforeAsyncAnalysis();
  await testDestinationForceRedactionAuditsReason();
  console.log("PASS beforeinput orchestration");
})();
