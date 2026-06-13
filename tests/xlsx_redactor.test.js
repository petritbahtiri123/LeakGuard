const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/shared/fileExtractors.js"));
require(path.join(repoRoot, "src/shared/xlsxRedactor.js"));

const { prepareFileExtractionAsync, EXTRACTOR_STATUS } = globalThis.PWM.FileExtractors;
const XlsxRedactor = globalThis.PWM.XlsxRedactor;

function arrayBufferFromBytes(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function byteText(bytes) {
  return new TextDecoder("latin1").decode(bytes);
}

async function extractXlsxText(buffer, fileName = "proof.redacted.xlsx") {
  return prepareFileExtractionAsync({
    fileName,
    mimeType: XlsxRedactor.XLSX_MIME_TYPE,
    buffer
  });
}

async function testGeneratedXlsxContainsOnlySanitizedText() {
  const rawSecret = "sk-proj-Phase16aRawXlsxSecret1234567890abcdef";
  const result = XlsxRedactor.createRedactedXlsxFromText({
    originalName: "source.xlsx",
    text: "API_KEY=[PWM_1]\nPUBLIC_URL=https://example.com"
  });
  const bytesText = byteText(result.bytes);
  const extracted = await extractXlsxText(arrayBufferFromBytes(result.bytes));

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.fileName, "source.redacted.xlsx");
  assert.strictEqual(result.mimeType, XlsxRedactor.XLSX_MIME_TYPE);
  assert.ok(result.bytes instanceof Uint8Array);
  assert.strictEqual(bytesText.includes(rawSecret), false);
  assert.strictEqual(bytesText.includes("sk-proj-Phase16aRawXlsxSecret"), false);
  assert.strictEqual(bytesText.includes("[PWM_1]"), true);
  assert.strictEqual(bytesText.includes("xl/worksheets/sheet1.xml"), true);
  assert.strictEqual(bytesText.includes("vbaProject.bin"), false);
  assert.strictEqual(extracted.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(extracted.text.includes(rawSecret), false);
  assert.ok(extracted.text.includes("API_KEY=[PWM_1]"));
  assert.ok(extracted.text.includes("PUBLIC_URL=https://example.com"));
}

async function testGeneratedXlsxDoesNotCopyOriginalSpreadsheetParts() {
  const rawSecrets = [
    "sk-proj-XlsxFormulaSecret1234567890abcdef",
    "sk-proj-XlsxCommentSecret1234567890abcdef",
    "sk-proj-XlsxHiddenSheetSecret1234567890abcdef",
    "sk-proj-XlsxMetadataSecret1234567890abcdef",
    "sk-proj-XlsxCustomXmlSecret1234567890abcdef",
    "sk-proj-XlsxMediaSecret1234567890abcdef"
  ];
  const result = XlsxRedactor.createRedactedXlsxFromText({
    originalName: "with-parts.xlsx",
    text: [
      "formula=[PWM_1]",
      "comment=[PWM_2]",
      "hidden_sheet=[PWM_3]",
      "metadata=[PWM_4]",
      "custom_xml=[PWM_5]",
      "media=[PWM_6]"
    ].join("\n")
  });
  const bytesText = byteText(result.bytes);
  const extracted = await extractXlsxText(arrayBufferFromBytes(result.bytes));

  assert.strictEqual(result.ok, true);
  for (const secret of rawSecrets) {
    assert.strictEqual(bytesText.includes(secret), false);
    assert.strictEqual(extracted.text.includes(secret), false);
  }
  assert.strictEqual(bytesText.includes("xl/sharedStrings.xml"), false);
  assert.strictEqual(bytesText.includes("xl/comments"), false);
  assert.strictEqual(bytesText.includes("docProps/"), false);
  assert.strictEqual(bytesText.includes("customXml/"), false);
  assert.strictEqual(bytesText.includes("xl/media/"), false);
  assert.strictEqual(bytesText.includes("xl/calcChain.xml"), false);
  assert.strictEqual(bytesText.includes("<f>"), false);
  assert.ok(extracted.text.includes("formula=[PWM_1]"));
  assert.ok(extracted.text.includes("hidden_sheet=[PWM_3]"));
}

function testUnsafeInputsDoNotProduceProofXlsx() {
  for (const [name, extraction, expectedStatus] of [
    ["malformed.xlsx", { status: EXTRACTOR_STATUS.ERROR, kind: "xlsx", safeForScan: false, reason: "xlsx_malformed_zip" }, "xlsx_malformed_zip"],
    ["encrypted.xlsx", { status: EXTRACTOR_STATUS.ERROR, kind: "xlsx", safeForScan: false, reason: "xlsx_encrypted" }, "xlsx_encrypted"],
    ["unsupported.xlsx", { status: EXTRACTOR_STATUS.ERROR, kind: "xlsx", safeForScan: false, reason: "xlsx_unsupported_compression" }, "xlsx_unsupported_compression"],
    ["legacy.xls", { status: EXTRACTOR_STATUS.UNSUPPORTED, kind: "unsupported", safeForScan: false, reason: "unsupported_file_type" }, "unsupported_file_type"],
    ["macro.xlsm", { status: EXTRACTOR_STATUS.UNSUPPORTED, kind: "unsupported", safeForScan: false, reason: "unsupported_file_type" }, "unsupported_file_type"]
  ]) {
    const result = XlsxRedactor.createRedactedXlsxFromExtraction({
      extraction,
      originalName: name,
      sanitizedText: "API_KEY=[PWM_1]"
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, expectedStatus);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "bytes"), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "fileName"), false);
  }
}

async function testEmptyAndOversizedSanitizedTextHandling() {
  const empty = XlsxRedactor.createRedactedXlsxFromExtraction({
    extraction: { status: EXTRACTOR_STATUS.OK, kind: "xlsx", safeForScan: true },
    originalName: "empty.xlsx",
    sanitizedText: "   \n\t"
  });
  assert.strictEqual(empty.ok, false);
  assert.strictEqual(empty.status, "xlsx_redacted_text_empty");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(empty, "bytes"), false);

  const keptPrefix = "API_KEY=[PWM_1]\n";
  const droppedTail = "TAIL_SHOULD_NOT_SURVIVE";
  const oversizedText = `${keptPrefix}${"A".repeat(XlsxRedactor.MAX_XLSX_TEXT_CHARS)}${droppedTail}`;
  const bounded = XlsxRedactor.createRedactedXlsxFromExtraction({
    extraction: { status: EXTRACTOR_STATUS.OK, kind: "xlsx", safeForScan: true },
    originalName: "large.xlsx",
    sanitizedText: oversizedText
  });
  const bytesText = byteText(bounded.bytes);
  const extracted = await extractXlsxText(arrayBufferFromBytes(bounded.bytes), bounded.fileName);

  assert.strictEqual(bounded.ok, true);
  assert.strictEqual(bounded.truncated, true);
  assert.strictEqual(bounded.fileName, "large.redacted.xlsx");
  assert.strictEqual(bytesText.includes(droppedTail), false);
  assert.strictEqual(extracted.status, EXTRACTOR_STATUS.OK);
  assert.ok(extracted.text.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(extracted.text.includes(droppedTail), false);
}

function testScannerXlsxOutputContractIsWired() {
  const pipelineSource = require("fs").readFileSync(
    path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"),
    "utf8"
  );
  const scannerSource = require("fs").readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");
  const scannerHtml = require("fs").readFileSync(path.join(repoRoot, "src/scanner/scanner.html"), "utf8");

  assert.ok(pipelineSource.includes('const EXTRACTED_TEXT_OUTPUT_KINDS = new Set(["pdf", "docx", "xlsx", "image_metadata", "image_ocr"]);'));
  assert.strictEqual(pipelineSource.includes("createRedactedXlsxFromText"), false);
  assert.ok(pipelineSource.includes("createRedactedXlsxFromExtraction"));
  assert.ok(pipelineSource.includes("redacted_xlsx_file"));
  assert.ok(scannerHtml.includes("download-redacted-xlsx-btn"), "scanner page should expose an XLSX export button");
  assert.ok(scannerHtml.includes("../shared/xlsxRedactor.js"), "scanner page should load the local XLSX redactor helper");
  assert.ok(scannerSource.includes("currentRedactedXlsx"), "scanner should track regenerated XLSX state separately");
  assert.ok(scannerSource.includes("createRedactedXlsxFromExtraction"), "scanner should generate XLSX output through sanitized text only");
  assert.ok(scannerSource.includes("downloadRedactedXlsx"), "scanner should expose a dedicated XLSX download handler");
  assert.ok(scannerSource.includes("Download Redacted XLSX") || scannerHtml.includes("Download Redacted XLSX"));
  assert.ok(scannerSource.includes("redactedFileName(currentScanResult.file.name)"), ".redacted.txt fallback download should remain available");
}

function testNoPersistenceLoggingOrUnsafeOverlayTerms() {
  const source = require("fs").readFileSync(path.join(repoRoot, "src/shared/xlsxRedactor.js"), "utf8");

  for (const forbidden of [
    "localStorage",
    "sessionStorage",
    "chrome.storage",
    "browser.storage",
    "pwm:audit",
    "console.log",
    "console.warn",
    "console.error",
    "hide",
    "overlay"
  ]) {
    assert.strictEqual(source.includes(forbidden), false, `xlsxRedactor proof must not include ${forbidden}`);
  }
}

function testPackageDependencyAndSizeGate() {
  const fs = require("fs");
  const source = fs.readFileSync(path.join(repoRoot, "src/shared/xlsxRedactor.js"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

  assert.ok(source.length < 22000, "xlsx redactor proof should stay below the agreed lightweight source budget");
  assert.deepStrictEqual(Object.keys(packageJson.dependencies || {}), ["onnxruntime-web"]);
}

(async () => {
  await testGeneratedXlsxContainsOnlySanitizedText();
  await testGeneratedXlsxDoesNotCopyOriginalSpreadsheetParts();
  testUnsafeInputsDoNotProduceProofXlsx();
  await testEmptyAndOversizedSanitizedTextHandling();
  testScannerXlsxOutputContractIsWired();
  testNoPersistenceLoggingOrUnsafeOverlayTerms();
  testPackageDependencyAndSizeGate();
  console.log("xlsx_redactor tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
