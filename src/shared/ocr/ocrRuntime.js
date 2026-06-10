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
    return workerPath;
  }

  function getWorker() {
    if (!worker) {
      worker = new root.Worker(getWorkerUrl());
    }
    return worker;
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
    const activeWorker = getWorker();

    return new Promise((resolve, reject) => {
      const timeout = root.setTimeout(() => {
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        workerStatus = "recognition_timeout";
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
