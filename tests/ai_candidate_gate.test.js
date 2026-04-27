const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/aiCandidateGate.js"));

const { extractAiCandidates, overlapsAnyRange } = globalThis.PWM.AiCandidateGate;

function testDeterministicRangesAreExcluded() {
  const text = "API_KEY=KnownSecret1234567890 leftover=UnknownSecret9876543210";
  const findings = [{ start: 8, end: 29 }];
  const candidates = extractAiCandidates(text, { findings });

  assert.ok(!candidates.some((candidate) => candidate.value === "KnownSecret1234567890"));
  assert.ok(candidates.some((candidate) => candidate.value === "UnknownSecret9876543210"));
}

function testSafeConfigValuesAreIgnored() {
  const text = [
    "version=1.2.3",
    "api_version=v1.2.3",
    "region=eu-central-1",
    "debug=false",
    "environment=production",
    "token_limit=4096",
    "secret_santa=true",
    "password_hint=ask-admin",
    "jira_key=LG-123",
    "ticket_id=INC-9",
    "commit_sha=abcdef1234567890abcdef1234567890abcdef12",
    "build_id=build-2026-04-27",
    "image_tag=app:2026.04"
  ].join("\n");

  assert.deepStrictEqual(extractAiCandidates(text), []);
}

function testSuspiciousAssignmentsAndUrlCredentials() {
  const text = [
    "unknown_value=MaybeSecretValue12345",
    "token: abcdefghijk12345",
    '{"custom":"JsonSecretValue12345"}',
    "https://user:UrlSecretPass123@example.com/path"
  ].join("\n");
  const candidates = extractAiCandidates(text);

  assert.ok(candidates.some((candidate) => candidate.kind === "assignment" && candidate.value === "MaybeSecretValue12345"));
  assert.ok(candidates.some((candidate) => candidate.kind === "colon" && candidate.value === "abcdefghijk12345"));
  assert.ok(candidates.some((candidate) => candidate.kind === "json" && candidate.value === "JsonSecretValue12345"));
  assert.ok(candidates.some((candidate) => candidate.kind === "urlCredential" && candidate.value === "UrlSecretPass123"));
}

function testPlaceholdersAreIgnored() {
  const candidates = extractAiCandidates("next=[PWM_1]\nother=[PWM_22]");
  assert.deepStrictEqual(candidates, []);
}

function testPolicyThresholds() {
  const text = "note=abc123def456";
  const consumer = extractAiCandidates(text, { policyMode: "consumer" });
  const enterprise = extractAiCandidates(text, { policyMode: "enterprise" });
  const strict = extractAiCandidates(text, { policyMode: "strict" });

  assert.strictEqual(consumer.length, 0, "consumer should exclude score 40-59 candidates");
  assert.ok(enterprise.some((candidate) => candidate.score >= 40 && candidate.score < 60));
  assert.ok(strict.some((candidate) => candidate.score >= 40 && candidate.score < 60));
}

function testRangeShapes() {
  assert.strictEqual(overlapsAnyRange({ start: 4, end: 8 }, [{ start: 7, end: 10 }]), true);
  assert.strictEqual(
    overlapsAnyRange({ start: 4, end: 8 }, [{ range: { start: 8, end: 10 } }]),
    false
  );
}

testDeterministicRangesAreExcluded();
testSafeConfigValuesAreIgnored();
testSuspiciousAssignmentsAndUrlCredentials();
testPlaceholdersAreIgnored();
testPolicyThresholds();
testRangeShapes();

console.log("PASS AI candidate gate regressions");
