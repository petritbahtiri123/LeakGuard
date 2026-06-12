const wasmProbePath = "shared/ocr/ocrWasmProbe.wasm";
const tesseractCoreScriptPath = "shared/ocr/tesseract-core/tesseract-core.js";
const tesseractCoreWasmPath = "shared/ocr/tesseract-core/tesseract-core.wasm";
const englishTrainedDataPath = "shared/ocr/tessdata/eng.traineddata.gz";
const syntheticRecognitionFixturePath = "shared/ocr/fixtures/synthetic-test-ocr.png";
const expectedSyntheticText = "TEST OCR";
let tesseractCoreProbePromise = null;
let tesseractCoreModulePromise = null;
let englishLanguageProbePromise = null;
let recognitionProbePromise = null;

function getExtensionUrl(resourcePath) {
  if (self.LEAKGUARD_OCR_BASE && typeof URL === "function") {
    return new URL(resourcePath, self.LEAKGUARD_OCR_BASE).href;
  }
  const runtime = self.chrome?.runtime || self.browser?.runtime || null;
  if (runtime && typeof runtime.getURL === "function") {
    return runtime.getURL(resourcePath);
  }
  if (self.location?.href && typeof URL === "function") {
    const workerRelativePath = resourcePath.startsWith("shared/ocr/")
      ? resourcePath.slice("shared/ocr/".length)
      : resourcePath.split("/").pop();
    return new URL(workerRelativePath, self.location.href).href;
  }
  return resourcePath;
}

async function runWasmProbe() {
  if (typeof self.fetch !== "function" || !self.WebAssembly?.compile) {
    return {
      ok: false,
      status: "wasm_blocked",
      reason: "wasm_api_unavailable"
    };
  }

  try {
    const response = await self.fetch(getExtensionUrl(wasmProbePath));
    if (!response?.ok) {
      return {
        ok: false,
        status: "wasm_blocked",
        reason: `wasm_asset_fetch_failed_${response?.status || "unknown"}`
      };
    }

    const buffer = await response.arrayBuffer();
    await self.WebAssembly.compile(new Uint8Array(buffer));
    return {
      ok: true,
      status: "wasm_ready",
      wasmLoaded: true
    };
  } catch (error) {
    return {
      ok: false,
      status: "wasm_blocked",
      reason: classifyWasmProbeError(error)
    };
  }
}

function classifyWasmProbeError(error) {
  const text = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
  if (
    text.includes("content security policy") ||
    text.includes("code generation") ||
    text.includes("embedder")
  ) {
    return "wasm_compile_blocked_by_csp";
  }
  return error?.name || "wasm_load_failed";
}

async function runTesseractCoreProbe() {
  tesseractCoreProbePromise = tesseractCoreProbePromise || loadTesseractCoreProof();
  return tesseractCoreProbePromise;
}

async function loadTesseractCoreProof() {
  const result = await getTesseractCoreModule();
  if (!result.ok) {
    return {
      ok: false,
      status: "tesseract_core_blocked",
      reason: result.reason
    };
  }

  return {
    ok: true,
    status: "tesseract_core_ready",
    ocrImplemented: false
  };
}

async function getTesseractCoreModule() {
  tesseractCoreModulePromise = tesseractCoreModulePromise || initializeTesseractCoreModule();
  return tesseractCoreModulePromise;
}

async function initializeTesseractCoreModule() {
  if (
    typeof self.fetch !== "function" ||
    typeof self.importScripts !== "function" ||
    !self.WebAssembly?.instantiate
  ) {
    return {
      ok: false,
      status: "tesseract_core_blocked",
      reason: "core_runtime_api_unavailable"
    };
  }

  try {
    const wasmUrl = getExtensionUrl(tesseractCoreWasmPath);
    const response = await self.fetch(wasmUrl);
    if (!response?.ok) {
      return {
        ok: false,
        status: "tesseract_core_blocked",
        reason: `core_wasm_fetch_failed_${response?.status || "unknown"}`
      };
    }

    const wasmBinary = await response.arrayBuffer();
    const root = typeof globalThis === "object" ? globalThis : self;
    const coreConfig = {
      wasmBinary,
      locateFile(fileName) {
        return fileName === "tesseract-core.wasm" ? wasmUrl : getExtensionUrl(`shared/ocr/tesseract-core/${fileName}`);
      },
      print() {},
      printErr() {}
    };
    self.importScripts(getExtensionUrl(tesseractCoreScriptPath));
    if (typeof root.TesseractCore !== "function") {
      return {
        ok: false,
        status: "tesseract_core_blocked",
        reason: "core_factory_unavailable"
      };
    }

    const module = await root.TesseractCore(coreConfig);
    return {
      ok: true,
      module
    };
  } catch (error) {
    return {
      ok: false,
      status: "tesseract_core_blocked",
      reason: classifyTesseractCoreError(error)
    };
  }
}

function classifyTesseractCoreError(error) {
  const text = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
  if (
    text.includes("content security policy") ||
    text.includes("code generation") ||
    text.includes("embedder")
  ) {
    return "core_wasm_blocked_by_csp";
  }
  return error?.name || "core_load_failed";
}

async function runLanguageProbe(language) {
  if (language !== "eng") {
    return {
      ok: false,
      status: "language_blocked",
      language: String(language || ""),
      reason: "unsupported_language"
    };
  }

  englishLanguageProbePromise = englishLanguageProbePromise || loadEnglishLanguageProof();
  return englishLanguageProbePromise;
}

async function loadEnglishLanguageProof() {
  const core = await getTesseractCoreModule();
  if (!core.ok) {
    return {
      ok: false,
      status: "language_blocked",
      language: "eng",
      reason: core.reason
    };
  }

  if (typeof DecompressionStream !== "function" || typeof Response !== "function" || typeof Blob !== "function") {
    return {
      ok: false,
      status: "language_blocked",
      language: "eng",
      reason: "gzip_decompression_unavailable"
    };
  }

  try {
    const response = await self.fetch(getExtensionUrl(englishTrainedDataPath));
    if (!response?.ok) {
      return {
        ok: false,
        status: "language_blocked",
        language: "eng",
        reason: `language_fetch_failed_${response?.status || "unknown"}`
      };
    }

    const compressedData = new Uint8Array(await response.arrayBuffer());
    if (compressedData[0] !== 0x1f || compressedData[1] !== 0x8b) {
      return {
        ok: false,
        status: "language_blocked",
        language: "eng",
        reason: "language_asset_not_gzip"
      };
    }

    const trainedData = await decompressGzip(compressedData);
    core.module.FS_createPath("/", "tessdata", true, true);
    core.module.FS_createDataFile("/tessdata", "eng.traineddata", trainedData, true, false, false);

    return {
      ok: true,
      status: "language_ready",
      language: "eng",
      ocrImplemented: false
    };
  } catch (error) {
    return {
      ok: false,
      status: "language_blocked",
      language: "eng",
      reason: classifyLanguageError(error)
    };
  }
}

async function decompressGzip(compressedData) {
  const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function classifyLanguageError(error) {
  const text = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
  if (text.includes("exists")) {
    return "language_already_loaded";
  }
  return error?.name || "language_load_failed";
}

async function runRecognitionProbe() {
  recognitionProbePromise = recognitionProbePromise || recognizeSyntheticFixture();
  return recognitionProbePromise;
}

async function recognizeSyntheticFixture() {
  const language = await runLanguageProbe("eng");
  if (!language.ok) {
    return {
      ok: false,
      status: "ocr_recognition_blocked",
      ocrImplemented: true,
      language: "eng",
      reason: language.reason || "language_not_ready"
    };
  }

  const core = await getTesseractCoreModule();
  if (!core.ok) {
    return {
      ok: false,
      status: "ocr_recognition_blocked",
      ocrImplemented: true,
      language: "eng",
      reason: core.reason
    };
  }

  try {
    const image = await loadSyntheticFixturePixels();
    const result = recognizeGrayscaleImage(core.module, image);
    return {
      ok: true,
      status: "ocr_recognition_ready",
      ocrImplemented: true,
      language: "eng",
      textLength: result.textLength,
      containsExpectedText: result.containsExpectedText,
      confidenceBucket: bucketConfidence(result.confidence)
    };
  } catch (error) {
    return {
      ok: false,
      status: "ocr_recognition_blocked",
      ocrImplemented: true,
      language: "eng",
      reason: classifyRecognitionError(error)
    };
  }
}

async function loadSyntheticFixturePixels() {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function" || typeof Blob !== "function") {
    throw new Error("image_decode_api_unavailable");
  }

  const response = await self.fetch(getExtensionUrl(syntheticRecognitionFixturePath));
  if (!response?.ok) {
    throw new Error(`fixture_fetch_failed_${response?.status || "unknown"}`);
  }

  const bytes = await response.arrayBuffer();
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("image_canvas_context_unavailable");
    }
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    return {
      width: bitmap.width,
      height: bitmap.height,
      grayscale: rgbaToGrayscale(pixels)
    };
  } finally {
    if (typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
}

function rgbaToGrayscale(pixels) {
  const grayscale = new Uint8Array(pixels.length / 4);
  for (let index = 0, output = 0; index < pixels.length; index += 4, output += 1) {
    grayscale[output] = Math.round((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3);
  }
  return grayscale;
}

function recognizeGrayscaleImage(module, image) {
  const api = new module.TessBaseAPI();
  const pointer = module._malloc(image.grayscale.length);
  try {
    module.HEAPU8.set(image.grayscale, pointer);
    if (api.Init("/tessdata", "eng") !== 0) {
      throw new Error("recognition_init_failed");
    }
    api.SetPageSegMode(7);
    api.SetVariable("tessedit_char_whitelist", "ABCDEFGHIJKLMNOPQRSTUVWXYZ ");
    api.SetImage(pointer, image.width, image.height, 1, image.width);
    api.SetSourceResolution(300);
    if (api.Recognize(null) !== 0) {
      throw new Error("recognition_failed");
    }
    const text = String(api.GetUTF8Text() || "").trim().replace(/\s+/g, " ");
    return {
      textLength: text.length,
      containsExpectedText: text.includes(expectedSyntheticText),
      confidence: Number(api.MeanTextConf() || 0)
    };
  } finally {
    try {
      api.End();
    } catch {}
    if (typeof api.__destroy__ === "function") {
      api.__destroy__();
    }
    module._free(pointer);
  }
}

function bucketConfidence(confidence) {
  if (confidence >= 85) return "high";
  if (confidence >= 60) return "medium";
  if (confidence > 0) return "low";
  return "none";
}

function findTextOffset(text, segment, cursor) {
  const input = String(text || "");
  const target = String(segment || "").trim();
  if (!target) return -1;
  const direct = input.indexOf(target, Math.max(0, cursor || 0));
  if (direct >= 0) return direct;
  return input.indexOf(target);
}

function qualityForBox(boxKind, confidence) {
  const confidenceBucket = bucketConfidence(confidence);
  const highEnough = confidenceBucket === "high" || confidenceBucket === "medium";
  const fallbackUsed = boxKind === "fallback";
  const visualRedactionSafe = highEnough && !fallbackUsed;
  return {
    boxKind,
    kind: boxKind,
    confidenceBucket,
    fallbackUsed,
    visualRedactionSafe,
    protectedSiteEligible: visualRedactionSafe
  };
}

function layoutSummary(source, boxes) {
  const fallbackUsed = source === "fallback" || boxes.some((box) => box.fallbackUsed === true);
  const visualRedactionSafe = boxes.length > 0 && boxes.every((box) => box.visualRedactionSafe === true);
  return {
    source,
    boxKind: source,
    fallbackUsed,
    visualRedactionSafe,
    protectedSiteEligible: visualRedactionSafe && !fallbackUsed,
    boxes
  };
}

function extractIteratorBoxes(module, api, text, level, boxKind) {
  if (typeof api.GetIterator !== "function" || typeof level !== "number") return [];
  let iterator = null;
  try {
    iterator = api.GetIterator();
    if (!iterator || typeof iterator.Begin !== "function" || typeof iterator.Next !== "function") return [];
    iterator.Begin();
    const boxes = [];
    let cursor = 0;
    do {
      const segment = String(iterator.GetUTF8Text(level) || "").trim();
      const bounds = typeof iterator.getBoundingBox === "function" ? iterator.getBoundingBox(level) : null;
      const start = findTextOffset(text, segment, cursor);
      const end = start >= 0 ? start + segment.length : -1;
      const x = Number(bounds?.x0);
      const y = Number(bounds?.y0);
      const width = Number(bounds?.x1) - x;
      const height = Number(bounds?.y1) - y;
      if (
        start >= 0 &&
        end > start &&
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0
      ) {
        boxes.push({
          ...qualityForBox(boxKind, Number(iterator.Confidence(level) || 0)),
          start,
          end,
          x,
          y,
          width,
          height
        });
        cursor = end;
      }
    } while (iterator.Next(level));
    return boxes;
  } catch {
    return [];
  }
}

function buildOcrLayout(module, api, image, text, confidence) {
  const wordBoxes = extractIteratorBoxes(module, api, text, module.RIL_WORD, "word");
  if (wordBoxes.length) return layoutSummary("word", wordBoxes);

  const lineBoxes = extractIteratorBoxes(module, api, text, module.RIL_TEXTLINE, "line");
  if (lineBoxes.length) return layoutSummary("line", lineBoxes);

  return layoutSummary(
    text ? "fallback" : "none",
    text
      ? [
          {
            ...qualityForBox("fallback", confidence),
            start: 0,
            end: text.length,
            x: 0,
            y: 0,
            width: image.width,
            height: image.height
          }
        ]
      : []
  );
}

function classifyRecognitionError(error) {
  return error?.message || error?.name || "recognition_load_failed";
}

function isSupportedScannerImageMimeType(mimeType) {
  return /^(?:image\/png|image\/jpeg|image\/webp)$/i.test(String(mimeType || ""));
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

async function decodeImageBytesToPixels(imageBytes, mimeType) {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function" || typeof Blob !== "function") {
    throw new Error("image_decode_api_unavailable");
  }
  if (!isSupportedScannerImageMimeType(mimeType)) {
    throw new Error("unsupported_image_mime_type");
  }

  const bytes = toUint8Array(imageBytes);
  if (!bytes || !bytes.byteLength) {
    throw new Error("image_bytes_unavailable");
  }

  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }));
  try {
    const width = Number(bitmap.width || 0);
    const height = Number(bitmap.height || 0);
    if (!width || !height || width > 4096 || height > 4096 || width * height > 12 * 1000 * 1000) {
      throw new Error("image_dimensions_too_large");
    }

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("image_canvas_context_unavailable");
    }
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    return {
      width,
      height,
      grayscale: rgbaToGrayscale(pixels)
    };
  } finally {
    if (typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
}

function recognizeScannerImage(module, image) {
  const api = new module.TessBaseAPI();
  const pointer = module._malloc(image.grayscale.length);
  try {
    module.HEAPU8.set(image.grayscale, pointer);
    if (api.Init("/tessdata", "eng") !== 0) {
      throw new Error("recognition_init_failed");
    }
    api.SetPageSegMode(6);
    api.SetImage(pointer, image.width, image.height, 1, image.width);
    api.SetSourceResolution(300);
    if (api.Recognize(null) !== 0) {
      throw new Error("recognition_failed");
    }
    const text = String(api.GetUTF8Text() || "").trim();
    const confidence = Number(api.MeanTextConf() || 0);
    const confidenceBucket = bucketConfidence(confidence);
    return {
      text,
      textLength: text.length,
      confidenceBucket,
      layout: buildOcrLayout(module, api, image, text, confidence)
    };
  } finally {
    try {
      api.End();
    } catch {}
    if (typeof api.__destroy__ === "function") {
      api.__destroy__();
    }
    module._free(pointer);
  }
}

async function recognizeScannerImageBytes(message) {
  if (message?.language !== "eng") {
    return {
      ok: false,
      status: "ocr_recognition_blocked",
      language: String(message?.language || ""),
      textLength: 0,
      confidenceBucket: "unknown",
      warnings: ["unsupported_language"],
      reason: "unsupported_language"
    };
  }

  const language = await runLanguageProbe("eng");
  if (!language.ok) {
    return {
      ok: false,
      status: "ocr_recognition_blocked",
      language: "eng",
      textLength: 0,
      confidenceBucket: "unknown",
      warnings: [language.reason || "language_not_ready"],
      reason: language.reason || "language_not_ready"
    };
  }

  const core = await getTesseractCoreModule();
  if (!core.ok) {
    return {
      ok: false,
      status: "ocr_recognition_blocked",
      language: "eng",
      textLength: 0,
      confidenceBucket: "unknown",
      warnings: [core.reason || "core_not_ready"],
      reason: core.reason || "core_not_ready"
    };
  }

  try {
    const image = await decodeImageBytesToPixels(message?.imageBytes, message?.mimeType);
    const result = recognizeScannerImage(core.module, image);
    return {
      ok: true,
      status: "ocr_recognition_ready",
      language: "eng",
      text: result.text,
      textLength: result.textLength,
      confidenceBucket: result.confidenceBucket,
      layout: result.layout,
      warnings: []
    };
  } catch (error) {
    const reason = classifyRecognitionError(error);
    return {
      ok: false,
      status: "ocr_recognition_blocked",
      language: "eng",
      textLength: 0,
      confidenceBucket: "unknown",
      warnings: [reason],
      reason
    };
  }
}

self.onmessage = async (event) => {
  if (event?.data?.type === "ocr_probe") {
    self.postMessage({
      ok: true,
      status: "worker_ready",
      ocrImplemented: false
    });
    return;
  }

  if (event?.data?.type === "wasm_probe") {
    self.postMessage(await runWasmProbe());
    return;
  }

  if (event?.data?.type === "tesseract_core_probe") {
    self.postMessage(await runTesseractCoreProbe());
    return;
  }

  if (event?.data?.type === "ocr_language_probe") {
    self.postMessage(await runLanguageProbe(event.data.language));
    return;
  }

  if (event?.data?.type === "ocr_recognition_probe") {
    self.postMessage(await runRecognitionProbe());
    return;
  }

  if (event?.data?.type === "ocr_recognize_image") {
    self.postMessage(await recognizeScannerImageBytes(event.data));
    return;
  }

  if (event?.data?.type === "ocr_engine_probe") {
    self.postMessage({
      ok: false,
      status: "engine_blocked",
      ocrImplemented: false,
      engine: null,
      reason: "no_candidate_passed_security_size_csp_gates"
    });
    return;
  }

  self.postMessage({
    ok: false,
    status: "unsupported_message",
    ocrImplemented: false
  });
};
