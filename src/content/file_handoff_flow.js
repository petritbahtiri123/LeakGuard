(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileHandoffFlow(deps = {}) {
    const noop = () => {};
    const {
      applySanitizedTextFallback = async () => false,
      buildSanitizedDownloadFileName = () => "sanitized-file.txt",
      createSanitizedDataTransfer = () => null,
      createSanitizedDataTransferForHandoff = () => null,
      createSanitizedFileHandoffDetails = () => ({}),
      createSanitizedPayload = () => null,
      debugFileHandoffAdapterSelected = noop,
      describeFileForDebug = () => null,
      describeFileHandoffAdapter = () => null,
      documentRef = typeof document !== "undefined" ? document : null,
      dispatchSanitizedFileEvent = () => false,
      downloadGeminiSanitizedFileFallback = async () => false,
      emitDebug = noop,
      findGeminiFileInput = () => ({ fileInput: null }),
      formatSanitizedFileFallbackText = () => "",
      getCurrentHandoffDriverId = () => "",
      getFileHandoffAdapterById = () => null,
      getFileHandoffAdapterForLocation = () => null,
      handOffGeminiSanitizedFileUpload = async () => false,
      handOffGrokSanitizedFileUpload = async () => false,
      handOffSanitizedFileInput = () => false,
      hideBadgeSoon = noop,
      hideDmzOverlay = noop,
      insertGeminiSanitizedText = async () => false,
      isFileHandoffAdapterPendingAttachEnabled = () => false,
      isFirefoxRuntime = () => false,
      isGeminiHost = () => false,
      isGrokHost = () => false,
      isProtectedFileDropDriver = () => false,
      locationRef = typeof location !== "undefined" ? location : null,
      logSanitizedFileHandoffFailure = noop,
      queuePendingSanitizedFileHandoff = () => false,
      readSanitizedFileTextForFallback = async () => "",
      refreshBadgeFromCurrentInput = noop,
      resolveFileInputForHandoff = () => null,
      scheduleDmzOverlayCleanup = noop,
      sendRuntimeMessage = async () => null,
      setBadge = noop,
      setDmzOverlayState = noop,
      shouldUseFirefoxTextFallbackForFileHandoff = () => false,
      tryFirefoxGeminiFileInputBridge = async () => ({ handled: false, ok: false }),
      tryGeminiSanitizedFileAttach = async () => false
    } = deps;

    function isFileOnlySanitizedPayload(payload) {
      return Boolean(payload?.allowFileOnlyHandoff && !String(payload?.redactedText || "").trim());
    }

    function isSafeSanitizedPayload(payload) {
      return Boolean(
        payload &&
          payload.sanitizedFile &&
          typeof payload.redactedText === "string" &&
          (payload.redactedText.length > 0 || payload.allowFileOnlyHandoff === true)
      );
    }

    async function handOffSanitizedLocalFile(event, input, sanitizedFile, context) {
      if (shouldUseFirefoxTextFallbackForFileHandoff()) {
        emitDebug("file-handoff:firefox-text-fallback-required", {
          context,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return false;
      }

      const target = event?.target || input;
      if (context === "drop") {
        if (isGeminiHost()) {
          return handOffGeminiSanitizedFileUpload(event, input, sanitizedFile, {
            allowUploadUiClick: isFirefoxRuntime()
          });
        }

        if (isGrokHost()) {
          return handOffGrokSanitizedFileUpload(event, input, sanitizedFile);
        }
      }

      const transfer = createSanitizedDataTransfer(sanitizedFile);
      if (!transfer) {
        emitDebug("file-handoff:data-transfer-create-failed", {
          context,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return false;
      }

      if (context === "file-input") {
        return handOffSanitizedFileInput(event?.target, transfer, {
          dispatchInput: true
        });
      }

      if (context === "drop") {

        try {
          transfer.dropEffect = "copy";
        } catch {
          // Some synthetic DataTransfer objects expose dropEffect as read-only.
        }
        return dispatchSanitizedFileEvent(target, "drop", transfer);
      }

      if (context === "paste") {
        return dispatchSanitizedFileEvent(target, "paste", transfer);
      }

      return false;
    }

    function tryRealFileInputSanitizedFileAttach(payload, event, input, driverId) {
      if (!payload?.sanitizedFile) return false;
      if (shouldUseFirefoxTextFallbackForFileHandoff()) return false;
      const details = createSanitizedFileHandoffDetails(event, payload.sanitizedFile, `${driverId}:file-input`);
      const transfer = createSanitizedDataTransferForHandoff(payload.sanitizedFile, details);
      if (!transfer) {
        details.failureReason = "data_transfer_failed";
        logSanitizedFileHandoffFailure(details);
        return false;
      }

      const adapter = getFileHandoffAdapterById(driverId);
      const fileInput =
        adapter?.resolveFileInput?.(event, input, adapter) || resolveFileInputForHandoff(event, input);
      details.fileInputCountBeforeClick = fileInput ? 1 : 0;
      details.fileInputCountAfterTopTriggerClick = fileInput ? 1 : 0;
      details.fileInputCountAfterOverlayItemClick = fileInput ? 1 : 0;
      if (!fileInput) {
        details.failureReason = "no_safe_file_input";
        return false;
      }

      const assigned = handOffSanitizedFileInput(fileInput, transfer, {
        dispatchInput: true,
        details
      });
      if (!assigned) {
        logSanitizedFileHandoffFailure(details);
      }
      return assigned;
    }

    async function insertSanitizedPayloadText(payload, event, input, context = null) {
      if (!String(payload?.redactedText || "").trim()) return false;
      if (!input && context?.composerResolved && !isFirefoxRuntime()) return false;
      if (isGeminiHost()) {
        return insertGeminiSanitizedText(payload, event, input);
      }
      return applySanitizedTextFallback(event, input, formatSanitizedFileFallbackText(payload), {
        rawInsertedText: payload.rawText || ""
      });
    }

    async function downloadSanitizedFileFallback(event, input, payload, driverId, details = null) {
      if (isGeminiHost()) {
        return downloadGeminiSanitizedFileFallback(event, input, payload?.sanitizedFile, details);
      }
      if (!payload?.sanitizedFile) return false;

      let redactedText = "";
      try {
        redactedText = await readSanitizedFileTextForFallback(payload.sanitizedFile);
      } catch (error) {
        if (details) {
          details.failureReason = "sanitized_download_read_failed";
          details.errorMessage = error?.message || String(error);
          details.errorStack = error?.stack || "";
        }
        return false;
      }

      try {
        const response = await sendRuntimeMessage({
          type: "PWM_DOWNLOAD_SANITIZED_FILE",
          fileName: buildSanitizedDownloadFileName(payload.sanitizedFile),
          mimeType: payload.sanitizedFile.type || "text/plain",
          redactedText
        });
        if (!response?.ok) {
          if (details) {
            details.failureReason = "sanitized_download_failed";
            details.errorMessage = response?.error || "Background download request failed.";
          }
          return false;
        }
        emitDebug("file-handoff:sanitized-download", {
          driver: driverId,
          sanitizedFile: describeFileForDebug(payload.sanitizedFile),
          downloadId: response.downloadId ?? null
        });
        setDmzOverlayState("Sanitized download ready", "fallback");
        scheduleDmzOverlayCleanup(3600);
        setBadge("Sanitized download ready");
        hideBadgeSoon(6500);
        refreshBadgeFromCurrentInput();
        return true;
      } catch (error) {
        if (details) {
          details.failureReason = "sanitized_download_failed";
          details.errorMessage = error?.message || String(error);
          details.errorStack = error?.stack || "";
        }
        return false;
      }
    }

    function getCurrentHandoffDriver() {
      const id = getCurrentHandoffDriverId();
      return {
        id,
        usesDmzOverlay: isProtectedFileDropDriver(id),
        canHandle: () => true,
        preparePayload: (sanitizedFile, redactedText, metadata) =>
          createSanitizedPayload(
            sanitizedFile,
            redactedText,
            metadata?.localFile,
            metadata?.analysis,
            metadata?.result
          ),
        tryAttachSanitizedFile: async (payload, context) => {
          if (id === "gemini") return tryGeminiSanitizedFileAttach(payload, context.event, context.input);
          if (id === "grok") return handOffGrokSanitizedFileUpload(context.event, context.input, payload.sanitizedFile);
          if (id === "chatgpt" || id === "claude" || id === "openai" || id === "x" || id === "generic") {
            return tryRealFileInputSanitizedFileAttach(payload, context.event, context.input, id);
          }
          return false;
        },
        insertSanitizedText: (payload, context) => insertSanitizedPayloadText(payload, context.event, context.input, context),
        emergencyDownload: (payload, context) =>
          downloadSanitizedFileFallback(
            context.event,
            context.input,
            payload,
            id,
            createSanitizedFileHandoffDetails(context.event, payload?.sanitizedFile, `${id}:emergency-download`)
          ),
        handoff: async (payload, context) => handoffSanitizedPayload(payload, context)
      };
    }

    async function handoffSanitizedPayload(payload, context) {
      const driver = context?.driver || getCurrentHandoffDriver();
      const adapter = context?.adapter || driver.adapter || getFileHandoffAdapterForLocation();
      debugFileHandoffAdapterSelected(adapter, "handoff");
      if (!driver?.canHandle?.(locationRef, documentRef)) {
        return { ok: false, stage: "driver-unavailable" };
      }
      if (!isSafeSanitizedPayload(payload)) {
        setDmzOverlayState("Raw file blocked", "failed");
        return { ok: false, stage: "failed", reason: "unsafe_sanitized_payload" };
      }

      const firefoxGeminiDropInput =
        driver.id === "gemini" && isFirefoxRuntime() && context?.context === "drop"
          ? findGeminiFileInput(context.event, context.input).fileInput
          : null;
      if (
        driver.id === "gemini" &&
        isFirefoxRuntime() &&
        context?.context === "drop" &&
        !firefoxGeminiDropInput &&
        payload?.sanitizedFile &&
        isFileHandoffAdapterPendingAttachEnabled(adapter)
      ) {
        const pendingDetails = createSanitizedFileHandoffDetails(
          context.event,
          payload.sanitizedFile,
          `${adapter.id}:firefox-drop-pending-attach`
        );
        if (queuePendingSanitizedFileHandoff(adapter, context.event, context.input, payload.sanitizedFile, pendingDetails)) {
          emitDebug("file-handoff:firefox-gemini-drop-pending-queued", {
            adapter: describeFileHandoffAdapter(adapter),
            context: context?.context || "",
            sanitizedFile: describeFileForDebug(payload.sanitizedFile)
          });
          hideDmzOverlay();
          return { ok: true, stage: "pending", strategy: `${adapter.id}-pending-sanitized-file-handoff` };
        }
      }

      emitDebug("file-handoff:direct-attempt-start", {
        site: driver.id,
        adapter: describeFileHandoffAdapter(adapter),
        context: context?.context || "",
        sanitizedFile: describeFileForDebug(payload.sanitizedFile)
      });
      if (await driver.tryAttachSanitizedFile(payload, context)) {
        emitDebug("file-handoff:direct-attempt-success", {
          site: driver.id,
          adapter: describeFileHandoffAdapter(adapter),
          context: context?.context || "",
          sanitizedFile: describeFileForDebug(payload.sanitizedFile)
        });
        setDmzOverlayState("Attached sanitized file", "attached");
        return { ok: true, stage: "file", strategy: `${driver.id}-sanitized-file-handoff` };
      }
      emitDebug("file-handoff:direct-attempt-failed", {
        site: driver.id,
        adapter: describeFileHandoffAdapter(adapter),
        context: context?.context || "",
        sanitizedFile: describeFileForDebug(payload.sanitizedFile)
      });

      const firefoxGeminiBridgeResult =
        driver.id === "gemini"
          ? await tryFirefoxGeminiFileInputBridge(payload, context)
          : { handled: false, ok: false };
      if (firefoxGeminiBridgeResult.ok) {
        if (firefoxGeminiBridgeResult.stage === "text") {
          setDmzOverlayState("Inserted sanitized content", "inserted");
          return { ok: true, stage: "text", strategy: firefoxGeminiBridgeResult.strategy };
        }
        if (firefoxGeminiBridgeResult.stage === "pending") {
          hideDmzOverlay();
          return { ok: true, stage: "pending", strategy: firefoxGeminiBridgeResult.strategy };
        }
        setDmzOverlayState("Attached sanitized file", "attached");
        return { ok: true, stage: "file", strategy: firefoxGeminiBridgeResult.strategy };
      }
      if (firefoxGeminiBridgeResult.handled) {
        if (
          firefoxGeminiBridgeResult.reason === "gemini_firefox_file_input_not_found" &&
          context?.context === "drop" &&
          payload?.sanitizedFile &&
          isFileHandoffAdapterPendingAttachEnabled(adapter)
        ) {
          const pendingDetails = createSanitizedFileHandoffDetails(
            context.event,
            payload.sanitizedFile,
            `${adapter.id}:pending-after-firefox-bridge-miss`
          );
          if (queuePendingSanitizedFileHandoff(adapter, context.event, context.input, payload.sanitizedFile, pendingDetails)) {
            hideDmzOverlay();
            return { ok: true, stage: "pending", strategy: `${adapter.id}-pending-sanitized-file-handoff` };
          }
        }
        setDmzOverlayState("Raw file blocked", "failed");
        return firefoxGeminiBridgeResult;
      }

      if (
        context?.context === "drop" &&
        payload?.sanitizedFile &&
        isFileHandoffAdapterPendingAttachEnabled(adapter)
      ) {
        const pendingDetails = createSanitizedFileHandoffDetails(
          context.event,
          payload.sanitizedFile,
          `${adapter.id}:pending-after-direct-failure`
        );
        if (queuePendingSanitizedFileHandoff(adapter, context.event, context.input, payload.sanitizedFile, pendingDetails)) {
          hideDmzOverlay();
          return { ok: true, stage: "pending", strategy: `${adapter.id}-pending-sanitized-file-handoff` };
        }
      }

      const fileOnlyPayload = isFileOnlySanitizedPayload(payload);
      if (!fileOnlyPayload) {
        const textInserted = await driver.insertSanitizedText(payload, context);
        if (textInserted === true) {
          setDmzOverlayState("Inserted sanitized content", "inserted");
          return { ok: true, stage: "text", strategy: `${driver.id}-sanitized-text-fallback` };
        }
        if (textInserted === "cancelled") {
          return { ok: false, stage: "text", reason: "sanitized_text_cancelled" };
        }

        if (await driver.emergencyDownload(payload, context)) {
          return { ok: true, stage: "download", strategy: `${driver.id}-sanitized-download-fallback` };
        }
      } else {
        emitDebug("file-handoff:file-only-fallback-skipped", {
          site: driver.id,
          adapter: describeFileHandoffAdapter(adapter),
          context: context?.context || "",
          sanitizedFile: describeFileForDebug(payload.sanitizedFile),
          reason: "streamed_sanitized_file_not_read_back"
        });
      }

      setDmzOverlayState("Raw file blocked", "failed");
      return { ok: false, stage: "failed", reason: "sanitized_payload_handoff_failed" };
    }

    return {
      isFileOnlySanitizedPayload,
      isSafeSanitizedPayload,
      handOffSanitizedLocalFile,
      tryRealFileInputSanitizedFileAttach,
      insertSanitizedPayloadText,
      downloadSanitizedFileFallback,
      getCurrentHandoffDriver,
      handoffSanitizedPayload
    };
  }

  root.PWM.createFileHandoffFlow = createFileHandoffFlow;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createFileHandoffFlow };
  }
})();
