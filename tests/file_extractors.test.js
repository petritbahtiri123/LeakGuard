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
  PDF_TEXT_EXTRACTION_MAX_BYTES,
  DOCX_TEXT_EXTRACTION_MAX_BYTES,
  XLSX_TEXT_EXTRACTION_MAX_BYTES
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

function dosDateTime() {
  return { time: 0, date: 0 };
}

function writeUInt32LE(buffer, value, offset) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function makeZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data || ""), "utf8");
    const method = entry.method ?? 8;
    const compressed =
      method === 8
        ? zlib.deflateRawSync(raw)
        : method === 0
          ? raw
          : Buffer.from(entry.compressedData || raw);
    const header = Buffer.alloc(30);
    const { time, date } = dosDateTime();
    writeUInt32LE(header, 0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(entry.encrypted ? 1 : 0, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
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

function docxParagraph(text) {
  return `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function docxXml(text, options = {}) {
  const body = String(text)
    .split("\n")
    .map((line) => docxParagraph(line))
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}${options.imageOnly ? "<w:p><w:r><w:drawing /></w:r></w:p>" : ""}</w:body></w:document>`;
}

function makeDocx(text, options = {}) {
  if (options.malformed) return bufferFromText("not a zip");
  const entries = [];
  if (options.contentTypes !== false) {
    entries.push({
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    });
  }
  if (options.encrypted) {
    entries.push({ name: "EncryptedPackage", data: "encrypted", encrypted: true });
  }
  if (options.document !== false) {
    entries.push({
      name: "word/document.xml",
      data: options.imageOnly ? docxXml("", { imageOnly: true }) : docxXml(text),
      method: options.method
    });
  }
  if (options.headerText) {
    entries.push({ name: "word/header1.xml", data: docxXml(options.headerText) });
  }
  if (options.footerText) {
    entries.push({ name: "word/footer1.xml", data: docxXml(options.footerText) });
  }
  if (options.footnoteText) {
    entries.push({ name: "word/footnotes.xml", data: docxXml(options.footnoteText) });
  }
  return makeZip(entries);
}

function xlsxSharedStrings(values = []) {
  const strings = values
    .map((value) => `<si><t>${escapeXml(value)}</t></si>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings}</sst>`;
}

function xlsxWorkbook(sheetNames = ["Sheet1"]) {
  const sheets = sheetNames
    .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
}

function xlsxWorksheet(cells = []) {
  const cellXml = cells
    .map((cell, index) => {
      const ref = cell.ref || `A${index + 1}`;
      if (cell.type === "shared") {
        return `<c r="${ref}" t="s"><v>${cell.value}</v></c>`;
      }
      if (cell.type === "inline") {
        return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell.value)}</t></is></c>`;
      }
      if (cell.type === "formula") {
        const valueXml = cell.cachedValue === undefined ? "" : `<v>${escapeXml(cell.cachedValue)}</v>`;
        return `<c r="${ref}"><f>${escapeXml(cell.value)}</f>${valueXml}</c>`;
      }
      return `<c r="${ref}"><v>${escapeXml(cell.value)}</v></c>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cellXml}</row></sheetData></worksheet>`;
}

function makeXlsx(options = {}) {
  if (options.malformed) return bufferFromText("not a zip");
  const entries = [];
  if (options.encrypted) {
    entries.push({ name: "EncryptedPackage", data: "encrypted", encrypted: true });
  }
  if (options.workbook !== false) {
    entries.push({ name: "xl/workbook.xml", data: xlsxWorkbook(options.sheetNames || ["Secrets"]) });
  }
  if (options.sharedStrings !== false) {
    entries.push({ name: "xl/sharedStrings.xml", data: xlsxSharedStrings(options.sharedStrings || []) });
  }
  if (options.worksheet !== false) {
    entries.push({
      name: "xl/worksheets/sheet1.xml",
      data: xlsxWorksheet(options.cells || []),
      method: options.method
    });
  }
  if (options.imageOnly) {
    entries.push({ name: "xl/media/image1.png", data: "not scanned" });
  }
  return makeZip(entries);
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
    ["sheet.xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
    ["sheet.xltm", "application/vnd.ms-excel.template.macroEnabled.12"],
    ["sheet.xlsb", "application/vnd.ms-excel.sheet.binary.macroEnabled.12"]
  ]) {
    const result = prepareFileExtraction({ fileName, mimeType, text: "SHOULD_NOT_PARSE" });
    assert.strictEqual(result.status, EXTRACTOR_STATUS.UNSUPPORTED, `${fileName} should stay unsupported`);
    assert.strictEqual(result.safeForScan, false);
  }
}

async function testSafeXlsxTextExtractsLocally() {
  const syncResult = prepareFileExtraction({
    fileName: "budget.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    text: "XLSX text must come from bytes"
  });
  const result = await prepareFileExtractionAsync({
    fileName: "budget.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: makeXlsx({
      sheetNames: ["Accounts"],
      sharedStrings: ["service account"],
      cells: [
        { type: "shared", value: 0 },
        { type: "inline", value: "inline note" },
        { type: "plain", value: "42" }
      ]
    })
  });

  assert.strictEqual(syncResult.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(syncResult.safeForScan, false);
  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(result.kind, "xlsx");
  assert.ok(result.text.includes("Accounts"));
  assert.ok(result.text.includes("service account"));
  assert.ok(result.text.includes("inline note"));
  assert.ok(result.text.includes("42"));
  assert.strictEqual(result.safeForScan, true);
  assert.strictEqual(result.metadata.fileName, "budget.xlsx");
  assert.strictEqual(result.metadata.textLength, result.text.length);
}

async function testXlsxSecretsFeedExistingScannerWithoutRawReportMetadata() {
  const rawSecret = "sk-proj-LeakGuardXlsxApiKey1234567890abcdef";
  const result = await prepareFileExtractionAsync({
    fileName: "secret.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: makeXlsx({
      sharedStrings: [`API key: ${rawSecret}`],
      cells: [{ type: "shared", value: 0 }]
    })
  });
  const scan = scanTextContent({
    fileName: "secret.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: result.metadata.textLength,
    text: result.text,
    extractedText: true,
    mode: "hide_public"
  });
  const report = buildSanitizedReport(scan);
  const metadataOnly = JSON.stringify({
    extractorMetadata: result.metadata,
    file: scan.file,
    summary: scan.summary,
    findings: scan.findings,
    report
  });

  assert.strictEqual(result.safeForScan, true);
  assert.ok(scan.summary.findingsCount > 0);
  assert.strictEqual(scan.redactedText.includes(rawSecret), false);
  assert.strictEqual(metadataOnly.includes(rawSecret), false);
}

async function testXlsxEnvMultilineInlineAndFormulaTextExtract() {
  const result = await prepareFileExtractionAsync({
    fileName: "secrets.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: makeXlsx({
      sharedStrings: [
        "OPENAI_API_KEY=sk-proj-LeakGuardXlsxEnvKey1234567890abcdef",
        "PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nabc123secret\n-----END PRIVATE KEY-----"
      ],
      cells: [
        { type: "shared", value: 0 },
        { type: "shared", value: 1 },
        { type: "inline", value: "X-API-Key: inline-secret-value-1234567890" },
        { type: "formula", value: '"sk-proj-FormulaTextOnly1234567890abcdef"', cachedValue: "0" }
      ]
    })
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.ok(result.text.includes("OPENAI_API_KEY="));
  assert.ok(result.text.includes("\nabc123secret\n"));
  assert.ok(result.text.includes("X-API-Key:"));
  assert.ok(result.text.includes("sk-proj-FormulaTextOnly1234567890abcdef"));
  assert.ok(result.text.includes("0"));
}

async function assertXlsxExtractionError(name, buffer, expectedReason) {
  const result = await prepareFileExtractionAsync({
    fileName: name,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(result.kind, "xlsx");
  assert.strictEqual(result.text, "");
  assert.strictEqual(result.safeForScan, false);
  assert.strictEqual(result.reason, expectedReason);
}

async function testUnreadableXlsxCasesFailClosed() {
  await assertXlsxExtractionError("empty.xlsx", makeXlsx({ cells: [], sharedStrings: [], sheetNames: [] }), "xlsx_no_extractable_text");
  await assertXlsxExtractionError("malformed.xlsx", makeXlsx({ malformed: true }), "xlsx_malformed_zip");
  await assertXlsxExtractionError("encrypted.xlsx", makeXlsx({ encrypted: true }), "xlsx_encrypted");
  await assertXlsxExtractionError("unsupported-compression.xlsx", makeXlsx({ cells: [{ type: "plain", value: "secret" }], method: 12 }), "xlsx_unsupported_compression");
  await assertXlsxExtractionError("image-only.xlsx", makeXlsx({ imageOnly: true, workbook: false, sharedStrings: false, worksheet: false }), "xlsx_no_extractable_text");
}

async function testLargeXlsxTextExtractionLimit() {
  const result = await prepareFileExtractionAsync({
    fileName: "large.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: makeXlsx({
      cells: [{ type: "inline", value: "A".repeat(XLSX_TEXT_EXTRACTION_MAX_BYTES + 1) }]
    })
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(result.reason, "xlsx_text_too_large");
  assert.strictEqual(result.safeForScan, false);
  assert.strictEqual(result.text, "");
}

async function testXlsxMimeMismatchAndLegacyFormatsDoNotBypassGates() {
  const wrongMimeXlsx = await prepareFileExtractionAsync({
    fileName: "wrong-mime.xlsx",
    mimeType: "text/plain",
    buffer: makeXlsx({ cells: [{ type: "plain", value: "XLSX extension controls extraction" }] })
  });
  const mimeOnlyXlsx = await prepareFileExtractionAsync({
    fileName: "not-xlsx.txt",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: makeXlsx({ cells: [{ type: "plain", value: "MIME alone must not parse XLSX" }] })
  });

  assert.strictEqual(wrongMimeXlsx.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(wrongMimeXlsx.kind, "xlsx");
  assert.strictEqual(mimeOnlyXlsx.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(mimeOnlyXlsx.kind, "text");
  assert.strictEqual(mimeOnlyXlsx.text, "");
  for (const name of ["legacy.xls", "macro.xlsm", "template.xltm", "binary.xlsb"]) {
    const result = await prepareFileExtractionAsync({
      fileName: name,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: makeXlsx({ cells: [{ type: "plain", value: "must not parse" }] })
    });
    assert.strictEqual(result.status, EXTRACTOR_STATUS.UNSUPPORTED, `${name} should be rejected`);
    assert.strictEqual(result.safeForScan, false);
  }
}

async function testSafeDocxTextExtractsLocally() {
  const syncResult = prepareFileExtraction({
    fileName: "notes.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    text: "DOCX text must come from bytes"
  });
  const result = await prepareFileExtractionAsync({
    fileName: "notes.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocx("Release notes only", {
      headerText: "Header text",
      footerText: "Footer text",
      footnoteText: "Footnote text"
    })
  });

  assert.strictEqual(syncResult.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(syncResult.safeForScan, false);
  assert.strictEqual(syncResult.text, "");
  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(result.kind, "docx");
  assert.ok(result.text.includes("Release notes only"));
  assert.ok(result.text.includes("Header text"));
  assert.ok(result.text.includes("Footer text"));
  assert.ok(result.text.includes("Footnote text"));
  assert.strictEqual(result.safeForScan, true);
  assert.strictEqual(result.metadata.fileName, "notes.docx");
  assert.strictEqual(result.metadata.textLength, result.text.length);
}

async function testDocxSecretsFeedExistingScannerWithoutRawReportMetadata() {
  const rawSecret = "sk-proj-LeakGuardDocxApiKey1234567890abcdef";
  const result = await prepareFileExtractionAsync({
    fileName: "secret.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocx(`API key: ${rawSecret}`)
  });
  const scan = scanTextContent({
    fileName: "secret.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

async function testDocxEnvAndMultilineSecretsExtract() {
  const text = [
    "OPENAI_API_KEY=sk-proj-LeakGuardDocxEnvKey1234567890abcdef",
    "PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nabc123secret\n-----END PRIVATE KEY-----"
  ].join("\n");
  const result = await prepareFileExtractionAsync({
    fileName: "secrets.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocx(text)
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.ok(result.text.includes("OPENAI_API_KEY="));
  assert.ok(result.text.includes("PRIVATE_KEY="));
  assert.ok(result.text.includes("\nabc123secret\n"));
}

async function assertDocxExtractionError(name, buffer, expectedReason) {
  const result = await prepareFileExtractionAsync({
    fileName: name,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(result.kind, "docx");
  assert.strictEqual(result.text, "");
  assert.strictEqual(result.safeForScan, false);
  assert.strictEqual(result.reason, expectedReason);
}

async function testUnreadableDocxCasesFailClosed() {
  await assertDocxExtractionError("empty.docx", makeDocx(""), "docx_no_extractable_text");
  await assertDocxExtractionError("encrypted.docx", makeDocx("secret", { encrypted: true }), "docx_encrypted");
  await assertDocxExtractionError("malformed.docx", makeDocx("", { malformed: true }), "docx_malformed_zip");
  await assertDocxExtractionError("image-only.docx", makeDocx("", { imageOnly: true }), "docx_no_extractable_text");
  await assertDocxExtractionError("unsupported-compression.docx", makeDocx("secret", { method: 12 }), "docx_unsupported_compression");
}

async function testLargeDocxTextExtractionLimit() {
  const result = await prepareFileExtractionAsync({
    fileName: "large.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocx("A".repeat(DOCX_TEXT_EXTRACTION_MAX_BYTES + 1))
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(result.reason, "docx_text_too_large");
  assert.strictEqual(result.safeForScan, false);
  assert.strictEqual(result.text, "");
}

async function testDocxMimeMismatchDoesNotBypassGates() {
  const wrongMimeDocx = await prepareFileExtractionAsync({
    fileName: "wrong-mime.docx",
    mimeType: "text/plain",
    buffer: makeDocx("DOCX extension still controls extraction")
  });
  const mimeOnlyDocx = await prepareFileExtractionAsync({
    fileName: "not-a-docx.txt",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocx("MIME alone must not switch text file path")
  });
  const legacyDoc = await prepareFileExtractionAsync({
    fileName: "legacy.doc",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocx("legacy doc must stay disabled")
  });
  const macroDocm = await prepareFileExtractionAsync({
    fileName: "macro.docm",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocx("macro docm must stay disabled")
  });

  assert.strictEqual(wrongMimeDocx.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(wrongMimeDocx.kind, "docx");
  assert.strictEqual(mimeOnlyDocx.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(mimeOnlyDocx.kind, "text");
  assert.strictEqual(mimeOnlyDocx.text, "");
  assert.strictEqual(legacyDoc.status, EXTRACTOR_STATUS.UNSUPPORTED);
  assert.strictEqual(legacyDoc.safeForScan, false);
  assert.strictEqual(macroDocm.status, EXTRACTOR_STATUS.UNSUPPORTED);
  assert.strictEqual(macroDocm.safeForScan, false);
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
  assert.strictEqual(docxWithPdfMime.status, EXTRACTOR_STATUS.ERROR);
  assert.strictEqual(docxWithPdfMime.kind, "docx");
  assert.strictEqual(docxWithPdfMime.reason, "docx_malformed_zip");
  assert.strictEqual(docxWithPdfMime.safeForScan, false);
}

function testPdfBundleBudget() {
  const source = fs.readFileSync(path.join(repoRoot, "src/shared/fileExtractors.js"), "utf8");
  assert.ok(source.length < 52000, "file extractor shell should stay below the agreed lightweight bundle budget");
  assert.strictEqual(source.includes("import("), false);
  assert.strictEqual(source.includes("eval("), false);
  assert.strictEqual(source.includes("require("), false);
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
  await testSafeDocxTextExtractsLocally();
  await testDocxSecretsFeedExistingScannerWithoutRawReportMetadata();
  await testDocxEnvAndMultilineSecretsExtract();
  await testUnreadableDocxCasesFailClosed();
  await testLargeDocxTextExtractionLimit();
  await testDocxMimeMismatchDoesNotBypassGates();
  await testSafeXlsxTextExtractsLocally();
  await testXlsxSecretsFeedExistingScannerWithoutRawReportMetadata();
  await testXlsxEnvMultilineInlineAndFormulaTextExtract();
  await testUnreadableXlsxCasesFailClosed();
  await testLargeXlsxTextExtractionLimit();
  await testXlsxMimeMismatchAndLegacyFormatsDoNotBypassGates();
  testPdfBundleBudget();
  console.log("PASS file extractor shell regressions");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
