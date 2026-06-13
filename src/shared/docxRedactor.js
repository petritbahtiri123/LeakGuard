(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const MAX_DOCX_TEXT_CHARS = 180000;
  const textEncoder = new TextEncoder();

  function normalizeFileName(fileName) {
    return String(fileName || "file").split(/[\\/]/).pop() || "file";
  }

  function redactedDocxFileName(fileName) {
    const normalized = normalizeFileName(fileName);
    const withoutExtension = normalized.replace(/\.docx$/i, "").replace(/^\.+/, "") || "file";
    return `${withoutExtension}.redacted.docx`;
  }

  function toUint8Array(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return new Uint8Array();
  }

  function readUInt16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function readUInt32LE(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function writeUInt16LE(bytes, value, offset) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
  }

  function writeUInt32LE(bytes, value, offset) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
  }

  function decodeUtf8(bytes) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  function validateOriginalDocx(originalName, originalBytes) {
    if (!/\.docx$/i.test(String(originalName || "")) || /\.docm$/i.test(String(originalName || ""))) {
      return "docx_unsupported_extension";
    }

    const bytes = toUint8Array(originalBytes);
    if (bytes.byteLength < 4) return "docx_malformed_zip";

    let offset = 0;
    let sawLocalHeader = false;
    let sawDocument = false;

    while (offset + 4 <= bytes.byteLength) {
      const signature = readUInt32LE(bytes, offset);
      if (signature === 0x02014b50 || signature === 0x06054b50) break;
      if (signature !== 0x04034b50) return sawLocalHeader ? "" : "docx_malformed_zip";
      if (offset + 30 > bytes.byteLength) return "docx_malformed_zip";

      sawLocalHeader = true;
      const flags = readUInt16LE(bytes, offset + 6);
      const method = readUInt16LE(bytes, offset + 8);
      const compressedSize = readUInt32LE(bytes, offset + 18);
      const fileNameLength = readUInt16LE(bytes, offset + 26);
      const extraLength = readUInt16LE(bytes, offset + 28);
      const nameStart = offset + 30;
      const nameEnd = nameStart + fileNameLength;
      const dataStart = nameEnd + extraLength;
      const dataEnd = dataStart + compressedSize;
      if (nameEnd > bytes.byteLength || dataEnd > bytes.byteLength) return "docx_malformed_zip";

      const name = decodeUtf8(bytes.slice(nameStart, nameEnd)).replace(/\\/g, "/");
      if (flags & 1 || /^(?:EncryptedPackage|EncryptionInfo)$/i.test(name)) return "docx_encrypted";
      if (method !== 0 && method !== 8) return "docx_unsupported_compression";
      if (/^word\/vbaProject\.bin$/i.test(name)) return "docx_macro_not_supported";
      if (/^word\/document\.xml$/i.test(name)) sawDocument = true;

      offset = dataEnd;
    }

    if (!sawLocalHeader || !sawDocument) return "docx_malformed_zip";
    return "";
  }

  function normalizeText(text) {
    return String(text || "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").slice(0, MAX_DOCX_TEXT_CHARS);
  }

  function isTruncatedText(text) {
    return String(text || "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").length > MAX_DOCX_TEXT_CHARS;
  }

  function escapeXml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function paragraphXml(line) {
    return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
  }

  function documentXml(text) {
    const paragraphs = normalizeText(text).split("\n").map(paragraphXml).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`;
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[index] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let value = 0xffffffff;
    for (let index = 0; index < bytes.byteLength; index += 1) {
      value = crcTable[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
    }
    return (value ^ 0xffffffff) >>> 0;
  }

  function concatBytes(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  }

  function zipEntry(name, content) {
    return {
      nameBytes: textEncoder.encode(name),
      dataBytes: textEncoder.encode(content),
      crc: 0
    };
  }

  function buildZip(entries) {
    const fileChunks = [];
    const directoryChunks = [];
    let offset = 0;

    for (const entry of entries) {
      entry.crc = crc32(entry.dataBytes);
      const local = new Uint8Array(30);
      writeUInt32LE(local, 0x04034b50, 0);
      writeUInt16LE(local, 20, 4);
      writeUInt16LE(local, 0, 6);
      writeUInt16LE(local, 0, 8);
      writeUInt32LE(local, 0, 10);
      writeUInt32LE(local, entry.crc, 14);
      writeUInt32LE(local, entry.dataBytes.byteLength, 18);
      writeUInt32LE(local, entry.dataBytes.byteLength, 22);
      writeUInt16LE(local, entry.nameBytes.byteLength, 26);
      writeUInt16LE(local, 0, 28);
      fileChunks.push(local, entry.nameBytes, entry.dataBytes);

      const central = new Uint8Array(46);
      writeUInt32LE(central, 0x02014b50, 0);
      writeUInt16LE(central, 20, 4);
      writeUInt16LE(central, 20, 6);
      writeUInt16LE(central, 0, 8);
      writeUInt16LE(central, 0, 10);
      writeUInt32LE(central, 0, 12);
      writeUInt32LE(central, entry.crc, 16);
      writeUInt32LE(central, entry.dataBytes.byteLength, 20);
      writeUInt32LE(central, entry.dataBytes.byteLength, 24);
      writeUInt16LE(central, entry.nameBytes.byteLength, 28);
      writeUInt16LE(central, 0, 30);
      writeUInt16LE(central, 0, 32);
      writeUInt16LE(central, 0, 34);
      writeUInt16LE(central, 0, 36);
      writeUInt32LE(central, 0, 38);
      writeUInt32LE(central, offset, 42);
      directoryChunks.push(central, entry.nameBytes);

      offset += local.byteLength + entry.nameBytes.byteLength + entry.dataBytes.byteLength;
    }

    const directory = concatBytes(directoryChunks);
    const end = new Uint8Array(22);
    writeUInt32LE(end, 0x06054b50, 0);
    writeUInt16LE(end, 0, 4);
    writeUInt16LE(end, 0, 6);
    writeUInt16LE(end, entries.length, 8);
    writeUInt16LE(end, entries.length, 10);
    writeUInt32LE(end, directory.byteLength, 12);
    writeUInt32LE(end, offset, 16);
    writeUInt16LE(end, 0, 20);

    return concatBytes([...fileChunks, directory, end]);
  }

  function buildDocxBytes(text) {
    return buildZip([
      zipEntry("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
      zipEntry("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
      zipEntry("word/document.xml", documentXml(text))
    ]);
  }

  async function createRedactedDocxFromText(options = {}) {
    const originalName = options.originalName || "file.docx";
    const validationStatus = validateOriginalDocx(originalName, options.originalBytes);
    if (validationStatus) {
      return {
        ok: false,
        status: validationStatus
      };
    }

    const text = normalizeText(options.text);
    if (!text.trim()) {
      return {
        ok: false,
        status: "docx_redacted_text_empty"
      };
    }

    return {
      ok: true,
      status: "docx_redacted_ready",
      fileName: redactedDocxFileName(originalName),
      mimeType: DOCX_MIME_TYPE,
      bytes: buildDocxBytes(text),
      source: "sanitized_text",
      truncated: isTruncatedText(options.text)
    };
  }

  root.PWM.DocxRedactor = {
    DOCX_MIME_TYPE,
    MAX_DOCX_TEXT_CHARS,
    redactedDocxFileName,
    createRedactedDocxFromText
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.DocxRedactor;
  }
})();
