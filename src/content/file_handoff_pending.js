(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileHandoffPending(deps = {}) {
    const noop = () => {};
    const {
      attemptPendingGeminiSanitizedFileHandoff = () => false,
      attemptPendingGrokSanitizedFileHandoff = () => false,
      clearPendingGeminiSanitizedFileHandoff = noop,
      clearPendingGrokSanitizedFileHandoff = noop,
      clearPendingGenericSanitizedFileHandoff = noop,
      clearPendingSanitizedAttachPrompt = noop,
      createSanitizedFileHandoffDetails = () => ({}),
      debugFileHandoffAdapterSelected = noop,
      describeFileForDebug = () => null,
      describeFileHandoffAdapter = () => null,
      downloadSanitizedFileFallback = async () => false,
      emitDebug = noop,
      getCurrentHandoffDriver = () => null,
      hideBadgeSoon = noop,
      isFileHandoffAdapterPendingAttachEnabled = () => false,
      normalizeFileHandoffAdapter = (adapter) => adapter || null,
      normalizeTarget = (target) => target || null,
      queuePendingGeminiSanitizedFileHandoff = () => false,
      queuePendingGrokSanitizedFileHandoff = () => false,
      queuePendingGenericSanitizedFileHandoff = () => false,
      readSanitizedFileTextForFallback = async () => "",
      refreshBadgeFromCurrentInput = noop,
      setBadge = noop,
      suppressStaleHandoffErrorAfterSuccess = () => false
    } = deps;

    function createPendingAttachEvent(event, type) {
      return {
        type,
        target: normalizeTarget(event?.target) || null
      };
    }

    function queuePendingSanitizedFileHandoff(adapter, event, input, sanitizedFile, details = null) {
      const selectedAdapter = normalizeFileHandoffAdapter(adapter);
      debugFileHandoffAdapterSelected(selectedAdapter, "pending-queue");
      if (!selectedAdapter || !sanitizedFile) return false;
      if (!isFileHandoffAdapterPendingAttachEnabled(selectedAdapter)) {
        emitDebug("file-handoff:pending-queue-skipped", {
          site: selectedAdapter.id || "",
          reason: "pending_attach_disabled",
          adapter: describeFileHandoffAdapter(selectedAdapter),
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return false;
      }

      let queued = false;
      if (selectedAdapter.id === "gemini") {
        queued = queuePendingGeminiSanitizedFileHandoff(event, input, sanitizedFile, details);
      } else if (selectedAdapter.id === "grok") {
        queued = queuePendingGrokSanitizedFileHandoff(event, input, sanitizedFile, details);
      } else {
        queued = queuePendingGenericSanitizedFileHandoff(selectedAdapter, event, input, sanitizedFile, details);
      }

      if (queued) {
        emitDebug("file-handoff:pending-queued", {
          site: selectedAdapter.id,
          adapter: describeFileHandoffAdapter(selectedAdapter),
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
      }
      return queued;
    }

    function attemptPendingSanitizedFileHandoff(adapter, reason = "") {
      const selectedAdapter = normalizeFileHandoffAdapter(adapter);
      if (!selectedAdapter) return false;
      if (selectedAdapter.id === "gemini") return attemptPendingGeminiSanitizedFileHandoff(reason);
      if (selectedAdapter.id === "grok") return attemptPendingGrokSanitizedFileHandoff(reason);
      return false;
    }

    function clearPendingSanitizedFileHandoff(adapter, reason = "") {
      if (adapter == null) {
        clearPendingGeminiSanitizedFileHandoff(reason);
        clearPendingGrokSanitizedFileHandoff(reason);
        clearPendingGenericSanitizedFileHandoff(reason);
        return;
      }
      const selectedAdapter = normalizeFileHandoffAdapter(adapter);
      if (!selectedAdapter) return;
      if (selectedAdapter.id === "gemini") {
        clearPendingGeminiSanitizedFileHandoff(reason);
      } else if (selectedAdapter.id === "grok") {
        clearPendingGrokSanitizedFileHandoff(reason);
      } else {
        clearPendingGenericSanitizedFileHandoff(reason);
      }
    }

    async function attachPendingSanitizedFileWithTrustedActivation(adapter, pending) {
      const selectedAdapter = normalizeFileHandoffAdapter(adapter);
      if (!selectedAdapter || !pending?.sanitizedFile) return false;
      if (!isFileHandoffAdapterPendingAttachEnabled(selectedAdapter)) {
        emitDebug("file-handoff:pending-user-attach-skipped", {
          site: selectedAdapter.id || "",
          reason: "pending_attach_disabled",
          adapter: describeFileHandoffAdapter(selectedAdapter),
          sanitizedFile: describeFileForDebug(pending.sanitizedFile)
        });
        return false;
      }
      if (typeof selectedAdapter.attachWithTrustedActivation !== "function") return false;
      return await selectedAdapter.attachWithTrustedActivation(pending, selectedAdapter);
    }

    async function insertPendingSanitizedFileText(site, event, input, sanitizedFile) {
      if (!sanitizedFile) return false;

      const redactedText = await readSanitizedFileTextForFallback(sanitizedFile);
      const driver = getCurrentHandoffDriver();
      const payload = driver.preparePayload(sanitizedFile, redactedText, {
        localFile: sanitizedFile,
        analysis: null,
        result: null
      });
      const inserted = await driver.insertSanitizedText(payload, {
        event,
        input,
        context: "pending-attach-text-fallback",
        driver,
        composerResolved: true
      });
      if (inserted === true) {
        clearPendingSanitizedFileHandoff(site, "insert-text");
        clearPendingSanitizedAttachPrompt("insert-text");
        return true;
      }
      if (suppressStaleHandoffErrorAfterSuccess("sanitized_text_fallback", site, sanitizedFile)) {
        clearPendingSanitizedAttachPrompt("stale-text-fallback-suppressed");
        return true;
      }
      setBadge("Sanitized text insertion unavailable");
      hideBadgeSoon(4200);
      refreshBadgeFromCurrentInput();
      return false;
    }

    async function downloadPendingSanitizedFile(site, event, input, sanitizedFile) {
      if (!sanitizedFile) return false;
      const driver = getCurrentHandoffDriver();
      const payload = driver.preparePayload(sanitizedFile, "", {
        localFile: sanitizedFile,
        analysis: null,
        result: null
      });
      const details = createSanitizedFileHandoffDetails(
        event,
        sanitizedFile,
        `${site || driver.id}:pending-attach-download`
      );
      const downloaded = await downloadSanitizedFileFallback(event, input, payload, driver.id, details);
      if (downloaded) {
        clearPendingSanitizedFileHandoff(site, "download");
        clearPendingSanitizedAttachPrompt("download");
      } else if (suppressStaleHandoffErrorAfterSuccess("sanitized_download_fallback", site, sanitizedFile)) {
        clearPendingSanitizedAttachPrompt("stale-download-fallback-suppressed");
        return true;
      }
      return downloaded;
    }

    function cancelPendingSanitizedFileAttach(site) {
      clearPendingSanitizedFileHandoff(site, "cancelled");
      clearPendingSanitizedAttachPrompt("cancelled");
      setBadge("Sanitized file attach cancelled");
      hideBadgeSoon(3200);
      refreshBadgeFromCurrentInput();
    }

    return {
      createPendingAttachEvent,
      queuePendingSanitizedFileHandoff,
      attemptPendingSanitizedFileHandoff,
      clearPendingSanitizedFileHandoff,
      attachPendingSanitizedFileWithTrustedActivation,
      insertPendingSanitizedFileText,
      downloadPendingSanitizedFile,
      cancelPendingSanitizedFileAttach
    };
  }

  root.PWM.createFileHandoffPending = createFileHandoffPending;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createFileHandoffPending };
  }
})();
