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
    "here is the production database password: ProdDbPass!2026",
    "my db password is DbPass123!",
    "real value: RealValue123!",
    "real secret value RealSecret123!",
    "the real api key is: sk-admin-NaturalLanguageApiKey123456",
    "actual token value ActualToken123456",
    "actual bearer token: BearerTokenValue123456",
    "use this client secret: ClientSecretValue123!",
    "token -> TokenValue123456",
    "here's my api key sk-admin-AbCdEf1234567890xyzXYZ",
    "again the same password is: RepeatPass!2026",
    "this is my secret 9876543210",
    "token -> 123456789012",
    "my password is 123456"
  ].join("\n");
  const { findings, result } = scanAndRedact(text);
  const expected = [
    ["SECRET", "Abc12345!"],
    ["PASSWORD", "ForestLock!2026"],
    ["PASSWORD", "ProdDbPass!2026"],
    ["PASSWORD", "DbPass123!"],
    ["SECRET", "RealValue123!"],
    ["SECRET", "RealSecret123!"],
    ["API_KEY", "sk-admin-NaturalLanguageApiKey123456"],
    ["TOKEN", "ActualToken123456"],
    ["TOKEN", "BearerTokenValue123456"],
    ["SECRET", "ClientSecretValue123!"],
    ["TOKEN", "TokenValue123456"],
    ["API_KEY", "sk-admin-AbCdEf1234567890xyzXYZ"],
    ["PASSWORD", "RepeatPass!2026"],
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
    "regex for password: RegexPass123!",
    "template real value: TemplateSecret123!",
    "example password: ExamplePass123!",
    "generated sample api key: GeneratedSampleKey123456",
    "secret santa says the real api key is SantaKey123456",
    "password_hint=ask-admin",
    "secret_santa=true",
    "token_limit=4096",
    "max_token_limit=8192",
    "api_version=2026-04-30",
    "build_id=build-2026-04-30",
    "region=eu-central-1",
    "environment=production",
    "token limit is 123456789012",
    "api version is ApiVersion123456",
    "build id is 1234567890"
  ].join("\n");
  const findings = new Detector().scan(text);

  assert.deepStrictEqual(findings, []);
}

function testPairedNaturalLanguageDisclosureFamilies() {
  const pairs = [
    {
      name: "production database password",
      positive: "here is the production database password: ProdPairDbPass!2026",
      raw: "ProdPairDbPass!2026",
      type: "PASSWORD",
      safe: "password policy: production database passwords require rotation every 90 days"
    },
    {
      name: "real api key",
      positive: "the real api key is: sk-admin-PairedRealApiKey123456",
      raw: "sk-admin-PairedRealApiKey123456",
      type: "API_KEY",
      safe: "api version is 2026-04-30"
    },
    {
      name: "actual bearer token",
      positive: "actual bearer token: PairedBearerToken123456",
      raw: "PairedBearerToken123456",
      type: "TOKEN",
      safe: "token limit is 123456789012"
    },
    {
      name: "client secret",
      positive: "use this client secret: PairedClientSecret123!",
      raw: "PairedClientSecret123!",
      type: "SECRET",
      safe: "generated sample client secret: GeneratedSampleSecret123!"
    },
    {
      name: "again same password",
      positive: "again the same password is: PairedRepeatPass!2026",
      raw: "PairedRepeatPass!2026",
      type: "PASSWORD",
      safe: "regex for password: PairedRegexPass!2026"
    }
  ];

  for (const pair of pairs) {
    const { findings, result } = scanAndRedact(pair.positive);
    assert.ok(
      findings.some((finding) => finding.type === pair.type && finding.raw === pair.raw),
      `${pair.name}: expected positive disclosure finding`
    );
    assert.strictEqual(result.redactedText.includes(pair.raw), false, `${pair.name}: raw value should redact`);

    const safeFindings = new Detector().scan(pair.safe);
    assert.deepStrictEqual(safeFindings, [], `${pair.name}: safe prose should not trigger`);
  }
}

testExpandedNaturalLanguageDisclosures();
testFalseContextDenyListSuppressesDiscussionText();
testPairedNaturalLanguageDisclosureFamilies();

console.log("PASS natural-language context regressions");
