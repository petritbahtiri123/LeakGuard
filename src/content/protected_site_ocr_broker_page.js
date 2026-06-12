(function () {
  const REQUEST_SOURCE = "LeakGuardProtectedSiteOcr";
  const RESPONSE_SOURCE = "LeakGuardProtectedSiteOcrBroker";
  const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

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

  function normalizeMimeType(mimeType) {
    return String(mimeType || "").split(";")[0].trim().toLowerCase();
  }

  function isArrayBuffer(value) {
    return value instanceof ArrayBuffer;
  }

  function hasOnlyKeys(value, allowedKeys) {
    const allowed = new Set(allowedKeys);
    return Object.keys(value || {}).every((key) => allowed.has(key));
  }

  function isValidRequestMessage(message, ports) {
    if (!message || typeof message !== "object" || Array.isArray(message)) return false;
    if (message.source !== REQUEST_SOURCE) return false;
    if (typeof message.requestId !== "string" || !message.requestId) return false;
    if (typeof message.channelId !== "string" || !message.channelId) return false;
    if (!Array.isArray(ports) || ports.length !== 1 || typeof ports[0]?.postMessage !== "function") return false;

    if (message.prepare === true) {
      if (!hasOnlyKeys(message, ["source", "channelId", "requestId", "prepare", "timeoutMs"])) return false;
      if (message.timeoutMs === undefined) return true;
      return Number.isFinite(Number(message.timeoutMs)) && Number(message.timeoutMs) > 0;
    }

    if (!hasOnlyKeys(message, ["source", "channelId", "requestId", "payload"])) return false;
    const payload = message.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    if (!hasOnlyKeys(payload, ["imageBytes", "mimeType", "language"])) return false;
    if (payload.language !== "eng") return false;
    if (!isArrayBuffer(payload.imageBytes)) return false;
    return allowedMimeTypes.has(normalizeMimeType(payload.mimeType));
  }

  function postResult(port, requestId, result) {
    port?.postMessage(
      {
        source: RESPONSE_SOURCE,
        requestId,
        ok: true,
        result
      }
    );
  }

  window.addEventListener("message", async (event) => {
    const message = event.data || {};
    const replyPort = event.ports?.[0] || null;
    if (event.source !== window.parent || !isValidRequestMessage(message, event.ports || [])) return;

    try {
      const runtime = window.PWM?.OcrRuntime || null;
      if (!runtime || typeof runtime.recognizeImageBytes !== "function") {
        postResult(replyPort, message.requestId, sanitizeFailure("ocr_runtime_unavailable"));
        return;
      }

      if (message.prepare === true) {
        postResult(replyPort, message.requestId, {
          ok: true,
          status: "protected_site_ocr_broker_ready",
          language: "eng"
        });
        return;
      }

      const payload = message.payload || {};
      const result = await runtime.recognizeImageBytes({
        imageBytes: payload.imageBytes,
        mimeType: normalizeMimeType(payload.mimeType)
      });
      postResult(replyPort, message.requestId, result || sanitizeFailure("ocr_failed"));
    } catch (error) {
      postResult(
        replyPort,
        message.requestId,
        sanitizeFailure(error?.message || error?.name || "protected_site_ocr_broker_failed")
      );
    }
  });
})();
