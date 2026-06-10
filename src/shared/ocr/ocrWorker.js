const wasmProbePath = "shared/ocr/ocrWasmProbe.wasm";

function getExtensionUrl(resourcePath) {
  const runtime = self.chrome?.runtime || self.browser?.runtime || null;
  if (runtime && typeof runtime.getURL === "function") {
    return runtime.getURL(resourcePath);
  }
  if (self.location?.href && typeof URL === "function") {
    return new URL(resourcePath.split("/").pop(), self.location.href).href;
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
