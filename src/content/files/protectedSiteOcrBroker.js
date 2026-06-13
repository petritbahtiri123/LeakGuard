(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const REQUEST_SOURCE = "LeakGuardProtectedSiteOcr";
  const RESPONSE_SOURCE = "LeakGuardProtectedSiteOcrBroker";
  const BROKER_PATH = "content/protected_site_ocr_broker.html";
  const DEFAULT_TIMEOUT_MS = 45000;

  let iframe = null;
  let iframeReady = null;
  let requestCounter = 0;
  let brokerChannelId = "";
  const pending = new Map();

  function getRuntimeUrl(path) {
    const runtime = root.chrome?.runtime || root.browser?.runtime || null;
    return runtime && typeof runtime.getURL === "function" ? runtime.getURL(path) : path;
  }

  function ensureBrokerFrame() {
    if (iframe?.contentWindow && iframeReady) return { frame: iframe, ready: iframeReady };
    if (!root.document?.documentElement) return null;

    brokerChannelId =
      root.crypto && typeof root.crypto.randomUUID === "function"
        ? root.crypto.randomUUID()
        : `ocr-channel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    iframe = root.document.createElement("iframe");
    iframeReady = new Promise((resolve, reject) => {
      const timeoutId = root.setTimeout(() => reject(new Error("protected_site_ocr_broker_load_timeout")), 5000);
      iframe.addEventListener(
        "load",
        () => {
          root.clearTimeout(timeoutId);
          resolve();
        },
        { once: true }
      );
    });
    iframe.src = getRuntimeUrl(BROKER_PATH);
    iframe.hidden = true;
    iframe.tabIndex = -1;
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "display:none!important;width:0;height:0;border:0;";
    root.document.documentElement.appendChild(iframe);
    return { frame: iframe, ready: iframeReady };
  }

  function toTransferableArrayBuffer(bytes) {
    if (bytes instanceof ArrayBuffer) return bytes.slice(0);
    if (ArrayBuffer.isView(bytes)) {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    return null;
  }

  function settle(requestId, result, isError = false) {
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);
    root.clearTimeout(entry.timeoutId);
    if (entry.port) {
      entry.port.onmessage = null;
      if (typeof entry.port.close === "function") entry.port.close();
    }
    if (isError) {
      entry.reject(new Error(result?.reason || "protected_site_ocr_broker_failed"));
    } else {
      entry.resolve(result);
    }
  }

  function failureResult(reason) {
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

  function sendBrokerRequest(messagePayload = {}, options = {}) {
    const broker = ensureBrokerFrame();
    const imageBytes = messagePayload.payload?.imageBytes || null;
    if (!broker?.frame?.contentWindow || (messagePayload.payload && !imageBytes)) {
      return Promise.resolve({
        ok: false,
        status: "ocr_recognition_blocked",
        language: "eng",
        textLength: 0,
        confidenceBucket: "unknown",
        warnings: ["protected_site_ocr_broker_unavailable"],
        reason: "protected_site_ocr_broker_unavailable"
      });
    }
    if (typeof root.MessageChannel !== "function") {
      return Promise.resolve(failureResult("protected_site_ocr_broker_unavailable"));
    }

    const requestId = `ocr-${Date.now()}-${++requestCounter}`;
    return new Promise((resolve, reject) => {
      const channel = new root.MessageChannel();
      const timeoutId = root.setTimeout(() => {
        settle(requestId, failureResult("protected_site_ocr_broker_timeout"));
      }, Math.max(1, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)));

      channel.port1.onmessage = (event) => {
        const message = event.data || {};
        if (message.source !== RESPONSE_SOURCE || message.requestId !== requestId) return;
        if (message.ok) {
          settle(requestId, message.result || {});
        } else {
          settle(requestId, failureResult(message.reason || "protected_site_ocr_broker_failed"));
        }
      };
      pending.set(requestId, { resolve, reject, timeoutId, port: channel.port1 });
      broker.ready
        .then(() => {
          const transfers = [channel.port2];
          if (imageBytes) transfers.push(imageBytes);
          broker.frame.contentWindow.postMessage(
            {
              source: REQUEST_SOURCE,
              channelId: brokerChannelId,
              requestId,
              ...messagePayload
            },
            "*",
            transfers
          );
        })
        .catch((error) => {
          settle(requestId, failureResult(error?.message || "protected_site_ocr_broker_load_failed"));
        });
    });
  }

  function prepare(payload = {}) {
    const timeoutMs = Number(payload.timeoutMs || 0);
    const message = { prepare: true };
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      message.timeoutMs = timeoutMs;
    }
    return sendBrokerRequest(message, payload);
  }

  function recognizeImageBytes(payload = {}) {
    return sendBrokerRequest(
      {
        payload: {
          imageBytes: toTransferableArrayBuffer(payload.imageBytes),
          mimeType: payload.mimeType || "",
          language: "eng"
        }
      },
      payload
    );
  }

  function terminate() {
    for (const requestId of Array.from(pending.keys())) {
      settle(requestId, failureResult("protected_site_ocr_broker_terminated"));
    }
    if (iframe?.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
    iframe = null;
    iframeReady = null;
  }

  root.PWM.ProtectedSiteOcrBroker = {
    prepare,
    recognizeImageBytes,
    terminate
  };
})();
