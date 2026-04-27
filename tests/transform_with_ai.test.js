const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/shared/aiCandidateGate.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPromptWithAi.js"));

const {
  Detector,
  PlaceholderManager,
  transformOutboundPrompt,
  transformOutboundPromptWithAi
} = globalThis.PWM;

function classifierReturning(result, calls) {
  return {
    classify: async (text) => {
      calls.push(text);
      return result;
    }
  };
}

async function testDeterministicFindingsAreNotSentAgain() {
  const text = "API_KEY=sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf leftover=UnknownSecretValue123";
  const deterministic = new Detector().scan(text);
  const calls = [];

  await transformOutboundPromptWithAi(text, {
    manager: new PlaceholderManager(),
    findings: deterministic,
    classifier: classifierReturning({ risk: "SECRET", confidence: 0.95 }, calls)
  });

  assert.ok(calls.length > 0, "leftover candidate should be classified");
  assert.ok(!calls.some((call) => call.includes("sk_live_7Qm2")), "deterministic secret should not be classified again");
}

async function testAiSecretRedactsUnknownAssignment() {
  const text = "intro safe line\nleftover=UnknownSecretValue123\noutro safe line";
  const calls = [];
  const result = await transformOutboundPromptWithAi(text, {
    manager: new PlaceholderManager(),
    classifier: classifierReturning({ risk: "SECRET", confidence: 0.91 }, calls)
  });

  assert.strictEqual(result.redactedText.includes("UnknownSecretValue123"), false);
  assert.ok(/leftover=\[PWM_\d+\]/.test(result.redactedText));
  assert.ok(calls[0].includes("UnknownSecretValue123"));
  assert.notStrictEqual(calls[0], text, "classifier should receive candidate context, not the full prompt");
}

async function testNotSecretKeepsOnlyDeterministicRedaction() {
  const text = "API_KEY=sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf leftover=UnknownSecretValue123";
  const result = await transformOutboundPromptWithAi(text, {
    manager: new PlaceholderManager(),
    classifier: classifierReturning({ risk: "NOT_SECRET", confidence: 0.99 }, [])
  });

  assert.strictEqual(result.redactedText.includes("sk_live_7Qm2"), false);
  assert.strictEqual(result.redactedText.includes("UnknownSecretValue123"), true);
}

async function testUnsurePolicyBehavior() {
  const text = "leftover=UnknownSecretValue123";
  const enterprise = await transformOutboundPromptWithAi(text, {
    manager: new PlaceholderManager(),
    policyMode: "enterprise",
    classifier: classifierReturning({ risk: "UNSURE", confidence: 0.2 }, [])
  });
  const consumer = await transformOutboundPromptWithAi(text, {
    manager: new PlaceholderManager(),
    policyMode: "consumer",
    classifier: classifierReturning({ risk: "UNSURE", confidence: 0.99 }, [])
  });

  assert.strictEqual(enterprise.redactedText.includes("UnknownSecretValue123"), false);
  assert.strictEqual(consumer.redactedText.includes("UnknownSecretValue123"), true);
}

function testSyncTransformerUnchanged() {
  const result = transformOutboundPrompt("safe text", {
    manager: new PlaceholderManager(),
    findings: []
  });

  assert.strictEqual(typeof transformOutboundPromptWithAi({}).then, "function");
  assert.ok(!result || typeof result.then === "undefined", "transformOutboundPrompt should remain synchronous");
}

(async () => {
  await testDeterministicFindingsAreNotSentAgain();
  await testAiSecretRedactsUnknownAssignment();
  await testNotSecretKeepsOnlyDeterministicRedaction();
  await testUnsurePolicyBehavior();
  testSyncTransformerUnchanged();
  console.log("PASS AI-assisted transform regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
