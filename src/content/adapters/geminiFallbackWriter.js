(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.GeminiFallbackWriter = root.PWM.GeminiFallbackWriter || {};

  function createGeminiFallbackWriter(deps = {}) {
    const noop = () => {};
    const {
      applyPasteDecision = async () => false,
      confirmGeminiLargeSanitizedTextInsertion = async () => true,
      contentDebugEvents = {},
      describeFileForDebug = () => null,
      documentRef = typeof document !== "undefined" ? document : null,
      emitDebug = noop,
      emitFileAttachMetadata = noop,
      findComposer = () => null,
      formatSanitizedFileFallbackText = () => "",
      getInputText = () => "",
      getSelectionOffsets = () => ({ start: 0, end: 0 }),
      hideBadgeSoon = noop,
      insertGeminiEditorText = () => false,
      isGeminiHost = () => false,
      locationRef = typeof location !== "undefined" ? location : null,
      normalizeComposerText = (value) => String(value || ""),
      refreshBadgeFromCurrentInput = noop,
      resolveGeminiFallbackEditor = () => null,
      rewriteComposerTransactionally = async () => ({ ok: false }),
      setBadge = noop,
      setGeminiDmzOverlayState = noop,
      showMessageModal = async () => {}
    } = deps;

    const textFallbackUnavailable =
      contentDebugEvents.FILE_HANDOFF_TEXT_FALLBACK_UNAVAILABLE ||
      "file-handoff:text-fallback-unavailable";
    const textFallbackFailed =
      contentDebugEvents.FILE_HANDOFF_TEXT_FALLBACK_FAILED ||
      "file-handoff:text-fallback-failed";
    const textFallbackSuccess =
      contentDebugEvents.FILE_HANDOFF_TEXT_FALLBACK_SUCCESS ||
      "file-handoff:text-fallback-success";
    const geminiSanitizedTextFallbackMessage =
      deps.geminiSanitizedTextFallbackMessage ||
      "Sanitized content inserted as text because Gemini rejected sanitized file upload.";

    async function applyGeminiEditorText(editor, sanitizedText, context, options) {
      const applyOptions = options || {};
      const rawInsertedText =
        typeof applyOptions.rawInsertedText === "string"
          ? normalizeComposerText(applyOptions.rawInsertedText)
          : "";
      if (
        !applyOptions.skipLargeConfirmation &&
        !(await confirmGeminiLargeSanitizedTextInsertion(sanitizedText, context))
      ) {
        setBadge("Sanitized text insertion cancelled");
        hideBadgeSoon(3200);
        refreshBadgeFromCurrentInput();
        return "cancelled";
      }

      if (rawInsertedText && getInputText(editor).includes(rawInsertedText)) {
        const currentText = getInputText(editor);
        const rawIndex = currentText.indexOf(rawInsertedText);
        const desiredText =
          rawIndex >= 0
            ? `${currentText.slice(0, rawIndex)}${normalizeComposerText(sanitizedText)}${currentText.slice(rawIndex + rawInsertedText.length)}`
            : normalizeComposerText(sanitizedText);
        const applied = await rewriteComposerTransactionally(
          editor,
          rawInsertedText,
          desiredText,
          context,
          { caretOffset: rawIndex >= 0 ? rawIndex + normalizeComposerText(sanitizedText).length : undefined }
        );

        if (applied.ok) {
          setBadge("Content redacted");
          hideBadgeSoon();
          refreshBadgeFromCurrentInput();
          return true;
        }
      }

      if (insertGeminiEditorText(editor, sanitizedText, { rawInsertedText })) {
        if (rawInsertedText && getInputText(editor).includes(rawInsertedText)) {
          const applied = await rewriteComposerTransactionally(
            editor,
            rawInsertedText,
            normalizeComposerText(sanitizedText),
            context,
            { caretOffset: normalizeComposerText(sanitizedText).length }
          );
          if (!applied.ok) {
            return false;
          }
        }
        setBadge("Content redacted");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return true;
      }

      const originalText = getInputText(editor);
      const selection = getSelectionOffsets(editor);
      const inserted = await applyPasteDecision(
        editor,
        originalText,
        selection,
        String(sanitizedText || ""),
        context,
        { rawInsertedText }
      );

      if (inserted) {
        setBadge("Content redacted");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
      }

      return inserted;
    }

    async function applyGeminiSanitizedTextFallback(event, input, redactedText, options) {
      options = options || {};
      if (!isGeminiHost()) {
        return false;
      }

      if (!(await confirmGeminiLargeSanitizedTextInsertion(redactedText, "file-text-fallback"))) {
        setBadge("Sanitized text insertion cancelled");
        hideBadgeSoon(3200);
        refreshBadgeFromCurrentInput();
        return "cancelled";
      }

      const editor = resolveGeminiFallbackEditor(event, input);
      if (editor) {
        const inserted = await applyGeminiEditorText(
          editor,
          String(redactedText || ""),
          "file-text-fallback",
          {
            skipLargeConfirmation: true,
            rawInsertedText: options.rawInsertedText || ""
          }
        );
        if (inserted) {
          setBadge(geminiSanitizedTextFallbackMessage);
          hideBadgeSoon(5200);
          await showMessageModal("Sanitized content inserted as text", geminiSanitizedTextFallbackMessage);
          refreshBadgeFromCurrentInput();
          return true;
        }
      }

      const targetInput = input || findComposer(event?.target) || findComposer(documentRef?.activeElement);
      if (!targetInput) {
        emitDebug(textFallbackUnavailable, {
          context: event?.type || "",
          reason: "composer_not_found"
        });
        return false;
      }

      const originalText = getInputText(targetInput);
      const selection = getSelectionOffsets(targetInput);
      const inserted = await applyPasteDecision(
        targetInput,
        originalText,
        selection,
        String(redactedText || ""),
        "file-text-fallback",
        { rawInsertedText: options.rawInsertedText || "" }
      );

      if (!inserted) {
        emitDebug(textFallbackFailed, {
          context: event?.type || "",
          reason: "composer_rewrite_failed"
        });
        return false;
      }

      emitDebug(textFallbackSuccess, {
        context: event?.type || "",
        redactedLength: String(redactedText || "").length
      });
      setBadge(geminiSanitizedTextFallbackMessage);
      hideBadgeSoon(5200);
      await showMessageModal("Sanitized content inserted as text", geminiSanitizedTextFallbackMessage);
      refreshBadgeFromCurrentInput();
      return true;
    }

    async function insertGeminiSanitizedText(payload, event, input) {
      if (!isGeminiHost()) return false;
      if (!String(payload?.redactedText || "").trim()) {
        emitDebug("file-handoff:gemini-empty-text-fallback-blocked", {
          reason: "empty_sanitized_text"
        });
        return false;
      }
      const inserted = await applyGeminiSanitizedTextFallback(
        event,
        input,
        formatSanitizedFileFallbackText(payload),
        { rawInsertedText: payload.rawText || "" }
      );
      if (inserted === true) {
        emitFileAttachMetadata("gemini:fallback-text-inserted", {
          hostname: locationRef?.hostname || "",
          stage: "text",
          sanitizedFile: describeFileForDebug(payload?.sanitizedFile)
        });
        setGeminiDmzOverlayState("Inserted sanitized content", "inserted");
      }
      return inserted;
    }

    return {
      applyGeminiEditorText,
      applyGeminiSanitizedTextFallback,
      insertGeminiSanitizedText
    };
  }

  root.PWM.GeminiFallbackWriter.createGeminiFallbackWriter = createGeminiFallbackWriter;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createGeminiFallbackWriter };
  }
})();
