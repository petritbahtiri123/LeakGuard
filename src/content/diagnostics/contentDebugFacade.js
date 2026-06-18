(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createContentDebugFacade(deps = {}) {
    const DebugLogger = deps.DebugLogger || root.PWM?.DebugLogger || {};
    const FileDebugMetadata = deps.FileDebugMetadata || root.PWM?.FileDebugMetadata || {};
    const rootRef = deps.root || root;
    const normalizeText = typeof deps.normalizeText === "function" ? deps.normalizeText : (value) => String(value || "");
    const normalizeEditorInnerText =
      typeof deps.normalizeEditorInnerText === "function" ? deps.normalizeEditorInnerText : normalizeText;
    const normalizeVisiblePlaceholders =
      typeof deps.normalizeVisiblePlaceholders === "function"
        ? deps.normalizeVisiblePlaceholders
        : (value) => String(value || "");
    const placeholderTokenRegex = deps.placeholderTokenRegex || /\[[A-Z_]+_\d+\]/g;
    const getInputText = typeof deps.getInputText === "function" ? deps.getInputText : () => "";
    const getSelectionOffsets = typeof deps.getSelectionOffsets === "function" ? deps.getSelectionOffsets : null;
    const findSendButton = typeof deps.findSendButton === "function" ? deps.findSendButton : null;
    const getHost = typeof deps.getHost === "function" ? deps.getHost : () => rootRef?.location?.hostname || "";
    const isChatGptHost = typeof deps.isChatGptHost === "function" ? deps.isChatGptHost : () => false;
    const createSafeFileAttachDebugPayload =
      typeof deps.createSafeFileAttachDebugPayload === "function"
        ? deps.createSafeFileAttachDebugPayload
        : FileDebugMetadata.createSafeFileAttachDebugPayload;

    function isDebugEnabled() {
      return Boolean(DebugLogger?.isDebugEnabled?.({ root: rootRef }));
    }

    function summarizeDebugText(text) {
      return DebugLogger.summarizeDebugText(text, {
        normalizeText,
        normalizeVisiblePlaceholders,
        placeholderTokenRegex
      });
    }

    function collectComposerDebugSnapshot(input, expected, writeText) {
      return DebugLogger.collectComposerDebugSnapshot(input, expected, writeText, {
        getInputText,
        normalizeText,
        normalizeEditorInnerText,
        normalizeVisiblePlaceholders,
        placeholderTokenRegex
      });
    }

    function debugLogSnapshot(label, input, expected, writeText) {
      if (!isDebugEnabled()) return;
      DebugLogger?.debugSnapshot?.(label, collectComposerDebugSnapshot(input, expected, writeText), { root: rootRef });
    }

    function debugReveal(label, payload) {
      DebugLogger?.debugEvent?.(label, payload || {}, { root: rootRef });
    }

    function debugFileAttachMetadata(label, payload) {
      const safePayload =
        typeof createSafeFileAttachDebugPayload === "function"
          ? createSafeFileAttachDebugPayload(payload)
          : payload || {};
      debugReveal(label, safePayload);
    }

    function debugResponseRehydration(label, payload) {
      debugReveal(label, payload || {});
    }

    function countDebugPlaceholders(text) {
      return (String(text || "").match(new RegExp(placeholderTokenRegex.source, "g")) || []).length;
    }

    function getSafeElementAttribute(el, name) {
      try {
        return String(el?.getAttribute?.(name) || "");
      } catch {
        return "";
      }
    }

    function safeDebugString(value) {
      const text = String(value || "");
      if (!text || text.length > 120) return "";
      if (/(?:bearer|cookie|credential|key|password|raw|reveal|secret|token|sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16})/i.test(text)) {
        return "";
      }
      if (/[A-Za-z0-9+/=_-]{24,}/.test(text)) return "";
      if (/(?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|[\\/][^\\/]+[\\/])/.test(text)) return "";
      return text;
    }

    function safeDebugClassName(value) {
      const text = String(value || "");
      if (!text || text.length > 256) return "";
      if (/[^A-Za-z0-9 _:-]/.test(text)) return "";
      if (/(?:bearer|cookie|key|password|secret|token|sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16})/i.test(text)) return "";
      if (/[A-Za-z0-9+/=_-]{24,}/.test(text)) return "";
      return text;
    }

    function describeFileForDebug(file) {
      return {
        nameLength: String(file?.name || "").length,
        size: Number(file?.size || 0),
        type: String(file?.type || "").split(";")[0].slice(0, 80),
        lastModified: Number(file?.lastModified || 0) || 0
      };
    }

    function describeElementForDebug(el, source = "") {
      const className = typeof el?.className === "string" ? el.className : getSafeElementAttribute(el, "class");
      const ariaLabel = getSafeElementAttribute(el, "aria-label") || el?.ariaLabel || "";
      const title = getSafeElementAttribute(el, "title") || el?.title || "";
      return {
        source,
        tag: String(el?.tagName || "").toLowerCase(),
        idLength: String(el?.id || getSafeElementAttribute(el, "id")).length,
        role: getSafeElementAttribute(el, "role") || el?.role || "",
        type: getSafeElementAttribute(el, "type"),
        ariaLabel: safeDebugString(ariaLabel),
        ariaLabelLength: getSafeElementAttribute(el, "aria-label").length,
        title: safeDebugString(title),
        titleLength: title.length,
        className: safeDebugClassName(className),
        classLength: className.length,
        dataTestIdLength: getSafeElementAttribute(el, "data-testid").length,
        hidden: Boolean(el?.hidden),
        disabled: Boolean(el?.disabled)
      };
    }

    function describeFileInputForDebug(fileInput, source = "") {
      return {
        ...describeElementForDebug(fileInput, source),
        multiple: Boolean(fileInput?.multiple),
        acceptLength: getSafeElementAttribute(fileInput, "accept").length,
        filesLength: Number(fileInput?.files?.length || 0)
      };
    }

    function getDebugTextLength(value) {
      return normalizeText(value || "").length;
    }

    function getChatGptSendButtonDebugState(input) {
      if (typeof rootRef.Element === "undefined" && typeof Element === "undefined") return null;
      try {
        const button = findSendButton?.(input);
        if (!button) return { found: false, enabled: null };
        const disabled = Boolean(button.disabled || button.getAttribute?.("disabled") != null || button.getAttribute?.("aria-disabled") === "true");
        return { found: true, enabled: !disabled };
      } catch {
        return null;
      }
    }

    function getChatGptComposerSyncDebug(input, expectedText = "", actualText = null) {
      const actual = actualText == null ? getInputText(input) : normalizeText(actualText);
      const innerText = normalizeText(input?.innerText || "");
      const textContent = normalizeText(input?.textContent || "");
      let selection = null;
      try { selection = getSelectionOffsets?.(input) || null; } catch { selection = null; }
      let className = "";
      try { className = typeof input?.className === "string" ? input.className : getSafeElementAttribute(input, "class"); } catch { className = ""; }
      return {
        host: getHost(),
        input: {
          tag: input?.tagName || "",
          role: getSafeElementAttribute(input, "role") || input?.role || "",
          contenteditable: getSafeElementAttribute(input, "contenteditable"),
          dataTestIdLength: getSafeElementAttribute(input, "data-testid").length,
          idLength: String(input?.id || getSafeElementAttribute(input, "id")).length,
          classLength: className.length
        },
        expectedLength: getDebugTextLength(expectedText),
        actualLength: getDebugTextLength(actual),
        innerTextLength: getDebugTextLength(innerText),
        textContentLength: getDebugTextLength(textContent),
        placeholderCount: countDebugPlaceholders(actual || expectedText),
        expectedPlaceholderCount: countDebugPlaceholders(expectedText),
        actualPlaceholderCount: countDebugPlaceholders(actual),
        selection: selection && Number.isFinite(Number(selection.start)) && Number.isFinite(Number(selection.end))
          ? { start: Number(selection.start), end: Number(selection.end) }
          : null,
        sendButton: getChatGptSendButtonDebugState(input)
      };
    }

    function debugChatGptSync(label, input, expectedText = "", actualText = null, extra = {}) {
      if (!isChatGptHost()) return;
      debugReveal(label, { ...getChatGptComposerSyncDebug(input, expectedText, actualText), ...(extra || {}) });
    }

    function logFailureDetails(details) {
      DebugLogger?.debugEvent?.("rewrite:verification-failure", details || {}, { root: rootRef });
    }

    function logFileInterception(label, details) {
      debugFileAttachMetadata(`file-interception:${label}`, details || {});
    }

    return {
      isDebugEnabled,
      summarizeDebugText,
      collectComposerDebugSnapshot,
      debugLogSnapshot,
      debugReveal,
      debugFileAttachMetadata,
      debugResponseRehydration,
      countDebugPlaceholders,
      getSafeElementAttribute,
      describeFileForDebug,
      describeElementForDebug,
      describeFileInputForDebug,
      getChatGptComposerSyncDebug,
      debugChatGptSync,
      logFailureDetails,
      logFileInterception
    };
  }

  root.PWM.ContentDebugFacade = { createContentDebugFacade };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ContentDebugFacade;
  }
})();
