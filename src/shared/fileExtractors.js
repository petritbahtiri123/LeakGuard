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

  function buildMetadata(fileInfo, classification) {
    const normalizeFileName = FileTypeRegistry.normalizeFileName || ((value) => String(value || ""));
    const normalizeMimeType =
      FileTypeRegistry.normalizeMimeType || ((value) => String(value || "").split(";")[0].trim().toLowerCase());

    return {
      fileName: normalizeFileName(fileInfo?.fileName),
      extension: classification.extension || "",
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

    return createExtractorResult({
      ...routed,
      text: normalizeText(fileInfo.text),
      safeForScan: true
    });
  }

  root.PWM.FileExtractors = {
    EXTRACTOR_STATUS,
    createExtractorResult,
    prepareFileExtraction,
    routeFileExtractor
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileExtractors;
  }
})();
