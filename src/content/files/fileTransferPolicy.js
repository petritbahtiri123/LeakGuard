(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const DEFAULT_UNSUPPORTED_WARNING =
    "LeakGuard did not scan or redact this unsupported file. Supported text, text PDF, DOCX, XLSX, and PNG/JPG/JPEG/WEBP image paths are protected where available. Unsupported archives, executables, legacy Office files, unsupported images, and binary files are blocked on protected sites when LeakGuard cannot safely replace them.";

  function getLocalTextPayloadByteLength(text, fallbackBytes = 0) {
    if (typeof text !== "string") {
      return Math.max(0, Number(fallbackBytes) || 0);
    }

    try {
      if (typeof TextEncoder === "function") {
        return new TextEncoder().encode(text).byteLength;
      }
    } catch {
      // Fall through to a conservative UTF-16 estimate.
    }

    return text.length * 2;
  }

  function classifyLocalTextPayloadSize(payload, options = {}) {
    const constants = options.constants || options;
    const input = payload || {};
    const hardBlockBytes = constants.LOCAL_TEXT_HARD_BLOCK_BYTES || constants.localTextHardBlockBytes || 4 * 1024 * 1024;
    const fastMaxBytes = constants.LOCAL_TEXT_FAST_MAX_BYTES || constants.localTextFastMaxBytes || 2 * 1024 * 1024;
    const optimizedMaxBytes =
      constants.LOCAL_TEXT_OPTIMIZED_MAX_BYTES || constants.localTextOptimizedMaxBytes || 4 * 1024 * 1024;
    const bytes = getLocalTextPayloadByteLength(input.text || "", input.sizeBytes || 0);
    if (bytes > hardBlockBytes) {
      return { zone: "blocked", bytes };
    }

    if (bytes > fastMaxBytes && bytes <= optimizedMaxBytes) {
      return { zone: "optimized", bytes };
    }

    return { zone: "fast", bytes };
  }

  function getUnsupportedWarning(options = {}) {
    return (
      options.unsupportedWarning ||
      options.LOCAL_FILE_UNSUPPORTED_WARNING ||
      root.PWM?.FileScanner?.UNSUPPORTED_COMPOSER_FILE_MESSAGE ||
      root.PWM?.FileLimits?.UNSUPPORTED_COMPOSER_FILE_MESSAGE ||
      DEFAULT_UNSUPPORTED_WARNING
    );
  }

  function classifyLocalFile(file, options = {}) {
    const FileScanner = options.FileScanner || root.PWM?.FileScanner || {};
    if (typeof FileScanner.classifyFileForTextScan === "function") {
      return FileScanner.classifyFileForTextScan({
        fileName: file?.name || "",
        mimeType: file?.type || ""
      });
    }

    return {
      kind: "unknown",
      action: "allow",
      message: getUnsupportedWarning(options)
    };
  }

  function defaultListLocalTransferFiles(dataTransfer) {
    if (typeof root.PWM?.FilePasteHelpers?.listDataTransferFiles === "function") {
      return root.PWM.FilePasteHelpers.listDataTransferFiles(dataTransfer);
    }
    return Array.from(dataTransfer?.files || []).filter(Boolean);
  }

  function resolveLocalFileTransferPolicy(dataTransfer, options = {}) {
    const listLocalTransferFiles = options.listLocalTransferFiles || defaultListLocalTransferFiles;
    const classifyFile = options.classifyLocalFile || ((file) => classifyLocalFile(file, options));
    const files = listLocalTransferFiles(dataTransfer);
    if (!files.length) {
      return { action: "scan" };
    }

    const classifications = files.map(classifyFile);
    if (classifications.some((classification) => classification.action === "scan")) {
      return { action: "scan", files, classifications };
    }

    return {
      action: "allow",
      reason: "unsupported_file_pass_through",
      files,
      classifications,
      message:
        classifications.find((classification) => classification.message)?.message ||
        getUnsupportedWarning(options)
    };
  }

  function shouldBlockUnsupportedFileTransfer(policy, options = {}) {
    return (
      typeof options.isFirefoxRuntime === "function" &&
      options.isFirefoxRuntime() &&
      policy?.action === "allow" &&
      typeof options.dataTransferLooksLikeFiles === "function" &&
      options.dataTransferLooksLikeFiles({ files: policy.files || [], types: ["Files"], items: [] }) &&
      typeof options.isProtectedFileDropDriver === "function" &&
      typeof options.getCurrentHandoffDriverId === "function" &&
      options.isProtectedFileDropDriver(options.getCurrentHandoffDriverId())
    );
  }

  function getUnsupportedFileBlockedMessage(policy) {
    return (
      policy?.message ||
      "LeakGuard blocked this file because Firefox cannot safely pass unsupported files through on protected AI sites. Use the LeakGuard drag/drop box with a supported text file."
    );
  }

  function isFileInputTarget(event) {
    return event?.target?.tagName === "INPUT" && String(event.target.type || "").toLowerCase() === "file";
  }

  function createLocalFileTransferPolicyGate(options = {}) {
    const clearLocalFileInputSelection =
      typeof options.clearLocalFileInputSelection === "function"
        ? options.clearLocalFileInputSelection
        : () => {};
    const consumeInterceptionEvent =
      typeof options.consumeInterceptionEvent === "function"
        ? options.consumeInterceptionEvent
        : (event) => {
            try {
              event?.preventDefault?.();
              event?.stopPropagation?.();
            } catch {
              // Best-effort event ownership for unsupported hosts and tests.
            }
          };
    const getCurrentHandoffDriverId =
      typeof options.getCurrentHandoffDriverId === "function" ? options.getCurrentHandoffDriverId : () => "";
    const getUnsupportedFileBlockedMessageFn =
      typeof options.getUnsupportedFileBlockedMessage === "function"
        ? options.getUnsupportedFileBlockedMessage
        : getUnsupportedFileBlockedMessage;
    const getUnsupportedFileBlockedTitle =
      typeof options.getUnsupportedFileBlockedTitle === "function"
        ? options.getUnsupportedFileBlockedTitle
        : () => "Raw file upload blocked";
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const hideFileProcessingOverlay =
      typeof options.hideFileProcessingOverlay === "function" ? options.hideFileProcessingOverlay : () => {};
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const shouldBlockUnsupportedFileTransferFn =
      typeof options.shouldBlockUnsupportedFileTransfer === "function"
        ? options.shouldBlockUnsupportedFileTransfer
        : (policy) => shouldBlockUnsupportedFileTransfer(policy, options);
    const shouldFailClosedProtectedUnsupportedFileTransfer =
      typeof options.shouldFailClosedProtectedUnsupportedFileTransfer === "function"
        ? options.shouldFailClosedProtectedUnsupportedFileTransfer
        : () => false;
    const showFileProcessingError =
      typeof options.showFileProcessingError === "function" ? options.showFileProcessingError : () => {};
    const showMessageModal =
      typeof options.showMessageModal === "function" ? options.showMessageModal : async () => {};
    const showUnsupportedFilePassThroughNotice =
      typeof options.showUnsupportedFilePassThroughNotice === "function"
        ? options.showUnsupportedFilePassThroughNotice
        : () => {};

    async function maybeHandleLocalFileTransferPolicy(event, transferPolicy, gateOptions = {}) {
      if (transferPolicy?.action === "allow" && !gateOptions.contentExtractionFile) {
        const shouldBlockUnsupported = shouldBlockUnsupportedFileTransferFn(transferPolicy);
        const unsupportedFileMustBlock =
          shouldBlockUnsupported || shouldFailClosedProtectedUnsupportedFileTransfer(transferPolicy);
        if (unsupportedFileMustBlock) {
          const unsupportedBlockReason = shouldBlockUnsupported
            ? "firefox_unsupported_file_blocked"
            : "unsupported_protected_file_blocked";
          const unsupportedBlockTitle = getUnsupportedFileBlockedTitle(transferPolicy);
          if (!event?.defaultPrevented) {
            consumeInterceptionEvent(event);
          }
          if (isFileInputTarget(event)) {
            clearLocalFileInputSelection(event.target);
          }
          showFileProcessingError(unsupportedBlockTitle, {
            site: getCurrentHandoffDriverId(),
            reason: unsupportedBlockReason
          });
          hideFileProcessingOverlay(unsupportedBlockReason);
          setBadge(unsupportedBlockTitle);
          hideBadgeSoon(4200);
          await showMessageModal(unsupportedBlockTitle, getUnsupportedFileBlockedMessageFn(transferPolicy));
          refreshBadgeFromCurrentInput();
          return {
            handled: true,
            ok: false,
            reason: unsupportedBlockReason
          };
        }
        showUnsupportedFilePassThroughNotice(transferPolicy);
        return false;
      }

      if (transferPolicy?.action === "block") {
        if (!event?.defaultPrevented) {
          consumeInterceptionEvent(event);
        }
        showFileProcessingError("Raw file upload blocked", {
          site: getCurrentHandoffDriverId(),
          reason: transferPolicy.reason
        });
        hideFileProcessingOverlay(transferPolicy.reason || "transfer_policy_blocked");
        setBadge("Raw file upload blocked");
        hideBadgeSoon(4200);
        await showMessageModal("Raw file upload blocked", transferPolicy.message);
        refreshBadgeFromCurrentInput();
        return {
          handled: true,
          ok: false,
          reason: transferPolicy.reason
        };
      }

      return null;
    }

    return Object.freeze({
      maybeHandleLocalFileTransferPolicy
    });
  }

  root.PWM.FileTransferPolicy = {
    getLocalTextPayloadByteLength,
    classifyLocalTextPayloadSize,
    classifyLocalFile,
    resolveLocalFileTransferPolicy,
    shouldBlockUnsupportedFileTransfer,
    getUnsupportedFileBlockedMessage,
    createLocalFileTransferPolicyGate
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileTransferPolicy;
  }
})();
