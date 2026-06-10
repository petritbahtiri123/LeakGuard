self.onmessage = (event) => {
  if (event?.data?.type === "ocr_probe") {
    self.postMessage({
      ok: true,
      status: "worker_ready",
      ocrImplemented: false
    });
    return;
  }

  self.postMessage({
    ok: false,
    status: "unsupported_message",
    ocrImplemented: false
  });
};
