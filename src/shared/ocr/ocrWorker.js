self.onmessage = (event) => {
  if (event?.data?.type === "ocr_probe") {
    self.postMessage({
      ok: true,
      status: "worker_ready",
      ocrImplemented: false
    });
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
