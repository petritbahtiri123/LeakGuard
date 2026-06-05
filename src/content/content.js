(function () {
  if (globalThis.__PWM_CONTENT_BOOTSTRAPPED__) {
    return;
  }
  globalThis.__PWM_CONTENT_BOOTSTRAPPED__ = true;
  const ext = globalThis.PWM?.ext || globalThis.browser || globalThis.chrome;
  const isTopFrame = window.top === window;
  const fileDragGuard = globalThis.__PWM_FILE_DRAG_GUARD__ || null;

  const {
    Detector,
    PLACEHOLDER_TOKEN_REGEX,
    normalizeVisiblePlaceholders,
    buildNetworkUiFindings,
    evaluateDestinationPolicy,
    ComposerHelpers,
    FilePasteHelpers,
    createFileHandoffState,
    createFileHandoffPending,
    createFileHandoffFlow,
    PlaceholderRehydrator,
    ResponseObserver,
    RevealController
  } = globalThis.PWM;
  const {
    normalizeComposerText,
    normalizeEditorInnerText,
    isTextArea,
    isContentEditable,
    getInputText,
    getSelectionOffsets,
    spliceSelectionText,
    shouldInterceptBeforeInput,
    getBeforeInputData,
    selectFindingsOverlappingInsertion,
    deriveRewriteCaretOffset,
    buildRiskFingerprint,
    setInputText,
    setInputTextDirect,
    writePlainTextToContentEditablePreservingNewlines,
    forceRewriteInputText
  } = ComposerHelpers;
  const {
    dataTransferHasFiles,
    readLocalTextFileFromDataTransfer,
    createSanitizedTextFile
  } = FilePasteHelpers || {};
  const FileScanner = globalThis.PWM?.FileScanner || {};
  const StreamingFileRedactor = globalThis.PWM?.StreamingFileRedactor || {};
  const FileLimits = globalThis.PWM?.FileLimits || {};
  const {
    placeholderSessionIndex,
    tokenizePlaceholderText: tokenizeRehydrationPlaceholderText
  } = PlaceholderRehydrator;

  const CHATGPT_COMPOSER_SELECTORS = [
    "#prompt-textarea",
    "[data-testid='prompt-textarea']",
    "[contenteditable='true'][data-testid='prompt-textarea']",
    "[contenteditable='true'][role='textbox']",
    "textarea[data-testid='prompt-textarea']",
    "main form [contenteditable='true']",
    "form [contenteditable='true']"
  ];
  const COMPOSER_SELECTORS = [
    "#prompt-textarea",
    "[data-testid='prompt-textarea']",
    "textarea[data-testid='prompt-textarea']",
    "textarea[placeholder*='Message' i]",
    "main form textarea",
    "form textarea",
    "main textarea",
    ".ProseMirror[contenteditable]:not([contenteditable='false'])",
    ".ql-editor[contenteditable]:not([contenteditable='false'])",
    "[contenteditable]:not([contenteditable='false'])[data-lexical-editor='true']",
    "[contenteditable]:not([contenteditable='false'])[aria-multiline='true']",
    "[data-testid*='composer'] textarea",
    "[data-testid*='composer'] [contenteditable='true']",
    "[data-testid*='composer'] [contenteditable]:not([contenteditable='false'])",
    "[contenteditable='true'][data-testid='prompt-textarea']",
    "[contenteditable]:not([contenteditable='false'])[data-testid='prompt-textarea']",
    "[contenteditable='true'][role='textbox'][data-testid*='prompt']",
    "[contenteditable]:not([contenteditable='false'])[data-testid*='prompt']",
    "[contenteditable='true'][role='textbox'][aria-label*='message' i]",
    "[contenteditable='true'][role='textbox']",
    "[contenteditable]:not([contenteditable='false'])[role='textbox']",
    "main form [contenteditable='true']",
    "form [contenteditable='true']",
    "main form [contenteditable='true'][role='textbox']",
    "form [contenteditable='true'][role='textbox']",
    "main [contenteditable='true'][role='textbox']",
    "main [contenteditable='true'][aria-label*='message' i]",
    "[contenteditable='true'][aria-label*='message' i]",
    "main [contenteditable]:not([contenteditable='false'])",
    "[contenteditable]:not([contenteditable='false'])[aria-label*='message' i]"
  ];

  const SEND_BUTTON_SELECTORS = [
    "form button[data-testid='send-button']",
    "form button[data-testid*='send']",
    "form button[aria-label*='send' i]",
    "button[data-testid='send-button']",
    "button[data-testid*='send']",
    "button[aria-label*='send' i]"
  ];
  let currentUrl = location.href;
  let currentPublicState = {
    transformMode: "hide_public",
    placeholderCount: 0,
    trustedPlaceholders: [],
    policy: {
      enterpriseMode: false,
      allowReveal: true,
      allowUserOverride: true,
      allowProtectionPause: true,
      protectionPauseMaxMinutes: 15,
      protectionPauseRequiresUserAction: true,
      allowUserAddedSites: true,
      allowSiteRemoval: true,
      blockHttpSecrets: false,
      redactHttpAggressively: true,
      aiAssistEnabled: true,
      defaultAction: "redact",
      defaultDestinationAction: "allow",
      auditMode: "off",
      strictPolicyLoad: false,
      destinationPoliciesConfigured: false,
      destinationAction: "allow",
      destinationRequiresRedaction: false,
      destinationPolicies: [],
      matchedDestinationPolicy: null,
      destinationApprovalConfigured: false,
      destinationApproved: true,
      destinationBlocked: false,
      managedAvailable: false,
      managedApplied: false,
      strictFailure: false,
      http: location.protocol === "http:"
    },
    protection: {
      paused: false,
      pausedUntil: 0,
      allowProtectionPause: true,
      protectionEnforced: false
    }
  };
  let badgeEl = null;
  let lastBadgeText = "";
  let badgeHideTimer = 0;
  let bypassNextSubmit = false;
  let inputScanTimer = 0;
  let rehydrateObserver = null;
  let modalOpen = false;
  let lastTypedPromptText = "";
  let typedScanGeneration = 0;
  let activeRiskEditor = null;
  let suppressInputScanUntil = 0;
  const rewriteFailureModalSuppressions = new Map();
  let statusPanelEl = null;
  let statusPanelCollapsed = false;
  let statusPanelProtectionValueEl = null;
  let statusPanelSiteValueEl = null;
  let statusPanelComposerValueEl = null;
  let statusPanelSessionValueEl = null;
  let statusPanelPauseBtn = null;
  let extensionRuntimeAvailable = true;
  const rawFileDropInterceptions = new WeakSet();
  const fileDragEventRoots = new WeakSet();
  const editorRiskState = new WeakMap();
  const CONTENT_DEBUG_EVENTS = Object.freeze({
    FILE_UI_PROCESSING_SHOWN: "file-ui:processing-shown",
    PENDING_ATTACH_PROMPT_SHOWN: "pending-attach-prompt-shown",
    FILE_HANDOFF_PENDING_PROMPT_SHOWN: "file-handoff:pending-prompt-shown",
    FILE_UI_PENDING_PROMPT_SHOWN: "file-ui:pending-prompt-shown",
    FILE_HANDOFF_TEXT_FALLBACK_UNAVAILABLE: "file-handoff:text-fallback-unavailable",
    FILE_HANDOFF_TEXT_FALLBACK_FAILED: "file-handoff:text-fallback-failed",
    FILE_HANDOFF_TEXT_FALLBACK_SUCCESS: "file-handoff:text-fallback-success",
    FILE_HANDOFF_PENDING_DUPLICATE_SUPPRESSED: "file-handoff:pending-duplicate-suppressed"
  });
  const SANITIZED_FILE_HANDOFF_SUPPRESS_MS = 30000;
  const PROGRAMMATIC_INPUT_SUPPRESS_MS = 500;
  const CHATGPT_LARGE_PASTE_FILE_THRESHOLD = 16 * 1024;
  const CHATGPT_SANITIZED_PASTE_FILE_NAME = "leakguard-redacted-paste.txt";
  const CHATGPT_SYNC_EVENT_DATA_MAX_CHARS = 256 * 1024;
  const CHATGPT_SYNC_VERIFY_DELAY_MS = 80;
  const GEMINI_DIRECT_TEXT_INSERT_THRESHOLD = 8 * 1024;
  const GEMINI_AUTO_INSERT_TEXT_LIMIT = 256 * 1024;
  const GEMINI_LARGE_TEXT_SUPPRESS_MS = 2500;
  const LOCAL_TEXT_FAST_MAX_BYTES =
    FileScanner.LOCAL_TEXT_FAST_MAX_BYTES ||
    FileLimits.LOCAL_TEXT_FAST_MAX_BYTES ||
    2 * 1024 * 1024;
  const LOCAL_TEXT_OPTIMIZED_MAX_BYTES =
    FileScanner.LOCAL_TEXT_OPTIMIZED_MAX_BYTES ||
    FileLimits.LOCAL_TEXT_OPTIMIZED_MAX_BYTES ||
    4 * 1024 * 1024;
  const LOCAL_TEXT_HARD_BLOCK_BYTES =
    FileScanner.LOCAL_TEXT_HARD_BLOCK_BYTES ||
    FileLimits.LOCAL_TEXT_HARD_BLOCK_BYTES ||
    4 * 1024 * 1024;
  const LOCAL_TEXT_HARD_BLOCK_TITLE =
    FileScanner.LOCAL_TEXT_HARD_BLOCK_TITLE ||
    FileLimits.LOCAL_TEXT_HARD_BLOCK_TITLE ||
    "Large payload blocked for browser stability";
  const LOCAL_TEXT_HARD_BLOCK_MESSAGE =
    FileScanner.LOCAL_TEXT_HARD_BLOCK_MESSAGE ||
    FileLimits.LOCAL_TEXT_HARD_BLOCK_MESSAGE ||
    "This content is over 4 MB. LeakGuard did not process or send it automatically to avoid browser instability. Split the file into smaller parts, or sanitize it separately before upload.";
  const LARGE_TEXT_STREAMING_MAX_BYTES =
    StreamingFileRedactor.LARGE_TEXT_STREAMING_MAX_BYTES ||
    FileScanner.LARGE_TEXT_STREAMING_MAX_BYTES ||
    FileLimits.LARGE_TEXT_STREAMING_MAX_BYTES ||
    50 * 1024 * 1024;
  const STREAMING_BLOCK_TITLE =
    StreamingFileRedactor.STREAMING_BLOCK_TITLE ||
    FileScanner.LARGE_TEXT_STREAMING_BLOCK_TITLE ||
    FileLimits.LARGE_TEXT_STREAMING_BLOCK_TITLE ||
    "File too large for local redaction";
  const STREAMING_BLOCK_MESSAGE =
    StreamingFileRedactor.STREAMING_BLOCK_MESSAGE ||
    FileScanner.LARGE_TEXT_STREAMING_BLOCK_MESSAGE ||
    FileLimits.LARGE_TEXT_STREAMING_BLOCK_MESSAGE ||
    "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.";
  const LOCAL_FILE_STREAMING_REQUIRED_MESSAGE =
    FileScanner.LOCAL_FILE_STREAMING_REQUIRED_MESSAGE ||
    FilePasteHelpers?.LOCAL_FILE_STREAMING_REQUIRED_MESSAGE ||
    FileLimits.LOCAL_FILE_STREAMING_REQUIRED_MESSAGE ||
    "LeakGuard will stream-redact this large text file locally before upload.";
  const LOCAL_FILE_UNSUPPORTED_WARNING =
    FileScanner.UNSUPPORTED_COMPOSER_FILE_MESSAGE ||
    FilePasteHelpers?.LOCAL_FILE_UNSUPPORTED_WARNING ||
    FileLimits.UNSUPPORTED_COMPOSER_FILE_MESSAGE ||
    "LeakGuard did not scan or redact this file. Unsupported file types such as PDF, DOCX, images, archives, executables, and binary files are not protected in this release. Normal upload may continue through the site.";
  const FILE_DRAG_SESSION_RESET_MS = 5000;
  const GEMINI_UPLOAD_INPUT_WAIT_MS = 450;
  const GEMINI_GHOST_INGRESS_TIMEOUT_MS = 2200;
  const GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS = 60000;
  const GROK_PENDING_SANITIZED_FILE_HANDOFF_MS = 60000;
  const GEMINI_SANITIZED_DOWNLOAD_MESSAGE =
    "Sanitized file downloaded. Upload the LeakGuard redacted copy to Gemini.";
  const GEMINI_SANITIZED_DOWNLOAD_MODAL_MESSAGE =
    "Gemini does not expose a safe upload target. LeakGuard downloaded a sanitized copy. Upload that redacted file manually.";
  const GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE =
    "Sanitized content inserted as text because Gemini rejected sanitized file upload.";
  const LOCAL_FILE_SANITIZED_TEXT_FALLBACK_MESSAGE =
    "Sanitized content inserted as text because the site did not accept a sanitized file upload.";
  const FIREFOX_GEMINI_FILE_INPUT_BRIDGE_FAILURE_MESSAGE =
    "LeakGuard blocked the raw file drop. Could not locate Gemini upload input. Please use the upload button or retry.";
  const GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE =
    "Large file sanitized. Click Attach sanitized file or Gemini Upload files.";
  const GROK_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE =
    "Large file sanitized. Click Attach sanitized file or Grok Upload/Attach.";
  const REWRITE_FAILURE_SUPPRESS_MS = 6000;
  let lastDiscoveredFileInput = null;
  let fileDragDiscoveryCompleted = false;
  let fileDragDiscoveryScheduled = false;
  let fileDragDiscoveryTimer = 0;
  let fileDragSessionResetTimer = 0;
  let fileDragSessionId = 0;
  let fileDragDetectedLogged = false;
  let lastGeminiDropSessionHash = "";
  const geminiSanitizedDownloadFallbacks = new WeakSet();
  let pendingGeminiSanitizedFileHandoff = null;
  let pendingGeminiSanitizedFileObserver = null;
  let pendingGeminiSanitizedFileTimer = 0;
  let pendingGeminiSanitizedFileClickHandler = null;
  let pendingGeminiGhostIngressClickCleanup = null;
  let pendingGrokSanitizedFileHandoff = null;
  let pendingGrokSanitizedFileObserver = null;
  let pendingGrokSanitizedFileTimer = 0;
  let pendingGrokSanitizedFileClickHandler = null;
  const FILE_HANDOFF_PENDING_ATTACH_ENABLED = Object.freeze({
    gemini: true,
    grok: true,
    chatgpt: false,
    claude: false,
    openai: false,
    x: false
  });
  let dmzOverlayEl = null;
  let dmzOverlayStatusEl = null;
  let dmzOverlayTimer = 0;
  let dmzFallbackStyleEl = null;
  let fileProcessingOverlayEl = null;
  let fileProcessingTitleEl = null;
  let fileProcessingStatusEl = null;
  let fileProcessingProgressEl = null;
  let fileProcessingHideTimer = 0;
  let pendingAttachPromptEl = null;
  let pendingAttachPromptSite = "";
  let syntheticFileListCapabilityCache = null;
  let inputFileAssignmentCapabilityCache = null;
  const fileHandoffState = createFileHandoffState({
    emitDebug: debugReveal,
    describeFileForDebug,
    describeFileInputForDebug,
    getCurrentHandoffDriverId,
    getFileHandoffAdapterForLocation,
    isFileInputElement,
    isFirefoxRuntime,
    isProtectedFileDropDriver,
    listLocalTransferFiles,
    locationRef: location,
    setTimeoutFn: setTimeout,
    DataTransferCtor: typeof DataTransfer === "function" ? DataTransfer : null,
    constants: {
      PROGRAMMATIC_INPUT_SUPPRESS_MS,
      SANITIZED_FILE_HANDOFF_SUPPRESS_MS
    }
  });
  const {
    sanitizedFileInputHandoffs,
    getFileMetadataSignature,
    getFileListMetadataSignature,
    markSanitizedFileHandoff,
    deleteSanitizedFileHandoffMark,
    shouldSuppressSanitizedFileReprocessing,
    isFileUnavailableLocalFileResult,
    getFileUnavailableAfterHandoffSuppression,
    suppressFileUnavailableAfterHandoff,
    suppressStaleHandoffErrorAfterSuccess,
    isFirefoxProtectedFileInputEvent,
    getFirefoxFileInputTransaction,
    setFirefoxFileInputTransaction,
    markFirefoxFileInputTransactionReplaced,
    shouldSuppressFirefoxFileInputEvent,
    clearLocalFileInputSelection
  } = fileHandoffState;
  const fileHandoffPending = createFileHandoffPending({
    attemptPendingGeminiSanitizedFileHandoff,
    attemptPendingGrokSanitizedFileHandoff,
    clearPendingGeminiSanitizedFileHandoff,
    clearPendingGrokSanitizedFileHandoff,
    clearPendingSanitizedAttachPrompt,
    createSanitizedFileHandoffDetails,
    debugFileHandoffAdapterSelected,
    describeFileForDebug,
    describeFileHandoffAdapter,
    downloadSanitizedFileFallback: (...args) => downloadSanitizedFileFallback(...args),
    emitDebug: debugReveal,
    getCurrentHandoffDriver: (...args) => getCurrentHandoffDriver(...args),
    hideBadgeSoon,
    isFileHandoffAdapterPendingAttachEnabled,
    normalizeFileHandoffAdapter,
    normalizeTarget,
    queuePendingGeminiSanitizedFileHandoff,
    queuePendingGrokSanitizedFileHandoff,
    readSanitizedFileTextForFallback,
    refreshBadgeFromCurrentInput,
    setBadge,
    suppressStaleHandoffErrorAfterSuccess
  });
  const {
    createPendingAttachEvent,
    queuePendingSanitizedFileHandoff,
    attemptPendingSanitizedFileHandoff,
    clearPendingSanitizedFileHandoff,
    attachPendingSanitizedFileWithTrustedActivation,
    insertPendingSanitizedFileText,
    downloadPendingSanitizedFile,
    cancelPendingSanitizedFileAttach
  } = fileHandoffPending;
  const fileHandoffFlow = createFileHandoffFlow({
    applySanitizedTextFallback,
    buildSanitizedDownloadFileName,
    createSanitizedDataTransfer,
    createSanitizedDataTransferForHandoff,
    createSanitizedFileHandoffDetails,
    createSanitizedPayload,
    debugFileHandoffAdapterSelected,
    describeFileForDebug,
    describeFileHandoffAdapter,
    documentRef: document,
    dispatchSanitizedFileEvent,
    downloadGeminiSanitizedFileFallback,
    emitDebug: debugReveal,
    findGeminiFileInput,
    formatSanitizedFileFallbackText,
    getCurrentHandoffDriverId,
    getFileHandoffAdapterById,
    getFileHandoffAdapterForLocation,
    handOffGeminiSanitizedFileUpload,
    handOffGrokSanitizedFileUpload,
    handOffSanitizedFileInput,
    hideBadgeSoon,
    hideDmzOverlay,
    insertGeminiSanitizedText,
    isFileHandoffAdapterPendingAttachEnabled,
    isFirefoxRuntime,
    isGeminiHost,
    isGrokHost,
    isProtectedFileDropDriver,
    locationRef: location,
    logSanitizedFileHandoffFailure,
    queuePendingSanitizedFileHandoff,
    readSanitizedFileTextForFallback,
    refreshBadgeFromCurrentInput,
    resolveFileInputForHandoff,
    scheduleDmzOverlayCleanup,
    sendRuntimeMessage,
    setBadge,
    setDmzOverlayState,
    shouldUseFirefoxTextFallbackForFileHandoff,
    tryFirefoxGeminiFileInputBridge,
    tryGeminiSanitizedFileAttach
  });
  const {
    isFileOnlySanitizedPayload,
    isSafeSanitizedPayload,
    handOffSanitizedLocalFile,
    tryRealFileInputSanitizedFileAttach,
    insertSanitizedPayloadText,
    downloadSanitizedFileFallback,
    getCurrentHandoffDriver,
    handoffSanitizedPayload
  } = fileHandoffFlow;

  function isExtensionContextInvalidatedError(error) {
    const message = String(error?.message || error || "");
    return /extension context invalidated/i.test(message);
  }

  function createExtensionContextInvalidatedError(originalError = null) {
    const error = new Error("LeakGuard was reloaded. Refresh this page to reactivate protection.");
    error.reason = "extension_context_invalidated";
    error.originalError = originalError;
    return error;
  }

  function markExtensionContextInvalidated() {
    extensionRuntimeAvailable = false;
    clearPendingGeminiGhostIngressClickInterceptor("extension-context-invalidated");
    clearPendingGeminiSanitizedFileHandoff("extension-context-invalidated");
    clearPendingGrokSanitizedFileHandoff("extension-context-invalidated");
    setBadge("LeakGuard reloaded. Refresh this page.");
    hideBadgeSoon(5000);
  }

  async function sendRuntimeMessage(message) {
    if (!extensionRuntimeAvailable || !ext?.runtime?.sendMessage) {
      markExtensionContextInvalidated();
      throw createExtensionContextInvalidatedError();
    }

    try {
      return await ext.runtime.sendMessage(message);
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        markExtensionContextInvalidated();
        throw createExtensionContextInvalidatedError(error);
      }
      throw error;
    }
  }

  function handleContentError(error) {
    if (error?.reason === "extension_context_invalidated" || isExtensionContextInvalidatedError(error)) {
      markExtensionContextInvalidated();
      return;
    }

    console.error(error);
  }

  function isDebugEnabled() {
    return Boolean(globalThis.PWM?.DebugLogger?.isDebugEnabled?.({ root: window }));
  }

  function summarizeDebugText(text) {
    return globalThis.PWM.DebugLogger.summarizeDebugText(text, {
      normalizeText: normalizeComposerText,
      normalizeVisiblePlaceholders,
      placeholderTokenRegex: PLACEHOLDER_TOKEN_REGEX
    });
  }

  function collectComposerDebugSnapshot(input, expected, writeText) {
    return globalThis.PWM.DebugLogger.collectComposerDebugSnapshot(input, expected, writeText, {
      getInputText,
      normalizeText: normalizeComposerText,
      normalizeEditorInnerText,
      normalizeVisiblePlaceholders,
      placeholderTokenRegex: PLACEHOLDER_TOKEN_REGEX
    });
  }

  function debugLogSnapshot(label, input, expected, writeText) {
    if (!isDebugEnabled()) return;

    const snapshot = collectComposerDebugSnapshot(input, expected, writeText);
    globalThis.PWM?.DebugLogger?.debugSnapshot?.(label, snapshot, { root: window });
  }

  function debugReveal(label, payload) {
    globalThis.PWM?.DebugLogger?.debugEvent?.(label, payload, { root: window });
  }

  function normalizeFileDebugString(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, "-")
      .slice(0, 96);
  }

  function isSafeFileDebugToken(value) {
    const text = String(value || "");
    return Boolean(text) && text.length <= 96 && !/[\\/]/.test(text) && !/[?#@]/.test(text);
  }

  function getFileDebugExtension(fileMeta) {
    const rawName = String(fileMeta?.name || "");
    if (!isSafeFileDebugToken(rawName) || rawName.includes("..")) return "";
    const match = /\.([a-z0-9]{1,12})$/i.exec(rawName);
    return match ? match[1].toLowerCase() : "";
  }

  function getFileDebugMimeCategory(fileMeta) {
    const type = String(fileMeta?.type || "").toLowerCase();
    if (!type || /[\\/?#@]/.test(type)) return "";
    return type.split("/")[0].replace(/[^a-z0-9.+-]/g, "").slice(0, 32);
  }

  function describeSafeFileDebugMetadata(fileMeta) {
    if (!fileMeta || typeof fileMeta !== "object") return null;
    const extension = getFileDebugExtension(fileMeta);
    const mimeCategory = getFileDebugMimeCategory(fileMeta);
    const sizeBytes = Number(fileMeta.size ?? fileMeta.sizeBytes ?? 0) || 0;
    return {
      sizeBytes,
      extension,
      category: extension || mimeCategory || "unknown",
      mimeCategory,
      supportedText: Boolean(fileMeta.supportedText),
      sanitized: Boolean(fileMeta.sanitized)
    };
  }

  function describeSafeFileInputDebugMetadata(inputMeta) {
    if (!inputMeta || typeof inputMeta !== "object") return null;
    return {
      tag: normalizeFileDebugString(inputMeta.tag || "input"),
      source: normalizeFileDebugString(inputMeta.source),
      disabled: Boolean(inputMeta.disabled),
      hidden: Boolean(inputMeta.hidden),
      multiple: Boolean(inputMeta.multiple),
      filesLength: Number(inputMeta.filesLength || 0) || 0
    };
  }

  function describeSafeFileHandoffAdapterDebugMetadata(adapter) {
    if (!adapter || typeof adapter !== "object") return null;
    return {
      id: normalizeFileDebugString(adapter.id),
      siteLabel: normalizeFileDebugString(adapter.siteLabel || adapter.id),
      hostCount: Array.isArray(adapter.hosts) ? adapter.hosts.length : 0,
      supportsDirectDropReplay: Boolean(adapter.supportsDirectDropReplay),
      supportsPendingAttach: Boolean(adapter.supportsPendingAttach),
      supportsTrustedAttachButton: Boolean(adapter.supportsTrustedAttachButton),
      pendingAttachEnabled: Boolean(adapter.pendingAttachEnabled)
    };
  }

  function copySafeFileDebugScalar(output, key, value) {
    if (value === null || typeof value === "boolean") {
      output[key] = value;
      return;
    }
    if (typeof value === "number") {
      output[key] = Number.isFinite(value) ? value : 0;
      return;
    }
    if (typeof value !== "string") return;
    const normalized = normalizeFileDebugString(value);
    if (normalized) output[key] = normalized;
  }

  function createSafeFileAttachDebugPayload(payload = {}) {
    const source = payload && typeof payload === "object" ? payload : {};
    const output = {};
    const scalarKeys = new Set([
      "action",
      "blocking",
      "bytes",
      "bytesProcessed",
      "changeEventDispatched",
      "chunks",
      "context",
      "fastMaxBytes",
      "findingsCount",
      "hardBlockBytes",
      "host",
      "hostname",
      "inputEventDispatched",
      "maxBytes",
      "outcome",
      "reason",
      "rendered",
      "site",
      "stage",
      "strategy",
      "totalBytes"
    ]);

    for (const key of scalarKeys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        copySafeFileDebugScalar(output, key, source[key]);
      }
    }

    if (source.progress && typeof source.progress === "object") {
      output.progress = {
        bytesProcessed: Number(source.progress.bytesProcessed || 0) || 0,
        totalBytes: Number(source.progress.totalBytes || 0) || 0,
        chunks: Number(source.progress.chunks || 0) || 0
      };
    }
    if (source.file) output.file = describeSafeFileDebugMetadata(source.file);
    if (source.sanitizedFile) output.sanitizedFile = describeSafeFileDebugMetadata(source.sanitizedFile);
    if (source.originalFile) output.originalFile = describeSafeFileDebugMetadata(source.originalFile);
    if (source.input) output.input = describeSafeFileInputDebugMetadata(source.input);
    if (source.adapter) output.adapter = describeSafeFileHandoffAdapterDebugMetadata(source.adapter);
    if (Array.isArray(source.files)) {
      output.fileCount = source.files.length;
      output.files = source.files.map(describeSafeFileDebugMetadata).filter(Boolean);
    }
    if (Array.isArray(source.events)) {
      output.events = source.events.map(normalizeFileDebugString).filter(Boolean).slice(0, 8);
      output.eventCount = output.events.length;
    }

    return output;
  }

  function debugFileAttachMetadata(label, payload) {
    debugReveal(label, createSafeFileAttachDebugPayload(payload));
  }

  function debugResponseRehydration(label, payload) {
    globalThis.PWM?.DebugLogger?.debugEvent?.(label, payload || {}, { root: window });
  }

  function getSafeElementAttribute(el, name) {
    try {
      return String(el?.getAttribute?.(name) || "");
    } catch {
      return "";
    }
  }

  function countDebugPlaceholders(text) {
    return (String(text || "").match(/\[[A-Z_]+_\d+\]/g) || []).length;
  }

  function getDebugTextLength(value) {
    return normalizeComposerText(value || "").length;
  }

  function getChatGptSendButtonDebugState(input) {
    if (typeof Element === "undefined") return null;
    try {
      const button = findSendButton(input);
      if (!button) {
        return {
          found: false,
          enabled: null
        };
      }
      const disabled = Boolean(
        button.disabled ||
          button.getAttribute?.("disabled") != null ||
          button.getAttribute?.("aria-disabled") === "true"
      );
      return {
        found: true,
        enabled: !disabled
      };
    } catch {
      return null;
    }
  }

  function getChatGptComposerSyncDebug(input, expectedText = "", actualText = null) {
    const actual = actualText == null ? getInputText(input) : normalizeComposerText(actualText);
    const innerText = normalizeComposerText(input?.innerText || "");
    const textContent = normalizeComposerText(input?.textContent || "");
    let selection = null;
    try {
      selection = getSelectionOffsets(input);
    } catch {
      selection = null;
    }
    let className = "";
    try {
      className =
        typeof input?.className === "string"
          ? input.className
          : getSafeElementAttribute(input, "class");
    } catch {
      className = "";
    }

    return {
      host: location?.hostname || "",
      input: {
        tag: input?.tagName || "",
        role: getSafeElementAttribute(input, "role") || input?.role || "",
        contenteditable: getSafeElementAttribute(input, "contenteditable"),
        dataTestId: getSafeElementAttribute(input, "data-testid"),
        id: input?.id || getSafeElementAttribute(input, "id"),
        classSnippet: className.slice(0, 96)
      },
      expectedLength: getDebugTextLength(expectedText),
      actualLength: getDebugTextLength(actual),
      innerTextLength: getDebugTextLength(innerText),
      textContentLength: getDebugTextLength(textContent),
      placeholderCount: countDebugPlaceholders(actual || expectedText),
      expectedPlaceholderCount: countDebugPlaceholders(expectedText),
      actualPlaceholderCount: countDebugPlaceholders(actual),
      selection:
        selection && Number.isFinite(Number(selection.start)) && Number.isFinite(Number(selection.end))
          ? {
              start: Number(selection.start),
              end: Number(selection.end)
            }
          : null,
      sendButton: getChatGptSendButtonDebugState(input)
    };
  }

  function debugChatGptSync(label, input, expectedText = "", actualText = null, extra = {}) {
    if (!isChatGptHost()) return;
    debugReveal(label, {
      ...getChatGptComposerSyncDebug(input, expectedText, actualText),
      ...(extra || {})
    });
  }

  function collectFailureDetails(input, expectedText, actualText, context) {
    return {
      context,
      expected: summarizeDebugText(expectedText),
      actual: summarizeDebugText(actualText),
      innerText: summarizeDebugText(input?.innerText || ""),
      normalizedInnerText: summarizeDebugText(normalizeEditorInnerText(input?.innerText || "")),
      textContent: summarizeDebugText(input?.textContent || "")
    };
  }

  function logFailureDetails(details) {
    console.group("[PWM] rewrite verification failure");
    console.log(details);
    console.groupEnd();
  }

  function consumeInterceptionEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function logFileInterception(label, details) {
    details = details || {};
    try {
      console.log(`[LeakGuard] ${label}`, details);
    } catch {
      // Console diagnostics are best-effort and must not affect protection.
    }
  }

  function isFirefoxRuntime() {
    return Boolean(globalThis.PWM?.isFirefox) || /Firefox/i.test(navigator.userAgent || "");
  }

  function createSafeCapabilityProbeFile() {
    if (typeof File === "function") {
      return new File(["leakguard capability probe"], "leakguard-probe.txt", {
        type: "text/plain",
        lastModified: 0
      });
    }

    if (typeof Blob === "function") {
      const blob = new Blob(["leakguard capability probe"], { type: "text/plain" });
      try {
        Object.defineProperty(blob, "name", {
          value: "leakguard-probe.txt",
          configurable: true
        });
        Object.defineProperty(blob, "lastModified", {
          value: 0,
          configurable: true
        });
      } catch {
        // Metadata is not required for the capability check.
      }
      return blob;
    }

    return null;
  }

  function canUseSyntheticDataTransferFileList() {
    if (syntheticFileListCapabilityCache != null) {
      return syntheticFileListCapabilityCache;
    }

    syntheticFileListCapabilityCache = false;
    if (typeof DataTransfer !== "function") {
      return syntheticFileListCapabilityCache;
    }

    try {
      const safeFile = createSafeCapabilityProbeFile();
      if (!safeFile) return syntheticFileListCapabilityCache;

      const transfer = new DataTransfer();
      if (typeof transfer.items?.add !== "function") return syntheticFileListCapabilityCache;
      transfer.items.add(safeFile);
      syntheticFileListCapabilityCache = Number(transfer.files?.length || 0) > 0;
      return syntheticFileListCapabilityCache;
    } catch {
      syntheticFileListCapabilityCache = false;
      return syntheticFileListCapabilityCache;
    }
  }

  function canAssignFilesToInput() {
    if (inputFileAssignmentCapabilityCache != null) {
      return inputFileAssignmentCapabilityCache;
    }

    inputFileAssignmentCapabilityCache = false;
    if (!canUseSyntheticDataTransferFileList() || typeof document?.createElement !== "function") {
      return inputFileAssignmentCapabilityCache;
    }

    try {
      const safeFile = createSafeCapabilityProbeFile();
      const transfer = new DataTransfer();
      const input = document.createElement("input");
      input.type = "file";
      transfer.items.add(safeFile);
      input.files = transfer.files;
      inputFileAssignmentCapabilityCache = Number(input.files?.length || 0) > 0;
      return inputFileAssignmentCapabilityCache;
    } catch {
      inputFileAssignmentCapabilityCache = false;
      return inputFileAssignmentCapabilityCache;
    }
  }

  function shouldUseFirefoxTextFallbackForFileHandoff() {
    return isFirefoxRuntime() && !canAssignFilesToInput();
  }

  function isExpectedFirefoxGeminiNoPickerMiss(details) {
    return Boolean(
      isFirefoxRuntime() &&
        isGeminiHost() &&
        details?.handoffStage === "gemini:no-file-input-without-picker" &&
        details?.failureReason === "no_file_input_without_opening_picker"
    );
  }

  function shouldQueueFirefoxGeminiPendingSanitizedFileHandoff(event, sanitizedFile, details) {
    if (!isFirefoxRuntime() || !isGeminiHost() || event?.type !== "drop" || !sanitizedFile) {
      return false;
    }
    return /^(?:ghost_ingress_timeout|file_input_bridge_input_not_found)$/.test(
      String(details?.failureReason || "")
    );
  }

  function getFirefoxRawFileUploadBlockedMessage(context) {
    if (context !== "file-input" || !isFirefoxRuntime()) return "";
    if (isGeminiHost()) {
      return "LeakGuard blocked raw file upload in Firefox. Use Gemini's upload button again so LeakGuard can sanitize and replace the selected file before upload.";
    }
    return "LeakGuard blocked raw file upload in Firefox. Use LeakGuard drag/drop with a supported text file.";
  }

  const FIREFOX_GEMINI_DROP_FILE_UNAVAILABLE_MESSAGE =
    "Firefox did not expose the dropped file to LeakGuard. Use Gemini's upload button so LeakGuard can sanitize and replace the selected file before upload.";

  function isPasteBeforeInput(event) {
    return String(event?.inputType || "") === "insertFromPaste";
  }

  function getPasteTransfer(event) {
    return event?.clipboardData || event?.dataTransfer || null;
  }

  function getPastedPlainText(event) {
    const transfer = getPasteTransfer(event);
    return transfer?.getData?.("text/plain") || transfer?.getData?.("text") || event?.data || "";
  }

  function dataTransferLooksLikeFiles(dataTransfer) {
    if (typeof fileDragGuard?.dataTransferLooksLikeFiles === "function") {
      return fileDragGuard.dataTransferLooksLikeFiles(dataTransfer);
    }

    if (!dataTransfer) return false;
    if (typeof dataTransferHasFiles === "function" && dataTransferHasFiles(dataTransfer)) return true;

    const types = Array.from(dataTransfer.types || []);
    if (types.includes("Files")) return true;
    if (Number(dataTransfer.files?.length || 0) > 0) return true;

    return Array.from(dataTransfer.items || []).some(
      (item) => String(item?.kind || "").toLowerCase() === "file"
    );
  }

  function listLocalTransferFiles(dataTransfer) {
    if (typeof FilePasteHelpers?.listDataTransferFiles === "function") {
      return FilePasteHelpers.listDataTransferFiles(dataTransfer);
    }

    return snapshotFilesFromDataTransfer(dataTransfer);
  }

  function snapshotFilesFromDataTransfer(dataTransfer) {
    const files = Array.from(dataTransfer?.files || []).filter(Boolean);
    if (files.length) return files;

    return Array.from(dataTransfer?.items || [])
      .filter(
        (item) =>
          String(item?.kind || "").toLowerCase() === "file" &&
          typeof item.getAsFile === "function"
      )
      .map((item) => item.getAsFile())
      .filter(Boolean);
  }

  function countDataTransferFileItems(dataTransfer) {
    return Array.from(dataTransfer?.items || []).filter(
      (item) => String(item?.kind || "").toLowerCase() === "file"
    ).length;
  }

  function describeDataTransferFileSnapshot(dataTransfer, files) {
    const filesLength = Number(dataTransfer?.files?.length || 0);
    const itemsFileCount = countDataTransferFileItems(dataTransfer);
    return {
      firefoxDataTransferFilesEmpty: isFirefoxRuntime() && filesLength === 0 && itemsFileCount > 0,
      itemsFileCount,
      itemsGetAsFileSucceeded: filesLength === 0 && itemsFileCount > 0 ? files.length > 0 : undefined,
      snapshottedFileCount: files.length
    };
  }

  function snapshotLocalFileDataTransfer(dataTransfer) {
    const files = snapshotFilesFromDataTransfer(dataTransfer);
    const fileItemCount = countDataTransferFileItems(dataTransfer);
    if (isFirefoxRuntime() && Number(dataTransfer?.files?.length || 0) === 0 && fileItemCount > 0) {
      debugReveal("file-drop:firefox-items-snapshot", describeDataTransferFileSnapshot(dataTransfer, files));
    }
    if (!files.length && !fileItemCount) return dataTransfer;

    const types = Array.from(dataTransfer?.types || []);
    if (!types.includes("Files")) types.push("Files");

    return {
      files,
      types,
      firefoxDataTransferFileUnavailable: !files.length && fileItemCount > 0,
      items: files.map((file) => ({
        kind: "file",
        type: file?.type || "",
        getAsFile: () => file
      })),
      dropEffect: dataTransfer?.dropEffect || "none",
      effectAllowed: dataTransfer?.effectAllowed || "all"
    };
  }

  function hashLocalString(value) {
    const input = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(36);
  }

  function getGeminiDropSessionHash(dataTransfer) {
    const files = listLocalTransferFiles(dataTransfer);
    if (!files.length) return "";
    return hashLocalString(
      files
        .map((file) =>
          [
            file?.name || "",
            file?.type || "",
            Number(file?.size || 0),
            Number(file?.lastModified || 0)
          ].join("\u0000")
        )
        .join("\u0001")
    );
  }

  function classifyLocalFile(file) {
    return globalThis.PWM.FileTransferPolicy.classifyLocalFile(file, {
      FileScanner: globalThis.PWM?.FileScanner || {},
      unsupportedWarning: LOCAL_FILE_UNSUPPORTED_WARNING
    });
  }

  function resolveLocalFileTransferPolicy(dataTransfer) {
    return globalThis.PWM.FileTransferPolicy.resolveLocalFileTransferPolicy(dataTransfer, {
      listLocalTransferFiles,
      classifyLocalFile,
      unsupportedWarning: LOCAL_FILE_UNSUPPORTED_WARNING
    });
  }

  function resolveFileDragGuardPolicy(dataTransfer) {
    const policy = resolveLocalFileTransferPolicy(dataTransfer);
    if (isGeminiHost() && dataTransferLooksLikeFiles(dataTransfer)) {
      return {
        action: "block",
        reason: policy.reason || policy.action
      };
    }
    return {
      action: policy.action === "allow" ? "allow" : "block",
      reason: policy.reason || policy.action
    };
  }

  function showUnsupportedFilePassThroughNotice(policy) {
    if (!policy?.message) return;
    setBadge("Unsupported file not scanned or redacted; normal upload may continue");
    hideBadgeSoon(5200);
  }

  function shouldBlockUnsupportedFileTransfer(policy) {
    return globalThis.PWM.FileTransferPolicy.shouldBlockUnsupportedFileTransfer(policy, {
      isFirefoxRuntime,
      dataTransferLooksLikeFiles,
      isProtectedFileDropDriver,
      getCurrentHandoffDriverId
    });
  }

  function getUnsupportedFileBlockedMessage(policy) {
    return globalThis.PWM.FileTransferPolicy.getUnsupportedFileBlockedMessage(policy);
  }

  function clearDmzOverlayTimer() {
    if (dmzOverlayTimer) {
      clearTimeout(dmzOverlayTimer);
      dmzOverlayTimer = 0;
    }
  }

  function hideDmzOverlay() {
    clearDmzOverlayTimer();
    if (dmzOverlayEl?.parentNode) {
      try {
        dmzOverlayEl.parentNode.removeChild(dmzOverlayEl);
      } catch {
        // Best-effort cleanup only.
      }
    }
    dmzOverlayEl = null;
    dmzOverlayStatusEl = null;
  }

  function clearGeminiDmzOverlayTimer() {
    clearDmzOverlayTimer();
  }

  function hideGeminiDmzOverlay() {
    hideDmzOverlay();
  }

  function setDmzOverlayState(message, state = "") {
    if (!getCurrentHandoffDriver()?.usesDmzOverlay) return;
    if (!dmzOverlayEl) {
      showDmzOverlay();
    }
    if (dmzOverlayStatusEl) {
      dmzOverlayStatusEl.textContent = message;
    }
    if (dmzOverlayEl) {
      dmzOverlayEl.dataset.pwmState = state;
    }
  }

  function setGeminiDmzOverlayState(message, state = "") {
    setDmzOverlayState(message, state);
  }

  function scheduleDmzOverlayCleanup(delayMs = 1200) {
    clearDmzOverlayTimer();
    dmzOverlayTimer = setTimeout(() => {
      hideDmzOverlay();
    }, delayMs);
  }

  function scheduleGeminiDmzOverlayCleanup(delayMs = 1200) {
    scheduleDmzOverlayCleanup(delayMs);
  }

  function showDmzOverlay() {
    if (!getCurrentHandoffDriver()?.usesDmzOverlay || dmzOverlayEl?.isConnected) {
      return dmzOverlayEl;
    }
    if (typeof document?.createElement !== "function" || !document.documentElement?.appendChild) {
      return null;
    }

    const overlay = document.createElement("div");
    overlay.className = "pwm-dmz pwm-gemini-dmz";
    overlay.setAttribute("role", "presentation");

    const box = document.createElement("div");
    box.className = "pwm-dmz-box pwm-gemini-dmz-box";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");

    const eyebrow = document.createElement("p");
    eyebrow.className = "pwm-dmz-eyebrow pwm-gemini-dmz-eyebrow";
    eyebrow.textContent = "LeakGuard Transparent DMZ";

    const status = document.createElement("p");
    status.className = "pwm-dmz-status pwm-gemini-dmz-status";
    status.textContent = "Drop file to sanitize with LeakGuard";

    box.append(eyebrow, status);
    overlay.appendChild(box);
    document.documentElement.appendChild(overlay);

    dmzOverlayEl = overlay;
    dmzOverlayStatusEl = status;
    ensureDmzOverlayFallbackStyle();
    scheduleDmzOverlayCleanup(FILE_DRAG_SESSION_RESET_MS);
    return overlay;
  }

  function ensureDmzOverlayFallbackStyle() {
    if (!dmzOverlayEl || dmzFallbackStyleEl?.isConnected) return;

    let needsFallback = false;
    try {
      const style = window.getComputedStyle?.(dmzOverlayEl);
      needsFallback =
        !style ||
        style.position !== "fixed" ||
        style.display === "none" ||
        Number.parseInt(style.zIndex || "0", 10) < 2147483000;
    } catch {
      needsFallback = true;
    }

    if (!needsFallback || typeof document?.createElement !== "function") return;

    const styleEl = document.createElement("style");
    styleEl.className = "pwm-dmz-fallback-style";
    styleEl.textContent =
      ".pwm-dmz,.pwm-gemini-dmz{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.42);color:#f8fafc;font:14px/1.4 system-ui,sans-serif;pointer-events:auto}.pwm-dmz-box,.pwm-gemini-dmz-box{width:min(520px,calc(100vw - 48px));min-height:180px;border:2px dashed rgba(34,211,238,.74);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:28px;background:rgba(15,23,42,.9);box-shadow:0 24px 70px rgba(2,6,23,.38);text-align:center}.pwm-dmz-eyebrow,.pwm-gemini-dmz-eyebrow{margin:0;color:#67e8f9;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.pwm-dmz-status,.pwm-gemini-dmz-status{margin:0;color:#f8fafc;font-size:20px;font-weight:700}.pwm-dmz[data-pwm-state='failed'] .pwm-dmz-box,.pwm-gemini-dmz[data-pwm-state='failed'] .pwm-gemini-dmz-box{border-color:rgba(251,113,133,.9)}";
    try {
      (document.head || document.documentElement).appendChild(styleEl);
      dmzFallbackStyleEl = styleEl;
    } catch {
      // CSS fallback is best-effort; interception still fails closed.
    }
  }

  function showGeminiDmzOverlay() {
    return showDmzOverlay();
  }

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

  function showFileProcessingOverlay(options = {}) {
    const site = getFileProcessingSiteId(options.site);
    const title = String(options.title || "LeakGuard is processing this file locally.");
    const status = String(options.status || "Processing file locally...");
    const progressText = formatFileProcessingProgress(options.progress) || "In progress";
    const blocking = options.blocking !== false;

    if (fileProcessingHideTimer) {
      clearTimeout(fileProcessingHideTimer);
      fileProcessingHideTimer = 0;
    }

    if (typeof document?.createElement !== "function" || !document.documentElement?.appendChild) {
      debugFileAttachMetadata(CONTENT_DEBUG_EVENTS.FILE_UI_PROCESSING_SHOWN, {
        site,
        rendered: false,
        blocking,
        status,
        progress: describeFileProcessingProgress(options.progress)
      });
      return null;
    }

    if (!fileProcessingOverlayEl?.isConnected) {
      const overlay = document.createElement("div");
      overlay.className = "pwm-file-processing-overlay";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");

      const card = document.createElement("div");
      card.className = "pwm-file-processing-card";

      const titleEl = document.createElement("p");
      titleEl.className = "pwm-file-processing-title";

      const statusEl = document.createElement("p");
      statusEl.className = "pwm-file-processing-status";

      const progressEl = document.createElement("p");
      progressEl.className = "pwm-file-processing-progress";

      card.append(titleEl, statusEl, progressEl);
      overlay.appendChild(card);
      document.documentElement.appendChild(overlay);

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

    debugFileAttachMetadata(CONTENT_DEBUG_EVENTS.FILE_UI_PROCESSING_SHOWN, {
      site,
      rendered: true,
      blocking,
      status,
      progress: describeFileProcessingProgress(options.progress)
    });
    return fileProcessingOverlayEl;
  }

  function updateFileProcessingOverlay(options = {}) {
    const site = getFileProcessingSiteId(options.site || fileProcessingOverlayEl?.dataset?.pwmSite);
    if (!fileProcessingOverlayEl?.isConnected) {
      return showFileProcessingOverlay({
        site,
        title: options.title || "LeakGuard is processing this file locally.",
        status: options.status || "Processing file locally...",
        progress: options.progress,
        blocking: options.blocking
      });
    }

    const status = options.status === undefined ? fileProcessingStatusEl?.textContent || "" : String(options.status);
    const progressText = formatFileProcessingProgress(options.progress);
    if (options.status !== undefined && fileProcessingStatusEl) {
      fileProcessingStatusEl.textContent = status;
    }
    if (fileProcessingProgressEl) {
      fileProcessingProgressEl.textContent = progressText || fileProcessingProgressEl.textContent || "In progress";
    }
    if (options.blocking !== undefined) {
      fileProcessingOverlayEl.dataset.pwmBlocking = options.blocking === false ? "false" : "true";
    }

    debugReveal("file-ui:processing-updated", {
      site,
      status,
      progress: describeFileProcessingProgress(options.progress)
    });
    return fileProcessingOverlayEl;
  }

  function hideFileProcessingOverlay(reason = "") {
    if (fileProcessingHideTimer) {
      clearTimeout(fileProcessingHideTimer);
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

  function showFileProcessingSuccess(status = "Sanitized file attached.", options = {}) {
    const site = getFileProcessingSiteId(options.site);
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
    fileProcessingHideTimer = setTimeout(() => {
      hideFileProcessingOverlay(options.reason || "success");
    }, Math.max(0, Number(options.hideAfterMs ?? 1200)));
  }

  function showFileProcessingError(status = "Raw file upload blocked", options = {}) {
    const site = getFileProcessingSiteId(options.site);
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
      reason: options.reason || ""
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
      return GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE;
    }
    if (id === "grok") {
      return GROK_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE;
    }
    return "File sanitized. Click Upload/Attach to attach the sanitized version.";
  }

  function showPendingSanitizedAttachPrompt(adapter, pending = null) {
    let selectedAdapter = null;
    let options = null;
    if (pending) {
      selectedAdapter =
        typeof adapter === "string"
          ? getFileHandoffAdapterById(adapter)
          : adapter || getFileHandoffAdapterForLocation();
      options = {
        site: selectedAdapter?.id || pending.site || getCurrentHandoffDriverId(),
        sanitizedFile: pending.sanitizedFile || null,
        message: pending.message || getPendingSanitizedAttachPromptMessage(selectedAdapter?.id || pending.site),
        onAttachClick: () => attachPendingSanitizedFileWithTrustedActivation(selectedAdapter, pending),
        onInsertTextClick: () =>
          insertPendingSanitizedFileText(
            selectedAdapter?.id || pending.site || getCurrentHandoffDriverId(),
            pending.event,
            pending.input,
            pending.sanitizedFile
          ),
        onDownloadClick: () =>
          downloadPendingSanitizedFile(
            selectedAdapter?.id || pending.site || getCurrentHandoffDriverId(),
            pending.event,
            pending.input,
            pending.sanitizedFile
          ),
        onCancelClick: () =>
          cancelPendingSanitizedFileAttach(selectedAdapter?.id || pending.site || getCurrentHandoffDriverId())
      };
    } else {
      options = adapter || {};
      selectedAdapter = options.adapter || getFileHandoffAdapterById(options.site) || getFileHandoffAdapterForLocation();
    }
    const site = options.site || getCurrentHandoffDriverId();
    const sanitizedFile = options.sanitizedFile || null;
    const message = options.message || getPendingSanitizedAttachPromptMessage(site);

    clearPendingSanitizedAttachPrompt("replaced");
    pendingAttachPromptSite = site;

    const runAction = async (label, callback) => {
      debugReveal(`pending-attach-prompt-${label}`, {
        site,
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      if (label === "attach-clicked") {
        debugFileAttachMetadata("file-handoff:pending-user-attach-clicked", {
          site,
          adapter: describeFileHandoffAdapter(selectedAdapter),
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
      }
      if (typeof callback !== "function") return;
      try {
        await callback();
      } catch (error) {
        handleContentError(error);
      }
    };

    if (typeof document?.createElement !== "function" || !document.documentElement?.appendChild) {
      debugReveal(CONTENT_DEBUG_EVENTS.PENDING_ATTACH_PROMPT_SHOWN, {
        site,
        rendered: false,
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      debugFileAttachMetadata(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_PENDING_PROMPT_SHOWN, {
        site,
        rendered: false,
        adapter: describeFileHandoffAdapter(selectedAdapter),
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      debugFileAttachMetadata(CONTENT_DEBUG_EVENTS.FILE_UI_PENDING_PROMPT_SHOWN, {
        site,
        rendered: false,
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      return null;
    }

    const prompt = document.createElement("div");
    prompt.className = "pwm-pending-attach-prompt";
    prompt.dataset.pwmSite = site;
    prompt.setAttribute("role", "status");
    prompt.setAttribute("aria-live", "polite");

    const card = document.createElement("div");
    card.className = "pwm-pending-attach-card";

    const title = document.createElement("p");
    title.className = "pwm-pending-attach-title";
    title.textContent = "LeakGuard sanitized the file";

    const body = document.createElement("p");
    body.className = "pwm-pending-attach-message";
    body.textContent = message;

    const actions = document.createElement("div");
    actions.className = "pwm-pending-attach-actions";

    const makeButton = (className, text, label, callback) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = text;
      button.addEventListener("click", (clickEvent) => {
        try {
          clickEvent.preventDefault?.();
          clickEvent.stopPropagation?.();
        } catch {
          // Host events can be partial.
        }
        runAction(label, callback);
      });
      return button;
    };

    actions.append(
      makeButton(
        "pwm-pending-attach-btn pwm-pending-attach-primary",
        "Attach sanitized file",
        "attach-clicked",
        options.onAttachClick
      ),
      makeButton(
        "pwm-pending-attach-btn",
        "Insert sanitized text instead",
        "insert-text-clicked",
        options.onInsertTextClick
      ),
      makeButton(
        "pwm-pending-attach-btn",
        "Download sanitized copy",
        "download-clicked",
        options.onDownloadClick
      ),
      makeButton(
        "pwm-pending-attach-btn pwm-pending-attach-secondary",
        "Cancel",
        "cancelled",
        options.onCancelClick
      )
    );

    card.append(title, body, actions);
    prompt.appendChild(card);
    document.documentElement.appendChild(prompt);
    pendingAttachPromptEl = prompt;

    debugReveal(CONTENT_DEBUG_EVENTS.PENDING_ATTACH_PROMPT_SHOWN, {
      site,
      rendered: true,
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    debugFileAttachMetadata(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_PENDING_PROMPT_SHOWN, {
      site,
      rendered: true,
      adapter: describeFileHandoffAdapter(selectedAdapter),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    debugFileAttachMetadata(CONTENT_DEBUG_EVENTS.FILE_UI_PENDING_PROMPT_SHOWN, {
      site,
      rendered: true,
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    return prompt;
  }

  function getLocalTextPayloadByteLength(text, fallbackBytes = 0) {
    return globalThis.PWM.FileTransferPolicy.getLocalTextPayloadByteLength(text, fallbackBytes);
  }

  function classifyLocalTextPayloadSize(payload) {
    return globalThis.PWM.FileTransferPolicy.classifyLocalTextPayloadSize(payload, {
      constants: {
        LOCAL_TEXT_FAST_MAX_BYTES,
        LOCAL_TEXT_OPTIMIZED_MAX_BYTES,
        LOCAL_TEXT_HARD_BLOCK_BYTES
      }
    });
  }

  function showLocalPayloadOptimizationStatus(sizeInfo) {
    debugFileAttachMetadata("local-payload:optimization-started", {
      bytes: sizeInfo?.bytes || 0,
      fastMaxBytes: LOCAL_TEXT_FAST_MAX_BYTES,
      optimizedMaxBytes: LOCAL_TEXT_OPTIMIZED_MAX_BYTES
    });
    setBadge("Optimizing redaction... LeakGuard is processing a larger payload locally.");
  }

  function clearLocalPayloadOptimizationStatus(sizeInfo, outcome = "complete") {
    debugFileAttachMetadata("local-payload:optimization-finished", {
      outcome,
      bytes: sizeInfo?.bytes || 0
    });
    if (outcome === "complete") {
      setBadge("Redaction complete. Sanitized content is ready.");
      hideBadgeSoon(3200);
    } else {
      hideBadgeSoon(1600);
    }
  }

  function blockLargeLocalTextPayload(event, sizeInfo) {
    consumeInterceptionEvent(event);
    debugFileAttachMetadata("local-payload:blocked", {
      bytes: sizeInfo?.bytes || 0,
      hardBlockBytes: LOCAL_TEXT_HARD_BLOCK_BYTES
    });
    setBadge(LOCAL_TEXT_HARD_BLOCK_TITLE);
    hideBadgeSoon(4200);
    return showMessageModal(LOCAL_TEXT_HARD_BLOCK_TITLE, LOCAL_TEXT_HARD_BLOCK_MESSAGE).then(() => {
      refreshBadgeFromCurrentInput();
      return {
        handled: true,
        ok: false,
        reason: "local_text_payload_too_large"
      };
    });
  }

  function showStreamingRedactionStatus(fileInfo) {
    debugFileAttachMetadata("streaming-redaction:started", {
      file: describeFileForDebug(fileInfo),
      maxBytes: LARGE_TEXT_STREAMING_MAX_BYTES
    });
    updateFileProcessingOverlay({
      status: "Stream-redacting large file locally...",
      progress: "",
      blocking: true
    });
    setBadge("Streaming redaction... LeakGuard is sanitizing a large file locally before upload.");
  }

  function updateStreamingRedactionProgress(progress) {
    const processed = Number(progress?.bytesProcessed || 0);
    const total = Number(progress?.totalBytes || 0);
    debugFileAttachMetadata("streaming-redaction:progress", {
      bytesProcessed: processed,
      totalBytes: total
    });
    const progressText = formatFileProcessingProgress(progress);
    updateFileProcessingOverlay({
      status: progressText
        ? `Stream-redacting locally... ${progressText}`
        : "Stream-redacting locally...",
      progress,
      blocking: true
    });
  }

  function clearStreamingRedactionStatus(result) {
    debugFileAttachMetadata("streaming-redaction:finished", {
      action: result?.action || "unknown",
      bytesProcessed: result?.bytesProcessed || 0,
      findingsCount: result?.findingsCount || 0
    });
    if (result?.action === "redacted") {
      setBadge("Redaction complete. Sanitized content is ready.");
      hideBadgeSoon(3200);
    } else {
      hideBadgeSoon(1600);
    }
  }

  function createStreamingSanitizedFile(fileInfo) {
    return ({ name, type, parts }) => {
      const metadata = {
        name: name || fileInfo?.name || "leakguard-redacted.txt",
        type: type || fileInfo?.type || "text/plain"
      };

      if (typeof File === "function") {
        return new File(parts, metadata.name, {
          type: metadata.type,
          lastModified: Date.now()
        });
      }

      if (typeof Blob === "function") {
        const blob = new Blob(parts, { type: metadata.type });
        try {
          Object.defineProperty(blob, "name", {
            value: metadata.name,
            configurable: true
          });
          Object.defineProperty(blob, "lastModified", {
            value: Date.now(),
            configurable: true
          });
        } catch {
          // The sanitized bytes remain available even if Blob metadata is read-only.
        }
        return blob;
      }

      return null;
    };
  }

  async function streamRedactLocalTextFile(sourceFile, fileInfo) {
    if (typeof StreamingFileRedactor.redactTextFileStream !== "function") {
      return {
        action: "failed",
        error: "LeakGuard streaming redaction is unavailable."
      };
    }

    showStreamingRedactionStatus(fileInfo || sourceFile);
    const result = await StreamingFileRedactor.redactTextFileStream(sourceFile, {
      createFile: createStreamingSanitizedFile(fileInfo || sourceFile),
      onProgress: updateStreamingRedactionProgress,
      redactText: async (text) => {
        const analysis = analyzeText(text);
        return requestRedaction(analysis.normalizedText, analysis.secretFindings, {
          auditReason: "streaming_file_redaction",
          skipBackgroundScan: true
        });
      }
    });
    clearStreamingRedactionStatus(result);
    return result;
  }

  async function blockStreamingLocalFile(event, title, message) {
    consumeInterceptionEvent(event);
    setBadge(title);
    hideBadgeSoon(4200);
    await showMessageModal(title, message);
    refreshBadgeFromCurrentInput();
    return {
      handled: true,
      ok: false,
      reason: "streaming_file_blocked"
    };
  }

  function buildComposerWritePlan(input, text) {
    const canonical = normalizeComposerText(normalizeVisiblePlaceholders(text));
    return {
      canonical,
      writeText: canonical,
      acceptableTexts: [canonical]
    };
  }

  function normalizeVerificationText(text) {
    return globalThis.PWM.RewriteVerificationText.normalizeVerificationText(text);
  }

  function normalizeLooseVerificationText(text) {
    return globalThis.PWM.RewriteVerificationText.normalizeLooseVerificationText(text);
  }

  function listExpectedPlaceholders(text) {
    return globalThis.PWM.RewriteVerificationText.listExpectedPlaceholders(text);
  }

  function listPlaceholderTokens(text) {
    return globalThis.PWM.RewriteVerificationText.listPlaceholderTokens(text);
  }

  function samePlaceholderTokenSet(expectedText, actualText) {
    return globalThis.PWM.RewriteVerificationText.samePlaceholderTokenSet(expectedText, actualText);
  }

  function actualContainsExpectedPlaceholders(expectedText, actualText) {
    return globalThis.PWM.RewriteVerificationText.actualContainsExpectedPlaceholders(expectedText, actualText);
  }

  function countVerificationLineBreaks(text) {
    return globalThis.PWM.RewriteVerificationText.countVerificationLineBreaks(text);
  }

  function countVerificationLines(text) {
    return globalThis.PWM.RewriteVerificationText.countVerificationLines(text);
  }

  function lineCollapseTokens(text) {
    return globalThis.PWM.RewriteVerificationText.lineCollapseTokens(text);
  }

  function detectMultilineCollapse(expected, actual) {
    return globalThis.PWM.RewriteVerificationText.detectMultilineCollapse(expected, actual);
  }

  function isReasonablyCloseRewriteLength(expectedText, actualText) {
    return globalThis.PWM.RewriteVerificationText.isReasonablyCloseRewriteLength(expectedText, actualText);
  }

  function collectComposerVerificationCandidates(input, initialActualText) {
    const candidates = [];
    const seen = new Set();
    const addCandidate = (source, value) => {
      if (typeof value !== "string") return;
      const normalized = normalizeComposerText(value);
      const key = `${source}:${normalized}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ source, text: normalized });
    };

    if (typeof initialActualText === "string") {
      addCandidate("stable", initialActualText);
    }
    addCandidate("getInputText", getInputText(input));
    addCandidate("innerText", input?.innerText || "");
    addCandidate("textContent", input?.textContent || "");
    addCandidate("normalizedInnerText", normalizeEditorInnerText(input?.innerText || ""));

    const baseCandidates = [...candidates];
    for (const candidate of baseCandidates) {
      addCandidate(`${candidate.source}:normalized`, normalizeComposerText(candidate.text));
    }

    return candidates;
  }

  function isHighConfidenceRewriteFinding(finding) {
    return globalThis.PWM.RewriteVerificationText.isHighConfidenceRewriteFinding(finding);
  }

  function collectOriginalRawSecretValues(originalText, findings) {
    return globalThis.PWM.RewriteVerificationText.collectOriginalRawSecretValues(originalText, findings, {
      analyzeText
    });
  }

  function candidateHasHighConfidenceSecret(candidateText, rawSecretValues) {
    return globalThis.PWM.RewriteVerificationText.candidateHasHighConfidenceSecret(candidateText, rawSecretValues, {
      analyzeText
    });
  }

  function summarizeVerificationCandidate(source, text, expectedText) {
    return globalThis.PWM.RewriteVerificationText.summarizeVerificationCandidate(source, text, expectedText);
  }

  function debugRewriteVerification(label, payload) {
    globalThis.PWM?.DebugLogger?.debugEvent?.(label, payload || {}, { root: window });
  }

  function evaluateComposerVerificationCandidates({ candidates, expectedText, originalText, findings, context }) {
    return globalThis.PWM.RewriteVerificationText.evaluateComposerVerificationCandidates(
      { candidates, expectedText, originalText, findings, context },
      {
        analyzeText,
        debug: debugRewriteVerification
      }
    );
  }

  async function verifyComposerRewriteSafe({
    input,
    expectedText,
    originalText,
    redactedText,
    findings,
    context,
    caretOffset,
    allowMultilineRetry = true,
    actualText
  }) {
    const expected = normalizeComposerText(redactedText || expectedText);
    const initialActual =
      typeof actualText === "string" ? normalizeComposerText(actualText) : await readStableComposerText(input, 2);
    const firstResult = evaluateComposerVerificationCandidates({
      candidates: collectComposerVerificationCandidates(input, initialActual),
      expectedText: expected,
      originalText,
      findings,
      context
    });
    if (firstResult.ok || !firstResult.collapseDetected || !allowMultilineRetry || !isContentEditable(input)) {
      return firstResult;
    }

    debugRewriteVerification("rewrite:multiline-preserving-retry-start", {
      context,
      expectedLength: expected.length,
      expectedLineCount: countVerificationLines(expected),
      expectedPlaceholderCount: listPlaceholderTokens(expected).length
    });

    suppressFollowupInputScan();
    const retryWritten = writePlainTextToContentEditablePreservingNewlines(input, expected, {
      caretOffset
    });
    const retryActual = await readStableComposerText(input, 2);
    const retryResult = retryWritten
      ? evaluateComposerVerificationCandidates({
          candidates: collectComposerVerificationCandidates(input, retryActual),
          expectedText: expected,
          originalText,
          findings,
          context
        })
      : {
          ok: false,
          actual: retryActual,
          reason: "multiline-retry-write-failed"
        };

    debugRewriteVerification(
      retryResult.ok
        ? "rewrite:multiline-preserving-retry-success"
        : "rewrite:multiline-preserving-retry-failed",
      {
        context,
        retryWritten,
        actualLength: normalizeComposerText(retryActual).length,
        actualLineCount: countVerificationLines(retryActual),
        expectedLineCount: countVerificationLines(expected),
        expectedPlaceholderCount: listPlaceholderTokens(expected).length
      }
    );

    return retryResult.ok ? { ...retryResult, strategy: `multiline-retry-${retryResult.strategy}` } : retryResult;
  }

  function matchesComposerPlan(plan, actualText) {
    const acceptableTexts = Array.isArray(plan.acceptableTexts) ? plan.acceptableTexts : [plan.canonical];
    if (acceptableTexts.includes(actualText)) {
      return true;
    }

    const normalizedActual = normalizeVerificationText(actualText);
    if (
      acceptableTexts.some(
        (candidate) =>
          normalizeVerificationText(candidate) === normalizedActual &&
          actualContainsExpectedPlaceholders(candidate, actualText)
      )
    ) {
      return true;
    }

    const looseActual = normalizeLooseVerificationText(actualText);
    return acceptableTexts.some(
      (candidate) =>
        normalizeLooseVerificationText(candidate) === looseActual &&
        actualContainsExpectedPlaceholders(candidate, actualText)
    );
  }

  function ensureBadge() {
    if (badgeEl) return badgeEl;

    badgeEl = document.createElement("div");
    badgeEl.className = "pwm-badge";
    badgeEl.setAttribute("aria-live", "polite");
    document.documentElement.appendChild(badgeEl);

    return badgeEl;
  }

  async function openProtectedSitesUi() {
    const response = await sendRuntimeMessage({
      type: "PWM_OPEN_POPUP_SITE_MANAGER"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not open protected site controls.");
    }

    return response;
  }

  function openOptionsPage() {
    return sendRuntimeMessage({
      type: "PWM_OPEN_OPTIONS_PAGE"
    });
  }

  function setStatusPanelCollapsed(collapsed) {
    const panel = ensureStatusPanel();
    const toggle = panel.querySelector(".pwm-panel-toggle");
    const body = panel.querySelector(".pwm-panel-body");

    statusPanelCollapsed = Boolean(collapsed);
    panel.classList.toggle("is-collapsed", statusPanelCollapsed);
    body.hidden = statusPanelCollapsed;
    toggle.setAttribute("aria-expanded", String(!statusPanelCollapsed));
    toggle.textContent = statusPanelCollapsed ? "Expand" : "Collapse";
  }

  function ensureStatusPanel() {
    if (statusPanelEl?.isConnected) {
      return statusPanelEl;
    }

    statusPanelEl = document.createElement("aside");
    statusPanelEl.className = "pwm-panel";
    statusPanelEl.setAttribute("aria-live", "polite");

    const header = document.createElement("div");
    header.className = "pwm-panel-header";

    const brandWrap = document.createElement("div");
    brandWrap.className = "pwm-panel-brand";

    const eyebrow = document.createElement("p");
    eyebrow.className = "pwm-panel-eyebrow";
    eyebrow.textContent = "Local-only protection";

    const title = document.createElement("h2");
    title.className = "pwm-panel-title";
    title.textContent = "LeakGuard";

    const toggle = document.createElement("button");
    toggle.className = "pwm-panel-toggle";
    toggle.type = "button";
    toggle.addEventListener("click", () => {
      setStatusPanelCollapsed(!statusPanelCollapsed);
    });

    brandWrap.append(eyebrow, title);
    header.append(brandWrap, toggle);

    const body = document.createElement("div");
    body.className = "pwm-panel-body";

    const makeRow = (labelText) => {
      const row = document.createElement("div");
      row.className = "pwm-panel-row";

      const label = document.createElement("span");
      label.className = "pwm-panel-label";
      label.textContent = labelText;

      const value = document.createElement("strong");
      value.className = "pwm-panel-value";

      row.append(label, value);
      body.appendChild(row);
      return value;
    };

    statusPanelProtectionValueEl = makeRow("Protection");
    statusPanelSiteValueEl = makeRow("Site");
    statusPanelComposerValueEl = makeRow("Composer");
    statusPanelSessionValueEl = makeRow("Session");

    const actions = document.createElement("div");
    actions.className = "pwm-panel-actions";

    const manageBtn = document.createElement("button");
    manageBtn.className = "pwm-btn pwm-panel-manage";
    manageBtn.type = "button";
    manageBtn.textContent = "Manage Sites";
    manageBtn.addEventListener("click", () => {
      openProtectedSitesUi()
        .then((response) => {
          if (!response?.opened) {
            setBadge("Open LeakGuard from the toolbar to manage sites");
            hideBadgeSoon(2800);
          }
        })
        .catch(() => {
          openOptionsPage().catch(() => {
            setBadge("LeakGuard settings unavailable");
            hideBadgeSoon(2200);
          });
      });
    });

    statusPanelPauseBtn = document.createElement("button");
    statusPanelPauseBtn.className = "pwm-btn pwm-panel-pause";
    statusPanelPauseBtn.type = "button";
    statusPanelPauseBtn.addEventListener("click", () => {
      const protection = getActiveProtection();
      setProtectionPaused(!protection.paused).catch((error) => {
        setBadge(error?.message || "Protection pause unavailable");
        hideBadgeSoon(2800);
      });
    });

    actions.append(statusPanelPauseBtn, manageBtn);
    body.appendChild(actions);

    statusPanelEl.append(header, body);
    document.documentElement.appendChild(statusPanelEl);
    setStatusPanelCollapsed(statusPanelCollapsed);

    return statusPanelEl;
  }

  function getActiveProtection() {
    return {
      paused: false,
      pausedUntil: 0,
      allowProtectionPause: false,
      protectionEnforced: false,
      ...(currentPublicState.protection || {})
    };
  }

  function updateStatusPanel(snapshot = {}) {
    ensureStatusPanel();

    const protection = getActiveProtection();
    if (protection.protectionEnforced) {
      statusPanelProtectionValueEl.textContent = "Enforced by policy";
    } else if (protection.paused) {
      statusPanelProtectionValueEl.textContent = "Paused";
    } else {
      statusPanelProtectionValueEl.textContent = "Active";
    }

    if (statusPanelPauseBtn) {
      statusPanelPauseBtn.hidden = !protection.allowProtectionPause;
      statusPanelPauseBtn.textContent = protection.paused ? "Resume Protection" : "Pause Protection";
    }

    statusPanelSiteValueEl.textContent = location.host || "Protected site";

    if (!snapshot.hasComposer) {
      statusPanelComposerValueEl.textContent = "Waiting for composer";
    } else if (snapshot.detectedCount > 0) {
      statusPanelComposerValueEl.textContent = `${snapshot.detectedCount} sensitive item${
        snapshot.detectedCount === 1 ? "" : "s"
      } detected`;
    } else if (snapshot.placeholderNormalized) {
      statusPanelComposerValueEl.textContent = "Canonical placeholders ready";
    } else {
      statusPanelComposerValueEl.textContent = "No sensitive items detected";
    }

    const placeholderCount = Number(currentPublicState.placeholderCount || 0);
    statusPanelSessionValueEl.textContent = `${placeholderCount} placeholder${
      placeholderCount === 1 ? "" : "s"
    } active`;
  }

  function setBadge(text) {
    const el = ensureBadge();

    if (!text) {
      el.textContent = "";
      el.classList.remove("is-visible");
      lastBadgeText = "";
      return;
    }

    if (text !== lastBadgeText) {
      el.textContent = text;
      lastBadgeText = text;
    }

    el.classList.add("is-visible");
  }

  function hideBadgeSoon(delay = 1800) {
    window.clearTimeout(badgeHideTimer);
    badgeHideTimer = window.setTimeout(() => {
      if (badgeEl) {
        badgeEl.classList.remove("is-visible");
      }
    }, delay);
  }

  function applyPublicState(state) {
    if (!state || typeof state !== "object") {
      return;
    }

    currentPublicState = {
      ...currentPublicState,
      ...state,
      policy: {
        ...(currentPublicState.policy || {}),
        ...(state.policy || {})
      },
      protection: {
        ...(currentPublicState.protection || {}),
        ...(state.protection || {})
      }
    };
  }

  function getActivePolicy() {
    return {
      enterpriseMode: false,
      allowReveal: true,
      allowUserOverride: true,
      allowProtectionPause: true,
      protectionPauseMaxMinutes: 15,
      protectionPauseRequiresUserAction: true,
      allowUserAddedSites: true,
      allowSiteRemoval: true,
      blockHttpSecrets: false,
      redactHttpAggressively: true,
      aiAssistEnabled: true,
      defaultAction: "redact",
      defaultDestinationAction: "allow",
      auditMode: "off",
      strictPolicyLoad: false,
      destinationPoliciesConfigured: false,
      destinationAction: "allow",
      destinationRequiresRedaction: false,
      destinationPolicies: [],
      matchedDestinationPolicy: null,
      destinationApprovalConfigured: false,
      destinationApproved: true,
      destinationBlocked: false,
      managedAvailable: false,
      managedApplied: false,
      strictFailure: false,
      http: location.protocol === "http:",
      ...(currentPublicState.policy || {})
    };
  }

  function sanitizeAuditFindings(findings) {
    return (findings || []).map((finding) => ({
      type: finding?.type || finding?.placeholderType || "SECRET"
    }));
  }

  async function recordMetadataAuditEvent(action, reason, findings) {
    try {
      await sendRuntimeMessage({
        type: "PWM_RECORD_AUDIT_EVENT",
        action,
        reason,
        url: location.href,
        findings: sanitizeAuditFindings(findings)
      });
    } catch {
      // Audit logging should never break the content flow.
    }
  }

  async function refreshPublicState() {
    const response = await sendRuntimeMessage({
      type: "PWM_GET_PUBLIC_STATE",
      url: location.href
    });

    if (!response?.ok) {
      const error = new Error(response?.error || "LeakGuard could not refresh policy state.");
      error.reason = response?.reason || null;
      throw error;
    }

    if (response.state) {
      applyPublicState(response.state);
    }

    return getActivePolicy();
  }

  async function setProtectionPaused(paused) {
    const policy = await refreshPublicState();
    const durationMinutes = Number(policy.protectionPauseMaxMinutes || 15);
    const response = await sendRuntimeMessage({
      type: "PWM_SET_PROTECTION_PAUSED",
      url: location.href,
      paused: Boolean(paused),
      durationMinutes
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not update protection pause.");
    }

    if (response.state) {
      applyPublicState(response.state);
    }

    updateStatusPanel();
    setBadge(paused ? "Protection paused" : "Protection resumed");
    hideBadgeSoon(2600);
    return getActiveProtection();
  }

  async function getPolicyForAction() {
    try {
      return await refreshPublicState();
    } catch {
      const fallbackPolicy = getActivePolicy();
      if (fallbackPolicy.enterpriseMode && fallbackPolicy.strictPolicyLoad) {
        return {
          ...fallbackPolicy,
          strictFailure: true
        };
      }

      return fallbackPolicy;
    }
  }

  function resolveDecisionAction(action, policy) {
    return action === "redact" ? "redact" : "cancel";
  }

  function getDestinationPolicyDecision(policy) {
    return evaluateDestinationPolicy(policy, location.href);
  }

  function isProtectionPauseActiveAfterPolicy(policy, destinationPolicy = null) {
    const protection = getActiveProtection();
    if (!protection.paused || !protection.allowProtectionPause) return false;
    if (protection.protectionEnforced) return false;
    if (policy?.strictFailure) return false;
    if (destinationPolicy?.blocked || destinationPolicy?.requiresRedaction) return false;
    if (policy?.enterpriseMode && policy?.http && policy?.blockHttpSecrets) return false;

    return true;
  }

  function shouldForceDestinationRedaction(decision, findings) {
    return Boolean(decision?.requiresRedaction && (findings || []).length > 0);
  }

  function getEditorRiskState(input) {
    if (!input || typeof input !== "object") return null;

    let state = editorRiskState.get(input);
    if (!state) {
      state = {
        pendingDecisionFingerprint: "",
        pendingDecisionPromise: null
      };
      editorRiskState.set(input, state);
    }

    return state;
  }

  function clearEditorRiskState(input) {
    const state = getEditorRiskState(input);
    if (!state) return;

    state.pendingDecisionFingerprint = "";
    state.pendingDecisionPromise = null;
  }

  function noteActiveRiskEditor(input) {
    if (!input || activeRiskEditor === input) return;

    if (activeRiskEditor) {
      clearEditorRiskState(activeRiskEditor);
    }

    activeRiskEditor = input;
    clearEditorRiskState(input);
  }

  function clearAllRiskSessionState() {
    if (activeRiskEditor) {
      clearEditorRiskState(activeRiskEditor);
    }

    activeRiskEditor = null;
    lastTypedPromptText = "";
    typedScanGeneration += 1;
  }

  function getRiskFingerprintForFindings(findings, normalizedText) {
    return buildRiskFingerprint(findings, normalizedText);
  }

  async function handleDestinationPolicy(findings, policy) {
    const decision = getDestinationPolicyDecision(policy);

    if (!decision.blocked) {
      return decision;
    }

    await recordMetadataAuditEvent("blocked", decision.reason, findings);
    setBadge("Destination blocked by policy");
    hideBadgeSoon(3200);
    await showMessageModal("Sensitive content blocked", decision.message);
    refreshBadgeFromCurrentInput();
    return decision;
  }

  async function promptForSensitiveContentDecision(
    findings,
    mode,
    policy,
    input = null,
    normalizedText = ""
  ) {
    const riskFingerprint = getRiskFingerprintForFindings(findings, normalizedText);
    const state = input ? getEditorRiskState(input) : null;

    if (
      state &&
      state.pendingDecisionPromise &&
      state.pendingDecisionFingerprint === riskFingerprint
    ) {
      return state.pendingDecisionPromise;
    }

    const decisionPromise = showDecisionModal(findings, mode, {
      policy
    }).then((decision) => {
      const action = resolveDecisionAction(decision.action, policy);

      if (state && state.pendingDecisionPromise === decisionPromise) {
        state.pendingDecisionFingerprint = "";
        state.pendingDecisionPromise = null;
      }

      return action;
    });

    if (state) {
      state.pendingDecisionFingerprint = riskFingerprint;
      state.pendingDecisionPromise = decisionPromise;
    }

    return decisionPromise;
  }

  async function initState() {
    const response = await sendRuntimeMessage({
      type: "PWM_INIT_TAB",
      url: location.href
    });

    if (response?.ok && response.state) {
      applyPublicState(response.state);
    }
  }

  async function requestRedaction(text, findings, options = {}) {
    const response = await sendRuntimeMessage({
      type: "PWM_REDACT_TEXT",
      url: location.href,
      text,
      findings,
      auditReason: options.auditReason || null,
      skipBackgroundScan: Boolean(options.skipBackgroundScan)
    });

    if (!response?.ok || !response?.result) {
      const error = new Error(response?.error || "LeakGuard could not redact this content.");
      error.reason = response?.reason || null;
      if (
        error.reason === "destination_blocked" ||
        error.reason === "destination_not_approved" ||
        error.reason === "policy_fail_closed"
      ) {
        setBadge("Destination blocked by policy");
        hideBadgeSoon(3200);
        await showMessageModal("Sensitive content blocked", error.message);
        refreshBadgeFromCurrentInput();
      }
      throw error;
    }

    if (response.state) {
      applyPublicState(response.state);
    }

    return response.result;
  }

  async function openPopupReveal(placeholder) {
    const response = await sendRuntimeMessage({
      type: "PWM_OPEN_POPUP_REVEAL",
      placeholder
    });

    if (!response?.ok || !response?.requestId) {
      throw new Error(response?.error || "LeakGuard could not open secure reveal.");
    }

    return response;
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    if (el.closest(".pwm-modal-backdrop")) return false;

    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    if (el.getAttribute("aria-hidden") === "true") return false;

    return el.getClientRects().length > 0;
  }

  function isEditableElement(el) {
    return (
      !!el &&
      !el.closest(".pwm-modal-backdrop") &&
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-disabled") !== "true" &&
      ((isTextArea(el) && !el.readOnly) || isContentEditable(el))
    );
  }

  function normalizeTarget(target) {
    if (!target) return null;
    return target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
  }

  function resolveEditableFromTarget(target) {
    const node = normalizeTarget(target);
    if (!node) return null;

    if (isEditableElement(node)) return node;

    const closest = node.closest(
      "textarea, [contenteditable='true'], [contenteditable]:not([contenteditable='false']), [role='textbox']"
    );
    if (closest && isEditableElement(closest)) return closest;

    return null;
  }

  function scoreComposerCandidate(el) {
    if (!isEditableElement(el) || !isVisible(el)) return -1000;

    let score = 0;
    const id = el.id || "";
    const dataTestId = el.getAttribute("data-testid") || "";
    const ariaLabel = el.getAttribute("aria-label") || "";
    const placeholder = el.getAttribute("placeholder") || "";
    const rect = el.getBoundingClientRect();

    if (document.activeElement === el) score += 100;
    if (el.contains(document.activeElement)) score += 32;
    if (id === "prompt-textarea") score += 80;
    if (/prompt/i.test(dataTestId)) score += 60;
    if (/composer/i.test(dataTestId)) score += 45;
    if (isTextArea(el)) score += 36;
    if (isContentEditable(el)) score += 28;
    if (el.getAttribute("role") === "textbox") score += 20;
    if (/message|prompt|ask/i.test(ariaLabel)) score += 18;
    if (/message|prompt|ask/i.test(placeholder)) score += 14;
    if (el.closest("form")) score += 18;
    if (el.closest("main")) score += 8;
    if (rect.bottom > window.innerHeight * 0.45) score += 10;
    if (rect.height >= 36) score += 6;

    return score;
  }

  function uniqueElements(elements) {
    return [...new Set(elements.filter(Boolean))];
  }

  function collectComposerCandidates(preferredTarget) {
    const candidates = [];
    const direct = resolveEditableFromTarget(preferredTarget);
    if (direct) candidates.push(direct);

    if (document.activeElement) {
      const active = resolveEditableFromTarget(document.activeElement);
      if (active) candidates.push(active);
    }

    if (isChatGptHost()) {
      for (const selector of CHATGPT_COMPOSER_SELECTORS) {
        document.querySelectorAll(selector).forEach((el) => candidates.push(el));
      }
    }

    for (const selector of COMPOSER_SELECTORS) {
      document.querySelectorAll(selector).forEach((el) => candidates.push(el));
    }

    return uniqueElements(candidates);
  }

  function findComposer(preferredTarget) {
    const candidates = collectComposerCandidates(preferredTarget);
    let winner = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const score = scoreComposerCandidate(candidate);
      if (score > bestScore) {
        winner = candidate;
        bestScore = score;
      }
    }

    return bestScore >= 0 ? winner : null;
  }

  function analyzeText(text) {
    const originalText = String(text || "");
    const normalizedText = normalizeVisiblePlaceholders(originalText);

    if (!normalizedText.trim()) {
      return {
        originalText,
        normalizedText,
        secretFindings: [],
        networkFindings: [],
        findings: [],
        placeholderNormalized: normalizedText !== originalText
      };
    }

    const detector = new Detector();
    const secretFindings = detector
      .scan(normalizedText, {
        trustedPlaceholders: currentPublicState.trustedPlaceholders
      })
      .filter((finding) => finding.severity !== "low");
    const networkFindings = buildNetworkUiFindings(normalizedText, {
      mode: currentPublicState.transformMode
    });

    return {
      originalText,
      normalizedText,
      secretFindings,
      networkFindings,
      findings: [...secretFindings, ...networkFindings].sort((a, b) => a.start - b.start),
      placeholderNormalized: normalizedText !== originalText
    };
  }

  async function analyzeTextWithAiAssist(text, policy = getActivePolicy()) {
    const originalText = String(text || "");
    const normalizedText = normalizeVisiblePlaceholders(originalText);

    if (!normalizedText.trim()) {
      return {
        originalText,
        normalizedText,
        secretFindings: [],
        networkFindings: [],
        findings: [],
        placeholderNormalized: normalizedText !== originalText
      };
    }

    const detector = new Detector();
    const scan =
      policy.aiAssistEnabled && typeof detector.scanWithAiAssist === "function"
        ? await detector.scanWithAiAssist(normalizedText, {
            policy,
            trustedPlaceholders: currentPublicState.trustedPlaceholders
          })
        : detector.scan(normalizedText, {
            trustedPlaceholders: currentPublicState.trustedPlaceholders
          });
    const secretFindings = scan.filter((finding) => finding.severity !== "low");
    const networkFindings = buildNetworkUiFindings(normalizedText, {
      mode: currentPublicState.transformMode
    });

    return {
      originalText,
      normalizedText,
      secretFindings,
      networkFindings,
      findings: [...secretFindings, ...networkFindings].sort((a, b) => a.start - b.start),
      placeholderNormalized: normalizedText !== originalText
    };
  }

  function splitSecretFindingsBySeverity(findings) {
    const high = [];
    const medium = [];

    for (const finding of findings || []) {
      if (finding?.severity === "high") {
        high.push(finding);
      } else if (finding?.severity === "medium") {
        medium.push(finding);
      }
    }

    return {
      high,
      medium
    };
  }

  function shouldAutoRedactTypedSecrets(secretFindings, allFindings) {
    if (!(secretFindings || []).length) return false;
    if ((allFindings || []).length !== secretFindings.length) return false;
    return secretFindings.every((finding) => finding?.severity === "high");
  }

  function shouldEnforceHttpSecretPolicy(policy, secretFindings) {
    return Boolean(policy.blockHttpSecrets && policy.http && (secretFindings || []).length > 0);
  }

  async function handleHttpSecretPolicy(policy, secretFindings, onRedact) {
    if (!shouldEnforceHttpSecretPolicy(policy, secretFindings)) {
      return false;
    }

    if (policy.defaultAction === "redact") {
      await onRedact();
      return true;
    }

    await recordMetadataAuditEvent("blocked", "http_blocked", secretFindings);
    setBadge("HTTP secret blocked by policy");
    hideBadgeSoon(3200);
    await showMessageModal(
      "Sensitive content blocked",
      "LeakGuard blocked sensitive content on this HTTP destination because policy treats HTTP as high risk."
    );
    refreshBadgeFromCurrentInput();
    return true;
  }

  function getFindings(text) {
    return analyzeText(text).findings;
  }

  async function applyNormalizedComposerRewrite(input, originalText, context) {
    const normalizedText = normalizeVisiblePlaceholders(originalText);

    if (normalizedText === originalText) {
      return {
        ok: true,
        changed: false,
        text: originalText
      };
    }

    const applied = await applyComposerText(input, normalizedText, {
      caretOffset: normalizedText.length,
      restoreText: normalizedText,
      restoreCaretOffset: normalizedText.length
    });

    if (!applied.ok) {
      await showRewriteFailure(
        context,
        collectFailureDetails(input, normalizedText, applied.actual, context)
      );
      refreshBadgeFromCurrentInput();
      return {
        ok: false,
        changed: true,
        text: normalizedText
      };
    }

    setBadge("Placeholders normalized");
    hideBadgeSoon();

    return {
      ok: true,
      changed: true,
      text: normalizedText
    };
  }

  function closeModal(backdrop, onClose) {
    if (backdrop?.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }

    modalOpen = false;

    if (typeof onClose === "function") {
      onClose();
    }
  }

  function appendFindingRow(container) {
    const row = document.createElement("div");
    row.className = "pwm-finding";
    row.textContent = "Sensitive item detected";
    container.appendChild(row);
  }

  function showDecisionModal(findings, mode, options = {}) {
    if (modalOpen) {
      return Promise.resolve({ action: "cancel" });
    }

    modalOpen = true;
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "pwm-modal-backdrop";

      const modal = document.createElement("div");
      modal.className = "pwm-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.tabIndex = -1;

      const title = document.createElement("h2");
      title.textContent = "LeakGuard detected sensitive content";

      const desc = document.createElement("p");
      desc.textContent =
        mode === "paste"
          ? "This pasted content appears to contain sensitive material. Redact it before it reaches the chat input, or cancel the paste."
          : mode === "input"
            ? "This typed content may contain sensitive material. Redact it before it stays in the chat input, or cancel the edit."
          : "This message appears to contain sensitive material. Redact it before sending, or cancel the send.";

      const findingsWrap = document.createElement("div");
      findingsWrap.className = "pwm-findings";
      findings.slice(0, 8).forEach(() => appendFindingRow(findingsWrap));

      const actions = document.createElement("div");
      actions.className = "pwm-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "pwm-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";

      const redactBtn = document.createElement("button");
      redactBtn.className = "pwm-btn pwm-btn-primary";
      redactBtn.type = "button";
      redactBtn.textContent = "Redact";

      const finish = (result) => {
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("keypress", onKeyPassthrough, true);
        window.removeEventListener("keyup", onKeyPassthrough, true);
        closeModal(backdrop);
        resolve(result);
      };

      const getFocusedAction = () => {
        const active = document.activeElement;
        if (active === redactBtn) return "redact";
        if (active === cancelBtn) return "cancel";
        if (modal.contains(active)) return "redact";
        return null;
      };

      const consumeModalKeyEvent = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          consumeModalKeyEvent(event);
          finish({ action: "cancel" });
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          consumeModalKeyEvent(event);
          finish({ action: getFocusedAction() || "redact" });
        }
      };

      const onKeyPassthrough = (event) => {
        if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
          consumeModalKeyEvent(event);
        }
      };

      cancelBtn.addEventListener("click", () => finish({ action: "cancel" }));
      redactBtn.addEventListener("click", () => finish({ action: "redact" }));

      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          finish({ action: "cancel" });
        }
      });

      actions.append(cancelBtn);
      actions.appendChild(redactBtn);
      modal.append(title, desc, findingsWrap, actions);
      backdrop.appendChild(modal);
      document.documentElement.appendChild(backdrop);

      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("keypress", onKeyPassthrough, true);
      window.addEventListener("keyup", onKeyPassthrough, true);
      redactBtn.focus();
    });
  }

  function showMessageModal(titleText, bodyText) {
    if (modalOpen) {
      return Promise.resolve();
    }

    modalOpen = true;

    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "pwm-modal-backdrop";

      const modal = document.createElement("div");
      modal.className = "pwm-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.tabIndex = -1;

      const title = document.createElement("h2");
      title.textContent = titleText;

      const desc = document.createElement("p");
      desc.textContent = bodyText;

      const actions = document.createElement("div");
      actions.className = "pwm-actions";

      const closeBtn = document.createElement("button");
      closeBtn.className = "pwm-btn pwm-btn-primary";
      closeBtn.type = "button";
      closeBtn.textContent = "Close";

      const consumeModalEvent = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
      };

      const finish = () => {
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("keypress", onModalPassthrough, true);
        window.removeEventListener("keyup", onModalPassthrough, true);
        window.removeEventListener("beforeinput", onModalPassthrough, true);
        window.removeEventListener("input", onModalPassthrough, true);
        window.removeEventListener("paste", onModalPassthrough, true);
        closeModal(backdrop);
        resolve();
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          consumeModalEvent(event);
          finish();
          return;
        }

        consumeModalEvent(event);
      };

      const onModalPassthrough = (event) => {
        consumeModalEvent(event);
      };

      closeBtn.addEventListener("click", finish);
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          finish();
        }
      });

      actions.append(closeBtn);
      modal.append(title, desc, actions);
      backdrop.appendChild(modal);
      document.documentElement.appendChild(backdrop);

      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("keypress", onModalPassthrough, true);
      window.addEventListener("keyup", onModalPassthrough, true);
      window.addEventListener("beforeinput", onModalPassthrough, true);
      window.addEventListener("input", onModalPassthrough, true);
      window.addEventListener("paste", onModalPassthrough, true);
      closeBtn.focus();
    });
  }

  function showGeminiLargeTextConfirmationModal(redactedLength) {
    if (modalOpen) {
      return Promise.resolve({ action: "cancel" });
    }

    modalOpen = true;

    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "pwm-modal-backdrop";

      const modal = document.createElement("div");
      modal.className = "pwm-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.tabIndex = -1;

      const title = document.createElement("h2");
      title.textContent = "Large sanitized text fallback";

      const desc = document.createElement("p");
      const sizeKb = Math.max(1, Math.round(Number(redactedLength || 0) / 1024));
      desc.textContent =
        `Gemini rejected the sanitized file upload. This sanitized text is about ${sizeKb} KiB, and inserting it into Gemini may freeze the page temporarily.`;

      const actions = document.createElement("div");
      actions.className = "pwm-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "pwm-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";

      const insertBtn = document.createElement("button");
      insertBtn.className = "pwm-btn pwm-btn-primary";
      insertBtn.type = "button";
      insertBtn.textContent = "Insert anyway";

      const consumeModalEvent = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
      };

      const finish = (action) => {
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("keypress", onModalPassthrough, true);
        window.removeEventListener("keyup", onModalPassthrough, true);
        window.removeEventListener("beforeinput", onModalPassthrough, true);
        window.removeEventListener("input", onModalPassthrough, true);
        window.removeEventListener("paste", onModalPassthrough, true);
        closeModal(backdrop);
        resolve({ action });
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          consumeModalEvent(event);
          finish("cancel");
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          consumeModalEvent(event);
          finish(document.activeElement === cancelBtn ? "cancel" : "insert");
          return;
        }

        consumeModalEvent(event);
      };

      const onModalPassthrough = (event) => {
        consumeModalEvent(event);
      };

      cancelBtn.addEventListener("click", () => finish("cancel"));
      insertBtn.addEventListener("click", () => finish("insert"));
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          finish("cancel");
        }
      });

      actions.append(cancelBtn, insertBtn);
      modal.append(title, desc, actions);
      backdrop.appendChild(modal);
      document.documentElement.appendChild(backdrop);

      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("keypress", onModalPassthrough, true);
      window.addEventListener("keyup", onModalPassthrough, true);
      window.addEventListener("beforeinput", onModalPassthrough, true);
      window.addEventListener("input", onModalPassthrough, true);
      window.addEventListener("paste", onModalPassthrough, true);
      insertBtn.focus();
    });
  }

  async function settleComposer() {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  async function readStableComposerText(input, maxPasses = 4) {
    let previous = getInputText(input);

    for (let pass = 0; pass < maxPasses; pass += 1) {
      await settleComposer();
      const current = getInputText(input);

      if (current === previous) {
        return current;
      }

      previous = current;
    }

    return previous;
  }

  function suppressFollowupInputScan(durationMs = PROGRAMMATIC_INPUT_SUPPRESS_MS) {
    suppressInputScanUntil = Date.now() + Math.max(PROGRAMMATIC_INPUT_SUPPRESS_MS, Number(durationMs) || 0);
  }

  function isProgrammaticInputScanSuppressed() {
    if (Date.now() >= suppressInputScanUntil) {
      suppressInputScanUntil = 0;
      return false;
    }

    return true;
  }

  function pruneRewriteFailureSuppressions(now) {
    for (const [fingerprint, expiresAt] of rewriteFailureModalSuppressions.entries()) {
      if (expiresAt <= now) {
        rewriteFailureModalSuppressions.delete(fingerprint);
      }
    }
  }

  function buildRewriteFailureFingerprint(context, details) {
    const expected = details?.expected || {};
    const actual = details?.actual || {};
    const normalizedInnerText = details?.normalizedInnerText || {};
    const textContent = details?.textContent || {};
    return [
      context || "",
      expected.length || 0,
      expected.lineCount || 0,
      expected.placeholderCount || 0,
      actual.length || 0,
      actual.lineCount || 0,
      actual.placeholderCount || 0,
      normalizedInnerText.length || 0,
      normalizedInnerText.lineCount || 0,
      textContent.length || 0,
      textContent.lineCount || 0
    ].join(":");
  }

  function shouldSuppressRewriteFailureModal(context, details) {
    const now = Date.now();
    pruneRewriteFailureSuppressions(now);
    const fingerprint = buildRewriteFailureFingerprint(context, details);
    const duplicateUntil = rewriteFailureModalSuppressions.get(fingerprint) || 0;
    const suppressed = Boolean(modalOpen || duplicateUntil > now);

    if (suppressed) {
      debugRewriteVerification("rewrite:failure-modal-suppressed-duplicate", {
        context,
        modalOpen,
        duplicate: duplicateUntil > now,
        ttlMs: Math.max(0, duplicateUntil - now),
        expected: details?.expected || null,
        actual: details?.actual || null
      });
      return true;
    }

    rewriteFailureModalSuppressions.set(fingerprint, now + REWRITE_FAILURE_SUPPRESS_MS);
    return false;
  }

  async function showRewriteFailure(context, details) {
    if (shouldSuppressRewriteFailureModal(context, details)) {
      return;
    }

    const message =
      context === "submit"
        ? "LeakGuard blocked send because it could not verify the rewritten composer content safely."
        : "LeakGuard blocked the action because it could not verify the rewritten composer content safely.";

    setBadge("Rewrite mismatch blocked");
    hideBadgeSoon(3200);
    if (details) {
      logFailureDetails(details);
    }

    await showMessageModal(
      "Rewrite verification failed",
      `${message} Nothing was submitted. Review the composer and retry.`
    );
  }

  function focusChatGptComposer(input) {
    if (!input || typeof input.focus !== "function") return;
    try {
      input.focus({ preventScroll: true });
    } catch {
      try {
        input.focus();
      } catch {
        // Focus is a sync hint only.
      }
    }
  }

  function placeChatGptCaretAtEnd(input) {
    if (!input) return;
    try {
      if (isTextArea(input) && typeof input.setSelectionRange === "function") {
        const textLength = getInputText(input).length;
        input.setSelectionRange(textLength, textLength);
        return;
      }
    } catch {
      // Best-effort only.
    }

    if (!isContentEditable(input) || typeof window?.getSelection !== "function") return;
    try {
      const selection = window.getSelection();
      const range = document.createRange?.();
      if (!selection || !range) return;
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // Selection APIs can be blocked by host-controlled DOM.
    }
  }

  function dispatchChatGptComposerInputEvent(input, inputType, data) {
    if (!input?.dispatchEvent) return false;
    const safeData =
      typeof data === "string" && data.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS
        ? data
        : null;
    let event = null;
    try {
      event = new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType,
        data: safeData
      });
    } catch {
      event = new Event("input", { bubbles: true, composed: true });
    }
    try {
      input.dispatchEvent(event);
      return true;
    } catch {
      return false;
    }
  }

  function dispatchChatGptComposerBeforeInput(input, inputType, data) {
    if (!input?.dispatchEvent) return false;
    const safeData =
      typeof data === "string" && data.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS
        ? data
        : null;
    let event = null;
    try {
      event = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType,
        data: safeData
      });
    } catch {
      event = new Event("beforeinput", { bubbles: true, cancelable: true, composed: true });
    }
    try {
      input.dispatchEvent(event);
      return true;
    } catch {
      return false;
    }
  }

  function dispatchChatGptComposerChange(input) {
    if (!input?.dispatchEvent) return false;
    try {
      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      return true;
    } catch {
      return false;
    }
  }

  function nudgeChatGptComposerState(input, expectedText, strategy) {
    focusChatGptComposer(input);
    placeChatGptCaretAtEnd(input);
    try {
      document.dispatchEvent?.(new Event("selectionchange", { bubbles: true }));
    } catch {
      // Host may not expose document-level dispatch.
    }
    debugChatGptSync("chatgpt-sync:react-state-nudge", input, expectedText, null, {
      strategy
    });
  }

  async function waitForChatGptComposerVerification() {
    await new Promise((resolve) => window.setTimeout(resolve, CHATGPT_SYNC_VERIFY_DELAY_MS));
  }

  function tryChatGptExecCommandWrite(input, writeText, options = {}) {
    if (!isContentEditable(input)) return false;
    if (writeText.length > CHATGPT_SYNC_EVENT_DATA_MAX_CHARS) return false;
    if (typeof document?.execCommand !== "function") return false;

    focusChatGptComposer(input);
    dispatchChatGptComposerBeforeInput(input, "insertReplacementText", writeText);

    let selected = false;
    try {
      selected = Boolean(document.execCommand("selectAll", false, null));
    } catch {
      selected = false;
    }
    if (!selected) return false;

    let inserted = false;
    try {
      inserted = Boolean(document.execCommand("insertText", false, writeText));
    } catch {
      inserted = false;
    }
    if (!inserted) return false;

    if (Number.isFinite(options.caretOffset)) {
      placeChatGptCaretAtEnd(input);
    } else {
      placeChatGptCaretAtEnd(input);
    }
    dispatchChatGptComposerInputEvent(input, "insertReplacementText", writeText);
    dispatchChatGptComposerChange(input);
    return true;
  }

  function tryChatGptDirectWrite(input, writeText, options = {}) {
    suppressFollowupInputScan(options.suppressMs || PROGRAMMATIC_INPUT_SUPPRESS_MS);
    focusChatGptComposer(input);
    const written = setInputTextDirect(input, writeText, {
      caretOffset: options.caretOffset
    });
    if (!written) return false;
    dispatchChatGptComposerInputEvent(input, "insertReplacementText", null);
    dispatchChatGptComposerChange(input);
    return true;
  }

  function tryChatGptComposerHelperWrite(input, writeText, options = {}) {
    suppressFollowupInputScan(options.suppressMs || PROGRAMMATIC_INPUT_SUPPRESS_MS);
    focusChatGptComposer(input);
    setInputText(input, writeText, {
      caretOffset: options.caretOffset
    });
    return true;
  }

  async function runChatGptSyncedWriteAttempt(input, plan, options, strategy) {
    const expected = plan.canonical;
    const writeText = plan.writeText;
    debugChatGptSync("chatgpt-sync:write-plan", input, expected, null, {
      strategy,
      eventData: writeText.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS ? "included" : "omitted"
    });

    suppressFollowupInputScan(options.suppressMs || PROGRAMMATIC_INPUT_SUPPRESS_MS);
    let writeAccepted = false;
    if (strategy === "exec-command") {
      writeAccepted = tryChatGptExecCommandWrite(input, writeText, options);
    } else if (strategy === "composer-helper") {
      writeAccepted = tryChatGptComposerHelperWrite(input, writeText, options);
    } else {
      writeAccepted = tryChatGptDirectWrite(input, writeText, options);
    }

    const actualAfterWrite = getInputText(input);
    debugChatGptSync("chatgpt-sync:after-write", input, expected, actualAfterWrite, {
      strategy,
      writeAccepted
    });
    nudgeChatGptComposerState(input, expected, strategy);
    await waitForChatGptComposerVerification();
    const actual = await readStableComposerText(input, 2);
    const verification = writeAccepted
      ? await verifyComposerRewriteSafe({
          input,
          expectedText: expected,
          originalText: options.rawInsertedText || options.restoreText || "",
          redactedText: expected,
          findings: options.findings,
          context: options.context || "chatgpt-sync",
          caretOffset: options.caretOffset,
          actualText: actual
        })
      : { ok: false, actual };
    if (writeAccepted && verification.ok) {
      debugChatGptSync("chatgpt-sync:verification-pass", input, expected, actual, {
        strategy,
        verificationStrategy: verification.strategy
      });
      return {
        ok: true,
        actual: verification.actual || actual,
        strategy: `chatgpt-${strategy}`
      };
    }

    debugChatGptSync("chatgpt-sync:verification-failed", input, expected, actual, {
      strategy,
      writeAccepted
    });
    return {
      ok: false,
      actual,
      strategy: `chatgpt-${strategy}`
    };
  }

  async function applyChatGptSyncedComposerText(input, expectedText, options = {}) {
    if (!isChatGptHost()) {
      return { ok: false, actual: getInputText(input), strategy: "not-chatgpt" };
    }
    const plan = buildComposerWritePlan(input, expectedText);
    debugChatGptSync("chatgpt-sync:before-write", input, plan.canonical, null, {
      context: options.context || ""
    });

    const writeText = plan.writeText;
    const attempts =
      isContentEditable(input) && writeText.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS
        ? ["exec-command", "direct-dom"]
        : writeText.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS
          ? ["direct-dom", "composer-helper"]
          : ["direct-dom"];

    let lastResult = {
      ok: false,
      actual: getInputText(input),
      strategy: "not-attempted"
    };
    for (const strategy of attempts) {
      lastResult = await runChatGptSyncedWriteAttempt(input, plan, options, strategy);
      if (lastResult.ok) {
        return lastResult;
      }
    }

    if (typeof options.restoreText === "string") {
      tryChatGptDirectWrite(input, normalizeComposerText(options.restoreText), {
        caretOffset: options.restoreCaretOffset,
        suppressMs: options.suppressMs
      });
      await readStableComposerText(input, 2);
    }

    return lastResult;
  }

  async function applyComposerText(input, expectedText, options) {
    options = options || {};
    if (typeof isChatGptHost === "function" && isChatGptHost()) {
      return applyChatGptSyncedComposerText(input, expectedText, {
        ...options,
        context: options.context || "composer-rewrite"
      });
    }

    const plan = buildComposerWritePlan(input, expectedText);
    const expected = plan.canonical;
    const writeText = plan.writeText;
    const rawInsertedText =
      typeof options.rawInsertedText === "string"
        ? normalizeComposerText(options.rawInsertedText)
        : "";

    suppressFollowupInputScan();
    setInputText(input, writeText, {
      caretOffset: options.caretOffset
    });
    const actualAfterPrimary = await readStableComposerText(input);
    debugLogSnapshot("rewrite:primary-rewrite", input, expected, writeText);

    let actual = actualAfterPrimary;
    const primaryPlanMatched = matchesComposerPlan(plan, actual);
    const primaryVerification = await verifyComposerRewriteSafe({
      input,
      expectedText: expected,
      originalText: options.originalText || rawInsertedText || options.restoreText || "",
      redactedText: expected,
      findings: options.findings,
      context: options.context || "composer-rewrite",
      caretOffset: options.caretOffset,
      actualText: actual
    });
    if (primaryVerification.ok) {
      return {
        ok: true,
        actual: primaryVerification.actual || actual,
        strategy: primaryPlanMatched ? "primary-rewrite" : `primary-rewrite-${primaryVerification.strategy}`
      };
    }

    forceRewriteInputText(input, writeText, {
      caretOffset: options.caretOffset
    });
    actual = await readStableComposerText(input);
    debugLogSnapshot("rewrite:html-fallback", input, expected, writeText);

    const htmlPlanMatched = matchesComposerPlan(plan, actual);
    const htmlVerification = await verifyComposerRewriteSafe({
      input,
      expectedText: expected,
      originalText: options.originalText || rawInsertedText || options.restoreText || "",
      redactedText: expected,
      findings: options.findings,
      context: options.context || "composer-rewrite",
      caretOffset: options.caretOffset,
      actualText: actual
    });
    if (htmlVerification.ok) {
      return {
        ok: true,
        actual: htmlVerification.actual || actual,
        strategy: htmlPlanMatched ? "html-fallback" : `html-fallback-${htmlVerification.strategy}`
      };
    }

    if (rawInsertedText && actual.includes(rawInsertedText)) {
      suppressFollowupInputScan();
      if (setInputTextDirect(input, writeText, { caretOffset: options.caretOffset })) {
        actual = await readStableComposerText(input);
        debugLogSnapshot("rewrite:direct-transactional-fallback", input, expected, writeText);

        const directPlanMatched = matchesComposerPlan(plan, actual);
        const directVerification = await verifyComposerRewriteSafe({
          input,
          expectedText: expected,
          originalText: options.originalText || rawInsertedText || options.restoreText || "",
          redactedText: expected,
          findings: options.findings,
          context: options.context || "composer-rewrite",
          caretOffset: options.caretOffset,
          actualText: actual
        });
        if (directVerification.ok && !actual.includes(rawInsertedText)) {
          return {
            ok: true,
            actual: directVerification.actual || actual,
            strategy: directPlanMatched
              ? "direct-transactional-fallback"
              : `direct-transactional-fallback-${directVerification.strategy}`
          };
        }
      }
    }

    if (typeof options.restoreText === "string") {
      forceRewriteInputText(input, options.restoreText, {
        caretOffset: options.restoreCaretOffset
      });
      await readStableComposerText(input, 2);
    }

    return {
      ok: false,
      actual
    };
  }

  async function rewriteComposerTransactionally(input, originalText, redactedText, context, options) {
    options = options || {};
    const normalizedOriginal = normalizeComposerText(originalText);
    const normalizedRedacted = normalizeComposerText(redactedText);
    const plan = buildComposerWritePlan(input, normalizedRedacted);
    const acceptableTexts = Array.isArray(plan.acceptableTexts) ? plan.acceptableTexts : [plan.canonical];
    const hasRawLeak = (actual) =>
      Boolean(
        normalizedOriginal &&
          normalizeComposerText(actual).includes(normalizedOriginal) &&
          !acceptableTexts.includes(normalizeComposerText(actual))
      );
    const applied = await applyComposerText(input, normalizedRedacted, {
      ...options,
      originalText: normalizedOriginal,
      redactedText: normalizedRedacted,
      rawInsertedText: normalizedOriginal
    });

    if (applied.ok && !hasRawLeak(applied.actual)) {
      return applied;
    }

    suppressFollowupInputScan();
    if (setInputTextDirect(input, normalizedRedacted, { caretOffset: options.caretOffset })) {
      const actual = await readStableComposerText(input);
      const verification = await verifyComposerRewriteSafe({
        input,
        expectedText: normalizedRedacted,
        originalText: normalizedOriginal,
        redactedText: normalizedRedacted,
        findings: options.findings,
        context,
        caretOffset: options.caretOffset,
        actualText: actual
      });
      if (
        verification.ok &&
        !hasRawLeak(actual)
      ) {
        return { ok: true, actual: verification.actual || actual, strategy: "direct-transactional-rewrite" };
      }
      if (hasRawLeak(actual)) {
        forceRewriteInputText(input, plan.writeText, { caretOffset: options.caretOffset });
        const forcedActual = await readStableComposerText(input);
        const forcedVerification = await verifyComposerRewriteSafe({
          input,
          expectedText: normalizedRedacted,
          originalText: normalizedOriginal,
          redactedText: normalizedRedacted,
          findings: options.findings,
          context,
          caretOffset: options.caretOffset,
          actualText: forcedActual
        });
        if (forcedVerification.ok && !hasRawLeak(forcedActual)) {
          return {
            ok: true,
            actual: forcedVerification.actual || forcedActual,
            strategy: "forced-transactional-rewrite"
          };
        }
        return { ok: false, actual: forcedActual };
      }
      return { ok: false, actual };
    }

    return applied;
  }

  async function ensureExactComposerState(input, expectedText, options = {}) {
    const plan = buildComposerWritePlan(input, expectedText);
    const actual = await readStableComposerText(input, 2);
    debugLogSnapshot("pre-submit-check", input, plan.canonical, plan.writeText);
    const verification = await verifyComposerRewriteSafe({
      input,
      expectedText: plan.canonical,
      originalText: options.originalText || "",
      redactedText: plan.canonical,
      findings: options.findings,
      context: options.context || "pre-submit-check",
      caretOffset: options.caretOffset,
      actualText: actual
    });
    return verification.ok;
  }

  function findSendButton(contextEl) {
    const searchRoot = contextEl?.closest("form") || document;

    for (const selector of SEND_BUTTON_SELECTORS) {
      const button = searchRoot.querySelector(selector);
      if (button && isVisible(button)) {
        return button;
      }
    }

    return null;
  }

  function submitComposer(form, input) {
    clearAllRiskSessionState();

    if (form && typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }

    const button = findSendButton(input);
    if (button) {
      button.click();
    }
  }

  async function applyPasteDecision(input, originalText, selection, insertedText, context, options) {
    options = options || {};
    const rawInsertedText =
      typeof options.rawInsertedText === "string"
        ? normalizeComposerText(options.rawInsertedText)
        : "";
    const normalizedOriginalText = normalizeComposerText(originalText);
    const normalizedInsertedText = normalizeComposerText(insertedText);
    const rawIndex = rawInsertedText ? normalizedOriginalText.indexOf(rawInsertedText) : -1;
    const next =
      rawIndex >= 0
        ? {
            text:
              normalizedOriginalText.slice(0, rawIndex) +
              normalizedInsertedText +
              normalizedOriginalText.slice(rawIndex + rawInsertedText.length),
            caretOffset: rawIndex + normalizedInsertedText.length
          }
        : spliceSelectionText(originalText, selection, insertedText);
    const applied = await rewriteComposerTransactionally(
      input,
      rawInsertedText,
      next.text,
      context,
      {
        caretOffset: next.caretOffset,
        restoreText: originalText,
        restoreCaretOffset: selection?.end
      }
    );

    if (!applied.ok) {
      await showRewriteFailure(
        context,
        collectFailureDetails(input, next.text, applied.actual, context)
      );
      refreshBadgeFromCurrentInput();
      return false;
    }

    return true;
  }

  async function applyTypedInterceptionRewrite(
    input,
    expectedText,
    originalText,
    selection,
    context
  ) {
    const restoreCaretOffset = Math.max(0, Number(selection?.end) || 0);
    const caretOffset = deriveRewriteCaretOffset(
      expectedText,
      normalizeComposerText(originalText).slice(restoreCaretOffset)
    );
    const applied = await applyComposerText(input, expectedText, {
      caretOffset,
      restoreText: originalText,
      restoreCaretOffset
    });

    if (!applied.ok) {
      await showRewriteFailure(
        context,
        collectFailureDetails(input, expectedText, applied.actual, context)
      );
      refreshBadgeFromCurrentInput();
      return false;
    }

    if (!(await ensureExactComposerState(input, expectedText))) {
      await showRewriteFailure(
        context,
        collectFailureDetails(input, expectedText, getInputText(input), context)
      );
      refreshBadgeFromCurrentInput();
      return false;
    }

    return true;
  }

  async function maybeHandleBeforeInput(event) {
    if (isPasteBeforeInput(event)) {
      await maybeHandlePaste(event);
      return;
    }

    if (event?.isTrusted === false && isProgrammaticInputScanSuppressed()) return;

    if (!extensionRuntimeAvailable || modalOpen || !shouldInterceptBeforeInput(event)) return;

    const input = findComposer(event.target);
    if (!input) return;
    noteActiveRiskEditor(input);

    const insertedText = getBeforeInputData(event);
    if (!insertedText) return;

    const originalText = getInputText(input);
    const selection = getSelectionOffsets(input);
    const next = spliceSelectionText(originalText, selection, insertedText);
    let firefoxEarlyAnalysis = null;
    let firefoxEarlyRelevantFindings = [];
    let firefoxEarlyRelevantSecretFindings = [];
    let firefoxEarlyPlaceholderNormalizationChanged = false;
    if (isFirefoxRuntime()) {
      firefoxEarlyAnalysis = analyzeText(next.text);
      firefoxEarlyRelevantFindings = selectFindingsOverlappingInsertion(
        firefoxEarlyAnalysis.findings,
        selection,
        insertedText
      );
      firefoxEarlyRelevantSecretFindings = selectFindingsOverlappingInsertion(
        firefoxEarlyAnalysis.secretFindings,
        selection,
        insertedText
      );
      firefoxEarlyPlaceholderNormalizationChanged =
        firefoxEarlyAnalysis.placeholderNormalized &&
        firefoxEarlyAnalysis.normalizedText !== next.text &&
        normalizeVisiblePlaceholders(insertedText) !== insertedText;

      if (firefoxEarlyRelevantFindings.length || firefoxEarlyPlaceholderNormalizationChanged) {
        consumeInterceptionEvent(event);
      }
    }
    const currentAnalysis = await analyzeTextWithAiAssist(originalText);
    const nextAnalysis = await analyzeTextWithAiAssist(next.text);
    const relevantFindings = selectFindingsOverlappingInsertion(
      nextAnalysis.findings,
      selection,
      insertedText
    );
    const relevantSecretFindings = selectFindingsOverlappingInsertion(
      nextAnalysis.secretFindings,
      selection,
      insertedText
    );
    const placeholderNormalizationChanged =
      nextAnalysis.placeholderNormalized &&
      nextAnalysis.normalizedText !== next.text &&
      (normalizeVisiblePlaceholders(insertedText) !== insertedText ||
        nextAnalysis.normalizedText !== currentAnalysis.normalizedText);

    if (!relevantFindings.length && !placeholderNormalizationChanged) {
      return;
    }

    const typedShouldAutoRedact = shouldAutoRedactTypedSecrets(
      relevantSecretFindings,
      relevantFindings
    );

    if (!event.defaultPrevented) {
      consumeInterceptionEvent(event);
    }

    const policy = await getPolicyForAction();
    const destinationPolicy = await handleDestinationPolicy(relevantFindings, policy);
    if (destinationPolicy.blocked) {
      return;
    }
    const destinationForceRedact = shouldForceDestinationRedaction(
      destinationPolicy,
      relevantFindings
    );

    const httpPolicyHandled = await handleHttpSecretPolicy(policy, relevantSecretFindings, async () => {
      const result = await requestRedaction(nextAnalysis.normalizedText, relevantSecretFindings);
      const ok = await applyTypedInterceptionRewrite(
        input,
        result.redactedText,
        originalText,
        selection,
        "input"
      );

      if (!ok) {
        return;
      }

      lastTypedPromptText = result.redactedText;
      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
    });

    if (httpPolicyHandled) {
      return;
    }

    if (destinationForceRedact) {
      const result = await requestRedaction(nextAnalysis.normalizedText, relevantSecretFindings, {
        auditReason: destinationPolicy.reason
      });
      const ok = await applyTypedInterceptionRewrite(
        input,
        result.redactedText,
        originalText,
        selection,
        "input"
      );

      if (!ok) return;

      lastTypedPromptText = result.redactedText;
      setBadge("Destination policy required redaction");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    if (isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
      const ok = await applyTypedInterceptionRewrite(
        input,
        nextAnalysis.normalizedText,
        originalText,
        selection,
        "input"
      );

      if (!ok) return;

      lastTypedPromptText = nextAnalysis.normalizedText;
      setBadge("Protection paused");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    if (typedShouldAutoRedact) {
      const result = await requestRedaction(nextAnalysis.normalizedText, relevantSecretFindings);
      const ok = await applyTypedInterceptionRewrite(
        input,
        result.redactedText,
        originalText,
        selection,
        "input"
      );

      if (!ok) {
        return;
      }

      lastTypedPromptText = result.redactedText;
      setBadge("High-confidence secret redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    if (!relevantFindings.length) {
      const ok = await applyTypedInterceptionRewrite(
        input,
        nextAnalysis.normalizedText,
        originalText,
        selection,
        "input"
      );

      if (!ok) return;

      lastTypedPromptText = nextAnalysis.normalizedText;
      setBadge("Placeholders normalized");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    const decisionAction = await promptForSensitiveContentDecision(
      relevantFindings,
      "input",
      policy,
      input,
      nextAnalysis.normalizedText
    );
    if (decisionAction === "cancel") {
      refreshBadgeFromCurrentInput();
      return;
    }

    const result = await requestRedaction(nextAnalysis.normalizedText, relevantSecretFindings);
    const ok = await applyTypedInterceptionRewrite(
      input,
      result.redactedText,
      originalText,
      selection,
      "input"
    );

    if (!ok) return;

    lastTypedPromptText = result.redactedText;
    setBadge("Content redacted");
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();
  }

  async function maybeHandlePaste(event) {
    if (!extensionRuntimeAvailable || modalOpen || event.defaultPrevented) return;
    if (isSanitizedFileHandoffEvent(event)) return;

    if (isGeminiHost() && await maybeHandleGeminiEditorPaste(event)) {
      return;
    }

    const input = findComposer(event.target);
    if (!input) return;
    noteActiveRiskEditor(input);

    const pasteTransfer = getPasteTransfer(event);
    if (typeof dataTransferHasFiles === "function" && dataTransferHasFiles(pasteTransfer)) {
      await maybeHandleLocalFileInsert(event, input, pasteTransfer, "paste");
      return;
    }

    const pasted = getPastedPlainText(event);

    if (!pasted) return;

    const quickAnalysis = analyzeText(pasted);
    if (await maybeHandleChatGptLargeTextPaste(event, input, pasted, quickAnalysis)) {
      return;
    }

    if (!quickAnalysis.findings.length && !quickAnalysis.placeholderNormalized) return;

    const originalText = getInputText(input);
    const selection = getSelectionOffsets(input);
    consumeInterceptionEvent(event);

    const analysis = await analyzeTextWithAiAssist(pasted);

    if (!analysis.findings.length) {
      const ok = await applyPasteDecision(
        input,
        originalText,
        selection,
        analysis.normalizedText,
        "paste",
        { rawInsertedText: pasted }
      );

      if (!ok) return;

      setBadge("Placeholders normalized");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    const policy = await getPolicyForAction();
    const destinationPolicy = await handleDestinationPolicy(analysis.findings, policy);
    if (destinationPolicy.blocked) {
      return;
    }
    const destinationForceRedact = shouldForceDestinationRedaction(destinationPolicy, analysis.findings);

    const httpPolicyHandled = await handleHttpSecretPolicy(policy, analysis.secretFindings, async () => {
      const latestInput = findComposer(input);
      if (!latestInput) return;

      const latestText = getInputText(latestInput);
      const baseText = latestText === originalText ? latestText : originalText;
      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      const ok = await applyPasteDecision(
        latestInput,
        baseText,
        selection,
        result.redactedText,
        "paste",
        { rawInsertedText: pasted }
      );

      if (!ok) {
        return;
      }

      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
    });

    if (httpPolicyHandled) {
      return;
    }

    if (destinationForceRedact) {
      const latestInput = findComposer(input);
      if (!latestInput) return;

      const latestText = getInputText(latestInput);
      const baseText = latestText === originalText ? latestText : originalText;
      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
        auditReason: destinationPolicy.reason
      });

      const ok = await applyPasteDecision(
        latestInput,
        baseText,
        selection,
        result.redactedText,
        "paste",
        { rawInsertedText: pasted }
      );

      if (!ok) return;

      setBadge("Destination policy required redaction");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    if (isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
      const latestInput = findComposer(input);
      if (!latestInput) return;

      const latestText = getInputText(latestInput);
      const baseText = latestText === originalText ? latestText : originalText;
      const ok = await applyPasteDecision(
        latestInput,
        baseText,
        selection,
        analysis.normalizedText,
        "paste",
        { rawInsertedText: pasted }
      );
      if (!ok) return;

      setBadge("Protection paused");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    const decisionAction = await promptForSensitiveContentDecision(
      analysis.findings,
      "paste",
      policy,
      input,
      analysis.normalizedText
    );
    if (decisionAction === "cancel") return;

    const latestInput = findComposer(input);
    if (!latestInput) return;

    const latestText = getInputText(latestInput);
    const baseText = latestText === originalText ? latestText : originalText;

    const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);

    const ok = await applyPasteDecision(
      latestInput,
      baseText,
      selection,
      result.redactedText,
      "paste",
      { rawInsertedText: pasted }
    );

    if (!ok) return;

    setBadge("Content redacted");
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();
  }

  function isSanitizedFileHandoffEvent(event) {
    return Boolean(event?.__PWM_SANITIZED_FILE_HANDOFF__);
  }

  function markSanitizedFileHandoffEvent(event) {
    try {
      Object.defineProperty(event, "__PWM_SANITIZED_FILE_HANDOFF__", {
        value: true,
        configurable: true
      });
    } catch {
      event.__PWM_SANITIZED_FILE_HANDOFF__ = true;
    }
  }

  function createSanitizedDataTransfer(sanitizedFile) {
    if (!sanitizedFile || typeof DataTransfer !== "function" || !canUseSyntheticDataTransferFileList()) {
      return null;
    }

    try {
      const transfer = new DataTransfer();
      if (typeof transfer.items?.add !== "function") return null;
      transfer.items.add(sanitizedFile);
      return Number(transfer.files?.length || 0) > 0 ? transfer : null;
    } catch {
      return null;
    }
  }

  function createSanitizedDataTransferForHandoff(sanitizedFile, details) {
    if (details) {
      details.dataTransferConstructorSucceeded = false;
      details.dataTransferItemsAddSucceeded = false;
    }
    if (!sanitizedFile || typeof DataTransfer !== "function" || !canUseSyntheticDataTransferFileList()) {
      return null;
    }

    try {
      const transfer = new DataTransfer();
      if (details) details.dataTransferConstructorSucceeded = true;
      if (typeof transfer.items?.add !== "function") return null;
      transfer.items.add(sanitizedFile);
      if (details) details.dataTransferItemsAddSucceeded = true;
      return Number(transfer.files?.length || 0) > 0 ? transfer : null;
    } catch (error) {
      if (details) {
        details.errorMessage = error?.message || String(error);
        details.errorStack = error?.stack || "";
      }
      return null;
    }
  }

  function attachEventDataTransfer(event, propertyName, transfer) {
    try {
      Object.defineProperty(event, propertyName, {
        value: transfer,
        configurable: true
      });
      return true;
    } catch {
      try {
        event[propertyName] = transfer;
        return true;
      } catch {
        return false;
      }
    }
  }

  function dispatchSanitizedFileEvent(target, type, transfer) {
    if (!target || !transfer) return false;

    let handoffEvent = null;
    try {
      if (type === "drop" && typeof DragEvent === "function") {
        handoffEvent = new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer
        });
      } else if (type === "paste" && typeof ClipboardEvent === "function") {
        handoffEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer
        });
      }
    } catch {
      handoffEvent = null;
    }

    if (!handoffEvent) {
      handoffEvent = new Event(type, {
        bubbles: true,
        cancelable: true
      });
    }

    markSanitizedFileHandoffEvent(handoffEvent);
    const propertyName = type === "paste" ? "clipboardData" : "dataTransfer";
    attachEventDataTransfer(handoffEvent, propertyName, transfer);

    try {
      target.dispatchEvent(handoffEvent);
      return true;
    } catch {
      return false;
    }
  }

  function handOffOriginalLocalFile(event, dataTransfer, context) {
    if (!event?.defaultPrevented) return false;

    if (context === "file-input" && isFileInputElement(event?.target)) {
      try {
        sanitizedFileInputHandoffs.add(event.target);
        event.target.dispatchEvent(
          new Event("change", {
            bubbles: true,
            cancelable: true
          })
        );
        return true;
      } catch {
        sanitizedFileInputHandoffs.delete(event.target);
        return false;
      }
    }

    const files = listLocalTransferFiles(dataTransfer);
    const transfer = files.length === 1 ? createSanitizedDataTransfer(files[0]) || dataTransfer : dataTransfer;
    const target = event?.target || document.activeElement;
    if (context === "drop") {
      const fileInput = resolveFileInputForHandoff(event, null);
      if (fileInput && handOffSanitizedFileInput(fileInput, transfer, { dispatchInput: true, markSanitized: false })) {
        return true;
      }

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

  function isChatGptHost() {
    return globalThis.PWM.HostMatching.isChatGptHost(location.hostname);
  }

  function isOpenAiChatHost() {
    return globalThis.PWM.HostMatching.isOpenAiChatHost(location.hostname);
  }

  function isGeminiHost() {
    return globalThis.PWM.HostMatching.isGeminiHost(location.hostname);
  }

  function isClaudeHost() {
    return globalThis.PWM.HostMatching.isClaudeHost(location.hostname);
  }

  function isGrokHost() {
    return globalThis.PWM.HostMatching.isGrokHost(location.hostname);
  }

  function isXHost() {
    return globalThis.PWM.HostMatching.isXHost(location.hostname);
  }

  const FILE_HANDOFF_ADAPTERS = globalThis.PWM.SiteAdapters.createFileHandoffAdapters({
    pendingAttachEnabled: FILE_HANDOFF_PENDING_ATTACH_ENABLED,
    hooks: {
      findGeminiUploadMenuButton,
      findGeminiUploadFilesMenuItem,
      findGeminiFileInput,
      isLikelyGeminiUploadClickTarget,
      performPendingGeminiUserAttach,
      findGrokUploadButton,
      discoverGrokPendingFileInput,
      isLikelyGrokUploadClickTarget,
      performPendingGrokUserAttach,
      findGenericAdapterUploadTrigger,
      resolveGenericAdapterFileInput,
      isLikelyGenericUploadClickTarget,
      attachGenericPendingWithTrustedActivation
    }
  });

  function getFileHandoffAdapterById(id) {
    return globalThis.PWM.HostMatching.getFileHandoffAdapterById(FILE_HANDOFF_ADAPTERS, id);
  }

  function hostMatchesFileHandoffAdapter(hostname, adapter) {
    return globalThis.PWM.HostMatching.hostMatchesFileHandoffAdapter(hostname, adapter);
  }

  function getFileHandoffAdapterForLocation(targetLocation = location) {
    return globalThis.PWM.HostMatching.getFileHandoffAdapterForLocation(FILE_HANDOFF_ADAPTERS, targetLocation);
  }

  function isFileHandoffAdapterPendingAttachEnabled(adapter) {
    return globalThis.PWM.HostMatching.isFileHandoffAdapterPendingAttachEnabled(adapter);
  }

  function describeFileHandoffAdapter(adapter) {
    return globalThis.PWM.HostMatching.describeFileHandoffAdapter(adapter);
  }

  function debugFileHandoffAdapterSelected(adapter, reason = "") {
    debugFileAttachMetadata("file-handoff:adapter-selected", {
      reason,
      host: location?.hostname || "",
      adapter: describeFileHandoffAdapter(adapter)
    });
  }

  function getCurrentHandoffDriverId() {
    return globalThis.PWM.HostMatching.getCurrentHandoffDriverId(location.hostname);
  }

  function isProtectedFileDropDriver(id) {
    if (
      id === "gemini" ||
      id === "chatgpt" ||
      id === "claude" ||
      id === "grok" ||
      id === "openai" ||
      id === "x"
    ) {
      return true;
    }
    if (id !== "generic") {
      return false;
    }
    return currentPublicState.currentSite?.protected === true;
  }

  function shouldHandleChatGptLargeTextPaste(pasted, quickAnalysis) {
    return Boolean(
      isChatGptHost() &&
        getLocalTextPayloadByteLength(String(pasted || "")) >= CHATGPT_LARGE_PASTE_FILE_THRESHOLD &&
        ((quickAnalysis?.findings || []).length || quickAnalysis?.placeholderNormalized)
    );
  }

  function createSanitizedChatGptPasteFile(redactedText) {
    if (typeof createSanitizedTextFile !== "function") return null;
    return createSanitizedTextFile(
      {
        name: CHATGPT_SANITIZED_PASTE_FILE_NAME,
        type: "text/plain"
      },
      redactedText
    );
  }

  async function applyChatGptLargePasteTextFallback(input, originalText, selection, redactedText) {
    if (!input || typeof setInputTextDirect !== "function") {
      debugReveal("chatgpt-large-paste:text-fallback-failed", {
        host: location?.hostname || "",
        reason: "missing_input_or_writer"
      });
      return false;
    }

    const next = spliceSelectionText(originalText, selection, String(redactedText || ""));
    debugReveal("chatgpt-large-paste:text-fallback-start", {
      host: location?.hostname || "",
      expectedLength: normalizeComposerText(next.text).length,
      placeholderCount: countDebugPlaceholders(next.text),
      selection: {
        start: Number(selection?.start ?? 0),
        end: Number(selection?.end ?? 0)
      }
    });
    const applied = await applyChatGptSyncedComposerText(input, next.text, {
      context: "large-paste-text-fallback",
      caretOffset: next.caretOffset,
      restoreText: originalText,
      restoreCaretOffset: selection?.end,
      suppressMs: GEMINI_LARGE_TEXT_SUPPRESS_MS
    });

    if (applied.ok) {
      debugReveal("chatgpt-large-paste:text-fallback-success", {
        host: location?.hostname || "",
        expectedLength: normalizeComposerText(next.text).length,
        actualLength: normalizeComposerText(applied.actual).length,
        placeholderCount: countDebugPlaceholders(applied.actual),
        strategy: applied.strategy
      });
      return true;
    }

    debugReveal("chatgpt-large-paste:text-fallback-failed", {
      host: location?.hostname || "",
      expectedLength: normalizeComposerText(next.text).length,
      actualLength: normalizeComposerText(applied.actual).length,
      placeholderCount: countDebugPlaceholders(applied.actual),
      strategy: applied.strategy
    });
    await showRewriteFailure("paste", collectFailureDetails(input, next.text, applied.actual, "paste"));
    refreshBadgeFromCurrentInput();
    return false;
  }

  async function maybeHandleChatGptLargeTextPaste(event, input, pasted, quickAnalysis) {
    if (isChatGptHost() && getLocalTextPayloadByteLength(String(pasted || "")) > LOCAL_TEXT_HARD_BLOCK_BYTES) {
      await blockLargeLocalTextPayload(event, classifyLocalTextPayloadSize({ text: pasted }));
      return true;
    }

    if (!shouldHandleChatGptLargeTextPaste(pasted, quickAnalysis)) {
      return false;
    }

    const originalText = getInputText(input);
    const selection = getSelectionOffsets(input);
    consumeInterceptionEvent(event);
    const sizeInfo = classifyLocalTextPayloadSize({ text: pasted });
    const optimizedStatus = sizeInfo.zone === "optimized";
    if (optimizedStatus) {
      showLocalPayloadOptimizationStatus(sizeInfo);
    }

    try {
      const analysis = analyzeText(pasted);
      const result = analysis.findings.length
        ? await requestRedaction(analysis.normalizedText, analysis.secretFindings)
        : { redactedText: analysis.normalizedText };
      const redactedText = String(result.redactedText || "");
      const sanitizedFile = createSanitizedChatGptPasteFile(redactedText);

      debugReveal("chatgpt-large-paste:sanitized-file-created", {
        redactedLength: redactedText.length,
        findingsCount: analysis.secretFindings.length,
        file: describeFileForDebug(sanitizedFile)
      });

      debugReveal("chatgpt-large-paste:file-handoff-attempt", {
        host: location?.hostname || "",
        redactedLength: redactedText.length,
        placeholderCount: countDebugPlaceholders(redactedText),
        file: describeFileForDebug(sanitizedFile)
      });
      if (sanitizedFile && (await handOffSanitizedLocalFile(event, input, sanitizedFile, "paste"))) {
        debugReveal("chatgpt-large-paste:file-handoff-success", {
          host: location?.hostname || "",
          redactedLength: redactedText.length,
          placeholderCount: countDebugPlaceholders(redactedText),
          file: describeFileForDebug(sanitizedFile)
        });
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "complete");
        }
        setBadge("LeakGuard redacted pasted text before attachment.");
        hideBadgeSoon(4200);
        refreshBadgeFromCurrentInput();
        return true;
      }
      debugReveal("chatgpt-large-paste:file-handoff-failed", {
        host: location?.hostname || "",
        redactedLength: redactedText.length,
        placeholderCount: countDebugPlaceholders(redactedText),
        file: describeFileForDebug(sanitizedFile)
      });

      if (await applyChatGptLargePasteTextFallback(input, originalText, selection, redactedText)) {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "complete");
        }
        setBadge("LeakGuard redacted pasted text before attachment.");
        hideBadgeSoon(4200);
        refreshBadgeFromCurrentInput();
        return true;
      }

      debugReveal("chatgpt-large-paste:fail-closed", {
        redactedLength: redactedText.length,
        file: describeFileForDebug(sanitizedFile)
      });
      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
      }
      setBadge("Raw paste blocked");
      hideBadgeSoon(4200);
      await showMessageModal(
        "Raw paste blocked",
        "LeakGuard blocked raw pasted text because sanitized ChatGPT handoff failed."
      );
      refreshBadgeFromCurrentInput();
      return true;
    } catch (error) {
      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
      }
      throw error;
    }
  }

  function resolveGeminiEditorTarget(target) {
    if (!isGeminiHost()) return null;
    const el = normalizeTarget(target);
    if (!el?.closest) return null;
    const direct =
      el.closest(".ql-editor") ||
      el.closest('[contenteditable="true"]') ||
      el.closest("[contenteditable]:not([contenteditable='false'])") ||
      el.closest("[role='textbox']");
    if (direct) return direct;

    const container = el.closest(
      "rich-textarea, .rich-textarea, .ql-container, .text-input-field, .input-area, .initial-input-area, [data-testid*='composer'], [data-test-id*='composer']"
    );
    return findGeminiEditorCandidateInRoot(container);
  }

  function findGeminiEditorCandidateInRoot(root) {
    if (!isGeminiHost() || !root?.querySelector) return null;
    const selectors = [
      ".ql-editor[contenteditable]:not([contenteditable='false'])",
      "[contenteditable]:not([contenteditable='false'])[role='textbox']",
      "[contenteditable]:not([contenteditable='false'])[aria-label*='prompt' i]",
      "[contenteditable]:not([contenteditable='false'])[aria-label*='message' i]",
      "[contenteditable]:not([contenteditable='false'])[aria-label*='ask' i]",
      "[contenteditable]:not([contenteditable='false'])",
      "textarea[placeholder*='Ask Gemini' i]",
      "textarea[placeholder*='Ask' i]",
      "textarea[aria-label*='prompt' i]",
      "textarea[aria-label*='message' i]",
      "textarea"
    ];
    for (const selector of selectors) {
      try {
        const candidate = root.querySelector(selector);
        if (isEditableElement(candidate)) return candidate;
      } catch {
        // Gemini prompt markup is host-controlled; try the next selector.
      }
    }
    return null;
  }

  function resolveGeminiFallbackEditor(event, input) {
    if (!isGeminiHost()) return null;
    return (
      resolveGeminiEditorTarget(event?.target) ||
      resolveGeminiEditorTarget(input) ||
      resolveGeminiEditorTarget(document.activeElement) ||
      resolveGeminiEditorTarget(findComposer(event?.target)) ||
      resolveGeminiEditorTarget(findComposer(document.activeElement)) ||
      findGeminiEditorCandidateInRoot(document) ||
      document.querySelector?.(".ql-editor[contenteditable]") ||
      document.querySelector?.('[role="textbox"][contenteditable]') ||
      document.querySelector?.('[contenteditable="true"]')
    );
  }

  function isFirefoxDataTransferFileUnavailableSnapshot(dataTransfer) {
    return Boolean(dataTransfer?.firefoxDataTransferFileUnavailable);
  }

  async function blockFirefoxGeminiUnavailableDrop(event) {
    rawFileDropInterceptions.add(event);
    consumeInterceptionEvent(event);
    debugReveal("file-drop:firefox-gemini-file-unavailable", {
      reason: "firefox_gemini_drop_file_unavailable",
      snapshot: describeDataTransferFileSnapshot(event?.dataTransfer, [])
    });
    setBadge("Firefox drag/drop file unavailable");
    hideBadgeSoon(5200);
    await showMessageModal("Raw file blocked", FIREFOX_GEMINI_DROP_FILE_UNAVAILABLE_MESSAGE);
    refreshBadgeFromCurrentInput();
    clearFileDragSession({ keepDmzOverlay: getCurrentHandoffDriver()?.usesDmzOverlay });
    return {
      handled: true,
      ok: false,
      reason: "firefox_gemini_drop_file_unavailable"
    };
  }

  async function redactGeminiEditorText(text) {
    const analysis = analyzeText(String(text || ""));
    const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
    return String(result.redactedText || "");
  }

  function placeGeminiEditorCaretAtEnd(editor) {
    try {
      const selection = window.getSelection?.();
      const range = document.createRange?.();
      if (!selection || !range) return;
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // Caret placement is best-effort after a safe direct text rewrite.
    }
  }

  function setEditorAttribute(el, name, value) {
    try {
      if (typeof el.setAttribute === "function") {
        el.setAttribute(name, value);
        return;
      }
    } catch {
      // Fall through to property assignment for simple DOM/test shims.
    }

    try {
      el[name] = value;
    } catch {
      // Best-effort only; Gemini may use non-standard contenteditable wrappers.
    }
  }

  function captureEditorAttribute(el, name) {
    let hadAttribute = false;
    let attributeValue = null;
    try {
      hadAttribute = typeof el.hasAttribute === "function" ? el.hasAttribute(name) : Object.prototype.hasOwnProperty.call(el, name);
      attributeValue = typeof el.getAttribute === "function" ? el.getAttribute(name) : el[name];
    } catch {
      hadAttribute = false;
      attributeValue = null;
    }

    let propertyValue;
    let hadProperty = false;
    try {
      hadProperty = name in el;
      propertyValue = el[name];
    } catch {
      hadProperty = false;
      propertyValue = undefined;
    }

    return { name, hadAttribute, attributeValue, hadProperty, propertyValue };
  }

  function disableGeminiEditorInputAssist(editor) {
    if (!editor) return null;
    const snapshot = ["spellcheck", "autocorrect", "autocomplete", "autocapitalize"].map((name) =>
      captureEditorAttribute(editor, name)
    );

    setEditorAttribute(editor, "spellcheck", "false");
    setEditorAttribute(editor, "autocorrect", "off");
    setEditorAttribute(editor, "autocomplete", "off");
    setEditorAttribute(editor, "autocapitalize", "off");
    try {
      editor.spellcheck = false;
    } catch {
      // Attribute form above covers normal contenteditable editors.
    }
    return snapshot;
  }

  function restoreGeminiEditorInputAssist(editor, snapshot) {
    if (!editor || !Array.isArray(snapshot)) return;
    for (const entry of snapshot) {
      try {
        if (entry.hadAttribute) {
          if (typeof editor.setAttribute === "function") {
            editor.setAttribute(entry.name, entry.attributeValue);
          } else {
            editor[entry.name] = entry.attributeValue;
          }
        } else if (typeof editor.removeAttribute === "function") {
          editor.removeAttribute(entry.name);
        } else {
          try {
            delete editor[entry.name];
          } catch {
            editor[entry.name] = undefined;
          }
        }

        if (entry.hadProperty) {
          editor[entry.name] = entry.propertyValue;
        }
      } catch {
        // Restore is best-effort and must not turn sanitized insertion into raw pass-through.
      }
    }
  }

  function setGeminiEditorTextDirect(editor, nextText) {
    const normalized = normalizeComposerText(nextText);
    if (!editor) return false;

    const assistSnapshot = disableGeminiEditorInputAssist(editor);
    try {
      if (isContentEditable(editor)) {
        return writePlainTextToContentEditablePreservingNewlines(editor, normalized, {
          caretOffset: normalized.length
        });
      }
      editor.textContent = normalized;
      placeGeminiEditorCaretAtEnd(editor);
      return true;
    } catch {
      return false;
    } finally {
      restoreGeminiEditorInputAssist(editor, assistSnapshot);
    }
  }

  function verifyGeminiFirefoxInsertedText(editor, sanitizedText, rawInsertedText = "") {
    const actual = normalizeComposerText(getInputText(editor));
    if (!actual.trim()) return false;
    if (detectMultilineCollapse(sanitizedText, actual)) return false;

    const placeholders = listExpectedPlaceholders(sanitizedText);
    if (placeholders.length && !placeholders.every((placeholder) => actual.includes(placeholder))) {
      return false;
    }

    const rawText = normalizeComposerText(rawInsertedText);
    if (rawText && actual.includes(rawText)) {
      return false;
    }

    return true;
  }

  function buildGeminiFirefoxMultilineDirectText(editor, sanitizedText, rawInsertedText = "", options = {}) {
    const originalText =
      typeof options.originalText === "string"
        ? normalizeComposerText(options.originalText)
        : normalizeComposerText(getInputText(editor));
    const normalized = normalizeComposerText(sanitizedText);
    const rawText = normalizeComposerText(rawInsertedText);
    const rawIndex = rawText ? originalText.indexOf(rawText) : -1;
    if (rawIndex >= 0) {
      return {
        text:
          originalText.slice(0, rawIndex) +
          normalized +
          originalText.slice(rawIndex + rawText.length),
        caretOffset: rawIndex + normalized.length
      };
    }
    const selection = options.selection || getSelectionOffsets(editor);
    return spliceSelectionText(originalText, selection, normalized);
  }

  function insertGeminiFirefoxMultilineDirectText(editor, sanitizedText, options) {
    options = options || {};
    const normalized = normalizeComposerText(sanitizedText);
    if (!editor || !isFirefoxRuntime() || !isGeminiHost() || !isContentEditable(editor) || !normalized.includes("\n")) {
      return false;
    }

    const next = buildGeminiFirefoxMultilineDirectText(editor, normalized, options.rawInsertedText || "", options);
    suppressFollowupInputScan();
    if (!setGeminiEditorTextDirect(editor, next.text)) {
      debugReveal("gemini-text:firefox-multiline-preserving-retry", {
        insertedLength: normalized.length,
        lineCount: normalized.split("\n").length,
        verified: false,
        written: false
      });
      return false;
    }

    dispatchGeminiEditorInput(editor, "", {
      inputType: "insertReplacementText",
      includeData: false
    });

    const verified = verifyGeminiFirefoxInsertedText(editor, next.text, options.rawInsertedText || "");
    debugReveal("gemini-text:firefox-multiline-preserving-retry", {
      insertedLength: normalized.length,
      lineCount: normalized.split("\n").length,
      finalLength: next.text.length,
      verified,
      written: true
    });
    return verified;
  }

  function insertGeminiFirefoxEditorText(editor, sanitizedText, options) {
    options = options || {};
    const normalized = normalizeComposerText(sanitizedText);
    if (!editor || !isFirefoxRuntime() || !isGeminiHost() || !isContentEditable(editor) || !normalized.includes("\n")) {
      return false;
    }

    const assistSnapshot = disableGeminiEditorInputAssist(editor);
    try {
      const originalTextBeforeInsert = normalizeComposerText(getInputText(editor));
      const selectionBeforeInsert = getSelectionOffsets(editor);
      suppressFollowupInputScan();
      editor.focus();
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        if (!selection || !range) {
          return insertGeminiFirefoxMultilineDirectText(editor, normalized, {
            ...options,
            originalText: originalTextBeforeInsert,
            selection: selectionBeforeInsert
          });
        }
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch {
        return insertGeminiFirefoxMultilineDirectText(editor, normalized, {
          ...options,
          originalText: originalTextBeforeInsert,
          selection: selectionBeforeInsert
        });
      }
      const inserted = Boolean(document.execCommand?.("insertText", false, normalized));
      if (!inserted) {
        debugReveal("gemini-text:firefox-insert-text-unavailable", {
          insertedLength: normalized.length,
          lineCount: normalized.split("\n").length
        });
        return insertGeminiFirefoxMultilineDirectText(editor, normalized, {
          ...options,
          originalText: originalTextBeforeInsert,
          selection: selectionBeforeInsert
        });
      }

      dispatchGeminiEditorInput(editor, normalized, {
        inputType: "insertFromPaste"
      });

      const verified = verifyGeminiFirefoxInsertedText(editor, normalized, options.rawInsertedText || "");
      debugReveal("gemini-text:firefox-insert-text", {
        insertedLength: normalized.length,
        lineCount: normalized.split("\n").length,
        verified
      });

      return verified || insertGeminiFirefoxMultilineDirectText(editor, normalized, {
        ...options,
        originalText: originalTextBeforeInsert,
        selection: selectionBeforeInsert
      });
    } catch (error) {
      debugReveal("gemini-text:firefox-insert-text-failed", {
        message: error?.message || String(error || ""),
        insertedLength: normalized.length,
        lineCount: normalized.split("\n").length
      });
      return false;
    } finally {
      restoreGeminiEditorInputAssist(editor, assistSnapshot);
    }
  }

  function insertLargeGeminiEditorText(editor, sanitizedText, options) {
    options = options || {};
    const text = String(sanitizedText || "");
    if (!editor || typeof editor.focus !== "function") return false;

    const originalText = getInputText(editor);
    const selection = getSelectionOffsets(editor);
    const next = spliceSelectionText(originalText, selection, text);

    suppressFollowupInputScan(GEMINI_LARGE_TEXT_SUPPRESS_MS);
    editor.focus();
    if (insertGeminiFirefoxEditorText(editor, text, options)) return true;
    if (!setGeminiEditorTextDirect(editor, next.text)) return false;
    // Gemini/Quill observes the DOM mutation; this event only announces that sanitized content changed.
    dispatchGeminiEditorInput(editor, "", {
      inputType: "insertReplacementText",
      includeData: false
    });
    debugReveal("gemini-text:direct-large-insert", {
      originalLength: originalText.length,
      insertedLength: text.length,
      finalLength: next.text.length
    });
    return true;
  }

  function insertGeminiEditorText(editor, sanitizedText, options) {
    options = options || {};
    const text = String(sanitizedText || "");
    if (!editor || typeof editor.focus !== "function") return false;

    if (insertGeminiFirefoxEditorText(editor, text, options)) {
      return true;
    }

    if (isFirefoxRuntime() && isGeminiHost() && isContentEditable(editor) && text.includes("\n")) {
      return false;
    }

    if (text.length >= GEMINI_DIRECT_TEXT_INSERT_THRESHOLD) {
      return insertLargeGeminiEditorText(editor, text, options);
    }

    try {
      suppressFollowupInputScan();
      editor.focus();
      if (document.execCommand?.("insertText", false, text)) {
        dispatchGeminiEditorInput(editor, text);
        return true;
      }
    } catch {
      // Fall through to the verified rewrite path for contenteditable editors.
    }

    return false;
  }

  function dispatchGeminiEditorInput(editor, sanitizedText, options) {
    const eventOptions = options || {};
    const includeData = eventOptions.includeData !== false;
    try {
      editor.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: false,
          inputType: eventOptions.inputType || "insertText",
          data: includeData ? String(sanitizedText || "") : null
        })
      );
      return;
    } catch {
      // Older browser/event shims may not expose constructible InputEvent.
    }

    try {
      editor.dispatchEvent(
        new Event("input", {
          bubbles: true,
          cancelable: false
        })
      );
    } catch {
      // Event notification is best-effort after the sanitized text is inserted.
    }
  }

  async function applyGeminiEditorText(editor, sanitizedText, context, options) {
    const applyOptions = options || {};
    const rawInsertedText =
      typeof applyOptions.rawInsertedText === "string"
        ? normalizeComposerText(applyOptions.rawInsertedText)
        : "";
    if (
      !applyOptions.skipLargeConfirmation &&
      !(await confirmGeminiLargeSanitizedTextInsertion(sanitizedText, context))
    ) {
      setBadge("Sanitized text insertion cancelled");
      hideBadgeSoon(3200);
      refreshBadgeFromCurrentInput();
      return "cancelled";
    }

    if (rawInsertedText && getInputText(editor).includes(rawInsertedText)) {
      const currentText = getInputText(editor);
      const rawIndex = currentText.indexOf(rawInsertedText);
      const desiredText =
        rawIndex >= 0
          ? `${currentText.slice(0, rawIndex)}${normalizeComposerText(sanitizedText)}${currentText.slice(rawIndex + rawInsertedText.length)}`
          : normalizeComposerText(sanitizedText);
      const applied = await rewriteComposerTransactionally(
        editor,
        rawInsertedText,
        desiredText,
        context,
        { caretOffset: rawIndex >= 0 ? rawIndex + normalizeComposerText(sanitizedText).length : undefined }
      );

      if (applied.ok) {
        setBadge("Content redacted");
        hideBadgeSoon();
        refreshBadgeFromCurrentInput();
        return true;
      }
    }

    if (insertGeminiEditorText(editor, sanitizedText, { rawInsertedText })) {
      if (rawInsertedText && getInputText(editor).includes(rawInsertedText)) {
        const applied = await rewriteComposerTransactionally(
          editor,
          rawInsertedText,
          normalizeComposerText(sanitizedText),
          context,
          { caretOffset: normalizeComposerText(sanitizedText).length }
        );
        if (!applied.ok) {
          return false;
        }
      }
      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return true;
    }

    const originalText = getInputText(editor);
    const selection = getSelectionOffsets(editor);
    const inserted = await applyPasteDecision(
      editor,
      originalText,
      selection,
      String(sanitizedText || ""),
      context,
      { rawInsertedText }
    );

    if (inserted) {
      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
    }

    return inserted;
  }

  async function confirmGeminiLargeSanitizedTextInsertion(sanitizedText, context) {
    const redactedLength = String(sanitizedText || "").length;
    if (redactedLength <= GEMINI_AUTO_INSERT_TEXT_LIMIT) return true;

    debugReveal("gemini-text:large-confirmation-required", {
      context,
      redactedLength,
      limit: GEMINI_AUTO_INSERT_TEXT_LIMIT
    });

    const decision = await showGeminiLargeTextConfirmationModal(redactedLength);
    if (decision?.action === "insert") {
      debugReveal("gemini-text:large-confirmation-accepted", {
        context,
        redactedLength
      });
      return true;
    }

    debugReveal("gemini-text:large-confirmation-cancelled", {
      context,
      redactedLength
    });
    return false;
  }

  async function blockGeminiEditorRawContent(event, title, message) {
    consumeInterceptionEvent(event);
    setBadge(title);
    hideBadgeSoon(4200);
    await showMessageModal(title, message);
    refreshBadgeFromCurrentInput();
    return true;
  }

  async function maybeHandleGeminiEditorPaste(event) {
    const editor = resolveGeminiEditorTarget(event?.target);
    if (!editor) return false;
    noteActiveRiskEditor(editor);

    const pasted = event.clipboardData?.getData("text/plain") || "";
    if (!pasted) return false;

    consumeInterceptionEvent(event);
    const sizeInfo = classifyLocalTextPayloadSize({ text: pasted });
    if (sizeInfo.zone === "blocked") {
      await blockLargeLocalTextPayload(event, sizeInfo);
      return true;
    }

    const optimizedStatus = sizeInfo.zone === "optimized";
    if (optimizedStatus) {
      showLocalPayloadOptimizationStatus(sizeInfo);
    }

    try {
      const analysis = await analyzeTextWithAiAssist(pasted);
      let textToInsert = analysis.normalizedText;

      if (analysis.findings.length) {
        const policy = await getPolicyForAction();
        const destinationPolicy = await handleDestinationPolicy(analysis.findings, policy);
        if (destinationPolicy.blocked) {
          if (optimizedStatus) {
            clearLocalPayloadOptimizationStatus(sizeInfo, "cancelled");
          }
          return true;
        }

        const destinationForceRedact = shouldForceDestinationRedaction(
          destinationPolicy,
          analysis.findings
        );
        const httpPolicyHandled = await handleHttpSecretPolicy(
          policy,
          analysis.secretFindings,
          async () => {
            const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
            textToInsert = result.redactedText;
          }
        );

        if (!httpPolicyHandled && destinationForceRedact) {
          const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
            auditReason: destinationPolicy.reason
          });
          textToInsert = result.redactedText;
        } else if (!httpPolicyHandled && !isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
          const decisionAction = await promptForSensitiveContentDecision(
            analysis.findings,
            "paste",
            policy,
            editor,
            analysis.normalizedText
          );

          if (decisionAction === "cancel") {
            if (optimizedStatus) {
              clearLocalPayloadOptimizationStatus(sizeInfo, "cancelled");
            }
            refreshBadgeFromCurrentInput();
            return true;
          }

          const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
          textToInsert = result.redactedText;
        } else if (!httpPolicyHandled) {
          setBadge("Protection paused");
          hideBadgeSoon();
          }
      }

      const applied = await applyGeminiEditorText(editor, textToInsert, "gemini-paste", {
        rawInsertedText: pasted
      });
      if (applied === true || applied === "cancelled") {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, applied === true ? "complete" : "cancelled");
        }
        return true;
      }
    } catch (error) {
      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
      }
      handleContentError(error);
    }

    if (optimizedStatus) {
      clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
    }
    setBadge("Raw paste blocked");
    hideBadgeSoon(4200);
    await showMessageModal(
      "Raw paste blocked",
      "LeakGuard blocked raw pasted content because sanitized insertion failed."
    );
    refreshBadgeFromCurrentInput();
    return true;
  }

  function listGeminiDropFiles(dataTransfer) {
    return Array.from(dataTransfer?.files || []).filter(Boolean);
  }

  function isSupportedGeminiTextFile(file) {
    return classifyLocalFile(file).action === "scan";
  }

  async function readGeminiTextFile(file) {
    if (!isSupportedGeminiTextFile(file) || typeof file?.text !== "function") {
      return {
        ok: false,
        message: LOCAL_FILE_UNSUPPORTED_WARNING
      };
    }

    if (Number(file?.size || 0) > LARGE_TEXT_STREAMING_MAX_BYTES) {
      return {
        ok: false,
        code: "file_too_large",
        message: STREAMING_BLOCK_MESSAGE
      };
    }

    if (Number(file?.size || 0) > LOCAL_TEXT_HARD_BLOCK_BYTES) {
      return {
        ok: false,
        code: "streaming_required",
        sourceFile: file,
        file: {
          name: file?.name || "",
          type: file?.type || "text/plain",
          sizeBytes: Number(file?.size || 0)
        },
        message: LOCAL_FILE_STREAMING_REQUIRED_MESSAGE
      };
    }

    try {
      return {
        ok: true,
        text: await file.text()
      };
    } catch {
      return {
        ok: false,
        message: "LeakGuard could not read this local file, so nothing was attached."
      };
    }
  }

  async function maybeHandleGeminiEditorDrop(event) {
    const editor = resolveGeminiFallbackEditor(event, null);
    if (!editor || typeof readLocalTextFileFromDataTransfer !== "function") {
      return false;
    }

    const files = listLocalTransferFiles(event?.dataTransfer);
    if (files.length !== 1) {
      return false;
    }

    const fileSize = Number(files[0]?.size || 0);
    if (fileSize > GEMINI_AUTO_INSERT_TEXT_LIMIT) {
      return false;
    }

    noteActiveRiskEditor(editor);
    const localFile = await readLocalTextFileFromDataTransfer(event.dataTransfer);
    if (!localFile.handled) {
      setBadge("Raw file blocked");
      hideBadgeSoon(4200);
      await showMessageModal(
        "Raw file blocked",
        localFile.message || "LeakGuard blocked raw file upload because local scanning failed."
      );
      refreshBadgeFromCurrentInput();
      return true;
    }

    if (!localFile.ok) {
      return false;
    }

    if (getLocalTextPayloadByteLength(localFile.text, localFile.file?.sizeBytes) > GEMINI_AUTO_INSERT_TEXT_LIMIT) {
      return false;
    }

    try {
      const analysis = analyzeText(localFile.text);
      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      const applied = await applyGeminiEditorText(editor, result.redactedText, "gemini-file-drop", {
        skipLargeConfirmation: true
      });
      if (applied === true) {
        setBadge("Sanitized file text inserted.");
        hideBadgeSoon(3200);
        refreshBadgeFromCurrentInput();
        return true;
      }
    } catch (error) {
      handleContentError(error);
    }

    setBadge("Raw file upload blocked");
    hideBadgeSoon(4200);
    await showMessageModal(
      "Raw file upload blocked",
      "LeakGuard blocked raw file upload because sanitized Gemini drop insertion failed."
    );
    refreshBadgeFromCurrentInput();
    return true;
  }

  function isFileInputElement(el) {
    return (
      !!el &&
      el.tagName === "INPUT" &&
      String(el.type || "").toLowerCase() === "file"
    );
  }

  function describeFileForDebug(file) {
    return globalThis.PWM.SafeSnapshots.describeFileForDebug(file);
  }

  function describeFileInputForDebug(fileInput, source = "") {
    if (!isFileInputElement(fileInput)) return null;
    return {
      tag: fileInput.tagName || "",
      source,
      disabled: Boolean(fileInput.disabled),
      hidden: Boolean(fileInput.hidden),
      className: typeof fileInput.className === "string" ? fileInput.className : fileInput.getAttribute?.("class") || "",
      accept: fileInput.accept || "",
      multiple: Boolean(fileInput.multiple),
      filesLength: Number(fileInput.files?.length || 0)
    };
  }

  function getSafeTextSnippet(el) {
    if (!el) return "";
    let text = "";
    try {
      text = String(el.innerText || el.textContent || "");
    } catch {
      text = "";
    }
    return text.replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function describeElementForDebug(el, source = "") {
    if (!el) return null;
    let className = "";
    try {
      className =
        typeof el.className === "string"
          ? el.className
          : el.getAttribute?.("class") || "";
    } catch {
      className = "";
    }
    return {
      tag: el.tagName || "",
      role: el.getAttribute?.("role") || el.role || "",
      ariaLabel: el.getAttribute?.("aria-label") || el.ariaLabel || "",
      title: el.getAttribute?.("title") || el.title || "",
      className,
      textSnippet: getSafeTextSnippet(el),
      source
    };
  }

  function originalFileMetadataFromEvent(event) {
    try {
      return describeFileForDebug(event?.dataTransfer?.files?.[0]);
    } catch {
      return null;
    }
  }

  function originalFileMetadataFromLocalFile(localFile) {
    return globalThis.PWM.FileAttachPipeline.originalFileMetadataFromLocalFile(localFile);
  }

  function createSanitizedPayload(sanitizedFile, redactedText, localFile, analysis, result) {
    return globalThis.PWM.FileAttachPipeline.createSanitizedPayload(
      sanitizedFile,
      redactedText,
      localFile,
      analysis,
      result
    );
  }

  function createGeminiSanitizedPayload(sanitizedFile, redactedText, localFile, analysis, result) {
    return createSanitizedPayload(sanitizedFile, redactedText, localFile, analysis, result);
  }

  function fallbackLanguageFromFileName(fileName) {
    const ext = String(fileName || "").split(".").pop().toLowerCase();
    if (!ext || ext === String(fileName || "").toLowerCase()) return "";
    if (ext === "js" || ext === "mjs" || ext === "cjs") return "javascript";
    if (ext === "ts" || ext === "tsx") return "typescript";
    if (ext === "py") return "python";
    if (ext === "rb") return "ruby";
    if (ext === "sh" || ext === "bash" || ext === "zsh") return "bash";
    if (ext === "yml") return "yaml";
    if (ext === "md") return "markdown";
    if (/^(?:csv|css|env|html|java|json|php|sql|toml|txt|xml|yaml)$/.test(ext)) return ext;
    return "";
  }

  function geminiFallbackLanguageFromFileName(fileName) {
    return fallbackLanguageFromFileName(fileName);
  }

  function formatSanitizedFileFallbackText(payload) {
    const fileName = payload?.originalFile?.name || payload?.sanitizedFile?.name || "sanitized-file.txt";
    const language = fallbackLanguageFromFileName(fileName);
    return `LeakGuard sanitized file: ${fileName}\n\n\`\`\`${language}\n${String(
      payload?.redactedText || ""
    )}\n\`\`\``;
  }

  function formatGeminiSanitizedFileFallbackText(payload) {
    return formatSanitizedFileFallbackText(payload);
  }

  async function insertGeminiSanitizedText(payload, event, input) {
    if (!isGeminiHost()) return false;
    if (!String(payload?.redactedText || "").trim()) {
      debugReveal("file-handoff:gemini-empty-text-fallback-blocked", {
        reason: "empty_sanitized_text"
      });
      return false;
    }
    const inserted = await applyGeminiSanitizedTextFallback(
      event,
      input,
      formatSanitizedFileFallbackText(payload),
      { rawInsertedText: payload.rawText || "" }
    );
    if (inserted === true) {
      setGeminiDmzOverlayState("Inserted sanitized content", "inserted");
    }
    return inserted;
  }

  async function tryGeminiSanitizedFileAttach(payload, event, input) {
    if (!isGeminiHost() || !payload?.sanitizedFile) return false;
    if (shouldUseFirefoxTextFallbackForFileHandoff()) return false;
    return handOffGeminiSanitizedFileUpload(event, input, payload.sanitizedFile, {
      allowUploadUiClick: !isFirefoxRuntime() || event?.type === "drop"
    });
  }

  function createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput = null) {
    const sanitizedFiles = listFirefoxGeminiBridgeSanitizedFiles(payload);
    return {
      mode: "file-input-bridge",
      browser: "firefox",
      host: location.hostname || "",
      eventType: context?.event?.type || "",
      rawFileCount: listLocalTransferFiles(context?.event?.dataTransfer).length,
      sanitizedFileCount: sanitizedFiles.length,
      inputFound: Boolean(fileInput),
      input: describeFileInputForDebug(fileInput, "gemini-firefox-file-input-bridge"),
      sanitizedFiles: sanitizedFiles.map(describeFileForDebug)
    };
  }

  function listFirefoxGeminiBridgeSanitizedFiles(payload) {
    const files = Array.isArray(payload?.sanitizedFiles)
      ? payload.sanitizedFiles
      : payload?.sanitizedFile
        ? [payload.sanitizedFile]
        : [];
    return files.filter(Boolean);
  }

  function createFirefoxGeminiBridgeDataTransfer(sanitizedFiles, details) {
    if (details) {
      details.dataTransferConstructorSucceeded = false;
      details.dataTransferItemsAddSucceeded = false;
    }
    if (!sanitizedFiles.length || typeof DataTransfer !== "function" || !canUseSyntheticDataTransferFileList()) {
      return null;
    }

    try {
      const transfer = new DataTransfer();
      if (details) details.dataTransferConstructorSucceeded = true;
      if (typeof transfer.items?.add !== "function") return null;
      for (const sanitizedFile of sanitizedFiles) {
        transfer.items.add(sanitizedFile);
      }
      if (details) details.dataTransferItemsAddSucceeded = true;
      return Number(transfer.files?.length || 0) === sanitizedFiles.length ? transfer : null;
    } catch (error) {
      if (details) {
        details.errorMessage = error?.message || String(error);
        details.errorStack = error?.stack || "";
      }
      return null;
    }
  }

  function findGeminiFileInput(event = null, input = null) {
    if (!isGeminiHost()) {
      return { discovery: {}, fileInput: null };
    }
    const discovery = discoverGeminiFileHandoffElements(event || { target: document.body }, input);
    return { discovery, fileInput: discovery.fileInput || null };
  }

  function isGeminiUploadMenuButtonVisible(candidate) {
    if (!candidate || candidate.disabled || candidate.hidden) return false;
    try {
      if (candidate.getAttribute?.("aria-hidden") === "true") return false;
    } catch {
      // Attribute reads are best-effort on host-controlled nodes.
    }
    try {
      const style = candidate.ownerDocument?.defaultView?.getComputedStyle?.(candidate);
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    } catch {
      // Synthetic DOMs may not expose computed styles.
    }
    return true;
  }

  function isUnsafeGeminiUploadMenuButton(candidate) {
    const meta = describeElementForDebug(candidate);
    const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""} ${meta?.className || ""}`.toLowerCase();
    return /\b(?:send|submit|mic|microphone|voice|record|settings|model|close|remove)\b/.test(haystack);
  }

  function hasGeminiUploadMenuIntent(meta) {
    const label = String(meta?.ariaLabel || "").trim();
    if (label === "Open upload file menu") return true;
    if (/^upload\s*(?:&|and)\s*tools$/i.test(label)) return true;
    const haystack = `${label} ${meta?.title || ""} ${meta?.textSnippet || ""}`.toLowerCase();
    return /\b(?:upload|attach)\b/.test(haystack) && /\b(?:file|files|menu)\b/.test(haystack);
  }

  function isGeminiSourceUploadIcon(candidate, meta = null) {
    if (!candidate || String(candidate.tagName || "").toUpperCase() !== "MAT-ICON") return false;
    const details = meta || describeElementForDebug(candidate);
    const className = details?.className || "";
    const text = (details?.textSnippet || "").trim().toLowerCase();
    return /\bupload-icon\b/.test(className) && (text === "add_2" || text === "add");
  }

  function isSafeGeminiUploadMenuButton(candidate) {
    if (!candidate) return false;
    if (isFileInputElement(candidate)) return false;
    if (!isGeminiUploadMenuButtonVisible(candidate) || isUnsafeGeminiUploadMenuButton(candidate)) return false;
    const meta = describeElementForDebug(candidate);
    const label = meta?.ariaLabel || "";
    const className = meta?.className || "";
    if (/\bhidden-local-(?:file-)?upload-button\b/.test(className)) return false;
    if (label === "Open upload file menu" || /^upload\s*(?:&|and)\s*tools$/i.test(label)) return true;
    if (/\bupload-card-button\b/.test(className) && hasGeminiUploadMenuIntent(meta)) return true;
    return isGeminiSourceUploadIcon(candidate, meta);
  }

  function collectGeminiUploadMenuButtonsFromRoot(root, candidates, seen, visitedRoots) {
    if (!root || visitedRoots.has(root)) return;
    visitedRoots.add(root);

    const selectors = [
      'button[aria-label="Open upload file menu"]',
      "button.upload-card-button",
      "mat-icon.upload-icon",
      "button"
    ];
    for (const selector of selectors) {
      try {
        root.querySelectorAll?.(selector).forEach((candidate) => {
          if (!candidate || seen.has(candidate)) return;
          seen.add(candidate);
          candidates.push(candidate);
        });
      } catch {
        // Selector support varies across synthetic and host-controlled roots.
      }
    }

    let elements = [];
    try {
      elements = Array.from(root.querySelectorAll?.("*") || []);
    } catch {
      elements = [];
    }
    elements.forEach((element) => {
      if (element?.shadowRoot) {
        collectGeminiUploadMenuButtonsFromRoot(element.shadowRoot, candidates, seen, visitedRoots);
      }
    });
  }

  function findGeminiUploadMenuButton() {
    if (!isGeminiHost()) return null;
    const candidates = [];
    collectGeminiUploadMenuButtonsFromRoot(document, candidates, new WeakSet(), new WeakSet());
    return (
      candidates.find((candidate) => {
        const label = candidate.getAttribute?.("aria-label") || candidate.ariaLabel || "";
        return label === "Open upload file menu" && isSafeGeminiUploadMenuButton(candidate);
      }) ||
      candidates.find((candidate) => {
        const label = candidate.getAttribute?.("aria-label") || candidate.ariaLabel || "";
        return /^upload\s*(?:&|and)\s*tools$/i.test(label) && isSafeGeminiUploadMenuButton(candidate);
      }) ||
      candidates.find((candidate) => {
        const className = String(candidate.className || candidate.getAttribute?.("class") || "");
        return /\bupload-card-button\b/.test(className) && isSafeGeminiUploadMenuButton(candidate);
      }) ||
      candidates.find((candidate) => isGeminiSourceUploadIcon(candidate) && isSafeGeminiUploadMenuButton(candidate)) ||
      null
    );
  }

  function describeGeminiUploadMenuDiscovery() {
    const candidates = [];
    collectGeminiUploadMenuButtonsFromRoot(document, candidates, new WeakSet(), new WeakSet());
    const selected = findGeminiUploadMenuButton();
    return {
      candidateCount: candidates.length,
      selected: describeElementForDebug(selected, "selected-gemini-upload-menu-button"),
      candidates: candidates.slice(0, 20).map((candidate) => ({
        ...describeElementForDebug(candidate, "gemini-upload-menu-candidate"),
        safeUploadMenuButton: isSafeGeminiUploadMenuButton(candidate),
        sourceUploadIcon: isGeminiSourceUploadIcon(candidate)
      }))
    };
  }

  function createGeminiUploadMenuEvent(type) {
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true
    };
    try {
      if (type === "pointerdown" && typeof PointerEvent === "function") {
        return new PointerEvent(type, init);
      }
      if (typeof MouseEvent === "function") {
        return new MouseEvent(type, init);
      }
    } catch {
      // Fall back to Event below.
    }
    return new Event(type, init);
  }

  function isGeminiFileDataInputElement(candidate) {
    if (!isFileInputElement(candidate)) return false;
    const name = candidate.getAttribute?.("name") || candidate.name || "";
    return name === "Filedata" || candidate.multiple === true || candidate.hasAttribute?.("multiple");
  }

  function findGeminiFileDataInputFromEvent(event) {
    const candidates = [];
    try {
      if (typeof event?.composedPath === "function") {
        candidates.push(...event.composedPath());
      }
    } catch {
      // Host event paths are best-effort.
    }
    candidates.push(event?.target);
    return candidates.find(isGeminiFileDataInputElement) || null;
  }

  function findGeminiFileDataInputInNode(node) {
    if (isGeminiFileDataInputElement(node)) return node;
    const roots = [];
    if (node?.querySelector || node?.querySelectorAll) roots.push(node);
    if (node?.shadowRoot) roots.push(node.shadowRoot);
    for (const root of roots) {
      try {
        const exact = root.querySelector?.('input[type="file"][name="Filedata"]');
        if (isGeminiFileDataInputElement(exact)) return exact;
      } catch {
        // Keep scanning best-effort.
      }
      try {
        const multiple = root.querySelector?.('input[type="file"][multiple]');
        if (isGeminiFileDataInputElement(multiple)) return multiple;
      } catch {
        // Keep scanning best-effort.
      }
      try {
        const inputs = Array.from(root.querySelectorAll?.('input[type="file"]') || []);
        const match = inputs.find(isGeminiFileDataInputElement);
        if (match) return match;
      } catch {
        // Keep scanning best-effort.
      }
    }
    return null;
  }

  function findGeminiFileDataInputInMutations(mutations) {
    for (const mutation of Array.from(mutations || [])) {
      for (const node of Array.from(mutation?.addedNodes || [])) {
        const input = findGeminiFileDataInputInNode(node);
        if (input) return input;
      }
      const input = findGeminiFileDataInputInNode(mutation?.target);
      if (input) return input;
    }
    return null;
  }

  function createGeminiFirefoxFilePickerGuard() {
    let capturedInput = null;
    const registrations = [];
    const waiters = new Set();
    const resolveWaiters = () => {
      for (const resolve of Array.from(waiters)) {
        waiters.delete(resolve);
        resolve(capturedInput);
      }
    };
    const handler = (event) => {
      const target = findGeminiFileDataInputFromEvent(event);
      if (!target) return;
      capturedInput = target;
      try {
        event.preventDefault?.();
      } catch {
        // Host event objects can be partial; continue blocking with remaining hooks.
      }
      try {
        event.stopPropagation?.();
      } catch {
        // Best-effort event suppression.
      }
      try {
        event.stopImmediatePropagation?.();
      } catch {
        // Best-effort event suppression.
      }
      debugReveal("file-handoff:gemini-firefox-file-picker-guard-captured", {
        mode: "file-input-bridge",
        browser: "firefox",
        host: location.hostname || "",
        input: describeFileInputForDebug(capturedInput, "gemini-firefox-file-picker-guard")
      });
      resolveWaiters();
    };

    const add = (target, type) => {
      try {
        target?.addEventListener?.(type, handler, { capture: true, passive: false });
        registrations.push({ target, type });
      } catch {
        // Keep the bridge fail-closed if a host target rejects listener registration.
      }
    };

    for (const type of ["pointerdown", "mousedown", "click"]) {
      add(window, type);
      add(document, type);
    }

    return {
      getInput() {
        return capturedInput;
      },
      waitForInput(timeoutMs = 2500) {
        if (capturedInput) return Promise.resolve(capturedInput);
        return new Promise((resolve) => {
          let timeoutId = 0;
          const finish = (input = null) => {
            if (timeoutId) clearTimeout(timeoutId);
            waiters.delete(finish);
            resolve(input || capturedInput || null);
          };
          waiters.add(finish);
          timeoutId = setTimeout(() => finish(null), timeoutMs);
        });
      },
      cleanup() {
        for (const resolve of Array.from(waiters)) {
          waiters.delete(resolve);
          resolve(capturedInput);
        }
        while (registrations.length) {
          const { target, type } = registrations.pop();
          try {
            target?.removeEventListener?.(type, handler, { capture: true, passive: false });
          } catch {
            // Best-effort cleanup only.
          }
        }
      }
    };
  }

  function openGeminiUploadMenuSafely(menuButton) {
    if (!isSafeGeminiUploadMenuButton(menuButton) || isFileInputElement(menuButton)) return false;
    try {
      for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
        menuButton.dispatchEvent(createGeminiUploadMenuEvent(type));
      }
      return true;
    } catch {
      return false;
    }
  }

  function isSafeGeminiUploadFilesMenuItem(candidate) {
    if (!candidate || String(candidate.tagName || "").toUpperCase() !== "BUTTON") return false;
    if (candidate.disabled || isFileInputElement(candidate)) return false;
    const meta = describeElementForDebug(candidate);
    const role = meta?.role || candidate.getAttribute?.("role") || "";
    const label = meta?.ariaLabel || "";
    const text = meta?.textSnippet || "";
    const testId = candidate.getAttribute?.("data-test-id") || candidate.dataset?.testId || "";
    if (testId === "local-images-files-uploader-button") return true;
    return role === "menuitem" && (/upload files/i.test(label) || /^upload files$/i.test(text));
  }

  function collectGeminiUploadFilesMenuItemsFromRoot(root, candidates, seen, visitedRoots) {
    if (!root || visitedRoots.has(root)) return;
    visitedRoots.add(root);

    const selectors = [
      'button[data-test-id="local-images-files-uploader-button"]',
      'button[role="menuitem"][aria-label*="Upload files"]',
      '[role="menuitem"]',
      "button"
    ];
    for (const selector of selectors) {
      try {
        root.querySelectorAll?.(selector).forEach((candidate) => {
          if (!candidate || seen.has(candidate)) return;
          seen.add(candidate);
          candidates.push(candidate);
        });
      } catch {
        // Selector support varies across synthetic and host-controlled roots.
      }
    }

    let elements = [];
    try {
      elements = Array.from(root.querySelectorAll?.("*") || []);
    } catch {
      elements = [];
    }
    elements.forEach((element) => {
      if (element?.shadowRoot) {
        collectGeminiUploadFilesMenuItemsFromRoot(element.shadowRoot, candidates, seen, visitedRoots);
      }
    });
  }

  function findGeminiUploadFilesMenuItem() {
    if (!isGeminiHost()) return null;
    const candidates = [];
    collectGeminiUploadFilesMenuItemsFromRoot(document, candidates, new WeakSet(), new WeakSet());
    const overlayItem = discoverGeminiUploadOverlayItem();
    return (
      candidates.find((candidate) => {
        const testId = candidate.getAttribute?.("data-test-id") || candidate.dataset?.testId || "";
        return testId === "local-images-files-uploader-button" && isSafeGeminiUploadFilesMenuItem(candidate);
      }) ||
      candidates.find((candidate) => isSafeGeminiUploadFilesMenuItem(candidate)) ||
      (isSafeGeminiUploadFilesMenuItem(overlayItem) ? overlayItem : null) ||
      null
    );
  }

  function openGeminiUploadFilesMenuItemSafely(menuItem) {
    if (!isSafeGeminiUploadFilesMenuItem(menuItem) || isFileInputElement(menuItem)) return false;
    try {
      for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
        menuItem.dispatchEvent(createGeminiUploadMenuEvent(type));
      }
      return true;
    } catch {
      return false;
    }
  }

  function isGeminiHiddenFileSelectorTrigger(candidate) {
    if (!candidate || String(candidate.tagName || "").toUpperCase() !== "BUTTON") return false;
    if (candidate.disabled || isFileInputElement(candidate)) return false;
    const className = String(candidate.className || candidate.getAttribute?.("class") || "");
    return /\bhidden-local-file-image-selector-button\b/.test(className);
  }

  function collectGeminiHiddenFileSelectorTriggersFromRoot(root, candidates, seen, visitedRoots) {
    if (!root || visitedRoots.has(root)) return;
    visitedRoots.add(root);

    const selectors = [
      "button.hidden-local-file-image-selector-button[xapfileselectortrigger]",
      ".hidden-local-file-image-selector-button[xapfileselectortrigger]",
      "button.hidden-local-file-image-selector-button",
      ".hidden-local-file-image-selector-button"
    ];
    for (const selector of selectors) {
      try {
        root.querySelectorAll?.(selector).forEach((candidate) => {
          if (!candidate || seen.has(candidate) || !isGeminiHiddenFileSelectorTrigger(candidate)) return;
          seen.add(candidate);
          candidates.push(candidate);
        });
      } catch {
        // Selector support varies across synthetic and host-controlled roots.
      }
    }

    let elements = [];
    try {
      elements = Array.from(root.querySelectorAll?.("*") || []);
    } catch {
      elements = [];
    }
    elements.forEach((element) => {
      if (element?.shadowRoot) {
        collectGeminiHiddenFileSelectorTriggersFromRoot(element.shadowRoot, candidates, seen, visitedRoots);
      }
    });
  }

  function findGeminiHiddenFileSelectorTrigger() {
    if (!isGeminiHost()) return null;
    const candidates = [];
    collectGeminiHiddenFileSelectorTriggersFromRoot(document, candidates, new WeakSet(), new WeakSet());
    return candidates.find(isGeminiHiddenFileSelectorTrigger) || null;
  }

  function findGeminiHiddenFileSelectorTriggerInNode(node) {
    if (!isGeminiHost() || !node || typeof node !== "object") return null;
    const candidate = normalizeTarget(node);
    if (isGeminiHiddenFileSelectorTrigger(candidate)) return candidate;

    const candidates = [];
    const seen = new WeakSet();
    const visitedRoots = new WeakSet();
    collectGeminiHiddenFileSelectorTriggersFromRoot(node, candidates, seen, visitedRoots);
    if (node.shadowRoot) {
      collectGeminiHiddenFileSelectorTriggersFromRoot(node.shadowRoot, candidates, seen, visitedRoots);
    }
    return candidates.find(isGeminiHiddenFileSelectorTrigger) || null;
  }

  function findGeminiHiddenFileSelectorTriggerInMutations(mutations) {
    if (!isGeminiHost() || !mutations) return null;
    for (const mutation of Array.from(mutations || [])) {
      const nodes = [];
      if (mutation?.target) nodes.push(mutation.target);
      try {
        nodes.push(...Array.from(mutation?.addedNodes || []));
      } catch {
        // Synthetic mutation records may not expose iterable node lists.
      }
      for (const node of nodes) {
        const trigger = findGeminiHiddenFileSelectorTriggerInNode(node);
        if (trigger) return trigger;
      }
    }
    return null;
  }

  function activateGeminiHiddenFileSelectorTriggerSafely(trigger) {
    if (!isGeminiHiddenFileSelectorTrigger(trigger)) return false;
    try {
      for (const type of ["pointerdown", "mousedown", "mouseup"]) {
        trigger.dispatchEvent?.(createGeminiUploadMenuEvent(type));
      }
      if (typeof trigger.click === "function") {
        trigger.click();
      } else {
        trigger.dispatchEvent?.(createGeminiUploadMenuEvent("click"));
      }
      return true;
    } catch {
      try {
        trigger.dispatchEvent?.(createGeminiUploadMenuEvent("click"));
        return true;
      } catch {
        return false;
      }
    }
  }

  async function waitForGeminiUploadFilesMenuItem(timeoutMs = 3000) {
    let menuItem = findGeminiUploadFilesMenuItem();
    if (menuItem) return menuItem;

    if (typeof MutationObserver !== "function") {
      return null;
    }

    return await new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let timeoutId = 0;
      const finish = (force = false) => {
        if (settled) return;
        menuItem = findGeminiUploadFilesMenuItem();
        if (!menuItem && !force) return;
        settled = true;
        if (observer) {
          try {
            observer.disconnect();
          } catch {
            // Best-effort cleanup only.
          }
        }
        if (timeoutId) clearTimeout(timeoutId);
        resolve(menuItem || null);
      };

      try {
        observer = new MutationObserver(() => finish(false));
        observer.observe(document.body || document.documentElement || document, {
          childList: true,
          subtree: true
        });
      } catch {
        observer = null;
      }

      const raf =
        typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame
          : null;
      if (raf) {
        try {
          raf(() => finish(false));
        } catch {
          finish(false);
        }
      }

      timeoutId = setTimeout(() => finish(true), timeoutMs);
    });
  }

  async function waitForGeminiFileInput(timeoutMs = 3000, event = null, input = null, details = null) {
    let result = findGeminiFileInput(event, input);
    if (result.fileInput) return result;

    if (typeof MutationObserver !== "function") {
      return result;
    }

    return await new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let timeoutId = 0;
      const finish = (reason = "", directInput = null) => {
        if (settled) return;
        result = directInput
          ? { discovery: result.discovery || {}, fileInput: directInput }
          : findGeminiFileInput(event, input);
        if (!result.fileInput && !reason) return;
        settled = true;
        if (observer) {
          try {
            observer.disconnect();
          } catch {
            // Best-effort cleanup only.
          }
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        const discovery = result.discovery || {};
        if (details) {
          details.fileInputCountBeforeClick = Math.max(
            Number(details.fileInputCountBeforeClick || 0),
            Number(discovery.fileInputCount || 0)
          );
          details.fileInputCountAfterTopTriggerClick = Number(discovery.fileInputCount || 0);
          details.fileInputCountAfterOverlayItemClick = Number(discovery.fileInputCount || 0);
          details.openShadowRootCount = Math.max(
            Number(details.openShadowRootCount || 0),
            Number(discovery.openShadowRootCount || 0)
          );
          if (reason && !result.fileInput) {
            details.failureReason = reason;
          }
        }
        if (directInput) {
          debugReveal("file-handoff:gemini-firefox-prime-filedata-input-observed", {
            mode: "file-input-prime",
            browser: "firefox",
            host: location.hostname || "",
            input: describeFileInputForDebug(directInput, "gemini-firefox-filedata-observed")
          });
        }
        resolve(result);
      };

      try {
        observer = new MutationObserver((mutations) => finish("", findGeminiFileDataInputInMutations(mutations)));
        observer.observe(document.body || document.documentElement || document, {
          childList: true,
          subtree: true
        });
      } catch {
        observer = null;
      }

      const raf =
        typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame
          : null;
      if (raf) {
        try {
          raf(() => finish());
        } catch {
          finish();
        }
      }

      timeoutId = setTimeout(() => finish("file_input_bridge_input_not_found"), timeoutMs);
    });
  }

  function verifyGeminiFirefoxFileInputBridgeAssignment(fileInput, sanitizedFiles, rawFiles) {
    const assignedFiles = Array.from(fileInput?.files || []);
    if (
      assignedFiles.length !== sanitizedFiles.length ||
      sanitizedFiles.some((sanitizedFile, index) => assignedFiles[index] !== sanitizedFile)
    ) {
      return false;
    }
    return !Array.from(rawFiles || []).some((rawFile) => rawFile && assignedFiles.includes(rawFile));
  }

  function primeGeminiFirefoxUploadTarget(event, input) {
    if (!isGeminiHost() || !isFirefoxRuntime() || event?.type !== "drop") return null;

    const pickerGuard = createGeminiFirefoxFilePickerGuard();
    const details = createSanitizedFileHandoffDetails(event, null, "gemini:prime-upload-target");
    let settled = false;
    let inputResolve = null;
    const inputPromise = new Promise((resolve) => {
      inputResolve = resolve;
    });
    const finish = (fileInput = null) => {
      if (settled) return;
      settled = true;
      try {
        pickerGuard.cleanup();
      } catch {
        // Best-effort cleanup after capture or timeout.
      }
      inputResolve(fileInput || pickerGuard.getInput() || null);
    };

    debugReveal("file-handoff:gemini-firefox-prime-start", {
      mode: "file-input-prime",
      browser: "firefox",
      host: location.hostname || "",
      eventType: event?.type || ""
    });

    (async () => {
      try {
        let waitResult = findGeminiFileInput(event, input);
        if (waitResult.fileInput) {
          details.handoffStage = "gemini:prime-existing-filedata-input";
          finish(waitResult.fileInput);
          return;
        }

        let menuItem = findGeminiUploadFilesMenuItem();
        if (!menuItem) {
          const menuButton = findGeminiUploadMenuButton();
          if (menuButton && openGeminiUploadMenuSafely(menuButton)) {
            details.foundTopUploadTrigger = true;
            details.uploadTrigger = describeElementForDebug(menuButton, "gemini-upload-menu-button");
            debugReveal("file-handoff:gemini-firefox-prime-menu-opened", {
              menuButton: details.uploadTrigger
            });
            menuItem = findGeminiUploadFilesMenuItem() || (await waitForGeminiUploadFilesMenuItem(3000));
          }
        }

        if (menuItem && openGeminiUploadFilesMenuItemSafely(menuItem)) {
          details.selectedOverlayItem = describeElementForDebug(menuItem, "gemini-upload-files-menu-item");
          details.handoffStage = "gemini:waiting-for-filedata-input";
          debugReveal("file-handoff:gemini-firefox-prime-menu-item-opened", {
            menuItem: details.selectedOverlayItem
          });
          const waitForPrimedInput = async (waitMs) =>
            pickerGuard.getInput() ||
            (await Promise.race([
              pickerGuard.waitForInput(waitMs),
              waitForGeminiFileInput(waitMs, event, input, details).then((result) => {
                waitResult = result;
                return result.fileInput || pickerGuard.getInput();
              })
            ]));

          waitResult = findGeminiFileInput(event, input);
          let guardedInput = pickerGuard.getInput() || waitResult.fileInput || null;
          if (!guardedInput && !waitResult.fileInput) {
            const hiddenTrigger = findGeminiHiddenFileSelectorTrigger();
            if (hiddenTrigger) {
              debugReveal("file-handoff:gemini-firefox-prime-hidden-trigger-found", {
                trigger: describeElementForDebug(hiddenTrigger, "gemini-hidden-file-selector-trigger")
              });
              if (activateGeminiHiddenFileSelectorTriggerSafely(hiddenTrigger)) {
                debugReveal("file-handoff:gemini-firefox-prime-hidden-trigger-clicked", {
                  trigger: describeElementForDebug(hiddenTrigger, "gemini-hidden-file-selector-trigger")
                });
                guardedInput = pickerGuard.getInput() || null;
              }
            }
          }
          if (!guardedInput && !waitResult.fileInput) {
            guardedInput = await waitForPrimedInput(3000);
          }

          const primedInput = guardedInput || waitResult.fileInput || null;
          if (primedInput && pickerGuard.getInput() === primedInput) {
            debugReveal("file-handoff:gemini-firefox-prime-filedata-input-captured", {
              mode: "file-input-prime",
              browser: "firefox",
              host: location.hostname || "",
              input: describeFileInputForDebug(primedInput, "gemini-firefox-filedata-captured")
            });
          }
          finish(primedInput);
          return;
        }

        details.failureReason = "upload_files_menu_item_not_found";
        finish(null);
      } catch (error) {
        details.failureReason = "prime_upload_target_failed";
        details.errorMessage = error?.message || String(error || "");
        finish(null);
      }
    })();

    return {
      details,
      inputPromise
    };
  }

  async function handOffPrimedGeminiFirefoxUploadTarget(prime, sanitizedFile) {
    if (!prime || !sanitizedFile) return { ok: false, reason: "not_primed" };
    const fileInput = await prime.inputPromise;
    if (!fileInput) {
      prime.details.failureReason = prime.details.failureReason || "primed_filedata_input_not_captured";
      debugReveal("file-handoff:gemini-firefox-prime-input-not-found", {
        reason: prime.details.failureReason,
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      return { ok: false, reason: prime.details.failureReason };
    }

    prime.details.handoffStage = "gemini:primed-filedata-assignment";
    prime.details.sanitizedFile = describeFileForDebug(sanitizedFile);
    const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, prime.details);
    if (!transfer) {
      prime.details.failureReason = "data_transfer_failed";
      return { ok: false, reason: "data_transfer_failed" };
    }

    const assigned = handOffSanitizedFileInput(fileInput, transfer, {
      dispatchInput: true,
      details: prime.details
    });
    if (!assigned) {
      prime.details.failureReason = prime.details.failureReason || "input_assignment_failed";
      return { ok: false, reason: prime.details.failureReason };
    }

    debugReveal("file-handoff:gemini-firefox-prime-assigned", {
      mode: "file-input-prime",
      inputFound: true,
      input: describeFileInputForDebug(fileInput, "gemini-firefox-primed-filedata-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    debugReveal("file-handoff:gemini-firefox-prime-sanitized-file-assigned", {
      mode: "file-input-prime",
      inputFound: true,
      input: describeFileInputForDebug(fileInput, "gemini-firefox-primed-filedata-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    return { ok: true, strategy: "gemini-firefox-primed-filedata-input" };
  }

  async function tryFirefoxGeminiFileInputBridge(payload, context) {
    if (
      !isFirefoxRuntime() ||
      !isGeminiHost() ||
      context?.event?.type !== "drop" ||
      !payload?.sanitizedFile
    ) {
      return { handled: false, ok: false };
    }

    const details = createSanitizedFileHandoffDetails(
      context.event,
      payload.sanitizedFile,
      "gemini:firefox-file-input-bridge"
    );
    const rawFiles = listLocalTransferFiles(context.event?.dataTransfer);
    const sanitizedFiles = listFirefoxGeminiBridgeSanitizedFiles(payload);
    debugReveal(
      "file-handoff:gemini-firefox-file-input-bridge-start",
      createFirefoxGeminiFileInputBridgeDebug(context, payload)
    );

    if (shouldUseFirefoxTextFallbackForFileHandoff()) {
      details.failureReason = "input_file_assignment_unavailable";
      debugReveal("file-handoff:gemini-firefox-file-input-bridge-unavailable", {
        ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
        reason: details.failureReason
      });
      return {
        handled: true,
        ok: false,
        stage: "failed",
        reason: "gemini_firefox_file_input_bridge_unavailable",
        message: FIREFOX_GEMINI_FILE_INPUT_BRIDGE_FAILURE_MESSAGE
      };
    }

    if (hasPendingGeminiSanitizedFileHandoff(payload.sanitizedFile)) {
      return {
        handled: true,
        ok: true,
        stage: "pending",
        strategy: "gemini-firefox-pending-sanitized-file-handoff"
      };
    }

    const pickerGuard = createGeminiFirefoxFilePickerGuard();
    let waitResult = findGeminiFileInput(context.event, context.input);
    const bridgeUi = {
      overlayItemFoundBeforeMenuOpen: false,
      menuOpenButtonClicked: false,
      uploadFilesMenuItemClicked: false,
      fileInputCapturedByGuard: false
    };
    try {
      if (!waitResult.fileInput) {
        let menuItem = findGeminiUploadFilesMenuItem();
        bridgeUi.overlayItemFoundBeforeMenuOpen = Boolean(menuItem);
        let menuOpened = false;
        if (!menuItem) {
          const menuButton = findGeminiUploadMenuButton();
          if (menuButton && openGeminiUploadMenuSafely(menuButton)) {
            menuOpened = true;
            bridgeUi.menuOpenButtonClicked = true;
            debugReveal("file-handoff:gemini-firefox-file-input-bridge-menu-opened", {
              ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
              menuButton: describeElementForDebug(menuButton, "gemini-upload-menu-button")
            });
            menuItem = await waitForGeminiUploadFilesMenuItem(3000);
          }
        }
        if (menuItem && openGeminiUploadFilesMenuItemSafely(menuItem)) {
          bridgeUi.uploadFilesMenuItemClicked = true;
          debugReveal("file-handoff:gemini-firefox-file-input-bridge-menu-item-opened", {
            ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
            menuOpened,
            menuItem: describeElementForDebug(menuItem, "gemini-upload-files-menu-item")
          });
          details.handoffStage = "gemini:waiting-for-filedata-input";
          const waitMs = 2500;
          const guardedInput =
            pickerGuard.getInput() ||
            (await Promise.race([
              pickerGuard.waitForInput(waitMs),
              waitForGeminiFileInput(waitMs, context.event, context.input, details).then((result) => {
                waitResult = result;
                return pickerGuard.getInput();
              })
            ]));
          bridgeUi.fileInputCapturedByGuard = Boolean(guardedInput);
          if (guardedInput) {
            waitResult = { discovery: { fileInputCount: 1, openShadowRootCount: 0 }, fileInput: guardedInput };
          } else if (!waitResult.fileInput) {
            waitResult = findGeminiFileInput(context.event, context.input);
          }
        }
      }
      if (!waitResult.fileInput && pickerGuard.getInput()) {
        bridgeUi.fileInputCapturedByGuard = true;
        waitResult = {
          discovery: waitResult.discovery || { fileInputCount: 1, openShadowRootCount: 0 },
          fileInput: pickerGuard.getInput()
        };
      }
    } finally {
      pickerGuard.cleanup();
    }
    const discovery = waitResult.discovery || {};
    const fileInput = waitResult.fileInput || null;
    details.fileInputCountBeforeClick = Number(discovery.fileInputCount || 0);
    details.fileInputCountAfterTopTriggerClick = Number(discovery.fileInputCount || 0);
    details.fileInputCountAfterOverlayItemClick = Number(discovery.fileInputCount || 0);
    details.openShadowRootCount = Math.max(
      Number(details.openShadowRootCount || 0),
      Number(discovery.openShadowRootCount || 0)
    );

    if (!fileInput) {
      details.failureReason = "file_input_bridge_input_not_found";
      const safeUploadOpenerDiscovered = isAllowedGeminiUploadMenuOpener(discovery.uploadTrigger);
      const uploadFlowWasReached =
        safeUploadOpenerDiscovered ||
        bridgeUi.overlayItemFoundBeforeMenuOpen ||
        bridgeUi.menuOpenButtonClicked ||
        bridgeUi.uploadFilesMenuItemClicked;
      const queuedPending =
        uploadFlowWasReached &&
        shouldQueueFirefoxGeminiPendingSanitizedFileHandoff(context.event, payload.sanitizedFile, details) &&
        queuePendingSanitizedFileHandoff(
          getFileHandoffAdapterById("gemini"),
          context.event,
          context.input,
          payload.sanitizedFile,
          details
        );
      debugReveal(
        "file-handoff:gemini-firefox-file-input-bridge-input-not-found",
        {
          ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
          bridgeUi,
          safeUploadOpenerDiscovered,
          uploadFlowWasReached,
          queuedPending,
          uploadMenu: describeGeminiUploadMenuDiscovery(),
          overlay: describeGeminiOverlayExposure()
        }
      );
      if (queuedPending) {
        return {
          handled: true,
          ok: true,
          stage: "pending",
          strategy: "gemini-firefox-pending-sanitized-file-handoff"
        };
      }
      if (
        suppressStaleHandoffErrorAfterSuccess(
          "file_bridge_failure",
          "gemini",
          payload.sanitizedFile,
          { bridgeReason: details.failureReason }
        )
      ) {
        return {
          handled: true,
          ok: true,
          stage: "file",
          strategy: "gemini-firefox-file-input-bridge-stale-error-suppressed"
        };
      }
      return {
        handled: true,
        ok: false,
        stage: "failed",
        reason: "gemini_firefox_file_input_not_found",
        message: FIREFOX_GEMINI_FILE_INPUT_BRIDGE_FAILURE_MESSAGE
      };
    }

    const transfer = createFirefoxGeminiBridgeDataTransfer(sanitizedFiles, details);
    if (!transfer) {
      details.failureReason = "data_transfer_failed";
      debugReveal("file-handoff:gemini-firefox-file-input-bridge-transfer-failed", {
        ...createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput),
        reason: details.failureReason
      });
      if (
        suppressStaleHandoffErrorAfterSuccess(
          "file_bridge_failure",
          "gemini",
          payload.sanitizedFile,
          { bridgeReason: details.failureReason }
        )
      ) {
        return {
          handled: true,
          ok: true,
          stage: "file",
          strategy: "gemini-firefox-file-input-bridge-stale-error-suppressed"
        };
      }
      return {
        handled: true,
        ok: false,
        stage: "failed",
        reason: "gemini_firefox_file_input_bridge_data_transfer_failed",
        message: FIREFOX_GEMINI_FILE_INPUT_BRIDGE_FAILURE_MESSAGE
      };
    }

    const assigned = handOffSanitizedFileInput(fileInput, transfer, {
      dispatchInput: true,
      details
    });
    if (!assigned || !verifyGeminiFirefoxFileInputBridgeAssignment(fileInput, sanitizedFiles, rawFiles)) {
      details.failureReason = assigned
        ? "file_input_bridge_verification_failed"
        : details.failureReason || "file_input_bridge_assignment_failed";
      debugReveal("file-handoff:gemini-firefox-file-input-bridge-assignment-failed", {
        ...createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput),
        reason: details.failureReason
      });
      return {
        handled: true,
        ok: false,
        stage: "failed",
        reason: "gemini_firefox_file_input_bridge_assignment_failed",
        message: FIREFOX_GEMINI_FILE_INPUT_BRIDGE_FAILURE_MESSAGE
      };
    }

    debugReveal(
      "file-handoff:gemini-firefox-file-input-bridge-assigned",
      createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput)
    );
    return {
      handled: true,
      ok: true,
      stage: "file",
      strategy: "gemini-firefox-file-input-bridge"
    };
  }

  function buildSanitizedDownloadFileName(sanitizedFile) {
    const originalName = sanitizeDownloadFileNameSegment(sanitizedFile?.name || "sanitized-file.txt");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace(/\d{3}Z$/, "Z");
    return `LeakGuard/redacted/${timestamp}-${originalName}`;
  }

  function createSanitizedFileHandoffDetails(event, sanitizedFile, stage) {
    const target = normalizeTarget(event?.target);
    return {
      hostname: location.hostname || "",
      eventType: event?.type || "",
      handoffStage: stage || "",
      targetTag: target?.tagName || "",
      originalFile: originalFileMetadataFromEvent(event),
      sanitizedFile: describeFileForDebug(sanitizedFile),
      sessionHash: lastGeminiDropSessionHash || "",
      foundTopUploadTrigger: false,
      uploadTrigger: null,
      overlayItemCount: 0,
      overlayCandidates: [],
      selectedOverlayItem: null,
      fileInputCountBeforeClick: 0,
      fileInputCountAfterTopTriggerClick: 0,
      fileInputCountAfterOverlayItemClick: 0,
      openShadowRootCount: 0,
      dataTransferConstructorSucceeded: false,
      dataTransferItemsAddSucceeded: false,
      inputFilesAssignmentSucceeded: false,
      inputEventDispatched: false,
      changeEventDispatched: false,
      failureReason: "",
      errorMessage: "",
      errorStack: ""
    };
  }

  function sanitizeDownloadFileNameSegment(value, fallback = "sanitized-file.txt") {
    return globalThis.PWM.SafeSnapshots.sanitizeDownloadFileNameSegment(value, fallback);
  }

  function buildGeminiSanitizedDownloadFileName(sanitizedFile) {
    const originalName = sanitizeDownloadFileNameSegment(sanitizedFile?.name || "sanitized-file.txt");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace(/\d{3}Z$/, "Z");
    return `LeakGuard/redacted/${timestamp}-${originalName}`;
  }

  async function downloadGeminiSanitizedFileFallback(event, input, sanitizedFile, details = null) {
    if (!isGeminiHost() || event?.type !== "drop" || !sanitizedFile) return false;

    let redactedText = "";
    try {
      redactedText = await readSanitizedFileTextForFallback(sanitizedFile);
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
        fileName: buildGeminiSanitizedDownloadFileName(sanitizedFile),
        mimeType: sanitizedFile.type || "text/plain",
        redactedText
      });

      if (!response?.ok) {
        if (details) {
          details.failureReason = "sanitized_download_failed";
          details.errorMessage = response?.error || "Background download request failed.";
        }
        return false;
      }

      geminiSanitizedDownloadFallbacks.add(sanitizedFile);
      clearPendingGeminiSanitizedFileHandoff("download-fallback");
      debugReveal("file-handoff:gemini-sanitized-download", {
        sanitizedFile: describeFileForDebug(sanitizedFile),
        downloadId: response.downloadId ?? null
      });
      setGeminiDmzOverlayState("Sanitized download ready", "fallback");
      scheduleGeminiDmzOverlayCleanup(3600);
      setBadge(GEMINI_SANITIZED_DOWNLOAD_MESSAGE);
      hideBadgeSoon(6500);
      await showMessageModal("Sanitized file downloaded", GEMINI_SANITIZED_DOWNLOAD_MODAL_MESSAGE);
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

  function hasGeminiSanitizedDownloadFallback(sanitizedFile) {
    return Boolean(sanitizedFile && geminiSanitizedDownloadFallbacks.has(sanitizedFile));
  }

  function logSanitizedFileHandoffFailure(details, error) {
    const payload = {
      ...(details || {}),
      errorMessage: details?.errorMessage || error?.message || (error ? String(error) : ""),
      errorStack: details?.errorStack || error?.stack || ""
    };
    try {
      debugReveal("sanitized-file-handoff:failed", payload);
    } catch {
      // Diagnostics must never affect blocking behavior.
    }
    try {
      console.error("[LeakGuard] sanitized file handoff failed", payload, error || "");
    } catch {
      // Ignore console failures in host-controlled environments.
    }
  }

  function normalizeFileHandoffAdapter(adapter) {
    if (!adapter) return getFileHandoffAdapterForLocation();
    if (typeof adapter === "string") return getFileHandoffAdapterById(adapter);
    return adapter;
  }

  async function performPendingGeminiUserAttach(event, input, sanitizedFile) {
    if (!isGeminiHost() || !sanitizedFile) return false;

    debugReveal("gemini-pending-user-attach-start", {
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    clearPendingGeminiGhostIngressClickInterceptor("pending-user-attach");

    const details = createSanitizedFileHandoffDetails(
      event,
      sanitizedFile,
      "gemini:pending-user-attach"
    );
    const pickerGuard = createGeminiFirefoxFilePickerGuard();
    let waitResult = findGeminiFileInput(event, input);

    try {
      if (!waitResult.fileInput) {
        let menuItem = findGeminiUploadFilesMenuItem();
        if (!menuItem) {
          const menuButton = findGeminiUploadMenuButton();
          if (menuButton && openGeminiUploadMenuSafely(menuButton)) {
            debugReveal("gemini-pending-user-attach-menu-opened", {
              menuButton: describeElementForDebug(menuButton, "gemini-upload-menu-button"),
              sanitizedFile: describeFileForDebug(sanitizedFile)
            });
            menuItem = await waitForGeminiUploadFilesMenuItem(3000);
          }
        }

        if (menuItem && openGeminiUploadFilesMenuItemSafely(menuItem)) {
          debugReveal("gemini-pending-user-attach-menu-item-clicked", {
            menuItem: describeElementForDebug(menuItem, "gemini-upload-files-menu-item"),
            sanitizedFile: describeFileForDebug(sanitizedFile)
          });
          const waitMs = 2500;
          const guardedInput =
            pickerGuard.getInput() ||
            (await Promise.race([
              pickerGuard.waitForInput(waitMs),
              waitForGeminiFileInput(waitMs, event, input, details).then((result) => {
                waitResult = result;
                return pickerGuard.getInput() || result.fileInput || null;
              })
            ]));
          if (guardedInput) {
            waitResult = { discovery: { fileInputCount: 1, openShadowRootCount: 0 }, fileInput: guardedInput };
          }
        }

        if (!waitResult.fileInput && pickerGuard.getInput()) {
          waitResult = {
            discovery: waitResult.discovery || { fileInputCount: 1, openShadowRootCount: 0 },
            fileInput: pickerGuard.getInput()
          };
        }

        if (!waitResult.fileInput) {
          const hiddenTrigger = findGeminiHiddenFileSelectorTrigger();
          if (hiddenTrigger && activateGeminiHiddenFileSelectorTriggerSafely(hiddenTrigger)) {
            const waitMs = 2500;
            const guardedInput =
              pickerGuard.getInput() ||
              (await Promise.race([
                pickerGuard.waitForInput(waitMs),
                waitForGeminiFileInput(waitMs, event, input, details).then((result) => {
                  waitResult = result;
                  return pickerGuard.getInput() || result.fileInput || null;
                })
              ]));
            if (guardedInput) {
              waitResult = { discovery: { fileInputCount: 1, openShadowRootCount: 0 }, fileInput: guardedInput };
            }
          }
        }
      }
    } finally {
      pickerGuard.cleanup();
    }

    const fileInput = waitResult.fileInput || null;
    if (!fileInput) {
      debugReveal("file-handoff:gemini-pending-input-not-found", {
        reason: "pending-user-attach",
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      if (suppressStaleHandoffErrorAfterSuccess("pending_attach_input_not_found", "gemini", sanitizedFile)) {
        return true;
      }
      setBadge("LeakGuard is waiting for Gemini upload input.");
      hideBadgeSoon(4200);
      refreshBadgeFromCurrentInput();
      return false;
    }

    debugReveal("gemini-pending-user-attach-input-captured", {
      input: describeFileInputForDebug(fileInput, "gemini-pending-user-attach-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    debugReveal("file-handoff:pending-input-captured", {
      site: "gemini",
      reason: "pending-user-attach",
      input: describeFileInputForDebug(fileInput, "gemini-pending-user-attach-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });

    const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, details);
    const assigned = transfer
      ? handOffSanitizedFileInput(fileInput, transfer, {
          dispatchInput: true,
          details
        })
      : false;
    if (!assigned) {
      details.failureReason = details.failureReason || "pending_user_attach_assignment_failed";
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    debugReveal("gemini-pending-user-attach-assigned", {
      input: describeFileInputForDebug(fileInput, "gemini-pending-user-attach-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    debugReveal("file-handoff:pending-assigned", {
      site: "gemini",
      reason: "pending-user-attach",
      input: describeFileInputForDebug(fileInput, "gemini-pending-user-attach-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    clearPendingGeminiSanitizedFileHandoff("assigned");
    showFileProcessingSuccess("Sanitized file attached.", {
      site: "gemini",
      reason: "pending-attached"
    });
    setBadge("LeakGuard attached the sanitized file.");
    hideBadgeSoon(3200);
    refreshBadgeFromCurrentInput();
    return true;
  }

  function findGrokUploadButton() {
    if (!isGrokHost()) return null;
    const roots = [];
    collectRootsWithOpenShadow(document, roots, new WeakSet(), null);
    const candidates = [];
    const seen = new WeakSet();
    const selectors = [
      "button",
      "label",
      "[role='button']",
      "input[type='file']"
    ];
    roots.forEach((root) => {
      selectors.forEach((selector) => {
        try {
          root.querySelectorAll?.(selector).forEach((candidate) => {
            if (!candidate || seen.has(candidate)) return;
            seen.add(candidate);
            candidates.push(candidate);
          });
        } catch {
          // Keep scanning other selectors and roots.
        }
      });
    });
    return candidates.find((candidate) => isLikelyGrokUploadClickTarget(candidate)) || null;
  }

  function openGrokUploadButtonSafely(button) {
    if (!button || button.disabled || isFileInputElement(button)) return false;
    if (!isLikelyGrokUploadClickTarget(button)) return false;
    try {
      for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
        button.dispatchEvent(createGeminiUploadMenuEvent(type));
      }
      return true;
    } catch {
      return false;
    }
  }

  async function waitForGrokPendingFileInput(timeoutMs = 2500, event = null, input = null) {
    let discovery = discoverGrokPendingFileInput(event, input);
    if (discovery.fileInput) return discovery;

    if (typeof MutationObserver !== "function") {
      return discovery;
    }

    return await new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let timeoutId = 0;
      const finish = (force = false) => {
        if (settled) return;
        discovery = discoverGrokPendingFileInput(event, input);
        if (!discovery.fileInput && !force) return;
        settled = true;
        if (observer) {
          try {
            observer.disconnect();
          } catch {
            // Best-effort cleanup only.
          }
        }
        if (timeoutId) clearTimeout(timeoutId);
        resolve(discovery);
      };

      try {
        observer = new MutationObserver(() => finish(false));
        observer.observe(document.documentElement || document, {
          childList: true,
          subtree: true
        });
      } catch {
        observer = null;
      }
      setTimeout(() => finish(false), 0);
      timeoutId = setTimeout(() => finish(true), timeoutMs);
    });
  }

  async function performPendingGrokUserAttach(event, input, sanitizedFile) {
    if (!isGrokHost() || !sanitizedFile) return false;

    debugReveal("grok-pending-user-attach-start", {
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });

    let discovery = discoverGrokPendingFileInput(event, input);
    if (!discovery.fileInput) {
      const uploadButton = findGrokUploadButton();
      if (uploadButton && !isFileInputElement(uploadButton)) {
        openGrokUploadButtonSafely(uploadButton);
      }
      discovery = await waitForGrokPendingFileInput(2500, event, input);
    }

    const fileInput = discovery.fileInput || null;
    if (!fileInput) {
      debugReveal("file-handoff:grok-pending-input-not-found", {
        reason: "pending-user-attach",
        ...describeGrokPendingInputDiscovery(discovery),
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      if (suppressStaleHandoffErrorAfterSuccess("pending_attach_input_not_found", "grok", sanitizedFile)) {
        return true;
      }
      setBadge("LeakGuard is waiting for Grok upload input.");
      hideBadgeSoon(4200);
      refreshBadgeFromCurrentInput();
      return false;
    }

    debugReveal("grok-pending-user-attach-input-captured", {
      input: describeFileInputForDebug(fileInput, "grok-pending-user-attach-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    debugReveal("file-handoff:pending-input-captured", {
      site: "grok",
      reason: "pending-user-attach",
      input: describeFileInputForDebug(fileInput, "grok-pending-user-attach-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });

    const details = createSanitizedFileHandoffDetails(
      event,
      sanitizedFile,
      "grok:pending-user-attach"
    );
    const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, details);
    const assigned = transfer
      ? handOffSanitizedFileInput(fileInput, transfer, {
          dispatchInput: true,
          details
        })
      : false;
    if (!assigned) {
      details.failureReason = details.failureReason || "pending_user_attach_assignment_failed";
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    debugReveal("grok-pending-user-attach-assigned", {
      input: describeFileInputForDebug(fileInput, "grok-pending-user-attach-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    debugReveal("file-handoff:pending-assigned", {
      site: "grok",
      reason: "pending-user-attach",
      input: describeFileInputForDebug(fileInput, "grok-pending-user-attach-input"),
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    clearPendingGrokSanitizedFileHandoff("assigned");
    showFileProcessingSuccess("Sanitized file attached.", {
      site: "grok",
      reason: "pending-attached"
    });
    setBadge("LeakGuard attached the sanitized file.");
    hideBadgeSoon(3200);
    refreshBadgeFromCurrentInput();
    return true;
  }

  function clearPendingGeminiSanitizedFileHandoff(reason = "") {
    clearPendingGeminiGhostIngressClickInterceptor(reason || "pending-cleared");
    if (!pendingGeminiSanitizedFileHandoff) {
      clearPendingSanitizedAttachPrompt(reason || "gemini-pending-cleared");
      return;
    }

    const pending = pendingGeminiSanitizedFileHandoff;
    pendingGeminiSanitizedFileHandoff = null;
    clearPendingSanitizedAttachPrompt(reason || "gemini-pending-cleared");

    if (pendingGeminiSanitizedFileObserver) {
      try {
        pendingGeminiSanitizedFileObserver.disconnect();
      } catch {
        debugReveal("file-handoff:pending-cleanup-failed", {
          site: "gemini",
          phase: "observer-disconnect",
          reason,
          hadPending: true
        });
      }
      pendingGeminiSanitizedFileObserver = null;
    }

    if (pendingGeminiSanitizedFileTimer) {
      clearTimeout(pendingGeminiSanitizedFileTimer);
      pendingGeminiSanitizedFileTimer = 0;
    }

    if (pendingGeminiSanitizedFileClickHandler) {
      try {
        document.removeEventListener("click", pendingGeminiSanitizedFileClickHandler, true);
      } catch {
        debugReveal("file-handoff:pending-cleanup-failed", {
          site: "gemini",
          phase: "click-listener-remove",
          reason,
          hadPending: true
        });
      }
      pendingGeminiSanitizedFileClickHandler = null;
    }

    debugReveal("file-handoff:gemini-pending-cleared", {
      reason,
      ageMs: Math.max(0, Date.now() - Number(pending.createdAt || 0)),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
    debugReveal("file-handoff:pending-cleared", {
      site: "gemini",
      reason,
      ageMs: Math.max(0, Date.now() - Number(pending.createdAt || 0)),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
  }

  function isLikelyGeminiUploadClickTarget(target) {
    const candidate = normalizeTarget(target);
    const explicitSelectors = [
      'button[aria-label="Open upload file menu"]',
      'button[data-test-id="local-images-files-uploader-button"]',
      'button[role="menuitem"][aria-label="Upload files. Documents, data, code files"]',
      "button.hidden-local-file-image-selector-button[xapfileselectortrigger]"
    ];
    for (const selector of explicitSelectors) {
      try {
        const matched = candidate?.matches?.(selector) ? candidate : candidate?.closest?.(selector);
        if (matched) return true;
      } catch {
        // Host-controlled selectors can fail; use metadata checks below.
      }
    }

    const meta = describeElementForDebug(candidate);
    const testId = candidate?.getAttribute?.("data-test-id") || candidate?.dataset?.testId || "";
    if (testId === "local-images-files-uploader-button") return true;
    if (meta?.ariaLabel === "Open upload file menu") return true;
    if (
      meta?.role === "menuitem" &&
      meta?.ariaLabel === "Upload files. Documents, data, code files"
    ) {
      return true;
    }
    if (
      /\bhidden-local-file-image-selector-button\b/.test(meta?.className || "") &&
      candidate?.hasAttribute?.("xapfileselectortrigger")
    ) {
      return true;
    }

    const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""} ${meta?.className || ""}`.toLowerCase();
    return /\b(upload|file|files|attach)\b/.test(haystack);
  }

  function schedulePendingGeminiSanitizedFileAttempt(reason = "") {
    if (!pendingGeminiSanitizedFileHandoff) return;
    const attempt = () => {
      try {
        attemptPendingGeminiSanitizedFileHandoff(reason);
      } catch (error) {
        handleContentError(error);
      }
    };

    setTimeout(attempt, 0);
    setTimeout(attempt, 250);
    setTimeout(attempt, 1000);
  }

  function describeGeminiHandoffDiscovery(discovery) {
    const summary = discovery || {};
    return {
      fileInputCount: Number(summary.fileInputCount || 0),
      uploadTriggerCount: Number(summary.uploadTriggerCount || 0),
      openShadowRootCount: Number(summary.openShadowRootCount || 0),
      selectedFileInput: describeFileInputForDebug(summary.fileInput, "selected-gemini-file-input"),
      selectedUploadTrigger: describeUploadTriggerForDebug(
        summary.uploadTrigger,
        "selected-gemini-upload-trigger"
      ),
      fileInputCandidates: Array.from(summary.fileInputs || [])
        .slice(0, 20)
        .map(({ input, source }) => ({
          ...describeFileInputForDebug(input, source),
          score: scoreGeminiFileInput(input, source)
        })),
      uploadTriggerCandidates: Array.from(summary.uploadTriggers || [])
        .slice(0, 20)
        .map(({ trigger, selector, source }) => ({
          ...describeUploadTriggerForDebug(trigger, source || selector),
          selector
        }))
    };
  }

  function describeGeminiOverlayExposure() {
    const details = {
      openShadowRootCount: 0,
      overlayItemCount: 0,
      overlayCandidates: [],
      selectedOverlayItem: null
    };
    discoverGeminiUploadOverlayItem(details);
    return {
      openShadowRootCount: details.openShadowRootCount,
      overlayItemCount: details.overlayItemCount,
      selectedOverlayItem: details.selectedOverlayItem,
      overlayCandidates: details.overlayCandidates
    };
  }

  function attemptPendingGeminiSanitizedFileHandoff(reason = "") {
    const pending = pendingGeminiSanitizedFileHandoff;
    if (!pending || !isGeminiHost()) return false;

    if (Date.now() > pending.expiresAt) {
      clearPendingGeminiSanitizedFileHandoff("expired");
      return false;
    }

    const event = {
      type: "pending-gemini-sanitized-file",
      target: null
    };
    const discovery = discoverGeminiFileHandoffElements(event, null);
    const fileInput = discovery.fileInput;
    if (!fileInput) {
      debugReveal("file-handoff:gemini-pending-input-not-found", {
        reason,
        ...describeGeminiHandoffDiscovery(discovery),
        overlay: describeGeminiOverlayExposure(),
        sanitizedFile: describeFileForDebug(pending.sanitizedFile)
      });
      return false;
    }
    debugReveal("file-handoff:pending-input-captured", {
      site: "gemini",
      reason,
      input: describeFileInputForDebug(fileInput, "pending-gemini-file-input"),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });

    const details = createSanitizedFileHandoffDetails(
      event,
      pending.sanitizedFile,
      "gemini:pending-file-input-assignment"
    );
    details.fileInputCountBeforeClick = discovery.fileInputCount;
    details.fileInputCountAfterTopTriggerClick = discovery.fileInputCount;
    details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount;
    details.openShadowRootCount = discovery.openShadowRootCount;
    details.failureReason = reason || "pending_file_input_assignment";

    const transfer = createSanitizedDataTransferForHandoff(pending.sanitizedFile, details);
    if (!transfer) {
      details.failureReason = "data_transfer_failed";
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    const assigned = handOffSanitizedFileInput(fileInput, transfer, {
      dispatchInput: true,
      details
    });
    if (!assigned) {
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    debugReveal("file-handoff:gemini-pending-assigned", {
      reason,
      input: describeFileInputForDebug(fileInput, "pending-gemini-file-input"),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
    debugReveal("file-handoff:pending-assigned", {
      site: "gemini",
      reason,
      input: describeFileInputForDebug(fileInput, "pending-gemini-file-input"),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
    clearPendingGeminiSanitizedFileHandoff("assigned");
    showFileProcessingSuccess("Sanitized file attached.", {
      site: "gemini",
      reason: "pending-attached"
    });
    setBadge("LeakGuard attached the sanitized file.");
    hideBadgeSoon(3200);
    refreshBadgeFromCurrentInput();
    return true;
  }

  function queuePendingGeminiSanitizedFileHandoff(event, input, sanitizedFile, details = null) {
    if (!isGeminiHost() || event?.type !== "drop" || !sanitizedFile) return false;

    const requestedHandoffStage = String(details?.handoffStage || "");
    const isStreamingPending = requestedHandoffStage.includes("streaming");
    clearPendingGeminiSanitizedFileHandoff("replaced");
    pendingGeminiSanitizedFileHandoff = {
      sanitizedFile,
      createdAt: Date.now(),
      expiresAt: Date.now() + GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS,
      sessionHash: lastGeminiDropSessionHash || ""
    };

    if (details) {
      details.handoffStage = isStreamingPending
        ? requestedHandoffStage
        : "gemini:pending-user-upload-input";
      details.failureReason = "pending_until_user_exposes_file_input";
    }

    if (typeof MutationObserver === "function") {
      try {
        pendingGeminiSanitizedFileObserver = new MutationObserver(() => {
          attemptPendingGeminiSanitizedFileHandoff("mutation");
        });
        pendingGeminiSanitizedFileObserver.observe(document.documentElement || document, {
          childList: true,
          subtree: true
        });
      } catch {
        pendingGeminiSanitizedFileObserver = null;
      }
    }

    pendingGeminiSanitizedFileClickHandler = (clickEvent) => {
      if (!pendingGeminiSanitizedFileHandoff) return;
      if (isLikelyGeminiUploadClickTarget(clickEvent?.target)) {
        debugReveal("file-handoff:gemini-upload-click-observed", {
          target: describeElementForDebug(normalizeTarget(clickEvent?.target), "pending-upload-click"),
          pendingAgeMs: Math.max(
            0,
            Date.now() - Number(pendingGeminiSanitizedFileHandoff.createdAt || 0)
          )
        });
        debugReveal("file-handoff:pending-site-upload-click-observed", {
          site: "gemini",
          target: describeElementForDebug(normalizeTarget(clickEvent?.target), "pending-upload-click"),
          pendingAgeMs: Math.max(
            0,
            Date.now() - Number(pendingGeminiSanitizedFileHandoff.createdAt || 0)
          )
        });
        schedulePendingGeminiSanitizedFileAttempt("upload-click");
      }
    };
    try {
      document.addEventListener("click", pendingGeminiSanitizedFileClickHandler, true);
    } catch {
      pendingGeminiSanitizedFileClickHandler = null;
    }

    pendingGeminiSanitizedFileTimer = setTimeout(() => {
      clearPendingGeminiSanitizedFileHandoff("expired");
    }, GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS);

    debugReveal("file-handoff:gemini-pending-queued", {
      ttlMs: GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS,
      sanitizedFile: describeFileForDebug(sanitizedFile),
      sessionHash: lastGeminiDropSessionHash || ""
    });
    if (isStreamingPending) {
      debugReveal("file-handoff:gemini-streaming-pending-queued", {
        ttlMs: GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS,
        sanitizedFile: describeFileForDebug(sanitizedFile),
        sessionHash: lastGeminiDropSessionHash || ""
      });
    }
    debugReveal("pending-attach-synthetic-loop-suppressed", {
      site: "gemini",
      streaming: isStreamingPending,
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    hideDmzOverlay();
    const pendingEvent = createPendingAttachEvent(event, "pending-gemini-sanitized-file-attach");
    showPendingSanitizedAttachPrompt(getFileHandoffAdapterById("gemini"), {
      site: "gemini",
      event: pendingEvent,
      input,
      sanitizedFile,
      message: getPendingSanitizedAttachPromptMessage("gemini")
    });
    setBadge(getPendingSanitizedAttachPromptMessage("gemini"));
    hideBadgeSoon(6500);
    return true;
  }

  function hasPendingGeminiSanitizedFileHandoff(sanitizedFile) {
    return Boolean(
      pendingGeminiSanitizedFileHandoff &&
        (!sanitizedFile || pendingGeminiSanitizedFileHandoff.sanitizedFile === sanitizedFile)
    );
  }

  function getPendingGeminiSanitizedFileHandoffDebug() {
    if (!pendingGeminiSanitizedFileHandoff) return null;
    return {
      keys: Object.keys(pendingGeminiSanitizedFileHandoff),
      sanitizedFile: pendingGeminiSanitizedFileHandoff.sanitizedFile,
      sanitizedFileDebug: describeFileForDebug(pendingGeminiSanitizedFileHandoff.sanitizedFile),
      expiresAt: pendingGeminiSanitizedFileHandoff.expiresAt,
      sessionHash: pendingGeminiSanitizedFileHandoff.sessionHash || ""
    };
  }

  function clearPendingGrokSanitizedFileHandoff(reason = "") {
    if (!pendingGrokSanitizedFileHandoff) {
      clearPendingSanitizedAttachPrompt(reason || "grok-pending-cleared");
      return;
    }

    const pending = pendingGrokSanitizedFileHandoff;
    pendingGrokSanitizedFileHandoff = null;
    clearPendingSanitizedAttachPrompt(reason || "grok-pending-cleared");

    if (pendingGrokSanitizedFileObserver) {
      try {
        pendingGrokSanitizedFileObserver.disconnect();
      } catch {
        debugReveal("file-handoff:pending-cleanup-failed", {
          site: "grok",
          phase: "observer-disconnect",
          reason,
          hadPending: true
        });
      }
      pendingGrokSanitizedFileObserver = null;
    }

    if (pendingGrokSanitizedFileTimer) {
      clearTimeout(pendingGrokSanitizedFileTimer);
      pendingGrokSanitizedFileTimer = 0;
    }

    if (pendingGrokSanitizedFileClickHandler) {
      try {
        document.removeEventListener("click", pendingGrokSanitizedFileClickHandler, true);
      } catch {
        debugReveal("file-handoff:pending-cleanup-failed", {
          site: "grok",
          phase: "click-listener-remove",
          reason,
          hadPending: true
        });
      }
      pendingGrokSanitizedFileClickHandler = null;
    }

    debugReveal("file-handoff:grok-pending-cleared", {
      reason,
      ageMs: Math.max(0, Date.now() - Number(pending.createdAt || 0)),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
    debugReveal("file-handoff:pending-cleared", {
      site: "grok",
      reason,
      ageMs: Math.max(0, Date.now() - Number(pending.createdAt || 0)),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
  }

  function getGrokUploadClickCandidates(clickEventOrTarget) {
    const rawCandidates = [];
    try {
      if (typeof clickEventOrTarget?.composedPath === "function") {
        rawCandidates.push(...clickEventOrTarget.composedPath());
      }
    } catch {
      // Host event paths are best-effort.
    }
    rawCandidates.push(clickEventOrTarget?.target || clickEventOrTarget);

    const candidates = [];
    const seen = new WeakSet();
    for (const rawCandidate of rawCandidates) {
      const candidate = normalizeTarget(rawCandidate);
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      candidates.push(candidate);

      try {
        const closest = candidate.closest?.("button, label, input[type='file'], [role='button']");
        if (closest && !seen.has(closest)) {
          seen.add(closest);
          candidates.push(closest);
        }
      } catch {
        // Synthetic and host-controlled nodes can reject selectors.
      }
    }
    return candidates;
  }

  function isLikelyGrokUploadClickTarget(clickEventOrTarget) {
    return getGrokUploadClickCandidates(clickEventOrTarget).some((candidate) => {
      if (!candidate || candidate.disabled) return false;
      if (isFileInputElement(candidate)) return true;

      const tag = String(candidate.tagName || "").toUpperCase();
      const meta = describeElementForDebug(candidate);
      const role = String(meta?.role || "").toLowerCase();
      if (tag !== "BUTTON" && tag !== "LABEL" && tag !== "INPUT" && role !== "button") {
        return false;
      }

      const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""} ${meta?.className || ""}`.toLowerCase();
      return /\b(?:upload|attach|files?|add)\b/.test(haystack);
    });
  }

  function scoreGrokFileInput(candidate, source = "") {
    if (!isFileInputElement(candidate) || candidate.disabled) return -1;
    let score = 0;
    if (candidate.multiple) score += 100;
    const accept = String(candidate.accept || "").toLowerCase();
    if (accept) score += 60;
    if (accept.includes("text") || accept.includes(".txt") || accept.includes(".md") || accept.includes(".json")) {
      score += 20;
    }
    if (/shadow-root/i.test(String(source || ""))) score += 10;
    if (candidate.hidden) score -= 5;
    return score;
  }

  function discoverGrokPendingFileInput(event, input) {
    const inputs = [];
    const seen = new WeakSet();
    const addCandidate = (candidate, source = "") => {
      if (!isFileInputElement(candidate) || seen.has(candidate)) return;
      seen.add(candidate);
      inputs.push({ input: candidate, source });
    };

    collectFileInputsFromAncestry(event?.target, addCandidate);
    try {
      input?.closest?.("form")?.querySelectorAll?.("input[type='file']")?.forEach((candidate) => {
        addCandidate(candidate, "composer-form");
      });
    } catch {
      // Keep global discovery available if a host-controlled form rejects selectors.
    }

    const roots = [];
    const stats = { openShadowRootCount: 0 };
    collectRootsWithOpenShadow(document, roots, new WeakSet(), stats);
    roots.forEach((root) => {
      try {
        root.querySelectorAll?.("input[type='file']").forEach((candidate) => {
          addCandidate(candidate, root === document ? "document" : "shadow-root");
        });
      } catch {
        // Keep scanning other roots.
      }
    });

    const fileInput =
      inputs
        .filter(({ input: candidate }) => !candidate.disabled)
        .sort((a, b) => scoreGrokFileInput(b.input, b.source) - scoreGrokFileInput(a.input, a.source))[0]
        ?.input || null;

    return {
      fileInput,
      fileInputCount: inputs.length,
      openShadowRootCount: stats.openShadowRootCount,
      fileInputs: inputs
    };
  }

  function describeGrokPendingInputDiscovery(discovery) {
    const summary = discovery || {};
    return {
      fileInputCount: Number(summary.fileInputCount || 0),
      openShadowRootCount: Number(summary.openShadowRootCount || 0),
      selectedFileInput: describeFileInputForDebug(summary.fileInput, "selected-grok-file-input"),
      fileInputCandidates: Array.from(summary.fileInputs || [])
        .slice(0, 20)
        .map(({ input, source }) => ({
          ...describeFileInputForDebug(input, source),
          score: scoreGrokFileInput(input, source)
        }))
    };
  }

  function schedulePendingGrokSanitizedFileAttempt(reason = "") {
    if (!pendingGrokSanitizedFileHandoff) return;
    const attempt = () => {
      try {
        attemptPendingGrokSanitizedFileHandoff(reason);
      } catch (error) {
        handleContentError(error);
      }
    };

    setTimeout(attempt, 0);
    setTimeout(attempt, 250);
    setTimeout(attempt, 1000);
  }

  function attemptPendingGrokSanitizedFileHandoff(reason = "") {
    const pending = pendingGrokSanitizedFileHandoff;
    if (!pending || !isGrokHost()) return false;

    if (Date.now() > pending.expiresAt) {
      clearPendingGrokSanitizedFileHandoff("expired");
      return false;
    }

    const event = {
      type: "pending-grok-sanitized-file",
      target: pending.target || null
    };
    const discovery = discoverGrokPendingFileInput(event, pending.input || null);
    const fileInput = discovery.fileInput;
    if (!fileInput) {
      debugReveal("file-handoff:grok-pending-input-not-found", {
        reason,
        ...describeGrokPendingInputDiscovery(discovery),
        sanitizedFile: describeFileForDebug(pending.sanitizedFile)
      });
      return false;
    }
    debugReveal("file-handoff:pending-input-captured", {
      site: "grok",
      reason,
      input: describeFileInputForDebug(fileInput, "pending-grok-file-input"),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });

    const details = createSanitizedFileHandoffDetails(
      event,
      pending.sanitizedFile,
      "grok:pending-file-input-assignment"
    );
    details.fileInputCountBeforeClick = discovery.fileInputCount;
    details.fileInputCountAfterTopTriggerClick = discovery.fileInputCount;
    details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount;
    details.openShadowRootCount = discovery.openShadowRootCount;
    details.failureReason = reason || "pending_file_input_assignment";

    const transfer = createSanitizedDataTransferForHandoff(pending.sanitizedFile, details);
    if (!transfer) {
      details.failureReason = "data_transfer_failed";
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    const assigned = handOffSanitizedFileInput(fileInput, transfer, {
      dispatchInput: true,
      details
    });
    if (!assigned) {
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    debugReveal("file-handoff:grok-pending-assigned", {
      reason,
      input: describeFileInputForDebug(fileInput, "pending-grok-file-input"),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
    debugReveal("file-handoff:pending-assigned", {
      site: "grok",
      reason,
      input: describeFileInputForDebug(fileInput, "pending-grok-file-input"),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
    clearPendingGrokSanitizedFileHandoff("assigned");
    showFileProcessingSuccess("Sanitized file attached.", {
      site: "grok",
      reason: "pending-attached"
    });
    setBadge("LeakGuard attached the sanitized file.");
    hideBadgeSoon(3200);
    refreshBadgeFromCurrentInput();
    return true;
  }

  function queuePendingGrokSanitizedFileHandoff(event, input, sanitizedFile, details = null) {
    if (!isGrokHost() || event?.type !== "drop" || !sanitizedFile) return false;

    const requestedHandoffStage = String(details?.handoffStage || "");
    const isStreamingPending = requestedHandoffStage.includes("streaming");
    clearPendingGrokSanitizedFileHandoff("replaced");
    pendingGrokSanitizedFileHandoff = {
      sanitizedFile,
      input: input || null,
      target: normalizeTarget(event?.target),
      createdAt: Date.now(),
      expiresAt: Date.now() + GROK_PENDING_SANITIZED_FILE_HANDOFF_MS
    };

    if (details) {
      details.handoffStage = isStreamingPending
        ? requestedHandoffStage
        : "grok:pending-user-upload-input";
      details.failureReason = "pending_until_user_exposes_file_input";
    }

    if (typeof MutationObserver === "function") {
      try {
        pendingGrokSanitizedFileObserver = new MutationObserver(() => {
          attemptPendingGrokSanitizedFileHandoff("mutation");
        });
        pendingGrokSanitizedFileObserver.observe(document.documentElement || document, {
          childList: true,
          subtree: true
        });
      } catch {
        pendingGrokSanitizedFileObserver = null;
      }
    }

    pendingGrokSanitizedFileClickHandler = (clickEvent) => {
      if (!pendingGrokSanitizedFileHandoff) return;
      if (isLikelyGrokUploadClickTarget(clickEvent)) {
        debugReveal("file-handoff:grok-upload-click-observed", {
          target: describeElementForDebug(normalizeTarget(clickEvent?.target), "pending-grok-upload-click"),
          pendingAgeMs: Math.max(
            0,
            Date.now() - Number(pendingGrokSanitizedFileHandoff.createdAt || 0)
          )
        });
        debugReveal("file-handoff:pending-site-upload-click-observed", {
          site: "grok",
          target: describeElementForDebug(normalizeTarget(clickEvent?.target), "pending-grok-upload-click"),
          pendingAgeMs: Math.max(
            0,
            Date.now() - Number(pendingGrokSanitizedFileHandoff.createdAt || 0)
          )
        });
        schedulePendingGrokSanitizedFileAttempt("upload-click");
      }
    };
    try {
      document.addEventListener("click", pendingGrokSanitizedFileClickHandler, true);
    } catch {
      pendingGrokSanitizedFileClickHandler = null;
    }

    pendingGrokSanitizedFileTimer = setTimeout(() => {
      clearPendingGrokSanitizedFileHandoff("expired");
    }, GROK_PENDING_SANITIZED_FILE_HANDOFF_MS);

    debugReveal("file-handoff:grok-pending-queued", {
      ttlMs: GROK_PENDING_SANITIZED_FILE_HANDOFF_MS,
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    if (isStreamingPending) {
      debugReveal("file-handoff:grok-streaming-pending-queued", {
        ttlMs: GROK_PENDING_SANITIZED_FILE_HANDOFF_MS,
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
    }
    debugReveal("pending-attach-synthetic-loop-suppressed", {
      site: "grok",
      streaming: isStreamingPending,
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    hideDmzOverlay();
    const pendingEvent = createPendingAttachEvent(event, "pending-grok-sanitized-file-attach");
    showPendingSanitizedAttachPrompt(getFileHandoffAdapterById("grok"), {
      site: "grok",
      event: pendingEvent,
      input,
      sanitizedFile,
      message: getPendingSanitizedAttachPromptMessage("grok")
    });
    setBadge(getPendingSanitizedAttachPromptMessage("grok"));
    hideBadgeSoon(6500);
    return true;
  }

  function hasPendingGrokSanitizedFileHandoff(sanitizedFile) {
    return Boolean(
      pendingGrokSanitizedFileHandoff &&
        (!sanitizedFile || pendingGrokSanitizedFileHandoff.sanitizedFile === sanitizedFile)
    );
  }

  function getPendingGrokSanitizedFileHandoffDebug() {
    if (!pendingGrokSanitizedFileHandoff) return null;
    return {
      keys: Object.keys(pendingGrokSanitizedFileHandoff),
      sanitizedFile: pendingGrokSanitizedFileHandoff.sanitizedFile,
      sanitizedFileDebug: describeFileForDebug(pendingGrokSanitizedFileHandoff.sanitizedFile),
      expiresAt: pendingGrokSanitizedFileHandoff.expiresAt
    };
  }

  function clearFileDragSession(options = {}) {
    clearPendingGeminiGhostIngressClickInterceptor("drag-session-cleared");
    fileDragSessionId += 1;
    lastDiscoveredFileInput = null;
    fileDragDiscoveryCompleted = false;
    fileDragDiscoveryScheduled = false;
    fileDragDetectedLogged = false;
    lastGeminiDropSessionHash = "";
    if (!options.keepDmzOverlay && !options.keepGeminiOverlay) {
      hideDmzOverlay();
    }

    if (fileDragDiscoveryTimer) {
      clearTimeout(fileDragDiscoveryTimer);
      fileDragDiscoveryTimer = 0;
    }

    if (fileDragSessionResetTimer) {
      clearTimeout(fileDragSessionResetTimer);
      fileDragSessionResetTimer = 0;
    }
  }

  function scheduleFileDragSessionReset() {
    if (fileDragSessionResetTimer) {
      clearTimeout(fileDragSessionResetTimer);
    }
    fileDragSessionResetTimer = setTimeout(clearFileDragSession, FILE_DRAG_SESSION_RESET_MS);
  }

  function collectFileInputsFromAncestry(target, addCandidate) {
    let node = normalizeTarget(target);
    const visited = new WeakSet();

    while (node && !visited.has(node)) {
      visited.add(node);
      addCandidate(node, "target-ancestry");

      try {
        node.querySelectorAll?.("input[type='file']").forEach((candidate) => {
          addCandidate(candidate, "target-ancestry");
        });
      } catch {
        // Host-controlled elements can reject selectors; keep the fail-closed path intact.
      }

      const rootNode = node.getRootNode?.();
      node = node.parentElement || rootNode?.host || null;
    }
  }

  function collectFileInputsFromRoot(root, addCandidate, visitedRoots) {
    if (!root || visitedRoots.has(root)) return;
    visitedRoots.add(root);

    try {
      root.querySelectorAll?.("input[type='file']").forEach((candidate) => {
        addCandidate(candidate, root === document ? "document" : "shadow-root");
      });
    } catch {
      // Some host-controlled roots can reject selectors; skip them and keep scanning others.
    }

    let elements = [];
    try {
      elements = Array.from(root.querySelectorAll?.("*") || []);
    } catch {
      elements = [];
    }

    elements.forEach((element) => {
      if (element?.shadowRoot) {
        collectFileInputsFromRoot(element.shadowRoot, addCandidate, visitedRoots);
      }
    });
  }

  function describeUploadTriggerForDebug(trigger, source = "") {
    return describeElementForDebug(trigger, source);
  }

  function collectFileHandoffElementsFromRoot(root, addInput, addUploadTrigger, visitedRoots, stats) {
    if (!root || visitedRoots.has(root)) return;
    visitedRoots.add(root);

    try {
      root.querySelectorAll?.("input[type='file']").forEach((candidate) => {
        addInput(candidate, root === document ? "document" : "shadow-root");
      });
    } catch {
      // Host-controlled roots can reject selectors; keep scanning other roots.
    }

    const uploadSelectors = [
      'button[aria-label="Add files"]',
      'button[aria-label="Open upload file menu"]',
      '[role="button"][aria-label*="add files" i]',
      '[role="button"][aria-label*="upload" i]',
      'button[aria-label*="upload" i]',
      'button[aria-label*="file" i]',
      'button[aria-label*="attach" i]',
      "button"
    ];
    for (const selector of uploadSelectors) {
      try {
        root.querySelectorAll?.(selector).forEach((candidate) => {
          addUploadTrigger(candidate, selector, root === document ? "document" : "shadow-root");
        });
      } catch {
        // Case-insensitive attribute selectors are not universally available in synthetic DOMs.
      }
    }

    let elements = [];
    try {
      elements = Array.from(root.querySelectorAll?.("*") || []);
    } catch {
      elements = [];
    }

    elements.forEach((element) => {
      if (element?.shadowRoot) {
        if (stats) {
          stats.openShadowRootCount += 1;
        }
        collectFileHandoffElementsFromRoot(element.shadowRoot, addInput, addUploadTrigger, visitedRoots, stats);
      }
    });
  }

  function isWithinGeminiImagesFilesUploader(candidate) {
    let node = candidate;
    const visited = new WeakSet();

    while (node && !visited.has(node)) {
      visited.add(node);
      if (String(node.tagName || "").toLowerCase() === "images-files-uploader") {
        return true;
      }
      try {
        if (typeof node.closest === "function" && node.closest("images-files-uploader")) {
          return true;
        }
      } catch {
        // Synthetic DOMs and host-controlled roots can reject custom selectors.
      }
      const rootNode = node.getRootNode?.();
      node = node.parentElement || rootNode?.host || null;
    }

    return false;
  }

  function scoreGeminiFileInput(candidate, source = "") {
    if (!isFileInputElement(candidate) || candidate.disabled) return -1;
    let score = 0;
    const name = String(candidate.name || candidate.getAttribute?.("name") || "");
    if (name === "Filedata") score += 80;
    if (isWithinGeminiImagesFilesUploader(candidate)) score += 100;
    if (candidate.multiple) score += 30;
    if (/images-files-uploader/i.test(String(source || ""))) score += 25;
    if (candidate.hidden) score += 5;
    const accept = String(candidate.accept || "").toLowerCase();
    if (accept.includes("text") || accept.includes(".txt") || accept.includes(".md") || accept.includes(".json")) {
      score += 10;
    }
    return score;
  }

  function discoverGeminiFileHandoffElements(event, input) {
    const inputs = [];
    const uploadTriggers = [];
    const seenInputs = new WeakSet();
    const seenTriggers = new WeakSet();
    const stats = { openShadowRootCount: 0 };
    const addInput = (candidate, source = "") => {
      if (!isFileInputElement(candidate) || seenInputs.has(candidate)) return;
      seenInputs.add(candidate);
      inputs.push({ input: candidate, source });
    };
    const addUploadTrigger = (candidate, selector = "", source = "") => {
      if (!candidate || seenTriggers.has(candidate)) return;
      seenTriggers.add(candidate);
      uploadTriggers.push({ trigger: candidate, selector, source });
    };

    collectFileInputsFromAncestry(event?.target, addInput);

    const target = normalizeTarget(event?.target);
    const preferredInputSelectors = [
      "input[type='file'][accept*='text']",
      "input[type='file'][accept*='.txt']",
      "input[type='file'][accept*='.md']",
      "input[type='file'][accept*='.json']",
      "input[type='file'][accept*='.csv']",
      "input[type='file']"
    ];
    for (const selector of preferredInputSelectors) {
      try {
        target?.closest?.("[role='dialog'], form, main, body")?.querySelectorAll?.(selector).forEach((candidate) => {
          addInput(candidate, "target-scope");
        });
      } catch {
        // Host-controlled selectors can fail; broader discovery below remains fail-closed.
      }
    }
    target?.closest?.("form")?.querySelectorAll?.("input[type='file']").forEach((candidate) => {
      addInput(candidate, "target-form");
    });
    input?.closest?.("form")?.querySelectorAll?.("input[type='file']").forEach((candidate) => {
      addInput(candidate, "composer-form");
    });

    collectFileHandoffElementsFromRoot(document, addInput, addUploadTrigger, new WeakSet(), stats);

    const fileInput =
      inputs
        .filter(({ input: candidate }) => !candidate.disabled)
        .sort((a, b) => scoreGeminiFileInput(b.input, b.source) - scoreGeminiFileInput(a.input, a.source))[0]
        ?.input || null;
    const uploadTrigger =
      uploadTriggers.find(({ trigger }) => {
        const meta = describeUploadTriggerForDebug(trigger);
        const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""}`.toLowerCase();
        return !trigger.disabled && /\badd files?\b/.test(haystack);
      })?.trigger ||
      uploadTriggers.find(({ trigger }) => {
        const label = trigger.getAttribute?.("aria-label") || trigger.ariaLabel || "";
        return label === "Open upload file menu" && !trigger.disabled;
      })?.trigger ||
      uploadTriggers.find(({ trigger }) => isSafeGeminiUploadMenuButton(trigger))?.trigger ||
      uploadTriggers.find(({ trigger }) => !trigger.disabled)?.trigger ||
      null;

    return {
      fileInput,
      uploadTrigger,
      fileInputCount: inputs.length,
      uploadTriggerCount: uploadTriggers.length,
      openShadowRootCount: stats.openShadowRootCount,
      fileInputs: inputs,
      uploadTriggers
    };
  }

  function collectRootsWithOpenShadow(root, roots, visitedRoots, stats) {
    if (!root || visitedRoots.has(root)) return;
    visitedRoots.add(root);
    roots.push(root);

    let elements = [];
    try {
      elements = Array.from(root.querySelectorAll?.("*") || []);
    } catch {
      elements = [];
    }

    elements.forEach((element) => {
      if (element?.shadowRoot) {
        if (stats) stats.openShadowRootCount += 1;
        collectRootsWithOpenShadow(element.shadowRoot, roots, visitedRoots, stats);
      }
    });
  }

  function candidateMatchesAnySelector(candidate, selectors) {
    if (!candidate || !Array.isArray(selectors)) return false;
    return selectors.some((selector) => {
      try {
        return Boolean(candidate.matches?.(selector));
      } catch {
        return false;
      }
    });
  }

  function getAdapterUploadClickCandidates(eventOrTarget) {
    const rawCandidates = [];
    try {
      if (typeof eventOrTarget?.composedPath === "function") {
        rawCandidates.push(...eventOrTarget.composedPath());
      }
    } catch {
      // Host event paths are best-effort.
    }
    rawCandidates.push(eventOrTarget?.target || eventOrTarget);

    const candidates = [];
    const seen = new WeakSet();
    for (const rawCandidate of rawCandidates) {
      const candidate = normalizeTarget(rawCandidate);
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      candidates.push(candidate);

      try {
        const closest = candidate.closest?.("button, label, input[type='file'], [role='button'], [role='menuitem']");
        if (closest && !seen.has(closest)) {
          seen.add(closest);
          candidates.push(closest);
        }
      } catch {
        // Synthetic and host-controlled nodes can reject selectors.
      }
    }
    return candidates;
  }

  function isUnsafeFileHandoffClickTarget(adapter, candidate) {
    if (!candidate) return true;
    if (candidate.disabled) return true;
    if (candidateMatchesAnySelector(candidate, adapter?.unsafeClickSelectors || [])) return true;
    const meta = describeElementForDebug(candidate);
    const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""} ${meta?.className || ""}`.toLowerCase();
    return /\b(?:send|submit|mic|microphone|voice|record|settings|close|remove|delete|drive|photos?|cloud|import)\b/.test(
      haystack
    );
  }

  function isLikelyGenericUploadClickTarget(adapter, eventOrTarget) {
    return getAdapterUploadClickCandidates(eventOrTarget).some((candidate) => {
      if (!candidate || isUnsafeFileHandoffClickTarget(adapter, candidate)) return false;
      if (isFileInputElement(candidate)) return true;

      const tag = String(candidate.tagName || "").toUpperCase();
      const meta = describeElementForDebug(candidate);
      const role = String(meta?.role || "").toLowerCase();
      if (tag !== "BUTTON" && tag !== "LABEL" && tag !== "INPUT" && role !== "button" && role !== "menuitem") {
        return false;
      }
      if (candidateMatchesAnySelector(candidate, adapter?.uploadButtonSelectors || [])) return true;
      if (candidateMatchesAnySelector(candidate, adapter?.uploadMenuItemSelectors || [])) return true;

      const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""} ${meta?.className || ""}`.toLowerCase();
      return /\b(?:upload|attach|files?|add)\b/.test(haystack);
    });
  }

  function collectAdapterSelectorCandidates(adapter, selectors, event, input) {
    const candidates = [];
    const seen = new WeakSet();
    const addCandidate = (candidate, source = "") => {
      const normalized = normalizeTarget(candidate);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push({ candidate: normalized, source });
    };

    const target = normalizeTarget(event?.target);
    for (const selector of selectors || []) {
      try {
        target?.closest?.("[role='dialog'], form, main, body")?.querySelectorAll?.(selector).forEach((candidate) => {
          addCandidate(candidate, "target-scope");
        });
      } catch {
        // Keep broad discovery available below.
      }
      try {
        input?.closest?.("form")?.querySelectorAll?.(selector).forEach((candidate) => {
          addCandidate(candidate, "composer-form");
        });
      } catch {
        // Continue best-effort discovery.
      }
    }

    const roots = [];
    collectRootsWithOpenShadow(document, roots, new WeakSet(), null);
    for (const root of roots) {
      for (const selector of selectors || []) {
        try {
          root.querySelectorAll?.(selector).forEach((candidate) => {
            addCandidate(candidate, root === document ? "document" : "shadow-root");
          });
        } catch {
          // Some adapter selectors are intentionally modern and may not parse everywhere.
        }
      }
    }

    return candidates;
  }

  function resolveGenericAdapterFileInput(adapter, event, input) {
    const candidates = collectAdapterSelectorCandidates(adapter, adapter?.fileInputSelectors || ["input[type='file']"], event, input)
      .map(({ candidate }) => candidate)
      .filter((candidate) => isFileInputElement(candidate) && !candidate.disabled);
    if (candidates.length) return candidates[0];
    return resolveFileInputForHandoff(event, input);
  }

  function findGenericAdapterUploadTrigger(adapter, event, input) {
    const candidates = collectAdapterSelectorCandidates(adapter, adapter?.uploadButtonSelectors || [], event, input)
      .map(({ candidate }) => candidate)
      .filter((candidate) => !isFileInputElement(candidate) && isLikelyGenericUploadClickTarget(adapter, candidate));
    return candidates[0] || null;
  }

  function activateAdapterUploadElementSafely(adapter, candidate) {
    if (!candidate || isFileInputElement(candidate) || isUnsafeFileHandoffClickTarget(adapter, candidate)) {
      return false;
    }
    if (!isLikelyGenericUploadClickTarget(adapter, candidate)) return false;
    try {
      for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
        candidate.dispatchEvent(createGeminiUploadMenuEvent(type));
      }
      return true;
    } catch {
      return false;
    }
  }

  async function waitForGenericAdapterFileInput(adapter, timeoutMs = 2500, event = null, input = null) {
    let fileInput = adapter?.resolveFileInput?.(event, input, adapter) || resolveGenericAdapterFileInput(adapter, event, input);
    if (fileInput) return fileInput;
    if (typeof MutationObserver !== "function") return null;

    return await new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let timeoutId = 0;
      const finish = (force = false) => {
        if (settled) return;
        fileInput = adapter?.resolveFileInput?.(event, input, adapter) || resolveGenericAdapterFileInput(adapter, event, input);
        if (!fileInput && !force) return;
        settled = true;
        if (observer) {
          try {
            observer.disconnect();
          } catch {
            // Best-effort cleanup only.
          }
        }
        if (timeoutId) clearTimeout(timeoutId);
        resolve(fileInput || null);
      };

      try {
        observer = new MutationObserver(() => finish(false));
        observer.observe(document.documentElement || document, {
          childList: true,
          subtree: true
        });
      } catch {
        observer = null;
      }
      setTimeout(() => finish(false), 0);
      timeoutId = setTimeout(() => finish(true), timeoutMs);
    });
  }

  async function attachGenericPendingWithTrustedActivation(adapter, pending) {
    if (!adapter || !isFileHandoffAdapterPendingAttachEnabled(adapter) || !pending?.sanitizedFile) {
      return false;
    }
    const event = pending.event || { type: `pending-${adapter.id}-sanitized-file`, target: pending.target || null };
    let fileInput = adapter.resolveFileInput?.(event, pending.input, adapter) || resolveGenericAdapterFileInput(adapter, event, pending.input);

    if (!fileInput) {
      const uploadTrigger =
        adapter.resolveUploadTrigger?.(event, pending.input, adapter) ||
        findGenericAdapterUploadTrigger(adapter, event, pending.input);
      if (uploadTrigger) {
        activateAdapterUploadElementSafely(adapter, uploadTrigger);
      }
      const menuItem = adapter.resolveUploadMenuItem?.(event, pending.input, adapter);
      if (menuItem) {
        activateAdapterUploadElementSafely(adapter, menuItem);
      }
      fileInput = await waitForGenericAdapterFileInput(adapter, 2500, event, pending.input);
    }

    if (!fileInput) {
      debugReveal("file-handoff:pending-input-not-found", {
        site: adapter.id,
        adapter: describeFileHandoffAdapter(adapter),
        sanitizedFile: describeFileForDebug(pending.sanitizedFile)
      });
      return false;
    }

    debugReveal("file-handoff:pending-input-captured", {
      site: adapter.id,
      input: describeFileInputForDebug(fileInput, `pending-${adapter.id}-file-input`),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
    const details = createSanitizedFileHandoffDetails(event, pending.sanitizedFile, `${adapter.id}:pending-user-attach`);
    const transfer = createSanitizedDataTransferForHandoff(pending.sanitizedFile, details);
    const assigned = transfer
      ? handOffSanitizedFileInput(fileInput, transfer, {
          dispatchInput: true,
          details
        })
      : false;
    if (!assigned) {
      details.failureReason = details.failureReason || "pending_user_attach_assignment_failed";
      logSanitizedFileHandoffFailure(details);
      return false;
    }
    debugReveal("file-handoff:pending-assigned", {
      site: adapter.id,
      input: describeFileInputForDebug(fileInput, `pending-${adapter.id}-file-input`),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
    clearPendingSanitizedFileHandoff(adapter, "assigned");
    return true;
  }

  function isRejectedGeminiUploadMenuItem(candidate) {
    const meta = describeElementForDebug(candidate);
    const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""}`.toLowerCase();
    return haystack.includes("drive") || haystack.includes("photos") || haystack.includes("notebooklm");
  }

  function scoreGeminiUploadMenuItem(candidate) {
    if (!candidate || isRejectedGeminiUploadMenuItem(candidate)) return 0;
    const meta = describeElementForDebug(candidate);
    const label = meta?.ariaLabel || "";
    const text = meta?.textSnippet || "";
    const role = meta?.role || "";
    if (role === "menuitem" && label === "Upload files. Documents, data, code files") return 100;
    if (role === "menuitem" && /^files$/i.test(label || text)) return 95;
    if (role === "menuitem" && /upload files/i.test(label)) return 80;
    if (role === "menuitem" && /upload files/i.test(text)) return 70;
    if (/\bfiles\b/i.test(label) || /\bfiles\b/i.test(text)) return 60;
    if (/upload files/i.test(label) || /upload files/i.test(text)) return 50;
    return 0;
  }

  function discoverGeminiUploadOverlayItem(details) {
    const roots = [];
    const stats = { openShadowRootCount: 0 };
    collectRootsWithOpenShadow(document, roots, new WeakSet(), stats);
    const candidates = [];
    const seen = new WeakSet();
    const selectors = [
      ".cdk-overlay-container",
      ".cdk-overlay-pane",
      'mat-action-list[role="menu"]',
      '[role="menuitem"]',
      "button"
    ];

    const addCandidate = (candidate, source) => {
      if (!candidate || seen.has(candidate)) return;
      seen.add(candidate);
      if (candidate.matches?.(".cdk-overlay-container, .cdk-overlay-pane, mat-action-list")) {
        return;
      }
      const score = scoreGeminiUploadMenuItem(candidate);
      candidates.push({ candidate, source, score });
    };

    roots.forEach((root) => {
      selectors.forEach((selector) => {
        try {
          root.querySelectorAll?.(selector).forEach((candidate) => addCandidate(candidate, selector));
        } catch {
          // Keep diagnostics best-effort.
        }
      });
    });

    const selected = candidates
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0]?.candidate || null;

    if (details) {
      details.openShadowRootCount = Math.max(Number(details.openShadowRootCount || 0), stats.openShadowRootCount);
      details.overlayItemCount = candidates.length;
      details.overlayCandidates = candidates
        .slice(0, 20)
        .map(({ candidate, source, score }) => ({
          ...describeElementForDebug(candidate, source),
          score
        }));
      details.selectedOverlayItem = describeElementForDebug(selected, "gemini-upload-overlay-item");
    }

    return selected;
  }

  function discoverFileInputForHandoff(event, input) {
    const candidates = [];
    const seen = new WeakSet();
    const addCandidate = (candidate, source = "") => {
      if (!isFileInputElement(candidate) || seen.has(candidate)) return;
      seen.add(candidate);
      candidates.push({ input: candidate, source });
    };

    collectFileInputsFromAncestry(event?.target, addCandidate);

    const target = normalizeTarget(event?.target);
    const preferredSelectors = [
      "input[type='file'][accept*='text']",
      "input[type='file'][accept*='.txt']",
      "input[type='file'][accept*='.md']",
      "input[type='file'][accept*='.json']",
      "input[type='file'][accept*='.csv']",
      "input[type='file']"
    ];
    for (const selector of preferredSelectors) {
      try {
        target?.closest?.("[role='dialog'], form, main, body")?.querySelectorAll?.(selector).forEach((candidate) => {
          addCandidate(candidate, "target-scope");
        });
      } catch {
        // Host-controlled selectors can fail; broader discovery below remains fail-closed.
      }
    }
    target?.closest?.("form")?.querySelectorAll?.("input[type='file']").forEach((candidate) => {
      addCandidate(candidate, "target-form");
    });
    input?.closest?.("form")?.querySelectorAll?.("input[type='file']").forEach((candidate) => {
      addCandidate(candidate, "composer-form");
    });
    collectFileInputsFromRoot(document, addCandidate, new WeakSet());

    const fileInput = candidates.find(({ input: candidate }) => !candidate.disabled)?.input || null;
    debugReveal(`file-drag:input-${fileInput ? "found" : "not-found"}`, {
      targetTag: target?.tagName || "",
      candidateCount: candidates.length,
      candidates: candidates.map(({ input: candidate, source }) =>
        describeFileInputForDebug(candidate, source)
      )
    });

    return fileInput;
  }

  async function waitForGeminiUploadMenuInput() {
    await new Promise((resolve) => {
      let done = false;
      let observer = null;
      const finish = () => {
        if (done) return;
        done = true;
        if (observer) {
          try {
            observer.disconnect();
          } catch {
            // Best-effort cleanup only.
          }
        }
        resolve();
      };
      const finishIfInputExists = () => {
        try {
          if (document.querySelector?.("input[type='file']")) {
            finish();
          }
        } catch {
          // Continue waiting; final discovery remains fail-closed.
        }
      };
      if (typeof MutationObserver === "function") {
        try {
          observer = new MutationObserver(finishIfInputExists);
          observer.observe(document.documentElement || document, {
            childList: true,
            subtree: true
          });
        } catch {
          observer = null;
        }
      }
      const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
      if (raf) {
        try {
          raf(() => {
            try {
              raf(finishIfInputExists);
            } catch {
              finishIfInputExists();
            }
          });
        } catch {
          setTimeout(finishIfInputExists, 0);
        }
      } else {
        setTimeout(finishIfInputExists, 0);
      }
      setTimeout(finish, GEMINI_UPLOAD_INPUT_WAIT_MS);
    });
  }

  function resolveFileInputForHandoff(event, input) {
    if (fileDragDiscoveryCompleted) {
      return isFileInputElement(lastDiscoveredFileInput) && !lastDiscoveredFileInput.disabled
        ? lastDiscoveredFileInput
        : null;
    }

    const fileInput = discoverFileInputForHandoff(event, input);
    lastDiscoveredFileInput = fileInput;
    fileDragDiscoveryCompleted = true;
    fileDragDiscoveryScheduled = false;
    return fileInput;
  }

  function scheduleFileInputDiscovery(event, input = null) {
    if (fileDragDiscoveryCompleted || fileDragDiscoveryScheduled) return;

    const sessionId = fileDragSessionId;
    const target = event?.target || null;
    fileDragDiscoveryScheduled = true;
    debugReveal("file-drag:discovery-started", {
      trigger: event?.type || "",
      targetTag: normalizeTarget(target)?.tagName || ""
    });

    fileDragDiscoveryTimer = setTimeout(() => {
      fileDragDiscoveryTimer = 0;
      if (sessionId !== fileDragSessionId) return;
      resolveFileInputForHandoff({ target }, input);
    }, 0);
  }

  function handleFileDragDetected(event) {
    scheduleFileDragSessionReset();
    if (getCurrentHandoffDriver()?.usesDmzOverlay && dataTransferLooksLikeFiles(event?.dataTransfer)) {
      setDmzOverlayState("Drop file to sanitize with LeakGuard", "ready");
    }
    if (!fileDragDetectedLogged) {
      fileDragDetectedLogged = true;
      debugReveal("file-drag:detected", {
        type: event?.type || "",
        targetTag: normalizeTarget(event?.target)?.tagName || ""
      });
    }
    scheduleFileInputDiscovery(event);
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
    try {
      fileInput.files = transfer.files;
      if (details) details.inputFilesAssignmentSucceeded = true;
      if (Number(fileInput.files?.length || 0) <= 0) {
        if (details) details.failureReason = "input_files_assignment_empty";
        return false;
      }
      if (markAsSanitized) {
        markSanitizedFileHandoff(fileInput, fileInput.files, { details });
      } else {
        sanitizedFileInputHandoffs.add(fileInput);
      }
      if (isFirefoxRuntime() && isProtectedFileDropDriver(getCurrentHandoffDriverId())) {
        markFirefoxFileInputTransactionReplaced(fileInput, fileInput.files);
      }
      if (dispatchInputEvent) {
        fileInput.dispatchEvent(
          new Event("input", {
            bubbles: true,
            cancelable: true,
            composed: true
          })
        );
        events.push("input");
        if (details) details.inputEventDispatched = true;
      }
      fileInput.dispatchEvent(
        new Event("change", {
          bubbles: true,
          cancelable: true,
          composed: true
        })
      );
      events.push("change");
      if (details) details.changeEventDispatched = true;
      debugFileAttachMetadata("file-handoff:assignment-success", {
        input: describeFileInputForDebug(fileInput, "resolved"),
        files: Array.from(fileInput.files || []).map(describeFileForDebug),
        events
      });
      logFileInterception("file replacement success", {
        input: describeFileInputForDebug(fileInput, "resolved"),
        files: Array.from(fileInput.files || []).map(describeFileForDebug),
        events
      });
      return true;
    } catch (error) {
      if (details) {
        details.failureReason = "input_assignment_or_event_dispatch_failed";
        details.errorMessage = error?.message || String(error);
        details.errorStack = error?.stack || "";
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
    }
  }

  function isForbiddenGeminiUploadButton(candidate) {
    const className = String(candidate?.className || candidate?.getAttribute?.("class") || "");
    return /\bhidden-local-(?:file-image-selector|upload|file-upload)-button\b/.test(className);
  }

  function isAllowedGeminiUploadMenuOpener(candidate) {
    if (!candidate || isForbiddenGeminiUploadButton(candidate)) return false;
    if (!isGeminiUploadMenuButtonVisible(candidate)) return false;
    if (hasGeminiUploadMenuIntent(describeElementForDebug(candidate)) && !isUnsafeGeminiUploadMenuButton(candidate)) {
      return true;
    }
    return isSafeGeminiUploadMenuButton(candidate);
  }

  function clickElementSafely(candidate) {
    if (!candidate || isForbiddenGeminiUploadButton(candidate) || !isGeminiUploadMenuButtonVisible(candidate)) return false;
    try {
      candidate.click?.();
      return true;
    } catch {
      try {
        candidate.dispatchEvent?.(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true
          })
        );
        return true;
      } catch {
        return false;
      }
    }
  }

  function isGeminiGhostIngressFileInput(candidate) {
    if (!isGeminiHost() || !isFileInputElement(candidate)) return false;
    const name = candidate.getAttribute?.("name") || candidate.name || "";
    if (name === "Filedata") return true;
    try {
      if (candidate.matches?.('input[type="file"][name="Filedata"]')) return true;
    } catch {
      // Selector support varies in synthetic and host-controlled DOMs.
    }
    return isWithinGeminiImagesFilesUploader(candidate);
  }

  function clearPendingGeminiGhostIngressClickInterceptor(reason = "") {
    if (typeof pendingGeminiGhostIngressClickCleanup !== "function") return;
    const cleanup = pendingGeminiGhostIngressClickCleanup;
    pendingGeminiGhostIngressClickCleanup = null;
    try {
      cleanup(reason);
    } catch {
      debugReveal("file-handoff:ghost-ingress-cleanup-failed", {
        site: "gemini",
        phase: "click-interceptor-cleanup",
        reason,
        hadCleanup: true
      });
    }
  }

  function createGeminiGhostIngressClickInterceptor(sanitizedFile, details, onFinished) {
    if (!isGeminiHost() || !sanitizedFile) return null;
    const clickRoots = [];
    if (typeof window !== "undefined" && typeof window?.addEventListener === "function") {
      clickRoots.push(window);
    }
    if (typeof document !== "undefined" && typeof document?.addEventListener === "function") {
      clickRoots.push(document);
    }
    if (!clickRoots.length) return null;

    let cleaned = false;
    let timeoutId = 0;
    const guardedEventTypes = ["pointerdown", "mousedown", "click"];
    const handler = (clickEvent) => {
      const candidates = [];
      try {
        if (typeof clickEvent?.composedPath === "function") {
          candidates.push(...clickEvent.composedPath());
        }
      } catch {
        // Host event paths are best-effort.
      }
      candidates.push(clickEvent?.target);
      const target = candidates.map(normalizeTarget).find(isGeminiGhostIngressFileInput);
      if (!isGeminiHost() || !sanitizedFile) {
        return;
      }
      if (!isGeminiGhostIngressFileInput(target)) return;

      consumeInterceptionEvent(clickEvent);
      details.handoffStage = "gemini:ghost-ingress-file-input-click";
      const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, details);
      const assigned = transfer
        ? handOffSanitizedFileInput(target, transfer, {
            dispatchInput: true,
            details
          })
        : false;
      if (!assigned) {
        details.failureReason = details.failureReason || "ghost_ingress_click_assignment_failed";
        if (typeof onFinished === "function") {
          onFinished(null, details.failureReason);
        }
        clearPendingGeminiGhostIngressClickInterceptor("assignment-failed");
        return;
      }
      if (typeof onFinished === "function") {
        onFinished(target, "ghost_ingress_click_assigned");
      }
      clearPendingGeminiGhostIngressClickInterceptor("assigned");
    };

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = 0;
      }
      for (const root of clickRoots) {
        for (const type of guardedEventTypes) {
          try {
            root.removeEventListener(type, handler, true);
          } catch {
            // Best-effort cleanup only.
          }
        }
      }
    };

    clearPendingGeminiGhostIngressClickInterceptor("replaced");
    for (const root of clickRoots) {
      for (const type of guardedEventTypes) {
        root.addEventListener(type, handler, true);
      }
    }
    timeoutId = setTimeout(() => {
      clearPendingGeminiGhostIngressClickInterceptor("timeout");
    }, GEMINI_GHOST_INGRESS_TIMEOUT_MS);
    pendingGeminiGhostIngressClickCleanup = cleanup;
    return { cleanup };
  }

  async function waitForGeminiGhostIngressFileInput(event, input, details, sanitizedFile) {
    let discovery = discoverGeminiFileHandoffElements(event, input);
    if (discovery.fileInput) {
      return { discovery, fileInput: discovery.fileInput };
    }

    const uploadTrigger = discovery.uploadTrigger;
    details.foundTopUploadTrigger = Boolean(uploadTrigger);
    details.uploadTrigger = describeUploadTriggerForDebug(uploadTrigger, "gemini-upload-trigger");

    if (!isAllowedGeminiUploadMenuOpener(uploadTrigger)) {
      details.failureReason = uploadTrigger ? "unsafe_upload_trigger" : "no_upload_trigger";
      return { discovery, fileInput: null };
    }

    return await new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let timeoutId = 0;
      let clickAssignedInput = null;

      const finish = (reason = "", assignedInput = null) => {
        if (settled) return;
        discovery = discoverGeminiFileHandoffElements(event, input);
        const fileInput = assignedInput || discovery.fileInput;
        if (!fileInput && !reason) return;
        settled = true;
        clearPendingGeminiGhostIngressClickInterceptor(reason || "finished");
        if (observer) {
          try {
            observer.disconnect();
          } catch {
            // Best-effort cleanup only.
          }
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount;
        details.openShadowRootCount = Math.max(details.openShadowRootCount, discovery.openShadowRootCount);
        if (!fileInput && reason) {
          details.failureReason = reason;
          if (suppressStaleHandoffErrorAfterSuccess(reason, "gemini", sanitizedFile)) {
            resolve({ discovery, fileInput: null, staleSuccess: true });
            return;
          }
        }
        resolve({ discovery, fileInput });
      };

      const activateFirefoxHiddenSelector = (trigger = null) => {
        if (settled || !isFirefoxRuntime()) return false;
        const hiddenTrigger = isGeminiHiddenFileSelectorTrigger(trigger)
          ? trigger
          : findGeminiHiddenFileSelectorTrigger();
        if (!hiddenTrigger) return false;
        details.handoffStage = "gemini:ghost-ingress-hidden-selector";
        debugReveal("file-handoff:gemini-firefox-prime-hidden-trigger-found", {
          trigger: describeElementForDebug(hiddenTrigger, "gemini-hidden-file-selector-trigger")
        });
        if (!activateGeminiHiddenFileSelectorTriggerSafely(hiddenTrigger)) {
          return false;
        }
        debugReveal("file-handoff:gemini-firefox-prime-hidden-trigger-clicked", {
          trigger: describeElementForDebug(hiddenTrigger, "gemini-hidden-file-selector-trigger")
        });
        finish();
        return true;
      };

      createGeminiGhostIngressClickInterceptor(sanitizedFile, details, (assignedInput, reason) => {
        clickAssignedInput = assignedInput;
        finish(reason || "ghost_ingress_click_assigned", assignedInput);
      });

      if (typeof MutationObserver === "function") {
        try {
          observer = new MutationObserver((mutations) => {
            finish();
            if (!settled && isFirefoxRuntime()) {
              activateFirefoxHiddenSelector(findGeminiHiddenFileSelectorTriggerInMutations(mutations));
            }
          });
          observer.observe(document.documentElement || document, {
            childList: true,
            subtree: true
          });
        } catch {
          observer = null;
        }
      }

      timeoutId = setTimeout(() => {
        finish("ghost_ingress_timeout", clickAssignedInput);
      }, GEMINI_GHOST_INGRESS_TIMEOUT_MS);

      details.handoffStage = "gemini:ghost-ingress-menu-open";
      const opened = clickElementSafely(uploadTrigger);
      if (!opened) {
        finish("top_upload_trigger_click_failed");
        return;
      }

      finish();
      setTimeout(() => {
        if (settled) return;
        details.handoffStage = "gemini:ghost-ingress-overlay-item";
        const overlayItem = discoverGeminiUploadOverlayItem(details);
        const overlayClicked =
          overlayItem &&
          (isFirefoxRuntime()
            ? openGeminiUploadFilesMenuItemSafely(overlayItem)
            : clickElementSafely(overlayItem));
        if (overlayClicked) {
          finish();
        }
        activateFirefoxHiddenSelector();
      }, 0);
    });
  }

  async function handOffGeminiSanitizedFileUpload(event, input, sanitizedFile, options) {
    if (!isGeminiHost()) return false;
    if (shouldUseFirefoxTextFallbackForFileHandoff()) return false;

    const details = createSanitizedFileHandoffDetails(event, sanitizedFile, "gemini:start");
    const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, details);
    if (!transfer) {
      details.handoffStage = "gemini:data-transfer";
      details.failureReason = "data_transfer_failed";
      debugReveal("file-handoff:gemini-data-transfer-create-failed", {
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    const cachedFileInput =
      fileDragDiscoveryCompleted && isFileInputElement(lastDiscoveredFileInput) && !lastDiscoveredFileInput.disabled
        ? lastDiscoveredFileInput
        : null;
    if (cachedFileInput) {
      details.handoffStage = "gemini:cached-input";
      details.fileInputCountBeforeClick = 1;
      const assigned = handOffSanitizedFileInput(cachedFileInput, transfer, {
        dispatchInput: true,
        details
      });
      if (!assigned) {
        logSanitizedFileHandoffFailure(details);
      }
      return assigned;
    }

    let discovery = discoverGeminiFileHandoffElements(event, input);
    let fileInput = discovery.fileInput;
    details.handoffStage = "gemini:initial-discovery";
    details.fileInputCountBeforeClick = discovery.fileInputCount;
    details.fileInputCountAfterTopTriggerClick = discovery.fileInputCount;
    details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount;
    details.openShadowRootCount = discovery.openShadowRootCount;
    const uploadTrigger = discovery.uploadTrigger;
    details.foundTopUploadTrigger = Boolean(uploadTrigger);
    details.uploadTrigger = describeUploadTriggerForDebug(uploadTrigger, "gemini-upload-trigger");
    const handoffOptions = options || {};
    const mayClickGeminiUploadUi =
      (!isFirefoxRuntime() || handoffOptions.allowUploadUiClick === true) &&
      (event?.type !== "drop" || handoffOptions.allowUploadUiClick === true);

    if (!fileInput && mayClickGeminiUploadUi) {
      const result = await waitForGeminiGhostIngressFileInput(event, input, details, sanitizedFile);
      discovery = result.discovery;
      fileInput = result.fileInput;
      if (result.staleSuccess) {
        return true;
      }
      details.fileInputCountAfterTopTriggerClick = discovery.fileInputCount;
      details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount;
      details.openShadowRootCount = Math.max(details.openShadowRootCount, discovery.openShadowRootCount);
      if (fileInput && details.handoffStage === "gemini:ghost-ingress-file-input-click") {
        lastDiscoveredFileInput = fileInput;
        fileDragDiscoveryCompleted = true;
        fileDragDiscoveryScheduled = false;
        return true;
      }
    } else if (!fileInput) {
      details.failureReason = "no_file_input_without_opening_picker";
    }

    lastDiscoveredFileInput = fileInput;
    fileDragDiscoveryCompleted = true;
    fileDragDiscoveryScheduled = false;

    if (!fileInput) {
      details.handoffStage =
        details.failureReason === "no_overlay_upload_item"
          ? "gemini:no-overlay-upload-item"
          : details.failureReason === "no_file_input_without_opening_picker"
            ? "gemini:no-file-input-without-picker"
            : "gemini:no-file-input-after-overlay";
      if (!details.failureReason) {
        details.failureReason = uploadTrigger ? "no_file_input_after_overlay_click" : "no_upload_trigger";
      }
      debugReveal("file-handoff:gemini-input-not-found", {
        foundUploadTrigger: Boolean(uploadTrigger),
        trigger: describeUploadTriggerForDebug(uploadTrigger, "gemini-upload-trigger"),
        fileInputCountBeforeClick: details.fileInputCountBeforeClick,
        fileInputCountAfterClick: details.fileInputCountAfterTopTriggerClick,
        fileInputCountAfterOverlayItemClick: details.fileInputCountAfterOverlayItemClick,
        openShadowRootCount: details.openShadowRootCount,
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      if (shouldQueueFirefoxGeminiPendingSanitizedFileHandoff(event, sanitizedFile, details)) {
        const originalFailureReason = details.failureReason;
        const originalHandoffStage = details.handoffStage;
        if (queuePendingSanitizedFileHandoff(getFileHandoffAdapterById("gemini"), event, input, sanitizedFile, details)) {
          debugReveal("file-handoff:gemini-firefox-pending-queued-after-native-miss", {
            handoffStage: originalHandoffStage,
            failureReason: originalFailureReason,
            sanitizedFile: describeFileForDebug(sanitizedFile)
          });
          return false;
        }
      }
      if (isExpectedFirefoxGeminiNoPickerMiss(details)) {
        debugReveal("file-handoff:gemini-firefox-native-input-unavailable", {
          handoffStage: details.handoffStage,
          failureReason: details.failureReason,
          foundUploadTrigger: Boolean(uploadTrigger),
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return false;
      }
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    details.handoffStage = "gemini:file-input-assignment";
    const assigned = handOffSanitizedFileInput(fileInput, transfer, {
      dispatchInput: true,
      details
    });
    if (!assigned) {
      logSanitizedFileHandoffFailure(details);
    }
    return assigned;
  }

  function handOffGrokSanitizedFileUpload(event, input, sanitizedFile) {
    if (!isGrokHost()) return false;
    if (shouldUseFirefoxTextFallbackForFileHandoff()) return false;

    const details = createSanitizedFileHandoffDetails(event, sanitizedFile, "grok:start");
    const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, details);
    if (!transfer) {
      details.handoffStage = "grok:data-transfer";
      details.failureReason = "data_transfer_failed";
      debugReveal("file-handoff:grok-data-transfer-create-failed", {
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    details.handoffStage = "grok:file-input-discovery";
    const fileInput = resolveFileInputForHandoff(event, input);
    details.fileInputCountBeforeClick = fileInput ? 1 : 0;
    details.fileInputCountAfterTopTriggerClick = fileInput ? 1 : 0;
    details.fileInputCountAfterOverlayItemClick = fileInput ? 1 : 0;
    if (fileInput) {
      const assigned = handOffSanitizedFileInput(fileInput, transfer, { dispatchInput: true, details });
      if (assigned) {
        return true;
      }
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    const target = event?.target || input;
    try {
      transfer.dropEffect = "copy";
    } catch {
      // Some synthetic DataTransfer objects expose dropEffect as read-only.
    }

    if (dispatchSanitizedFileEvent(target, "drop", transfer)) {
      debugReveal("file-handoff:grok-drop-success", {
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      return true;
    }

    details.handoffStage = "grok:drop-dispatch";
    details.failureReason = "no_file_input_or_drop_target";
    debugReveal("file-handoff:grok-upload-failed", {
      sanitizedFile: describeFileForDebug(sanitizedFile)
    });
    logSanitizedFileHandoffFailure(details);
    return false;
  }

  async function applyGeminiSanitizedTextFallback(event, input, redactedText, options) {
    options = options || {};
    if (!isGeminiHost()) {
      return false;
    }

    if (!(await confirmGeminiLargeSanitizedTextInsertion(redactedText, "file-text-fallback"))) {
      setBadge("Sanitized text insertion cancelled");
      hideBadgeSoon(3200);
      refreshBadgeFromCurrentInput();
      return "cancelled";
    }

    const editor = resolveGeminiFallbackEditor(event, input);
    if (editor) {
      const inserted = await applyGeminiEditorText(
        editor,
        String(redactedText || ""),
        "file-text-fallback",
        {
          skipLargeConfirmation: true,
          rawInsertedText: options.rawInsertedText || ""
        }
      );
      if (inserted) {
        setBadge(GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE);
        hideBadgeSoon(5200);
        await showMessageModal("Sanitized content inserted as text", GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE);
        refreshBadgeFromCurrentInput();
        return true;
      }
    }

    const targetInput = input || findComposer(event?.target) || findComposer(document.activeElement);
    if (!targetInput) {
      debugReveal(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_TEXT_FALLBACK_UNAVAILABLE, {
        context: event?.type || "",
        reason: "composer_not_found"
      });
      return false;
    }

    const originalText = getInputText(targetInput);
    const selection = getSelectionOffsets(targetInput);
    const inserted = await applyPasteDecision(
      targetInput,
      originalText,
      selection,
      String(redactedText || ""),
      "file-text-fallback",
      { rawInsertedText: options.rawInsertedText || "" }
    );

    if (!inserted) {
      debugReveal(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_TEXT_FALLBACK_FAILED, {
        context: event?.type || "",
        reason: "composer_rewrite_failed"
      });
      return false;
    }

    debugReveal(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_TEXT_FALLBACK_SUCCESS, {
      context: event?.type || "",
      redactedLength: String(redactedText || "").length
    });
    setBadge(GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE);
    hideBadgeSoon(5200);
    await showMessageModal("Sanitized content inserted as text", GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE);
    refreshBadgeFromCurrentInput();
    return true;
  }

  async function applySanitizedTextFallback(event, input, redactedText, options) {
    options = options || {};
    const text = String(redactedText || "");
    if (!text) {
      return false;
    }

    if (isGeminiHost()) {
      return applyGeminiSanitizedTextFallback(event, input, text, options);
    }

    if (text.length > GEMINI_AUTO_INSERT_TEXT_LIMIT) {
      debugReveal(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_TEXT_FALLBACK_UNAVAILABLE, {
        context: event?.type || "",
        reason: "sanitized_text_too_large",
        redactedLength: text.length
      });
      return false;
    }

    const targetInput = input || findComposer(event?.target) || findComposer(document.activeElement);
    if (!targetInput) {
      debugReveal(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_TEXT_FALLBACK_UNAVAILABLE, {
        context: event?.type || "",
        reason: "composer_not_found"
      });
      return false;
    }

    const originalText = getInputText(targetInput);
    const selection = getSelectionOffsets(targetInput);
    const inserted = await applyPasteDecision(
      targetInput,
      originalText,
      selection,
      text,
      "file-text-fallback",
      { rawInsertedText: options.rawInsertedText || "" }
    );

    if (!inserted) {
      debugReveal(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_TEXT_FALLBACK_FAILED, {
        context: event?.type || "",
        reason: "composer_rewrite_failed"
      });
      return false;
    }

    debugReveal(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_TEXT_FALLBACK_SUCCESS, {
      context: event?.type || "",
      redactedLength: text.length
    });
    setBadge(LOCAL_FILE_SANITIZED_TEXT_FALLBACK_MESSAGE);
    hideBadgeSoon(5200);
    refreshBadgeFromCurrentInput();
    return true;
  }

  async function readSanitizedFileTextForFallback(sanitizedFile) {
    if (!sanitizedFile) return "";
    if (typeof sanitizedFile.text === "function") {
      return String(await sanitizedFile.text());
    }
    if (typeof sanitizedFile.text === "string") {
      return sanitizedFile.text;
    }
    return "";
  }

  async function insertGeminiLocalFileText(event, input, redactedText, options) {
    options = options || {};
    if (!isGeminiHost()) {
      return false;
    }

    if (!(await confirmGeminiLargeSanitizedTextInsertion(redactedText, "gemini-file-text"))) {
      setBadge("Sanitized text insertion cancelled");
      hideBadgeSoon(3200);
      refreshBadgeFromCurrentInput();
      return "cancelled";
    }

    const editor = resolveGeminiFallbackEditor(event, input);
    if (editor) {
      return applyGeminiEditorText(editor, String(redactedText || ""), "gemini-file-text", {
        skipLargeConfirmation: true,
        rawInsertedText: options.rawInsertedText || ""
      });
    }

    const targetInput = input || findComposer(event?.target) || findComposer(document.activeElement);
    if (!targetInput) {
      debugReveal("file-handoff:gemini-text-direct-unavailable", {
        context: event?.type || "",
        reason: "composer_not_found"
      });
      return false;
    }

    const originalText = getInputText(targetInput);
    const selection = getSelectionOffsets(targetInput);
    return applyPasteDecision(
      targetInput,
      originalText,
      selection,
      String(redactedText || ""),
      "gemini-file-text",
      { rawInsertedText: options.rawInsertedText || "" }
    );
  }

  async function maybeHandleLocalFileInsert(event, input, dataTransfer, context) {
    if (
      !extensionRuntimeAvailable ||
      modalOpen ||
      (event.defaultPrevented &&
        context !== "drop" &&
        !(context === "file-input" && (isGeminiHost() || (isFirefoxRuntime() && isProtectedFileDropDriver(getCurrentHandoffDriverId()))))) ||
      typeof readLocalTextFileFromDataTransfer !== "function" ||
      typeof createSanitizedTextFile !== "function" ||
      !dataTransferHasFiles(dataTransfer)
    ) {
      return false;
    }

    const transferPolicy = resolveLocalFileTransferPolicy(dataTransfer);
    if (transferPolicy.action === "allow") {
      if (shouldBlockUnsupportedFileTransfer(transferPolicy)) {
        if (!event.defaultPrevented) {
          consumeInterceptionEvent(event);
        }
        showFileProcessingError("Raw file upload blocked", {
          site: getCurrentHandoffDriverId(),
          reason: "firefox_unsupported_file_blocked"
        });
        hideFileProcessingOverlay("firefox_unsupported_file_blocked");
        setBadge("Raw file upload blocked");
        hideBadgeSoon(4200);
        await showMessageModal("Raw file upload blocked", getUnsupportedFileBlockedMessage(transferPolicy));
        refreshBadgeFromCurrentInput();
        return {
          handled: true,
          ok: false,
          reason: "firefox_unsupported_file_blocked"
        };
      }
      showUnsupportedFilePassThroughNotice(transferPolicy);
      return false;
    }

    if (transferPolicy.action === "block") {
      if (!event.defaultPrevented) {
        consumeInterceptionEvent(event);
      }
      showFileProcessingError("Raw file upload blocked", {
        site: getCurrentHandoffDriverId(),
        reason: transferPolicy.reason
      });
      hideFileProcessingOverlay(transferPolicy.reason || "transfer_policy_blocked");
      setBadge("Raw file upload blocked");
      hideBadgeSoon(4200);
      await showMessageModal("Raw file upload blocked", transferPolicy.message);
      refreshBadgeFromCurrentInput();
      return {
        handled: true,
        ok: false,
        reason: transferPolicy.reason
      };
    }

    if (!(event.defaultPrevented && context === "file-input" && isGeminiHost())) {
      consumeInterceptionEvent(event);
    }

    if (context === "file-input") {
      logFileInterception("file input intercepted", {
        files: listLocalTransferFiles(dataTransfer).map(describeFileForDebug),
        browser: isFirefoxRuntime() ? "firefox" : "other"
      });
    }

    const processingSite = getCurrentHandoffDriverId();
    const { failProcessing, hideProcessing, showProcessingSuccess } =
      globalThis.PWM.FileAttachPipeline.createProcessingStageControls({
        site: processingSite,
        showFileProcessingError,
        hideFileProcessingOverlay,
        showFileProcessingSuccess
      });

    showFileProcessingOverlay({
      site: processingSite,
      title: "LeakGuard is scanning this file...",
      status: "Scanning file locally...",
      progress: "In progress",
      blocking: true
    });

    try {
    const localFile = await readLocalTextFileFromDataTransfer(dataTransfer);
    if (context === "file-input") {
      logFileInterception("file scan result", {
        handled: Boolean(localFile.handled),
        ok: Boolean(localFile.ok),
        code: localFile.code || "",
        file: describeFileForDebug(localFile.file || localFile.sourceFile),
        textLength: typeof localFile.text === "string" ? localFile.text.length : 0
      });
    }
    const unavailableAfterHandoffSuppression =
      context === "file-input"
        ? getFileUnavailableAfterHandoffSuppression(event, dataTransfer, localFile)
        : null;
    if (unavailableAfterHandoffSuppression) {
      hideProcessing("suppressed-after-sanitized-handoff");
      return suppressFileUnavailableAfterHandoff(event, unavailableAfterHandoffSuppression, localFile);
    }
    if (!localFile.handled) {
      failProcessing(localFile.code || "file_scan_failed", "Raw file blocked");
      setBadge("Raw file blocked");
      hideBadgeSoon(4200);
      await showMessageModal(
        "Raw file blocked",
        localFile.message || "LeakGuard blocked raw file upload because local scanning failed."
      );
      refreshBadgeFromCurrentInput();
      return {
        handled: true,
        ok: false,
        reason: localFile.code || "file_scan_failed"
      };
    }

    if (event?.target?.tagName === "INPUT" && String(event.target.type || "").toLowerCase() === "file") {
      clearLocalFileInputSelection(event.target);
    }

    if (!localFile.ok) {
      if (localFile.code === "firefox_data_transfer_file_unavailable") {
        debugReveal("file-drop:firefox-data-transfer-file-unavailable", {
          reason: "firefox_data_transfer_file_unavailable"
        });
      }
      if (localFile.code === "streaming_required" && localFile.sourceFile) {
        updateFileProcessingOverlay({
          site: processingSite,
          status: "Stream-redacting large file locally...",
          progress: "",
          blocking: true
        });
        const streamResult = await streamRedactLocalTextFile(localFile.sourceFile, localFile.file);
        const isGeminiDrop = context === "drop" && isGeminiHost();
        const isGrokDrop = context === "drop" && isGrokHost();
        const streamingPlan = globalThis.PWM.FileAttachPipeline.classifyStreamingAttachPlan({
          context,
          isGeminiDrop,
          isGrokDrop,
          streamResultAction: streamResult.action,
          hasSanitizedFile: Boolean(streamResult.sanitizedFile)
        });
        if (streamingPlan.blockedResult.shouldBlock) {
          failProcessing(streamingPlan.blockedResult.reason, streamResult.title || STREAMING_BLOCK_TITLE);
          return blockStreamingLocalFile(
            event,
            streamResult.title || STREAMING_BLOCK_TITLE,
            streamResult.error || STREAMING_BLOCK_MESSAGE
          );
        }

        if (streamingPlan.failedResult.shouldBlock) {
          failProcessing(streamingPlan.failedResult.reason, streamingPlan.failedResult.title);
          return blockStreamingLocalFile(
            event,
            streamingPlan.failedResult.title,
            streamResult.error || streamingPlan.failedResult.message
          );
        }

        updateFileProcessingOverlay({
          site: processingSite,
          status: streamingPlan.preparingStatus.processingStatus,
          progress: streamingPlan.preparingStatus.processingProgress,
          blocking: streamingPlan.preparingStatus.processingBlocking
        });
        if (streamingPlan.pendingAttach.provider === "gemini") {
          const details = createSanitizedFileHandoffDetails(
            event,
            streamResult.sanitizedFile,
            streamingPlan.pendingAttach.detailsStage
          );

          hideProcessing("sanitized");
          if (
            queuePendingSanitizedFileHandoff(
              getFileHandoffAdapterById("gemini"),
              event,
              input,
              streamResult.sanitizedFile,
              details
            )
          ) {
            setBadge(getPendingSanitizedAttachPromptMessage("gemini"));
            hideBadgeSoon(6500);
            refreshBadgeFromCurrentInput();
            return {
              handled: true,
              ok: true,
              strategy: streamingPlan.pendingAttach.strategy
            };
          }
          showFileProcessingError(streamingPlan.pendingAttach.queueFailureTitle, {
            site: processingSite,
            reason: streamingPlan.pendingAttach.queueFailureReason
          });
          return blockStreamingLocalFile(
            event,
            streamingPlan.pendingAttach.queueFailureTitle,
            streamingPlan.pendingAttach.queueFailureMessage
          );
        }

        if (streamingPlan.pendingAttach.provider === "grok") {
          const details = createSanitizedFileHandoffDetails(
            event,
            streamResult.sanitizedFile,
            streamingPlan.pendingAttach.detailsStage
          );

          hideProcessing("sanitized");
          if (
            queuePendingSanitizedFileHandoff(
              getFileHandoffAdapterById("grok"),
              event,
              input,
              streamResult.sanitizedFile,
              details
            )
          ) {
            setBadge(getPendingSanitizedAttachPromptMessage("grok"));
            hideBadgeSoon(6500);
            refreshBadgeFromCurrentInput();
            return {
              handled: true,
              ok: true,
              strategy: streamingPlan.pendingAttach.strategy
            };
          }
          showFileProcessingError(streamingPlan.pendingAttach.queueFailureTitle, {
            site: processingSite,
            reason: streamingPlan.pendingAttach.queueFailureReason
          });
          return blockStreamingLocalFile(
            event,
            streamingPlan.pendingAttach.queueFailureTitle,
            streamingPlan.pendingAttach.queueFailureMessage
          );
        }

        const driver = getCurrentHandoffDriver();
        const payload = driver.preparePayload(streamResult.sanitizedFile, "", {
          localFile: localFile.sourceFile || localFile.file,
          analysis: null,
          result: null
        });
        payload.allowFileOnlyHandoff = true;
        payload.streamed = true;
        const handoffResult = await globalThis.PWM.FileAttachPipeline.runSanitizedPayloadHandoffOrder({
          context,
          tryDropHandoff: () =>
            driver.handoff(payload, { event, input, context, driver, composerResolved: true }),
          trySanitizedHandoff: () =>
            handOffSanitizedLocalFile(event, input, streamResult.sanitizedFile, context),
          shouldSkipFallback: () => context === "file-input" && isFirefoxRuntime() && isGeminiHost(),
          skipFallbackReason: streamingPlan.genericAttach.skipFallbackReason,
          insertFallbackText: () => driver.insertSanitizedText(payload, { event, input, context, driver }),
          fileStrategy: streamingPlan.genericAttach.fileStrategy,
          textStrategy: streamingPlan.genericAttach.textStrategy
        });
        const handoffClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
          handoffResult,
          context,
          defaultSuccessStrategy: streamingPlan.genericAttach.defaultSuccessStrategy,
          failureReason: streamingPlan.genericAttach.failureReason,
          treatCancellation: false
        });
        if (handoffClassification.ok) {
          const disposition = globalThis.PWM.FileAttachPipeline.classifyFileAttachDisposition({
            handoffClassification,
            context,
            forceDmzAttached: streamingPlan.dispositionOptions.forceDmzAttached,
            forceAttachedBadge: streamingPlan.dispositionOptions.forceAttachedBadge
          });
          if (disposition.shouldSetDmzAttached) {
            setDmzOverlayState(disposition.dmzStatus, disposition.dmzMode);
          }
          if (disposition.shouldHideProcessing) {
            hideProcessing(disposition.hideProcessingReason);
          } else if (disposition.shouldShowSuccess) {
            showProcessingSuccess(disposition.successStatus, disposition.successReason);
          }
          if (disposition.shouldShowAttachedBadge) {
            setBadge("LeakGuard attached a sanitized local file.");
            hideBadgeSoon(3200);
          }
          refreshBadgeFromCurrentInput();
          return {
            handled: true,
            ok: true,
            strategy: handoffClassification.strategy
          };
        }

        if (handoffClassification.shouldFailProcessing) {
          failProcessing(handoffClassification.reason, "Raw file upload blocked");
        }
        return blockStreamingLocalFile(
          event,
          streamingPlan.genericAttach.failureTitle,
          handoffResult.message || streamingPlan.genericAttach.failureMessage
        );
      }

      if (localFile.code === "file_too_large") {
        failProcessing(localFile.code || "file_too_large", STREAMING_BLOCK_TITLE);
        setBadge(STREAMING_BLOCK_TITLE);
        hideBadgeSoon(4200);
        await showMessageModal(STREAMING_BLOCK_TITLE, localFile.message || STREAMING_BLOCK_MESSAGE);
      } else {
        const firefoxBlockedMessage = getFirefoxRawFileUploadBlockedMessage(context);
        failProcessing(localFile.code || "file_scan_failed", "Raw file blocked");
        setBadge("Raw file blocked");
        hideBadgeSoon(4200);
        await showMessageModal(
          "Raw file blocked",
          firefoxBlockedMessage || localFile.message || "LeakGuard blocked raw file upload because local scanning failed."
        );
      }
      refreshBadgeFromCurrentInput();
      return {
        handled: true,
        ok: false,
        reason: localFile.code || "file_scan_failed"
      };
    }

    const sizeInfo = classifyLocalTextPayloadSize({
      text: localFile.text,
      sizeBytes: localFile.file?.sizeBytes
    });
    if (sizeInfo.zone === "blocked") {
      failProcessing("local_text_payload_too_large", LOCAL_TEXT_HARD_BLOCK_TITLE);
      await blockLargeLocalTextPayload(event, sizeInfo);
      return true;
    }

    const shouldSkipTextFallback = context === "file-input" && isFirefoxRuntime() && isGeminiHost();
    const preflightPlan = globalThis.PWM.FileAttachPipeline.classifyFileAttachPreflightPlan({
      context,
      sizeZone: sizeInfo.zone,
      usesDmzOverlay: getCurrentHandoffDriver()?.usesDmzOverlay === true,
      skipTextFallback: shouldSkipTextFallback,
      allowPendingFallback: context === "drop"
    });
    const optimizedStatus = preflightPlan.optimizedStatus.shouldShow;
    if (optimizedStatus) {
      showLocalPayloadOptimizationStatus(sizeInfo);
    }

    let analysis;
    let result;
    let sanitizedFile;
    try {
      if (preflightPlan.sanitizationStatus.shouldSetDmzRedacting) {
        setDmzOverlayState(
          preflightPlan.sanitizationStatus.dmzStatus,
          preflightPlan.sanitizationStatus.dmzMode
        );
      }
      analysis = analyzeText(localFile.text);
      updateFileProcessingOverlay({
        site: processingSite,
        status: preflightPlan.sanitizationStatus.processingStatus,
        progress: preflightPlan.sanitizationStatus.processingProgress,
        blocking: preflightPlan.sanitizationStatus.processingBlocking
      });
      result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      sanitizedFile = createSanitizedTextFile(localFile.file, result.redactedText);
    } catch (error) {
      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(
          sizeInfo,
          preflightPlan.optimizedStatus.cleanupOnSanitizationFailure
        );
      }
      debugReveal("file-handoff:redaction-failed", {
        context,
        error: error?.message || String(error)
      });
      if (context === "drop" && getCurrentHandoffDriver()?.usesDmzOverlay) {
        setDmzOverlayState("Raw file blocked", "failed");
        scheduleDmzOverlayCleanup(3600);
      }
      failProcessing("local_file_sanitization_failed", "Raw file upload blocked");
      setBadge("Raw file upload blocked");
      hideBadgeSoon(4200);
      await showMessageModal(
        "Raw file upload blocked",
        getFirefoxRawFileUploadBlockedMessage(context) ||
          "LeakGuard blocked raw file upload because local sanitization failed."
      );
      refreshBadgeFromCurrentInput();
      return {
        handled: true,
        ok: false,
        reason: "local_file_sanitization_failed"
      };
    }

    debugReveal("file-handoff:sanitized-file-created", {
      context,
      originalFile: describeFileForDebug(localFile.file),
      sanitizedFile: describeFileForDebug(sanitizedFile),
      findingsCount: analysis.secretFindings.length,
      redactedLength: result.redactedText.length
    });
    const driver = getCurrentHandoffDriver();
    if (preflightPlan.handoffStatus.shouldSetDmzReady) {
      setDmzOverlayState(preflightPlan.handoffStatus.dmzStatus, preflightPlan.handoffStatus.dmzMode);
    }
    updateFileProcessingOverlay({
      site: processingSite,
      status: preflightPlan.handoffStatus.processingStatus,
      progress: preflightPlan.handoffStatus.processingProgress,
      blocking: preflightPlan.handoffStatus.processingBlocking
    });

    const payload = driver.preparePayload(sanitizedFile, result.redactedText, {
      localFile,
      analysis,
      result
    });
    const attachFlow = await globalThis.PWM.FileAttachPipeline.runSanitizedFileAttachFlow({
      context,
      tryDropHandoff: () =>
        driver.handoff(payload, { event, input, context, driver, composerResolved: true }),
      trySanitizedHandoff: () => handOffSanitizedLocalFile(event, input, sanitizedFile, context),
      shouldSkipFallback: () => shouldSkipTextFallback,
      skipFallbackReason: preflightPlan.attachFlowOptions.skipFallbackReason,
      insertFallbackText: () => driver.insertSanitizedText(payload, { event, input, context, driver }),
      allowPendingFallback: preflightPlan.attachFlowOptions.allowPendingFallback && Boolean(sanitizedFile),
      defaultSuccessStrategy: preflightPlan.attachFlowOptions.defaultSuccessStrategy,
      failureReason: preflightPlan.attachFlowOptions.failureReason,
      fileStrategy: preflightPlan.attachFlowOptions.fileStrategy,
      textStrategy: preflightPlan.attachFlowOptions.textStrategy,
      usesDmzOverlay: driver.usesDmzOverlay === true,
      getPendingAttachFallbackOptions: (handoffClassification) => {
        const pendingAdapter = getFileHandoffAdapterForLocation();
        return {
          pendingAdapter,
          pendingAttachEnabled:
            handoffClassification.shouldContinueFallback &&
            isFileHandoffAdapterPendingAttachEnabled(pendingAdapter),
          adapterId: pendingAdapter?.id
        };
      }
    });
    const handoffResult = attachFlow.handoffResult;
    const handoffClassification = attachFlow.handoffClassification;

    if (attachFlow.action !== "success") {
      if (attachFlow.action === "cancelled") {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(
            sizeInfo,
            preflightPlan.optimizedStatus.cleanupOnAttachCancellation
          );
        }
        hideProcessing(handoffClassification.hideProcessingReason);
        return {
          handled: attachFlow.handled,
          ok: false,
          reason: attachFlow.reason
        };
      }

      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(sizeInfo, preflightPlan.optimizedStatus.cleanupOnAttachFailure);
      }
      const pendingAdapter = attachFlow.pendingAttachOptions?.pendingAdapter;
      const pendingFallbackDecision = attachFlow.pendingFallbackDecision || {};
      if (
        attachFlow.action === "pending" &&
        queuePendingSanitizedFileHandoff(
          pendingAdapter,
          event,
          input,
          sanitizedFile,
          createSanitizedFileHandoffDetails(
            event,
            sanitizedFile,
            `${pendingAdapter.id}:pending-after-handoff-failure`
          )
        )
      ) {
        hideProcessing("pending");
        hideDmzOverlay();
        return {
          handled: attachFlow.handled,
          ok: true,
          strategy: attachFlow.strategy
        };
      }
      debugReveal("file-handoff:fail-closed", {
        context,
        reason: attachFlow.reason,
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      if (handoffClassification.shouldFailProcessing) {
        failProcessing(handoffClassification.reason, "Raw file upload blocked");
      }
      setBadge("Raw file upload blocked");
      hideBadgeSoon(4200);
      await showMessageModal(
        "Raw file upload blocked",
        handoffResult.message ||
          "LeakGuard blocked raw file upload. Sanitized file handoff failed; use File Scanner or paste redacted text manually."
      );
      refreshBadgeFromCurrentInput();
      return {
        handled: attachFlow.handled,
        ok: false,
        reason: attachFlow.reason
      };
    }

    if (optimizedStatus) {
      clearLocalPayloadOptimizationStatus(sizeInfo, preflightPlan.optimizedStatus.cleanupOnAttachSuccess);
    }
    const disposition = attachFlow.disposition;
    if (disposition.shouldSetDmzAttached) {
      setDmzOverlayState(disposition.dmzStatus, disposition.dmzMode);
    }
    if (disposition.shouldScheduleDmzCleanup) {
      scheduleDmzOverlayCleanup(disposition.dmzCleanupDelay);
    }
    if (disposition.shouldShowAttachedBadge) {
      setBadge("LeakGuard attached a sanitized local file.");
      hideBadgeSoon(3200);
    }
    if (disposition.shouldHideProcessing) {
      hideProcessing(disposition.hideProcessingReason);
    } else if (disposition.shouldShowSuccess) {
      showProcessingSuccess(disposition.successStatus, disposition.successReason);
    }
    refreshBadgeFromCurrentInput();
    return {
      handled: handoffClassification.handled,
      ok: true,
      strategy: handoffClassification.strategy
    };
    } catch (error) {
      showFileProcessingError("File processing failed", {
        site: processingSite,
        reason: "exception"
      });
      hideFileProcessingOverlay("exception");
      throw error;
    }
  }

  async function maybeHandleDrop(event) {
    if (
      isSanitizedFileHandoffEvent(event) ||
      rawFileDropInterceptions.has(event) ||
      !dataTransferLooksLikeFiles(event.dataTransfer)
    ) {
      return;
    }

    const snapshotDataTransfer = snapshotLocalFileDataTransfer(event.dataTransfer);
    if (
      isFirefoxRuntime() &&
      isGeminiHost() &&
      isFirefoxDataTransferFileUnavailableSnapshot(snapshotDataTransfer)
    ) {
      await blockFirefoxGeminiUnavailableDrop(event);
      return;
    }

    const transferPolicy = resolveLocalFileTransferPolicy(snapshotDataTransfer);
    if (transferPolicy.action === "allow") {
      if (shouldBlockUnsupportedFileTransfer(transferPolicy)) {
        rawFileDropInterceptions.add(event);
        consumeInterceptionEvent(event);
        setBadge("Raw file upload blocked");
        hideBadgeSoon(4200);
        await showMessageModal("Raw file upload blocked", getUnsupportedFileBlockedMessage(transferPolicy));
        refreshBadgeFromCurrentInput();
        clearFileDragSession();
        return;
      }
      if (isGeminiHost()) {
        rawFileDropInterceptions.add(event);
        consumeInterceptionEvent(event);
        handOffOriginalLocalFile(event, snapshotDataTransfer, "drop");
        showUnsupportedFilePassThroughNotice(transferPolicy);
        clearFileDragSession();
        return;
      }
      showUnsupportedFilePassThroughNotice(transferPolicy);
      return;
    }

    if (transferPolicy.action === "block") {
      rawFileDropInterceptions.add(event);
      consumeInterceptionEvent(event);
      setBadge("Raw file upload blocked");
      hideBadgeSoon(4200);
      await showMessageModal("Raw file upload blocked", transferPolicy.message);
      refreshBadgeFromCurrentInput();
      clearFileDragSession();
      return;
    }

    rawFileDropInterceptions.add(event);
    consumeInterceptionEvent(event);
    if (isGeminiHost()) {
      lastGeminiDropSessionHash = getGeminiDropSessionHash(snapshotDataTransfer);
    }

    if (!extensionRuntimeAvailable || modalOpen) {
      clearFileDragSession();
      return;
    }

    try {
      handleFileDragDetected(event);
      const input = findComposer(event.target) || findComposer(document.activeElement);
      await maybeHandleLocalFileInsert(event, input, snapshotDataTransfer, "drop");
    } finally {
      clearFileDragSession({ keepDmzOverlay: getCurrentHandoffDriver()?.usesDmzOverlay });
    }
  }

  function maybeHandleFileDrag(event) {
    if (!dataTransferLooksLikeFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    if (event.dataTransfer) {
      try {
        event.dataTransfer.dropEffect = "copy";
      } catch {
        // Some DataTransfer implementations expose dropEffect as read-only.
      }
    }

    handleFileDragDetected(event);

    if (!extensionRuntimeAvailable || modalOpen) {
      return;
    }
  }

  async function maybeHandleFileInputChange(event) {
    if (
      !extensionRuntimeAvailable ||
      modalOpen ||
      event.defaultPrevented ||
      !event.target ||
      event.target.tagName !== "INPUT" ||
      String(event.target.type || "").toLowerCase() !== "file" ||
      typeof dataTransferHasFiles !== "function"
    ) {
      return;
    }

    const selectedFiles = Array.from(event.target.files || []);
    const sanitizedHandoffSuppression = getSanitizedFileInputHandoffSuppression(event.target, selectedFiles);
    if (sanitizedHandoffSuppression) {
      suppressSanitizedFileInputHandoffEvent(event, sanitizedHandoffSuppression);
      return {
        handled: true,
        ok: true,
        strategy: "sanitized-file-handoff-suppressed"
      };
    }

    const isFirefoxProtectedInput = isFirefoxProtectedFileInputEvent(event);
    const existingTransaction = isFirefoxProtectedInput ? getFirefoxFileInputTransaction(event.target) : null;

    if (sanitizedFileInputHandoffs.has(event.target)) {
      if (!isFirefoxProtectedInput) {
        debugReveal(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_PENDING_DUPLICATE_SUPPRESSED, {
          eventType: event.type || "",
          input: describeFileInputForDebug(event.target, "sanitized-file-handoff")
        });
        sanitizedFileInputHandoffs.delete(event.target);
        return;
      }
      const currentSignature = getFileListMetadataSignature(event.target.files);
      const isOwnSanitizedRedispatch =
        existingTransaction?.state === "replaced" &&
        (!existingTransaction.sanitizedSignature || currentSignature === existingTransaction.sanitizedSignature) &&
        (!existingTransaction.suppressUntil || Date.now() <= existingTransaction.suppressUntil);
      if (isOwnSanitizedRedispatch) {
        debugReveal(CONTENT_DEBUG_EVENTS.FILE_HANDOFF_PENDING_DUPLICATE_SUPPRESSED, {
          eventType: event.type || "",
          input: describeFileInputForDebug(event.target, "firefox-sanitized-file-handoff"),
          state: existingTransaction.state
        });
        markFirefoxFileInputTransactionReplaced(event.target, event.target.files);
        return;
      }
      sanitizedFileInputHandoffs.delete(event.target);
    }

    if (isFirefoxProtectedInput && shouldSuppressFirefoxFileInputEvent(event, existingTransaction)) {
      if (existingTransaction.state === "processing") {
        consumeInterceptionEvent(event);
      }
      debugReveal("file-input:firefox-transaction-suppressed", {
        eventType: event.type || "",
        state: existingTransaction.state,
        rawSignature: existingTransaction.rawSignature || "",
        sanitizedSignature: existingTransaction.sanitizedSignature || ""
      });
      return;
    }

    if (!dataTransferHasFiles({ files: event.target.files, types: ["Files"], items: [] })) {
      return;
    }

    let transaction = null;
    if (isFirefoxProtectedInput) {
      transaction = setFirefoxFileInputTransaction(event.target, {
        state: "processing",
        rawSignature: getFileListMetadataSignature(selectedFiles),
        startedAt: Date.now(),
        suppressUntil: Date.now() + PROGRAMMATIC_INPUT_SUPPRESS_MS,
        replacementDispatched: false
      });
      consumeInterceptionEvent(event);
      clearLocalFileInputSelection(event.target);
    }

    const input = findComposer(event.target);
    if (!input && !isGeminiHost()) {
      if (!(isFirefoxRuntime() && isProtectedFileDropDriver(getCurrentHandoffDriverId()))) return;
    }

    const result = await maybeHandleLocalFileInsert(
      event,
      input,
      {
        files: selectedFiles,
        types: ["Files"],
        items: []
      },
      "file-input"
    );
    if (isFirefoxProtectedInput && transaction) {
      const latest = getFirefoxFileInputTransaction(event.target);
      if (result?.ok) {
        setFirefoxFileInputTransaction(event.target, {
          state: "replaced",
          rawSignature: transaction.rawSignature,
          sanitizedSignature: latest?.sanitizedSignature || getFileListMetadataSignature(event.target.files),
          suppressUntil: Date.now() + PROGRAMMATIC_INPUT_SUPPRESS_MS,
          replacementDispatched: true
        });
        setBadge("LeakGuard replaced the selected file with a sanitized copy.");
        hideBadgeSoon(3200);
      } else if (latest?.state !== "replaced") {
        setFirefoxFileInputTransaction(event.target, {
          state: "failed",
          rawSignature: transaction.rawSignature,
          suppressUntil: Date.now() + PROGRAMMATIC_INPUT_SUPPRESS_MS
        });
      }
    }
  }

  async function maybeHandleSubmit(event) {
    if (!extensionRuntimeAvailable) {
      return;
    }

    if (modalOpen) {
      consumeInterceptionEvent(event);
      return;
    }

    if (bypassNextSubmit) {
      bypassNextSubmit = false;
      return;
    }

    const form = event.target?.closest ? event.target.closest("form") : event.target;
    const input =
      form?.querySelector?.("textarea, [contenteditable='true'][role='textbox'], [contenteditable='true']") ||
      findComposer(event.target);

    if (!input) return;
    noteActiveRiskEditor(input);

    const text = getInputText(input);
    if (!text || !text.trim()) return;

    const analysis = await analyzeTextWithAiAssist(text);
    if (!analysis.findings.length && !analysis.placeholderNormalized) return;

    consumeInterceptionEvent(event);

    const policy = analysis.findings.length ? await getPolicyForAction() : getActivePolicy();
    const destinationPolicy = analysis.findings.length
      ? await handleDestinationPolicy(analysis.findings, policy)
      : getDestinationPolicyDecision(policy);
    if (analysis.findings.length && destinationPolicy.blocked) {
      return;
    }
    const destinationForceRedact = shouldForceDestinationRedaction(destinationPolicy, analysis.findings);

    const httpPolicyHandled = await handleHttpSecretPolicy(policy, analysis.secretFindings, async () => {
      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      const applied = await applyComposerText(input, result.redactedText, {
        caretOffset: result.redactedText.length,
        restoreText: analysis.normalizedText,
        restoreCaretOffset: analysis.normalizedText.length
      });

      if (!applied.ok) {
        await showRewriteFailure(
          "submit",
          collectFailureDetails(input, result.redactedText, applied.actual, "submit")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();

      if (!(await ensureExactComposerState(input, result.redactedText))) {
        await showRewriteFailure(
          "submit",
          collectFailureDetails(input, result.redactedText, getInputText(input), "submit")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      bypassNextSubmit = true;
      queueMicrotask(() => submitComposer(form, input));
    });

    if (httpPolicyHandled) {
      return;
    }

    if (destinationForceRedact) {
      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
        auditReason: destinationPolicy.reason
      });
      const applied = await applyComposerText(input, result.redactedText, {
        caretOffset: result.redactedText.length,
        restoreText: analysis.normalizedText,
        restoreCaretOffset: analysis.normalizedText.length
      });

      if (!applied.ok) {
        await showRewriteFailure(
          "submit",
          collectFailureDetails(input, result.redactedText, applied.actual, "submit")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      setBadge("Destination policy required redaction");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();

      if (!(await ensureExactComposerState(input, result.redactedText))) {
        await showRewriteFailure(
          "submit",
          collectFailureDetails(input, result.redactedText, getInputText(input), "submit")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      bypassNextSubmit = true;
      queueMicrotask(() => submitComposer(form, input));
      return;
    }

    if (analysis.findings.length && isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
      clearAllRiskSessionState();
      bypassNextSubmit = true;
      submitComposer(form, input);
      return;
    }

    if (!analysis.findings.length) {
      const normalized = await applyNormalizedComposerRewrite(input, text, "submit");
      if (!normalized.ok) return;

      if (!(await ensureExactComposerState(input, normalized.text))) {
        await showRewriteFailure(
          "submit",
          collectFailureDetails(input, normalized.text, getInputText(input), "submit")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      bypassNextSubmit = true;
      queueMicrotask(() => submitComposer(form, input));
      return;
    }

    const decisionAction = await promptForSensitiveContentDecision(
      analysis.findings,
      "submit",
      policy,
      input,
      analysis.normalizedText
    );
    if (decisionAction === "cancel") return;

    const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);

    const applied = await applyComposerText(input, result.redactedText, {
      caretOffset: result.redactedText.length,
      restoreText: analysis.normalizedText,
      restoreCaretOffset: analysis.normalizedText.length
    });

    if (!applied.ok) {
      await showRewriteFailure(
        "submit",
        collectFailureDetails(input, result.redactedText, applied.actual, "submit")
      );
      refreshBadgeFromCurrentInput();
      return;
    }

    setBadge("Content redacted");
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();

    if (!(await ensureExactComposerState(input, result.redactedText))) {
      await showRewriteFailure(
        "submit",
        collectFailureDetails(input, result.redactedText, getInputText(input), "submit")
      );
      refreshBadgeFromCurrentInput();
      return;
    }

    bypassNextSubmit = true;
    queueMicrotask(() => submitComposer(form, input));
  }

  async function maybeHandleFallbackSendKey(event) {
    if (
      !extensionRuntimeAvailable ||
      modalOpen ||
      event.defaultPrevented ||
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing
    ) {
      return;
    }

    const input = findComposer(event.target);
    if (!input || input.closest("form")) return;
    noteActiveRiskEditor(input);

    const text = getInputText(input);
    if (!text || !text.trim()) return;

    const analysis = await analyzeTextWithAiAssist(text);
    if (!analysis.findings.length && !analysis.placeholderNormalized) return;

    consumeInterceptionEvent(event);

    const policy = analysis.findings.length ? await getPolicyForAction() : getActivePolicy();
    const destinationPolicy = analysis.findings.length
      ? await handleDestinationPolicy(analysis.findings, policy)
      : getDestinationPolicyDecision(policy);
    if (analysis.findings.length && destinationPolicy.blocked) {
      return;
    }
    const destinationForceRedact = shouldForceDestinationRedaction(destinationPolicy, analysis.findings);

    const httpPolicyHandled = await handleHttpSecretPolicy(policy, analysis.secretFindings, async () => {
      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      const applied = await applyComposerText(input, result.redactedText, {
        caretOffset: result.redactedText.length,
        restoreText: analysis.normalizedText,
        restoreCaretOffset: analysis.normalizedText.length
      });

      if (!applied.ok) {
        await showRewriteFailure(
          "submit",
          collectFailureDetails(input, result.redactedText, applied.actual, "submit")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();

      queueMicrotask(() => {
        ensureExactComposerState(input, result.redactedText)
          .then((isExact) => {
            if (!isExact) {
              return showRewriteFailure(
                "submit",
                collectFailureDetails(input, result.redactedText, getInputText(input), "submit")
              ).then(() => {
                refreshBadgeFromCurrentInput();
              });
            }

            const button = findSendButton(input);
            if (button) {
              clearAllRiskSessionState();
              button.click();
            }
            return null;
          })
          .catch(handleContentError);
      });
    });

    if (httpPolicyHandled) {
      return;
    }

    if (destinationForceRedact) {
      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
        auditReason: destinationPolicy.reason
      });
      const applied = await applyComposerText(input, result.redactedText, {
        caretOffset: result.redactedText.length,
        restoreText: analysis.normalizedText,
        restoreCaretOffset: analysis.normalizedText.length
      });

      if (!applied.ok) {
        await showRewriteFailure(
          "submit",
          collectFailureDetails(input, result.redactedText, applied.actual, "submit")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      setBadge("Destination policy required redaction");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();

      queueMicrotask(() => {
        ensureExactComposerState(input, result.redactedText)
          .then((isExact) => {
            if (!isExact) {
              return showRewriteFailure(
                "submit",
                collectFailureDetails(input, result.redactedText, getInputText(input), "submit")
              ).then(() => {
                refreshBadgeFromCurrentInput();
              });
            }

            const button = findSendButton(input);
            if (button) {
              clearAllRiskSessionState();
              button.click();
            }
            return null;
          })
          .catch(handleContentError);
      });
      return;
    }

    if (analysis.findings.length && isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
      const button = findSendButton(input);
      clearAllRiskSessionState();
      if (button) button.click();
      return;
    }

    if (!analysis.findings.length) {
      const normalized = await applyNormalizedComposerRewrite(input, text, "submit");
      if (!normalized.ok) return;

      queueMicrotask(() => {
        ensureExactComposerState(input, normalized.text)
          .then((isExact) => {
            if (!isExact) {
              return showRewriteFailure(
                "submit",
                collectFailureDetails(input, normalized.text, getInputText(input), "submit")
              ).then(() => {
                refreshBadgeFromCurrentInput();
              });
            }

            const button = findSendButton(input);
            if (button) {
              clearAllRiskSessionState();
              button.click();
            }
            return null;
          })
          .catch(handleContentError);
      });
      return;
    }

    const decisionAction = await promptForSensitiveContentDecision(
      analysis.findings,
      "submit",
      policy,
      input,
      analysis.normalizedText
    );
    if (decisionAction === "cancel") return;

    const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);

    const applied = await applyComposerText(input, result.redactedText, {
      caretOffset: result.redactedText.length,
      restoreText: analysis.normalizedText,
      restoreCaretOffset: analysis.normalizedText.length
    });

    if (!applied.ok) {
      await showRewriteFailure(
        "submit",
        collectFailureDetails(input, result.redactedText, applied.actual, "submit")
      );
      refreshBadgeFromCurrentInput();
      return;
    }

    setBadge("Content redacted");
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();

    queueMicrotask(() => {
      ensureExactComposerState(input, result.redactedText)
        .then((isExact) => {
          if (!isExact) {
            return showRewriteFailure(
              "submit",
              collectFailureDetails(input, result.redactedText, getInputText(input), "submit")
            ).then(() => {
              refreshBadgeFromCurrentInput();
            });
          }

          const button = findSendButton(input);
          if (button) {
            clearAllRiskSessionState();
            button.click();
          }
          return null;
        })
        .catch(handleContentError);
    });
  }

  async function maybeHandleTypedSecrets() {
    if (!extensionRuntimeAvailable || modalOpen) return;

    const scanGeneration = typedScanGeneration + 1;
    typedScanGeneration = scanGeneration;
    const input = findComposer();
    if (!input) return;
    noteActiveRiskEditor(input);

    const text = getInputText(input);
    if (!text || !text.trim()) {
      lastTypedPromptText = "";
      clearEditorRiskState(input);
      return;
    }

    const analysis = await analyzeTextWithAiAssist(text);
    if (scanGeneration !== typedScanGeneration) return;

    if (!analysis.findings.length) {
      if (analysis.placeholderNormalized) {
        if (text !== lastTypedPromptText) {
          const normalized = await applyNormalizedComposerRewrite(input, text, "input");
          if (normalized.ok) {
            lastTypedPromptText = normalized.text;
          }
        }
        return;
      }

      lastTypedPromptText = "";
      clearEditorRiskState(input);
      return;
    }

    if (PLACEHOLDER_TOKEN_REGEX.test(analysis.normalizedText)) {
      PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
      return;
    }
    PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;

    if (analysis.normalizedText === lastTypedPromptText) {
      return;
    }

    lastTypedPromptText = analysis.normalizedText;
    const typedShouldAutoRedact = shouldAutoRedactTypedSecrets(
      analysis.secretFindings,
      analysis.findings
    );
    const policy = await getPolicyForAction();

    const destinationPolicy = await handleDestinationPolicy(analysis.findings, policy);
    if (destinationPolicy.blocked) {
      return;
    }
    const destinationForceRedact = shouldForceDestinationRedaction(destinationPolicy, analysis.findings);

    const httpPolicyHandled = await handleHttpSecretPolicy(policy, analysis.secretFindings, async () => {
      const latestInput = findComposer(input);
      if (!latestInput) return;

      const latestText = getInputText(latestInput);
      if (latestText !== text) {
        refreshBadgeFromCurrentInput();
        return;
      }

      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      if (scanGeneration !== typedScanGeneration) {
        lastTypedPromptText = analysis.normalizedText;
        refreshBadgeFromCurrentInput();
        return;
      }
      const applied = await applyComposerText(latestInput, result.redactedText, {
        caretOffset: result.redactedText.length,
        restoreText: analysis.normalizedText,
        restoreCaretOffset: analysis.normalizedText.length
      });

      if (!applied.ok) {
        await showRewriteFailure(
          "input",
          collectFailureDetails(latestInput, result.redactedText, applied.actual, "input")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      lastTypedPromptText = result.redactedText;
      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
    });

    if (httpPolicyHandled) {
      return;
    }

    if (destinationForceRedact) {
      const latestInput = findComposer(input);
      if (!latestInput) return;

      const latestText = getInputText(latestInput);
      if (latestText !== text) {
        refreshBadgeFromCurrentInput();
        return;
      }

      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
        auditReason: destinationPolicy.reason
      });
      if (scanGeneration !== typedScanGeneration) {
        lastTypedPromptText = analysis.normalizedText;
        refreshBadgeFromCurrentInput();
        return;
      }
      const applied = await applyComposerText(latestInput, result.redactedText, {
        caretOffset: result.redactedText.length,
        restoreText: analysis.normalizedText,
        restoreCaretOffset: analysis.normalizedText.length
      });

      if (!applied.ok) {
        await showRewriteFailure(
          "input",
          collectFailureDetails(latestInput, result.redactedText, applied.actual, "input")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      lastTypedPromptText = result.redactedText;
      setBadge("Destination policy required redaction");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    if (isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)) {
      lastTypedPromptText = analysis.normalizedText;
      setBadge("Protection paused");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    if (typedShouldAutoRedact) {
      const latestInput = findComposer(input);
      if (!latestInput) return;

      const latestText = getInputText(latestInput);
      if (latestText !== text) {
        refreshBadgeFromCurrentInput();
        return;
      }

      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      if (scanGeneration !== typedScanGeneration) {
        lastTypedPromptText = analysis.normalizedText;
        refreshBadgeFromCurrentInput();
        return;
      }

      const applied = await applyComposerText(latestInput, result.redactedText, {
        caretOffset: result.redactedText.length,
        restoreText: analysis.normalizedText,
        restoreCaretOffset: analysis.normalizedText.length
      });

      if (!applied.ok) {
        await showRewriteFailure(
          "input",
          collectFailureDetails(latestInput, result.redactedText, applied.actual, "input")
        );
        refreshBadgeFromCurrentInput();
        return;
      }

      lastTypedPromptText = result.redactedText;
      setBadge("High-confidence secret redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    const decisionAction = await promptForSensitiveContentDecision(
      analysis.findings,
      "input",
      policy,
      input,
      analysis.normalizedText
    );
    if (decisionAction !== "redact") {
      lastTypedPromptText = analysis.normalizedText;
      refreshBadgeFromCurrentInput();
      return;
    }

    const latestInput = findComposer(input);
    if (!latestInput) return;

    const latestText = getInputText(latestInput);
    if (latestText !== text) {
      refreshBadgeFromCurrentInput();
      return;
    }

    const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
    if (scanGeneration !== typedScanGeneration) {
      lastTypedPromptText = analysis.normalizedText;
      refreshBadgeFromCurrentInput();
      return;
    }

    const applied = await applyComposerText(latestInput, result.redactedText, {
      caretOffset: result.redactedText.length,
      restoreText: analysis.normalizedText,
      restoreCaretOffset: analysis.normalizedText.length
    });

    if (!applied.ok) {
      await showRewriteFailure(
        "input",
        collectFailureDetails(latestInput, result.redactedText, applied.actual, "input")
      );
      refreshBadgeFromCurrentInput();
      return;
    }

    lastTypedPromptText = result.redactedText;
    setBadge("Content redacted");
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();
  }

  async function refreshBadgeFromCurrentInput() {
    const input = findComposer();
    if (!input) {
      updateStatusPanel({
        hasComposer: false,
        detectedCount: 0,
        placeholderNormalized: false
      });
      return;
    }

    const text = getInputText(input);
    if (!text || !text.trim()) {
      setBadge("");
      updateStatusPanel({
        hasComposer: true,
        detectedCount: 0,
        placeholderNormalized: false
      });
      return;
    }

    const analysis = await analyzeTextWithAiAssist(text);
    if (!analysis.findings.length) {
      setBadge("");
      updateStatusPanel({
        hasComposer: true,
        detectedCount: 0,
        placeholderNormalized: analysis.placeholderNormalized
      });
      return;
    }

    if (!analysis.networkFindings.length && severityBandsOnlyMedium(analysis.secretFindings)) {
      setBadge("Review possible sensitive content");
    } else {
      setBadge("Sensitive content detected");
    }
    updateStatusPanel({
      hasComposer: true,
      detectedCount: analysis.findings.length,
      placeholderNormalized: analysis.placeholderNormalized
    });
  }

  function scheduleInputScan() {
    if (isProgrammaticInputScanSuppressed()) {
      return;
    }

    window.clearTimeout(inputScanTimer);
    inputScanTimer = window.setTimeout(() => {
      if (isProgrammaticInputScanSuppressed()) {
        return;
      }
      refreshBadgeFromCurrentInput();
      maybeHandleTypedSecrets().catch(handleContentError);
    }, 220);
  }

  function severityBandsOnlyMedium(findings) {
    const bands = splitSecretFindingsBySeverity(findings);
    return bands.medium.length > 0 && bands.high.length === 0;
  }

  async function openRevealInExtensionUi(placeholder) {
    if (!getActivePolicy().allowReveal) {
      setBadge("Secure reveal disabled by policy");
      hideBadgeSoon(2400);
      return;
    }

    const response = await openPopupReveal(placeholder);

    debugReveal("reveal:popup-open", {
      placeholder,
      requestId: response.requestId,
      opened: response.opened,
      placeholderCount: currentPublicState.placeholderCount
    });

    if (!response.opened) {
      setBadge("Open LeakGuard from the toolbar to inspect this placeholder");
      hideBadgeSoon(3200);
    }
  }

  function handleRevealActivationError(placeholder, error) {
    debugReveal("reveal:panel-error", {
      placeholder,
      error: error?.message || String(error)
    });
    setBadge("Secure reveal unavailable");
    hideBadgeSoon(2400);
  }

  function getRevealControllerOptions() {
    return {
      document,
      placeholderSessionIndex,
      openReveal: openRevealInExtensionUi,
      onRevealError: handleRevealActivationError
    };
  }

  function getResponseObserverOptions() {
    return {
      document,
      MutationObserver,
      Node,
      NodeFilter,
      normalizeVisiblePlaceholders,
      placeholderTokenRegex: PLACEHOLDER_TOKEN_REGEX,
      placeholderCount: currentPublicState.placeholderCount,
      tokenizePlaceholderText: (text, options) =>
        tokenizeRehydrationPlaceholderText(text, {
          ...options,
          placeholderCount: currentPublicState.placeholderCount
        }),
      createSecretSpan: (placeholder) => RevealController.createSecretSpan(placeholder, getRevealControllerOptions()),
      debug: debugResponseRehydration,
      getObserver: () => rehydrateObserver,
      setObserver: (observer) => {
        rehydrateObserver = observer;
      }
    };
  }

  async function handleUrlChange() {
    if (location.href === currentUrl) return;

    currentUrl = location.href;
    clearPendingGeminiGhostIngressClickInterceptor("navigation");
    clearPendingGeminiSanitizedFileHandoff("navigation");
    clearPendingGrokSanitizedFileHandoff("navigation");
    clearAllRiskSessionState();
    await initState();
    ResponseObserver.rehydrateTree(document.body, getResponseObserverOptions());
    refreshBadgeFromCurrentInput();
    setBadge("Chat route changed");
    hideBadgeSoon(1400);
  }

  function installNavigationWatchers() {
    const scheduleCheck = () => {
      queueMicrotask(() => {
        handleUrlChange().catch(handleContentError);
      });
    };

    const wrapHistoryMethod = (name) => {
      const original = history[name];
      if (typeof original !== "function") return;

      history[name] = function () {
        const result = original.apply(this, arguments);
        scheduleCheck();
        return result;
      };
    };

    wrapHistoryMethod("pushState");
    wrapHistoryMethod("replaceState");

    window.addEventListener("popstate", () => scheduleCheck(), true);
    window.addEventListener("hashchange", () => scheduleCheck(), true);

    window.setInterval(() => {
      handleUrlChange().catch(handleContentError);
    }, 1500);
  }

  function bindFileDragEvents(root, onFileDrop) {
    if (!root || typeof root.addEventListener !== "function" || fileDragEventRoots.has(root)) {
      return;
    }

    fileDragEventRoots.add(root);
    if (fileDragGuard?.bind) {
      fileDragGuard.bind(root);
      return;
    }

    root.addEventListener("dragenter", maybeHandleFileDrag, { capture: true, passive: false });
    root.addEventListener("dragover", maybeHandleFileDrag, { capture: true, passive: false });
    root.addEventListener("drop", onFileDrop, { capture: true, passive: false });
    root.addEventListener("dragend", clearFileDragSession, { capture: true, passive: false });
  }

  function bindEvents() {
    ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type === "PWM_CONTENT_PING") {
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "PWM_REFRESH_STATUS_PANEL") {
        refreshBadgeFromCurrentInput();
        sendResponse({ ok: true });
      }
    });
    const onFileDrop = (event) => {
      maybeHandleDrop(event).catch(handleContentError);
    };
    fileDragGuard?.setDropHandler?.(onFileDrop);
    fileDragGuard?.setDragHandler?.(handleFileDragDetected);
    fileDragGuard?.setDragEndHandler?.(clearFileDragSession);
    fileDragGuard?.setFilePolicyResolver?.(resolveFileDragGuardPolicy);
    debugReveal("file-drag:guard-initialized", {
      singleton: Boolean(fileDragGuard?.initialized),
      marker: Boolean(window.__LEAKGUARD_FILE_DRAG_GUARD_INIT__)
    });

    bindFileDragEvents(window, onFileDrop);
    bindFileDragEvents(document, onFileDrop);
    bindFileDragEvents(document.documentElement, onFileDrop);
    bindFileDragEvents(document.body, onFileDrop);

    document.addEventListener(
      "beforeinput",
      (event) => {
        maybeHandleBeforeInput(event).catch(handleContentError);
      },
      true
    );

    document.addEventListener(
      "paste",
      (event) => {
        maybeHandlePaste(event).catch(handleContentError);
      },
      true
    );

    document.addEventListener(
      "change",
      (event) => {
        maybeHandleFileInputChange(event).catch(handleContentError);
      },
      true
    );

    document.addEventListener(
      "input",
      (event) => {
        maybeHandleFileInputChange(event).catch(handleContentError);
      },
      true
    );

    document.addEventListener(
      "submit",
      (event) => {
        maybeHandleSubmit(event).catch(handleContentError);
      },
      true
    );

    document.addEventListener(
      "keydown",
      (event) => {
        maybeHandleFallbackSendKey(event).catch(handleContentError);
      },
      true
    );

    document.addEventListener("input", scheduleInputScan, true);
  }

  function finishBodyReadyBoot() {
    if (isTopFrame) {
      ensureStatusPanel();
    }
    bindFileDragEvents(document.documentElement, (event) => {
      maybeHandleDrop(event).catch(handleContentError);
    });
    bindFileDragEvents(document.body, (event) => {
      maybeHandleDrop(event).catch(handleContentError);
    });
    ResponseObserver.startRehydrationObserver(getResponseObserverOptions());
    if (isTopFrame) {
      refreshBadgeFromCurrentInput();
    }
  }

  async function boot() {
    bindEvents();
    await initState();
    finishBodyReadyBoot();
    installNavigationWatchers();

    if (!document.body) {
      document.addEventListener("DOMContentLoaded", finishBodyReadyBoot, { once: true });
    }
  }

  boot().catch(handleContentError);
})();
