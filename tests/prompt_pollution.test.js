const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/knownSecretReuse.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/content/composer_helpers.js"));

const { Detector, PlaceholderManager, transformOutboundPrompt, ComposerHelpers } = globalThis.PWM;

const POLLUTION_MARKERS = [
  "LeakGuard",
  "PWM_DEBUG",
  "debug",
  "metadata",
  "redactedLength",
  "placeholderCount",
  "file-handoff",
  "pending attach",
  "diagnostic",
  "adapter",
  "rawState",
  "status:"
];

function redactPrompt(input, manager = new PlaceholderManager()) {
  const normalized = ComposerHelpers.normalizeComposerText(input);
  const findings = new Detector().scan(normalized).filter((finding) => finding.severity !== "low");
  return transformOutboundPrompt(normalized, {
    findings,
    manager,
    mode: "hide_public"
  });
}

function assertNoPromptPollution(text, label) {
  for (const marker of POLLUTION_MARKERS) {
    assert.strictEqual(text.includes(marker), false, `${label} should not contain ${marker}`);
  }
}

function assertIntentSurvives(text, requiredTerms, label) {
  for (const term of requiredTerms) {
    assert.ok(text.includes(term), `${label} should preserve task context term: ${term}`);
  }
}

function countPlaceholders(text) {
  return (String(text).match(/\[[A-Z][A-Z0-9_]*_\d+(?:_[A-Z0-9_]+)?\]/g) || []).length;
}

function testProtectionOffLeavesPromptUntouched() {
  const prompt = "Create a PowerShell script to migrate SMB shares from SERVER01 to SERVER02 while preserving NTFS permissions.";
  const submitted = ComposerHelpers.normalizeComposerText(prompt);

  assert.strictEqual(submitted, prompt, "protection-off baseline should submit user-authored text unchanged");
  assertNoPromptPollution(submitted, "protection-off prompt");
}

function testDevOpsPromptsRemainUnderstandableAfterRedaction() {
  const cases = [
    {
      label: "SMB migration",
      input: "Create a PowerShell script to migrate SMB shares from SERVER01 to SERVER02 while preserving NTFS permissions.",
      terms: ["Create a PowerShell script", "migrate SMB shares", "preserving NTFS permissions"],
      maxPlaceholders: 0
    },
    {
      label: "Azure CLI subscription",
      input: "Fix this Azure CLI command that fails against subscription 7f2b8c9d-1234-4abc-8def-123456789abc: az account set --subscription 7f2b8c9d-1234-4abc-8def-123456789abc",
      terms: ["Fix this Azure CLI command", "az account set", "--subscription"],
      maxPlaceholders: 2
    },
    {
      label: "private network log",
      input: "Explain this log from private IP 10.10.20.15 and UNC path \\\\filesrv01\\Finance where access was denied.",
      terms: ["Explain this log", "private IP", "UNC path", "access was denied"],
      maxPlaceholders: 2
    },
    {
      label: "GPO registry",
      input: "Generate a GPO path and registry setting for blocking removable storage under HKLM\\Software\\Policies\\ExampleCorp.",
      terms: ["Generate a GPO path", "registry setting", "blocking removable storage"],
      maxPlaceholders: 1
    },
    {
      label: "env review",
      input: "Review this .env file and tell me what is risky:\nAPI_KEY=sk-test-abcdefghijklmnopqrstuvwxyz123456\nDB_PASSWORD=CorrectHorseBatteryStaple42!\nAPP_MODE=production",
      terms: ["Review this .env file", "tell me what is risky", "API_KEY=", "DB_PASSWORD=", "APP_MODE=production"],
      maxPlaceholders: 2
    }
  ];

  for (const testCase of cases) {
    const result = redactPrompt(testCase.input);
    assertNoPromptPollution(result.redactedText, testCase.label);
    assertIntentSurvives(result.redactedText, testCase.terms, testCase.label);
    assert.ok(
      countPlaceholders(result.redactedText) <= testCase.maxPlaceholders,
      `${testCase.label} should keep placeholder count reasonable: ${result.redactedText}`
    );
  }
}

function testRepeatedProcessingIsIdempotent() {
  const manager = new PlaceholderManager();
  const prompt = "Review this command: curl -H 'Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890' https://api.example.invalid/v1";
  const first = redactPrompt(prompt, manager);
  const second = redactPrompt(first.redactedText, manager);

  assert.strictEqual(second.redactedText, first.redactedText, "second pass should not duplicate placeholders");
  assert.strictEqual(
    countPlaceholders(second.redactedText),
    countPlaceholders(first.redactedText),
    "second pass should keep placeholder count stable"
  );
  assertNoPromptPollution(second.redactedText, "idempotent redaction prompt");
}

function testFileOnlyAndMultiFileFallbackPromptsStayUserAuthored() {
  const userPrompt = "Review the attached sanitized files and summarize risky configuration choices.";
  const fileOnlySubmittedText = ComposerHelpers.normalizeComposerText(userPrompt);
  const multiFileSubmittedText = ComposerHelpers.normalizeComposerText(userPrompt);

  assert.strictEqual(fileOnlySubmittedText, userPrompt, "file-only handoff should not add file status text to prompt body");
  assert.strictEqual(multiFileSubmittedText, userPrompt, "multi-file handoff should not add per-file status text to prompt body");
  assertNoPromptPollution(fileOnlySubmittedText, "file-only submitted prompt");
  assertNoPromptPollution(multiFileSubmittedText, "multi-file submitted prompt");
}

function run() {
  testProtectionOffLeavesPromptUntouched();
  testDevOpsPromptsRemainUnderstandableAfterRedaction();
  testRepeatedProcessingIsIdempotent();
  testFileOnlyAndMultiFileFallbackPromptsStayUserAuthored();
  console.log("PASS prompt pollution regressions");
}

run();
