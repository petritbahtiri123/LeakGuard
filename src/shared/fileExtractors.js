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

    if (metadata.extension === ".pdf") {
      return createExtractorResult({
        status: EXTRACTOR_STATUS.OK,
        kind: "pdf",
        metadata: {
          ...metadata,
          status: EXTRACTOR_STATUS.OK,
          family: "document",
          planned: false
        },
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

  function extractTextFromPdfContent(content) {
    const textParts = [];
    const textObjectPattern = /BT([\s\S]*?)ET/g;
    let objectMatch;
    while ((objectMatch = textObjectPattern.exec(content))) {
      const objectSource = objectMatch[1];
      const textOperatorPattern = /(?:\((?:\\.|[^\\()])*(?:\((?:\\.|[^\\()])*\)(?:\\.|[^\\()])*)*\)|<[\da-fA-F\s]+>|\[[\s\S]*?\])\s*(?:Tj|TJ|'|")/g;
      let operatorMatch;
      while ((operatorMatch = textOperatorPattern.exec(objectSource))) {
        const token = nextTextToken(operatorMatch[0], 0);
        if (token?.value) textParts.push(token.value);
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
    if (typeof DecompressionStream !== "function" || typeof Blob !== "function") {
      return null;
    }

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  }

  async function decodePdfStreamEntry(entry) {
    const filters = entry.dictionary.match(/\/Filter\s*(?:\/([A-Za-z0-9]+)|\[\s*\/([A-Za-z0-9]+)\s*\])/);
    const filterName = filters?.[1] || filters?.[2] || "";
    if (!filterName) return decodePdfByteString(entry.bytes);
    if (filterName === "FlateDecode" || filterName === "Fl") {
      const inflated = await inflatePdfStream(entry.bytes);
      return inflated ? decodePdfByteString(inflated) : "";
    }
    return "";
  }

  function safePdfError(routed, reason) {
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

  async function prepareFileExtractionAsync(fileInfo = {}) {
    const routed = routeFileExtractor(fileInfo);
    if (!routed.safeForScan) return routed;
    if (routed.kind === "pdf") return extractPdfText(fileInfo, routed);
    return createExtractorResult({
      ...routed,
      text: normalizeText(fileInfo.text),
      safeForScan: true
    });
  }

  root.PWM.FileExtractors = {
    EXTRACTOR_STATUS,
    PDF_TEXT_EXTRACTION_MAX_BYTES,
    createExtractorResult,
    prepareFileExtractionAsync,
    prepareFileExtraction,
    routeFileExtractor
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileExtractors;
  }
})();
