const assert = require("assert");
const path = require("path");
const zlib = require("zlib");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/shared/fileExtractors.js"));
require(path.join(repoRoot, "src/shared/docxRedactor.js"));

const { prepareFileExtractionAsync, EXTRACTOR_STATUS } = globalThis.PWM.FileExtractors;
const DocxRedactor = globalThis.PWM.DocxRedactor;

function bufferFromText(text) {
  return new TextEncoder().encode(String(text)).buffer;
}

function writeUInt16LE(buffer, value, offset) {
  buffer.writeUInt16LE(value, offset);
}

function writeUInt32LE(buffer, value, offset) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function makeZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(String(entry.data || ""), "utf8");
    const method = entry.method === undefined ? 0 : entry.method;
    const compressed = method === 8 ? zlib.deflateRawSync(raw) : raw;
    const header = Buffer.alloc(30);
    writeUInt32LE(header, 0x04034b50, 0);
    writeUInt16LE(header, 20, 4);
    writeUInt16LE(header, entry.encrypted ? 1 : 0, 6);
    writeUInt16LE(header, method, 8);
    writeUInt32LE(header, 0, 10);
    writeUInt32LE(header, 0, 14);
    writeUInt32LE(header, compressed.length, 18);
    writeUInt32LE(header, raw.length, 22);
    writeUInt16LE(header, name.length, 26);
    writeUInt16LE(header, 0, 28);
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

function docxXml(text) {
  const body = String(text)
    .split("\n")
    .map((line) => `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

function makeDocx(text, options = {}) {
  if (options.malformed) return bufferFromText("not a zip");
  const entries = [
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    }
  ];
  if (options.encrypted) {
    entries.push({ name: "EncryptedPackage", data: "encrypted", encrypted: true });
  }
  entries.push({ name: "word/document.xml", data: docxXml(text), method: options.method });
  if (options.headerText) entries.push({ name: "word/header1.xml", data: docxXml(options.headerText) });
  if (options.footerText) entries.push({ name: "word/footer1.xml", data: docxXml(options.footerText) });
  if (options.footnoteText) entries.push({ name: "word/footnotes.xml", data: docxXml(options.footnoteText) });
  if (options.endnoteText) entries.push({ name: "word/endnotes.xml", data: docxXml(options.endnoteText) });
  if (options.commentText) entries.push({ name: "word/comments.xml", data: docxXml(options.commentText) });
  if (options.stylesText) entries.push({ name: "word/styles.xml", data: docxXml(options.stylesText) });
  if (options.metadataText) entries.push({ name: "docProps/core.xml", data: docxXml(options.metadataText) });
  if (options.customXmlText) entries.push({ name: "customXml/item1.xml", data: docxXml(options.customXmlText) });
  if (options.mediaText) entries.push({ name: "word/media/image1.png", data: options.mediaText });
  return makeZip(entries);
}

function arrayBufferFromBytes(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function byteText(bytes) {
  return new TextDecoder("latin1").decode(bytes);
}

async function extractDocxText(buffer, fileName = "proof.redacted.docx") {
  return prepareFileExtractionAsync({
    fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer
  });
}

async function testGeneratedDocxContainsOnlySanitizedText() {
  const rawSecret = "sk-proj-Phase15aRawDocxSecret1234567890abcdef";
  const source = makeDocx(`API_KEY=${rawSecret}`);
  const result = await DocxRedactor.createRedactedDocxFromText({
    originalName: "source.docx",
    originalBytes: source,
    text: "API_KEY=[PWM_1]\nPUBLIC_URL=https://example.com"
  });
  const bytesText = byteText(result.bytes);
  const extracted = await extractDocxText(arrayBufferFromBytes(result.bytes));

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.fileName, "source.redacted.docx");
  assert.strictEqual(result.mimeType, DocxRedactor.DOCX_MIME_TYPE);
  assert.ok(result.bytes instanceof Uint8Array);
  assert.ok(bytesText.includes("[Content_Types].xml"));
  assert.strictEqual(bytesText.includes(rawSecret), false);
  assert.strictEqual(bytesText.includes("sk-proj-Phase15aRawDocxSecret"), false);
  assert.strictEqual(bytesText.includes("[PWM_1]"), true);
  assert.strictEqual(extracted.status, EXTRACTOR_STATUS.OK);
  assert.strictEqual(extracted.text.includes(rawSecret), false);
  assert.ok(extracted.text.includes("API_KEY=[PWM_1]"));
  assert.ok(extracted.text.includes("PUBLIC_URL=https://example.com"));
}

async function testGeneratedDocxDropsOriginalHeaderFooterFootnoteEndnoteText() {
  const secrets = [
    "sk-proj-DocxBodySecret1234567890abcdef",
    "sk-proj-DocxHeaderSecret1234567890abcdef",
    "sk-proj-DocxFooterSecret1234567890abcdef",
    "sk-proj-DocxFootnoteSecret1234567890abcdef",
    "sk-proj-DocxEndnoteSecret1234567890abcdef",
    "sk-proj-DocxCommentSecret1234567890abcdef",
    "sk-proj-DocxStyleSecret1234567890abcdef",
    "sk-proj-DocxMetadataSecret1234567890abcdef",
    "sk-proj-DocxCustomXmlSecret1234567890abcdef",
    "sk-proj-DocxMediaSecret1234567890abcdef"
  ];
  const source = makeDocx(`body=${secrets[0]}`, {
    headerText: `header=${secrets[1]}`,
    footerText: `footer=${secrets[2]}`,
    footnoteText: `footnote=${secrets[3]}`,
    endnoteText: `endnote=${secrets[4]}`,
    commentText: `comment=${secrets[5]}`,
    stylesText: `style=${secrets[6]}`,
    metadataText: `metadata=${secrets[7]}`,
    customXmlText: `custom=${secrets[8]}`,
    mediaText: `media=${secrets[9]}`
  });
  const result = await DocxRedactor.createRedactedDocxFromText({
    originalName: "with-parts.docx",
    originalBytes: source,
    text: "body=[PWM_1]\nheader=[PWM_2]\nfooter=[PWM_3]\nfootnote=[PWM_4]\nendnote=[PWM_5]\ncomment=[PWM_6]\nstyle=[PWM_7]\nmetadata=[PWM_8]\ncustom=[PWM_9]\nmedia=[PWM_10]"
  });
  const bytesText = byteText(result.bytes);
  const extracted = await extractDocxText(arrayBufferFromBytes(result.bytes));

  assert.strictEqual(result.ok, true);
  for (const secret of secrets) {
    assert.strictEqual(bytesText.includes(secret), false);
    assert.strictEqual(extracted.text.includes(secret), false);
  }
  assert.strictEqual(bytesText.includes("word/header1.xml"), false);
  assert.strictEqual(bytesText.includes("word/footer1.xml"), false);
  assert.strictEqual(bytesText.includes("word/footnotes.xml"), false);
  assert.strictEqual(bytesText.includes("word/endnotes.xml"), false);
  assert.strictEqual(bytesText.includes("word/comments.xml"), false);
  assert.strictEqual(bytesText.includes("word/styles.xml"), false);
  assert.strictEqual(bytesText.includes("docProps/core.xml"), false);
  assert.strictEqual(bytesText.includes("customXml/item1.xml"), false);
  assert.strictEqual(bytesText.includes("word/media/image1.png"), false);
  assert.ok(extracted.text.includes("header=[PWM_2]"));
  assert.ok(extracted.text.includes("media=[PWM_10]"));
}

function testScannerCopyStatesRegeneratedDocxBoundaries() {
  const scannerHtml = require("fs").readFileSync(path.join(repoRoot, "src/scanner/scanner.html"), "utf8");
  const scannerSource = require("fs").readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");

  for (const required of [
    "regenerated from sanitized extracted text",
    "not layout-preserving",
    "original styles, images, comments, and metadata are not preserved",
    "does not copy original DOCX XML parts",
    "does not redact embedded images",
    "Protected-site DOCX output can hand off a regenerated .redacted.docx when complete",
    "truncated or unsafe DOCX regeneration falls back to .redacted.txt or blocks raw upload",
    ".doc, .docm, and macros are unsupported",
    ".redacted.txt remains available as the fallback"
  ]) {
    assert.ok(scannerHtml.includes(required), `scanner copy should include: ${required}`);
  }

  assert.ok(
    scannerSource.includes("original styles, images, comments, and metadata are not preserved"),
    "scanner completion copy should state regenerated DOCX does not preserve source document adornments"
  );
}

async function testUnsafeDocxInputsDoNotProduceProofDocx() {
  for (const [name, buffer, expectedStatus] of [
    ["malformed.docx", makeDocx("", { malformed: true }), "docx_malformed_zip"],
    ["encrypted.docx", makeDocx("secret", { encrypted: true }), "docx_encrypted"],
    ["unsupported.docx", makeDocx("secret", { method: 12 }), "docx_unsupported_compression"],
    ["legacy.doc", makeDocx("secret"), "docx_unsupported_extension"],
    ["macro.docm", makeDocx("secret"), "docx_unsupported_extension"]
  ]) {
    const result = await DocxRedactor.createRedactedDocxFromText({
      originalName: name,
      originalBytes: buffer,
      text: "API_KEY=[PWM_1]"
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, expectedStatus);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "bytes"), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "fileName"), false);
  }
}

async function testEmptyAndOversizedSanitizedDocxTextHandling() {
  const source = makeDocx("safe source text");
  const empty = await DocxRedactor.createRedactedDocxFromText({
    originalName: "empty.docx",
    originalBytes: source,
    text: " \n\t "
  });
  assert.strictEqual(empty.ok, false);
  assert.strictEqual(empty.status, "docx_redacted_text_empty");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(empty, "bytes"), false);

  const keptPrefix = "API_KEY=[PWM_1]\n";
  const droppedTail = "TAIL_SHOULD_NOT_SURVIVE";
  const oversizedText = `${keptPrefix}${"A".repeat(DocxRedactor.MAX_DOCX_TEXT_CHARS)}${droppedTail}`;
  const bounded = await DocxRedactor.createRedactedDocxFromText({
    originalName: "large.docx",
    originalBytes: source,
    text: oversizedText
  });
  const bytesText = byteText(bounded.bytes);
  const extracted = await extractDocxText(arrayBufferFromBytes(bounded.bytes), bounded.fileName);

  assert.strictEqual(bounded.ok, true);
  assert.strictEqual(bounded.truncated, true);
  assert.strictEqual(bounded.fileName, "large.redacted.docx");
  assert.strictEqual(bytesText.includes(droppedTail), false);
  assert.strictEqual(extracted.status, EXTRACTOR_STATUS.OK);
  assert.ok(extracted.text.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(extracted.text.includes(droppedTail), false);
}

async function testFallbackTxtContractKeepsProtectedSiteAndScannerWired() {
  const pipelineSource = require("fs").readFileSync(
    path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"),
    "utf8"
  );
  const scannerHtml = require("fs").readFileSync(path.join(repoRoot, "src/scanner/scanner.html"), "utf8");
  const scannerSource = require("fs").readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");

  assert.ok(pipelineSource.includes('const EXTRACTED_TEXT_OUTPUT_KINDS = new Set(["pdf", "docx", "xlsx", "image_metadata", "image_ocr"]);'));
  assert.ok(pipelineSource.includes("createRedactedDocxFromText"), "protected-site DOCX uploads should use regenerated DOCX when safe");
  assert.ok(pipelineSource.includes("redacted_docx_file"), "protected-site DOCX handoff should have a DOCX output kind");
  assert.ok(pipelineSource.includes("docx-redaction:docx_redacted_text_truncated"), "protected-site DOCX should keep text fallback when regeneration is bounded");
  assert.ok(scannerHtml.includes("download-redacted-docx-btn"), "scanner page should expose a DOCX export button");
  assert.ok(scannerHtml.includes("../shared/docxRedactor.js"), "scanner page should load the local DOCX redactor helper");
  assert.ok(scannerSource.includes("currentRedactedDocx"), "scanner should track regenerated DOCX state separately");
  assert.ok(scannerSource.includes("createRedactedDocxFromText"), "scanner should generate DOCX output through sanitized text only");
  assert.ok(scannerSource.includes("downloadRedactedDocx"), "scanner should expose a dedicated DOCX download handler");
  assert.ok(scannerSource.includes('extension === ".docx"'));
  assert.ok(scannerSource.includes("redactedFileName"));
  assert.ok(scannerSource.includes("redactedFileName(currentScanResult.file.name)"), ".redacted.txt fallback download should remain available");
}

function testNoPersistenceLoggingOrUnsafeOverlayTerms() {
  const source = require("fs").readFileSync(path.join(repoRoot, "src/shared/docxRedactor.js"), "utf8");

  for (const forbidden of [
    "localStorage",
    "sessionStorage",
    "chrome.storage",
    "browser.storage",
    "pwm:audit",
    "console.log",
    "console.warn",
    "console.error",
    "comment",
    "highlight",
    "overlay"
  ]) {
    assert.strictEqual(source.includes(forbidden), false, `docxRedactor proof must not include ${forbidden}`);
  }
}

(async () => {
  await testGeneratedDocxContainsOnlySanitizedText();
  await testGeneratedDocxDropsOriginalHeaderFooterFootnoteEndnoteText();
  testScannerCopyStatesRegeneratedDocxBoundaries();
  await testUnsafeDocxInputsDoNotProduceProofDocx();
  await testEmptyAndOversizedSanitizedDocxTextHandling();
  await testFallbackTxtContractKeepsProtectedSiteAndScannerWired();
  testNoPersistenceLoggingOrUnsafeOverlayTerms();
  console.log("docx_redactor tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
