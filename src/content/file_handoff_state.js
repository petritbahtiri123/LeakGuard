(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileHandoffState(deps = {}) {
    const noop = () => {};
    const {
      emitDebug = noop,
      describeFileForDebug = () => null,
      describeFileInputForDebug = () => null,
      getCurrentHandoffDriverId = () => "",
      getFileHandoffAdapterForLocation = () => null,
      isFileInputElement = () => false,
      isFirefoxRuntime = () => false,
      isProtectedFileDropDriver = () => false,
      listLocalTransferFiles = () => [],
      locationRef = typeof location !== "undefined" ? location : null,
      setTimeoutFn = typeof setTimeout === "function" ? setTimeout : noop,
      DataTransferCtor = typeof DataTransfer === "function" ? DataTransfer : null
    } = deps;
    const constants = deps.constants || {};
    const SANITIZED_FILE_HANDOFF_SUPPRESS_MS =
      constants.SANITIZED_FILE_HANDOFF_SUPPRESS_MS ||
      constants.sanitizedFileHandoffSuppressMs ||
      30000;
    const PROGRAMMATIC_INPUT_SUPPRESS_MS =
      constants.PROGRAMMATIC_INPUT_SUPPRESS_MS ||
      constants.programmaticInputSuppressMs ||
      500;
    const sanitizedFileInputHandoffs = new WeakSet();
    const sanitizedFileInputHandoffExpires = new WeakMap();
    const sanitizedFileInputHandoffRecords = new WeakMap();
    const sanitizedFileHandoffFiles = new WeakSet();
    const sanitizedFileHandoffFileExpires = new WeakMap();
    const sanitizedFileHandoffSignatures = new Map();
    const recentSanitizedFileInputHandoffRecords = [];
    const firefoxFileInputTransactions = new WeakMap();
    let sanitizedFileHandoffSequence = 0;
    let lastCompletedSanitizedFileInputHandoff = null;
    let lastCompletedPendingSanitizedFileInputHandoff = null;

    function getFileMetadataSignature(file) {
      if (!file) return "";
      return [
        String(file.name || ""),
        String(Number(file.size ?? file.sizeBytes ?? 0)),
        String(file.type || ""),
        String(Number(file.lastModified || 0))
      ].join("|");
    }

    function getFileListMetadataSignature(files) {
      return Array.from(files || []).map(getFileMetadataSignature).join("||");
    }

    function isWeakSetFileObject(file) {
      return Boolean(file && (typeof file === "object" || typeof file === "function"));
    }

    function getSanitizedFileHandoffSiteId() {
      try {
        return getCurrentHandoffDriverId() || "";
      } catch {
        return "";
      }
    }

    function getSanitizedFileHandoffAdapterId(site = "") {
      try {
        return getFileHandoffAdapterForLocation()?.id || site || "";
      } catch {
        return site || "";
      }
    }

    function isPendingSanitizedFileHandoffStage(stage) {
      return /\b(?:pending|ghost|bridge|prime|primed)\b/i.test(String(stage || ""));
    }

    function pruneRecentSanitizedFileInputHandoffRecords(now = Date.now()) {
      for (let index = recentSanitizedFileInputHandoffRecords.length - 1; index >= 0; index -= 1) {
        const record = recentSanitizedFileInputHandoffRecords[index];
        if (!record || Number(record.expiresAt || 0) <= now) {
          recentSanitizedFileInputHandoffRecords.splice(index, 1);
        }
      }

      if (
        lastCompletedSanitizedFileInputHandoff &&
        Number(lastCompletedSanitizedFileInputHandoff.expiresAt || 0) <= now
      ) {
        lastCompletedSanitizedFileInputHandoff = null;
      }
      if (
        lastCompletedPendingSanitizedFileInputHandoff &&
        Number(lastCompletedPendingSanitizedFileInputHandoff.expiresAt || 0) <= now
      ) {
        lastCompletedPendingSanitizedFileInputHandoff = null;
      }
    }

    function createSanitizedFileInputHandoffRecord(fileInput, files, options = {}) {
      if (!isFileInputElement(fileInput)) return null;

      const assignedFiles = Array.from(files || []).filter(Boolean);
      const now = Date.now();
      const ttlMs = Math.max(1, Number(options.ttlMs || SANITIZED_FILE_HANDOFF_SUPPRESS_MS));
      const expiresAt = Number(options.expiresAt || now + ttlMs);
      const details = options.details || null;
      const stage = String(options.stage || details?.handoffStage || "");
      const site = String(options.site || getSanitizedFileHandoffSiteId() || details?.hostname || "");
      const adapter = String(options.adapter || getSanitizedFileHandoffAdapterId(site) || site || "");
      const signatures = assignedFiles.map(getFileMetadataSignature).filter(Boolean);
      const signature = getFileListMetadataSignature(assignedFiles);
      const pending = Boolean(options.pending || isPendingSanitizedFileHandoffStage(stage));
      sanitizedFileHandoffSequence += 1;

      return {
        input: fileInput,
        timestamp: now,
        expiresAt,
        ttlMs,
        handoffId:
          options.handoffId ||
          `${site || adapter || "site"}:${now}:${sanitizedFileHandoffSequence}`,
        sessionId: String(options.sessionId || details?.sessionHash || ""),
        site,
        adapter,
        stage,
        pending,
        signature,
        signatures,
        files: assignedFiles.map(describeFileForDebug)
      };
    }

    function recordSanitizedFileInputHandoffCompletion(fileInput, files, options = {}) {
      const record = createSanitizedFileInputHandoffRecord(fileInput, files, options);
      if (!record) return null;

      pruneRecentSanitizedFileInputHandoffRecords(record.timestamp);
      sanitizedFileInputHandoffRecords.set(fileInput, record);
      recentSanitizedFileInputHandoffRecords.push(record);
      while (recentSanitizedFileInputHandoffRecords.length > 20) {
        recentSanitizedFileInputHandoffRecords.shift();
      }
      lastCompletedSanitizedFileInputHandoff = record;
      if (record.pending) {
        lastCompletedPendingSanitizedFileInputHandoff = record;
      }
      return record;
    }

    function deleteSanitizedFileInputHandoffRecord(fileInput) {
      if (!isFileInputElement(fileInput)) return;

      sanitizedFileInputHandoffRecords.delete(fileInput);
      for (let index = recentSanitizedFileInputHandoffRecords.length - 1; index >= 0; index -= 1) {
        if (recentSanitizedFileInputHandoffRecords[index]?.input === fileInput) {
          recentSanitizedFileInputHandoffRecords.splice(index, 1);
        }
      }
      if (lastCompletedSanitizedFileInputHandoff?.input === fileInput) {
        lastCompletedSanitizedFileInputHandoff = null;
      }
      if (lastCompletedPendingSanitizedFileInputHandoff?.input === fileInput) {
        lastCompletedPendingSanitizedFileInputHandoff = null;
      }
    }

    function getRecentSanitizedFileInputHandoffRecord(fileInput, options = {}) {
      const now = Date.now();
      pruneRecentSanitizedFileInputHandoffRecords(now);

      const selectedFiles = Array.from(options.files || []).filter(Boolean);
      const signature = getFileListMetadataSignature(selectedFiles);
      const currentSite = getSanitizedFileHandoffSiteId();
      const inputRecord = isFileInputElement(fileInput)
        ? sanitizedFileInputHandoffRecords.get(fileInput) || null
        : null;
      const recordIsActive = (record) => Boolean(record && Number(record.expiresAt || 0) > now);
      const recordMatches = (record) => {
        if (!recordIsActive(record)) return null;
        const inputMatch = Boolean(isFileInputElement(fileInput) && record.input === fileInput);
        const signatureMatch = Boolean(
          signature &&
            (record.signature === signature ||
              selectedFiles.every((file) => record.signatures.includes(getFileMetadataSignature(file))))
        );
        const sitePendingMatch = Boolean(
          options.allowSitePending &&
            record.pending &&
            currentSite &&
            record.site === currentSite
        );
        if (!inputMatch && !signatureMatch && !sitePendingMatch) return null;
        return { record, inputMatch, signatureMatch, sitePendingMatch };
      };

      const inputMatch = recordMatches(inputRecord);
      if (inputMatch) return inputMatch;

      const pendingMatch = recordMatches(lastCompletedPendingSanitizedFileInputHandoff);
      if (pendingMatch) return pendingMatch;

      const latestMatch = recordMatches(lastCompletedSanitizedFileInputHandoff);
      if (latestMatch) return latestMatch;

      for (let index = recentSanitizedFileInputHandoffRecords.length - 1; index >= 0; index -= 1) {
        const match = recordMatches(recentSanitizedFileInputHandoffRecords[index]);
        if (match) return match;
      }

      return null;
    }

    function createSanitizedHandoffSuppressionDebug(fileInput, suppression, reason = "") {
      const record = suppression?.record || null;
      return {
        reason,
        input: describeFileInputForDebug(fileInput, "sanitized-file-handoff"),
        handoffId: record?.handoffId || "",
        sessionId: record?.sessionId || "",
        site: record?.site || getSanitizedFileHandoffSiteId(),
        adapter: record?.adapter || "",
        stage: record?.stage || "",
        pending: Boolean(record?.pending),
        ageMs: record ? Math.max(0, Date.now() - Number(record.timestamp || 0)) : 0,
        signature: record?.signature || "",
        files: record?.files || [],
        inputMatch: Boolean(suppression?.inputMatch),
        signatureMatch: Boolean(suppression?.signatureMatch),
        sitePendingMatch: Boolean(suppression?.sitePendingMatch)
      };
    }

    function deleteSanitizedFileHandoffMark(fileInput, files) {
      if (isFileInputElement(fileInput)) {
        sanitizedFileInputHandoffs.delete(fileInput);
        sanitizedFileInputHandoffExpires.delete(fileInput);
        deleteSanitizedFileInputHandoffRecord(fileInput);
      }
      for (const file of Array.from(files || [])) {
        if (isWeakSetFileObject(file)) {
          sanitizedFileHandoffFiles.delete(file);
          sanitizedFileHandoffFileExpires.delete(file);
        }
        const signature = getFileMetadataSignature(file);
        if (signature) {
          sanitizedFileHandoffSignatures.delete(signature);
        }
      }
    }

    function expireSanitizedFileHandoffMarks(fileInput, files, signatures, expiresAt) {
      const now = Date.now();
      let inputExpired = false;
      let fileCount = 0;
      let signatureCount = 0;

      if (isFileInputElement(fileInput)) {
        const inputExpiresAt = Number(sanitizedFileInputHandoffExpires.get(fileInput) || 0);
        if (inputExpiresAt && inputExpiresAt <= now && inputExpiresAt <= expiresAt) {
          sanitizedFileInputHandoffs.delete(fileInput);
          sanitizedFileInputHandoffExpires.delete(fileInput);
          deleteSanitizedFileInputHandoffRecord(fileInput);
          inputExpired = true;
        }
      }

      for (const file of files || []) {
        if (!isWeakSetFileObject(file)) continue;
        const fileExpiresAt = Number(sanitizedFileHandoffFileExpires.get(file) || 0);
        if (fileExpiresAt && fileExpiresAt <= now && fileExpiresAt <= expiresAt) {
          sanitizedFileHandoffFiles.delete(file);
          sanitizedFileHandoffFileExpires.delete(file);
          fileCount += 1;
        }
      }

      for (const signature of signatures || []) {
        const signatureExpiresAt = Number(sanitizedFileHandoffSignatures.get(signature) || 0);
        if (signatureExpiresAt && signatureExpiresAt <= now && signatureExpiresAt <= expiresAt) {
          sanitizedFileHandoffSignatures.delete(signature);
          signatureCount += 1;
        }
      }

      if (inputExpired || fileCount > 0 || signatureCount > 0) {
        emitDebug("file-input:sanitized-handoff-expired", {
          inputExpired,
          fileCount,
          signatureCount,
          ttlMs: SANITIZED_FILE_HANDOFF_SUPPRESS_MS
        });
      }
    }

    function pruneExpiredSanitizedFileHandoffSignatures(now = Date.now()) {
      let expiredCount = 0;
      for (const [signature, expiresAt] of sanitizedFileHandoffSignatures) {
        if (Number(expiresAt || 0) <= now) {
          sanitizedFileHandoffSignatures.delete(signature);
          expiredCount += 1;
        }
      }
      if (expiredCount > 0) {
        emitDebug("file-input:sanitized-handoff-expired", {
          inputExpired: false,
          signatureCount: expiredCount,
          ttlMs: SANITIZED_FILE_HANDOFF_SUPPRESS_MS
        });
      }
    }

    function markSanitizedFileHandoff(fileInput, files, options = {}) {
      if (!isFileInputElement(fileInput)) return false;
      const assignedFiles = Array.from(files || []).filter(Boolean);
      if (!assignedFiles.length) return false;

      const ttlMs = Math.max(1, Number(options.ttlMs || SANITIZED_FILE_HANDOFF_SUPPRESS_MS));
      const expiresAt = Date.now() + ttlMs;
      const signatures = [];
      sanitizedFileInputHandoffs.add(fileInput);
      sanitizedFileInputHandoffExpires.set(fileInput, expiresAt);
      const record = recordSanitizedFileInputHandoffCompletion(fileInput, assignedFiles, {
        ...options,
        expiresAt,
        ttlMs
      });

      for (const file of assignedFiles) {
        if (isWeakSetFileObject(file)) {
          sanitizedFileHandoffFiles.add(file);
          sanitizedFileHandoffFileExpires.set(file, expiresAt);
        }
        const signature = getFileMetadataSignature(file);
        if (signature) {
          sanitizedFileHandoffSignatures.set(signature, expiresAt);
          signatures.push(signature);
        }
      }

      emitDebug("file-input:sanitized-handoff-marked", {
        input: describeFileInputForDebug(fileInput, "sanitized-file-handoff"),
        files: assignedFiles.map(describeFileForDebug),
        ttlMs,
        handoffId: record?.handoffId || "",
        sessionId: record?.sessionId || "",
        signature: record?.signature || "",
        site: record?.site || "",
        adapter: record?.adapter || "",
        stage: record?.stage || ""
      });

      setTimeoutFn(() => {
        expireSanitizedFileHandoffMarks(fileInput, assignedFiles, signatures, expiresAt);
      }, ttlMs);
      return true;
    }

    function isSanitizedFileHandoffFile(file, now = Date.now()) {
      if (isWeakSetFileObject(file) && sanitizedFileHandoffFiles.has(file)) {
        const fileExpiresAt = Number(sanitizedFileHandoffFileExpires.get(file) || 0);
        if (fileExpiresAt > now) {
          return true;
        }
        sanitizedFileHandoffFiles.delete(file);
        sanitizedFileHandoffFileExpires.delete(file);
        if (fileExpiresAt) {
          emitDebug("file-input:sanitized-handoff-expired", {
            inputExpired: false,
            fileCount: 1,
            signatureCount: 0,
            ttlMs: SANITIZED_FILE_HANDOFF_SUPPRESS_MS
          });
        }
      }

      const signature = getFileMetadataSignature(file);
      if (!signature) return false;

      const expiresAt = Number(sanitizedFileHandoffSignatures.get(signature) || 0);
      if (!expiresAt) return false;
      if (expiresAt <= now) {
        sanitizedFileHandoffSignatures.delete(signature);
        emitDebug("file-input:sanitized-handoff-expired", {
          inputExpired: false,
          fileCount: 0,
          signatureCount: 1,
          ttlMs: SANITIZED_FILE_HANDOFF_SUPPRESS_MS
        });
        return false;
      }
      return true;
    }

    function getSanitizedFileInputHandoffSuppression(fileInput, files) {
      if (!isFileInputElement(fileInput)) return null;
      const selectedFiles = Array.from(files || []).filter(Boolean);
      const now = Date.now();
      pruneExpiredSanitizedFileHandoffSignatures(now);

      const inputExpiresAt = Number(sanitizedFileInputHandoffExpires.get(fileInput) || 0);
      const inputMarked = sanitizedFileInputHandoffs.has(fileInput);
      const inputActive = Boolean(inputMarked && inputExpiresAt && inputExpiresAt > now);
      const allFilesMatch = selectedFiles.every((file) => isSanitizedFileHandoffFile(file, now));

      if (inputMarked && inputExpiresAt && inputExpiresAt <= now) {
        sanitizedFileInputHandoffs.delete(fileInput);
        sanitizedFileInputHandoffExpires.delete(fileInput);
        deleteSanitizedFileInputHandoffRecord(fileInput);
        emitDebug("file-input:sanitized-handoff-expired", {
          inputExpired: true,
          signatureCount: 0,
          ttlMs: SANITIZED_FILE_HANDOFF_SUPPRESS_MS
        });
      }

      if (!selectedFiles.length) {
        const recentMatch = getRecentSanitizedFileInputHandoffRecord(fileInput, {
          files: selectedFiles
        });
        return inputActive || recentMatch
          ? {
              record: recentMatch?.record || sanitizedFileInputHandoffRecords.get(fileInput) || null,
              inputMatch: Boolean(inputActive || recentMatch?.inputMatch),
              signatureMatch: false,
              sitePendingMatch: Boolean(recentMatch?.sitePendingMatch),
              files: []
            }
          : null;
      }

      if (!allFilesMatch) {
        if (inputActive) {
          sanitizedFileInputHandoffs.delete(fileInput);
          sanitizedFileInputHandoffExpires.delete(fileInput);
          deleteSanitizedFileInputHandoffRecord(fileInput);
        }
        return null;
      }

      const recentMatch = getRecentSanitizedFileInputHandoffRecord(fileInput, {
        files: selectedFiles
      });
      return {
        record: recentMatch?.record || sanitizedFileInputHandoffRecords.get(fileInput) || null,
        inputMatch: inputActive,
        signatureMatch: true,
        files: selectedFiles
      };
    }

    function suppressSanitizedFileInputHandoffEvent(event, suppression) {
      const fileInput = event?.target || null;
      if (suppression.inputMatch) {
        emitDebug("file-input:sanitized-handoff-input-match", {
          eventType: event?.type || "",
          input: describeFileInputForDebug(fileInput, "sanitized-file-handoff"),
          files: suppression.files.map(describeFileForDebug)
        });
      }
      if (suppression.signatureMatch) {
        emitDebug("file-input:sanitized-handoff-signature-match", {
          eventType: event?.type || "",
          files: suppression.files.map(describeFileForDebug)
        });
      }
      emitDebug("file-input:sanitized-handoff-suppressed", {
        eventType: event?.type || "",
        input: describeFileInputForDebug(fileInput, "sanitized-file-handoff"),
        files: suppression.files.map(describeFileForDebug),
        browser: isFirefoxRuntime() ? "firefox" : "other",
        host: locationRef?.hostname || "",
        handoffId: suppression.record?.handoffId || "",
        sitePendingMatch: Boolean(suppression.sitePendingMatch)
      });
      if (!suppression.files.length) {
        const details = createSanitizedHandoffSuppressionDebug(
          fileInput,
          suppression,
          "empty_file_input_event"
        );
        emitDebug("file-input:empty-event-after-handoff-suppressed", {
          ...details,
          eventType: event?.type || "",
          browser: isFirefoxRuntime() ? "firefox" : "other"
        });
        emitDebug("file-handoff:stale-error-suppressed-after-success", {
          ...details,
          eventType: event?.type || "",
          staleReason: "empty_file_input_event"
        });
      }
    }

    function shouldSuppressSanitizedFileReprocessing(eventOrInput, files) {
      const fileInput = isFileInputElement(eventOrInput) ? eventOrInput : eventOrInput?.target || null;
      const selectedFiles =
        files ||
        (isFileInputElement(eventOrInput) ? eventOrInput.files : eventOrInput?.target?.files) ||
        [];
      const suppression = getSanitizedFileInputHandoffSuppression(fileInput, selectedFiles);
      if (suppression && eventOrInput?.type) {
        suppressSanitizedFileInputHandoffEvent(eventOrInput, suppression);
      }
      return Boolean(suppression);
    }

    function isFileUnavailableLocalFileResult(localFile) {
      return Boolean(
        localFile?.code === "file_unavailable" ||
          (
            !localFile?.code &&
            /could not read this local file/i.test(String(localFile?.message || ""))
          )
      );
    }

    function getFileUnavailableAfterHandoffSuppression(event, dataTransfer, localFile) {
      const fileInput = event?.target || null;
      if (!isFileInputElement(fileInput) || !isFileUnavailableLocalFileResult(localFile)) return null;

      const selectedFiles = Array.from(fileInput.files || []).filter(Boolean);
      const transferFiles = listLocalTransferFiles(dataTransfer);
      if (selectedFiles.length || transferFiles.length) return null;

      return getRecentSanitizedFileInputHandoffRecord(fileInput, {
        files: [],
        allowSitePending: true
      });
    }

    function suppressFileUnavailableAfterHandoff(event, suppression, localFile) {
      const fileInput = event?.target || null;
      const details = createSanitizedHandoffSuppressionDebug(
        fileInput,
        suppression,
        localFile?.code || "file_unavailable"
      );
      emitDebug("file-input:file-unavailable-after-handoff-suppressed", {
        ...details,
        eventType: event?.type || "",
        code: localFile?.code || "",
        browser: isFirefoxRuntime() ? "firefox" : "other"
      });
      emitDebug("file-handoff:stale-error-suppressed-after-success", {
        ...details,
        eventType: event?.type || "",
        staleReason: localFile?.code || "file_unavailable"
      });
      return {
        handled: true,
        ok: true,
        strategy: "file-unavailable-after-sanitized-handoff-suppressed"
      };
    }

    function getRecentSanitizedFileHandoffSuccessForSite(site = "", sanitizedFile = null) {
      const now = Date.now();
      pruneRecentSanitizedFileInputHandoffRecords(now);

      const expectedSite = String(site || getSanitizedFileHandoffSiteId() || "");
      const expectedSignature = getFileMetadataSignature(sanitizedFile);
      const matches = (record) => {
        if (!record || Number(record.expiresAt || 0) <= now) return false;
        if (expectedSite && record.site !== expectedSite) return false;
        if (!expectedSignature) return true;
        return record.signatures.includes(expectedSignature) || record.signature === expectedSignature;
      };

      if (matches(lastCompletedSanitizedFileInputHandoff)) return lastCompletedSanitizedFileInputHandoff;
      if (matches(lastCompletedPendingSanitizedFileInputHandoff)) {
        return lastCompletedPendingSanitizedFileInputHandoff;
      }
      for (let index = recentSanitizedFileInputHandoffRecords.length - 1; index >= 0; index -= 1) {
        const record = recentSanitizedFileInputHandoffRecords[index];
        if (matches(record)) return record;
      }
      return null;
    }

    function suppressStaleHandoffErrorAfterSuccess(reason, site = "", sanitizedFile = null, extra = {}) {
      const record = getRecentSanitizedFileHandoffSuccessForSite(site, sanitizedFile);
      if (!record) return false;
      emitDebug("file-handoff:stale-error-suppressed-after-success", {
        reason,
        site: record.site || site || "",
        adapter: record.adapter || "",
        handoffId: record.handoffId || "",
        sessionId: record.sessionId || "",
        stage: record.stage || "",
        pending: Boolean(record.pending),
        ageMs: Math.max(0, Date.now() - Number(record.timestamp || 0)),
        sanitizedFile: describeFileForDebug(sanitizedFile),
        ...extra
      });
      return true;
    }

    function isFirefoxProtectedFileInputEvent(event) {
      return Boolean(
        isFirefoxRuntime() &&
          isProtectedFileDropDriver(getCurrentHandoffDriverId()) &&
          event?.target &&
          event.target.tagName === "INPUT" &&
          String(event.target.type || "").toLowerCase() === "file"
      );
    }

    function getFirefoxFileInputTransaction(input) {
      return isFileInputElement(input) ? firefoxFileInputTransactions.get(input) || null : null;
    }

    function setFirefoxFileInputTransaction(input, updates) {
      if (!isFileInputElement(input)) return null;
      const existing = firefoxFileInputTransactions.get(input) || {};
      const transaction = {
        id: existing.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        state: existing.state || "processing",
        startedAt: existing.startedAt || Date.now(),
        rawSignature: existing.rawSignature || "",
        sanitizedSignature: existing.sanitizedSignature || "",
        suppressUntil: existing.suppressUntil || 0,
        replacementDispatched: Boolean(existing.replacementDispatched),
        ...(updates || {})
      };
      firefoxFileInputTransactions.set(input, transaction);
      return transaction;
    }

    function markFirefoxFileInputTransactionReplaced(input, files) {
      const transaction = getFirefoxFileInputTransaction(input);
      if (!transaction) return null;
      return setFirefoxFileInputTransaction(input, {
        state: "replaced",
        sanitizedSignature: getFileListMetadataSignature(files),
        suppressUntil: Date.now() + PROGRAMMATIC_INPUT_SUPPRESS_MS,
        replacementDispatched: true
      });
    }

    function shouldSuppressFirefoxFileInputEvent(event, transaction) {
      if (!transaction) return false;
      if (transaction.state === "processing") return true;
      if (transaction.suppressUntil && Date.now() < transaction.suppressUntil) return true;
      if (transaction.state === "replaced") {
        const currentSignature = getFileListMetadataSignature(event?.target?.files);
        return Boolean(
          transaction.sanitizedSignature &&
            currentSignature &&
            currentSignature === transaction.sanitizedSignature
        );
      }
      return false;
    }

    function clearLocalFileInputSelection(fileInput) {
      if (!isFileInputElement(fileInput)) return false;
      let cleared = false;
      try {
        fileInput.value = "";
        cleared = true;
      } catch {
        // Some host-controlled inputs reject value clearing; try an empty FileList below.
      }

      if (typeof DataTransferCtor === "function") {
        try {
          const emptyTransfer = new DataTransferCtor();
          fileInput.files = emptyTransfer.files;
          cleared = true;
        } catch {
          // Assignment is best-effort. The original event is still stopped fail-closed.
        }
      }
      return cleared;
    }

    return {
      sanitizedFileInputHandoffs,
      getFileMetadataSignature,
      getFileListMetadataSignature,
      isWeakSetFileObject,
      getSanitizedFileHandoffSiteId,
      getSanitizedFileHandoffAdapterId,
      isPendingSanitizedFileHandoffStage,
      pruneRecentSanitizedFileInputHandoffRecords,
      createSanitizedFileInputHandoffRecord,
      recordSanitizedFileInputHandoffCompletion,
      deleteSanitizedFileInputHandoffRecord,
      getRecentSanitizedFileInputHandoffRecord,
      createSanitizedHandoffSuppressionDebug,
      deleteSanitizedFileHandoffMark,
      expireSanitizedFileHandoffMarks,
      pruneExpiredSanitizedFileHandoffSignatures,
      markSanitizedFileHandoff,
      isSanitizedFileHandoffFile,
      getSanitizedFileInputHandoffSuppression,
      suppressSanitizedFileInputHandoffEvent,
      shouldSuppressSanitizedFileReprocessing,
      isFileUnavailableLocalFileResult,
      getFileUnavailableAfterHandoffSuppression,
      suppressFileUnavailableAfterHandoff,
      getRecentSanitizedFileHandoffSuccessForSite,
      suppressStaleHandoffErrorAfterSuccess,
      isFirefoxProtectedFileInputEvent,
      getFirefoxFileInputTransaction,
      setFirefoxFileInputTransaction,
      markFirefoxFileInputTransactionReplaced,
      shouldSuppressFirefoxFileInputEvent,
      clearLocalFileInputSelection
    };
  }

  root.PWM.createFileHandoffState = createFileHandoffState;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createFileHandoffState };
  }
})();
