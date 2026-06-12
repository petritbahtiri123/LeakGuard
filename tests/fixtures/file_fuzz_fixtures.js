const zlib = require("zlib");

const PHASE_17D_FUZZ_SEED = "phase-17d-deterministic-seed-v1";
const PHASE_17D_RAW_MARKER = "sk-proj-Phase17dRawMarker1234567890abcdef";
const PHASE_17D_PASSWORD_MARKER = "Phase17dPasswordMarker123!";

const PDF_TEXT_EXTRACTION_MAX_BYTES = 4 * 1024 * 1024;
const DOCX_TEXT_EXTRACTION_MAX_BYTES = 4 * 1024 * 1024;
const XLSX_TEXT_EXTRACTION_MAX_BYTES = 4 * 1024 * 1024;

function arrayBufferFromBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function bufferFromText(text) {
  return arrayBufferFromBuffer(Buffer.from(String(text), "utf8"));
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
  if (options.malformed) return bufferFromText(`not a pdf ${PHASE_17D_RAW_MARKER}`);
  const streamText = options.imageOnly
    ? "q\n10 0 0 10 0 0 cm\n/Im1 Do\nQ\n"
    : `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\n`;
  const stream = options.flate ? zlib.deflateSync(Buffer.from(streamText, "binary")) : Buffer.from(streamText, "binary");
  const streamHeader = options.flate
    ? `<< /Length ${stream.length} /Filter /FlateDecode >>`
    : `<< /Length ${stream.length} >>`;
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
  if (options.truncated) return arrayBufferFromBuffer(buffer.subarray(0, Math.max(16, Math.floor(buffer.length / 2))));
  return arrayBufferFromBuffer(buffer);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data || ""), "utf8");
    const method = entry.method ?? 8;
    const compressed = method === 8 ? zlib.deflateRawSync(raw) : raw;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(entry.encrypted ? 1 : 0, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, name, compressed);
  }
  return arrayBufferFromBuffer(Buffer.concat(chunks));
}

function docxDocumentXml(text, options = {}) {
  if (options.weirdEntities) {
    return `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>entity &amp; literal ${escapeXml(text)} &#x2603;</w:t></w:r></w:p></w:body></w:document>`;
  }
  return `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`;
}

function makeDocx(text, options = {}) {
  if (options.malformed) return bufferFromText(`not a docx ${PHASE_17D_RAW_MARKER}`);
  const entries = [
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    }
  ];
  if (options.document !== false) {
    entries.push({
      name: "word/document.xml",
      data: docxDocumentXml(text, { weirdEntities: options.weirdEntities }),
      method: options.method
    });
  }
  return makeZip(entries);
}

function makeXlsx(options = {}) {
  if (options.malformed) return bufferFromText(`not an xlsx ${PHASE_17D_RAW_MARKER}`);
  const entries = [];
  if (options.workbook !== false) {
    entries.push({
      name: "xl/workbook.xml",
      data: '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Secrets" sheetId="1"/></sheets></workbook>'
    });
  }
  if (options.sharedStrings !== false) {
    entries.push({
      name: "xl/sharedStrings.xml",
      data: `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>${escapeXml(options.sharedText || "")}</t></si></sst>`
    });
  }
  if (options.sheet !== false) {
    const formula = options.withRawParts ? `<c r="B1"><f>"${PHASE_17D_RAW_MARKER}"</f><v>0</v></c>` : "";
    entries.push({
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${escapeXml(options.inlineText || "")}</t></is></c>${formula}</row></sheetData></worksheet>`
    });
  }
  if (options.withRawParts) {
    entries.push({ name: "xl/comments1.xml", data: `<comments>${PHASE_17D_RAW_MARKER}</comments>` });
    entries.push({ name: "xl/worksheets/hidden.xml", data: `<worksheet state="hidden">${PHASE_17D_RAW_MARKER}</worksheet>` });
    entries.push({ name: "customXml/item1.xml", data: `<custom>${PHASE_17D_RAW_MARKER}</custom>` });
  }
  return makeZip(entries);
}

function createLargeText(label, repeatCount) {
  return `${label}=safe\nOPENAI_API_KEY=${PHASE_17D_RAW_MARKER}\nDB_PASSWORD=${PHASE_17D_PASSWORD_MARKER}\n`.repeat(repeatCount);
}

function createPhase17dExtractorFuzzCases() {
  const largePdfText = `PDF=${"A".repeat(PDF_TEXT_EXTRACTION_MAX_BYTES + 1)}`;
  const largeDocxText = `DOCX=${"B".repeat(DOCX_TEXT_EXTRACTION_MAX_BYTES + 1)}`;
  const largeXlsxText = `XLSX=${"C".repeat(XLSX_TEXT_EXTRACTION_MAX_BYTES + 1)}`;
  return [
    {
      label: "malformed PDF",
      fileName: "phase17d-malformed.pdf",
      mimeType: "application/pdf",
      buffer: makePdf("", { malformed: true }),
      expectedStatus: "error",
      expectedReason: "pdf_malformed",
      safeForScan: false
    },
    {
      label: "truncated PDF",
      fileName: "phase17d-truncated.pdf",
      mimeType: "application/pdf",
      buffer: makePdf(`API_KEY=${PHASE_17D_RAW_MARKER}`, { truncated: true }),
      expectedStatus: "error",
      safeForScan: false
    },
    {
      label: "image-only PDF",
      fileName: "phase17d-image-only.pdf",
      mimeType: "application/pdf",
      buffer: makePdf("", { imageOnly: true }),
      expectedStatus: "error",
      expectedReason: "pdf_no_extractable_text",
      safeForScan: false
    },
    {
      label: "oversized text PDF",
      fileName: "phase17d-oversized.pdf",
      mimeType: "application/pdf",
      buffer: makePdf(largePdfText),
      expectedStatus: "error",
      expectedReason: "pdf_text_too_large",
      safeForScan: false
    },
    {
      label: "malformed DOCX ZIP",
      fileName: "phase17d-malformed.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: makeDocx("", { malformed: true }),
      expectedStatus: "error",
      expectedReason: "docx_malformed_zip",
      safeForScan: false
    },
    {
      label: "DOCX missing document.xml",
      fileName: "phase17d-missing-document.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: makeDocx("", { document: false }),
      expectedStatus: "error",
      expectedReason: "docx_no_extractable_text",
      safeForScan: false
    },
    {
      label: "DOCX weird XML entities",
      fileName: "phase17d-weird-entities.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: makeDocx(`API_KEY=${PHASE_17D_RAW_MARKER}`, { weirdEntities: true }),
      expectedStatus: "ok",
      expectRawMarkerRedactedByScanner: true
    },
    {
      label: "oversized DOCX extracted text",
      fileName: "phase17d-oversized.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: makeDocx(largeDocxText),
      expectedStatus: "error",
      expectedReason: "docx_text_too_large",
      safeForScan: false
    },
    {
      label: "malformed XLSX ZIP",
      fileName: "phase17d-malformed.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: makeXlsx({ malformed: true }),
      expectedStatus: "error",
      expectedReason: "xlsx_malformed_zip",
      safeForScan: false
    },
    {
      label: "XLSX missing workbook",
      fileName: "phase17d-missing-workbook.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: makeXlsx({ workbook: false, sharedText: "", inlineText: "" }),
      expectedStatus: "error",
      expectedReason: "xlsx_no_extractable_text",
      safeForScan: false
    },
    {
      label: "XLSX raw formula/comment/hidden/custom parts",
      fileName: "phase17d-raw-parts.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: makeXlsx({ withRawParts: true, inlineText: `API_KEY=${PHASE_17D_RAW_MARKER}` }),
      expectedStatus: "ok",
      expectRawMarkerRedactedByScanner: true
    },
    {
      label: "oversized XLSX extracted text",
      fileName: "phase17d-oversized.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: makeXlsx({ inlineText: largeXlsxText }),
      expectedStatus: "error",
      expectedReason: "xlsx_text_too_large",
      safeForScan: false
    },
    ...["png", "jpg", "webp"].map((extension) => ({
      label: `corrupt ${extension.toUpperCase()} metadata path`,
      fileName: `phase17d-corrupt-image.${extension}`,
      mimeType: extension === "jpg" ? "image/jpeg" : `image/${extension}`,
      sizeBytes: 256,
      buffer: bufferFromText(`${extension} corrupt bytes ${PHASE_17D_RAW_MARKER}`),
      expectedStatus: "ok",
      expectRawMarkerRedactedByScanner: true
    })),
    {
      label: "oversized image metadata path",
      fileName: `phase17d-image-${PHASE_17D_RAW_MARKER}.png`,
      mimeType: "image/png",
      sizeBytes: 12 * 1024 * 1024,
      buffer: bufferFromText("large image bytes ignored"),
      expectedStatus: "ok",
      expectRawMarkerRedactedByScanner: true
    },
    ...["env", "json", "log", "md", "js"].map((extension) => ({
      label: `large .${extension} source text`,
      fileName: `phase17d-large.${extension}`,
      mimeType: extension === "json" ? "application/json" : "text/plain",
      text: createLargeText(extension.toUpperCase(), 256),
      expectedStatus: "ok",
      expectRawMarkerRedactedByScanner: true
    })),
    ...["doc", "docm", "xls", "xlsm"].map((extension) => ({
      label: `unsupported legacy Office .${extension}`,
      fileName: `phase17d-legacy.${extension}`,
      mimeType: "application/octet-stream",
      buffer: bufferFromText(`legacy ${extension} ${PHASE_17D_RAW_MARKER}`),
      expectedStatus: "unsupported",
      safeForScan: false
    }))
  ];
}

module.exports = {
  PHASE_17D_FUZZ_SEED,
  PHASE_17D_RAW_MARKER,
  PHASE_17D_PASSWORD_MARKER,
  createPhase17dExtractorFuzzCases,
  makeDocx,
  makePdf,
  makeXlsx
};
