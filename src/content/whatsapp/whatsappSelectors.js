(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createWhatsAppSelectors(options = {}) {
    const documentRef = options.documentRef || (typeof document !== "undefined" ? document : null);
    const setTimeoutFn = typeof options.setTimeoutFn === "function" ? options.setTimeoutFn : setTimeout;
    const clearTimeoutFn = typeof options.clearTimeoutFn === "function" ? options.clearTimeoutFn : clearTimeout;
    const MutationObserverRef =
      typeof options.MutationObserverRef === "function"
        ? options.MutationObserverRef
        : (typeof MutationObserver === "function" ? MutationObserver : null);
    const isFileInputElement =
      typeof options.isFileInputElement === "function" ? options.isFileInputElement : () => false;
    const fileInputAcceptsHandoffFiles =
      typeof options.fileInputAcceptsHandoffFiles === "function"
        ? options.fileInputAcceptsHandoffFiles
        : () => false;
    const isSupportedWhatsAppAttachImageFile =
      typeof options.isSupportedWhatsAppAttachImageFile === "function"
        ? options.isSupportedWhatsAppAttachImageFile
        : () => false;
    const isWhatsAppHandoffContext =
      typeof options.isWhatsAppHandoffContext === "function" ? options.isWhatsAppHandoffContext : () => false;

    function shouldUseWhatsAppDocumentInputForFiles(files) {
      const expectedFiles = Array.from(files || []).filter(Boolean);
      return Boolean(expectedFiles.length && expectedFiles.some((file) => !isSupportedWhatsAppAttachImageFile(file)));
    }

    function isWhatsAppDocumentFileInputForHandoff(fileInput, files, selectorOptions = {}) {
      if (!isFileInputElement(fileInput)) return false;
      if (fileInput.disabled && selectorOptions.allowDisabled !== true) return false;
      const expectedFiles = Array.from(files || []).filter(Boolean);
      if (!fileInputAcceptsHandoffFiles(fileInput, expectedFiles)) return false;
      const accept = String(fileInput.accept || fileInput.getAttribute?.("accept") || "").trim().toLowerCase();
      if (accept === "*" || accept === "*/*") return true;
      return Boolean(accept && expectedFiles.some((file) => !isSupportedWhatsAppAttachImageFile(file)));
    }

    function findWhatsAppDocumentFileInputForHandoff(files) {
      try {
        return Array.from(documentRef?.querySelectorAll?.("input[type='file']") || []).find((candidate) =>
          isWhatsAppDocumentFileInputForHandoff(candidate, files)
        ) || null;
      } catch {
        return null;
      }
    }

    function findDisabledWhatsAppDocumentFileInputForHandoff(files) {
      try {
        return Array.from(documentRef?.querySelectorAll?.("input[type='file']") || []).find((candidate) =>
          candidate.disabled &&
            Boolean(candidate.closest?.("[data-shell='whatsapp'], footer, [data-testid='conversation-panel-wrapper'], [role='application'], main")) &&
            isWhatsAppDocumentFileInputForHandoff(candidate, files, { allowDisabled: true })
        ) || null;
      } catch {
        return null;
      }
    }

    function findWhatsAppAttachButtonForDocumentHandoff() {
      try {
        return Array.from(documentRef?.querySelectorAll?.("button[aria-label], [role='button'][aria-label]") || []).find((candidate) =>
          String(candidate.getAttribute?.("aria-label") || "").trim().toLowerCase() === "attach" &&
            Boolean(candidate.closest?.("[data-shell='whatsapp'], footer, [data-testid='conversation-panel-wrapper'], [role='application'], main"))
        ) || null;
      } catch {
        return null;
      }
    }

    function findWhatsAppDocumentMenuItemForHandoff() {
      try {
        return Array.from(documentRef?.querySelectorAll?.("button[aria-label], [role='menuitem'][aria-label]") || []).find((candidate) =>
          String(candidate.getAttribute?.("aria-label") || "").trim().toLowerCase() === "document"
        ) || null;
      } catch {
        return null;
      }
    }

    function waitForWhatsAppDocumentFileInput(files, timeoutMs = 1200) {
      const expectedFiles = Array.from(files || []).filter(Boolean);
      const existing = findWhatsAppDocumentFileInputForHandoff(expectedFiles);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve) => {
        let settled = false;
        let observer = null;
        let timer = 0;
        const finish = (input = null) => {
          if (settled) return;
          settled = true;
          if (observer) {
            try {
              observer.disconnect();
            } catch {
              // Best-effort cleanup for a short-lived DOM wait.
            }
          }
          if (timer) clearTimeoutFn(timer);
          resolve(input);
        };
        const check = () => {
          const input = findWhatsAppDocumentFileInputForHandoff(expectedFiles);
          if (input) finish(input);
        };
        try {
          if (typeof MutationObserverRef === "function") {
            observer = new MutationObserverRef(check);
            observer.observe(documentRef?.documentElement || documentRef?.body, { childList: true, subtree: true });
          }
        } catch {
          observer = null;
        }
        timer = setTimeoutFn(() => finish(null), timeoutMs);
        setTimeoutFn(check, 0);
      });
    }

    async function resolveWhatsAppDocumentDropInputForHandoff(_event, _input, files) {
      const expectedFiles = Array.from(files || []).filter(Boolean);
      if (!isWhatsAppHandoffContext() || !shouldUseWhatsAppDocumentInputForFiles(expectedFiles)) return null;
      const existing = findWhatsAppDocumentFileInputForHandoff(expectedFiles);
      if (existing) return existing;
      const disabledExisting = findDisabledWhatsAppDocumentFileInputForHandoff(expectedFiles);
      if (disabledExisting) {
        try {
          disabledExisting.disabled = false;
          disabledExisting.removeAttribute?.("disabled");
          return disabledExisting;
        } catch {
          return null;
        }
      }

      const attachButton = findWhatsAppAttachButtonForDocumentHandoff();
      if (!attachButton) return null;
      try {
        attachButton.click();
      } catch {
        return null;
      }

      const afterAttachInput = findWhatsAppDocumentFileInputForHandoff(expectedFiles);
      if (afterAttachInput) return afterAttachInput;

      let documentMenuItem = findWhatsAppDocumentMenuItemForHandoff();
      if (!documentMenuItem) {
        await new Promise((resolve) => setTimeoutFn(resolve, 0));
        documentMenuItem = findWhatsAppDocumentMenuItemForHandoff();
      }
      if (!documentMenuItem) return null;
      try {
        documentMenuItem.click();
      } catch {
        return null;
      }
      return waitForWhatsAppDocumentFileInput(expectedFiles);
    }

    return Object.freeze({
      shouldUseWhatsAppDocumentInputForFiles,
      isWhatsAppDocumentFileInputForHandoff,
      findWhatsAppDocumentFileInputForHandoff,
      findDisabledWhatsAppDocumentFileInputForHandoff,
      findWhatsAppAttachButtonForDocumentHandoff,
      findWhatsAppDocumentMenuItemForHandoff,
      waitForWhatsAppDocumentFileInput,
      resolveWhatsAppDocumentDropInputForHandoff
    });
  }

  root.PWM.WhatsAppSelectors = Object.freeze({
    createWhatsAppSelectors
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.WhatsAppSelectors;
  }
})();
