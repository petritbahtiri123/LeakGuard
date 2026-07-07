(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createBeforeInputOrchestration(options = {}) {
    const analyzeText =
      typeof options.analyzeText === "function"
        ? options.analyzeText
        : (text) => ({ normalizedText: text, secretFindings: [], findings: [], placeholderNormalized: false });
    const analyzeTextWithAiAssist =
      typeof options.analyzeTextWithAiAssist === "function"
        ? options.analyzeTextWithAiAssist
        : async (text) => ({ normalizedText: text, secretFindings: [], findings: [], placeholderNormalized: false });
    const applyTypedInterceptionRewrite =
      typeof options.applyTypedInterceptionRewrite === "function"
        ? options.applyTypedInterceptionRewrite
        : async () => false;
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const findComposer = typeof options.findComposer === "function" ? options.findComposer : () => null;
    const getActivePolicy = typeof options.getActivePolicy === "function" ? options.getActivePolicy : () => ({});
    const getBeforeInputData =
      typeof options.getBeforeInputData === "function" ? options.getBeforeInputData : (event) => event?.data || "";
    const getInputText = typeof options.getInputText === "function" ? options.getInputText : () => "";
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
    const isFirefoxRuntime =
      typeof options.isFirefoxRuntime === "function" ? options.isFirefoxRuntime : () => false;
    const isLiveTypedRedactionEnabled =
      typeof options.isLiveTypedRedactionEnabled === "function"
        ? options.isLiveTypedRedactionEnabled
        : () => false;
    const isModalOpen =
      typeof options.isModalOpen === "function" ? options.isModalOpen : () => options.modalOpen === true;
    const isPasteBeforeInput =
      typeof options.isPasteBeforeInput === "function" ? options.isPasteBeforeInput : () => false;
    const isProgrammaticInputScanSuppressed =
      typeof options.isProgrammaticInputScanSuppressed === "function"
        ? options.isProgrammaticInputScanSuppressed
        : () => false;
    const isProtectionPauseActiveAfterPolicy =
      typeof options.isProtectionPauseActiveAfterPolicy === "function"
        ? options.isProtectionPauseActiveAfterPolicy
        : () => false;
    const maybeHandlePaste =
      typeof options.maybeHandlePaste === "function" ? options.maybeHandlePaste : async () => {};
    const normalizeVisiblePlaceholders =
      typeof options.normalizeVisiblePlaceholders === "function" ? options.normalizeVisiblePlaceholders : (text) => text;
    const noteActiveRiskEditor =
      typeof options.noteActiveRiskEditor === "function" ? options.noteActiveRiskEditor : () => {};
    const promptForSensitiveContentDecision =
      typeof options.promptForSensitiveContentDecision === "function"
        ? options.promptForSensitiveContentDecision
        : async () => "cancel";
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const requestRedaction =
      typeof options.requestRedaction === "function"
        ? options.requestRedaction
        : async (text) => ({ redactedText: text });
    const selectFindingsOverlappingInsertion =
      typeof options.selectFindingsOverlappingInsertion === "function"
        ? options.selectFindingsOverlappingInsertion
        : (findings) => findings || [];
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const setLastTypedPromptText =
      typeof options.setLastTypedPromptText === "function" ? options.setLastTypedPromptText : () => {};
    const shouldAutoRedactTypedSecrets =
      typeof options.shouldAutoRedactTypedSecrets === "function"
        ? options.shouldAutoRedactTypedSecrets
        : () => false;
    const shouldForceDestinationRedaction =
      typeof options.shouldForceDestinationRedaction === "function"
        ? options.shouldForceDestinationRedaction
        : () => false;
    const shouldInterceptBeforeInput =
      typeof options.shouldInterceptBeforeInput === "function" ? options.shouldInterceptBeforeInput : () => false;
    const spliceSelectionText =
      typeof options.spliceSelectionText === "function"
        ? options.spliceSelectionText
        : (originalText, selection, insertedText) => ({
            text: `${originalText.slice(0, selection.start)}${insertedText}${originalText.slice(selection.end)}`,
            caretOffset: selection.start + insertedText.length
          });

    async function maybeHandleBeforeInput(event) {
      if (isPasteBeforeInput(event)) {
        await maybeHandlePaste(event);
        return;
      }

      if (event?.isTrusted === false && isProgrammaticInputScanSuppressed()) return;

      if (!isExtensionRuntimeAvailable() || isModalOpen() || !shouldInterceptBeforeInput(event)) return;

      const input = findComposer(event.target);
      if (!input) return;
      noteActiveRiskEditor(input);

      const insertedText = getBeforeInputData(event);
      if (!insertedText) return;

      const originalText = getInputText(input);
      const selection = getSelectionOffsets(input);
      const next = spliceSelectionText(originalText, selection, insertedText);

      if (!isLiveTypedRedactionEnabled(getActivePolicy())) {
        return;
      }

      let firefoxEarlyAnalysis = null;
      let firefoxEarlyRelevantFindings = [];
      let firefoxEarlyPlaceholderNormalizationChanged = false;
      if (isFirefoxRuntime()) {
        firefoxEarlyAnalysis = analyzeText(next.text);
        firefoxEarlyRelevantFindings = selectFindingsOverlappingInsertion(
          firefoxEarlyAnalysis.findings,
          selection,
          insertedText
        );
        firefoxEarlyPlaceholderNormalizationChanged =
          firefoxEarlyAnalysis.placeholderNormalized &&
          firefoxEarlyAnalysis.normalizedText !== next.text &&
          normalizeVisiblePlaceholders(insertedText) !== insertedText;

        if (firefoxEarlyRelevantFindings.length || firefoxEarlyPlaceholderNormalizationChanged) {
          consumeInterceptionEvent(event);
        }
      }
      const quickCurrentAnalysis = analyzeText(originalText);
      const quickNextAnalysis = analyzeText(next.text);
      const quickRelevantFindings = selectFindingsOverlappingInsertion(
        quickNextAnalysis.findings,
        selection,
        insertedText
      );
      const quickPlaceholderNormalizationChanged =
        quickNextAnalysis.placeholderNormalized &&
        quickNextAnalysis.normalizedText !== next.text &&
        (normalizeVisiblePlaceholders(insertedText) !== insertedText ||
          quickNextAnalysis.normalizedText !== quickCurrentAnalysis.normalizedText);

      if (!quickRelevantFindings.length && !quickPlaceholderNormalizationChanged) {
        return;
      }

      if (!event.defaultPrevented) {
        consumeInterceptionEvent(event);
      }

      const currentAnalysis = await analyzeTextWithAiAssist(originalText);
      const nextAnalysis = await analyzeTextWithAiAssist(next.text);
      const relevantFindings = selectFindingsOverlappingInsertion(
        nextAnalysis.findings,
        selection,
        insertedText
      );
      const relevantSecretFindings = selectFindingsOverlappingInsertion(
        nextAnalysis.secretFindings,
        selection,
        insertedText
      );
      const placeholderNormalizationChanged =
        nextAnalysis.placeholderNormalized &&
        nextAnalysis.normalizedText !== next.text &&
        (normalizeVisiblePlaceholders(insertedText) !== insertedText ||
          nextAnalysis.normalizedText !== currentAnalysis.normalizedText);

      if (!relevantFindings.length && !placeholderNormalizationChanged) return;

      const typedShouldAutoRedact = shouldAutoRedactTypedSecrets(
        relevantSecretFindings,
        relevantFindings
      );

      const policy = await getPolicyForAction();
      const destinationPolicy = await handleDestinationPolicy(relevantFindings, policy);
      if (destinationPolicy.blocked) {
        return;
      }
      const destinationForceRedact = shouldForceDestinationRedaction(
        destinationPolicy,
        relevantFindings
      );

      const httpPolicyHandled = await handleHttpSecretPolicy(policy, relevantSecretFindings, async () => {
        const result = await requestRedaction(nextAnalysis.normalizedText, relevantSecretFindings);
        const ok = await applyTypedInterceptionRewrite(
          input,
          result.redactedText,
          originalText,
          selection,
          "input"
        );

        if (!ok) {
          return;
        }

        setLastTypedPromptText(result.redactedText);
        setBadge("Content redacted");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
      });

      if (httpPolicyHandled) {
        return;
      }

      if (destinationForceRedact) {
        const result = await requestRedaction(nextAnalysis.normalizedText, relevantSecretFindings, {
          auditReason: destinationPolicy.reason
        });
        const ok = await applyTypedInterceptionRewrite(
          input,
          result.redactedText,
          originalText,
          selection,
          "input"
        );

        if (!ok) return;

        setLastTypedPromptText(result.redactedText);
        setBadge("Destination policy required redaction");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      if (isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
        const ok = await applyTypedInterceptionRewrite(
          input,
          nextAnalysis.normalizedText,
          originalText,
          selection,
          "input"
        );

        if (!ok) return;

        setLastTypedPromptText(nextAnalysis.normalizedText);
        setBadge("Protection paused");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      if (typedShouldAutoRedact) {
        const result = await requestRedaction(nextAnalysis.normalizedText, relevantSecretFindings);
        const ok = await applyTypedInterceptionRewrite(
          input,
          result.redactedText,
          originalText,
          selection,
          "input"
        );

        if (!ok) {
          return;
        }

        setLastTypedPromptText(result.redactedText);
        setBadge("High-confidence secret redacted");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      if (!relevantFindings.length) {
        const ok = await applyTypedInterceptionRewrite(
          input,
          nextAnalysis.normalizedText,
          originalText,
          selection,
          "input"
        );

        if (!ok) return;

        setLastTypedPromptText(nextAnalysis.normalizedText);
        setBadge("Placeholders normalized");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      const decisionAction = await promptForSensitiveContentDecision(
        relevantFindings,
        "input",
        policy,
        input,
        nextAnalysis.normalizedText
      );
      if (decisionAction === "cancel") {
        refreshBadgeFromCurrentInput();
        return;
      }

      const result = await requestRedaction(nextAnalysis.normalizedText, relevantSecretFindings);
      const ok = await applyTypedInterceptionRewrite(
        input,
        result.redactedText,
        originalText,
        selection,
        "input"
      );

      if (!ok) return;

      setLastTypedPromptText(result.redactedText);
      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
    }

    return Object.freeze({
      maybeHandleBeforeInput
    });
  }

  root.PWM.BeforeInputOrchestration = Object.freeze({
    createBeforeInputOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.BeforeInputOrchestration;
  }
})();
