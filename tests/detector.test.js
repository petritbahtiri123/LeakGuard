const assert = require("assert");
const fs = require("fs");
const path = require("path");

require(path.join(__dirname, "../shared/entropy.js"));
require(path.join(__dirname, "../shared/patterns.js"));
require(path.join(__dirname, "../shared/detector.js"));
require(path.join(__dirname, "../shared/placeholders.js"));
require(path.join(__dirname, "../shared/redactor.js"));

const { Detector, PlaceholderManager, Redactor } = globalThis.PWM;

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures.json"), "utf8")
);

function assertSinglePlaceholderType(resultText, expectedType) {
  const matches = resultText.match(/\[[A-Z0-9_]+_\d+\]/g) || [];
  assert.ok(matches.length >= 1, `expected placeholder for ${expectedType}`);
}

function testFixtures() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);

  let passed = 0;

  for (const fixture of fixtures) {
    const findings = detector.scan(fixture.text);

    assert.ok(findings.length > 0, `${fixture.name}: expected at least one finding`);
    assert.ok(
      findings.some((finding) => finding.type === fixture.expectsType),
      `${fixture.name}: expected finding type ${fixture.expectsType}, got ${findings
        .map((finding) => finding.type)
        .join(", ")}`
    );

    const result = redactor.redact(fixture.text, findings);
    assertSinglePlaceholderType(result.redactedText, fixture.expectsType);
    passed += 1;
  }

  return passed;
}

function testRepeatedSameSecret() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text =
    "OPENAI_API_KEY=sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555 mirror=sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555";

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const matches = result.redactedText.match(/\[API_KEY_\d+\]/g) || [];
  const unique = [...new Set(matches)];

  assert.strictEqual(matches.length, 2, "expected two replacements for repeated secret");
  assert.strictEqual(unique.length, 1, "repeated same secret should map to one placeholder");
}

function testRepeatedDifferentSecretsSameType() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text =
    "OPENAI_API_KEY=sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555 and backup=sk-proj-ZZZZ9999yyyy8888XXXX7777wwww6666vvvv5555";

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const matches = result.redactedText.match(/\[API_KEY_\d+\]/g) || [];
  const unique = [...new Set(matches)];

  assert.strictEqual(matches.length, 2, "expected two API key replacements");
  assert.strictEqual(unique.length, 2, "different secrets of same type need separate placeholders");
}

function testDbUriWithCredentials() {
  const detector = new Detector();
  const text = "Use mysql://reporter:S3cure!Pass@db.internal:3306/analytics for local debug.";
  const findings = detector.scan(text);

  assert.ok(findings.some((finding) => finding.type === "DB_URI"), "db uri should be detected");
}

function testOverlapBearerVsJwt() {
  const detector = new Detector();
  const text =
    "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50IjoiZGV2In0.c2lnbmF0dXJlX3ZhbHVlXzEyMzQ1";

  const findings = detector.scan(text);

  assert.strictEqual(findings.length, 1, "bearer/jwt overlap should resolve to one finding");
  assert.strictEqual(findings[0].type, "TOKEN", "overlap should still report a token");
}

function testOverlappingMatchesPreferSinglePemBlock() {
  const detector = new Detector();
  const text =
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----";

  const findings = detector.scan(text);

  assert.strictEqual(findings.length, 1, "overlapping PEM matches should collapse to one finding");
  assert.strictEqual(findings[0].type, "PRIVATE_KEY");
}

function testAllowlist() {
  const detector = new Detector({
    allowlist: ["sk-proj-ALLOWED1111bbbb2222CCCC3333dddd4444eeee5555"]
  });

  const text =
    "Safe fixture OPENAI_API_KEY=sk-proj-ALLOWED1111bbbb2222CCCC3333dddd4444eeee5555 should stay visible.";

  const findings = detector.scan(text);
  assert.strictEqual(findings.length, 0, "allowlisted values should not trigger");
}

function testExampleValuesDoNotTrigger() {
  const detector = new Detector();
  const cases = [
    "Example token: sk-proj-example-placeholder-value-should-not-match",
    "Sample credential: AWS_SECRET_ACCESS_KEY=example-secret-placeholder-value",
    "Use postgres://demo:password@example.com/app as sample docs text"
  ];

  for (const text of cases) {
    const findings = detector.scan(text);
    assert.strictEqual(findings.length, 0, `example value should not trigger: ${text}`);
  }
}

function run() {
  const fixtureCount = testFixtures();
  testRepeatedSameSecret();
  testRepeatedDifferentSecretsSameType();
  testDbUriWithCredentials();
  testOverlapBearerVsJwt();
  testOverlappingMatchesPreferSinglePemBlock();
  testAllowlist();
  testExampleValuesDoNotTrigger();

  console.log(`PASS ${fixtureCount} fixtures + targeted detector cases`);
}

run();
