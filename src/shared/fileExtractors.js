(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const FileTypeRegistry = root.PWM.FileTypeRegistry || {};

  const EXTRACTOR_STATUS = Object.freeze({
    OK: "ok",
    UNSUPPORTED: "unsupported",
    PLANNED_UNSUPPORTED: "planned_unsupported",
    ERROR: "error"
  });
  const PDF_TEXT_EXTRACTION_MAX_BYTES = 4 * 1024 * 1024;
  const DOCX_TEXT_EXTRACTION_MAX_BYTES = 4 * 1024 * 1024;
  const XLSX_TEXT_EXTRACTION_MAX_BYTES = 4 * 1024 * 1024;
  const XLSX_XML_PART_MAX_BYTES = 8 * 1024 * 1024;
  const XLSX_ZIP_ENTRY_MAX_COUNT = 1000;
  const XLSX_SHARED_STRING_ITEM_PATTERN = /<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/gi;
  const XLSX_SHEET_NAME_PATTERN = /<(?:[A-Za-z_][\w.-]*:)?sheet\b[^>]*\bname=(["'])([\s\S]*?)\1/gi;
  const XLSX_WORKSHEET_CELL_PATTERN = /<(?:[A-Za-z_][\w.-]*:)?c\b[^>]*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?c>/gi;
  const XLSX_TEXT_TAG_PATTERN = /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi;
  const XLSX_VALUE_TAG_PATTERN = /<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/gi;
  const XLSX_FORMULA_TAG_PATTERN = /<(?:[A-Za-z_][\w.-]*:)?f\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?f>/gi;
  const XLSX_CELL_TYPE_ATTRIBUTE_PATTERN = /\bt=(["'])(.*?)\1/i;
  const xlsxXmlTextPatternCache = new Map();
  const xlsxCellAttributePatternCache = new Map();
  const IMAGE_METADATA_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

  function normalizeText(text) {
    return typeof text === "string" ? text : "";
  }

  function normalizeWarnings(warnings) {
    return Array.isArray(warnings) ? warnings.filter(Boolean).map(String) : [];
  }

  function createExtractorResult({
    status,
    kind = "",
    text = "",
    metadata = {},
    warnings = [],
    reason = "",
    safeForScan = false
  } = {}) {
    return {
      status: status || EXTRACTOR_STATUS.ERROR,
      kind,
      text: normalizeText(text),
      metadata: metadata && typeof metadata === "object" ? { ...metadata } : {},
      warnings: normalizeWarnings(warnings),
      reason: String(reason || ""),
      safeForScan: Boolean(safeForScan)
    };
  }

  function classify(fileInfo) {
    if (FileTypeRegistry.classifyFileType) {
      return FileTypeRegistry.classifyFileType(fileInfo);
    }

    return {
      status: "unsupported",
      kind: "unsupported",
      family: "unknown",
      action: "allow",
      supported: false,
      extension: "",
      mimeType: ""
    };
  }

  function getExtension(fileInfo) {
    if (FileTypeRegistry.getFileExtension) return FileTypeRegistry.getFileExtension(fileInfo?.fileName);
    const name = String(fileInfo?.fileName || "").split(/[\\/]/).pop().toLowerCase();
    const index = name.lastIndexOf(".");
    return index > 0 ? name.slice(index) : "";
  }

  function buildMetadata(fileInfo, classification) {
    const normalizeFileName = FileTypeRegistry.normalizeFileName || ((value) => String(value || ""));
    const normalizeMimeType =
      FileTypeRegistry.normalizeMimeType || ((value) => String(value || "").split(";")[0].trim().toLowerCase());

    return {
      fileName: normalizeFileName(fileInfo?.fileName),
      extension: classification.extension || getExtension(fileInfo),
      mimeType: classification.mimeType || normalizeMimeType(fileInfo?.mimeType),
      status: classification.status || "",
      family: classification.family || "",
      planned: Boolean(classification.planned),
      fallbackNamePattern: classification.fallbackNamePattern || ""
    };
  }

  function routeFileExtractor(fileInfo = {}) {
    const classification = classify(fileInfo);
    const metadata = buildMetadata(fileInfo, classification);

    if (metadata.extension === ".pdf" || metadata.extension === ".docx" || metadata.extension === ".xlsx") {
      const kind = metadata.extension.slice(1);
      return createExtractorResult({
        status: EXTRACTOR_STATUS.OK,
        kind,
        metadata: {
          ...metadata,
          status: EXTRACTOR_STATUS.OK,
          family: "document",
          planned: false
        },
        safeForScan: true
      });
    }

    if (IMAGE_METADATA_EXTENSIONS.has(metadata.extension)) {
      return createExtractorResult({
        status: EXTRACTOR_STATUS.OK,
        kind: "image_metadata",
        metadata: {
          ...metadata,
          fileName: "",
          status: EXTRACTOR_STATUS.OK,
          family: "image",
          planned: false
        },
        warnings: ["image_ocr_not_supported"],
        safeForScan: true
      });
    }

    if (classification.status === "supported" && classification.family === "text") {
      return createExtractorResult({
        status: EXTRACTOR_STATUS.OK,
        kind: "text",
        metadata,
        safeForScan: true
      });
    }

    if (classification.status === "planned_unsupported") {
      return createExtractorResult({
        status: EXTRACTOR_STATUS.PLANNED_UNSUPPORTED,
        kind: classification.family || "planned_unsupported",
        metadata,
        reason: `${classification.family || "file"} extraction is planned but disabled in this release.`,
        safeForScan: false
      });
    }

    return createExtractorResult({
      status: EXTRACTOR_STATUS.UNSUPPORTED,
      kind: "unsupported",
      metadata,
      reason: "Unsupported file type for local text extraction.",
      safeForScan: false
    });
  }

  function prepareFileExtraction(fileInfo = {}) {
    const routed = routeFileExtractor(fileInfo);
    if (!routed.safeForScan) return routed;
    if (routed.kind === "pdf") {
      return safePdfError(routed, "pdf_requires_binary_extraction");
    }
    if (routed.kind === "docx") {
      return safeDocumentError(routed, "docx_requires_binary_extraction");
    }
    if (routed.kind === "xlsx") {
      return safeDocumentError(routed, "xlsx_requires_binary_extraction");
    }
    if (routed.kind === "image_metadata") {
      return extractImageMetadata(fileInfo, routed);
    }

    return createExtractorResult({
      ...routed,
      text: normalizeText(fileInfo.text),
      safeForScan: true
    });
  }

  function toUint8Array(buffer) {
    if (buffer instanceof Uint8Array) return buffer;
    if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
    if (ArrayBuffer.isView(buffer)) {
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    return null;
  }

  function decodePdfBytes(buffer) {
    const bytes = toUint8Array(buffer);
    if (!bytes) throw new Error("pdf_read_failed");
    return decodePdfByteString(bytes);
  }

  function decodePdfByteString(bytes) {
    let output = "";
    for (let index = 0; index < bytes.byteLength; index += 1) {
      output += String.fromCharCode(bytes[index]);
    }
    return output;
  }

  function readUInt16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function readUInt32LE(bytes, offset) {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }

  let utf8Decoder = null;

  function getUtf8Decoder() {
    if (!utf8Decoder) utf8Decoder = new TextDecoder("utf-8", { fatal: false });
    return utf8Decoder;
  }

  function decodeUtf8Bytes(bytes) {
    return getUtf8Decoder().decode(bytes);
  }

  function classifySizeBucket(sizeBytes) {
    const size = Number(sizeBytes);
    if (!Number.isFinite(size) || size < 0) return "unknown";
    if (size < 64 * 1024) return "small";
    if (size < 2 * 1024 * 1024) return "medium";
    return "large";
  }

  function extractImageMetadata(fileInfo, routed) {
    const fileName = FileTypeRegistry.normalizeFileName
      ? FileTypeRegistry.normalizeFileName(fileInfo?.fileName)
      : String(fileInfo?.fileName || "").split(/[\\/]/).pop();
    const extension = routed.metadata.extension || getExtension(fileInfo);
    const mimeType = routed.metadata.mimeType || "";
    const sizeBucket = classifySizeBucket(fileInfo?.sizeBytes);
    const text = [
      `file_name=${fileName}`,
      `extension=${extension}`,
      `mime_type=${mimeType}`,
      `size_bucket=${sizeBucket}`,
      "visual_text_scanned=false",
      "image_ocr_supported=false",
      "image_redaction_supported=false"
    ].join("\n");

    return createExtractorResult({
      ...routed,
      text,
      metadata: {
        ...routed.metadata,
        fileName: "",
        textLength: text.length,
        sizeBucket,
        visualContentScanned: false,
        ocrSupported: false,
        imageRedactionSupported: false
      },
      warnings: ["image_ocr_not_supported"],
      safeForScan: true
    });
  }

  async function inflateBytes(bytes, format) {
    if (typeof DecompressionStream !== "function" || typeof Blob !== "function") {
      return null;
    }

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  }

  function decodePdfEscapedString(value) {
    let output = "";
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      if (char !== "\\") {
        output += char;
        continue;
      }

      const next = value[index + 1];
      if (next === "n") output += "\n";
      else if (next === "r") output += "\r";
      else if (next === "t") output += "\t";
      else if (next === "b") output += "\b";
      else if (next === "f") output += "\f";
      else if (next === "(" || next === ")" || next === "\\") output += next;
      else if (/[0-7]/.test(next || "")) {
        const match = value.slice(index + 1).match(/^[0-7]{1,3}/);
        output += String.fromCharCode(parseInt(match[0], 8));
        index += match[0].length;
        continue;
      } else if (next === "\r" && value[index + 2] === "\n") {
        index += 2;
        continue;
      } else if (next === "\r" || next === "\n") {
        index += 1;
        continue;
      } else if (next) {
        output += next;
      }
      index += 1;
    }
    return output;
  }

  function decodePdfHexString(value) {
    const compact = value.replace(/\s+/g, "");
    let output = "";
    for (let index = 0; index < compact.length; index += 2) {
      const pair = compact.slice(index, index + 2).padEnd(2, "0");
      const code = parseInt(pair, 16);
      if (Number.isFinite(code)) output += String.fromCharCode(code);
    }
    return output;
  }

  function readBalancedPdfString(source, start) {
    let depth = 1;
    let value = "";
    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index];
      if (char === "\\") {
        value += char;
        if (index + 1 < source.length) {
          value += source[index + 1];
          index += 1;
        }
        continue;
      }
      if (char === "(") {
        depth += 1;
        value += char;
        continue;
      }
      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          return { value: decodePdfEscapedString(value), end: index + 1 };
        }
        value += char;
        continue;
      }
      value += char;
    }
    return null;
  }

  function readPdfHexString(source, start) {
    const end = source.indexOf(">", start + 1);
    if (end === -1) return null;
    return {
      value: decodePdfHexString(source.slice(start + 1, end)),
      end: end + 1
    };
  }

  function nextTextToken(source, start) {
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (char === "(") return readBalancedPdfString(source, index);
      if (char === "<" && source[index + 1] !== "<") return readPdfHexString(source, index);
    }
    return null;
  }

  function extractPdfTextTokens(source) {
    const parts = [];
    let index = 0;
    while (index < source.length) {
      const token = nextTextToken(source, index);
      if (!token) break;
      if (token.value) parts.push(token.value);
      index = Math.max(token.end || index + 1, index + 1);
    }
    return parts.join("");
  }

  function extractTextFromPdfContent(content) {
    const textParts = [];
    const textObjectPattern = /BT([\s\S]*?)ET/g;
    let objectMatch;
    while ((objectMatch = textObjectPattern.exec(content))) {
      const objectSource = objectMatch[1];
      const textOperatorPattern = /(?:\((?:\\.|[^\\()])*(?:\((?:\\.|[^\\()])*\)(?:\\.|[^\\()])*)*\)|<[\da-fA-F\s]+>|\[[\s\S]*?\])\s*(?:Tj|TJ|'|")/g;
      let operatorMatch;
      while ((operatorMatch = textOperatorPattern.exec(objectSource))) {
        const value = extractPdfTextTokens(operatorMatch[0]);
        if (value) textParts.push(value);
      }
    }
    return textParts.join("\n").replace(/\r\n?/g, "\n").trim();
  }

  function getPdfStreamEntries(source, bytes) {
    const entries = [];
    const streamPattern = /(<<[\s\S]*?>>)\s*stream\r?\n?/g;
    let match;
    while ((match = streamPattern.exec(source))) {
      const bodyStart = match.index + match[0].length;
      let bodyEnd = source.indexOf("endstream", bodyStart);
      if (bodyEnd === -1) continue;
      if (source[bodyEnd - 1] === "\n") bodyEnd -= 1;
      if (source[bodyEnd - 1] === "\r") bodyEnd -= 1;
      entries.push({
        dictionary: match[1],
        bytes: bytes.slice(bodyStart, bodyEnd)
      });
    }
    return entries;
  }

  async function inflatePdfStream(bytes) {
    return inflateBytes(bytes, "deflate");
  }

  function decodeAscii85Bytes(bytes) {
    const output = [];
    let group = [];

    const flushGroup = (final = false) => {
      if (!group.length) return true;
      if (final && group.length === 1) return false;
      const originalLength = group.length;
      while (group.length < 5) group.push(84);
      let value = 0;
      for (const digit of group) value = value * 85 + digit;
      const decoded = [
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff
      ];
      output.push(...decoded.slice(0, final ? originalLength - 1 : 4));
      group = [];
      return true;
    };

    for (let index = 0; index < bytes.length; index += 1) {
      const byte = bytes[index];
      if (byte === 0x00 || byte === 0x09 || byte === 0x0a || byte === 0x0c || byte === 0x0d || byte === 0x20) {
        continue;
      }
      if (byte === 0x3c && bytes[index + 1] === 0x7e) {
        index += 1;
        continue;
      }
      if (byte === 0x7e) break;
      if (byte === 0x7a && group.length === 0) {
        output.push(0, 0, 0, 0);
        continue;
      }
      if (byte < 0x21 || byte > 0x75) return null;
      group.push(byte - 0x21);
      if (group.length === 5 && !flushGroup(false)) return null;
    }

    if (!flushGroup(true)) return null;
    return new Uint8Array(output);
  }

  function getPdfStreamFilters(dictionary) {
    const filterMatch = String(dictionary || "").match(/\/Filter\s*(\[[\s\S]*?\]|\/[A-Za-z0-9]+)/);
    if (!filterMatch) return [];
    const source = filterMatch[1];
    if (source.startsWith("[")) {
      return Array.from(source.matchAll(/\/([A-Za-z0-9]+)/g), (match) => match[1]);
    }
    return [source.replace(/^\//, "")].filter(Boolean);
  }

  function normalizePdfFilterName(filterName) {
    const name = String(filterName || "");
    if (name === "FlateDecode" || name === "Fl") return "FlateDecode";
    if (name === "ASCII85Decode" || name === "A85") return "ASCII85Decode";
    return name;
  }

  async function decodePdfStreamEntry(entry) {
    const filters = getPdfStreamFilters(entry.dictionary).map(normalizePdfFilterName);
    let bytes = entry.bytes;
    if (!filters.length) return decodePdfByteString(bytes);

    for (const filterName of filters) {
      if (filterName === "ASCII85Decode") {
        const decoded = decodeAscii85Bytes(bytes);
        if (!decoded) return "";
        bytes = decoded;
        continue;
      }
      if (filterName === "FlateDecode") {
        const inflated = await inflatePdfStream(bytes);
        if (!inflated) return "";
        bytes = inflated;
        continue;
      }
      return "";
    }

    return decodePdfByteString(bytes);
  }

  function safePdfError(routed, reason) {
    return safeDocumentError(routed, reason);
  }

  function safeDocumentError(routed, reason) {
    return createExtractorResult({
      ...routed,
      status: EXTRACTOR_STATUS.ERROR,
      text: "",
      reason,
      safeForScan: false
    });
  }

  async function extractPdfText(fileInfo, routed) {
    let source;
    try {
      source = decodePdfBytes(fileInfo?.buffer);
    } catch {
      return safePdfError(routed, "pdf_read_failed");
    }

    if (!source.startsWith("%PDF-")) return safePdfError(routed, "pdf_malformed");
    if (/\/Encrypt\b/.test(source)) return safePdfError(routed, "pdf_encrypted");

    const bytes = toUint8Array(fileInfo?.buffer);
    const streamContents = await Promise.all(getPdfStreamEntries(source, bytes).map(decodePdfStreamEntry));
    const streamText = streamContents.map(extractTextFromPdfContent).filter(Boolean).join("\n");
    const text = streamText.replace(/\r\n?/g, "\n").trim();

    if (!text) return safePdfError(routed, "pdf_no_extractable_text");
    if (text.length > PDF_TEXT_EXTRACTION_MAX_BYTES) return safePdfError(routed, "pdf_text_too_large");

    return createExtractorResult({
      ...routed,
      text,
      metadata: {
        ...routed.metadata,
        textLength: text.length
      },
      safeForScan: true
    });
  }

  async function parseZipEntries(buffer) {
    const bytes = toUint8Array(buffer);
    if (!bytes || bytes.byteLength < 4) {
      throw new Error("docx_malformed_zip");
    }

    const entries = [];
    let offset = 0;
    let sawLocalHeader = false;

    while (offset + 4 <= bytes.byteLength) {
      const signature = readUInt32LE(bytes, offset);
      if (signature === 0x02014b50 || signature === 0x06054b50) break;
      if (signature !== 0x04034b50) {
        if (!sawLocalHeader) throw new Error("docx_malformed_zip");
        break;
      }

      sawLocalHeader = true;
      if (offset + 30 > bytes.byteLength) throw new Error("docx_malformed_zip");
      const flags = readUInt16LE(bytes, offset + 6);
      const method = readUInt16LE(bytes, offset + 8);
      const compressedSize = readUInt32LE(bytes, offset + 18);
      const uncompressedSize = readUInt32LE(bytes, offset + 22);
      const fileNameLength = readUInt16LE(bytes, offset + 26);
      const extraLength = readUInt16LE(bytes, offset + 28);
      const nameStart = offset + 30;
      const nameEnd = nameStart + fileNameLength;
      const dataStart = nameEnd + extraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.byteLength || nameEnd > bytes.byteLength) {
        throw new Error("docx_malformed_zip");
      }

      const name = decodeUtf8Bytes(bytes.subarray(nameStart, nameEnd)).replace(/\\/g, "/");
      entries.push({
        name,
        flags,
        method,
        compressedSize,
        uncompressedSize,
        compressedBytes: bytes.subarray(dataStart, dataEnd)
      });
      offset = dataEnd;
    }

    if (!sawLocalHeader) throw new Error("docx_malformed_zip");
    return entries;
  }

  function isSafeDocxTextPart(name) {
    return /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(name);
  }

  function sortDocxTextParts(left, right) {
    const order = (name) => {
      if (/^word\/document\.xml$/i.test(name)) return 0;
      if (/^word\/header\d+\.xml$/i.test(name)) return 1;
      if (/^word\/footer\d+\.xml$/i.test(name)) return 2;
      if (/^word\/footnotes\.xml$/i.test(name)) return 3;
      if (/^word\/endnotes\.xml$/i.test(name)) return 4;
      return 5;
    };
    return order(left.name) - order(right.name) || left.name.localeCompare(right.name);
  }

  async function readZipEntryText(entry) {
    if (entry.flags & 1) throw new Error("docx_encrypted");
    if (entry.method === 0) return decodeUtf8Bytes(entry.compressedBytes);
    if (entry.method === 8) {
      const inflated = await inflateBytes(entry.compressedBytes, "deflate-raw");
      if (!inflated) throw new Error("docx_unsupported_compression");
      if (entry.uncompressedSize && inflated.byteLength !== entry.uncompressedSize) {
        throw new Error("docx_malformed_zip");
      }
      return decodeUtf8Bytes(inflated);
    }
    throw new Error("docx_unsupported_compression");
  }

  function decodeXmlEntities(text) {
    return String(text || "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_match, value) => String.fromCodePoint(parseInt(value, 16)))
      .replace(/&#(\d+);/g, (_match, value) => String.fromCodePoint(parseInt(value, 10)))
      .replace(/&amp;/g, "&");
  }

  function extractTextFromDocxXml(xml) {
    const textParts = [];
    const tokenPattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>|<\/w:p>/g;
    let match;
    while ((match = tokenPattern.exec(xml))) {
      if (match[1] !== undefined) {
        textParts.push(decodeXmlEntities(match[1]));
      } else if (/^<w:tab\b/i.test(match[0])) {
        textParts.push("\t");
      } else {
        textParts.push("\n");
      }
    }
    return textParts.join("").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  }

  async function extractDocxText(fileInfo, routed) {
    let entries;
    try {
      entries = await parseZipEntries(fileInfo?.buffer);
    } catch (error) {
      return safeDocumentError(routed, error?.message || "docx_malformed_zip");
    }

    if (entries.some((entry) => entry.flags & 1 || /^(?:EncryptedPackage|EncryptionInfo)$/i.test(entry.name))) {
      return safeDocumentError(routed, "docx_encrypted");
    }

    const textEntries = entries.filter((entry) => isSafeDocxTextPart(entry.name)).sort(sortDocxTextParts);
    if (!textEntries.length) return safeDocumentError(routed, "docx_no_extractable_text");

    const textParts = [];
    try {
      for (const entry of textEntries) {
        const xml = await readZipEntryText(entry);
        const partText = extractTextFromDocxXml(xml);
        if (partText) textParts.push(partText);
      }
    } catch (error) {
      return safeDocumentError(routed, error?.message || "docx_malformed_zip");
    }

    const text = textParts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return safeDocumentError(routed, "docx_no_extractable_text");
    if (text.length > DOCX_TEXT_EXTRACTION_MAX_BYTES) {
      return safeDocumentError(routed, "docx_text_too_large");
    }

    return createExtractorResult({
      ...routed,
      text,
      metadata: {
        ...routed.metadata,
        textLength: text.length,
        extractedParts: textEntries.length
      },
      safeForScan: true
    });
  }

  function normalizeXlsxZipError(error) {
    const reason = String(error?.message || "");
    if (reason === "docx_encrypted") return "xlsx_encrypted";
    if (reason === "docx_unsupported_compression") return "xlsx_unsupported_compression";
    if (reason === "docx_malformed_zip") return "xlsx_malformed_zip";
    if (reason.startsWith("xlsx_")) return reason;
    return "xlsx_malformed_zip";
  }

  function isSafeXlsxTextPart(name) {
    return (
      /^xl\/sharedStrings\.xml$/i.test(name) ||
      /^xl\/workbook\.xml$/i.test(name) ||
      /^xl\/worksheets\/sheet\d+\.xml$/i.test(name) ||
      /^xl\/comments\d*\.xml$/i.test(name)
    );
  }

  function sortXlsxTextParts(left, right) {
    const order = (name) => {
      if (/^xl\/workbook\.xml$/i.test(name)) return 0;
      if (/^xl\/sharedStrings\.xml$/i.test(name)) return 1;
      if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)) return 2;
      if (/^xl\/comments\d*\.xml$/i.test(name)) return 3;
      return 4;
    };
    return order(left.name) - order(right.name) || left.name.localeCompare(right.name);
  }

  async function readXlsxXmlPart(entry) {
    if (entry.uncompressedSize > XLSX_XML_PART_MAX_BYTES) throw new Error("xlsx_xml_too_large");
    const xml = await readZipEntryText(entry);
    if (xml.length > XLSX_XML_PART_MAX_BYTES) throw new Error("xlsx_xml_too_large");
    return xml;
  }

  function extractXmlTextValues(xml, tagName) {
    const values = [];
    const pattern = getXlsxXmlTextPattern(tagName);
    let match;
    while ((match = pattern.exec(xml))) {
      const value = decodeXmlEntities(match[1].replace(/[<>]/g, ""));
      if (value) values.push(value);
    }
    return values;
  }

  function getXlsxXmlTextPattern(tagName) {
    if (tagName === "t") {
      XLSX_TEXT_TAG_PATTERN.lastIndex = 0;
      return XLSX_TEXT_TAG_PATTERN;
    }
    if (tagName === "v") {
      XLSX_VALUE_TAG_PATTERN.lastIndex = 0;
      return XLSX_VALUE_TAG_PATTERN;
    }
    if (tagName === "f") {
      XLSX_FORMULA_TAG_PATTERN.lastIndex = 0;
      return XLSX_FORMULA_TAG_PATTERN;
    }
    let pattern = xlsxXmlTextPatternCache.get(tagName);
    if (!pattern) {
      const qualifiedTagName = `(?:[A-Za-z_][\\w.-]*:)?${tagName}`;
      pattern = new RegExp(
        `<${qualifiedTagName}\\b[^>]*>([\\s\\S]*?)<\\/${qualifiedTagName}>`,
        "gi"
      );
      xlsxXmlTextPatternCache.set(tagName, pattern);
    }
    pattern.lastIndex = 0;
    return pattern;
  }

  function extractSharedStrings(xml) {
    const strings = [];
    // Cached global XLSX regexes must reset before each scan to avoid skipped matches.
    XLSX_SHARED_STRING_ITEM_PATTERN.lastIndex = 0;
    let itemMatch;
    while ((itemMatch = XLSX_SHARED_STRING_ITEM_PATTERN.exec(xml))) {
      const text = extractXmlTextValues(itemMatch[1], "t").join("");
      if (text) strings.push(text);
    }
    return strings;
  }

  function extractSheetNames(xml) {
    const names = [];
    XLSX_SHEET_NAME_PATTERN.lastIndex = 0;
    let match;
    while ((match = XLSX_SHEET_NAME_PATTERN.exec(xml))) {
      const name = decodeXmlEntities(match[2]).trim();
      if (name && !/^Sheet\d*$/i.test(name)) names.push(name);
    }
    return names;
  }

  function getCellAttribute(cellXml, attributeName) {
    if (attributeName === "t") {
      return cellXml.match(XLSX_CELL_TYPE_ATTRIBUTE_PATTERN)?.[2] || "";
    }
    let pattern = xlsxCellAttributePatternCache.get(attributeName);
    if (!pattern) {
      pattern = new RegExp(`\\b${attributeName}=(["'])(.*?)\\1`, "i");
      xlsxCellAttributePatternCache.set(attributeName, pattern);
    }
    return cellXml.match(pattern)?.[2] || "";
  }

  function extractTextFromXlsxWorksheetXml(xml, sharedStrings) {
    const parts = [];
    XLSX_WORKSHEET_CELL_PATTERN.lastIndex = 0;
    let cellMatch;
    while ((cellMatch = XLSX_WORKSHEET_CELL_PATTERN.exec(xml))) {
      const cellXml = cellMatch[0];
      const type = getCellAttribute(cellXml, "t");

      if (type === "s") {
        const indexText = extractXmlTextValues(cellXml, "v")[0] || "";
        const shared = sharedStrings[Number(indexText)];
        if (shared) parts.push(shared);
        continue;
      }

      if (type === "inlineStr") {
        parts.push(...extractXmlTextValues(cellXml, "t"));
        continue;
      }

      const formulaText = extractXmlTextValues(cellXml, "f").join("");
      if (formulaText) parts.push(formulaText);

      const valueText = extractXmlTextValues(cellXml, "v").join("");
      if (valueText) parts.push(valueText);
    }
    return parts.join("\n");
  }

  function extractTextFromXlsxCommentsXml(xml) {
    return extractXmlTextValues(xml, "t").join("\n");
  }

  async function extractXlsxText(fileInfo, routed) {
    let entries;
    try {
      entries = await parseZipEntries(fileInfo?.buffer);
    } catch (error) {
      return safeDocumentError(routed, normalizeXlsxZipError(error));
    }

    if (entries.length > XLSX_ZIP_ENTRY_MAX_COUNT) {
      return safeDocumentError(routed, "xlsx_too_many_zip_entries");
    }
    if (
      entries.some((entry) =>
        entry.flags & 1 ||
        /^(?:EncryptedPackage|EncryptionInfo)$/i.test(entry.name) ||
        /(^|\/)vbaProject\.bin$/i.test(entry.name)
      )
    ) {
      return safeDocumentError(routed, "xlsx_encrypted");
    }

    const textEntries = entries.filter((entry) => isSafeXlsxTextPart(entry.name)).sort(sortXlsxTextParts);
    if (!textEntries.length) return safeDocumentError(routed, "xlsx_no_extractable_text");

    const sharedStrings = [];
    const textParts = [];
    try {
      for (const entry of textEntries) {
        const xml = await readXlsxXmlPart(entry);
        if (/^xl\/sharedStrings\.xml$/i.test(entry.name)) {
          sharedStrings.push(...extractSharedStrings(xml));
        } else if (/^xl\/workbook\.xml$/i.test(entry.name)) {
          textParts.push(...extractSheetNames(xml));
        } else if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name)) {
          const partText = extractTextFromXlsxWorksheetXml(xml, sharedStrings);
          if (partText) textParts.push(partText);
        } else if (/^xl\/comments\d*\.xml$/i.test(entry.name)) {
          const partText = extractTextFromXlsxCommentsXml(xml);
          if (partText) textParts.push(partText);
        }
      }
    } catch (error) {
      return safeDocumentError(routed, normalizeXlsxZipError(error));
    }

    const text = textParts.join("\n").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return safeDocumentError(routed, "xlsx_no_extractable_text");
    if (text.length > XLSX_TEXT_EXTRACTION_MAX_BYTES) {
      return safeDocumentError(routed, "xlsx_text_too_large");
    }

    return createExtractorResult({
      ...routed,
      text,
      metadata: {
        ...routed.metadata,
        textLength: text.length,
        extractedParts: textEntries.length
      },
      safeForScan: true
    });
  }

  async function prepareFileExtractionAsync(fileInfo = {}) {
    const routed = routeFileExtractor(fileInfo);
    if (!routed.safeForScan) return routed;
    if (routed.kind === "pdf") return extractPdfText(fileInfo, routed);
    if (routed.kind === "docx") return extractDocxText(fileInfo, routed);
    if (routed.kind === "xlsx") return extractXlsxText(fileInfo, routed);
    if (routed.kind === "image_metadata") return extractImageMetadata(fileInfo, routed);
    return createExtractorResult({
      ...routed,
      text: normalizeText(fileInfo.text),
      safeForScan: true
    });
  }

  root.PWM.FileExtractors = {
    EXTRACTOR_STATUS,
    PDF_TEXT_EXTRACTION_MAX_BYTES,
    DOCX_TEXT_EXTRACTION_MAX_BYTES,
    XLSX_TEXT_EXTRACTION_MAX_BYTES,
    createExtractorResult,
    prepareFileExtractionAsync,
    prepareFileExtraction,
    routeFileExtractor
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileExtractors;
  }
})();
