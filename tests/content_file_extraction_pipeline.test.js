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
require(path.join(repoRoot, "src/shared/pdfRedactor.js"));
require(path.join(repoRoot, "src/shared/policy.js"));
require(path.join(repoRoot, "src/shared/scannerOcr.js"));
require(path.join(repoRoot, "src/shared/imageRedactor.js"));
require(path.join(repoRoot, "src/content/file_paste_helpers.js"));
require(path.join(repoRoot, "src/content/files/fileExtractionSessionCache.js"));
require(path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"));

const { processFileForAdapterHandoff } = globalThis.PWM.ContentFileExtractionPipeline;
const ExtractionCache = globalThis.PWM.FileExtractionSessionCache;
const {
  PROTECTED_SITE_OCR_ENABLED_STORAGE_KEY,
  isProtectedSiteOcrEnabled,
  setProtectedSiteOcrEnabled
} = globalThis.PWM;
const ScannerOcr = globalThis.PWM.ScannerOcr;

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

async function readFileBuffer(file) {
  if (typeof file?.arrayBuffer !== "function") return Buffer.from([]);
  const buffer = await file.arrayBuffer();
  return Buffer.from(buffer);
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

async function testPdfProducesRedactedPdfOutputWhenCompleteAndSafe() {
  const file = fileFromBuffer("contract.pdf", "application/pdf", makePdf(`token ${RAW_SECRET}`));
  const result = await processFileForAdapterHandoff({ file, context: "drop" });

  assertNormalizedReadyResult(result, {
    originalName: "contract.pdf",
    outputName: "contract.redacted.pdf",
    outputKind: "redacted_pdf_file",
    extractedKind: "pdf"
  });
  assert.strictEqual(result.sanitizedFile.type, "application/pdf");
  assert.strictEqual(result.outputName.endsWith(".redacted.pdf"), true);
  assert.strictEqual(result.sanitizedText.includes(RAW_SECRET), false);

  const pdfBytes = await readFileBuffer(result.sanitizedFile);
  const pdfSource = pdfBytes.toString("utf8");
  assert.strictEqual(pdfSource.includes(RAW_SECRET), false);
  assert.ok(pdfSource.startsWith("%PDF-"));

  const extracted = await globalThis.PWM.FileExtractors.prepareFileExtractionAsync({
    fileName: result.outputName,
    mimeType: "application/pdf",
    sizeBytes: pdfBytes.length,
    buffer: pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
  });
  assert.strictEqual(extracted.safeForScan, true);
  assert.strictEqual(extracted.text.includes(RAW_SECRET), false);
  assert.ok(extracted.text.includes("[PWM_1]"));
}

async function testLargePdfFallsBackToRedactedTxtWhenRegeneratedPdfWouldTruncate() {
  const originalScan = globalThis.PWM.FileScanner.scanTextContent;
  const longSafeSuffix = `\n${"safe line ".repeat(25000)}`;
  const file = fileFromBuffer("large-contract.pdf", "application/pdf", makePdf(`token ${RAW_SECRET}`));
  globalThis.PWM.FileScanner.scanTextContent = (...args) => {
    const result = originalScan(...args);
    return {
      ...result,
      redactedText: `${result.redactedText}${longSafeSuffix}`,
      reportWarnings: Array.isArray(result.reportWarnings) ? result.reportWarnings.slice() : []
    };
  };

  let result;
  try {
    result = await processFileForAdapterHandoff({ file, context: "drop" });
  } finally {
    globalThis.PWM.FileScanner.scanTextContent = originalScan;
  }

  assertNormalizedReadyResult(result, {
    originalName: "large-contract.pdf",
    outputName: "large-contract.redacted.txt",
    outputKind: "redacted_text_file",
    extractedKind: "pdf"
  });
  assert.strictEqual(result.sanitizedFile.type, "text/plain");
  assert.ok(result.warnings.includes("pdf-redaction:pdf_redacted_text_truncated"));
  assert.strictEqual(JSON.stringify(result.warnings).includes(RAW_SECRET), false);
  assert.strictEqual(result.sanitizedText.includes(RAW_SECRET), false);
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

async function testProtectedSiteOcrDisabledByDefaultAndLocalPersistence() {
  const localStore = {};
  const syncStore = {};
  const storageArea = {
    async get(key) {
      return Object.prototype.hasOwnProperty.call(localStore, key) ? { [key]: localStore[key] } : {};
    },
    async set(values) {
      Object.assign(localStore, values);
    }
  };
  const syncStorageArea = {
    async get(key) {
      return Object.prototype.hasOwnProperty.call(syncStore, key) ? { [key]: syncStore[key] } : {};
    },
    async set(values) {
      Object.assign(syncStore, values);
    }
  };

  assert.strictEqual(await isProtectedSiteOcrEnabled({ storageArea, syncStorageArea }), false);
  await setProtectedSiteOcrEnabled(true, { storageArea, syncStorageArea });
  assert.strictEqual(await isProtectedSiteOcrEnabled({ storageArea, syncStorageArea }), true);
  assert.deepStrictEqual(localStore, { [PROTECTED_SITE_OCR_ENABLED_STORAGE_KEY]: true });
  assert.deepStrictEqual(syncStore, {});
}

async function testProtectedSiteImageAttachStaysMetadataOnlyWhenOcrSettingEnabled() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  let helperCalls = 0;
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => {
    helperCalls += 1;
    return true;
  };
  let ocrCalls = 0;
  globalThis.PWM.OcrRuntime = {
    recognizeImageBytes() {
      ocrCalls += 1;
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: "ignored while implementation is absent",
        textLength: 38,
        confidenceBucket: "high",
        warnings: []
      });
    }
  };

  try {
    const file = fileFromBuffer("photo.png", "image/png", bufferFromText("pixel bytes"));
    const result = await processFileForAdapterHandoff({ file, context: "drop" });

    assert.strictEqual(helperCalls, 1);
    assert.strictEqual(ocrCalls, 1);
    assert.strictEqual(result.status, "ready");
    assert.strictEqual(result.extractedKind, "image_ocr");
    assert.strictEqual(result.outputName, "photo.redacted.txt");
    assert.strictEqual(result.outputKind, "redacted_text_file");
    assert.strictEqual(result.metadata.extraction.visualContentScanned, true);
    assert.strictEqual(result.metadata.extraction.ocrSupported, true);
    assert.ok(result.sanitizedText.includes("visual_text_scanned=true"));
    assert.ok(result.sanitizedText.includes("image_ocr_supported=true"));
    assert.strictEqual(result.warnings.includes("image_ocr_not_supported"), false);
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
  }
}

function makeProtectedSiteOcrRuntime({ text, layout, status = "ocr_recognition_ready", warnings = [] }, calls) {
  return {
    recognizeImageBytes(payload) {
      calls.push(payload);
      return Promise.resolve({
        ok: true,
        status,
        language: "eng",
        text,
        textLength: String(text || "").length,
        confidenceBucket: "high",
        warnings,
        layout
      });
    }
  };
}

function installProtectedSiteImageRedactor(calls) {
  const original = globalThis.PWM.ImageRedactor;
  globalThis.PWM.ImageRedactor = {
    createRedactedPng(options = {}) {
      calls.push({
        fileName: options.fileName,
        mimeType: options.mimeType,
        boxes: options.boxes,
        imageBytesLength: options.imageBytes?.byteLength || options.imageBytes?.length || 0
      });
      return Promise.resolve({
        ok: true,
        status: "image_redacted_png_ready",
        fileName: "photo.redacted.png",
        blob: new TestFile(["redacted png bytes"], "photo.redacted.png", { type: "image/png" }),
        file: new TestFile(["redacted png bytes"], "photo.redacted.png", { type: "image/png" })
      });
    }
  };
  return () => {
    globalThis.PWM.ImageRedactor = original;
  };
}

function protectedSiteWordLayout(rawSecret) {
  const ocrText = `API_KEY=${rawSecret}`;
  return {
    source: "word",
    boxKind: "word",
    fallbackUsed: false,
    visualRedactionSafe: true,
    protectedSiteEligible: true,
    boxes: [
      {
        boxKind: "word",
        kind: "word",
        start: 8,
        end: ocrText.length,
        x: 20,
        y: 20,
        width: 260,
        height: 40,
        confidenceBucket: "high",
        fallbackUsed: false,
        visualRedactionSafe: true,
        protectedSiteEligible: true
      }
    ]
  };
}

function protectedSiteLineLayout(rawSecret) {
  const ocrText = `API_KEY=${rawSecret}`;
  return {
    source: "line",
    boxKind: "line",
    fallbackUsed: false,
    visualRedactionSafe: true,
    protectedSiteEligible: true,
    boxes: [
      {
        boxKind: "line",
        kind: "line",
        start: 0,
        end: ocrText.length,
        x: 12,
        y: 18,
        width: 420,
        height: 52,
        confidenceBucket: "medium",
        fallbackUsed: false,
        visualRedactionSafe: true,
        protectedSiteEligible: true
      }
    ]
  };
}

async function testProtectedSiteImageOcrEnabledWithSafeBoxesProducesRedactedPng() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  const rawSecret = "sk-proj-ProtectedSiteVisualSafe1234567890abcdef";
  const imageBytes = bufferFromText(`raw image bytes ${rawSecret}`);
  const ocrText = `API_KEY=${rawSecret}`;
  const ocrCalls = [];
  const redactorCalls = [];
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = makeProtectedSiteOcrRuntime(
    { text: ocrText, layout: protectedSiteWordLayout(rawSecret) },
    ocrCalls
  );
  const restoreRedactor = installProtectedSiteImageRedactor(redactorCalls);

  try {
    const result = await processFileForAdapterHandoff({
      file: fileFromBuffer("photo.jpg", "image/jpeg", imageBytes),
      context: "drop",
      ocrDimensions: { width: 640, height: 320 }
    });

    assert.strictEqual(ocrCalls.length, 1);
    assert.strictEqual(redactorCalls.length, 1);
    assert.strictEqual(result.status, "ready");
    assert.strictEqual(result.safeForUpload, true);
    assert.strictEqual(result.extractedKind, "image_ocr");
    assert.strictEqual(result.outputName, "photo.redacted.png");
    assert.strictEqual(result.outputKind, "redacted_image_file");
    assert.strictEqual(result.sanitizedFile.name, "photo.redacted.png");
    assert.strictEqual(result.sanitizedFile.type, "image/png");
    assert.strictEqual(result.sanitizedText.includes(rawSecret), false);
    assert.strictEqual(JSON.stringify(result.metadata).includes(rawSecret), false);
    assert.strictEqual(redactorCalls[0].mimeType, "image/jpeg");
    assert.strictEqual(redactorCalls[0].boxes[0].boxKind, "word");
    assert.notDeepStrictEqual(Buffer.from(await result.sanitizedFile.arrayBuffer()), Buffer.from(imageBytes));
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
    restoreRedactor();
  }
}

async function testProtectedSiteImageOcrEnabledWithLineBoxesProducesPngWithWarning() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  const rawSecret = "sk-proj-ProtectedSiteVisualLine1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const ocrCalls = [];
  const redactorCalls = [];
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = makeProtectedSiteOcrRuntime(
    { text: ocrText, layout: protectedSiteLineLayout(rawSecret) },
    ocrCalls
  );
  const restoreRedactor = installProtectedSiteImageRedactor(redactorCalls);

  try {
    const result = await processFileForAdapterHandoff({
      file: fileFromBuffer("photo.png", "image/png", bufferFromText("raw png bytes")),
      context: "drop",
      ocrDimensions: { width: 640, height: 320 }
    });

    assert.strictEqual(result.status, "ready");
    assert.strictEqual(result.outputName, "photo.redacted.png");
    assert.strictEqual(result.outputKind, "redacted_image_file");
    assert.strictEqual(result.sanitizedFile.type, "image/png");
    assert.ok(result.warnings.includes("image-redaction:ocr_line_boxes_used"));
    assert.strictEqual(redactorCalls.length, 1);
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
    restoreRedactor();
  }
}

async function testProtectedSiteImageOcrFallbackBoxesStayTextOnly() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  const rawSecret = "sk-proj-ProtectedSiteFallbackBoxes1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const redactorCalls = [];
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = makeProtectedSiteOcrRuntime(
    {
      text: ocrText,
      layout: {
        source: "fallback",
        fallbackUsed: true,
        visualRedactionSafe: false,
        protectedSiteEligible: false,
        boxes: [
          {
            boxKind: "fallback",
            kind: "fallback",
            start: 0,
            end: ocrText.length,
            x: 0,
            y: 0,
            width: 640,
            height: 320,
            confidenceBucket: "high",
            fallbackUsed: true,
            visualRedactionSafe: false,
            protectedSiteEligible: false
          }
        ]
      }
    },
    []
  );
  const restoreRedactor = installProtectedSiteImageRedactor(redactorCalls);

  try {
    const result = await processFileForAdapterHandoff({
      file: fileFromBuffer("photo.png", "image/png", bufferFromText("raw image bytes")),
      context: "drop",
      ocrDimensions: { width: 640, height: 320 }
    });

    assert.strictEqual(redactorCalls.length, 0);
    assert.strictEqual(result.status, "ready");
    assert.strictEqual(result.outputName, "photo.redacted.txt");
    assert.strictEqual(result.outputKind, "redacted_text_file");
    assert.strictEqual(result.sanitizedFile.type, "text/plain");
    assert.ok(result.warnings.includes("image-redaction:ocr_fallback_boxes_used_scanner_only"));
    assert.strictEqual(result.sanitizedText.includes(rawSecret), false);
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
    restoreRedactor();
  }
}

async function testProtectedSiteImageOcrUnsafeBoxesFailClosed() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  const rawSecret = "sk-proj-ProtectedSiteUnsafeBoxes1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const redactorCalls = [];
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = makeProtectedSiteOcrRuntime(
    {
      text: ocrText,
      layout: {
        source: "word",
        boxes: [
          {
            boxKind: "word",
            kind: "word",
            start: 8,
            end: ocrText.length,
            x: 12,
            y: 12,
            width: 320,
            height: 40,
            confidenceBucket: "low",
            fallbackUsed: false,
            visualRedactionSafe: false,
            protectedSiteEligible: false
          }
        ]
      }
    },
    []
  );
  const restoreRedactor = installProtectedSiteImageRedactor(redactorCalls);

  try {
    const result = await processFileForAdapterHandoff({
      file: fileFromBuffer("photo.png", "image/png", bufferFromText(rawSecret)),
      context: "drop",
      ocrDimensions: { width: 640, height: 320 }
    });
    const serialized = JSON.stringify(result);

    assert.strictEqual(redactorCalls.length, 0);
    assert.strictEqual(result.status, "blocked");
    assert.strictEqual(result.safeForUpload, false);
    assert.strictEqual(result.sanitizedFile, null);
    assert.strictEqual(result.fallbackReason, "ocr_box_confidence_too_low");
    assert.strictEqual(serialized.includes(rawSecret), false);
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
    restoreRedactor();
  }
}

async function testProtectedSiteImageAttachStaysMetadataOnlyWhenOcrDisabled() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  let ocrCalls = 0;
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => false;
  globalThis.PWM.OcrRuntime = {
    recognizeImageBytes() {
      ocrCalls += 1;
      throw new Error("disabled protected-site OCR must not call the OCR runtime");
    }
  };
  const originalImageRedactor = globalThis.PWM.ImageRedactor;
  let imageRedactorCalls = 0;
  globalThis.PWM.ImageRedactor = {
    createRedactedPng() {
      imageRedactorCalls += 1;
      throw new Error("disabled protected-site OCR must not call image redaction");
    }
  };

  try {
    const file = fileFromBuffer("photo.png", "image/png", bufferFromText("pixel bytes"));
    const result = await processFileForAdapterHandoff({ file, context: "drop" });

    assert.strictEqual(ocrCalls, 0);
    assert.strictEqual(imageRedactorCalls, 0);
    assert.strictEqual(result.status, "ready");
    assert.strictEqual(result.extractedKind, "image_metadata");
    assert.strictEqual(result.outputName, "photo.redacted.txt");
    assert.strictEqual(result.outputKind, "redacted_text_file");
    assert.strictEqual(result.metadata.extraction.visualContentScanned, false);
    assert.strictEqual(result.metadata.extraction.ocrSupported, false);
    assert.ok(result.sanitizedText.includes("visual_text_scanned=false"));
    assert.ok(result.sanitizedText.includes("image_ocr_supported=false"));
    assert.ok(result.warnings.includes("image_ocr_not_supported"));
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
    globalThis.PWM.ImageRedactor = originalImageRedactor;
  }
}

async function testProtectedSiteImageOcrRedactsSupportedFormatsWhenEnabled() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  const rawSecret = "sk-proj-ProtectedSiteOcrApiKey1234567890abcdef";
  const calls = [];
  const redactorCalls = [];
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = {
    recognizeImageBytes(payload) {
      calls.push(payload);
      const text = `API_KEY=${rawSecret}`;
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text,
        textLength: rawSecret.length + 8,
        confidenceBucket: "high",
        warnings: [],
        layout: protectedSiteWordLayout(rawSecret)
      });
    }
  };
  const restoreRedactor = installProtectedSiteImageRedactor(redactorCalls);

  try {
    ExtractionCache.clear();
    for (const [fileName, mimeType] of [
      ["photo.png", "image/png"],
      ["photo.jpg", "image/jpeg"],
      ["photo.jpeg", "image/jpeg"],
      ["photo.webp", "image/webp"]
    ]) {
      const result = await processFileForAdapterHandoff({
        file: fileFromBuffer(fileName, mimeType, bufferFromText("image bytes")),
        context: "drop"
      });

      assert.strictEqual(result.status, "ready", fileName);
      assert.strictEqual(result.safeForUpload, true, fileName);
      assert.strictEqual(result.extractedKind, "image_ocr", fileName);
      assert.strictEqual(result.outputName, "photo.redacted.png", fileName);
      assert.strictEqual(result.outputKind, "redacted_image_file", fileName);
      assert.strictEqual(result.sanitizedFile.type, "image/png", fileName);
      assert.ok(result.sanitizedText.includes("API_KEY=[PWM_"), fileName);
      assert.strictEqual(result.sanitizedText.includes(rawSecret), false, fileName);
      assert.strictEqual((result.sanitizedText.match(/\[PWM_\d+\]/g) || []).length, 1, fileName);
      assert.strictEqual(JSON.stringify(result.metadata).includes(rawSecret), false, fileName);
      assert.strictEqual(JSON.stringify(result.warnings).includes(rawSecret), false, fileName);
    }

    assert.strictEqual(calls.length, 4);
    assert.strictEqual(redactorCalls.length, 4);
    assert.ok(calls.every((payload) => payload.type === "ocr_recognize_image"));
    assert.ok(calls.every((payload) => payload.language === "eng"));
    assert.strictEqual(ExtractionCache.debugSnapshot().entries.length, 0);
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
    restoreRedactor();
  }
}

async function testProtectedSiteImageOcrEnabledLeavesUnsupportedImagesMetadataOnly() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  let runtimeCalls = 0;
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = {
    recognizeImageBytes() {
      runtimeCalls += 1;
      throw new Error("unsupported protected-site images must not call OCR");
    }
  };

  try {
    const result = await processFileForAdapterHandoff({
      file: fileFromBuffer("diagram.gif", "image/gif", bufferFromText("gif bytes")),
      context: "drop"
    });

    assert.strictEqual(runtimeCalls, 0);
    assert.strictEqual(result.status, "unsupported");
    assert.strictEqual(result.safeForUpload, false);
    assert.strictEqual(result.sanitizedFile, null);
    assert.strictEqual(result.sanitizedText, "");
    assert.strictEqual(result.fallbackReason, "Unsupported file type for local text extraction.");
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
  }
}

async function testProtectedSiteImageOcrFailureFailsClosedWithoutCachingRawText() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  const rawSecret = "sk-proj-ProtectedSiteOcrFailureSecret1234567890";
  let runtimeCalls = 0;
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = {
    recognizeImageBytes() {
      runtimeCalls += 1;
      return Promise.reject(new Error(`decoder saw ${rawSecret}`));
    }
  };

  try {
    ExtractionCache.clear();
    const result = await processFileForAdapterHandoff({
      file: fileFromBuffer("broken.png", "image/png", bufferFromText(rawSecret)),
      context: "drop"
    });
    const serialized = JSON.stringify(result);

    assert.strictEqual(runtimeCalls, 1);
    assert.strictEqual(result.status, "blocked");
    assert.strictEqual(result.safeForUpload, false);
    assert.strictEqual(result.sanitizedFile, null);
    assert.strictEqual(result.sanitizedText, "");
    assert.strictEqual(result.fallbackReason, "ocr_failed");
    assert.strictEqual(serialized.includes(rawSecret), false);
    assert.strictEqual(JSON.stringify(ExtractionCache.debugSnapshot()).includes(rawSecret), false);
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
  }
}

async function testProtectedSiteImageOcrTimeoutTerminatesRuntimeAndFailsClosed() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  let terminated = 0;
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = {
    recognizeImageBytes() {
      return new Promise(() => {});
    },
    terminate() {
      terminated += 1;
    }
  };

  try {
    const result = await processFileForAdapterHandoff({
      file: fileFromBuffer("timeout.png", "image/png", bufferFromText("image bytes")),
      context: "drop",
      ocrTimeoutMs: 1
    });

    assert.strictEqual(terminated, 1);
    assert.strictEqual(result.status, "blocked");
    assert.strictEqual(result.safeForUpload, false);
    assert.strictEqual(result.sanitizedFile, null);
    assert.strictEqual(result.fallbackReason, "ocr_timeout");
    assert.ok(result.warnings.includes("ocr_timeout"));
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
  }
}

async function testProtectedSiteImageOcrOversizedImageFailsBeforeWorkerCall() {
  const originalHelper = globalThis.PWM.isProtectedSiteOcrEnabled;
  let runtimeCalls = 0;
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = {
    recognizeImageBytes() {
      runtimeCalls += 1;
      throw new Error("oversized images must not reach OCR runtime");
    }
  };

  try {
    const result = await processFileForAdapterHandoff({
      file: fileFromBuffer(
        "huge.png",
        "image/png",
        bufferFromText("not actually huge but metadata controls validation")
      ),
      context: "drop",
      ocrDimensions: {
        width: ScannerOcr.MAX_SCANNER_OCR_IMAGE_DIMENSION + 1,
        height: 100
      }
    });

    assert.strictEqual(runtimeCalls, 0);
    assert.strictEqual(result.status, "blocked");
    assert.strictEqual(result.safeForUpload, false);
    assert.strictEqual(result.sanitizedFile, null);
    assert.strictEqual(result.fallbackReason, "ocr_image_dimensions_too_large");
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalHelper;
    delete globalThis.PWM.OcrRuntime;
  }
}

function testProtectedSiteImageAttachUsesOcrOnlyInsidePipelineGate() {
  const source = fs.readFileSync(
    path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"),
    "utf8"
  );

  assert.ok(source.includes("isProtectedSiteOcrEnabled"));
  assert.ok(source.includes("recognizeScannerImageFile"));
  assert.strictEqual(source.includes("new Worker"), false);
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

async function testSameFileSignatureReusesSafeCachedResult() {
  ExtractionCache.clear();
  const file = fileFromBuffer("cached.pdf", "application/pdf", makePdf(`token ${RAW_SECRET}`));
  const originalPrepare = globalThis.PWM.FileExtractors.prepareFileExtractionAsync;
  const originalScan = globalThis.PWM.FileScanner.scanTextContent;
  let prepareCalls = 0;
  let scanCalls = 0;
  globalThis.PWM.FileExtractors.prepareFileExtractionAsync = async (...args) => {
    prepareCalls += 1;
    return originalPrepare(...args);
  };
  globalThis.PWM.FileScanner.scanTextContent = (...args) => {
    scanCalls += 1;
    return originalScan(...args);
  };
  let first;
  let second;
  try {
    first = await processFileForAdapterHandoff({ file, context: "drop" });
    second = await processFileForAdapterHandoff({ file, context: "drop" });
  } finally {
    globalThis.PWM.FileExtractors.prepareFileExtractionAsync = originalPrepare;
    globalThis.PWM.FileScanner.scanTextContent = originalScan;
  }

  assertNormalizedReadyResult(first, {
    originalName: "cached.pdf",
    outputName: "cached.redacted.pdf",
    outputKind: "redacted_pdf_file",
    extractedKind: "pdf"
  });
  assertNormalizedReadyResult(second, {
    originalName: "cached.pdf",
    outputName: "cached.redacted.pdf",
    outputKind: "redacted_pdf_file",
    extractedKind: "pdf"
  });
  assert.strictEqual(first.sanitizedText, second.sanitizedText);
  assert.notStrictEqual(first.sanitizedFile, second.sanitizedFile);
  assert.strictEqual(second.sanitizedFile.type, "application/pdf");
  assert.strictEqual(prepareCalls, 1);
  assert.strictEqual(scanCalls, 1);
  assert.strictEqual(second.metadata.cache.status, "hit");
  assert.strictEqual(JSON.stringify(ExtractionCache.debugSnapshot()).includes(RAW_SECRET), false);
}

async function testChangedSignatureCausesCacheMiss() {
  ExtractionCache.clear();
  const firstFile = new TestFile([makePdf(`token ${RAW_SECRET}`)], "same.pdf", {
    type: "application/pdf",
    lastModified: 111
  });
  const changedFile = new TestFile([makePdf(`token ${RAW_SECRET}`)], "same.pdf", {
    type: "application/pdf",
    lastModified: 222
  });

  const first = await processFileForAdapterHandoff({ file: firstFile, context: "drop" });
  const second = await processFileForAdapterHandoff({ file: changedFile, context: "drop" });

  assert.strictEqual(first.metadata.cache.status, "miss");
  assert.strictEqual(second.metadata.cache.status, "miss");
}

async function testRawFilenameAndExtractedTextAreNotStoredInCache() {
  ExtractionCache.clear();
  const file = fileFromBuffer(`contract-${RAW_SECRET}.pdf`, "application/pdf", makePdf(`document body ${RAW_SECRET}`));

  await processFileForAdapterHandoff({ file, context: "drop" });
  const snapshotJson = JSON.stringify(ExtractionCache.debugSnapshot());

  assert.strictEqual(snapshotJson.includes(RAW_SECRET), false);
  assert.strictEqual(snapshotJson.includes("document body"), false);
  assert.strictEqual(snapshotJson.includes("contract-"), false);
}

async function testBlockedOrUnsupportedFilesAreNotCached() {
  ExtractionCache.clear();
  const scannedPdf = fileFromBuffer("scan.pdf", "application/pdf", makePdf("", { imageOnly: true }));
  const unsupportedDoc = new TestFile(["legacy"], "legacy.doc", { type: "application/msword" });

  await processFileForAdapterHandoff({ file: scannedPdf, context: "drop" });
  await processFileForAdapterHandoff({ file: unsupportedDoc, context: "drop" });

  assert.strictEqual(ExtractionCache.debugSnapshot().entries.length, 0);
}

function makeCacheFile(name, options = {}) {
  return new TestFile(["safe sanitized cache bytes"], name, {
    type: options.type || "application/pdf",
    lastModified: options.lastModified || 999
  });
}

function makeSafeCacheResult(overrides = {}) {
  return {
    status: "ready",
    outputName: "safe.redacted.txt",
    outputKind: "redacted_text_file",
    extractedKind: "pdf",
    sanitizedText: "API_KEY=[PWM_1]",
    metadata: {
      original: {
        type: "application/pdf",
        size: 26
      },
      extraction: {
        extension: ".pdf",
        mimeType: "application/pdf",
        sizeBytes: 26,
        textLength: 18,
        extractedParts: 1
      },
      scan: {
        findingsCount: 1,
        changed: true,
        redactedLength: 15
      }
    },
    warnings: [],
    safeForUpload: true,
    fallbackReason: "",
    ...overrides
  };
}

function testCacheRefusesRawExtractedTextFields() {
  ExtractionCache.clear();
  const unsafeKeys = ["rawText", "extractedText", "originalText", "sourceText", "fileText"];

  for (const key of unsafeKeys) {
    const result = makeSafeCacheResult({ [key]: RAW_SECRET });
    assert.strictEqual(ExtractionCache.set(makeCacheFile(`${key}.pdf`), result), false, key);
  }

  assert.strictEqual(ExtractionCache.debugSnapshot().entries.length, 0);
}

function testCacheRefusesUnsafeMetadataKeys() {
  ExtractionCache.clear();
  const unsafeMetadata = [
    { rawText: RAW_SECRET },
    { nested: { extractedText: RAW_SECRET } },
    { nested: [{ originalText: RAW_SECRET }] },
    { originalName: `contract-${RAW_SECRET}.pdf` },
    { content: RAW_SECRET },
    { bytes: [1, 2, 3] },
    { arrayBuffer: RAW_SECRET }
  ];

  for (const [index, metadata] of unsafeMetadata.entries()) {
    assert.strictEqual(
      ExtractionCache.set(makeCacheFile(`unsafe-${index}.pdf`), makeSafeCacheResult({ metadata })),
      false,
      JSON.stringify(metadata)
    );
  }

  assert.strictEqual(ExtractionCache.debugSnapshot().entries.length, 0);
}

function testCacheRefusesUnsupportedErrorBlockedAndUnsafeOutputs() {
  ExtractionCache.clear();
  for (const status of ["unsupported", "failed", "blocked", "error"]) {
    assert.strictEqual(
      ExtractionCache.set(makeCacheFile(`${status}.pdf`), makeSafeCacheResult({ status })),
      false,
      status
    );
  }

  assert.strictEqual(
    ExtractionCache.set(makeCacheFile("unsafe-output.pdf"), makeSafeCacheResult({ outputName: "unsafe.pdf" })),
    false
  );
  assert.strictEqual(
    ExtractionCache.set(makeCacheFile("empty-text.pdf"), makeSafeCacheResult({ sanitizedText: "" })),
    false
  );
  assert.strictEqual(ExtractionCache.debugSnapshot().entries.length, 0);
}

function testCacheAcceptsOnlySafeSanitizedOutputsAndTrimsMaxEntries() {
  ExtractionCache.clear();

  assert.strictEqual(
    ExtractionCache.set(makeCacheFile("safe-doc.pdf"), makeSafeCacheResult()),
    true
  );
  assert.strictEqual(
    ExtractionCache.set(
      makeCacheFile("safe-ok-doc.pdf", { lastModified: 1000 }),
      makeSafeCacheResult({ status: "ok", outputName: "safe-ok.redacted.txt" })
    ),
    true
  );
  assert.strictEqual(
    ExtractionCache.set(
      makeCacheFile("safe-text.env", { type: "text/plain", lastModified: 1001 }),
      makeSafeCacheResult({
        outputName: "safe-text.env",
        outputKind: "sanitized_text_file",
        extractedKind: "text"
      })
    ),
    true
  );

  ExtractionCache.clear();
  for (let index = 0; index < 30; index += 1) {
    assert.strictEqual(
      ExtractionCache.set(
        makeCacheFile(`safe-${index}.pdf`, { lastModified: 2000 + index }),
        makeSafeCacheResult({ outputName: `safe-${index}.redacted.txt` })
      ),
      true
    );
  }

  const snapshot = ExtractionCache.debugSnapshot();
  assert.strictEqual(snapshot.entries.length, 24);
  assert.strictEqual(snapshot.entries.some((entry) => entry.outputName), false);
}

async function testCacheTtlExpiryAndClear() {
  ExtractionCache.clear();
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const file = fileFromBuffer("ttl.pdf", "application/pdf", makePdf(`token ${RAW_SECRET}`));
    await processFileForAdapterHandoff({ file, context: "drop" });
    assert.strictEqual(ExtractionCache.debugSnapshot().entries.length, 1);

    now += 16 * 60 * 1000;
    const result = await processFileForAdapterHandoff({ file, context: "drop" });
    assert.strictEqual(result.metadata.cache.status, "miss");

    ExtractionCache.clear();
    assert.strictEqual(ExtractionCache.debugSnapshot().entries.length, 0);
  } finally {
    Date.now = originalNow;
  }
}

function testCacheAvoidsPersistentStorageAndPermissions() {
  const cacheSource = fs.readFileSync(path.join(repoRoot, "src/content/files/fileExtractionSessionCache.js"), "utf8");

  assert.strictEqual(cacheSource.includes("chrome.storage.local"), false);
  assert.strictEqual(cacheSource.includes("chrome.storage.sync"), false);
  assert.strictEqual(cacheSource.includes("chrome.storage.session"), false);
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
  await testPdfProducesRedactedPdfOutputWhenCompleteAndSafe();
  await testLargePdfFallsBackToRedactedTxtWhenRegeneratedPdfWouldTruncate();
  await testDocxProducesRedactedTxtOutput();
  await testXlsxProducesRedactedTxtOutput();
  await testImageMetadataProducesRedactedTxtOutput();
  await testProtectedSiteOcrDisabledByDefaultAndLocalPersistence();
  await testProtectedSiteImageAttachStaysMetadataOnlyWhenOcrSettingEnabled();
  await testProtectedSiteImageAttachStaysMetadataOnlyWhenOcrDisabled();
  await testProtectedSiteImageOcrEnabledWithSafeBoxesProducesRedactedPng();
  await testProtectedSiteImageOcrEnabledWithLineBoxesProducesPngWithWarning();
  await testProtectedSiteImageOcrFallbackBoxesStayTextOnly();
  await testProtectedSiteImageOcrUnsafeBoxesFailClosed();
  await testProtectedSiteImageOcrRedactsSupportedFormatsWhenEnabled();
  await testProtectedSiteImageOcrEnabledLeavesUnsupportedImagesMetadataOnly();
  await testProtectedSiteImageOcrFailureFailsClosedWithoutCachingRawText();
  await testProtectedSiteImageOcrTimeoutTerminatesRuntimeAndFailsClosed();
  await testProtectedSiteImageOcrOversizedImageFailsBeforeWorkerCall();
  testProtectedSiteImageAttachUsesOcrOnlyInsidePipelineGate();
  await testScannedPdfFailsClosedWithoutSanitizedFile();
  await testMacroAndLegacyFormatsStayUnsupported();
  await testDebugMetadataExcludesRawExtractedText();
  await testSameFileSignatureReusesSafeCachedResult();
  await testChangedSignatureCausesCacheMiss();
  await testRawFilenameAndExtractedTextAreNotStoredInCache();
  await testBlockedOrUnsupportedFilesAreNotCached();
  testCacheRefusesRawExtractedTextFields();
  testCacheRefusesUnsafeMetadataKeys();
  testCacheRefusesUnsupportedErrorBlockedAndUnsafeOutputs();
  testCacheAcceptsOnlySafeSanitizedOutputsAndTrimsMaxEntries();
  await testCacheTtlExpiryAndClear();
  testCacheAvoidsPersistentStorageAndPermissions();
  testExtractionIsNotOnTypingPath();
}

run().then(() => {
  console.log("PASS content file extraction pipeline regressions");
});
