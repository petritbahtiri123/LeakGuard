(function initSanitizedFileHandoff(root) {
  "use strict";

  const PWM = (root.PWM = root.PWM || {});

  function createSanitizedFileHandoff(dependencies = {}) {
    const documentRef = dependencies.documentRef || root.document || {};
    const EventRef = dependencies.EventRef || root.Event;
    const isFileInputElement = dependencies.isFileInputElement || (() => false);
    const isFirefoxRuntime = dependencies.isFirefoxRuntime || (() => false);
    const canAssignFilesToInput = dependencies.canAssignFilesToInput || (() => false);
    const getCurrentHandoffDriverId = dependencies.getCurrentHandoffDriverId || (() => "");
    const isProtectedFileDropDriver = dependencies.isProtectedFileDropDriver || (() => false);
    const markFirefoxFileInputTransactionReplaced =
      dependencies.markFirefoxFileInputTransactionReplaced || (() => {});
    const markSanitizedFileHandoff = dependencies.markSanitizedFileHandoff || (() => {});
    const markUntrackedSanitizedFileInputHandoff =
      dependencies.markUntrackedSanitizedFileInputHandoff || (() => {});
    const deleteSanitizedFileHandoffMark = dependencies.deleteSanitizedFileHandoffMark || (() => {});
    const assignSafeFileAttachErrorMetadata = dependencies.assignSafeFileAttachErrorMetadata || (() => {});
    const describeFileForDebug = dependencies.describeFileForDebug || (() => ({}));
    const describeFileInputForDebug = dependencies.describeFileInputForDebug || (() => ({}));
    const debugFileAttachMetadata = dependencies.debugFileAttachMetadata || (() => {});
    const debugReveal = dependencies.debugReveal || (() => {});
    const createSanitizedDataTransfer = dependencies.createSanitizedDataTransfer || (() => null);
    const dispatchSanitizedFileEvent = dependencies.dispatchSanitizedFileEvent || (() => false);
    const prepareFileInputForSanitizedHandoff = dependencies.prepareFileInputForSanitizedHandoff || (() => () => {});
    const resolveFileInputForHandoff = dependencies.resolveFileInputForHandoff || (() => null);
    const shouldUseWhatsAppDocumentInputForFiles =
      dependencies.shouldUseWhatsAppDocumentInputForFiles || (() => false);
    const resolveWhatsAppDocumentDropInputForHandoff =
      dependencies.resolveWhatsAppDocumentDropInputForHandoff || (async () => null);
    const verifyWhatsAppSanitizedMultiFileAttach =
      dependencies.verifyWhatsAppSanitizedMultiFileAttach || (() => ({ ok: false }));
    const clearLocalFileInputSelection = dependencies.clearLocalFileInputSelection || (() => {});

    function createInputEvent(type) {
      return new EventRef(type, {
        bubbles: true,
        cancelable: true,
        composed: true
      });
    }

    function handOffSanitizedFileInput(fileInput, transfer, options) {
      if (!isFileInputElement(fileInput) || !transfer?.files) return false;
      if (isFirefoxRuntime() && !canAssignFilesToInput()) return false;

      const handoffOptions = options || {};
      const details = handoffOptions.details || null;
      const dispatchInputEvent = handoffOptions.dispatchInput !== false;
      const markAsSanitized = handoffOptions.markSanitized !== false;
      const events = [];
      const transferFiles = Array.from(transfer.files || []);
      let restorePreparedInput = null;
      try {
        if (typeof handoffOptions.prepareInput === "function") {
          restorePreparedInput = handoffOptions.prepareInput(fileInput, transferFiles);
        }
        fileInput.files = transfer.files;
        if (details) details.inputFilesAssignmentSucceeded = true;
        if (Number(fileInput.files?.length || 0) <= 0) {
          if (details) details.failureReason = "input_files_assignment_empty";
          return false;
        }
        if (markAsSanitized) {
          markSanitizedFileHandoff(fileInput, fileInput.files, { details });
        } else {
          markUntrackedSanitizedFileInputHandoff(fileInput);
        }
        if (isFirefoxRuntime() && isProtectedFileDropDriver(getCurrentHandoffDriverId())) {
          markFirefoxFileInputTransactionReplaced(fileInput, fileInput.files);
        }
        if (dispatchInputEvent) {
          fileInput.dispatchEvent(createInputEvent("input"));
          events.push("input");
          if (details) details.inputEventDispatched = true;
        }
        fileInput.dispatchEvent(createInputEvent("change"));
        events.push("change");
        if (details) details.changeEventDispatched = true;
        debugFileAttachMetadata("file-handoff:assignment-success", {
          input: describeFileInputForDebug(fileInput, "resolved"),
          files: Array.from(fileInput.files || []).map(describeFileForDebug),
          events
        });
        return true;
      } catch (error) {
        if (details) {
          details.failureReason = "input_assignment_or_event_dispatch_failed";
          assignSafeFileAttachErrorMetadata(details, error);
        }
        debugReveal("file-handoff:assignment-failure", {
          input: describeFileInputForDebug(fileInput, "resolved"),
          files: Array.from(transfer.files || []).map(describeFileForDebug)
        });
        deleteSanitizedFileHandoffMark(fileInput, transferFiles);
        try {
          fileInput.value = "";
        } catch {
          // The original raw file must remain blocked if sanitized file assignment fails.
        }
        return false;
      } finally {
        if (typeof restorePreparedInput === "function") {
          restorePreparedInput();
        }
      }
    }

    async function handOffSanitizedFileBatch(event, input, sanitizedFiles, context, options = {}) {
      const transfer = createSanitizedDataTransfer(sanitizedFiles);
      if (!transfer) return false;
      const verifyWhatsAppBatch = options.verifyWhatsAppBatch === true;
      const originalFiles = Array.from(options.originalFiles || []);
      const assignSanitizedBatchToInput = (fileInput, assignOptions = {}) => {
        const assigned = handOffSanitizedFileInput(fileInput, transfer, {
          dispatchInput: true,
          prepareInput: assignOptions.prepareInput
        });
        if (!assigned || !verifyWhatsAppBatch) return assigned;
        const verification = verifyWhatsAppSanitizedMultiFileAttach(fileInput, sanitizedFiles, originalFiles);
        if (verification.ok) {
          debugFileAttachMetadata("file-handoff:whatsapp-multi-file-attach-verified", {
            fileCount: verification.assignedCount,
            files: Array.from(sanitizedFiles || []).map(describeFileForDebug)
          });
          return true;
        }
        debugFileAttachMetadata("file-handoff:whatsapp-multi-file-attach-verification-failed", {
          reason: verification.reason,
          assignedCount: verification.assignedCount,
          expectedCount: verification.expectedCount,
          files: Array.from(sanitizedFiles || []).map(describeFileForDebug)
        });
        clearLocalFileInputSelection(fileInput);
        return false;
      };

      if (context === "file-input" && isFileInputElement(event?.target)) {
        return assignSanitizedBatchToInput(event.target);
      }

      const target = event?.target || input || documentRef.activeElement;
      const shouldUseWhatsAppDropInputHandoff = context === "drop" && verifyWhatsAppBatch;
      if (shouldUseWhatsAppDropInputHandoff) {
        if (shouldUseWhatsAppDocumentInputForFiles(sanitizedFiles)) {
          const documentInput = await resolveWhatsAppDocumentDropInputForHandoff(event, input, sanitizedFiles);
          if (documentInput && assignSanitizedBatchToInput(documentInput)) {
            debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-document-input-verified", {
              fileCount: sanitizedFiles.length,
              files: Array.from(sanitizedFiles || []).map(describeFileForDebug)
            });
            return true;
          }
          debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-document-input-verification-failed", {
            reason: documentInput ? "document_file_input_assignment_failed" : "document_file_input_not_found",
            expectedCount: sanitizedFiles.length,
            files: Array.from(sanitizedFiles || []).map(describeFileForDebug)
          });
          return false;
        }
        const fileInput = resolveFileInputForHandoff(event, input, {
          expectedFiles: sanitizedFiles
        });
        if (fileInput && assignSanitizedBatchToInput(fileInput)) {
          debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-input-verified", {
            fileCount: sanitizedFiles.length,
            files: Array.from(sanitizedFiles || []).map(describeFileForDebug)
          });
          return true;
        }
        if (!fileInput) {
          const fallbackInput = resolveFileInputForHandoff(event, input, {
            expectedFiles: sanitizedFiles,
            allowIncompatible: true
          });
          if (
            fallbackInput &&
            assignSanitizedBatchToInput(fallbackInput, { prepareInput: prepareFileInputForSanitizedHandoff })
          ) {
            debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-prepared-input-verified", {
              fileCount: sanitizedFiles.length,
              files: Array.from(sanitizedFiles || []).map(describeFileForDebug)
            });
            return true;
          }
          debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-prepared-input-verification-failed", {
            reason: fallbackInput ? "prepared_file_input_assignment_failed" : "file_input_not_found",
            expectedCount: sanitizedFiles.length,
            files: Array.from(sanitizedFiles || []).map(describeFileForDebug)
          });
          return false;
        }
        debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-input-verification-failed", {
          reason: "file_input_assignment_failed",
          expectedCount: sanitizedFiles.length,
          files: Array.from(sanitizedFiles || []).map(describeFileForDebug)
        });
        return false;
      }

      const fileInput = resolveFileInputForHandoff(event, input);
      if (fileInput && assignSanitizedBatchToInput(fileInput)) {
        return true;
      }

      if (context === "drop") {
        try {
          transfer.dropEffect = "copy";
        } catch {
          // Some DataTransfer implementations expose dropEffect as read-only.
        }
        return dispatchSanitizedFileEvent(target, "drop", transfer);
      }
      if (context === "paste") {
        return dispatchSanitizedFileEvent(target, "paste", transfer);
      }
      return false;
    }

    return Object.freeze({
      handOffSanitizedFileInput,
      handOffSanitizedFileBatch
    });
  }

  PWM.SanitizedFileHandoff = Object.freeze({
    createSanitizedFileHandoff
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PWM.SanitizedFileHandoff;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
