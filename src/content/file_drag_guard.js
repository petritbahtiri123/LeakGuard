(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  const markerRoot = typeof window !== "undefined" ? window : root;
  const initMarker = "__LEAKGUARD_FILE_DRAG_GUARD_INIT__";

  if (root.__PWM_FILE_DRAG_GUARD__) {
    markerRoot[initMarker] =
      markerRoot[initMarker] || {
        initialized: true,
        api: root.__PWM_FILE_DRAG_GUARD__
      };
    return;
  }

  if (markerRoot[initMarker]?.api) {
    root.__PWM_FILE_DRAG_GUARD__ = markerRoot[initMarker].api;
    return;
  }

  if (markerRoot[initMarker]?.initialized) {
    return;
  }

  const initState = {
    initialized: true,
    api: null
  };
  markerRoot[initMarker] = initState;

  const handledDrops = new WeakSet();
  const boundRoots = new WeakSet();
  const listenerOptions = { capture: true, passive: false };
  let dropHandler = null;
  let dragHandler = null;
  let dragEndHandler = null;
  let fileDragActive = false;

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

  function blockFileEvent(event, setDropEffect = false) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    if (setDropEffect && event.dataTransfer) {
      try {
        event.dataTransfer.dropEffect = "copy";
      } catch {
        // Some DataTransfer implementations expose dropEffect as read-only.
      }
    }
  }

  function notifyFileDragDetected(event) {
    if (fileDragActive) return;
    fileDragActive = true;
    if (typeof dragHandler === "function") {
      try {
        dragHandler(event);
      } catch {
        // Synchronous raw-file blocking must not depend on diagnostic/discovery callbacks.
      }
    }
  }

  function preventFileDrag(event) {
    if (isSanitizedFileHandoffEvent(event) || !dataTransferLooksLikeFiles(event.dataTransfer)) {
      return false;
    }

    blockFileEvent(event, true);
    notifyFileDragDetected(event);
    return true;
  }

  function consumeFileDrop(event) {
    if (isSanitizedFileHandoffEvent(event) || !dataTransferLooksLikeFiles(event.dataTransfer)) {
      return;
    }

    blockFileEvent(event, false);
    notifyFileDragDetected(event);

    if (handledDrops.has(event)) return;
    handledDrops.add(event);
    fileDragActive = false;

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

  function handleDragEnd(event) {
    if (!fileDragActive) return;
    fileDragActive = false;
    if (typeof dragEndHandler === "function") {
      try {
        dragEndHandler(event);
      } catch {
        // Session cleanup is best-effort; future drops are still blocked synchronously.
      }
    }
  }

  function bind(rootTarget) {
    if (!rootTarget || typeof rootTarget.addEventListener !== "function" || boundRoots.has(rootTarget)) {
      return;
    }

    boundRoots.add(rootTarget);
    rootTarget.addEventListener("dragenter", preventFileDrag, listenerOptions);
    rootTarget.addEventListener("dragover", preventFileDrag, listenerOptions);
    rootTarget.addEventListener("drop", consumeFileDrop, listenerOptions);
    rootTarget.addEventListener("dragend", handleDragEnd, listenerOptions);
  }

  bind(window);
  bind(document);
  bind(document.documentElement);
  bind(document.body);

  if (!document.body) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        bind(document.documentElement);
        bind(document.body);
      },
      { once: true }
    );
  }

  const api = {
    initialized: true,
    dataTransferLooksLikeFiles,
    setDropHandler(handler) {
      dropHandler = typeof handler === "function" ? handler : null;
    },
    setDragHandler(handler) {
      dragHandler = typeof handler === "function" ? handler : null;
    },
    setDragEndHandler(handler) {
      dragEndHandler = typeof handler === "function" ? handler : null;
    },
    bind
  };
  initState.api = api;
  root.__PWM_FILE_DRAG_GUARD__ = api;
})();
