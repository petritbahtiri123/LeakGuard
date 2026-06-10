(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const FileTypeRegistry = root.PWM.FileTypeRegistry || {};

  const SUPPORTED_SCANNER_OCR_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  const SUPPORTED_SCANNER_OCR_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const MAX_SCANNER_OCR_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_SCANNER_OCR_IMAGE_DIMENSION = 4096;
  const MAX_SCANNER_OCR_IMAGE_PIXELS = 12 * 1000 * 1000;
  const DEFAULT_SCANNER_OCR_TIMEOUT_MS = 15000;

  function normalizeFileName(fileName) {
    if (FileTypeRegistry.normalizeFileName) return FileTypeRegistry.normalizeFileName(fileName);
    return String(fileName || "").split(/[\\/]/).pop() || "";
  }

  function normalizeMimeType(mimeType) {
    if (FileTypeRegistry.normalizeMimeType) return FileTypeRegistry.normalizeMimeType(mimeType);
    return String(mimeType || "").split(";")[0].trim().toLowerCase();
  }

  function getFileExtension(fileName) {
    if (FileTypeRegistry.getFileExtension) return FileTypeRegistry.getFileExtension(fileName);
    const name = normalizeFileName(fileName).toLowerCase();
    const index = name.lastIndexOf(".");
    if (index <= 0 || index === name.length - 1) return "";
    return name.slice(index);
  }

  function isSupportedScannerOcrImage({ fileName, mimeType } = {}) {
    const extension = getFileExtension(fileName);
    const type = normalizeMimeType(mimeType);
    return SUPPORTED_SCANNER_OCR_IMAGE_EXTENSIONS.has(extension) && SUPPORTED_SCANNER_OCR_IMAGE_MIME_TYPES.has(type);
  }

  function validationError(code, message) {
    return { ok: false, code, message };
  }

  function validateScannerOcrImage({ fileName, mimeType, sizeBytes, dimensions } = {}) {
    if (!isSupportedScannerOcrImage({ fileName, mimeType })) {
      return validationError(
        "ocr_unsupported_image_type",
        "LeakGuard scanner OCR supports PNG, JPG, JPEG, and WEBP images only."
      );
    }

    const size = Number(sizeBytes);
    if (!Number.isFinite(size) || size < 0) {
      return validationError("ocr_image_size_unknown", "LeakGuard could not read this image size for OCR.");
    }

    if (size > MAX_SCANNER_OCR_IMAGE_BYTES) {
      return validationError(
        "ocr_image_too_large",
        "This image is too large for local scanner OCR. Choose a smaller PNG, JPG, JPEG, or WEBP image."
      );
    }

    if (dimensions) {
      const width = Number(dimensions.width);
      const height = Number(dimensions.height);
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0 ||
        width > MAX_SCANNER_OCR_IMAGE_DIMENSION ||
        height > MAX_SCANNER_OCR_IMAGE_DIMENSION ||
        width * height > MAX_SCANNER_OCR_IMAGE_PIXELS
      ) {
        return validationError(
          "ocr_image_dimensions_too_large",
          "This image dimensions are too large for local scanner OCR. Choose a smaller image."
        );
      }
    }

    return { ok: true };
  }

  function toUint8Array(buffer) {
    if (buffer instanceof Uint8Array) return buffer;
    if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
    if (ArrayBuffer.isView(buffer)) {
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    return null;
  }

  function timeoutError() {
    return {
      ok: false,
      status: "ocr_timeout",
      language: "eng",
      textLength: 0,
      confidenceBucket: "unknown",
      warnings: ["ocr_timeout"]
    };
  }

  function sanitizeOcrFailure(status, warning) {
    return {
      ok: false,
      status: status || "ocr_failed",
      language: "eng",
      textLength: 0,
      confidenceBucket: "unknown",
      warnings: warning ? [warning] : ["ocr_failed"]
    };
  }

  function sanitizeOcrSuccess(result) {
    const text = String(result?.text || "");
    return {
      ok: result?.ok === true,
      status: String(result?.status || "ocr_recognition_ready"),
      language: result?.language === "eng" ? "eng" : "eng",
      text,
      textLength: Math.max(0, Number(result?.textLength || text.length)),
      confidenceBucket: String(result?.confidenceBucket || "unknown"),
      warnings: Array.isArray(result?.warnings) ? result.warnings.map(String).filter(Boolean) : []
    };
  }

  async function readImageDimensions(file) {
    if (typeof root.createImageBitmap !== "function" || typeof root.Blob !== "function") return null;
    const buffer = await file.arrayBuffer();
    const bitmap = await root.createImageBitmap(new root.Blob([buffer], { type: file.type || "" }));
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      if (typeof bitmap.close === "function") bitmap.close();
    }
  }

  async function recognizeScannerImageFile(file, options = {}) {
    const runtime = options.runtime || root.PWM.OcrRuntime || {};
    const timeoutMs = Math.max(1, Number(options.timeoutMs || DEFAULT_SCANNER_OCR_TIMEOUT_MS));
    let dimensions = null;
    if (options.readDimensions === true) {
      try {
        dimensions = await readImageDimensions(file);
      } catch {
        return sanitizeOcrFailure("ocr_image_decode_failed", "ocr_image_decode_failed");
      }
    } else if (options.dimensions) {
      dimensions = options.dimensions;
    }

    const validation = validateScannerOcrImage({
      fileName: file?.name,
      mimeType: file?.type,
      sizeBytes: file?.size,
      dimensions
    });
    if (!validation.ok) {
      return sanitizeOcrFailure(validation.code, validation.code);
    }

    if (typeof file?.arrayBuffer !== "function") {
      return sanitizeOcrFailure("ocr_file_read_unavailable", "ocr_file_read_unavailable");
    }
    if (typeof runtime.recognizeImageBytes !== "function") {
      return sanitizeOcrFailure("ocr_runtime_unavailable", "ocr_runtime_unavailable");
    }

    let bytes;
    try {
      bytes = toUint8Array(await file.arrayBuffer());
    } catch {
      return sanitizeOcrFailure("ocr_file_read_failed", "ocr_file_read_failed");
    }
    if (!bytes) {
      return sanitizeOcrFailure("ocr_file_read_failed", "ocr_file_read_failed");
    }

    const payload = {
      type: "ocr_recognize_image",
      language: "eng",
      imageBytes: bytes,
      mimeType: normalizeMimeType(file.type)
    };
    const timeout = new Promise((resolve) => {
      root.setTimeout(() => resolve(timeoutError()), timeoutMs);
    });

    try {
      const result = await Promise.race([runtime.recognizeImageBytes(payload), timeout]);
      if (!result?.ok) {
        return sanitizeOcrFailure(result?.status || "ocr_failed", result?.status || "ocr_failed");
      }
      return sanitizeOcrSuccess(result);
    } catch {
      return sanitizeOcrFailure("ocr_failed", "ocr_failed");
    }
  }

  function buildScannerOcrScanText({ metadataText, ocrText, ocrMetadata } = {}) {
    const metadata = String(metadataText || "");
    const text = String(ocrText || "");
    const info = ocrMetadata || {};
    const header = [
      "visual_text_scanned=true",
      "image_ocr_supported=true",
      "ocr_language=eng",
      `ocr_text_length=${Math.max(0, Number(info.textLength || text.length))}`,
      `ocr_confidence_bucket=${String(info.confidenceBucket || "unknown")}`
    ].join("\n");
    return [metadata, header, "ocr_text_begin", text, "ocr_text_end"].filter(Boolean).join("\n");
  }

  function redactedTextFileNameForImage(fileName) {
    const name = normalizeFileName(fileName) || "image";
    const extension = getFileExtension(name);
    const base = extension ? name.slice(0, -extension.length).replace(/^\.+/, "") || "image" : name;
    return `${base}.redacted.txt`;
  }

  root.PWM.ScannerOcr = {
    SUPPORTED_SCANNER_OCR_IMAGE_EXTENSIONS,
    SUPPORTED_SCANNER_OCR_IMAGE_MIME_TYPES,
    MAX_SCANNER_OCR_IMAGE_BYTES,
    MAX_SCANNER_OCR_IMAGE_DIMENSION,
    MAX_SCANNER_OCR_IMAGE_PIXELS,
    DEFAULT_SCANNER_OCR_TIMEOUT_MS,
    isSupportedScannerOcrImage,
    validateScannerOcrImage,
    recognizeScannerImageFile,
    buildScannerOcrScanText,
    redactedTextFileNameForImage
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ScannerOcr;
  }
})();
