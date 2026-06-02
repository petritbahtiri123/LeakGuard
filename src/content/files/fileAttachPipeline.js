(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function originalFileMetadataFromLocalFile(localFile) {
    return root.PWM.SafeSnapshots.originalFileMetadataFromLocalFile(localFile);
  }

  function createSanitizedPayload(sanitizedFile, redactedText, localFile, analysis, result) {
    return {
      sanitizedFile,
      redactedText: String(redactedText || ""),
      rawText: typeof localFile?.text === "string" ? localFile.text : "",
      originalFile: originalFileMetadataFromLocalFile(localFile),
      placeholders: Array.from(new Set(String(redactedText || "").match(/\[[A-Z_]+_\d+\]/g) || [])),
      replacements: Array.isArray(result?.replacements)
        ? result.replacements.map((replacement) => ({
            id: replacement?.id || "",
            start: Number(replacement?.start || 0),
            end: Number(replacement?.end || 0),
            placeholder: replacement?.placeholder || ""
          }))
        : [],
      findingCount: Number(analysis?.secretFindings?.length || analysis?.findings?.length || 0)
    };
  }

  function createProcessingStageControls(options = {}) {
    const site = options.site || "";
    const showFileProcessingError =
      typeof options.showFileProcessingError === "function" ? options.showFileProcessingError : () => {};
    const hideFileProcessingOverlay =
      typeof options.hideFileProcessingOverlay === "function" ? options.hideFileProcessingOverlay : () => {};
    const showFileProcessingSuccess =
      typeof options.showFileProcessingSuccess === "function" ? options.showFileProcessingSuccess : () => {};

    return {
      failProcessing(reason, status = "Raw file upload blocked") {
        showFileProcessingError(status, {
          site,
          reason
        });
        hideFileProcessingOverlay(reason);
      },
      hideProcessing(reason) {
        hideFileProcessingOverlay(reason);
      },
      showProcessingSuccess(status, reason = "success") {
        showFileProcessingSuccess(status, {
          site,
          reason
        });
      }
    };
  }

  async function runSanitizedPayloadHandoffOrder(options = {}) {
    const context = options.context || "";
    const tryDropHandoff =
      typeof options.tryDropHandoff === "function" ? options.tryDropHandoff : async () => ({
        ok: false,
        stage: "failed",
        reason: "sanitized_payload_handoff_failed"
      });
    const trySanitizedHandoff =
      typeof options.trySanitizedHandoff === "function" ? options.trySanitizedHandoff : async () => false;
    const shouldSkipFallback =
      typeof options.shouldSkipFallback === "function" ? options.shouldSkipFallback : () => false;
    const insertFallbackText =
      typeof options.insertFallbackText === "function" ? options.insertFallbackText : async () => false;
    const fileStrategy = options.fileStrategy || "sanitized-file-handoff";
    const textStrategy = options.textStrategy || "sanitized-text-fallback";
    const failedReason = options.failedReason || "sanitized_payload_handoff_failed";

    if (context === "drop") {
      return tryDropHandoff();
    }

    if (await trySanitizedHandoff()) {
      return { ok: true, stage: "file", strategy: fileStrategy };
    }

    if (shouldSkipFallback()) {
      return {
        ok: false,
        stage: "failed",
        reason: options.skipFallbackReason || failedReason
      };
    }

    const inserted = await insertFallbackText();
    return inserted === true
      ? { ok: true, stage: "text", strategy: textStrategy }
      : {
          ok: false,
          stage: "failed",
          reason: inserted === "cancelled" ? "sanitized_text_cancelled" : failedReason
        };
  }

  root.PWM.FileAttachPipeline = {
    originalFileMetadataFromLocalFile,
    createSanitizedPayload,
    createProcessingStageControls,
    runSanitizedPayloadHandoffOrder
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileAttachPipeline;
  }
})();
