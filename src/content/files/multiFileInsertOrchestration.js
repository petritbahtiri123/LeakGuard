(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createMultiFileInsertOrchestration(options = {}) {
    const fileAttachPipeline = options.fileAttachPipeline || root.PWM.FileAttachPipeline || {};
    const batchProcessor = options.batchProcessor || {};
    const maxSmallFiles =
      Number(options.maxSmallFiles || fileAttachPipeline.MAX_MULTI_FILE_SMALL_ATTACHMENTS) || 20;
    const maxLargeFiles =
      Number(options.maxLargeFiles || fileAttachPipeline.MAX_MULTI_FILE_LARGE_ATTACHMENTS) || 5;
    const smallMaxBytes =
      Number(options.smallMaxBytes || fileAttachPipeline.MULTI_FILE_SMALL_MAX_BYTES) || 4 * 1024 * 1024;
    const supportedMaxBytes =
      Number(options.supportedMaxBytes || fileAttachPipeline.MULTI_FILE_SUPPORTED_MAX_BYTES) || 50 * 1024 * 1024;
    const whatsAppFileAttachUnsupportedReason =
      options.whatsAppFileAttachUnsupportedReason || "whatsapp_file_attachments_unsupported";
    const whatsAppFileAttachBlockTitle =
      options.whatsAppFileAttachBlockTitle || "WhatsApp file upload blocked";

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
              // Event consumption is best-effort in tests and unsupported hosts.
            }
          };
    const debugFileAttachMetadata =
      typeof options.debugFileAttachMetadata === "function" ? options.debugFileAttachMetadata : () => {};
    const getFileHandoffAdapterForLocation =
      typeof options.getFileHandoffAdapterForLocation === "function"
        ? options.getFileHandoffAdapterForLocation
        : () => null;
    const handOffSanitizedFileBatch =
      typeof options.handOffSanitizedFileBatch === "function" ? options.handOffSanitizedFileBatch : async () => false;
    const hideBadgeSoon =
      typeof options.hideBadgeSoon === "function" ? options.hideBadgeSoon : () => {};
    const isFileHandoffAdapterPendingAttachEnabled =
      typeof options.isFileHandoffAdapterPendingAttachEnabled === "function"
        ? options.isFileHandoffAdapterPendingAttachEnabled
        : () => false;
    const isPotentialWhatsAppMultiFileAttach =
      typeof options.isPotentialWhatsAppMultiFileAttach === "function"
        ? options.isPotentialWhatsAppMultiFileAttach
        : () => false;
    const isSupportedWhatsAppMultiFileAttach =
      typeof options.isSupportedWhatsAppMultiFileAttach === "function"
        ? options.isSupportedWhatsAppMultiFileAttach
        : () => false;
    const queuePendingSanitizedFileHandoff =
      typeof options.queuePendingSanitizedFileHandoff === "function"
        ? options.queuePendingSanitizedFileHandoff
        : () => false;
    const refreshBadgeFromCurrentInput =
      typeof options.refreshBadgeFromCurrentInput === "function"
        ? options.refreshBadgeFromCurrentInput
        : () => {};
    const setBadge =
      typeof options.setBadge === "function" ? options.setBadge : () => {};
    const showFileProcessingOverlay =
      typeof options.showFileProcessingOverlay === "function"
        ? options.showFileProcessingOverlay
        : () => {};
    const showMessageModal =
      typeof options.showMessageModal === "function" ? options.showMessageModal : async () => {};
    const updateFileProcessingOverlay =
      typeof options.updateFileProcessingOverlay === "function"
        ? options.updateFileProcessingOverlay
        : () => {};
    const createSanitizedFileHandoffDetails =
      typeof options.createSanitizedFileHandoffDetails === "function"
        ? options.createSanitizedFileHandoffDetails
        : () => ({});
    const getPendingSanitizedAttachPromptMessage =
      typeof options.getPendingSanitizedAttachPromptMessage === "function"
        ? options.getPendingSanitizedAttachPromptMessage
        : () => "Attach sanitized file";

    function createMultiFileAttachPlan(files) {
      if (typeof fileAttachPipeline.createMultiFileAttachPlan === "function") {
        return fileAttachPipeline.createMultiFileAttachPlan(files, {
          maxSmallFiles,
          maxLargeFiles,
          smallMaxBytes,
          supportedMaxBytes
        });
      }
      const fileCount = Array.from(files || []).length;
      return {
        mode: fileCount <= 1 ? "single" : "multi",
        ok: true,
        fileCount,
        smallCount: fileCount,
        largeCount: 0,
        maxSmallFiles,
        maxLargeFiles,
        reason: ""
      };
    }

    function createBlockedBeforeProcessingItems(files, code) {
      if (typeof batchProcessor.createBlockedBeforeProcessingItems === "function") {
        return batchProcessor.createBlockedBeforeProcessingItems(files, code);
      }
      return Array.from(files || []).map((file, index) => ({
        ok: false,
        status: "blocked",
        code,
        summary: {
          index,
          label: `file-${index + 1}`,
          status: "blocked",
          extension: "",
          mimeCategory: String(file?.type || "").split("/")[0].replace(/[^a-z0-9.+-]/gi, "").slice(0, 32),
          sizeBytes: Math.max(0, Number(file?.size || 0) || 0),
          code
        }
      }));
    }

    function createMultiFileStatusSummary(sanitizedItems, blockedItems) {
      if (typeof batchProcessor.createMultiFileStatusSummary === "function") {
        return batchProcessor.createMultiFileStatusSummary(sanitizedItems, blockedItems);
      }
      const attached = Array.from(sanitizedItems || []).map((item) => item.summary || item);
      const blocked = Array.from(blockedItems || []).map((item) => item.summary || item);
      return {
        sanitizedCount: attached.length,
        attachedCount: attached.length,
        blockedCount: blocked.length,
        attached,
        blocked,
        files: [...attached, ...blocked].sort((a, b) => Number(a.index || 0) - Number(b.index || 0))
      };
    }

    function formatMultiFileStatusMessage(summary, formatOptions = {}) {
      if (typeof batchProcessor.formatMultiFileStatusMessage === "function") {
        return batchProcessor.formatMultiFileStatusMessage(summary, formatOptions);
      }
      return "LeakGuard blocked or sanitized this protected upload batch. No raw files were uploaded.";
    }

    async function processLocalFilesForSanitizedBatch(files, context) {
      if (typeof batchProcessor.processLocalFilesForSanitizedBatch === "function") {
        return batchProcessor.processLocalFilesForSanitizedBatch(files, context);
      }
      return [];
    }

    async function maybeHandleMultiFileInsert(event, input, files, context, processingSite, controls) {
      const safeControls = controls || {};
      const isWhatsAppBatch = isPotentialWhatsAppMultiFileAttach(files, context);
      const plan = createMultiFileAttachPlan(files);
      if (plan.mode === "single") return null;

      if (!event.defaultPrevented) {
        consumeInterceptionEvent(event);
      }
      if (event?.target?.tagName === "INPUT" && String(event.target.type || "").toLowerCase() === "file") {
        clearLocalFileInputSelection(event.target);
      }

      if (!plan.ok) {
        const blockedBeforeProcessingItems = createBlockedBeforeProcessingItems(files, plan.reason);
        const blockedBeforeProcessingSummary = createMultiFileStatusSummary([], blockedBeforeProcessingItems);
        safeControls.failProcessing?.(plan.reason, "Raw file upload blocked");
        setBadge("Raw file upload blocked");
        hideBadgeSoon(4200);
        await showMessageModal(
          "Raw file upload blocked",
          formatMultiFileStatusMessage(blockedBeforeProcessingSummary, {
            blockedBeforeProcessing: true,
            reason: plan.reason
          })
        );
        refreshBadgeFromCurrentInput();
        debugFileAttachMetadata("file-handoff:multi-file-blocked", {
          site: processingSite,
          reason: plan.reason,
          fileCount: plan.fileCount,
          smallCount: plan.smallCount,
          largeCount: plan.largeCount,
          maxSmallFiles: plan.maxSmallFiles,
          maxLargeFiles: plan.maxLargeFiles,
          summary: blockedBeforeProcessingSummary
        });
        return { handled: true, ok: false, reason: plan.reason };
      }

      if (isWhatsAppBatch && !isSupportedWhatsAppMultiFileAttach({ files, types: ["Files"], items: [] }, context)) {
        const blockedBeforeProcessingItems = createBlockedBeforeProcessingItems(
          files,
          whatsAppFileAttachUnsupportedReason
        );
        const blockedBeforeProcessingSummary = createMultiFileStatusSummary([], blockedBeforeProcessingItems);
        safeControls.failProcessing?.(whatsAppFileAttachUnsupportedReason, whatsAppFileAttachBlockTitle);
        setBadge(whatsAppFileAttachBlockTitle);
        hideBadgeSoon(4200);
        await showMessageModal(
          whatsAppFileAttachBlockTitle,
          formatMultiFileStatusMessage(blockedBeforeProcessingSummary, {
            blockedBeforeProcessing: true,
            reason: whatsAppFileAttachUnsupportedReason
          })
        );
        refreshBadgeFromCurrentInput();
        debugFileAttachMetadata("file-handoff:multi-file-blocked", {
          site: processingSite,
          reason: whatsAppFileAttachUnsupportedReason,
          fileCount: plan.fileCount,
          summary: blockedBeforeProcessingSummary
        });
        return { handled: true, ok: false, reason: whatsAppFileAttachUnsupportedReason };
      }

      showFileProcessingOverlay({
        site: processingSite,
        title: `LeakGuard is scanning ${plan.fileCount} files...`,
        status: "Scanning files locally...",
        progress: `0/${plan.fileCount}`,
        blocking: true
      });

      let processed;
      try {
        processed = await processLocalFilesForSanitizedBatch(files, context);
      } catch {
        debugFileAttachMetadata("file-handoff:multi-file-redaction-failed", {
          site: processingSite,
          reason: "multi_file_processing_exception"
        });
        safeControls.failProcessing?.("multi_file_processing_exception", "Raw file upload blocked");
        setBadge("Raw file upload blocked");
        hideBadgeSoon(4200);
        await showMessageModal(
          "Raw file upload blocked",
          "LeakGuard blocked the multi-file upload because local sanitization failed. No raw files were uploaded."
        );
        refreshBadgeFromCurrentInput();
        return { handled: true, ok: false, reason: "multi_file_processing_exception" };
      }

      const sanitizedItems = processed.filter((item) => item.ok && item.sanitizedFile);
      const blockedItems = processed.filter((item) => !item.ok);
      const statusSummary = createMultiFileStatusSummary(sanitizedItems, blockedItems);
      debugFileAttachMetadata("file-handoff:multi-file-processed", {
        site: processingSite,
        fileCount: files.length,
        sanitizedCount: sanitizedItems.length,
        blockedCount: blockedItems.length,
        files: statusSummary.files,
        summary: statusSummary
      });

      if (!sanitizedItems.length) {
        safeControls.failProcessing?.("multi_file_all_blocked", "Raw file upload blocked");
        setBadge("Raw file upload blocked");
        hideBadgeSoon(4200);
        await showMessageModal(
          "Raw file upload blocked",
          formatMultiFileStatusMessage(statusSummary)
        );
        refreshBadgeFromCurrentInput();
        return { handled: true, ok: false, reason: "multi_file_all_blocked" };
      }

      if (isWhatsAppBatch && blockedItems.length) {
        const allBlockedSummary = createMultiFileStatusSummary(
          [],
          processed.map((item) => ({
            ...item,
            status: item.ok ? "blocked" : item.status,
            code: item.ok ? "whatsapp_batch_blocked_after_peer_failure" : item.code,
            summary: {
              ...(item.summary || {}),
              status: item.ok ? "blocked" : item.summary?.status || item.status,
              code: item.ok ? "whatsapp_batch_blocked_after_peer_failure" : item.summary?.code || item.code
            }
          }))
        );
        safeControls.failProcessing?.("whatsapp_multi_file_batch_failed", "Raw file upload blocked");
        setBadge("Raw file upload blocked");
        hideBadgeSoon(4200);
        await showMessageModal(
          "Raw file upload blocked",
          formatMultiFileStatusMessage(allBlockedSummary)
        );
        refreshBadgeFromCurrentInput();
        debugFileAttachMetadata("file-handoff:multi-file-blocked", {
          site: processingSite,
          reason: "whatsapp_multi_file_batch_failed",
          fileCount: files.length,
          sanitizedCount: sanitizedItems.length,
          blockedCount: blockedItems.length,
          summary: allBlockedSummary
        });
        return { handled: true, ok: false, reason: "whatsapp_multi_file_batch_failed" };
      }

      updateFileProcessingOverlay({
        site: processingSite,
        status: "Preparing sanitized file upload...",
        progress: `${sanitizedItems.length}/${plan.fileCount}`,
        blocking: true
      });

      const sanitizedFiles = sanitizedItems.map((item) => item.sanitizedFile);
      const pendingPlan = createMultiFileAttachPlan(sanitizedFiles);
      const pendingAdapter = !blockedItems.length ? getFileHandoffAdapterForLocation() : null;
      const canQueuePendingMultiFileHandoff =
        pendingAdapter &&
        (pendingAdapter.id === "gemini" || pendingAdapter.id === "grok") &&
        isFileHandoffAdapterPendingAttachEnabled(pendingAdapter) &&
        sanitizedFiles.length > 1 &&
        pendingPlan.ok;
      const queuePendingMultiFileHandoff = () => {
        if (!canQueuePendingMultiFileHandoff) return false;
        const details = createSanitizedFileHandoffDetails(
          event,
          sanitizedFiles[0],
          `${pendingAdapter.id}:multi-file-pending-user-upload-input`
        );
        if (!queuePendingSanitizedFileHandoff(pendingAdapter, event, input, sanitizedFiles, details)) return false;
        safeControls.showProcessingSuccess?.("Sanitized files ready for attach.", "multi-file-pending-attach");
        setBadge(getPendingSanitizedAttachPromptMessage(pendingAdapter.id));
        hideBadgeSoon(6500);
        refreshBadgeFromCurrentInput();
        return true;
      };
      const shouldPreferPendingMultiFileHandoff = pendingAdapter?.id === "gemini";
      if (shouldPreferPendingMultiFileHandoff && queuePendingMultiFileHandoff()) {
        return {
          handled: true,
          ok: true,
          stage: "pending",
          strategy: `${pendingAdapter.id}-multi-file-pending-sanitized-file-handoff`,
          sanitizedCount: sanitizedItems.length,
          blockedCount: blockedItems.length
        };
      }

      const handoffOk = await handOffSanitizedFileBatch(
        event,
        input,
        sanitizedFiles,
        context,
        {
          verifyWhatsAppBatch: isWhatsAppBatch,
          originalFiles: files
        }
      );
      if (!handoffOk) {
        if (queuePendingMultiFileHandoff()) {
          return {
            handled: true,
            ok: true,
            stage: "pending",
            strategy: `${pendingAdapter.id}-multi-file-pending-sanitized-file-handoff`,
            sanitizedCount: sanitizedItems.length,
            blockedCount: blockedItems.length
          };
        }
        safeControls.failProcessing?.("multi_file_sanitized_handoff_failed", "Raw file upload blocked");
        setBadge("Raw file upload blocked");
        hideBadgeSoon(4200);
        const handoffFailedSummary = createMultiFileStatusSummary(
          [],
          processed.map((item) => ({
            ...item,
            status: item.ok ? "failed" : item.status,
            code: item.ok ? "sanitized_handoff_failed" : item.code,
            summary: {
              ...(item.summary || {}),
              status: item.ok ? "failed" : item.summary?.status || item.status,
              code: item.ok ? "sanitized_handoff_failed" : item.summary?.code || item.code
            }
          }))
        );
        await showMessageModal(
          "Raw file upload blocked",
          formatMultiFileStatusMessage(handoffFailedSummary)
        );
        refreshBadgeFromCurrentInput();
        return { handled: true, ok: false, reason: "multi_file_sanitized_handoff_failed" };
      }

      if (blockedItems.length) {
        safeControls.showProcessingSuccess?.(
          "Sanitized files attached; unsupported files blocked.",
          "multi-file-partial-success"
        );
        setBadge("LeakGuard attached sanitized files; blocked unsafe files.");
        await showMessageModal(
          "Some files were blocked",
          formatMultiFileStatusMessage(statusSummary)
        );
      } else {
        safeControls.showProcessingSuccess?.("Sanitized files attached.", "multi-file-attached");
        setBadge("LeakGuard attached sanitized files.");
      }
      hideBadgeSoon(4200);
      refreshBadgeFromCurrentInput();
      return {
        handled: true,
        ok: true,
        stage: "file",
        strategy: "multi-file-sanitized-file-handoff",
        sanitizedCount: sanitizedItems.length,
        blockedCount: blockedItems.length
      };
    }

    return Object.freeze({
      maybeHandleMultiFileInsert
    });
  }

  root.PWM.MultiFileInsertOrchestration = Object.freeze({
    createMultiFileInsertOrchestration
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.MultiFileInsertOrchestration;
  }
})();
