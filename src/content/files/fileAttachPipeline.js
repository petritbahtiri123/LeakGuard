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

  function getSuccessDetailsForStage(stage, options = {}) {
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
    if (stage === "file" && options.successStatus) {
      return {
        successStatus: options.successStatus,
        successReason: options.successReason || "attached"
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
      ? getSuccessDetailsForStage(stage, {
          successStatus: options.successStatus,
          successReason: options.successReason
        })
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

  function classifyFileAttachDisposition(options = {}) {
    const handoffClassification = options.handoffClassification || {};
    const context = options.context || "";
    const stage = handoffClassification.stage || "";
    const usesDmzOverlay = options.usesDmzOverlay === true;
    const forceDmzAttached = options.forceDmzAttached === true;
    const forceAttachedBadge = options.forceAttachedBadge === true;
    const shouldUseDropDmz = context === "drop" && usesDmzOverlay;
    const shouldSetDmzAttached = forceDmzAttached || (shouldUseDropDmz && stage === "file");
    const shouldScheduleDmzCleanup = shouldUseDropDmz && (stage === "file" || stage === "text");
    const shouldShowAttachedBadge =
      forceAttachedBadge || handoffClassification.shouldShowAttachedBadge === true;
    const shouldHideProcessing = handoffClassification.shouldHideProcessing === true;
    const shouldShowSuccess = !shouldHideProcessing;

    return {
      status: handoffClassification.ok === false ? "blocked" : "attached",
      reason: handoffClassification.reason || handoffClassification.successReason || "attached",
      badgeMode: shouldShowAttachedBadge ? "attached" : "none",
      shouldSetDmzAttached,
      dmzStatus: shouldSetDmzAttached ? "Attached sanitized file" : "",
      dmzMode: shouldSetDmzAttached ? "attached" : "",
      shouldScheduleDmzCleanup,
      dmzCleanupDelay: shouldScheduleDmzCleanup ? (stage === "file" ? 1400 : 1800) : 0,
      shouldHideProcessing,
      hideProcessingReason: handoffClassification.hideProcessingReason || "",
      shouldShowSuccess,
      shouldShowOptimizedStatus: false,
      shouldFailProcessing: handoffClassification.shouldFailProcessing === true,
      successStatus:
        handoffClassification.shouldShowSuccess === true
          ? handoffClassification.successStatus
          : "Sanitized file attached.",
      successReason:
        handoffClassification.shouldShowSuccess === true
          ? handoffClassification.successReason
          : "attached",
      shouldShowAttachedBadge,
      attachedBadgeMessage: shouldShowAttachedBadge ? "LeakGuard attached a sanitized local file." : "",
      attachedBadgeHideDelay: shouldShowAttachedBadge ? 3200 : 0
    };
  }

  function classifyPendingAttachFallbackDecision(options = {}) {
    const handoffClassification = options.handoffClassification || {};
    const pendingAttachEnabled = options.pendingAttachEnabled === true;
    const adapterId = String(options.adapterId || "");
    const shouldAttemptPendingFallback =
      handoffClassification.shouldContinueFallback === true && pendingAttachEnabled;

    return {
      shouldAttemptPendingFallback,
      strategy: shouldAttemptPendingFallback ? `${adapterId}-pending-sanitized-file-handoff` : "",
      reason: handoffClassification.reason || ""
    };
  }

  function classifyFileAttachPreflightPlan(options = {}) {
    const context = options.context || "";
    const sizeZone = options.sizeZone || "";
    const usesDmzOverlay = options.usesDmzOverlay === true;
    const shouldUseDropDmz = context === "drop" && usesDmzOverlay;
    const skipTextFallback = options.skipTextFallback === true;
    const allowPendingFallback = options.allowPendingFallback === true;
    const imageRedactionMode = options.imageRedactionMode === true;

    return {
      shouldContinueSanitizedFlow: sizeZone !== "blocked",
      optimizedStatus: {
        shouldShow: sizeZone === "optimized",
        cleanupOnSanitizationFailure: "failed",
        cleanupOnAttachFailure: "failed",
        cleanupOnAttachCancellation: "cancelled",
        cleanupOnAttachSuccess: "complete"
      },
      sanitizationStatus: {
        shouldSetDmzRedacting: shouldUseDropDmz,
        dmzStatus: "Redacting...",
        dmzMode: "redacting",
        processingStatus: imageRedactionMode ? "Redacting image locally..." : "Sanitizing file locally...",
        processingProgress: "",
        processingBlocking: true
      },
      handoffStatus: {
        shouldSetDmzReady: shouldUseDropDmz,
        dmzStatus: imageRedactionMode ? "Sanitized image ready" : "Sanitized file ready",
        dmzMode: "ready",
        processingStatus: imageRedactionMode ? "Preparing sanitized image upload..." : "Preparing sanitized upload...",
        processingProgress: "Complete",
        processingBlocking: true
      },
      attachFlowOptions: {
        allowPendingFallback,
        defaultSuccessStrategy: imageRedactionMode ? "sanitized-image-file-handoff" : "sanitized-file-handoff",
        failureReason: imageRedactionMode ? "sanitized_image_handoff_failed" : "sanitized_file_handoff_failed",
        skipFallbackReason: skipTextFallback
          ? imageRedactionMode
            ? "image_text_fallback_disabled"
            : "firefox_gemini_file_input_replacement_failed"
          : "",
        successStatus: imageRedactionMode ? "Sanitized image attached." : "",
        fileStrategy: imageRedactionMode ? "sanitized-image-file-handoff" : "sanitized-file-handoff",
        textStrategy: "sanitized-text-fallback"
      }
    };
  }

  function normalizeStreamingPendingProviderId(value) {
    const id = String(value || "").trim().toLowerCase();
    return /^(gemini|grok|chatgpt|claude|openai|x)$/.test(id) ? id : "";
  }

  function getStreamingPendingProviderLabel(provider) {
    if (provider === "gemini") return "Gemini";
    if (provider === "grok") return "Grok";
    if (provider === "chatgpt") return "ChatGPT";
    if (provider === "claude") return "Claude";
    if (provider === "openai") return "OpenAI Chat";
    if (provider === "x") return "X";
    return provider || "site";
  }

  function classifyStreamingAttachPlan(options = {}) {
    const isGeminiDrop = options.isGeminiDrop === true;
    const isGrokDrop = options.isGrokDrop === true;
    const streamResultAction = options.streamResultAction || "";
    const hasSanitizedFile = options.hasSanitizedFile === true;
    const provider =
      normalizeStreamingPendingProviderId(options.pendingAdapterId) ||
      (isGeminiDrop ? "gemini" : isGrokDrop ? "grok" : "");
    const pendingOnlyProvider = provider === "gemini" || provider === "grok";
    const providerLabel = getStreamingPendingProviderLabel(provider);

    return {
      shouldContinueStreamingAttach: streamResultAction === "redacted" && hasSanitizedFile,
      blockedResult: {
        shouldBlock: streamResultAction === "blocked",
        reason: "streaming_file_blocked"
      },
      failedResult: {
        shouldBlock: streamResultAction !== "blocked" && (streamResultAction !== "redacted" || !hasSanitizedFile),
        reason: "streaming_file_redaction_failed",
        title: "Raw file upload blocked",
        message: "LeakGuard blocked raw file upload because streaming redaction failed."
      },
      preparingStatus: {
        processingStatus: "Preparing sanitized upload...",
        processingProgress: "Complete",
        processingBlocking: true
      },
      pendingAttach: {
        shouldAttempt: provider !== "",
        provider,
        detailsStage: provider ? `${provider}:streaming-pending-user-upload-input` : "",
        strategy: provider ? `${provider}-streaming-pending-sanitized-file-handoff` : "",
        queueFailureReason: provider ? `${provider}_pending_queue_failed` : "",
        queueFailureTitle: "Raw file upload blocked",
        queueFailureMessage: provider
          ? `LeakGuard sanitized the large file but could not queue ${providerLabel} pending attach.`
          : ""
      },
      genericAttach: {
        shouldAttempt: !pendingOnlyProvider,
        fileStrategy: "streaming-sanitized-file-handoff",
        textStrategy: "streaming-sanitized-text-fallback",
        defaultSuccessStrategy: "streaming-sanitized-file-handoff",
        failureReason: "streaming_sanitized_handoff_failed",
        skipFallbackReason: "firefox_gemini_file_input_replacement_failed",
        failureTitle: "Raw file upload blocked",
        failureMessage: "LeakGuard blocked raw file upload. Sanitized streaming file handoff failed."
      },
      dispositionOptions: {
        forceDmzAttached: true,
        forceAttachedBadge: true
      }
    };
  }

  async function runSanitizedFileAttachFlow(options = {}) {
    const context = options.context || "";
    const handoffResult = await runSanitizedPayloadHandoffOrder({
      context,
      tryDropHandoff: options.tryDropHandoff,
      trySanitizedHandoff: options.trySanitizedHandoff,
      shouldSkipFallback: options.shouldSkipFallback,
      skipFallbackReason: options.skipFallbackReason,
      insertFallbackText: options.insertFallbackText,
      fileStrategy: options.fileStrategy,
      textStrategy: options.textStrategy,
      failedReason: options.failedReason
    });
    const handoffClassification = classifyPostHandoffResult({
      handoffResult,
      context,
      allowPendingFallback: options.allowPendingFallback === true,
      defaultSuccessStrategy: options.defaultSuccessStrategy || "sanitized-file-handoff",
      failureReason: options.failureReason || "sanitized_file_handoff_failed",
      successStatus: options.successStatus,
      cancellationReason: options.cancellationReason,
      treatCancellation: options.treatCancellation
    });

    if (!handoffClassification.ok) {
      if (handoffClassification.reason === (options.cancellationReason || "sanitized_text_cancelled")) {
        return {
          action: "cancelled",
          handled: handoffClassification.handled,
          ok: false,
          reason: handoffClassification.reason,
          handoffResult,
          handoffClassification
        };
      }

      const getPendingAttachFallbackOptions =
        typeof options.getPendingAttachFallbackOptions === "function"
          ? options.getPendingAttachFallbackOptions
          : () => ({});
      const pendingOptions = getPendingAttachFallbackOptions(handoffClassification) || {};
      const pendingFallbackDecision = classifyPendingAttachFallbackDecision({
        handoffClassification,
        pendingAttachEnabled: pendingOptions.pendingAttachEnabled === true,
        adapterId: pendingOptions.adapterId
      });

      if (pendingFallbackDecision.shouldAttemptPendingFallback) {
        return {
          action: "pending",
          handled: handoffClassification.handled,
          ok: true,
          strategy: pendingFallbackDecision.strategy,
          reason: pendingFallbackDecision.reason,
          pendingFallbackDecision,
          pendingAttachOptions: pendingOptions,
          handoffResult,
          handoffClassification
        };
      }

      return {
        action: "fail-closed",
        handled: handoffClassification.handled,
        ok: false,
        reason: handoffClassification.reason,
        pendingFallbackDecision,
        pendingAttachOptions: pendingOptions,
        handoffResult,
        handoffClassification
      };
    }

    const disposition = classifyFileAttachDisposition({
      handoffClassification,
      context,
      usesDmzOverlay: options.usesDmzOverlay === true,
      forceDmzAttached: options.forceDmzAttached === true,
      forceAttachedBadge: options.forceAttachedBadge === true
    });

    return {
      action: "success",
      handled: handoffClassification.handled,
      ok: true,
      strategy: handoffClassification.strategy,
      disposition,
      handoffResult,
      handoffClassification
    };
  }

  root.PWM.FileAttachPipeline = {
    originalFileMetadataFromLocalFile,
    createSanitizedPayload,
    createProcessingStageControls,
    classifyPostHandoffResult,
    classifyFileAttachDisposition,
    classifyPendingAttachFallbackDecision,
    classifyFileAttachPreflightPlan,
    classifyStreamingAttachPlan,
    runSanitizedFileAttachFlow,
    runSanitizedPayloadHandoffOrder
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileAttachPipeline;
  }
})();
