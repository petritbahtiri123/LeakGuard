{
  const root = typeof globalThis !== "undefined" ? globalThis : self;
  root.PWM = root.PWM || {};

  const workerPath = "shared/ocr/ocrWorker.js";
  let worker = null;
  let workerStatus = "idle";

  function isAvailable() {
    return typeof root.Worker === "function";
  }

  function getStatus() {
    return {
      available: isAvailable(),
      status: "scanner_page_v1",
      ocrImplemented: true,
      workerStatus
    };
  }

  function getWorkerUrl() {
    const runtime = root.chrome?.runtime || root.browser?.runtime || null;
    if (runtime && typeof runtime.getURL === "function") {
      return runtime.getURL(workerPath);
    }
    if (root.location?.href && typeof URL === "function") {
      return new URL(`/${workerPath}`, root.location.href).href;
    }
    return workerPath;
  }

  function createBlobWorkerFallback() {
    if (
      root.chrome?.runtime ||
      root.browser?.runtime ||
      typeof root.XMLHttpRequest !== "function" ||
      typeof root.Blob !== "function" ||
      !root.URL?.createObjectURL ||
      !root.location?.href
    ) {
      return null;
    }

    const request = new root.XMLHttpRequest();
    request.open("GET", getWorkerUrl(), false);
    request.send(null);
    if (request.status && request.status !== 200) return null;

    const extensionBase = new URL("/", root.location.href).href;
    const source = `self.LEAKGUARD_OCR_BASE=${JSON.stringify(extensionBase)};\n${request.responseText || ""}`;
    const blobUrl = root.URL.createObjectURL(new root.Blob([source], { type: "text/javascript" }));
    return new root.Worker(blobUrl);
  }

  function getWorker() {
    if (!worker) {
      try {
        worker = new root.Worker(getWorkerUrl());
      } catch (error) {
        worker = createBlobWorkerFallback();
        if (!worker) throw error;
      }
    }
    return worker;
  }

  function classifyWorkerStartError(error) {
    const text = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
    if (text.includes("content security policy") || text.includes("security")) {
      return "worker_start_blocked_by_csp";
    }
    if (text.includes("web_accessible_resources") || text.includes("access")) {
      return "worker_start_resource_blocked";
    }
    return error?.name || "worker_start_failed";
  }

  function createWorkerProbe() {
    if (!isAvailable()) {
      return Promise.resolve({
        ok: false,
        status: "worker_unavailable",
        ocrImplemented: false
      });
    }

    workerStatus = "probing";
    const activeWorker = getWorker();

    return new Promise((resolve, reject) => {
      const timeout = root.setTimeout(() => {
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "probe_timeout";
        reject(new Error("OCR worker probe timed out."));
      }, 3000);

      activeWorker.onmessage = (event) => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        const response = event?.data || {};
        workerStatus = response.status === "worker_ready" ? "worker_ready" : "unexpected_response";
        resolve({
          ok: response.ok === true,
          status: response.status || workerStatus,
          ocrImplemented: false
        });
      };

      activeWorker.onerror = () => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "worker_error";
        reject(new Error("OCR worker probe failed."));
      };

      activeWorker.postMessage({ type: "ocr_probe" });
    });
  }

  function createEngineProbe() {
    if (!isAvailable()) {
      return Promise.resolve({
        ok: false,
        status: "worker_unavailable",
        ocrImplemented: false,
        engine: null,
        reason: "worker_api_unavailable"
      });
    }

    workerStatus = "probing_engine";
    const activeWorker = getWorker();

    return new Promise((resolve, reject) => {
      const timeout = root.setTimeout(() => {
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "engine_probe_timeout";
        reject(new Error("OCR engine probe timed out."));
      }, 3000);

      activeWorker.onmessage = (event) => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        const response = event?.data || {};
        workerStatus =
          response.status === "engine_ready" || response.status === "engine_blocked"
            ? response.status
            : "unexpected_response";
        resolve({
          ok: response.ok === true,
          status: response.status || workerStatus,
          ocrImplemented: false,
          engine: response.engine || null,
          reason: response.reason || null
        });
      };

      activeWorker.onerror = () => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "worker_error";
        reject(new Error("OCR engine probe failed."));
      };

      activeWorker.postMessage({ type: "ocr_engine_probe" });
    });
  }

  function createWasmProbe() {
    if (!isAvailable()) {
      return Promise.resolve({
        ok: false,
        status: "worker_unavailable",
        wasmLoaded: false,
        reason: "worker_api_unavailable"
      });
    }

    workerStatus = "probing_wasm";
    const activeWorker = getWorker();

    return new Promise((resolve, reject) => {
      const timeout = root.setTimeout(() => {
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "wasm_probe_timeout";
        reject(new Error("OCR WASM probe timed out."));
      }, 3000);

      activeWorker.onmessage = (event) => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        const response = event?.data || {};
        workerStatus =
          response.status === "wasm_ready" || response.status === "wasm_blocked"
            ? response.status
            : "unexpected_response";
        const result = {
          ok: response.ok === true,
          status: response.status || workerStatus,
          wasmLoaded: response.wasmLoaded === true
        };
        if (response.reason) {
          result.reason = response.reason;
        }
        resolve(result);
      };

      activeWorker.onerror = () => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "worker_error";
        reject(new Error("OCR WASM probe failed."));
      };

      activeWorker.postMessage({ type: "wasm_probe" });
    });
  }

  function createTesseractCoreProbe() {
    if (!isAvailable()) {
      return Promise.resolve({
        ok: false,
        status: "worker_unavailable",
        ocrImplemented: false,
        reason: "worker_api_unavailable"
      });
    }

    workerStatus = "probing_tesseract_core";
    const activeWorker = getWorker();

    return new Promise((resolve, reject) => {
      const timeout = root.setTimeout(() => {
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "tesseract_core_probe_timeout";
        reject(new Error("OCR tesseract.js-core probe timed out."));
      }, 3000);

      activeWorker.onmessage = (event) => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        const response = event?.data || {};
        workerStatus =
          response.status === "tesseract_core_ready" || response.status === "tesseract_core_blocked"
            ? response.status
            : "unexpected_response";
        const result = {
          ok: response.ok === true,
          status: response.status || workerStatus,
          ocrImplemented: false
        };
        if (response.reason) {
          result.reason = response.reason;
        }
        resolve(result);
      };

      activeWorker.onerror = () => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "worker_error";
        reject(new Error("OCR tesseract.js-core probe failed."));
      };

      activeWorker.postMessage({ type: "tesseract_core_probe" });
    });
  }

  function createLanguageProbe(language = "eng") {
    if (!isAvailable()) {
      return Promise.resolve({
        ok: false,
        status: "worker_unavailable",
        language,
        ocrImplemented: false,
        reason: "worker_api_unavailable"
      });
    }

    workerStatus = "probing_language";
    const activeWorker = getWorker();

    return new Promise((resolve, reject) => {
      const timeout = root.setTimeout(() => {
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "language_probe_timeout";
        reject(new Error("OCR language probe timed out."));
      }, 5000);

      activeWorker.onmessage = (event) => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        const response = event?.data || {};
        workerStatus =
          response.status === "language_ready" || response.status === "language_blocked"
            ? response.status
            : "unexpected_response";
        const result = {
          ok: response.ok === true,
          status: response.status || workerStatus,
          language: response.language || language,
          ocrImplemented: false
        };
        if (response.reason) {
          result.reason = response.reason;
        }
        resolve(result);
      };

      activeWorker.onerror = () => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "worker_error";
        reject(new Error("OCR language probe failed."));
      };

      activeWorker.postMessage({ type: "ocr_language_probe", language });
    });
  }

  function createRecognitionProbe() {
    if (!isAvailable()) {
      return Promise.resolve({
        ok: false,
        status: "worker_unavailable",
        ocrImplemented: false,
        language: "eng",
        reason: "worker_api_unavailable"
      });
    }

    workerStatus = "probing_recognition";
    const activeWorker = getWorker();

    return new Promise((resolve, reject) => {
      const timeout = root.setTimeout(() => {
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "recognition_probe_timeout";
        reject(new Error("OCR recognition probe timed out."));
      }, 8000);

      activeWorker.onmessage = (event) => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        const response = event?.data || {};
        workerStatus =
          response.status === "ocr_recognition_ready" || response.status === "ocr_recognition_blocked"
            ? response.status
            : "unexpected_response";
        const result = {
          ok: response.ok === true,
          status: response.status || workerStatus,
          ocrImplemented: response.ocrImplemented === true,
          language: response.language || "eng",
          textLength: Number(response.textLength || 0),
          containsExpectedText: response.containsExpectedText === true,
          confidenceBucket: response.confidenceBucket || "unknown"
        };
        if (response.reason) {
          result.reason = response.reason;
        }
        resolve(result);
      };

      activeWorker.onerror = () => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "worker_error";
        reject(new Error("OCR recognition probe failed."));
      };

      activeWorker.postMessage({ type: "ocr_recognition_probe" });
    });
  }

  function sanitizeRecognitionResponse(response) {
    const result = {
      ok: response?.ok === true,
      status: response?.status || "ocr_recognition_blocked",
      language: response?.language === "eng" ? "eng" : "eng",
      text: String(response?.text || ""),
      textLength: Number(response?.textLength || String(response?.text || "").length),
      confidenceBucket: response?.confidenceBucket || "unknown",
      warnings: Array.isArray(response?.warnings) ? response.warnings.map(String).filter(Boolean) : []
    };
    if (!result.ok) {
      delete result.text;
      result.textLength = 0;
    }
    if (response?.reason) {
      result.reason = response.reason;
    }
    return result;
  }

  function recognizeImageBytes(payload = {}) {
    if (!isAvailable()) {
      return Promise.resolve({
        ok: false,
        status: "worker_unavailable",
        language: "eng",
        textLength: 0,
        confidenceBucket: "unknown",
        warnings: ["worker_api_unavailable"],
        reason: "worker_api_unavailable"
      });
    }

    workerStatus = "recognizing_image";
    let activeWorker;
    try {
      activeWorker = getWorker();
    } catch (error) {
      const reason = classifyWorkerStartError(error);
      workerStatus = reason;
      return Promise.resolve({
        ok: false,
        status: "ocr_recognition_blocked",
        language: "eng",
        textLength: 0,
        confidenceBucket: "unknown",
        warnings: [reason],
        reason
      });
    }

    return new Promise((resolve, reject) => {
      const timeout = root.setTimeout(() => {
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "recognition_timeout";
        if (typeof activeWorker.terminate === "function") {
          activeWorker.terminate();
        }
        if (worker === activeWorker) {
          worker = null;
        }
        reject(new Error("OCR image recognition timed out."));
      }, 20000);

      activeWorker.onmessage = (event) => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        const response = event?.data || {};
        workerStatus =
          response.status === "ocr_recognition_ready" || response.status === "ocr_recognition_blocked"
            ? response.status
            : "unexpected_response";
        resolve(sanitizeRecognitionResponse(response));
      };

      activeWorker.onerror = () => {
        root.clearTimeout(timeout);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "worker_error";
        reject(new Error("OCR image recognition failed."));
      };

      activeWorker.postMessage({
        type: "ocr_recognize_image",
        language: "eng",
        imageBytes: payload.imageBytes,
        mimeType: payload.mimeType
      });
    });
  }

  function terminate() {
    if (worker && typeof worker.terminate === "function") {
      worker.terminate();
    }
    worker = null;
    workerStatus = "idle";
  }

  root.PWM.OcrRuntime = {
    isAvailable,
    getStatus,
    createWorkerProbe,
    createWasmProbe,
    createEngineProbe,
    createTesseractCoreProbe,
    createLanguageProbe,
    createRecognitionProbe,
    recognizeImageBytes,
    terminate
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.OcrRuntime;
  }
}
