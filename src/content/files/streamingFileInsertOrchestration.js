(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createStreamingFileInsertOrchestration(options = {}) {
    const fileAttachPipeline = options.fileAttachPipeline || root.PWM.FileAttachPipeline || {};
    const streamingBlockTitle = options.streamingBlockTitle || "File too large for local redaction";
    const streamingBlockMessage =
      options.streamingBlockMessage ||
      "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.";

    const blockStreamingLocalFile =
      typeof options.blockStreamingLocalFile === "function"
        ? options.blockStreamingLocalFile
        : async () => ({ handled: true, ok: false, reason: "streaming_file_blocked" });
    const createSanitizedFileHandoffDetails =
      typeof options.createSanitizedFileHandoffDetails === "function"
        ? options.createSanitizedFileHandoffDetails
        : () => ({});
    const getCurrentHandoffDriver =
      typeof options.getCurrentHandoffDriver === "function" ? options.getCurrentHandoffDriver : () => null;
    const getFileHandoffAdapterById =
      typeof options.getFileHandoffAdapterById === "function" ? options.getFileHandoffAdapterById : () => null;
    const getFileHandoffAdapterForLocation =
      typeof options.getFileHandoffAdapterForLocation === "function"
        ? options.getFileHandoffAdapterForLocation
        : () => null;
    const getPendingSanitizedAttachPromptMessage =
      typeof options.getPendingSanitizedAttachPromptMessage === "function"
        ? options.getPendingSanitizedAttachPromptMessage
        : () => "Attach sanitized file";
    const handOffSanitizedLocalFile =
      typeof options.handOffSanitizedLocalFile === "function" ? options.handOffSanitizedLocalFile : async () => false;
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const isFileHandoffAdapterPendingAttachEnabled =
      typeof options.isFileHandoffAdapterPendingAttachEnabled === "function"
        ? options.isFileHandoffAdapterPendingAttachEnabled
        : () => false;
    const isFirefoxRuntime = typeof options.isFirefoxRuntime === "function" ? options.isFirefoxRuntime : () => false;
    const isGeminiHost = typeof options.isGeminiHost === "function" ? options.isGeminiHost : () => false;
    const isGrokHost = typeof options.isGrokHost === "function" ? options.isGrokHost : () => false;
    const queuePendingSanitizedFileHandoff =
      typeof options.queuePendingSanitizedFileHandoff === "function"
        ? options.queuePendingSanitizedFileHandoff
        : () => false;
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const setDmzOverlayState = typeof options.setDmzOverlayState === "function" ? options.setDmzOverlayState : () => {};
    const showFileProcessingError =
      typeof options.showFileProcessingError === "function" ? options.showFileProcessingError : () => {};
    const streamRedactLocalTextFile =
      typeof options.streamRedactLocalTextFile === "function"
        ? options.streamRedactLocalTextFile
        : async () => ({ action: "failed" });
    const updateFileProcessingOverlay =
      typeof options.updateFileProcessingOverlay === "function" ? options.updateFileProcessingOverlay : () => {};

    async function maybeHandleStreamingRequiredLocalFile(args = {}) {
      const { event, input, localFile, context, processingSite } = args;
      const controls = args.controls || {};
      if (localFile?.code !== "streaming_required" || !localFile.sourceFile) {
        return null;
      }

      updateFileProcessingOverlay({
        site: processingSite,
        status: "Stream-redacting large file locally...",
        progress: "",
        blocking: true
      });
      const streamResult = await streamRedactLocalTextFile(localFile.sourceFile, localFile.file);
      const streamingPendingAdapter = context === "drop" ? getFileHandoffAdapterForLocation() : null;
      const streamingPendingAdapterId =
        streamingPendingAdapter && isFileHandoffAdapterPendingAttachEnabled(streamingPendingAdapter)
          ? streamingPendingAdapter.id
          : "";
      const isGeminiDrop = !streamingPendingAdapterId && context === "drop" && isGeminiHost();
      const isGrokDrop = !streamingPendingAdapterId && context === "drop" && isGrokHost();
      const streamingPlan = fileAttachPipeline.classifyStreamingAttachPlan({
        context,
        isGeminiDrop,
        isGrokDrop,
        pendingAdapterId: streamingPendingAdapterId,
        streamResultAction: streamResult.action,
        hasSanitizedFile: Boolean(streamResult.sanitizedFile)
      });
      if (streamingPlan.blockedResult.shouldBlock) {
        controls.failProcessing?.(streamingPlan.blockedResult.reason, streamResult.title || streamingBlockTitle);
        return blockStreamingLocalFile(
          event,
          streamResult.title || streamingBlockTitle,
          streamResult.error || streamingBlockMessage
        );
      }

      if (streamingPlan.failedResult.shouldBlock) {
        controls.failProcessing?.(streamingPlan.failedResult.reason, streamingPlan.failedResult.title);
        return blockStreamingLocalFile(
          event,
          streamingPlan.failedResult.title,
          streamResult.error || streamingPlan.failedResult.message
        );
      }

      updateFileProcessingOverlay({
        site: processingSite,
        status: streamingPlan.preparingStatus.processingStatus,
        progress: streamingPlan.preparingStatus.processingProgress,
        blocking: streamingPlan.preparingStatus.processingBlocking
      });

      if (streamingPlan.pendingAttach.provider === "gemini" || streamingPlan.pendingAttach.provider === "grok") {
        const provider = streamingPlan.pendingAttach.provider;
        const details = createSanitizedFileHandoffDetails(
          event,
          streamResult.sanitizedFile,
          streamingPlan.pendingAttach.detailsStage
        );

        controls.hideProcessing?.("sanitized");
        if (
          queuePendingSanitizedFileHandoff(
            getFileHandoffAdapterById(provider),
            event,
            input,
            streamResult.sanitizedFile,
            details
          )
        ) {
          setBadge(getPendingSanitizedAttachPromptMessage(provider));
          hideBadgeSoon(6500);
          refreshBadgeFromCurrentInput();
          return {
            handled: true,
            ok: true,
            strategy: streamingPlan.pendingAttach.strategy
          };
        }
        showFileProcessingError(streamingPlan.pendingAttach.queueFailureTitle, {
          site: processingSite,
          reason: streamingPlan.pendingAttach.queueFailureReason
        });
        return blockStreamingLocalFile(
          event,
          streamingPlan.pendingAttach.queueFailureTitle,
          streamingPlan.pendingAttach.queueFailureMessage
        );
      }

      const driver = getCurrentHandoffDriver();
      const payload = driver.preparePayload(streamResult.sanitizedFile, "", {
        localFile: localFile.sourceFile || localFile.file,
        analysis: null,
        result: null
      });
      payload.allowFileOnlyHandoff = true;
      payload.streamed = true;
      const handoffResult = await fileAttachPipeline.runSanitizedPayloadHandoffOrder({
        context,
        tryDropHandoff: () =>
          driver.handoff(payload, { event, input, context, driver, composerResolved: true }),
        trySanitizedHandoff: () =>
          handOffSanitizedLocalFile(event, input, streamResult.sanitizedFile, context),
        shouldSkipFallback: () => context === "file-input" && isFirefoxRuntime() && isGeminiHost(),
        skipFallbackReason: streamingPlan.genericAttach.skipFallbackReason,
        insertFallbackText: () => driver.insertSanitizedText(payload, { event, input, context, driver }),
        fileStrategy: streamingPlan.genericAttach.fileStrategy,
        textStrategy: streamingPlan.genericAttach.textStrategy
      });
      const handoffClassification = fileAttachPipeline.classifyPostHandoffResult({
        handoffResult,
        context,
        defaultSuccessStrategy: streamingPlan.genericAttach.defaultSuccessStrategy,
        failureReason: streamingPlan.genericAttach.failureReason,
        treatCancellation: false
      });
      if (handoffClassification.ok) {
        const disposition = fileAttachPipeline.classifyFileAttachDisposition({
          handoffClassification,
          context,
          forceDmzAttached: streamingPlan.dispositionOptions.forceDmzAttached,
          forceAttachedBadge: streamingPlan.dispositionOptions.forceAttachedBadge
        });
        if (disposition.shouldSetDmzAttached) {
          setDmzOverlayState(disposition.dmzStatus, disposition.dmzMode);
        }
        if (disposition.shouldHideProcessing) {
          controls.hideProcessing?.(disposition.hideProcessingReason);
        } else if (disposition.shouldShowSuccess) {
          controls.showProcessingSuccess?.(disposition.successStatus, disposition.successReason);
        }
        if (disposition.shouldShowAttachedBadge) {
          setBadge("LeakGuard attached a sanitized local file.");
          hideBadgeSoon(3200);
        }
        refreshBadgeFromCurrentInput();
        return {
          handled: true,
          ok: true,
          strategy: handoffClassification.strategy
        };
      }

      if (handoffClassification.shouldFailProcessing) {
        controls.failProcessing?.(handoffClassification.reason, "Raw file upload blocked");
      }
      return blockStreamingLocalFile(
        event,
        streamingPlan.genericAttach.failureTitle,
        handoffResult.message || streamingPlan.genericAttach.failureMessage
      );
    }

    return Object.freeze({
      maybeHandleStreamingRequiredLocalFile
    });
  }

  root.PWM.StreamingFileInsertOrchestration = Object.freeze({
    createStreamingFileInsertOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.StreamingFileInsertOrchestration;
  }
})();
