const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/redactor.js"));

const { Detector, PlaceholderManager, Redactor } = globalThis.PWM;

function scanAndRedact(text) {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const findings = detector.scan(text);
  const result = new Redactor(manager).redact(text, findings);
  return { findings, result };
}

function testExpandedNaturalLanguageDisclosures() {
  const text = [
    "this is my secret Abc12345!",
    "here is my password ForestLock!2026",
    "my db password is DbPass123!",
    "real value: RealValue123!",
    "real secret value RealSecret123!",
    "actual token value ActualToken123456",
    "token -> TokenValue123456",
    "here's my api key sk-admin-AbCdEf1234567890xyzXYZ",
    "this is my secret 9876543210",
    "token -> 123456789012",
    "my password is 123456"
  ].join("\n");
  const { findings, result } = scanAndRedact(text);
  const expected = [
    ["SECRET", "Abc12345!"],
    ["PASSWORD", "ForestLock!2026"],
    ["PASSWORD", "DbPass123!"],
    ["SECRET", "RealValue123!"],
    ["SECRET", "RealSecret123!"],
    ["TOKEN", "ActualToken123456"],
    ["TOKEN", "TokenValue123456"],
    ["API_KEY", "sk-admin-AbCdEf1234567890xyzXYZ"],
    ["SECRET", "9876543210"],
    ["TOKEN", "123456789012"],
    ["PASSWORD", "123456"]
  ];

  for (const [type, raw] of expected) {
    assert.ok(
      findings.some((finding) => finding.type === type && finding.raw === raw),
      `expected ${type} natural-language finding for ${raw}`
    );
    assert.strictEqual(result.redactedText.includes(raw), false, `${raw} should be redacted`);
  }
}

function testFalseContextDenyListSuppressesDiscussionText() {
  const text = [
    "example: my password is ExamplePass123!",
    "password policy says my password is PolicyPass123!",
    "regex for token -> TokenValue123456",
    "template real value: TemplateSecret123!",
    "password_hint=ask-admin",
    "secret_santa=true",
    "token_limit=4096",
    "max_token_limit=8192",
    "api_version=2026-04-30",
    "build_id=build-2026-04-30",
    "region=eu-central-1",
    "environment=production",
    "token limit is 123456789012",
    "build id is 1234567890"
  ].join("\n");
  const findings = new Detector().scan(text);

  assert.deepStrictEqual(findings, []);
}

testExpandedNaturalLanguageDisclosures();
testFalseContextDenyListSuppressesDiscussionText();

console.log("PASS natural-language context regressions");
