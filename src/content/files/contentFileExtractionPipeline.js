(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const SUPPORTED_EXTRACTION_KINDS = new Set(["text", "pdf", "docx", "xlsx", "image_metadata"]);
  const EXTRACTED_TEXT_OUTPUT_KINDS = new Set(["pdf", "docx", "xlsx", "image_metadata"]);

  function getRegistry() {
    return root.PWM.FileTypeRegistry || {};
  }

  function getExtractors() {
    return root.PWM.FileExtractors || {};
  }

  function getScanner() {
    return root.PWM.FileScanner || {};
  }

  function normalizeFileName(fileName) {
    const registry = getRegistry();
    if (typeof registry.normalizeFileName === "function") return registry.normalizeFileName(fileName);
    return String(fileName || "").split(/[\\/]/).pop() || "";
  }

  function normalizeMimeType(mimeType) {
    const registry = getRegistry();
    if (typeof registry.normalizeMimeType === "function") return registry.normalizeMimeType(mimeType);
    return String(mimeType || "").split(";")[0].trim().toLowerCase();
  }

  function getFileExtension(fileName) {
    const registry = getRegistry();
    if (typeof registry.getFileExtension === "function") return registry.getFileExtension(fileName);
    const name = normalizeFileName(fileName).toLowerCase();
    const index = name.lastIndexOf(".");
    if (index <= 0 || index === name.length - 1) return "";
    return name.slice(index);
  }

  function splitFileName(fileName) {
    const normalizedName = normalizeFileName(fileName) || "file";
    const extension = getFileExtension(normalizedName);
    if (!extension) return { base: normalizedName || "file", extension: ".txt" };
    return {
      base: normalizedName.slice(0, -extension.length).replace(/^\.+/, "") || "file",
      extension
    };
  }

  function buildRedactedTxtName(fileName) {
    const { base } = splitFileName(fileName);
    return `${base}.redacted.txt`;
  }

  function listWarnings(...sources) {
    return Array.from(
      new Set(
        sources
          .flatMap((source) => Array.isArray(source) ? source : [])
          .map((warning) => String(warning || "").trim())
          .filter(Boolean)
      )
    );
  }

  function sanitizeExtractionMetadata(metadata = {}) {
    return {
      fileName: normalizeFileName(metadata.fileName),
      extension: String(metadata.extension || ""),
      mimeType: normalizeMimeType(metadata.mimeType),
      sizeBytes: Math.max(0, Number(metadata.sizeBytes || 0)),
      textLength: Math.max(0, Number(metadata.textLength || 0)),
      extractedParts: Math.max(0, Number(metadata.extractedParts || 0)),
      visualContentScanned: metadata.visualContentScanned === true,
      ocrSupported: metadata.ocrSupported === true
    };
  }

  function createEmptyResult(status, options = {}) {
    return {
      status,
      originalName: normalizeFileName(options.originalName),
      outputName: options.outputName || "",
      outputKind: options.outputKind || "",
      extractedKind: options.extractedKind || "",
      sanitizedText: "",
      sanitizedFile: null,
      metadata: {
        original: {
          name: normalizeFileName(options.originalName),
          type: normalizeMimeType(options.mimeType),
          size: Math.max(0, Number(options.sizeBytes || 0))
        },
        extraction: sanitizeExtractionMetadata(options.extractionMetadata),
        scan: {
          findingsCount: 0,
          changed: false,
          redactedLength: 0
        }
      },
      warnings: listWarnings(options.warnings),
      safeForUpload: false,
      fallbackReason: options.fallbackReason || ""
    };
  }

  function createTextFile(text, outputName, mimeType) {
    const FilePasteHelpers = root.PWM.FilePasteHelpers || {};
    if (typeof FilePasteHelpers.createSanitizedTextFile === "function") {
      return FilePasteHelpers.createSanitizedTextFile(
        {
          name: outputName,
          type: mimeType || "text/plain"
        },
        text
      );
    }

    const options = {
      type: mimeType || "text/plain",
      lastModified: Date.now()
    };
    if (typeof root.File === "function") {
      return new root.File([text], outputName, options);
    }
    if (typeof root.Blob === "function") {
      const blob = new root.Blob([text], { type: options.type });
      try {
        Object.defineProperty(blob, "name", { value: outputName, configurable: true });
        Object.defineProperty(blob, "lastModified", { value: options.lastModified, configurable: true });
      } catch {
        // Blob metadata is best-effort; the bytes are still sanitized.
      }
      return blob;
    }
    return null;
  }

  async function readFileBuffer(file) {
    if (typeof file?.arrayBuffer !== "function") {
      throw new Error("file_array_buffer_unavailable");
    }
    return file.arrayBuffer();
  }

  async function readFileText(file, buffer) {
    if (typeof file?.text === "function") {
      return String(await file.text());
    }
    const scanner = getScanner();
    if (typeof scanner.decodeUtf8Text === "function") return scanner.decodeUtf8Text(buffer);
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  }

  function canExtractForAdapterHandoff(file) {
    const extractors = getExtractors();
    if (typeof extractors.routeFileExtractor !== "function") return false;
    const routed = extractors.routeFileExtractor({
      fileName: file?.name || "",
      mimeType: file?.type || "",
      sizeBytes: Number(file?.size || 0)
    });
    return SUPPORTED_EXTRACTION_KINDS.has(routed?.kind) && routed?.safeForScan === true;
  }

  async function processFileForAdapterHandoff(options = {}) {
    const file = options.file;
    const originalName = normalizeFileName(file?.name);
    const mimeType = normalizeMimeType(file?.type);
    const sizeBytes = Math.max(0, Number(file?.size || 0));
    const extractors = getExtractors();
    const scanner = getScanner();

    if (
      !file ||
      typeof extractors.prepareFileExtractionAsync !== "function" ||
      typeof scanner.scanTextContent !== "function"
    ) {
      return createEmptyResult("failed", {
        originalName,
        mimeType,
        sizeBytes,
        fallbackReason: "content_file_pipeline_unavailable"
      });
    }

    let buffer;
    try {
      buffer = await readFileBuffer(file);
    } catch {
      return createEmptyResult("failed", {
        originalName,
        mimeType,
        sizeBytes,
        fallbackReason: "file_read_failed"
      });
    }

    let text = "";
    const routed = extractors.routeFileExtractor?.({
      fileName: originalName,
      mimeType,
      sizeBytes
    });
    if (routed?.kind === "text") {
      try {
        text = await readFileText(file, buffer);
      } catch {
        return createEmptyResult("blocked", {
          originalName,
          mimeType,
          sizeBytes,
          fallbackReason: "invalid_utf8"
        });
      }
    }

    const extraction = await extractors.prepareFileExtractionAsync({
      fileName: originalName,
      mimeType,
      sizeBytes,
      buffer,
      text
    });
    const extractedKind = extraction?.kind || routed?.kind || "";
    const extractionMetadata = extraction?.metadata || {
      fileName: originalName,
      mimeType,
      sizeBytes
    };

    if (!extraction?.safeForScan) {
      const status = extraction?.status === "unsupported" ? "unsupported" : "blocked";
      return createEmptyResult(status, {
        originalName,
        mimeType,
        sizeBytes,
        extractedKind,
        extractionMetadata,
        warnings: extraction?.warnings,
        fallbackReason: extraction?.reason || extraction?.status || "file_extraction_failed"
      });
    }

    const extractedText = String(extraction.text || "");
    const scan = scanner.scanTextContent({
      fileName: originalName,
      mimeType,
      sizeBytes: Number(extraction.metadata?.textLength || sizeBytes),
      text: extractedText,
      extractedText: extractedKind !== "text",
      mode: options.mode || "hide_public"
    });
    const sanitizedText = String(scan.redactedText || "");
    const outputName = EXTRACTED_TEXT_OUTPUT_KINDS.has(extractedKind)
      ? buildRedactedTxtName(scan.file?.name || originalName)
      : normalizeFileName(scan.file?.name || originalName);
    const outputKind = EXTRACTED_TEXT_OUTPUT_KINDS.has(extractedKind)
      ? "redacted_text_file"
      : "sanitized_text_file";
    const outputMimeType = outputKind === "redacted_text_file"
      ? "text/plain"
      : mimeType || "text/plain";
    const sanitizedFile = createTextFile(sanitizedText, outputName, outputMimeType);

    if (!sanitizedFile) {
      return createEmptyResult("failed", {
        originalName,
        mimeType,
        sizeBytes,
        extractedKind,
        outputName,
        outputKind,
        extractionMetadata,
        warnings: extraction.warnings,
        fallbackReason: "sanitized_file_create_failed"
      });
    }

    return {
      status: "ready",
      originalName,
      outputName,
      outputKind,
      extractedKind,
      sanitizedText,
      sanitizedFile,
      metadata: {
        original: {
          name: normalizeFileName(scan.file?.name || originalName),
          type: mimeType,
          size: sizeBytes
        },
        extraction: sanitizeExtractionMetadata(extractionMetadata),
        scan: {
          findingsCount: Number(scan.summary?.findingsCount || 0),
          changed: scan.summary?.changed === true,
          redactedLength: sanitizedText.length
        }
      },
      warnings: listWarnings(extraction.warnings, scan.reportWarnings),
      safeForUpload: true,
      fallbackReason: ""
    };
  }

  root.PWM.ContentFileExtractionPipeline = {
    canExtractForAdapterHandoff,
    processFileForAdapterHandoff
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ContentFileExtractionPipeline;
  }
})();
