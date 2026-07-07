(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createSendButtonClickOrchestration(options = {}) {
    const analysisNeedsEventOwnership =
      typeof options.analysisNeedsEventOwnership === "function" ? options.analysisNeedsEventOwnership : () => false;
    const analyzeText =
      typeof options.analyzeText === "function"
        ? options.analyzeText
        : () => ({ findings: [], placeholderNormalized: false });
    const blockWhatsAppTextSend =
      typeof options.blockWhatsAppTextSend === "function" ? options.blockWhatsAppTextSend : async () => {};
    const consumeBypassNextSendButtonClick =
      typeof options.consumeBypassNextSendButtonClick === "function"
        ? options.consumeBypassNextSendButtonClick
        : () => false;
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const consumeRecentWhatsAppSanitizedImageHandoff =
      typeof options.consumeRecentWhatsAppSanitizedImageHandoff === "function"
        ? options.consumeRecentWhatsAppSanitizedImageHandoff
        : () => {};
    const createSyntheticSubmitInterceptionEvent =
      typeof options.createSyntheticSubmitInterceptionEvent === "function"
        ? options.createSyntheticSubmitInterceptionEvent
        : (target, submitOptions) => ({
            target,
            leakGuardSendButton: submitOptions.sendButton || null,
            leakGuardReplayViaClick: Boolean(submitOptions.replayViaClick)
          });
    const debugReveal = typeof options.debugReveal === "function" ? options.debugReveal : () => {};
    const findComposer = typeof options.findComposer === "function" ? options.findComposer : () => null;
    const findSendButtonClickTarget =
      typeof options.findSendButtonClickTarget === "function" ? options.findSendButtonClickTarget : () => null;
    const getInputText = typeof options.getInputText === "function" ? options.getInputText : () => "";
    const isExtensionRuntimeAvailable =
      typeof options.isExtensionRuntimeAvailable === "function"
        ? options.isExtensionRuntimeAvailable
        : () => options.extensionRuntimeAvailable === true;
    const isModalOpen =
      typeof options.isModalOpen === "function" ? options.isModalOpen : () => options.modalOpen === true;
    const isWhatsAppHost = typeof options.isWhatsAppHost === "function" ? options.isWhatsAppHost : () => false;
    const maybeHandleSubmit =
      typeof options.maybeHandleSubmit === "function" ? options.maybeHandleSubmit : async () => {};
    const normalizeTarget = typeof options.normalizeTarget === "function" ? options.normalizeTarget : (target) => target;
    const noteActiveRiskEditor =
      typeof options.noteActiveRiskEditor === "function" ? options.noteActiveRiskEditor : () => {};
    const now = typeof options.now === "function" ? options.now : () => Date.now();
    const setWhatsAppBypassSanitizedImageSubmitUntil =
      typeof options.setWhatsAppBypassSanitizedImageSubmitUntil === "function"
        ? options.setWhatsAppBypassSanitizedImageSubmitUntil
        : () => {};
    const shouldBypassWhatsAppSanitizedImageSend =
      typeof options.shouldBypassWhatsAppSanitizedImageSend === "function"
        ? options.shouldBypassWhatsAppSanitizedImageSend
        : () => false;
    const shouldOwnWhatsAppTextSend =
      typeof options.shouldOwnWhatsAppTextSend === "function" ? options.shouldOwnWhatsAppTextSend : () => false;
    const summarizeDebugText =
      typeof options.summarizeDebugText === "function"
        ? options.summarizeDebugText
        : (text) => ({ length: String(text || "").length });

    async function maybeHandleSendButtonClick(event) {
      if (!isExtensionRuntimeAvailable()) {
        return;
      }

      const clickTarget = normalizeTarget(event.target);
      if (clickTarget?.closest?.(".pwm-modal-backdrop")) {
        return;
      }

      if (isModalOpen()) {
        consumeInterceptionEvent(event);
        return;
      }

      if (consumeBypassNextSendButtonClick()) {
        return;
      }

      const button = findSendButtonClickTarget(event);
      if (!button) return;

      const input = findComposer(button);
      if (!input) {
        if (isWhatsAppHost()) {
          consumeInterceptionEvent(event);
          await blockWhatsAppTextSend("composer_not_found");
        }
        return;
      }
      noteActiveRiskEditor(input);

      const extractedText = getInputText(input);
      if (extractedText == null) {
        if (isWhatsAppHost()) {
          consumeInterceptionEvent(event);
          await blockWhatsAppTextSend("text_extraction_failed");
        }
        return;
      }

      const text = String(extractedText);
      if (!text.trim()) {
        return;
      }
      if (shouldBypassWhatsAppSanitizedImageSend(input, text)) {
        consumeRecentWhatsAppSanitizedImageHandoff(input);
        setWhatsAppBypassSanitizedImageSubmitUntil(now() + 1000);
        debugReveal("whatsapp:image-send-click-verification-bypassed", {
          reason: "recent_sanitized_image_handoff",
          text: summarizeDebugText(text)
        });
        return;
      }

      const quickAnalysis = analyzeText(text);
      if (!analysisNeedsEventOwnership(quickAnalysis) && !shouldOwnWhatsAppTextSend(text)) return;

      consumeInterceptionEvent(event);
      const form = button.closest?.("form") || input.closest?.("form") || null;
      await maybeHandleSubmit(createSyntheticSubmitInterceptionEvent(form || input, {
        sendButton: button,
        replayViaClick: true
      }));
    }

    return Object.freeze({
      maybeHandleSendButtonClick
    });
  }

  root.PWM.SendButtonClickOrchestration = Object.freeze({
    createSendButtonClickOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.SendButtonClickOrchestration;
  }
})();
