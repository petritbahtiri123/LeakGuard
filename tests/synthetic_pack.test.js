const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "shared/placeholders.js"));
require(path.join(repoRoot, "shared/entropy.js"));
require(path.join(repoRoot, "shared/patterns.js"));
require(path.join(repoRoot, "shared/detector.js"));
require(path.join(repoRoot, "shared/redactor.js"));
require(path.join(repoRoot, "shared/ipClassification.js"));
require(path.join(repoRoot, "shared/ipDetection.js"));
require(path.join(repoRoot, "shared/networkHierarchy.js"));
require(path.join(repoRoot, "shared/placeholderAllocator.js"));
require(path.join(repoRoot, "shared/sessionMapStore.js"));
require(path.join(repoRoot, "shared/transformOutboundPrompt.js"));

const {
  Detector,
  PlaceholderManager,
  Redactor,
  transformOutboundPrompt
} = globalThis.PWM;

function redact(text) {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const findings = detector.scan(text);
  const result = new Redactor(manager).redact(text, findings);
  return { findings, result };
}

function transform(text, findings, mode = "hide_public") {
  return transformOutboundPrompt(text, {
    manager: new PlaceholderManager(),
    findings,
    mode
  });
}

function assertForbiddenOutput(output, forbidden, label) {
  for (const raw of forbidden) {
    assert.strictEqual(
      output.includes(raw),
      false,
      `${label}: raw value survived redaction: ${raw}`
    );
  }
}

function assertPreservedOutput(output, preserved, label) {
  for (const raw of preserved) {
    assert.ok(output.includes(raw), `${label}: expected safe value to stay visible: ${raw}`);
  }
}

function testRepeatedReuseAndDistinctMapping() {
  const text = [
    "OPENAI_API_KEY=sk-test-OPENAI-ALPHA-1234567890",
    "mirror=sk-test-OPENAI-ALPHA-1234567890",
    "AAA_SECRET=alpha_secret_value_123456789",
    "BBB_SECRET=beta_secret_value_987654321",
    "AAA_MIRROR=alpha_secret_value_123456789",
    "BBB_MIRROR=beta_secret_value_987654321"
  ].join("\n");

  const { findings, result } = redact(text);
  const lines = result.redactedText.split("\n");
  const placeholders = result.redactedText.match(/\[PWM_\d+\]/g) || [];

  assert.ok(findings.length >= 6, "repeated secret forms should all be detected");
  assert.strictEqual(lines[0], lines[1].replace("mirror", "OPENAI_API_KEY"));
  assert.strictEqual(lines[2].split("=")[1], lines[4].split("=")[1]);
  assert.strictEqual(lines[3].split("=")[1], lines[5].split("=")[1]);
  assert.notStrictEqual(lines[2].split("=")[1], lines[3].split("=")[1]);
  assert.strictEqual(new Set(placeholders).size >= 3, true, "distinct secrets should not collapse");
}

function testCloudCredentialFamilies() {
  const text = [
    "AWS_ACCESS_KEY_ID=AKIAQTESTEXAMPLE1234",
    "AWS_SECRET_ACCESS_KEY=awsSecretExampleValue1234567890AbCdEf",
    "AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjEJr//////////wEaCXVzLWVhc3QtMSJGMEQCIGLeakGuardSessionValue1234567890abcdefghijklmnop",
    "AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=leakguardsynthetic;AccountKey=LeakGuardAzureStorageKey1234567890abcdefghijklmnop==;EndpointSuffix=core.windows.net",
    "GOOGLE_API_KEY=AIzaSyD-LEAKGUARD-KEY-1234567890ABCDEFG",
    'GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASC_leakguard_key_material_only_1234567890\\n-----END PRIVATE KEY-----\\n"',
    "CLOUDFLARE_API_TOKEN=cfpat_LeakGuardCloudflareToken_1234567890abcdef",
    "DIGITALOCEAN_TOKEN=dop_v1_leakguard_digitalocean_token_1234567890",
    "GITHUB_TOKEN=ghp_leakguardGithubPersonalAccessToken1234567890",
    "GITLAB_TOKEN=glpat-leakguardGitLabAccessToken1234567890"
  ].join("\n");

  const { findings, result } = redact(text);

  assert.ok(findings.some((finding) => finding.type === "AWS_KEY"), "AWS access key should detect");
  assert.ok(findings.some((finding) => finding.type === "AWS_SECRET_KEY"), "AWS secret should detect");
  assert.ok(findings.some((finding) => finding.type === "CONNECTION_STRING"), "Azure connection string should detect");
  assert.ok(findings.some((finding) => finding.type === "PRIVATE_KEY"), "private key block should detect");
  assert.ok(findings.some((finding) => finding.raw.includes("ghp_")), "GitHub token should detect");
  assertForbiddenOutput(
    result.redactedText,
    [
      "AKIAQTESTEXAMPLE1234",
      "awsSecretExampleValue1234567890AbCdEf",
      "LeakGuardAzureStorageKey1234567890abcdefghijklmnop==",
      "ghp_leakguardGithubPersonalAccessToken1234567890"
    ],
    "cloud credential families"
  );
}

function testAuthHeadersCookiesAndUrls() {
  const text = [
    "Authorization: Bearer LeakGuardBearerToken_1234567890_abcdefghijklmnopqrstuvwxyz",
    "Authorization: Basic bGVha2d1YXJkOnN5bnRoZXRpY1Bhc3MxMjMh",
    "Cookie: sessionid=LeakGuardSessionCookie1234567890abcdef; auth_token=LeakGuardAuthToken0987654321; csrftoken=LeakGuardCsrfToken123456",
    "DATABASE_URL=postgres://appuser:LeakGuardPgPass123!@db.corp.internal:5432/leakguard",
    "MYSQL_URL=mysql://root:LeakGuardMysql456!@mysql.corp.internal:3306/appdb",
    "MONGO_URL=mongodb://mongoUser:LeakGuardMongo789!@mongo.corp.internal:27017/app",
    "REDIS_URL=redis://:LeakGuardRedis123!@redis.corp.internal:6379/0",
    "AMQP_URL=amqp://rabbitUser:LeakGuardRabbit456!@mq.corp.internal:5672/vhost",
    "SMTP_URL=smtp://mailer:LeakGuardMail789!@smtp.corp.internal:587",
    "PIP_INDEX_URL=https://pipuser:LeakGuardPipPass123!@pypi.corp.internal/simple",
    "https://svcuser:LeakGuardGitPass123!@git.corp.internal/repo.git"
  ].join("\n");

  const { findings, result } = redact(text);

  assert.ok(findings.some((finding) => finding.type === "TOKEN"), "auth headers and cookies should detect");
  assert.ok(
    findings.some((finding) => finding.type === "DB_URI" || finding.type === "CONNECTION_STRING"),
    "credential-bearing URLs should detect"
  );
  assertForbiddenOutput(
    result.redactedText,
    [
      "LeakGuardBearerToken_1234567890_abcdefghijklmnopqrstuvwxyz",
      "bGVha2d1YXJkOnN5bnRoZXRpY1Bhc3MxMjMh",
      "LeakGuardSessionCookie1234567890abcdef",
      "LeakGuardPgPass123!",
      "LeakGuardGitPass123!"
    ],
    "auth headers cookies and urls"
  );
}

function testStructuredConfigForms() {
  const text = [
    '{"apiKey":"json_leakguard_api_key_1234567890","clientSecret":"json_leakguard_client_secret_0987654321","refreshToken":"json_leakguard_refresh_token_abcdefghijklmnop","region":"eu-central-1","path":"/srv/app"}',
    "service:",
    "  api_key: yaml_leakguard_api_key_1234567890",
    "  secret_key: yaml_leakguard_secret_key_0987654321",
    "  refresh_token: yaml_leakguard_refresh_token_qwerty123456",
    "apiVersion: v1",
    "kind: Secret",
    "stringData:",
    "  password: LeakGuardK8sPassword123!",
    "  apiKey: LeakGuardK8sApiKey1234567890",
    "  clientSecret: LeakGuardK8sClientSecretABCDEF123456",
    "export API_KEY=LeakGuardShellApiKey1234567890",
    "export SECRET_KEY=LeakGuardShellSecretKey0987654321",
    "export ACCESS_TOKEN=LeakGuardShellAccessToken_qwertyuiop",
    "export DB_PASSWORD=LeakGuardShellDbPassword123!"
  ].join("\n");

  const { findings, result } = redact(text);

  assert.ok(findings.some((finding) => finding.raw === "json_leakguard_refresh_token_abcdefghijklmnop"));
  assert.ok(findings.some((finding) => finding.raw === "LeakGuardK8sApiKey1234567890"));
  assert.ok(findings.some((finding) => finding.raw === "LeakGuardK8sClientSecretABCDEF123456"));
  assertForbiddenOutput(
    result.redactedText,
    [
      "json_leakguard_api_key_1234567890",
      "json_leakguard_refresh_token_abcdefghijklmnop",
      "LeakGuardK8sApiKey1234567890",
      "LeakGuardShellDbPassword123!"
    ],
    "structured config forms"
  );
  assertPreservedOutput(result.redactedText, ["region\":\"eu-central-1", "/srv/app"], "structured config forms");
}

function testQueryParamsAndGenericSecretAssignments() {
  const text = [
    "https://api.corp.internal/data?api_key=QueryApiKey1234567890&token=QueryToken0987654321&region=eu-central-1",
    "MASTER_TOKEN=master_token_live_1234567890",
    "INTERNAL_SERVICE_SECRET=internal_service_secret_live_0987654321",
    "PROD_SIGNING_KEY=LeakGuardProdSigningKeyAbcdef123456",
    "BACKUP_ENCRYPTION_KEY=LeakGuardBackupEncryptionKeyQwerty123456"
  ].join("\n");

  const { findings, result } = redact(text);

  assert.ok(findings.some((finding) => finding.raw === "QueryApiKey1234567890"));
  assert.ok(findings.some((finding) => finding.raw === "QueryToken0987654321"));
  assertForbiddenOutput(
    result.redactedText,
    [
      "QueryApiKey1234567890",
      "QueryToken0987654321",
      "master_token_live_1234567890",
      "LeakGuardProdSigningKeyAbcdef123456"
    ],
    "query params and generic secret assignments"
  );
  assertPreservedOutput(result.redactedText, ["region=eu-central-1"], "query params and generic secret assignments");
}

function testPlaceholdersSafeValuesAndNetworkTransform() {
  const text = [
    "API_KEY=[PWM_1]",
    "DB_PASSWORD=[PWM_2]",
    "TOKEN=[PWM_3]",
    "version=1.2.3",
    "region=eu-central-1",
    "path=/opt/app/config",
    "local_ip=192.168.1.10",
    "private_subnet=10.0.0.0/24",
    "loopback=127.0.0.1",
    "hostname=devbox01",
    "url=https://example.com",
    "public_ip=8.8.8.8",
    "public_subnet=52.95.110.0/24"
  ].join("\n");

  const { findings, result } = redact(text);
  const transformed = transform(text, findings);

  assert.strictEqual(findings.length, 0, "already-redacted placeholders and safe literals should not create detector findings");
  assert.strictEqual(result.redactedText, text, "detector-side redaction should leave safe text untouched");
  assertPreservedOutput(
    transformed.redactedText,
    ["API_KEY=[PWM_1]", "version=1.2.3", "region=eu-central-1", "local_ip=192.168.1.10"],
    "placeholders safe values and network transform"
  );
  assert.ok(/\[PUB_HOST_\d+\]/.test(transformed.redactedText), "public host should transform");
  assert.ok(/\[NET_\d+\]/.test(transformed.redactedText), "public subnet should transform");
  assert.strictEqual(transformed.redactedText.includes("8.8.8.8"), false);
  assert.strictEqual(transformed.redactedText.includes("52.95.110.0/24"), false);
}

function testSyntheticMegaBlock() {
  const text = [
    "OPENAI_API_KEY=sk-test-OPENAI-ALPHA-1234567890",
    "mirror=sk-test-OPENAI-ALPHA-1234567890",
    "AWS_ACCESS_KEY_ID=AKIAQTESTEXAMPLE1234",
    "AWS_SECRET_ACCESS_KEY=awsSecretExampleValue1234567890AbCdEf",
    "TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.syntheticPayloadForLeakGuardTests.syntheticSignatureValue123456",
    "DATABASE_URL=postgres://appuser:LeakGuardPgPass123!@db.corp.internal:5432/leakguard",
    "Authorization: Bearer LeakGuardBearerToken_1234567890_abcdefghijklmnopqrstuvwxyz",
    "DB_PASSWORD=LeakGuardDbPassword123!",
    "apiKey: yaml_leakguard_api_key_1234567890",
    "private_ip=10.0.0.5",
    "local_ip=192.168.1.10",
    "region=eu-central-1",
    "path=/opt/app/config",
    "url=https://example.com",
    "placeholder=[PWM_77]",
    "-----BEGIN PRIVATE KEY-----",
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDleakguardprivatekeymaterial",
    "LeakGuardSyntheticOnly1234567890abcdefghijklmnopqrstuvwxyz",
    "-----END PRIVATE KEY-----"
  ].join("\n");

  const { findings, result } = redact(text);
  const transformed = transform(text, findings);

  assert.ok(findings.length >= 9, "mega block should produce multiple findings");
  assertForbiddenOutput(
    transformed.redactedText,
    [
      "sk-test-OPENAI-ALPHA-1234567890",
      "AKIAQTESTEXAMPLE1234",
      "awsSecretExampleValue1234567890AbCdEf",
      "LeakGuardPgPass123!",
      "LeakGuardBearerToken_1234567890_abcdefghijklmnopqrstuvwxyz",
      "LeakGuardDbPassword123!"
    ],
    "synthetic mega block"
  );
  assertPreservedOutput(
    transformed.redactedText,
    ["private_ip=10.0.0.5", "local_ip=192.168.1.10", "region=eu-central-1", "placeholder=[PWM_77]"],
    "synthetic mega block"
  );
  assert.ok((result.redactedText.match(/\[PWM_\d+\]/g) || []).length >= 8, "mega block should use multiple placeholders");
}

function run() {
  testRepeatedReuseAndDistinctMapping();
  testCloudCredentialFamilies();
  testAuthHeadersCookiesAndUrls();
  testStructuredConfigForms();
  testQueryParamsAndGenericSecretAssignments();
  testPlaceholdersSafeValuesAndNetworkTransform();
  testSyntheticMegaBlock();
  console.log("PASS synthetic secret pack regressions");
}

run();
