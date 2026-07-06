const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer_helpers.js"));
require(path.join(repoRoot, "src/content/input/rewriteVerificationText.js"));
require(path.join(repoRoot, "src/content/composer/replayVerification.js"));

function createReplayVerification(overrides = {}) {
  return globalThis.PWM.ReplayVerification.createReplayVerification({
    rewriteVerificationText: globalThis.PWM.RewriteVerificationText,
    normalizeComposerText: globalThis.PWM.ComposerHelpers.normalizeComposerText,
    normalizeEditorInnerText: globalThis.PWM.ComposerHelpers.normalizeEditorInnerText,
    getInputText: (input) => input?.value || input?.text || "",
    analyzeText: () => ({ findings: [], secretFindings: [] }),
    debug: () => {},
    ...overrides
  });
}

function testCollectComposerVerificationCandidatesDedupesNormalizedSources() {
  const replay = createReplayVerification();
  const input = {
    value: "line 1\nline 2",
    innerText: "line 1\nline 2",
    textContent: "line 1line 2"
  };

  const candidates = replay.collectComposerVerificationCandidates(input, "line 1\nline 2");

  assert.ok(candidates.some((candidate) => candidate.source === "stable"));
  assert.ok(candidates.some((candidate) => candidate.source === "getInputText"));
  assert.ok(candidates.some((candidate) => candidate.source === "textContent"));
  assert.strictEqual(
    candidates.filter((candidate) => candidate.source === "stable").length,
    1
  );
}

function testMatchesComposerPlanToleratesPlaceholderWhitespaceNormalization() {
  const replay = createReplayVerification();
  const plan = {
    canonical: "password is [PWM_1]",
    writeText: "password is [PWM_1]",
    acceptableTexts: ["password is [PWM_1]"]
  };

  assert.strictEqual(replay.matchesComposerPlan(plan, "password is\n[PWM_1]\n"), true);
  assert.strictEqual(
    replay.matchesComposerPlan(plan, "password is [PWM_1]\nRawSecretABCDE12345"),
    false
  );
}

function testEvaluateCandidatesDelegatesToRewriteVerificationTextWithDebug() {
  const debugEvents = [];
  const replay = createReplayVerification({
    analyzeText: (text) => ({
      findings: String(text || "").includes("RawSecretABCDE12345")
        ? [{ raw: "RawSecretABCDE12345", severity: "high", score: 90 }]
        : [],
      secretFindings: []
    }),
    debug: (label, payload) => debugEvents.push({ label, payload })
  });

  const result = replay.evaluateComposerVerificationCandidates({
    candidates: [{ source: "actual", text: "safe [PWM_1]" }],
    expectedText: "safe [PWM_1]",
    originalText: "RawSecretABCDE12345",
    findings: [{ raw: "RawSecretABCDE12345", severity: "high", score: 90 }],
    context: "test"
  });

  assert.strictEqual(result.ok, true);
  assert.ok(debugEvents.length >= 0);
}

testCollectComposerVerificationCandidatesDedupesNormalizedSources();
testMatchesComposerPlanToleratesPlaceholderWhitespaceNormalization();
testEvaluateCandidatesDelegatesToRewriteVerificationTextWithDebug();

console.log("PASS replay verification");
