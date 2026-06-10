const wasmProbePath = "shared/ocr/ocrWasmProbe.wasm";
const tesseractCoreScriptPath = "shared/ocr/tesseract-core/tesseract-core.js";
const tesseractCoreWasmPath = "shared/ocr/tesseract-core/tesseract-core.wasm";
const englishTrainedDataPath = "shared/ocr/tessdata/eng.traineddata.gz";
let tesseractCoreProbePromise = null;
let tesseractCoreModulePromise = null;
let englishLanguageProbePromise = null;

function getExtensionUrl(resourcePath) {
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
