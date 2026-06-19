(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const FileLimits = root.PWM.FileLimits || {};

  const MULTI_FILE_SMALL_MAX_BYTES =
    Number(FileLimits.MULTI_FILE_SMALL_MAX_BYTES || FileLimits.LOCAL_TEXT_HARD_BLOCK_BYTES) || 4 * 1024 * 1024;
  const MULTI_FILE_SUPPORTED_MAX_BYTES =
    Number(FileLimits.MULTI_FILE_SUPPORTED_MAX_BYTES || FileLimits.LARGE_TEXT_STREAMING_MAX_BYTES) || 50 * 1024 * 1024;
  const MAX_MULTI_FILE_SMALL_ATTACHMENTS = Number(FileLimits.MAX_MULTI_FILE_SMALL_ATTACHMENTS) || 20;
  const MAX_MULTI_FILE_LARGE_ATTACHMENTS = Number(FileLimits.MAX_MULTI_FILE_LARGE_ATTACHMENTS) || 5;
  const MAX_MULTI_FILE_ATTACHMENTS = MAX_MULTI_FILE_LARGE_ATTACHMENTS;
  const SAFE_MULTI_FILE_REASON_CODES = new Set([
    "unsupported_file_type",
    "large_file_count_exceeded",
    "small_file_count_exceeded",
    "file_exceeds_supported_size",
    "extraction_failed",
    "redaction_failed",
    "ocr_unavailable",
    "unsafe_image_boxes",
    "sanitized_handoff_failed",
    "file_processing_exception",
    "blocked_by_policy",
    "unknown_blocked"
  ]);

  function normalizeMultiFileIndex(value) {
    const index = Number(value);
    return Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  }

  function normalizeMultiFileReasonCode(value) {
    const code = String(value || "").replace(/[^a-z0-9_:-]/gi, "").slice(0, 64);
    if (!code) return "";
    if (SAFE_MULTI_FILE_REASON_CODES.has(code)) return code;
    if (/(?:authorization|bearer|cookie|credential|key|password|raw|secret|token|sk-proj|akia)/i.test(code)) {
      return "unknown_blocked";
    }
    if (/[A-Za-z0-9_-]{24,}/.test(code)) return "unknown_blocked";
    if (/^(?:file_unavailable|file_scan_failed|file_decode_failed|text_decode_failed|binary_file_detected)$/i.test(code)) {
      return "extraction_failed";
    }
    if (/^(?:file_too_large|local_text_payload_too_large|too_large|max_size_exceeded)$/i.test(code)) {
      return "file_exceeds_supported_size";
    }
    if (/^streaming_required$/i.test(code)) {
      return "redaction_failed";
    }
    if (/^(?:sanitized_file_create_failed|redaction_exception|sanitization_failed)$/i.test(code)) {
      return "redaction_failed";
    }
    if (/^(?:multi_file_sanitized_handoff_failed|sanitized_file_handoff_failed|data_transfer_failed)$/i.test(code)) {
      return "sanitized_handoff_failed";
    }
    if (/^(?:too_many_files|multi_file_limit_exceeded|policy_blocked)$/i.test(code)) {
      return "blocked_by_policy";
    }
    return "unknown_blocked";
  }

  function normalizeMultiFileStatus(value, fallback = "failed") {
    const status = String(value || "");
    return /^(?:sanitized|attached|blocked|failed|pending)$/.test(status) ? status : fallback;
  }

  function getMultiFileSizeBytes(file = {}) {
    const metadata = file.metadata && typeof file.metadata === "object" ? file.metadata : {};
    return Math.max(0, Number(metadata.sizeBytes ?? file.sizeBytes ?? file.size ?? 0) || 0);
  }

  function isLargeMultiFile(file = {}) {
    return getMultiFileSizeBytes(file) > MULTI_FILE_SMALL_MAX_BYTES;
  }

  function formatMultiFileSize(bytes) {
    const value = Math.max(0, Number(bytes || 0) || 0);
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} bytes`;
  }

  function createMultiFileItemSummary(item = {}) {
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const file = item.file && typeof item.file === "object" ? item.file : {};
    const index = normalizeMultiFileIndex(item.index);
    const extension = String(metadata.extension || file.extension || "").slice(0, 16);
    const mimeCategory = String(metadata.mimeCategory || file.mimeCategory || file.type || "")
      .split("/")[0]
      .replace(/[^a-z0-9.+-]/gi, "")
      .slice(0, 32);
    const status = normalizeMultiFileStatus(item.status, "failed");
    return {
      index,
      label: `file-${index + 1}`,
      status,
      extension,
      mimeCategory,
      sizeBytes: getMultiFileSizeBytes({ ...file, metadata }),
      code: normalizeMultiFileReasonCode(item.code || item.reason || "")
    };
  }

  function normalizeMultiFileSummaryItem(value = {}, options = {}) {
    const summary = value.summary && typeof value.summary === "object" ? value.summary : value;
    const fallbackStatus = options.fallbackStatus || "failed";
    const status = normalizeMultiFileStatus(options.status || summary.status, fallbackStatus);
    return {
      index: normalizeMultiFileIndex(summary.index),
      label: /^file-\d+$/.test(String(summary.label || "")) ? String(summary.label) : `file-${normalizeMultiFileIndex(summary.index) + 1}`,
      status,
      extension: /^\.[a-z0-9]{1,12}$/i.test(String(summary.extension || "")) ? String(summary.extension).toLowerCase() : "",
      mimeCategory: String(summary.mimeCategory || "").replace(/[^a-z0-9.+-]/gi, "").slice(0, 32),
      sizeBytes: getMultiFileSizeBytes(summary),
      code: normalizeMultiFileReasonCode(options.code || summary.code || "")
    };
  }

  function createMultiFileStatusSummary(options = {}) {
    const sanitizedItems = Array.isArray(options.sanitizedItems) ? options.sanitizedItems : [];
    const blockedItems = Array.isArray(options.blockedItems) ? options.blockedItems : [];
    const attached = sanitizedItems.map((item) =>
      normalizeMultiFileSummaryItem(item, { status: "attached", fallbackStatus: "attached" })
    );
    const blocked = blockedItems.map((item) =>
      normalizeMultiFileSummaryItem(item, {
        status: item?.summary?.status || item?.status || "blocked",
        fallbackStatus: "blocked",
        code: item?.code || item?.summary?.code || "unknown_blocked"
      })
    );
    return {
      sanitizedCount: attached.length,
      attachedCount: attached.length,
      blockedCount: blocked.length,
      attached,
      blocked,
      files: [...attached, ...blocked].sort((a, b) => a.index - b.index)
    };
  }

  function formatMultiFileItemLine(item) {
    const parts = [];
    if (item.extension) parts.push(item.extension);
    if (item.mimeCategory) parts.push(item.mimeCategory);
    parts.push(formatMultiFileSize(item.sizeBytes));
    const reason = item.code ? `, reason: ${item.code}` : "";
    return `- ${item.label} (${parts.join(", ")}) - ${item.status}${reason}`;
  }

  function formatMultiFileStatusMessage(summary = {}, options = {}) {
    const sanitizedCount = Math.max(0, Number(summary.sanitizedCount ?? summary.attachedCount ?? 0) || 0);
    const blockedCount = Math.max(0, Number(summary.blockedCount || 0) || 0);
    const attached = Array.isArray(summary.attached) ? summary.attached : [];
    const blocked = Array.isArray(summary.blocked) ? summary.blocked : [];
    const lines = [];
    if (options.blockedBeforeProcessing) {
      const reason = normalizeMultiFileReasonCode(options.reason || "");
      if (reason === "large_file_count_exceeded") {
        lines.push(`Up to ${MAX_MULTI_FILE_LARGE_ATTACHMENTS} large files can be attached per protected upload. This batch was blocked before reading or processing.`);
      } else if (reason === "small_file_count_exceeded") {
        lines.push(`Up to ${MAX_MULTI_FILE_SMALL_ATTACHMENTS} small files can be attached per protected upload. This batch was blocked before reading or processing.`);
      } else if (reason === "file_exceeds_supported_size") {
        lines.push(`Files over ${formatMultiFileSize(MULTI_FILE_SUPPORTED_MAX_BYTES)} are not supported for protected upload. This batch was blocked before reading or processing.`);
      } else {
        lines.push(`This protected upload batch was blocked before reading or processing.`);
      }
    } else if (sanitizedCount > 0 && blockedCount > 0) {
      lines.push(`LeakGuard attached ${sanitizedCount} sanitized file(s) and blocked ${blockedCount} file(s).`);
    } else if (sanitizedCount > 0) {
      lines.push(`LeakGuard attached ${sanitizedCount} sanitized file(s).`);
    } else {
      lines.push(`LeakGuard blocked ${blockedCount} file(s).`);
    }
    lines.push("No raw files were uploaded.");
    if (attached.length) {
      lines.push("", "Attached files:", ...attached.map(formatMultiFileItemLine));
    }
    if (blocked.length) {
      lines.push("", "Blocked files:", ...blocked.map(formatMultiFileItemLine));
    }
    return lines.join("\n");
  }

  function createMultiFileAttachPlan(files = [], options = {}) {
    const maxSmallFiles = Math.max(1, Number(options.maxSmallFiles || MAX_MULTI_FILE_SMALL_ATTACHMENTS));
    const maxLargeFiles = Math.max(1, Number(options.maxLargeFiles || MAX_MULTI_FILE_LARGE_ATTACHMENTS));
    const smallMaxBytes = Math.max(1, Number(options.smallMaxBytes || MULTI_FILE_SMALL_MAX_BYTES));
    const supportedMaxBytes = Math.max(smallMaxBytes, Number(options.supportedMaxBytes || MULTI_FILE_SUPPORTED_MAX_BYTES));
    const inputFiles = Array.from(files || []);
    const fileCount = inputFiles.length;
    const oversizedCount = inputFiles.filter((file) => getMultiFileSizeBytes(file) > supportedMaxBytes).length;
    const smallCount = inputFiles.filter((file) => getMultiFileSizeBytes(file) <= smallMaxBytes).length;
    const largeCount = inputFiles.filter((file) => {
      const size = getMultiFileSizeBytes(file);
      return size > smallMaxBytes && size <= supportedMaxBytes;
    }).length;
    if (fileCount <= 1) {
      return {
        mode: "single",
        ok: true,
        fileCount,
        acceptedCount: fileCount,
        blockedCount: 0,
        smallCount,
        largeCount,
        maxSmallFiles,
        maxLargeFiles,
        smallMaxBytes,
        supportedMaxBytes,
        reason: ""
      };
    }
    let reason = "";
    if (oversizedCount > 0) reason = "file_exceeds_supported_size";
    else if (largeCount > maxLargeFiles) reason = "large_file_count_exceeded";
    else if (smallCount > maxSmallFiles) reason = "small_file_count_exceeded";
    if (reason) {
      return {
        mode: "blocked",
        ok: false,
        fileCount,
        acceptedCount: 0,
        blockedCount: fileCount,
        smallCount,
        largeCount,
        maxSmallFiles,
        maxLargeFiles,
        smallMaxBytes,
        supportedMaxBytes,
        reason
      };
    }
    return {
      mode: "multi",
      ok: true,
      fileCount,
      acceptedCount: fileCount,
      blockedCount: 0,
      smallCount,
      largeCount,
      maxSmallFiles,
      maxLargeFiles,
      smallMaxBytes,
      supportedMaxBytes,
      reason: ""
    };
  }

  function originalFileMetadataFromLocalFile(localFile) {
    return root.PWM.SafeSnapshots.originalFileMetadataFromLocalFile(localFile);
  }

  function createSanitizedPayload(sanitizedFile, redactedText, localFile, analysis, result) {
    return {
      sanitizedFile,
      redactedText: String(redactedText || ""),
      rawText: typeof localFile?.text === "string" ? localFile.text : "",
      originalFile: originalFileMetadataFromLocalFile(localFile),
      placeholders: Array.from(new Set(String(redactedText || "").match(/\[[A-Z_]+_\d+\]/g) || [])),
      replacements: Array.isArray(result?.replacements)
        ? result.replacements.map((replacement) => ({
            id: replacement?.id || "",
            start: Number(replacement?.start || 0),
            end: Number(replacement?.end || 0),
            placeholder: replacement?.placeholder || ""
          }))
        : [],
      findingCount: Number(analysis?.secretFindings?.length || analysis?.findings?.length || 0)
    };
  }

  function createProcessingStageControls(options = {}) {
    const site = options.site || "";
    const showFileProcessingError =
      typeof options.showFileProcessingError === "function" ? options.showFileProcessingError : () => {};
    const hideFileProcessingOverlay =
      typeof options.hideFileProcessingOverlay === "function" ? options.hideFileProcessingOverlay : () => {};
    const showFileProcessingSuccess =
      typeof options.showFileProcessingSuccess === "function" ? options.showFileProcessingSuccess : () => {};

    return {
      failProcessing(reason, status = "Raw file upload blocked") {
        showFileProcessingError(status, {
          site,
          reason
        });
        hideFileProcessingOverlay(reason);
      },
      hideProcessing(reason) {
        hideFileProcessingOverlay(reason);
      },
      showProcessingSuccess(status, reason = "success") {
        showFileProcessingSuccess(status, {
          site,
          reason
        });
      }
    };
  }

  async function runSanitizedPayloadHandoffOrder(options = {}) {
    const context = options.context || "";
    const tryDropHandoff =
      typeof options.tryDropHandoff === "function" ? options.tryDropHandoff : async () => ({
        ok: false,
        stage: "failed",
        reason: "sanitized_payload_handoff_failed"
      });
    const trySanitizedHandoff =
      typeof options.trySanitizedHandoff === "function" ? options.trySanitizedHandoff : async () => false;
    const shouldSkipFallback =
      typeof options.shouldSkipFallback === "function" ? options.shouldSkipFallback : () => false;
    const insertFallbackText =
      typeof options.insertFallbackText === "function" ? options.insertFallbackText : async () => false;
    const fileStrategy = options.fileStrategy || "sanitized-file-handoff";
    const textStrategy = options.textStrategy || "sanitized-text-fallback";
    const failedReason = options.failedReason || "sanitized_payload_handoff_failed";

    if (context === "drop") {
      return tryDropHandoff();
    }

    if (await trySanitizedHandoff()) {
      return { ok: true, stage: "file", strategy: fileStrategy };
    }

    if (shouldSkipFallback()) {
      return {
        ok: false,
        stage: "failed",
        reason: options.skipFallbackReason || failedReason
      };
    }

    const inserted = await insertFallbackText();
    return inserted === true
      ? { ok: true, stage: "text", strategy: textStrategy }
      : {
          ok: false,
          stage: "failed",
          reason: inserted === "cancelled" ? "sanitized_text_cancelled" : failedReason
        };
  }

  function getSuccessDetailsForStage(stage, options = {}) {
    if (stage === "text") {
      return {
        successStatus: "Sanitized content inserted.",
        successReason: "inserted"
      };
    }
    if (stage === "download") {
      return {
        successStatus: "Sanitized file ready.",
        successReason: "download"
      };
    }
    if (stage === "file" && options.successStatus) {
      return {
        successStatus: options.successStatus,
        successReason: options.successReason || "attached"
      };
    }
    return {
      successStatus: "Sanitized file attached.",
      successReason: "attached"
    };
  }

  function classifyPostHandoffResult(options = {}) {
    const handoffResult = options.handoffResult;
    const context = options.context || "";
    const ok = Boolean(handoffResult.ok);
    const stage = handoffResult.stage || "";
    const handoffReason = handoffResult.reason || "";
    const cancellationReason = options.cancellationReason || "sanitized_text_cancelled";
    const treatsCancellation = options.treatCancellation !== false;
    const cancelled = !ok && treatsCancellation && handoffReason === cancellationReason;
    const reason = ok ? "" : cancelled ? cancellationReason : options.failureReason || "sanitized_file_handoff_failed";
    const shouldContinueFallback = !ok && !cancelled && options.allowPendingFallback === true;
    const shouldShowSuccess = ok && stage !== "pending";
    const successDetails = shouldShowSuccess
      ? getSuccessDetailsForStage(stage, {
          successStatus: options.successStatus,
          successReason: options.successReason
        })
      : {
          successStatus: "",
          successReason: ""
        };

    return {
      handled: true,
      ok,
      stage,
      reason,
      handoffReason,
      strategy: ok ? handoffResult.strategy || options.defaultSuccessStrategy || "sanitized-file-handoff" : "",
      shouldShowSuccess,
      shouldHideProcessing: cancelled || (ok && stage === "pending"),
      hideProcessingReason: cancelled ? "cancelled" : ok && stage === "pending" ? "pending" : "",
      shouldFailProcessing: !ok && !cancelled,
      shouldContinueFallback,
      shouldShowAttachedBadge: ok && (stage === "file" || context !== "drop"),
      successStatus: successDetails.successStatus,
      successReason: successDetails.successReason,
      handoffResult
    };
  }

  function classifyFileAttachDisposition(options = {}) {
    const handoffClassification = options.handoffClassification || {};
    const context = options.context || "";
    const stage = handoffClassification.stage || "";
    const usesDmzOverlay = options.usesDmzOverlay === true;
    const forceDmzAttached = options.forceDmzAttached === true;
    const forceAttachedBadge = options.forceAttachedBadge === true;
    const shouldUseDropDmz = context === "drop" && usesDmzOverlay;
    const shouldSetDmzAttached = forceDmzAttached || (shouldUseDropDmz && stage === "file");
    const shouldScheduleDmzCleanup = shouldUseDropDmz && (stage === "file" || stage === "text");
    const shouldShowAttachedBadge =
      forceAttachedBadge || handoffClassification.shouldShowAttachedBadge === true;
    const shouldHideProcessing = handoffClassification.shouldHideProcessing === true;
    const shouldShowSuccess = !shouldHideProcessing;

    return {
      status: handoffClassification.ok === false ? "blocked" : "attached",
      reason: handoffClassification.reason || handoffClassification.successReason || "attached",
      badgeMode: shouldShowAttachedBadge ? "attached" : "none",
      shouldSetDmzAttached,
      dmzStatus: shouldSetDmzAttached ? "Attached sanitized file" : "",
      dmzMode: shouldSetDmzAttached ? "attached" : "",
      shouldScheduleDmzCleanup,
      dmzCleanupDelay: shouldScheduleDmzCleanup ? (stage === "file" ? 1400 : 1800) : 0,
      shouldHideProcessing,
      hideProcessingReason: handoffClassification.hideProcessingReason || "",
      shouldShowSuccess,
      shouldShowOptimizedStatus: false,
      shouldFailProcessing: handoffClassification.shouldFailProcessing === true,
      successStatus:
        handoffClassification.shouldShowSuccess === true
          ? handoffClassification.successStatus
          : "Sanitized file attached.",
      successReason:
        handoffClassification.shouldShowSuccess === true
          ? handoffClassification.successReason
          : "attached",
      shouldShowAttachedBadge,
      attachedBadgeMessage: shouldShowAttachedBadge ? "LeakGuard attached a sanitized local file." : "",
      attachedBadgeHideDelay: shouldShowAttachedBadge ? 3200 : 0
    };
  }

  function classifyPendingAttachFallbackDecision(options = {}) {
    const handoffClassification = options.handoffClassification || {};
    const pendingAttachEnabled = options.pendingAttachEnabled === true;
    const adapterId = String(options.adapterId || "");
    const shouldAttemptPendingFallback =
      handoffClassification.shouldContinueFallback === true && pendingAttachEnabled;

    return {
      shouldAttemptPendingFallback,
      strategy: shouldAttemptPendingFallback ? `${adapterId}-pending-sanitized-file-handoff` : "",
      reason: handoffClassification.reason || ""
    };
  }

  function classifyFileAttachPreflightPlan(options = {}) {
    const context = options.context || "";
    const sizeZone = options.sizeZone || "";
    const usesDmzOverlay = options.usesDmzOverlay === true;
    const shouldUseDropDmz = context === "drop" && usesDmzOverlay;
    const skipTextFallback = options.skipTextFallback === true;
    const allowPendingFallback = options.allowPendingFallback === true;
    const imageRedactionMode = options.imageRedactionMode === true;

    return {
      shouldContinueSanitizedFlow: sizeZone !== "blocked",
      optimizedStatus: {
        shouldShow: sizeZone === "optimized",
        cleanupOnSanitizationFailure: "failed",
        cleanupOnAttachFailure: "failed",
        cleanupOnAttachCancellation: "cancelled",
        cleanupOnAttachSuccess: "complete"
      },
      sanitizationStatus: {
        shouldSetDmzRedacting: shouldUseDropDmz,
        dmzStatus: "Redacting...",
        dmzMode: "redacting",
        processingStatus: imageRedactionMode ? "Redacting image locally..." : "Sanitizing file locally...",
        processingProgress: "",
        processingBlocking: true
      },
      handoffStatus: {
        shouldSetDmzReady: shouldUseDropDmz,
        dmzStatus: imageRedactionMode ? "Sanitized image ready" : "Sanitized file ready",
        dmzMode: "ready",
        processingStatus: imageRedactionMode ? "Preparing sanitized image upload..." : "Preparing sanitized upload...",
        processingProgress: "Complete",
        processingBlocking: true
      },
      attachFlowOptions: {
        allowPendingFallback,
        defaultSuccessStrategy: imageRedactionMode ? "sanitized-image-file-handoff" : "sanitized-file-handoff",
        failureReason: imageRedactionMode ? "sanitized_image_handoff_failed" : "sanitized_file_handoff_failed",
        skipFallbackReason: skipTextFallback
          ? imageRedactionMode
            ? "image_text_fallback_disabled"
            : "firefox_gemini_file_input_replacement_failed"
          : "",
        successStatus: imageRedactionMode ? "Sanitized image attached." : "",
        fileStrategy: imageRedactionMode ? "sanitized-image-file-handoff" : "sanitized-file-handoff",
        textStrategy: "sanitized-text-fallback"
      }
    };
  }

  function normalizeStreamingPendingProviderId(value) {
    const id = String(value || "").trim().toLowerCase();
    return /^(gemini|grok|chatgpt|claude|openai|x)$/.test(id) ? id : "";
  }

  function getStreamingPendingProviderLabel(provider) {
    if (provider === "gemini") return "Gemini";
    if (provider === "grok") return "Grok";
    if (provider === "chatgpt") return "ChatGPT";
    if (provider === "claude") return "Claude";
    if (provider === "openai") return "OpenAI Chat";
    if (provider === "x") return "X";
    return provider || "site";
  }

  function classifyStreamingAttachPlan(options = {}) {
    const isGeminiDrop = options.isGeminiDrop === true;
    const isGrokDrop = options.isGrokDrop === true;
    const streamResultAction = options.streamResultAction || "";
    const hasSanitizedFile = options.hasSanitizedFile === true;
    const provider =
      normalizeStreamingPendingProviderId(options.pendingAdapterId) ||
      (isGeminiDrop ? "gemini" : isGrokDrop ? "grok" : "");
    const pendingOnlyProvider = provider === "gemini" || provider === "grok";
    const providerLabel = getStreamingPendingProviderLabel(provider);

    return {
      shouldContinueStreamingAttach: streamResultAction === "redacted" && hasSanitizedFile,
      blockedResult: {
        shouldBlock: streamResultAction === "blocked",
        reason: "streaming_file_blocked"
      },
      failedResult: {
        shouldBlock: streamResultAction !== "blocked" && (streamResultAction !== "redacted" || !hasSanitizedFile),
        reason: "streaming_file_redaction_failed",
        title: "Raw file upload blocked",
        message: "LeakGuard blocked raw file upload because streaming redaction failed."
      },
      preparingStatus: {
        processingStatus: "Preparing sanitized upload...",
        processingProgress: "Complete",
        processingBlocking: true
      },
      pendingAttach: {
        shouldAttempt: provider !== "",
        provider,
        detailsStage: provider ? `${provider}:streaming-pending-user-upload-input` : "",
        strategy: provider ? `${provider}-streaming-pending-sanitized-file-handoff` : "",
        queueFailureReason: provider ? `${provider}_pending_queue_failed` : "",
        queueFailureTitle: "Raw file upload blocked",
        queueFailureMessage: provider
          ? `LeakGuard sanitized the large file but could not queue ${providerLabel} pending attach.`
          : ""
      },
      genericAttach: {
        shouldAttempt: !pendingOnlyProvider,
        fileStrategy: "streaming-sanitized-file-handoff",
        textStrategy: "streaming-sanitized-text-fallback",
        defaultSuccessStrategy: "streaming-sanitized-file-handoff",
        failureReason: "streaming_sanitized_handoff_failed",
        skipFallbackReason: "firefox_gemini_file_input_replacement_failed",
        failureTitle: "Raw file upload blocked",
        failureMessage: "LeakGuard blocked raw file upload. Sanitized streaming file handoff failed."
      },
      dispositionOptions: {
        forceDmzAttached: true,
        forceAttachedBadge: true
      }
    };
  }

  async function runSanitizedFileAttachFlow(options = {}) {
    const context = options.context || "";
    const handoffResult = await runSanitizedPayloadHandoffOrder({
      context,
      tryDropHandoff: options.tryDropHandoff,
      trySanitizedHandoff: options.trySanitizedHandoff,
      shouldSkipFallback: options.shouldSkipFallback,
      skipFallbackReason: options.skipFallbackReason,
      insertFallbackText: options.insertFallbackText,
      fileStrategy: options.fileStrategy,
      textStrategy: options.textStrategy,
      failedReason: options.failedReason
    });
    const handoffClassification = classifyPostHandoffResult({
      handoffResult,
      context,
      allowPendingFallback: options.allowPendingFallback === true,
      defaultSuccessStrategy: options.defaultSuccessStrategy || "sanitized-file-handoff",
      failureReason: options.failureReason || "sanitized_file_handoff_failed",
      successStatus: options.successStatus,
      cancellationReason: options.cancellationReason,
      treatCancellation: options.treatCancellation
    });

    if (!handoffClassification.ok) {
      if (handoffClassification.reason === (options.cancellationReason || "sanitized_text_cancelled")) {
        return {
          action: "cancelled",
          handled: handoffClassification.handled,
          ok: false,
          reason: handoffClassification.reason,
          handoffResult,
          handoffClassification
        };
      }

      const getPendingAttachFallbackOptions =
        typeof options.getPendingAttachFallbackOptions === "function"
          ? options.getPendingAttachFallbackOptions
          : () => ({});
      const pendingOptions = getPendingAttachFallbackOptions(handoffClassification) || {};
      const pendingFallbackDecision = classifyPendingAttachFallbackDecision({
        handoffClassification,
        pendingAttachEnabled: pendingOptions.pendingAttachEnabled === true,
        adapterId: pendingOptions.adapterId
      });

      if (pendingFallbackDecision.shouldAttemptPendingFallback) {
        return {
          action: "pending",
          handled: handoffClassification.handled,
          ok: true,
          strategy: pendingFallbackDecision.strategy,
          reason: pendingFallbackDecision.reason,
          pendingFallbackDecision,
          pendingAttachOptions: pendingOptions,
          handoffResult,
          handoffClassification
        };
      }

      return {
        action: "fail-closed",
        handled: handoffClassification.handled,
        ok: false,
        reason: handoffClassification.reason,
        pendingFallbackDecision,
        pendingAttachOptions: pendingOptions,
        handoffResult,
        handoffClassification
      };
    }

    const disposition = classifyFileAttachDisposition({
      handoffClassification,
      context,
      usesDmzOverlay: options.usesDmzOverlay === true,
      forceDmzAttached: options.forceDmzAttached === true,
      forceAttachedBadge: options.forceAttachedBadge === true
    });

    return {
      action: "success",
      handled: handoffClassification.handled,
      ok: true,
      strategy: handoffClassification.strategy,
      disposition,
      handoffResult,
      handoffClassification
    };
  }

  root.PWM.FileAttachPipeline = {
    MAX_MULTI_FILE_ATTACHMENTS,
    MAX_MULTI_FILE_SMALL_ATTACHMENTS,
    MAX_MULTI_FILE_LARGE_ATTACHMENTS,
    MULTI_FILE_SMALL_MAX_BYTES,
    MULTI_FILE_SUPPORTED_MAX_BYTES,
    createMultiFileAttachPlan,
    createMultiFileItemSummary,
    createMultiFileStatusSummary,
    formatMultiFileStatusMessage,
    formatMultiFileSize,
    isLargeMultiFile,
    originalFileMetadataFromLocalFile,
    createSanitizedPayload,
    createProcessingStageControls,
    classifyPostHandoffResult,
    classifyFileAttachDisposition,
    classifyPendingAttachFallbackDecision,
    classifyFileAttachPreflightPlan,
    classifyStreamingAttachPlan,
    runSanitizedFileAttachFlow,
    runSanitizedPayloadHandoffOrder
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileAttachPipeline;
  }
})();
