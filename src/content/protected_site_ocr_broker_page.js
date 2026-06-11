(function () {
  const REQUEST_SOURCE = "LeakGuardProtectedSiteOcr";
  const RESPONSE_SOURCE = "LeakGuardProtectedSiteOcrBroker";

  function sanitizeFailure(reason) {
    return {
      ok: false,
      status: "ocr_recognition_blocked",
      language: "eng",
      textLength: 0,
      confidenceBucket: "unknown",
      warnings: [reason || "protected_site_ocr_broker_failed"],
      reason: reason || "protected_site_ocr_broker_failed"
    };
  }

  function postResult(target, origin, requestId, result) {
    target?.postMessage(
      {
        source: RESPONSE_SOURCE,
        requestId,
        ok: true,
        result
      },
      origin
    );
  }

  window.addEventListener("message", async (event) => {
    const message = event.data || {};
    if (message.source !== REQUEST_SOURCE || !message.requestId) return;

    try {
      const runtime = window.PWM?.OcrRuntime || null;
      if (!runtime || typeof runtime.recognizeImageBytes !== "function") {
        postResult(event.source, event.origin, message.requestId, sanitizeFailure("ocr_runtime_unavailable"));
        return;
      }

      if (message.prepare === true) {
        const core =
          typeof runtime.createTesseractCoreProbe === "function"
            ? await runtime.createTesseractCoreProbe()
            : sanitizeFailure("ocr_core_probe_unavailable");
        if (!core?.ok) {
          postResult(event.source, event.origin, message.requestId, sanitizeFailure(core?.reason || core?.status));
          return;
        }
        const language =
          typeof runtime.createLanguageProbe === "function"
            ? await runtime.createLanguageProbe("eng")
            : sanitizeFailure("ocr_language_probe_unavailable");
        postResult(
          event.source,
          event.origin,
          message.requestId,
          language?.ok ? { ok: true, status: "protected_site_ocr_broker_ready", language: "eng" } : sanitizeFailure(language?.reason || language?.status)
        );
        return;
      }

      const payload = message.payload || {};
      if (payload.language && payload.language !== "eng") {
        postResult(event.source, event.origin, message.requestId, sanitizeFailure("unsupported_language"));
        return;
      }

      const result = await runtime.recognizeImageBytes({
        imageBytes: payload.imageBytes,
        mimeType: payload.mimeType || ""
      });
      postResult(event.source, event.origin, message.requestId, result || sanitizeFailure("ocr_failed"));
    } catch (error) {
      postResult(
        event.source,
        event.origin,
        message.requestId,
        sanitizeFailure(error?.message || error?.name || "protected_site_ocr_broker_failed")
      );
    }
  });
})();
