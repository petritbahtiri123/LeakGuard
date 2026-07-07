(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createPasteOrchestration(options = {}) {
    const analyzeText =
      typeof options.analyzeText === "function"
        ? options.analyzeText
        : (text) => ({ normalizedText: text, secretFindings: [], findings: [], placeholderNormalized: false });
    const analyzeTextWithAiAssist =
      typeof options.analyzeTextWithAiAssist === "function"
        ? options.analyzeTextWithAiAssist
        : async (text) => ({ normalizedText: text, secretFindings: [], findings: [], placeholderNormalized: false });
    const applyPasteDecision =
      typeof options.applyPasteDecision === "function" ? options.applyPasteDecision : async () => false;
    const blockWhatsAppFileAttachment =
      typeof options.blockWhatsAppFileAttachment === "function" ? options.blockWhatsAppFileAttachment : async () => {};
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const dataTransferHasFiles =
      typeof options.dataTransferHasFiles === "function" ? options.dataTransferHasFiles : () => false;
    const findComposer = typeof options.findComposer === "function" ? options.findComposer : () => null;
    const getInputText = typeof options.getInputText === "function" ? options.getInputText : () => "";
    const getPasteTransfer = typeof options.getPasteTransfer === "function" ? options.getPasteTransfer : () => null;
    const getPastedPlainText =
      typeof options.getPastedPlainText === "function" ? options.getPastedPlainText : () => "";
    const getPolicyForAction =
      typeof options.getPolicyForAction === "function" ? options.getPolicyForAction : async () => ({});
    const getSelectionOffsets =
      typeof options.getSelectionOffsets === "function" ? options.getSelectionOffsets : () => ({ start: 0, end: 0 });
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
    const isGeminiHost = typeof options.isGeminiHost === "function" ? options.isGeminiHost : () => false;
    const isModalOpen =
      typeof options.isModalOpen === "function" ? options.isModalOpen : () => options.modalOpen === true;
    const isProtectionPauseActiveAfterPolicy =
      typeof options.isProtectionPauseActiveAfterPolicy === "function"
        ? options.isProtectionPauseActiveAfterPolicy
        : () => false;
    const isSanitizedFileHandoffEvent =
      typeof options.isSanitizedFileHandoffEvent === "function" ? options.isSanitizedFileHandoffEvent : () => false;
    const isSanitizedTextRewriteEvent =
      typeof options.isSanitizedTextRewriteEvent === "function" ? options.isSanitizedTextRewriteEvent : () => false;
    const isSupportedWhatsAppClipboardImagePaste =
      typeof options.isSupportedWhatsAppClipboardImagePaste === "function"
        ? options.isSupportedWhatsAppClipboardImagePaste
        : () => false;
    const isWhatsAppHost = typeof options.isWhatsAppHost === "function" ? options.isWhatsAppHost : () => false;
    const maybeHandleChatGptLargeTextPaste =
      typeof options.maybeHandleChatGptLargeTextPaste === "function"
        ? options.maybeHandleChatGptLargeTextPaste
        : async () => false;
    const maybeHandleGeminiEditorPaste =
      typeof options.maybeHandleGeminiEditorPaste === "function"
        ? options.maybeHandleGeminiEditorPaste
        : async () => false;
    const maybeHandleLocalFileInsert =
      typeof options.maybeHandleLocalFileInsert === "function" ? options.maybeHandleLocalFileInsert : async () => {};
    const normalizeClipboardImageDataTransfer =
      typeof options.normalizeClipboardImageDataTransfer === "function"
        ? options.normalizeClipboardImageDataTransfer
        : (transfer) => transfer;
    const noteActiveRiskEditor =
      typeof options.noteActiveRiskEditor === "function" ? options.noteActiveRiskEditor : () => {};
    const promptForSensitiveContentDecision =
      typeof options.promptForSensitiveContentDecision === "function"
        ? options.promptForSensitiveContentDecision
        : async () => "cancel";
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const rememberWhatsAppTextPaste =
      typeof options.rememberWhatsAppTextPaste === "function" ? options.rememberWhatsAppTextPaste : () => {};
    const requestRedaction =
      typeof options.requestRedaction === "function"
        ? options.requestRedaction
        : async (text) => ({ redactedText: text });
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const shouldForceDestinationRedaction =
      typeof options.shouldForceDestinationRedaction === "function"
        ? options.shouldForceDestinationRedaction
        : () => false;
    const shouldSuppressDuplicateWhatsAppTextPaste =
      typeof options.shouldSuppressDuplicateWhatsAppTextPaste === "function"
        ? options.shouldSuppressDuplicateWhatsAppTextPaste
        : () => false;

    async function maybeHandlePaste(event) {
      if (!isExtensionRuntimeAvailable() || isModalOpen() || event.defaultPrevented) return;
      if (isSanitizedFileHandoffEvent(event)) return;
      if (isSanitizedTextRewriteEvent(event)) return;

      if (isGeminiHost() && await maybeHandleGeminiEditorPaste(event)) {
        return;
      }

      const rawPasteTransfer = getPasteTransfer(event);
      const pasteTransfer = normalizeClipboardImageDataTransfer(rawPasteTransfer);
      const hasPasteFiles = dataTransferHasFiles(pasteTransfer);
      const supportedWhatsAppClipboardImagePaste =
        hasPasteFiles && isSupportedWhatsAppClipboardImagePaste(pasteTransfer, "paste");
      if (
        hasPasteFiles &&
        isWhatsAppHost() &&
        !supportedWhatsAppClipboardImagePaste
      ) {
        await blockWhatsAppFileAttachment(event);
        return;
      }
      if (supportedWhatsAppClipboardImagePaste) {
        consumeInterceptionEvent(event);
      }

      const input = findComposer(event.target);
      if (!input) {
        if (hasPasteFiles && isWhatsAppHost()) {
          await blockWhatsAppFileAttachment(event);
        }
        return;
      }
      noteActiveRiskEditor(input);

      if (hasPasteFiles) {
        await maybeHandleLocalFileInsert(event, input, pasteTransfer, "paste");
        return;
      }

      const pasted = getPastedPlainText(event);

      if (!pasted) return;
      if (shouldSuppressDuplicateWhatsAppTextPaste(input, pasted, event)) {
        consumeInterceptionEvent(event);
        return;
      }

      const quickAnalysis = analyzeText(pasted);
      if (!quickAnalysis.findings.length && !quickAnalysis.placeholderNormalized) return;
      rememberWhatsAppTextPaste(input, pasted, event);
      consumeInterceptionEvent(event);

      if (await maybeHandleChatGptLargeTextPaste(event, input, pasted, quickAnalysis)) {
        return;
      }

      const originalText = getInputText(input);
      const selection = getSelectionOffsets(input);

      const analysis = await analyzeTextWithAiAssist(pasted);

      if (!analysis.findings.length) {
        const ok = await applyPasteDecision(
          input,
          originalText,
          selection,
          analysis.normalizedText,
          "paste",
          { rawInsertedText: pasted }
        );

        if (!ok) return;

        setBadge("Placeholders normalized");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      const policy = await getPolicyForAction();
      const destinationPolicy = await handleDestinationPolicy(analysis.findings, policy);
      if (destinationPolicy.blocked) {
        return;
      }
      const destinationForceRedact = shouldForceDestinationRedaction(destinationPolicy, analysis.findings);

      const httpPolicyHandled = await handleHttpSecretPolicy(policy, analysis.secretFindings, async () => {
        const latestInput = findComposer(input);
        if (!latestInput) return;

        const latestText = getInputText(latestInput);
        const baseText = latestText === originalText ? latestText : originalText;
        const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
        const ok = await applyPasteDecision(
          latestInput,
          baseText,
          selection,
          result.redactedText,
          "paste",
          { rawInsertedText: pasted }
        );

        if (!ok) {
          return;
        }

        setBadge("Content redacted");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
      });

      if (httpPolicyHandled) {
        return;
      }

      if (destinationForceRedact) {
        const latestInput = findComposer(input);
        if (!latestInput) return;

        const latestText = getInputText(latestInput);
        const baseText = latestText === originalText ? latestText : originalText;
        const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
          auditReason: destinationPolicy.reason
        });

        const ok = await applyPasteDecision(
          latestInput,
          baseText,
          selection,
          result.redactedText,
          "paste",
          { rawInsertedText: pasted }
        );

        if (!ok) return;

        setBadge("Destination policy required redaction");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      if (isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
        const latestInput = findComposer(input);
        if (!latestInput) return;

        const latestText = getInputText(latestInput);
        const baseText = latestText === originalText ? latestText : originalText;
        const ok = await applyPasteDecision(
          latestInput,
          baseText,
          selection,
          analysis.normalizedText,
          "paste",
          { rawInsertedText: pasted }
        );
        if (!ok) return;

        setBadge("Protection paused");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      const decisionAction = await promptForSensitiveContentDecision(
        analysis.findings,
        "paste",
        policy,
        input,
        analysis.normalizedText
      );
      if (decisionAction === "cancel") return;

      const latestInput = findComposer(input);
      if (!latestInput) return;

      const latestText = getInputText(latestInput);
      const baseText = latestText === originalText ? latestText : originalText;

      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);

      const ok = await applyPasteDecision(
        latestInput,
        baseText,
        selection,
        result.redactedText,
        "paste",
        { rawInsertedText: pasted }
      );

      if (!ok) return;

      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
    }

    return Object.freeze({
      maybeHandlePaste
    });
  }

  root.PWM.PasteOrchestration = Object.freeze({
    createPasteOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.PasteOrchestration;
  }
})();
