(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createLocalFileAttachPreflightOrchestration(options = {}) {
    const blockLargeLocalTextPayload =
      typeof options.blockLargeLocalTextPayload === "function"
        ? options.blockLargeLocalTextPayload
        : async () => {};
    const classifyLocalTextPayloadSize =
      typeof options.classifyLocalTextPayloadSize === "function"
        ? options.classifyLocalTextPayloadSize
        : () => ({ zone: "fast", bytes: 0 });
    const fileAttachPipeline = options.fileAttachPipeline || {};
    const classifyFileAttachPreflightPlan =
      typeof fileAttachPipeline.classifyFileAttachPreflightPlan === "function"
        ? fileAttachPipeline.classifyFileAttachPreflightPlan
        : () => ({
            optimizedStatus: { shouldShow: false }
          });
    const getCurrentHandoffDriver =
      typeof options.getCurrentHandoffDriver === "function" ? options.getCurrentHandoffDriver : () => null;
    const isFirefoxRuntime =
      typeof options.isFirefoxRuntime === "function" ? options.isFirefoxRuntime : () => false;
    const isGeminiHost = typeof options.isGeminiHost === "function" ? options.isGeminiHost : () => false;
    const localTextHardBlockTitle =
      options.localTextHardBlockTitle || "Large payload blocked for browser stability";
    const showLocalPayloadOptimizationStatus =
      typeof options.showLocalPayloadOptimizationStatus === "function"
        ? options.showLocalPayloadOptimizationStatus
        : () => {};

    function resolveImageRedactionMode(localFile) {
      return localFile?.imageRedactionMode === true || localFile?.fileOnlyUpload === true;
    }

    function resolveSizeInfo(localFile, imageRedactionMode) {
      if (imageRedactionMode) {
        return {
          zone: "fast",
          bytes: Math.max(0, Number(localFile?.file?.sizeBytes || 0))
        };
      }
      return classifyLocalTextPayloadSize({
        text: localFile?.text,
        sizeBytes: localFile?.file?.sizeBytes
      });
    }

    function resolveShouldSkipTextFallback(localFile, context, attachModes) {
      return (
        localFile?.skipTextFallback === true ||
        attachModes.textDocument === true ||
        attachModes.pdf === true ||
        attachModes.docx === true ||
        attachModes.xlsx === true ||
        (context === "file-input" && isFirefoxRuntime() && isGeminiHost())
      );
    }

    async function prepareLocalFileAttachPreflight(args = {}) {
      const { event, localFile, context } = args;
      const attachModes = args.attachModes || {};
      const controls = args.controls || {};

      const imageRedactionMode = resolveImageRedactionMode(localFile);
      const sizeInfo = resolveSizeInfo(localFile, imageRedactionMode);
      if (sizeInfo.zone === "blocked") {
        controls.failProcessing?.("local_text_payload_too_large", localTextHardBlockTitle);
        await blockLargeLocalTextPayload(event, sizeInfo);
        return { done: true, value: true };
      }

      const shouldSkipTextFallback = resolveShouldSkipTextFallback(localFile, context, attachModes);
      const preflightPlan = classifyFileAttachPreflightPlan({
        context,
        sizeZone: sizeInfo.zone,
        usesDmzOverlay: getCurrentHandoffDriver()?.usesDmzOverlay === true,
        skipTextFallback: shouldSkipTextFallback,
        imageRedactionMode,
        allowPendingFallback: context === "drop"
      });
      const optimizedStatus = preflightPlan.optimizedStatus.shouldShow;
      if (optimizedStatus) {
        showLocalPayloadOptimizationStatus(sizeInfo);
      }

      return {
        done: false,
        imageRedactionMode,
        sizeInfo,
        shouldSkipTextFallback,
        preflightPlan,
        optimizedStatus
      };
    }

    return Object.freeze({
      prepareLocalFileAttachPreflight
    });
  }

  root.PWM.LocalFileAttachPreflightOrchestration = Object.freeze({
    createLocalFileAttachPreflightOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.LocalFileAttachPreflightOrchestration;
  }
})();
