(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileProcessingUi(options = {}) {
    const documentRef = options.documentRef || (typeof document !== "undefined" ? document : null);
    const setTimeoutFn = typeof options.setTimeoutFn === "function" ? options.setTimeoutFn : setTimeout;
    const clearTimeoutFn = typeof options.clearTimeoutFn === "function" ? options.clearTimeoutFn : clearTimeout;
    const getCurrentHandoffDriverId =
      typeof options.getCurrentHandoffDriverId === "function"
        ? options.getCurrentHandoffDriverId
        : () => "generic";
    const debugReveal = typeof options.debugReveal === "function" ? options.debugReveal : () => {};
    const debugFileAttachMetadata =
      typeof options.debugFileAttachMetadata === "function" ? options.debugFileAttachMetadata : () => {};
    const contentDebugEvents = options.contentDebugEvents || {};
    const describeSanitizedFileOrBatchForDebug =
      typeof options.describeSanitizedFileOrBatchForDebug === "function"
        ? options.describeSanitizedFileOrBatchForDebug
        : () => ({});
    const describeFileHandoffAdapter =
      typeof options.describeFileHandoffAdapter === "function"
        ? options.describeFileHandoffAdapter
        : () => ({});
    const getFileHandoffAdapterById =
      typeof options.getFileHandoffAdapterById === "function" ? options.getFileHandoffAdapterById : () => null;
    const getFileHandoffAdapterForLocation =
      typeof options.getFileHandoffAdapterForLocation === "function"
        ? options.getFileHandoffAdapterForLocation
        : () => null;
    const attachPendingSanitizedFileWithTrustedActivation =
      typeof options.attachPendingSanitizedFileWithTrustedActivation === "function"
        ? options.attachPendingSanitizedFileWithTrustedActivation
        : async () => false;
    const insertPendingSanitizedFileText =
      typeof options.insertPendingSanitizedFileText === "function"
        ? options.insertPendingSanitizedFileText
        : async () => false;
    const downloadPendingSanitizedFile =
      typeof options.downloadPendingSanitizedFile === "function"
        ? options.downloadPendingSanitizedFile
        : async () => false;
    const cancelPendingSanitizedFileAttach =
      typeof options.cancelPendingSanitizedFileAttach === "function"
        ? options.cancelPendingSanitizedFileAttach
        : () => {};
    const handleContentError =
      typeof options.handleContentError === "function"
        ? options.handleContentError
        : (error) => {
            throw error;
          };
    const geminiPendingMessage =
      options.geminiPendingMessage || "Large file sanitized. Click Attach sanitized file or Gemini Upload files.";
    const grokPendingMessage =
      options.grokPendingMessage || "Large file sanitized. Click Attach sanitized file or Grok Upload/Attach.";

    let fileProcessingOverlayEl = null;
    let fileProcessingTitleEl = null;
    let fileProcessingStatusEl = null;
    let fileProcessingProgressEl = null;
    let fileProcessingHideTimer = 0;
    let pendingAttachPromptEl = null;
    let pendingAttachPromptSite = "";

    function getFileProcessingSiteId(site = "") {
      try {
        return String(site || getCurrentHandoffDriverId() || "generic");
      } catch {
        return String(site || "generic");
      }
    }

    function formatFileProcessingProgress(progress) {
      if (progress === null || progress === undefined || progress === false || progress === "") {
        return "";
      }
      if (typeof progress === "number" && Number.isFinite(progress)) {
        return `${Math.max(0, Math.min(100, Math.round(progress)))}%`;
      }
      if (typeof progress === "string") {
        return progress.replace(/\s+/g, " ").trim().slice(0, 80);
      }

      const bytesProcessed = Number(progress?.bytesProcessed ?? progress?.processedBytes ?? 0);
      const totalBytes = Number(progress?.totalBytes ?? progress?.bytesTotal ?? 0);
      if (totalBytes > 0 && bytesProcessed >= 0) {
        const percent = Math.max(0, Math.min(100, Math.round((bytesProcessed / totalBytes) * 100)));
        return `${percent}%`;
      }

      const chunks = Number(
        progress?.chunksProcessed ?? progress?.chunkCount ?? progress?.chunks ?? progress?.chunkIndex ?? 0
      );
      if (chunks > 0) {
        return `${chunks} ${chunks === 1 ? "chunk" : "chunks"}`;
      }

      return "";
    }

    function describeFileProcessingProgress(progress) {
      return {
        text: formatFileProcessingProgress(progress),
        bytesProcessed: Number(progress?.bytesProcessed ?? progress?.processedBytes ?? 0) || 0,
        totalBytes: Number(progress?.totalBytes ?? progress?.bytesTotal ?? 0) || 0,
        chunks: Number(
          progress?.chunksProcessed ?? progress?.chunkCount ?? progress?.chunks ?? progress?.chunkIndex ?? 0
        ) || 0
      };
    }

    function showFileProcessingOverlay(renderOptions = {}) {
      const site = getFileProcessingSiteId(renderOptions.site);
      const title = String(renderOptions.title || "LeakGuard is processing this file locally.");
      const status = String(renderOptions.status || "Processing file locally...");
      const progressText = formatFileProcessingProgress(renderOptions.progress) || "In progress";
      const blocking = renderOptions.blocking !== false;

      if (fileProcessingHideTimer) {
        clearTimeoutFn(fileProcessingHideTimer);
        fileProcessingHideTimer = 0;
      }

      if (typeof documentRef?.createElement !== "function" || !documentRef.documentElement?.appendChild) {
        debugFileAttachMetadata(contentDebugEvents.FILE_UI_PROCESSING_SHOWN || "file-ui:processing-shown", {
          site,
          rendered: false,
          blocking,
          status,
          progress: describeFileProcessingProgress(renderOptions.progress)
        });
        return null;
      }

      if (!fileProcessingOverlayEl?.isConnected) {
        const overlay = documentRef.createElement("div");
        overlay.className = "pwm-file-processing-overlay";
        overlay.setAttribute("role", "status");
        overlay.setAttribute("aria-live", "polite");

        const card = documentRef.createElement("div");
        card.className = "pwm-file-processing-card";

        const titleEl = documentRef.createElement("p");
        titleEl.className = "pwm-file-processing-title";

        const statusEl = documentRef.createElement("p");
        statusEl.className = "pwm-file-processing-status";

        const progressEl = documentRef.createElement("p");
        progressEl.className = "pwm-file-processing-progress";

        card.append(titleEl, statusEl, progressEl);
        overlay.appendChild(card);
        documentRef.documentElement.appendChild(overlay);

        fileProcessingOverlayEl = overlay;
        fileProcessingTitleEl = titleEl;
        fileProcessingStatusEl = statusEl;
        fileProcessingProgressEl = progressEl;
      }

      fileProcessingOverlayEl.dataset.pwmSite = site;
      fileProcessingOverlayEl.dataset.pwmBlocking = blocking ? "true" : "false";
      fileProcessingOverlayEl.dataset.pwmState = "processing";
      fileProcessingTitleEl.textContent = title;
      fileProcessingStatusEl.textContent = status;
      fileProcessingProgressEl.textContent = progressText;

      debugFileAttachMetadata(contentDebugEvents.FILE_UI_PROCESSING_SHOWN || "file-ui:processing-shown", {
        site,
        rendered: true,
        blocking,
        status,
        progress: describeFileProcessingProgress(renderOptions.progress)
      });
      return fileProcessingOverlayEl;
    }

    function updateFileProcessingOverlay(updateOptions = {}) {
      const site = getFileProcessingSiteId(updateOptions.site || fileProcessingOverlayEl?.dataset?.pwmSite);
      if (!fileProcessingOverlayEl?.isConnected) {
        return showFileProcessingOverlay({
          site,
          title: updateOptions.title || "LeakGuard is processing this file locally.",
          status: updateOptions.status || "Processing file locally...",
          progress: updateOptions.progress,
          blocking: updateOptions.blocking
        });
      }

      const status =
        updateOptions.status === undefined ? fileProcessingStatusEl?.textContent || "" : String(updateOptions.status);
      const progressText = formatFileProcessingProgress(updateOptions.progress);
      if (updateOptions.status !== undefined && fileProcessingStatusEl) {
        fileProcessingStatusEl.textContent = status;
      }
      if (fileProcessingProgressEl) {
        fileProcessingProgressEl.textContent = progressText || fileProcessingProgressEl.textContent || "In progress";
      }
      if (updateOptions.blocking !== undefined) {
        fileProcessingOverlayEl.dataset.pwmBlocking = updateOptions.blocking === false ? "false" : "true";
      }

      debugReveal("file-ui:processing-updated", {
        site,
        status,
        progress: describeFileProcessingProgress(updateOptions.progress)
      });
      return fileProcessingOverlayEl;
    }

    function hideFileProcessingOverlay(reason = "") {
      if (fileProcessingHideTimer) {
        clearTimeoutFn(fileProcessingHideTimer);
        fileProcessingHideTimer = 0;
      }

      const overlay = fileProcessingOverlayEl;
      const site = getFileProcessingSiteId(overlay?.dataset?.pwmSite);
      fileProcessingOverlayEl = null;
      fileProcessingTitleEl = null;
      fileProcessingStatusEl = null;
      fileProcessingProgressEl = null;

      if (overlay?.parentNode) {
        try {
          overlay.parentNode.removeChild(overlay);
        } catch {
          // Best-effort cleanup only.
        }
      }

      debugFileAttachMetadata("file-ui:processing-hidden", {
        site,
        reason,
        rendered: Boolean(overlay)
      });
    }

    function showFileProcessingSuccess(status = "Sanitized file attached.", successOptions = {}) {
      const site = getFileProcessingSiteId(successOptions.site);
      if (fileProcessingOverlayEl?.isConnected) {
        updateFileProcessingOverlay({
          site,
          status,
          progress: "Complete",
          blocking: false
        });
        fileProcessingOverlayEl.dataset.pwmState = "success";
      } else {
        showFileProcessingOverlay({
          site,
          title: "LeakGuard finished local file processing.",
          status,
          progress: "Complete",
          blocking: false
        });
        if (fileProcessingOverlayEl) {
          fileProcessingOverlayEl.dataset.pwmState = "success";
        }
      }
      debugReveal("file-ui:success-shown", {
        site,
        status
      });
      fileProcessingHideTimer = setTimeoutFn(() => {
        hideFileProcessingOverlay(successOptions.reason || "success");
      }, Math.max(0, Number(successOptions.hideAfterMs ?? 1200)));
    }

    function showFileProcessingError(status = "Raw file upload blocked", errorOptions = {}) {
      const site = getFileProcessingSiteId(errorOptions.site);
      if (fileProcessingOverlayEl?.isConnected) {
        updateFileProcessingOverlay({
          site,
          status,
          progress: "",
          blocking: false
        });
        fileProcessingOverlayEl.dataset.pwmState = "error";
      }
      debugReveal("file-ui:error-shown", {
        site,
        status,
        reason: errorOptions.reason || ""
      });
    }

    function clearPendingSanitizedAttachPrompt(reason = "") {
      const prompt = pendingAttachPromptEl;
      pendingAttachPromptEl = null;
      const site = prompt?.dataset?.pwmSite || pendingAttachPromptSite || "";
      pendingAttachPromptSite = "";
      if (!prompt) {
        if (site) {
          debugFileAttachMetadata("file-ui:pending-prompt-cleared", {
            site,
            reason,
            rendered: false
          });
        }
        return;
      }
      try {
        prompt.dataset.pwmClearReason = reason || "";
      } catch {
        // Best-effort diagnostics only.
      }
      if (prompt.parentNode) {
        try {
          prompt.parentNode.removeChild(prompt);
        } catch {
          // Best-effort cleanup only.
        }
      }
      debugFileAttachMetadata("file-ui:pending-prompt-cleared", {
        site: site || getFileProcessingSiteId(),
        reason,
        rendered: true
      });
    }

    function getPendingSanitizedAttachPromptMessage(site = "") {
      const id = String(site || getCurrentHandoffDriverId() || "").toLowerCase();
      if (id === "gemini") {
        return geminiPendingMessage;
      }
      if (id === "grok") {
        return grokPendingMessage;
      }
      return "File sanitized. Click Upload/Attach to attach the sanitized version.";
    }

    function showPendingSanitizedAttachPrompt(adapter, pending = null) {
      let selectedAdapter = null;
      let promptOptions = null;
      if (pending) {
        selectedAdapter =
          typeof adapter === "string"
            ? getFileHandoffAdapterById(adapter)
            : adapter || getFileHandoffAdapterForLocation();
        promptOptions = {
          site: selectedAdapter?.id || pending.site || getCurrentHandoffDriverId(),
          sanitizedFile: pending.sanitizedFile || null,
          sanitizedFiles: pending.sanitizedFiles || null,
          message: pending.message || getPendingSanitizedAttachPromptMessage(selectedAdapter?.id || pending.site),
          onAttachClick: () => attachPendingSanitizedFileWithTrustedActivation(selectedAdapter, pending),
          onInsertTextClick: () =>
            insertPendingSanitizedFileText(
              selectedAdapter?.id || pending.site || getCurrentHandoffDriverId(),
              pending.event,
              pending.input,
              pending.sanitizedFiles || pending.sanitizedFile
            ),
          onDownloadClick: () =>
            downloadPendingSanitizedFile(
              selectedAdapter?.id || pending.site || getCurrentHandoffDriverId(),
              pending.event,
              pending.input,
              pending.sanitizedFiles || pending.sanitizedFile
            ),
          onCancelClick: () =>
            cancelPendingSanitizedFileAttach(selectedAdapter?.id || pending.site || getCurrentHandoffDriverId())
        };
      } else {
        promptOptions = adapter || {};
        selectedAdapter =
          promptOptions.adapter || getFileHandoffAdapterById(promptOptions.site) || getFileHandoffAdapterForLocation();
      }
      const site = promptOptions.site || getCurrentHandoffDriverId();
      const sanitizedFile = promptOptions.sanitizedFiles || promptOptions.sanitizedFile || null;
      const pendingFileDebug = describeSanitizedFileOrBatchForDebug(sanitizedFile);
      const message = promptOptions.message || getPendingSanitizedAttachPromptMessage(site);
      const isMultiFilePendingAttach =
        (Array.isArray(promptOptions.sanitizedFiles) && promptOptions.sanitizedFiles.filter(Boolean).length > 1) ||
        (Array.isArray(promptOptions.sanitizedFile) && promptOptions.sanitizedFile.filter(Boolean).length > 1);

      clearPendingSanitizedAttachPrompt("replaced");
      pendingAttachPromptSite = site;

      const runAction = async (label, callback) => {
        debugReveal(`pending-attach-prompt-${label}`, {
          site,
          ...pendingFileDebug
        });
        if (label === "attach-clicked") {
          debugFileAttachMetadata("file-handoff:pending-user-attach-clicked", {
            site,
            adapter: describeFileHandoffAdapter(selectedAdapter),
            ...pendingFileDebug
          });
        }
        if (typeof callback !== "function") return;
        try {
          await callback();
        } catch (error) {
          handleContentError(error);
        }
      };

      if (typeof documentRef?.createElement !== "function" || !documentRef.documentElement?.appendChild) {
        debugReveal(contentDebugEvents.PENDING_ATTACH_PROMPT_SHOWN || "pending-attach-prompt-shown", {
          site,
          rendered: false,
          ...pendingFileDebug
        });
        debugFileAttachMetadata(
          contentDebugEvents.FILE_HANDOFF_PENDING_PROMPT_SHOWN || "file-handoff:pending-prompt-shown",
          {
            site,
            rendered: false,
            adapter: describeFileHandoffAdapter(selectedAdapter),
            ...pendingFileDebug
          }
        );
        debugFileAttachMetadata(contentDebugEvents.FILE_UI_PENDING_PROMPT_SHOWN || "file-ui:pending-prompt-shown", {
          site,
          rendered: false,
          ...pendingFileDebug
        });
        return null;
      }

      const prompt = documentRef.createElement("div");
      prompt.className = "pwm-pending-attach-prompt";
      prompt.dataset.pwmSite = site;
      prompt.setAttribute("role", "status");
      prompt.setAttribute("aria-live", "polite");

      const card = documentRef.createElement("div");
      card.className = "pwm-pending-attach-card";

      const title = documentRef.createElement("p");
      title.className = "pwm-pending-attach-title";
      title.textContent = isMultiFilePendingAttach ? "LeakGuard sanitized the files" : "LeakGuard sanitized the file";

      const body = documentRef.createElement("p");
      body.className = "pwm-pending-attach-message";
      body.textContent = message;

      const actions = documentRef.createElement("div");
      actions.className = "pwm-pending-attach-actions";

      const makeButton = (className, text, label, callback) => {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = text;
        button.addEventListener("click", (clickEvent) => {
          try {
            clickEvent.preventDefault?.();
            clickEvent.stopPropagation?.();
            clickEvent.stopImmediatePropagation?.();
          } catch {
            // Host events can be partial.
          }
          runAction(label, callback);
        });
        return button;
      };

      actions.appendChild(
        makeButton(
          "pwm-pending-attach-btn pwm-pending-attach-primary",
          isMultiFilePendingAttach ? "Attach sanitized files" : "Attach sanitized file",
          "attach-clicked",
          promptOptions.onAttachClick
        )
      );
      if (!isMultiFilePendingAttach) {
        actions.append(
          makeButton(
            "pwm-pending-attach-btn",
            "Insert sanitized text instead",
            "insert-text-clicked",
            promptOptions.onInsertTextClick
          ),
          makeButton(
            "pwm-pending-attach-btn",
            "Download sanitized copy",
            "download-clicked",
            promptOptions.onDownloadClick
          )
        );
      }
      actions.appendChild(
        makeButton(
          "pwm-pending-attach-btn pwm-pending-attach-secondary",
          "Cancel",
          "cancelled",
          promptOptions.onCancelClick
        )
      );

      card.append(title, body, actions);
      prompt.appendChild(card);
      documentRef.documentElement.appendChild(prompt);
      pendingAttachPromptEl = prompt;

      debugReveal(contentDebugEvents.PENDING_ATTACH_PROMPT_SHOWN || "pending-attach-prompt-shown", {
        site,
        rendered: true,
        ...pendingFileDebug
      });
      debugFileAttachMetadata(
        contentDebugEvents.FILE_HANDOFF_PENDING_PROMPT_SHOWN || "file-handoff:pending-prompt-shown",
        {
          site,
          rendered: true,
          adapter: describeFileHandoffAdapter(selectedAdapter),
          ...pendingFileDebug
        }
      );
      debugFileAttachMetadata(contentDebugEvents.FILE_UI_PENDING_PROMPT_SHOWN || "file-ui:pending-prompt-shown", {
        site,
        rendered: true,
        ...pendingFileDebug
      });
      return prompt;
    }

    return Object.freeze({
      getFileProcessingSiteId,
      formatFileProcessingProgress,
      describeFileProcessingProgress,
      showFileProcessingOverlay,
      updateFileProcessingOverlay,
      hideFileProcessingOverlay,
      showFileProcessingSuccess,
      showFileProcessingError,
      clearPendingSanitizedAttachPrompt,
      getPendingSanitizedAttachPromptMessage,
      showPendingSanitizedAttachPrompt
    });
  }

  root.PWM.FileProcessingUi = Object.freeze({
    createFileProcessingUi
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileProcessingUi;
  }
})();
