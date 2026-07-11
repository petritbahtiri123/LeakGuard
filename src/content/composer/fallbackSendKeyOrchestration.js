(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFallbackSendKeyOrchestration(options = {}) {
    const analysisHasOnlySanitizedPlaceholderFindings =
      typeof options.analysisHasOnlySanitizedPlaceholderFindings === "function"
        ? options.analysisHasOnlySanitizedPlaceholderFindings
        : () => false;
    const analysisNeedsEventOwnership =
      typeof options.analysisNeedsEventOwnership === "function" ? options.analysisNeedsEventOwnership : () => false;
    const analyzeText =
      typeof options.analyzeText === "function"
        ? options.analyzeText
        : (text) => ({ normalizedText: text, secretFindings: [], findings: [], placeholderNormalized: false });
    const analyzeTextWithAiAssist =
      typeof options.analyzeTextWithAiAssist === "function"
        ? options.analyzeTextWithAiAssist
        : async (text) => ({ normalizedText: text, secretFindings: [], findings: [], placeholderNormalized: false });
    const applyNormalizedComposerRewrite =
      typeof options.applyNormalizedComposerRewrite === "function"
        ? options.applyNormalizedComposerRewrite
        : async (_input, text) => ({ ok: true, text });
    const applySubmitRedactionTransactionally =
      typeof options.applySubmitRedactionTransactionally === "function"
        ? options.applySubmitRedactionTransactionally
        : async () => false;
    const blockWhatsAppTextSend =
      typeof options.blockWhatsAppTextSend === "function" ? options.blockWhatsAppTextSend : async () => {};
    const clearFallbackSendKeyRedactionPending =
      typeof options.clearFallbackSendKeyRedactionPending === "function"
        ? options.clearFallbackSendKeyRedactionPending
        : () => {};
    const clearWhatsAppTextSendPending =
      typeof options.clearWhatsAppTextSendPending === "function" ? options.clearWhatsAppTextSendPending : () => {};
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const createWhatsAppVerifiedSendOptions =
      typeof options.createWhatsAppVerifiedSendOptions === "function"
        ? options.createWhatsAppVerifiedSendOptions
        : () => ({});
    const findComposer = typeof options.findComposer === "function" ? options.findComposer : () => null;
    const findSendButton = typeof options.findSendButton === "function" ? options.findSendButton : () => null;
    const getActivePolicy = typeof options.getActivePolicy === "function" ? options.getActivePolicy : () => ({});
    const getDestinationPolicyDecision =
      typeof options.getDestinationPolicyDecision === "function"
        ? options.getDestinationPolicyDecision
        : () => ({ blocked: false });
    const getInputText = typeof options.getInputText === "function" ? options.getInputText : () => "";
    const getPolicyForAction =
      typeof options.getPolicyForAction === "function" ? options.getPolicyForAction : async () => ({});
    const handleDestinationPolicy =
      typeof options.handleDestinationPolicy === "function"
        ? options.handleDestinationPolicy
        : async () => ({ blocked: false });
    const handleHttpSecretPolicy =
      typeof options.handleHttpSecretPolicy === "function" ? options.handleHttpSecretPolicy : async () => false;
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const isExtensionRuntimeAvailable =
      typeof options.isExtensionRuntimeAvailable === "function"
        ? options.isExtensionRuntimeAvailable
        : () => options.extensionRuntimeAvailable === true;
    const isModalOpen =
      typeof options.isModalOpen === "function" ? options.isModalOpen : () => options.modalOpen === true;
    const isProtectionPauseActiveAfterPolicy =
      typeof options.isProtectionPauseActiveAfterPolicy === "function"
        ? options.isProtectionPauseActiveAfterPolicy
        : () => false;
    const isWhatsAppHost = typeof options.isWhatsAppHost === "function" ? options.isWhatsAppHost : () => false;
    const markFallbackSendKeyRedactionPending =
      typeof options.markFallbackSendKeyRedactionPending === "function"
        ? options.markFallbackSendKeyRedactionPending
        : () => {};
    const markWhatsAppTextSendPending =
      typeof options.markWhatsAppTextSendPending === "function" ? options.markWhatsAppTextSendPending : () => true;
    const noteActiveRiskEditor =
      typeof options.noteActiveRiskEditor === "function" ? options.noteActiveRiskEditor : () => {};
    const promptForSensitiveContentDecision =
      typeof options.promptForSensitiveContentDecision === "function"
        ? options.promptForSensitiveContentDecision
        : async () => "cancel";
    const queueVerifiedComposerSend =
      typeof options.queueVerifiedComposerSend === "function" ? options.queueVerifiedComposerSend : () => {};
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const replayVerifiedSend =
      typeof options.replayVerifiedSend === "function" ? options.replayVerifiedSend : () => false;
    const requestRedaction =
      typeof options.requestRedaction === "function"
        ? options.requestRedaction
        : async (text) => ({ redactedText: text });
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const shouldForceDestinationRedaction =
      typeof options.shouldForceDestinationRedaction === "function"
        ? options.shouldForceDestinationRedaction
        : () => false;
    const shouldOwnWhatsAppTextSend =
      typeof options.shouldOwnWhatsAppTextSend === "function" ? options.shouldOwnWhatsAppTextSend : () => false;

    function replayFallbackSend(input) {
      const button = findSendButton(input);
      if (!button && isWhatsAppHost()) {
        void blockWhatsAppTextSend("replay_button_not_found");
        return false;
      }
      return replayVerifiedSend(input, null, button);
    }

    async function maybeHandleFallbackSendKey(event) {
      if (
        !isExtensionRuntimeAvailable() ||
        isModalOpen() ||
        event.defaultPrevented ||
        event.key !== "Enter" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing
      ) {
        return;
      }

      const input = findComposer(event.target);
      if (!input) return;
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
      if (!text.trim()) return;

      const quickAnalysis = analyzeText(text);
      const whatsappOwnsTextSend = shouldOwnWhatsAppTextSend(text);
      if (!analysisNeedsEventOwnership(quickAnalysis) && !whatsappOwnsTextSend) return;

      consumeInterceptionEvent(event);
      if (whatsappOwnsTextSend && !markWhatsAppTextSendPending(input)) return;
      const verifiedSendOptions = createWhatsAppVerifiedSendOptions(input, whatsappOwnsTextSend);
      markFallbackSendKeyRedactionPending(input);

      const analysis = await analyzeTextWithAiAssist(text);
      if (!analysis.findings.length && !analysis.placeholderNormalized && !whatsappOwnsTextSend) {
        clearFallbackSendKeyRedactionPending(input);
        return;
      }

      if (analysisHasOnlySanitizedPlaceholderFindings(analysis)) {
        const normalized = await applyNormalizedComposerRewrite(input, text, "submit");
        if (!normalized.ok) {
          clearFallbackSendKeyRedactionPending(input);
          clearWhatsAppTextSendPending(input);
          return;
        }

        queueVerifiedComposerSend(input, normalized.text, "submit",
          () => replayFallbackSend(input),
          verifiedSendOptions);
        return;
      }

      const policy = analysis.findings.length ? await getPolicyForAction() : getActivePolicy();
      const destinationPolicy = analysis.findings.length
        ? await handleDestinationPolicy(analysis.findings, policy)
        : getDestinationPolicyDecision(policy);
      if (analysis.findings.length && destinationPolicy.blocked) {
        clearFallbackSendKeyRedactionPending(input);
        clearWhatsAppTextSendPending(input);
        return;
      }
      const destinationForceRedact = shouldForceDestinationRedaction(destinationPolicy, analysis.findings);

      const httpPolicyHandled = await handleHttpSecretPolicy(policy, analysis.secretFindings, async () => {
        const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
        const rewritten = await applySubmitRedactionTransactionally(
          input,
          analysis.normalizedText,
          result.redactedText,
          "submit",
          analysis.secretFindings
        );
        if (!rewritten) {
          clearFallbackSendKeyRedactionPending(input);
          clearWhatsAppTextSendPending(input);
          return;
        }

        setBadge("Content redacted");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();

        queueVerifiedComposerSend(input, result.redactedText, "submit",
          () => replayFallbackSend(input),
          verifiedSendOptions);
      });

      if (httpPolicyHandled) {
        return;
      }

      if (destinationForceRedact) {
        const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
          auditReason: destinationPolicy.reason
        });
        const rewritten = await applySubmitRedactionTransactionally(
          input,
          analysis.normalizedText,
          result.redactedText,
          "submit",
          analysis.secretFindings
        );
        if (!rewritten) {
          clearFallbackSendKeyRedactionPending(input);
          clearWhatsAppTextSendPending(input);
          return;
        }

        setBadge("Destination policy required redaction");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();

        queueVerifiedComposerSend(input, result.redactedText, "submit",
          () => replayFallbackSend(input),
          verifiedSendOptions);
        return;
      }

      if (
        analysis.findings.length &&
        !whatsappOwnsTextSend &&
        isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)
      ) {
        const button = findSendButton(input);
        clearFallbackSendKeyRedactionPending(input);
        replayVerifiedSend(input, null, button);
        return;
      }

      if (!analysis.findings.length) {
        const normalized = await applyNormalizedComposerRewrite(input, text, "submit");
        if (!normalized.ok) {
          clearFallbackSendKeyRedactionPending(input);
          clearWhatsAppTextSendPending(input);
          return;
        }

        queueVerifiedComposerSend(input, normalized.text, "submit",
          () => replayFallbackSend(input),
          verifiedSendOptions);
        return;
      }

      const decisionAction = await promptForSensitiveContentDecision(
        analysis.findings,
        "submit",
        policy,
        input,
        analysis.normalizedText
      );
      if (decisionAction === "cancel") {
        clearFallbackSendKeyRedactionPending(input);
        clearWhatsAppTextSendPending(input);
        return;
      }

      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);

      const rewritten = await applySubmitRedactionTransactionally(
        input,
        analysis.normalizedText,
        result.redactedText,
        "submit",
        analysis.secretFindings
      );
      if (!rewritten) {
        clearFallbackSendKeyRedactionPending(input);
        clearWhatsAppTextSendPending(input);
        return;
      }

      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();

      queueVerifiedComposerSend(input, result.redactedText, "submit",
        () => replayFallbackSend(input),
        verifiedSendOptions);
    }

    return Object.freeze({
      maybeHandleFallbackSendKey
    });
  }

  root.PWM.FallbackSendKeyOrchestration = Object.freeze({
    createFallbackSendKeyOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FallbackSendKeyOrchestration;
  }
})();
