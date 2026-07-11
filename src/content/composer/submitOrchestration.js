(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createSubmitOrchestration(options = {}) {
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
    const clearAllRiskSessionState =
      typeof options.clearAllRiskSessionState === "function" ? options.clearAllRiskSessionState : () => {};
    const clearWhatsAppTextSendPending =
      typeof options.clearWhatsAppTextSendPending === "function" ? options.clearWhatsAppTextSendPending : () => {};
    const collectFailureDetails =
      typeof options.collectFailureDetails === "function" ? options.collectFailureDetails : () => ({});
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const consumeRecentWhatsAppSanitizedImageHandoff =
      typeof options.consumeRecentWhatsAppSanitizedImageHandoff === "function"
        ? options.consumeRecentWhatsAppSanitizedImageHandoff
        : () => {};
    const createWhatsAppVerifiedSendOptions =
      typeof options.createWhatsAppVerifiedSendOptions === "function"
        ? options.createWhatsAppVerifiedSendOptions
        : () => ({});
    const debugReveal = typeof options.debugReveal === "function" ? options.debugReveal : () => {};
    const ensureExactComposerState =
      typeof options.ensureExactComposerState === "function" ? options.ensureExactComposerState : async () => true;
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
    const getWhatsAppBypassSanitizedImageSubmitUntil =
      typeof options.getWhatsAppBypassSanitizedImageSubmitUntil === "function"
        ? options.getWhatsAppBypassSanitizedImageSubmitUntil
        : () => 0;
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
    const markWhatsAppTextSendPending =
      typeof options.markWhatsAppTextSendPending === "function" ? options.markWhatsAppTextSendPending : () => true;
    const now = typeof options.now === "function" ? options.now : () => Date.now();
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
    const setWhatsAppBypassSanitizedImageSubmitUntil =
      typeof options.setWhatsAppBypassSanitizedImageSubmitUntil === "function"
        ? options.setWhatsAppBypassSanitizedImageSubmitUntil
        : () => {};
    const shouldBypassWhatsAppSanitizedImageSend =
      typeof options.shouldBypassWhatsAppSanitizedImageSend === "function"
        ? options.shouldBypassWhatsAppSanitizedImageSend
        : () => false;
    const shouldForceDestinationRedaction =
      typeof options.shouldForceDestinationRedaction === "function"
        ? options.shouldForceDestinationRedaction
        : () => false;
    const shouldOwnWhatsAppTextSend =
      typeof options.shouldOwnWhatsAppTextSend === "function" ? options.shouldOwnWhatsAppTextSend : () => false;
    const showRewriteFailure =
      typeof options.showRewriteFailure === "function" ? options.showRewriteFailure : async () => {};
    const summarizeDebugText =
      typeof options.summarizeDebugText === "function" ? options.summarizeDebugText : (text) => ({ length: String(text || "").length });

    async function maybeHandleSubmit(event) {
      if (!isExtensionRuntimeAvailable()) {
        return;
      }

      const bypassUntil = getWhatsAppBypassSanitizedImageSubmitUntil();
      if (isWhatsAppHost() && bypassUntil > now()) {
        return;
      }
      if (bypassUntil && bypassUntil <= now()) {
        setWhatsAppBypassSanitizedImageSubmitUntil(0);
      }

      if (isModalOpen()) {
        consumeInterceptionEvent(event);
        return;
      }

      if (options.consumeBypassNextSubmit?.()) {
        return;
      }

      const form = event.target?.closest ? event.target.closest("form") : event.target;
      const input =
        form?.querySelector?.("textarea, [contenteditable='true'][role='textbox'], [contenteditable='true']") ||
        findComposer(event.target);

      if (!input) {
        if (isWhatsAppHost()) {
          consumeInterceptionEvent(event);
          await blockWhatsAppTextSend("composer_not_found");
        }
        return;
      }
      const nativeSubmitEvent = event.type === "submit" && !event.leakGuardSendButton;
      const submitter = event.leakGuardSendButton || event.submitter || (nativeSubmitEvent ? findSendButton(input) : null);
      const replayOptions = {
        preferButtonClick: Boolean(event.leakGuardReplayViaClick || event.submitter || nativeSubmitEvent)
      };

      if (typeof options.noteActiveRiskEditor === "function") {
        options.noteActiveRiskEditor(input);
      }

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
        debugReveal("whatsapp:image-send-text-verification-bypassed", {
          reason: "recent_sanitized_image_handoff",
          text: summarizeDebugText(text)
        });
        return;
      }

      const quickAnalysis = analyzeText(text);
      const whatsappOwnsTextSend = shouldOwnWhatsAppTextSend(text);
      if (!analysisNeedsEventOwnership(quickAnalysis) && !whatsappOwnsTextSend) return;

      consumeInterceptionEvent(event);
      if (whatsappOwnsTextSend && !markWhatsAppTextSendPending(input)) return;
      const verifiedSendOptions = createWhatsAppVerifiedSendOptions(input, whatsappOwnsTextSend);

      const analysis = await analyzeTextWithAiAssist(text);
      if (!analysis.findings.length && !analysis.placeholderNormalized && !whatsappOwnsTextSend) return;

      if (analysisHasOnlySanitizedPlaceholderFindings(analysis)) {
        const normalized = await applyNormalizedComposerRewrite(input, text, "submit");
        if (!normalized.ok) {
          clearWhatsAppTextSendPending(input);
          return;
        }

        queueVerifiedComposerSend(input, normalized.text, "submit",
          () => replayVerifiedSend(input, form, submitter, replayOptions),
          verifiedSendOptions);
        return;
      }

      const policy = analysis.findings.length ? await getPolicyForAction() : getActivePolicy();
      const destinationPolicy = analysis.findings.length
        ? await handleDestinationPolicy(analysis.findings, policy)
        : getDestinationPolicyDecision(policy);
      if (analysis.findings.length && destinationPolicy.blocked) {
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
          clearWhatsAppTextSendPending(input);
          return;
        }

        setBadge("Content redacted");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();

        queueVerifiedComposerSend(input, result.redactedText, "submit",
          () => replayVerifiedSend(input, form, submitter, replayOptions),
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
          clearWhatsAppTextSendPending(input);
          return;
        }

        setBadge("Destination policy required redaction");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();

        queueVerifiedComposerSend(input, result.redactedText, "submit",
          () => replayVerifiedSend(input, form, submitter, replayOptions),
          verifiedSendOptions);
        return;
      }

      if (
        analysis.findings.length &&
        !whatsappOwnsTextSend &&
        isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)
      ) {
        clearAllRiskSessionState();
        replayVerifiedSend(input, form, submitter, replayOptions);
        return;
      }

      if (!analysis.findings.length) {
        const normalized = await applyNormalizedComposerRewrite(input, text, "submit");
        if (!normalized.ok) {
          clearWhatsAppTextSendPending(input);
          return;
        }

        if (!(await ensureExactComposerState(input, normalized.text))) {
          await showRewriteFailure(
            "submit",
            collectFailureDetails(input, normalized.text, getInputText(input), "submit")
          );
          refreshBadgeFromCurrentInput();
          clearWhatsAppTextSendPending(input);
          return;
        }

        queueVerifiedComposerSend(input, normalized.text, "submit",
          () => replayVerifiedSend(input, form, submitter, replayOptions),
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
        clearWhatsAppTextSendPending(input);
        return;
      }

      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();

      queueVerifiedComposerSend(input, result.redactedText, "submit",
        () => replayVerifiedSend(input, form, submitter, replayOptions),
        verifiedSendOptions);
    }

    return Object.freeze({
      maybeHandleSubmit
    });
  }

  root.PWM.SubmitOrchestration = Object.freeze({
    createSubmitOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.SubmitOrchestration;
  }
})();
