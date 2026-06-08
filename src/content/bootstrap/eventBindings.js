(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function bindFileDragRoot(rootTarget, options = {}) {
    const eventRoots = options.eventRoots;
    if (
      !rootTarget ||
      typeof rootTarget.addEventListener !== "function" ||
      eventRoots?.has(rootTarget)
    ) {
      return false;
    }

    eventRoots?.add(rootTarget);
    if (options.fileDragGuard?.bind) {
      options.fileDragGuard.bind(rootTarget);
      return true;
    }

    const listenerOptions = { capture: true, passive: false };
    rootTarget.addEventListener("dragenter", options.onFileDrag, listenerOptions);
    rootTarget.addEventListener("dragover", options.onFileDrag, listenerOptions);
    rootTarget.addEventListener("drop", options.onFileDrop, listenerOptions);
    rootTarget.addEventListener("dragend", options.onDragEnd, listenerOptions);
    return true;
  }

  root.PWM.ContentEventBindings = {
    bindFileDragRoot
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ContentEventBindings;
  }
})();
