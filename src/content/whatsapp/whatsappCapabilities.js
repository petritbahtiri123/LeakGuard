(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createWhatsAppCapabilities(options = {}) {
    const isWhatsAppHost = typeof options.isWhatsAppHost === "function" ? options.isWhatsAppHost : () => false;
    const getCurrentHandoffDriverId =
      typeof options.getCurrentHandoffDriverId === "function" ? options.getCurrentHandoffDriverId : () => "";
    const getFileHandoffAdapterById =
      typeof options.getFileHandoffAdapterById === "function" ? options.getFileHandoffAdapterById : () => null;
    const getFileHandoffAdapterForLocation =
      typeof options.getFileHandoffAdapterForLocation === "function"
        ? options.getFileHandoffAdapterForLocation
        : () => null;
    const dataTransferHasFiles =
      typeof options.dataTransferHasFiles === "function" ? options.dataTransferHasFiles : null;
    const listLocalTransferFiles =
      typeof options.listLocalTransferFiles === "function"
        ? options.listLocalTransferFiles
        : (dataTransfer) => Array.from(dataTransfer?.files || []).filter(Boolean);
    const filePasteHelpers = options.filePasteHelpers || {};

    function getWhatsAppAdapter() {
      return getFileHandoffAdapterById("whatsapp") || getFileHandoffAdapterForLocation();
    }

    function isSupportedWhatsAppClipboardImagePaste(dataTransfer, context = "paste") {
      if (!isWhatsAppHost() || context !== "paste") return false;
      if (typeof dataTransferHasFiles !== "function" || !dataTransferHasFiles(dataTransfer)) return false;
      const files = listLocalTransferFiles(dataTransfer);
      if (files.length !== 1) return false;
      if (typeof filePasteHelpers.isSupportedClipboardImageMimeType !== "function") return false;
      if (!filePasteHelpers.isSupportedClipboardImageMimeType(files[0]?.type)) return false;
      const adapter = getWhatsAppAdapter();
      return adapter?.id === "whatsapp" && adapter.supportsClipboardImagePasteHandoff === true;
    }

    function isWhatsAppSanitizedDropHandoffEnabled(context = "drop") {
      if (!isWhatsAppHost() || context !== "drop") return false;
      const adapter = getWhatsAppAdapter();
      return adapter?.id === "whatsapp" && adapter.supportsSanitizedDropHandoff === true;
    }

    function isWhatsAppHandoffContext() {
      return isWhatsAppHost() || getCurrentHandoffDriverId() === "whatsapp";
    }

    function isWhatsAppSanitizedFileHandoffContext(context = "file-input") {
      return context === "file-input" || isWhatsAppSanitizedDropHandoffEnabled(context);
    }

    function isWhatsAppSanitizedMultiFileAttachEnabled(context = "file-input") {
      if (!isWhatsAppHost() || !isWhatsAppSanitizedFileHandoffContext(context)) return false;
      const adapter = getWhatsAppAdapter();
      return adapter?.id === "whatsapp" && adapter.supportsSanitizedMultiFileAttachHandoff === true;
    }

    function isPotentialWhatsAppMultiFileAttach(files, context = "file-input") {
      return Boolean(
        isWhatsAppSanitizedMultiFileAttachEnabled(context) &&
          Array.from(files || []).length > 1
      );
    }

    return Object.freeze({
      isSupportedWhatsAppClipboardImagePaste,
      isWhatsAppSanitizedDropHandoffEnabled,
      isWhatsAppHandoffContext,
      isWhatsAppSanitizedFileHandoffContext,
      isWhatsAppSanitizedMultiFileAttachEnabled,
      isPotentialWhatsAppMultiFileAttach
    });
  }

  root.PWM.WhatsAppCapabilities = Object.freeze({
    createWhatsAppCapabilities
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.WhatsAppCapabilities;
  }
})();
