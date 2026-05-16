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
    FilePasteHelpers
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
    forceRewriteInputText
  } = ComposerHelpers;
  const {
    dataTransferHasFiles,
    readLocalTextFileFromDataTransfer,
    createSanitizedTextFile
  } = FilePasteHelpers || {};
  const StreamingFileRedactor = globalThis.PWM?.StreamingFileRedactor || {};

  const COMPOSER_SELECTORS = [
    "#prompt-textarea",
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
    "[contenteditable]:not([contenteditable='false'])[role='textbox']",
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
  let statusPanelEl = null;
  let statusPanelCollapsed = false;
  let statusPanelProtectionValueEl = null;
  let statusPanelSiteValueEl = null;
  let statusPanelComposerValueEl = null;
  let statusPanelSessionValueEl = null;
  let statusPanelPauseBtn = null;
  let extensionRuntimeAvailable = true;
  const sanitizedFileInputHandoffs = new WeakSet();
  const firefoxFileInputTransactions = new WeakMap();
  const rawFileDropInterceptions = new WeakSet();
  const fileDragEventRoots = new WeakSet();
  const editorRiskState = new WeakMap();
  const PROGRAMMATIC_INPUT_SUPPRESS_MS = 500;
  const CHATGPT_LARGE_PASTE_FILE_THRESHOLD = 16 * 1024;
  const CHATGPT_SANITIZED_PASTE_FILE_NAME = "leakguard-redacted-paste.txt";
  const GEMINI_DIRECT_TEXT_INSERT_THRESHOLD = 8 * 1024;
  const GEMINI_AUTO_INSERT_TEXT_LIMIT = 256 * 1024;
  const GEMINI_LARGE_TEXT_SUPPRESS_MS = 2500;
  const LOCAL_TEXT_FAST_MAX_BYTES =
    globalThis.PWM?.FileScanner?.LOCAL_TEXT_FAST_MAX_BYTES || 2 * 1024 * 1024;
  const LOCAL_TEXT_OPTIMIZED_MAX_BYTES =
    globalThis.PWM?.FileScanner?.LOCAL_TEXT_OPTIMIZED_MAX_BYTES || 4 * 1024 * 1024;
  const LOCAL_TEXT_HARD_BLOCK_BYTES =
    globalThis.PWM?.FileScanner?.LOCAL_TEXT_HARD_BLOCK_BYTES || 4 * 1024 * 1024;
  const LOCAL_TEXT_HARD_BLOCK_TITLE = "Large payload blocked for browser stability";
  const LOCAL_TEXT_HARD_BLOCK_MESSAGE =
    "This content is over 4 MB. LeakGuard did not process or send it automatically to avoid browser instability. Split the file into smaller parts, or sanitize it separately before upload.";
  const STREAMING_BLOCK_TITLE =
    StreamingFileRedactor.STREAMING_BLOCK_TITLE || "File too large for local redaction";
  const STREAMING_BLOCK_MESSAGE =
    StreamingFileRedactor.STREAMING_BLOCK_MESSAGE ||
    "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.";
  const FILE_DRAG_SESSION_RESET_MS = 5000;
  const GEMINI_UPLOAD_INPUT_WAIT_MS = 450;
  const GEMINI_GHOST_INGRESS_TIMEOUT_MS = 2200;
  const GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS = 30000;
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
  let dmzOverlayEl = null;
  let dmzOverlayStatusEl = null;
  let dmzOverlayTimer = 0;
  let dmzFallbackStyleEl = null;
  let syntheticFileListCapabilityCache = null;
  let inputFileAssignmentCapabilityCache = null;

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
    try {
      return (
        window.localStorage?.getItem("pwm:debug") === "1" ||
        window.sessionStorage?.getItem("pwm:debug") === "1"
      );
    } catch {
      return false;
    }
  }

  function summarizeDebugText(text) {
    const normalized = normalizeComposerText(normalizeVisiblePlaceholders(text));
    const matches = normalized.match(new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g")) || [];

    return {
      length: normalized.length,
      lineCount: normalized ? normalized.split("\n").length : 0,
      placeholderCount: matches.length
    };
  }

  function collectComposerDebugSnapshot(input, expected, writeText) {
    const actual = getInputText(input);
    const normalizedExpected = normalizeComposerText(expected);
    const normalizedWriteText =
      typeof writeText === "string" ? normalizeComposerText(writeText) : normalizedExpected;
    const innerText = normalizeComposerText(input?.innerText || "");
    const normalizedInnerText = normalizeEditorInnerText(input?.innerText || "");

    return {
      expected: summarizeDebugText(normalizedExpected),
      writeText: summarizeDebugText(normalizedWriteText),
      getInputText: summarizeDebugText(actual),
      innerText: summarizeDebugText(innerText),
      normalizedInnerText: summarizeDebugText(normalizedInnerText),
      textContent: summarizeDebugText(input?.textContent || ""),
      actualMatchesExpected: actual === normalizedExpected,
      actualMatchesWriteText: actual === normalizedWriteText
    };
  }

  function debugLogSnapshot(label, input, expected, writeText) {
    if (!isDebugEnabled()) return;

    const snapshot = collectComposerDebugSnapshot(input, expected, writeText);
    console.groupCollapsed(`[PWM] ${label}`);
    console.log(snapshot);
    console.groupEnd();
  }

  function debugReveal(label, payload) {
    if (!isDebugEnabled()) return;
    console.groupCollapsed(`[PWM] ${label}`);
    console.log(payload);
    console.groupEnd();
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

  function getFirefoxRawFileUploadBlockedMessage(context) {
    if (context !== "file-input" || !isFirefoxRuntime()) return "";
    if (isGeminiHost()) {
      return "LeakGuard blocked raw file upload in Firefox. Use Gemini's upload button again so LeakGuard can sanitize and replace the selected file before upload.";
    }
    return "LeakGuard blocked raw file upload in Firefox. Use LeakGuard drag/drop with a supported text file.";
  }

  const FIREFOX_GEMINI_DROP_FILE_UNAVAILABLE_MESSAGE =
    "Firefox did not expose the dropped file to LeakGuard. Use Gemini's upload button so LeakGuard can sanitize and replace the selected file before upload.";

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

    if (typeof DataTransfer === "function") {
      try {
        const emptyTransfer = new DataTransfer();
        fileInput.files = emptyTransfer.files;
        cleared = true;
      } catch {
        // Assignment is best-effort. The original event is still stopped fail-closed.
      }
    }
    return cleared;
  }

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
    const FileScanner = globalThis.PWM?.FileScanner || {};
    if (typeof FileScanner.classifyFileForTextScan === "function") {
      return FileScanner.classifyFileForTextScan({
        fileName: file?.name || "",
        mimeType: file?.type || ""
      });
    }

    return {
      kind: "unknown",
      action: "allow",
      message:
        "LeakGuard did not scan or redact this file. Unsupported file types such as PDF, DOCX, images, archives, executables, and binary files are not protected in this release. Normal upload may continue through the site."
    };
  }

  function resolveLocalFileTransferPolicy(dataTransfer) {
    const files = listLocalTransferFiles(dataTransfer);
    if (!files.length) {
      return { action: "scan" };
    }

    const classifications = files.map(classifyLocalFile);
    if (classifications.some((classification) => classification.action === "scan")) {
      return { action: "scan", files, classifications };
    }

    return {
      action: "allow",
      reason: "unsupported_file_pass_through",
      files,
      classifications,
      message:
        classifications.find((classification) => classification.message)?.message ||
        "LeakGuard did not scan or redact this file. Unsupported file types such as PDF, DOCX, images, archives, executables, and binary files are not protected in this release. Normal upload may continue through the site."
    };
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
    return (
      isFirefoxRuntime() &&
      policy?.action === "allow" &&
      dataTransferLooksLikeFiles({ files: policy.files || [], types: ["Files"], items: [] }) &&
      isProtectedFileDropDriver(getCurrentHandoffDriverId())
    );
  }

  function getUnsupportedFileBlockedMessage(policy) {
    return (
      policy?.message ||
      "LeakGuard blocked this file because Firefox cannot safely pass unsupported files through on protected AI sites. Use the LeakGuard drag/drop box with a supported text file."
    );
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

  function getLocalTextPayloadByteLength(text, fallbackBytes = 0) {
    if (typeof text !== "string") {
      return Math.max(0, Number(fallbackBytes) || 0);
    }

    try {
      if (typeof TextEncoder === "function") {
        return new TextEncoder().encode(text).byteLength;
      }
    } catch {
      // Fall through to a conservative UTF-16 estimate.
    }

    return text.length * 2;
  }

  function classifyLocalTextPayloadSize(payload) {
    const input = payload || {};
    const bytes = getLocalTextPayloadByteLength(input.text || "", input.sizeBytes || 0);
    if (bytes > LOCAL_TEXT_HARD_BLOCK_BYTES) {
      return { zone: "blocked", bytes };
    }

    if (bytes > LOCAL_TEXT_FAST_MAX_BYTES && bytes <= LOCAL_TEXT_OPTIMIZED_MAX_BYTES) {
      return { zone: "optimized", bytes };
    }

    return { zone: "fast", bytes };
  }

  function showLocalPayloadOptimizationStatus(sizeInfo) {
    debugReveal("local-payload:optimization-started", {
      bytes: sizeInfo?.bytes || 0,
      fastMaxBytes: LOCAL_TEXT_FAST_MAX_BYTES,
      optimizedMaxBytes: LOCAL_TEXT_OPTIMIZED_MAX_BYTES
    });
    setBadge("Optimizing redaction... LeakGuard is processing a larger payload locally.");
  }

  function clearLocalPayloadOptimizationStatus(sizeInfo, outcome = "complete") {
    debugReveal("local-payload:optimization-finished", {
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
    debugReveal("local-payload:blocked", {
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
    debugReveal("streaming-redaction:started", {
      file: describeFileForDebug(fileInfo),
      maxBytes: StreamingFileRedactor.LARGE_TEXT_STREAMING_MAX_BYTES || 50 * 1024 * 1024
    });
    setBadge("Streaming redaction... LeakGuard is sanitizing a large file locally before upload.");
  }

  function updateStreamingRedactionProgress(progress) {
    const processed = Number(progress?.bytesProcessed || 0);
    const total = Number(progress?.totalBytes || 0);
    debugReveal("streaming-redaction:progress", {
      bytesProcessed: processed,
      totalBytes: total
    });
  }

  function clearStreamingRedactionStatus(result) {
    debugReveal("streaming-redaction:finished", {
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
    return normalizeEditorInnerText(normalizeComposerText(normalizeVisiblePlaceholders(text))).replace(
      /[^\S\n]+/g,
      " "
    ).replace(
      / *\n+ */g,
      "\n"
    ).replace(
      /\n+$/g,
      ""
    );
  }

  function normalizeLooseVerificationText(text) {
    return normalizeVerificationText(text).replace(/\s+/g, " ").trim();
  }

  function listExpectedPlaceholders(text) {
    const normalized = normalizeVisiblePlaceholders(text);
    const matches = normalized.match(new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g")) || [];
    return [...new Set(matches)];
  }

  function actualContainsExpectedPlaceholders(expectedText, actualText) {
    const placeholders = listExpectedPlaceholders(expectedText);
    if (!placeholders.length) return true;

    const actual = normalizeVisiblePlaceholders(actualText);
    return placeholders.every((placeholder) => actual.includes(placeholder));
  }

  function matchesComposerPlan(plan, actualText) {
    if (plan.acceptableTexts.includes(actualText)) {
      return true;
    }

    const normalizedActual = normalizeVerificationText(actualText);
    if (
      plan.acceptableTexts.some(
        (candidate) =>
          normalizeVerificationText(candidate) === normalizedActual &&
          actualContainsExpectedPlaceholders(candidate, actualText)
      )
    ) {
      return true;
    }

    const looseActual = normalizeLooseVerificationText(actualText);
    return plan.acceptableTexts.some(
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

  async function showRewriteFailure(context, details) {
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

  async function applyComposerText(input, expectedText, options) {
    options = options || {};
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
    if (matchesComposerPlan(plan, actual)) {
      return { ok: true, actual, strategy: "primary-rewrite" };
    }

    forceRewriteInputText(input, writeText, {
      caretOffset: options.caretOffset
    });
    actual = await readStableComposerText(input);
    debugLogSnapshot("rewrite:html-fallback", input, expected, writeText);

    if (matchesComposerPlan(plan, actual)) {
      return { ok: true, actual, strategy: "html-fallback" };
    }

    if (rawInsertedText && actual.includes(rawInsertedText)) {
      suppressFollowupInputScan();
      if (setInputTextDirect(input, writeText, { caretOffset: options.caretOffset })) {
        actual = await readStableComposerText(input);
        debugLogSnapshot("rewrite:direct-transactional-fallback", input, expected, writeText);

        if (matchesComposerPlan(plan, actual) && !actual.includes(rawInsertedText)) {
          return { ok: true, actual, strategy: "direct-transactional-fallback" };
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
      rawInsertedText: normalizedOriginal
    });

    if (applied.ok && !hasRawLeak(applied.actual)) {
      return applied;
    }

    suppressFollowupInputScan();
    if (setInputTextDirect(input, normalizedRedacted, { caretOffset: options.caretOffset })) {
      const actual = await readStableComposerText(input);
      if (
        matchesComposerPlan(plan, actual) &&
        !hasRawLeak(actual)
      ) {
        return { ok: true, actual, strategy: "direct-transactional-rewrite" };
      }
      if (hasRawLeak(actual)) {
        forceRewriteInputText(input, plan.writeText, { caretOffset: options.caretOffset });
        const forcedActual = await readStableComposerText(input);
        if (matchesComposerPlan(plan, forcedActual) && !hasRawLeak(forcedActual)) {
          return { ok: true, actual: forcedActual, strategy: "forced-transactional-rewrite" };
        }
        return { ok: false, actual: forcedActual };
      }
      return { ok: false, actual };
    }

    return applied;
  }

  async function ensureExactComposerState(input, expectedText) {
    const plan = buildComposerWritePlan(input, expectedText);
    const actual = await readStableComposerText(input, 2);
    debugLogSnapshot("pre-submit-check", input, plan.canonical, plan.writeText);
    return matchesComposerPlan(plan, actual);
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
      if (fileInput && handOffSanitizedFileInput(fileInput, transfer, { dispatchInput: true })) {
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
    return location.hostname === "chatgpt.com" || location.hostname === "chat.openai.com";
  }

  function isGeminiHost() {
    return location.hostname === "gemini.google.com";
  }

  function isClaudeHost() {
    return location.hostname === "claude.ai" || location.hostname.endsWith(".claude.ai");
  }

  function isGrokHost() {
    return location.hostname === "grok.com" || location.hostname.endsWith(".grok.com");
  }

  function getCurrentHandoffDriverId() {
    if (isGeminiHost()) return "gemini";
    if (isChatGptHost()) return "chatgpt";
    if (isClaudeHost()) return "claude";
    if (isGrokHost()) return "grok";
    return "generic";
  }

  function isProtectedFileDropDriver(id) {
    if (id === "gemini" || id === "chatgpt" || id === "claude" || id === "grok") {
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
    if (!input || typeof setInputTextDirect !== "function") return false;

    const next = spliceSelectionText(originalText, selection, String(redactedText || ""));
    const plan = buildComposerWritePlan(input, next.text);

    suppressFollowupInputScan(GEMINI_LARGE_TEXT_SUPPRESS_MS);
    if (!setInputTextDirect(input, plan.writeText, { caretOffset: next.caretOffset })) {
      return false;
    }

    const actual = await readStableComposerText(input);
    if (matchesComposerPlan(plan, actual)) {
      return true;
    }

    await showRewriteFailure("paste", collectFailureDetails(input, next.text, actual, "paste"));
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

      if (sanitizedFile && (await handOffSanitizedLocalFile(event, input, sanitizedFile, "paste"))) {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "complete");
        }
        setBadge("LeakGuard redacted pasted text before attachment.");
        hideBadgeSoon(4200);
        refreshBadgeFromCurrentInput();
        return true;
      }

      if (await applyChatGptLargePasteTextFallback(input, originalText, selection, redactedText)) {
        debugReveal("chatgpt-large-paste:text-fallback-success", {
          redactedLength: redactedText.length
        });
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
    return (
      el.closest(".ql-editor") ||
      el.closest('[contenteditable="true"]') ||
      el.closest("[contenteditable]:not([contenteditable='false'])") ||
      el.closest("[role='textbox']")
    );
  }

  function resolveGeminiFallbackEditor(event, input) {
    if (!isGeminiHost()) return null;
    return (
      resolveGeminiEditorTarget(event?.target) ||
      resolveGeminiEditorTarget(input) ||
      resolveGeminiEditorTarget(document.activeElement) ||
      resolveGeminiEditorTarget(findComposer(event?.target)) ||
      resolveGeminiEditorTarget(findComposer(document.activeElement)) ||
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

  function insertGeminiFirefoxEditorText(editor, sanitizedText, options) {
    options = options || {};
    const normalized = normalizeComposerText(sanitizedText);
    if (!editor || !isFirefoxRuntime() || !isGeminiHost() || !isContentEditable(editor) || !normalized.includes("\n")) {
      return false;
    }

    const assistSnapshot = disableGeminiEditorInputAssist(editor);
    try {
      suppressFollowupInputScan();
      editor.focus();
      const inserted = Boolean(document.execCommand?.("insertText", false, normalized));
      if (!inserted) {
        debugReveal("gemini-text:firefox-insert-text-unavailable", {
          insertedLength: normalized.length,
          lineCount: normalized.split("\n").length
        });
        return false;
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

      return verified;
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
        message:
          "LeakGuard did not scan or redact this file. Unsupported file types such as PDF, DOCX, images, archives, executables, and binary files are not protected in this release. Normal upload may continue through the site."
      };
    }

    if (Number(file?.size || 0) > (StreamingFileRedactor.LARGE_TEXT_STREAMING_MAX_BYTES || 50 * 1024 * 1024)) {
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
        message: "LeakGuard will stream-redact this large text file locally before upload."
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
    if (!file) return null;
    return {
      name: file.name || "",
      type: file.type || "",
      size: Number(file.size || 0)
    };
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
    const file = localFile?.file || localFile || null;
    return {
      name: file?.name || "",
      type: file?.type || "",
      size: Number(file?.size ?? file?.sizeBytes ?? 0),
      lastModified: Number(file?.lastModified || 0)
    };
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
      allowUploadUiClick: !isFirefoxRuntime()
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
    if (label === "Open upload file menu" || /\bupload-card-button\b/.test(className)) return true;
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
    const testId = candidate.getAttribute?.("data-test-id") || candidate.dataset?.testId || "";
    if (testId === "local-images-files-uploader-button") return true;
    return role === "menuitem" && /upload files/i.test(label);
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
    return (
      candidates.find((candidate) => {
        const testId = candidate.getAttribute?.("data-test-id") || candidate.dataset?.testId || "";
        return testId === "local-images-files-uploader-button" && isSafeGeminiUploadFilesMenuItem(candidate);
      }) ||
      candidates.find((candidate) => isSafeGeminiUploadFilesMenuItem(candidate)) ||
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
      const finish = (reason = "") => {
        if (settled) return;
        result = findGeminiFileInput(event, input);
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
        resolve(result);
      };

      try {
        observer = new MutationObserver(() => finish());
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
      const textInserted =
        typeof insertGeminiSanitizedText === "function"
          ? await insertGeminiSanitizedText(payload, context.event, context.input)
          : false;
      if (textInserted === true) {
        debugReveal("file-handoff:gemini-firefox-file-input-bridge-text-fallback-success", {
          ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
          bridgeUi
        });
        return {
          handled: true,
          ok: true,
          stage: "text",
          strategy: "gemini-firefox-sanitized-text-fallback"
        };
      }
      details.failureReason = "file_input_bridge_input_not_found";
      debugReveal(
        "file-handoff:gemini-firefox-file-input-bridge-input-not-found",
        {
          ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
          bridgeUi,
          uploadMenu: describeGeminiUploadMenuDiscovery(),
          overlay: describeGeminiOverlayExposure()
        }
      );
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

  function isSafeSanitizedPayload(payload) {
    return Boolean(
      payload &&
        payload.sanitizedFile &&
        typeof payload.redactedText === "string" &&
        payload.redactedText.length > 0
    );
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

    const fileInput = resolveFileInputForHandoff(event, input);
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

  function buildSanitizedDownloadFileName(sanitizedFile) {
    const originalName = sanitizeDownloadFileNameSegment(sanitizedFile?.name || "sanitized-file.txt");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace(/\d{3}Z$/, "Z");
    return `LeakGuard/redacted/${timestamp}-${originalName}`;
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
      debugReveal("file-handoff:sanitized-download", {
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
        if (id === "chatgpt" || id === "claude" || id === "generic") {
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
    if (!driver?.canHandle?.(location, document)) {
      return { ok: false, stage: "driver-unavailable" };
    }
    if (!isSafeSanitizedPayload(payload)) {
      setDmzOverlayState("Raw file blocked", "failed");
      return { ok: false, stage: "failed", reason: "unsafe_sanitized_payload" };
    }

    if (await driver.tryAttachSanitizedFile(payload, context)) {
      setDmzOverlayState("Attached sanitized file", "attached");
      return { ok: true, stage: "file", strategy: `${driver.id}-sanitized-file-handoff` };
    }

    const firefoxGeminiBridgeResult =
      driver.id === "gemini"
        ? await tryFirefoxGeminiFileInputBridge(payload, context)
        : { handled: false, ok: false };
    if (firefoxGeminiBridgeResult.ok) {
      if (firefoxGeminiBridgeResult.stage === "text") {
        setDmzOverlayState("Inserted sanitized content", "inserted");
        return { ok: true, stage: "text", strategy: firefoxGeminiBridgeResult.strategy };
      }
      setDmzOverlayState("Attached sanitized file", "attached");
      return { ok: true, stage: "file", strategy: firefoxGeminiBridgeResult.strategy };
    }
    if (firefoxGeminiBridgeResult.handled) {
      setDmzOverlayState("Raw file blocked", "failed");
      return firefoxGeminiBridgeResult;
    }

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

    setDmzOverlayState("Raw file blocked", "failed");
    return { ok: false, stage: "failed", reason: "sanitized_payload_handoff_failed" };
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
    const unsafePathChars = new RegExp('[\\\\/:*?"<>|\\u0000-\\u001f]+', "g");
    const normalized = String(value || fallback)
      .replace(unsafePathChars, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+|\.+$/g, "");
    return normalized || fallback;
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

  function clearPendingGeminiSanitizedFileHandoff(reason = "") {
    clearPendingGeminiGhostIngressClickInterceptor(reason || "pending-cleared");
    if (!pendingGeminiSanitizedFileHandoff) return;

    const pending = pendingGeminiSanitizedFileHandoff;
    pendingGeminiSanitizedFileHandoff = null;

    if (pendingGeminiSanitizedFileObserver) {
      try {
        pendingGeminiSanitizedFileObserver.disconnect();
      } catch {
        // Best-effort cleanup only.
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
        // Best-effort cleanup only.
      }
      pendingGeminiSanitizedFileClickHandler = null;
    }

    debugReveal("file-handoff:gemini-pending-cleared", {
      reason,
      ageMs: Math.max(0, Date.now() - Number(pending.createdAt || 0)),
      sanitizedFile: describeFileForDebug(pending.sanitizedFile)
    });
  }

  function isLikelyGeminiUploadClickTarget(target) {
    const meta = describeElementForDebug(normalizeTarget(target));
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
    clearPendingGeminiSanitizedFileHandoff("assigned");
    setBadge("LeakGuard attached the sanitized file.");
    hideBadgeSoon(3200);
    refreshBadgeFromCurrentInput();
    return true;
  }

  function queuePendingGeminiSanitizedFileHandoff(event, input, sanitizedFile, details = null) {
    if (!isGeminiHost() || event?.type !== "drop" || !sanitizedFile) return false;

    clearPendingGeminiSanitizedFileHandoff("replaced");
    pendingGeminiSanitizedFileHandoff = {
      sanitizedFile,
      createdAt: Date.now(),
      expiresAt: Date.now() + GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS,
      sessionHash: lastGeminiDropSessionHash || ""
    };

    if (details) {
      details.handoffStage = "gemini:pending-user-upload-input";
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
    setBadge("Sanitized file ready. Open Gemini upload files to attach.");
    hideBadgeSoon(6500);
    schedulePendingGeminiSanitizedFileAttempt("queued");
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
    const events = [];
    try {
      sanitizedFileInputHandoffs.add(fileInput);
      fileInput.files = transfer.files;
      if (details) details.inputFilesAssignmentSucceeded = true;
      if (Number(fileInput.files?.length || 0) <= 0) {
        if (details) details.failureReason = "input_files_assignment_empty";
        sanitizedFileInputHandoffs.delete(fileInput);
        return false;
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
      debugReveal("file-handoff:assignment-success", {
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
      sanitizedFileInputHandoffs.delete(fileInput);
      try {
        fileInput.value = "";
      } catch {
        // The original raw file must remain blocked if sanitized file assignment fails.
      }
      return false;
    }
  }

  async function handOffSanitizedLocalFile(event, input, sanitizedFile, context) {
    if (shouldUseFirefoxTextFallbackForFileHandoff()) {
      debugReveal("file-handoff:firefox-text-fallback-required", {
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
      debugReveal("file-handoff:data-transfer-create-failed", {
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

  function isForbiddenGeminiUploadButton(candidate) {
    const className = String(candidate?.className || candidate?.getAttribute?.("class") || "");
    return /\bhidden-local-(?:file-image-selector|upload|file-upload)-button\b/.test(className);
  }

  function isAllowedGeminiUploadMenuOpener(candidate) {
    if (!candidate || candidate.disabled || isForbiddenGeminiUploadButton(candidate)) return false;
    const label = candidate.getAttribute?.("aria-label") || candidate.ariaLabel || "";
    return label === "Open upload file menu";
  }

  function clickElementSafely(candidate) {
    if (!candidate || candidate.disabled || isForbiddenGeminiUploadButton(candidate)) return false;
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
      // Best-effort cleanup only.
    }
  }

  function createGeminiGhostIngressClickInterceptor(sanitizedFile, details, onFinished) {
    if (!isGeminiHost() || !sanitizedFile) return null;
    const clickRoot =
      typeof window !== "undefined" && typeof window?.addEventListener === "function" ? window : document;
    if (!clickRoot || typeof clickRoot.addEventListener !== "function") return null;

    let cleaned = false;
    let timeoutId = 0;
    const handler = (clickEvent) => {
      const target = normalizeTarget(clickEvent?.target);
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
      try {
        clickRoot.removeEventListener("click", handler, true);
      } catch {
        // Best-effort cleanup only.
      }
    };

    clearPendingGeminiGhostIngressClickInterceptor("replaced");
    clickRoot.addEventListener("click", handler, true);
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
        }
        resolve({ discovery, fileInput });
      };

      createGeminiGhostIngressClickInterceptor(sanitizedFile, details, (assignedInput, reason) => {
        clickAssignedInput = assignedInput;
        finish(reason || "ghost_ingress_click_assigned", assignedInput);
      });

      if (typeof MutationObserver === "function") {
        try {
          observer = new MutationObserver(() => finish());
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
        if (overlayItem && clickElementSafely(overlayItem)) {
          finish();
        }
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
      debugReveal("file-handoff:text-fallback-unavailable", {
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
      debugReveal("file-handoff:text-fallback-failed", {
        context: event?.type || "",
        reason: "composer_rewrite_failed"
      });
      return false;
    }

    debugReveal("file-handoff:text-fallback-success", {
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
      debugReveal("file-handoff:text-fallback-unavailable", {
        context: event?.type || "",
        reason: "sanitized_text_too_large",
        redactedLength: text.length
      });
      return false;
    }

    const targetInput = input || findComposer(event?.target) || findComposer(document.activeElement);
    if (!targetInput) {
      debugReveal("file-handoff:text-fallback-unavailable", {
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
      debugReveal("file-handoff:text-fallback-failed", {
        context: event?.type || "",
        reason: "composer_rewrite_failed"
      });
      return false;
    }

    debugReveal("file-handoff:text-fallback-success", {
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
    if (!localFile.handled) {
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
        const streamResult = await streamRedactLocalTextFile(localFile.sourceFile, localFile.file);
        if (streamResult.action === "blocked") {
          return blockStreamingLocalFile(
            event,
            streamResult.title || STREAMING_BLOCK_TITLE,
            streamResult.error || STREAMING_BLOCK_MESSAGE
          );
        }

        if (streamResult.action !== "redacted" || !streamResult.sanitizedFile) {
          return blockStreamingLocalFile(
            event,
            "Raw file upload blocked",
            streamResult.error || "LeakGuard blocked raw file upload because streaming redaction failed."
          );
        }

        const fallbackText = isGeminiHost() ? await readSanitizedFileTextForFallback(streamResult.sanitizedFile) : "";
        const driver = getCurrentHandoffDriver();
        const payload = driver.preparePayload(streamResult.sanitizedFile, fallbackText, {
          localFile: localFile.sourceFile || localFile.file,
          analysis: null,
          result: null
        });
        const handoffResult =
          context === "drop"
            ? await driver.handoff(payload, { event, input, context, driver, composerResolved: true })
            : await (async () => {
                if (await handOffSanitizedLocalFile(event, input, streamResult.sanitizedFile, context)) {
                  return { ok: true, stage: "file", strategy: "streaming-sanitized-file-handoff" };
                }
      if (context === "file-input" && isFirefoxRuntime() && isGeminiHost()) {
        return { ok: false, stage: "failed", reason: "firefox_gemini_file_input_replacement_failed" };
      }
      const inserted = await driver.insertSanitizedText(payload, { event, input, context, driver });
      return inserted === true
        ? { ok: true, stage: "text", strategy: "streaming-sanitized-text-fallback" }
        : { ok: false, stage: "failed", reason: inserted === "cancelled" ? "sanitized_text_cancelled" : "sanitized_payload_handoff_failed" };
              })();
        if (handoffResult.ok) {
          setDmzOverlayState("Attached sanitized file", "attached");
          setBadge("LeakGuard attached a sanitized local file.");
          hideBadgeSoon(3200);
          refreshBadgeFromCurrentInput();
          return {
            handled: true,
            ok: true,
            strategy: handoffResult.strategy || "streaming-sanitized-file-handoff"
          };
        }

        return blockStreamingLocalFile(
          event,
          "Raw file upload blocked",
          handoffResult.message ||
            "LeakGuard blocked raw file upload. Sanitized streaming file handoff failed."
        );
      }

      if (localFile.code === "file_too_large") {
        setBadge(STREAMING_BLOCK_TITLE);
        hideBadgeSoon(4200);
        await showMessageModal(STREAMING_BLOCK_TITLE, localFile.message || STREAMING_BLOCK_MESSAGE);
      } else {
        const firefoxBlockedMessage = getFirefoxRawFileUploadBlockedMessage(context);
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
      await blockLargeLocalTextPayload(event, sizeInfo);
      return true;
    }

    const optimizedStatus = sizeInfo.zone === "optimized";
    if (optimizedStatus) {
      showLocalPayloadOptimizationStatus(sizeInfo);
    }

    let analysis;
    let result;
    let sanitizedFile;
    try {
      if (context === "drop" && getCurrentHandoffDriver()?.usesDmzOverlay) {
        setDmzOverlayState("Redacting...", "redacting");
      }
      analysis = analyzeText(localFile.text);
      result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
      sanitizedFile = createSanitizedTextFile(localFile.file, result.redactedText);
    } catch (error) {
      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
      }
      debugReveal("file-handoff:redaction-failed", {
        context,
        error: error?.message || String(error)
      });
      if (context === "drop" && getCurrentHandoffDriver()?.usesDmzOverlay) {
        setDmzOverlayState("Raw file blocked", "failed");
        scheduleDmzOverlayCleanup(3600);
      }
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
    if (context === "drop" && driver.usesDmzOverlay) {
      setDmzOverlayState("Sanitized file ready", "ready");
    }

    const payload = driver.preparePayload(sanitizedFile, result.redactedText, {
      localFile,
      analysis,
      result
    });
    const handoffResult =
      context === "drop"
        ? await driver.handoff(payload, { event, input, context, driver, composerResolved: true })
        : await (async () => {
            // Legacy non-drop path starts with handOffSanitizedLocalFile(event, input, sanitizedFile, context).
            if (await handOffSanitizedLocalFile(event, input, sanitizedFile, context)) {
              return { ok: true, stage: "file", strategy: "sanitized-file-handoff" };
            }
            if (context === "file-input" && isFirefoxRuntime() && isGeminiHost()) {
              return { ok: false, stage: "failed", reason: "firefox_gemini_file_input_replacement_failed" };
            }
            const inserted = await driver.insertSanitizedText(payload, { event, input, context, driver });
            return inserted === true
              ? { ok: true, stage: "text", strategy: "sanitized-text-fallback" }
              : { ok: false, stage: "failed", reason: inserted === "cancelled" ? "sanitized_text_cancelled" : "sanitized_payload_handoff_failed" };
          })();

    if (!handoffResult.ok) {
      if (handoffResult.reason === "sanitized_text_cancelled") {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "cancelled");
        }
        return {
          handled: true,
          ok: false,
          reason: "sanitized_text_cancelled"
        };
      }

      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
      }
      debugReveal("file-handoff:fail-closed", {
        context,
        reason: "sanitized_file_handoff_failed",
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      setBadge("Raw file upload blocked");
      hideBadgeSoon(4200);
      await showMessageModal(
        "Raw file upload blocked",
        handoffResult.message ||
          "LeakGuard blocked raw file upload. Sanitized file handoff failed; use File Scanner or paste redacted text manually."
      );
      refreshBadgeFromCurrentInput();
      return {
        handled: true,
        ok: false,
        reason: "sanitized_file_handoff_failed"
      };
    }

    if (optimizedStatus) {
      clearLocalPayloadOptimizationStatus(sizeInfo, "complete");
    }
    if (context === "drop" && driver.usesDmzOverlay && handoffResult.stage === "file") {
      scheduleDmzOverlayCleanup(1400);
    } else if (context === "drop" && driver.usesDmzOverlay && handoffResult.stage === "text") {
      scheduleDmzOverlayCleanup(1800);
    }
    if (handoffResult.stage === "file" || context !== "drop") {
      setBadge("LeakGuard attached a sanitized local file.");
      hideBadgeSoon(3200);
    }
    refreshBadgeFromCurrentInput();
    return {
      handled: true,
      ok: true,
      strategy: handoffResult.strategy || "sanitized-file-handoff"
    };
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

    const isFirefoxProtectedInput = isFirefoxProtectedFileInputEvent(event);
    const existingTransaction = isFirefoxProtectedInput ? getFirefoxFileInputTransaction(event.target) : null;

    if (sanitizedFileInputHandoffs.has(event.target)) {
      if (!isFirefoxProtectedInput) {
        sanitizedFileInputHandoffs.delete(event.target);
        return;
      }
      const currentSignature = getFileListMetadataSignature(event.target.files);
      const isOwnSanitizedRedispatch =
        existingTransaction?.state === "replaced" &&
        (!existingTransaction.sanitizedSignature || currentSignature === existingTransaction.sanitizedSignature) &&
        (!existingTransaction.suppressUntil || Date.now() <= existingTransaction.suppressUntil);
      if (isOwnSanitizedRedispatch) {
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

    const selectedFiles = Array.from(event.target.files || []);
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

  function createSecretSpan(placeholder) {
    const span = document.createElement("span");
    const tones = ["aqua", "amber", "violet", "rose", "emerald"];
    const index = placeholderSessionIndex(placeholder);
    span.className = "pwm-secret";
    span.dataset.pwmTone = tones[index ? (index - 1) % tones.length : 0];
    span.textContent = placeholder;
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    span.setAttribute("aria-label", "LeakGuard redacted sensitive content. Open secure reveal in LeakGuard.");

    const activate = (event) => {
      event.preventDefault();
      event.stopPropagation();

      openRevealInExtensionUi(placeholder).catch((error) => {
        debugReveal("reveal:panel-error", {
          placeholder,
          error: error?.message || String(error)
        });
        setBadge("Secure reveal unavailable");
        hideBadgeSoon(2400);
      });
    };

    span.addEventListener("click", activate);
    span.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        activate(event);
      }
    });

    return span;
  }

  function shouldSkipHydration(node) {
    const parent = node.parentElement;
    if (!parent) return true;

    return !!parent.closest(
      ".pwm-modal-backdrop, .pwm-secret, form, textarea, [role='textbox'], [contenteditable='true']"
    );
  }

  function tokenizePlaceholderText(text) {
    const input = normalizeVisiblePlaceholders(text);
    const segments = [];
    let lastIndex = 0;
    let match;
    const regex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");

    while ((match = regex.exec(input)) !== null) {
      const placeholder = match[0];

      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          value: input.slice(lastIndex, match.index)
        });
      }

      if (shouldHydratePlaceholder(placeholder)) {
        segments.push({
          type: "secret",
          placeholder
        });
      } else {
        segments.push({
          type: "text",
          value: placeholder
        });
      }

      lastIndex = match.index + placeholder.length;
    }

    if (lastIndex < input.length) {
      segments.push({
        type: "text",
        value: input.slice(lastIndex)
      });
    }

    return segments.length ? segments : [{ type: "text", value: input }];
  }

  function placeholderSessionIndex(placeholder) {
    const pwmMatch = /^\[PWM_(\d+)\]$/.exec(String(placeholder || ""));
    if (pwmMatch) {
      return Number(pwmMatch[1]);
    }

    const semanticMatch = /^\[(?:NET_(\d+)|PUB_HOST_(\d+))(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?\]$/.exec(
      String(placeholder || "")
    );

    if (!semanticMatch) {
      return null;
    }

    return Number(semanticMatch[1] || semanticMatch[2] || 0);
  }

  function shouldHydratePlaceholder(placeholder) {
    const count = Number(currentPublicState.placeholderCount || 0);
    const index = placeholderSessionIndex(placeholder);

    if (!count || !Number.isFinite(index)) {
      return false;
    }

    return index >= 1 && index <= count;
  }

  function hydrateTextNode(node) {
    const text = node.nodeValue;
    const normalizedText = normalizeVisiblePlaceholders(text);
    if (!normalizedText || !PLACEHOLDER_TOKEN_REGEX.test(normalizedText)) return;
    PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
    if (shouldSkipHydration(node)) return;

    const parent = node.parentElement;
    if (!parent) return;

    const segments = tokenizePlaceholderText(normalizedText);
    if (segments.length === 1 && segments[0].type === "text") return;

    debugReveal("rehydrate:text-node", {
      parentTag: parent.tagName,
      placeholderCount: segments.filter((segment) => segment.type === "secret").length
    });

    const fragment = document.createDocumentFragment();

    for (const segment of segments) {
      if (segment.type === "text") {
        fragment.appendChild(document.createTextNode(segment.value));
      } else {
        fragment.appendChild(createSecretSpan(segment.placeholder));
      }
    }

    parent.replaceChild(fragment, node);
  }

  function rehydrateTree(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      hydrateTextNode(root);
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const normalizedText = normalizeVisiblePlaceholders(node.nodeValue || "");
      if (normalizedText && PLACEHOLDER_TOKEN_REGEX.test(normalizedText)) {
        nodes.push(node);
      }
      PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
    }

    nodes.forEach(hydrateTextNode);
  }

  function startRehydrationObserver() {
    if (rehydrateObserver || !document.body) return;

    rehydrateObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target?.nodeType === Node.TEXT_NODE) {
          const normalizedText = normalizeVisiblePlaceholders(mutation.target.nodeValue || "");
          debugReveal("rehydrate:character-data", {
            parentTag: mutation.target.parentElement?.tagName || null,
            containsPlaceholder: PLACEHOLDER_TOKEN_REGEX.test(normalizedText)
          });
          PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
          hydrateTextNode(mutation.target);
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            hydrateTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const normalizedText = normalizeVisiblePlaceholders(node.textContent || "");
            const containsPlaceholder = PLACEHOLDER_TOKEN_REGEX.test(normalizedText);
            debugReveal("rehydrate:element-added", {
              tagName: node.tagName,
              containsPlaceholder
            });
            PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
            if (!containsPlaceholder) return;
            rehydrateTree(node);
          }
        });
      }
    });

    rehydrateObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });

    rehydrateTree(document.body);
  }

  async function handleUrlChange() {
    if (location.href === currentUrl) return;

    currentUrl = location.href;
    clearPendingGeminiGhostIngressClickInterceptor("navigation");
    clearPendingGeminiSanitizedFileHandoff("navigation");
    clearAllRiskSessionState();
    await initState();
    rehydrateTree(document.body);
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
    startRehydrationObserver();
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
