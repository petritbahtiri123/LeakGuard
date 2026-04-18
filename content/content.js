(function () {
  const { Detector, PlaceholderManager, Redactor } = globalThis.PWM;

  const COMPOSER_SELECTORS = [
    "#prompt-textarea",
    "textarea[data-testid='prompt-textarea']",
    "main form textarea",
    "form textarea",
    "main textarea",
    "[data-testid*='composer'] textarea",
    "[contenteditable='true'][data-testid='prompt-textarea']",
    "[contenteditable='true'][role='textbox'][data-testid*='prompt']",
    "main form [contenteditable='true'][role='textbox']",
    "form [contenteditable='true'][role='textbox']",
    "main [contenteditable='true'][role='textbox']",
    "main [contenteditable='true'][aria-label*='message' i]",
    "[contenteditable='true'][aria-label*='message' i]"
  ];

  const SEND_BUTTON_SELECTORS = [
    "form button[data-testid*='send']",
    "form button[aria-label*='send' i]",
    "button[data-testid*='send']",
    "button[aria-label*='send' i]"
  ];

  const detector = new Detector();
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

  function isTextArea(el) {
    return !!el && el.tagName === "TEXTAREA";
  }

  function isContentEditable(el) {
    return !!el && !isTextArea(el) && !!el.isContentEditable;
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

    if (document.activeElement === el) score += 80;
    if (id === "prompt-textarea") score += 80;
    if (/prompt/i.test(dataTestId)) score += 60;
    if (/composer/i.test(dataTestId)) score += 45;
    if (isTextArea(el)) score += 40;
    if (isContentEditable(el)) score += 28;
    if (el.getAttribute("role") === "textbox") score += 18;
    if (/message|prompt|ask/i.test(ariaLabel)) score += 16;
    if (/message|prompt|ask/i.test(placeholder)) score += 12;
    if (el.closest("form")) score += 16;
    if (rect.bottom > window.innerHeight * 0.45) score += 8;
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

  function normalizeTextValue(value) {
    return String(value || "").replace(/\u00a0/g, " ");
  }

  function getInputText(el) {
    if (!el) return "";
    if (isTextArea(el)) return normalizeTextValue(el.value);
    if (isContentEditable(el)) return normalizeTextValue(el.innerText || el.textContent || "");
    return "";
  }

  function lookupValueSetter(el) {
    let proto = el;

    while (proto) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor && typeof descriptor.set === "function") {
        return descriptor.set;
      }
      proto = Object.getPrototypeOf(proto);
    }

    return null;
  }

  function dispatchInput(el, data, inputType) {
    let event;

    try {
      event = new InputEvent("input", {
        bubbles: true,
        composed: true,
        data: data == null ? null : String(data),
        inputType: inputType || "insertText"
      });
    } catch {
      event = new Event("input", { bubbles: true, composed: true });
    }

    el.dispatchEvent(event);
  }

  function setTextareaValue(el, value) {
    const setter = lookupValueSetter(el);

    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }

    dispatchInput(el, value, "insertReplacementText");
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function textToFragment(text) {
    const fragment = document.createDocumentFragment();
    const parts = String(text || "").split("\n");

    parts.forEach((part, index) => {
      if (index > 0) {
        fragment.appendChild(document.createElement("br"));
      }
      if (part) {
        fragment.appendChild(document.createTextNode(part));
      }
    });

    if (!fragment.childNodes.length) {
      fragment.appendChild(document.createTextNode(""));
    }

    return fragment;
  }

  function placeCaretAtEnd(el) {
    if (!isContentEditable(el)) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function setContentEditableText(el, value) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.deleteContents();
    range.insertNode(textToFragment(value));
    placeCaretAtEnd(el);
    dispatchInput(el, value, "insertReplacementText");
  }

  function setInputText(el, value) {
    if (!el) return;

    if (isTextArea(el)) {
      setTextareaValue(el, value);
      return;
    }

    if (isContentEditable(el)) {
      setContentEditableText(el, value);
    }
  }

  function captureSelectionState(el) {
    if (!el) return null;

    if (isTextArea(el)) {
      return {
        kind: "textarea",
        start: el.selectionStart ?? el.value.length,
        end: el.selectionEnd ?? el.value.length
      };
    }

    if (isContentEditable(el)) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return { kind: "contenteditable", range: null };

      const range = selection.getRangeAt(0);
      if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
        return { kind: "contenteditable", range: null };
      }

      return {
        kind: "contenteditable",
        range: range.cloneRange()
      };
    }

    return null;
  }

  function restoreSelectionState(el, state) {
    if (!el || !state) return;

    if (state.kind === "textarea" && isTextArea(el)) {
      el.focus();
      const start = Math.min(state.start, el.value.length);
      const end = Math.min(state.end, el.value.length);
      el.setSelectionRange(start, end);
      return;
    }

    if (state.kind === "contenteditable" && isContentEditable(el)) {
      el.focus();
      const selection = window.getSelection();
      if (!selection) return;
      selection.removeAllRanges();

      if (state.range) {
        selection.addRange(state.range);
      } else {
        placeCaretAtEnd(el);
      }
    }
  }

  function insertTextAtCursor(el, text) {
    if (!el) return;

    if (isTextArea(el)) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;

      if (typeof el.setRangeText === "function") {
        el.setRangeText(text, start, end, "end");
        dispatchInput(el, text, "insertText");
      } else {
        const next = el.value.slice(0, start) + text + el.value.slice(end);
        setTextareaValue(el, next);
        const caret = start + text.length;
        el.setSelectionRange(caret, caret);
      }

      return;
    }

    if (isContentEditable(el)) {
      el.focus();
      const selection = window.getSelection();
      if (!selection) return;

      let range;
      if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
      }

      if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
        range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
      }

      range.deleteContents();

      const fragment = textToFragment(text);
      const lastNode = fragment.lastChild;
      range.insertNode(fragment);

      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        placeCaretAtEnd(el);
      }

      dispatchInput(el, text, "insertText");
    }
  }

  function mask(raw) {
    if (!raw) return "";
    if (raw.length <= 8) return "••••••••";
    return `${raw.slice(0, 4)}••••${raw.slice(-2)}`;
  }

  function getFindings(text) {
    if (!text || !text.trim()) return [];
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

  async function maybeHandlePaste(event) {
    if (modalOpen || event.defaultPrevented) return;

    const input = findComposer(event.target);
    if (!input) return;

    const pasted =
      event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "";

    if (!pasted) return;

    const findings = getFindings(pasted);
    if (!findings.length) return;

    event.preventDefault();

    const selectionState = captureSelectionState(input);
    const decision = await showDecisionModal(findings, "paste");

    if (decision.action === "cancel") return;

    restoreSelectionState(input, selectionState);

    if (decision.action === "allow") {
      insertTextAtCursor(input, pasted);
      setBadge("Allowed once");
      hideBadgeSoon();
      refreshBadgeFromCurrentInput();
      return;
    }

    const result = redactor.redact(pasted, findings);
    insertTextAtCursor(input, result.redactedText);
    await persistState();

    setBadge(`Redacted ${findings.length} item(s)`);
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();
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
    setInputText(input, result.redactedText);
    await persistState();

    setBadge(`Redacted ${findings.length} item(s)`);
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();

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
    setInputText(input, result.redactedText);
    await persistState();
    setBadge(`Redacted ${findings.length} item(s)`);
    hideBadgeSoon();
    refreshBadgeFromCurrentInput();

    queueMicrotask(() => {
      const button = findSendButton(input);
      if (button) button.click();
    });
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
    inputScanTimer = window.setTimeout(refreshBadgeFromCurrentInput, 220);
  }

  async function lookupRawByPlaceholder(placeholder) {
    const local = manager.getRaw(placeholder);
    if (local) return local;

    const response = await chrome.runtime.sendMessage({
      type: "PWM_GET_RAW_BY_PLACEHOLDER",
      url: location.href,
      placeholder
    });

    return response?.ok ? response.raw : null;
  }

  function createSecretSpan(placeholder) {
    const span = document.createElement("span");
    span.className = "pwm-secret";
    span.dataset.placeholder = placeholder;
    span.textContent = placeholder;
    span.title = "Click to reveal locally for 8 seconds";

    span.addEventListener("click", async () => {
      if (span.classList.contains("is-revealed")) {
        span.classList.remove("is-revealed");
        span.textContent = placeholder;
        return;
      }

      const raw = await lookupRawByPlaceholder(placeholder);
      if (!raw) return;

      span.classList.add("is-revealed");
      span.textContent = raw;

      window.setTimeout(() => {
        if (span.isConnected) {
          span.classList.remove("is-revealed");
          span.textContent = placeholder;
        }
      }, 8000);
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

  function hydrateTextNode(node) {
    const text = node.nodeValue;
    if (!text || !/\[[A-Z0-9_]+_\d+\]/.test(text)) return;
    if (shouldSkipHydration(node)) return;

    const parent = node.parentElement;
    if (!parent) return;

    const segments = manager.segmentText(text);
    if (segments.length === 1 && segments[0].type === "text") return;

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
      if (node.nodeValue && /\[[A-Z0-9_]+_\d+\]/.test(node.nodeValue)) {
        nodes.push(node);
      }
    }

    nodes.forEach(hydrateTextNode);
  }

  function startRehydrationObserver() {
    if (rehydrateObserver || !document.body) return;

    rehydrateObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            hydrateTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            rehydrateTree(node);
          }
        });
      }
    });

    rehydrateObserver.observe(document.body, {
      childList: true,
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
    setBadge("New chat session detected");
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
