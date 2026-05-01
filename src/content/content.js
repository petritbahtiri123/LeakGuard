(function () {
  if (globalThis.__PWM_CONTENT_BOOTSTRAPPED__) {
    return;
  }
  globalThis.__PWM_CONTENT_BOOTSTRAPPED__ = true;
  const ext = globalThis.PWM?.ext || globalThis.browser || globalThis.chrome;

  const {
    Detector,
    PLACEHOLDER_TOKEN_REGEX,
    normalizeVisiblePlaceholders,
    buildNetworkUiFindings,
    evaluateDestinationPolicy,
    ComposerHelpers
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
    forceRewriteInputText
  } = ComposerHelpers;

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
  const PROGRAMMATIC_INPUT_SUPPRESS_MS = 500;

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

  function suppressFollowupInputScan() {
    suppressInputScanUntil = Date.now() + PROGRAMMATIC_INPUT_SUPPRESS_MS;
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

    const input = findComposer(event.target);
    if (!input) return;

    const pasted =
      event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "";

    if (!pasted) return;

    const quickAnalysis = analyzeText(pasted);
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
            debugReveal("rehydrate:element-added", {
              tagName: node.tagName,
              containsPlaceholder: PLACEHOLDER_TOKEN_REGEX.test(normalizedText)
            });
            PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
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

  async function boot() {
    await initState();
    ensureStatusPanel();
    bindEvents();
    installNavigationWatchers();
    startRehydrationObserver();
    refreshBadgeFromCurrentInput();
  }

  boot().catch(handleContentError);
})();
