(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createLocalFileSanitizationOrchestration(options = {}) {
    const analyzeText = typeof options.analyzeText === "function" ? options.analyzeText : () => ({
      normalizedText: "",
      secretFindings: [],
      findings: []
    });
    const clearLocalPayloadOptimizationStatus =
      typeof options.clearLocalPayloadOptimizationStatus === "function"
        ? options.clearLocalPayloadOptimizationStatus
        : () => {};
    const createSanitizedTextFile =
      typeof options.createSanitizedTextFile === "function" ? options.createSanitizedTextFile : () => null;
    const debugFileAttachMetadata =
      typeof options.debugFileAttachMetadata === "function" ? options.debugFileAttachMetadata : () => {};
    const getCurrentHandoffDriver =
      typeof options.getCurrentHandoffDriver === "function" ? options.getCurrentHandoffDriver : () => null;
    const getFirefoxRawFileUploadBlockedMessage =
      typeof options.getFirefoxRawFileUploadBlockedMessage === "function"
        ? options.getFirefoxRawFileUploadBlockedMessage
        : () => "";
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const requestRedaction =
      typeof options.requestRedaction === "function"
        ? options.requestRedaction
        : async (text) => ({ redactedText: text, replacements: [] });
    const scheduleDmzOverlayCleanup =
      typeof options.scheduleDmzOverlayCleanup === "function" ? options.scheduleDmzOverlayCleanup : () => {};
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const setDmzOverlayState = typeof options.setDmzOverlayState === "function" ? options.setDmzOverlayState : () => {};
    const showMessageModal =
      typeof options.showMessageModal === "function" ? options.showMessageModal : async () => {};
    const updateFileProcessingOverlay =
      typeof options.updateFileProcessingOverlay === "function" ? options.updateFileProcessingOverlay : () => {};

    function resultFromReadyContentExtraction(contentExtractionResult, localFile) {
      const contentExtractionFileOnly =
        localFile.fileOnlyUpload === true || contentExtractionResult.fileOnlyUpload === true;
      return {
        result: {
          redactedText: contentExtractionFileOnly ? "" : contentExtractionResult.sanitizedText,
          replacements: []
        },
        sanitizedFile: contentExtractionResult.sanitizedFile,
        analysis: {
          normalizedText: contentExtractionResult.sanitizedText,
          secretFindings: Array.from(
            { length: Number(contentExtractionResult.metadata?.scan?.findingsCount || 0) },
            () => ({})
          ),
          findings: []
        }
      };
    }

    async function sanitizeLocalFileForAttach(args = {}) {
      const {
        localFile,
        contentExtractionResult,
        context,
        processingSite,
        sizeInfo,
        preflightPlan,
        imageRedactionMode
      } = args;
      const optimizedStatus = args.optimizedStatus === true;
      const controls = args.controls || {};

      try {
        if (preflightPlan.sanitizationStatus.shouldSetDmzRedacting) {
          setDmzOverlayState(
            preflightPlan.sanitizationStatus.dmzStatus,
            preflightPlan.sanitizationStatus.dmzMode
          );
        }
        let analysis = analyzeText(localFile.text);
        updateFileProcessingOverlay({
          site: processingSite,
          status: preflightPlan.sanitizationStatus.processingStatus,
          progress: preflightPlan.sanitizationStatus.processingProgress,
          blocking: preflightPlan.sanitizationStatus.processingBlocking
        });

        let result;
        let sanitizedFile;
        if (contentExtractionResult?.status === "ready") {
          const readyResult = resultFromReadyContentExtraction(contentExtractionResult, localFile);
          analysis = readyResult.analysis;
          result = readyResult.result;
          sanitizedFile = readyResult.sanitizedFile;
        } else {
          result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
          sanitizedFile = createSanitizedTextFile(localFile.file, result.redactedText);
        }
        if (!sanitizedFile) {
          throw new Error("sanitized_file_create_failed");
        }
        return {
          ok: true,
          analysis,
          result,
          sanitizedFile
        };
      } catch (error) {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(
            sizeInfo,
            preflightPlan.optimizedStatus.cleanupOnSanitizationFailure
          );
        }
        debugFileAttachMetadata("file-handoff:redaction-failed", {
          context,
          error
        });
        if (context === "drop" && getCurrentHandoffDriver()?.usesDmzOverlay) {
          setDmzOverlayState("Raw file blocked", "failed");
          scheduleDmzOverlayCleanup(3600);
        }
        const sanitizationFailureTitle = imageRedactionMode ? "Raw image upload blocked" : "Raw file upload blocked";
        controls.failProcessing?.("local_file_sanitization_failed", sanitizationFailureTitle);
        setBadge(sanitizationFailureTitle);
        hideBadgeSoon(4200);
        await showMessageModal(
          sanitizationFailureTitle,
          getFirefoxRawFileUploadBlockedMessage(context) ||
            "LeakGuard blocked raw file upload because local sanitization failed."
        );
        refreshBadgeFromCurrentInput();
        return {
          handled: true,
          ok: false,
          reason: "local_file_sanitization_failed"
        };
      }
    }

    return Object.freeze({
      sanitizeLocalFileForAttach
    });
  }

  root.PWM.LocalFileSanitizationOrchestration = Object.freeze({
    createLocalFileSanitizationOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.LocalFileSanitizationOrchestration;
  }
})();
