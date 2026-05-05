const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/shared/fileScanner.js"));

const {
  LOCAL_TEXT_FAST_MAX_BYTES,
  LOCAL_TEXT_OPTIMIZED_MAX_BYTES,
  LOCAL_TEXT_HARD_BLOCK_BYTES,
  LARGE_TEXT_STREAMING_MAX_BYTES,
  MAX_TEXT_FILE_SIZE_BYTES,
  getFileExtension,
  isSupportedTextFile,
  validateFileForTextScan,
  classifyFileForTextScan,
  decodeUtf8Text,
  getLineColumnFromOffset,
  scanTextContent,
  buildSanitizedReport
} = globalThis.PWM.FileScanner;

function bufferFromText(text) {
  return new TextEncoder().encode(text).buffer;
}

function bufferFromBytes(bytes) {
  return Uint8Array.from(bytes).buffer;
}

function scanSample(text, fileName = "sample.env") {
  return scanTextContent({
    fileName,
    mimeType: "text/plain",
    sizeBytes: bufferFromText(text).byteLength,
    text,
    mode: "hide_public"
  });
}

function testSupportedExtensionsAccepted() {
  const supported = [
    ".txt",
    ".env",
    ".log",
    ".json",
    ".yaml",
    ".yml",
    ".xml",
    ".csv",
    ".md",
    ".markdown",
    ".toml",
    ".ini",
    ".conf",
    ".cfg",
    ".ps1",
    ".sh",
    ".bash",
    ".zsh",
    ".bat",
    ".cmd",
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".scss",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".sql"
  ];

  for (const extension of supported) {
    const fileName = extension === ".env" ? ".env" : `sample${extension}`;
    assert.strictEqual(getFileExtension(fileName), extension);
    assert.strictEqual(isSupportedTextFile(fileName, ""), true, `${extension} should be accepted`);
    assert.strictEqual(
      isSupportedTextFile(fileName, "application/octet-stream"),
      true,
      `${extension} should allow generic MIME from local file pickers`
    );
  }

  assert.strictEqual(isSupportedTextFile("Dockerfile", ""), true);
  assert.strictEqual(isSupportedTextFile("Makefile", ""), true);
}

function testUnsupportedExtensionsRejected() {
  for (const extension of [".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".ico", ".svg"]) {
    const result = validateFileForTextScan({
      fileName: `sample${extension}`,
      mimeType: "",
      sizeBytes: 8,
      buffer: bufferFromText("content")
    });

    assert.strictEqual(result.ok, false, `${extension} should be rejected`);
    assert.strictEqual(
      classifyFileForTextScan({ fileName: `sample${extension}` }).action,
      "allow",
      `${extension} should be classified for pass-through upload`
    );
  }

  assert.strictEqual(classifyFileForTextScan({ fileName: "sample.bin" }).kind, "unknown");
  assert.strictEqual(classifyFileForTextScan({ fileName: "sample.bin" }).action, "allow");
}

function testGenericMimeRequiresSupportedExtension() {
  assert.strictEqual(isSupportedTextFile("config.env", ""), true);
  assert.strictEqual(isSupportedTextFile("config.env", "application/octet-stream"), true);
  assert.strictEqual(isSupportedTextFile("component.ts", "video/mp2t"), true);
  assert.strictEqual(isSupportedTextFile("config.bin", ""), false);
  assert.strictEqual(isSupportedTextFile("README", "text/plain"), false);
}

function testUtf8DecodeFailureRejected() {
  const result = validateFileForTextScan({
    fileName: "bad.txt",
    mimeType: "text/plain",
    sizeBytes: 3,
    buffer: bufferFromBytes([0xff, 0xfe, 0xfd])
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "invalid_utf8");
  assert.throws(() => decodeUtf8Text(bufferFromBytes([0xff])), /encoded data/);
}

function testNullHeavyContentRejected() {
  const bytes = [];
  for (let index = 0; index < 200; index += 1) {
    bytes.push(index % 2 === 0 ? 0 : 65);
  }

  const result = validateFileForTextScan({
    fileName: "binary.txt",
    mimeType: "text/plain",
    sizeBytes: bytes.length,
    buffer: bufferFromBytes(bytes)
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "binary_content");
}

function testOversizedFileRejectedBeforeScanning() {
  assert.strictEqual(LOCAL_TEXT_FAST_MAX_BYTES, 2 * 1024 * 1024);
  assert.strictEqual(LOCAL_TEXT_OPTIMIZED_MAX_BYTES, 4 * 1024 * 1024);
  assert.strictEqual(LOCAL_TEXT_HARD_BLOCK_BYTES, 4 * 1024 * 1024);
  assert.strictEqual(LARGE_TEXT_STREAMING_MAX_BYTES, 50 * 1024 * 1024);
  assert.strictEqual(MAX_TEXT_FILE_SIZE_BYTES, LARGE_TEXT_STREAMING_MAX_BYTES);

  const optimizedZone = validateFileForTextScan({
    fileName: "optimized.log",
    mimeType: "text/plain",
    sizeBytes: LOCAL_TEXT_FAST_MAX_BYTES + 1
  });
  assert.strictEqual(optimizedZone.ok, true, "2-4 MiB text files should remain processable");

  const streamingZone = validateFileForTextScan({
    fileName: "large.log",
    mimeType: "text/plain",
    sizeBytes: LOCAL_TEXT_HARD_BLOCK_BYTES + 1
  });
  assert.strictEqual(streamingZone.ok, true, ">4 MiB text files should be streamable");

  const result = validateFileForTextScan({
    fileName: "too-large.log",
    mimeType: "text/plain",
    sizeBytes: LARGE_TEXT_STREAMING_MAX_BYTES + 1
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "file_too_large");
  assert.ok(result.message.includes("over 50 MB"));
}

function testEnvSecretsRedacted() {
  const secret = "LeakGuardShellApiKey1234567890";
  const password = "LeakGuardDbPassword123!";
  const result = scanSample(`API_KEY=${secret}\nDB_PASSWORD=${password}\n`);
  const report = buildSanitizedReport(result);
  const reportJson = JSON.stringify(report);

  assert.ok(result.summary.findingsCount >= 2, "expected env secrets to be detected");
  assert.strictEqual(result.redactedText.includes(secret), false);
  assert.strictEqual(result.redactedText.includes(password), false);
  assert.ok(/\[PWM_\d+\]/.test(result.redactedText));
  assert.strictEqual(reportJson.includes(secret), false, "report should not include raw API key");
  assert.strictEqual(reportJson.includes(password), false, "report should not include raw password");
}

function testJsonCredentialRedacted() {
  const secret = "LeakGuardJsonPassword123!";
  const result = scanSample(`{"password":"${secret}","safe":true}`, "config.json");

  assert.strictEqual(result.redactedText.includes(secret), false);
  assert.ok(result.redactedText.includes('"password"'), "JSON key should remain readable");
  assert.ok(result.redactedText.includes('"safe":true'), "surrounding JSON should remain readable");
}

function testSanitizedScannerReportExcludesRawSecretBoundaries() {
  const repeatedSecret = "ScannerBoundaryApiKey1234567890";
  const urlPassword = "ScannerUrlPass!2026";
  const text = [
    `API_KEY=${repeatedSecret}`,
    `Authorization: Bearer ${repeatedSecret}`,
    `DATABASE_URL=postgres://app:${urlPassword}@db.example.com:5432/app`,
    "PUBLIC_URL=https://example.com"
  ].join("\n");
  const result = scanSample(text, "boundary.env");
  const report = buildSanitizedReport(result);
  const reportJson = JSON.stringify(report);

  assert.strictEqual(result.redactedText.includes(repeatedSecret), false, "redacted text leaked repeated secret");
  assert.strictEqual(result.redactedText.includes(urlPassword), false, "redacted text leaked URL password");
  assert.strictEqual(reportJson.includes(repeatedSecret), false, "sanitized report leaked repeated secret");
  assert.strictEqual(reportJson.includes(urlPassword), false, "sanitized report leaked URL password");
  assert.strictEqual(reportJson.includes(`postgres://app:${urlPassword}`), false, "report leaked raw URI credential prefix");
  assert.ok(result.redactedText.includes("Authorization: Bearer "), "header label should remain visible");
  assert.ok(
    /DATABASE_URL=postgres:\/\/\[PWM_\d+\]:\[PWM_\d+\]@db\.example\.com:5432\/(?:app|\[PWM_\d+\])/.test(result.redactedText),
    "database URL shape should remain visible with separate credential placeholders"
  );
  assert.ok(result.redactedText.includes("PUBLIC_URL=https://example.com"), "safe public URL should remain visible");

  const placeholders = result.redactedText.match(/\[PWM_\d+\]/g) || [];
  assert.ok(placeholders.length >= 4, "expected redacted placeholders for repeated secret and URL credentials");
  assert.strictEqual(
    result.redactedText.includes(`ApiKey${placeholders[0]}`),
    false,
    "known raw secret reuse should not leave raw prefixes attached to placeholders"
  );
}

function testSupportedTextFormatFixturesRedactSecrets() {
  const fixtures = [
    {
      fileName: ".env",
      text: [
        "PUBLIC_URL=https://example.com",
        "API_KEY=LeakGuardEnvApiKey1234567890",
        "PASSWORD=LeakGuardEnvPassword123!",
        "FEATURE_FLAG=true"
      ].join("\n"),
      secrets: ["LeakGuardEnvApiKey1234567890", "LeakGuardEnvPassword123!"],
      safeValues: ["PUBLIC_URL=https://example.com", "FEATURE_FLAG=true"]
    },
    {
      fileName: "settings.json",
      text: JSON.stringify({
        public_url: "https://example.com",
        token: "LeakGuardJsonToken1234567890",
        password: "LeakGuardJsonPassword123!",
        safe: true
      }),
      secrets: ["LeakGuardJsonToken1234567890", "LeakGuardJsonPassword123!"],
      safeValues: ['"public_url":"https://example.com"', '"safe":true']
    },
    {
      fileName: "deployment.yaml",
      text: [
        "public_url: https://example.com",
        "api_token: LeakGuardYamlToken1234567890",
        "db_password: LeakGuardYamlPassword123!",
        "sample_token: example-token-for-docs-only"
      ].join("\n"),
      secrets: ["LeakGuardYamlToken1234567890", "LeakGuardYamlPassword123!"],
      safeValues: [
        "public_url: https://example.com",
        "sample_token: example-token-for-docs-only"
      ]
    },
    {
      fileName: "application.log",
      text: [
        "INFO healthcheck=https://example.com/health status=200",
        "WARN Authorization: Bearer LeakGuardLogBearerToken1234567890",
        "INFO private_client=192.168.1.1"
      ].join("\n"),
      secrets: ["LeakGuardLogBearerToken1234567890"],
      safeValues: ["https://example.com/health", "192.168.1.1"]
    },
    {
      fileName: "deploy.sh",
      text: [
        "#!/usr/bin/env sh",
        "PUBLIC_URL=https://example.com",
        "export API_TOKEN=LeakGuardShellToken1234567890",
        "echo \"$PUBLIC_URL\""
      ].join("\n"),
      secrets: ["LeakGuardShellToken1234567890"],
      safeValues: ["PUBLIC_URL=https://example.com", "echo \"$PUBLIC_URL\""]
    },
    {
      fileName: "deploy.ps1",
      text: [
        "$PublicUrl = \"https://example.com\"",
        "$Env:API_KEY = \"LeakGuardPowerShellApiKey1234567890\"",
        "Write-Output $PublicUrl"
      ].join("\n"),
      secrets: ["LeakGuardPowerShellApiKey1234567890"],
      safeValues: ["$PublicUrl = \"https://example.com\"", "Write-Output $PublicUrl"]
    }
  ];

  for (const fixture of fixtures) {
    const result = scanSample(fixture.text, fixture.fileName);
    const report = buildSanitizedReport(result);
    const reportJson = JSON.stringify(report);

    assert.ok(result.summary.findingsCount >= fixture.secrets.length, `${fixture.fileName}: expected findings`);
    assert.ok(/\[(?:PWM|PUB_HOST)_\d+\]/.test(result.redactedText), `${fixture.fileName}: expected placeholders`);

    for (const secret of fixture.secrets) {
      assert.strictEqual(result.redactedText.includes(secret), false, `${fixture.fileName}: redacted text leaked ${secret}`);
      assert.strictEqual(reportJson.includes(secret), false, `${fixture.fileName}: report leaked ${secret}`);
    }

    for (const safeValue of fixture.safeValues) {
      assert.ok(
        result.redactedText.includes(safeValue),
        `${fixture.fileName}: safe value should remain visible: ${safeValue}`
      );
    }
  }
}

function testPublicIpRedactedPrivateIpVisible() {
  const result = scanSample("public=8.8.8.8 private=192.168.1.1", "network.log");

  assert.strictEqual(result.redactedText.includes("8.8.8.8"), false);
  assert.ok(/\[PUB_HOST_\d+\]/.test(result.redactedText));
  assert.ok(result.redactedText.includes("192.168.1.1"));
}

function testLineColumnMapping() {
  const text = "first line\r\nsecond line\nAPI_KEY=value";
  assert.deepStrictEqual(getLineColumnFromOffset(text, 0), { line: 1, column: 1 });
  assert.deepStrictEqual(
    getLineColumnFromOffset(text, text.indexOf("second")),
    { line: 2, column: 1 }
  );
  assert.deepStrictEqual(
    getLineColumnFromOffset(text, text.indexOf("API_KEY")),
    { line: 3, column: 1 }
  );
}

testSupportedExtensionsAccepted();
testUnsupportedExtensionsRejected();
testGenericMimeRequiresSupportedExtension();
testUtf8DecodeFailureRejected();
testNullHeavyContentRejected();
testOversizedFileRejectedBeforeScanning();
testEnvSecretsRedacted();
testJsonCredentialRedacted();
testSanitizedScannerReportExcludesRawSecretBoundaries();
testSupportedTextFormatFixturesRedactSecrets();
testPublicIpRedactedPrivateIpVisible();
testLineColumnMapping();

console.log("PASS local file scanner regressions");
