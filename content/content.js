(function () {
  const {
    Detector,
    PLACEHOLDER_TOKEN_REGEX,
    normalizeVisiblePlaceholders,
    buildNetworkUiFindings,
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
    sessionId: null,
    urlKey: "",
    transformMode: "hide_public",
    placeholderCount: 0,
    knownPlaceholders: []
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
  const REVEAL_WINDOW_NAME = "pwm-secure-reveal";
  const PROGRAMMATIC_INPUT_SUPPRESS_MS = 500;

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

  async function initState() {
    const response = await chrome.runtime.sendMessage({
      type: "PWM_INIT_TAB",
      url: location.href
    });

    if (response?.ok && response.state) {
      currentPublicState = response.state;
    }
  }

  async function requestRedaction(text, findings) {
    const response = await chrome.runtime.sendMessage({
      type: "PWM_REDACT_TEXT",
      url: location.href,
      text,
      findings
    });

    if (!response?.ok || !response?.result) {
      throw new Error(response?.error || "Portable Work Memory could not redact this content.");
    }

    if (response.state) {
      currentPublicState = response.state;
    }

    return response.result;
  }

  async function createRevealRequest(placeholder) {
    const response = await chrome.runtime.sendMessage({
      type: "PWM_CREATE_REVEAL_REQUEST",
      placeholder
    });

    if (!response?.ok || !response?.requestId) {
      throw new Error(response?.error || "Portable Work Memory could not open the secure reveal window.");
    }

    return response.requestId;
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
    const secretFindings = detector.scan(normalizedText).filter((finding) => finding.severity !== "low");
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

  function showDecisionModal(findings, mode) {
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
      title.textContent = "Sensitive content detected";

      const desc = document.createElement("p");
      desc.textContent =
        mode === "paste"
          ? "This pasted content appears to contain sensitive material. Redact it before it reaches the chat input."
          : mode === "input"
            ? "This typed content appears to contain sensitive material. Redact it before it sits in the chat input."
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
        if (active === allowBtn) return "allow";
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

      actions.append(cancelBtn, allowBtn, redactBtn);
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

      const finish = () => {
        window.removeEventListener("keydown", onKeyDown, true);
        closeModal(backdrop);
        resolve();
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault();
          finish();
        }
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
        ? "Portable Work Memory blocked send because it could not verify the rewritten composer content safely."
        : "Portable Work Memory blocked the action because it could not verify the rewritten composer content safely.";

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
    if (modalOpen || !shouldInterceptBeforeInput(event)) return;

    const input = findComposer(event.target);
    if (!input) return;

    const insertedText = getBeforeInputData(event);
    if (!insertedText) return;

    const originalText = getInputText(input);
    const selection = getSelectionOffsets(input);
    const next = spliceSelectionText(originalText, selection, insertedText);
    const currentAnalysis = analyzeText(originalText);
    const nextAnalysis = analyzeText(next.text);
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

    event.preventDefault();
    event.stopPropagation();

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

    const decision = await showDecisionModal(relevantFindings, "input");
    if (decision.action === "cancel") {
      refreshBadgeFromCurrentInput();
      return;
    }

    if (decision.action === "allow") {
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
    if (modalOpen || event.defaultPrevented) return;

    const input = findComposer(event.target);
    if (!input) return;

    const pasted =
      event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "";

    if (!pasted) return;

    const analysis = analyzeText(pasted);
    if (!analysis.findings.length && !analysis.placeholderNormalized) return;

    const originalText = getInputText(input);
    const selection = getSelectionOffsets(input);

    if (!analysis.findings.length) {
      consumeInterceptionEvent(event);

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

    consumeInterceptionEvent(event);

    const decision = await showDecisionModal(analysis.findings, "paste");
    if (decision.action === "cancel") return;

    const latestInput = findComposer(input);
    if (!latestInput) return;

    const latestText = getInputText(latestInput);
    const baseText = latestText === originalText ? latestText : originalText;

    if (decision.action === "allow") {
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
    if (modalOpen) {
      event.preventDefault();
      event.stopPropagation();
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

    const analysis = analyzeText(text);
    if (!analysis.findings.length && !analysis.placeholderNormalized) return;

    event.preventDefault();
    event.stopPropagation();

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

    const decision = await showDecisionModal(analysis.findings, "submit");
    if (decision.action === "cancel") return;

    if (decision.action === "allow") {
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

    const analysis = analyzeText(text);
    if (!analysis.findings.length && !analysis.placeholderNormalized) return;

    event.preventDefault();
    event.stopPropagation();

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
          .catch(console.error);
      });
      return;
    }

    const decision = await showDecisionModal(analysis.findings, "submit");
    if (decision.action === "cancel") return;

    if (decision.action === "allow") {
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
        .catch(console.error);
    });
  }

  async function maybeHandleTypedSecrets() {
    if (modalOpen) return;

    const input = findComposer();
    if (!input) return;

    const text = getInputText(input);
    if (!text || !text.trim()) {
      lastTypedPromptText = "";
      return;
    }

    const analysis = analyzeText(text);
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

    const decision = await showDecisionModal(analysis.findings, "input");
    if (decision.action !== "redact") {
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

  function refreshBadgeFromCurrentInput() {
    const input = findComposer();
    if (!input) return;

    const text = getInputText(input);
    if (!text || !text.trim()) {
      setBadge("");
      return;
    }

    const analysis = analyzeText(text);
    if (!analysis.findings.length) {
      setBadge("");
      return;
    }

    setBadge("Sensitive content detected");
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
      maybeHandleTypedSecrets().catch(console.error);
    }, 220);
  }

  function buildRevealWindowFeatures(anchorRect) {
    const width = 420;
    const height = 340;
    const margin = 12;
    const hostLeft = Number(window.screenX || window.screenLeft || 0);
    const hostTop = Number(window.screenY || window.screenTop || 0);
    const hostWidth = Number(window.outerWidth || window.innerWidth || width);
    const hostHeight = Number(window.outerHeight || window.innerHeight || height);
    const rectLeft = Number(anchorRect?.left || 0);
    const rectTop = Number(anchorRect?.top || 0);
    const rectBottom = Number(anchorRect?.bottom || rectTop);

    let left = hostLeft + rectLeft;
    let top = hostTop + rectBottom + 20;

    const maxLeft = hostLeft + hostWidth - width - margin;
    const maxTop = hostTop + hostHeight - height - margin;

    left = Math.max(hostLeft + margin, Math.min(left, maxLeft));
    top = Math.max(hostTop + margin, Math.min(top, maxTop));

    return [
      "popup=yes",
      "noopener=yes",
      "noreferrer=yes",
      `width=${width}`,
      `height=${height}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`
    ].join(",");
  }

  async function openRevealPanel(placeholder, anchorRect) {
    const requestId = await createRevealRequest(placeholder);
    const revealUrl = chrome.runtime.getURL(
      `ui/reveal_panel.html#request=${encodeURIComponent(requestId)}`
    );
    const revealWindow = window.open(
      revealUrl,
      REVEAL_WINDOW_NAME,
      buildRevealWindowFeatures(anchorRect)
    );

    if (!revealWindow) {
      throw new Error("Portable Work Memory could not open the secure reveal window.");
    }

    try {
      revealWindow.focus();
    } catch {
      // Ignore focus failures for blocked or backgrounded popup windows.
    }

    debugReveal("reveal:window-open", {
      placeholder,
      requestId,
      knownPlaceholderCount: currentPublicState.knownPlaceholders.length
    });
  }

  function createSecretSpan(placeholder) {
    const span = document.createElement("span");
    span.className = "pwm-secret";
    span.textContent = placeholder;
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    span.setAttribute("aria-label", "Redacted sensitive content. Open secure reveal window.");

    const activate = (event) => {
      event.preventDefault();
      event.stopPropagation();

      openRevealPanel(placeholder, span.getBoundingClientRect()).catch((error) => {
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

      segments.push({
        type: "secret",
        placeholder
      });

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
        handleUrlChange().catch(console.error);
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
      handleUrlChange().catch(console.error);
    }, 1500);
  }

  function bindEvents() {
    document.addEventListener(
      "beforeinput",
      (event) => {
        maybeHandleBeforeInput(event).catch(console.error);
      },
      true
    );

    document.addEventListener(
      "paste",
      (event) => {
        maybeHandlePaste(event).catch(console.error);
      },
      true
    );

    document.addEventListener(
      "submit",
      (event) => {
        maybeHandleSubmit(event).catch(console.error);
      },
      true
    );

    document.addEventListener(
      "keydown",
      (event) => {
        maybeHandleFallbackSendKey(event).catch(console.error);
      },
      true
    );

    document.addEventListener("input", scheduleInputScan, true);
  }

  async function boot() {
    await initState();
    bindEvents();
    installNavigationWatchers();
    startRehydrationObserver();
    refreshBadgeFromCurrentInput();
  }

  boot().catch(console.error);
})();
