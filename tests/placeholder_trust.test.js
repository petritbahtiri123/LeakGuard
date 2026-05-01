const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/redactor.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));

const { Detector, PlaceholderManager, Redactor, transformOutboundPrompt } = globalThis.PWM;

function placeholders(text) {
  return text.match(/\[PWM_\d+\]/g) || [];
}

function trustPlaceholders(...tokens) {
  const manager = new PlaceholderManager();
  for (const token of tokens) {
    manager.trackKnownPlaceholder(token);
  }
  return manager;
}

function redact(text, manager = new PlaceholderManager()) {
  const detector = new Detector();
  const findings = detector.scan(text, { manager });
  return {
    findings,
    result: new Redactor(manager).redact(text, findings),
    manager
  };
}

function testTrustedPlaceholderPreserved() {
  const manager = trustPlaceholders("[PWM_1]");
  const text = "my password is [PWM_1]";
  const { findings, result } = redact(text, manager);

  assert.deepStrictEqual(findings, []);
  assert.strictEqual(result.redactedText, text);
}

function testRepeatedTrustedPlaceholderPreserved() {
  const manager = trustPlaceholders("[PWM_1]");
  const text = "my password is [PWM_1] and again [PWM_1]";
  const { findings, result } = redact(text, manager);

  assert.deepStrictEqual(findings, []);
  assert.strictEqual(result.redactedText, text);
}

function testUnknownCleanPlaceholderRedactsInPasswordContext() {
  const text = "my password is [PWM_21234123]";
  const { findings, result } = redact(text);

  assert.ok(findings.some((finding) => finding.raw === "[PWM_21234123]"));
  assert.strictEqual(result.redactedText.includes("[PWM_21234123]"), false);
  assert.ok(/^my password is \[PWM_\d+\]$/.test(result.redactedText));
}

function testUnknownStandardPlaceholderDoesNotRedactToItself() {
  const text = "my password is [PWM_1]";
  const { result } = redact(text);

  assert.strictEqual(result.redactedText, "my password is [PWM_2]");
}

function testTrustedPlaceholderNumericTailSplits() {
  const manager = trustPlaceholders("[PWM_2]");
  const text = "my password is [PWM_2]4512341234";
  const { findings, result } = redact(text, manager);

  assert.deepStrictEqual(findings.map((finding) => finding.raw), ["4512341234"]);
  assert.strictEqual(result.redactedText, "my password is [PWM_2][PWM_3]");
}

function testTrustedPlaceholderAlphaNumericTailSplits() {
  const manager = trustPlaceholders("[PWM_2]");
  const text = "token=[PWM_2]prodABC123XYZ";
  const { findings, result } = redact(text, manager);

  assert.deepStrictEqual(findings.map((finding) => finding.raw), ["prodABC123XYZ"]);
  assert.strictEqual(result.redactedText, "token=[PWM_2][PWM_3]");
}

function testTrustedPlaceholderBenignSuffixStaysVisible() {
  const manager = trustPlaceholders("[PWM_2]");
  const text = "file=[PWM_2].json";
  const { findings, result } = redact(text, manager);

  assert.deepStrictEqual(findings, []);
  assert.strictEqual(result.redactedText, text);
}

function testUnknownPlaceholderTailIsWholeCandidate() {
  const text = "my password is [PWM_2]4512341234";
  const { findings, result } = redact(text);

  assert.ok(findings.some((finding) => finding.raw === "[PWM_2]4512341234"));
  assert.strictEqual(result.redactedText, "my password is [PWM_3]");
}

function testVisibleFakeIndicesAreReserved() {
  const text = [
    "my password is [PWM_7]",
    "OPENAI_API_KEY=sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555"
  ].join("\n");
  const { result } = redact(text);

  assert.strictEqual(result.redactedText.includes("[PWM_7]"), false);
  assert.ok(result.redactedText.includes("my password is [PWM_8]"));
  assert.ok(result.redactedText.includes("OPENAI_API_KEY=[PWM_9]"));
}

function testRepeatedFakePlaceholderReusesReplacement() {
  const text = "my password is [PWM_42] and backup password is [PWM_42]";
  const { result } = redact(text);
  const unique = [...new Set(placeholders(result.redactedText))];

  assert.deepStrictEqual(unique, ["[PWM_43]"]);
}

function testTransformOutboundPromptFiltersTrustedPlaceholderFindingsSynchronously() {
  const manager = trustPlaceholders("[PWM_1]");
  const text = "my password is [PWM_1]";
  const result = transformOutboundPrompt(text, {
    manager,
    findings: [
      {
        id: "over_eager",
        raw: "[PWM_1]",
        start: 15,
        end: 22,
        type: "PASSWORD",
        category: "credential"
      }
    ],
    mode: "hide_public"
  });

  assert.strictEqual(typeof result.then, "undefined");
  assert.strictEqual(result.redactedText, text);
}

function testTrustedPlaceholderUriCredentialsStayStableAndExtraAtSecretRedacts() {
  const manager = trustPlaceholders("[PWM_48]", "[PWM_49]", "[PWM_50]", "[PWM_51]", "[PWM_52]");
  const text = [
    "postgres://[PWM_48]:[PWM_49]@ssw0rd123@db.internal:5432/app",
    "mysql://[PWM_50]:[PWM_51]@mysql.internal:3306/analytics",
    "https://user:Passw0rd!@example.com/path",
    "ftp://[PWM_48]:[PWM_52]@files.example.com"
  ].join("\n");
  const { findings, result } = redact(text, manager);

  assert.ok(findings.some((finding) => finding.raw === "@ssw0rd123"));
  assert.ok(findings.some((finding) => finding.raw === "Passw0rd!"));
  assert.strictEqual(result.redactedText.includes("ssw0rd123"), false);
  assert.strictEqual(result.redactedText.includes("Passw0rd!"), false);
  assert.ok(
    result.redactedText.includes("mysql://[PWM_50]:[PWM_51]@mysql.internal:3306/analytics"),
    "trusted-placeholder mysql URI should stay intact"
  );
  assert.ok(
    result.redactedText.includes("ftp://[PWM_48]:[PWM_52]@files.example.com"),
    "trusted-placeholder ftp URI should stay intact"
  );
}

function testUntrustedPlaceholderUriExtraAtSecretAlsoRedacts() {
  const text = "postgres://[PWM_1]:[PWM_2]@ssw0rd123@db.internal:5432/app";
  const { findings, result } = redact(text);

  assert.ok(findings.some((finding) => finding.raw === "@ssw0rd123"));
  assert.strictEqual(result.redactedText.includes("ssw0rd123"), false);
  assert.strictEqual(result.redactedText.includes("[PWM_1]"), true);
  assert.strictEqual(result.redactedText.includes("[PWM_2]"), true);
  assert.ok(
    /postgres:\/\/\[PWM_1\]:\[PWM_2\]\[PWM_\d+\]@db\.internal:5432\/app/.test(
      result.redactedText
    )
  );
}

function testMixedPlaceholderUriBlockRedactsOnlyUntrustedOrRawSecretParts() {
  const text = [
    "postgres://[PWM_1]:[PWM_2]@ssw0rd123@db.internal:5432/app",
    "mysql://[PWM_3]:[PWM_4]@mysql.internal:3306/analytics",
    "https://[PWM_5]:[PWM_6]@example.com/path",
    "ftp://[PWM_1]:[PWM_7]@files.example.com"
  ].join("\n");
  const untrusted = redact(text);
  const trustedManager = trustPlaceholders(
    "[PWM_1]",
    "[PWM_2]",
    "[PWM_3]",
    "[PWM_4]",
    "[PWM_5]",
    "[PWM_6]",
    "[PWM_7]"
  );
  const trusted = redact(text, trustedManager);

  assert.strictEqual(untrusted.result.redactedText.includes("ssw0rd123"), false);
  for (let index = 1; index <= 7; index += 1) {
    assert.ok(
      untrusted.result.redactedText.includes(`[PWM_${index}]`),
      `clean URL placeholder [PWM_${index}] should remain visible`
    );
  }

  assert.strictEqual(trusted.result.redactedText.includes("ssw0rd123"), false);
  assert.ok(
    trusted.result.redactedText.includes("mysql://[PWM_3]:[PWM_4]@mysql.internal:3306/analytics")
  );
  assert.ok(trusted.result.redactedText.includes("https://[PWM_5]:[PWM_6]@example.com/path"));
  assert.ok(trusted.result.redactedText.includes("ftp://[PWM_1]:[PWM_7]@files.example.com"));
}

testTrustedPlaceholderPreserved();
testRepeatedTrustedPlaceholderPreserved();
testUnknownCleanPlaceholderRedactsInPasswordContext();
testUnknownStandardPlaceholderDoesNotRedactToItself();
testTrustedPlaceholderNumericTailSplits();
testTrustedPlaceholderAlphaNumericTailSplits();
testTrustedPlaceholderBenignSuffixStaysVisible();
testUnknownPlaceholderTailIsWholeCandidate();
testVisibleFakeIndicesAreReserved();
testRepeatedFakePlaceholderReusesReplacement();
testTransformOutboundPromptFiltersTrustedPlaceholderFindingsSynchronously();
testTrustedPlaceholderUriCredentialsStayStableAndExtraAtSecretRedacts();
testUntrustedPlaceholderUriExtraAtSecretAlsoRedacts();
testMixedPlaceholderUriBlockRedactsOnlyUntrustedOrRawSecretParts();

console.log("PASS placeholder trust regressions");
