(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const FileLimits = root.PWM.FileLimits || {};

  const LOCAL_FILE_MULTI_MESSAGE =
    FileLimits.LOCAL_FILE_MULTI_MESSAGE ||
    "LeakGuard did not attach these files. Paste or drop one supported text file at a time.";
  const LOCAL_FILE_READ_MESSAGE =
    FileLimits.LOCAL_FILE_READ_MESSAGE ||
    "LeakGuard could not read this local file, so nothing was attached.";
  const LOCAL_FILE_TEXT_INSERTION_FALLBACK_ENABLED =
    Boolean(FileLimits.LOCAL_FILE_TEXT_INSERTION_FALLBACK_ENABLED);
  const LOCAL_FILE_STREAMING_REQUIRED_MESSAGE =
    getFileScanner().LOCAL_FILE_STREAMING_REQUIRED_MESSAGE ||
    FileLimits.LOCAL_FILE_STREAMING_REQUIRED_MESSAGE ||
    "LeakGuard will stream-redact this large text file locally before upload.";
  const LOCAL_FILE_UNSUPPORTED_WARNING =
    getFileScanner().UNSUPPORTED_COMPOSER_FILE_MESSAGE ||
    FileLimits.UNSUPPORTED_COMPOSER_FILE_MESSAGE ||
    "LeakGuard did not scan or redact this unsupported file. Supported text, text PDF, DOCX, XLSX, and PNG/JPG/JPEG/WEBP image paths are protected where available. Unsupported archives, executables, legacy Office files, unsupported images, and binary files are blocked on protected sites when LeakGuard cannot safely replace them.";

  function getFileScanner() {
    return root.PWM.FileScanner || {};
  }

  function dataTransferHasFiles(dataTransfer) {
    if (!dataTransfer) return false;

    const types = Array.from(dataTransfer.types || []);
    if (types.includes("Files")) return true;
    if (Number(dataTransfer.files?.length || 0) > 0) return true;

    return Array.from(dataTransfer.items || []).some(
      (item) => String(item?.kind || "").toLowerCase() === "file"
    );
  }

  function listDataTransferFiles(dataTransfer) {
    if (!dataTransferHasFiles(dataTransfer)) return [];

    const files = Array.from(dataTransfer.files || []).filter(Boolean);
    if (files.length) return files;

    return Array.from(dataTransfer.items || [])
      .filter(
        (item) =>
          String(item?.kind || "").toLowerCase() === "file" &&
          typeof item.getAsFile === "function"
      )
      .map((item) => item.getAsFile())
      .filter(Boolean);
  }

  function countFileItems(dataTransfer) {
    return Array.from(dataTransfer?.items || []).filter(
      (item) => String(item?.kind || "").toLowerCase() === "file"
    ).length;
  }

  function dataTransferHasUnavailableFileItems(dataTransfer) {
    return (
      Boolean(dataTransfer?.firefoxDataTransferFileUnavailable) ||
      (
        dataTransferHasFiles(dataTransfer) &&
        Number(dataTransfer?.files?.length || 0) === 0 &&
        countFileItems(dataTransfer) > 0 &&
        listDataTransferFiles(dataTransfer).length === 0
      )
    );
  }

  function resultFromValidation(validation) {
    if (
      validation?.code === "unsupported_binary_or_document" ||
      validation?.code === "unsupported_file_type" ||
      validation?.code === "binary_content" ||
      validation?.code === "invalid_utf8"
    ) {
      return {
        handled: validation?.code === "invalid_utf8",
        ok: false,
        code: validation.code,
        message:
          validation?.code === "invalid_utf8"
            ? validation?.message || LOCAL_FILE_READ_MESSAGE
            : LOCAL_FILE_UNSUPPORTED_WARNING
      };
    }

    return {
      handled: true,
      ok: false,
      code: validation?.code || "invalid_file",
      message: validation?.message || LOCAL_FILE_READ_MESSAGE
    };
  }

  async function readLocalTextFileFromDataTransfer(dataTransfer) {
    const FileScanner = getFileScanner();

    if (!dataTransferHasFiles(dataTransfer)) {
      return { handled: false, ok: false };
    }

    const files = listDataTransferFiles(dataTransfer);
    if (files.length !== 1) {
      return {
        handled: true,
        ok: false,
        code:
          files.length > 1
            ? "multiple_files"
            : dataTransferHasUnavailableFileItems(dataTransfer)
              ? "firefox_data_transfer_file_unavailable"
              : "file_unavailable",
        message: files.length > 1 ? LOCAL_FILE_MULTI_MESSAGE : LOCAL_FILE_READ_MESSAGE
      };
    }

    const file = files[0];
    const fileName = String(file?.name || "");
    const mimeType = String(file?.type || "");
    const sizeBytes = Number(file?.size || 0);

    const metadataValidation = FileScanner.validateFileForTextScan?.({
      fileName,
      mimeType,
      sizeBytes
    });
    if (!metadataValidation?.ok) return resultFromValidation(metadataValidation);

    if (
      sizeBytes >
      Number(
        FileScanner.LOCAL_TEXT_HARD_BLOCK_BYTES ||
          FileLimits.LOCAL_TEXT_HARD_BLOCK_BYTES ||
          4 * 1024 * 1024
      )
    ) {
      return {
        handled: true,
        ok: false,
        code: "streaming_required",
        message: FileScanner.LOCAL_FILE_STREAMING_REQUIRED_MESSAGE || LOCAL_FILE_STREAMING_REQUIRED_MESSAGE,
        sourceFile: file,
        file: {
          name: fileName.split(/[\\/]/).pop() || "",
          extension: FileScanner.getFileExtension?.(fileName) || "",
          type: FileScanner.normalizeMimeType?.(mimeType) || mimeType.split(";")[0].trim().toLowerCase(),
          sizeBytes
        }
      };
    }

    let buffer;
    let textFromBlob = "";
    try {
      if (typeof file.text === "function") {
        textFromBlob = String(await file.text());
      }
      if (typeof file.arrayBuffer !== "function") {
        if (textFromBlob) {
          return {
            handled: true,
            ok: true,
            text: normalizeDecodedText(textFromBlob),
            file: {
              name: fileName.split(/[\\/]/).pop() || "",
              extension: FileScanner.getFileExtension?.(fileName) || "",
              type: FileScanner.normalizeMimeType?.(mimeType) || mimeType.split(";")[0].trim().toLowerCase(),
              sizeBytes
            }
          };
        }
        return {
          handled: true,
          ok: false,
          code: "file_read_unavailable",
          message: LOCAL_FILE_READ_MESSAGE
        };
      }
      buffer = await file.arrayBuffer();
    } catch {
      return {
        handled: true,
        ok: false,
        code: "file_read_failed",
        message: LOCAL_FILE_READ_MESSAGE
      };
    }

    const contentValidation = FileScanner.validateFileForTextScan?.({
      fileName,
      mimeType,
      sizeBytes,
      buffer
    });
    if (!contentValidation?.ok && contentValidation?.code !== "invalid_utf8") {
      return resultFromValidation(contentValidation);
    }

    let text;
    try {
      text =
        textFromBlob ||
        FileScanner.decodeUtf8Text(buffer);
    } catch {
      try {
        text = tolerantDecodeUtf8Text(buffer);
      } catch {
        return {
          handled: true,
          ok: false,
          code: "invalid_utf8",
          message: contentValidation?.message || LOCAL_FILE_READ_MESSAGE
        };
      }
    }

    return {
      handled: true,
      ok: true,
      text: normalizeDecodedText(text),
      file: {
        name: fileName.split(/[\\/]/).pop() || "",
        extension: FileScanner.getFileExtension?.(fileName) || "",
        type: FileScanner.normalizeMimeType?.(mimeType) || mimeType.split(";")[0].trim().toLowerCase(),
        sizeBytes
      }
    };
  }

  function tolerantDecodeUtf8Text(buffer) {
    if (typeof TextDecoder !== "function") {
      throw new Error("TextDecoder unavailable");
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  }

  function normalizeDecodedText(text) {
    return String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n");
  }

  function sanitizeFileNameSegment(value, fallback = "leakguard-redacted.txt") {
    const normalized = String(value || fallback)
      .split(/[\\/]/)
      .pop()
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+|\.+$/g, "");
    return normalized || fallback;
  }

  function redactSensitiveFileNameWithLocalFallback(fileName) {
    let count = 0;
    const sensitiveTokenPattern =
      /\b(?:sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|(?:api[_-]?key|password|secret|token)[-_]?[A-Za-z0-9_-]{8,})\b/gi;
    return String(fileName || "").replace(sensitiveTokenPattern, () => `[PWM_${++count}]`);
  }

  function redactSensitiveFileName(fileName) {
    const fallbackName =
      FileLimits.DEFAULT_SANITIZED_TEXT_FILE_NAME ||
      "leakguard-redacted.txt";
    const normalizedName = sanitizeFileNameSegment(fileName, fallbackName);
    const transformer = root.PWM?.transformOutboundPrompt;
    if (typeof transformer === "function") {
      try {
        const result = transformer(normalizedName);
        const redactedName = sanitizeFileNameSegment(result?.redactedText || normalizedName, fallbackName);
        if (redactedName && redactedName !== normalizedName) return redactedName;
      } catch {
        // Filename redaction falls back to local token-shape scrubbing.
      }
    }
    return sanitizeFileNameSegment(redactSensitiveFileNameWithLocalFallback(normalizedName), fallbackName);
  }

  function createSanitizedTextFile(fileInfo, redactedText) {
    const FileScanner = root.PWM.FileScanner || {};
    const normalizedName = redactSensitiveFileName(fileInfo?.name);
    const mimeType =
      FileScanner.normalizeMimeType?.(fileInfo?.type) ||
      String(fileInfo?.type || "").split(";")[0].trim().toLowerCase() ||
      "text/plain";
    const options = {
      type: mimeType || "text/plain",
      lastModified: Date.now()
    };
    const text = String(redactedText || "");

    if (typeof root.File === "function") {
      return new root.File([text], normalizedName, options);
    }

    if (typeof root.Blob === "function") {
      const blob = new root.Blob([text], { type: options.type });
      try {
        Object.defineProperty(blob, "name", {
          value: normalizedName,
          configurable: true
        });
        Object.defineProperty(blob, "lastModified", {
          value: options.lastModified,
          configurable: true
        });
      } catch {
        // Some Blob implementations expose non-configurable metadata; the bytes remain sanitized.
      }
      return blob;
    }

    return null;
  }

  root.PWM.FilePasteHelpers = {
    LOCAL_FILE_MULTI_MESSAGE,
    LOCAL_FILE_READ_MESSAGE,
    LOCAL_FILE_STREAMING_REQUIRED_MESSAGE,
    LOCAL_FILE_UNSUPPORTED_WARNING,
    LOCAL_FILE_TEXT_INSERTION_FALLBACK_ENABLED,
    dataTransferHasFiles,
    listDataTransferFiles,
    dataTransferHasUnavailableFileItems,
    readLocalTextFileFromDataTransfer,
    createSanitizedTextFile,
    redactSensitiveFileName
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FilePasteHelpers;
  }
})();
