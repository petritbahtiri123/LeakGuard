(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createSanitizedFileInsertOrchestration(options = {}) {
    const fileAttachPipeline = options.fileAttachPipeline || root.PWM.FileAttachPipeline || {};
    const clearLocalPayloadOptimizationStatus =
      typeof options.clearLocalPayloadOptimizationStatus === "function"
        ? options.clearLocalPayloadOptimizationStatus
        : () => {};
    const createSanitizedFileHandoffDetails =
      typeof options.createSanitizedFileHandoffDetails === "function"
        ? options.createSanitizedFileHandoffDetails
        : () => ({});
    const debugReveal = typeof options.debugReveal === "function" ? options.debugReveal : () => {};
    const describeFileForDebug =
      typeof options.describeFileForDebug === "function" ? options.describeFileForDebug : () => ({});
    const findComposer = typeof options.findComposer === "function" ? options.findComposer : () => null;
    const getCurrentHandoffDriver =
      typeof options.getCurrentHandoffDriver === "function" ? options.getCurrentHandoffDriver : () => null;
    const getFileHandoffAdapterForLocation =
      typeof options.getFileHandoffAdapterForLocation === "function"
        ? options.getFileHandoffAdapterForLocation
        : () => null;
    const handOffSanitizedLocalFile =
      typeof options.handOffSanitizedLocalFile === "function" ? options.handOffSanitizedLocalFile : async () => false;
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const hideDmzOverlay = typeof options.hideDmzOverlay === "function" ? options.hideDmzOverlay : () => {};
    const isFileHandoffAdapterPendingAttachEnabled =
      typeof options.isFileHandoffAdapterPendingAttachEnabled === "function"
        ? options.isFileHandoffAdapterPendingAttachEnabled
        : () => false;
    const isWhatsAppHost = typeof options.isWhatsAppHost === "function" ? options.isWhatsAppHost : () => false;
    const markWhatsAppSanitizedImageHandoff =
      typeof options.markWhatsAppSanitizedImageHandoff === "function"
        ? options.markWhatsAppSanitizedImageHandoff
        : () => {};
    const queuePendingSanitizedFileHandoff =
      typeof options.queuePendingSanitizedFileHandoff === "function"
        ? options.queuePendingSanitizedFileHandoff
        : () => false;
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const scheduleDmzOverlayCleanup =
      typeof options.scheduleDmzOverlayCleanup === "function" ? options.scheduleDmzOverlayCleanup : () => {};
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const setDmzOverlayState = typeof options.setDmzOverlayState === "function" ? options.setDmzOverlayState : () => {};
    const showMessageModal =
      typeof options.showMessageModal === "function" ? options.showMessageModal : async () => {};
    const updateFileProcessingOverlay =
      typeof options.updateFileProcessingOverlay === "function" ? options.updateFileProcessingOverlay : () => {};

    function applyAttachModes(payload, imageRedactionMode, attachModes = {}) {
      if (imageRedactionMode) {
        payload.allowFileOnlyHandoff = true;
        payload.imageRedactionMode = true;
      }
      if (attachModes.textDocument) {
        payload.allowFileOnlyHandoff = true;
        payload.textDocumentAttachMode = true;
      }
      if (attachModes.pdf) {
        payload.allowFileOnlyHandoff = true;
        payload.pdfAttachMode = true;
      }
      if (attachModes.docx) {
        payload.allowFileOnlyHandoff = true;
        payload.docxAttachMode = true;
      }
      if (attachModes.xlsx) {
        payload.allowFileOnlyHandoff = true;
        payload.xlsxAttachMode = true;
      }
    }

    async function handleSanitizedLocalFileAttach(args = {}) {
      const {
        event,
        input,
        localFile,
        analysis,
        result,
        sanitizedFile,
        context,
        processingSite,
        sizeInfo,
        preflightPlan,
        imageRedactionMode,
        shouldSkipTextFallback
      } = args;
      const optimizedStatus = args.optimizedStatus === true;
      const attachModes = args.attachModes || {};
      const controls = args.controls || {};

      debugReveal("file-handoff:sanitized-file-created", {
        context,
        originalFile: describeFileForDebug(localFile.file),
        sanitizedFile: describeFileForDebug(sanitizedFile),
        findingsCount: analysis.secretFindings.length,
        redactedLength: result.redactedText.length
      });
      const driver = getCurrentHandoffDriver();
      if (preflightPlan.handoffStatus.shouldSetDmzReady) {
        setDmzOverlayState(preflightPlan.handoffStatus.dmzStatus, preflightPlan.handoffStatus.dmzMode);
      }
      updateFileProcessingOverlay({
        site: processingSite,
        status: preflightPlan.handoffStatus.processingStatus,
        progress: preflightPlan.handoffStatus.processingProgress,
        blocking: preflightPlan.handoffStatus.processingBlocking
      });

      const payload = driver.preparePayload(sanitizedFile, result.redactedText, {
        localFile,
        analysis,
        result
      });
      applyAttachModes(payload, imageRedactionMode, attachModes);

      const attachFlow = await fileAttachPipeline.runSanitizedFileAttachFlow({
        context,
        tryDropHandoff: () =>
          driver.handoff(payload, { event, input, context, driver, composerResolved: true }),
        trySanitizedHandoff: () => handOffSanitizedLocalFile(event, input, sanitizedFile, context),
        shouldSkipFallback: () => shouldSkipTextFallback,
        skipFallbackReason: preflightPlan.attachFlowOptions.skipFallbackReason,
        insertFallbackText: () => driver.insertSanitizedText(payload, { event, input, context, driver }),
        allowPendingFallback: preflightPlan.attachFlowOptions.allowPendingFallback && Boolean(sanitizedFile),
        defaultSuccessStrategy: preflightPlan.attachFlowOptions.defaultSuccessStrategy,
        failureReason: preflightPlan.attachFlowOptions.failureReason,
        successStatus: preflightPlan.attachFlowOptions.successStatus,
        fileStrategy: preflightPlan.attachFlowOptions.fileStrategy,
        textStrategy: preflightPlan.attachFlowOptions.textStrategy,
        usesDmzOverlay: driver.usesDmzOverlay === true,
        getPendingAttachFallbackOptions: (handoffClassification) => {
          const pendingAdapter = getFileHandoffAdapterForLocation();
          return {
            pendingAdapter,
            pendingAttachEnabled:
              handoffClassification.shouldContinueFallback &&
              isFileHandoffAdapterPendingAttachEnabled(pendingAdapter),
            adapterId: pendingAdapter?.id
          };
        }
      });
      const handoffResult = attachFlow.handoffResult;
      const handoffClassification = attachFlow.handoffClassification;

      if (attachFlow.action !== "success") {
        if (attachFlow.action === "cancelled") {
          if (optimizedStatus) {
            clearLocalPayloadOptimizationStatus(
              sizeInfo,
              preflightPlan.optimizedStatus.cleanupOnAttachCancellation
            );
          }
          controls.hideProcessing?.(handoffClassification.hideProcessingReason);
          return {
            handled: attachFlow.handled,
            ok: false,
            reason: attachFlow.reason
          };
        }

        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, preflightPlan.optimizedStatus.cleanupOnAttachFailure);
        }
        const pendingAdapter = attachFlow.pendingAttachOptions?.pendingAdapter;
        if (
          attachFlow.action === "pending" &&
          queuePendingSanitizedFileHandoff(
            pendingAdapter,
            event,
            input,
            sanitizedFile,
            createSanitizedFileHandoffDetails(
              event,
              sanitizedFile,
              `${pendingAdapter.id}:pending-after-handoff-failure`
            )
          )
        ) {
          controls.hideProcessing?.("pending");
          hideDmzOverlay();
          return {
            handled: attachFlow.handled,
            ok: true,
            strategy: attachFlow.strategy
          };
        }
        debugReveal("file-handoff:fail-closed", {
          context,
          reason: attachFlow.reason,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        const handoffFailureTitle = imageRedactionMode ? "Raw image upload blocked" : "Raw file upload blocked";
        if (handoffClassification.shouldFailProcessing) {
          controls.failProcessing?.(handoffClassification.reason, handoffFailureTitle);
        }
        setBadge(handoffFailureTitle);
        hideBadgeSoon(4200);
        await showMessageModal(
          handoffFailureTitle,
          handoffResult.message ||
            "LeakGuard blocked raw file upload. Sanitized file handoff failed; use File Scanner or paste redacted text manually."
        );
        refreshBadgeFromCurrentInput();
        return {
          handled: attachFlow.handled,
          ok: false,
          reason: attachFlow.reason
        };
      }

      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(sizeInfo, preflightPlan.optimizedStatus.cleanupOnAttachSuccess);
      }
      const disposition = attachFlow.disposition;
      if (disposition.shouldSetDmzAttached) {
        setDmzOverlayState(disposition.dmzStatus, disposition.dmzMode);
      }
      if (disposition.shouldScheduleDmzCleanup) {
        scheduleDmzOverlayCleanup(disposition.dmzCleanupDelay);
      }
      if (disposition.shouldShowAttachedBadge) {
        setBadge("LeakGuard attached a sanitized local file.");
        hideBadgeSoon(3200);
      }
      if (disposition.shouldHideProcessing) {
        controls.hideProcessing?.(disposition.hideProcessingReason);
      } else if (disposition.shouldShowSuccess) {
        controls.showProcessingSuccess?.(disposition.successStatus, disposition.successReason);
      }
      if (imageRedactionMode && isWhatsAppHost()) {
        markWhatsAppSanitizedImageHandoff(input || findComposer(event.target));
      }
      refreshBadgeFromCurrentInput();
      return {
        handled: handoffClassification.handled,
        ok: true,
        stage: handoffClassification.stage,
        strategy: handoffClassification.strategy
      };
    }

    return Object.freeze({
      handleSanitizedLocalFileAttach
    });
  }

  root.PWM.SanitizedFileInsertOrchestration = Object.freeze({
    createSanitizedFileInsertOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.SanitizedFileInsertOrchestration;
  }
})();
