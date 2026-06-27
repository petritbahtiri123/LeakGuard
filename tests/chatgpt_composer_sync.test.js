const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

globalThis.PWM = {};
globalThis.location = { hostname: "chatgpt.com" };
globalThis.window = globalThis;
globalThis.document = {
  dispatchEvent() {
    return true;
  },
  execCommand() {
    return false;
  }
};

class TestEvent {
  constructor(type, options = {}) {
    this.type = type;
    Object.assign(this, options);
  }
}
class TestInputEvent extends TestEvent {}

globalThis.Event = TestEvent;
globalThis.InputEvent = TestInputEvent;

require(path.join(repoRoot, "src/shared/runtime_scripts.js"));
require(path.join(repoRoot, "src/content/composer_helpers.js"));
require(path.join(repoRoot, "src/content/input/rewriteVerificationText.js"));
require(path.join(repoRoot, "src/content/composer/chatgptComposerSync.js"));

function makeInput({ contentEditable = false, directWrites = true } = {}) {
  const events = [];
  return {
    tagName: contentEditable ? "DIV" : "TEXTAREA",
    isContentEditable: contentEditable,
    contentEditable: contentEditable ? "true" : "false",
    value: "",
    textContent: "",
    events,
    focus() {},
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
    directWrites
  };
}

function installComposerHelperStubs(calls) {
  globalThis.PWM.ComposerHelpers = {
    normalizeComposerText: (text) => String(text || ""),
    getInputText: (input) => input.value || input.textContent || "",
    isTextArea: (input) => input.tagName === "TEXTAREA",
    isContentEditable: (input) => input.isContentEditable === true,
    setInputTextDirect: (input, text) => {
      calls.push("direct-dom");
      if (!input.directWrites) return false;
      input.value = text;
      input.textContent = text;
      return true;
    },
    setInputText: (input, text) => {
      calls.push("composer-helper");
      input.value = text;
      input.textContent = text;
    }
  };
}

function makeDependencies({ verify = ({ actualText, expectedText }) => ({ ok: actualText === expectedText, actual: actualText }) } = {}) {
  const strategies = [];
  return {
    strategies,
    dependencies: {
      isChatGptHost: () => true,
      suppressFollowupInputScan() {},
      readStableComposerText: async (input) => globalThis.PWM.ComposerHelpers.getInputText(input),
      verifyComposerRewriteSafe: async (payload) => verify(payload),
      debugChatGptSync: (_label, _input, _expected, _actual, extra) => {
        if (extra?.strategy && _label === "chatgpt-sync:write-plan") strategies.push(extra.strategy);
      }
    }
  };
}

async function testRuntimeScriptOrder() {
  const scripts = globalThis.PWM.RuntimeScripts.contentScripts;
  const helperIndex = scripts.indexOf("content/composer_helpers.js");
  const verificationIndex = scripts.indexOf("content/input/rewriteVerificationText.js");
  const syncIndex = scripts.indexOf("content/composer/chatgptComposerSync.js");
  const contentIndex = scripts.indexOf("content/content.js");
  assert.ok(helperIndex >= 0 && verificationIndex >= 0 && syncIndex >= 0 && contentIndex >= 0);
  assert.ok(helperIndex < syncIndex, "ChatGPT sync should load after ComposerHelpers");
  assert.ok(verificationIndex < syncIndex, "ChatGPT sync should load after rewrite verification text");
  assert.ok(syncIndex < contentIndex, "ChatGPT sync should load before content.js");
}

async function testVerificationBlocksRawSecretLeakage() {
  const calls = [];
  installComposerHelperStubs(calls);
  const input = makeInput();
  const rawSecret = "sk-live-raw-secret";
  const verificationPayloads = [];
  const { dependencies } = makeDependencies({
    verify: ({ actualText, expectedText }) => {
      verificationPayloads.push(actualText);
      return { ok: actualText === expectedText && !actualText.includes(rawSecret), actual: actualText };
    }
  });

  globalThis.PWM.ComposerHelpers.setInputTextDirect = (target) => {
    calls.push("direct-dom");
    target.value = `leaked ${rawSecret}`;
    return true;
  };

  const result = await globalThis.PWM.ChatGptComposerSync.applyChatGptSyncedComposerText(input, "safe [PWM_1]", {
    rawInsertedText: rawSecret,
    dependencies
  });
  assert.strictEqual(result.ok, true, "safe fallback rewrite should still be accepted after the raw write is rejected");
  assert.ok(verificationPayloads.some((text) => text.includes(rawSecret)), "test fixture should simulate a host/raw write mismatch");
  assert.strictEqual(input.value, "safe [PWM_1]", "final accepted composer text should not retain the raw secret");
}

async function testFallbackOrder() {
  const calls = [];
  installComposerHelperStubs(calls);
  const input = makeInput({ directWrites: false });
  const { dependencies, strategies } = makeDependencies();

  const result = await globalThis.PWM.ChatGptComposerSync.applyChatGptSyncedComposerText(input, "safe [PWM_1]", {
    dependencies
  });

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(strategies, ["direct-dom", "composer-helper"], "textarea fallback order should remain direct DOM then composer helper");
  assert.deepStrictEqual(calls, ["direct-dom", "composer-helper"]);
}

async function testDefaultContentEditableExecCommandKeepsDocumentSelectionBehavior() {
  const calls = [];
  installComposerHelperStubs(calls);
  const input = makeInput({ contentEditable: true });
  input.textContent = "my password is synthetic1234";
  const commands = [];
  let selected = false;
  const originalExecCommand = globalThis.document.execCommand;
  globalThis.PWM.ComposerHelpers.insertContentEditableTextCommand = (target, text) => {
    calls.push("scoped-insert-command");
    target.textContent = text;
    return true;
  };
  globalThis.document.execCommand = (command, _showUi, value) => {
    commands.push(command);
    if (command === "selectAll") {
      selected = true;
      return true;
    }
    if (command === "insertText") {
      input.textContent = selected ? value : `${input.textContent}${value}`;
      selected = false;
      return true;
    }
    return false;
  };
  const { dependencies, strategies } = makeDependencies();

  try {
    const result = await globalThis.PWM.ChatGptComposerSync.applyChatGptSyncedComposerText(input, "my password is [PWM_1]", {
      rawInsertedText: "my password is synthetic1234",
      dependencies
    });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(strategies, ["exec-command"], "contenteditable sync should still use the exec-command strategy");
    assert.deepStrictEqual(calls, [], "default contenteditable sync should not use the WhatsApp scoped helper");
    assert.deepStrictEqual(commands, ["selectAll", "insertText"], "default contenteditable sync should preserve document execCommand behavior");
    assert.strictEqual(input.textContent, "my password is [PWM_1]");
  } finally {
    globalThis.document.execCommand = originalExecCommand;
  }
}

async function testStrictContentEditableSyncDoesNotUseAppendProneFallbacks() {
  const calls = [];
  installComposerHelperStubs(calls);
  const input = makeInput({ contentEditable: true });
  const rawText = "my password is synthetic1234";
  const redactedText = "my password is [PWM_1]";
  input.textContent = rawText;
  globalThis.PWM.ComposerHelpers.insertContentEditableTextCommand = (target, text) => {
    calls.push("scoped-insert-command");
    target.textContent += text;
    return true;
  };
  globalThis.PWM.ComposerHelpers.setInputTextDirect = (target, text) => {
    calls.push("direct-dom");
    target.textContent += text;
    return true;
  };
  const { dependencies, strategies } = makeDependencies({
    verify: ({ actualText, expectedText }) => ({
      ok: actualText === expectedText && !actualText.includes(rawText),
      actual: actualText
    })
  });

  const result = await globalThis.PWM.ChatGptComposerSync.applyChatGptSyncedComposerText(input, redactedText, {
    rawInsertedText: rawText,
    restoreText: rawText,
    strictContentEditableSync: true,
    dependencies
  });

  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(strategies, ["exec-command"], "strict contenteditable sync should try only the scoped command path");
  assert.deepStrictEqual(calls, ["scoped-insert-command"], "strict contenteditable sync must not use direct DOM or restore fallbacks");
  assert.strictEqual(input.textContent, `${rawText}${redactedText}`);
}

async function testStrictContentEditableSyncClearsStateMirrorBeforeReplacement() {
  const calls = [];
  const input = makeInput({ contentEditable: true });
  const rawText = "LGQA_WA_DUPLICATE_1 my password is synthetic1234";
  const redactedText = "LGQA_WA_DUPLICATE_1 my password is [PWM_1]";
  const state = { internalText: rawText };
  input.textContent = rawText;
  input.value = rawText;
  input.dispatchEvent = (event) => {
    input.events.push(event);
    if (event.type !== "input") return true;

    const text = globalThis.PWM.ComposerHelpers.getInputText(input);
    if (/\[PWM_\d+\]/.test(text) && state.internalText && state.internalText !== text) {
      state.internalText = `${text}\n${text}`;
    } else {
      state.internalText = text;
    }

    const delay = event.inputType === "insertReplacementText" ? 20 : 35;
    globalThis.setTimeout(() => {
      input.textContent = state.internalText;
      input.value = state.internalText;
    }, delay);
    return true;
  };

  globalThis.PWM.ComposerHelpers = {
    normalizeComposerText: (text) => String(text || ""),
    getInputText: (target) => target.value || target.textContent || "",
    isTextArea: () => false,
    isContentEditable: (target) => target.isContentEditable === true,
    insertContentEditableTextCommand: (target, text, options = {}) => {
      calls.push({ strategy: "scoped-insert-command", syncClearBeforeInsert: options.syncClearBeforeInsert === true });
      if (options.syncClearBeforeInsert) {
        target.textContent = "";
        target.value = "";
        target.dispatchEvent(new InputEvent("input", {
          inputType: "deleteContentBackward",
          data: null
        }));
      }
      target.textContent = text;
      target.value = text;
      target.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      target.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      return true;
    },
    setInputTextDirect: () => {
      throw new Error("strict WhatsApp sync must not fall back to direct DOM writes");
    },
    setInputText: () => {
      throw new Error("strict WhatsApp sync must not fall back to generic helper writes");
    }
  };
  const { dependencies, strategies } = makeDependencies();

  const result = await globalThis.PWM.ChatGptComposerSync.applyChatGptSyncedComposerText(input, redactedText, {
    rawInsertedText: rawText,
    restoreText: rawText,
    strictContentEditableSync: true,
    syncClearBeforeInsert: true,
    dependencies
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.actual, redactedText);
  assert.strictEqual(globalThis.PWM.ComposerHelpers.getInputText(input), redactedText);
  assert.deepStrictEqual(strategies, ["exec-command"]);
  assert.deepStrictEqual(calls, [{ strategy: "scoped-insert-command", syncClearBeforeInsert: true }]);
}

async function testLargePayloadOmitsInputEventData() {
  const calls = [];
  installComposerHelperStubs(calls);
  const input = makeInput();
  const { dependencies } = makeDependencies();
  const largeText = "x".repeat(256 * 1024 + 1);

  const result = await globalThis.PWM.ChatGptComposerSync.applyChatGptSyncedComposerText(input, largeText, {
    dependencies
  });

  assert.strictEqual(result.ok, true);
  const inputEvents = input.events.filter((event) => event.type === "input");
  assert.ok(inputEvents.length > 0, "direct write should dispatch an input event");
  assert.ok(inputEvents.every((event) => event.data === null), "oversized InputEvent.data should be omitted");
}

(async () => {
  await testRuntimeScriptOrder();
  await testVerificationBlocksRawSecretLeakage();
  await testFallbackOrder();
  await testDefaultContentEditableExecCommandKeepsDocumentSelectionBehavior();
  await testStrictContentEditableSyncDoesNotUseAppendProneFallbacks();
  await testStrictContentEditableSyncClearsStateMirrorBeforeReplacement();
  await testLargePayloadOmitsInputEventData();
  console.log("PASS ChatGPT composer sync regressions");
})();
