const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

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
require(path.join(repoRoot, "src/shared/knownSecretReuse.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/shared/fileLimits.js"));
require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/shared/fileExtractors.js"));
require(path.join(repoRoot, "src/shared/fileScanner.js"));
require(path.join(repoRoot, "src/content/file_paste_helpers.js"));
require(path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"));

const { processFileForAdapterHandoff } = globalThis.PWM.ContentFileExtractionPipeline;

const RAW_SECRET = "sk-proj-LeakGuardPhaseTenContentPipelineSecret1234567890abcdef";

class TestFile {
  constructor(parts, name, options = {}) {
    this.parts = parts.map((part) => {
      if (part instanceof ArrayBuffer) return Buffer.from(part);
      if (ArrayBuffer.isView(part)) return Buffer.from(part.buffer, part.byteOffset, part.byteLength);
      return Buffer.from(String(part), "utf8");
    });
    this.name = name;
    this.type = options.type || "";
    this.lastModified = options.lastModified || 1234;
    this.size = this.parts.reduce((total, part) => total + part.length, 0);
  }

  async arrayBuffer() {
    const buffer = Buffer.concat(this.parts);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  async text() {
    return Buffer.concat(this.parts).toString("utf8");
  }
}

globalThis.File = TestFile;

function bufferFromText(text) {
  return new TextEncoder().encode(text).buffer;
}

function fileFromBuffer(name, type, buffer) {
  return new TestFile([buffer], name, { type });
}

function escapePdfText(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makePdf(text, options = {}) {
  const streamText = options.imageOnly
    ? "q\n10 0 0 10 0 0 cm\n/Im1 Do\nQ\n"
    : `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\n`;
  const stream = Buffer.from(streamText, "binary");
  const parts = [
    "%PDF-1.4",
    "1 0 obj",
    "<< /Type /Catalog /Pages 2 0 R >>",
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

function writeUInt32LE(buffer, value, offset) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function makeZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(String(entry.data || ""), "utf8");
    const compressed = zlib.deflateRawSync(raw);
    const header = Buffer.alloc(30);
    writeUInt32LE(header, 0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(entry.encrypted ? 1 : 0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    writeUInt32LE(header, 0, 14);
    writeUInt32LE(header, compressed.length, 18);
    writeUInt32LE(header, raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, name, compressed);
  }
  const buffer = Buffer.concat(chunks);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeDocx(text) {
  return makeZip([
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`
    }
  ]);
}

function makeXlsx(text) {
  return makeZip([
    {
      name: "xl/workbook.xml",
      data: '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Secrets" sheetId="1"/></sheets></workbook>'
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c></row></sheetData></worksheet>`
    }
  ]);
}

async function readFileText(file) {
  return typeof file?.text === "function" ? String(await file.text()) : String(file?.text || "");
}

function assertNormalizedReadyResult(result, expected) {
  assert.strictEqual(result.status, "ready");
  assert.strictEqual(result.originalName, expected.originalName);
  assert.strictEqual(result.outputName, expected.outputName);
  assert.strictEqual(result.outputKind, expected.outputKind);
  assert.strictEqual(result.extractedKind, expected.extractedKind);
  assert.strictEqual(result.safeForUpload, true);
  assert.strictEqual(result.fallbackReason, "");
  assert.ok(result.sanitizedText.includes("[PWM_1]"));
  assert.strictEqual(result.sanitizedText.includes(RAW_SECRET), false);
  assert.strictEqual(result.sanitizedFile.name, expected.outputName);
  assert.deepStrictEqual(Object.keys(result).sort(), [
    "extractedKind",
    "fallbackReason",
    "metadata",
    "originalName",
    "outputKind",
    "outputName",
    "safeForUpload",
    "sanitizedFile",
    "sanitizedText",
    "status",
    "warnings"
  ].sort());
}

async function testTextFilePreservesExistingSanitizedOutputName() {
  const file = new TestFile([`API_KEY=${RAW_SECRET}`], "service.env", { type: "text/plain" });
  const result = await processFileForAdapterHandoff({ file, context: "drop" });

  assertNormalizedReadyResult(result, {
    originalName: "service.env",
    outputName: "service.env",
    outputKind: "sanitized_text_file",
    extractedKind: "text"
  });
  assert.strictEqual(await readFileText(result.sanitizedFile), result.sanitizedText);
}

async function testPdfProducesRedactedTxtOutput() {
  const file = fileFromBuffer("contract.pdf", "application/pdf", makePdf(`token ${RAW_SECRET}`));
  const result = await processFileForAdapterHandoff({ file, context: "drop" });

  assertNormalizedReadyResult(result, {
    originalName: "contract.pdf",
    outputName: "contract.redacted.txt",
    outputKind: "redacted_text_file",
    extractedKind: "pdf"
  });
}

async function testDocxProducesRedactedTxtOutput() {
  const file = fileFromBuffer(
    "brief.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    makeDocx(`token ${RAW_SECRET}`)
  );
  const result = await processFileForAdapterHandoff({ file, context: "drop" });

  assertNormalizedReadyResult(result, {
    originalName: "brief.docx",
    outputName: "brief.redacted.txt",
    outputKind: "redacted_text_file",
    extractedKind: "docx"
  });
}

async function testXlsxProducesRedactedTxtOutput() {
  const file = fileFromBuffer(
    "sheet.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    makeXlsx(`token ${RAW_SECRET}`)
  );
  const result = await processFileForAdapterHandoff({ file, context: "drop" });

  assertNormalizedReadyResult(result, {
    originalName: "sheet.xlsx",
    outputName: "sheet.redacted.txt",
    outputKind: "redacted_text_file",
    extractedKind: "xlsx"
  });
}

async function testImageMetadataProducesRedactedTxtOutput() {
  const file = fileFromBuffer(
    `diagram-${RAW_SECRET}.png`,
    "image/png",
    bufferFromText("pixel bytes are not OCR input")
  );
  const result = await processFileForAdapterHandoff({ file, context: "drop" });

  assertNormalizedReadyResult(result, {
    originalName: `diagram-${RAW_SECRET}.png`,
    outputName: "diagram-[PWM_1].redacted.txt",
    outputKind: "redacted_text_file",
    extractedKind: "image_metadata"
  });
  assert.ok(result.warnings.includes("image_ocr_not_supported"));
}

async function testScannedPdfFailsClosedWithoutSanitizedFile() {
  const file = fileFromBuffer("scan.pdf", "application/pdf", makePdf("", { imageOnly: true }));
  const result = await processFileForAdapterHandoff({ file, context: "drop" });

  assert.strictEqual(result.status, "blocked");
  assert.strictEqual(result.safeForUpload, false);
  assert.strictEqual(result.sanitizedFile, null);
  assert.strictEqual(result.sanitizedText, "");
  assert.strictEqual(result.fallbackReason, "pdf_no_extractable_text");
}

async function testMacroAndLegacyFormatsStayUnsupported() {
  for (const file of [
    new TestFile(["legacy"], "legacy.doc", { type: "application/msword" }),
    new TestFile(["macro"], "macro.docm", { type: "application/vnd.ms-word.document.macroEnabled.12" }),
    new TestFile(["legacy"], "legacy.xls", { type: "application/vnd.ms-excel" }),
    new TestFile(["macro"], "macro.xlsm", { type: "application/vnd.ms-excel.sheet.macroEnabled.12" })
  ]) {
    const result = await processFileForAdapterHandoff({ file, context: "drop" });

    assert.strictEqual(result.status, "unsupported", `${file.name} should stay unsupported`);
    assert.strictEqual(result.safeForUpload, false);
    assert.strictEqual(result.sanitizedFile, null);
  }
}

async function testDebugMetadataExcludesRawExtractedText() {
  const file = fileFromBuffer("brief.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", makeDocx(RAW_SECRET));
  const result = await processFileForAdapterHandoff({ file, context: "drop" });
  const metadataJson = JSON.stringify(result.metadata);

  assert.strictEqual(result.sanitizedText.includes(RAW_SECRET), false);
  assert.strictEqual(metadataJson.includes(RAW_SECRET), false);
  assert.strictEqual(metadataJson.includes("token"), false);
}

function testExtractionIsNotOnTypingPath() {
  const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
  const beforeInputSource = /async function maybeHandleBeforeInput\(event\) \{([\s\S]*?)\n  async function/.exec(contentSource)?.[1] || "";
  const typedSecretsSource = /async function maybeHandleTypedSecrets\(\) \{([\s\S]*?)\n  function/.exec(contentSource)?.[1] || "";

  assert.strictEqual(beforeInputSource.includes("processFileForAdapterHandoff"), false);
  assert.strictEqual(typedSecretsSource.includes("processFileForAdapterHandoff"), false);
}

async function run() {
  await testTextFilePreservesExistingSanitizedOutputName();
  await testPdfProducesRedactedTxtOutput();
  await testDocxProducesRedactedTxtOutput();
  await testXlsxProducesRedactedTxtOutput();
  await testImageMetadataProducesRedactedTxtOutput();
  await testScannedPdfFailsClosedWithoutSanitizedFile();
  await testMacroAndLegacyFormatsStayUnsupported();
  await testDebugMetadataExcludesRawExtractedText();
  testExtractionIsNotOnTypingPath();
}

run().then(() => {
  console.log("PASS content file extraction pipeline regressions");
});
