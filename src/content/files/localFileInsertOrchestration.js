(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createLocalFileInsertOrchestration(options = {}) {
    const blockWhatsAppFileAttachment =
      typeof options.blockWhatsAppFileAttachment === "function" ? options.blockWhatsAppFileAttachment : async () => {};
    const clearLocalFileInputSelection =
      typeof options.clearLocalFileInputSelection === "function" ? options.clearLocalFileInputSelection : () => {};
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const createSanitizedTextFile =
      typeof options.createSanitizedTextFile === "function" ? options.createSanitizedTextFile : null;
    const dataTransferHasFiles =
      typeof options.dataTransferHasFiles === "function" ? options.dataTransferHasFiles : () => false;
    const describeFileForDebug =
      typeof options.describeFileForDebug === "function" ? options.describeFileForDebug : () => ({});
    const fileAttachPipeline = options.fileAttachPipeline || root.PWM.FileAttachPipeline || {};
    const createProcessingStageControls =
      typeof fileAttachPipeline.createProcessingStageControls === "function"
        ? fileAttachPipeline.createProcessingStageControls
        : () => ({
            failProcessing: () => {},
            hideProcessing: () => {},
            showProcessingSuccess: () => {}
          });
    const getCurrentHandoffDriverId =
      typeof options.getCurrentHandoffDriverId === "function" ? options.getCurrentHandoffDriverId : () => "";
    const getLocalFileAttachPreflightOrchestration =
      typeof options.getLocalFileAttachPreflightOrchestration === "function"
        ? options.getLocalFileAttachPreflightOrchestration
        : () => ({ prepareLocalFileAttachPreflight: async () => ({ done: true, value: false }) });
    const getLocalFileReadOrchestration =
      typeof options.getLocalFileReadOrchestration === "function"
        ? options.getLocalFileReadOrchestration
        : () => ({ readLocalFileForInsert: async () => ({ done: true, value: false }) });
    const getLocalFileSanitizationOrchestration =
      typeof options.getLocalFileSanitizationOrchestration === "function"
        ? options.getLocalFileSanitizationOrchestration
        : () => ({ sanitizeLocalFileForAttach: async () => ({ ok: false }) });
    const getLocalFileTransferPolicyGate =
      typeof options.getLocalFileTransferPolicyGate === "function"
        ? options.getLocalFileTransferPolicyGate
        : () => ({ maybeHandleLocalFileTransferPolicy: async () => null });
    const getSanitizedFileInsertOrchestration =
      typeof options.getSanitizedFileInsertOrchestration === "function"
        ? options.getSanitizedFileInsertOrchestration
        : () => ({ handleSanitizedLocalFileAttach: async () => ({ handled: true, ok: false }) });
    const hideFileProcessingOverlay =
      typeof options.hideFileProcessingOverlay === "function" ? options.hideFileProcessingOverlay : () => {};
    const isExtensionRuntimeAvailable =
      typeof options.isExtensionRuntimeAvailable === "function"
        ? options.isExtensionRuntimeAvailable
        : () => options.extensionRuntimeAvailable === true;
    const isFirefoxRuntime =
      typeof options.isFirefoxRuntime === "function" ? options.isFirefoxRuntime : () => false;
    const isGeminiHost = typeof options.isGeminiHost === "function" ? options.isGeminiHost : () => false;
    const isModalOpen =
      typeof options.isModalOpen === "function" ? options.isModalOpen : () => options.modalOpen === true;
    const isPotentialWhatsAppMultiFileAttach =
      typeof options.isPotentialWhatsAppMultiFileAttach === "function"
        ? options.isPotentialWhatsAppMultiFileAttach
        : () => false;
    const isProtectedFileDropDriver =
      typeof options.isProtectedFileDropDriver === "function" ? options.isProtectedFileDropDriver : () => false;
    const isSupportedWhatsAppClipboardImagePaste =
      typeof options.isSupportedWhatsAppClipboardImagePaste === "function"
        ? options.isSupportedWhatsAppClipboardImagePaste
        : () => false;
    const isSupportedWhatsAppDocxAttach =
      typeof options.isSupportedWhatsAppDocxAttach === "function" ? options.isSupportedWhatsAppDocxAttach : () => false;
    const isSupportedWhatsAppImageAttach =
      typeof options.isSupportedWhatsAppImageAttach === "function"
        ? options.isSupportedWhatsAppImageAttach
        : () => false;
    const isSupportedWhatsAppPdfAttach =
      typeof options.isSupportedWhatsAppPdfAttach === "function" ? options.isSupportedWhatsAppPdfAttach : () => false;
    const isSupportedWhatsAppTextDocumentAttach =
      typeof options.isSupportedWhatsAppTextDocumentAttach === "function"
        ? options.isSupportedWhatsAppTextDocumentAttach
        : () => false;
    const isSupportedWhatsAppXlsxAttach =
      typeof options.isSupportedWhatsAppXlsxAttach === "function" ? options.isSupportedWhatsAppXlsxAttach : () => false;
    const isWhatsAppHost = typeof options.isWhatsAppHost === "function" ? options.isWhatsAppHost : () => false;
    const listLocalTransferFiles =
      typeof options.listLocalTransferFiles === "function" ? options.listLocalTransferFiles : () => [];
    const logFileInterception =
      typeof options.logFileInterception === "function" ? options.logFileInterception : () => {};
    const maybeHandleMultiFileInsert =
      typeof options.maybeHandleMultiFileInsert === "function" ? options.maybeHandleMultiFileInsert : async () => null;
    const readLocalTextFileFromDataTransfer =
      typeof options.readLocalTextFileFromDataTransfer === "function"
        ? options.readLocalTextFileFromDataTransfer
        : null;
    const resolveLocalFileTransferPolicy =
      typeof options.resolveLocalFileTransferPolicy === "function"
        ? options.resolveLocalFileTransferPolicy
        : () => ({});
    const shouldUseContentFileExtractionPipeline =
      typeof options.shouldUseContentFileExtractionPipeline === "function"
        ? options.shouldUseContentFileExtractionPipeline
        : () => false;
    const showFileProcessingError =
      typeof options.showFileProcessingError === "function" ? options.showFileProcessingError : () => {};
    const showFileProcessingSuccess =
      typeof options.showFileProcessingSuccess === "function" ? options.showFileProcessingSuccess : () => {};
    const whatsappFileAttachBlockTitle = options.whatsappFileAttachBlockTitle || "WhatsApp file upload blocked";
    const whatsappFileAttachUnsupportedReason =
      options.whatsappFileAttachUnsupportedReason || "whatsapp_file_attachments_unsupported";

    function isFileInputTarget(event) {
      return event?.target?.tagName === "INPUT" && String(event.target.type || "").toLowerCase() === "file";
    }

    function createAttachModes({
      supportedWhatsAppTextDocumentAttach,
      supportedWhatsAppPdfAttach,
      supportedWhatsAppDocxAttach,
      supportedWhatsAppXlsxAttach
    }) {
      return {
        textDocument: supportedWhatsAppTextDocumentAttach,
        pdf: supportedWhatsAppPdfAttach,
        docx: supportedWhatsAppDocxAttach,
        xlsx: supportedWhatsAppXlsxAttach
      };
    }

    async function maybeHandleLocalFileInsert(event, input, dataTransfer, context) {
      const alreadyConsumedSupportedWhatsAppClipboardImagePaste =
        event?.defaultPrevented === true &&
        context === "paste" &&
        isSupportedWhatsAppClipboardImagePaste(dataTransfer, context);
      if (
        !isExtensionRuntimeAvailable() ||
        isModalOpen() ||
        (event.defaultPrevented &&
          context !== "drop" &&
          !(
            context === "file-input" &&
            (isGeminiHost() || (isFirefoxRuntime() && isProtectedFileDropDriver(getCurrentHandoffDriverId())))
          ) &&
          !alreadyConsumedSupportedWhatsAppClipboardImagePaste) ||
        typeof readLocalTextFileFromDataTransfer !== "function" ||
        typeof createSanitizedTextFile !== "function" ||
        !dataTransferHasFiles(dataTransfer)
      ) {
        return false;
      }

      const localTransferFiles = listLocalTransferFiles(dataTransfer);
      const processingSite = getCurrentHandoffDriverId();
      const { failProcessing, hideProcessing, showProcessingSuccess: showStageProcessingSuccess } =
        createProcessingStageControls({
          site: processingSite,
          showFileProcessingError,
          hideFileProcessingOverlay,
          showFileProcessingSuccess
        });
      const controls = {
        failProcessing,
        hideProcessing,
        showProcessingSuccess: showStageProcessingSuccess
      };
      const supportedWhatsAppImageAttach = isSupportedWhatsAppImageAttach(dataTransfer, context);
      const supportedWhatsAppTextDocumentAttach = isSupportedWhatsAppTextDocumentAttach(dataTransfer, context);
      const supportedWhatsAppPdfAttach = isSupportedWhatsAppPdfAttach(dataTransfer, context);
      const supportedWhatsAppDocxAttach = isSupportedWhatsAppDocxAttach(dataTransfer, context);
      const supportedWhatsAppXlsxAttach = isSupportedWhatsAppXlsxAttach(dataTransfer, context);
      const potentialWhatsAppMultiFileAttach = isPotentialWhatsAppMultiFileAttach(localTransferFiles, context);
      if (
        isWhatsAppHost() &&
        localTransferFiles.length &&
        !isSupportedWhatsAppClipboardImagePaste(dataTransfer, context) &&
        !potentialWhatsAppMultiFileAttach &&
        !supportedWhatsAppImageAttach &&
        !supportedWhatsAppTextDocumentAttach &&
        !supportedWhatsAppPdfAttach &&
        !supportedWhatsAppDocxAttach &&
        !supportedWhatsAppXlsxAttach
      ) {
        failProcessing(whatsappFileAttachUnsupportedReason, whatsappFileAttachBlockTitle);
        return blockWhatsAppFileAttachment(event);
      }
      const multiFileResult = await maybeHandleMultiFileInsert(
        event,
        input,
        localTransferFiles,
        context,
        processingSite,
        controls
      );
      if (multiFileResult) return multiFileResult;

      const contentExtractionFile =
        localTransferFiles.length === 1 && shouldUseContentFileExtractionPipeline(localTransferFiles[0])
          ? localTransferFiles[0]
          : null;
      const transferPolicy = resolveLocalFileTransferPolicy(dataTransfer);
      const transferPolicyResult = await getLocalFileTransferPolicyGate().maybeHandleLocalFileTransferPolicy(
        event,
        transferPolicy,
        { contentExtractionFile }
      );
      if (transferPolicyResult !== null) return transferPolicyResult;

      if (!(event.defaultPrevented && context === "file-input" && isGeminiHost())) {
        consumeInterceptionEvent(event);
      }
      if (
        (supportedWhatsAppImageAttach ||
          supportedWhatsAppTextDocumentAttach ||
          supportedWhatsAppPdfAttach ||
          supportedWhatsAppDocxAttach ||
          supportedWhatsAppXlsxAttach) &&
        isFileInputTarget(event)
      ) {
        clearLocalFileInputSelection(event.target);
      }

      if (context === "file-input") {
        logFileInterception("file input intercepted", {
          files: listLocalTransferFiles(dataTransfer).map(describeFileForDebug),
          browser: isFirefoxRuntime() ? "firefox" : "other"
        });
      }

      const attachModes = createAttachModes({
        supportedWhatsAppTextDocumentAttach,
        supportedWhatsAppPdfAttach,
        supportedWhatsAppDocxAttach,
        supportedWhatsAppXlsxAttach
      });

      try {
        const localFileRead = await getLocalFileReadOrchestration().readLocalFileForInsert({
          event,
          input,
          dataTransfer,
          contentExtractionFile,
          context,
          processingSite,
          controls
        });
        if (localFileRead.done) return localFileRead.value;
        const { localFile, contentExtractionResult } = localFileRead;

        const attachPreflight =
          await getLocalFileAttachPreflightOrchestration().prepareLocalFileAttachPreflight({
            event,
            localFile,
            context,
            attachModes,
            controls: { failProcessing }
          });
        if (attachPreflight.done) return attachPreflight.value;
        const {
          imageRedactionMode,
          sizeInfo,
          shouldSkipTextFallback,
          preflightPlan,
          optimizedStatus
        } = attachPreflight;

        const sanitization = await getLocalFileSanitizationOrchestration().sanitizeLocalFileForAttach({
          localFile,
          contentExtractionResult,
          context,
          processingSite,
          sizeInfo,
          preflightPlan,
          optimizedStatus,
          imageRedactionMode,
          controls: { failProcessing }
        });
        if (!sanitization.ok) return sanitization;
        const { analysis, result, sanitizedFile } = sanitization;

        return getSanitizedFileInsertOrchestration().handleSanitizedLocalFileAttach({
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
          optimizedStatus,
          imageRedactionMode,
          shouldSkipTextFallback,
          attachModes,
          controls
        });
      } catch (error) {
        showFileProcessingError("File processing failed", {
          site: processingSite,
          reason: "exception"
        });
        hideFileProcessingOverlay("exception");
        throw error;
      }
    }

    return Object.freeze({
      maybeHandleLocalFileInsert
    });
  }

  root.PWM.LocalFileInsertOrchestration = Object.freeze({
    createLocalFileInsertOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.LocalFileInsertOrchestration;
  }
})();
