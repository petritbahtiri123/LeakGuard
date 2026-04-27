const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/redactor.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));

const { Detector, PlaceholderManager, Redactor, transformOutboundPrompt } = globalThis.PWM;

const BREAK_TEST_PACK = [
  "DB_PASSWORD=VaultHorse!2026!Test",
  "API_KEY=sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf",
  "SECRET_KEY=RealSecretValueAfterPlaceholder123",
  "CLIENT_SECRET=ClientSecretValue1234567890",
  "TOKEN=TokenValue1234567890abcdef",
  "AUTH_HEADER=Bearer HeaderToken1234567890",
  "Authorization: Bearer HeaderToken123456",
  "DATABASE_URL=postgres://app:ProdDbPass2026!@db.internal:5432/app",
  "MYSQL_URL=mysql://root:RoutePass8899!@mysql.internal:3306/analytics",
  "REDIS_URL=redis://:RedisPass8899!@redis.internal:6379/0",
  "WEBHOOK_URL=https://webhook.invalid/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
  "SHARED_SECRET=SharedSecretValue1234567890",
  "real_secret_after_placeholder=RealSecretValueAfterPlaceholder123",
  "token_limit=4096",
  "secret_santa=true",
  "password_hint=ask-admin",
  "api_version=2026-04-27",
  "region=eu-central-1",
  "version=1.2.3",
  "debug=true",
  "environment=production",
  "username=petrit",
  "public_url=https://example.com",
  "url=https://example.com",
  "this is not a password",
  "token budget is 4096",
  "secret santa party",
  "bearer animal is not auth",
  "client secret meeting notes",
  "private_ip=10.0.0.5",
  "local_ip=192.168.1.10",
  "public_ip=8.8.8.8",
  "placeholder=[PWM_1]",
  "API_KEY=sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf",
  "p a s s w o r d = SpacedPass123!",
  "passw0rd=ZeroPass123!",
  "pa$$word=DollarPass123!",
  "api key = spacedApiKey1234567890",
  "bearer token: BearerToken1234567890",
  "authorization bearer AuthorizationBearer1234567890"
].join("\n");

function assertIncludesAll(output, expected, label) {
  for (const value of expected) {
    assert.ok(output.includes(value), `${label}: expected visible text: ${value}`);
  }
}

function assertExcludesAll(output, forbidden, label) {
  for (const value of forbidden) {
    assert.strictEqual(output.includes(value), false, `${label}: raw value survived: ${value}`);
  }
}

function testBreakPackRedactionAndSafeLines() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const findings = detector.scan(BREAK_TEST_PACK);
  const redacted = new Redactor(manager).redact(BREAK_TEST_PACK, findings);
  const transformed = transformOutboundPrompt(BREAK_TEST_PACK, {
    manager,
    findings,
    mode: "hide_public"
  });

  const redactedText = redacted.redactedText;
  const transformedText = transformed.redactedText;
  const repeatedApiKeyPlaceholder = /^API_KEY=(\[PWM_\d+\])$/m.exec(redactedText)?.[1];
  const repeatedSecretPlaceholder = /^SECRET_KEY=(\[PWM_\d+\])$/m.exec(redactedText)?.[1];

  assert.ok(findings.length >= 18, "break pack should produce broad credential findings");
  assert.ok(repeatedApiKeyPlaceholder, "primary API key should redact");
  assert.ok(repeatedSecretPlaceholder, "secret key should redact");
  assert.strictEqual(
    redactedText.includes(`real_secret_after_placeholder=${repeatedSecretPlaceholder}`),
    true,
    "same repeated secret value should reuse one placeholder"
  );
  assert.strictEqual(
    redactedText.split(`API_KEY=${repeatedApiKeyPlaceholder}`).length - 1,
    2,
    "same repeated API key should reuse one placeholder"
  );
  assert.ok(redactedText.includes("placeholder=[PWM_1]"), "existing placeholder should stay visible");
  assert.strictEqual(
    /^DB_PASSWORD=\[PWM_1\]$/m.test(redactedText),
    false,
    "new redaction must not collide with existing [PWM_1]"
  );

  assertExcludesAll(
    transformedText,
    [
      "VaultHorse!2026!Test",
      "sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf",
      "RealSecretValueAfterPlaceholder123",
      "ClientSecretValue1234567890",
      "TokenValue1234567890abcdef",
      "HeaderToken1234567890",
      "HeaderToken123456",
      "ProdDbPass2026!",
      "RoutePass8899!",
      "RedisPass8899!",
      "SharedSecretValue1234567890",
      "SpacedPass123!",
      "ZeroPass123!",
      "DollarPass123!",
      "spacedApiKey1234567890",
      "BearerToken1234567890",
      "AuthorizationBearer1234567890",
      "8.8.8.8"
    ],
    "break pack"
  );

  assertIncludesAll(
    transformedText,
    [
      "token_limit=4096",
      "secret_santa=true",
      "password_hint=ask-admin",
      "api_version=2026-04-27",
      "region=eu-central-1",
      "version=1.2.3",
      "debug=true",
      "environment=production",
      "public_url=https://example.com",
      "url=https://example.com",
      "this is not a password",
      "token budget is 4096",
      "secret santa party",
      "bearer animal is not auth",
      "client secret meeting notes",
      "private_ip=10.0.0.5",
      "local_ip=192.168.1.10",
      "placeholder=[PWM_1]"
    ],
    "break pack"
  );

  assert.ok(/\[PUB_HOST_\d+\]/.test(transformedText), "public IP should use public-host placeholder");
}

testBreakPackRedactionAndSafeLines();
console.log("PASS LeakGuard break-test redaction pack");
