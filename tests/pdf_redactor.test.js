const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/shared/fileExtractors.js"));
require(path.join(repoRoot, "src/shared/pdfRedactor.js"));

const { prepareFileExtractionAsync, EXTRACTOR_STATUS } = globalThis.PWM.FileExtractors;
const PdfRedactor = globalThis.PWM.PdfRedactor;

function textBuffer(text) {
  return new TextEncoder().encode(String(text)).buffer;
}

function makePdf(text, options = {}) {
  if (options.malformed) return textBuffer("not a pdf");
  if (options.empty) {
    return textBuffer("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF\n");
  }
  const uniqueSourceMarker = options.sourceMarker ? `\n% ${options.sourceMarker}\n` : "";
  const streamText = options.imageOnly
    ? "q\n10 0 0 10 0 0 cm\n/Im1 Do\nQ\n"
    : `BT\n/F1 12 Tf\n72 720 Td\n(${String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")}) Tj\nET\n${uniqueSourceMarker}`;
  const stream = Buffer.from(streamText, "binary");
  const encryptMarker = options.encrypted ? "\n/Encrypt 6 0 R\n" : "";
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
    `<< /Length ${stream.length} >>`,
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

async function extractPdfText(buffer, fileName = "proof.redacted.pdf") {
  return prepareFileExtractionAsync({
    fileName,
    mimeType: "application/pdf",
    buffer
  });
}

async function testGeneratedPdfContainsOnlySanitizedText() {
  const rawSecret = "sk-proj-Phase14aRawPdfSecret1234567890abcdef";
  const sanitizedText = "API_KEY=[PWM_1]\nPUBLIC_URL=https://example.com";
  const result = PdfRedactor.createRedactedPdfFromText({
    originalName: "source.pdf",
    text: sanitizedText
  });
  const bytesText = new TextDecoder("latin1").decode(result.bytes);
  const extracted = await extractPdfText(result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength));

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.fileName, "source.redacted.pdf");
  assert.strictEqual(result.mimeType, "application/pdf");
  assert.ok(result.bytes instanceof Uint8Array);
  assert.ok(bytesText.startsWith("%PDF-1.4"));
  assert.strictEqual(bytesText.includes(rawSecret), false);
  assert.strictEqual(bytesText.includes("sk-proj-Phase14aRawPdfSecret"), false);
  assert.strictEqual(bytesText.includes("[PWM_1]"), true);
  assert.strictEqual(extracted.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(extracted.text.includes(rawSecret), false);
  assert.ok(extracted.text.includes("API_KEY=[PWM_1]"));
  assert.ok(extracted.text.includes("PUBLIC_URL=https://example.com"));
}

async function testGeneratedPdfExcludesSourcePdfStreamsAndMarkers() {
  const rawSecret = "sk-proj-OriginalStreamSecret1234567890abcdef";
  const sourceMarker = "ORIGINAL_STREAM_MARKER_PHASE_14B_H";
  const sourceBuffer = makePdf(`API_KEY=${rawSecret}`, { sourceMarker });
  const extraction = await extractPdfText(sourceBuffer, "source-stream.pdf");
  const result = PdfRedactor.createRedactedPdfFromExtraction({
    originalName: "source-stream.pdf",
    extraction,
    sanitizedText: "API_KEY=[PWM_1]\nsource_stream_removed=true"
  });
  const bytesText = new TextDecoder("latin1").decode(result.bytes);
  const extracted = await extractPdfText(result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength));

  assert.strictEqual(extraction.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.source, "sanitized_text");
  assert.strictEqual(result.mimeType, "application/pdf");
  assert.ok(result.fileName.endsWith(".redacted.pdf"));
  assert.strictEqual(bytesText.includes(rawSecret), false);
  assert.strictEqual(bytesText.includes(sourceMarker), false);
  assert.strictEqual(bytesText.includes("ORIGINAL_STREAM_MARKER"), false);
  assert.strictEqual(extracted.text.includes(rawSecret), false);
  assert.strictEqual(extracted.text.includes(sourceMarker), false);
  assert.ok(extracted.text.includes("API_KEY=[PWM_1]"));
}

function testOutputNameNormalization() {
  assert.strictEqual(PdfRedactor.redactedPdfFileName("report.pdf"), "report.redacted.pdf");
  assert.strictEqual(PdfRedactor.redactedPdfFileName("archive.final.PDF"), "archive.final.redacted.pdf");
  assert.strictEqual(PdfRedactor.redactedPdfFileName("../secret.pdf"), "secret.redacted.pdf");
  assert.strictEqual(PdfRedactor.redactedPdfFileName("no-extension"), "no-extension.redacted.pdf");
}

async function testUnsafePdfInputsDoNotProduceProofPdf() {
  for (const [name, buffer, expectedReason] of [
    ["empty.pdf", makePdf("", { empty: true }), "pdf_no_extractable_text"],
    ["encrypted.pdf", makePdf("secret", { encrypted: true }), "pdf_encrypted"],
    ["malformed.pdf", makePdf("", { malformed: true }), "pdf_malformed"],
    ["scanned.pdf", makePdf("", { imageOnly: true }), "pdf_no_extractable_text"]
  ]) {
    const extraction = await extractPdfText(buffer, name);
    const rebuilt = PdfRedactor.createRedactedPdfFromExtraction({
      originalName: name,
      extraction,
      sanitizedText: "API_KEY=[PWM_1]"
    });

    assert.strictEqual(extraction.status, EXTRACTOR_STATUS.ERROR);
    assert.strictEqual(extraction.reason, expectedReason);
    assert.strictEqual(rebuilt.ok, false);
    assert.strictEqual(rebuilt.status, expectedReason);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(rebuilt, "bytes"), false);
  }
}

async function testLargeSanitizedPdfOutputIsBoundedAndSafe() {
  const rawSecret = "sk-proj-LargePdfRawSecret1234567890abcdef";
  const sanitizedText = [
    "API_KEY=[PWM_1]",
    "SAFE_LINE_START",
    "A".repeat(PdfRedactor.MAX_PDF_TEXT_CHARS + 1000),
    "SAFE_LINE_AFTER_LIMIT"
  ].join("\n");
  const result = PdfRedactor.createRedactedPdfFromText({
    originalName: "large.pdf",
    text: sanitizedText
  });
  const bytesText = new TextDecoder("latin1").decode(result.bytes);
  const extracted = await extractPdfText(result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength));

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.mimeType, "application/pdf");
  assert.strictEqual(result.fileName, "large.redacted.pdf");
  assert.strictEqual(result.truncated, true);
  assert.ok(result.bytes.byteLength > 0);
  assert.strictEqual(bytesText.includes(rawSecret), false);
  assert.strictEqual(extracted.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(extracted.text.includes(rawSecret), false);
  assert.ok(extracted.text.includes("API_KEY=[PWM_1]"));
  assert.ok(extracted.text.includes("SAFE_LINE_START"));
  assert.strictEqual(extracted.text.includes("SAFE_LINE_AFTER_LIMIT"), false);
}

function testEmptySanitizedPdfTextDoesNotProduceProofPdf() {
  const result = PdfRedactor.createRedactedPdfFromExtraction({
    originalName: "empty-sanitized.pdf",
    extraction: { status: EXTRACTOR_STATUS.OK, kind: "pdf", safeForScan: true },
    sanitizedText: " \n\t "
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, "pdf_redacted_text_empty");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "bytes"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "fileName"), false);
}

async function testProtectedSitePdfFallbackContractRemainsDocumentedByProof() {
  const source = require("fs").readFileSync(
    path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"),
    "utf8"
  );

  assert.ok(source.includes('const EXTRACTED_TEXT_OUTPUT_KINDS = new Set(["pdf", "docx", "xlsx", "image_metadata", "image_ocr"]);'));
  assert.ok(source.includes("buildRedactedTxtName"));
  assert.ok(source.includes("createRedactedPdfFromExtraction"));
  assert.ok(source.includes("redactedPdf.truncated !== true"));
  assert.ok(source.includes("pdf-redaction:pdf_redacted_text_truncated"));
}

function testScannerPageWiresPdfProofOutputFromSanitizedText() {
  const scannerHtml = require("fs").readFileSync(path.join(repoRoot, "src/scanner/scanner.html"), "utf8");
  const scannerSource = require("fs").readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");

  assert.ok(scannerHtml.includes("download-redacted-pdf-btn"), "scanner page should expose a PDF proof export button");
  assert.ok(scannerHtml.includes("Download Redacted PDF"), "scanner page should label the PDF proof export clearly");
  assert.ok(scannerSource.includes("currentRedactedPdf"), "scanner should track regenerated PDF proof state separately");
  assert.ok(
    scannerSource.includes("createRedactedPdfFromExtraction") &&
      scannerSource.includes("sanitizedText: result?.redactedText"),
    "scanner should generate PDFs through sanitized extracted text"
  );
  assert.ok(scannerSource.includes("downloadRedactedPdf"), "scanner should expose a dedicated PDF download handler");
  assert.ok(
    scannerSource.includes("pdf-redaction:pdf_redacted_text_truncated"),
    "scanner should surface bounded regenerated PDF output in sanitized report warnings"
  );
  assert.ok(scannerSource.includes("redactedFileName(currentScanResult.file.name)"), ".redacted.txt fallback download should remain available");
  assert.strictEqual(
    scannerSource.includes("downloadBlob(\n      currentScanResult.redactedText || \"\",\n      \"application/pdf"),
    false,
    "scanner must not turn raw/redacted text download path into a PDF MIME path"
  );
}

function testNoPersistenceLoggingOrOriginalStreamInputs() {
  const source = require("fs").readFileSync(path.join(repoRoot, "src/shared/pdfRedactor.js"), "utf8");

  for (const forbidden of [
    "localStorage",
    "sessionStorage",
    "chrome.storage",
    "browser.storage",
    "pwm:audit",
    "console.log",
    "console.warn",
    "console.error",
    "originalPdf",
    "originalBytes",
    "sourcePdf",
    "overlay",
    "black box",
    "redaction rectangle",
    "canvas"
  ]) {
    assert.strictEqual(source.includes(forbidden), false, `pdfRedactor proof must not include ${forbidden}`);
  }
}

(async () => {
  testOutputNameNormalization();
  await testGeneratedPdfContainsOnlySanitizedText();
  await testGeneratedPdfExcludesSourcePdfStreamsAndMarkers();
  await testUnsafePdfInputsDoNotProduceProofPdf();
  await testLargeSanitizedPdfOutputIsBoundedAndSafe();
  testEmptySanitizedPdfTextDoesNotProduceProofPdf();
  await testProtectedSitePdfFallbackContractRemainsDocumentedByProof();
  testScannerPageWiresPdfProofOutputFromSanitizedText();
  testNoPersistenceLoggingOrOriginalStreamInputs();
  console.log("PASS PDF redacted output proof regressions");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
