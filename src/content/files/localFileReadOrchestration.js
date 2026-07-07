(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createLocalFileReadOrchestration(options = {}) {
    const clearLocalFileInputSelection =
      typeof options.clearLocalFileInputSelection === "function" ? options.clearLocalFileInputSelection : () => {};
    const debugReveal = typeof options.debugReveal === "function" ? options.debugReveal : () => {};
    const describeFileForDebug =
      typeof options.describeFileForDebug === "function" ? options.describeFileForDebug : () => ({});
    const getFileUnavailableAfterHandoffSuppression =
      typeof options.getFileUnavailableAfterHandoffSuppression === "function"
        ? options.getFileUnavailableAfterHandoffSuppression
        : () => null;
    const getFirefoxRawFileUploadBlockedMessage =
      typeof options.getFirefoxRawFileUploadBlockedMessage === "function"
        ? options.getFirefoxRawFileUploadBlockedMessage
        : () => "";
    const hideBadgeSoon = typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const localFileFromContentExtractionResult =
      typeof options.localFileFromContentExtractionResult === "function"
        ? options.localFileFromContentExtractionResult
        : () => null;
    const logFileInterception =
      typeof options.logFileInterception === "function" ? options.logFileInterception : () => {};
    const maybeHandleStreamingRequiredLocalFile =
      typeof options.maybeHandleStreamingRequiredLocalFile === "function"
        ? options.maybeHandleStreamingRequiredLocalFile
        : async () => null;
    const processFileForAdapterHandoff =
      typeof options.processFileForAdapterHandoff === "function"
        ? options.processFileForAdapterHandoff
        : async () => null;
    const readLocalTextFileFromDataTransfer =
      typeof options.readLocalTextFileFromDataTransfer === "function"
        ? options.readLocalTextFileFromDataTransfer
        : async () => ({ handled: false, ok: false, code: "file_scan_failed" });
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function" ? options.refreshBadgeFromCurrentInput : () => {};
    const setBadge = typeof options.setBadge === "function" ? options.setBadge : () => {};
    const showFileProcessingOverlay =
      typeof options.showFileProcessingOverlay === "function" ? options.showFileProcessingOverlay : () => {};
    const showMessageModal =
      typeof options.showMessageModal === "function" ? options.showMessageModal : async () => {};
    const streamingBlockTitle = options.streamingBlockTitle || "Large file blocked";
    const streamingBlockMessage = options.streamingBlockMessage || "LeakGuard blocked raw file upload.";
    const suppressFileUnavailableAfterHandoff =
      typeof options.suppressFileUnavailableAfterHandoff === "function"
        ? options.suppressFileUnavailableAfterHandoff
        : () => null;

    function isFileInputTarget(event) {
      return event?.target?.tagName === "INPUT" && String(event.target.type || "").toLowerCase() === "file";
    }

    function logScanResult(context, localFile) {
      if (context !== "file-input") return;
      logFileInterception("file scan result", {
        handled: Boolean(localFile.handled),
        ok: Boolean(localFile.ok),
        code: localFile.code || "",
        file: describeFileForDebug(localFile.file || localFile.sourceFile),
        textLength: typeof localFile.text === "string" ? localFile.text.length : 0
      });
    }

    async function failClosedUnreadableLocalFile(localFile, controls) {
      controls.failProcessing?.(localFile.code || "file_scan_failed", "Raw file blocked");
      setBadge("Raw file blocked");
      hideBadgeSoon(4200);
      await showMessageModal(
        "Raw file blocked",
        localFile.message || "LeakGuard blocked raw file upload because local scanning failed."
      );
      refreshBadgeFromCurrentInput();
      return {
        done: true,
        value: {
          handled: true,
          ok: false,
          reason: localFile.code || "file_scan_failed"
        }
      };
    }

    async function failClosedRejectedLocalFile(localFile, context, controls) {
      if (localFile.code === "file_too_large") {
        controls.failProcessing?.(localFile.code || "file_too_large", streamingBlockTitle);
        setBadge(streamingBlockTitle);
        hideBadgeSoon(4200);
        await showMessageModal(streamingBlockTitle, localFile.message || streamingBlockMessage);
      } else {
        const firefoxBlockedMessage =
          localFile.title === "Raw image upload blocked" ? "" : getFirefoxRawFileUploadBlockedMessage(context);
        const blockedTitle = localFile.title || "Raw file blocked";
        controls.failProcessing?.(localFile.code || "file_scan_failed", blockedTitle);
        setBadge(blockedTitle);
        hideBadgeSoon(4200);
        await showMessageModal(
          blockedTitle,
          firefoxBlockedMessage || localFile.message || "LeakGuard blocked raw file upload because local scanning failed."
        );
      }
      refreshBadgeFromCurrentInput();
      return {
        done: true,
        value: {
          handled: true,
          ok: false,
          reason: localFile.code || "file_scan_failed"
        }
      };
    }

    async function readLocalFileForInsert(args = {}) {
      const {
        event,
        input,
        dataTransfer,
        contentExtractionFile,
        context,
        processingSite
      } = args;
      const controls = args.controls || {};

      showFileProcessingOverlay({
        site: processingSite,
        title: "LeakGuard is scanning this file...",
        status: "Scanning file locally...",
        progress: "In progress",
        blocking: true
      });

      const contentExtractionResult = contentExtractionFile
        ? await processFileForAdapterHandoff({
            file: contentExtractionFile,
            context
          })
        : null;
      const localFile = contentExtractionResult
        ? localFileFromContentExtractionResult(contentExtractionResult)
        : await readLocalTextFileFromDataTransfer(dataTransfer);
      logScanResult(context, localFile);

      const unavailableAfterHandoffSuppression =
        context === "file-input"
          ? getFileUnavailableAfterHandoffSuppression(event, dataTransfer, localFile)
          : null;
      if (unavailableAfterHandoffSuppression) {
        controls.hideProcessing?.("suppressed-after-sanitized-handoff");
        return {
          done: true,
          value: suppressFileUnavailableAfterHandoff(event, unavailableAfterHandoffSuppression, localFile)
        };
      }
      if (!localFile.handled) {
        return failClosedUnreadableLocalFile(localFile, controls);
      }

      if (isFileInputTarget(event)) {
        clearLocalFileInputSelection(event.target);
      }

      if (!localFile.ok) {
        if (localFile.code === "firefox_data_transfer_file_unavailable") {
          debugReveal("file-drop:firefox-data-transfer-file-unavailable", {
            reason: "firefox_data_transfer_file_unavailable"
          });
        }
        const streamingResult = await maybeHandleStreamingRequiredLocalFile({
          event,
          input,
          localFile,
          context,
          processingSite,
          controls
        });
        if (streamingResult) {
          return { done: true, value: streamingResult };
        }
        return failClosedRejectedLocalFile(localFile, context, controls);
      }

      return {
        done: false,
        localFile,
        contentExtractionResult
      };
    }

    return Object.freeze({
      readLocalFileForInsert
    });
  }

  root.PWM.LocalFileReadOrchestration = Object.freeze({
    createLocalFileReadOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.LocalFileReadOrchestration;
  }
})();
