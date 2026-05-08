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
    "request_id=req-01HV7M7A2B3C4D5E6F7G8H9J0K",
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

function testMediumConfidenceCandidatesForLocalAssist() {
  const text = [
    "note=abc123def456",
    "custom_header: MediumRiskValue123",
    "my integration token MaybeToken12345",
    "callback=https://user:MaybeUrlPass123@example.com/path"
  ].join("\n");
  const candidates = extractAiCandidates(text, { policyMode: "enterprise" });

  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.value === "abc123def456" && candidate.score >= 40 && candidate.score < 60
    ),
    "enterprise/strict mode should pass medium-confidence unknown values to local AI assist"
  );
  assert.ok(candidates.some((candidate) => candidate.kind === "colon" && candidate.value === "MediumRiskValue123"));
  assert.ok(candidates.some((candidate) => candidate.kind === "naturalLanguage" && candidate.value === "MaybeToken12345"));
  assert.ok(candidates.some((candidate) => candidate.kind === "urlCredential" && candidate.value === "MaybeUrlPass123"));
}

function testCandidateExtractionDoesNotUseNetworkApis() {
  const originalFetch = globalThis.fetch;
  const originalXmlHttpRequest = globalThis.XMLHttpRequest;
  let networkCalls = 0;

  globalThis.fetch = () => {
    networkCalls += 1;
    throw new Error("network call is not allowed in local AI candidate extraction");
  };
  globalThis.XMLHttpRequest = function XMLHttpRequest() {
    networkCalls += 1;
    throw new Error("XMLHttpRequest is not allowed in local AI candidate extraction");
  };

  try {
    const candidates = extractAiCandidates("token=MaybeLocalOnlyToken12345", {
      policyMode: "enterprise"
    });
    assert.ok(candidates.some((candidate) => candidate.value === "MaybeLocalOnlyToken12345"));
    assert.strictEqual(networkCalls, 0, "AI candidate extraction must remain local-only");
  } finally {
    if (typeof originalFetch === "undefined") {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
    if (typeof originalXmlHttpRequest === "undefined") {
      delete globalThis.XMLHttpRequest;
    } else {
      globalThis.XMLHttpRequest = originalXmlHttpRequest;
    }
  }
}

testDeterministicRangesAreExcluded();
testSafeConfigValuesAreIgnored();
testSuspiciousAssignmentsAndUrlCredentials();
testPlaceholdersAreIgnored();
testPolicyThresholds();
testRangeShapes();
testMediumConfidenceCandidatesForLocalAssist();
testCandidateExtractionDoesNotUseNetworkApis();

console.log("PASS AI candidate gate regressions");
