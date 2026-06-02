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

  // TODO(PR4): Move pipeline control flow here only after event timing, handoff order,
  // raw blocking, streaming memory behavior, and trusted pending attach coverage are pinned.
  root.PWM.FileAttachPipeline = {
    originalFileMetadataFromLocalFile,
    createSanitizedPayload,
    createProcessingStageControls
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileAttachPipeline;
  }
})();
