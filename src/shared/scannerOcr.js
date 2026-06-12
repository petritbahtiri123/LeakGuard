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

  function confidenceBucket(confidence) {
    const value = Number(confidence);
    if (value >= 85) return "high";
    if (value >= 60) return "medium";
    if (value > 0) return "low";
    return "unknown";
  }

  function normalizeOcrBox(box) {
    const source = box?.box || box?.bbox || box?.boundingBox || box;
    const x = Number(source?.x ?? source?.left ?? source?.x0);
    const y = Number(source?.y ?? source?.top ?? source?.y0);
    const width = Number(source?.width ?? (Number(source?.x1) - x));
    const height = Number(source?.height ?? (Number(source?.y1) - y));
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }
    return { x, y, width, height };
  }

  function layoutBoxFromEntry(entry, kind, fallbackStart) {
    const box = normalizeOcrBox(entry);
    if (!box) return null;
    const text = String(entry?.text || "");
    const start = Number.isFinite(Number(entry?.start)) ? Number(entry.start) : fallbackStart;
    const end = Number.isFinite(Number(entry?.end)) ? Number(entry.end) : start + text.length;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;
    return {
      kind,
      start,
      end,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      confidenceBucket: confidenceBucket(entry?.confidence)
    };
  }

  function sanitizeOcrLayout(result, text) {
    if (Array.isArray(result?.layout?.boxes)) {
      const boxes = result.layout.boxes
        .map((entry) => {
          const box = normalizeOcrBox(entry);
          const start = Number(entry?.start);
          const end = Number(entry?.end);
          if (!box || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;
          return {
            kind: entry?.kind === "word" ? "word" : "line",
            start,
            end,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            confidenceBucket: String(entry?.confidenceBucket || "unknown")
          };
        })
        .filter(Boolean);
      return {
        source: result.layout.source === "word" ? "word" : boxes.length ? "line" : "none",
        boxes
      };
    }

    const words = Array.isArray(result?.words) ? result.words : [];
    const lines = Array.isArray(result?.lines) ? result.lines : [];
    const boxes = [];
    let cursor = 0;

    for (const word of words) {
      const wordText = String(word?.text || "");
      const fallbackStart = wordText ? String(text || "").indexOf(wordText, cursor) : -1;
      const layoutBox = layoutBoxFromEntry(word, "word", fallbackStart);
      if (layoutBox) {
        boxes.push(layoutBox);
        cursor = Math.max(cursor, layoutBox.end);
      }
    }

    if (!boxes.length) {
      cursor = 0;
      for (const line of lines) {
        const lineText = String(line?.text || "");
        const fallbackStart = lineText ? String(text || "").indexOf(lineText, cursor) : -1;
        const layoutBox = layoutBoxFromEntry(line, "line", fallbackStart);
        if (layoutBox) {
          boxes.push(layoutBox);
          cursor = Math.max(cursor, layoutBox.end);
        }
      }
    }

    return {
      source: boxes.some((box) => box.kind === "word") ? "word" : boxes.length ? "line" : "none",
      boxes
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
      warnings: Array.isArray(result?.warnings) ? result.warnings.map(String).filter(Boolean) : [],
      layout: sanitizeOcrLayout(result, text)
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
    let timeoutId = null;
    let timedOut = false;
    const timeout = new Promise((resolve) => {
      timeoutId = root.setTimeout(() => {
        timedOut = true;
        if (typeof runtime.terminate === "function") {
          try {
            runtime.terminate();
          } catch {}
        }
        resolve(timeoutError());
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([runtime.recognizeImageBytes(payload), timeout]);
      if (!timedOut && timeoutId !== null) {
        root.clearTimeout(timeoutId);
      }
      if (!result?.ok) {
        const reason = result?.reason || result?.status || "ocr_failed";
        return sanitizeOcrFailure(reason, reason);
      }
      return sanitizeOcrSuccess(result);
    } catch {
      if (!timedOut && timeoutId !== null) {
        root.clearTimeout(timeoutId);
      }
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

  function overlaps(leftStart, leftEnd, rightStart, rightEnd) {
    return leftStart < rightEnd && leftEnd > rightStart;
  }

  function mergeBoxes(boxes) {
    const first = boxes[0];
    let minX = first.x;
    let minY = first.y;
    let maxX = first.x + first.width;
    let maxY = first.y + first.height;
    for (const box of boxes.slice(1)) {
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }
    const buckets = boxes.map((box) => box.confidenceBucket);
    const confidenceBucket = buckets.includes("low") || buckets.includes("unknown") ? "low" : buckets.includes("medium") ? "medium" : "high";
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      confidenceBucket
    };
  }

  function redactionBoxesForOcrFindings({ ocr, scanResult, scanText, ocrText } = {}) {
    const boxes = Array.isArray(ocr?.layout?.boxes) ? ocr.layout.boxes : [];
    const findings = Array.isArray(scanResult?.findings) ? scanResult.findings : [];
    const text = String(scanText || "");
    const recognizedText = String(ocrText || ocr?.text || "");
    const ocrStart = text && recognizedText ? text.indexOf(recognizedText) : 0;
    if (!boxes.length) {
      return {
        ok: false,
        status: "ocr_boxes_missing",
        message: "OCR detected text but did not provide usable bounding boxes for visual redaction."
      };
    }
    if (ocrStart < 0) {
      return {
        ok: false,
        status: "ocr_text_boundary_missing",
        message: "LeakGuard could not map OCR text boundaries to detector findings."
      };
    }

    const redactionBoxes = [];
    for (const finding of findings) {
      const findingStart = Number(finding?.start) - ocrStart;
      const findingEnd = Number(finding?.end) - ocrStart;
      if (!Number.isFinite(findingStart) || !Number.isFinite(findingEnd) || findingEnd <= 0) continue;
      if (findingStart < 0 || findingStart >= recognizedText.length) continue;
      const matchedBoxes = boxes.filter((box) => overlaps(box.start, box.end, findingStart, findingEnd));
      if (!matchedBoxes.length) {
        return {
          ok: false,
          status: "ocr_box_mapping_missing",
          message: "OCR detected a secret but did not provide a usable bounding box for it."
        };
      }
      const merged = mergeBoxes(matchedBoxes);
      if (merged.confidenceBucket !== "high" && merged.confidenceBucket !== "medium") {
        return {
          ok: false,
          status: "ocr_box_confidence_too_low",
          message: "OCR detected a secret but the bounding box confidence is too low for visual redaction."
        };
      }
      redactionBoxes.push(merged);
    }

    if (!redactionBoxes.length) {
      return {
        ok: false,
        status: "ocr_secret_findings_missing",
        message: "No OCR secret findings were available for visual redaction."
      };
    }
    return {
      ok: true,
      status: "ocr_redaction_boxes_ready",
      boxes: redactionBoxes
    };
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
    redactedTextFileNameForImage,
    redactionBoxesForOcrFindings
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ScannerOcr;
  }
})();
