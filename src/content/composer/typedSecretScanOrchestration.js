(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createTypedSecretScanOrchestration(options = {}) {
    const analyzeTextWithAiAssist =
      typeof options.analyzeTextWithAiAssist === "function"
        ? options.analyzeTextWithAiAssist
        : async (text) => ({ normalizedText: text, secretFindings: [], findings: [], placeholderNormalized: false });
    const applyComposerText =
      typeof options.applyComposerText === "function"
        ? options.applyComposerText
        : async (_input, text) => ({ ok: true, actual: text });
    const applyNormalizedComposerRewrite =
      typeof options.applyNormalizedComposerRewrite === "function"
        ? options.applyNormalizedComposerRewrite
        : async (_input, text) => ({ ok: true, text });
    const beginTypedScan = typeof options.beginTypedScan === "function" ? options.beginTypedScan : () => 0;
    const clearEditorRiskState =
      typeof options.clearEditorRiskState === "function" ? options.clearEditorRiskState : () => {};
    const collectFailureDetails =
      typeof options.collectFailureDetails === "function" ? options.collectFailureDetails : () => ({});
    const findComposer = typeof options.findComposer === "function" ? options.findComposer : () => null;
    const getActivePolicy = typeof options.getActivePolicy === "function" ? options.getActivePolicy : () => ({});
    const getInputText = typeof options.getInputText === "function" ? options.getInputText : () => "";
    const getLastTypedPromptText =
      typeof options.getLastTypedPromptText === "function" ? options.getLastTypedPromptText : () => "";
    const getPolicyForAction =
      typeof options.getPolicyForAction === "function" ? options.getPolicyForAction : async () => ({});
    const handleDestinationPolicy =
      typeof options.handleDestinationPolicy === "function"
        ? options.handleDestinationPolicy
        : async () => ({ blocked: false });
    const handleHttpSecretPolicy =
      typeof options.handleHttpSecretPolicy === "function" ? options.handleHttpSecretPolicy : async () => false;
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const isCurrentTypedScan =
      typeof options.isCurrentTypedScan === "function" ? options.isCurrentTypedScan : () => true;
    const isExtensionRuntimeAvailable =
      typeof options.isExtensionRuntimeAvailable === "function"
        ? options.isExtensionRuntimeAvailable
        : () => options.extensionRuntimeAvailable === true;
    const isLiveTypedRedactionEnabled =
      typeof options.isLiveTypedRedactionEnabled === "function"
        ? options.isLiveTypedRedactionEnabled
        : () => false;
    const isModalOpen =
      typeof options.isModalOpen === "function" ? options.isModalOpen : () => options.modalOpen === true;
    const isProtectionPauseActiveAfterPolicy =
      typeof options.isProtectionPauseActiveAfterPolicy === "function"
        ? options.isProtectionPauseActiveAfterPolicy
        : () => false;
    const noteActiveRiskEditor =
      typeof options.noteActiveRiskEditor === "function" ? options.noteActiveRiskEditor : () => {};
    const placeholderTokenRegex = options.placeholderTokenRegex || /\[PWM_\d+\]/g;
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
    const showRewriteFailure =
      typeof options.showRewriteFailure === "function" ? options.showRewriteFailure : async () => {};

    function resetPlaceholderTokenRegex() {
      if (placeholderTokenRegex && typeof placeholderTokenRegex === "object") {
        placeholderTokenRegex.lastIndex = 0;
      }
    }

    async function maybeHandleTypedSecrets() {
      if (!isExtensionRuntimeAvailable() || isModalOpen()) return;

      const scanGeneration = beginTypedScan();
      const input = findComposer();
      if (!input) return;
      noteActiveRiskEditor(input);

      const text = getInputText(input);
      if (!text || !text.trim()) {
        setLastTypedPromptText("");
        clearEditorRiskState(input);
        return;
      }

      const analysis = await analyzeTextWithAiAssist(text);
      if (!isCurrentTypedScan(scanGeneration)) return;

      if (!isLiveTypedRedactionEnabled(getActivePolicy())) {
        setLastTypedPromptText(analysis.normalizedText);
        return;
      }

      if (!analysis.findings.length) {
        if (analysis.placeholderNormalized) {
          if (text !== getLastTypedPromptText()) {
            const normalized = await applyNormalizedComposerRewrite(input, text, "input");
            if (normalized.ok) {
              setLastTypedPromptText(normalized.text);
            }
          }
          return;
        }

        setLastTypedPromptText("");
        clearEditorRiskState(input);
        return;
      }

      if (placeholderTokenRegex.test(analysis.normalizedText)) {
        resetPlaceholderTokenRegex();
        return;
      }
      resetPlaceholderTokenRegex();

      if (analysis.normalizedText === getLastTypedPromptText()) {
        return;
      }

      setLastTypedPromptText(analysis.normalizedText);
      const typedShouldAutoRedact = shouldAutoRedactTypedSecrets(
        analysis.secretFindings,
        analysis.findings
      );
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
        if (latestText !== text) {
          refreshBadgeFromCurrentInput();
          return;
        }

        const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
        if (!isCurrentTypedScan(scanGeneration)) {
          setLastTypedPromptText(analysis.normalizedText);
          refreshBadgeFromCurrentInput();
          return;
        }
        const applied = await applyComposerText(latestInput, result.redactedText, {
          caretOffset: result.redactedText.length,
          restoreText: analysis.normalizedText,
          restoreCaretOffset: analysis.normalizedText.length
        });

        if (!applied.ok) {
          await showRewriteFailure(
            "input",
            collectFailureDetails(latestInput, result.redactedText, applied.actual, "input")
          );
          refreshBadgeFromCurrentInput();
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
        const latestInput = findComposer(input);
        if (!latestInput) return;

        const latestText = getInputText(latestInput);
        if (latestText !== text) {
          refreshBadgeFromCurrentInput();
          return;
        }

        const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
          auditReason: destinationPolicy.reason
        });
        if (!isCurrentTypedScan(scanGeneration)) {
          setLastTypedPromptText(analysis.normalizedText);
          refreshBadgeFromCurrentInput();
          return;
        }
        const applied = await applyComposerText(latestInput, result.redactedText, {
          caretOffset: result.redactedText.length,
          restoreText: analysis.normalizedText,
          restoreCaretOffset: analysis.normalizedText.length
        });

        if (!applied.ok) {
          await showRewriteFailure(
            "input",
            collectFailureDetails(latestInput, result.redactedText, applied.actual, "input")
          );
          refreshBadgeFromCurrentInput();
          return;
        }

        setLastTypedPromptText(result.redactedText);
        setBadge("Destination policy required redaction");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      if (isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
        setLastTypedPromptText(analysis.normalizedText);
        setBadge("Protection paused");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      if (typedShouldAutoRedact) {
        const latestInput = findComposer(input);
        if (!latestInput) return;

        const latestText = getInputText(latestInput);
        if (latestText !== text) {
          refreshBadgeFromCurrentInput();
          return;
        }

        const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
        if (!isCurrentTypedScan(scanGeneration)) {
          setLastTypedPromptText(analysis.normalizedText);
          refreshBadgeFromCurrentInput();
          return;
        }

        const applied = await applyComposerText(latestInput, result.redactedText, {
          caretOffset: result.redactedText.length,
          restoreText: analysis.normalizedText,
          restoreCaretOffset: analysis.normalizedText.length
        });

        if (!applied.ok) {
          await showRewriteFailure(
            "input",
            collectFailureDetails(latestInput, result.redactedText, applied.actual, "input")
          );
          refreshBadgeFromCurrentInput();
          return;
        }

        setLastTypedPromptText(result.redactedText);
        setBadge("High-confidence secret redacted");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return;
      }

      const decisionAction = await promptForSensitiveContentDecision(
        analysis.findings,
        "input",
        policy,
        input,
        analysis.normalizedText
      );
      if (decisionAction !== "redact") {
        setLastTypedPromptText(analysis.normalizedText);
        refreshBadgeFromCurrentInput();
        return;
      }

      const latestInput = findComposer(input);
      if (!latestInput) return;

      const latestText = getInputText(latestInput);
      if (latestText !== text) {
        refreshBadgeFromCurrentInput();
        return;
      }

      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      if (!isCurrentTypedScan(scanGeneration)) {
        setLastTypedPromptText(analysis.normalizedText);
        refreshBadgeFromCurrentInput();
        return;
      }

      const applied = await applyComposerText(latestInput, result.redactedText, {
        caretOffset: result.redactedText.length,
        restoreText: analysis.normalizedText,
        restoreCaretOffset: analysis.normalizedText.length
      });

      if (!applied.ok) {
        await showRewriteFailure(
          "input",
          collectFailureDetails(latestInput, result.redactedText, applied.actual, "input")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      setLastTypedPromptText(result.redactedText);
      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
    }

    return Object.freeze({
      maybeHandleTypedSecrets
    });
  }

  root.PWM.TypedSecretScanOrchestration = Object.freeze({
    createTypedSecretScanOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.TypedSecretScanOrchestration;
  }
})();
