(function () {
  const { Detector, PlaceholderManager, Redactor, ComposerHelpers } = globalThis.PWM;
  const {
    normalizeComposerText,
    normalizeEditorInnerText,
    isTextArea,
    isContentEditable,
    getInputText,
    getSelectionOffsets,
    spliceSelectionText,
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
  const PLACEHOLDER_TOKEN_REGEX = /\[[A-Z0-9_]+_\d+\]/g;

  const manager = new PlaceholderManager();
  const redactor = new Redactor(manager);

  let currentUrl = location.href;
  let badgeEl = null;
  let lastBadgeText = "";
  let badgeHideTimer = 0;
  let bypassNextSubmit = false;
  let inputScanTimer = 0;
  let rehydrateObserver = null;
  let modalOpen = false;
  let lastTypedPromptText = "";

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

  function collectComposerDebugSnapshot(input, expected, writeText) {
    const actual = getInputText(input);
    const normalizedExpected = normalizeComposerText(expected);
    const normalizedWriteText =
      typeof writeText === "string" ? normalizeComposerText(writeText) : normalizedExpected;
    const rawInnerText = normalizeComposerText(input?.innerText || "");
    const normalizedInnerText = normalizeEditorInnerText(input?.innerText || "");
    return {
      expected: normalizedExpected,
      writeText: normalizedWriteText,
      getInputText: actual,
      innerText: rawInnerText,
      normalizedInnerText,
      textContent: normalizeComposerText(input?.textContent || ""),
      innerHTML: input?.innerHTML || "",
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
      expected: normalizeComposerText(expectedText),
      actual: normalizeComposerText(actualText),
      innerText: normalizeComposerText(input?.innerText || ""),
      normalizedInnerText: normalizeEditorInnerText(input?.innerText || ""),
      textContent: normalizeComposerText(input?.textContent || ""),
      innerHTML: input?.innerHTML || ""
    };
  }

  function logFailureDetails(details) {
    console.group("[PWM] rewrite verification failure");
    console.log(details);
    console.groupEnd();
  }

  function buildComposerWritePlan(input, text) {
    const canonical = normalizeComposerText(text);
    return {
      canonical,
      writeText: canonical,
      acceptableTexts: [canonical]
    };
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
      manager.setState(response.state);
    }
  }

  async function persistState() {
    return chrome.runtime.sendMessage({
      type: "PWM_SET_STATE",
      url: location.href,
      state: manager.exportState()
    });
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

  function mask(raw) {
    if (!raw) return "";
    if (raw.length <= 8) return "••••••••";
    return `${raw.slice(0, 4)}••••${raw.slice(-2)}`;
  }

  function getFindings(text) {
    if (!text || !text.trim()) return [];
    const detector = new Detector();
    return detector.scan(text).filter((finding) => finding.severity !== "low");
  }

  function summarizeFindings(findings) {
    const counts = {};

    for (const finding of findings) {
      counts[finding.type] = (counts[finding.type] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([type, count]) => `${type} ×${count}`)
      .join(", ");
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

  function appendFindingRow(container, finding) {
    const row = document.createElement("div");
    row.className = "pwm-finding";

    const title = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = finding.type;
    const score = document.createElement("span");
    score.textContent = `score ${finding.score}`;
    title.append(strong, score);

    const raw = document.createElement("div");
    raw.style.marginTop = "6px";
    raw.style.color = "#cbd5e1";
    raw.style.fontFamily = "ui-monospace, monospace";
    raw.textContent = mask(finding.raw);

    row.append(title, raw);
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
      title.textContent = "Potential secrets detected";

      const desc = document.createElement("p");
      desc.textContent =
        mode === "paste"
          ? "This pasted content appears to contain credentials or secrets. Redact before it reaches the chat input."
          : mode === "input"
            ? "This typed content appears to contain credentials or secrets. Redact it before it sits in the chat input."
          : "This message appears to contain credentials or secrets. Redact before sending it.";

      const findingsWrap = document.createElement("div");
      findingsWrap.className = "pwm-findings";
      findings.slice(0, 8).forEach((finding) => appendFindingRow(findingsWrap, finding));

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
        closeModal(backdrop);
        resolve(result);
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish({ action: "cancel" });
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
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  function verifyPlaceholderConsistency(result) {
    const rawToPlaceholder = new Map();
    const placeholderToRawByType = new Map();

    for (const replacement of result?.replacements || []) {
      if (!replacement?.placeholder || !replacement?.raw || !replacement?.type) {
        return {
          ok: false,
          error: "Redaction output was incomplete."
        };
      }

      if (!result.redactedText.includes(replacement.placeholder)) {
        return {
          ok: false,
          error: "A generated placeholder was missing from the redacted text."
        };
      }

      const previousPlaceholder = rawToPlaceholder.get(replacement.raw);
      if (previousPlaceholder && previousPlaceholder !== replacement.placeholder) {
        return {
          ok: false,
          error: "The same secret mapped to multiple placeholders."
        };
      }

      rawToPlaceholder.set(replacement.raw, replacement.placeholder);

      const typeMap =
        placeholderToRawByType.get(replacement.type) || new Map();
      const previousRaw = typeMap.get(replacement.placeholder);

      if (previousRaw && previousRaw !== replacement.raw) {
        return {
          ok: false,
          error: "Different secrets of the same type reused one placeholder."
        };
      }

      typeMap.set(replacement.placeholder, replacement.raw);
      placeholderToRawByType.set(replacement.type, typeMap);
    }

    return { ok: true };
  }

  async function showRewriteFailure(context, details) {
    const message =
      context === "submit"
        ? "Portable Work Memory blocked send because it could not verify the rewritten composer content."
        : "Portable Work Memory blocked the paste because it could not verify the rewritten composer content.";

    setBadge("Rewrite mismatch blocked");
    hideBadgeSoon(3200);
    if (details) {
      logFailureDetails(details);
    }

    const lines = [
      `${message} Nothing was submitted. Review the composer and retry.`
    ];

    if (details) {
      lines.push("");
      lines.push(`Expected: ${JSON.stringify(details.expected)}`);
      lines.push(`Actual: ${JSON.stringify(details.actual)}`);
      lines.push(`innerText: ${JSON.stringify(details.innerText)}`);
      lines.push(`normalizedInnerText: ${JSON.stringify(details.normalizedInnerText)}`);
      lines.push(`textContent: ${JSON.stringify(details.textContent)}`);
    }

    await showMessageModal(
      "Rewrite verification failed",
      lines.join("\n")
    );
  }

  async function applyComposerText(input, expectedText, options = {}) {
    const plan = buildComposerWritePlan(input, expectedText);
    const expected = plan.canonical;
    const writeText = plan.writeText;

    setInputText(input, writeText, {
      caretOffset: options.caretOffset
    });
    await settleComposer();
    debugLogSnapshot("rewrite:block-rewrite", input, expected, writeText);

    let actual = getInputText(input);
    if (plan.acceptableTexts.includes(actual)) {
      return { ok: true, actual, strategy: "block-rewrite" };
    }

    if (typeof options.restoreText === "string") {
      forceRewriteInputText(input, options.restoreText, {
        caretOffset: options.restoreCaretOffset
      });
      await settleComposer();
    }

    return {
      ok: false,
      actual
    };
  }

  function ensureExactComposerState(input, expectedText) {
    const plan = buildComposerWritePlan(input, expectedText);
    const actual = getInputText(input);
    debugLogSnapshot("pre-submit-check", input, plan.canonical, plan.writeText);
    return plan.acceptableTexts.includes(actual);
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

  async function maybeHandlePaste(event) {
    if (modalOpen || event.defaultPrevented) return;

    const input = findComposer(event.target);
    if (!input) return;

    const pasted =
      event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "";

    if (!pasted) return;

    const findings = getFindings(pasted);
    if (!findings.length) return;

    const originalText = getInputText(input);
    const selection = getSelectionOffsets(input);

    event.preventDefault();

    const decision = await showDecisionModal(findings, "paste");
    if (decision.action === "cancel") return;

    if (decision.action === "allow") {
      const ok = await applyPasteDecision(input, originalText, selection, pasted, "paste");
      if (!ok) return;

      setBadge("Allowed once");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    const result = redactor.redact(pasted, findings);
    const placeholderCheck = verifyPlaceholderConsistency(result);

    if (!placeholderCheck.ok) {
      await showMessageModal("Redaction blocked", placeholderCheck.error);
      return;
    }

    const ok = await applyPasteDecision(
      input,
      originalText,
      selection,
      result.redactedText,
      "paste"
    );

    if (!ok) return;

    await persistState();

    setBadge(`Redacted ${findings.length} item(s)`);
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

    const findings = getFindings(text);
    if (!findings.length) return;

    event.preventDefault();
    event.stopPropagation();

    const decision = await showDecisionModal(findings, "submit");
    if (decision.action === "cancel") return;

    if (decision.action === "allow") {
      bypassNextSubmit = true;
      submitComposer(form, input);
      return;
    }

    const result = redactor.redact(text, findings);
    const placeholderCheck = verifyPlaceholderConsistency(result);

    if (!placeholderCheck.ok) {
      await showMessageModal("Redaction blocked", placeholderCheck.error);
      return;
    }

    const applied = await applyComposerText(input, result.redactedText, {
      caretOffset: result.redactedText.length,
      restoreText: text,
      restoreCaretOffset: text.length
    });

    if (!applied.ok) {
      await showRewriteFailure(
        "submit",
        collectFailureDetails(input, result.redactedText, applied.actual, "submit")
      );
      refreshBadgeFromCurrentInput();
      return;
    }

    await persistState();

    setBadge(`Redacted ${findings.length} item(s)`);
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();

    if (!ensureExactComposerState(input, result.redactedText)) {
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

    const findings = getFindings(text);
    if (!findings.length) return;

    event.preventDefault();
    event.stopPropagation();

    const decision = await showDecisionModal(findings, "submit");
    if (decision.action === "cancel") return;

    if (decision.action === "allow") {
      const button = findSendButton(input);
      if (button) button.click();
      return;
    }

    const result = redactor.redact(text, findings);
    const placeholderCheck = verifyPlaceholderConsistency(result);

    if (!placeholderCheck.ok) {
      await showMessageModal("Redaction blocked", placeholderCheck.error);
      return;
    }

    const applied = await applyComposerText(input, result.redactedText, {
      caretOffset: result.redactedText.length,
      restoreText: text,
      restoreCaretOffset: text.length
    });

    if (!applied.ok) {
      await showRewriteFailure(
        "submit",
        collectFailureDetails(input, result.redactedText, applied.actual, "submit")
      );
      refreshBadgeFromCurrentInput();
      return;
    }

    await persistState();

    setBadge(`Redacted ${findings.length} item(s)`);
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();

    queueMicrotask(() => {
      if (!ensureExactComposerState(input, result.redactedText)) {
        showRewriteFailure(
          "submit",
          collectFailureDetails(input, result.redactedText, getInputText(input), "submit")
        ).catch(console.error);
        refreshBadgeFromCurrentInput();
        return;
      }
      const button = findSendButton(input);
      if (button) button.click();
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

    const findings = getFindings(text);
    if (!findings.length) {
      lastTypedPromptText = "";
      return;
    }

    if (PLACEHOLDER_TOKEN_REGEX.test(text)) {
      PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
      return;
    }
    PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;

    if (text === lastTypedPromptText) {
      return;
    }

    lastTypedPromptText = text;

    const decision = await showDecisionModal(findings, "input");
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

    const result = redactor.redact(latestText, findings);
    const placeholderCheck = verifyPlaceholderConsistency(result);

    if (!placeholderCheck.ok) {
      await showMessageModal("Redaction blocked", placeholderCheck.error);
      refreshBadgeFromCurrentInput();
      return;
    }

    const applied = await applyComposerText(latestInput, result.redactedText, {
      caretOffset: result.redactedText.length,
      restoreText: latestText,
      restoreCaretOffset: latestText.length
    });

    if (!applied.ok) {
      await showRewriteFailure(
        "input",
        collectFailureDetails(latestInput, result.redactedText, applied.actual, "input")
      );
      refreshBadgeFromCurrentInput();
      return;
    }

    await persistState();

    lastTypedPromptText = result.redactedText;
    setBadge(`Redacted ${findings.length} item(s)`);
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

    const findings = getFindings(text);
    if (!findings.length) {
      setBadge("");
      return;
    }

    setBadge(`Shield: ${summarizeFindings(findings)}`);
  }

  function scheduleInputScan() {
    window.clearTimeout(inputScanTimer);
    inputScanTimer = window.setTimeout(() => {
      refreshBadgeFromCurrentInput();
      maybeHandleTypedSecrets().catch(console.error);
    }, 220);
  }

  async function lookupRawByPlaceholder(placeholder) {
    const local = manager.getRaw(placeholder);
    if (local) {
      debugReveal("reveal:lookup", {
        placeholder,
        source: "content-manager",
        found: true
      });
      return local;
    }

    const response = await chrome.runtime.sendMessage({
      type: "PWM_GET_RAW_BY_PLACEHOLDER",
      url: location.href,
      placeholder
    });

    const raw = response?.ok ? response.raw : null;
    debugReveal("reveal:lookup", {
      placeholder,
      source: "background-session",
      found: !!raw
    });
    return raw;
  }

  function createSecretSpan(placeholder) {
    const span = document.createElement("span");
    span.className = "pwm-secret";
    span.dataset.placeholder = placeholder;
    span.textContent = placeholder;
    span.title = "Click to reveal locally for 8 seconds";

    span.addEventListener("click", async () => {
      debugReveal("reveal:click", {
        placeholder,
        connected: span.isConnected
      });

      if (span.classList.contains("is-revealed")) {
        span.classList.remove("is-revealed");
        span.textContent = placeholder;
        return;
      }

      const raw = await lookupRawByPlaceholder(placeholder);
      if (!raw) {
        debugReveal("reveal:missing-raw", {
          placeholder
        });
        span.title = "Placeholder is not available in this local session";
        return;
      }

      span.classList.add("is-revealed");
      span.textContent = raw;

      window.setTimeout(() => {
        if (span.isConnected) {
          span.classList.remove("is-revealed");
          span.textContent = placeholder;
        }
      }, 8000);

      debugReveal("reveal:success", {
        placeholder
      });
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
    const input = String(text || "");
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
    if (!text || !PLACEHOLDER_TOKEN_REGEX.test(text)) return;
    PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
    if (shouldSkipHydration(node)) return;

    const parent = node.parentElement;
    if (!parent) return;

    const segments = tokenizePlaceholderText(text);
    if (segments.length === 1 && segments[0].type === "text") return;

    debugReveal("rehydrate:text-node", {
      text,
      parentTag: parent.tagName,
      segments
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
      if (node.nodeValue && PLACEHOLDER_TOKEN_REGEX.test(node.nodeValue)) {
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
          debugReveal("rehydrate:character-data", {
            text: mutation.target.nodeValue || "",
            parentTag: mutation.target.parentElement?.tagName || null
          });
          hydrateTextNode(mutation.target);
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            hydrateTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            debugReveal("rehydrate:element-added", {
              tagName: node.tagName,
              textPreview: (node.textContent || "").slice(0, 200)
            });
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
