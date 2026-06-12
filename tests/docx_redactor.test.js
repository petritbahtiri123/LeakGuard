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
    "sk-proj-DocxEndnoteSecret1234567890abcdef"
  ];
  const source = makeDocx(`body=${secrets[0]}`, {
    headerText: `header=${secrets[1]}`,
    footerText: `footer=${secrets[2]}`,
    footnoteText: `footnote=${secrets[3]}`,
    endnoteText: `endnote=${secrets[4]}`
  });
  const result = await DocxRedactor.createRedactedDocxFromText({
    originalName: "with-parts.docx",
    originalBytes: source,
    text: "body=[PWM_1]\nheader=[PWM_2]\nfooter=[PWM_3]\nfootnote=[PWM_4]\nendnote=[PWM_5]"
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
  assert.ok(extracted.text.includes("header=[PWM_2]"));
  assert.ok(extracted.text.includes("endnote=[PWM_5]"));
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

async function testFallbackTxtContractRemainsUnwired() {
  const pipelineSource = require("fs").readFileSync(
    path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"),
    "utf8"
  );
  const scannerSource = require("fs").readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");

  assert.ok(pipelineSource.includes('const EXTRACTED_TEXT_OUTPUT_KINDS = new Set(["pdf", "docx", "xlsx", "image_metadata", "image_ocr"]);'));
  assert.strictEqual(pipelineSource.includes("createRedactedDocxFrom"), false);
  assert.strictEqual(scannerSource.includes("createRedactedDocxFrom"), false);
  assert.ok(scannerSource.includes('extension === ".docx"'));
  assert.ok(scannerSource.includes("redactedFileName"));
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
  await testUnsafeDocxInputsDoNotProduceProofDocx();
  await testFallbackTxtContractRemainsUnwired();
  testNoPersistenceLoggingOrUnsafeOverlayTerms();
  console.log("docx_redactor tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
