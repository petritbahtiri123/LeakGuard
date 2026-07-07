const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer/typedSecretScanOrchestration.js"));

function createHarness(overrides = {}) {
  const calls = {
    aiAnalyses: [],
    badges: [],
    clears: [],
    hideBadgeSoon: 0,
    lastTypedPromptText: [],
    normalized: [],
    policies: [],
    prompts: [],
    redactions: [],
    refreshes: 0,
    rewriteFailures: [],
    rewrites: []
  };
  const input = { value: overrides.text ?? "secret=value" };
  let scanGeneration = 0;
  let lastTypedPromptText = overrides.initialLastTypedPromptText || "";

  const riskyAnalysis = (text) => ({
    normalizedText: text,
    secretFindings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
    findings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
    placeholderNormalized: false
  });

  const options = {
    analyzeTextWithAiAssist: async (text) => {
      calls.aiAnalyses.push(text);
      return riskyAnalysis(text);
    },
    applyComposerText: async (target, text, rewriteOptions = {}) => {
      calls.rewrites.push({ target, text, rewriteOptions });
      target.value = text;
      return { ok: true, actual: text };
    },
    applyNormalizedComposerRewrite: async (target, text, context) => {
      calls.normalized.push({ target, text, context });
      target.value = text.replace("PWM＿1", "PWM_1");
      return { ok: true, text: target.value };
    },
    beginTypedScan: () => {
      scanGeneration += 1;
      return scanGeneration;
    },
    clearEditorRiskState: (target) => calls.clears.push(target),
    collectFailureDetails: (_target, expected, actual, context) => ({ expected, actual, context }),
    findComposer: () => input,
    getActivePolicy: () => ({ liveTypedRedaction: true }),
    getInputText: (target) => target.value,
    getLastTypedPromptText: () => lastTypedPromptText,
    getPolicyForAction: async () => {
      calls.policies.push("get");
      return { liveTypedRedaction: true };
    },
    handleDestinationPolicy: async (findings, policy) => {
      calls.policies.push({ findings, policy });
      return { blocked: false, reason: "destination_policy" };
    },
    handleHttpSecretPolicy: async () => false,
    hideBadgeSoon: () => {
      calls.hideBadgeSoon += 1;
    },
    isCurrentTypedScan: (generation) => generation === scanGeneration,
    isExtensionRuntimeAvailable: () => true,
    isLiveTypedRedactionEnabled: (policy) => policy.liveTypedRedaction !== false,
    isModalOpen: () => false,
    isProtectionPauseActiveAfterPolicy: () => false,
    noteActiveRiskEditor: () => {},
    placeholderTokenRegex: /\[PWM_\d+\]/g,
    promptForSensitiveContentDecision: async (...args) => {
      calls.prompts.push(args);
      return "redact";
    },
    refreshBadgeFromCurrentInput: () => {
      calls.refreshes += 1;
    },
    requestRedaction: async (text, findings, requestOptions) => {
      calls.redactions.push({ text, findings, requestOptions });
      return { redactedText: "secret=[PWM_1]" };
    },
    setBadge: (message) => calls.badges.push(message),
    setLastTypedPromptText: (text) => {
      lastTypedPromptText = text;
      calls.lastTypedPromptText.push(text);
    },
    shouldAutoRedactTypedSecrets: () => false,
    shouldForceDestinationRedaction: () => false,
    showRewriteFailure: async (...args) => {
      calls.rewriteFailures.push(args);
    }
  };

  const orchestration =
    globalThis.PWM.TypedSecretScanOrchestration.createTypedSecretScanOrchestration({
      ...options,
      ...overrides
    });

  return {
    calls,
    input,
    orchestration,
    bumpScanGeneration: () => {
      scanGeneration += 1;
    },
    getLastTypedPromptText: () => lastTypedPromptText
  };
}

async function testEmptyComposerClearsLastPromptAndRiskState() {
  const { calls, input, orchestration, getLastTypedPromptText } = createHarness({
    initialLastTypedPromptText: "previous",
    text: "   "
  });

  await orchestration.maybeHandleTypedSecrets();

  assert.strictEqual(getLastTypedPromptText(), "");
  assert.deepStrictEqual(calls.lastTypedPromptText, [""]);
  assert.deepStrictEqual(calls.clears, [input]);
  assert.deepStrictEqual(calls.aiAnalyses, []);
}

async function testStaleScanGenerationAbandonsAfterAnalysis() {
  const harness = createHarness({
    analyzeTextWithAiAssist: async (text) => {
      harness.calls.aiAnalyses.push(text);
      harness.bumpScanGeneration();
      return {
        normalizedText: text,
        secretFindings: [{ raw: "secret" }],
        findings: [{ raw: "secret" }],
        placeholderNormalized: false
      };
    }
  });

  await harness.orchestration.maybeHandleTypedSecrets();

  assert.deepStrictEqual(harness.calls.policies, []);
  assert.deepStrictEqual(harness.calls.redactions, []);
  assert.deepStrictEqual(harness.calls.rewrites, []);
  assert.strictEqual(harness.getLastTypedPromptText(), "");
}

async function testPlaceholderNormalizationRewritesWithoutPrompt() {
  const { calls, input, orchestration, getLastTypedPromptText } = createHarness({
    analyzeTextWithAiAssist: async (text) => {
      calls.aiAnalyses.push(text);
      return {
        normalizedText: "hello [PWM_1]",
        secretFindings: [],
        findings: [],
        placeholderNormalized: true
      };
    },
    text: "hello [PWM＿1]"
  });

  await orchestration.maybeHandleTypedSecrets();

  assert.deepStrictEqual(calls.normalized, [{ target: input, text: "hello [PWM＿1]", context: "input" }]);
  assert.strictEqual(getLastTypedPromptText(), "hello [PWM_1]");
  assert.deepStrictEqual(calls.prompts, []);
  assert.deepStrictEqual(calls.redactions, []);
}

async function testDestinationForceRedactionAuditsReasonAndSkipsPrompt() {
  const { calls, orchestration } = createHarness({
    shouldForceDestinationRedaction: () => true
  });

  await orchestration.maybeHandleTypedSecrets();

  assert.deepStrictEqual(calls.prompts, []);
  assert.deepStrictEqual(calls.redactions, [
    {
      text: "secret=value",
      findings: [{ raw: "secret" }],
      requestOptions: { auditReason: "destination_policy" }
    }
  ]);
  assert.deepStrictEqual(calls.badges, ["Destination policy required redaction"]);
  assert.deepStrictEqual(calls.rewrites.map((entry) => entry.text), ["secret=[PWM_1]"]);
}

async function testLatestTextGuardStopsDestinationForceRewrite() {
  const harness = createHarness({
    handleDestinationPolicy: async () => {
      harness.input.value = "secret=value plus typing";
      return { blocked: false, reason: "destination_policy" };
    },
    shouldForceDestinationRedaction: () => true
  });

  await harness.orchestration.maybeHandleTypedSecrets();

  assert.deepStrictEqual(harness.calls.redactions, []);
  assert.deepStrictEqual(harness.calls.rewrites, []);
  assert.strictEqual(harness.calls.refreshes, 1);
}

(async () => {
  await testEmptyComposerClearsLastPromptAndRiskState();
  await testStaleScanGenerationAbandonsAfterAnalysis();
  await testPlaceholderNormalizationRewritesWithoutPrompt();
  await testDestinationForceRedactionAuditsReasonAndSkipsPrompt();
  await testLatestTextGuardStopsDestinationForceRewrite();
  console.log("PASS typed secret scan orchestration");
})();
