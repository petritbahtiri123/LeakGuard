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
  "MSSQL_URL=sqlserver://sa:SqlServerPass123@sql.example.com:1433;databaseName=prod",
  "SQLSERVER_URL=sqlserver://app:SqlServerEnvPass456@sql.example.com:1433;databaseName=prod",
  "JDBC_URL=jdbc:sqlserver://host:1433;user=name;password=JdbcSqlPass123;databaseName=prod",
  "WEBHOOK_URL=https://webhook.invalid/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
  "SHARED_SECRET=SharedSecretValue1234567890",
  "secret=FAKELongAwsSecret1234567890abcdefFAKELONGLINE",
  "LONG_LINE_START openai=abc secret=FAKELongAwsSecret1234567890abcdefFAKELONGLINE stripe=xyz LONG_LINE_END",
  "LONG_LINE_START openai= github= db=postgres://:@long-db.example.com:5432/longapp aws= secret=FAKELongAwsSecret1234567890abcdefFAKELONGLINE stripe= ip=",
  "real_secret_after_placeholder=RealSecretValueAfterPlaceholder123",
  "token_limit=4096",
  "secret_santa=true",
  "secret_santa=office-game",
  'secret_santa="John gives gift to Anna"',
  "secret_santa_enabled=true",
  "password_hint=ask-admin",
  '"password_hint": "use a password manager",',
  'password_hint="Use long passwords"',
  "BENIGN_PASSWORD_HINT=use-a-password-manager",
  'github_username="petritbahtiri123"',
  'bearer_market="financial term"',
  'public_key_label="this is public, not private"',
  "DUPLICATE_CHECK_BEGIN_123456789",
  "DUPLICATE_CHECK_END_123456789",
  "LEAKGUARD_PERFORMANCE_TEST_END_MARKER_987654321",
  "api_version=2026-04-27",
  "region=eu-central-1",
  "version=1.2.3",
  "debug=true",
  "environment=production",
  "username=petrit",
  "public_url=https://example.com",
  "url=https://example.com",
  "this is not a password",
  "This text says use a password manager.",
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
  "authorization bearer AuthorizationBearer1234567890",
  'secret_note="this is my secret: admin-login-token-FAKE-1234567890"'
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
  assert.ok(
    /^LONG_LINE_START openai=abc secret=\[PWM_\d+\] stripe=xyz LONG_LINE_END$/m.test(
      transformedText
    ),
    "embedded long-line secret should redact without changing surrounding fields"
  );
  assert.ok(
    /^LONG_LINE_START openai= github= db=postgres:\/\/:@long-db\.example\.com:5432\/longapp aws= secret=\[PWM_\d+\] stripe= ip=$/m.test(
      transformedText
    ),
    "embedded long-line secret should redact after empty fields without changing surrounding fields"
  );
  assert.ok(
    /^secret_note="this is my secret: \[PWM_\d+\]"$/m.test(transformedText),
    "secret_note should redact only the inner token and preserve the closing quote"
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
      "SqlServerPass123",
      "SqlServerEnvPass456",
      "JdbcSqlPass123",
      "SharedSecretValue1234567890",
      "FAKELongAwsSecret1234567890abcdefFAKELONGLINE",
      "admin-login-token-FAKE-1234567890",
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
      "secret_santa=office-game",
      'secret_santa="John gives gift to Anna"',
      "secret_santa_enabled=true",
      "password_hint=ask-admin",
      '"password_hint": "use a password manager",',
      'password_hint="Use long passwords"',
      "BENIGN_PASSWORD_HINT=use-a-password-manager",
      'github_username="petritbahtiri123"',
      'bearer_market="financial term"',
      'public_key_label="this is public, not private"',
      "DUPLICATE_CHECK_BEGIN_123456789",
      "DUPLICATE_CHECK_END_123456789",
      "LEAKGUARD_PERFORMANCE_TEST_END_MARKER_987654321",
      "api_version=2026-04-27",
      "region=eu-central-1",
      "version=1.2.3",
      "debug=true",
      "environment=production",
      "public_url=https://example.com",
      "url=https://example.com",
      "this is not a password",
      "This text says use a password manager.",
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

function testFullCapabilityBreakPackV2() {
  const text = [
    "https://admin:AdminUrlPass2026@example.com/admin",
    "https://user:UrlSecretPass123@internal.example.com/path",
    "https://oauth2:GitUrlToken1234567890@gitlab.example.com/group/repo.git",
    "https://user:NpmRegistryPass123@registry.example.com/",
    "https://example.com/api",
    "https://example.com/oauth/callback",
    "username=admin",
    "user_name=admin",
    '"user": "admin"',
    '"username": "admin"',
    "Username: admin",
    "password_hint=ask-admin",
    "passw0rd=FakeStrongPass2026!",
    "pa$$word=FakeStrongPass2026!",
    "p@ssword=FakeStrongPass2026!",
    "passwd=FakeStrongPass2026!",
    "pwd=FakeStrongPass2026!",
    "secr3t=FakeSecret2026!",
    "tok3n=FakeToken2026!",
    "normal sentence says passw0rd is a typo",
    "token_limit=4096",
    "max_token_limit=8192",
    "api_version=2026-04-27",
    "secret_santa=true",
    "build_id=build-2026-04-27",
    "commit_sha=abcdef1234567890abcdef1234567890abcdef12",
    "image_tag=leakguard:2026.04",
    "release_id=rel-2026-04-27",
    "ticket_id=LG-1234",
    "jira_key=LG-5678",
    "trace_id=00-abcdef1234567890abcdef1234567890-abcdef1234567890-01",
    "existing placeholders [PWM_1] [PWM_2] [PWM_3]",
    "API_KEY=sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf",
    "API_KEY=sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf"
  ].join("\n");

  const detector = new Detector();
  const manager = new PlaceholderManager();
  const findings = detector.scan(text);
  const { redactedText } = new Redactor(manager).redact(text, findings);

  const adminPlaceholder = /^username=(\[PWM_\d+\])$/m.exec(redactedText)?.[1];
  const apiPlaceholder = /^API_KEY=(\[PWM_\d+\])$/m.exec(redactedText)?.[1];
  assert.ok(adminPlaceholder, "username assignment should redact");
  assert.ok(apiPlaceholder, "repeated API key should redact");

  assert.ok(
    redactedText.includes(`https://${adminPlaceholder}:`) &&
      /https:\/\/\[PWM_\d+\]:\[PWM_\d+\]@example\.com\/admin/.test(redactedText),
    "URL credentials should redact username and password while preserving URL structure"
  );
  assert.ok(
    /https:\/\/\[PWM_\d+\]:\[PWM_\d+\]@internal\.example\.com\/path/.test(redactedText),
    "internal URL credentials should preserve URL structure"
  );
  assert.ok(
    /https:\/\/\[PWM_\d+\]:\[PWM_\d+\]@gitlab\.example\.com\/group\/repo\.git/.test(redactedText),
    "git remote URL credentials should preserve URL structure"
  );
  assert.ok(
    /https:\/\/\[PWM_\d+\]:\[PWM_\d+\]@registry\.example\.com\//.test(redactedText),
    "registry URL credentials should preserve URL structure"
  );

  assertIncludesAll(
    redactedText,
    [
      "https://example.com/api",
      "https://example.com/oauth/callback",
      `password_hint=ask-${adminPlaceholder}`,
      "normal sentence says passw0rd is a typo",
      "token_limit=4096",
      "max_token_limit=8192",
      "api_version=2026-04-27",
      "secret_santa=true",
      "build_id=build-2026-04-27",
      "commit_sha=abcdef1234567890abcdef1234567890abcdef12",
      "image_tag=leakguard:2026.04",
      "release_id=rel-2026-04-27",
      "ticket_id=LG-1234",
      "jira_key=LG-5678",
      "trace_id=00-abcdef1234567890abcdef1234567890-abcdef1234567890-01",
      "existing placeholders [PWM_1] [PWM_2] [PWM_3]"
    ],
    "break pack v2"
  );

  assertExcludesAll(
    redactedText,
    [
      "AdminUrlPass2026",
      "UrlSecretPass123",
      "GitUrlToken1234567890",
      "NpmRegistryPass123",
      "FakeStrongPass2026!",
      "FakeSecret2026!",
      "FakeToken2026!",
      '"user": "admin"',
      '"username": "admin"',
      "Username: admin"
    ],
    "break pack v2"
  );

  assert.strictEqual(
    redactedText.split(`API_KEY=${apiPlaceholder}`).length - 1,
    2,
    "repeated API key should reuse one placeholder"
  );
  assert.ok(/^user_name=\[PWM_\d+\]$/m.test(redactedText), "user_name should redact");
  assert.ok(/"user": "\[PWM_\d+\]"/.test(redactedText), "JSON user should redact");
  assert.ok(/"username": "\[PWM_\d+\]"/.test(redactedText), "JSON username should redact");
  assert.ok(/^Username: \[PWM_\d+\]$/m.test(redactedText), "labelled Username should redact");
  assert.ok(/^passw0rd=\[PWM_\d+\]$/m.test(redactedText), "passw0rd alias should redact");
  assert.ok(/^pa\$\$word=\[PWM_\d+\]$/m.test(redactedText), "pa$$word alias should redact");
  assert.ok(/^p@ssword=\[PWM_\d+\]$/m.test(redactedText), "p@ssword alias should redact");
  assert.ok(/^passwd=\[PWM_\d+\]$/m.test(redactedText), "passwd alias should redact");
  assert.ok(/^pwd=\[PWM_\d+\]$/m.test(redactedText), "pwd alias should redact");
  assert.ok(/^secr3t=\[PWM_\d+\]$/m.test(redactedText), "secr3t alias should redact");
  assert.ok(/^tok3n=\[PWM_\d+\]$/m.test(redactedText), "tok3n alias should redact");
}

function redactSingleText(text) {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const findings = detector.scan(text);
  return new Redactor(manager).redact(text, findings).redactedText;
}

function redactTextWithManager(text, manager = new PlaceholderManager()) {
  const detector = new Detector();
  const findings = detector.scan(text, { manager });
  return {
    findings,
    result: new Redactor(manager).redact(text, findings),
    manager
  };
}

function testSensitiveHttpHeaderRedaction() {
  const xApiKey = redactSingleText("X-API-Key: ApiKeyHeader1234567890");
  assert.ok(/^X-API-Key: \[PWM_\d+\]$/.test(xApiKey), `unexpected X-API-Key redaction: ${xApiKey}`);
  assertExcludesAll(
    xApiKey,
    ["ApiKeyHeader1234567890", "ApiKey", "Header123", "1234567890"],
    "X-API-Key header"
  );

  const authorization = redactSingleText("Authorization: Bearer BearerToken1234567890");
  assert.ok(
    /^Authorization: Bearer \[PWM_\d+\]$/.test(authorization),
    `unexpected Authorization redaction: ${authorization}`
  );
  assertExcludesAll(authorization, ["BearerToken1234567890"], "Authorization header");

  const authToken = redactSingleText("X-Auth-Token: AuthToken1234567890");
  assert.ok(
    /^X-Auth-Token: \[PWM_\d+\]$/.test(authToken),
    `unexpected X-Auth-Token redaction: ${authToken}`
  );
  assertExcludesAll(authToken, ["AuthToken1234567890", "AuthToken"], "X-Auth-Token header");

  const subscriptionKey = redactSingleText("Ocp-Apim-Subscription-Key: SubKey1234567890");
  assert.ok(
    /^Ocp-Apim-Subscription-Key: \[PWM_\d+\]$/.test(subscriptionKey),
    `unexpected subscription key redaction: ${subscriptionKey}`
  );
  assertExcludesAll(
    subscriptionKey,
    ["SubKey1234567890", "SubKey"],
    "Ocp-Apim-Subscription-Key header"
  );

  const cookie = redactSingleText("Cookie: sessionid=SessionValue1234567890");
  assert.ok(
    /^Cookie: sessionid=\[PWM_\d+\]$/.test(cookie) || /^Cookie: \[PWM_\d+\]$/.test(cookie),
    `unexpected Cookie redaction: ${cookie}`
  );
  assertExcludesAll(cookie, ["SessionValue1234567890", "SessionValue"], "Cookie header");

  const setCookie = redactSingleText("Set-Cookie: auth_token=AuthCookieValue1234567890; HttpOnly");
  assert.ok(
    /^Set-Cookie: auth_token=\[PWM_\d+\]; HttpOnly$/.test(setCookie) ||
      /^Set-Cookie: \[PWM_\d+\]; HttpOnly$/.test(setCookie),
    `unexpected Set-Cookie redaction: ${setCookie}`
  );
  assertExcludesAll(setCookie, ["AuthCookieValue1234567890", "AuthCookieValue"], "Set-Cookie header");

  const safeHeaders = [
    "Content-Type: application/json",
    "Accept: application/json",
    "User-Agent: Mozilla/5.0",
    "Cache-Control: no-cache",
    "X-Request-ID: abcdef1234567890",
    "X-Trace-ID: 00-abcdef1234567890abcdef1234567890-abcdef1234567890-01"
  ].join("\n");
  assert.strictEqual(redactSingleText(safeHeaders), safeHeaders, "safe headers should stay unchanged");

  const existingPlaceholders = [
    "X-API-Key: [PWM_1]",
    "Authorization: Bearer [PWM_2]",
    "X-Auth-Token: AuthToken1234567890"
  ].join("\n");
  const placeholderManager = new PlaceholderManager();
  placeholderManager.trackKnownPlaceholder("[PWM_1]");
  placeholderManager.trackKnownPlaceholder("[PWM_2]");
  const placeholderDetector = new Detector();
  const placeholderFindings = placeholderDetector.scan(existingPlaceholders, {
    manager: placeholderManager
  });
  const placeholderOutput = new Redactor(placeholderManager).redact(
    existingPlaceholders,
    placeholderFindings
  ).redactedText;
  assert.ok(
    placeholderOutput.includes("X-API-Key: [PWM_1]"),
    "existing API key placeholder should be preserved"
  );
  assert.ok(
    placeholderOutput.includes("Authorization: Bearer [PWM_2]"),
    "existing Authorization placeholder should be preserved"
  );
  assert.ok(
    /^X-Auth-Token: \[PWM_\d+\]$/m.test(placeholderOutput),
    `new header token should redact after existing placeholders: ${placeholderOutput}`
  );
  assertExcludesAll(placeholderOutput, ["AuthToken1234567890"], "existing placeholder header text");
}

function testMultiSecretHttpHeaderPromptRedaction() {
  const text = [
    "Authorization: Bearer BearerToken1234567890",
    "Cookie: sessionid=SessionValue1234567890",
    "Set-Cookie: auth_token=AuthCookieValue1234567890; HttpOnly",
    "X-API-Key: ApiKeyHeader1234567890"
  ].join("\n");
  const { findings, result, manager } = redactTextWithManager(text);
  const redactedText = result.redactedText;

  assert.ok(
    /^Authorization: Bearer \[PWM_\d+\]$/m.test(redactedText),
    `Authorization should preserve Bearer and redact only token: ${redactedText}`
  );
  assert.ok(
    /^Cookie: sessionid=\[PWM_\d+\]$/m.test(redactedText) ||
      /^Cookie: \[PWM_\d+\]$/m.test(redactedText),
    `Cookie should not leak session value: ${redactedText}`
  );
  assert.ok(
    /^Set-Cookie: auth_token=\[PWM_\d+\]; HttpOnly$/m.test(redactedText) ||
      /^Set-Cookie: \[PWM_\d+\]; HttpOnly$/m.test(redactedText),
    `Set-Cookie should not leak auth cookie value: ${redactedText}`
  );
  assert.ok(
    /^X-API-Key: \[PWM_\d+\]$/m.test(redactedText),
    `X-API-Key should redact the full header value: ${redactedText}`
  );
  assertExcludesAll(
    redactedText,
    [
      "BearerToken1234567890",
      "SessionValue1234567890",
      "AuthCookieValue1234567890",
      "ApiKeyHeader1234567890"
    ],
    "multi sensitive header prompt"
  );
  assert.strictEqual(redactedText.includes("X-API-Key: ApiKey[PWM_"), false);
  assert.strictEqual(redactedText.includes("Header123"), false);

  const transformed = transformOutboundPrompt(text, {
    manager,
    findings,
    mode: "hide_public"
  }).redactedText;
  assert.strictEqual(transformed, redactedText, "transform should reuse the same full-range replacements");
}

function testRepeatedHttpHeaderSecretReusesPlaceholder() {
  const text = [
    "X-API-Key: ApiKeyHeader1234567890",
    "API-Key: ApiKeyHeader1234567890"
  ].join("\n");
  const { result } = redactTextWithManager(text);
  const placeholders = result.redactedText.match(/\[PWM_\d+\]/g) || [];

  assert.strictEqual(placeholders.length, 2, "both repeated header values should redact");
  assert.strictEqual(new Set(placeholders).size, 1, "same raw header secret should reuse one placeholder");
  assertExcludesAll(
    result.redactedText,
    ["ApiKeyHeader1234567890", "ApiKey", "Header123"],
    "repeated header secret"
  );
}

function testRepeatedHeaderSecretReusesPlaceholderInLabelledText() {
  const text = [
    "X-API-Key: ApiKeyHeader1234567890",
    "X-API-Key: ApiKeyHeader1234567890",
    "Again same key: ApiKeyHeader1234567890",
    "Plain repeat: ApiKeyHeader1234567890"
  ].join("\n");
  const { findings, result, manager } = redactTextWithManager(text);
  const redactedText = result.redactedText;
  const placeholders = redactedText.match(/\[PWM_\d+\]/g) || [];

  assert.strictEqual(placeholders.length, 4, "all repeated raw key values should redact");
  assert.strictEqual(new Set(placeholders).size, 1, "same raw key should reuse one placeholder");
  assert.ok(/^X-API-Key: \[PWM_\d+\]$/m.test(redactedText), "first header value should redact");
  assert.ok(/^Again same key: \[PWM_\d+\]$/m.test(redactedText), "labelled repeat should redact");
  assert.ok(/^Plain repeat: \[PWM_\d+\]$/m.test(redactedText), "known raw repeat should redact");
  assertExcludesAll(
    redactedText,
    ["ApiKeyHeader1234567890", "ApiKey", "Header1234567890", "ApiKey[PWM_", "[PWM_]Header123"],
    "labelled repeated header secret"
  );

  const transformed = transformOutboundPrompt(text, {
    manager,
    findings,
    mode: "hide_public"
  }).redactedText;
  assert.strictEqual(transformed, redactedText, "transform should reuse full known raw key values");
}

function testSameLabelledSecretValuesRedactFully() {
  const safeLines = [
    "password policy is strong",
    "token_limit=4096",
    "secret_santa=Michael",
    "api_version=v1",
    "Content-Type: application/json",
    "X-Request-ID: abcdef1234567890"
  ];
  const text = [
    "Again same token: TokenValue1234567890",
    "Again same password: MyP@ssw0rd123",
    "Again same secret: SecretValue1234567890",
    ...safeLines
  ].join("\n");
  const { result } = redactTextWithManager(text);
  const redactedText = result.redactedText;

  assert.ok(/^Again same token: \[PWM_\d+\]$/m.test(redactedText), "token label should redact full value");
  assert.ok(
    /^Again same password: \[PWM_\d+\]$/m.test(redactedText),
    "password label should redact full value"
  );
  assert.ok(/^Again same secret: \[PWM_\d+\]$/m.test(redactedText), "secret label should redact full value");
  assertExcludesAll(
    redactedText,
    [
      "TokenValue1234567890",
      "TokenValue",
      "MyP@ssw0rd123",
      "P@ssw0rd123",
      "SecretValue1234567890",
      "SecretValue"
    ],
    "same labelled secret values"
  );
  assertIncludesAll(redactedText, safeLines, "same labelled safe lines");
}

function testTrustedHeaderPlaceholdersAndRawSuffixes() {
  const trustedManager = new PlaceholderManager();
  trustedManager.trackKnownPlaceholder("[PWM_1]");
  trustedManager.trackKnownPlaceholder("[PWM_2]");
  const trustedText = [
    "X-API-Key: [PWM_1]",
    "Authorization: Bearer [PWM_2]"
  ].join("\n");
  const trusted = redactTextWithManager(trustedText, trustedManager).result.redactedText;

  assert.strictEqual(trusted, trustedText, "trusted header placeholders should remain unchanged");

  const tailText = "X-API-Key: [PWM_1]Header1234567890";
  const untrustedTail = redactTextWithManager(tailText).result.redactedText;
  assert.strictEqual(untrustedTail.includes("Header1234567890"), false);
  assert.strictEqual(untrustedTail.includes("[PWM_1]Header"), false);

  const manager = new PlaceholderManager();
  manager.trackKnownPlaceholder("[PWM_1]");
  const trustedTail = redactTextWithManager(tailText, manager).result.redactedText;
  assert.ok(trustedTail.includes("X-API-Key: [PWM_1]"), "trusted prefix placeholder should stay");
  assert.strictEqual(trustedTail.includes("Header1234567890"), false);
}

function assertUrlCredentialsRedactWithLastAt({ input, expectedRegex, forbidden }) {
  const redactedText = redactSingleText(input);

  assert.ok(expectedRegex.test(redactedText), `unexpected URL redaction: ${redactedText}`);
  assertExcludesAll(redactedText, forbidden, input);
}

function testUrlCredentialPasswordsCanContainRawAtSigns() {
  assertUrlCredentialsRedactWithLastAt({
    input: "postgres://admin:p@ssw0rd123@db.internal:5432/app",
    expectedRegex: /^postgres:\/\/\[PWM_\d+\]:\[PWM_\d+\]@db\.internal:5432\/app$/,
    forbidden: ["admin", "p@ssw0rd123", "@ssw0rd123"]
  });

  assertUrlCredentialsRedactWithLastAt({
    input: "mysql://reporter:Report@Pass123@mysql.internal:3306/analytics",
    expectedRegex: /^mysql:\/\/\[PWM_\d+\]:\[PWM_\d+\]@mysql\.internal:3306\/analytics$/,
    forbidden: ["reporter", "Report@Pass123", "@Pass123"]
  });

  assertUrlCredentialsRedactWithLastAt({
    input: "https://user:P@ssw0rd!@example.com/path",
    expectedRegex: /^https:\/\/\[PWM_\d+\]:\[PWM_\d+\]@example\.com\/path$/,
    forbidden: ["user", "P@ssw0rd!", "@ssw0rd!"]
  });

  assertUrlCredentialsRedactWithLastAt({
    input: "ftp://admin:S3cret@123@files.example.com",
    expectedRegex: /^ftp:\/\/\[PWM_\d+\]:\[PWM_\d+\]@files\.example\.com$/,
    forbidden: ["admin", "S3cret@123", "@123"]
  });
}

function testUrlCredentialParserLeavesSafeUrlShapesAlone() {
  assert.strictEqual(redactSingleText("https://example.com/path"), "https://example.com/path");
  assert.strictEqual(
    redactSingleText("https://user@example.com/path"),
    "https://user@example.com/path"
  );
  assert.strictEqual(
    redactSingleText("postgres://[PWM_1]:[PWM_2]@db.internal:5432/app"),
    "postgres://[PWM_1]:[PWM_2]@db.internal:5432/app"
  );
}

function testBrokenPlaceholderUrlTailDoesNotLeakFurther() {
  const redactedText = redactSingleText(
    "postgres://[PWM_1]:[PWM_2]@ssw0rd123@db.internal:5432/app"
  );

  assert.strictEqual(redactedText.includes("@ssw0rd123"), false);
  assert.strictEqual(redactedText.includes("ssw0rd123"), false);
  assert.ok(
    /^postgres:\/\/\[PWM_1\]:\[PWM_2\](?:@\[PWM_\d+\]|\[PWM_\d+\])@db\.internal:5432\/app$/.test(
      redactedText
    ),
    `broken placeholder URL should redact only the raw tail: ${redactedText}`
  );
}

function testTransformDoesNotReuseUrlUsernamesOutsideCredentialRanges() {
  const text = [
    '"readonlyUrl": "postgres://readonly:ReadonlyPassword123@readonly.example.com:5432/app"',
    "ELASTIC_URL=https://elastic:ElasticPass123@elastic.example.com:9200",
    'password_hint="Use long passwords"',
    "BENIGN_PASSWORD_HINT=use-a-password-manager",
    'github_username="petritbahtiri123"',
    "DUPLICATE_CHECK_BEGIN_123456789",
    "DUPLICATE_CHECK_END_123456789",
    "LEAKGUARD_PERFORMANCE_TEST_END_MARKER_987654321",
    "secret=FAKELongAwsSecret1234567890abcdefFAKELONGLINE"
  ].join("\n");
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const findings = detector.scan(text, { manager });
  const redactedText = transformOutboundPrompt(text, {
    manager,
    findings,
    mode: "hide_public"
  }).redactedText;

  assert.ok(
    /"readonlyUrl": "postgres:\/\/\[PWM_\d+\]:\[PWM_\d+\]@readonly\.example\.com:5432\/app"/.test(
      redactedText
    ),
    `readonly URL syntax or host was corrupted: ${redactedText}`
  );
  assert.ok(
    /^ELASTIC_URL=https:\/\/\[PWM_\d+\]:\[PWM_\d+\]@elastic\.example\.com:9200$/m.test(redactedText),
    `elastic URL syntax or host was corrupted: ${redactedText}`
  );
  assert.ok(/^secret=\[PWM_\d+\]$/m.test(redactedText), "generic long-line secret should redact");
  assertExcludesAll(redactedText, ["ReadonlyPassword123", "ElasticPass123", "FAKELongAwsSecret1234567890abcdefFAKELONGLINE"], "URL reuse regression");
  assertIncludesAll(
    redactedText,
    [
      'password_hint="Use long passwords"',
      "BENIGN_PASSWORD_HINT=use-a-password-manager",
      'github_username="petritbahtiri123"',
      "DUPLICATE_CHECK_BEGIN_123456789",
      "DUPLICATE_CHECK_END_123456789",
      "LEAKGUARD_PERFORMANCE_TEST_END_MARKER_987654321"
    ],
    "URL reuse regression safe controls"
  );
  assert.strictEqual(redactedText.includes('"[PWM_'), false, "JSON key must not be placeholderized");
  assert.strictEqual(redactedText.includes("@[PWM_"), false, "host prefix must not be placeholderized");
}

testBreakPackRedactionAndSafeLines();
testFullCapabilityBreakPackV2();
testSensitiveHttpHeaderRedaction();
testMultiSecretHttpHeaderPromptRedaction();
testRepeatedHttpHeaderSecretReusesPlaceholder();
testRepeatedHeaderSecretReusesPlaceholderInLabelledText();
testSameLabelledSecretValuesRedactFully();
testTrustedHeaderPlaceholdersAndRawSuffixes();
testUrlCredentialPasswordsCanContainRawAtSigns();
testUrlCredentialParserLeavesSafeUrlShapesAlone();
testBrokenPlaceholderUrlTailDoesNotLeakFurther();
testTransformDoesNotReuseUrlUsernamesOutsideCredentialRanges();
console.log("PASS LeakGuard break-test redaction pack");
