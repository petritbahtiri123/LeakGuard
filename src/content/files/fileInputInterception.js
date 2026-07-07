(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileInputInterception(options = {}) {
    const dataTransferHasFiles =
      typeof options.dataTransferHasFiles === "function" ? options.dataTransferHasFiles : null;

    function isFileInputTarget(target) {
      return (
        target &&
        target.tagName === "INPUT" &&
        String(target.type || "").toLowerCase() === "file"
      );
    }

    function shouldHandleFileInputChange(event, state = {}) {
      return Boolean(
        state.extensionRuntimeAvailable &&
          !state.modalOpen &&
          !event?.defaultPrevented &&
          isFileInputTarget(event?.target) &&
          typeof dataTransferHasFiles === "function"
      );
    }

    function createSelectedTransfer(files) {
      return {
        files: Array.from(files || []),
        types: ["Files"],
        items: []
      };
    }

    function hasSelectedFiles(files) {
      if (typeof dataTransferHasFiles !== "function") return false;
      return dataTransferHasFiles(createSelectedTransfer(files));
    }

    function shouldContinueWithoutComposer(options = {}) {
      if (options.input) return true;
      if (options.isGeminiHost) return true;
      if (options.hasContentExtractionFile) return true;
      if (options.hasFailClosedProtectedUnsupportedFile) return true;
      if (options.hasSupportedWhatsAppAttach) return true;
      if (options.hasWhatsAppFileInputSelection) return true;
      return Boolean(options.isProtectedFileDropDriver);
    }

    return Object.freeze({
      shouldHandleFileInputChange,
      createSelectedTransfer,
      hasSelectedFiles,
      shouldContinueWithoutComposer
    });
  }

  root.PWM.FileInputInterception = Object.freeze({
    createFileInputInterception
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileInputInterception;
  }
})();
