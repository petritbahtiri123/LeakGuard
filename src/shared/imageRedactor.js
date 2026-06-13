(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const MAX_IMAGE_DIMENSION = 4096;
  const MAX_IMAGE_PIXELS = 12 * 1000 * 1000;

  function toUint8Array(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    return null;
  }

  async function readBytes(imageBytes, imageBlob) {
    if (imageBlob && typeof imageBlob.arrayBuffer === "function") {
      return toUint8Array(await imageBlob.arrayBuffer());
    }
    return toUint8Array(imageBytes);
  }

  function fail(status, message) {
    return {
      ok: false,
      status,
      message
    };
  }

  function isSupportedMimeType(mimeType) {
    return /^(?:image\/png|image\/jpeg|image\/webp)$/i.test(String(mimeType || ""));
  }

  function validateDimensions(dimensions) {
    if (!dimensions) return { ok: true };
    const width = Number(dimensions.width);
    const height = Number(dimensions.height);
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      width > MAX_IMAGE_DIMENSION ||
      height > MAX_IMAGE_DIMENSION ||
      width * height > MAX_IMAGE_PIXELS
    ) {
      return fail("image_dimensions_too_large", "Image dimensions are too large for local visual redaction.");
    }
    return { ok: true, width, height };
  }

  function normalizeBox(box) {
    const x = Number(box?.x);
    const y = Number(box?.y);
    const width = Number(box?.width);
    const height = Number(box?.height);
    const confidenceBucket = String(box?.confidenceBucket || "unknown");
    const boxKind = String(box?.boxKind || box?.kind || "line");
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      (confidenceBucket !== "high" && confidenceBucket !== "medium")
    ) {
      return null;
    }
    return {
      x,
      y,
      width,
      height,
      confidenceBucket,
      boxKind,
      kind: boxKind,
      fallbackUsed: box?.fallbackUsed === true || boxKind === "fallback",
      visualRedactionSafe: box?.visualRedactionSafe === true && boxKind !== "fallback"
    };
  }

  function normalizeBoxes(boxes, dimensions, options = {}) {
    if (!Array.isArray(boxes) || !boxes.length) {
      if (options.allowNoBoxes === true) {
        return { ok: true, boxes: [] };
      }
      return fail("redaction_boxes_missing", "Visual redaction requires usable OCR bounding boxes.");
    }

    const normalized = [];
    for (const box of boxes) {
      const normalizedBox = normalizeBox(box);
      if (!normalizedBox) {
        return fail("redaction_box_invalid", "Visual redaction requires medium or high confidence OCR boxes.");
      }
      if (
        dimensions &&
        (normalizedBox.x + normalizedBox.width > dimensions.width ||
          normalizedBox.y + normalizedBox.height > dimensions.height)
      ) {
        return fail("redaction_box_out_of_bounds", "Visual redaction box is outside the decoded image.");
      }
      normalized.push(normalizedBox);
    }
    return { ok: true, boxes: normalized };
  }

  function redactedPngFileName(fileName) {
    const name = String(fileName || "image").split(/[\\/]/).pop() || "image";
    const index = name.lastIndexOf(".");
    const base = index > 0 ? name.slice(0, index).replace(/^\.+/, "") || "image" : name;
    return `${base}.redacted.png`;
  }

  function makeBlob(parts, type) {
    return new root.Blob(parts, { type });
  }

  function canvasToBlob(canvas) {
    if (typeof canvas.convertToBlob === "function") {
      return canvas.convertToBlob({ type: "image/png" });
    }
    if (typeof canvas.toBlob === "function") {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("canvas_export_failed"));
          }
        }, "image/png");
      });
    }
    throw new Error("canvas_export_unavailable");
  }

  async function drawWithBrowserCanvas({ imageBytes, imageBlob, mimeType, boxes, allowNoBoxes }) {
    if (typeof root.createImageBitmap !== "function" || typeof root.Blob !== "function") {
      throw new Error("image_decode_api_unavailable");
    }

    const bytes = await readBytes(imageBytes, imageBlob);
    if (!bytes || !bytes.byteLength) {
      throw new Error("image_bytes_unavailable");
    }

    const sourceBlob = makeBlob([bytes], mimeType);
    const bitmap = await root.createImageBitmap(sourceBlob);
    try {
      const dimensions = validateDimensions({ width: bitmap.width, height: bitmap.height });
      if (!dimensions.ok) {
        throw new Error(dimensions.status);
      }

      const normalized = normalizeBoxes(boxes, dimensions, { allowNoBoxes });
      if (!normalized.ok) {
        throw new Error(normalized.status);
      }

      const canvas =
        typeof root.OffscreenCanvas === "function"
          ? new root.OffscreenCanvas(bitmap.width, bitmap.height)
          : root.document?.createElement("canvas");
      if (!canvas) {
        throw new Error("canvas_unavailable");
      }
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("canvas_context_unavailable");
      }

      context.drawImage(bitmap, 0, 0);
      context.fillStyle = "#000000";
      for (const box of normalized.boxes) {
        context.fillRect(box.x, box.y, box.width, box.height);
      }
      return canvasToBlob(canvas);
    } finally {
      if (typeof bitmap.close === "function") {
        bitmap.close();
      }
    }
  }

  async function createRedactedPng(options = {}) {
    const mimeType = String(options.mimeType || options.imageBlob?.type || "");
    if (!isSupportedMimeType(mimeType)) {
      return fail("unsupported_image_type", "Visual redaction supports PNG, JPG, JPEG, and WEBP images only.");
    }

    const dimensions = validateDimensions(options.dimensions);
    if (!dimensions.ok) return dimensions;

    const allowNoBoxes = options.allowNoBoxes === true;
    const boxes = normalizeBoxes(options.boxes, dimensions.width ? dimensions : null, { allowNoBoxes });
    if (!boxes.ok) return boxes;

    let bytes;
    try {
      bytes = await readBytes(options.imageBytes, options.imageBlob);
    } catch {
      return fail("image_read_failed", "LeakGuard could not read the image for visual redaction.");
    }
    if (!bytes || !bytes.byteLength) {
      return fail("image_bytes_unavailable", "LeakGuard could not read the image for visual redaction.");
    }

    try {
      const blob =
        typeof options.canvasAdapter === "function"
          ? await options.canvasAdapter({ imageBytes: bytes, mimeType, boxes: boxes.boxes })
          : await drawWithBrowserCanvas({
              imageBytes: bytes,
              mimeType,
              boxes: boxes.boxes,
              allowNoBoxes
            });
      const fileName = redactedPngFileName(options.fileName);
      const result = {
        ok: true,
        status: "image_redacted_png_ready",
        blob,
        fileName
      };
      if (typeof root.File === "function") {
        result.file = new root.File([blob], fileName, { type: "image/png" });
      }
      return result;
    } catch {
      return fail("image_redaction_failed", "LeakGuard could not generate a redacted PNG from these OCR boxes.");
    }
  }

  root.PWM.ImageRedactor = {
    MAX_IMAGE_DIMENSION,
    MAX_IMAGE_PIXELS,
    createRedactedPng,
    redactedPngFileName
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ImageRedactor;
  }
})();
