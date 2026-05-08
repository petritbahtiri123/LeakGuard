const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/redactor.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));

const { Detector, PlaceholderManager, Redactor } = globalThis.PWM;

function redact(text) {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const findings = detector.scan(text);
  return new Redactor(manager).redact(text, findings);
}

(function testZeroWidth() {
  const text = "pass\u200bword=HiddenSecret456";
  const result = redact(text);
  assert.strictEqual(result.redactedText.includes("HiddenSecret456"), false);
})();

(function testSplitSecret() {
  const text = 'API_KEY="sk-abc" + "123456789"';
  const result = redact(text);
  assert.strictEqual(result.redactedText.includes("sk-abc123456789"), false);
})();

(function testBase64() {
  const secret = Buffer.from("SuperSecret789").toString("base64");
  const text = `encoded=${secret}`;
  const result = redact(text);
  assert.strictEqual(result.redactedText.includes(secret), false);
})();

(function testIPv6() {
  const text = "public_ipv6=2001:0db8:85a3:0000:0000:8a2e:0370:7334";
  const result = redact(text);
  assert.strictEqual(result.redactedText.includes("2001:0db8"), false);
})();

(function testObfuscatedKey() {
  const text = "p a s s w o r d = Secret999";
  const result = redact(text);
  assert.strictEqual(result.redactedText.includes("Secret999"), false);
})();

(function testUnknownPlaceholderLikePassword() {
  const text = "password=[PWM_12345]";
  const result = redact(text);
  assert.strictEqual(result.redactedText.includes("[PWM_12345]"), false);
})();

(function testTrustedPlaceholderTailRedactsOnlyTail() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  manager.trackKnownPlaceholder("[PWM_2]");
  const text = "password=[PWM_2]4512341234";
  const findings = detector.scan(text, { manager });
  const result = new Redactor(manager).redact(text, findings);

  assert.strictEqual(result.redactedText, "password=[PWM_2][PWM_3]");
})();

(function testPartialApiKeyAndJwtLikeValues() {
  const text = [
    "api_key=ApiKeyPartial123",
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZHZlcnNhcmlhbCJ9.signature123456",
    "token is ghr_AdversarialToken1234567890"
  ].join("\n");
  const result = redact(text);

  assert.strictEqual(result.redactedText.includes("ApiKeyPartial123"), false);
  assert.strictEqual(result.redactedText.includes("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZHZlcnNhcmlhbCJ9.signature123456"), false);
  assert.strictEqual(result.redactedText.includes("ghr_AdversarialToken1234567890"), false);
})();

(function testPemBlockAndUrlCredentialStructure() {
  const text = [
    "private_key: -----BEGIN PRIVATE KEY-----",
    "ABCDEF1234567890ABCDEF1234567890",
    "-----END PRIVATE KEY-----",
    "https://svc:UrlCredPass123!@service.internal/path"
  ].join("\n");
  const result = redact(text);

  assert.strictEqual(result.redactedText.includes("ABCDEF1234567890ABCDEF1234567890"), false);
  assert.ok(/^private_key: \[PWM_\d+\]$/m.test(result.redactedText));
  assert.ok(/https:\/\/\[PWM_\d+\]:\[PWM_\d+\]@service\.internal\/path/.test(result.redactedText));
  assert.strictEqual(result.redactedText.includes("UrlCredPass123!"), false);
})();

console.log("PASS adversarial redaction tests");
