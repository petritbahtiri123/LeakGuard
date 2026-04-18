const assert = require("assert");
const fs = require("fs");
const path = require("path");

require(path.join(__dirname, "../shared/entropy.js"));
require(path.join(__dirname, "../shared/patterns.js"));
require(path.join(__dirname, "../shared/detector.js"));
require(path.join(__dirname, "../shared/placeholders.js"));
require(path.join(__dirname, "../shared/redactor.js"));

const { Detector, PlaceholderManager, Redactor, PATTERNS } = globalThis.PWM;

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures.json"), "utf8")
);

const NEW_PATTERN_NAMES = [
  "openssh_private_key_block",
  "aws_session_token_assignment",
  "azure_storage_account_key_assignment",
  "slack_webhook",
  "discord_webhook",
  "gitlab_pat",
  "stripe_secret_key",
  "google_service_account_private_key",
  "basic_auth_header",
  "azure_servicebus_connection_string",
  "npm_token",
  "docker_auth_config",
  "cookie_session_token"
];

const NEGATIVE_CASES = [
  {
    name: "openssh private key example marker",
    text:
      "-----BEGIN OPENSSH PRIVATE KEY-----\nexample-placeholder-key-material\n-----END OPENSSH PRIVATE KEY-----",
    expectsNoFindings: true
  },
  {
    name: "aws session token replace me",
    text: "AWS_SESSION_TOKEN=replace_me",
    expectsNoFindings: true
  },
  {
    name: "azure storage account key example",
    text: 'AZURE_STORAGE_ACCOUNT_KEY="exampleStorageKeyMaterialShouldStayVisible1234567890=="',
    expectsNoFindings: true
  },
  {
    name: "slack webhook sample path",
    text: "Use this sample https://hooks.slack.com/services/TEXAMPLE1/BEXAMPLE2/exampleWebhookToken for docs.",
    expectsNoFindings: true
  },
  {
    name: "discord webhook example token",
    text: "Sample URL https://discord.com/api/webhooks/123456789012345678/exampleWebhookToken",
    expectsNoFindings: true
  },
  {
    name: "gitlab pat example token",
    text: "glpat-example-placeholder-token-value should not trigger in docs.",
    expectsNoFindings: true
  },
  {
    name: "stripe publishable key",
    text: "Frontend key pk_test_51Nn3ExamplePublishableKey0000 is safe to expose.",
    expectsNoFindings: true
  },
  {
    name: "google service account private key example block",
    text:
      '{"private_key":"-----BEGIN PRIVATE KEY-----\\nexample-placeholder\\n-----END PRIVATE KEY-----\\n"}',
    expectsNoFindings: true
  },
  {
    name: "basic auth prose only",
    text: "Document the Authorization: Basic header format for onboarding.",
    expectsNoFindings: true
  },
  {
    name: "azure service bus sample docs",
    text:
      "Sample Endpoint=sb://example.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=example-shared-access-key",
    expectsNoFindings: true
  },
  {
    name: "npm token placeholder",
    text: "NPM_TOKEN=replace_me",
    expectsNoFindings: true
  },
  {
    name: "docker auth placeholder",
    text: '{"auths":{"https://index.docker.io/v1/":{"auth":"replace_me"}}}',
    expectsNoFindings: true
  },
  {
    name: "cookie preference",
    text: "Cookie: theme=dark; locale=en-US",
    expectsNoFindings: true
  }
];

function assertSinglePlaceholderType(resultText, expectedType) {
  const regex = new RegExp(`\\[${expectedType}_\\d+\\]`, "g");
  const matches = resultText.match(regex) || [];
  assert.ok(matches.length >= 1, `expected placeholder for ${expectedType}`);
}

function testPatternMetadata() {
  for (const name of NEW_PATTERN_NAMES) {
    const pattern = PATTERNS.find((entry) => entry.name === name);
    assert.ok(pattern, `${name}: missing pattern definition`);
    assert.ok(pattern.type, `${name}: missing type`);
    assert.ok(pattern.category, `${name}: missing category`);
    assert.ok(Number.isFinite(pattern.baseScore), `${name}: missing base score`);
    assert.ok(pattern.suppressionNotes, `${name}: missing false-positive suppression notes`);
  }
}

function testPositiveFixtures() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);

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
  }
}

function testNegativeExamples() {
  const detector = new Detector();

  for (const fixture of NEGATIVE_CASES) {
    const findings = detector.scan(fixture.text);
    if (fixture.expectsNoFindings) {
      assert.strictEqual(findings.length, 0, `${fixture.name}: expected suppression`);
    }
  }
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

function testMultilineDifferentPasswords() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = 'db_password = "AlphaPass_111!!"\nbackup_password = "BetaPass_222!!"';

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.strictEqual(
    result.redactedText,
    "db_password = [PASSWORD_1]\nbackup_password = [PASSWORD_2]",
    "different multiline password values should keep line boundaries and get unique placeholders"
  );
}

function testMultilineRepeatedPassword() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = 'db_password = "RepeatPass_111!!"\nbackup_password = "RepeatPass_111!!"';

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.strictEqual(
    result.redactedText,
    "db_password = [PASSWORD_1]\nbackup_password = [PASSWORD_1]",
    "repeated multiline password values should reuse the same placeholder"
  );
}

function testRegressionMixedMultilineSecrets() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    'AWS_SESSION_TOKEN="IQoJb3JpZ2luX2VjEMv//////////wEaCXVzLWVhc3QtMSJGMEQCIBxY2FzZVN0dWR5VG9rZW4wMTIz"',
    "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50IjoiZGV2In0.c2lnbmF0dXJlX3ZhbHVlXzEyMzQ1",
    "https://hooks.slack.com/services/T12345678/B12345678/abcdefghijklmnopqrstuvwxyzABCD"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.ok(findings.length >= 3, "expected multiline mixed secrets to produce multiple findings");
  assert.ok(/\[TOKEN_1\]/.test(result.redactedText), "expected first token placeholder");
  assert.ok(/\[TOKEN_2\]/.test(result.redactedText), "expected second token placeholder");
  assert.ok(/\[WEBHOOK_1\]/.test(result.redactedText), "expected webhook placeholder");
}

function testDbUriWithCredentials() {
  const detector = new Detector();
  const text = "Use mysql://reporter:S3cure!Pass@db.internal:3306/analytics for local debug.";
  const findings = detector.scan(text);

  assert.ok(findings.some((finding) => finding.type === "DB_URI"), "db uri should be detected");
}

function testGenericBasicAuthUrl() {
  const detector = new Detector();
  const text = "Internal URL https://deploy:Sup3rSecr3t!@ops.internal.corp/path is used by the deploy agent.";
  const findings = detector.scan(text);

  assert.ok(
    findings.some((finding) => finding.type === "CONNECTION_STRING"),
    "basic auth URL should be detected via generic credential URI rule"
  );
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

function testSuppressionFamilies() {
  const detector = new Detector();
  const cases = [
    {
      name: "webhook family suppression",
      text:
        "Slack docs example https://hooks.slack.com/services/TEXAMPLE1/BEXAMPLE2/exampleWebhookToken and sample https://discord.com/api/webhooks/123456789012345678/exampleWebhookToken should stay visible."
    },
    {
      name: "connection string family suppression",
      text:
        "Example Endpoint=sb://example.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=example-shared-access-key and DefaultEndpointsProtocol=https;AccountName=example;AccountKey=replace_me;EndpointSuffix=core.windows.net"
    },
    {
      name: "assignment family suppression",
      text:
        'SESSION_SECRET="replace_me"\nAZURE_STORAGE_ACCOUNT_KEY="exampleStorageKeyMaterialShouldStayVisible1234567890=="\nNPM_TOKEN=changeme'
    }
  ];

  for (const fixture of cases) {
    const findings = detector.scan(fixture.text);
    assert.strictEqual(findings.length, 0, `${fixture.name}: expected all examples to suppress`);
  }
}

function testRevealStateLookupUnit() {
  const manager = new PlaceholderManager();
  const placeholder = manager.getPlaceholder("real-session-value-1234567890", "TOKEN");
  const state = manager.exportState();

  const freshManager = new PlaceholderManager();
  freshManager.setState(state);

  assert.strictEqual(
    freshManager.getRaw(placeholder),
    "real-session-value-1234567890",
    "placeholder lookup should survive state rehydration"
  );

  const segments = freshManager.segmentText(`before ${placeholder} after`);
  assert.strictEqual(segments.length, 3, "segmentation should preserve revealable placeholder runs");
  assert.strictEqual(segments[1].type, "secret", "middle segment should be revealable");
  assert.strictEqual(segments[1].raw, "real-session-value-1234567890");
}

function run() {
  testPatternMetadata();
  testPositiveFixtures();
  testNegativeExamples();
  testRepeatedSameSecret();
  testRepeatedDifferentSecretsSameType();
  testMultilineDifferentPasswords();
  testMultilineRepeatedPassword();
  testRegressionMixedMultilineSecrets();
  testDbUriWithCredentials();
  testGenericBasicAuthUrl();
  testOverlapBearerVsJwt();
  testOverlappingMatchesPreferSinglePemBlock();
  testAllowlist();
  testExampleValuesDoNotTrigger();
  testSuppressionFamilies();
  testRevealStateLookupUnit();

  console.log(
    `PASS ${fixtures.length} positive fixtures + metadata, suppression, multiline, and reveal regressions`
  );
}

run();
