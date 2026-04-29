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
  MAX_TEXT_FILE_SIZE_BYTES,
  getFileExtension,
  isSupportedTextFile,
  validateFileForTextScan,
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
    ".ini",
    ".conf",
    ".ps1",
    ".sh",
    ".py",
    ".js",
    ".ts",
    ".html",
    ".css"
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
}

function testUnsupportedExtensionsRejected() {
  for (const extension of [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".zip", ".exe"]) {
    const result = validateFileForTextScan({
      fileName: `sample${extension}`,
      mimeType: "",
      sizeBytes: 8,
      buffer: bufferFromText("content")
    });

    assert.strictEqual(result.ok, false, `${extension} should be rejected`);
  }
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
  const result = validateFileForTextScan({
    fileName: "large.log",
    mimeType: "text/plain",
    sizeBytes: MAX_TEXT_FILE_SIZE_BYTES + 1
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "file_too_large");
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
testPublicIpRedactedPrivateIpVisible();
testLineColumnMapping();

console.log("PASS local file scanner regressions");
