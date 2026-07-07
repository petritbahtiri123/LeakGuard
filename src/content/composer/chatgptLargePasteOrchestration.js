(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createChatGptLargePasteOrchestration(options = {}) {
    const analyzeText =
      typeof options.analyzeText === "function"
        ? options.analyzeText
        : (text) => ({ normalizedText: text, secretFindings: [], findings: [] });
    const blockLargeLocalTextPayload =
      typeof options.blockLargeLocalTextPayload === "function"
        ? options.blockLargeLocalTextPayload
        : async () => {};
    const chatGptComposerSync = options.chatGptComposerSync || {};
    const applyChatGptSyncedComposerText =
      typeof chatGptComposerSync.applyChatGptSyncedComposerText === "function"
        ? chatGptComposerSync.applyChatGptSyncedComposerText
        : async () => ({ ok: false, actual: "", strategy: "" });
    const chatGptLargePasteFileName = options.chatGptLargePasteFileName || "leakguard-redacted-paste.txt";
    const chatGptLargePasteFileThreshold = Number(options.chatGptLargePasteFileThreshold || 16 * 1024);
    const classifyLocalTextPayloadSize =
      typeof options.classifyLocalTextPayloadSize === "function"
        ? options.classifyLocalTextPayloadSize
        : () => ({ zone: "fast", bytes: 0 });
    const clearLocalPayloadOptimizationStatus =
      typeof options.clearLocalPayloadOptimizationStatus === "function"
        ? options.clearLocalPayloadOptimizationStatus
        : () => {};
    const collectFailureDetails =
      typeof options.collectFailureDetails === "function" ? options.collectFailureDetails : () => ({});
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const countDebugPlaceholders =
      typeof options.countDebugPlaceholders === "function" ? options.countDebugPlaceholders : () => 0;
    const createSanitizedTextFile =
      typeof options.createSanitizedTextFile === "function" ? options.createSanitizedTextFile : () => null;
    const debugReveal = typeof options.debugReveal === "function" ? options.debugReveal : () => {};
    const describeFileForDebug =
      typeof options.describeFileForDebug === "function" ? options.describeFileForDebug : () => ({});
    const getChatGptComposerSyncDependencies =
      typeof options.getChatGptComposerSyncDependencies === "function"
        ? options.getChatGptComposerSyncDependencies
        : () => ({});
    const getInputText = typeof options.getInputText === "function" ? options.getInputText : () => "";
    const getLocalTextPayloadByteLength =
      typeof options.getLocalTextPayloadByteLength === "function"
        ? options.getLocalTextPayloadByteLength
        : (text) => String(text || "").length;
    const getSelectionOffsets =
      typeof options.getSelectionOffsets === "function" ? options.getSelectionOffsets : () => ({ start: 0, end: 0 });
    const handOffSanitizedLocalFile =
      typeof options.handOffSanitizedLocalFile === "function"
        ? options.handOffSanitizedLocalFile
        : async () => false;
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const isChatGptHost = typeof options.isChatGptHost === "function" ? options.isChatGptHost : () => false;
    const localTextHardBlockBytes = Number(options.localTextHardBlockBytes || 4 * 1024 * 1024);
    const locationRef = options.locationRef || root.location || {};
    const normalizeComposerText =
      typeof options.normalizeComposerText === "function" ? options.normalizeComposerText : (text) => String(text || "");
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const requestRedaction =
      typeof options.requestRedaction === "function"
        ? options.requestRedaction
        : async (text) => ({ redactedText: text });
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const setInputTextDirect =
      typeof options.setInputTextDirect === "function" ? options.setInputTextDirect : null;
    const showLocalPayloadOptimizationStatus =
      typeof options.showLocalPayloadOptimizationStatus === "function"
        ? options.showLocalPayloadOptimizationStatus
        : () => {};
    const showMessageModal =
      typeof options.showMessageModal === "function" ? options.showMessageModal : async () => {};
    const showRewriteFailure =
      typeof options.showRewriteFailure === "function" ? options.showRewriteFailure : async () => {};
    const spliceSelectionText =
      typeof options.spliceSelectionText === "function"
        ? options.spliceSelectionText
        : (originalText, selection, replacement) => {
            const source = String(originalText || "");
            const start = Math.max(0, Number(selection?.start ?? source.length));
            const end = Math.max(start, Number(selection?.end ?? start));
            return {
              text: `${source.slice(0, start)}${replacement}${source.slice(end)}`,
              caretOffset: start + String(replacement || "").length
            };
          };
    const syncSuppressMs = Number(options.syncSuppressMs || 2500);

    function shouldHandleChatGptLargeTextPaste(pasted, quickAnalysis) {
      return Boolean(
        isChatGptHost() &&
          getLocalTextPayloadByteLength(String(pasted || "")) >= chatGptLargePasteFileThreshold &&
          ((quickAnalysis?.findings || []).length || quickAnalysis?.placeholderNormalized)
      );
    }

    function createSanitizedChatGptPasteFile(redactedText) {
      return createSanitizedTextFile(
        {
          name: chatGptLargePasteFileName,
          type: "text/plain"
        },
        redactedText
      );
    }

    async function applyChatGptLargePasteTextFallback(input, originalText, selection, redactedText) {
      if (!input || !setInputTextDirect) {
        debugReveal("chatgpt-large-paste:text-fallback-failed", {
          host: locationRef?.hostname || "",
          reason: "missing_input_or_writer"
        });
        return false;
      }

      const next = spliceSelectionText(originalText, selection, String(redactedText || ""));
      debugReveal("chatgpt-large-paste:text-fallback-start", {
        host: locationRef?.hostname || "",
        expectedLength: normalizeComposerText(next.text).length,
        placeholderCount: countDebugPlaceholders(next.text),
        selection: {
          start: Number(selection?.start ?? 0),
          end: Number(selection?.end ?? 0)
        }
      });
      const applied = await applyChatGptSyncedComposerText(input, next.text, {
        context: "large-paste-text-fallback",
        caretOffset: next.caretOffset,
        restoreText: originalText,
        restoreCaretOffset: selection?.end,
        suppressMs: syncSuppressMs,
        dependencies: getChatGptComposerSyncDependencies()
      });

      if (applied.ok) {
        debugReveal("chatgpt-large-paste:text-fallback-success", {
          host: locationRef?.hostname || "",
          expectedLength: normalizeComposerText(next.text).length,
          actualLength: normalizeComposerText(applied.actual).length,
          placeholderCount: countDebugPlaceholders(applied.actual),
          strategy: applied.strategy
        });
        return true;
      }

      debugReveal("chatgpt-large-paste:text-fallback-failed", {
        host: locationRef?.hostname || "",
        expectedLength: normalizeComposerText(next.text).length,
        actualLength: normalizeComposerText(applied.actual).length,
        placeholderCount: countDebugPlaceholders(applied.actual),
        strategy: applied.strategy
      });
      await showRewriteFailure("paste", collectFailureDetails(input, next.text, applied.actual, "paste"));
      refreshBadgeFromCurrentInput();
      return false;
    }

    async function maybeHandleChatGptLargeTextPaste(event, input, pasted, quickAnalysis) {
      if (isChatGptHost() && getLocalTextPayloadByteLength(String(pasted || "")) > localTextHardBlockBytes) {
        await blockLargeLocalTextPayload(event, classifyLocalTextPayloadSize({ text: pasted }));
        return true;
      }

      if (!shouldHandleChatGptLargeTextPaste(pasted, quickAnalysis)) {
        return false;
      }

      const originalText = getInputText(input);
      const selection = getSelectionOffsets(input);
      consumeInterceptionEvent(event);
      const sizeInfo = classifyLocalTextPayloadSize({ text: pasted });
      const optimizedStatus = sizeInfo.zone === "optimized";
      if (optimizedStatus) {
        showLocalPayloadOptimizationStatus(sizeInfo);
      }

      try {
        const analysis = analyzeText(pasted);
        const result = analysis.findings.length
          ? await requestRedaction(analysis.normalizedText, analysis.secretFindings)
          : { redactedText: analysis.normalizedText };
        const redactedText = String(result.redactedText || "");
        const sanitizedFile = createSanitizedChatGptPasteFile(redactedText);

        debugReveal("chatgpt-large-paste:sanitized-file-created", {
          redactedLength: redactedText.length,
          findingsCount: analysis.secretFindings.length,
          file: describeFileForDebug(sanitizedFile)
        });

        debugReveal("chatgpt-large-paste:file-handoff-attempt", {
          host: locationRef?.hostname || "",
          redactedLength: redactedText.length,
          placeholderCount: countDebugPlaceholders(redactedText),
          file: describeFileForDebug(sanitizedFile)
        });
        if (sanitizedFile && (await handOffSanitizedLocalFile(event, input, sanitizedFile, "paste"))) {
          debugReveal("chatgpt-large-paste:file-handoff-success", {
            host: locationRef?.hostname || "",
            redactedLength: redactedText.length,
            placeholderCount: countDebugPlaceholders(redactedText),
            file: describeFileForDebug(sanitizedFile)
          });
          if (optimizedStatus) {
            clearLocalPayloadOptimizationStatus(sizeInfo, "complete");
          }
          setBadge("LeakGuard redacted pasted text before attachment.");
          hideBadgeSoon(4200);
          refreshBadgeFromCurrentInput();
          return true;
        }
        debugReveal("chatgpt-large-paste:file-handoff-failed", {
          host: locationRef?.hostname || "",
          redactedLength: redactedText.length,
          placeholderCount: countDebugPlaceholders(redactedText),
          file: describeFileForDebug(sanitizedFile)
        });

        if (await applyChatGptLargePasteTextFallback(input, originalText, selection, redactedText)) {
          if (optimizedStatus) {
            clearLocalPayloadOptimizationStatus(sizeInfo, "complete");
          }
          setBadge("LeakGuard redacted pasted text before attachment.");
          hideBadgeSoon(4200);
          refreshBadgeFromCurrentInput();
          return true;
        }

        debugReveal("chatgpt-large-paste:fail-closed", {
          redactedLength: redactedText.length,
          file: describeFileForDebug(sanitizedFile)
        });
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
        }
        setBadge("Raw paste blocked");
        hideBadgeSoon(4200);
        await showMessageModal(
          "Raw paste blocked",
          "LeakGuard blocked raw pasted text because sanitized ChatGPT handoff failed."
        );
        refreshBadgeFromCurrentInput();
        return true;
      } catch (error) {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
        }
        throw error;
      }
    }

    return Object.freeze({
      applyChatGptLargePasteTextFallback,
      createSanitizedChatGptPasteFile,
      maybeHandleChatGptLargeTextPaste,
      shouldHandleChatGptLargeTextPaste
    });
  }

  root.PWM.ChatGptLargePasteOrchestration = Object.freeze({
    createChatGptLargePasteOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ChatGptLargePasteOrchestration;
  }
})();
