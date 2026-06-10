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
      status: "not_implemented",
      ocrImplemented: false,
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
    terminate
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.OcrRuntime;
  }
}
