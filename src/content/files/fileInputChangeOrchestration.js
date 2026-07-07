(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileInputChangeOrchestration(options = {}) {
    const clearLocalFileInputSelection =
      typeof options.clearLocalFileInputSelection === "function" ? options.clearLocalFileInputSelection : () => {};
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const contentDebugEvents = options.contentDebugEvents || {};
    const dateNow = typeof options.dateNow === "function" ? options.dateNow : () => Date.now();
    const debugReveal = typeof options.debugReveal === "function" ? options.debugReveal : () => {};
    const describeFileInputForDebug =
      typeof options.describeFileInputForDebug === "function" ? options.describeFileInputForDebug : () => ({});
    const fileInputProcessingSignatures = options.fileInputProcessingSignatures || new WeakMap();
    const findComposer = typeof options.findComposer === "function" ? options.findComposer : () => null;
    const getCurrentHandoffDriverId =
      typeof options.getCurrentHandoffDriverId === "function" ? options.getCurrentHandoffDriverId : () => "";
    const getFileInputInterception =
      typeof options.getFileInputInterception === "function"
        ? options.getFileInputInterception
        : () => ({
            shouldHandleFileInputChange: () => false,
            createSelectedTransfer: (files) => ({ files: Array.from(files || []), types: ["Files"], items: [] }),
            hasSelectedFiles: () => false,
            shouldContinueWithoutComposer: () => false
          });
    const getFileListMetadataSignature =
      typeof options.getFileListMetadataSignature === "function" ? options.getFileListMetadataSignature : () => "";
    const getFirefoxFileInputTransaction =
      typeof options.getFirefoxFileInputTransaction === "function"
        ? options.getFirefoxFileInputTransaction
        : () => null;
    const getSanitizedFileInputHandoffSuppression =
      typeof options.getSanitizedFileInputHandoffSuppression === "function"
        ? options.getSanitizedFileInputHandoffSuppression
        : () => null;
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const isExtensionRuntimeAvailable =
      typeof options.isExtensionRuntimeAvailable === "function"
        ? options.isExtensionRuntimeAvailable
        : () => options.extensionRuntimeAvailable === true;
    const isFirefoxProtectedFileInputEvent =
      typeof options.isFirefoxProtectedFileInputEvent === "function"
        ? options.isFirefoxProtectedFileInputEvent
        : () => false;
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
    const markFirefoxFileInputTransactionReplaced =
      typeof options.markFirefoxFileInputTransactionReplaced === "function"
        ? options.markFirefoxFileInputTransactionReplaced
        : () => {};
    const maybeHandleLocalFileInsert =
      typeof options.maybeHandleLocalFileInsert === "function"
        ? options.maybeHandleLocalFileInsert
        : async () => null;
    const programmaticInputSuppressMs = Number(options.programmaticInputSuppressMs || 500);
    const resolveLocalFileTransferPolicy =
      typeof options.resolveLocalFileTransferPolicy === "function"
        ? options.resolveLocalFileTransferPolicy
        : () => ({ action: "redact" });
    const sanitizedFileInputHandoffs = options.sanitizedFileInputHandoffs || new WeakSet();
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const setFirefoxFileInputTransaction =
      typeof options.setFirefoxFileInputTransaction === "function"
        ? options.setFirefoxFileInputTransaction
        : (_target, transaction) => transaction;
    const shouldFailClosedProtectedUnsupportedFileTransfer =
      typeof options.shouldFailClosedProtectedUnsupportedFileTransfer === "function"
        ? options.shouldFailClosedProtectedUnsupportedFileTransfer
        : () => false;
    const shouldSuppressFirefoxFileInputEvent =
      typeof options.shouldSuppressFirefoxFileInputEvent === "function"
        ? options.shouldSuppressFirefoxFileInputEvent
        : () => false;
    const shouldUseContentFileExtractionPipeline =
      typeof options.shouldUseContentFileExtractionPipeline === "function"
        ? options.shouldUseContentFileExtractionPipeline
        : () => false;
    const suppressSanitizedFileInputHandoffEvent =
      typeof options.suppressSanitizedFileInputHandoffEvent === "function"
        ? options.suppressSanitizedFileInputHandoffEvent
        : () => {};

    function createSelectedFiles(target) {
      return Array.from(target?.files || []);
    }

    function getRuntimeState() {
      return {
        extensionRuntimeAvailable: isExtensionRuntimeAvailable(),
        modalOpen: isModalOpen()
      };
    }

    function getSupportedWhatsAppAttach(selectedTransfer, selectedFiles) {
      return (
        isSupportedWhatsAppImageAttach(selectedTransfer, "file-input") ||
        isSupportedWhatsAppTextDocumentAttach(selectedTransfer, "file-input") ||
        isSupportedWhatsAppPdfAttach(selectedTransfer, "file-input") ||
        isSupportedWhatsAppDocxAttach(selectedTransfer, "file-input") ||
        isSupportedWhatsAppXlsxAttach(selectedTransfer, "file-input") ||
        isPotentialWhatsAppMultiFileAttach(selectedFiles, "file-input")
      );
    }

    function suppressWhatsAppEmptyProcessingEvent(event) {
      consumeInterceptionEvent(event);
      debugReveal("file-input:whatsapp-empty-processing-event-suppressed", {
        eventType: event.type || "",
        input: describeFileInputForDebug(event.target, "whatsapp-processing"),
        reason: "empty_event_during_image_attach_processing"
      });
      return {
        handled: true,
        ok: true,
        strategy: "whatsapp-empty-processing-event-suppressed"
      };
    }

    function suppressDuplicateRawEvent(event, selectedFiles) {
      consumeInterceptionEvent(event);
      debugReveal("file-input:duplicate-raw-event-suppressed", {
        eventType: event.type || "",
        input: describeFileInputForDebug(event.target, "processing"),
        fileCount: selectedFiles.length
      });
      return {
        handled: true,
        ok: true,
        strategy: "duplicate-file-input-event-suppressed"
      };
    }

    async function maybeHandleFileInputChange(event) {
      const inputInterception = getFileInputInterception();
      if (!inputInterception.shouldHandleFileInputChange(event, getRuntimeState())) {
        return;
      }

      const selectedFiles = createSelectedFiles(event.target);
      const processingSignature = fileInputProcessingSignatures.get(event.target) || "";
      if (isWhatsAppHost() && processingSignature && selectedFiles.length === 0) {
        return suppressWhatsAppEmptyProcessingEvent(event);
      }
      const sanitizedHandoffSuppression = getSanitizedFileInputHandoffSuppression(event.target, selectedFiles);
      if (sanitizedHandoffSuppression) {
        suppressSanitizedFileInputHandoffEvent(event, sanitizedHandoffSuppression);
        return {
          handled: true,
          ok: true,
          strategy: "sanitized-file-handoff-suppressed"
        };
      }

      const isFirefoxProtectedInput = isFirefoxProtectedFileInputEvent(event);
      const existingTransaction = isFirefoxProtectedInput ? getFirefoxFileInputTransaction(event.target) : null;

      if (sanitizedFileInputHandoffs.has(event.target)) {
        if (!isFirefoxProtectedInput) {
          debugReveal(contentDebugEvents.FILE_HANDOFF_PENDING_DUPLICATE_SUPPRESSED, {
            eventType: event.type || "",
            input: describeFileInputForDebug(event.target, "sanitized-file-handoff")
          });
          sanitizedFileInputHandoffs.delete(event.target);
          return;
        }
        const currentSignature = getFileListMetadataSignature(event.target.files);
        const isOwnSanitizedRedispatch =
          existingTransaction?.state === "replaced" &&
          (!existingTransaction.sanitizedSignature || currentSignature === existingTransaction.sanitizedSignature) &&
          (!existingTransaction.suppressUntil || dateNow() <= existingTransaction.suppressUntil);
        if (isOwnSanitizedRedispatch) {
          debugReveal(contentDebugEvents.FILE_HANDOFF_PENDING_DUPLICATE_SUPPRESSED, {
            eventType: event.type || "",
            input: describeFileInputForDebug(event.target, "firefox-sanitized-file-handoff"),
            state: existingTransaction.state
          });
          markFirefoxFileInputTransactionReplaced(event.target, event.target.files);
          return;
        }
        sanitizedFileInputHandoffs.delete(event.target);
      }

      if (isFirefoxProtectedInput && shouldSuppressFirefoxFileInputEvent(event, existingTransaction)) {
        if (existingTransaction.state === "processing") {
          consumeInterceptionEvent(event);
        }
        debugReveal("file-input:firefox-transaction-suppressed", {
          eventType: event.type || "",
          state: existingTransaction.state,
          rawSignature: existingTransaction.rawSignature || "",
          sanitizedSignature: existingTransaction.sanitizedSignature || ""
        });
        return;
      }

      if (!inputInterception.hasSelectedFiles(event.target.files)) {
        return;
      }

      const selectedSignature = getFileListMetadataSignature(selectedFiles);
      if (selectedSignature && processingSignature === selectedSignature) {
        return suppressDuplicateRawEvent(event, selectedFiles);
      }

      let transaction = null;
      if (isFirefoxProtectedInput) {
        transaction = setFirefoxFileInputTransaction(event.target, {
          state: "processing",
          rawSignature: selectedSignature,
          startedAt: dateNow(),
          suppressUntil: dateNow() + programmaticInputSuppressMs,
          replacementDispatched: false
        });
        consumeInterceptionEvent(event);
        clearLocalFileInputSelection(event.target);
      }

      const input = findComposer(event.target);
      const selectedTransfer = inputInterception.createSelectedTransfer(selectedFiles);
      const hasContentExtractionFile =
        selectedFiles.length === 1 && shouldUseContentFileExtractionPipeline(selectedFiles[0]);
      const hasSupportedWhatsAppAttach = getSupportedWhatsAppAttach(selectedTransfer, selectedFiles);
      const selectedTransferPolicy = resolveLocalFileTransferPolicy(selectedTransfer);
      const hasFailClosedProtectedUnsupportedFile =
        shouldFailClosedProtectedUnsupportedFileTransfer(selectedTransferPolicy);
      const hasWhatsAppFileInputSelection = isWhatsAppHost() && selectedFiles.length > 0;
      if (
        !inputInterception.shouldContinueWithoutComposer({
          input,
          isGeminiHost: isGeminiHost(),
          hasContentExtractionFile,
          hasFailClosedProtectedUnsupportedFile,
          hasSupportedWhatsAppAttach,
          hasWhatsAppFileInputSelection,
          isFirefoxRuntime: isFirefoxRuntime(),
          isProtectedFileDropDriver: isProtectedFileDropDriver(getCurrentHandoffDriverId()),
          currentHandoffDriverId: getCurrentHandoffDriverId()
        })
      ) {
        return;
      }

      fileInputProcessingSignatures.set(event.target, selectedSignature);
      let result;
      try {
        result = await maybeHandleLocalFileInsert(
          event,
          input,
          selectedTransfer,
          "file-input"
        );
      } finally {
        if (fileInputProcessingSignatures.get(event.target) === selectedSignature) {
          fileInputProcessingSignatures.delete(event.target);
        }
      }
      if (isFirefoxProtectedInput && transaction) {
        const latest = getFirefoxFileInputTransaction(event.target);
        if (result?.ok) {
          setFirefoxFileInputTransaction(event.target, {
            state: "replaced",
            rawSignature: transaction.rawSignature,
            sanitizedSignature: latest?.sanitizedSignature || getFileListMetadataSignature(event.target.files),
            suppressUntil: dateNow() + programmaticInputSuppressMs,
            replacementDispatched: true
          });
          setBadge("LeakGuard replaced the selected file with a sanitized copy.");
          hideBadgeSoon(3200);
        } else if (latest?.state !== "replaced") {
          setFirefoxFileInputTransaction(event.target, {
            state: "failed",
            rawSignature: transaction.rawSignature,
            suppressUntil: dateNow() + programmaticInputSuppressMs
          });
        }
      }
      return result;
    }

    return Object.freeze({
      maybeHandleFileInputChange
    });
  }

  root.PWM.FileInputChangeOrchestration = Object.freeze({
    createFileInputChangeOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileInputChangeOrchestration;
  }
})();
