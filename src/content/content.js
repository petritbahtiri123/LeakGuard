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
    ANY_PLACEHOLDER_TOKEN_REGEX,
    normalizeVisiblePlaceholders,
    buildNetworkUiFindings,
    evaluateDestinationPolicy,
    ComposerHelpers,
    FilePasteHelpers,
    createFileHandoffState,
    createFileHandoffPending,
    createPendingSanitizedFileHandoffManager,
    createFileHandoffFlow,
    PlaceholderRehydrator,
    ResponseObserver,
    RevealController,
    FileDebugMetadata,
    ChatGptComposerSync,
    PlaceholderFamilies = {}
  } = globalThis.PWM;
  const ReplayVerification = globalThis.PWM?.ReplayVerification || {};
  const ChatGptLargePasteOrchestration = globalThis.PWM?.ChatGptLargePasteOrchestration || {};
  const GeminiEditorPasteOrchestration = globalThis.PWM?.GeminiEditorPasteOrchestration || {};
  const FallbackSendKeyOrchestration = globalThis.PWM?.FallbackSendKeyOrchestration || {};
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
    normalizeClipboardImageDataTransfer,
    readLocalTextFileFromDataTransfer,
    createSanitizedTextFile,
    redactSensitiveFileName
  } = FilePasteHelpers || {};
  const FileScanner = globalThis.PWM?.FileScanner || {};
  const FileTypeRegistry = globalThis.PWM?.FileTypeRegistry || {};
  const ContentModalUi = globalThis.PWM?.ContentModalUi || {};
  const ContentStatusUi = globalThis.PWM?.ContentStatusUi || {};
  const ContentFileTypeSupport = globalThis.PWM?.ContentFileTypeSupport || {};
  const SanitizedFileBatchProcessor = globalThis.PWM?.SanitizedFileBatchProcessor || {};
  const FileHandoffVerification = globalThis.PWM?.FileHandoffVerification || {};
  const FileHandoffDiscovery = globalThis.PWM?.FileHandoffDiscovery || {};
  const SanitizedFileHandoff = globalThis.PWM?.SanitizedFileHandoff || {};
  const FileDropInterception = globalThis.PWM?.FileDropInterception || {};
  const FileInputInterception = globalThis.PWM?.FileInputInterception || {};
  const MultiFileInsertOrchestration = globalThis.PWM?.MultiFileInsertOrchestration || {};
  const StreamingFileInsertOrchestration = globalThis.PWM?.StreamingFileInsertOrchestration || {};
  const LocalFileReadOrchestration = globalThis.PWM?.LocalFileReadOrchestration || {};
  const LocalFileAttachPreflightOrchestration = globalThis.PWM?.LocalFileAttachPreflightOrchestration || {};
  const LocalFileSanitizationOrchestration = globalThis.PWM?.LocalFileSanitizationOrchestration || {};
  const SanitizedFileInsertOrchestration = globalThis.PWM?.SanitizedFileInsertOrchestration || {};
  const FileInputPreparation = globalThis.PWM?.FileInputPreparation || {};
  const FileProcessingUi = globalThis.PWM?.FileProcessingUi || {};
  const WhatsAppCapabilities = globalThis.PWM?.WhatsAppCapabilities || {};
  const WhatsAppTextFlow = globalThis.PWM?.WhatsAppTextFlow || {};
  const WhatsAppSelectors = globalThis.PWM?.WhatsAppSelectors || {};
  const GeminiUploadDiscovery = globalThis.PWM?.GeminiUploadDiscovery || {};
  const GeminiFileHandoff = globalThis.PWM?.GeminiFileHandoff || {};
  const GrokFileHandoff = globalThis.PWM?.GrokFileHandoff || {};
  const {
    canExtractForAdapterHandoff,
    processFileForAdapterHandoff
  } = globalThis.PWM?.ContentFileExtractionPipeline || {};
  const StreamingFileRedactor = globalThis.PWM?.StreamingFileRedactor || {};
  const FileLimits = globalThis.PWM?.FileLimits || {};
  const {
    placeholderSessionIndex,
    tokenizePlaceholderText: tokenizeRehydrationPlaceholderText
  } = PlaceholderRehydrator;
  const {
    createSafeFileAttachDebugPayload,
    assignSafeFileAttachErrorMetadata
  } = FileDebugMetadata;

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
    "[data-testid='conversation-compose-box-input'][contenteditable]:not([contenteditable='false'])",
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
    "form button#send-button",
    "button[data-testid='send-button']",
    "button[data-testid*='send']",
    "button#send-button",
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
      liveTypedRedaction: false,
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
  let contentModalUi = null;
  let contentStatusUi = null;
  let geminiUploadDiscovery = null;
  let geminiFileHandoff = null;
  let grokFileHandoff = null;
  let sanitizedFileHandoff = null;
  let bypassNextSubmit = false;
  let bypassNextSendButtonClick = false;
  let fallbackSendKeySuppressionUntil = 0;
  let fallbackSendKeySuppressionInput = null;
  const whatsAppPendingTextSendInputs = new WeakSet();
  const whatsAppPendingTextSendTimers = new WeakMap();
  const whatsAppSanitizedImageHandoffInputs = new WeakMap();
  let whatsAppSanitizedImageHandoffUntil = 0;
  let whatsAppBypassSanitizedImageSubmitUntil = 0;
  let inputScanTimer = 0;
  let rehydrateObserver = null;
  let modalOpen = false;
  let lastTypedPromptText = "";
  let typedScanGeneration = 0;
  let typedRewriteGeneration = 0;
  let activeRiskEditor = null;
  let suppressInputScanUntil = 0;
  const rewriteFailureModalSuppressions = new Map();
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
  const WHATSAPP_DUPLICATE_TEXT_PASTE_SUPPRESS_MS = 1200;
  const FALLBACK_SEND_KEY_SUPPRESS_MS = 5000;
  const WHATSAPP_TEXT_SEND_GUARD_MS = 5000;
  const WHATSAPP_SANITIZED_IMAGE_SEND_BYPASS_MS = 30000;
  const WHATSAPP_REWRITE_CLEAR_TIMEOUT_MS = 500;
  const WHATSAPP_REWRITE_INSERT_TIMEOUT_MS = 700;
  const WHATSAPP_REWRITE_POLL_MS = 50;
  const WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON = "whatsapp_file_attachments_unsupported";
  const WHATSAPP_FILE_ATTACH_BLOCK_TITLE = "WhatsApp file upload blocked";
  const WHATSAPP_FILE_ATTACH_BLOCK_MESSAGE =
    "LeakGuard blocks unsupported WhatsApp Web file attachments in this phase. No raw file was uploaded.";
  const WHATSAPP_TEXT_SEND_BLOCK_TITLE = "WhatsApp send blocked";
  const CHATGPT_LARGE_PASTE_FILE_THRESHOLD = 16 * 1024;
  const CHATGPT_SANITIZED_PASTE_FILE_NAME = "leakguard-redacted-paste.txt";
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
    "LeakGuard did not scan or redact this unsupported file. Supported text, text PDF, DOCX, XLSX, and PNG/JPG/JPEG/WEBP image paths are protected where available. Unsupported archives, executables, legacy Office files, unsupported images, and binary files are blocked on protected sites when LeakGuard cannot safely replace them.";
  const UNSUPPORTED_PROTECTED_IMAGE_BLOCKED_TITLE = "Raw image upload blocked";
  const UNSUPPORTED_PROTECTED_IMAGE_BLOCKED_MESSAGE =
    "Raw image upload blocked. This image type is not supported for safe redaction.";
  const SUPPORTED_IMAGE_REDACTION_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  const SUPPORTED_IMAGE_REDACTION_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const UNSUPPORTED_PROTECTED_IMAGE_EXTENSIONS = new Set([".gif", ".bmp", ".ico", ".svg"]);
  const FILE_DRAG_SESSION_RESET_MS = 5000;
  const MAX_MULTI_FILE_SMALL_ATTACHMENTS =
    globalThis.PWM?.FileAttachPipeline?.MAX_MULTI_FILE_SMALL_ATTACHMENTS || 20;
  const MAX_MULTI_FILE_LARGE_ATTACHMENTS =
    globalThis.PWM?.FileAttachPipeline?.MAX_MULTI_FILE_LARGE_ATTACHMENTS || 5;
  const MULTI_FILE_SMALL_MAX_BYTES =
    globalThis.PWM?.FileAttachPipeline?.MULTI_FILE_SMALL_MAX_BYTES || LOCAL_TEXT_HARD_BLOCK_BYTES;
  const MULTI_FILE_SUPPORTED_MAX_BYTES =
    globalThis.PWM?.FileAttachPipeline?.MULTI_FILE_SUPPORTED_MAX_BYTES || LARGE_TEXT_STREAMING_MAX_BYTES;
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
  const contentDebug = globalThis.PWM.ContentDebugFacade.createContentDebugFacade({
    root: window,
    DebugLogger: globalThis.PWM?.DebugLogger,
    FileDebugMetadata,
    createSafeFileAttachDebugPayload,
    normalizeText: normalizeComposerText,
    normalizeEditorInnerText,
    normalizeVisiblePlaceholders,
    placeholderTokenRegex: PLACEHOLDER_TOKEN_REGEX,
    getInputText,
    getSelectionOffsets,
    findSendButton,
    getHost: () => location?.hostname || "",
    isChatGptHost: () => isChatGptHost()
  });
  let lastDiscoveredFileInput = null;
  let fileDragDiscoveryCompleted = false;
  let fileDragDiscoveryScheduled = false;
  let fileDragDiscoveryTimer = 0;
  let fileDragSessionResetTimer = 0;
  let fileDragSessionId = 0;
  let fileDragDetectedLogged = false;
  let lastGeminiDropSessionHash = "";
  const geminiSanitizedDownloadFallbacks = new WeakSet();
  const FILE_HANDOFF_PENDING_ATTACH_ENABLED = Object.freeze({
    gemini: true,
    grok: true,
    chatgpt: true,
    claude: true,
    openai: true,
    x: true,
    whatsapp: false
  });
  let dmzOverlayEl = null;
  let dmzOverlayStatusEl = null;
  let dmzOverlayTimer = 0;
  let dmzFallbackStyleEl = null;
  let contentFileTypeSupport = null;
  let localFileTransferPolicyGate = null;
  let sanitizedFileBatchProcessor = null;
  let fileHandoffVerification = null;
  let fileHandoffDiscovery = null;
  let fileDropInterception = null;
  let fileInputInterception = null;
  let multiFileInsertOrchestration = null;
  let streamingFileInsertOrchestration = null;
  let localFileReadOrchestration = null;
  let localFileAttachPreflightOrchestration = null;
  let localFileSanitizationOrchestration = null;
  let sanitizedFileInsertOrchestration = null;
  let fileInputPreparation = null;
  let fileProcessingUi = null;
  let whatsAppCapabilities = null;
  let whatsAppTextFlow = null;
  let whatsAppSelectors = null;
  let replayVerification = null;
  let chatGptLargePasteOrchestration = null;
  let geminiEditorPasteOrchestration = null;
  let fallbackSendKeyOrchestration = null;
  let syntheticFileListCapabilityCache = null;
  let inputFileAssignmentCapabilityCache = null;
  const fileInputProcessingSignatures = new WeakMap();
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
    getFileListMetadataSignature,
    markSanitizedFileHandoff,
    deleteSanitizedFileHandoffMark,
    getSanitizedFileInputHandoffSuppression,
    suppressSanitizedFileInputHandoffEvent,
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
  const pendingSanitizedFileHandoff = createPendingSanitizedFileHandoffManager({
    clearPendingGeminiGhostIngressClickInterceptor,
    clearPendingSanitizedAttachPrompt,
    createPendingAttachEvent: (event, type) => createPendingAttachEvent(event, type),
    createSanitizedDataTransferForHandoff,
    createSanitizedFileHandoffDetails,
    debugReveal,
    describeElementForDebug,
    describeFileForDebug,
    describeFileHandoffAdapter,
    describeFileInputForDebug,
    describeGeminiHandoffDiscovery,
    describeGeminiOverlayExposure,
    describeGrokPendingInputDiscovery,
    discoverGeminiFileHandoffElements,
    discoverGrokPendingFileInput,
    documentRef: document,
    geminiTtlMs: GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS,
    genericTtlMs: GROK_PENDING_SANITIZED_FILE_HANDOFF_MS,
    getFileHandoffAdapterById,
    getGeminiSessionHash: () => lastGeminiDropSessionHash || "",
    getPendingSanitizedAttachPromptMessage,
    grokTtlMs: GROK_PENDING_SANITIZED_FILE_HANDOFF_MS,
    handOffSanitizedFileInput,
    handleContentError,
    hideBadgeSoon,
    hideDmzOverlay,
    isFileHandoffAdapterPendingAttachEnabled,
    isGeminiHost,
    isGrokHost,
    isLikelyGeminiUploadClickTarget,
    isLikelyGrokUploadClickTarget,
    logSanitizedFileHandoffFailure,
    normalizeFileHandoffAdapter,
    normalizeTarget,
    refreshBadgeFromCurrentInput,
    setBadge,
    showFileProcessingSuccess,
    showPendingSanitizedAttachPrompt
  });
  function attemptPendingGeminiSanitizedFileHandoff(reason = "") {
    return pendingSanitizedFileHandoff.attemptPendingGeminiSanitizedFileHandoff(reason);
  }

  function attemptPendingGrokSanitizedFileHandoff(reason = "") {
    return pendingSanitizedFileHandoff.attemptPendingGrokSanitizedFileHandoff(reason);
  }

  function clearPendingGeminiSanitizedFileHandoff(reason = "") {
    return pendingSanitizedFileHandoff.clearPendingGeminiSanitizedFileHandoff(reason);
  }

  function clearPendingGrokSanitizedFileHandoff(reason = "") {
    return pendingSanitizedFileHandoff.clearPendingGrokSanitizedFileHandoff(reason);
  }

  function clearPendingGenericSanitizedFileHandoff(reason = "") {
    return pendingSanitizedFileHandoff.clearPendingGenericSanitizedFileHandoff(reason);
  }

  function queuePendingGeminiSanitizedFileHandoff(event, input, sanitizedFile, details = null) {
    return pendingSanitizedFileHandoff.queuePendingGeminiSanitizedFileHandoff(event, input, sanitizedFile, details);
  }

  function queuePendingGrokSanitizedFileHandoff(event, input, sanitizedFile, details = null) {
    return pendingSanitizedFileHandoff.queuePendingGrokSanitizedFileHandoff(event, input, sanitizedFile, details);
  }

  function queuePendingGenericSanitizedFileHandoff(adapter, event, input, sanitizedFile, details = null) {
    return pendingSanitizedFileHandoff.queuePendingGenericSanitizedFileHandoff(adapter, event, input, sanitizedFile, details);
  }

  function hasPendingGeminiSanitizedFileHandoff(sanitizedFile) {
    return pendingSanitizedFileHandoff.hasPendingGeminiSanitizedFileHandoff(sanitizedFile);
  }

  function hasPendingGrokSanitizedFileHandoff(sanitizedFile) {
    return pendingSanitizedFileHandoff.hasPendingGrokSanitizedFileHandoff(sanitizedFile);
  }

  function getPendingGeminiSanitizedFileHandoffDebug() {
    return pendingSanitizedFileHandoff.getPendingGeminiSanitizedFileHandoffDebug();
  }

  function getPendingGrokSanitizedFileHandoffDebug() {
    return pendingSanitizedFileHandoff.getPendingGrokSanitizedFileHandoffDebug();
  }
  const fileHandoffPending = createFileHandoffPending({
    attemptPendingGeminiSanitizedFileHandoff,
    attemptPendingGrokSanitizedFileHandoff,
    clearPendingGeminiSanitizedFileHandoff,
    clearPendingGrokSanitizedFileHandoff,
    clearPendingGenericSanitizedFileHandoff,
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
    queuePendingGenericSanitizedFileHandoff,
    readSanitizedFileTextForFallback,
    refreshBadgeFromCurrentInput,
    setBadge,
    suppressStaleHandoffErrorAfterSuccess
  });
  const {
    createPendingAttachEvent,
    queuePendingSanitizedFileHandoff,
    clearPendingSanitizedFileHandoff,
    attachPendingSanitizedFileWithTrustedActivation,
    insertPendingSanitizedFileText,
    downloadPendingSanitizedFile,
    cancelPendingSanitizedFileAttach
  } = fileHandoffPending;
  const geminiFallbackWriter = globalThis.PWM.GeminiFallbackWriter.createGeminiFallbackWriter({
    applyPasteDecision,
    confirmGeminiLargeSanitizedTextInsertion,
    contentDebugEvents: CONTENT_DEBUG_EVENTS,
    describeFileForDebug,
    documentRef: document,
    emitDebug: debugReveal,
    emitFileAttachMetadata: debugFileAttachMetadata,
    findComposer,
    formatSanitizedFileFallbackText,
    geminiSanitizedTextFallbackMessage: GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE,
    getInputText,
    getSelectionOffsets,
    hideBadgeSoon,
    insertGeminiEditorText,
    isGeminiHost,
    locationRef: location,
    normalizeComposerText,
    refreshBadgeFromCurrentInput,
    resolveGeminiFallbackEditor,
    rewriteComposerTransactionally,
    setBadge,
    setGeminiDmzOverlayState,
    showMessageModal
  });
  const {
    applyGeminiEditorText,
    applyGeminiSanitizedTextFallback,
    insertGeminiSanitizedText
  } = geminiFallbackWriter;
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
    assignSafeFileAttachErrorMetadata,
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
    prepareFileInputForHandoff: prepareFileInputForSanitizedHandoff,
    readSanitizedFileTextForFallback,
    refreshBadgeFromCurrentInput,
    resolveFileInputForHandoff,
    resolveWhatsAppDocumentDropInputForHandoff,
    scheduleDmzOverlayCleanup,
    sendRuntimeMessage,
    setBadge,
    setDmzOverlayState,
    shouldUseFirefoxTextFallbackForFileHandoff,
    tryFirefoxGeminiFileInputBridge,
    tryGeminiSanitizedFileAttach
  });
  const {
    handOffSanitizedLocalFile,
    downloadSanitizedFileFallback,
    getCurrentHandoffDriver
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
    clearPendingGenericSanitizedFileHandoff("extension-context-invalidated");
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

    debugReveal("content:error", { error });
  }

  function isDebugEnabled() {
    if (typeof contentDebug !== "undefined") return contentDebug.isDebugEnabled();
    return Boolean(globalThis.PWM?.DebugLogger?.isDebugEnabled?.({ root: window }));
  }

  function summarizeDebugText(text) {
    if (typeof contentDebug !== "undefined") return contentDebug.summarizeDebugText(text);
    return globalThis.PWM.DebugLogger.summarizeDebugText(text, {
      normalizeText: normalizeComposerText,
      normalizeVisiblePlaceholders,
      placeholderTokenRegex: PLACEHOLDER_TOKEN_REGEX
    });
  }

  function debugLogSnapshot(label, input, expected, writeText) {
    if (typeof contentDebug !== "undefined") {
      contentDebug.debugLogSnapshot(label, input, expected, writeText);
      return;
    }
    if (!isDebugEnabled()) return;
    globalThis.PWM?.DebugLogger?.debugSnapshot?.(label, {
      expected: summarizeDebugText(expected),
      writeText: summarizeDebugText(writeText),
      getInputText: summarizeDebugText(getInputText(input)),
      innerText: summarizeDebugText(input?.innerText || ""),
      normalizedInnerText: summarizeDebugText(normalizeEditorInnerText(input?.innerText || "")),
      textContent: summarizeDebugText(input?.textContent || "")
    }, { root: window });
  }

  function debugReveal(label, payload) {
    if (typeof contentDebug !== "undefined") {
      contentDebug.debugReveal(label, payload);
      return;
    }
    globalThis.PWM?.DebugLogger?.debugEvent?.(label, payload || {}, { root: window });
  }

  function getGeminiDiagnosticsAdapter() {
    return globalThis.PWM?.SiteAdapters?.GeminiDiagnosticsAdapter || null;
  }

  function runGeminiUiDiagnostics(reason = "") {
    const debugEnabled =
      typeof isDebugEnabled === "function"
        ? isDebugEnabled()
        : Boolean(globalThis.PWM?.DebugLogger?.isDebugEnabled?.({ root: window }));
    if (!isGeminiHost() || !debugEnabled) return false;
    const diagnostics = getGeminiDiagnosticsAdapter();
    if (!diagnostics?.scanGeminiUi) return false;
    try {
      debugReveal("gemini-diagnostics:ui-map", {
        reason,
        ...diagnostics.scanGeminiUi(document)
      });
      return true;
    } catch (error) {
      debugReveal("gemini-diagnostics:ui-map-failed", {
        reason,
        errorName: error?.name || "Error"
      });
      return false;
    }
  }

  function debugFileAttachMetadata(label, payload) {
    if (typeof contentDebug !== "undefined") {
      contentDebug.debugFileAttachMetadata(label, payload);
      return;
    }
    debugReveal(label, createSafeFileAttachDebugPayload(payload));
  }

  function debugResponseRehydration(label, payload) {
    debugReveal(label, payload || {});
  }

  function countDebugPlaceholders(text) {
    if (typeof contentDebug !== "undefined") return contentDebug.countDebugPlaceholders(text);
    return (String(text || "").match(/\[[A-Z_]+_\d+\]/g) || []).length;
  }

  function getSafeElementAttribute(el, name) {
    if (typeof contentDebug !== "undefined") return contentDebug.getSafeElementAttribute(el, name);
    try {
      return String(el?.getAttribute?.(name) || "");
    } catch {
      return "";
    }
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
    if (typeof contentDebug === "undefined") {
      const actual = actualText == null ? getInputText(input) : normalizeComposerText(actualText);
      return {
        host: location?.hostname || "",
        input: {
          tag: input?.tagName || "",
          role: getSafeElementAttribute(input, "role") || input?.role || "",
          contenteditable: getSafeElementAttribute(input, "contenteditable"),
          dataTestIdLength: getSafeElementAttribute(input, "data-testid").length,
          idLength: String(input?.id || getSafeElementAttribute(input, "id")).length,
          classLength: String(typeof input?.className === "string" ? input.className : getSafeElementAttribute(input, "class")).length
        },
        expectedLength: getDebugTextLength(expectedText),
        actualLength: getDebugTextLength(actual),
        innerTextLength: getDebugTextLength(input?.innerText || ""),
        textContentLength: getDebugTextLength(input?.textContent || ""),
        placeholderCount: countDebugPlaceholders(actual || expectedText),
        expectedPlaceholderCount: countDebugPlaceholders(expectedText),
        actualPlaceholderCount: countDebugPlaceholders(actual),
        sendButton: getChatGptSendButtonDebugState(input)
      };
    }
    const debugState = contentDebug.getChatGptComposerSyncDebug(input, expectedText, actualText);
    return {
      ...debugState,
      expectedLength: getDebugTextLength(expectedText),
      input: {
        ...(debugState.input || {}),
        role: getSafeElementAttribute(input, "role") || input?.role || "",
        contenteditable: getSafeElementAttribute(input, "contenteditable")
      },
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
      textContent: summarizeDebugText(input?.textContent || ""),
      safeWhatsAppPlaceholderRewrite: shouldAcceptWhatsAppSafePlaceholderPasteVerification(
        expectedText,
        actualText
      )
    };
  }

  function logFailureDetails(details) {
    if (typeof contentDebug !== "undefined") {
      contentDebug.logFailureDetails(details);
      return;
    }
    debugReveal("rewrite:verification-failure", details || {});
  }

  function consumeInterceptionEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function logFileInterception(label, details) {
    if (typeof contentDebug !== "undefined") {
      contentDebug.logFileInterception(label, details);
      return;
    }
    debugFileAttachMetadata(`file-interception:${label}`, details || {});
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

  function isTextPasteInterceptionEvent(event) {
    return event?.type === "paste" || isPasteBeforeInput(event);
  }

  function getWhatsAppTextFlow() {
    if (whatsAppTextFlow) return whatsAppTextFlow;
    if (typeof WhatsAppTextFlow.createWhatsAppTextFlow !== "function") {
      whatsAppTextFlow = Object.freeze({
        rememberWhatsAppTextPaste: () => {},
        shouldSuppressDuplicateWhatsAppTextPaste: () => false
      });
      return whatsAppTextFlow;
    }

    whatsAppTextFlow = WhatsAppTextFlow.createWhatsAppTextFlow({
      isWhatsAppHost,
      isTextPasteInterceptionEvent,
      normalizeComposerText,
      debugReveal,
      duplicateTextPasteSuppressMs: WHATSAPP_DUPLICATE_TEXT_PASTE_SUPPRESS_MS
    });
    return whatsAppTextFlow;
  }

  function rememberWhatsAppTextPaste(input, pasted, event) {
    return getWhatsAppTextFlow().rememberWhatsAppTextPaste(input, pasted, event);
  }

  function shouldSuppressDuplicateWhatsAppTextPaste(input, pasted, event) {
    return getWhatsAppTextFlow().shouldSuppressDuplicateWhatsAppTextPaste(input, pasted, event);
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
    const localTransferFiles = listLocalTransferFiles(dataTransfer);
    if (isWhatsAppHost() && dataTransferLooksLikeFiles(dataTransfer)) {
      return {
        action: "block",
        reason: WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON
      };
    }
    if (
      localTransferFiles.length === 1 &&
      shouldUseContentFileExtractionPipeline(localTransferFiles[0])
    ) {
      return {
        action: "block",
        reason: "content_extraction_candidate"
      };
    }
    if (shouldFailClosedProtectedUnsupportedFileTransfer(policy)) {
      return {
        action: "block",
        reason: "unsupported_protected_file_blocked"
      };
    }
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
    if (isUnsupportedProtectedImageTransfer(policy)) {
      return UNSUPPORTED_PROTECTED_IMAGE_BLOCKED_MESSAGE;
    }
    return globalThis.PWM.FileTransferPolicy.getUnsupportedFileBlockedMessage(policy);
  }

  function getUnsupportedFileBlockedTitle(policy) {
    return isUnsupportedProtectedImageTransfer(policy)
      ? UNSUPPORTED_PROTECTED_IMAGE_BLOCKED_TITLE
      : "Raw file upload blocked";
  }

  function getLocalFileTransferPolicyGate() {
    if (localFileTransferPolicyGate) return localFileTransferPolicyGate;
    if (typeof globalThis.PWM.FileTransferPolicy.createLocalFileTransferPolicyGate !== "function") {
      localFileTransferPolicyGate = Object.freeze({
        maybeHandleLocalFileTransferPolicy: async () => null
      });
      return localFileTransferPolicyGate;
    }

    localFileTransferPolicyGate = globalThis.PWM.FileTransferPolicy.createLocalFileTransferPolicyGate({
      clearLocalFileInputSelection,
      consumeInterceptionEvent,
      getCurrentHandoffDriverId,
      getUnsupportedFileBlockedMessage,
      getUnsupportedFileBlockedTitle,
      hideBadgeSoon,
      hideFileProcessingOverlay,
      refreshBadgeFromCurrentInput,
      setBadge,
      shouldBlockUnsupportedFileTransfer,
      shouldFailClosedProtectedUnsupportedFileTransfer,
      showFileProcessingError,
      showMessageModal,
      showUnsupportedFilePassThroughNotice
    });
    return localFileTransferPolicyGate;
  }

  function getContentFileTypeSupport() {
    if (contentFileTypeSupport) return contentFileTypeSupport;
    if (typeof ContentFileTypeSupport.createContentFileTypeSupport !== "function") {
      contentFileTypeSupport = Object.freeze({
        isSupportedWhatsAppAttachImageFile: () => false,
        isSupportedWhatsAppTextDocumentAttachFile: () => false,
        isSupportedWhatsAppPdfAttachFile: () => false,
        isSupportedWhatsAppDocxAttachFile: () => false,
        isSupportedWhatsAppXlsxAttachFile: () => false,
        isSupportedWhatsAppMultiFileAttachFile: () => false,
        isSingleSupportedWhatsAppFileAttach: () => false,
        isSupportedWhatsAppMultiFileAttach: () => false
      });
      return contentFileTypeSupport;
    }

    contentFileTypeSupport = ContentFileTypeSupport.createContentFileTypeSupport({
      fileScanner: FileScanner,
      fileTypeRegistry: FileTypeRegistry,
      shouldUseContentFileExtractionPipeline,
      getLocalFileExtension,
      getLocalFileMimeType,
      dataTransferHasFiles,
      listLocalTransferFiles,
      maxWhatsAppMultiFileAttachments: MAX_MULTI_FILE_SMALL_ATTACHMENTS
    });
    return contentFileTypeSupport;
  }

  function getWhatsAppCapabilities() {
    if (whatsAppCapabilities) return whatsAppCapabilities;
    if (typeof WhatsAppCapabilities.createWhatsAppCapabilities !== "function") {
      whatsAppCapabilities = Object.freeze({
        isSupportedWhatsAppClipboardImagePaste: () => false,
        isWhatsAppSanitizedDropHandoffEnabled: () => false,
        isWhatsAppHandoffContext: () => false,
        isWhatsAppSanitizedFileHandoffContext: (context = "file-input") => context === "file-input",
        isWhatsAppSanitizedMultiFileAttachEnabled: () => false,
        isPotentialWhatsAppMultiFileAttach: () => false
      });
      return whatsAppCapabilities;
    }
    whatsAppCapabilities = WhatsAppCapabilities.createWhatsAppCapabilities({
      isWhatsAppHost,
      getCurrentHandoffDriverId,
      getFileHandoffAdapterById,
      getFileHandoffAdapterForLocation,
      dataTransferHasFiles,
      listLocalTransferFiles,
      filePasteHelpers: globalThis.PWM?.FilePasteHelpers || {}
    });
    return whatsAppCapabilities;
  }


  function isSupportedWhatsAppClipboardImagePaste(dataTransfer, context = "paste") {
    return getWhatsAppCapabilities().isSupportedWhatsAppClipboardImagePaste(dataTransfer, context);
  }

  function isWhatsAppSanitizedDropHandoffEnabled(context = "drop") {
    return getWhatsAppCapabilities().isWhatsAppSanitizedDropHandoffEnabled(context);
  }

  function isWhatsAppHandoffContext() {
    return getWhatsAppCapabilities().isWhatsAppHandoffContext();
  }

  function isWhatsAppSanitizedFileHandoffContext(context = "file-input") {
    return getWhatsAppCapabilities().isWhatsAppSanitizedFileHandoffContext(context);
  }

  function isSupportedWhatsAppAttachImageFile(file) {
    return getContentFileTypeSupport().isSupportedWhatsAppAttachImageFile(file);
  }

  function isSupportedWhatsAppImageAttach(dataTransfer, context = "file-input") {
    if (!isWhatsAppHost() || !isWhatsAppSanitizedFileHandoffContext(context)) return false;
    const support = getContentFileTypeSupport();
    if (!support.isSingleSupportedWhatsAppFileAttach(dataTransfer, support.isSupportedWhatsAppAttachImageFile)) return false;
    const adapter = getFileHandoffAdapterById("whatsapp") || getFileHandoffAdapterForLocation();
    return adapter?.id === "whatsapp" && adapter.supportsSanitizedImageAttachHandoff === true;
  }

  function isSupportedWhatsAppTextDocumentAttachFile(file) {
    return getContentFileTypeSupport().isSupportedWhatsAppTextDocumentAttachFile(file);
  }

  function isSupportedWhatsAppTextDocumentAttach(dataTransfer, context = "file-input") {
    if (!isWhatsAppHost() || !isWhatsAppSanitizedFileHandoffContext(context)) return false;
    const support = getContentFileTypeSupport();
    if (!support.isSingleSupportedWhatsAppFileAttach(dataTransfer, support.isSupportedWhatsAppTextDocumentAttachFile)) return false;
    const adapter = getFileHandoffAdapterById("whatsapp") || getFileHandoffAdapterForLocation();
    return adapter?.id === "whatsapp" && adapter.supportsSanitizedTextDocumentAttachHandoff === true;
  }

  function isSupportedWhatsAppPdfAttachFile(file) {
    return getContentFileTypeSupport().isSupportedWhatsAppPdfAttachFile(file);
  }

  function isSupportedWhatsAppPdfAttach(dataTransfer, context = "file-input") {
    if (!isWhatsAppHost() || !isWhatsAppSanitizedFileHandoffContext(context)) return false;
    const support = getContentFileTypeSupport();
    if (!support.isSingleSupportedWhatsAppFileAttach(dataTransfer, support.isSupportedWhatsAppPdfAttachFile)) return false;
    const adapter = getFileHandoffAdapterById("whatsapp") || getFileHandoffAdapterForLocation();
    return adapter?.id === "whatsapp" && adapter.supportsSanitizedPdfAttachHandoff === true;
  }

  function isSupportedWhatsAppDocxAttachFile(file) {
    return getContentFileTypeSupport().isSupportedWhatsAppDocxAttachFile(file);
  }

  function isSupportedWhatsAppDocxAttach(dataTransfer, context = "file-input") {
    if (!isWhatsAppHost() || !isWhatsAppSanitizedFileHandoffContext(context)) return false;
    const support = getContentFileTypeSupport();
    if (!support.isSingleSupportedWhatsAppFileAttach(dataTransfer, support.isSupportedWhatsAppDocxAttachFile)) return false;
    const adapter = getFileHandoffAdapterById("whatsapp") || getFileHandoffAdapterForLocation();
    return adapter?.id === "whatsapp" && adapter.supportsSanitizedDocxAttachHandoff === true;
  }

  function isSupportedWhatsAppXlsxAttachFile(file) {
    return getContentFileTypeSupport().isSupportedWhatsAppXlsxAttachFile(file);
  }

  function isSupportedWhatsAppXlsxAttach(dataTransfer, context = "file-input") {
    if (!isWhatsAppHost() || !isWhatsAppSanitizedFileHandoffContext(context)) return false;
    const support = getContentFileTypeSupport();
    if (!support.isSingleSupportedWhatsAppFileAttach(dataTransfer, support.isSupportedWhatsAppXlsxAttachFile)) return false;
    const adapter = getFileHandoffAdapterById("whatsapp") || getFileHandoffAdapterForLocation();
    return adapter?.id === "whatsapp" && adapter.supportsSanitizedXlsxAttachHandoff === true;
  }

  function isWhatsAppSanitizedMultiFileAttachEnabled(context = "file-input") {
    return getWhatsAppCapabilities().isWhatsAppSanitizedMultiFileAttachEnabled(context);
  }

  function isPotentialWhatsAppMultiFileAttach(files, context = "file-input") {
    return getWhatsAppCapabilities().isPotentialWhatsAppMultiFileAttach(files, context);
  }

  function isSupportedWhatsAppMultiFileAttachFile(file) {
    return getContentFileTypeSupport().isSupportedWhatsAppMultiFileAttachFile(file);
  }

  function isSupportedWhatsAppMultiFileAttach(dataTransfer, context = "file-input") {
    if (!isWhatsAppSanitizedMultiFileAttachEnabled(context)) return false;
    return getContentFileTypeSupport().isSupportedWhatsAppMultiFileAttach(dataTransfer);
  }

  async function blockWhatsAppFileAttachment(event) {
    if (!event?.defaultPrevented) {
      consumeInterceptionEvent(event);
    }
    if (event?.target?.tagName === "INPUT" && String(event.target.type || "").toLowerCase() === "file") {
      clearLocalFileInputSelection(event.target);
    }
    showFileProcessingError(WHATSAPP_FILE_ATTACH_BLOCK_TITLE, {
      site: "whatsapp",
      reason: WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON
    });
    hideFileProcessingOverlay(WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON);
    setBadge(WHATSAPP_FILE_ATTACH_BLOCK_TITLE);
    hideBadgeSoon(4200);
    await showMessageModal(WHATSAPP_FILE_ATTACH_BLOCK_TITLE, WHATSAPP_FILE_ATTACH_BLOCK_MESSAGE);
    refreshBadgeFromCurrentInput();
    return {
      handled: true,
      ok: false,
      reason: WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON
    };
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

  function getFileProcessingUi() {
    if (fileProcessingUi) return fileProcessingUi;
    if (typeof FileProcessingUi.createFileProcessingUi !== "function") {
      fileProcessingUi = Object.freeze({
        getFileProcessingSiteId: (site = "") => String(site || getCurrentHandoffDriverId() || "generic"),
        formatFileProcessingProgress: () => "",
        describeFileProcessingProgress: () => ({ text: "", bytesProcessed: 0, totalBytes: 0, chunks: 0 }),
        showFileProcessingOverlay: () => null,
        updateFileProcessingOverlay: () => null,
        hideFileProcessingOverlay: () => {},
        showFileProcessingSuccess: () => {},
        showFileProcessingError: () => {},
        clearPendingSanitizedAttachPrompt: () => {},
        getPendingSanitizedAttachPromptMessage: () =>
          "File sanitized. Click Upload/Attach to attach the sanitized version.",
        showPendingSanitizedAttachPrompt: () => null
      });
      return fileProcessingUi;
    }

    fileProcessingUi = FileProcessingUi.createFileProcessingUi({
      documentRef: document,
      setTimeoutFn: setTimeout,
      clearTimeoutFn: clearTimeout,
      getCurrentHandoffDriverId,
      debugReveal,
      debugFileAttachMetadata,
      contentDebugEvents: CONTENT_DEBUG_EVENTS,
      geminiPendingMessage: GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE,
      grokPendingMessage: GROK_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE,
      describeSanitizedFileOrBatchForDebug,
      describeFileHandoffAdapter,
      getFileHandoffAdapterById,
      getFileHandoffAdapterForLocation,
      attachPendingSanitizedFileWithTrustedActivation,
      insertPendingSanitizedFileText,
      downloadPendingSanitizedFile,
      cancelPendingSanitizedFileAttach,
      handleContentError
    });
    return fileProcessingUi;
  }

  function formatFileProcessingProgress(progress) {
    return getFileProcessingUi().formatFileProcessingProgress(progress);
  }

  function showFileProcessingOverlay(options = {}) {
    return getFileProcessingUi().showFileProcessingOverlay(options);
  }

  function updateFileProcessingOverlay(options = {}) {
    return getFileProcessingUi().updateFileProcessingOverlay(options);
  }

  function hideFileProcessingOverlay(reason = "") {
    return getFileProcessingUi().hideFileProcessingOverlay(reason);
  }

  function showFileProcessingSuccess(status = "Sanitized file attached.", options = {}) {
    return getFileProcessingUi().showFileProcessingSuccess(status, options);
  }

  function showFileProcessingError(status = "Raw file upload blocked", options = {}) {
    return getFileProcessingUi().showFileProcessingError(status, options);
  }

  function clearPendingSanitizedAttachPrompt(reason = "") {
    return getFileProcessingUi().clearPendingSanitizedAttachPrompt(reason);
  }

  function getPendingSanitizedAttachPromptMessage(site = "") {
    return getFileProcessingUi().getPendingSanitizedAttachPromptMessage(site);
  }

  function showPendingSanitizedAttachPrompt(adapter, pending = null) {
    return getFileProcessingUi().showPendingSanitizedAttachPrompt(adapter, pending);
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

  function getReplayVerification() {
    if (replayVerification) return replayVerification;
    if (typeof ReplayVerification.createReplayVerification !== "function") {
      replayVerification = globalThis.PWM.RewriteVerificationText;
      return replayVerification;
    }
    replayVerification = ReplayVerification.createReplayVerification({
      rewriteVerificationText: globalThis.PWM.RewriteVerificationText,
      normalizeComposerText,
      normalizeEditorInnerText,
      getInputText,
      analyzeText,
      debug: debugRewriteVerification
    });
    return replayVerification;
  }

  function normalizeVerificationText(text) {
    return getReplayVerification().normalizeVerificationText(text);
  }

  function normalizeLooseVerificationText(text) {
    return getReplayVerification().normalizeLooseVerificationText(text);
  }

  function listExpectedPlaceholders(text) {
    return getReplayVerification().listExpectedPlaceholders(text);
  }

  function listPlaceholderTokens(text) {
    return getReplayVerification().listPlaceholderTokens(text);
  }

  function samePlaceholderTokenSet(expectedText, actualText) {
    return getReplayVerification().samePlaceholderTokenSet(expectedText, actualText);
  }

  function actualContainsExpectedPlaceholders(expectedText, actualText) {
    return getReplayVerification().actualContainsExpectedPlaceholders(expectedText, actualText);
  }

  function countVerificationLineBreaks(text) {
    return getReplayVerification().countVerificationLineBreaks(text);
  }

  function countVerificationLines(text) {
    return getReplayVerification().countVerificationLines(text);
  }

  function lineCollapseTokens(text) {
    return getReplayVerification().lineCollapseTokens(text);
  }

  function detectMultilineCollapse(expected, actual) {
    return getReplayVerification().detectMultilineCollapse(expected, actual);
  }

  function isReasonablyCloseRewriteLength(expectedText, actualText) {
    return getReplayVerification().isReasonablyCloseRewriteLength(expectedText, actualText);
  }

  function collectComposerVerificationCandidates(input, initialActualText) {
    return getReplayVerification().collectComposerVerificationCandidates(input, initialActualText);
  }

  function isHighConfidenceRewriteFinding(finding) {
    return getReplayVerification().isHighConfidenceRewriteFinding(finding);
  }

  function collectOriginalRawSecretValues(originalText, findings) {
    return getReplayVerification().collectOriginalRawSecretValues(originalText, findings);
  }

  function candidateHasHighConfidenceSecret(candidateText, rawSecretValues) {
    return getReplayVerification().candidateHasHighConfidenceSecret(candidateText, rawSecretValues);
  }

  function summarizeVerificationCandidate(source, text, expectedText) {
    return getReplayVerification().summarizeVerificationCandidate(source, text, expectedText);
  }

  function debugRewriteVerification(label, payload) {
    globalThis.PWM?.DebugLogger?.debugEvent?.(label, payload || {}, { root: window });
  }

  function evaluateComposerVerificationCandidates({ candidates, expectedText, originalText, findings, context }) {
    return getReplayVerification().evaluateComposerVerificationCandidates({
      candidates,
      expectedText,
      originalText,
      findings,
      context
    });
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
    return getReplayVerification().matchesComposerPlan(plan, actualText);
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

  function getActiveProtection() {
    return {
      paused: false,
      pausedUntil: 0,
      allowProtectionPause: false,
      protectionEnforced: false,
      ...(currentPublicState.protection || {})
    };
  }

  function getContentStatusUi() {
    if (contentStatusUi) return contentStatusUi;
    if (typeof ContentStatusUi.createContentStatusUi !== "function") {
      contentStatusUi = Object.freeze({
        setBadge: () => null,
        hideBadgeSoon: () => 0,
        ensureStatusPanel: () => null,
        updateStatusPanel: () => null
      });
      return contentStatusUi;
    }

    contentStatusUi = ContentStatusUi.createContentStatusUi({
      documentRef: document,
      windowRef: window,
      locationRef: location,
      getActiveProtection,
      getPlaceholderCount: () => currentPublicState.placeholderCount,
      openProtectedSitesUi,
      openOptionsPage,
      setProtectionPaused
    });
    return contentStatusUi;
  }

  function ensureStatusPanel() {
    return getContentStatusUi().ensureStatusPanel();
  }

  function updateStatusPanel(snapshot = {}) {
    return getContentStatusUi().updateStatusPanel(snapshot);
  }

  function setBadge(text) {
    return getContentStatusUi().setBadge(text);
  }

  function hideBadgeSoon(delay = 1800) {
    return getContentStatusUi().hideBadgeSoon(delay);
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
      liveTypedRedaction: false,
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

  function resolveDecisionAction(action, _policy) {
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

    if (policy?.defaultAction === "redact" || policy?.defaultAction === "block") {
      return resolveDecisionAction(policy.defaultAction, policy);
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
    if (dataTestId === "conversation-compose-box-input") score += 70;
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

  function analysisNeedsEventOwnership(analysis) {
    return Boolean((analysis?.findings || []).length || analysis?.placeholderNormalized);
  }

  function isKnownSanitizedPlaceholderToken(raw) {
    const token = normalizeVisiblePlaceholders(String(raw || "").trim());
    if (!token) return false;

    const corePlaceholderRegex = new RegExp(`^(?:${PLACEHOLDER_TOKEN_REGEX.source})$`);
    if (corePlaceholderRegex.test(token)) return true;

    const typedMatch = /^\[([A-Z][A-Z0-9_]*)_\d+\]$/.exec(token);
    return Boolean(
      typedMatch &&
        typeof PlaceholderFamilies.isTypedPlaceholderFamily === "function" &&
        PlaceholderFamilies.isTypedPlaceholderFamily(typedMatch[1])
    );
  }

  function analysisHasOnlySanitizedPlaceholderFindings(analysis) {
    const findings = analysis?.findings || [];
    return findings.length > 0 && findings.every((finding) => isKnownSanitizedPlaceholderToken(finding?.raw));
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

  function isLiveTypedRedactionEnabled(policy) {
    const activePolicy = policy || getActivePolicy();
    return Boolean(activePolicy?.liveTypedRedaction === true && activePolicy?.strictFailure !== true);
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

  function getContentModalUi() {
    if (contentModalUi) return contentModalUi;
    if (typeof ContentModalUi.createContentModalUi !== "function") {
      contentModalUi = Object.freeze({
        showDecisionModal: async () => ({ action: "cancel" }),
        showMessageModal: async () => {},
        showGeminiLargeTextConfirmationModal: async () => ({ action: "cancel" })
      });
      return contentModalUi;
    }

    contentModalUi = ContentModalUi.createContentModalUi({
      documentRef: document,
      windowRef: window,
      getModalOpen: () => modalOpen,
      setModalOpen: (value) => {
        modalOpen = Boolean(value);
      }
    });
    return contentModalUi;
  }

  function showDecisionModal(findings, mode, options = {}) {
    return getContentModalUi().showDecisionModal(findings, mode, options);
  }

  function showMessageModal(titleText, bodyText) {
    return getContentModalUi().showMessageModal(titleText, bodyText);
  }

  function showGeminiLargeTextConfirmationModal(redactedLength) {
    return getContentModalUi().showGeminiLargeTextConfirmationModal(redactedLength);
  }

  function waitForAnimationFrameOrTimeout(timeoutMs = 50) {
    return new Promise((resolve) => {
      let settled = false;
      let timeoutId = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        resolve();
      };

      timeoutId = window.setTimeout(finish, timeoutMs);
      try {
        window.requestAnimationFrame(finish);
      } catch {
        finish();
      }
    });
  }

  async function settleComposer() {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await waitForAnimationFrameOrTimeout();
    await waitForAnimationFrameOrTimeout();
    await waitForAnimationFrameOrTimeout();
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
    if (details?.safeWhatsAppPlaceholderRewrite) {
      debugRewriteVerification("rewrite:failure-modal-suppressed-safe-whatsapp-placeholder", {
        context,
        expected: details?.expected || null,
        actual: details?.actual || null
      });
      return;
    }

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

  function getChatGptComposerSyncDependencies() {
    return {
      debugChatGptSync,
      isChatGptHost,
      readStableComposerText,
      suppressFollowupInputScan,
      verifyComposerRewriteSafe
    };
  }

  function debugWhatsAppComposerSync(label, input, expectedText = "", actualText = null, extra = {}) {
    if (!isWhatsAppHost()) return;
    debugReveal(String(label || "").replace(/^chatgpt-sync/, "whatsapp-sync"), {
      ...getChatGptComposerSyncDebug(input, expectedText, actualText),
      ...(extra || {})
    });
  }

  function dispatchWhatsAppEditorInputEvent(input, inputType, data, options = {}) {
    if (!input?.dispatchEvent) return false;
    let event = null;
    try {
      event = new InputEvent(options.beforeInput ? "beforeinput" : "input", {
        bubbles: true,
        cancelable: Boolean(options.beforeInput),
        composed: true,
        inputType,
        data: data == null ? null : String(data)
      });
    } catch {
      event = new Event(options.beforeInput ? "beforeinput" : "input", {
        bubbles: true,
        cancelable: Boolean(options.beforeInput),
        composed: true
      });
    }

    try {
      input.dispatchEvent(event);
      return true;
    } catch {
      return false;
    }
  }

  function dispatchWhatsAppEditorChange(input) {
    try {
      input?.dispatchEvent?.(new Event("change", { bubbles: true, composed: true }));
      document.dispatchEvent?.(new Event("selectionchange", { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  }

  function focusWhatsAppComposer(input) {
    try {
      input?.focus?.({ preventScroll: true });
      return;
    } catch {
      try {
        input?.focus?.();
      } catch {
        // Focus is best-effort; verification below decides whether the rewrite worked.
      }
    }
  }

  function selectWhatsAppComposerContents(input) {
    if (
      !input ||
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      typeof window.getSelection !== "function" ||
      typeof document.createRange !== "function"
    ) {
      return false;
    }

    try {
      focusWhatsAppComposer(input);
      const selection = window.getSelection();
      const range = document.createRange();
      if (!selection || !range) return false;
      range.selectNodeContents(input);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch {
      return false;
    }
  }

  function runWhatsAppEditorCommand(command, value = null) {
    if (typeof document?.execCommand !== "function") return false;
    try {
      return Boolean(document.execCommand(command, false, value));
    } catch {
      return false;
    }
  }

  function createWhatsAppPlainTextTransfer(text) {
    if (typeof DataTransfer !== "function") return null;
    try {
      const transfer = new DataTransfer();
      transfer.setData("text/plain", text);
      transfer.setData("text", text);
      return transfer;
    } catch {
      return null;
    }
  }

  function dispatchWhatsAppEditorPasteEvent(input, text) {
    if (!input || typeof ClipboardEvent !== "function") return false;
    const transfer = createWhatsAppPlainTextTransfer(text);
    if (!transfer) return false;

    try {
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: transfer
      });
      markSanitizedTextRewriteEvent(event);
      const hasClipboardText =
        event.clipboardData?.getData?.("text/plain") === text ||
        attachEventDataTransfer(event, "clipboardData", transfer);
      if (!hasClipboardText) return false;
      const dispatched = input.dispatchEvent(event);
      return Boolean(dispatched || event.defaultPrevented);
    } catch {
      return false;
    }
  }

  async function waitForWhatsAppComposerText(input, expectedText, options = {}) {
    const expected = normalizeComposerText(expectedText);
    const timeoutMs = Math.max(WHATSAPP_REWRITE_POLL_MS, Number(options.timeoutMs) || WHATSAPP_REWRITE_INSERT_TIMEOUT_MS);
    const stablePasses = Math.max(1, Number(options.stablePasses) || 2);
    const deadline = Date.now() + timeoutMs;
    let actual = normalizeComposerText(getInputText(input));
    let matchedPasses = actual === expected ? 1 : 0;

    while (Date.now() <= deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, WHATSAPP_REWRITE_POLL_MS));
      actual = normalizeComposerText(getInputText(input));
      matchedPasses = actual === expected ? matchedPasses + 1 : 0;
      if (matchedPasses >= stablePasses) {
        return { ok: true, actual };
      }
    }

    return { ok: false, actual };
  }

  async function clearWhatsAppComposerThroughEditor(input) {
    if (!selectWhatsAppComposerContents(input)) {
      return { ok: false, actual: normalizeComposerText(getInputText(input)), strategy: "whatsapp-select-failed" };
    }

    dispatchWhatsAppEditorInputEvent(input, "deleteContentBackward", null, { beforeInput: true });
    const deleted = runWhatsAppEditorCommand("delete");
    dispatchWhatsAppEditorInputEvent(input, "deleteContentBackward", null);
    dispatchWhatsAppEditorChange(input);

    if (!deleted) {
      return { ok: false, actual: normalizeComposerText(getInputText(input)), strategy: "whatsapp-delete-failed" };
    }

    const cleared = await waitForWhatsAppComposerText(input, "", {
      timeoutMs: WHATSAPP_REWRITE_CLEAR_TIMEOUT_MS,
      stablePasses: 2
    });
    return {
      ...cleared,
      strategy: cleared.ok ? "whatsapp-clear-synced" : "whatsapp-clear-not-empty"
    };
  }

  function insertWhatsAppComposerTextThroughEditor(input, text, options = {}) {
    const normalized = normalizeComposerText(text);
    if (!selectWhatsAppComposerContents(input)) return false;

    const inserted = !normalized || (
      normalized.includes("\n")
        ? dispatchWhatsAppEditorPasteEvent(input, normalized)
        : runWhatsAppEditorCommand("insertText", normalized)
    );
    if (!inserted) return false;

    if (Number.isFinite(options.caretOffset)) {
      try {
        input.focus({ preventScroll: true });
      } catch {
        focusWhatsAppComposer(input);
      }
    }
    dispatchWhatsAppEditorInputEvent(input, "insertReplacementText", null);
    dispatchWhatsAppEditorChange(input);
    return true;
  }

  async function applyWhatsAppEditorActionComposerText(input, expectedText, options = {}) {
    const plan = buildComposerWritePlan(input, expectedText);
    const expected = plan.canonical;
    const writeText = plan.writeText;
    const rawInsertedText =
      typeof options.rawInsertedText === "string"
        ? normalizeComposerText(options.rawInsertedText)
        : "";

    debugWhatsAppComposerSync("whatsapp-sync:before-editor-action", input, expected, null, {
      context: options.context || "composer-rewrite"
    });

    suppressFollowupInputScan();
    const cleared = await clearWhatsAppComposerThroughEditor(input);
    debugWhatsAppComposerSync("whatsapp-sync:after-clear", input, expected, cleared.actual, {
      clearOk: cleared.ok,
      strategy: cleared.strategy
    });
    if (!cleared.ok) {
      return {
        ok: false,
        actual: cleared.actual,
        strategy: cleared.strategy || "whatsapp-clear-failed"
      };
    }

    suppressFollowupInputScan();
    const inserted = insertWhatsAppComposerTextThroughEditor(input, writeText, {
      caretOffset: options.caretOffset
    });
    if (!inserted) {
      return {
        ok: false,
        actual: normalizeComposerText(getInputText(input)),
        strategy: "whatsapp-insert-failed"
      };
    }

    const settled = await waitForWhatsAppComposerText(input, expected, {
      timeoutMs: WHATSAPP_REWRITE_INSERT_TIMEOUT_MS,
      stablePasses: 2
    });
    debugWhatsAppComposerSync("whatsapp-sync:after-insert-settle", input, expected, settled.actual, {
      insertOk: inserted,
      exactMatch: settled.actual === expected
    });

    const verification = await verifyComposerRewriteSafe({
      input,
      expectedText: expected,
      originalText: options.originalText || rawInsertedText || options.restoreText || "",
      redactedText: expected,
      findings: options.findings,
      context: options.context || "composer-rewrite",
      caretOffset: options.caretOffset,
      actualText: settled.actual,
      allowMultilineRetry: false
    });

    const verifiedActual = verification.actual || settled.actual;
    const verifiedSafePlaceholderLayout = shouldAcceptWhatsAppSafePlaceholderPasteVerification(
      expected,
      verifiedActual
    );

    if (!verification.ok && !verifiedSafePlaceholderLayout) {
      return {
        ok: false,
        actual: verifiedActual,
        strategy: `whatsapp-${verification.strategy || "rewrite-verification-failed"}`
      };
    }

    const settledActual = normalizeComposerText(settled.actual);
    const exactSettledMatch = settledActual === expected;
    if (
      !exactSettledMatch &&
      !verifiedSafePlaceholderLayout &&
      !shouldAcceptWhatsAppSafePlaceholderPasteVerification(expected, settledActual)
    ) {
      return {
        ok: false,
        actual: settled.actual,
        strategy: "whatsapp-insert-verification-failed"
      };
    }

    return {
      ok: true,
      actual: verifiedActual,
      strategy:
        exactSettledMatch
          ? "whatsapp-editor-action"
          : verification.ok
            ? `whatsapp-editor-action-${verification.strategy || "safe-verification"}`
            : "whatsapp-editor-action-safe-placeholder-verification"
    };
  }

  function applyWhatsAppSyncedComposerText(input, expectedText, options = {}) {
    return applyWhatsAppEditorActionComposerText(input, expectedText, {
      ...options,
      context: options.context || "composer-rewrite"
    });
  }

  async function applyComposerText(input, expectedText, options) {
    options = options || {};
    if (typeof isChatGptHost === "function" && isChatGptHost()) {
      return ChatGptComposerSync.applyChatGptSyncedComposerText(input, expectedText, {
        ...options,
        context: options.context || "composer-rewrite",
        dependencies: getChatGptComposerSyncDependencies()
      });
    }

    const plan = buildComposerWritePlan(input, expectedText);
    const expected = plan.canonical;
    const writeText = plan.writeText;
    const rawInsertedText =
      typeof options.rawInsertedText === "string"
        ? normalizeComposerText(options.rawInsertedText)
        : "";
    const useWhatsAppSyncedRewrite =
      typeof isWhatsAppHost === "function" &&
      isWhatsAppHost() &&
      isContentEditable(input);

    if (useWhatsAppSyncedRewrite) {
      return applyWhatsAppSyncedComposerText(input, expected, {
        ...options,
        originalText: options.originalText || rawInsertedText || options.restoreText || "",
        redactedText: expected,
        rawInsertedText
      });
    }

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
    const isWhatsAppContentEditable =
      typeof isWhatsAppHost === "function" &&
      isWhatsAppHost() &&
      isContentEditable(input);
    const hasRawLeak = (actual) =>
      Boolean(
        normalizedOriginal &&
          normalizeComposerText(actual).includes(normalizedOriginal) &&
          !acceptableTexts.includes(normalizeComposerText(actual))
      );

    if (
      isWhatsAppContentEditable &&
      containsVisiblePlaceholderToken(normalizedOriginal) &&
      hasUnsafeVisibleSecret(normalizedOriginal)
    ) {
      return {
        ok: false,
        actual: normalizedOriginal,
        strategy: "whatsapp-corrupted-composer-blocked"
      };
    }

    const applied = await applyComposerText(input, normalizedRedacted, {
      ...options,
      originalText: normalizedOriginal,
      redactedText: normalizedRedacted,
      rawInsertedText: normalizedOriginal
    });

    if (applied.ok && !hasRawLeak(applied.actual)) {
      return applied;
    }

    if (isWhatsAppContentEditable) {
      return {
        ok: false,
        actual: applied.actual || getInputText(input),
        strategy: applied.strategy || "whatsapp-synced-rewrite-failed"
      };
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
    return (
      verification.ok ||
      shouldAcceptWhatsAppSafePlaceholderPasteVerification(
        plan.canonical,
        verification.actual || actual
      )
    );
  }

  async function applySubmitRedactionTransactionally(input, originalText, redactedText, context, findings) {
    const applied = await rewriteComposerTransactionally(input, originalText, redactedText, context, {
      caretOffset: String(redactedText || "").length,
      restoreText: originalText,
      restoreCaretOffset: String(originalText || "").length,
      findings
    });

    if (!applied.ok) {
      await showRewriteFailure(
        context,
        collectFailureDetails(input, redactedText, applied.actual, context)
      );
      refreshBadgeFromCurrentInput();
      return false;
    }

    if (!(await ensureExactComposerState(input, redactedText, {
      originalText,
      findings,
      context
    }))) {
      await showRewriteFailure(
        context,
        collectFailureDetails(input, redactedText, getInputText(input), context)
      );
      refreshBadgeFromCurrentInput();
      return false;
    }

    return true;
  }

  function queueVerifiedComposerSend(input, expectedText, context, send, options = {}) {
    const settle = () => {
      if (typeof options.onSettled === "function") {
        options.onSettled();
      }
    };
    queueMicrotask(() => {
      ensureExactComposerState(input, expectedText, { context })
        .then((isExact) => {
          if (!isExact) {
            settle();
            clearFallbackSendKeyRedactionPending(input);
            return showRewriteFailure(
              context,
              collectFailureDetails(input, expectedText, getInputText(input), context)
            ).then(() => {
              refreshBadgeFromCurrentInput();
            });
          }

          clearFallbackSendKeyRedactionPending(input);
          try {
            send();
          } finally {
            settle();
          }
          return null;
        })
        .catch((error) => {
          settle();
          handleContentError(error);
        });
    });
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

  function isPreferredSubmitterForForm(form, button) {
    if (!form || !button || !isVisible(button) || button.disabled) return false;
    const ownerForm = button.form || button.closest?.("form") || null;
    if (ownerForm !== form) return false;

    const tagName = String(button.tagName || "").toLowerCase();
    const type = String(button.type || button.getAttribute?.("type") || (tagName === "button" ? "submit" : "")).toLowerCase();
    if (tagName === "button") return type === "submit" || type === "";
    if (tagName === "input") return type === "submit" || type === "image";
    return false;
  }

  function dispatchSubmitEventWithBypass(form, submitter = null) {
    if (!form || typeof form.dispatchEvent !== "function") return false;
    let event = null;
    try {
      if (typeof SubmitEvent === "function") {
        event = new SubmitEvent("submit", {
          bubbles: true,
          cancelable: true,
          submitter
        });
      }
    } catch {
      event = null;
    }

    if (!event) {
      event = new Event("submit", { bubbles: true, cancelable: true });
      if (submitter && !("submitter" in event)) {
        try {
          Object.defineProperty(event, "submitter", { value: submitter });
        } catch {
          // Older engines may expose a non-configurable Event shape.
        }
      }
    }

    form.dispatchEvent(event);
    return true;
  }

  function clickSendButtonWithBypass(button, options = {}) {
    if (!button) return false;
    const fallbackForm = options.fallbackForm || null;
    let submitObserved = false;
    const markSubmitObserved = () => {
      submitObserved = true;
    };
    if (fallbackForm && typeof fallbackForm.addEventListener === "function") {
      fallbackForm.addEventListener("submit", markSubmitObserved, true);
    }

    bypassNextSendButtonClick = true;
    button.click();
    queueMicrotask(() => {
      bypassNextSendButtonClick = false;
      if (fallbackForm && typeof fallbackForm.removeEventListener === "function") {
        fallbackForm.removeEventListener("submit", markSubmitObserved, true);
      }
      if (fallbackForm && !submitObserved) {
        dispatchSubmitEventWithBypass(fallbackForm, button);
      }
    });
    return true;
  }

  function submitComposer(form, input, preferredButton = null, options = {}) {
    clearAllRiskSessionState();
    const preferButtonClick = Boolean(options.preferButtonClick);

    if (form && typeof form.requestSubmit === "function") {
      if (preferButtonClick && isPreferredSubmitterForForm(form, preferredButton)) {
        if (clickSendButtonWithBypass(preferredButton, { fallbackForm: form })) return;
      }

      if (isPreferredSubmitterForForm(form, preferredButton)) {
        try {
          form.requestSubmit(preferredButton);
          return;
        } catch {
          if (clickSendButtonWithBypass(preferredButton, { fallbackForm: form })) return;
        }
      }

      try {
        form.requestSubmit();
        return;
      } catch {
        // Fall back to a verified button replay when requestSubmit is unavailable for this form state.
      }
    }

    const button = preferredButton && isVisible(preferredButton)
      ? preferredButton
      : findSendButton(input);
    if (button) {
      clickSendButtonWithBypass(button, { fallbackForm: form || button.form || button.closest?.("form") || null });
    }
  }

  function replayVerifiedSend(input, form = null, preferredButton = null, options = {}) {
    const targetForm = form || preferredButton?.closest?.("form") || input?.closest?.("form") || null;
    if (targetForm) {
      bypassNextSubmit = true;
    }
    submitComposer(targetForm, input, preferredButton, options);
    if (targetForm) {
      queueMicrotask(() => {
        bypassNextSubmit = false;
      });
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
      if (
        context === "paste" &&
        shouldAcceptWhatsAppSafePlaceholderPasteVerification(next.text, applied.actual)
      ) {
        debugReveal("whatsapp:paste-safe-placeholder-verification-accepted", {
          reason: "actual_contains_expected_placeholders",
          strategy: applied.strategy || null,
          expected: {
            length: getDebugTextLength(next.text),
            placeholderCount: countDebugPlaceholders(next.text)
          },
          actual: {
            length: getDebugTextLength(applied.actual),
            placeholderCount: countDebugPlaceholders(applied.actual)
          }
        });
        return true;
      }

      await showRewriteFailure(
        context,
        collectFailureDetails(input, next.text, applied.actual, context)
      );
      refreshBadgeFromCurrentInput();
      return false;
    }

    return true;
  }

  function containsVisiblePlaceholderToken(text) {
    const regex = ANY_PLACEHOLDER_TOKEN_REGEX || PLACEHOLDER_TOKEN_REGEX;
    if (!regex?.test) return false;
    regex.lastIndex = 0;
    const hasPlaceholder = regex.test(String(text || ""));
    regex.lastIndex = 0;
    return hasPlaceholder;
  }

  function hasUnsafeVisibleSecret(text) {
    const analysis = analyzeText(text);
    return (analysis.secretFindings || []).some((finding) => {
      const { raw = "" } = finding || {};
      return isHighConfidenceRewriteFinding(finding) && !containsVisiblePlaceholderToken(raw);
    });
  }

  function shouldAcceptWhatsAppSafePlaceholderPasteVerification(expectedText, actualText) {
    if (!isWhatsAppHost()) return false;

    const expected = normalizeComposerText(expectedText);
    const actual = normalizeComposerText(actualText);
    if (!expected.trim() || !actual.trim()) return false;
    if (!containsVisiblePlaceholderToken(expected) || !containsVisiblePlaceholderToken(actual)) {
      return false;
    }
    if (!isReasonablyCloseRewriteLength(expected, actual)) return false;
    if (listPlaceholderTokens(expected).length !== listPlaceholderTokens(actual).length) {
      return false;
    }
    if (!actualContainsExpectedPlaceholders(expected, actual)) return false;
    if (hasUnsafeVisibleSecret(actual)) return false;

    return true;
  }

  function shouldSuppressStaleTypedRewriteFailure(rewriteGeneration, input, actualText = null) {
    if (rewriteGeneration === typedRewriteGeneration) return false;

    const actual = normalizeComposerText(actualText == null ? getInputText(input) : actualText);
    return Boolean(
      actual.trim() &&
        containsVisiblePlaceholderToken(actual) &&
        !hasUnsafeVisibleSecret(actual)
    );
  }

  async function applyTypedInterceptionRewrite(
    input,
    expectedText,
    originalText,
    selection,
    context
  ) {
    const rewriteGeneration = ++typedRewriteGeneration;
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
      if (shouldSuppressStaleTypedRewriteFailure(rewriteGeneration, input, applied.actual)) {
        refreshBadgeFromCurrentInput();
        return false;
      }
      await showRewriteFailure(
        context,
        collectFailureDetails(input, expectedText, applied.actual, context)
      );
      refreshBadgeFromCurrentInput();
      return false;
    }

    if (!(await ensureExactComposerState(input, expectedText))) {
      const actual = getInputText(input);
      if (shouldSuppressStaleTypedRewriteFailure(rewriteGeneration, input, actual)) {
        refreshBadgeFromCurrentInput();
        return false;
      }
      await showRewriteFailure(
        context,
        collectFailureDetails(input, expectedText, actual, context)
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

    if (!isLiveTypedRedactionEnabled(getActivePolicy())) {
      return;
    }

    let firefoxEarlyAnalysis = null;
    let firefoxEarlyRelevantFindings = [];
    let firefoxEarlyPlaceholderNormalizationChanged = false;
    if (isFirefoxRuntime()) {
      firefoxEarlyAnalysis = analyzeText(next.text);
      firefoxEarlyRelevantFindings = selectFindingsOverlappingInsertion(
        firefoxEarlyAnalysis.findings,
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
    const quickCurrentAnalysis = analyzeText(originalText);
    const quickNextAnalysis = analyzeText(next.text);
    const quickRelevantFindings = selectFindingsOverlappingInsertion(
      quickNextAnalysis.findings,
      selection,
      insertedText
    );
    const quickPlaceholderNormalizationChanged =
      quickNextAnalysis.placeholderNormalized &&
      quickNextAnalysis.normalizedText !== next.text &&
      (normalizeVisiblePlaceholders(insertedText) !== insertedText ||
        quickNextAnalysis.normalizedText !== quickCurrentAnalysis.normalizedText);

    if (!quickRelevantFindings.length && !quickPlaceholderNormalizationChanged) {
      return;
    }

    if (!event.defaultPrevented) {
      consumeInterceptionEvent(event);
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

    if (!relevantFindings.length && !placeholderNormalizationChanged) return;

    const typedShouldAutoRedact = shouldAutoRedactTypedSecrets(
      relevantSecretFindings,
      relevantFindings
    );

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
    if (isSanitizedTextRewriteEvent(event)) return;

    if (isGeminiHost() && await maybeHandleGeminiEditorPaste(event)) {
      return;
    }

    const rawPasteTransfer = getPasteTransfer(event);
    const pasteTransfer =
      typeof normalizeClipboardImageDataTransfer === "function"
        ? normalizeClipboardImageDataTransfer(rawPasteTransfer)
        : rawPasteTransfer;
    const hasPasteFiles =
      typeof dataTransferHasFiles === "function" && dataTransferHasFiles(pasteTransfer);
    const supportedWhatsAppClipboardImagePaste =
      hasPasteFiles && isSupportedWhatsAppClipboardImagePaste(pasteTransfer, "paste");
    if (
      hasPasteFiles &&
      isWhatsAppHost() &&
      !supportedWhatsAppClipboardImagePaste
    ) {
      await blockWhatsAppFileAttachment(event);
      return;
    }
    if (supportedWhatsAppClipboardImagePaste) {
      consumeInterceptionEvent(event);
    }

    const input = findComposer(event.target);
    if (!input) {
      if (hasPasteFiles && isWhatsAppHost()) {
        await blockWhatsAppFileAttachment(event);
      }
      return;
    }
    noteActiveRiskEditor(input);

    if (hasPasteFiles) {
      await maybeHandleLocalFileInsert(event, input, pasteTransfer, "paste");
      return;
    }

    const pasted = getPastedPlainText(event);

    if (!pasted) return;
    if (shouldSuppressDuplicateWhatsAppTextPaste(input, pasted, event)) {
      consumeInterceptionEvent(event);
      return;
    }

    const quickAnalysis = analyzeText(pasted);
    if (!quickAnalysis.findings.length && !quickAnalysis.placeholderNormalized) return;
    rememberWhatsAppTextPaste(input, pasted, event);
    consumeInterceptionEvent(event);

    if (await maybeHandleChatGptLargeTextPaste(event, input, pasted, quickAnalysis)) {
      return;
    }

    const originalText = getInputText(input);
    const selection = getSelectionOffsets(input);

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

  function isSanitizedTextRewriteEvent(event) {
    return Boolean(event?.__PWM_SANITIZED_TEXT_REWRITE__);
  }

  function markSanitizedTextRewriteEvent(event) {
    try {
      Object.defineProperty(event, "__PWM_SANITIZED_TEXT_REWRITE__", {
        value: true,
        configurable: false
      });
    } catch {
      event.__PWM_SANITIZED_TEXT_REWRITE__ = true;
    }
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
    const sanitizedFiles = Array.isArray(sanitizedFile) ? sanitizedFile : [sanitizedFile];
    const files = sanitizedFiles.filter(Boolean);
    if (!files.length || typeof DataTransfer !== "function" || !canUseSyntheticDataTransferFileList()) {
      return null;
    }

    try {
      const transfer = new DataTransfer();
      if (typeof transfer.items?.add !== "function") return null;
      files.forEach((file) => transfer.items.add(file));
      return Number(transfer.files?.length || 0) === files.length ? transfer : null;
    } catch {
      return null;
    }
  }

  function createSanitizedDataTransferForHandoff(sanitizedFile, details) {
    const sanitizedFiles = Array.isArray(sanitizedFile) ? sanitizedFile : [sanitizedFile];
    if (details) {
      details.dataTransferConstructorSucceeded = false;
      details.dataTransferItemsAddSucceeded = false;
    }
    if (!sanitizedFiles.filter(Boolean).length || typeof DataTransfer !== "function" || !canUseSyntheticDataTransferFileList()) {
      return null;
    }

    try {
      const transfer = new DataTransfer();
      if (details) details.dataTransferConstructorSucceeded = true;
      if (typeof transfer.items?.add !== "function") return null;
      const files = sanitizedFiles.filter(Boolean);
      files.forEach((file) => transfer.items.add(file));
      if (details) details.dataTransferItemsAddSucceeded = true;
      return Number(transfer.files?.length || 0) === files.length ? transfer : null;
    } catch (error) {
      if (details) {
        assignSafeFileAttachErrorMetadata(details, error);
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

  function isWhatsAppHost() {
    return globalThis.PWM.HostMatching.isWhatsAppHost(location.hostname);
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
    const protection = getActiveProtection();
    if (protection.protectionEnforced === true) return true;
    if (protection.paused === true && protection.allowProtectionPause === true) return false;

    if (
      id === "gemini" ||
      id === "chatgpt" ||
      id === "claude" ||
      id === "grok" ||
      id === "openai" ||
      id === "x" ||
      id === "whatsapp"
    ) {
      return true;
    }
    if (id !== "generic") {
      return false;
    }
    if (currentPublicState.currentSite?.protected === true) return true;
    if (currentPublicState.currentSite?.protected === false) {
      return false;
    }
    return true;
  }

  function getChatGptLargePasteOrchestration() {
    if (chatGptLargePasteOrchestration) return chatGptLargePasteOrchestration;
    if (typeof ChatGptLargePasteOrchestration.createChatGptLargePasteOrchestration !== "function") {
      chatGptLargePasteOrchestration = Object.freeze({
        maybeHandleChatGptLargeTextPaste: async () => false
      });
      return chatGptLargePasteOrchestration;
    }

    chatGptLargePasteOrchestration =
      ChatGptLargePasteOrchestration.createChatGptLargePasteOrchestration({
        analyzeText,
        blockLargeLocalTextPayload,
        chatGptComposerSync: ChatGptComposerSync,
        chatGptLargePasteFileName: CHATGPT_SANITIZED_PASTE_FILE_NAME,
        chatGptLargePasteFileThreshold: CHATGPT_LARGE_PASTE_FILE_THRESHOLD,
        classifyLocalTextPayloadSize,
        clearLocalPayloadOptimizationStatus,
        collectFailureDetails,
        consumeInterceptionEvent,
        countDebugPlaceholders,
        createSanitizedTextFile,
        debugReveal,
        describeFileForDebug,
        getChatGptComposerSyncDependencies,
        getInputText,
        getLocalTextPayloadByteLength,
        getSelectionOffsets,
        handOffSanitizedLocalFile,
        hideBadgeSoon,
        isChatGptHost,
        localTextHardBlockBytes: LOCAL_TEXT_HARD_BLOCK_BYTES,
        locationRef: location,
        normalizeComposerText,
        refreshBadgeFromCurrentInput,
        requestRedaction,
        setBadge,
        setInputTextDirect,
        showLocalPayloadOptimizationStatus,
        showMessageModal,
        showRewriteFailure,
        spliceSelectionText,
        syncSuppressMs: GEMINI_LARGE_TEXT_SUPPRESS_MS
      });
    return chatGptLargePasteOrchestration;
  }

  async function maybeHandleChatGptLargeTextPaste(event, input, pasted, quickAnalysis) {
    return getChatGptLargePasteOrchestration().maybeHandleChatGptLargeTextPaste(
      event,
      input,
      pasted,
      quickAnalysis
    );
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

  function getGeminiEditorPasteOrchestration() {
    if (geminiEditorPasteOrchestration) return geminiEditorPasteOrchestration;
    if (typeof GeminiEditorPasteOrchestration.createGeminiEditorPasteOrchestration !== "function") {
      geminiEditorPasteOrchestration = Object.freeze({
        maybeHandleGeminiEditorPaste: async () => false
      });
      return geminiEditorPasteOrchestration;
    }

    geminiEditorPasteOrchestration =
      GeminiEditorPasteOrchestration.createGeminiEditorPasteOrchestration({
        analyzeTextWithAiAssist,
        applyGeminiEditorText,
        blockLargeLocalTextPayload,
        classifyLocalTextPayloadSize,
        clearLocalPayloadOptimizationStatus,
        consumeInterceptionEvent,
        getPolicyForAction,
        handleContentError,
        handleDestinationPolicy,
        handleHttpSecretPolicy,
        hideBadgeSoon,
        isProtectionPauseActiveAfterPolicy,
        noteActiveRiskEditor,
        promptForSensitiveContentDecision,
        refreshBadgeFromCurrentInput,
        requestRedaction,
        resolveGeminiEditorTarget,
        setBadge,
        shouldForceDestinationRedaction,
        showLocalPayloadOptimizationStatus,
        showMessageModal
      });
    return geminiEditorPasteOrchestration;
  }

  async function maybeHandleGeminiEditorPaste(event) {
    return getGeminiEditorPasteOrchestration().maybeHandleGeminiEditorPaste(event);
  }

  function isFileInputElement(el) {
    return (
      !!el &&
      el.tagName === "INPUT" &&
      String(el.type || "").toLowerCase() === "file"
    );
  }

  function describeFileForDebug(file) {
    return globalThis.PWM.SafeSnapshots?.describeFileForDebug?.(file) ||
      (typeof contentDebug !== "undefined" ? contentDebug.describeFileForDebug(file) : {
        nameLength: String(file?.name || "").length,
        size: Number(file?.size || 0),
        type: String(file?.type || "").split(";")[0].slice(0, 80),
        lastModified: Number(file?.lastModified || 0) || 0
      });
  }


  function describeSanitizedFileOrBatchForDebug(sanitizedFile) {
    const files = Array.isArray(sanitizedFile) ? sanitizedFile.filter(Boolean) : [sanitizedFile].filter(Boolean);
    if (files.length <= 1) return { sanitizedFile: describeFileForDebug(files[0]) };
    return {
      sanitizedFileCount: files.length,
      sanitizedFiles: files.map((file, index) =>
        globalThis.PWM.FileAttachPipeline.createMultiFileItemSummary({
          index,
          status: "sanitized",
          file
        })
      )
    };
  }

  function describeFileInputForDebug(fileInput, source = "") {
    if (!isFileInputElement(fileInput)) return null;
    if (typeof contentDebug !== "undefined") return contentDebug.describeFileInputForDebug(fileInput, source);
    return {
      tag: fileInput.tagName || "",
      source,
      disabled: Boolean(fileInput.disabled),
      hidden: Boolean(fileInput.hidden),
      classLength: String(typeof fileInput.className === "string" ? fileInput.className : fileInput.getAttribute?.("class") || "").length,
      acceptLength: String(fileInput.accept || "").length,
      multiple: Boolean(fileInput.multiple),
      filesLength: Number(fileInput.files?.length || 0)
    };
  }

  function getSafeTextSnippet(el) {
    let text = "";
    try {
      const normalize = typeof normalizeComposerText === "function" ? normalizeComposerText : (value) => String(value || "");
      text = normalize(el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
    } catch {
      text = "";
    }
    if (!text) return "";
    const snippet = text.slice(0, 80);
    if (/(?:bearer|cookie|credential|key|password|raw|reveal|secret|token|sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16})/i.test(snippet)) {
      return `[text length=${text.length}]`;
    }
    if (/[A-Za-z0-9+/=_-]{24,}/.test(snippet)) return `[text length=${text.length}]`;
    return snippet;
  }

  function describeElementForDebug(el, source = "") {
    if (!el) return null;
    if (typeof contentDebug === "undefined") {
      const safeAttribute = (name) => {
        try {
          return String(el?.getAttribute?.(name) || "");
        } catch {
          return "";
        }
      };
      const safeDebugString = (value) => {
        const text = String(value || "");
        if (!text || text.length > 120) return "";
        if (/(?:bearer|cookie|credential|key|password|raw|reveal|secret|token|sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16})/i.test(text)) {
          return "";
        }
        if (/[A-Za-z0-9+/=_-]{24,}/.test(text)) return "";
        if (/(?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|[\\/][^\\/]+[\\/])/.test(text)) return "";
        return text;
      };
      const safeDebugClassName = (value) => {
        const text = String(value || "");
        if (!text || text.length > 256) return "";
        if (/[^A-Za-z0-9 _:-]/.test(text)) return "";
        if (/(?:bearer|cookie|key|password|secret|token|sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16})/i.test(text)) return "";
        if (/[A-Za-z0-9+/=_-]{24,}/.test(text)) return "";
        return text;
      };
      const ariaLabel = safeAttribute("aria-label") || el.ariaLabel || "";
      const title = safeAttribute("title") || el.title || "";
      const className = typeof el.className === "string" ? el.className : safeAttribute("class");
      return {
        tag: el.tagName || "",
        role: safeAttribute("role") || el.role || "",
        ariaLabel: safeDebugString(ariaLabel),
        ariaLabelLength: String(ariaLabel).length,
        title: safeDebugString(title),
        titleLength: String(title).length,
        className: safeDebugClassName(className),
        classLength: String(className).length,
        textSnippet: getSafeTextSnippet(el),
        source
      };
    }
    return {
      ...contentDebug.describeElementForDebug(el, source),
      textSnippet: getSafeTextSnippet(el)
    };
  }

  function originalFileMetadataFromEvent(event) {
    try {
      return describeFileForDebug(event?.dataTransfer?.files?.[0]);
    } catch {
      return null;
    }
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
    const fileName = typeof redactSensitiveFileName === "function"
      ? redactSensitiveFileName(payload?.sanitizedFile?.name || payload?.originalFile?.name || "sanitized-file.txt")
      : sanitizeDownloadFileNameSegment(payload?.sanitizedFile?.name || payload?.originalFile?.name || "sanitized-file.txt");
    const language = fallbackLanguageFromFileName(fileName);
    return `LeakGuard sanitized file: ${fileName}\n\n\`\`\`${language}\n${String(
      payload?.redactedText || ""
    )}\n\`\`\``;
  }

  function formatGeminiSanitizedFileFallbackText(payload) {
    return formatSanitizedFileFallbackText(payload);
  }

  async function tryGeminiSanitizedFileAttach(payload, event, input) {
    if (!isGeminiHost() || !payload?.sanitizedFile) return false;
    if (shouldUseFirefoxTextFallbackForFileHandoff()) return false;
    return handOffGeminiSanitizedFileUpload(event, input, payload.sanitizedFile, {
      allowUploadUiClick: !isFirefoxRuntime() || event?.type === "drop"
    });
  }

  function createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput = null) {
    return getGeminiFileHandoff().createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput);
  }

  function listFirefoxGeminiBridgeSanitizedFiles(payload) {
    return getGeminiFileHandoff().listFirefoxGeminiBridgeSanitizedFiles(payload);
  }

  function createFirefoxGeminiBridgeDataTransfer(sanitizedFiles, details) {
    return getGeminiFileHandoff().createFirefoxGeminiBridgeDataTransfer(sanitizedFiles, details);
  }

  function findGeminiFileInput(event = null, input = null) {
    return getGeminiFileHandoff().findGeminiFileInput(event, input);
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
    const className =
      details?.className ||
      (typeof candidate.className === "string" ? candidate.className : candidate.getAttribute?.("class") || "");
    const text = (
      details?.textSnippet ||
      candidate.innerText ||
      candidate.textContent ||
      ""
    ).trim().toLowerCase();
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
    return getGeminiFileHandoff().createGeminiFirefoxFilePickerGuard();
  }

  function getGeminiUploadDiscovery() {
    if (geminiUploadDiscovery) return geminiUploadDiscovery;
    if (typeof GeminiUploadDiscovery.createGeminiUploadDiscovery !== "function") {
      geminiUploadDiscovery = Object.freeze({
        openGeminiUploadMenuSafely: () => false,
        isSafeGeminiUploadFilesMenuItem: () => false,
        collectGeminiUploadFilesMenuItemsFromRoot: () => {},
        findGeminiUploadFilesMenuItem: () => null,
        openGeminiUploadFilesMenuItemSafely: () => false,
        isGeminiHiddenFileSelectorTrigger: () => false,
        collectGeminiHiddenFileSelectorTriggersFromRoot: () => {},
        findGeminiHiddenFileSelectorTrigger: () => null,
        findGeminiHiddenFileSelectorTriggerInNode: () => null,
        findGeminiHiddenFileSelectorTriggerInMutations: () => null,
        activateGeminiHiddenFileSelectorTriggerSafely: () => false,
        waitForGeminiUploadFilesMenuItem: async () => null,
        isLikelyGeminiUploadClickTarget: () => false,
        isRejectedGeminiUploadMenuItem: () => false,
        scoreGeminiUploadMenuItem: () => 0,
        discoverGeminiUploadOverlayItem: () => null,
        isForbiddenGeminiUploadButton: () => true,
        isAllowedGeminiUploadMenuOpener: () => false,
        clickElementSafely: () => false
      });
      return geminiUploadDiscovery;
    }

    geminiUploadDiscovery = GeminiUploadDiscovery.createGeminiUploadDiscovery({
      documentRef: document,
      MutationObserverRef: typeof MutationObserver === "function" ? MutationObserver : null,
      MouseEventRef: typeof MouseEvent === "function" ? MouseEvent : null,
      setTimeoutFn: setTimeout,
      clearTimeoutFn: clearTimeout,
      isGeminiHost,
      isFileInputElement,
      normalizeTarget,
      describeElementForDebug,
      createGeminiUploadMenuEvent,
      isSafeGeminiUploadMenuButton,
      isGeminiUploadMenuButtonVisible,
      hasGeminiUploadMenuIntent,
      isUnsafeGeminiUploadMenuButton,
      isGeminiSourceUploadIcon
    });
    return geminiUploadDiscovery;
  }

  function getGeminiFileHandoff() {
    if (geminiFileHandoff) return geminiFileHandoff;
    if (typeof GeminiFileHandoff.createGeminiFileHandoff !== "function") {
      geminiFileHandoff = Object.freeze({
        listFirefoxGeminiBridgeSanitizedFiles: () => [],
        createFirefoxGeminiFileInputBridgeDebug: () => ({}),
        createFirefoxGeminiBridgeDataTransfer: () => null,
        findGeminiFileInput: () => ({ discovery: {}, fileInput: null }),
        createGeminiFirefoxFilePickerGuard: () => ({
          getInput: () => null,
          waitForInput: async () => null,
          cleanup: () => {}
        }),
        waitForGeminiFileInput: async () => ({ discovery: {}, fileInput: null }),
        verifyGeminiFirefoxFileInputBridgeAssignment: () => false,
        primeGeminiFirefoxUploadTarget: () => null,
        handOffPrimedGeminiFirefoxUploadTarget: async () => ({ ok: false, reason: "handoff_unavailable" }),
        tryFirefoxGeminiFileInputBridge: async () => ({ handled: false, ok: false }),
        handOffGeminiSanitizedFileInput: async () => false,
        performPendingGeminiUserAttach: async () => false,
        clearPendingGeminiGhostIngressClickInterceptor: () => {},
        createGeminiGhostIngressClickInterceptor: () => null,
        waitForGeminiGhostIngressFileInput: async () => ({ discovery: {}, fileInput: null }),
        handOffGeminiSanitizedFileUpload: async () => false
      });
      return geminiFileHandoff;
    }

    geminiFileHandoff = GeminiFileHandoff.createGeminiFileHandoff({
      documentRef: document,
      windowRef: window,
      locationRef: location,
      DataTransferRef: typeof DataTransfer === "function" ? DataTransfer : null,
      MutationObserverRef: typeof MutationObserver === "function" ? MutationObserver : null,
      setTimeoutFn: setTimeout,
      clearTimeoutFn: clearTimeout,
      requestAnimationFrameFn:
        typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : null,
      geminiUploadInputWaitMs: GEMINI_UPLOAD_INPUT_WAIT_MS,
      geminiGhostIngressTimeoutMs: GEMINI_GHOST_INGRESS_TIMEOUT_MS,
      firefoxGeminiFileInputBridgeFailureMessage: FIREFOX_GEMINI_FILE_INPUT_BRIDGE_FAILURE_MESSAGE,
      isGeminiHost,
      isFirefoxRuntime,
      isFileInputElement,
      canUseSyntheticDataTransferFileList,
      shouldUseFirefoxTextFallbackForFileHandoff,
      createSanitizedFileHandoffDetails,
      createSanitizedDataTransferForHandoff,
      handOffSanitizedFileInput,
      discoverGeminiFileHandoffElements,
      findGeminiUploadFilesMenuItem,
      findGeminiUploadMenuButton,
      openGeminiUploadMenuSafely,
      openGeminiUploadFilesMenuItemSafely,
      waitForGeminiUploadFilesMenuItem,
      findGeminiHiddenFileSelectorTrigger,
      activateGeminiHiddenFileSelectorTriggerSafely,
      findGeminiFileDataInputFromEvent,
      findGeminiFileDataInputInMutations,
      isGeminiHiddenFileSelectorTrigger,
      isGeminiGhostIngressFileInput,
      isAllowedGeminiUploadMenuOpener,
      clickElementSafely,
      discoverGeminiUploadOverlayItem,
      shouldQueueFirefoxGeminiPendingSanitizedFileHandoff,
      isExpectedFirefoxGeminiNoPickerMiss,
      queuePendingSanitizedFileHandoff,
      getFileHandoffAdapterById,
      hasPendingGeminiSanitizedFileHandoff,
      suppressStaleHandoffErrorAfterSuccess,
      listLocalTransferFiles,
      describeFileForDebug,
      describeFileInputForDebug,
      describeElementForDebug,
      describeUploadTriggerForDebug,
      describeGeminiUploadMenuDiscovery,
      describeGeminiOverlayExposure,
      describeSanitizedFileOrBatchForDebug,
      debugReveal,
      debugFileAttachMetadata,
      consumeInterceptionEvent,
      assignSafeFileAttachErrorMetadata,
      logSanitizedFileHandoffFailure,
      clearPendingGeminiSanitizedFileHandoff,
      showFileProcessingSuccess,
      setBadge,
      hideBadgeSoon,
      refreshBadgeFromCurrentInput,
      countGeminiAttachmentIndicators,
      waitForGeminiAttachmentIndicators,
      getCachedGeminiFileInput: () =>
        fileDragDiscoveryCompleted && isFileInputElement(lastDiscoveredFileInput) && !lastDiscoveredFileInput.disabled
          ? lastDiscoveredFileInput
          : null,
      rememberGeminiFileInput: (fileInput) => {
        lastDiscoveredFileInput = fileInput;
        fileDragDiscoveryCompleted = true;
        fileDragDiscoveryScheduled = false;
      }
    });
    return geminiFileHandoff;
  }

  function openGeminiUploadMenuSafely(menuButton) {
    return getGeminiUploadDiscovery().openGeminiUploadMenuSafely(menuButton);
  }

  function isSafeGeminiUploadFilesMenuItem(candidate) {
    return getGeminiUploadDiscovery().isSafeGeminiUploadFilesMenuItem(candidate);
  }

  function collectGeminiUploadFilesMenuItemsFromRoot(root, candidates, seen, visitedRoots) {
    return getGeminiUploadDiscovery().collectGeminiUploadFilesMenuItemsFromRoot(root, candidates, seen, visitedRoots);
  }

  function findGeminiUploadFilesMenuItem() {
    return getGeminiUploadDiscovery().findGeminiUploadFilesMenuItem();
  }

  function openGeminiUploadFilesMenuItemSafely(menuItem) {
    return getGeminiUploadDiscovery().openGeminiUploadFilesMenuItemSafely(menuItem);
  }

  function isGeminiHiddenFileSelectorTrigger(candidate) {
    return getGeminiUploadDiscovery().isGeminiHiddenFileSelectorTrigger(candidate);
  }

  function collectGeminiHiddenFileSelectorTriggersFromRoot(root, candidates, seen, visitedRoots) {
    return getGeminiUploadDiscovery().collectGeminiHiddenFileSelectorTriggersFromRoot(root, candidates, seen, visitedRoots);
  }

  function findGeminiHiddenFileSelectorTrigger() {
    return getGeminiUploadDiscovery().findGeminiHiddenFileSelectorTrigger();
  }

  function findGeminiHiddenFileSelectorTriggerInNode(node) {
    return getGeminiUploadDiscovery().findGeminiHiddenFileSelectorTriggerInNode(node);
  }

  function findGeminiHiddenFileSelectorTriggerInMutations(mutations) {
    return getGeminiUploadDiscovery().findGeminiHiddenFileSelectorTriggerInMutations(mutations);
  }

  function activateGeminiHiddenFileSelectorTriggerSafely(trigger) {
    return getGeminiUploadDiscovery().activateGeminiHiddenFileSelectorTriggerSafely(trigger);
  }

  function waitForGeminiUploadFilesMenuItem(timeoutMs = 3000) {
    return getGeminiUploadDiscovery().waitForGeminiUploadFilesMenuItem(timeoutMs);
  }

  async function waitForGeminiFileInput(timeoutMs = 3000, event = null, input = null, details = null) {
    return getGeminiFileHandoff().waitForGeminiFileInput(timeoutMs, event, input, details);
  }

  function verifyGeminiFirefoxFileInputBridgeAssignment(fileInput, sanitizedFiles, rawFiles) {
    return getGeminiFileHandoff().verifyGeminiFirefoxFileInputBridgeAssignment(
      fileInput,
      sanitizedFiles,
      rawFiles
    );
  }

  function primeGeminiFirefoxUploadTarget(event, input) {
    return getGeminiFileHandoff().primeGeminiFirefoxUploadTarget(event, input);
  }

  async function handOffPrimedGeminiFirefoxUploadTarget(prime, sanitizedFile) {
    return getGeminiFileHandoff().handOffPrimedGeminiFirefoxUploadTarget(prime, sanitizedFile);
  }

  async function tryFirefoxGeminiFileInputBridge(payload, context) {
    return getGeminiFileHandoff().tryFirefoxGeminiFileInputBridge(payload, context);
  }

  function buildSanitizedDownloadFileName(sanitizedFile) {
    const originalName = sanitizeDownloadFileNameSegment(
      typeof redactSensitiveFileName === "function"
        ? redactSensitiveFileName(sanitizedFile?.name || "sanitized-file.txt")
        : sanitizedFile?.name || "sanitized-file.txt"
    );
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
      chipCountBefore: 0,
      chipCountAfter: 0,
      failureReason: "",
      errorMessage: "",
      errorStack: ""
    };
  }

  function sanitizeDownloadFileNameSegment(value, fallback = "sanitized-file.txt") {
    return globalThis.PWM.SafeSnapshots.sanitizeDownloadFileNameSegment(value, fallback);
  }

  function buildGeminiSanitizedDownloadFileName(sanitizedFile) {
    const originalName = sanitizeDownloadFileNameSegment(
      typeof redactSensitiveFileName === "function"
        ? redactSensitiveFileName(sanitizedFile?.name || "sanitized-file.txt")
        : sanitizedFile?.name || "sanitized-file.txt"
    );
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
        assignSafeFileAttachErrorMetadata(details, error);
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
          assignSafeFileAttachErrorMetadata(details, response?.error || "Background download request failed.");
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
        assignSafeFileAttachErrorMetadata(details, error);
      }
      return false;
    }
  }

  function hasGeminiSanitizedDownloadFallback(sanitizedFile) {
    return Boolean(sanitizedFile && geminiSanitizedDownloadFallbacks.has(sanitizedFile));
  }

  function logSanitizedFileHandoffFailure(details, error) {
    const payload = {
      ...(details || {})
    };
    if (error) {
      assignSafeFileAttachErrorMetadata(payload, error);
    }
    try {
      debugFileAttachMetadata("sanitized-file-handoff:failed", payload);
    } catch {
      // Diagnostics must never affect blocking behavior.
    }
  }

  function normalizeFileHandoffAdapter(adapter) {
    if (!adapter) return getFileHandoffAdapterForLocation();
    if (typeof adapter === "string") return getFileHandoffAdapterById(adapter);
    return adapter;
  }

  async function performPendingGeminiUserAttach(event, input, sanitizedFile) {
    return getGeminiFileHandoff().performPendingGeminiUserAttach(event, input, sanitizedFile);
  }

  function getGrokFileHandoff() {
    if (grokFileHandoff) return grokFileHandoff;
    if (typeof GrokFileHandoff.createGrokFileHandoff !== "function") {
      grokFileHandoff = Object.freeze({
        getGrokUploadClickCandidates: () => [],
        isLikelyGrokUploadClickTarget: () => false,
        scoreGrokFileInput: () => -1,
        discoverGrokPendingFileInput: () => ({ fileInput: null, fileInputCount: 0, openShadowRootCount: 0, fileInputs: [] }),
        describeGrokPendingInputDiscovery: () => ({
          fileInputCount: 0,
          openShadowRootCount: 0,
          selectedFileInput: null,
          fileInputCandidates: []
        }),
        findGrokUploadButton: () => null,
        openGrokUploadButtonSafely: () => false,
        waitForGrokPendingFileInput: async () => ({ fileInput: null, fileInputCount: 0, openShadowRootCount: 0, fileInputs: [] }),
        performPendingGrokUserAttach: async () => false,
        handOffGrokSanitizedFileUpload: () => false
      });
      return grokFileHandoff;
    }

    grokFileHandoff = GrokFileHandoff.createGrokFileHandoff({
      documentRef: document,
      MutationObserverRef: typeof MutationObserver === "function" ? MutationObserver : null,
      setTimeoutFn: setTimeout,
      clearTimeoutFn: clearTimeout,
      isGrokHost,
      isFileInputElement,
      normalizeTarget,
      describeElementForDebug,
      describeFileForDebug,
      describeFileInputForDebug,
      createGeminiUploadMenuEvent,
      debugReveal,
      createSanitizedFileHandoffDetails,
      createSanitizedDataTransferForHandoff,
      handOffSanitizedFileInput,
      logSanitizedFileHandoffFailure,
      clearPendingGrokSanitizedFileHandoff,
      showFileProcessingSuccess,
      setBadge,
      hideBadgeSoon,
      refreshBadgeFromCurrentInput,
      suppressStaleHandoffErrorAfterSuccess,
      shouldUseFirefoxTextFallbackForFileHandoff,
      resolveFileInputForHandoff,
      dispatchSanitizedFileEvent
    });
    return grokFileHandoff;
  }

  function findGrokUploadButton() {
    return getGrokFileHandoff().findGrokUploadButton();
  }

  function openGrokUploadButtonSafely(button) {
    return getGrokFileHandoff().openGrokUploadButtonSafely(button);
  }

  function waitForGrokPendingFileInput(timeoutMs = 2500, event = null, input = null) {
    return getGrokFileHandoff().waitForGrokPendingFileInput(timeoutMs, event, input);
  }

  function performPendingGrokUserAttach(event, input, sanitizedFile) {
    return getGrokFileHandoff().performPendingGrokUserAttach(event, input, sanitizedFile);
  }

  function isLikelyGeminiUploadClickTarget(target) {
    return getGeminiUploadDiscovery().isLikelyGeminiUploadClickTarget(target);
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

  function getGrokUploadClickCandidates(clickEventOrTarget) {
    return getGrokFileHandoff().getGrokUploadClickCandidates(clickEventOrTarget);
  }

  function isLikelyGrokUploadClickTarget(clickEventOrTarget) {
    return getGrokFileHandoff().isLikelyGrokUploadClickTarget(clickEventOrTarget);
  }

  function scoreGrokFileInput(candidate, source = "") {
    return getGrokFileHandoff().scoreGrokFileInput(candidate, source);
  }

  function discoverGrokPendingFileInput(event, input) {
    return getGrokFileHandoff().discoverGrokPendingFileInput(event, input);
  }

  function describeGrokPendingInputDiscovery(discovery) {
    return getGrokFileHandoff().describeGrokPendingInputDiscovery(discovery);
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

  function getFileHandoffDiscovery() {
    if (fileHandoffDiscovery) return fileHandoffDiscovery;
    if (typeof FileHandoffDiscovery.createFileHandoffDiscovery !== "function") {
      fileHandoffDiscovery = Object.freeze({
        collectFileInputsFromAncestry: () => {},
        collectFileInputsFromRoot: () => {},
        describeUploadTriggerForDebug: (trigger, source = "") => describeElementForDebug(trigger, source),
        collectFileHandoffElementsFromRoot: () => {},
        collectRootsWithOpenShadow: () => {},
        candidateMatchesAnySelector: () => false,
        getAdapterUploadClickCandidates: () => [],
        isUnsafeFileHandoffClickTarget: () => true,
        isLikelyGenericUploadClickTarget: () => false,
        collectAdapterSelectorCandidates: () => [],
        scoreFileInputForHandoff: () => -1,
        getFileInputDiscoveryScope: () => null,
        discoverFileInputForHandoff: () => null,
        resolveFileInputForHandoff: () => null,
        resolveGenericAdapterFileInput: () => null,
        findGenericAdapterUploadTrigger: () => null,
        activateAdapterUploadElementSafely: () => false,
        waitForGenericAdapterFileInput: async () => null,
        attachGenericPendingWithTrustedActivation: async () => false
      });
      return fileHandoffDiscovery;
    }

    fileHandoffDiscovery = FileHandoffDiscovery.createFileHandoffDiscovery({
      documentRef: document,
      MutationObserverRef: typeof MutationObserver === "function" ? MutationObserver : null,
      setTimeoutFn: setTimeout,
      clearTimeoutFn: clearTimeout,
      isFileInputElement,
      normalizeTarget,
      fileInputAcceptsHandoffFiles,
      isWhatsAppHandoffContext,
      describeElementForDebug,
      describeFileForDebug,
      describeFileHandoffAdapter,
      describeFileInputForDebug,
      debugReveal,
      createGeminiUploadMenuEvent,
      createSanitizedFileHandoffDetails,
      createSanitizedDataTransferForHandoff,
      handOffSanitizedFileInput,
      isFileHandoffAdapterPendingAttachEnabled,
      logSanitizedFileHandoffFailure,
      clearPendingSanitizedFileHandoff
    });
    return fileHandoffDiscovery;
  }

  function collectFileInputsFromAncestry(target, addCandidate) {
    return getFileHandoffDiscovery().collectFileInputsFromAncestry(target, addCandidate);
  }

  function collectFileInputsFromRoot(root, addCandidate, visitedRoots) {
    return getFileHandoffDiscovery().collectFileInputsFromRoot(root, addCandidate, visitedRoots);
  }

  function describeUploadTriggerForDebug(trigger, source = "") {
    return getFileHandoffDiscovery().describeUploadTriggerForDebug(trigger, source);
  }

  function collectFileHandoffElementsFromRoot(root, addInput, addUploadTrigger, visitedRoots, stats) {
    return getFileHandoffDiscovery().collectFileHandoffElementsFromRoot(
      root,
      addInput,
      addUploadTrigger,
      visitedRoots,
      stats
    );
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
    return getFileHandoffDiscovery().collectRootsWithOpenShadow(root, roots, visitedRoots, stats);
  }

  function candidateMatchesAnySelector(candidate, selectors) {
    return getFileHandoffDiscovery().candidateMatchesAnySelector(candidate, selectors);
  }

  function getAdapterUploadClickCandidates(eventOrTarget) {
    return getFileHandoffDiscovery().getAdapterUploadClickCandidates(eventOrTarget);
  }

  function isUnsafeFileHandoffClickTarget(adapter, candidate) {
    return getFileHandoffDiscovery().isUnsafeFileHandoffClickTarget(adapter, candidate);
  }

  function isLikelyGenericUploadClickTarget(adapter, eventOrTarget) {
    return getFileHandoffDiscovery().isLikelyGenericUploadClickTarget(adapter, eventOrTarget);
  }

  function collectAdapterSelectorCandidates(adapter, selectors, event, input) {
    return getFileHandoffDiscovery().collectAdapterSelectorCandidates(adapter, selectors, event, input);
  }

  function resolveGenericAdapterFileInput(adapter, event, input) {
    return getFileHandoffDiscovery().resolveGenericAdapterFileInput(adapter, event, input);
  }

  function findGenericAdapterUploadTrigger(adapter, event, input) {
    return getFileHandoffDiscovery().findGenericAdapterUploadTrigger(adapter, event, input);
  }

  function activateAdapterUploadElementSafely(adapter, candidate) {
    return getFileHandoffDiscovery().activateAdapterUploadElementSafely(adapter, candidate);
  }

  function waitForGenericAdapterFileInput(adapter, timeoutMs = 2500, event = null, input = null) {
    return getFileHandoffDiscovery().waitForGenericAdapterFileInput(adapter, timeoutMs, event, input);
  }

  async function attachGenericPendingWithTrustedActivation(adapter, pending) {
    return getFileHandoffDiscovery().attachGenericPendingWithTrustedActivation(adapter, pending);
  }

  function isRejectedGeminiUploadMenuItem(candidate) {
    return getGeminiUploadDiscovery().isRejectedGeminiUploadMenuItem(candidate);
  }

  function scoreGeminiUploadMenuItem(candidate) {
    return getGeminiUploadDiscovery().scoreGeminiUploadMenuItem(candidate);
  }

  function discoverGeminiUploadOverlayItem(details) {
    return getGeminiUploadDiscovery().discoverGeminiUploadOverlayItem(details);
  }

  function countGeminiAttachmentIndicators() {
    if (!isGeminiHost()) return 0;
    const selectors = [
      "images-files-uploader",
      "file-preview",
      "attachment-chip",
      "mat-chip",
      "[data-test-id*='attachment' i]",
      "[data-test-id*='upload' i]",
      "[aria-label*='attachment' i]",
      "[aria-label*='uploaded' i]",
      "[aria-label*='uploading' i]",
      "[aria-label*='file attached' i]",
      "[role='progressbar']"
    ];
    const roots = [];
    collectRootsWithOpenShadow(document, roots, new WeakSet(), null);
    const seen = new WeakSet();
    let count = 0;
    for (const scanRoot of roots) {
      for (const selector of selectors) {
        try {
          scanRoot.querySelectorAll?.(selector).forEach((candidate) => {
            if (!candidate || seen.has(candidate)) return;
            seen.add(candidate);
            count += 1;
          });
        } catch {
          // Case-insensitive selectors may not parse in every runtime; keep validation best-effort.
        }
      }
    }
    return count;
  }

  async function waitForGeminiAttachmentIndicators(previousCount = 0, timeoutMs = 450) {
    let count = countGeminiAttachmentIndicators();
    if (count > previousCount) return count;
    if (typeof MutationObserver !== "function") return count;

    return await new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let timeoutId = 0;
      const finish = (force = false) => {
        if (settled) return;
        count = countGeminiAttachmentIndicators();
        if (count <= previousCount && !force) return;
        settled = true;
        if (observer) {
          try {
            observer.disconnect();
          } catch {
            // Best-effort cleanup only.
          }
        }
        if (timeoutId) clearTimeout(timeoutId);
        resolve(count);
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

  function getFileInputPreparation() {
    if (fileInputPreparation) return fileInputPreparation;
    if (typeof FileInputPreparation.createFileInputPreparation !== "function") {
      fileInputPreparation = Object.freeze({
        fileInputAcceptsHandoffFiles: () => false,
        prepareFileInputForSanitizedHandoff: () => () => {}
      });
      return fileInputPreparation;
    }

    fileInputPreparation = FileInputPreparation.createFileInputPreparation({
      isFileInputElement
    });
    return fileInputPreparation;
  }

  function fileInputAcceptsHandoffFiles(fileInput, files) {
    return getFileInputPreparation().fileInputAcceptsHandoffFiles(fileInput, files);
  }

  function scoreFileInputForHandoff(fileInput, source, files, options = {}) {
    return getFileHandoffDiscovery().scoreFileInputForHandoff(fileInput, source, files, options);
  }

  function getFileInputDiscoveryScope(target) {
    return getFileHandoffDiscovery().getFileInputDiscoveryScope(target);
  }

  function discoverFileInputForHandoff(event, input, options = {}) {
    return getFileHandoffDiscovery().discoverFileInputForHandoff(event, input, options);
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

  function resolveFileInputForHandoff(event, input, options = {}) {
    const expectedFiles = Array.from(options?.expectedFiles || []).filter(Boolean);
    const allowIncompatible = options?.allowIncompatible === true;
    if (fileDragDiscoveryCompleted) {
      if (
        isFileInputElement(lastDiscoveredFileInput) &&
        !lastDiscoveredFileInput.disabled &&
        (allowIncompatible || fileInputAcceptsHandoffFiles(lastDiscoveredFileInput, expectedFiles))
      ) {
        return lastDiscoveredFileInput;
      }
      if (!expectedFiles.length && !allowIncompatible) return null;
    }

    const fileInput = discoverFileInputForHandoff(event, input, { expectedFiles, allowIncompatible });
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

  function getWhatsAppSelectors() {
    if (whatsAppSelectors) return whatsAppSelectors;
    if (typeof WhatsAppSelectors.createWhatsAppSelectors !== "function") {
      whatsAppSelectors = Object.freeze({
        shouldUseWhatsAppDocumentInputForFiles: () => false,
        resolveWhatsAppDocumentDropInputForHandoff: async () => null
      });
      return whatsAppSelectors;
    }

    whatsAppSelectors = WhatsAppSelectors.createWhatsAppSelectors({
      documentRef: document,
      setTimeoutFn: setTimeout,
      clearTimeoutFn: clearTimeout,
      MutationObserverRef: typeof MutationObserver === "function" ? MutationObserver : null,
      isFileInputElement,
      fileInputAcceptsHandoffFiles,
      isSupportedWhatsAppAttachImageFile,
      isWhatsAppHandoffContext
    });
    return whatsAppSelectors;
  }

  function shouldUseWhatsAppDocumentInputForFiles(files) {
    return getWhatsAppSelectors().shouldUseWhatsAppDocumentInputForFiles(files);
  }

  async function resolveWhatsAppDocumentDropInputForHandoff(event, input, files) {
    return getWhatsAppSelectors().resolveWhatsAppDocumentDropInputForHandoff(event, input, files);
  }

  function prepareFileInputForSanitizedHandoff(fileInput, files) {
    return getFileInputPreparation().prepareFileInputForSanitizedHandoff(fileInput, files);
  }

  function getSanitizedFileHandoff() {
    if (sanitizedFileHandoff) return sanitizedFileHandoff;
    if (typeof SanitizedFileHandoff.createSanitizedFileHandoff !== "function") {
      sanitizedFileHandoff = Object.freeze({
        handOffSanitizedFileInput: () => false,
        handOffSanitizedFileBatch: async () => false
      });
      return sanitizedFileHandoff;
    }

    sanitizedFileHandoff = SanitizedFileHandoff.createSanitizedFileHandoff({
      documentRef: document,
      EventRef: Event,
      isFileInputElement,
      isFirefoxRuntime,
      canAssignFilesToInput,
      getCurrentHandoffDriverId,
      isProtectedFileDropDriver,
      markFirefoxFileInputTransactionReplaced,
      markSanitizedFileHandoff,
      markUntrackedSanitizedFileInputHandoff: (fileInput) => sanitizedFileInputHandoffs.add(fileInput),
      deleteSanitizedFileHandoffMark,
      assignSafeFileAttachErrorMetadata,
      describeFileForDebug,
      describeFileInputForDebug,
      debugFileAttachMetadata,
      debugReveal,
      createSanitizedDataTransfer,
      dispatchSanitizedFileEvent,
      prepareFileInputForSanitizedHandoff,
      resolveFileInputForHandoff,
      shouldUseWhatsAppDocumentInputForFiles,
      resolveWhatsAppDocumentDropInputForHandoff,
      verifyWhatsAppSanitizedMultiFileAttach,
      clearLocalFileInputSelection
    });
    return sanitizedFileHandoff;
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
    return getSanitizedFileHandoff().handOffSanitizedFileInput(fileInput, transfer, options);
  }

  async function handOffGeminiSanitizedFileInput(fileInput, transfer, details, sanitizedFile) {
    return getGeminiFileHandoff().handOffGeminiSanitizedFileInput(fileInput, transfer, details, sanitizedFile);
  }

  function isForbiddenGeminiUploadButton(candidate) {
    return getGeminiUploadDiscovery().isForbiddenGeminiUploadButton(candidate);
  }

  function isAllowedGeminiUploadMenuOpener(candidate) {
    return getGeminiUploadDiscovery().isAllowedGeminiUploadMenuOpener(candidate);
  }

  function clickElementSafely(candidate) {
    return getGeminiUploadDiscovery().clickElementSafely(candidate);
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
    return getGeminiFileHandoff().clearPendingGeminiGhostIngressClickInterceptor(reason);
  }

  function createGeminiGhostIngressClickInterceptor(sanitizedFile, details, onFinished) {
    return getGeminiFileHandoff().createGeminiGhostIngressClickInterceptor(sanitizedFile, details, onFinished);
  }

  async function waitForGeminiGhostIngressFileInput(event, input, details, sanitizedFile) {
    return getGeminiFileHandoff().waitForGeminiGhostIngressFileInput(event, input, details, sanitizedFile);
  }

  async function handOffGeminiSanitizedFileUpload(event, input, sanitizedFile, options) {
    return getGeminiFileHandoff().handOffGeminiSanitizedFileUpload(event, input, sanitizedFile, options);
  }

  function handOffGrokSanitizedFileUpload(event, input, sanitizedFile) {
    return getGrokFileHandoff().handOffGrokSanitizedFileUpload(event, input, sanitizedFile);
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

  function shouldUseContentFileExtractionPipeline(file) {
    if (
      !file ||
      typeof canExtractForAdapterHandoff !== "function" ||
      typeof processFileForAdapterHandoff !== "function"
    ) {
      return false;
    }
    if (isUnsupportedLegacyOfficeFile(file)) {
      return false;
    }
    if (typeof FileScanner.isSupportedTextFile === "function" && FileScanner.isSupportedTextFile(file.name, file.type)) {
      return false;
    }
    return canExtractForAdapterHandoff(file);
  }

  function isImageContentExtractionResult(result) {
    const kind = String(result?.extractedKind || "");
    const outputKind = String(result?.outputKind || "");
    const mimeType = String(result?.metadata?.original?.type || "").toLowerCase();
    return (
      result?.fileOnlyUpload === true ||
      outputKind === "redacted_image_file" ||
      kind === "image_metadata" ||
      kind === "image_ocr" ||
      mimeType.startsWith("image/")
    );
  }

  function getContentExtractionBlockedTitle(result) {
    return isImageContentExtractionResult(result) ? "Raw image upload blocked" : "Raw file blocked";
  }

  function getImageContentExtractionBlockedMessage(reason) {
    const code = String(reason || "image_redaction_failed");
    const messages = {
      protected_site_image_ocr_disabled:
        "LeakGuard blocked this image because local image OCR is not available for this protected site.",
      ocr_runtime_unavailable:
        "LeakGuard blocked this image because local OCR could not start.",
      protected_site_ocr_broker_unavailable:
        "LeakGuard blocked this image because the local OCR bridge could not start.",
      protected_site_ocr_broker_timeout:
        "LeakGuard blocked this image because local OCR timed out before a sanitized image was ready.",
      ocr_failed:
        "LeakGuard blocked this image because local OCR could not read it safely.",
      ocr_unsupported_image_type:
        "LeakGuard blocked this image because this image type is not supported for safe redaction.",
      ocr_image_too_large:
        "LeakGuard blocked this image because it is too large for local OCR.",
      ocr_image_dimensions_too_large:
        "LeakGuard blocked this image because its dimensions are too large for local OCR.",
      ocr_boxes_missing:
        "LeakGuard blocked this image because it could not verify safe visual redaction boxes.",
      protected_site_visual_redaction_not_eligible:
        "LeakGuard blocked this image because visual redaction could not be verified safely.",
      ocr_box_confidence_too_low:
        "LeakGuard blocked this image because OCR box confidence was too low for protected-site upload.",
      image_redactor_unavailable:
        "LeakGuard blocked this image because local image redaction is not available.",
      image_redaction_failed:
        "LeakGuard blocked this image because local redacted PNG creation failed.",
      redacted_image_file_invalid:
        "LeakGuard blocked this image because the redacted PNG output could not be verified.",
      image_redaction_file_unavailable:
        "LeakGuard blocked this image because no verified redacted PNG was produced.",
      file_read_failed:
        "LeakGuard blocked this image because the clipboard image could not be read locally.",
      file_extraction_failed:
        "LeakGuard blocked this image because local image extraction failed."
    };
    return messages[code] || `LeakGuard blocked this image because local OCR/redaction did not produce a verified sanitized PNG. Reason: ${code}.`;
  }

  function getContentExtractionBlockedMessage(reason, result) {
    const code = String(reason || "content_file_extraction_failed");
    if (isImageContentExtractionResult(result)) {
      return getImageContentExtractionBlockedMessage(code);
    }
    if (code === "pdf_no_extractable_text") {
      return "LeakGuard blocked the raw upload because this appears to be a scanned or image-only PDF. Local PDF OCR is not available yet, so LeakGuard could not create a safe redacted replacement.";
    }
    return `LeakGuard blocked raw file upload because local file extraction did not produce safe text. Reason: ${code}.`;
  }

  function localFileFromContentExtractionResult(result) {
    const fallbackReason = result?.fallbackReason || result?.status || "content_file_extraction_failed";
    if (!result || result.status !== "ready" || !result.safeForUpload || !result.sanitizedFile) {
      return {
        handled: true,
        ok: false,
        code: fallbackReason,
        title: getContentExtractionBlockedTitle(result),
        message: getContentExtractionBlockedMessage(fallbackReason, result)
      };
    }

    const imageRedactionMode = isImageContentExtractionResult(result);
    const sanitizedFile = result.sanitizedFile;
    return {
      handled: true,
      ok: true,
      text: imageRedactionMode ? "" : result.sanitizedText,
      file: {
        name: result.outputName,
        extension: FileScanner.getFileExtension?.(result.outputName) || ".txt",
        type: sanitizedFile?.type || (imageRedactionMode ? "image/png" : "text/plain"),
        sizeBytes: Number(sanitizedFile?.size || result.sanitizedText.length || 0)
      },
      fileOnlyUpload: imageRedactionMode || result.fileOnlyUpload === true,
      imageRedactionMode,
      skipTextFallback: imageRedactionMode || result.skipTextFallback === true,
      successStatus: imageRedactionMode ? "Sanitized image attached." : "",
      failureTitle: imageRedactionMode ? "Raw image upload blocked" : "",
      contentExtraction: result
    };
  }

  function isUnsupportedLegacyOfficeFile(file) {
    return /\.(?:doc|docm|xls|xlsm)$/i.test(String(file?.name || "").toLowerCase());
  }

  function isUnsupportedBinaryFileForProtectedUpload(file) {
    const extension = getLocalFileExtension(file);
    const mimeType = getLocalFileMimeType(file);
    return extension === ".bin" || (extension === "" && mimeType === "application/octet-stream");
  }

  function getLocalFileExtension(file) {
    if (typeof FileScanner.getFileExtension === "function") {
      return String(FileScanner.getFileExtension(file?.name || "") || "").toLowerCase();
    }
    const name = String(file?.name || "").split(/[\\/]/).pop().toLowerCase();
    const index = name.lastIndexOf(".");
    if (index <= 0 || index === name.length - 1) return "";
    return name.slice(index);
  }

  function getLocalFileMimeType(file) {
    return String(file?.type || "").split(";")[0].trim().toLowerCase();
  }

  function isUnsupportedImageFileForProtectedUpload(file) {
    const extension = getLocalFileExtension(file);
    const mimeType = getLocalFileMimeType(file);
    if (UNSUPPORTED_PROTECTED_IMAGE_EXTENSIONS.has(extension)) {
      return true;
    }
    if (!mimeType.startsWith("image/")) {
      return false;
    }
    return (
      !SUPPORTED_IMAGE_REDACTION_EXTENSIONS.has(extension) ||
      !SUPPORTED_IMAGE_REDACTION_MIME_TYPES.has(mimeType)
    );
  }

  function isUnsupportedProtectedImageTransfer(policy) {
    const files = Array.from(policy?.files || []);
    return files.length === 1 && isUnsupportedImageFileForProtectedUpload(files[0]);
  }

  function shouldFailClosedProtectedUnsupportedFileTransfer(policy) {
    if (policy?.action !== "allow" || !isProtectedFileDropDriver(getCurrentHandoffDriverId())) {
      return false;
    }

    const files = Array.from(policy.files || []);
    return (
      files.length === 1 &&
      (isUnsupportedLegacyOfficeFile(files[0]) ||
        isUnsupportedImageFileForProtectedUpload(files[0]) ||
        isUnsupportedBinaryFileForProtectedUpload(files[0]))
    );
  }

  function createSingleFileDataTransfer(file) {
    return {
      files: file ? [file] : [],
      types: file ? ["Files"] : [],
      items: []
    };
  }

  function getLocalFileSafeMetadata(file) {
    const extension = getLocalFileExtension(file);
    const mimeType = getLocalFileMimeType(file);
    return {
      extension,
      mimeCategory: mimeType ? mimeType.split("/")[0].replace(/[^a-z0-9.+-]/gi, "").slice(0, 32) : "",
      sizeBytes: Math.max(0, Number(file?.size || 0) || 0)
    };
  }

  function getSanitizedFileBatchProcessor() {
    if (sanitizedFileBatchProcessor) return sanitizedFileBatchProcessor;
    if (typeof SanitizedFileBatchProcessor.createSanitizedFileBatchProcessor !== "function") {
      sanitizedFileBatchProcessor = Object.freeze({
        summarizeMultiFileItem: () => ({}),
        createBlockedBeforeProcessingItems: () => [],
        createMultiFileStatusSummary: () => ({ files: [] }),
        formatMultiFileStatusMessage: () =>
          "LeakGuard blocked or sanitized this protected upload batch. No raw files were uploaded.",
        processLocalFileForSanitizedBatch: async () => ({
          ok: false,
          status: "failed",
          code: "file_processing_exception"
        }),
        processLocalFilesForSanitizedBatch: async () => []
      });
      return sanitizedFileBatchProcessor;
    }

    sanitizedFileBatchProcessor = SanitizedFileBatchProcessor.createSanitizedFileBatchProcessor({
      fileAttachPipeline: globalThis.PWM.FileAttachPipeline,
      shouldUseContentFileExtractionPipeline,
      processFileForAdapterHandoff,
      localFileFromContentExtractionResult,
      readLocalTextFileFromDataTransfer,
      createSingleFileDataTransfer,
      streamRedactLocalTextFile,
      classifyLocalTextPayloadSize,
      analyzeText,
      requestRedaction,
      createSanitizedTextFile,
      getLocalFileSafeMetadata,
      debugFileAttachMetadata
    });
    return sanitizedFileBatchProcessor;
  }

  function summarizeMultiFileItem(index, status, file, code = "") {
    return getSanitizedFileBatchProcessor().summarizeMultiFileItem(index, status, file, code);
  }

  function getFileHandoffVerification() {
    if (fileHandoffVerification) return fileHandoffVerification;
    if (typeof FileHandoffVerification.createFileHandoffVerification !== "function") {
      fileHandoffVerification = Object.freeze({
        isExpectedWhatsAppSanitizedMultiFileAttachFile: () => false,
        verifyWhatsAppSanitizedMultiFileAttach: () => ({
          ok: false,
          reason: "verification_unavailable",
          assignedCount: 0,
          expectedCount: 0
        })
      });
      return fileHandoffVerification;
    }

    fileHandoffVerification = FileHandoffVerification.createFileHandoffVerification({
      getLocalFileExtension,
      getLocalFileMimeType,
      isSupportedWhatsAppTextDocumentAttachFile
    });
    return fileHandoffVerification;
  }

  function isExpectedWhatsAppSanitizedMultiFileAttachFile(file) {
    return getFileHandoffVerification().isExpectedWhatsAppSanitizedMultiFileAttachFile(file);
  }

  function verifyWhatsAppSanitizedMultiFileAttach(fileInput, sanitizedFiles, originalFiles = []) {
    return getFileHandoffVerification().verifyWhatsAppSanitizedMultiFileAttach(
      fileInput,
      sanitizedFiles,
      originalFiles
    );
  }

  async function processLocalFileForSanitizedBatch(file, index, context) {
    return getSanitizedFileBatchProcessor().processLocalFileForSanitizedBatch(file, index, context);
  }

  async function handOffSanitizedFileBatch(event, input, sanitizedFiles, context, options = {}) {
    return getSanitizedFileHandoff().handOffSanitizedFileBatch(event, input, sanitizedFiles, context, options);
  }

  function getMultiFileInsertOrchestration() {
    if (multiFileInsertOrchestration) return multiFileInsertOrchestration;
    if (typeof MultiFileInsertOrchestration.createMultiFileInsertOrchestration !== "function") {
      multiFileInsertOrchestration = Object.freeze({
        maybeHandleMultiFileInsert: async () => null
      });
      return multiFileInsertOrchestration;
    }

    multiFileInsertOrchestration = MultiFileInsertOrchestration.createMultiFileInsertOrchestration({
      fileAttachPipeline: globalThis.PWM.FileAttachPipeline,
      batchProcessor: getSanitizedFileBatchProcessor(),
      maxSmallFiles: MAX_MULTI_FILE_SMALL_ATTACHMENTS,
      maxLargeFiles: MAX_MULTI_FILE_LARGE_ATTACHMENTS,
      smallMaxBytes: MULTI_FILE_SMALL_MAX_BYTES,
      supportedMaxBytes: MULTI_FILE_SUPPORTED_MAX_BYTES,
      whatsAppFileAttachUnsupportedReason: WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON,
      whatsAppFileAttachBlockTitle: WHATSAPP_FILE_ATTACH_BLOCK_TITLE,
      clearLocalFileInputSelection,
      consumeInterceptionEvent,
      createSanitizedFileHandoffDetails,
      debugFileAttachMetadata,
      getFileHandoffAdapterForLocation,
      getPendingSanitizedAttachPromptMessage,
      handOffSanitizedFileBatch,
      hideBadgeSoon,
      isFileHandoffAdapterPendingAttachEnabled,
      isPotentialWhatsAppMultiFileAttach,
      isSupportedWhatsAppMultiFileAttach,
      queuePendingSanitizedFileHandoff,
      refreshBadgeFromCurrentInput,
      setBadge,
      showFileProcessingOverlay,
      showMessageModal,
      updateFileProcessingOverlay
    });
    return multiFileInsertOrchestration;
  }

  async function maybeHandleMultiFileInsert(event, input, files, context, processingSite, controls) {
    return getMultiFileInsertOrchestration().maybeHandleMultiFileInsert(
      event,
      input,
      files,
      context,
      processingSite,
      controls
    );
  }

  function getStreamingFileInsertOrchestration() {
    if (streamingFileInsertOrchestration) return streamingFileInsertOrchestration;
    if (typeof StreamingFileInsertOrchestration.createStreamingFileInsertOrchestration !== "function") {
      streamingFileInsertOrchestration = Object.freeze({
        maybeHandleStreamingRequiredLocalFile: async () => null
      });
      return streamingFileInsertOrchestration;
    }

    streamingFileInsertOrchestration =
      StreamingFileInsertOrchestration.createStreamingFileInsertOrchestration({
        fileAttachPipeline: globalThis.PWM.FileAttachPipeline,
        streamingBlockTitle: STREAMING_BLOCK_TITLE,
        streamingBlockMessage: STREAMING_BLOCK_MESSAGE,
        blockStreamingLocalFile,
        createSanitizedFileHandoffDetails,
        getCurrentHandoffDriver,
        getFileHandoffAdapterById,
        getFileHandoffAdapterForLocation,
        getPendingSanitizedAttachPromptMessage,
        handOffSanitizedLocalFile,
        hideBadgeSoon,
        isFileHandoffAdapterPendingAttachEnabled,
        isFirefoxRuntime,
        isGeminiHost,
        isGrokHost,
        queuePendingSanitizedFileHandoff,
        refreshBadgeFromCurrentInput,
        setBadge,
        setDmzOverlayState,
        showFileProcessingError,
        streamRedactLocalTextFile,
        updateFileProcessingOverlay
      });
    return streamingFileInsertOrchestration;
  }

  function getLocalFileReadOrchestration() {
    if (localFileReadOrchestration) return localFileReadOrchestration;
    if (typeof LocalFileReadOrchestration.createLocalFileReadOrchestration !== "function") {
      localFileReadOrchestration = Object.freeze({
        readLocalFileForInsert: async () => ({ done: true, value: false })
      });
      return localFileReadOrchestration;
    }

    localFileReadOrchestration =
      LocalFileReadOrchestration.createLocalFileReadOrchestration({
        clearLocalFileInputSelection,
        debugReveal,
        describeFileForDebug,
        getFileUnavailableAfterHandoffSuppression,
        getFirefoxRawFileUploadBlockedMessage,
        hideBadgeSoon,
        localFileFromContentExtractionResult,
        logFileInterception,
        maybeHandleStreamingRequiredLocalFile: (...args) =>
          getStreamingFileInsertOrchestration().maybeHandleStreamingRequiredLocalFile(...args),
        processFileForAdapterHandoff,
        readLocalTextFileFromDataTransfer,
        refreshBadgeFromCurrentInput,
        setBadge,
        showFileProcessingOverlay,
        showMessageModal,
        streamingBlockTitle: STREAMING_BLOCK_TITLE,
        streamingBlockMessage: STREAMING_BLOCK_MESSAGE,
        suppressFileUnavailableAfterHandoff
      });
    return localFileReadOrchestration;
  }

  function getLocalFileAttachPreflightOrchestration() {
    if (localFileAttachPreflightOrchestration) return localFileAttachPreflightOrchestration;
    if (typeof LocalFileAttachPreflightOrchestration.createLocalFileAttachPreflightOrchestration !== "function") {
      localFileAttachPreflightOrchestration = Object.freeze({
        prepareLocalFileAttachPreflight: async () => ({ done: true, value: false })
      });
      return localFileAttachPreflightOrchestration;
    }

    localFileAttachPreflightOrchestration =
      LocalFileAttachPreflightOrchestration.createLocalFileAttachPreflightOrchestration({
        blockLargeLocalTextPayload,
        classifyLocalTextPayloadSize,
        fileAttachPipeline: globalThis.PWM.FileAttachPipeline,
        getCurrentHandoffDriver,
        isFirefoxRuntime,
        isGeminiHost,
        localTextHardBlockTitle: LOCAL_TEXT_HARD_BLOCK_TITLE,
        showLocalPayloadOptimizationStatus
      });
    return localFileAttachPreflightOrchestration;
  }

  function getLocalFileSanitizationOrchestration() {
    if (localFileSanitizationOrchestration) return localFileSanitizationOrchestration;
    if (typeof LocalFileSanitizationOrchestration.createLocalFileSanitizationOrchestration !== "function") {
      localFileSanitizationOrchestration = Object.freeze({
        sanitizeLocalFileForAttach: async () => ({ ok: false, handled: true, reason: "unavailable" })
      });
      return localFileSanitizationOrchestration;
    }

    localFileSanitizationOrchestration =
      LocalFileSanitizationOrchestration.createLocalFileSanitizationOrchestration({
        analyzeText,
        clearLocalPayloadOptimizationStatus,
        createSanitizedTextFile,
        debugFileAttachMetadata,
        getCurrentHandoffDriver,
        getFirefoxRawFileUploadBlockedMessage,
        hideBadgeSoon,
        refreshBadgeFromCurrentInput,
        requestRedaction,
        scheduleDmzOverlayCleanup,
        setBadge,
        setDmzOverlayState,
        showMessageModal,
        updateFileProcessingOverlay
      });
    return localFileSanitizationOrchestration;
  }

  function getSanitizedFileInsertOrchestration() {
    if (sanitizedFileInsertOrchestration) return sanitizedFileInsertOrchestration;
    if (typeof SanitizedFileInsertOrchestration.createSanitizedFileInsertOrchestration !== "function") {
      sanitizedFileInsertOrchestration = Object.freeze({
        handleSanitizedLocalFileAttach: async () => ({ handled: true, ok: false, reason: "unavailable" })
      });
      return sanitizedFileInsertOrchestration;
    }

    sanitizedFileInsertOrchestration =
      SanitizedFileInsertOrchestration.createSanitizedFileInsertOrchestration({
        fileAttachPipeline: globalThis.PWM.FileAttachPipeline,
        clearLocalPayloadOptimizationStatus,
        createSanitizedFileHandoffDetails,
        debugReveal,
        describeFileForDebug,
        findComposer,
        getCurrentHandoffDriver,
        getFileHandoffAdapterForLocation,
        handOffSanitizedLocalFile,
        hideBadgeSoon,
        hideDmzOverlay,
        isFileHandoffAdapterPendingAttachEnabled,
        isWhatsAppHost,
        markWhatsAppSanitizedImageHandoff,
        queuePendingSanitizedFileHandoff,
        refreshBadgeFromCurrentInput,
        scheduleDmzOverlayCleanup,
        setBadge,
        setDmzOverlayState,
        showMessageModal,
        updateFileProcessingOverlay
      });
    return sanitizedFileInsertOrchestration;
  }

  async function maybeHandleLocalFileInsert(event, input, dataTransfer, context) {
    const alreadyConsumedSupportedWhatsAppClipboardImagePaste =
      event?.defaultPrevented === true &&
      context === "paste" &&
      isSupportedWhatsAppClipboardImagePaste(dataTransfer, context);
    if (
      !extensionRuntimeAvailable ||
      modalOpen ||
      (event.defaultPrevented &&
        context !== "drop" &&
        !(
          context === "file-input" &&
          (isGeminiHost() || (isFirefoxRuntime() && isProtectedFileDropDriver(getCurrentHandoffDriverId())))
        ) &&
        !alreadyConsumedSupportedWhatsAppClipboardImagePaste) ||
      typeof readLocalTextFileFromDataTransfer !== "function" ||
      typeof createSanitizedTextFile !== "function" ||
      !dataTransferHasFiles(dataTransfer)
    ) {
      return false;
    }

    const localTransferFiles = listLocalTransferFiles(dataTransfer);
    const processingSite = getCurrentHandoffDriverId();
    const { failProcessing, hideProcessing, showProcessingSuccess } =
      globalThis.PWM.FileAttachPipeline.createProcessingStageControls({
        site: processingSite,
        showFileProcessingError,
        hideFileProcessingOverlay,
        showFileProcessingSuccess
      });
    const supportedWhatsAppImageAttach = isSupportedWhatsAppImageAttach(dataTransfer, context);
    const supportedWhatsAppTextDocumentAttach = isSupportedWhatsAppTextDocumentAttach(dataTransfer, context);
    const supportedWhatsAppPdfAttach = isSupportedWhatsAppPdfAttach(dataTransfer, context);
    const supportedWhatsAppDocxAttach = isSupportedWhatsAppDocxAttach(dataTransfer, context);
    const supportedWhatsAppXlsxAttach = isSupportedWhatsAppXlsxAttach(dataTransfer, context);
    const potentialWhatsAppMultiFileAttach = isPotentialWhatsAppMultiFileAttach(localTransferFiles, context);
    if (
      isWhatsAppHost() &&
      localTransferFiles.length &&
      !isSupportedWhatsAppClipboardImagePaste(dataTransfer, context) &&
      !potentialWhatsAppMultiFileAttach &&
      !supportedWhatsAppImageAttach &&
      !supportedWhatsAppTextDocumentAttach &&
      !supportedWhatsAppPdfAttach &&
      !supportedWhatsAppDocxAttach &&
      !supportedWhatsAppXlsxAttach
    ) {
      failProcessing(WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON, WHATSAPP_FILE_ATTACH_BLOCK_TITLE);
      return blockWhatsAppFileAttachment(event);
    }
    const multiFileResult = await maybeHandleMultiFileInsert(
      event,
      input,
      localTransferFiles,
      context,
      processingSite,
      { failProcessing, hideProcessing, showProcessingSuccess }
    );
    if (multiFileResult) return multiFileResult;

    const contentExtractionFile =
      localTransferFiles.length === 1 && shouldUseContentFileExtractionPipeline(localTransferFiles[0])
        ? localTransferFiles[0]
        : null;
    const transferPolicy = resolveLocalFileTransferPolicy(dataTransfer);
    const transferPolicyResult = await getLocalFileTransferPolicyGate().maybeHandleLocalFileTransferPolicy(
      event,
      transferPolicy,
      { contentExtractionFile }
    );
    if (transferPolicyResult !== null) return transferPolicyResult;

    if (!(event.defaultPrevented && context === "file-input" && isGeminiHost())) {
      consumeInterceptionEvent(event);
    }
    if (
      (supportedWhatsAppImageAttach ||
        supportedWhatsAppTextDocumentAttach ||
        supportedWhatsAppPdfAttach ||
        supportedWhatsAppDocxAttach ||
        supportedWhatsAppXlsxAttach) &&
      event?.target?.tagName === "INPUT" &&
      String(event.target.type || "").toLowerCase() === "file"
    ) {
      clearLocalFileInputSelection(event.target);
    }

    if (context === "file-input") {
      logFileInterception("file input intercepted", {
        files: listLocalTransferFiles(dataTransfer).map(describeFileForDebug),
        browser: isFirefoxRuntime() ? "firefox" : "other"
      });
    }

    try {
      const localFileRead = await getLocalFileReadOrchestration().readLocalFileForInsert({
        event,
        input,
        dataTransfer,
        contentExtractionFile,
        context,
        processingSite,
        controls: { failProcessing, hideProcessing, showProcessingSuccess }
      });
      if (localFileRead.done) return localFileRead.value;
      const { localFile, contentExtractionResult } = localFileRead;

      const attachPreflight = await getLocalFileAttachPreflightOrchestration().prepareLocalFileAttachPreflight({
        event,
        localFile,
        context,
        attachModes: {
          textDocument: supportedWhatsAppTextDocumentAttach,
          pdf: supportedWhatsAppPdfAttach,
          docx: supportedWhatsAppDocxAttach,
          xlsx: supportedWhatsAppXlsxAttach
        },
        controls: { failProcessing }
      });
      if (attachPreflight.done) return attachPreflight.value;
      const {
        imageRedactionMode,
        sizeInfo,
        shouldSkipTextFallback,
        preflightPlan,
        optimizedStatus
      } = attachPreflight;

      const sanitization = await getLocalFileSanitizationOrchestration().sanitizeLocalFileForAttach({
        localFile,
        contentExtractionResult,
        context,
        processingSite,
        sizeInfo,
        preflightPlan,
        optimizedStatus,
        imageRedactionMode,
        controls: { failProcessing }
      });
      if (!sanitization.ok) return sanitization;
      const { analysis, result, sanitizedFile } = sanitization;

      return getSanitizedFileInsertOrchestration().handleSanitizedLocalFileAttach({
        event,
        input,
        localFile,
        analysis,
        result,
        sanitizedFile,
        context,
        processingSite,
        sizeInfo,
        preflightPlan,
        optimizedStatus,
        imageRedactionMode,
        shouldSkipTextFallback,
        attachModes: {
          textDocument: supportedWhatsAppTextDocumentAttach,
          pdf: supportedWhatsAppPdfAttach,
          docx: supportedWhatsAppDocxAttach,
          xlsx: supportedWhatsAppXlsxAttach
        },
        controls: { failProcessing, hideProcessing, showProcessingSuccess }
      });
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

    const localTransferFiles = listLocalTransferFiles(snapshotDataTransfer);
    const supportedWhatsAppDrop =
      isSupportedWhatsAppImageAttach(snapshotDataTransfer, "drop") ||
      isSupportedWhatsAppTextDocumentAttach(snapshotDataTransfer, "drop") ||
      isSupportedWhatsAppPdfAttach(snapshotDataTransfer, "drop") ||
      isSupportedWhatsAppDocxAttach(snapshotDataTransfer, "drop") ||
      isSupportedWhatsAppXlsxAttach(snapshotDataTransfer, "drop") ||
      isPotentialWhatsAppMultiFileAttach(localTransferFiles, "drop");
    if (isWhatsAppHost() && localTransferFiles.length && !supportedWhatsAppDrop) {
      rawFileDropInterceptions.add(event);
      await blockWhatsAppFileAttachment(event);
      clearFileDragSession();
      return;
    }
    const contentExtractionFile =
      localTransferFiles.length === 1 && shouldUseContentFileExtractionPipeline(localTransferFiles[0])
        ? localTransferFiles[0]
        : null;
    const transferPolicy = resolveLocalFileTransferPolicy(snapshotDataTransfer);
    if (transferPolicy.action === "allow" && !contentExtractionFile) {
      const unsupportedFileMustBlock =
        shouldBlockUnsupportedFileTransfer(transferPolicy) ||
        shouldFailClosedProtectedUnsupportedFileTransfer(transferPolicy);
      if (unsupportedFileMustBlock) {
        const unsupportedBlockReason = shouldBlockUnsupportedFileTransfer(transferPolicy)
          ? "firefox_unsupported_file_blocked"
          : "unsupported_protected_file_blocked";
        const unsupportedBlockTitle = getUnsupportedFileBlockedTitle(transferPolicy);
        rawFileDropInterceptions.add(event);
        consumeInterceptionEvent(event);
        showFileProcessingError(unsupportedBlockTitle, {
          site: getCurrentHandoffDriverId(),
          reason: unsupportedBlockReason
        });
        hideFileProcessingOverlay(unsupportedBlockReason);
        setBadge(unsupportedBlockTitle);
        hideBadgeSoon(4200);
        await showMessageModal(unsupportedBlockTitle, getUnsupportedFileBlockedMessage(transferPolicy));
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

  function getFileDropInterception() {
    if (fileDropInterception) return fileDropInterception;
    if (typeof FileDropInterception.createFileDropInterception !== "function") {
      fileDropInterception = Object.freeze({
        maybeHandleFileDrag: () => undefined
      });
      return fileDropInterception;
    }
    fileDropInterception = FileDropInterception.createFileDropInterception({
      dataTransferLooksLikeFiles,
      handleFileDragDetected
    });
    return fileDropInterception;
  }

  function maybeHandleFileDrag(event) {
    return getFileDropInterception().maybeHandleFileDrag(event, {
      extensionRuntimeAvailable,
      modalOpen
    });
  }

  function getFileInputInterception() {
    if (fileInputInterception) return fileInputInterception;
    if (typeof FileInputInterception.createFileInputInterception !== "function") {
      fileInputInterception = Object.freeze({
        shouldHandleFileInputChange: () => false,
        createSelectedTransfer: (files) => ({ files: Array.from(files || []), types: ["Files"], items: [] }),
        hasSelectedFiles: () => false,
        shouldContinueWithoutComposer: () => false
      });
      return fileInputInterception;
    }
    fileInputInterception = FileInputInterception.createFileInputInterception({
      dataTransferHasFiles
    });
    return fileInputInterception;
  }

  async function maybeHandleFileInputChange(event) {
    const inputInterception = getFileInputInterception();
    if (!inputInterception.shouldHandleFileInputChange(event, { extensionRuntimeAvailable, modalOpen })) {
      return;
    }

    const selectedFiles = Array.from(event.target.files || []);
    const processingSignature = fileInputProcessingSignatures.get(event.target) || "";
    if (isWhatsAppHost() && processingSignature && selectedFiles.length === 0) {
      consumeInterceptionEvent(event);
      debugReveal("file-input:whatsapp-empty-processing-event-suppressed", {
        eventType: event.type || "",
        input: describeFileInputForDebug(event.target, "whatsapp-processing"),
        reason: "empty_event_during_image_attach_processing"
      });
      return {
        handled: true,
        ok: true,
        strategy: "whatsapp-empty-processing-event-suppressed"
      };
    }
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

    if (!inputInterception.hasSelectedFiles(event.target.files)) {
      return;
    }

    const selectedSignature = getFileListMetadataSignature(selectedFiles);
    if (selectedSignature && processingSignature === selectedSignature) {
      consumeInterceptionEvent(event);
      debugReveal("file-input:duplicate-raw-event-suppressed", {
        eventType: event.type || "",
        input: describeFileInputForDebug(event.target, "processing"),
        fileCount: selectedFiles.length
      });
      return {
        handled: true,
        ok: true,
        strategy: "duplicate-file-input-event-suppressed"
      };
    }

    let transaction = null;
    if (isFirefoxProtectedInput) {
      transaction = setFirefoxFileInputTransaction(event.target, {
        state: "processing",
        rawSignature: selectedSignature,
        startedAt: Date.now(),
        suppressUntil: Date.now() + PROGRAMMATIC_INPUT_SUPPRESS_MS,
        replacementDispatched: false
      });
      consumeInterceptionEvent(event);
      clearLocalFileInputSelection(event.target);
    }

    const input = findComposer(event.target);
    const selectedTransfer = inputInterception.createSelectedTransfer(selectedFiles);
    const hasContentExtractionFile =
      selectedFiles.length === 1 && shouldUseContentFileExtractionPipeline(selectedFiles[0]);
    const hasSupportedWhatsAppAttach =
      isSupportedWhatsAppImageAttach(selectedTransfer, "file-input") ||
      isSupportedWhatsAppTextDocumentAttach(selectedTransfer, "file-input") ||
      isSupportedWhatsAppPdfAttach(selectedTransfer, "file-input") ||
      isSupportedWhatsAppDocxAttach(selectedTransfer, "file-input") ||
      isSupportedWhatsAppXlsxAttach(selectedTransfer, "file-input") ||
      isPotentialWhatsAppMultiFileAttach(selectedFiles, "file-input");
    const selectedTransferPolicy = resolveLocalFileTransferPolicy(selectedTransfer);
    const hasFailClosedProtectedUnsupportedFile =
      shouldFailClosedProtectedUnsupportedFileTransfer(selectedTransferPolicy);
    const hasWhatsAppFileInputSelection = isWhatsAppHost() && selectedFiles.length > 0;
    if (
      !inputInterception.shouldContinueWithoutComposer({
        input,
        isGeminiHost: isGeminiHost(),
        hasContentExtractionFile,
        hasFailClosedProtectedUnsupportedFile,
        hasSupportedWhatsAppAttach,
        hasWhatsAppFileInputSelection,
        isFirefoxRuntime: isFirefoxRuntime(),
        isProtectedFileDropDriver: isProtectedFileDropDriver(getCurrentHandoffDriverId()),
        currentHandoffDriverId: getCurrentHandoffDriverId()
      })
    ) {
      return;
    }

    fileInputProcessingSignatures.set(event.target, selectedSignature);
    let result;
    try {
      result = await maybeHandleLocalFileInsert(
        event,
        input,
        selectedTransfer,
        "file-input"
      );
    } finally {
      if (fileInputProcessingSignatures.get(event.target) === selectedSignature) {
        fileInputProcessingSignatures.delete(event.target);
      }
    }
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
    return result;
  }

  function shouldOwnWhatsAppTextSend(text) {
    return Boolean(isWhatsAppHost() && String(text || "").trim());
  }

  function markWhatsAppSanitizedImageHandoff(input) {
    if (!isWhatsAppHost()) return;
    const expiresAt = Date.now() + WHATSAPP_SANITIZED_IMAGE_SEND_BYPASS_MS;
    whatsAppSanitizedImageHandoffUntil = expiresAt;
    if (input && typeof input === "object") {
      whatsAppSanitizedImageHandoffInputs.set(input, expiresAt);
    }
  }

  function hasRecentWhatsAppSanitizedImageHandoff(input) {
    if (!isWhatsAppHost()) return false;
    const now = Date.now();
    if (input && (whatsAppSanitizedImageHandoffInputs.get(input) || 0) > now) return true;
    return whatsAppSanitizedImageHandoffUntil > now;
  }

  function consumeRecentWhatsAppSanitizedImageHandoff(input) {
    whatsAppSanitizedImageHandoffUntil = 0;
    if (input && typeof input === "object") {
      whatsAppSanitizedImageHandoffInputs.delete(input);
    }
  }

  function isWhatsAppSanitizedImageSendTextSafe(text) {
    const value = String(text || "");
    if (!value.trim()) return true;
    if (hasUnsafeVisibleSecret(value)) return false;
    const analysis = analyzeText(value);
    return (analysis.findings || []).every((finding) =>
      isKnownSanitizedPlaceholderToken(finding?.raw) || containsVisiblePlaceholderToken(finding?.raw)
    );
  }

  function shouldBypassWhatsAppSanitizedImageSend(input, text) {
    return (
      hasRecentWhatsAppSanitizedImageHandoff(input) &&
      isWhatsAppSanitizedImageSendTextSafe(text)
    );
  }

  function clearWhatsAppTextSendPending(input) {
    if (!input || !whatsAppPendingTextSendInputs.has(input)) return;
    whatsAppPendingTextSendInputs.delete(input);
    const timer = whatsAppPendingTextSendTimers.get(input);
    if (timer) {
      clearTimeout(timer);
      whatsAppPendingTextSendTimers.delete(input);
    }
  }

  function markWhatsAppTextSendPending(input) {
    if (!isWhatsAppHost() || !input) return true;
    if (whatsAppPendingTextSendInputs.has(input)) return false;
    whatsAppPendingTextSendInputs.add(input);
    const timer = setTimeout(() => {
      whatsAppPendingTextSendInputs.delete(input);
      whatsAppPendingTextSendTimers.delete(input);
    }, WHATSAPP_TEXT_SEND_GUARD_MS);
    whatsAppPendingTextSendTimers.set(input, timer);
    return true;
  }

  function createWhatsAppVerifiedSendOptions(input, ownsTextSend) {
    return ownsTextSend
      ? {
          onSettled: () => clearWhatsAppTextSendPending(input)
        }
      : {};
  }

  function getWhatsAppTextSendBlockMessage(reason) {
    switch (reason) {
      case "composer_not_found":
        return "the active message composer could not be found";
      case "text_extraction_failed":
        return "the message text could not be read safely";
      case "replay_button_not_found":
        return "the send button could not be replayed safely";
      default:
        return "the text send could not be verified safely";
    }
  }

  async function blockWhatsAppTextSend(reason) {
    setBadge(WHATSAPP_TEXT_SEND_BLOCK_TITLE);
    hideBadgeSoon(3200);
    await showMessageModal(
      WHATSAPP_TEXT_SEND_BLOCK_TITLE,
      `LeakGuard blocked this WhatsApp Web send because ${getWhatsAppTextSendBlockMessage(reason)}. Nothing was submitted.`
    );
    refreshBadgeFromCurrentInput();
  }

  async function maybeHandleSubmit(event) {
    if (!extensionRuntimeAvailable) {
      return;
    }

    if (isWhatsAppHost() && whatsAppBypassSanitizedImageSubmitUntil > Date.now()) {
      return;
    }
    if (whatsAppBypassSanitizedImageSubmitUntil && whatsAppBypassSanitizedImageSubmitUntil <= Date.now()) {
      whatsAppBypassSanitizedImageSubmitUntil = 0;
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

    if (!input) {
      if (isWhatsAppHost()) {
        consumeInterceptionEvent(event);
        await blockWhatsAppTextSend("composer_not_found");
      }
      return;
    }
    noteActiveRiskEditor(input);
    const nativeSubmitEvent = event.type === "submit" && !event.leakGuardSendButton;
    const submitter = event.leakGuardSendButton || event.submitter || (nativeSubmitEvent ? findSendButton(input) : null);
    const replayOptions = {
      preferButtonClick: Boolean(event.leakGuardReplayViaClick || event.submitter || nativeSubmitEvent)
    };

    const extractedText = getInputText(input);
    if (extractedText == null) {
      if (isWhatsAppHost()) {
        consumeInterceptionEvent(event);
        await blockWhatsAppTextSend("text_extraction_failed");
      }
      return;
    }

    const text = String(extractedText);
    if (!text.trim()) {
      return;
    }
    if (shouldBypassWhatsAppSanitizedImageSend(input, text)) {
      consumeRecentWhatsAppSanitizedImageHandoff(input);
      whatsAppBypassSanitizedImageSubmitUntil = Date.now() + 1000;
      debugReveal("whatsapp:image-send-text-verification-bypassed", {
        reason: "recent_sanitized_image_handoff",
        text: summarizeDebugText(text)
      });
      return;
    }

    const quickAnalysis = analyzeText(text);
    const whatsappOwnsTextSend = shouldOwnWhatsAppTextSend(text);
    if (!analysisNeedsEventOwnership(quickAnalysis) && !whatsappOwnsTextSend) return;

    consumeInterceptionEvent(event);
    if (whatsappOwnsTextSend && !markWhatsAppTextSendPending(input)) return;
    const verifiedSendOptions = createWhatsAppVerifiedSendOptions(input, whatsappOwnsTextSend);

    const analysis = await analyzeTextWithAiAssist(text);
    if (!analysis.findings.length && !analysis.placeholderNormalized && !whatsappOwnsTextSend) return;

    if (analysisHasOnlySanitizedPlaceholderFindings(analysis)) {
      const normalized = await applyNormalizedComposerRewrite(input, text, "submit");
      if (!normalized.ok) {
        clearWhatsAppTextSendPending(input);
        return;
      }

      queueVerifiedComposerSend(input, normalized.text, "submit", () => {
        replayVerifiedSend(input, form, submitter, replayOptions);
      }, verifiedSendOptions);
      return;
    }

    const policy = analysis.findings.length ? await getPolicyForAction() : getActivePolicy();
    const destinationPolicy = analysis.findings.length
      ? await handleDestinationPolicy(analysis.findings, policy)
      : getDestinationPolicyDecision(policy);
    if (analysis.findings.length && destinationPolicy.blocked) {
      clearWhatsAppTextSendPending(input);
      return;
    }
    const destinationForceRedact = shouldForceDestinationRedaction(destinationPolicy, analysis.findings);

    const httpPolicyHandled = await handleHttpSecretPolicy(policy, analysis.secretFindings, async () => {
      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      const rewritten = await applySubmitRedactionTransactionally(
        input,
        analysis.normalizedText,
        result.redactedText,
        "submit",
        analysis.secretFindings
      );
      if (!rewritten) {
        clearWhatsAppTextSendPending(input);
        return;
      }

      setBadge("Content redacted");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();

      queueVerifiedComposerSend(input, result.redactedText, "submit", () => {
        replayVerifiedSend(input, form, submitter, replayOptions);
      }, verifiedSendOptions);
    });

    if (httpPolicyHandled) {
      return;
    }

    if (destinationForceRedact) {
      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings, {
        auditReason: destinationPolicy.reason
      });
      const rewritten = await applySubmitRedactionTransactionally(
        input,
        analysis.normalizedText,
        result.redactedText,
        "submit",
        analysis.secretFindings
      );
      if (!rewritten) {
        clearWhatsAppTextSendPending(input);
        return;
      }

      setBadge("Destination policy required redaction");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();

      queueVerifiedComposerSend(input, result.redactedText, "submit", () => {
        replayVerifiedSend(input, form, submitter, replayOptions);
      }, verifiedSendOptions);
      return;
    }

    if (
      analysis.findings.length &&
      !whatsappOwnsTextSend &&
      isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)
    ) {
      clearAllRiskSessionState();
      replayVerifiedSend(input, form, submitter, replayOptions);
      return;
    }

    if (!analysis.findings.length) {
      const normalized = await applyNormalizedComposerRewrite(input, text, "submit");
      if (!normalized.ok) {
        clearWhatsAppTextSendPending(input);
        return;
      }

      if (!(await ensureExactComposerState(input, normalized.text))) {
        await showRewriteFailure(
          "submit",
          collectFailureDetails(input, normalized.text, getInputText(input), "submit")
        );
        refreshBadgeFromCurrentInput();
        clearWhatsAppTextSendPending(input);
        return;
      }

      queueVerifiedComposerSend(input, normalized.text, "submit", () => {
        replayVerifiedSend(input, form, submitter, replayOptions);
      }, verifiedSendOptions);
      return;
    }

    const decisionAction = await promptForSensitiveContentDecision(
      analysis.findings,
      "submit",
      policy,
      input,
      analysis.normalizedText
    );
    if (decisionAction === "cancel") {
      clearWhatsAppTextSendPending(input);
      return;
    }

    const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);

    const rewritten = await applySubmitRedactionTransactionally(
      input,
      analysis.normalizedText,
      result.redactedText,
      "submit",
      analysis.secretFindings
    );
    if (!rewritten) {
      clearWhatsAppTextSendPending(input);
      return;
    }

    setBadge("Content redacted");
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();

    queueVerifiedComposerSend(input, result.redactedText, "submit", () => {
      replayVerifiedSend(input, form, submitter, replayOptions);
    }, verifiedSendOptions);
  }

  function findSendButtonClickTarget(event) {
    const candidates = [];
    if (typeof event?.composedPath === "function") {
      candidates.push(...event.composedPath());
    }
    candidates.push(event?.target);

    for (const candidate of candidates) {
      if (!candidate || candidate === window || candidate === document) continue;
      const element = candidate.nodeType === Node.ELEMENT_NODE ? candidate : candidate.parentElement;
      if (!element) continue;

      for (const selector of SEND_BUTTON_SELECTORS) {
        const button = element.matches?.(selector) ? element : element.closest?.(selector);
        if (button && isVisible(button)) {
          return button;
        }
      }
    }

    return null;
  }

  function createSyntheticSubmitInterceptionEvent(target, options = {}) {
    return {
      target,
      leakGuardSendButton: options.sendButton || null,
      leakGuardReplayViaClick: Boolean(options.replayViaClick),
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() {}
    };
  }

  function markFallbackSendKeyRedactionPending(input) {
    fallbackSendKeySuppressionInput = input || null;
    fallbackSendKeySuppressionUntil = Date.now() + FALLBACK_SEND_KEY_SUPPRESS_MS;
  }

  function clearFallbackSendKeyRedactionPending(input) {
    if (!input || fallbackSendKeySuppressionInput === input) {
      fallbackSendKeySuppressionInput = null;
      fallbackSendKeySuppressionUntil = 0;
    }
  }

  function maybeConsumeSuppressedFallbackSendKeyEvent(event) {
    if (
      !fallbackSendKeySuppressionInput ||
      Date.now() > fallbackSendKeySuppressionUntil ||
      event?.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing
    ) {
      if (Date.now() > fallbackSendKeySuppressionUntil) {
        clearFallbackSendKeyRedactionPending();
      }
      return false;
    }

    const input = findComposer(event.target);
    if (input !== fallbackSendKeySuppressionInput) return false;

    consumeInterceptionEvent(event);
    return true;
  }

  async function maybeHandleSendButtonClick(event) {
    if (!extensionRuntimeAvailable) {
      return;
    }

    const clickTarget = normalizeTarget(event.target);
    if (clickTarget?.closest?.(".pwm-modal-backdrop")) {
      return;
    }

    if (modalOpen) {
      consumeInterceptionEvent(event);
      return;
    }

    if (bypassNextSendButtonClick) {
      bypassNextSendButtonClick = false;
      return;
    }

    const button = findSendButtonClickTarget(event);
    if (!button) return;

    const input = findComposer(button);
    if (!input) {
      if (isWhatsAppHost()) {
        consumeInterceptionEvent(event);
        await blockWhatsAppTextSend("composer_not_found");
      }
      return;
    }
    noteActiveRiskEditor(input);

    const extractedText = getInputText(input);
    if (extractedText == null) {
      if (isWhatsAppHost()) {
        consumeInterceptionEvent(event);
        await blockWhatsAppTextSend("text_extraction_failed");
      }
      return;
    }

    const text = String(extractedText);
    if (!text.trim()) {
      return;
    }
    if (shouldBypassWhatsAppSanitizedImageSend(input, text)) {
      consumeRecentWhatsAppSanitizedImageHandoff(input);
      whatsAppBypassSanitizedImageSubmitUntil = Date.now() + 1000;
      debugReveal("whatsapp:image-send-click-verification-bypassed", {
        reason: "recent_sanitized_image_handoff",
        text: summarizeDebugText(text)
      });
      return;
    }

    const quickAnalysis = analyzeText(text);
    if (!analysisNeedsEventOwnership(quickAnalysis) && !shouldOwnWhatsAppTextSend(text)) return;

    consumeInterceptionEvent(event);
    const form = button.closest?.("form") || input.closest?.("form") || null;
    await maybeHandleSubmit(createSyntheticSubmitInterceptionEvent(form || input, {
      sendButton: button,
      replayViaClick: true
    }));
  }

  function getFallbackSendKeyOrchestration() {
    if (fallbackSendKeyOrchestration) return fallbackSendKeyOrchestration;
    if (typeof FallbackSendKeyOrchestration.createFallbackSendKeyOrchestration !== "function") {
      fallbackSendKeyOrchestration = Object.freeze({
        maybeHandleFallbackSendKey: async () => {}
      });
      return fallbackSendKeyOrchestration;
    }

    fallbackSendKeyOrchestration =
      FallbackSendKeyOrchestration.createFallbackSendKeyOrchestration({
        analysisHasOnlySanitizedPlaceholderFindings,
        analysisNeedsEventOwnership,
        analyzeText,
        analyzeTextWithAiAssist,
        applyNormalizedComposerRewrite,
        applySubmitRedactionTransactionally,
        blockWhatsAppTextSend,
        clearFallbackSendKeyRedactionPending,
        clearWhatsAppTextSendPending,
        consumeInterceptionEvent,
        createWhatsAppVerifiedSendOptions,
        findComposer,
        findSendButton,
        getActivePolicy,
        getDestinationPolicyDecision,
        getInputText,
        getPolicyForAction,
        handleDestinationPolicy,
        handleHttpSecretPolicy,
        hideBadgeSoon,
        isExtensionRuntimeAvailable: () => extensionRuntimeAvailable,
        isModalOpen: () => modalOpen,
        isProtectionPauseActiveAfterPolicy,
        isWhatsAppHost,
        markFallbackSendKeyRedactionPending,
        markWhatsAppTextSendPending,
        noteActiveRiskEditor,
        promptForSensitiveContentDecision,
        queueVerifiedComposerSend,
        refreshBadgeFromCurrentInput,
        replayVerifiedSend,
        requestRedaction,
        setBadge,
        shouldForceDestinationRedaction,
        shouldOwnWhatsAppTextSend
      });
    return fallbackSendKeyOrchestration;
  }

  async function maybeHandleFallbackSendKey(event) {
    return getFallbackSendKeyOrchestration().maybeHandleFallbackSendKey(event);
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

    if (!isLiveTypedRedactionEnabled(getActivePolicy())) {
      lastTypedPromptText = analysis.normalizedText;
      return;
    }

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
    const placeholderTokenRegex = ANY_PLACEHOLDER_TOKEN_REGEX || PLACEHOLDER_TOKEN_REGEX;
    return {
      document,
      MutationObserver,
      Node,
      NodeFilter,
      normalizeVisiblePlaceholders,
      placeholderTokenRegex,
      placeholderCount: currentPublicState.placeholderCount,
      trustedPlaceholders: currentPublicState.trustedPlaceholders,
      knownPlaceholders: currentPublicState.trustedPlaceholders,
      canonicalizePlaceholderToken: globalThis.PWM?.canonicalizePlaceholderToken,
      tokenizePlaceholderText: (text, options) =>
        tokenizeRehydrationPlaceholderText(text, {
          ...options,
          placeholderCount: currentPublicState.placeholderCount,
          trustedPlaceholders: currentPublicState.trustedPlaceholders,
          knownPlaceholders: currentPublicState.trustedPlaceholders,
          canonicalizePlaceholderToken: globalThis.PWM?.canonicalizePlaceholderToken
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
    clearPendingGenericSanitizedFileHandoff("navigation");
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
    globalThis.PWM.ContentEventBindings.bindFileDragRoot(root, {
      eventRoots: fileDragEventRoots,
      fileDragGuard,
      onFileDrag: maybeHandleFileDrag,
      onFileDrop,
      onDragEnd: clearFileDragSession
    });
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

    const onPaste = (event) => {
      maybeHandlePaste(event).catch(handleContentError);
    };
    window.addEventListener("paste", onPaste, true);
    document.addEventListener("paste", onPaste, true);

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
      "click",
      (event) => {
        maybeHandleSendButtonClick(event).catch(handleContentError);
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

    window.addEventListener(
      "keydown",
      (event) => {
        maybeHandleFallbackSendKey(event).catch(handleContentError);
      },
      true
    );

    window.addEventListener(
      "keypress",
      (event) => {
        maybeConsumeSuppressedFallbackSendKeyEvent(event);
      },
      true
    );

    window.addEventListener(
      "keyup",
      (event) => {
        maybeConsumeSuppressedFallbackSendKeyEvent(event);
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
    runGeminiUiDiagnostics("body-ready");
  }

  async function boot() {
    bindEvents();
    await initState();
    finishBodyReadyBoot();
    installNavigationWatchers();
    runGeminiUiDiagnostics("boot");

    if (!document.body) {
      document.addEventListener("DOMContentLoaded", finishBodyReadyBoot, { once: true });
    }
  }

  boot().catch(handleContentError);
})();
