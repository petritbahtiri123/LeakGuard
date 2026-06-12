(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const MAX_XLSX_TEXT_CHARS = 180000;
  const MAX_CELL_TEXT_CHARS = 32000;
  const textEncoder = new TextEncoder();

  function normalizeFileName(fileName) {
    return String(fileName || "file").split(/[\\/]/).pop() || "file";
  }

  function redactedXlsxFileName(fileName) {
    const normalized = normalizeFileName(fileName);
    const withoutExtension = normalized.replace(/\.xlsx$/i, "").replace(/^\.+/, "") || "file";
    return `${withoutExtension}.redacted.xlsx`;
  }

  function hasSupportedXlsxExtension(fileName) {
    const name = String(fileName || "");
    return /\.xlsx$/i.test(name) && !/\.(?:xls|xlsm|xlsb|xltm)$/i.test(name.replace(/\.xlsx$/i, ""));
  }

  function normalizeText(text) {
    return String(text || "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").slice(0, MAX_XLSX_TEXT_CHARS);
  }

  function isTruncatedText(text) {
    return String(text || "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").length > MAX_XLSX_TEXT_CHARS;
  }

  function escapeXml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function columnName(index) {
    let value = index + 1;
    let output = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      output = String.fromCharCode(65 + remainder) + output;
      value = Math.floor((value - 1) / 26);
    }
    return output;
  }

  function splitCellText(line) {
    const value = String(line || "");
    if (!value) return [""];
    const output = [];
    for (let index = 0; index < value.length; index += MAX_CELL_TEXT_CHARS) {
      output.push(value.slice(index, index + MAX_CELL_TEXT_CHARS));
    }
    return output;
  }

  function worksheetRows(text) {
    const lines = normalizeText(text).split("\n");
    const rows = [];
    for (const line of lines) {
      for (const part of splitCellText(line)) {
        rows.push(part);
      }
    }
    return rows.length ? rows : [""];
  }

  function worksheetXml(text) {
    const rows = worksheetRows(text);
    const sheetRows = rows
      .map((value, index) => {
        const row = index + 1;
        const cell = `${columnName(0)}${row}`;
        return `<row r="${row}"><c r="${cell}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c></row>`;
      })
      .join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
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

  function buildXlsxBytes(text) {
    return buildZip([
      zipEntry("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
      zipEntry("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
      zipEntry("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Redacted" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      zipEntry("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      zipEntry("xl/worksheets/sheet1.xml", worksheetXml(text))
    ]);
  }

  function createRedactedXlsxFromText(options = {}) {
    const originalName = options.originalName || "file.xlsx";
    if (!hasSupportedXlsxExtension(originalName)) {
      return {
        ok: false,
        status: "xlsx_unsupported_extension"
      };
    }

    const text = normalizeText(options.text);
    if (!text.trim()) {
      return {
        ok: false,
        status: "xlsx_redacted_text_empty"
      };
    }

    return {
      ok: true,
      status: "xlsx_redacted_ready",
      fileName: redactedXlsxFileName(originalName),
      mimeType: XLSX_MIME_TYPE,
      bytes: buildXlsxBytes(text),
      source: "sanitized_text",
      truncated: isTruncatedText(options.text)
    };
  }

  function createRedactedXlsxFromExtraction(options = {}) {
    const extraction = options.extraction || {};
    if (extraction.status !== "ok" || extraction.kind !== "xlsx" || extraction.safeForScan !== true) {
      return {
        ok: false,
        status: extraction.reason || extraction.status || "xlsx_extraction_not_safe"
      };
    }
    return createRedactedXlsxFromText({
      originalName: options.originalName || extraction.metadata?.fileName,
      text: options.sanitizedText
    });
  }

  root.PWM.XlsxRedactor = {
    XLSX_MIME_TYPE,
    MAX_XLSX_TEXT_CHARS,
    redactedXlsxFileName,
    createRedactedXlsxFromText,
    createRedactedXlsxFromExtraction
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.XlsxRedactor;
  }
})();
