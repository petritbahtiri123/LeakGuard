(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createGeminiEditorPasteOrchestration(options = {}) {
    const analyzeTextWithAiAssist =
      typeof options.analyzeTextWithAiAssist === "function"
        ? options.analyzeTextWithAiAssist
        : async (text) => ({ normalizedText: text, secretFindings: [], findings: [] });
    const applyGeminiEditorText =
      typeof options.applyGeminiEditorText === "function" ? options.applyGeminiEditorText : async () => false;
    const blockLargeLocalTextPayload =
      typeof options.blockLargeLocalTextPayload === "function"
        ? options.blockLargeLocalTextPayload
        : async () => {};
    const classifyLocalTextPayloadSize =
      typeof options.classifyLocalTextPayloadSize === "function"
        ? options.classifyLocalTextPayloadSize
        : () => ({ zone: "fast", bytes: 0 });
    const clearLocalPayloadOptimizationStatus =
      typeof options.clearLocalPayloadOptimizationStatus === "function"
        ? options.clearLocalPayloadOptimizationStatus
        : () => {};
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const getPolicyForAction =
      typeof options.getPolicyForAction === "function" ? options.getPolicyForAction : async () => ({});
    const handleContentError =
      typeof options.handleContentError === "function" ? options.handleContentError : () => {};
    const handleDestinationPolicy =
      typeof options.handleDestinationPolicy === "function"
        ? options.handleDestinationPolicy
        : async () => ({ blocked: false });
    const handleHttpSecretPolicy =
      typeof options.handleHttpSecretPolicy === "function" ? options.handleHttpSecretPolicy : async () => false;
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const isProtectionPauseActiveAfterPolicy =
      typeof options.isProtectionPauseActiveAfterPolicy === "function"
        ? options.isProtectionPauseActiveAfterPolicy
        : () => false;
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
    const resolveGeminiEditorTarget =
      typeof options.resolveGeminiEditorTarget === "function" ? options.resolveGeminiEditorTarget : () => null;
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const shouldForceDestinationRedaction =
      typeof options.shouldForceDestinationRedaction === "function"
        ? options.shouldForceDestinationRedaction
        : () => false;
    const showLocalPayloadOptimizationStatus =
      typeof options.showLocalPayloadOptimizationStatus === "function"
        ? options.showLocalPayloadOptimizationStatus
        : () => {};
    const showMessageModal =
      typeof options.showMessageModal === "function" ? options.showMessageModal : async () => {};

    async function maybeHandleGeminiEditorPaste(event) {
      const editor = resolveGeminiEditorTarget(event?.target);
      if (!editor) return false;
      noteActiveRiskEditor(editor);

      const pasted = event.clipboardData?.getData("text/plain") || "";
      if (!pasted) return false;

      consumeInterceptionEvent(event);
      const sizeInfo = classifyLocalTextPayloadSize({ text: pasted });
      if (sizeInfo.zone === "blocked") {
        await blockLargeLocalTextPayload(event, sizeInfo);
        return true;
      }

      const optimizedStatus = sizeInfo.zone === "optimized";
      if (optimizedStatus) {
        showLocalPayloadOptimizationStatus(sizeInfo);
      }

      try {
        const analysis = await analyzeTextWithAiAssist(pasted);
        let textToInsert = analysis.normalizedText;

        if (analysis.findings.length) {
          const policy = await getPolicyForAction();
          const destinationPolicy = await handleDestinationPolicy(analysis.findings, policy);
          if (destinationPolicy.blocked) {
            if (optimizedStatus) {
              clearLocalPayloadOptimizationStatus(sizeInfo, "cancelled");
            }
            return true;
          }

          const destinationForceRedact = shouldForceDestinationRedaction(
            destinationPolicy,
            analysis.findings
          );
          const httpPolicyHandled = await handleHttpSecretPolicy(
            policy,
            analysis.secretFindings,
            async () => {
              const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
              textToInsert = result.redactedText;
            }
          );

          if (!httpPolicyHandled && destinationForceRedact) {
            const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
              auditReason: destinationPolicy.reason
            });
            textToInsert = result.redactedText;
          } else if (!httpPolicyHandled && !isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
            const decisionAction = await promptForSensitiveContentDecision(
              analysis.findings,
              "paste",
              policy,
              editor,
              analysis.normalizedText
            );

            if (decisionAction === "cancel") {
              if (optimizedStatus) {
                clearLocalPayloadOptimizationStatus(sizeInfo, "cancelled");
              }
              refreshBadgeFromCurrentInput();
              return true;
            }

            const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
            textToInsert = result.redactedText;
          } else if (!httpPolicyHandled) {
            setBadge("Protection paused");
            hideBadgeSoon();
          }
        }

        const applied = await applyGeminiEditorText(editor, textToInsert, "gemini-paste", {
          rawInsertedText: pasted
        });
        if (applied === true || applied === "cancelled") {
          if (optimizedStatus) {
            clearLocalPayloadOptimizationStatus(sizeInfo, applied === true ? "complete" : "cancelled");
          }
          return true;
        }
      } catch (error) {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
        }
        handleContentError(error);
      }

      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
      }
      setBadge("Raw paste blocked");
      hideBadgeSoon(4200);
      await showMessageModal(
        "Raw paste blocked",
        "LeakGuard blocked raw pasted content because sanitized insertion failed."
      );
      refreshBadgeFromCurrentInput();
      return true;
    }

    return Object.freeze({
      maybeHandleGeminiEditorPaste
    });
  }

  root.PWM.GeminiEditorPasteOrchestration = Object.freeze({
    createGeminiEditorPasteOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.GeminiEditorPasteOrchestration;
  }
})();
