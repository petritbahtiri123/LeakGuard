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

  function getSuccessDetailsForStage(stage) {
    if (stage === "text") {
      return {
        successStatus: "Sanitized content inserted.",
        successReason: "inserted"
      };
    }
    if (stage === "download") {
      return {
        successStatus: "Sanitized file ready.",
        successReason: "download"
      };
    }
    return {
      successStatus: "Sanitized file attached.",
      successReason: "attached"
    };
  }

  function classifyPostHandoffResult(options = {}) {
    const handoffResult = options.handoffResult;
    const context = options.context || "";
    const ok = Boolean(handoffResult.ok);
    const stage = handoffResult.stage || "";
    const handoffReason = handoffResult.reason || "";
    const cancellationReason = options.cancellationReason || "sanitized_text_cancelled";
    const treatsCancellation = options.treatCancellation !== false;
    const cancelled = !ok && treatsCancellation && handoffReason === cancellationReason;
    const reason = ok ? "" : cancelled ? cancellationReason : options.failureReason || "sanitized_file_handoff_failed";
    const shouldContinueFallback = !ok && !cancelled && options.allowPendingFallback === true;
    const shouldShowSuccess = ok && stage !== "pending";
    const successDetails = shouldShowSuccess
      ? getSuccessDetailsForStage(stage)
      : {
          successStatus: "",
          successReason: ""
        };

    return {
      handled: true,
      ok,
      stage,
      reason,
      handoffReason,
      strategy: ok ? handoffResult.strategy || options.defaultSuccessStrategy || "sanitized-file-handoff" : "",
      shouldShowSuccess,
      shouldHideProcessing: cancelled || (ok && stage === "pending"),
      hideProcessingReason: cancelled ? "cancelled" : ok && stage === "pending" ? "pending" : "",
      shouldFailProcessing: !ok && !cancelled,
      shouldContinueFallback,
      shouldShowAttachedBadge: ok && (stage === "file" || context !== "drop"),
      successStatus: successDetails.successStatus,
      successReason: successDetails.successReason,
      handoffResult
    };
  }

  root.PWM.FileAttachPipeline = {
    originalFileMetadataFromLocalFile,
    createSanitizedPayload,
    createProcessingStageControls,
    classifyPostHandoffResult,
    runSanitizedPayloadHandoffOrder
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileAttachPipeline;
  }
})();
