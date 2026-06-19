(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createPendingSanitizedFileHandoffManager(deps = {}) {
    const noop = () => {};
    const state = {
      gemini: { pending: null, observer: null, timer: 0, clickHandler: null },
      grok: { pending: null, observer: null, timer: 0, clickHandler: null },
      generic: { pending: null, observer: null, timer: 0, clickHandler: null }
    };
    const {
      debugReveal = noop,
      showFileProcessingSuccess = noop,
      setBadge = noop,
      hideBadgeSoon = noop,
      refreshBadgeFromCurrentInput = noop,
      createSanitizedDataTransferForHandoff = () => null,
      handOffSanitizedFileInput = () => false,
      clearPendingSanitizedAttachPrompt = noop,
      createPendingAttachEvent = (event, type) => ({ type, target: event?.target || null }),
      createSanitizedFileHandoffDetails = () => ({}),
      describeFileForDebug = () => null,
      describeFileInputForDebug = () => null,
      describeElementForDebug = () => null,
      logSanitizedFileHandoffFailure = noop,
      hideDmzOverlay = noop,
      showPendingSanitizedAttachPrompt = noop,
      getPendingSanitizedAttachPromptMessage = () => "",
      getFileHandoffAdapterById = () => null,
      isFileHandoffAdapterPendingAttachEnabled = () => false,
      normalizeFileHandoffAdapter = (adapter) => adapter || null,
      normalizeTarget = (target) => target || null,
      handleContentError = (error) => { throw error; },
      documentRef = typeof document !== "undefined" ? document : null,
      mutationObserverCtor = typeof MutationObserver === "function" ? MutationObserver : null,
      setTimeoutFn = setTimeout,
      clearTimeoutFn = clearTimeout,
      isGeminiHost = () => false,
      isGrokHost = () => false,
      getGeminiSessionHash = () => "",
      clearPendingGeminiGhostIngressClickInterceptor = noop,
      discoverGeminiFileHandoffElements = () => ({}),
      describeGeminiHandoffDiscovery = () => ({}),
      describeGeminiOverlayExposure = () => ({}),
      isLikelyGeminiUploadClickTarget = () => false,
      discoverGrokPendingFileInput = () => ({}),
      describeGrokPendingInputDiscovery = () => ({}),
      isLikelyGrokUploadClickTarget = () => false,
      geminiTtlMs = 60000,
      grokTtlMs = 60000,
      genericTtlMs = 60000
    } = deps;

    function cleanupSite(site, reason = "") {
      const slot = state[site];
      if (!slot) return null;
      const pending = slot.pending;
      slot.pending = null;
      if (slot.observer) {
        try { slot.observer.disconnect(); } catch {
          debugReveal("file-handoff:pending-cleanup-failed", { site, phase: "observer-disconnect", reason, hadPending: Boolean(pending) });
        }
        slot.observer = null;
      }
      if (slot.timer) {
        clearTimeoutFn(slot.timer);
        slot.timer = 0;
      }
      if (slot.clickHandler && documentRef?.removeEventListener) {
        try { documentRef.removeEventListener("click", slot.clickHandler, true); } catch {
          debugReveal("file-handoff:pending-cleanup-failed", { site, phase: "click-listener-remove", reason, hadPending: Boolean(pending) });
        }
      }
      slot.clickHandler = null;
      return pending;
    }

    function getPendingFiles(pending) {
      if (!pending) return [];
      if (Array.isArray(pending.sanitizedFiles)) return pending.sanitizedFiles.filter(Boolean);
      return pending.sanitizedFile ? [pending.sanitizedFile] : [];
    }

    function hasUnsafePendingFileMarkers(file, strictContent = false) {
      if (!file || typeof file !== "object") return true;
      if (file.rawFile || file.originalFile || file.rawMarker) return true;
      if (typeof file.path === "string" && file.path) return true;
      if (typeof file.webkitRelativePath === "string" && file.webkitRelativePath) return true;
      if (strictContent) {
        for (const key of ["rawText", "rawContent", "content", "contents"]) {
          if (Object.prototype.hasOwnProperty.call(file, key)) return true;
        }
        if (Object.prototype.hasOwnProperty.call(file, "text") && typeof file.text !== "function") return true;
      }
      return false;
    }

    function isSafeSanitizedPendingFile(file, strictContent = false) {
      return !hasUnsafePendingFileMarkers(file, strictContent);
    }

    function getSafePendingExtension(file, index) {
      const name = String(file?.name || "").split(/[\\/]/).pop().toLowerCase();
      const match = /\.([a-z0-9]{1,12})$/i.exec(name);
      if (match) return `.${match[1].toLowerCase()}`;
      const summary = summarizePendingFile(file, index);
      const extension = String(summary.extension || "").toLowerCase();
      return /^\.[a-z0-9]{1,12}$/.test(extension) ? extension : ".bin";
    }

    function clonePendingSanitizedFile(file, index, shouldUseSafeName) {
      if (!isSafeSanitizedPendingFile(file, shouldUseSafeName)) return null;
      if (!shouldUseSafeName) return file;
      const safeName = `file-${index + 1}${getSafePendingExtension(file, index)}`;
      const type = typeof file.type === "string" ? file.type : "";
      const lastModified = Number(file.lastModified || Date.now()) || Date.now();
      if (typeof globalThis.File === "function" && typeof globalThis.Blob === "function" && file instanceof globalThis.Blob) {
        return new globalThis.File([file], safeName, { type, lastModified });
      }
      if (typeof globalThis.Blob === "function" && file instanceof globalThis.Blob) {
        try {
          Object.defineProperty(file, "name", { value: safeName, configurable: true });
          Object.defineProperty(file, "lastModified", { value: lastModified, configurable: true });
          return file;
        } catch {
          return null;
        }
      }
      return {
        name: safeName,
        type,
        size: Math.max(0, Number(file.size || 0) || 0),
        lastModified
      };
    }

    function normalizePendingSanitizedFiles(value) {
      const inputFiles = (Array.isArray(value) ? value : [value]).filter(Boolean);
      const planFactory = globalThis.PWM?.FileAttachPipeline?.createMultiFileAttachPlan;
      const plan = typeof planFactory === "function"
        ? planFactory(inputFiles)
        : {
            ok: inputFiles.length > 0 && inputFiles.length <= 5
          };
      if (!inputFiles.length || !plan.ok) return [];
      const shouldUseSafeNames = inputFiles.length > 1;
      const files = inputFiles.map((file, index) => clonePendingSanitizedFile(file, index, shouldUseSafeNames));
      return files.every(Boolean) ? files : [];
    }

    function summarizePendingFile(file, index) {
      const summaryFactory = globalThis.PWM?.FileAttachPipeline?.createMultiFileItemSummary;
      if (typeof summaryFactory === "function") {
        return summaryFactory({
          index,
          status: "sanitized",
          file
        });
      }
      const type = String(file?.type || "").split(";")[0].trim().toLowerCase();
      const name = String(file?.name || "").split(/[\\/]/).pop().toLowerCase();
      const match = /\.([a-z0-9]{1,12})$/i.exec(name);
      return {
        index,
        label: `file-${index + 1}`,
        status: "sanitized",
        extension: match ? `.${match[1].toLowerCase()}` : "",
        mimeCategory: type ? type.split("/")[0].replace(/[^a-z0-9.+-]/g, "").slice(0, 32) : "",
        sizeBytes: Math.max(0, Number(file?.size || 0) || 0),
        code: ""
      };
    }

    function summarizePendingFiles(files) {
      return files.map((file, index) => summarizePendingFile(file, index));
    }

    function describePendingFilesForDebug(files) {
      if (files.length <= 1) return { sanitizedFile: describeFileForDebug(files[0]) };
      return { sanitizedFileCount: files.length, sanitizedFiles: summarizePendingFiles(files) };
    }

    function getPendingFileRefsForHandoff(pending) {
      const files = normalizePendingSanitizedFiles(getPendingFiles(pending));
      if (!files.length) return [];
      return files;
    }

    function clearSite(site, reason = "") {
      if (site === "gemini") clearPendingGeminiGhostIngressClickInterceptor(reason || "pending-cleared");
      if (!state[site]?.pending) {
        clearPendingSanitizedAttachPrompt(reason || `${site}-pending-cleared`);
        return;
      }
      const pending = cleanupSite(site, reason);
      clearPendingSanitizedAttachPrompt(reason || `${site}-pending-cleared`);
      const payload = {
        reason,
        ageMs: Math.max(0, Date.now() - Number(pending.createdAt || 0)),
        ...describePendingFilesForDebug(getPendingFiles(pending))
      };
      if (site === "generic") payload.site = pending.site || "";
      debugReveal(`file-handoff:${site}-pending-cleared`, payload);
      debugReveal("file-handoff:pending-cleared", { ...payload, site: site === "generic" ? pending.site || "" : site });
    }

    function schedule(site, attemptFn, reason = "") {
      if (!state[site]?.pending) return;
      const attempt = () => { try { attemptFn(reason); } catch (error) { handleContentError(error); } };
      setTimeoutFn(attempt, 0); setTimeoutFn(attempt, 250); setTimeoutFn(attempt, 1000);
    }

    function assignToInput(site, fileInput, event, pending, details, reason, inputDebugLabel) {
      const pendingFiles = getPendingFileRefsForHandoff(pending);
      if (!pendingFiles.length) { details.failureReason = "pending_sanitized_files_invalid"; logSanitizedFileHandoffFailure(details); clearSite(site, "invalid-pending-files"); return false; }
      const filesForHandoff = pendingFiles.length === 1 ? pendingFiles[0] : pendingFiles;
      const transfer = createSanitizedDataTransferForHandoff(filesForHandoff, details);
      if (!transfer || Number(transfer.files?.length || 0) !== pendingFiles.length) { details.failureReason = "data_transfer_failed"; logSanitizedFileHandoffFailure(details); return false; }
      const assigned = handOffSanitizedFileInput(fileInput, transfer, { dispatchInput: true, details });
      if (!assigned) { logSanitizedFileHandoffFailure(details); return false; }
      const assignedFiles = Array.from(fileInput.files || []);
      const assignmentMatches =
        assignedFiles.length === pendingFiles.length &&
        pendingFiles.every((file, index) => assignedFiles[index] === file);
      if (!assignmentMatches) {
        details.failureReason = "input_files_assignment_count_mismatch";
        logSanitizedFileHandoffFailure(details);
        debugReveal(`file-handoff:${site}-pending-assignment-mismatch`, {
          reason,
          expectedFileCount: pendingFiles.length,
          assignedFileCount: assignedFiles.length,
          input: describeFileInputForDebug(fileInput, inputDebugLabel),
          ...describePendingFilesForDebug(pendingFiles)
        });
        return false;
      }
      debugReveal(`file-handoff:${site}-pending-assigned`, { reason, input: describeFileInputForDebug(fileInput, inputDebugLabel), ...describePendingFilesForDebug(pendingFiles) });
      debugReveal("file-handoff:pending-assigned", { site, reason, input: describeFileInputForDebug(fileInput, inputDebugLabel), ...describePendingFilesForDebug(pendingFiles) });
      clearSite(site, "assigned");
      showFileProcessingSuccess(pendingFiles.length > 1 ? "Sanitized files attached." : "Sanitized file attached.", { site, reason: "pending-attached" });
      setBadge(pendingFiles.length > 1 ? "LeakGuard attached the sanitized files." : "LeakGuard attached the sanitized file."); hideBadgeSoon(3200); refreshBadgeFromCurrentInput();
      return true;
    }

    function attemptGemini(reason = "") {
      const pending = state.gemini.pending;
      if (!pending || !isGeminiHost()) return false;
      if (Date.now() > pending.expiresAt) { clearSite("gemini", "expired"); return false; }
      const event = { type: "pending-gemini-sanitized-file", target: null };
      const discovery = discoverGeminiFileHandoffElements(event, null);
      const fileInput = discovery.fileInput;
      if (!fileInput) {
        debugReveal("file-handoff:gemini-pending-input-not-found", { reason, ...describeGeminiHandoffDiscovery(discovery), overlay: describeGeminiOverlayExposure(), ...describePendingFilesForDebug(getPendingFiles(pending)) });
        return false;
      }
      debugReveal("file-handoff:pending-input-captured", { site: "gemini", reason, input: describeFileInputForDebug(fileInput, "pending-gemini-file-input"), ...describePendingFilesForDebug(getPendingFiles(pending)) });
      const details = createSanitizedFileHandoffDetails(event, pending.sanitizedFile, "gemini:pending-file-input-assignment");
      details.fileInputCountBeforeClick = discovery.fileInputCount; details.fileInputCountAfterTopTriggerClick = discovery.fileInputCount; details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount; details.openShadowRootCount = discovery.openShadowRootCount; details.failureReason = reason || "pending_file_input_assignment";
      return assignToInput("gemini", fileInput, event, pending, details, reason, "pending-gemini-file-input");
    }

    function attemptGrok(reason = "") {
      const pending = state.grok.pending;
      if (!pending || !isGrokHost()) return false;
      if (Date.now() > pending.expiresAt) { clearSite("grok", "expired"); return false; }
      const event = { type: "pending-grok-sanitized-file", target: pending.target || null };
      const discovery = discoverGrokPendingFileInput(event, pending.input || null);
      const fileInput = discovery.fileInput;
      if (!fileInput) { debugReveal("file-handoff:grok-pending-input-not-found", { reason, ...describeGrokPendingInputDiscovery(discovery), ...describePendingFilesForDebug(getPendingFiles(pending)) }); return false; }
      debugReveal("file-handoff:pending-input-captured", { site: "grok", reason, input: describeFileInputForDebug(fileInput, "pending-grok-file-input"), ...describePendingFilesForDebug(getPendingFiles(pending)) });
      const details = createSanitizedFileHandoffDetails(event, pending.sanitizedFile, "grok:pending-file-input-assignment");
      details.fileInputCountBeforeClick = discovery.fileInputCount; details.fileInputCountAfterTopTriggerClick = discovery.fileInputCount; details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount; details.openShadowRootCount = discovery.openShadowRootCount; details.failureReason = reason || "pending_file_input_assignment";
      return assignToInput("grok", fileInput, event, pending, details, reason, "pending-grok-file-input");
    }

    function queueSite(site, event, input, sanitizedFile, details = null) {
      const isGemini = site === "gemini";
      const sanitizedFiles = normalizePendingSanitizedFiles(sanitizedFile);
      const eventType = String(event?.type || "");
      const hostOk = isGemini ? isGeminiHost() : isGrokHost();
      const eventOk = /^(?:drop|paste|change|input)$/.test(eventType);
      if (!hostOk || !eventOk || !sanitizedFiles.length) {
        debugReveal(`file-handoff:${site}-pending-queue-skipped`, {
          reason: !hostOk ? "host_mismatch" : !eventOk ? "unsupported_event_type" : "invalid_sanitized_files",
          eventType,
          sanitizedFileCount: sanitizedFiles.length
        });
        return false;
      }
      const ttlMs = isGemini ? geminiTtlMs : grokTtlMs;
      const requestedHandoffStage = String(details?.handoffStage || "");
      const isStreamingPending = requestedHandoffStage.includes("streaming");
      clearSite(site, "replaced");
      state[site].pending = {
        sanitizedFile: sanitizedFiles[0],
        ...(sanitizedFiles.length > 1 ? { sanitizedFiles, files: summarizePendingFiles(sanitizedFiles) } : {}),
        input: isGemini ? undefined : input || null,
        target: isGemini ? undefined : normalizeTarget(event?.target),
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        sessionHash: isGemini ? getGeminiSessionHash() || "" : undefined
      };
      if (details) { details.handoffStage = isStreamingPending ? requestedHandoffStage : `${site}:pending-user-upload-input`; details.failureReason = "pending_until_user_exposes_file_input"; }
      const attemptFn = isGemini ? attemptGemini : attemptGrok;
      if (mutationObserverCtor && documentRef) {
        try { state[site].observer = new mutationObserverCtor(() => attemptFn("mutation")); state[site].observer.observe(documentRef.documentElement || documentRef, { childList: true, subtree: true }); } catch { state[site].observer = null; }
      }
      const clickTest = isGemini ? isLikelyGeminiUploadClickTarget : isLikelyGrokUploadClickTarget;
      state[site].clickHandler = (clickEvent) => {
        const pending = state[site].pending;
        if (!pending || !clickTest(isGemini ? clickEvent?.target : clickEvent)) return;
        const label = isGemini ? "pending-upload-click" : "pending-grok-upload-click";
        const target = describeElementForDebug(normalizeTarget(clickEvent?.target), label);
        const pendingAgeMs = Math.max(0, Date.now() - Number(pending.createdAt || 0));
        debugReveal(`file-handoff:${site}-upload-click-observed`, { target, pendingAgeMs });
        debugReveal("file-handoff:pending-site-upload-click-observed", { site, target, pendingAgeMs });
        schedule(site, attemptFn, "upload-click");
      };
      try { documentRef?.addEventListener?.("click", state[site].clickHandler, true); } catch { state[site].clickHandler = null; }
      state[site].timer = setTimeoutFn(() => clearSite(site, "expired"), ttlMs);
      const queuedPayload = { ttlMs, ...describePendingFilesForDebug(sanitizedFiles) };
      if (isGemini) queuedPayload.sessionHash = getGeminiSessionHash() || "";
      debugReveal(`file-handoff:${site}-pending-queued`, queuedPayload);
      if (isStreamingPending) debugReveal(`file-handoff:${site}-streaming-pending-queued`, queuedPayload);
      debugReveal("pending-attach-synthetic-loop-suppressed", { site, streaming: isStreamingPending, ...describePendingFilesForDebug(sanitizedFiles) });
      hideDmzOverlay();
      const pendingEvent = createPendingAttachEvent(event, `pending-${site}-sanitized-file-attach`);
      showPendingSanitizedAttachPrompt(getFileHandoffAdapterById(site), { site, event: pendingEvent, input, sanitizedFile: sanitizedFiles[0], sanitizedFiles: sanitizedFiles.length > 1 ? sanitizedFiles : undefined, message: getPendingSanitizedAttachPromptMessage(site) });
      setBadge(getPendingSanitizedAttachPromptMessage(site)); hideBadgeSoon(6500);
      return true;
    }

    function queueGeneric(adapter, event, input, sanitizedFile, details = null) {
      const selectedAdapter = normalizeFileHandoffAdapter(adapter);
      if (!selectedAdapter || !sanitizedFile) return false;
      if (selectedAdapter.id === "gemini" || selectedAdapter.id === "grok" || selectedAdapter.id === "generic") return false;
      if (!isFileHandoffAdapterPendingAttachEnabled(selectedAdapter)) return false;
      const requestedHandoffStage = String(details?.handoffStage || "");
      clearSite("generic", "replaced");
      state.generic.pending = { site: selectedAdapter.id, sanitizedFile, input: input || null, target: normalizeTarget(event?.target), createdAt: Date.now(), expiresAt: Date.now() + genericTtlMs };
      if (details) { details.handoffStage = requestedHandoffStage || `${selectedAdapter.id}:pending-user-upload-input`; details.failureReason = "pending_until_user_exposes_file_input"; }
      state.generic.timer = setTimeoutFn(() => clearSite("generic", "expired"), genericTtlMs);
      debugReveal("file-handoff:generic-pending-queued", { site: selectedAdapter.id, ttlMs: genericTtlMs, sanitizedFile: describeFileForDebug(sanitizedFile) });
      debugReveal("pending-attach-synthetic-loop-suppressed", { site: selectedAdapter.id, streaming: requestedHandoffStage.includes("streaming"), sanitizedFile: describeFileForDebug(sanitizedFile) });
      hideDmzOverlay();
      const pendingEvent = createPendingAttachEvent(event, `pending-${selectedAdapter.id}-sanitized-file-attach`);
      showPendingSanitizedAttachPrompt(selectedAdapter, { site: selectedAdapter.id, event: pendingEvent, input, sanitizedFile, message: getPendingSanitizedAttachPromptMessage(selectedAdapter.id) });
      setBadge(getPendingSanitizedAttachPromptMessage(selectedAdapter.id)); hideBadgeSoon(6500);
      return true;
    }

    function has(site, sanitizedFile) {
      const pending = state[site]?.pending;
      if (!pending) return false;
      if (!sanitizedFile) return true;
      const files = getPendingFiles(pending);
      if (Array.isArray(sanitizedFile)) return sanitizedFile.length === files.length && sanitizedFile.every((file, index) => file === files[index]);
      return files.includes(sanitizedFile);
    }
    function debug(site) {
      const pending = state[site]?.pending;
      if (!pending) return null;
      const files = getPendingFiles(pending);
      const out = { keys: Object.keys(pending), expiresAt: pending.expiresAt };
      if (files.length === 1) out.sanitizedFileDebug = describeFileForDebug(files[0]);
      if (files.length > 1) {
        out.sanitizedFileCount = files.length;
        out.sanitizedFilesDebug = summarizePendingFiles(files);
      }
      if (site === "gemini") out.sessionHash = pending.sessionHash || "";
      return out;
    }

    function schedulePendingGeminiSanitizedFileAttempt(reason = "") {
      return schedule("gemini", attemptGemini, reason);
    }

    function schedulePendingGrokSanitizedFileAttempt(reason = "") {
      return schedule("grok", attemptGrok, reason);
    }

    return {
      clearPendingGeminiSanitizedFileHandoff: (reason) => clearSite("gemini", reason),
      schedulePendingGeminiSanitizedFileAttempt,
      attemptPendingGeminiSanitizedFileHandoff: attemptGemini,
      queuePendingGeminiSanitizedFileHandoff: (event, input, sanitizedFile, details) => queueSite("gemini", event, input, sanitizedFile, details),
      hasPendingGeminiSanitizedFileHandoff: (sanitizedFile) => has("gemini", sanitizedFile),
      getPendingGeminiSanitizedFileHandoffDebug: () => debug("gemini"),
      clearPendingGrokSanitizedFileHandoff: (reason) => clearSite("grok", reason),
      schedulePendingGrokSanitizedFileAttempt,
      attemptPendingGrokSanitizedFileHandoff: attemptGrok,
      queuePendingGrokSanitizedFileHandoff: (event, input, sanitizedFile, details) => queueSite("grok", event, input, sanitizedFile, details),
      hasPendingGrokSanitizedFileHandoff: (sanitizedFile) => has("grok", sanitizedFile),
      getPendingGrokSanitizedFileHandoffDebug: () => debug("grok"),
      clearPendingGenericSanitizedFileHandoff: (reason) => clearSite("generic", reason),
      queuePendingGenericSanitizedFileHandoff: queueGeneric
    };
  }

  root.PWM.createPendingSanitizedFileHandoffManager = createPendingSanitizedFileHandoffManager;
  if (typeof module !== "undefined" && module.exports) module.exports = { createPendingSanitizedFileHandoffManager };
})();
