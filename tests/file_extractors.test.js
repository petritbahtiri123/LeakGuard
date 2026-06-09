const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/shared/fileExtractors.js"));
require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/knownSecretReuse.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/shared/fileLimits.js"));
require(path.join(repoRoot, "src/shared/fileScanner.js"));

const {
  EXTRACTOR_STATUS,
  prepareFileExtraction,
  prepareFileExtractionAsync,
  routeFileExtractor,
  createExtractorResult,
  PDF_TEXT_EXTRACTION_MAX_BYTES
} = globalThis.PWM.FileExtractors;
const { scanTextContent, buildSanitizedReport } = globalThis.PWM.FileScanner;

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

function bufferFromText(text) {
  return new TextEncoder().encode(text).buffer;
}

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function makePdf(text, options = {}) {
  if (options.malformed) return bufferFromText("not a pdf");

  const streamText = options.imageOnly
    ? "q\n10 0 0 10 0 0 cm\n/Im1 Do\nQ\n"
    : `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\n`;
  const stream = options.flate ? zlib.deflateSync(Buffer.from(streamText, "binary")) : streamText;
  const encryptMarker = options.encrypted ? "\n/Encrypt 6 0 R\n" : "";
  const streamHeader = options.flate
    ? `<< /Length ${stream.length} /Filter /FlateDecode >>`
    : `<< /Length ${stream.length} >>`;
  const parts = [
    "%PDF-1.4",
    "1 0 obj",
    `<< /Type /Catalog /Pages 2 0 R${encryptMarker} >>`,
    "endobj",
    "2 0 obj",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "endobj",
    "3 0 obj",
    "<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>",
    "endobj",
    "4 0 obj",
    streamHeader,
    "stream",
    stream,
    "endstream",
    "endobj",
    "trailer",
    "<< /Root 1 0 R >>",
    "%%EOF"
  ];
  const buffer = Buffer.concat(parts.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(`${part}\n`, "binary")));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
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

async function testSafeTextPdfExtractsLocally() {
  const syncResult = prepareFileExtraction({
    fileName: "notes.pdf",
    mimeType: "application/pdf",
    text: "PDF text must come from bytes"
  });
  const result = await prepareFileExtractionAsync({
    fileName: "notes.pdf",
    mimeType: "application/pdf",
    buffer: makePdf("Release notes only")
  });

  assert.strictEqual(syncResult.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(syncResult.safeForScan, false);
  assert.strictEqual(syncResult.text, "");
  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(result.kind, "pdf");
  assert.strictEqual(result.text, "Release notes only");
  assert.strictEqual(result.safeForScan, true);
  assert.strictEqual(result.metadata.fileName, "notes.pdf");
  assert.strictEqual(result.metadata.textLength, "Release notes only".length);
}

async function testFlateTextPdfExtractsLocally() {
  const result = await prepareFileExtractionAsync({
    fileName: "compressed.pdf",
    mimeType: "application/pdf",
    buffer: makePdf("Compressed release notes", { flate: true })
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(result.text, "Compressed release notes");
  assert.strictEqual(result.safeForScan, true);
}

async function testPdfSecretsFeedExistingScannerWithoutRawReportMetadata() {
  const rawSecret = "sk-proj-LeakGuardPdfApiKey1234567890abcdef";
  const result = await prepareFileExtractionAsync({
    fileName: "secret.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(`API key: ${rawSecret}`)
  });
  const scan = scanTextContent({
    fileName: "secret.pdf",
    mimeType: "application/pdf",
    sizeBytes: result.metadata.textLength,
    text: result.text,
    extractedText: true,
    mode: "hide_public"
  });
  const report = buildSanitizedReport(scan);
  const metadataOnly = JSON.stringify({
    file: scan.file,
    summary: scan.summary,
    findings: scan.findings,
    report
  });

  assert.strictEqual(result.safeForScan, true);
  assert.ok(scan.summary.findingsCount > 0);
  assert.strictEqual(JSON.stringify(result.metadata).includes(rawSecret), false);
  assert.strictEqual(JSON.stringify(scan.file).includes(rawSecret), false);
  assert.strictEqual(scan.redactedText.includes(rawSecret), false);
  assert.strictEqual(metadataOnly.includes(rawSecret), false);
}

async function testPdfEnvAndMultilineSecretsExtract() {
  const text = [
    "OPENAI_API_KEY=sk-proj-LeakGuardPdfEnvKey1234567890abcdef",
    "PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nabc123secret\n-----END PRIVATE KEY-----"
  ].join("\n");
  const result = await prepareFileExtractionAsync({
    fileName: "secrets.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(text)
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.ok(result.text.includes("OPENAI_API_KEY="));
  assert.ok(result.text.includes("PRIVATE_KEY="));
  assert.ok(result.text.includes("\nabc123secret\n"));
}

async function assertPdfExtractionError(name, buffer, expectedReason) {
  const result = await prepareFileExtractionAsync({
    fileName: name,
    mimeType: "application/pdf",
    buffer
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(result.kind, "pdf");
  assert.strictEqual(result.text, "");
  assert.strictEqual(result.safeForScan, false);
  assert.strictEqual(result.reason, expectedReason);
}

async function testUnreadablePdfCasesFailClosed() {
  await assertPdfExtractionError("empty.pdf", makePdf(""), "pdf_no_extractable_text");
  await assertPdfExtractionError("encrypted.pdf", makePdf("secret", { encrypted: true }), "pdf_encrypted");
  await assertPdfExtractionError("malformed.pdf", makePdf("", { malformed: true }), "pdf_malformed");
  await assertPdfExtractionError("scan.pdf", makePdf("", { imageOnly: true }), "pdf_no_extractable_text");
}

async function testLargePdfTextExtractionLimit() {
  const result = await prepareFileExtractionAsync({
    fileName: "large.pdf",
    mimeType: "application/pdf",
    buffer: makePdf("A".repeat(PDF_TEXT_EXTRACTION_MAX_BYTES + 1))
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(result.reason, "pdf_text_too_large");
  assert.strictEqual(result.safeForScan, false);
  assert.strictEqual(result.text, "");
}

async function testPdfMimeMismatchDoesNotBypassGates() {
  const wrongMimePdf = await prepareFileExtractionAsync({
    fileName: "wrong-mime.pdf",
    mimeType: "text/plain",
    buffer: makePdf("PDF extension still controls extraction")
  });
  const mimeOnlyPdf = await prepareFileExtractionAsync({
    fileName: "not-a-pdf.txt",
    mimeType: "application/pdf",
    buffer: makePdf("MIME alone must not switch text file path")
  });
  const docxWithPdfMime = await prepareFileExtractionAsync({
    fileName: "proposal.docx",
    mimeType: "application/pdf",
    buffer: makePdf("DOCX must stay disabled")
  });

  assert.strictEqual(wrongMimePdf.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(wrongMimePdf.kind, "pdf");
  assert.strictEqual(mimeOnlyPdf.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(mimeOnlyPdf.kind, "text");
  assert.strictEqual(mimeOnlyPdf.text, "");
  assert.strictEqual(docxWithPdfMime.status, EXTRACTOR_STATUS.PLANNED_UNSUPPORTED);
  assert.strictEqual(docxWithPdfMime.safeForScan, false);
}

function testPdfBundleBudget() {
  const source = fs.readFileSync(path.join(repoRoot, "src/shared/fileExtractors.js"), "utf8");
  assert.ok(source.length < 24000, "PDF extractor shell should stay below the agreed lightweight budget");
  assert.strictEqual(source.includes("import("), false);
  assert.strictEqual(source.includes("eval("), false);
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

(async () => {
  testSupportedTextFilesAreSafeForScan();
  testPlannedDocumentsRemainDisabled();
  testPlannedImagesRemainDisabled();
  testMimeOnlyPlannedTypesDoNotEnableParsing();
  testUnknownFileRemainsUnsupported();
  testResultShapeDefaults();
  testNoNewDependenciesAdded();
  await testSafeTextPdfExtractsLocally();
  await testFlateTextPdfExtractsLocally();
  await testPdfSecretsFeedExistingScannerWithoutRawReportMetadata();
  await testPdfEnvAndMultilineSecretsExtract();
  await testUnreadablePdfCasesFailClosed();
  await testLargePdfTextExtractionLimit();
  await testPdfMimeMismatchDoesNotBypassGates();
  testPdfBundleBudget();
  console.log("PASS file extractor shell regressions");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
