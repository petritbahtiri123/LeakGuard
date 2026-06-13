const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));

const {
  FILE_TYPE_STATUS,
  classifyFileType,
  getFileExtension,
  isSupportedTextFileType,
  isPlannedUnsupportedFileType
} = globalThis.PWM.FileTypeRegistry;

function testSupportedTextFilesRemainSupported() {
  for (const fileName of [
    "notes.txt",
    "service.log",
    "README.md",
    "package.json",
    ".env",
    "Dockerfile",
    "Makefile",
    "script.ts",
    "component.tsx",
    "deploy.sh",
    "query.sql",
    "private.key"
  ]) {
    const result = classifyFileType({ fileName, mimeType: "application/octet-stream" });
    assert.strictEqual(result.status, FILE_TYPE_STATUS.SUPPORTED, `${fileName} should stay supported`);
    assert.strictEqual(result.action, "scan");
    assert.strictEqual(result.family, "text");
    assert.strictEqual(isSupportedTextFileType({ fileName, mimeType: "" }), true);
  }
}

function testPlannedDocumentsAreUnsupported() {
  for (const [fileName, mimeType] of [
    ["statement.pdf", "application/pdf"],
    ["proposal.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["budget.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
  ]) {
    const result = classifyFileType({ fileName, mimeType });
    assert.strictEqual(result.status, FILE_TYPE_STATUS.PLANNED_UNSUPPORTED, `${fileName} should be planned`);
    assert.strictEqual(result.action, "allow");
    assert.strictEqual(result.family, "document");
    assert.strictEqual(result.supported, false);
    assert.strictEqual(isPlannedUnsupportedFileType({ fileName, mimeType }), true);
  }
}

function testPlannedImagesAreUnsupported() {
  for (const [fileName, mimeType] of [
    ["screenshot.png", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["capture.webp", "image/webp"]
  ]) {
    const result = classifyFileType({ fileName, mimeType });
    assert.strictEqual(result.status, FILE_TYPE_STATUS.PLANNED_UNSUPPORTED, `${fileName} should be planned`);
    assert.strictEqual(result.action, "allow");
    assert.strictEqual(result.family, "image");
    assert.strictEqual(result.supported, false);
  }
}

function testUnknownBinariesRemainUnsupported() {
  for (const fileName of ["archive.zip", "program.exe", "payload.bin", "unknown"]) {
    const result = classifyFileType({ fileName, mimeType: "application/octet-stream" });
    assert.strictEqual(result.status, FILE_TYPE_STATUS.UNSUPPORTED, `${fileName} should be unsupported`);
    assert.strictEqual(result.action, "allow");
    assert.strictEqual(result.supported, false);
  }
}

function testMimeMismatchDoesNotEnableParsing() {
  assert.strictEqual(
    classifyFileType({ fileName: "invoice.pdf", mimeType: "text/plain" }).status,
    FILE_TYPE_STATUS.PLANNED_UNSUPPORTED
  );
  assert.strictEqual(
    classifyFileType({ fileName: "malware.bin", mimeType: "text/plain" }).status,
    FILE_TYPE_STATUS.UNSUPPORTED
  );
  assert.strictEqual(
    classifyFileType({ fileName: "README", mimeType: "text/plain" }).status,
    FILE_TYPE_STATUS.UNSUPPORTED
  );
  assert.strictEqual(
    classifyFileType({ fileName: "notes.txt", mimeType: "application/pdf" }).status,
    FILE_TYPE_STATUS.SUPPORTED
  );
}

function testExtensionAndFallbackNamePattern() {
  assert.strictEqual(getFileExtension("C:\\fakepath\\.env"), ".env");
  assert.strictEqual(classifyFileType({ fileName: "Dockerfile" }).fallbackNamePattern, "dockerfile");
  assert.strictEqual(classifyFileType({ fileName: "Makefile" }).fallbackNamePattern, "makefile");
}

testSupportedTextFilesRemainSupported();
testPlannedDocumentsAreUnsupported();
testPlannedImagesAreUnsupported();
testUnknownBinariesRemainUnsupported();
testMimeMismatchDoesNotEnableParsing();
testExtensionAndFallbackNamePattern();
console.log("PASS file type registry regressions");
