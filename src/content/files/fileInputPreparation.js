(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileInputPreparation(options = {}) {
    const isFileInputElement =
      typeof options.isFileInputElement === "function" ? options.isFileInputElement : () => false;

    function getSafeFileExtensionForAccept(file) {
      const name = String(file?.name || "").split(/[\\/]/).pop().toLowerCase();
      const dotIndex = name.lastIndexOf(".");
      return dotIndex >= 0 ? name.slice(dotIndex) : "";
    }

    function fileMatchesAcceptTokenForHandoff(file, token) {
      const acceptToken = String(token || "").trim().toLowerCase();
      if (!acceptToken || acceptToken === "*/*" || acceptToken === "*") return true;
      const extension = getSafeFileExtensionForAccept(file);
      const mimeType = String(file?.type || "").split(";")[0].trim().toLowerCase();
      if (acceptToken.startsWith(".")) return extension === acceptToken;
      if (acceptToken.endsWith("/*")) {
        const prefix = acceptToken.slice(0, -1);
        return Boolean(mimeType && mimeType.startsWith(prefix));
      }
      return Boolean(mimeType && mimeType === acceptToken);
    }

    function fileInputAcceptsHandoffFiles(fileInput, files) {
      const expectedFiles = Array.from(files || []).filter(Boolean);
      if (!expectedFiles.length) return true;
      if (expectedFiles.length > 1 && fileInput?.multiple !== true) return false;
      const accept = String(fileInput?.accept || fileInput?.getAttribute?.("accept") || "").trim();
      if (!accept) return true;
      const tokens = accept.split(",").map((token) => token.trim()).filter(Boolean);
      if (!tokens.length) return true;
      return expectedFiles.every((file) => tokens.some((token) => fileMatchesAcceptTokenForHandoff(file, token)));
    }

    function buildAcceptTokensForHandoffFiles(files) {
      const tokens = [];
      const seen = new Set();
      const addToken = (token) => {
        const value = String(token || "").trim();
        const key = value.toLowerCase();
        if (!value || seen.has(key)) return;
        seen.add(key);
        tokens.push(value);
      };
      Array.from(files || []).filter(Boolean).forEach((file) => {
        addToken(getSafeFileExtensionForAccept(file));
        addToken(String(file?.type || "").split(";")[0].trim());
      });
      return tokens;
    }

    function prepareFileInputForSanitizedHandoff(fileInput, files) {
      if (!isFileInputElement(fileInput)) return () => {};
      const expectedFiles = Array.from(files || []).filter(Boolean);
      const originalAcceptAttribute = fileInput.getAttribute?.("accept");
      const originalAcceptProperty = fileInput.accept;
      const originalMultiple = fileInput.multiple;
      let changed = false;
      if (!fileInputAcceptsHandoffFiles(fileInput, expectedFiles)) {
        const existingTokens = String(fileInput.accept || originalAcceptAttribute || "")
          .split(",")
          .map((token) => token.trim())
          .filter(Boolean);
        const nextAccept = [...existingTokens, ...buildAcceptTokensForHandoffFiles(expectedFiles)].join(",");
        try {
          fileInput.setAttribute?.("accept", nextAccept);
          fileInput.accept = nextAccept;
          changed = true;
        } catch {
          // Assignment verification below still fails closed if WhatsApp cannot accept the sanitized files.
        }
      }
      if (expectedFiles.length > 1 && fileInput.multiple !== true) {
        try {
          fileInput.multiple = true;
          fileInput.setAttribute?.("multiple", "");
          changed = true;
        } catch {
          // Assignment verification below still fails closed if count/order cannot be preserved.
        }
      }
      return () => {
        if (!changed) return;
        try {
          if (originalAcceptAttribute == null) {
            fileInput.removeAttribute?.("accept");
          } else {
            fileInput.setAttribute?.("accept", originalAcceptAttribute);
          }
          fileInput.accept = originalAcceptProperty;
        } catch {
          // Best-effort restoration after sanitized-only assignment.
        }
        try {
          fileInput.multiple = originalMultiple;
          if (originalMultiple) {
            fileInput.setAttribute?.("multiple", "");
          } else {
            fileInput.removeAttribute?.("multiple");
          }
        } catch {
          // Best-effort restoration after sanitized-only assignment.
        }
      };
    }

    return Object.freeze({
      getSafeFileExtensionForAccept,
      fileMatchesAcceptTokenForHandoff,
      fileInputAcceptsHandoffFiles,
      buildAcceptTokensForHandoffFiles,
      prepareFileInputForSanitizedHandoff
    });
  }

  root.PWM.FileInputPreparation = Object.freeze({
    createFileInputPreparation
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileInputPreparation;
  }
})();
