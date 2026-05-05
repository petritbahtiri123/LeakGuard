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
    "[data-testid*='composer'] textarea",
    "[data-testid*='composer'] [contenteditable='true']",
    "[contenteditable='true'][data-testid='prompt-textarea']",
    "[contenteditable='true'][role='textbox'][data-testid*='prompt']",
    "[contenteditable='true'][role='textbox'][aria-label*='message' i]",
    "main form [contenteditable='true'][role='textbox']",
    "form [contenteditable='true'][role='textbox']",
    "main [contenteditable='true'][role='textbox']",
    "main [contenteditable='true'][aria-label*='message' i]",
    "[contenteditable='true'][aria-label*='message' i]"
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
  let suppressInputScanUntil = 0;
  let statusPanelEl = null;
  let statusPanelCollapsed = false;
  let statusPanelProtectionValueEl = null;
  let statusPanelSiteValueEl = null;
  let statusPanelComposerValueEl = null;
  let statusPanelSessionValueEl = null;
  let extensionRuntimeAvailable = true;
  const sanitizedFileInputHandoffs = new WeakSet();
  const rawFileDropInterceptions = new WeakSet();
  const fileDragEventRoots = new WeakSet();
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
  const GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE =
    "Sanitized content inserted as text because Gemini rejected sanitized file upload.";
  let lastDiscoveredFileInput = null;
  let fileDragDiscoveryCompleted = false;
  let fileDragDiscoveryScheduled = false;
  let fileDragDiscoveryTimer = 0;
  let fileDragSessionResetTimer = 0;
  let fileDragSessionId = 0;
  let fileDragDetectedLogged = false;

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

  function isStrictUnsupportedFileMode() {
    const policy = getActivePolicy();
    return Boolean(
      policy.strictUnsupportedFileBlocking ||
        policy.blockUnsupportedFileUploads ||
        policy.fileUploadMode === "strict"
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
      message: "LeakGuard does not inspect this file type yet. Upload allowed."
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

    if (
      isStrictUnsupportedFileMode() &&
      classifications.some((classification) => classification.kind === "unknown")
    ) {
      return {
        action: "block",
        reason: "unknown_binary_strict",
        files,
        classifications,
        message: "LeakGuard blocked this unsupported file type because strict file handling is enabled."
      };
    }

    return {
      action: "allow",
      reason: "unsupported_file_pass_through",
      files,
      classifications,
      message:
        classifications.find((classification) => classification.message)?.message ||
        "LeakGuard does not inspect this file type yet. Upload allowed."
    };
  }

  function resolveFileDragGuardPolicy(dataTransfer) {
    const policy = resolveLocalFileTransferPolicy(dataTransfer);
    return {
      action: policy.action === "allow" ? "allow" : "block",
      reason: policy.reason || policy.action
    };
  }

  function showUnsupportedFilePassThroughNotice(policy) {
    if (!policy?.message) return;
    setBadge(policy.message);
    hideBadgeSoon(3200);
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
          auditReason: "streaming_file_redaction"
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
      /\n+$/g,
      ""
    );
  }

  function matchesComposerPlan(plan, actualText) {
    if (plan.acceptableTexts.includes(actualText)) {
      return true;
    }

    const normalizedActual = normalizeVerificationText(actualText);
    return plan.acceptableTexts.some(
      (candidate) => normalizeVerificationText(candidate) === normalizedActual
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

    actions.appendChild(manageBtn);
    body.appendChild(actions);

    statusPanelEl.append(header, body);
    document.documentElement.appendChild(statusPanelEl);
    setStatusPanelCollapsed(statusPanelCollapsed);

    return statusPanelEl;
  }

  function updateStatusPanel(snapshot = {}) {
    ensureStatusPanel();

    statusPanelProtectionValueEl.textContent = "Active";
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
      }
    };
  }

  function getActivePolicy() {
    return {
      enterpriseMode: false,
      allowReveal: true,
      allowUserOverride: true,
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
    if (action !== "allow" || policy.allowUserOverride) {
      return action;
    }

    return policy.defaultAction === "redact" ? "redact" : "cancel";
  }

  function getDestinationPolicyDecision(policy) {
    return evaluateDestinationPolicy(policy, location.href);
  }

  function shouldForceDestinationRedaction(decision, findings) {
    return Boolean(decision?.requiresRedaction && (findings || []).length > 0);
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

  async function promptForSensitiveContentDecision(findings, mode, policy) {
    const decision = await showDecisionModal(findings, mode, {
      allowUserOverride: policy.allowUserOverride
    });

    return resolveDecisionAction(decision.action, policy);
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
      auditReason: options.auditReason || null
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

    const closest = node.closest("textarea, [contenteditable='true'], [role='textbox']");
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
    const allowUserOverride = options.allowUserOverride !== false;

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
          ? "This pasted content appears to contain sensitive material. Redact it before it reaches the chat input."
          : mode === "input"
            ? "This typed content may contain sensitive material. High-confidence detections auto-redact; review this one before it sits in the chat input."
          : "This message appears to contain sensitive material. Redact it before sending.";

      const findingsWrap = document.createElement("div");
      findingsWrap.className = "pwm-findings";
      findings.slice(0, 8).forEach(() => appendFindingRow(findingsWrap));

      const actions = document.createElement("div");
      actions.className = "pwm-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "pwm-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";

      const allowBtn = document.createElement("button");
      allowBtn.className = "pwm-btn";
      allowBtn.type = "button";
      allowBtn.textContent = "Allow once";

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
        if (allowUserOverride && active === allowBtn) return "allow";
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
      allowBtn.addEventListener("click", () => finish({ action: "allow" }));
      redactBtn.addEventListener("click", () => finish({ action: "redact" }));

      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          finish({ action: "cancel" });
        }
      });

      actions.append(cancelBtn);
      if (allowUserOverride) {
        actions.appendChild(allowBtn);
      }
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

  async function applyComposerText(input, expectedText, options = {}) {
    const plan = buildComposerWritePlan(input, expectedText);
    const expected = plan.canonical;
    const writeText = plan.writeText;

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
    if (form && typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }

    const button = findSendButton(input);
    if (button) {
      button.click();
    }
  }

  async function applyPasteDecision(input, originalText, selection, insertedText, context) {
    const next = spliceSelectionText(originalText, selection, insertedText);
    const applied = await applyComposerText(input, next.text, {
      caretOffset: next.caretOffset,
      restoreText: originalText,
      restoreCaretOffset: selection?.end
    });

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
    if (!extensionRuntimeAvailable || modalOpen || !shouldInterceptBeforeInput(event)) return;

    const input = findComposer(event.target);
    if (!input) return;

    const insertedText = getBeforeInputData(event);
    if (!insertedText) return;

    const originalText = getInputText(input);
    const selection = getSelectionOffsets(input);
    const next = spliceSelectionText(originalText, selection, insertedText);
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

    consumeInterceptionEvent(event);

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

    const decisionAction = await promptForSensitiveContentDecision(relevantFindings, "input", policy);
    if (decisionAction === "cancel") {
      refreshBadgeFromCurrentInput();
      return;
    }

    if (decisionAction === "allow") {
      const ok = await applyTypedInterceptionRewrite(
        input,
        nextAnalysis.normalizedText,
        originalText,
        selection,
        "input"
      );

      if (!ok) return;

      lastTypedPromptText = nextAnalysis.normalizedText;
      setBadge("Redaction skipped once");
      hideBadgeSoon();
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

    if (typeof dataTransferHasFiles === "function" && dataTransferHasFiles(event.clipboardData)) {
      await maybeHandleLocalFileInsert(event, input, event.clipboardData, "paste");
      return;
    }

    const pasted =
      event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "";

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
        "paste"
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
        "paste"
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
        "paste"
      );

      if (!ok) return;

      setBadge("Destination policy required redaction");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    const decisionAction = await promptForSensitiveContentDecision(analysis.findings, "paste", policy);
    if (decisionAction === "cancel") return;

    const latestInput = findComposer(input);
    if (!latestInput) return;

    const latestText = getInputText(latestInput);
    const baseText = latestText === originalText ? latestText : originalText;

    if (decisionAction === "allow") {
      const ok = await applyPasteDecision(
        latestInput,
        baseText,
        selection,
        analysis.normalizedText,
        "paste"
      );
      if (!ok) return;

      setBadge("Redaction skipped once");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);

    const ok = await applyPasteDecision(
      latestInput,
      baseText,
      selection,
      result.redactedText,
      "paste"
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
    if (!sanitizedFile || typeof DataTransfer !== "function") {
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

  function isChatGptHost() {
    return location.hostname === "chatgpt.com" || location.hostname === "chat.openai.com";
  }

  function isGeminiHost() {
    return location.hostname === "gemini.google.com";
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

      if (sanitizedFile && handOffSanitizedLocalFile(event, input, sanitizedFile, "paste")) {
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
    return el.closest(".ql-editor") || el.closest('[contenteditable="true"]');
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

  function insertLargeGeminiEditorText(editor, sanitizedText) {
    const text = String(sanitizedText || "");
    if (!editor || typeof editor.focus !== "function") return false;

    const originalText = getInputText(editor);
    const selection = getSelectionOffsets(editor);
    const next = spliceSelectionText(originalText, selection, text);

    suppressFollowupInputScan(GEMINI_LARGE_TEXT_SUPPRESS_MS);
    editor.focus();
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

  function insertGeminiEditorText(editor, sanitizedText) {
    const text = String(sanitizedText || "");
    if (!editor || typeof editor.focus !== "function") return false;

    if (text.length >= GEMINI_DIRECT_TEXT_INSERT_THRESHOLD) {
      return insertLargeGeminiEditorText(editor, text);
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
    if (
      !applyOptions.skipLargeConfirmation &&
      !(await confirmGeminiLargeSanitizedTextInsertion(sanitizedText, context))
    ) {
      setBadge("Sanitized text insertion cancelled");
      hideBadgeSoon(3200);
      refreshBadgeFromCurrentInput();
      return "cancelled";
    }

    if (insertGeminiEditorText(editor, sanitizedText)) {
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
      context
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
      const sanitizedText = await redactGeminiEditorText(pasted);
      const applied = await applyGeminiEditorText(editor, sanitizedText, "gemini-paste");
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
        message: "This release safely redacts text-based files only. PDF/DOCX/image redaction is planned but not enabled yet."
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
    const editor = resolveGeminiEditorTarget(event?.target);
    if (!editor) return false;

    const files = listLocalTransferFiles(event.dataTransfer);
    if (files.length !== 1 || !isSupportedGeminiTextFile(files[0])) {
      return false;
    }

    consumeInterceptionEvent(event);
    const localFile =
      typeof readLocalTextFileFromDataTransfer === "function"
        ? await readLocalTextFileFromDataTransfer(event.dataTransfer)
        : await readGeminiTextFile(files[0]);
    if (!localFile.ok) {
      if (localFile.code === "streaming_required" && localFile.sourceFile) {
        const streamResult = await streamRedactLocalTextFile(localFile.sourceFile, localFile.file);
        if (streamResult.action === "redacted" && streamResult.sanitizedFile) {
          const handedOff = handOffGeminiSanitizedFileUpload(event, editor, streamResult.sanitizedFile);
          if (handedOff) {
            setBadge("LeakGuard attached a sanitized local file.");
            hideBadgeSoon(3200);
            refreshBadgeFromCurrentInput();
            return true;
          }
        }

        return blockGeminiEditorRawContent(
          event,
          streamResult.title || "Raw file upload blocked",
          streamResult.error || "LeakGuard blocked raw file upload because sanitized streaming handoff failed."
        );
      }

      return blockGeminiEditorRawContent(
        event,
        "Raw file upload blocked",
        localFile.message || "LeakGuard could not read this local file, so nothing was attached."
      );
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

    try {
      const sanitizedText = await redactGeminiEditorText(localFile.text);
      const applied = await applyGeminiEditorText(editor, sanitizedText, "gemini-drop");
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
    return blockGeminiEditorRawContent(
      event,
      "Raw file upload blocked",
      "LeakGuard blocked raw file upload because sanitized insertion failed."
    );
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
      source,
      disabled: Boolean(fileInput.disabled),
      hidden: Boolean(fileInput.hidden),
      accept: fileInput.accept || "",
      multiple: Boolean(fileInput.multiple),
      filesLength: Number(fileInput.files?.length || 0)
    };
  }

  function clearFileDragSession() {
    fileDragSessionId += 1;
    lastDiscoveredFileInput = null;
    fileDragDiscoveryCompleted = false;
    fileDragDiscoveryScheduled = false;
    fileDragDetectedLogged = false;

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
    if (isGeminiHost()) {
      return;
    }

    scheduleFileDragSessionReset();
    if (!fileDragDetectedLogged) {
      fileDragDetectedLogged = true;
      debugReveal("file-drag:detected", {
        type: event?.type || "",
        targetTag: normalizeTarget(event?.target)?.tagName || ""
      });
    }
    scheduleFileInputDiscovery(event);
  }

  function handOffSanitizedFileInput(fileInput, transfer) {
    if (!isFileInputElement(fileInput) || !transfer?.files) return false;

    try {
      sanitizedFileInputHandoffs.add(fileInput);
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(
        new Event("input", {
          bubbles: true,
          cancelable: true
        })
      );
      fileInput.dispatchEvent(
        new Event("change", {
          bubbles: true,
          cancelable: true
        })
      );
      debugReveal("file-handoff:assignment-success", {
        input: describeFileInputForDebug(fileInput, "resolved"),
        files: Array.from(fileInput.files || []).map(describeFileForDebug),
        events: ["input", "change"]
      });
      return true;
    } catch {
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

  function handOffSanitizedLocalFile(event, input, sanitizedFile, context) {
    const transfer = createSanitizedDataTransfer(sanitizedFile);
    if (!transfer) {
      debugReveal("file-handoff:data-transfer-create-failed", {
        context,
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      return false;
    }

    if (context === "file-input") {
      return handOffSanitizedFileInput(event?.target, transfer);
    }

    const target = event?.target || input;
    if (context === "drop") {
      if (isGeminiHost()) {
        debugReveal("file-handoff:gemini-file-upload-skipped", {
          context,
          targetTag: event?.target?.tagName || "",
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return false;
      }

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

  function handOffGeminiSanitizedFileUpload(event, input, sanitizedFile) {
    if (!isGeminiHost()) return false;

    const transfer = createSanitizedDataTransfer(sanitizedFile);
    if (!transfer) {
      debugReveal("file-handoff:gemini-data-transfer-create-failed", {
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      return false;
    }

    const fileInput = resolveFileInputForHandoff(event, input);
    if (!fileInput) {
      debugReveal("file-handoff:gemini-input-not-found", {
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      return false;
    }

    return handOffSanitizedFileInput(fileInput, transfer);
  }

  async function applyGeminiSanitizedTextFallback(event, input, redactedText) {
    if (!isGeminiHost()) {
      return false;
    }

    if (!(await confirmGeminiLargeSanitizedTextInsertion(redactedText, "file-text-fallback"))) {
      setBadge("Sanitized text insertion cancelled");
      hideBadgeSoon(3200);
      refreshBadgeFromCurrentInput();
      return "cancelled";
    }

    const editor = resolveGeminiEditorTarget(event?.target) || resolveGeminiEditorTarget(input);
    if (editor) {
      const inserted = await applyGeminiEditorText(
        editor,
        String(redactedText || ""),
        "file-text-fallback",
        { skipLargeConfirmation: true }
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
      "file-text-fallback"
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

  async function insertGeminiLocalFileText(event, input, redactedText) {
    if (!isGeminiHost()) {
      return false;
    }

    if (!(await confirmGeminiLargeSanitizedTextInsertion(redactedText, "gemini-file-text"))) {
      setBadge("Sanitized text insertion cancelled");
      hideBadgeSoon(3200);
      refreshBadgeFromCurrentInput();
      return "cancelled";
    }

    const editor = resolveGeminiEditorTarget(event?.target) || resolveGeminiEditorTarget(input);
    if (editor) {
      return applyGeminiEditorText(editor, String(redactedText || ""), "gemini-file-text", {
        skipLargeConfirmation: true
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
      "gemini-file-text"
    );
  }

  async function maybeHandleLocalFileInsert(event, input, dataTransfer, context) {
    if (
      !extensionRuntimeAvailable ||
      modalOpen ||
      (event.defaultPrevented && context !== "drop") ||
      typeof readLocalTextFileFromDataTransfer !== "function" ||
      typeof createSanitizedTextFile !== "function" ||
      !dataTransferHasFiles(dataTransfer)
    ) {
      return false;
    }

    const transferPolicy = resolveLocalFileTransferPolicy(dataTransfer);
    if (transferPolicy.action === "allow") {
      showUnsupportedFilePassThroughNotice(transferPolicy);
      return false;
    }

    if (transferPolicy.action === "block") {
      consumeInterceptionEvent(event);
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

    consumeInterceptionEvent(event);

    const localFile = await readLocalTextFileFromDataTransfer(dataTransfer);
    if (event?.target?.tagName === "INPUT" && String(event.target.type || "").toLowerCase() === "file") {
      event.target.value = "";
    }
    if (!localFile.handled) return false;

    if (!localFile.ok) {
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

        const handedOff =
          context === "drop" && isGeminiHost()
            ? handOffGeminiSanitizedFileUpload(event, input, streamResult.sanitizedFile)
            : handOffSanitizedLocalFile(event, input, streamResult.sanitizedFile, context);
        if (handedOff) {
          setBadge("LeakGuard attached a sanitized local file.");
          hideBadgeSoon(3200);
          refreshBadgeFromCurrentInput();
          return {
            handled: true,
            ok: true,
            strategy: "streaming-sanitized-file-handoff"
          };
        }

        return blockStreamingLocalFile(
          event,
          "Raw file upload blocked",
          "LeakGuard blocked raw file upload. Sanitized streaming file handoff failed."
        );
      }

      if (localFile.code === "file_too_large") {
        setBadge(STREAMING_BLOCK_TITLE);
        hideBadgeSoon(4200);
        await showMessageModal(STREAMING_BLOCK_TITLE, localFile.message || STREAMING_BLOCK_MESSAGE);
      } else {
        setBadge("Local file not attached");
        hideBadgeSoon(3200);
        await showMessageModal("Local file not attached", localFile.message);
      }
      refreshBadgeFromCurrentInput();
      return true;
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

    const analysis = analyzeText(localFile.text);
    const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);

    if (context === "drop" && isGeminiHost()) {
      const geminiTextResult = await insertGeminiLocalFileText(event, input, result.redactedText);
      if (geminiTextResult === true) {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "complete");
        }
        setBadge("Sanitized content inserted as text");
        hideBadgeSoon(4200);
        refreshBadgeFromCurrentInput();
        return {
          handled: true,
          ok: true,
          strategy: "gemini-direct-text"
        };
      }

      if (geminiTextResult === "cancelled") {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "cancelled");
        }
        return {
          handled: true,
          ok: false,
          reason: "gemini_large_text_cancelled"
        };
      }

      if (optimizedStatus) {
        clearLocalPayloadOptimizationStatus(sizeInfo, "failed");
      }
      setBadge("Raw file upload blocked");
      hideBadgeSoon(4200);
      await showMessageModal(
        "Raw file upload blocked",
        "LeakGuard blocked raw file upload because sanitized text insertion failed."
      );
      refreshBadgeFromCurrentInput();
      return {
        handled: true,
        ok: false,
        reason: "gemini_direct_text_failed"
      };
    }

    const sanitizedFile = createSanitizedTextFile(localFile.file, result.redactedText);
    debugReveal("file-handoff:sanitized-file-created", {
      context,
      originalFile: describeFileForDebug(localFile.file),
      sanitizedFile: describeFileForDebug(sanitizedFile),
      findingsCount: analysis.secretFindings.length,
      redactedLength: result.redactedText.length
    });
    const handedOff = handOffSanitizedLocalFile(event, input, sanitizedFile, context);

    if (!handedOff) {
      const fallbackResult = await applyGeminiSanitizedTextFallback(event, input, result.redactedText);
      if (fallbackResult === true) {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "complete");
        }
        return {
          handled: true,
          ok: true,
          strategy: "gemini-sanitized-text-fallback"
        };
      }

      if (fallbackResult === "cancelled") {
        if (optimizedStatus) {
          clearLocalPayloadOptimizationStatus(sizeInfo, "cancelled");
        }
        return {
          handled: true,
          ok: false,
          reason: "gemini_large_text_cancelled"
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
    setBadge("LeakGuard attached a sanitized local file.");
    hideBadgeSoon(3200);
    refreshBadgeFromCurrentInput();
    return {
      handled: true,
      ok: true,
      strategy: "sanitized-file-handoff"
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

    const transferPolicy = resolveLocalFileTransferPolicy(event.dataTransfer);
    if (transferPolicy.action === "allow") {
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

    if (!extensionRuntimeAvailable || modalOpen) {
      clearFileDragSession();
      return;
    }

    try {
      if (await maybeHandleGeminiEditorDrop(event)) {
        return;
      }

      handleFileDragDetected(event);
      const input = findComposer(event.target) || findComposer(document.activeElement);
      await maybeHandleLocalFileInsert(event, input, event.dataTransfer, "drop");
    } finally {
      clearFileDragSession();
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

    if (!isGeminiHost()) {
      handleFileDragDetected(event);
    }

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
      typeof dataTransferHasFiles !== "function" ||
      !dataTransferHasFiles({ files: event.target.files, types: ["Files"], items: [] })
    ) {
      return;
    }

    if (sanitizedFileInputHandoffs.has(event.target)) {
      sanitizedFileInputHandoffs.delete(event.target);
      return;
    }

    const input = findComposer(event.target);
    if (!input) return;

    await maybeHandleLocalFileInsert(
      event,
      input,
      {
        files: Array.from(event.target.files || []),
        types: ["Files"],
        items: []
      },
      "file-input"
    );
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

    const decisionAction = await promptForSensitiveContentDecision(analysis.findings, "submit", policy);
    if (decisionAction === "cancel") return;

    if (decisionAction === "allow") {
      if (analysis.placeholderNormalized) {
        const rewritten = await applyNormalizedComposerRewrite(input, text, "submit");
        if (!rewritten.ok) {
          await showRewriteFailure(
            "submit",
            collectFailureDetails(input, rewritten.text, getInputText(input), "submit")
          );
          refreshBadgeFromCurrentInput();
          return;
        }

        if (!(await ensureExactComposerState(input, rewritten.text))) {
          await showRewriteFailure(
            "submit",
            collectFailureDetails(input, rewritten.text, getInputText(input), "submit")
          );
          refreshBadgeFromCurrentInput();
          return;
        }
      }

      bypassNextSubmit = true;
      submitComposer(form, input);
      return;
    }

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
            if (button) button.click();
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
            if (button) button.click();
            return null;
          })
          .catch(handleContentError);
      });
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
            if (button) button.click();
            return null;
          })
          .catch(handleContentError);
      });
      return;
    }

    const decisionAction = await promptForSensitiveContentDecision(analysis.findings, "submit", policy);
    if (decisionAction === "cancel") return;

    if (decisionAction === "allow") {
      if (analysis.placeholderNormalized) {
        const rewritten = await applyNormalizedComposerRewrite(input, text, "submit");
        if (!rewritten.ok) return;
      }

      const button = findSendButton(input);
      if (button) button.click();
      return;
    }

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
          if (button) button.click();
          return null;
        })
        .catch(handleContentError);
    });
  }

  async function maybeHandleTypedSecrets() {
    if (!extensionRuntimeAvailable || modalOpen) return;

    const input = findComposer();
    if (!input) return;

    const text = getInputText(input);
    if (!text || !text.trim()) {
      lastTypedPromptText = "";
      return;
    }

    const analysis = await analyzeTextWithAiAssist(text);
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

    if (typedShouldAutoRedact) {
      const latestInput = findComposer(input);
      if (!latestInput) return;

      const latestText = getInputText(latestInput);
      if (latestText !== text) {
        refreshBadgeFromCurrentInput();
        return;
      }

      const result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);

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

    const decisionAction = await promptForSensitiveContentDecision(analysis.findings, "input", policy);
    if (decisionAction !== "redact") {
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
    span.className = "pwm-secret";
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
