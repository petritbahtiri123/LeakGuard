(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;

  if (root.__PWM_FILE_DRAG_GUARD__) {
    return;
  }

  const handledDrops = new WeakSet();
  let dropHandler = null;

  function dataTransferLooksLikeFiles(dataTransfer) {
    if (!dataTransfer) return false;

    const types = Array.from(dataTransfer.types || []);
    if (types.includes("Files")) return true;
    if (Number(dataTransfer.files?.length || 0) > 0) return true;

    return Array.from(dataTransfer.items || []).some(
      (item) => String(item?.kind || "").toLowerCase() === "file"
    );
  }

  function isSanitizedFileHandoffEvent(event) {
    return Boolean(event?.__PWM_SANITIZED_FILE_HANDOFF__);
  }

  function preventFileDrag(event) {
    if (isSanitizedFileHandoffEvent(event) || !dataTransferLooksLikeFiles(event.dataTransfer)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      try {
        event.dataTransfer.dropEffect = "copy";
      } catch {
        // Some DataTransfer implementations expose dropEffect as read-only.
      }
    }
    return true;
  }

  function consumeFileDrop(event) {
    if (isSanitizedFileHandoffEvent(event) || !dataTransferLooksLikeFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    if (handledDrops.has(event)) return;
    handledDrops.add(event);

    if (typeof dropHandler === "function") {
      try {
        const result = dropHandler(event);
        if (result && typeof result.catch === "function") {
          result.catch(() => {});
        }
      } catch {
        // Raw file delivery is already blocked; the full content script owns user-facing errors.
      }
    }
  }

  function bind(rootTarget) {
    if (!rootTarget || typeof rootTarget.addEventListener !== "function") return;
    rootTarget.addEventListener("dragenter", preventFileDrag, true);
    rootTarget.addEventListener("dragover", preventFileDrag, true);
    rootTarget.addEventListener("drop", consumeFileDrop, true);
  }

  bind(window);
  bind(document);

  root.__PWM_FILE_DRAG_GUARD__ = {
    dataTransferLooksLikeFiles,
    setDropHandler(handler) {
      dropHandler = typeof handler === "function" ? handler : null;
    },
    bind
  };
})();
