const assert = require("assert");
const fs = require("fs");
const path = require("path");

require(path.join(__dirname, "../src/shared/entropy.js"));
require(path.join(__dirname, "../src/shared/patterns.js"));
require(path.join(__dirname, "../src/shared/detector.js"));
require(path.join(__dirname, "../src/shared/placeholders.js"));
require(path.join(__dirname, "../src/shared/redactor.js"));

const {
  Detector,
  PlaceholderManager,
  Redactor,
  PATTERNS,
  normalizeVisiblePlaceholders,
  canonicalizePlaceholderToken
} = globalThis.PWM;

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures.json"), "utf8")
);

const NEW_PATTERN_NAMES = [
  "openssh_private_key_block",
  "aws_session_token_assignment",
  "aws_access_key_id_assignment",
  "azure_storage_account_key_assignment",
  "anthropic_api_key",
  "slack_webhook",
  "discord_webhook",
  "gitlab_pat",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "google_service_account_private_key",
  "google_oauth_client_secret",
  "google_refresh_token_assignment",
  "sendgrid_api_key",
  "authorization_bearer_value",
  "bearer_token",
  "basic_auth_header",
  "azure_servicebus_connection_string",
  "npm_token",
  "pypi_token",
  "docker_auth_config",
  "cookie_session_token",
  "query_param_api_key",
  "query_param_token",
  "natural_language_openai_key",
  "natural_language_secret",
  "labelled_password_value",
  "labelled_openai_key_value",
  "real_value_label",
  "quoted_secret_label"
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
    name: "stripe webhook example secret",
    text: "STRIPE_WEBHOOK_SECRET=whsec_example_placeholder_value",
    expectsNoFindings: true
  },
  {
    name: "google service account private key example block",
    text:
      '{"private_key":"-----BEGIN PRIVATE KEY-----\\nexample-placeholder\\n-----END PRIVATE KEY-----\\n"}',
    expectsNoFindings: true
  },
  {
    name: "google oauth client secret example",
    text: "GOOGLE_CLIENT_SECRET=GOCSPX-example-placeholder-secret-value",
    expectsNoFindings: true
  },
  {
    name: "google refresh token example",
    text: "refresh_token=1//example-placeholder-refresh-token",
    expectsNoFindings: true
  },
  {
    name: "sendgrid docs sample",
    text: "Use SG.examplePlaceholderValue1234.exampleTokenValue5678 in docs only.",
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
    name: "pypi token placeholder",
    text: "PYPI_TOKEN=replace_me",
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
  },
  {
    name: "natural language secret prose",
    text: "The secret is patience during the rollout.",
    expectsNoFindings: true
  }
];

const PWM_PLACEHOLDER_REGEX = /\[PWM_\d+\]/g;
const LEGACY_PLACEHOLDER_REGEX = /\[(?!PWM_)[A-Z][A-Z0-9_]*_\d+\]/;

function getPlaceholders(text) {
  return text.match(PWM_PLACEHOLDER_REGEX) || [];
}

function assertNoTypedPlaceholders(text, label) {
  assert.strictEqual(
    LEGACY_PLACEHOLDER_REGEX.test(text),
    false,
    label || "typed placeholders must not appear in visible output"
  );
}

function assertContainsGenericPlaceholder(resultText, label) {
  const matches = getPlaceholders(resultText);
  assert.ok(matches.length >= 1, label || "expected generic placeholder");
  assert.strictEqual(
    LEGACY_PLACEHOLDER_REGEX.test(resultText),
    false,
    "expected only neutral PWM placeholders"
  );
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
    assertContainsGenericPlaceholder(
      result.redactedText,
      `expected placeholder for ${fixture.expectsType}`
    );
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

function testProviderTokenFamiliesDetectAndRedact() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const body20 = "A1b2C3d4E5f6G7h8I9j0";
  const body30 = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4";
  const cases = [
    ["GitHub ghp", `ghp_${body30}`],
    ["GitHub github_pat", `github_pat_${body30}_${body20}`],
    ["GitHub gho", `gho_${body30}`],
    ["GitHub ghu", `ghu_${body30}`],
    ["GitHub ghs", `ghs_${body30}`],
    ["GitHub ghr", `ghr_${body30}`],
    ["GitLab glpat", `glpat-${body30}`],
    ["GitLab gldt", `gldt-${body30}`],
    ["GitLab glrt", `glrt-${body30}`],
    ["GitLab glcbt", `glcbt-${body30}`],
    ["GitLab glptt", `glptt-${body30}`],
    ["GitLab glft", `glft-${body30}`],
    ["GitLab glimt", `glimt-${body30}`],
    ["GitLab glagent", `glagent-${body30}`],
    ["GitLab glwt", `glwt-${body30}`]
  ];

  for (const [name, token] of cases) {
    const text = `PROVIDER_TOKEN=${token}`;
    const findings = detector.scan(text);
    const finding = findings.find((entry) => entry.type === "TOKEN" && entry.raw === token);

    assert.ok(finding, `${name}: expected exact raw token finding`);
    assert.strictEqual(finding.severity, "high", `${name}: expected high severity finding`);

    const result = redactor.redact(text, findings);
    const redactedLine = result.redactedText.match(/^PROVIDER_TOKEN=(\[PWM_\d+\])$/m);
    assert.ok(redactedLine, `${name}: expected token to be fully replaced by one placeholder`);
    assertContainsGenericPlaceholder(result.redactedText, `${name}: expected redaction`);
    assert.strictEqual(
      result.redactedText.includes(token),
      false,
      `${name}: raw token must not remain after redaction`
    );
    assert.strictEqual(
      result.redactedText,
      `PROVIDER_TOKEN=${redactedLine[1]}`,
      `${name}: token prefix/suffix must not remain beside the placeholder`
    );
  }
}

function testProviderTokenShortAndTemplateValuesStayVisible() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const safeValues = [
    "ghp_demo",
    "gho_test",
    "github_pat_example",
    "glpat-demo",
    "glrt-test",
    "glwt-example",
    "gldt-CHANGE_ME",
    "template GitLab token glpat-replace-me",
    "example GitHub token ghp-replace-me",
    "docs say use github_pat_xxxxx as a placeholder"
  ];

  for (const text of safeValues) {
    const findings = detector.scan(text);
    const result = redactor.redact(text, findings);
    assert.strictEqual(findings.length, 0, `${text}: expected provider token suppression`);
    assert.strictEqual(result.redactedText, text, `${text}: safe value should remain visible`);
  }
}

function testMixedGitlabRedactionKeepsConfigReadable() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const runnerToken = "glrt-AbCdEfGhIjKlMnOpQrStUvWxYz12";
  const workloadToken = "glwt-ZyXwVuTsRqPoNmLkJiHgFeDcBa9876";
  const text = [
    "[gitlab]",
    "endpoint = https://gitlab.com/group/project",
    `runner_token = ${runnerToken}`,
    "branch = main",
    `repeat_runner = ${runnerToken}`,
    `workload_token = ${workloadToken}`,
    "notes = keep surrounding config readable"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const redactedText = result.redactedText;
  const runnerMatches = redactedText.match(/^runner_token = (\[PWM_\d+\])$/m);
  const repeatMatches = redactedText.match(/^repeat_runner = (\[PWM_\d+\])$/m);

  assert.ok(runnerMatches, "runner token should redact to a placeholder");
  assert.ok(repeatMatches, "repeated runner token should redact to a placeholder");
  assert.strictEqual(
    repeatMatches[1],
    runnerMatches[1],
    "repeated GitLab token should reuse a stable placeholder"
  );
  assert.ok(/^workload_token = \[PWM_\d+\]$/m.test(redactedText), "workload token should redact");
  assert.strictEqual(redactedText.includes(runnerToken), false);
  assert.strictEqual(redactedText.includes(workloadToken), false);
  assert.strictEqual(/gl(?:pat|dt|rt|cbt|ptt|ft|imt|agent|wt)-\[PWM_\d+\]/.test(redactedText), false);
  assert.strictEqual(/\[PWM_\d+\][A-Za-z0-9_-]{4,}/.test(redactedText), false);
  assert.ok(redactedText.includes("endpoint = https://gitlab.com/group/project"));
  assert.ok(redactedText.includes("branch = main"));
  assert.ok(redactedText.includes("notes = keep surrounding config readable"));
}

function testLegacyPlaceholderNormalizationHelper() {
  const text = [
    "API_KEY=[API_KEY_1]",
    "DB_PASSWORD=[PASSWORD_2]",
    "TOKEN=[TOKEN_1]",
    "AWS_SECRET_ACCESS_KEY=[AWS_SECRET_KEY_1]"
  ].join("\n");

  const normalized = normalizeVisiblePlaceholders(text);

  assertNoTypedPlaceholders(normalized, "legacy placeholder helper must normalize typed tokens");
  assert.ok(
    normalized.includes(`API_KEY=${canonicalizePlaceholderToken("[API_KEY_1]")}`),
    "API key placeholder should normalize to a generic PWM token"
  );
  assert.ok(
    normalized.includes(`DB_PASSWORD=${canonicalizePlaceholderToken("[PASSWORD_2]")}`),
    "password placeholder should normalize to a generic PWM token"
  );
  assert.ok(
    normalized.includes(`TOKEN=${canonicalizePlaceholderToken("[TOKEN_1]")}`),
    "token placeholder should normalize to a generic PWM token"
  );
}

function testRepeatedSameSecret() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text =
    "OPENAI_API_KEY=sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555 mirror=sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555";

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const matches = getPlaceholders(result.redactedText);
  const unique = [...new Set(matches)];

  assert.strictEqual(matches.length, 2, "expected two replacements for repeated secret");
  assert.strictEqual(unique.length, 1, "repeated same secret should map to one placeholder");
}

function testRepeatedAwsAccessKeyWithExampleSubstringStillRedactsAndReusesPlaceholder() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = "AWS_ACCESS_KEY_ID=AKIAQ4EXAMPLE7K9M2P1\nmirror=AKIAQ4EXAMPLE7K9M2P1";

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const matches = getPlaceholders(result.redactedText);
  const unique = [...new Set(matches)];

  assert.ok(
    findings.some(
      (finding) => finding.type === "AWS_KEY" && finding.raw === "AKIAQ4EXAMPLE7K9M2P1"
    ),
    "aws access key containing EXAMPLE should still be detected when the keyword is inside the value"
  );
  assert.strictEqual(matches.length, 2, "expected both repeated AWS key occurrences to be replaced");
  assert.strictEqual(unique.length, 1, "repeated AWS key should reuse the same placeholder");
  assert.strictEqual(
    result.redactedText,
    "AWS_ACCESS_KEY_ID=[PWM_1]\nmirror=[PWM_1]",
    "repeated AWS key should redact both occurrences consistently"
  );
}

function testRepeatedDifferentSecretsSameType() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text =
    "OPENAI_API_KEY=sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555 and backup=sk-proj-ZZZZ9999yyyy8888XXXX7777wwww6666vvvv5555";

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const matches = getPlaceholders(result.redactedText);
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
    "db_password = [PWM_1]\nbackup_password = [PWM_2]",
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
    "db_password = [PWM_1]\nbackup_password = [PWM_1]",
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
  assert.ok(/\[PWM_1\]/.test(result.redactedText), "expected first neutral placeholder");
  assert.ok(/\[PWM_2\]/.test(result.redactedText), "expected second neutral placeholder");
  assert.ok(/\[PWM_3\]/.test(result.redactedText), "expected third neutral placeholder");
}

function testAwsSessionTokenStillRedactsAfterOtherAwsValuesAreAlreadyPlaceholderized() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjEJr//////////wEaCXVzLWVhc3QtMSJHMEUCIFakeSessionTokenValue1234567890abcdefghijklmnop"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "TOKEN" &&
        finding.raw ===
          "IQoJb3JpZ2luX2VjEJr//////////wEaCXVzLWVhc3QtMSJHMEUCIFakeSessionTokenValue1234567890abcdefghijklmnop"
    ),
    "aws session token should still be detected when sibling AWS values are already placeholderized"
  );
  assert.strictEqual(
    result.redactedText,
    "AWS_ACCESS_KEY_ID=[PWM_1]\nAWS_SECRET_ACCESS_KEY=[PWM_2]\nAWS_SESSION_TOKEN=[PWM_3]",
    "aws session token should be fully redacted without colliding with existing clean placeholders"
  );
}

function testExistingVisiblePlaceholdersDoNotCollideWithNewSecretAssignments() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "KNOWN=[PWM_1]",
    "NETWORK=[NET_1]",
    "PUBLIC_HOST=[PUB_HOST_1]",
    "OPENAI_API_KEY=sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555"
  ].join("\n");

  const result = redactor.redact(text, detector.scan(text));
  const lines = result.redactedText.split("\n");

  assert.strictEqual(lines[0], "KNOWN=[PWM_1]", "existing PWM placeholder should stay intact");
  assert.strictEqual(lines[1], "NETWORK=[NET_1]", "existing network placeholder should stay intact");
  assert.strictEqual(
    lines[2],
    "PUBLIC_HOST=[PUB_HOST_1]",
    "existing public host placeholder should stay intact"
  );
  assert.strictEqual(
    lines[3],
    "OPENAI_API_KEY=[PWM_2]",
    "new secret should advance past existing visible PWM placeholders"
  );
}

function testPositiveCredentialFixturesStillRedactWithExistingPlaceholdersInText() {
  const detector = new Detector();
  const fixtureTypes = new Set([
    "API_KEY",
    "TOKEN",
    "SECRET",
    "PASSWORD",
    "AWS_KEY",
    "AWS_SECRET_KEY",
    "PRIVATE_KEY",
    "DB_URI",
    "CONNECTION_STRING",
    "WEBHOOK"
  ]);

  for (const fixture of fixtures) {
    if (!fixtureTypes.has(fixture.expectsType)) continue;

    const manager = new PlaceholderManager();
    const redactor = new Redactor(manager);
    const text = [
      "KNOWN=[PWM_1]",
      "NET=[NET_1]",
      fixture.text
    ].join("\n");
    const findings = detector.scan(text);
    const result = redactor.redact(text, findings);

    assert.ok(findings.length > 0, `${fixture.name}: expected finding with existing placeholders present`);
    for (const finding of findings) {
      assert.strictEqual(
        result.redactedText.includes(finding.raw),
        false,
        `${fixture.name}: raw finding survived redaction with existing placeholders present`
      );
    }
    assert.ok(result.redactedText.includes("KNOWN=[PWM_1]"), `${fixture.name}: existing PWM placeholder changed`);
    assert.ok(result.redactedText.includes("NET=[NET_1]"), `${fixture.name}: existing NET placeholder changed`);
  }
}

function testDbUriWithCredentials() {
  const detector = new Detector();
  const text = "Use mysql://reporter:S3cure!Pass@db.internal:3306/analytics for local debug.";
  const findings = detector.scan(text);

  assert.ok(findings.some((finding) => finding.type === "DB_URI"), "db uri should be detected");
}

function testFullValueReplacementForConnectionStyleAssignments() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=fakestorageacct;AccountKey=FakeAccountKey1234567890ABCDEFGHIJKLMN==;EndpointSuffix=core.windows.net",
    "DATABASE_URL=postgres://testuser:FakeDbPass123!@db.internal:5432/appdb",
    "MYSQL_URL=mysql://reporter:AnotherFakePass456!@mysql.internal:3306/analytics"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const lines = result.redactedText.split("\n");

  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "CONNECTION_STRING" &&
        finding.raw ===
          "DefaultEndpointsProtocol=https;AccountName=fakestorageacct;AccountKey=FakeAccountKey1234567890ABCDEFGHIJKLMN==;EndpointSuffix=core.windows.net" &&
        finding.method.includes("full-value")
    ),
    "azure storage connection string assignment should be detected as one full value"
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "DB_URI" &&
        finding.raw === "FakeDbPass123!" &&
        finding.method.includes("db-uri-password")
    ),
    "DATABASE_URL assignment should detect the password segment directly"
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "DB_URI" &&
        finding.raw === "AnotherFakePass456!" &&
        finding.method.includes("db-uri-password")
    ),
    "MYSQL_URL assignment should detect the password segment directly"
  );

  assert.strictEqual(lines[0], "AZURE_STORAGE_CONNECTION_STRING=[PWM_1]");
  assert.ok(
    /^DATABASE_URL=postgres:\/\/\[PWM_\d+\]:\[PWM_\d+\]@db\.internal:5432\/appdb$/.test(lines[1]),
    "DATABASE_URL assignment should redact username and password while preserving URL structure"
  );
  assert.ok(
    /^MYSQL_URL=mysql:\/\/\[PWM_\d+\]:\[PWM_\d+\]@mysql\.internal:3306\/analytics$/.test(lines[2]),
    "MYSQL_URL assignment should redact username and password while preserving URL structure"
  );

  assert.ok(
    !result.redactedText.includes("FakeDbPass123!") &&
      !result.redactedText.includes("AnotherFakePass456!"),
    "db passwords must not survive redaction output"
  );
  assert.ok(
    !result.redactedText.includes("testuser") && !result.redactedText.includes("reporter"),
    "db usernames must not survive redaction output"
  );
  assert.ok(
    !result.redactedText.includes("FakeAccountKey1234567890ABCDEFGHIJKLMN==") &&
      !result.redactedText.includes("AccountName=fakestorageacct") &&
      !result.redactedText.includes("EndpointSuffix=core.windows.net"),
    "azure connection string fragments must not survive redaction output"
  );
  assert.ok(
    !result.redactedText.includes("[PWM_1];") &&
      !result.redactedText.includes("[PWM_2]://") &&
      !result.redactedText.includes("[PWM_3]://"),
    "connection-style assignment placeholders should not break URI prefixes"
  );
}

function testGenericBasicAuthUrl() {
  const detector = new Detector();
  const text = "Internal URL https://deploy:Sup3rSecr3t!@ops.internal.corp/path is used by the deploy agent.";
  const findings = detector.scan(text);

  assert.ok(
    findings.some((finding) => finding.type === "USERNAME" && finding.raw === "deploy") &&
      findings.some((finding) => finding.type === "PASSWORD" && finding.raw === "Sup3rSecr3t!"),
    "basic auth URL should redact username and password segments"
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

function testAuthorizationBearerVariants() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "AUTHORIZATION=Bearer mF_9.B5f-4.1JqM",
    "authorization=Bearer mF_9.B5f-4.1JqM",
    "Authorization=Bearer mF_9.B5f-4.1JqM",
    "Authorization: Bearer mF_9.B5f-4.1JqM"
    ,
    "Bearer mF_9.B5f-4.1JqM"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const matches = getPlaceholders(result.redactedText);
  const unique = [...new Set(matches)];

  assert.strictEqual(findings.length, 5, "all authorization and standalone bearer variants should be detected");
  assert.ok(findings.every((finding) => finding.type === "TOKEN"), "bearer values should map to TOKEN");
  assert.strictEqual(matches.length, 5, "all bearer values should be redacted");
  assert.strictEqual(unique.length, 1, "same bearer token should reuse one placeholder");
}

function testBasicAuthAssignmentVariants() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "Authorization: Basic dXNlcjpwYXNzd29yZA==",
    "BASIC_AUTH=Basic dXNlcjpwYXNzd29yZA==",
    "AUTH_HEADER=Basic dXNlcjpwYXNzd29yZA=="
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const matches = getPlaceholders(result.redactedText);
  const unique = [...new Set(matches)];

  assert.strictEqual(findings.length, 3, "all Basic auth assignment variants should be detected");
  assert.ok(findings.every((finding) => finding.type === "TOKEN"), "Basic auth values should map to TOKEN");
  assert.strictEqual(result.redactedText.includes("dXNlcjpwYXNzd29yZA=="), false);
  assert.strictEqual(result.redactedText.includes("[PWM_1]=="), false, "base64 padding should be redacted");
  assert.strictEqual(matches.length, 3, "all Basic auth payloads should be redacted");
  assert.strictEqual(unique.length, 1, "same Basic auth payload should reuse one placeholder");
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

function testExplicitAssignmentsStillRedactWhenAdjacentLinesContainExampleLikeValues() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "OPENAI_API_KEY=sk-test-example-1234567890abcdef",
    "DB_PASSWORD=SuperSecret123!"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const lines = result.redactedText.split("\n");

  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "API_KEY" &&
        finding.raw === "sk-test-example-1234567890abcdef"
    ),
    "explicit API key assignments should still be detected even when the value contains an example segment"
  );
  assert.ok(
    findings.some(
      (finding) => finding.type === "PASSWORD" && finding.raw === "SuperSecret123!"
    ),
    "a real password on the following line should not be suppressed by example-like text above it"
  );
  assert.strictEqual(lines[0], "AWS_ACCESS_KEY_ID=[PWM_1]");
  assert.strictEqual(lines[1], "AWS_SECRET_ACCESS_KEY=[PWM_2]");
  assert.ok(/^OPENAI_API_KEY=\[PWM_\d+\]$/.test(lines[2]));
  assert.ok(/^DB_PASSWORD=\[PWM_\d+\]$/.test(lines[3]));
  assert.strictEqual(
    result.redactedText.includes("sk-test-example-1234567890abcdef"),
    false,
    "raw API key assignment should not survive redaction"
  );
  assert.strictEqual(
    result.redactedText.includes("SuperSecret123!"),
    false,
    "raw password assignment should not survive redaction"
  );
}

function testAwsSecretAssignmentWithExamplePrefixStillFailsClosedButDocsPlaceholderStaysVisible() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "AWS_ACCESS_KEY_ID=AKIAEXAMPLE12345678",
    "AWS_SECRET_ACCESS_KEY=exampleSecretValue123456789",
    "mirror_secret=exampleSecretValue123456789",
    "private_ip=10.0.0.5",
    "url=https://example.com"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const lines = result.redactedText.split("\n");
  const placeholders = getPlaceholders(result.redactedText);
  const unique = [...new Set(placeholders)];

  assert.ok(
    findings.some(
      (finding) => finding.type === "AWS_KEY" && finding.raw === "AKIAEXAMPLE12345678"
    ),
    "explicit AWS access key id assignments should still detect key-shaped values"
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "AWS_SECRET_KEY" &&
        finding.raw === "exampleSecretValue123456789"
    ),
    "explicit AWS secret access key assignments should still detect structured values with an example prefix"
  );
  assert.strictEqual(placeholders.length, 3, "expected all explicit AWS secrets and duplicate mirrors to be replaced");
  assert.strictEqual(unique.length, 2, "AWS access key and AWS secret should map to distinct placeholders");
  assert.ok(/^AWS_ACCESS_KEY_ID=\[PWM_\d+\]$/.test(lines[0]));
  assert.ok(/^AWS_SECRET_ACCESS_KEY=\[PWM_\d+\]$/.test(lines[1]));
  assert.strictEqual(lines[2], `mirror_secret=${lines[1].split("=")[1]}`);
  assert.strictEqual(lines[3], "private_ip=10.0.0.5");
  assert.strictEqual(lines[4], "url=https://example.com");

  const docsFindings = detector.scan("AWS_SECRET_ACCESS_KEY=example-secret-placeholder-value");
  assert.strictEqual(
    docsFindings.length,
    0,
    "obvious docs placeholders for AWS secret access keys should stay suppressed"
  );
}

function testConcatenatedPlaceholderAssignmentsDoNotCreateCompositeFalsePositives() {
  const detector = new Detector();
  const text = [
    "DB_PASSWORD=[PWM_4]OPENAI_API_KEY=[PWM_3]",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]AWS_SECRET_ACCESS_KEY=[PWM_9]",
    "DB_PASSWORD=[PWM_17]OPENAI_API_KEY=[PWM_3]DB_PASSWORD=[PWM_18]AWS_ACCESS_KEY_ID=[PWM_1]"
  ].join("\n");

  const findings = detector.scan(text);

  assert.strictEqual(
    findings.length,
    0,
    "adjacent clean placeholder assignments should not be treated as raw secret composites"
  );
}

function testUserStressEdgeCasesRedactSecretsButKeepSafeLiterals() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    'mirror_1=sk-test-example-1234567890abcdef',
    'mirror_2="sk-test-example-1234567890abcdef"api_key=[PWM_5]',
    'secret "abc123SECRETvalue"Authorization: Bearer [PWM_6].payloadsignature.example',
    "DATABASE_URL=postgres://admin:MyUltraSecretPass@db.example.com:5432/appdb{",
    '{"apiKey":"sk-test-example-1234567890abcdef","dbPassword":"[PWM_7]","accessToken":"ghp_exampletokentest123456789"}',
    "my openai key is sk-test-example-1234567890abcdef",
    "Now mask this real value: MyActualPassword123!",
    "Password → SuperSecret123!",
    "Key → “sk-test-example-1234567890abcdef”",
    "```env",
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "DB_PASSWORD=[PWM_4]",
    "```",
    "secrets:",
    '  openai: "sk-test-example-1234567890abcdef"',
    '  db_password: [PWM_4]',
    "Please do not modify this literal text: [PWM_4256932165]",
    "The region is eu-central-1.",
    "CIDR=192.168.1.0/24",
    "PUBLIC_URL=https://example.com",
    "PASSWORD",
    "Key"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.ok(
    findings.some((finding) => finding.raw === "sk-test-example-1234567890abcdef"),
    "openai-style test key should still be detected across assignment, prose, and YAML-style contexts"
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "DB_URI" &&
        finding.raw === "MyUltraSecretPass" &&
        finding.method.includes("db-uri-password")
    ),
    "database URL assignments should still detect the password segment even with example-style hosts"
  );
  assert.ok(
    findings.some((finding) => finding.raw === "abc123SECRETvalue"),
    "quoted secret labels should detect the raw secret"
  );
  assert.ok(
    findings.some((finding) => finding.raw === "MyActualPassword123!"),
    "real value labels should detect raw password-like secrets"
  );
  assert.ok(
    findings.some((finding) => finding.raw === "SuperSecret123!"),
    "arrow-labelled passwords should be detected"
  );
  assert.strictEqual(
    result.redactedText.includes("sk-test-example-1234567890abcdef"),
    false,
    "openai-style test key should not survive redaction"
  );
  assert.strictEqual(
    result.redactedText.includes("MyUltraSecretPass"),
    false,
    "database password should not survive redaction"
  );
  assert.strictEqual(
    result.redactedText.includes("abc123SECRETvalue"),
    false,
    "quoted secret values should not survive redaction"
  );
  assert.strictEqual(
    result.redactedText.includes("MyActualPassword123!"),
    false,
    "real value labels should not survive redaction"
  );
  assert.strictEqual(
    result.redactedText.includes("SuperSecret123!"),
    false,
    "arrow-labelled passwords should not survive redaction"
  );
  assert.ok(
    result.redactedText.includes("[PWM_4256932165]"),
    "literal placeholder-looking text should stay unchanged"
  );
  assert.ok(result.redactedText.includes("The region is eu-central-1."), "region text should stay visible");
  assert.ok(result.redactedText.includes("CIDR=192.168.1.0/24"), "private CIDRs should stay visible");
  assert.ok(result.redactedText.includes("PUBLIC_URL=https://example.com"), "public URLs should stay visible");
  assert.ok(/\bPASSWORD\b/.test(result.redactedText), "bare PASSWORD labels should stay visible");
  assert.ok(/\bKey\b/.test(result.redactedText), "bare key labels should stay visible");
}

function testInlineStructuredAssignmentsStillMatchAfterEarlierInlineAssignments() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "AWS_ACCESS_KEY_ID=[PWM_1] DATABASE_URL=postgres://admin:MyUltraSecretPass@db.example.com:5432/appdb{",
    'AWS_SECRET_ACCESS_KEY=[PWM_2] DATABASE_URL=postgres://admin:VerySecretPass@db.example.com:5432/prod'
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "DB_URI" &&
        finding.raw === "MyUltraSecretPass" &&
        finding.method.includes("db-uri-password")
    ),
    "DATABASE_URL should still be detected when it appears later on the same line after other assignments"
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "DB_URI" &&
        finding.raw === "VerySecretPass" &&
        finding.method.includes("db-uri-password")
    ),
    "later inline DATABASE_URL values should keep matching instead of being swallowed by earlier assignments"
  );
  assert.strictEqual(
    result.redactedText.includes("MyUltraSecretPass"),
    false,
    "first inline database password should not survive redaction"
  );
  assert.strictEqual(
    result.redactedText.includes("VerySecretPass"),
    false,
    "second inline database password should not survive redaction"
  );
}

function testPartiallyRedactedOutputDoesNotRetriggerBenignPlaceholderComposites() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    'AWS_ACCESS_KEY_ID=[PWM_1] AWS_SECRET_ACCESS_KEY=[PWM_2] OPENAI_API_KEY=[PWM_3] DB_PASSWORD=[PWM_4]OPENAI_API_KEY=[PWM_3] mirror_1=sk-test-example-1234567890abcdef mirror_2="[PWM_1]"api_key=[PWM_5] API_KEY=[PWM_5] token: [PWM_5] secret "[PWM_6]"Authorization: Bearer [PWM_6].payloadsignature.example DATABASE_URL=postgres://admin:MyUltraSecretPass@db.example.com:5432/appdb{ "apiKey": "[PWM_1]", "dbPassword": "[PWM_7]" }',
    "AWS_DEFAULT_REGION = [PWM_7]eu-central-1",
    "text secrets: openai: [PWM_1] db_password: [PWM_4] aws_secret: [PWM_8]://example.com/callback?token=[PWM_3] DB_PASSWORD=[PWM_17]OPENAI_API_KEY=[PWM_3]DB_PASSWORD=[PWM_18]AWS_ACCESS_KEY_ID=[PWM_1] AWS_SECRET_ACCESS_KEY=[PWM_2] DB_PASSWORD=[PWM_19] OPENAI_API_KEY=[PWM_3] GITHUB_TOKEN=[PWM_15] DATABASE_URL=postgres://admin:VerySecretPass@db.example.com:5432/prod"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "DB_URI" &&
        finding.raw === "MyUltraSecretPass" &&
        finding.method.includes("db-uri-password")
    ),
    "reruns over partially redacted blobs should still recover raw database passwords inside URLs"
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "DB_URI" &&
        finding.raw === "VerySecretPass" &&
        finding.method.includes("db-uri-password")
    ),
    "later raw database passwords in partially redacted blobs should still be found"
  );
  assert.strictEqual(
    findings.some((finding) => finding.raw === "[PWM_7]eu-central-1"),
    false,
    "region suffixes attached to visible placeholders should not retrigger secret detection"
  );
  assert.strictEqual(
    findings.some((finding) => finding.raw === "[PWM_8]://example.com/callback?token=[PWM_3]"),
    false,
    "URL tails attached to visible placeholders should not retrigger secret detection"
  );
  assert.strictEqual(
    result.redactedText.includes("MyUltraSecretPass"),
    false,
    "reruns should not leave the first raw database password visible"
  );
  assert.strictEqual(
    result.redactedText.includes("VerySecretPass"),
    false,
    "reruns should not leave the second raw database password visible"
  );
  assert.ok(
    result.redactedText.includes("AWS_DEFAULT_REGION = [PWM_7]eu-central-1"),
    "benign placeholder-adjacent region text should stay untouched on rerun"
  );
  assert.ok(
    result.redactedText.includes("aws_secret: [PWM_8]://example.com/callback?token=[PWM_3]"),
    "benign placeholder-adjacent URL tails should stay untouched on rerun"
  );
}

function testPlaceholderValuesDoNotRetriggerDetection() {
  const detector = new Detector();
  const cases = [
    'SESSION_SECRET="[PWM_1]"',
    'AWS_SECRET_ACCESS_KEY="[PWM_2]"',
    'DB_PASSWORD="[PWM_3]"',
    'ANTHROPIC_API_KEY="[PWM_4]"',
    'STRIPE_WEBHOOK_SECRET="[PWM_5]"',
    'GOOGLE_CLIENT_SECRET="[PWM_6]"',
    'refresh_token="[PWM_7]"',
    'SENDGRID_API_KEY="[PWM_8]"',
    'PYPI_TOKEN="[PWM_9]"'
  ];

  for (const text of cases) {
    const findings = detector.scan(text);
    assert.strictEqual(findings.length, 0, `placeholder value should suppress: ${text}`);
  }
}

function testExpandedDetectorFamiliesMixedBlob() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  manager.trackKnownPlaceholder("[PWM_1]");
  const redactor = new Redactor(manager);
  const text = [
    "ANTHROPIC_API_KEY=sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXyz0123456789_abcd",
    "SENDGRID_API_KEY=SG.ZXhhbXBsZVNlbmRncmQxMjM0NTY3.EHl6QWJjRGVmR2hpSktMbU5vcFFSU1RVVldY",
    "STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefABCDEF1234567890",
    "GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz1234567890AB",
    "refresh_token=1//0gLExampleRefreshTokenValueAbCdEfGhIjKlMnOpQrStUv",
    "PYPI_TOKEN=[PWM_1]",
    "Use pypi-AgEIcHlwaS5vcmcCJDEyMzQ1Njc4OTBhYmNkZWYxMjM0NTY3ODlhYmNkZWY for release automation."
  ].join("\n");

  const findings = detector.scan(text, { manager });
  const result = redactor.redact(text, findings);

  assert.ok(findings.some((finding) => finding.raw.startsWith("sk-ant-")), "anthropic key should be detected");
  assert.ok(findings.some((finding) => finding.raw.startsWith("SG.")), "sendgrid key should be detected");
  assert.ok(
    findings.some((finding) => finding.raw.startsWith("whsec_")),
    "stripe webhook secret should be detected"
  );
  assert.ok(
    findings.some((finding) => finding.raw.startsWith("GOCSPX-")),
    "google oauth client secret should be detected"
  );
  assert.ok(
    findings.some((finding) => finding.raw.startsWith("1//")),
    "google refresh token assignment should be detected"
  );
  assert.ok(
    findings.some((finding) => finding.raw.startsWith("pypi-")),
    "raw PyPI token should be detected"
  );
  assert.ok(result.redactedText.includes("PYPI_TOKEN=[PWM_1]"), "clean placeholder should stay unchanged");
  assert.ok(
    !result.redactedText.includes("sk-ant-api03-") &&
      !result.redactedText.includes("SG.ZXhhbXBs") &&
      !result.redactedText.includes("whsec_123456") &&
      !result.redactedText.includes("GOCSPX-") &&
      !result.redactedText.includes("1//0gL") &&
      !result.redactedText.includes("pypi-AgEI"),
    "raw expanded-family secrets should not survive redaction"
  );
}

function testGoogleApiKeyJsonRegression() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text =
    '{"apiKey":"AIzaSyA-PLACEHOLDER-LOOKING-KEY1234567890","clientSecret":"GOCSPX-abcdefghijklmnopqrstuvwxyz1234567890AB"}';

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "API_KEY" &&
        finding.raw === "AIzaSyA-PLACEHOLDER-LOOKING-KEY1234567890"
    ),
    "google API key fixture should be detected inside JSON config"
  );
  assert.ok(
    result.redactedText.includes('"apiKey":"[PWM_1]"') ||
      result.redactedText.includes('"apiKey":"[PWM_2]"'),
    "google API key should be redacted inside JSON config"
  );
  assert.ok(
    !result.redactedText.includes("AIzaSyA-PLACEHOLDER-LOOKING-KEY1234567890"),
    "raw google API key fixture should not survive redaction"
  );
}

function testCompositePlaceholderAndNaturalLanguageEdgeCaseBlock() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  manager.trackKnownPlaceholder("[PWM_2]");
  manager.trackKnownPlaceholder("[PWM_3]");
  const redactor = new Redactor(manager);
  const text = [
    "API_KEY=abc123secretvalue",
    "DB_PASSWORD=[PWM_2]",
    "TOKEN=[PWM_1].TESTPAYLOAD.TESTSIGIG]",
    "API_KEY=abc123secretvalue",
    "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
    "AWS_SECRET_ACCESS_KEY=[PWM_3]",
    "API_KEY=abc123secretvalue",
    "my api key is abc123secretvalue",
    "[PWM_4]LEKEY"
  ].join("\n");

  const findings = detector.scan(text, { manager });
  const result = redactor.redact(text, findings);
  const lines = result.redactedText.split("\n");
  const compositeAssignment = findings.find(
    (finding) => finding.raw === "[PWM_1].TESTPAYLOAD.TESTSIGIG]"
  );

  assert.ok(compositeAssignment, "composite placeholder assignment should produce a finding");
  assert.ok(
    compositeAssignment.method.includes("placeholder-composite") ||
      compositeAssignment.method.includes("pattern"),
    "composite assignment should still be detected via a dedicated composite path"
  );

  assert.strictEqual(lines[1], "DB_PASSWORD=[PWM_2]", "clean password placeholder should stay");
  assert.strictEqual(
    lines[5],
    "AWS_SECRET_ACCESS_KEY=[PWM_3]",
    "clean AWS secret placeholder should stay"
  );
  assert.ok(/^TOKEN=\[PWM_\d+\]$/.test(lines[2]), "composite token value should be fully redacted");
  assert.ok(
    /^AWS_ACCESS_KEY_ID=\[PWM_\d+\]$/.test(lines[4]),
    "AWS access key assignment should redact the full key value"
  );
  assert.ok(/^my api key is \[PWM_\d+\]$/.test(lines[7]), "natural-language API key should redact");
  assert.ok(/^\[PWM_\d+\]$/.test(lines[8]), "standalone composite placeholder junk should redact");
  assert.strictEqual(lines[0], `API_KEY=${lines[3].split("=")[1]}`, "same API key should reuse one placeholder");
  assert.strictEqual(lines[0], `API_KEY=${lines[6].split("=")[1]}`, "same API key should reuse one placeholder");
  assert.strictEqual(lines[7], `my api key is ${lines[0].split("=")[1]}`, "natural-language API key should reuse the same placeholder");
}

function testMixedPlaceholderBlobPreservesKnownPlaceholdersAndRedactsRawLeaks() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  for (let index = 1; index <= 8; index += 1) {
    manager.trackKnownPlaceholder(`[PWM_${index}]`);
  }
  const redactor = new Redactor(manager);
  const text =
    'API_KEY=[PWM_1] DB_PASSWORD=[PWM_2] TOKEN=[PWM_3] AWS_ACCESS_KEY_ID=[PWM_4] AWS_SECRET_ACCESS_KEY=[PWM_5] AWS_SESSION_TOKEN=[PWM_6] CLIENT_SECRET=[PWM_7] AUTHORIZATION=Bearer mF_9.B5f{ "apiKey": "[PWM_8]", "password": "PrinterCable!2026!Demo", "token": "[PWM_3export API_KEY="[PWM_9]" export DB_PASSWORD=[PWM_10] export AWS_SECRET_ACCESS_KEY=[PWM_$env:API_KEY="[PWM_11]" $env:DB_PASSWORD=[PWM_12] $env:TOKEN="[PWM_13]"3]]" }-4.1JqM';

  const findings = detector.scan(text, { manager });
  const result = redactor.redact(text, findings);

  assert.ok(
    findings.some((finding) => finding.type === "PASSWORD" && finding.raw === "PrinterCable!2026!Demo"),
    "raw JSON password should be detected"
  );
  assert.ok(
    findings.some((finding) => finding.raw.startsWith("[PWM_3export")),
    "broken token placeholder prefix should be detected"
  );
  assert.ok(result.redactedText.includes("API_KEY=[PWM_1]"), "known API placeholder should stay");
  assert.ok(result.redactedText.includes("DB_PASSWORD=[PWM_2]"), "known password placeholder should stay");
  assert.ok(result.redactedText.includes("AWS_ACCESS_KEY_ID=[PWM_4]"), "known AWS key placeholder should stay");
  assert.ok(
    result.redactedText.includes("AWS_SECRET_ACCESS_KEY=[PWM_5]"),
    "known AWS secret placeholder should stay"
  );
  assert.ok(
    result.redactedText.includes("AWS_SESSION_TOKEN=[PWM_6]"),
    "known AWS session placeholder should stay"
  );
  assert.ok(result.redactedText.includes('CLIENT_SECRET=[PWM_7]'), "known secret placeholder should stay");
  assert.ok(
    !result.redactedText.includes("PrinterCable!2026!Demo"),
    "raw JSON password should not survive redaction"
  );
  assert.ok(
    !result.redactedText.includes("[PWM_3export"),
    "broken token placeholder prefix should not survive redaction"
  );
}

function testFinalRegressionBlockKeepsTrailingNaturalLanguagePasswordRedacted() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "FINAL REGRESSION TEST",
    "",
    "API_KEY=sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf",
    "DB_PASSWORD=VaultHorse!2026!Test",
    "TOKEN=eyJhbGciOiJIUzI1NiJ9.UExBQ0VIT0xERVJfUEFZTE9BRA.U2lnbmF0dXJlVGVzdDEyMw",
    "AWS_SECRET_ACCESS_KEY=Qm9Wc3RrL1pXcDcrTjVxUXIvV2hKc1l4cG9DdzJm",
    "",
    "API_KEY=[PWM_1]",
    "DB_PASSWORD=[PWM_2]",
    "TOKEN=[PWM_3]",
    "AWS_SECRET_ACCESS_KEY=[PWM_4]",
    "",
    "AUTHORIZATION=Bearer mF_9.B5f-4.1JqM",
    "Authorization: Bearer HeaderToken123456",
    "",
    '{"password":"PrinterCable!2026!Demo","token":"eyJhbGciOiJIUzI1NiJ9.TESTPAYLOAD.TESTSIG"}',
    "",
    'export API_KEY="sk_proj_9Zx2Lm7Qp4Vc8Rt5Yn1Kd6Hs3Bw0Tf"',
    '$env:DB_PASSWORD="ForestLock!2026!PS"',
    "",
    "[PWM_5]suffix",
    "prefix_[PWM_1]",
    "",
    "my api key is sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf",
    "my password is VaultHorse!2026!Test"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const trailingPasswordStart = text.lastIndexOf("VaultHorse!2026!Test");
  const dbPasswordPlaceholderMatch = /DB_PASSWORD=(\[PWM_\d+\])/.exec(result.redactedText);

  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "PASSWORD" &&
        finding.raw === "VaultHorse!2026!Test" &&
        finding.start === trailingPasswordStart
    ),
    "trailing natural-language password should be detected inside the mixed regression block"
  );
  assert.ok(
    dbPasswordPlaceholderMatch,
    "db password placeholder should still be present in the mixed regression block"
  );
  assert.ok(
    result.redactedText.includes(`my password is ${dbPasswordPlaceholderMatch[1]}`),
    "trailing natural-language password should reuse the same placeholder in the mixed regression block"
  );
  assert.ok(
    !result.redactedText.includes("my password is VaultHorse!2026!Test"),
    "trailing natural-language password should not survive redaction in the mixed regression block"
  );
}

function testNaturalLanguagePasswordVariants() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "my password is VaultHorse!2026!Test",
    'my password is "ForestLock!2026!PS"'
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);
  const passwordFindings = findings.filter((finding) => finding.type === "PASSWORD");

  assert.strictEqual(passwordFindings.length, 2, "both natural-language password variants should be detected");
  assert.ok(
    result.redactedText.includes("my password is [PWM_1]"),
    "bare natural-language password should be redacted"
  );
  assert.ok(
    result.redactedText.includes('my password is "[PWM_2]"'),
    "quoted natural-language password should be redacted"
  );
  assert.ok(
    !result.redactedText.includes("VaultHorse!2026!Test") &&
      !result.redactedText.includes("ForestLock!2026!PS"),
    "natural-language password raws should not survive redaction"
  );
}

function testDatabaseUrlAssignmentKeepsUriButMasksOnlyPassword() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = 'storage: {\n  databaseUrl: "postgres://admin:MyUltraSecretPass@db.example.com:5432/appdb"\n}';

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "DB_URI" &&
        finding.raw === "MyUltraSecretPass" &&
        finding.method.includes("db-uri-password")
    ),
    "databaseUrl assignment should detect only the DB password segment"
  );
  assert.ok(
    /databaseUrl: "postgres:\/\/\[PWM_\d+\]:\[PWM_\d+\]@db\.example\.com:5432\/appdb"/.test(
      result.redactedText
    ),
    "databaseUrl should keep the URI shape while masking username and password"
  );
  assert.ok(
    !result.redactedText.includes("MyUltraSecretPass") && !result.redactedText.includes("admin:"),
    "raw database credentials must not survive redaction"
  );
}

function testGithubJsonAccessTokenWithExampleSegmentStillRedacts() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    '{ "accessToken": "ghp_exampletokentest123456789" }',
    '{ "sessionToken": "gho_exampleoauthvalue123456789" }',
    '{ "token": "github_pat_exampletokentest123456789ABCDE" }'
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  assert.ok(
    findings.some(
      (finding) => finding.type === "TOKEN" && finding.raw === "ghp_exampletokentest123456789"
    ),
    "json accessToken should detect ghp tokens even when they contain an example segment"
  );
  assert.ok(
    findings.some(
      (finding) => finding.type === "TOKEN" && finding.raw === "gho_exampleoauthvalue123456789"
    ),
    "json sessionToken should detect gho tokens even when they contain an example segment"
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.type === "TOKEN" &&
        finding.raw === "github_pat_exampletokentest123456789ABCDE"
    ),
    "json token should detect github_pat values even when they contain an example segment"
  );
  assert.ok(
    !result.redactedText.includes("ghp_exampletokentest123456789") &&
      !result.redactedText.includes("gho_exampleoauthvalue123456789") &&
      !result.redactedText.includes("github_pat_exampletokentest123456789ABCDE"),
    "github token raws should not survive redaction in json fields"
  );
  assert.ok(
    result.redactedText.includes('"accessToken": "[PWM_1]"') ||
      result.redactedText.includes('"accessToken":"[PWM_1]"'),
    "accessToken should be replaced with a PWM placeholder"
  );
}

function testGithubExampleDocsTokensStillSuppressWhenObviouslyFake() {
  const detector = new Detector();
  const text = [
    '{ "accessToken": "example-token-for-docs-only" }',
    '{ "token": "ghp_placeholder_value" }',
    '{ "sessionToken": "changeme" }'
  ].join("\n");

  const findings = detector.scan(text);

  assert.strictEqual(
    findings.length,
    0,
    "obvious docs placeholders in json token fields should still suppress"
  );
}

function testSyntheticCredentialHardeningBlock() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "OPENAI_API_KEY=sk-proj-A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0",
    "ANTHROPIC_API_KEY=sk-ant-api03-AlphaBetaGammaDelta1234567890uvwx",
    "STRIPE_SECRET_KEY=sk_live_51NqR7ZaBcDeFgHiJkLmNoPqRsTuVwXy123456",
    "STRIPE_WEBHOOK_SECRET=whsec_AbCdEfGhIjKlMnOpQrStUvWxYz123456",
    "GITHUB_TOKEN=ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3",
    "GITHUB_PAT=github_pat_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890",
    "GITLAB_TOKEN=glpat-1Ab2Cd3Ef4Gh5Ij6Kl7Mn8Op",
    "SLACK_BOT_TOKEN=xoxb-123456789012-123456789012-AbCdEfGhIjKlMnOpQr",
    "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T8NQ7M2LP/B8NQ7M2LP/AbCdEfGhIjKlMnOpQrStUvWx",
    "DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
    "SENDGRID_API_KEY=SG.QWxwaGFCZXRhR2FtbWExMjM0NTY3ODkw.QmV0YUdhbW1hRGVsdGFFcHNpbG9uMTIzNDU2Nzg5MEFCQ0RFRg",
    "GOOGLE_API_KEY=AIzaSyD4nQ7Lp2Vm5Xc8Rt1Bg4Hj7Km0Np3Qs6Tu9W",
    "GOOGLE_CLIENT_SECRET=GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
    "refresh_token=1//0xA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6",
    "Authorization: Bearer mF_9.B5f-4.1JqM2LmNoP3QrStUvWx",
    "Authorization: Basic bGVha2d1YXJkLXVuaXQ6U3VwZXJTZWNyZXQxMjMh",
    "JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJsZWFrZ3VhcmQiLCJzdWIiOiJzeW50aGV0aWMtdGVzdCIsInJvbGUiOiJhZG1pbiJ9.c2lnbmF0dXJlLXN5bnRoZXRpYy12YWx1ZS0xMjM0NTY3ODkw",
    "NPM_TOKEN=npm_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8",
    "PYPI_TOKEN=pypi-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-TOKENBLOCK",
    'docker={"auths":{"https://index.docker.io/v1/":{"auth":"bGVha2d1YXJkLXVuaXQ6U3VwZXJTZWNyZXQxMjMh"}}}',
    "Cookie: sessionid=ZXlKaGJHY2lPaUpJVXpJMU5pSjkuYWJjMTIzZGVmNDU2Z2hpNzg5amtsbW5vcA",
    'config={"apiKey":"sk-proj-Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3h2G1f0","dbPassword":"VaultHorse!2026!Unit","accessToken":"ghu_AbCdEfGhIjKlMnOpQrStUv","clientSecret":"TopSecretValue9988!"}',
    'databaseUrl="postgres://admin:UltraDbPass7788!@db.prod.internal:5432/app"',
    "MYSQL_URL=mysql://reporter:RoutePass8899!@mysql.ops.internal:3306/analytics",
    "AzureWebJobsStorage=DefaultEndpointsProtocol=https;AccountName=vaultstorage001;AccountKey=MDEyMzQ1Njc4OUFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW4=;EndpointSuffix=core.windows.net",
    "Endpoint=sb://prod-ingest.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=QWxwaGFCZXRhR2FtbWExMjM0NTY3ODkwQUJDREVGR0g=;EntityPath=events",
    "my password is HarborLock4455!",
    "my token is ghr_AbCdEfGhIjKlMnOpQrStUvWx",
    'Password → "QuotedLock5566!"',
    'Key → "sk-proj-Q1w2E3r4T5y6U7i8O9p0A1s2D3f4G5h6J7k8L9m0"',
    'secret "VaultAlias9988!"',
    "PUBLIC_URL=https://openai.com",
    "REGION=eu-central-1",
    "PLACEHOLDER_DOC=[PWM_42]",
    "DOCS_TOKEN=replace_me"
  ].join("\n");

  const findings = detector.scan(text);
  const result = redactor.redact(text, findings);

  const expectedFindings = [
    ["API_KEY", "sk-proj-A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0"],
    ["API_KEY", "sk-ant-api03-AlphaBetaGammaDelta1234567890uvwx"],
    ["API_KEY", "sk_live_51NqR7ZaBcDeFgHiJkLmNoPqRsTuVwXy123456"],
    ["SECRET", "whsec_AbCdEfGhIjKlMnOpQrStUvWxYz123456"],
    ["TOKEN", "ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3"],
    ["TOKEN", "github_pat_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"],
    ["TOKEN", "glpat-1Ab2Cd3Ef4Gh5Ij6Kl7Mn8Op"],
    ["TOKEN", "xoxb-123456789012-123456789012-AbCdEfGhIjKlMnOpQr"],
    ["WEBHOOK", "https://hooks.slack.com/services/T8NQ7M2LP/B8NQ7M2LP/AbCdEfGhIjKlMnOpQrStUvWx"],
    ["WEBHOOK", "https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"],
    ["API_KEY", "SG.QWxwaGFCZXRhR2FtbWExMjM0NTY3ODkw.QmV0YUdhbW1hRGVsdGFFcHNpbG9uMTIzNDU2Nzg5MEFCQ0RFRg"],
    ["API_KEY", "AIzaSyD4nQ7Lp2Vm5Xc8Rt1Bg4Hj7Km0Np3Qs6Tu9W"],
    ["SECRET", "GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"],
    ["TOKEN", "1//0xA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6"],
    ["TOKEN", "mF_9.B5f-4.1JqM2LmNoP3QrStUvWx"],
    ["TOKEN", "bGVha2d1YXJkLXVuaXQ6U3VwZXJTZWNyZXQxMjMh"],
    ["TOKEN", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJsZWFrZ3VhcmQiLCJzdWIiOiJzeW50aGV0aWMtdGVzdCIsInJvbGUiOiJhZG1pbiJ9.c2lnbmF0dXJlLXN5bnRoZXRpYy12YWx1ZS0xMjM0NTY3ODkw"],
    ["TOKEN", "npm_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"],
    ["TOKEN", "pypi-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-TOKENBLOCK"],
    ["TOKEN", "ZXlKaGJHY2lPaUpJVXpJMU5pSjkuYWJjMTIzZGVmNDU2Z2hpNzg5amtsbW5vcA"],
    ["PASSWORD", "VaultHorse!2026!Unit"],
    ["TOKEN", "ghu_AbCdEfGhIjKlMnOpQrStUv"],
    ["SECRET", "TopSecretValue9988!"],
    ["DB_URI", "UltraDbPass7788!"],
    ["DB_URI", "RoutePass8899!"],
    ["CONNECTION_STRING", "DefaultEndpointsProtocol=https;AccountName=vaultstorage001;AccountKey=MDEyMzQ1Njc4OUFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW4=;EndpointSuffix=core.windows.net"],
    ["CONNECTION_STRING", "Endpoint=sb://prod-ingest.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=QWxwaGFCZXRhR2FtbWExMjM0NTY3ODkwQUJDREVGR0g=;EntityPath=events"],
    ["PASSWORD", "HarborLock4455!"],
    ["TOKEN", "ghr_AbCdEfGhIjKlMnOpQrStUvWx"],
    ["PASSWORD", "QuotedLock5566!"],
    ["API_KEY", "sk-proj-Q1w2E3r4T5y6U7i8O9p0A1s2D3f4G5h6J7k8L9m0"],
    ["SECRET", "VaultAlias9988!"]
  ];

  for (const [type, raw] of expectedFindings) {
    assert.ok(
      findings.some((finding) => finding.type === type && finding.raw === raw),
      `synthetic hardening block should detect ${type} value: ${raw}`
    );
    assert.strictEqual(
      result.redactedText.includes(raw),
      false,
      `synthetic hardening block should redact raw value: ${raw}`
    );
  }

  assert.ok(
    /databaseUrl="postgres:\/\/\[PWM_\d+\]:\[PWM_\d+\]@db\.prod\.internal:5432\/app"/.test(result.redactedText),
    "databaseUrl should keep its URI structure while masking username and password"
  );
  assert.ok(
    /MYSQL_URL=mysql:\/\/\[PWM_\d+\]:\[PWM_\d+\]@mysql\.ops\.internal:3306\/analytics/.test(
      result.redactedText
    ),
    "MYSQL_URL should keep its URI structure while masking username and password"
  );
  assert.ok(result.redactedText.includes("PUBLIC_URL=https://openai.com"), "safe public URLs should stay visible");
  assert.ok(result.redactedText.includes("REGION=eu-central-1"), "regions should stay visible");
  assert.ok(result.redactedText.includes("PLACEHOLDER_DOC=[PWM_42]"), "visible placeholders should stay visible");
  assert.ok(result.redactedText.includes("DOCS_TOKEN=replace_me"), "obvious docs placeholders should stay visible");
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

function testTechnicalPathAndProseFalsePositivesStayVisible() {
  const detector = new Detector();
  const cases = [
    "Path: /home/wayland/Desktop/Development/portable-work-memory/tests/fixtures.json",
    "See [patterns.js](/home/user/project/src/shared/patterns.js) and [content.js](/home/user/project/src/content/content.js).",
    "Normal changelog: updated package.json, tests/fixtures.json, and typed_interception.test.js",
    "Use typed_interception.test.js and tests/fixtures.json when reviewing detector coverage.",
    "Twilio/Mailchimp-style plain hex assignment guesses should stay visible in prose."
  ];

  for (const text of cases) {
    const findings = detector.scan(text);
    assert.strictEqual(findings.length, 0, `technical text should stay visible: ${text}`);
  }
}

function testUnsupportedVendorPlainHexAssignmentsStayVisible() {
  const detector = new Detector();
  const cases = [
    "TWILIO_AUTH_TOKEN=abcdef1234567890abcdef1234567890",
    "MAILCHIMP_API_KEY=0123456789abcdef0123456789abcdef-us1"
  ];

  for (const text of cases) {
    const findings = detector.scan(text);
    assert.strictEqual(
      findings.length,
      0,
      `unsupported vendor plain-hex assignment should not trigger generic detection: ${text}`
    );
  }
}

function testRevealStateLookupUnit() {
  const manager = new PlaceholderManager();
  const placeholder = manager.getPlaceholder("real-session-value-1234567890", "TOKEN");
  const state = manager.exportPrivateState();

  const freshManager = new PlaceholderManager();
  freshManager.setPrivateState(state);

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

function testPlaceholderFormatIsGeneric() {
  const manager = new PlaceholderManager();
  const first = manager.getPlaceholder("alpha-secret", "PASSWORD");
  const second = manager.getPlaceholder("beta-secret", "API_KEY");

  assert.strictEqual(first, "[PWM_1]", "first placeholder should use the neutral PWM prefix");
  assert.strictEqual(second, "[PWM_2]", "placeholder numbering should be global and neutral");
}

function testPublicStateOmitsRawMappings() {
  const manager = new PlaceholderManager();
  const placeholder = manager.getPlaceholder("ultra-sensitive-value", "TOKEN");
  const publicState = manager.exportPublicState();
  const publicStateJson = JSON.stringify(publicState);
  const publicManager = new PlaceholderManager();

  publicManager.setPublicState(publicState);

  assert.deepStrictEqual(
    Object.keys(publicState).sort(),
    ["counters", "knownPlaceholders", "sessionId"],
    "public state should expose only sanitized fields"
  );
  assert.deepStrictEqual(publicState.knownPlaceholders, [placeholder]);
  assert.strictEqual(publicStateJson.includes("ultra-sensitive-value"), false, "public state must not contain raw values");
  assert.strictEqual(publicStateJson.includes("secretByFingerprint"), false, "public state must not expose private maps");
  assert.strictEqual(publicManager.getRaw(placeholder), null, "public state rehydration must not recover raw values");
}

function testExactMixedLegacyPlaceholderInputDoesNotReemitTypedTokens() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = [
    "API_KEY=[API_KEY_1]",
    "DB_PASSWORD=[PASSWORD_2]",
    "TOKEN=[TOKEN_1]",
    "AWS_SECRET_ACCESS_KEY=[AWS_SECRET_KEY_1]",
    "OPENAI_API_KEY=sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555"
  ].join("\n");

  const normalizedInput = normalizeVisiblePlaceholders(text);
  const findings = detector.scan(normalizedInput);
  const result = redactor.redact(normalizedInput, findings);
  const lines = result.redactedText.split("\n");

  assertNoTypedPlaceholders(result.redactedText, "mixed legacy placeholder input must never re-emit typed placeholders");
  assert.ok(/^API_KEY=\[PWM_\d+\]$/.test(lines[0]), "unknown legacy API key placeholder should redact");
  assert.ok(/^DB_PASSWORD=\[PWM_\d+\]$/.test(lines[1]), "unknown legacy password placeholder should redact");
  assert.ok(/^TOKEN=\[PWM_\d+\]$/.test(lines[2]), "unknown legacy token placeholder should redact");
  assert.ok(
    /^AWS_SECRET_ACCESS_KEY=\[PWM_\d+\]$/.test(lines[3]),
    "unknown legacy AWS secret placeholder should redact"
  );
  assert.strictEqual(
    result.redactedText.includes(canonicalizePlaceholderToken("[API_KEY_1]")),
    false,
    "unknown canonicalized legacy placeholders must not remain visible"
  );
  assert.ok(
    /\[PWM_\d+\]/.test(result.redactedText),
    "redacted output should continue to use PWM placeholders"
  );
}

function testStandaloneBarePasswordHeuristicRedactsHighConfidenceValue() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = "HarborLock4455!";
  const findings = detector.scan(text);
  const passwordFinding = findings.find((finding) => finding.raw === text);
  const result = redactor.redact(text, findings);

  assert.ok(passwordFinding, "standalone password-like value should be detected");
  assert.strictEqual(passwordFinding.type, "PASSWORD");
  assert.strictEqual(passwordFinding.severity, "high");
  assert.ok(
    passwordFinding.method.includes("bare-password"),
    "standalone password-like value should be marked as a bare-password heuristic"
  );
  assert.strictEqual(result.redactedText, "[PWM_1]", "standalone password-like value should redact cleanly");
}

function testStandaloneSecretKeywordPasswordRedactsHighConfidenceValue() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = "secret1234";
  const findings = detector.scan(text);
  const passwordFinding = findings.find((finding) => finding.raw === text);
  const result = redactor.redact(text, findings);

  assert.ok(passwordFinding, "secret-prefixed password-like value should be detected");
  assert.strictEqual(passwordFinding.type, "PASSWORD");
  assert.strictEqual(passwordFinding.severity, "high");
  assert.ok(passwordFinding.method.includes("bare-password"));
  assert.strictEqual(result.redactedText, "[PWM_1]", "secret-prefixed password-like value should redact cleanly");
}

function testNaturalLanguageSecretRedactsCredentialLikeValue() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);
  const text = "my secret is petrit123";
  const findings = detector.scan(text);
  const secretFinding = findings.find((finding) => finding.raw === "petrit123");
  const result = redactor.redact(text, findings);

  assert.ok(secretFinding, "natural-language secret value should be detected");
  assert.strictEqual(secretFinding.type, "SECRET");
  assert.strictEqual(
    secretFinding.severity,
    "high",
    "explicit natural-language secret disclosures should auto-redact"
  );
  assert.ok(
    secretFinding.method.includes("pattern") || secretFinding.method.includes("natural-language")
  );
  assert.strictEqual(
    result.redactedText,
    "my secret is [PWM_1]",
    "natural-language secret value should redact without changing surrounding prose"
  );
}

function testPlaceholderSuffixSecretRedactsOnlyAppendedMaterial() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  manager.trackKnownPlaceholder("[PWM_2]");
  const redactor = new Redactor(manager);
  const text = "my password is [PWM_2]45123412341324123";
  const findings = detector.scan(text, { manager });
  const suffixFinding = findings.find((finding) => finding.raw === "45123412341324123");
  const result = redactor.redact(text, findings);

  assert.ok(suffixFinding, "secret-like material appended to a placeholder should be detected");
  assert.strictEqual(suffixFinding.type, "SECRET");
  assert.strictEqual(suffixFinding.severity, "high");
  assert.ok(suffixFinding.method.includes("placeholder-suffix"));
  assert.strictEqual(
    result.redactedText,
    "my password is [PWM_2][PWM_3]",
    "existing placeholder should stay while appended secret material is redacted separately"
  );
}

function testStandaloneBenignBuildLabelStaysVisible() {
  const detector = new Detector();
  const text = "release-2026-04-24";
  const findings = detector.scan(text);

  assert.strictEqual(findings.length, 0, "harmless build/version labels should not be treated as passwords");
}

function testUsernameAndEmailAssignmentsStayMediumConfidence() {
  const detector = new Detector();
  const text = ["username=wayland.dev", "email=wayland.dev@corp.internal"].join("\n");
  const findings = detector.scan(text);
  const usernameFinding = findings.find((finding) => finding.type === "USERNAME");
  const emailFinding = findings.find((finding) => finding.type === "EMAIL");

  assert.ok(usernameFinding, "username assignment should surface as a contextual identity finding");
  assert.ok(emailFinding, "email assignment should surface as a contextual identity finding");
  assert.strictEqual(usernameFinding.severity, "medium", "username assignments should warn before they auto-redact");
  assert.strictEqual(emailFinding.severity, "medium", "email assignments should warn before they auto-redact");
  assert.ok(usernameFinding.method.includes("identity"));
  assert.ok(emailFinding.method.includes("identity"));
}

function run() {
  testPatternMetadata();
  testPositiveFixtures();
  testNegativeExamples();
  testProviderTokenFamiliesDetectAndRedact();
  testProviderTokenShortAndTemplateValuesStayVisible();
  testMixedGitlabRedactionKeepsConfigReadable();
  testLegacyPlaceholderNormalizationHelper();
  testRepeatedSameSecret();
  testRepeatedAwsAccessKeyWithExampleSubstringStillRedactsAndReusesPlaceholder();
  testRepeatedDifferentSecretsSameType();
  testMultilineDifferentPasswords();
  testMultilineRepeatedPassword();
  testRegressionMixedMultilineSecrets();
  testAwsSessionTokenStillRedactsAfterOtherAwsValuesAreAlreadyPlaceholderized();
  testExistingVisiblePlaceholdersDoNotCollideWithNewSecretAssignments();
  testPositiveCredentialFixturesStillRedactWithExistingPlaceholdersInText();
  testDbUriWithCredentials();
  testFullValueReplacementForConnectionStyleAssignments();
  testGenericBasicAuthUrl();
  testOverlapBearerVsJwt();
  testAuthorizationBearerVariants();
  testBasicAuthAssignmentVariants();
  testOverlappingMatchesPreferSinglePemBlock();
  testAllowlist();
  testExampleValuesDoNotTrigger();
  testExplicitAssignmentsStillRedactWhenAdjacentLinesContainExampleLikeValues();
  testAwsSecretAssignmentWithExamplePrefixStillFailsClosedButDocsPlaceholderStaysVisible();
  testConcatenatedPlaceholderAssignmentsDoNotCreateCompositeFalsePositives();
  testUserStressEdgeCasesRedactSecretsButKeepSafeLiterals();
  testInlineStructuredAssignmentsStillMatchAfterEarlierInlineAssignments();
  testPartiallyRedactedOutputDoesNotRetriggerBenignPlaceholderComposites();
  testPlaceholderValuesDoNotRetriggerDetection();
  testExpandedDetectorFamiliesMixedBlob();
  testGoogleApiKeyJsonRegression();
  testCompositePlaceholderAndNaturalLanguageEdgeCaseBlock();
  testMixedPlaceholderBlobPreservesKnownPlaceholdersAndRedactsRawLeaks();
  testFinalRegressionBlockKeepsTrailingNaturalLanguagePasswordRedacted();
  testNaturalLanguagePasswordVariants();
  testDatabaseUrlAssignmentKeepsUriButMasksOnlyPassword();
  testGithubJsonAccessTokenWithExampleSegmentStillRedacts();
  testGithubExampleDocsTokensStillSuppressWhenObviouslyFake();
  testSyntheticCredentialHardeningBlock();
  testSuppressionFamilies();
  testTechnicalPathAndProseFalsePositivesStayVisible();
  testUnsupportedVendorPlainHexAssignmentsStayVisible();
  testRevealStateLookupUnit();
  testPlaceholderFormatIsGeneric();
  testPublicStateOmitsRawMappings();
  testExactMixedLegacyPlaceholderInputDoesNotReemitTypedTokens();
  testStandaloneBarePasswordHeuristicRedactsHighConfidenceValue();
  testStandaloneSecretKeywordPasswordRedactsHighConfidenceValue();
  testNaturalLanguageSecretRedactsCredentialLikeValue();
  testPlaceholderSuffixSecretRedactsOnlyAppendedMaterial();
  testStandaloneBenignBuildLabelStaysVisible();
  testUsernameAndEmailAssignmentsStayMediumConfidence();

  console.log(
    `PASS ${fixtures.length} positive fixtures + metadata, suppression, multiline, and reveal regressions`
  );
}

run();
