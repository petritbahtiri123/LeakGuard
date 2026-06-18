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
  await testLargePayloadOmitsInputEventData();
  console.log("PASS ChatGPT composer sync regressions");
})();
