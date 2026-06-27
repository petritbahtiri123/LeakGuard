(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const CHATGPT_SYNC_EVENT_DATA_MAX_CHARS = 256 * 1024;
  const CHATGPT_SYNC_VERIFY_DELAY_MS = 80;
  const PROGRAMMATIC_INPUT_SUPPRESS_MS = 500;

  function getComposerHelpers() {
    return root.PWM?.ComposerHelpers || {};
  }

  function getDependencies(options = {}) {
    return options.dependencies || options.__dependencies || {};
  }

  function defaultIsChatGptHost() {
    const hostname = String(root.location?.hostname || "").toLowerCase();
    return hostname === "chatgpt.com" || hostname.endsWith(".chatgpt.com") || hostname === "chat.openai.com";
  }

  function normalizeText(text) {
    const helpers = getComposerHelpers();
    return typeof helpers.normalizeComposerText === "function" ? helpers.normalizeComposerText(text) : String(text || "");
  }

  function getInputTextSafe(input) {
    const helpers = getComposerHelpers();
    return typeof helpers.getInputText === "function" ? helpers.getInputText(input) : input?.value || input?.textContent || "";
  }

  function isTextArea(input) {
    const helpers = getComposerHelpers();
    return typeof helpers.isTextArea === "function" ? helpers.isTextArea(input) : input?.tagName === "TEXTAREA";
  }

  function isContentEditable(input) {
    const helpers = getComposerHelpers();
    return typeof helpers.isContentEditable === "function"
      ? helpers.isContentEditable(input)
      : input?.isContentEditable === true || input?.contentEditable === "true";
  }

  function buildComposerWritePlan(text) {
    const normalizer = root.PWM?.normalizeVisiblePlaceholders || ((value) => value);
    const canonical = normalizeText(normalizer(text));
    return { canonical, writeText: canonical, acceptableTexts: [canonical] };
  }

  function debugChatGptSync(options, label, input, expectedText = "", actualText = null, extra = {}) {
    const debug = getDependencies(options).debugChatGptSync;
    if (typeof debug === "function") debug(label, input, expectedText, actualText, extra);
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
        const textLength = getInputTextSafe(input).length;
        input.setSelectionRange(textLength, textLength);
        return;
      }
    } catch {
      // Best-effort only.
    }

    if (!isContentEditable(input) || typeof root.window?.getSelection !== "function") return;
    try {
      const selection = root.window.getSelection();
      const range = root.document.createRange?.();
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
    const safeData = typeof data === "string" && data.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS ? data : null;
    let event = null;
    try {
      event = new InputEvent("input", { bubbles: true, composed: true, inputType, data: safeData });
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
    const safeData = typeof data === "string" && data.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS ? data : null;
    let event = null;
    try {
      event = new InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, inputType, data: safeData });
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

  function nudgeChatGptComposerState(input, expectedText, strategy, options) {
    focusChatGptComposer(input);
    placeChatGptCaretAtEnd(input);
    try {
      root.document.dispatchEvent?.(new Event("selectionchange", { bubbles: true }));
    } catch {
      // Host may not expose document-level dispatch.
    }
    debugChatGptSync(options, "chatgpt-sync:react-state-nudge", input, expectedText, null, { strategy });
  }

  async function waitForChatGptComposerVerification() {
    await new Promise((resolve) => root.window.setTimeout(resolve, CHATGPT_SYNC_VERIFY_DELAY_MS));
  }

  function tryChatGptExecCommandWrite(input, writeText, options = {}) {
    if (!isContentEditable(input)) return false;
    if (writeText.length > CHATGPT_SYNC_EVENT_DATA_MAX_CHARS) return false;

    focusChatGptComposer(input);
    dispatchChatGptComposerBeforeInput(input, "insertReplacementText", writeText);

    if (options.strictContentEditableSync) {
      const scopedCommandWrite = getComposerHelpers().insertContentEditableTextCommand;
      if (typeof scopedCommandWrite !== "function") return false;

      let scopedInserted = false;
      try {
        scopedInserted = Boolean(scopedCommandWrite(input, writeText, {
          caretOffset: options.caretOffset,
          selectTextNodeRange: Boolean(options.selectTextNodeRange),
          syncClearBeforeInsert: Boolean(options.syncClearBeforeInsert)
        }));
      } catch {
        scopedInserted = false;
      }
      if (!scopedInserted) return false;

      placeChatGptCaretAtEnd(input);
      dispatchChatGptComposerInputEvent(input, "insertReplacementText", writeText);
      dispatchChatGptComposerChange(input);
      return true;
    }

    if (typeof root.document?.execCommand !== "function") return false;

    let selected = false;
    try {
      selected = Boolean(root.document.execCommand("selectAll", false, null));
    } catch {
      selected = false;
    }
    if (!selected) return false;

    let inserted = false;
    try {
      inserted = Boolean(root.document.execCommand("insertText", false, writeText));
    } catch {
      inserted = false;
    }
    if (!inserted) return false;

    placeChatGptCaretAtEnd(input);
    dispatchChatGptComposerInputEvent(input, "insertReplacementText", writeText);
    dispatchChatGptComposerChange(input);
    return true;
  }

  function suppress(options) {
    const suppressFollowupInputScan = getDependencies(options).suppressFollowupInputScan;
    if (typeof suppressFollowupInputScan === "function") {
      suppressFollowupInputScan(options.suppressMs || PROGRAMMATIC_INPUT_SUPPRESS_MS);
    }
  }

  function tryChatGptDirectWrite(input, writeText, options = {}) {
    const helpers = getComposerHelpers();
    suppress(options);
    focusChatGptComposer(input);
    const written = helpers.setInputTextDirect?.(input, writeText, { caretOffset: options.caretOffset });
    if (!written) return false;
    dispatchChatGptComposerInputEvent(input, "insertReplacementText", null);
    dispatchChatGptComposerChange(input);
    return true;
  }

  function tryChatGptComposerHelperWrite(input, writeText, options = {}) {
    const helpers = getComposerHelpers();
    suppress(options);
    focusChatGptComposer(input);
    helpers.setInputText?.(input, writeText, { caretOffset: options.caretOffset });
    return true;
  }

  async function runChatGptSyncedWriteAttempt(input, plan, options, strategy) {
    const expected = plan.canonical;
    const writeText = plan.writeText;
    const deps = getDependencies(options);
    debugChatGptSync(options, "chatgpt-sync:write-plan", input, expected, null, {
      strategy,
      eventData: writeText.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS ? "included" : "omitted"
    });

    suppress(options);
    let writeAccepted = false;
    if (strategy === "exec-command") writeAccepted = tryChatGptExecCommandWrite(input, writeText, options);
    else if (strategy === "composer-helper") writeAccepted = tryChatGptComposerHelperWrite(input, writeText, options);
    else writeAccepted = tryChatGptDirectWrite(input, writeText, options);

    const actualAfterWrite = getInputTextSafe(input);
    debugChatGptSync(options, "chatgpt-sync:after-write", input, expected, actualAfterWrite, { strategy, writeAccepted });
    nudgeChatGptComposerState(input, expected, strategy, options);
    await waitForChatGptComposerVerification();
    const actual = typeof deps.readStableComposerText === "function" ? await deps.readStableComposerText(input, 2) : getInputTextSafe(input);
    const verification =
      writeAccepted && typeof deps.verifyComposerRewriteSafe === "function"
        ? await deps.verifyComposerRewriteSafe({
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
      debugChatGptSync(options, "chatgpt-sync:verification-pass", input, expected, actual, {
        strategy,
        verificationStrategy: verification.strategy
      });
      return { ok: true, actual: verification.actual || actual, strategy: `chatgpt-${strategy}` };
    }

    debugChatGptSync(options, "chatgpt-sync:verification-failed", input, expected, actual, { strategy, writeAccepted });
    return { ok: false, actual, strategy: `chatgpt-${strategy}` };
  }

  async function applyChatGptSyncedComposerText(input, expectedText, options = {}) {
    const deps = getDependencies(options);
    const isChatGptHost = typeof deps.isChatGptHost === "function" ? deps.isChatGptHost : defaultIsChatGptHost;
    if (!isChatGptHost()) return { ok: false, actual: getInputTextSafe(input), strategy: "not-chatgpt" };

    const plan = buildComposerWritePlan(expectedText);
    debugChatGptSync(options, "chatgpt-sync:before-write", input, plan.canonical, null, { context: options.context || "" });

    const writeText = plan.writeText;
    const strictContentEditableSync = Boolean(options.strictContentEditableSync && isContentEditable(input));
    const attempts =
      strictContentEditableSync && writeText.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS
        ? ["exec-command"]
        : isContentEditable(input) && writeText.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS
        ? ["exec-command", "direct-dom"]
        : writeText.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS
          ? ["direct-dom", "composer-helper"]
          : ["direct-dom"];

    let lastResult = { ok: false, actual: getInputTextSafe(input), strategy: "not-attempted" };
    for (const strategy of attempts) {
      lastResult = await runChatGptSyncedWriteAttempt(input, plan, options, strategy);
      if (lastResult.ok) return lastResult;
    }

    if (!strictContentEditableSync && typeof options.restoreText === "string") {
      tryChatGptDirectWrite(input, normalizeText(options.restoreText), {
        caretOffset: options.restoreCaretOffset,
        suppressMs: options.suppressMs,
        dependencies: deps
      });
      if (typeof deps.readStableComposerText === "function") await deps.readStableComposerText(input, 2);
    }

    return lastResult;
  }

  root.PWM.ChatGptComposerSync = Object.freeze({ applyChatGptSyncedComposerText });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ChatGptComposerSync;
  }
})();
