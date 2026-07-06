(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createWhatsAppTextFlow(options = {}) {
    const isWhatsAppHost = typeof options.isWhatsAppHost === "function" ? options.isWhatsAppHost : () => false;
    const isTextPasteInterceptionEvent =
      typeof options.isTextPasteInterceptionEvent === "function"
        ? options.isTextPasteInterceptionEvent
        : () => false;
    const normalizeComposerText =
      typeof options.normalizeComposerText === "function" ? options.normalizeComposerText : (text) => String(text || "");
    const debugReveal = typeof options.debugReveal === "function" ? options.debugReveal : () => {};
    const now = typeof options.now === "function" ? options.now : () => Date.now();
    const duplicateTextPasteSuppressMs = Math.max(0, Number(options.duplicateTextPasteSuppressMs) || 0);

    let recentWhatsAppTextPaste = null;

    function buildTextPasteSignature(text) {
      const normalized = normalizeComposerText(text);
      let hash = 2166136261;
      for (let index = 0; index < normalized.length; index += 1) {
        hash ^= normalized.charCodeAt(index);
        hash = Math.imul(hash, 16777619) >>> 0;
      }
      return `${normalized.length}:${(normalized.match(/\n/g) || []).length}:${hash.toString(36)}`;
    }

    function rememberWhatsAppTextPaste(input, pasted, event) {
      if (!isWhatsAppHost() || !isTextPasteInterceptionEvent(event) || !pasted) return;
      recentWhatsAppTextPaste = {
        input,
        signature: buildTextPasteSignature(pasted),
        eventType: String(event?.type || ""),
        inputType: String(event?.inputType || ""),
        expiresAt: now() + duplicateTextPasteSuppressMs
      };
    }

    function shouldSuppressDuplicateWhatsAppTextPaste(input, pasted, event) {
      if (!isWhatsAppHost() || !isTextPasteInterceptionEvent(event) || !pasted) return false;

      const recent = recentWhatsAppTextPaste;
      if (!recent) return false;
      if (now() > recent.expiresAt) {
        recentWhatsAppTextPaste = null;
        return false;
      }

      const currentEventType = String(event?.type || "");
      const currentInputType = String(event?.inputType || "");
      const isPairedBrowserPasteEvent =
        recent.eventType !== currentEventType || recent.inputType !== currentInputType;
      const duplicate =
        isPairedBrowserPasteEvent &&
        recent.input === input &&
        recent.signature === buildTextPasteSignature(pasted);

      if (duplicate) {
        recentWhatsAppTextPaste = null;
        debugReveal("whatsapp:text-paste-duplicate-event-suppressed", {
          previousEventType: recent.eventType,
          currentEventType,
          previousInputType: recent.inputType,
          currentInputType,
          length: normalizeComposerText(pasted).length
        });
      }

      return duplicate;
    }

    return Object.freeze({
      buildTextPasteSignature,
      rememberWhatsAppTextPaste,
      shouldSuppressDuplicateWhatsAppTextPaste
    });
  }

  root.PWM.WhatsAppTextFlow = Object.freeze({
    createWhatsAppTextFlow
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.WhatsAppTextFlow;
  }
})();
