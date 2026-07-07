(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileDropOrchestration(options = {}) {
    const blockFirefoxGeminiUnavailableDrop =
      typeof options.blockFirefoxGeminiUnavailableDrop === "function"
        ? options.blockFirefoxGeminiUnavailableDrop
        : async () => {};
    const blockWhatsAppFileAttachment =
      typeof options.blockWhatsAppFileAttachment === "function" ? options.blockWhatsAppFileAttachment : async () => {};
    const clearFileDragSession =
      typeof options.clearFileDragSession === "function" ? options.clearFileDragSession : () => {};
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function" ? options.consumeInterceptionEvent : () => {};
    const dataTransferLooksLikeFiles =
      typeof options.dataTransferLooksLikeFiles === "function" ? options.dataTransferLooksLikeFiles : () => false;
    const documentRef = options.documentRef || (typeof document !== "undefined" ? document : {});
    const findComposer = typeof options.findComposer === "function" ? options.findComposer : () => null;
    const getCurrentHandoffDriver =
      typeof options.getCurrentHandoffDriver === "function" ? options.getCurrentHandoffDriver : () => null;
    const getCurrentHandoffDriverId =
      typeof options.getCurrentHandoffDriverId === "function" ? options.getCurrentHandoffDriverId : () => "";
    const getGeminiDropSessionHash =
      typeof options.getGeminiDropSessionHash === "function" ? options.getGeminiDropSessionHash : () => "";
    const getUnsupportedFileBlockedMessage =
      typeof options.getUnsupportedFileBlockedMessage === "function"
        ? options.getUnsupportedFileBlockedMessage
        : () => "";
    const getUnsupportedFileBlockedTitle =
      typeof options.getUnsupportedFileBlockedTitle === "function"
        ? options.getUnsupportedFileBlockedTitle
        : () => "Raw file upload blocked";
    const handOffOriginalLocalFile =
      typeof options.handOffOriginalLocalFile === "function" ? options.handOffOriginalLocalFile : () => {};
    const handleFileDragDetected =
      typeof options.handleFileDragDetected === "function" ? options.handleFileDragDetected : () => {};
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const hideFileProcessingOverlay =
      typeof options.hideFileProcessingOverlay === "function" ? options.hideFileProcessingOverlay : () => {};
    const isExtensionRuntimeAvailable =
      typeof options.isExtensionRuntimeAvailable === "function"
        ? options.isExtensionRuntimeAvailable
        : () => options.extensionRuntimeAvailable === true;
    const isFirefoxDataTransferFileUnavailableSnapshot =
      typeof options.isFirefoxDataTransferFileUnavailableSnapshot === "function"
        ? options.isFirefoxDataTransferFileUnavailableSnapshot
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
    const isSanitizedFileHandoffEvent =
      typeof options.isSanitizedFileHandoffEvent === "function" ? options.isSanitizedFileHandoffEvent : () => false;
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
    const maybeHandleLocalFileInsert =
      typeof options.maybeHandleLocalFileInsert === "function"
        ? options.maybeHandleLocalFileInsert
        : async () => null;
    const rawFileDropInterceptions = options.rawFileDropInterceptions || new WeakSet();
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const resolveLocalFileTransferPolicy =
      typeof options.resolveLocalFileTransferPolicy === "function"
        ? options.resolveLocalFileTransferPolicy
        : () => ({ action: "redact" });
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const setLastGeminiDropSessionHash =
      typeof options.setLastGeminiDropSessionHash === "function" ? options.setLastGeminiDropSessionHash : () => {};
    const shouldBlockUnsupportedFileTransfer =
      typeof options.shouldBlockUnsupportedFileTransfer === "function"
        ? options.shouldBlockUnsupportedFileTransfer
        : () => false;
    const shouldFailClosedProtectedUnsupportedFileTransfer =
      typeof options.shouldFailClosedProtectedUnsupportedFileTransfer === "function"
        ? options.shouldFailClosedProtectedUnsupportedFileTransfer
        : () => false;
    const shouldUseContentFileExtractionPipeline =
      typeof options.shouldUseContentFileExtractionPipeline === "function"
        ? options.shouldUseContentFileExtractionPipeline
        : () => false;
    const showFileProcessingError =
      typeof options.showFileProcessingError === "function" ? options.showFileProcessingError : () => {};
    const showMessageModal =
      typeof options.showMessageModal === "function" ? options.showMessageModal : async () => {};
    const showUnsupportedFilePassThroughNotice =
      typeof options.showUnsupportedFilePassThroughNotice === "function"
        ? options.showUnsupportedFilePassThroughNotice
        : () => {};
    const snapshotLocalFileDataTransfer =
      typeof options.snapshotLocalFileDataTransfer === "function"
        ? options.snapshotLocalFileDataTransfer
        : (transfer) => transfer;

    function isSupportedWhatsAppDrop(snapshotDataTransfer, localTransferFiles) {
      return (
        isSupportedWhatsAppImageAttach(snapshotDataTransfer, "drop") ||
        isSupportedWhatsAppTextDocumentAttach(snapshotDataTransfer, "drop") ||
        isSupportedWhatsAppPdfAttach(snapshotDataTransfer, "drop") ||
        isSupportedWhatsAppDocxAttach(snapshotDataTransfer, "drop") ||
        isSupportedWhatsAppXlsxAttach(snapshotDataTransfer, "drop") ||
        isPotentialWhatsAppMultiFileAttach(localTransferFiles, "drop")
      );
    }

    async function blockUnsupportedAllowedDrop(event, transferPolicy) {
      const unsupportedBlockReason = shouldBlockUnsupportedFileTransfer(transferPolicy)
        ? "firefox_unsupported_file_blocked"
        : "unsupported_protected_file_blocked";
      const unsupportedBlockTitle = getUnsupportedFileBlockedTitle(transferPolicy);
      rawFileDropInterceptions.add(event);
      consumeInterceptionEvent(event);
      showFileProcessingError(unsupportedBlockTitle, {
        site: getCurrentHandoffDriverId(),
        reason: unsupportedBlockReason
      });
      hideFileProcessingOverlay(unsupportedBlockReason);
      setBadge(unsupportedBlockTitle);
      hideBadgeSoon(4200);
      await showMessageModal(unsupportedBlockTitle, getUnsupportedFileBlockedMessage(transferPolicy));
      refreshBadgeFromCurrentInput();
      clearFileDragSession();
    }

    async function blockPolicyDrop(event, transferPolicy) {
      rawFileDropInterceptions.add(event);
      consumeInterceptionEvent(event);
      setBadge("Raw file upload blocked");
      hideBadgeSoon(4200);
      await showMessageModal("Raw file upload blocked", transferPolicy.message);
      refreshBadgeFromCurrentInput();
      clearFileDragSession();
    }

    async function maybeHandleDrop(event) {
      if (
        isSanitizedFileHandoffEvent(event) ||
        rawFileDropInterceptions.has(event) ||
        !dataTransferLooksLikeFiles(event.dataTransfer)
      ) {
        return;
      }

      const snapshotDataTransfer = snapshotLocalFileDataTransfer(event.dataTransfer);
      if (
        isFirefoxRuntime() &&
        isGeminiHost() &&
        isFirefoxDataTransferFileUnavailableSnapshot(snapshotDataTransfer)
      ) {
        await blockFirefoxGeminiUnavailableDrop(event);
        return;
      }

      const localTransferFiles = listLocalTransferFiles(snapshotDataTransfer);
      const supportedWhatsAppDrop = isSupportedWhatsAppDrop(snapshotDataTransfer, localTransferFiles);
      if (isWhatsAppHost() && localTransferFiles.length && !supportedWhatsAppDrop) {
        rawFileDropInterceptions.add(event);
        await blockWhatsAppFileAttachment(event);
        clearFileDragSession();
        return;
      }
      const contentExtractionFile =
        localTransferFiles.length === 1 && shouldUseContentFileExtractionPipeline(localTransferFiles[0])
          ? localTransferFiles[0]
          : null;
      const transferPolicy = resolveLocalFileTransferPolicy(snapshotDataTransfer);
      if (transferPolicy.action === "allow" && !contentExtractionFile) {
        const unsupportedFileMustBlock =
          shouldBlockUnsupportedFileTransfer(transferPolicy) ||
          shouldFailClosedProtectedUnsupportedFileTransfer(transferPolicy);
        if (unsupportedFileMustBlock) {
          await blockUnsupportedAllowedDrop(event, transferPolicy);
          return;
        }
        if (isGeminiHost()) {
          rawFileDropInterceptions.add(event);
          consumeInterceptionEvent(event);
          handOffOriginalLocalFile(event, snapshotDataTransfer, "drop");
          showUnsupportedFilePassThroughNotice(transferPolicy);
          clearFileDragSession();
          return;
        }
        showUnsupportedFilePassThroughNotice(transferPolicy);
        return;
      }

      if (transferPolicy.action === "block") {
        await blockPolicyDrop(event, transferPolicy);
        return;
      }

      rawFileDropInterceptions.add(event);
      consumeInterceptionEvent(event);
      if (isGeminiHost()) {
        setLastGeminiDropSessionHash(getGeminiDropSessionHash(snapshotDataTransfer));
      }

      if (!isExtensionRuntimeAvailable() || isModalOpen()) {
        clearFileDragSession();
        return;
      }

      try {
        handleFileDragDetected(event);
        const input = findComposer(event.target) || findComposer(documentRef.activeElement);
        await maybeHandleLocalFileInsert(event, input, snapshotDataTransfer, "drop");
      } finally {
        clearFileDragSession({ keepDmzOverlay: getCurrentHandoffDriver()?.usesDmzOverlay });
      }
    }

    return Object.freeze({
      maybeHandleDrop
    });
  }

  root.PWM.FileDropOrchestration = Object.freeze({
    createFileDropOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileDropOrchestration;
  }
})();
