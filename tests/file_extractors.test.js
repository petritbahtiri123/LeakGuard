const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/shared/fileExtractors.js"));

const {
  EXTRACTOR_STATUS,
  prepareFileExtraction,
  routeFileExtractor,
  createExtractorResult
} = globalThis.PWM.FileExtractors;

function assertTextReady(fileName, mimeType = "application/octet-stream") {
  const result = prepareFileExtraction({
    fileName,
    mimeType,
    text: "LOCAL_ONLY_TEXT"
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK, `${fileName} should be extractable text`);
  assert.strictEqual(result.kind, "text");
  assert.strictEqual(result.text, "LOCAL_ONLY_TEXT");
  assert.strictEqual(result.safeForScan, true);
  assert.deepStrictEqual(result.warnings, []);
  assert.strictEqual(result.reason, "");
  assert.strictEqual(result.metadata.fileName, fileName.split(/[\\/]/).pop());
}

function assertPlannedUnsupported(fileName, mimeType, expectedKind) {
  const routed = routeFileExtractor({ fileName, mimeType });
  const result = prepareFileExtraction({
    fileName,
    mimeType,
    text: "SHOULD_NOT_PARSE"
  });

  assert.strictEqual(routed.status, EXTRACTOR_STATUS.PLANNED_UNSUPPORTED, `${fileName} route should be planned`);
  assert.strictEqual(result.status, EXTRACTOR_STATUS.PLANNED_UNSUPPORTED, `${fileName} should stay disabled`);
  assert.strictEqual(result.kind, expectedKind);
  assert.strictEqual(result.text, "");
  assert.strictEqual(result.safeForScan, false);
  assert.ok(result.reason.includes("planned"));
  assert.ok(result.metadata.planned);
}

function testSupportedTextFilesAreSafeForScan() {
  for (const fileName of [
    "notes.txt",
    "service.env",
    ".env",
    "audit.log",
    "README.md",
    "package.json",
    "component.ts",
    "script.js",
    "query.sql",
    "Dockerfile",
    "Makefile"
  ]) {
    assertTextReady(fileName);
  }
}

function testPlannedDocumentsRemainDisabled() {
  for (const [fileName, mimeType] of [
    ["paper.pdf", "application/pdf"],
    ["proposal.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
  ]) {
    assertPlannedUnsupported(fileName, mimeType, "document");
  }
}

function testPlannedImagesRemainDisabled() {
  for (const [fileName, mimeType] of [
    ["diagram.png", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["capture.webp", "image/webp"]
  ]) {
    assertPlannedUnsupported(fileName, mimeType, "image");
  }
}

function testMimeOnlyPlannedTypesDoNotEnableParsing() {
  for (const [fileName, mimeType] of [
    ["upload.bin", "application/pdf"],
    ["upload.dat", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["upload", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["upload.bin", "image/png"]
  ]) {
    const result = prepareFileExtraction({ fileName, mimeType, text: "SHOULD_NOT_PARSE" });
    assert.strictEqual(result.status, EXTRACTOR_STATUS.UNSUPPORTED);
    assert.strictEqual(result.safeForScan, false);
    assert.strictEqual(result.text, "");
  }
}

function testUnknownFileRemainsUnsupported() {
  const result = prepareFileExtraction({
    fileName: "archive.bin",
    mimeType: "application/octet-stream",
    text: "SHOULD_NOT_PARSE"
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.UNSUPPORTED);
  assert.strictEqual(result.kind, "unsupported");
  assert.strictEqual(result.safeForScan, false);
  assert.strictEqual(result.text, "");
}

function testResultShapeDefaults() {
  const result = createExtractorResult({ status: EXTRACTOR_STATUS.ERROR, reason: "read_failed" });
  assert.deepStrictEqual(Object.keys(result), [
    "status",
    "kind",
    "text",
    "metadata",
    "warnings",
    "reason",
    "safeForScan"
  ]);
  assert.strictEqual(result.status, EXTRACTOR_STATUS.ERROR);
  assert.deepStrictEqual(result.metadata, {});
  assert.deepStrictEqual(result.warnings, []);
}

function testNoNewDependenciesAdded() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.deepStrictEqual(Object.keys(packageJson.dependencies || {}), ["onnxruntime-web"]);
}

testSupportedTextFilesAreSafeForScan();
testPlannedDocumentsRemainDisabled();
testPlannedImagesRemainDisabled();
testMimeOnlyPlannedTypesDoNotEnableParsing();
testUnknownFileRemainsUnsupported();
testResultShapeDefaults();
testNoNewDependenciesAdded();
console.log("PASS file extractor shell regressions");
