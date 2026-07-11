(function initSanitizedFileHandoff(root) {
  "use strict";

  const PWM = (root.PWM = root.PWM || {});

  function getFinalFileExtension(fileName) {
    const match = String(fileName || "").trim().match(/(\.[a-z0-9][a-z0-9+_-]{0,15})$/i);
    return match ? match[1] : "";
  }

  function getCollisionSafeFileSuffix(fileName) {
    const name = String(fileName || "").trim();
    const redactedSuffix = name.match(/(\.redacted\.[a-z0-9][a-z0-9+_-]{0,15})$/i);
    return redactedSuffix ? redactedSuffix[1] : getFinalFileExtension(name);
  }

  function defaultCloneSanitizedFileWithName(file, name) {
    if (!file || typeof root.File !== "function") return null;
    try {
      const lastModified = Number(file.lastModified);
      return new root.File([file], name, {
        type: String(file.type || ""),
        ...(Number.isFinite(lastModified) ? { lastModified } : {})
      });
    } catch {
      return null;
    }
  }

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
    const cloneSanitizedFileWithName =
      dependencies.cloneSanitizedFileWithName || defaultCloneSanitizedFileWithName;

    function normalizeSanitizedBatchFileNames(sanitizedFiles) {
      const files = Array.from(sanitizedFiles || []).filter(Boolean);
      if (files.length === 0) return files;

      const nameKeys = files.map((file) => String(file?.name || "").trim().toLowerCase());
      const nameCounts = new Map();
      for (const name of nameKeys) {
        if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      }
      const requiresRename = nameKeys.map((name) => !name || (nameCounts.get(name) || 0) > 1);
      if (!requiresRename.some(Boolean)) return files;

      const reservedNames = new Set(
        nameKeys.filter((name, index) => name && !requiresRename[index])
      );

      const renamed = files.map((file, index) => {
        if (!requiresRename[index]) return file;
        const suffix = getCollisionSafeFileSuffix(file?.name);
        const baseName = `file-${index + 1}`;
        let name = `${baseName}${suffix}`;
        let attempt = 2;
        while (reservedNames.has(name.toLowerCase())) {
          name = `${baseName}-${attempt}${suffix}`;
          attempt += 1;
        }
        reservedNames.add(name.toLowerCase());
        const clone = cloneSanitizedFileWithName(file, name);
        if (!clone || clone === file || String(clone.name || "") !== name) return null;
        if (Number(clone.size || 0) !== Number(file.size || 0)) return null;
        if (String(clone.type || "").toLowerCase() !== String(file.type || "").toLowerCase()) return null;
        if (
          Number.isFinite(Number(file.lastModified)) &&
          Number(clone.lastModified) !== Number(file.lastModified)
        ) {
          return null;
        }
        return clone;
      });

      return renamed.every(Boolean) ? renamed : null;
    }

    function createInputEvent(type) {
      return new EventRef(type, {
        bubbles: true,
        cancelable: true,
        composed: true
      });
    }

    function handOffSanitizedFileInput(fileInput, transfer, options) {
      if (!isFileInputElement(fileInput) || !transfer) return false;
      if (isFirefoxRuntime() && !canAssignFilesToInput()) return false;

      const handoffOptions = options || {};
      const details = handoffOptions.details || null;
      const dispatchInputEvent = handoffOptions.dispatchInput !== false;
      const markAsSanitized = handoffOptions.markSanitized !== false;
      const events = [];
      const transferFileList = transfer.files;
      if (!transferFileList) return false;
      const transferFiles = Array.from(transferFileList || []);
      if (transferFiles.length === 0) return false;
      let restorePreparedInput = null;
      try {
        if (typeof handoffOptions.prepareInput === "function") {
          restorePreparedInput = handoffOptions.prepareInput(fileInput, transferFiles);
        }
        fileInput.files = transferFileList;
        if (details) details.inputFilesAssignmentSucceeded = true;
        const assignedFiles = Array.from(fileInput.files || []);
        const exactAssignment =
          transferFiles.length > 0 &&
          assignedFiles.length === transferFiles.length &&
          assignedFiles.every((file, index) => file === transferFiles[index]);
        if (!exactAssignment) {
          if (details) details.failureReason = "input_files_assignment_mismatch";
          debugFileAttachMetadata("file-handoff:assignment-verification-failed", {
            expectedCount: transferFiles.length,
            assignedCount: assignedFiles.length
          });
          clearLocalFileInputSelection(fileInput);
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
          files: transferFiles.map(describeFileForDebug)
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
      const sourceFiles = Array.from(sanitizedFiles || []).filter(Boolean);
      const verifyWhatsAppBatch = options.verifyWhatsAppBatch === true;
      const originalFiles = Array.from(options.originalFiles || []).filter(Boolean);
      if (verifyWhatsAppBatch && originalFiles.length > 0) {
        const rawOriginals = new Set(originalFiles);
        if (sourceFiles.some((file) => rawOriginals.has(file))) {
          debugFileAttachMetadata("file-handoff:raw-original-source-rejected", {
            expectedCount: sourceFiles.length
          });
          return false;
        }
      }

      const batchFiles = normalizeSanitizedBatchFileNames(sourceFiles);
      if (!batchFiles || batchFiles.length === 0) {
        debugFileAttachMetadata("file-handoff:batch-filename-normalization-failed", {
          expectedCount: sourceFiles.length
        });
        return false;
      }
      const transfer = createSanitizedDataTransfer(batchFiles);
      if (!transfer) return false;
      const assignSanitizedBatchToInput = (fileInput, assignOptions = {}) => {
        const assigned = handOffSanitizedFileInput(fileInput, transfer, {
          dispatchInput: true,
          prepareInput: assignOptions.prepareInput
        });
        if (!assigned || !verifyWhatsAppBatch) return assigned;
        const verification = verifyWhatsAppSanitizedMultiFileAttach(fileInput, batchFiles, originalFiles);
        if (verification.ok) {
          debugFileAttachMetadata("file-handoff:whatsapp-multi-file-attach-verified", {
            fileCount: verification.assignedCount,
            files: batchFiles.map(describeFileForDebug)
          });
          return true;
        }
        debugFileAttachMetadata("file-handoff:whatsapp-multi-file-attach-verification-failed", {
          reason: verification.reason,
          assignedCount: verification.assignedCount,
          expectedCount: verification.expectedCount,
          files: batchFiles.map(describeFileForDebug)
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
        if (shouldUseWhatsAppDocumentInputForFiles(batchFiles)) {
          const documentInput = await resolveWhatsAppDocumentDropInputForHandoff(event, input, batchFiles);
          if (documentInput && assignSanitizedBatchToInput(documentInput)) {
            debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-document-input-verified", {
              fileCount: batchFiles.length,
              files: batchFiles.map(describeFileForDebug)
            });
            return true;
          }
          debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-document-input-verification-failed", {
            reason: documentInput ? "document_file_input_assignment_failed" : "document_file_input_not_found",
            expectedCount: batchFiles.length,
            files: batchFiles.map(describeFileForDebug)
          });
          return false;
        }
        const fileInput = resolveFileInputForHandoff(event, input, {
          expectedFiles: batchFiles
        });
        if (fileInput && assignSanitizedBatchToInput(fileInput)) {
          debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-input-verified", {
            fileCount: batchFiles.length,
            files: batchFiles.map(describeFileForDebug)
          });
          return true;
        }
        if (!fileInput) {
          const fallbackInput = resolveFileInputForHandoff(event, input, {
            expectedFiles: batchFiles,
            allowIncompatible: true
          });
          if (
            fallbackInput &&
            assignSanitizedBatchToInput(fallbackInput, { prepareInput: prepareFileInputForSanitizedHandoff })
          ) {
            debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-prepared-input-verified", {
              fileCount: batchFiles.length,
              files: batchFiles.map(describeFileForDebug)
            });
            return true;
          }
          debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-prepared-input-verification-failed", {
            reason: fallbackInput ? "prepared_file_input_assignment_failed" : "file_input_not_found",
            expectedCount: batchFiles.length,
            files: batchFiles.map(describeFileForDebug)
          });
          return false;
        }
        debugFileAttachMetadata("file-handoff:whatsapp-multi-file-drop-input-verification-failed", {
          reason: "file_input_assignment_failed",
          expectedCount: batchFiles.length,
          files: batchFiles.map(describeFileForDebug)
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
