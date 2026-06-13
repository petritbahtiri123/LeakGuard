(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const FileLimits = root.PWM.FileLimits || {};
  const FileTypeRegistry = root.PWM.FileTypeRegistry || {};

  const LOCAL_TEXT_FAST_MAX_BYTES =
    Number(FileLimits.LOCAL_TEXT_FAST_MAX_BYTES) || 2 * 1024 * 1024;
  const LOCAL_TEXT_OPTIMIZED_MAX_BYTES =
    Number(FileLimits.LOCAL_TEXT_OPTIMIZED_MAX_BYTES) || 4 * 1024 * 1024;
  const LOCAL_TEXT_HARD_BLOCK_BYTES =
    Number(FileLimits.LOCAL_TEXT_HARD_BLOCK_BYTES) || 4 * 1024 * 1024;
  const LARGE_TEXT_STREAMING_MAX_BYTES =
    Number(FileLimits.LARGE_TEXT_STREAMING_MAX_BYTES) || 50 * 1024 * 1024;
  const MAX_TEXT_FILE_SIZE_BYTES =
    Number(FileLimits.MAX_TEXT_FILE_SIZE_BYTES) || LARGE_TEXT_STREAMING_MAX_BYTES;
  const LOCAL_TEXT_HARD_BLOCK_TITLE =
    FileLimits.LOCAL_TEXT_HARD_BLOCK_TITLE || "Large payload blocked for browser stability";
  const LOCAL_TEXT_HARD_BLOCK_MESSAGE =
    FileLimits.LOCAL_TEXT_HARD_BLOCK_MESSAGE ||
    "This content is over 4 MB. LeakGuard did not process or send it automatically to avoid browser instability. Split the file into smaller parts, or sanitize it separately before upload.";
  const LARGE_TEXT_STREAMING_BLOCK_TITLE =
    FileLimits.LARGE_TEXT_STREAMING_BLOCK_TITLE || "File too large for local redaction";
  const LARGE_TEXT_STREAMING_BLOCK_MESSAGE =
    FileLimits.LARGE_TEXT_STREAMING_BLOCK_MESSAGE ||
    "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.";
  const LOCAL_FILE_STREAMING_REQUIRED_MESSAGE =
    FileLimits.LOCAL_FILE_STREAMING_REQUIRED_MESSAGE ||
    "LeakGuard will stream-redact this large text file locally before upload.";
  const REDACTED_PREVIEW_LIMIT =
    Number(FileLimits.REDACTED_PREVIEW_LIMIT) || 4000;
  const UNSUPPORTED_TEXT_RELEASE_MESSAGE =
    FileLimits.UNSUPPORTED_TEXT_RELEASE_MESSAGE ||
    "This release scans supported text files, text PDFs, DOCX/XLSX text, and PNG/JPG/JPEG/WEBP image metadata or OCR paths only. Unsupported archives, executables, legacy Office files, unsupported images, and binary files are not scanned or redacted.";
  const UNSUPPORTED_COMPOSER_FILE_MESSAGE =
    FileLimits.UNSUPPORTED_COMPOSER_FILE_MESSAGE ||
    "LeakGuard did not scan or redact this unsupported file. Supported text, text PDF, DOCX, XLSX, and PNG/JPG/JPEG/WEBP image paths are protected where available. Unsupported archives, executables, legacy Office files, unsupported images, and binary files are blocked on protected sites when LeakGuard cannot safely replace them.";
  const SUPPORTED_TEXT_EXTENSIONS = FileTypeRegistry.SUPPORTED_TEXT_EXTENSIONS || new Set([
    ".txt",
    ".md",
    ".markdown",
    ".env",
    ".log",
    ".json",
    ".yaml",
    ".yml",
    ".pem",
    ".key",
    ".toml",
    ".xml",
    ".csv",
    ".ini",
    ".conf",
    ".cfg",
    ".ps1",
    ".sh",
    ".bash",
    ".zsh",
    ".bat",
    ".cmd",
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".scss",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".sql"
  ]);
  const SUPPORTED_TEXT_BASENAMES =
    FileTypeRegistry.SUPPORTED_TEXT_BASENAMES || new Set(["dockerfile", "makefile"]);
  const PASS_THROUGH_UNSUPPORTED_EXTENSIONS = new Set([
    ...(FileTypeRegistry.PLANNED_DOCUMENT_EXTENSIONS || [".pdf", ".docx", ".xlsx"]),
    ...(FileTypeRegistry.PLANNED_IMAGE_EXTENSIONS || [".png", ".jpg", ".jpeg", ".webp"]),
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".ico",
    ".svg",
    ".zip",
    ".7z",
    ".rar",
    ".tar",
    ".gz",
    ".tgz",
    ".bz2",
    ".xz",
    ".exe",
    ".dll",
    ".dmg",
    ".pkg",
    ".app",
    ".msi",
    ".bin"
  ]);

  function normalizeFileName(fileName) {
    if (FileTypeRegistry.normalizeFileName) return FileTypeRegistry.normalizeFileName(fileName);
    return String(fileName || "").split(/[\\/]/).pop() || "";
  }

  function getFileExtension(fileName) {
    if (FileTypeRegistry.getFileExtension) return FileTypeRegistry.getFileExtension(fileName);
    const name = normalizeFileName(fileName).toLowerCase();
    if (!name) return "";
    if (name === ".env") return ".env";

    const index = name.lastIndexOf(".");
    if (index <= 0 || index === name.length - 1) return "";
    return name.slice(index);
  }

  function getFileBasename(fileName) {
    if (FileTypeRegistry.getFileBasename) return FileTypeRegistry.getFileBasename(fileName);
    return normalizeFileName(fileName).toLowerCase();
  }

  function normalizeMimeType(mimeType) {
    if (FileTypeRegistry.normalizeMimeType) return FileTypeRegistry.normalizeMimeType(mimeType);
    return String(mimeType || "").split(";")[0].trim().toLowerCase();
  }

  function isSupportedTextFile(fileName, mimeType) {
    if (FileTypeRegistry.isSupportedTextFileType) {
      return FileTypeRegistry.isSupportedTextFileType({ fileName, mimeType });
    }
    if (SUPPORTED_TEXT_BASENAMES.has(getFileBasename(fileName))) return true;
    const extension = getFileExtension(fileName);
    if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) return false;
    return true;
  }

  function classifyFileForTextScan({ fileName, mimeType } = {}) {
    const registryClassification = FileTypeRegistry.classifyFileType
      ? FileTypeRegistry.classifyFileType({ fileName, mimeType })
      : null;
    const extension = registryClassification?.extension || getFileExtension(fileName);
    if (registryClassification?.supported || isSupportedTextFile(fileName, mimeType)) {
      return {
        kind: "text",
        status: "supported",
        action: "scan",
        supported: true,
        extension
      };
    }

    if (registryClassification?.status === "planned_unsupported") {
      return {
        kind: "planned_unsupported",
        status: "planned_unsupported",
        family: registryClassification.family,
        action: "allow",
        supported: false,
        extension,
        message: UNSUPPORTED_COMPOSER_FILE_MESSAGE
      };
    }

    if (PASS_THROUGH_UNSUPPORTED_EXTENSIONS.has(extension)) {
      return {
        kind: "known_unsupported",
        status: "unsupported",
        action: "allow",
        supported: false,
        extension,
        message: UNSUPPORTED_COMPOSER_FILE_MESSAGE
      };
    }

    return {
      kind: "unknown",
      status: "unsupported",
      action: "allow",
      supported: false,
      extension,
      message: UNSUPPORTED_COMPOSER_FILE_MESSAGE
    };
  }

  function validationError(code, message) {
    return { ok: false, code, message };
  }

  function toUint8Array(buffer) {
    if (buffer instanceof Uint8Array) return buffer;
    if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
    if (ArrayBuffer.isView(buffer)) {
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    return null;
  }

  function byteLengthOf(buffer) {
    const bytes = toUint8Array(buffer);
    return bytes ? bytes.byteLength : 0;
  }

  function isNullHeavy(buffer) {
    const bytes = toUint8Array(buffer);
    if (!bytes || !bytes.byteLength) return false;

    const sampleLength = Math.min(bytes.byteLength, 65536);
    let nulCount = 0;

    for (let index = 0; index < sampleLength; index += 1) {
      if (bytes[index] === 0) nulCount += 1;
    }

    return nulCount > 0 && nulCount / sampleLength >= 0.01;
  }

  function decodeUtf8Text(buffer) {
    const bytes = toUint8Array(buffer);
    if (!bytes) {
      throw new TypeError("Expected an ArrayBuffer or typed array.");
    }

    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function validateFileForTextScan({ fileName, mimeType, sizeBytes, buffer } = {}) {
    const extension = getFileExtension(fileName);
    const declaredSize = Number(sizeBytes);
    const actualSize = buffer ? byteLengthOf(buffer) : 0;
    const effectiveSize = Number.isFinite(declaredSize) && declaredSize >= 0 ? declaredSize : actualSize;

    if (!isSupportedTextFile(fileName, mimeType)) {
      return validationError(
        PASS_THROUGH_UNSUPPORTED_EXTENSIONS.has(extension) ? "unsupported_binary_or_document" : "unsupported_file_type",
        UNSUPPORTED_TEXT_RELEASE_MESSAGE
      );
    }

    if (effectiveSize > LARGE_TEXT_STREAMING_MAX_BYTES) {
      return validationError(
        "file_too_large",
        LARGE_TEXT_STREAMING_BLOCK_MESSAGE
      );
    }

    if (!buffer) {
      return { ok: true };
    }

    if (isNullHeavy(buffer)) {
      return validationError(
        "binary_content",
        "This file looks binary, so LeakGuard did not scan it. This release scans only supported text, document-text, and image OCR paths."
      );
    }

    try {
      decodeUtf8Text(buffer);
    } catch {
      return validationError(
        "invalid_utf8",
        "This file is not valid UTF-8 text, so LeakGuard did not scan it."
      );
    }

    return { ok: true };
  }

  function getLineColumnFromOffset(text, offset) {
    const input = String(text || "");
    const target = Math.max(0, Math.min(Number(offset) || 0, input.length));
    let line = 1;
    let column = 1;

    for (let index = 0; index < target; index += 1) {
      const char = input[index];

      if (char === "\r") {
        line += 1;
        column = 1;
        if (input[index + 1] === "\n") index += 1;
      } else if (char === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }

    return { line, column };
  }

  function lineBoundsForOffset(text, offset) {
    const input = String(text || "");
    const target = Math.max(0, Math.min(Number(offset) || 0, input.length));
    let start = input.lastIndexOf("\n", target - 1) + 1;
    let end = input.indexOf("\n", target);

    if (end === -1) end = input.length;
    if (input[end - 1] === "\r") end -= 1;

    return { start, end };
  }

  function trimPreview(lineText, placeholder) {
    const input = String(lineText || "");
    const marker = String(placeholder || "");
    const index = marker ? input.indexOf(marker) : -1;
    const maxLength = 180;

    if (input.length <= maxLength) return input;
    if (index === -1) return `${input.slice(0, maxLength - 1)}...`;

    const context = 72;
    const start = Math.max(0, index - context);
    const end = Math.min(input.length, index + marker.length + context);
    return `${start > 0 ? "..." : ""}${input.slice(start, end)}${end < input.length ? "..." : ""}`;
  }

  function previewForFinding(finding, text) {
    const input = String(text || "");
    const { start: lineStart, end: lineEnd } = lineBoundsForOffset(input, finding.start);
    let lineText = input.slice(lineStart, lineEnd);
    const replacements = Array.isArray(finding.allReplacements) && finding.allReplacements.length
      ? finding.allReplacements
      : [finding];

    const lineReplacements = replacements
      .filter((replacement) => replacement.start < lineEnd && replacement.end > lineStart)
      .sort((left, right) => right.start - left.start);

    for (const replacement of lineReplacements) {
      const start = Math.max(0, replacement.start - lineStart);
      const end = Math.min(lineText.length, replacement.end - lineStart);
      const placeholder = replacement.placeholder || "[REDACTED]";
      lineText = lineText.slice(0, start) + placeholder + lineText.slice(end);
    }

    return trimPreview(lineText, finding.placeholder || "[REDACTED]");
  }

  function sanitizeFindingForReport(finding, text) {
    const start = Math.max(0, Number(finding?.start || 0));
    const end = Math.max(start, Number(finding?.end || start));
    const location = getLineColumnFromOffset(text, start);

    return {
      id: String(finding?.id || `finding_${start}_${end}`),
      category: finding?.category || "credential",
      type: finding?.type || finding?.placeholderType || "SECRET",
      severity: finding?.severity || "high",
      start,
      end,
      line: location.line,
      column: location.column,
      length: Math.max(0, end - start),
      placeholder: finding?.placeholder || "[REDACTED]",
      method: Array.isArray(finding?.method) ? finding.method.map(String) : [],
      preview: previewForFinding(finding || {}, text)
    };
  }

  function randomScanSuffix() {
    const cryptoObject = root.crypto;
    if (cryptoObject?.getRandomValues) {
      const values = new Uint32Array(2);
      cryptoObject.getRandomValues(values);
      return `${values[0].toString(16)}${values[1].toString(16)}`;
    }
    return Math.random().toString(16).slice(2, 14);
  }

  function countBySeverity(findings, severity) {
    return findings.filter((finding) => finding.severity === severity).length;
  }

  function countCategories(findings) {
    return findings.reduce((output, finding) => {
      const category = finding.category || "credential";
      output[category] = Number(output[category] || 0) + 1;
      return output;
    }, {});
  }

  function buildRedactedPreview(redactedText, warnings) {
    const input = String(redactedText || "");
    if (input.length <= REDACTED_PREVIEW_LIMIT) return input;
    warnings.push("Redacted preview is truncated for display. Download the redacted copy for the full file.");
    return `${input.slice(0, REDACTED_PREVIEW_LIMIT)}\n...`;
  }

  function utf8ByteLength(text) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(String(text || "")).byteLength;
    }
    return String(text || "").length;
  }

  function scanTextContent({ fileName, mimeType, sizeBytes, text, mode, extractedText = false } = {}) {
    const {
      Detector,
      PlaceholderManager,
      transformOutboundPrompt
    } = root.PWM;

    if (!Detector || !PlaceholderManager || !transformOutboundPrompt) {
      throw new Error("LeakGuard file scanning dependencies are unavailable.");
    }

    const input = String(text || "");
    if (!extractedText) {
      const metadataValidation = validateFileForTextScan({
        fileName,
        mimeType,
        sizeBytes
      });

      if (!metadataValidation.ok) {
        throw new Error(metadataValidation.message);
      }
    }

    const scannedAt = new Date().toISOString();
    const manager = new PlaceholderManager();
    const detector = new Detector();
    const findings = detector.scan(input);
    const transformed = transformOutboundPrompt(input, {
      manager,
      findings,
      mode: mode || "hide_public"
    });
    const replacements = transformed.findings || transformed.replacements || [];
    const reportWarnings = [];
    const sanitizedFindings = replacements.map((finding) =>
      sanitizeFindingForReport(
        {
          ...finding,
          allReplacements: replacements
        },
        input
      )
    );
    const redactedText = String(transformed.redactedText || input);
    const redactedPreview = buildRedactedPreview(redactedText, reportWarnings);
    const originalFileName = normalizeFileName(fileName);
    const fileNameFindings = detector.scan(originalFileName);
    const transformedFileName = transformOutboundPrompt(originalFileName, {
      manager,
      findings: fileNameFindings,
      mode: mode || "hide_public"
    });
    const reportFileName = String(transformedFileName.redactedText || originalFileName);
    const normalizedSize = Number(sizeBytes);
    const textBytesRead = Number.isFinite(normalizedSize) && normalizedSize >= 0
      ? normalizedSize
      : utf8ByteLength(input);

    return {
      scanId: `scan_${scannedAt.replace(/[:.]/g, "-")}_${randomScanSuffix()}`,
      scannedAt,
      file: {
        name: reportFileName,
        extension: getFileExtension(fileName),
        type: normalizeMimeType(mimeType),
        sizeBytes: textBytesRead,
        textBytesRead,
        truncated: false
      },
      summary: {
        findingsCount: sanitizedFindings.length,
        highCount: countBySeverity(sanitizedFindings, "high"),
        mediumCount: countBySeverity(sanitizedFindings, "medium"),
        lowCount: countBySeverity(sanitizedFindings, "low"),
        categories: countCategories(sanitizedFindings),
        changed: Boolean(transformed.changed)
      },
      findings: sanitizedFindings,
      redactedPreview,
      redactedText,
      reportWarnings
    };
  }

  function buildSanitizedReport(scanResult) {
    const result = scanResult || {};
    return {
      version: 1,
      product: "LeakGuard",
      localOnly: true,
      generatedAt: new Date().toISOString(),
      scanId: result.scanId || null,
      scannedAt: result.scannedAt || null,
      file: result.file || null,
      summary: result.summary || null,
      findings: Array.isArray(result.findings)
        ? result.findings.map((finding) => ({
            id: finding.id,
            category: finding.category,
            type: finding.type,
            severity: finding.severity,
            start: finding.start,
            end: finding.end,
            line: finding.line,
            column: finding.column,
            length: finding.length,
            placeholder: finding.placeholder,
            method: Array.isArray(finding.method) ? [...finding.method] : [],
            preview: finding.preview
          }))
        : [],
      redactedPreview: result.redactedPreview || "",
      reportWarnings: Array.isArray(result.reportWarnings) ? [...result.reportWarnings] : []
    };
  }

  root.PWM.FileScanner = {
    LOCAL_TEXT_FAST_MAX_BYTES,
    LOCAL_TEXT_OPTIMIZED_MAX_BYTES,
    LOCAL_TEXT_HARD_BLOCK_BYTES,
    LOCAL_TEXT_HARD_BLOCK_TITLE,
    LOCAL_TEXT_HARD_BLOCK_MESSAGE,
    LARGE_TEXT_STREAMING_MAX_BYTES,
    LARGE_TEXT_STREAMING_BLOCK_TITLE,
    LARGE_TEXT_STREAMING_BLOCK_MESSAGE,
    LOCAL_FILE_STREAMING_REQUIRED_MESSAGE,
    MAX_TEXT_FILE_SIZE_BYTES,
    SUPPORTED_TEXT_EXTENSIONS,
    SUPPORTED_TEXT_BASENAMES,
    PASS_THROUGH_UNSUPPORTED_EXTENSIONS,
    UNSUPPORTED_TEXT_RELEASE_MESSAGE,
    UNSUPPORTED_COMPOSER_FILE_MESSAGE,
    getFileExtension,
    getFileBasename,
    normalizeMimeType,
    classifyFileForTextScan,
    isSupportedTextFile,
    validateFileForTextScan,
    decodeUtf8Text,
    getLineColumnFromOffset,
    sanitizeFindingForReport,
    scanTextContent,
    buildSanitizedReport
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileScanner;
  }
})();
