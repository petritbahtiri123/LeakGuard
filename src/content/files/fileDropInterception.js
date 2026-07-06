(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileDropInterception(options = {}) {
    const dataTransferLooksLikeFiles =
      typeof options.dataTransferLooksLikeFiles === "function"
        ? options.dataTransferLooksLikeFiles
        : () => false;
    const handleFileDragDetected =
      typeof options.handleFileDragDetected === "function" ? options.handleFileDragDetected : () => {};

    function maybeHandleFileDrag(event) {
      if (!dataTransferLooksLikeFiles(event?.dataTransfer)) {
        return undefined;
      }

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (event.dataTransfer) {
        try {
          event.dataTransfer.dropEffect = "copy";
        } catch {
          // Some DataTransfer implementations expose dropEffect as read-only.
        }
      }

      handleFileDragDetected(event);
      return { handled: true };
    }

    return Object.freeze({
      maybeHandleFileDrag
    });
  }

  root.PWM.FileDropInterception = Object.freeze({
    createFileDropInterception
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileDropInterception;
  }
})();
