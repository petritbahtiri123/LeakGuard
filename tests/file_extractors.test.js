const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const fuzzFixtures = require("./fixtures/file_fuzz_fixtures.js");

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

function ascii85Encode(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let output = "<~";

  for (let index = 0; index < bytes.length; index += 4) {
    const chunk = bytes.slice(index, index + 4);
    const padded = Buffer.alloc(4);
    chunk.copy(padded);
    const value = padded.readUInt32BE(0);

    if (chunk.length === 4 && value === 0) {
      output += "z";
      continue;
    }

    const encoded = new Array(5);
    let current = value;
    for (let digit = 4; digit >= 0; digit -= 1) {
      encoded[digit] = String.fromCharCode((current % 85) + 33);
      current = Math.floor(current / 85);
    }
    output += encoded.slice(0, chunk.length + 1).join("");
  }

  return `${output}~>`;
}

function makePdf(text, options = {}) {
  if (options.malformed) return bufferFromText("not a pdf");

  const streamText = options.imageOnly
    ? "q\n10 0 0 10 0 0 cm\n/Im1 Do\nQ\n"
    : options.splitTextArray
      ? `BT\n/F1 12 Tf\n72 720 Td\n[${String(text)
          .match(options.splitTextArray)
          .map((part) => `(${escapePdfText(part)})`)
          .join(" 12 ")}] TJ\nET\n`
    : `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\n`;
  const stream = options.ascii85Flate
    ? ascii85Encode(zlib.deflateSync(Buffer.from(streamText, "binary")))
    : options.flate
      ? zlib.deflateSync(Buffer.from(streamText, "binary"))
      : streamText;
  const encryptMarker = options.encrypted ? "\n/Encrypt 6 0 R\n" : "";
  const streamHeader = options.ascii85Flate
    ? `<< /Length ${stream.length} /Filter [ /ASCII85Decode /FlateDecode ] >>`
    : options.flate
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

function xlsxComments(values = []) {
  const commentXml = values.map((value) => `<comment><text><t>${escapeXml(value)}</t></text></comment>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><commentList>${commentXml}</commentList></comments>`;
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
  if (options.comments) {
    entries.push({ name: "xl/comments1.xml", data: xlsxComments(options.comments) });
  }
  return makeZip(entries);
}

function makeNamespacedWorksheetXlsx(cells = []) {
  const cellXml = cells
    .map((cell, index) => {
      const ref = cell.ref || `A${index + 1}`;
      return `<x:c r="${ref}"><x:v>${escapeXml(cell.value)}</x:v></x:c>`;
    })
    .join("");

  return makeZip([
    {
      name: "xl/workbook.xml",
      data:
        '<?xml version="1.0" encoding="UTF-8"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:sheets><x:sheet name="Secrets" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>'
    },
    {
      name: "xl/sharedStrings.xml",
      data:
        '<?xml version="1.0" encoding="UTF-8"?><x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"></x:sst>'
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1">${cellXml}</x:row></x:sheetData></x:worksheet>`
    }
  ]);
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

async function testImageMetadataExtractsSafeFieldsOnly() {
  for (const [fileName, mimeType] of [
    ["photo.png", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["photo.webp", "image/webp"]
  ]) {
    const result = await prepareFileExtractionAsync({
      fileName,
      mimeType,
      sizeBytes: 1536,
      buffer: bufferFromText("pixel text must not be scanned")
    });

    assert.strictEqual(result.status, EXTRACTOR_STATUS.OK, `${fileName} should extract metadata`);
    assert.strictEqual(result.kind, "image_metadata");
    assert.strictEqual(result.safeForScan, true);
    assert.ok(result.text.includes(`file_name=${fileName}`));
    assert.ok(result.text.includes(`extension=${fileName.slice(fileName.lastIndexOf("."))}`));
    assert.ok(result.text.includes(`mime_type=${mimeType}`));
    assert.ok(result.text.includes("size_bucket=small"));
    assert.strictEqual(result.text.includes("pixel text must not be scanned"), false);
    assert.strictEqual(result.metadata.visualContentScanned, false);
  }
}

async function testPhase17dDeterministicFuzzFixturesFailClosedAndStaySanitized() {
  const started = Date.now();
  const cases = fuzzFixtures.createPhase17dExtractorFuzzCases();

  assert.strictEqual(fuzzFixtures.PHASE_17D_FUZZ_SEED, "phase-17d-deterministic-seed-v1");
  assert.ok(cases.length >= 18, "Phase 17D should cover deterministic malformed, oversized, image, and legacy fixtures");

  for (const testCase of cases) {
    const result = await prepareFileExtractionAsync({
      fileName: testCase.fileName,
      mimeType: testCase.mimeType,
      sizeBytes: testCase.sizeBytes,
      buffer: testCase.buffer,
      text: testCase.text
    });
    const serializedSafeState = JSON.stringify({
      label: testCase.label,
      status: result.status,
      kind: result.kind,
      metadata: result.metadata,
      warnings: result.warnings,
      reason: result.reason,
      safeForScan: result.safeForScan
    });

    assert.strictEqual(
      serializedSafeState.includes(fuzzFixtures.PHASE_17D_RAW_MARKER),
      false,
      `${testCase.label} leaked raw marker in safe extractor state; seed=${fuzzFixtures.PHASE_17D_FUZZ_SEED}`
    );
    assert.ok(
      Date.now() - started < 5000,
      `${testCase.label} exceeded bounded extractor fuzz runtime; seed=${fuzzFixtures.PHASE_17D_FUZZ_SEED}`
    );
    if (testCase.expectedStatus) {
      assert.strictEqual(result.status, testCase.expectedStatus, `${testCase.label} status`);
    }
    if (testCase.expectedReason) {
      assert.strictEqual(result.reason, testCase.expectedReason, `${testCase.label} reason`);
    }
    if (testCase.safeForScan === false) {
      assert.strictEqual(result.safeForScan, false, `${testCase.label} should fail closed`);
      assert.strictEqual(result.text, "", `${testCase.label} should not expose extracted raw text`);
    }
    if (testCase.expectRawMarkerRedactedByScanner) {
      const scan = scanTextContent({
        fileName: testCase.fileName,
        mimeType: testCase.mimeType,
        sizeBytes: result.metadata.textLength || result.text.length,
        text: result.text,
        extractedText: result.kind !== "text",
        mode: "hide_public"
      });
      const report = buildSanitizedReport(scan);
      assert.strictEqual(scan.redactedText.includes(fuzzFixtures.PHASE_17D_RAW_MARKER), false, `${testCase.label} redacted text`);
      assert.strictEqual(JSON.stringify(report).includes(fuzzFixtures.PHASE_17D_RAW_MARKER), false, `${testCase.label} report`);
    }
  }
}

async function testImageFilenameSecretFeedsExistingScannerWithoutRawReportMetadata() {
  const rawSecret = "sk-proj-LeakGuardImageNameApiKey1234567890abcdef";
  const fileName = `diagram-${rawSecret}.png`;
  const result = await prepareFileExtractionAsync({
    fileName,
    mimeType: "image/png",
    sizeBytes: 2048,
    buffer: bufferFromText("ignored image bytes")
  });
  const scan = scanTextContent({
    fileName,
    mimeType: "image/png",
    sizeBytes: result.metadata.textLength,
    text: result.text,
    extractedText: true,
    mode: "hide_public"
  });
  const report = buildSanitizedReport(scan);
  const reportJson = JSON.stringify(report);

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.ok(scan.summary.findingsCount > 0);
  assert.strictEqual(scan.redactedText.includes(rawSecret), false);
  assert.strictEqual(reportJson.includes(rawSecret), false);
  assert.strictEqual(JSON.stringify(result.metadata).includes(rawSecret), false);
}

async function testSafeImageFilenameHasNoFindingsAndReportsOcrUnsupported() {
  const result = await prepareFileExtractionAsync({
    fileName: "vacation-photo.png",
    mimeType: "image/png",
    sizeBytes: 4096,
    buffer: bufferFromText("ignored image bytes")
  });
  const scan = scanTextContent({
    fileName: "vacation-photo.png",
    mimeType: "image/png",
    sizeBytes: result.metadata.textLength,
    text: result.text,
    extractedText: true,
    mode: "hide_public"
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(scan.summary.findingsCount, 0);
  assert.ok(result.warnings.includes("image_ocr_not_supported"));
  assert.ok(result.text.includes("visual_text_scanned=false"));
  assert.ok(result.text.includes("image_ocr_supported=false"));
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

async function testNamespacedXlsxSecretsExtractAndRedactLocally() {
  const rawSecret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  const result = await prepareFileExtractionAsync({
    fileName: "namespaced-secrets.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: makeNamespacedWorksheetXlsx([
      { value: "AWS Secret Key" },
      { value: rawSecret }
    ])
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(result.safeForScan, true);
  assert.ok(result.text.includes(rawSecret));

  const scan = scanTextContent({
    fileName: "namespaced-secrets.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: result.metadata.textLength,
    text: result.text,
    extractedText: true,
    mode: "hide_public"
  });
  const report = buildSanitizedReport(scan);

  assert.strictEqual(scan.redactedText.includes(rawSecret), false);
  assert.match(scan.redactedText, /AWS Secret Key\s+\[PWM_\d+\]/);
  assert.strictEqual(JSON.stringify(report).includes(rawSecret), false);
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

async function testRepeatedXlsxExtractionKeepsXmlOrderingAndMetadataStable() {
  const buffer = makeXlsx({
    sheetNames: ["Accounts & Billing"],
    sharedStrings: ["shared alpha", "shared beta"],
    cells: [
      { type: "shared", value: 0 },
      { type: "shared", value: 1 },
      { type: "inline", value: "inline <note> & value" },
      { type: "formula", value: '"formula & value"', cachedValue: "42" }
    ],
    comments: ["comment one", "comment two"]
  });
  const runs = [];

  for (let index = 0; index < 3; index += 1) {
    runs.push(
      await prepareFileExtractionAsync({
        fileName: "stable.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer
      })
    );
  }

  for (const result of runs) {
    assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
    assert.strictEqual(result.safeForScan, true);
    assert.strictEqual(result.metadata.textLength, result.text.length);
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.reason, "");
  }

  assert.strictEqual(runs[1].text, runs[0].text);
  assert.strictEqual(runs[2].text, runs[0].text);
  assert.strictEqual(runs[1].metadata.textLength, runs[0].metadata.textLength);
  assert.strictEqual(runs[2].metadata.textLength, runs[0].metadata.textLength);
  assert.ok(runs[0].text.indexOf("Accounts & Billing") < runs[0].text.indexOf("shared alpha"));
  assert.ok(runs[0].text.indexOf("shared alpha") < runs[0].text.indexOf("shared beta"));
  assert.ok(runs[0].text.indexOf("shared beta") < runs[0].text.indexOf("inline <note> & value"));
  assert.ok(runs[0].text.indexOf("inline <note> & value") < runs[0].text.indexOf("formula & value"));
  assert.ok(runs[0].text.indexOf("formula & value") < runs[0].text.indexOf("42"));
  assert.ok(runs[0].text.indexOf("42") < runs[0].text.indexOf("comment one"));
  assert.ok(runs[0].text.indexOf("comment one") < runs[0].text.indexOf("comment two"));
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

async function testPlannedImagesUseMetadataExtraction() {
  for (const [fileName, mimeType] of [
    ["diagram.png", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["capture.webp", "image/webp"]
  ]) {
    const routed = routeFileExtractor({ fileName, mimeType });
    const result = await prepareFileExtractionAsync({
      fileName,
      mimeType,
      sizeBytes: 128,
      buffer: bufferFromText("not OCR text")
    });

    assert.strictEqual(routed.status, EXTRACTOR_STATUS.OK, `${fileName} route should be enabled`);
    assert.strictEqual(routed.kind, "image_metadata");
    assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
    assert.strictEqual(result.kind, "image_metadata");
    assert.strictEqual(result.safeForScan, true);
    assert.strictEqual(result.text.includes("not OCR text"), false);
  }
}

async function testUnnamedClipboardImagesUseMimeMetadataExtraction() {
  for (const [fileName, mimeType] of [
    ["", "image/png"],
    ["image", "image/png"]
  ]) {
    const routed = routeFileExtractor({ fileName, mimeType });
    const result = await prepareFileExtractionAsync({
      fileName,
      mimeType,
      sizeBytes: 128,
      buffer: bufferFromText("clipboard image bytes must not be scanned as text")
    });

    assert.strictEqual(routed.status, EXTRACTOR_STATUS.OK, `${fileName || "(unnamed)"} route should be enabled`);
    assert.strictEqual(routed.kind, "image_metadata");
    assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
    assert.strictEqual(result.kind, "image_metadata");
    assert.strictEqual(result.safeForScan, true);
    assert.strictEqual(result.text.includes("clipboard image bytes"), false);
    assert.ok(result.text.includes(`mime_type=${mimeType}`));
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

async function testAscii85FlateTextPdfExtractsLocally() {
  const result = await prepareFileExtractionAsync({
    fileName: "reportlab-compressed.pdf",
    mimeType: "application/pdf",
    buffer: makePdf("ReportLab release notes", { ascii85Flate: true })
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(result.text, "ReportLab release notes");
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

async function testPdfTextArraysExtractAllStringParts() {
  const text = "OPENAI_API_KEY=sk-proj-LeakGuardPdfArrayKey1234567890abcdef";
  const result = await prepareFileExtractionAsync({
    fileName: "array-text.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(text, { splitTextArray: /OPENAI_|API_|KEY=.*$/g })
  });

  assert.strictEqual(result.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(result.safeForScan, true);
  assert.strictEqual(result.text, text);
}

async function testSplitAwsSecretLabelsRedactAcrossExtractedDocuments() {
  const rawSecret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  const text = ["AWS Secret Key", rawSecret].join("\n");
  const cases = [
    {
      fileName: "split-aws-secret.pdf",
      mimeType: "application/pdf",
      buffer: makePdf(text, { ascii85Flate: true })
    },
    {
      fileName: "split-aws-secret.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: makeDocx(text)
    },
    {
      fileName: "split-aws-secret.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: makeXlsx({
        sharedStrings: ["AWS Secret Key", rawSecret],
        cells: [
          { type: "shared", value: 0 },
          { type: "shared", value: 1 }
        ]
      })
    }
  ];

  for (const testCase of cases) {
    const result = await prepareFileExtractionAsync(testCase);
    const scan = scanTextContent({
      fileName: testCase.fileName,
      mimeType: testCase.mimeType,
      sizeBytes: result.metadata.textLength,
      text: result.text,
      extractedText: true,
      mode: "hide_public"
    });
    const report = buildSanitizedReport(scan);
    const safeState = JSON.stringify({
      extractorMetadata: result.metadata,
      file: scan.file,
      summary: scan.summary,
      findings: scan.findings,
      report
    });

    assert.strictEqual(result.status, EXTRACTOR_STATUS.OK, `${testCase.fileName} should extract locally`);
    assert.strictEqual(result.safeForScan, true, `${testCase.fileName} should be safe for scan`);
    assert.ok(result.text.includes(rawSecret), `${testCase.fileName} should reproduce the split AWS secret fixture`);
    assert.strictEqual(scan.redactedText.includes(rawSecret), false, `${testCase.fileName} should redact AWS secret`);
    assert.strictEqual(safeState.includes(rawSecret), false, `${testCase.fileName} metadata/report should not leak raw AWS secret`);
    assert.match(scan.redactedText, /AWS Secret Key\s+\[PWM_\d+\]/, `${testCase.fileName} should preserve label shape`);
  }
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
  assert.strictEqual(/tesseract|tensorflow|tfjs/i.test(source), false);
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
  await testPlannedImagesUseMetadataExtraction();
  await testUnnamedClipboardImagesUseMimeMetadataExtraction();
  testMimeOnlyPlannedTypesDoNotEnableParsing();
  testUnknownFileRemainsUnsupported();
  testResultShapeDefaults();
  testNoNewDependenciesAdded();
  await testSafeTextPdfExtractsLocally();
  await testFlateTextPdfExtractsLocally();
  await testAscii85FlateTextPdfExtractsLocally();
  await testPdfSecretsFeedExistingScannerWithoutRawReportMetadata();
  await testPdfEnvAndMultilineSecretsExtract();
  await testPdfTextArraysExtractAllStringParts();
  await testSplitAwsSecretLabelsRedactAcrossExtractedDocuments();
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
  await testNamespacedXlsxSecretsExtractAndRedactLocally();
  await testXlsxEnvMultilineInlineAndFormulaTextExtract();
  await testRepeatedXlsxExtractionKeepsXmlOrderingAndMetadataStable();
  await testUnreadableXlsxCasesFailClosed();
  await testLargeXlsxTextExtractionLimit();
  await testXlsxMimeMismatchAndLegacyFormatsDoNotBypassGates();
  await testImageMetadataExtractsSafeFieldsOnly();
  await testPhase17dDeterministicFuzzFixturesFailClosedAndStaySanitized();
  await testImageFilenameSecretFeedsExistingScannerWithoutRawReportMetadata();
  await testSafeImageFilenameHasNoFindingsAndReportsOcrUnsupported();
  testPdfBundleBudget();
  console.log("PASS file extractor shell regressions");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
