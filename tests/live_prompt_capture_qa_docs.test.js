const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const runbookPath = path.join(repoRoot, "docs/qa/live-prompt-capture-qa.md");
const fixturePath = path.join(repoRoot, "tests/fixtures/manual/live-site-qa/prompt-comprehension-cases.md");

const runbook = fs.readFileSync(runbookPath, "utf8");
const fixture = fs.readFileSync(fixturePath, "utf8");

function assertIncludesAll(label, text, values) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} should include ${value}`);
  }
}

function testRunbookSafetyGates() {
  assertIncludesAll("runbook safety", runbook, [
    "Use only the synthetic inputs",
    "does not hook network",
    "does not submit",
    "not included in manifests",
    "not shipped as a runtime script",
    "Captured text must stay in the local browser DevTools session",
    "Do not send it to a model",
    "userAuthoredPrompt",
    "sanitizedPrompt",
    "uiStatusText",
    "fileHandoffMetadata",
    "adapterInternalState"
  ]);
}

function testAdapterCoverageAndGeminiPriority() {
  assertIncludesAll("adapter checklist", runbook, [
    "ChatGPT",
    "OpenAI",
    "Gemini",
    "Claude",
    "Grok",
    "X/generic",
    "Highest priority",
    "rejected file fallback",
    "Pending attach clear",
    "Disable/re-enable protection",
    "Multi-file",
    "File-only"
  ]);
}

function testPromptCapturePassCriteria() {
  assertIncludesAll("pass criteria", runbook, [
    "Pre-submit observe-only capture",
    "typed risky synthetic values may remain visible",
    "no placeholder should appear before submit",
    "Submit/post-submit capture",
    "submitted content must be sanitized",
    "raw synthetic sensitive values must be absent",
    "placeholders are expected",
    "exact-state verification",
    "fail-closed",
    "UI/status/debug text appeared only outside the composer",
    "Repeated capture changed prompt",
    "Repeated submit mutated prompt",
    "Gemini pending attach stale payload reused"
  ]);
}

function testTypedPlaceholderDesignNote() {
  assertIncludesAll("typed placeholder note", runbook, [
    "[PWM_N]",
    "[REDACTED_PRIVATE_IP_1]",
    "[REDACTED_UNC_PATH_1]",
    "[REDACTED_EMAIL_1]",
    "[REDACTED_SERVER_NAME_1]",
    "should remain generic or strongly secret-classed",
    "future Phase entry"
  ]);
}

function testFixtureCasesCoverModelComprehensionSet() {
  assertIncludesAll("fixture cases", fixture, [
    "PC-001",
    "SMB migration",
    "PC-002",
    "Azure subscription and tenant command",
    "PC-003",
    "Private IP log investigation",
    "PC-004",
    "GPO and registry hardening",
    "PC-005",
    "`.env` review",
    "PC-006",
    "Kubernetes secret reference",
    "PC-007",
    "AWS/GCP mixed cloud configuration",
    "Expected preserved meaning",
    "Expected placeholder count/type",
    "Pass/fail criteria"
  ]);
}

function testNoProductionHookInstructions() {
  assert.strictEqual(runbook.includes("manifest.json"), false, "runbook must not instruct manifest changes");
  assert.strictEqual(runbook.includes("fetch("), false, "runbook snippet must not transmit captures");
  assert.strictEqual(runbook.includes("sendBeacon"), false, "runbook snippet must not beacon captures");
  assert.strictEqual(runbook.includes("XMLHttpRequest"), false, "runbook snippet must not upload captures");
}

function run() {
  testRunbookSafetyGates();
  testAdapterCoverageAndGeminiPriority();
  testPromptCapturePassCriteria();
  testTypedPlaceholderDesignNote();
  testFixtureCasesCoverModelComprehensionSet();
  testNoProductionHookInstructions();
  console.log("PASS live prompt capture QA docs");
}

run();
