const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/composer/chatgptLargePasteOrchestration.js"));

function spliceSelectionText(original, selection, replacement) {
  const source = String(original || "");
  const start = Math.max(0, Number(selection?.start ?? source.length));
  const end = Math.max(start, Number(selection?.end ?? start));
  const text = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
  return {
    text,
    caretOffset: start + String(replacement || "").length
  };
}

function createHarness(overrides = {}) {
  const calls = {
    badges: [],
    blockedPayloads: [],
    clearOptimization: [],
    consumed: 0,
    createdFiles: [],
    debugEvents: [],
    handoffs: [],
    hideBadgeSoon: [],
    modals: [],
    optimizationStatus: [],
    redactions: [],
    refreshBadge: 0,
    rewriteFailures: [],
    syncWrites: []
  };
  const redactedText = "alpha [PWM_1] beta";
  const orchestration =
    globalThis.PWM.ChatGptLargePasteOrchestration.createChatGptLargePasteOrchestration({
      analyzeText: (text) => ({
        normalizedText: text,
        secretFindings: String(text || "").includes("secret") ? [{ raw: "secret" }] : [],
        findings: String(text || "").includes("secret") ? [{ raw: "secret" }] : []
      }),
      blockLargeLocalTextPayload: async (event, sizeInfo) => calls.blockedPayloads.push({ event, sizeInfo }),
      chatGptComposerSync: {
        applyChatGptSyncedComposerText: async (input, text, options) => {
          calls.syncWrites.push({ input, text, options });
          input.text = String(text || "");
          return { ok: true, actual: input.text, strategy: "direct" };
        }
      },
      chatGptLargePasteFileName: "leakguard-redacted-paste.txt",
      chatGptLargePasteFileThreshold: 16,
      classifyLocalTextPayloadSize: () => ({ zone: "optimized", bytes: 1024 }),
      clearLocalPayloadOptimizationStatus: (sizeInfo, cleanup) =>
        calls.clearOptimization.push({ sizeInfo, cleanup }),
      collectFailureDetails: (...args) => ({ argsLength: args.length }),
      consumeInterceptionEvent: (event) => {
        event.defaultPrevented = true;
        calls.consumed += 1;
      },
      countDebugPlaceholders: (text) => (String(text || "").match(/\[PWM_/g) || []).length,
      createSanitizedTextFile: (file, text) => {
        const sanitizedFile = {
          name: file.name,
          type: file.type,
          text
        };
        calls.createdFiles.push({ file, text, sanitizedFile });
        return sanitizedFile;
      },
      debugReveal: (label, details) => calls.debugEvents.push({ label, details }),
      describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "" }),
      getChatGptComposerSyncDependencies: () => ({ marker: "sync-deps" }),
      getInputText: (input) => input?.text || "",
      getLocalTextPayloadByteLength: (text) => String(text || "").length,
      getSelectionOffsets: (input) => input?.selection || { start: 0, end: 0 },
      handOffSanitizedLocalFile: async (event, input, sanitizedFile, context) => {
        calls.handoffs.push({ event, input, sanitizedFile, context });
        return true;
      },
      hideBadgeSoon: (delayMs) => calls.hideBadgeSoon.push(delayMs),
      isChatGptHost: () => true,
      localTextHardBlockBytes: 4096,
      normalizeComposerText: (text) => String(text || ""),
      refreshBadgeFromCurrentInput: () => {
        calls.refreshBadge += 1;
      },
      requestRedaction: async (text, findings) => {
        calls.redactions.push({ text, findings });
        return { redactedText };
      },
      setBadge: (message) => calls.badges.push(message),
      setInputTextDirect: () => true,
      showLocalPayloadOptimizationStatus: (sizeInfo) => calls.optimizationStatus.push(sizeInfo),
      showMessageModal: async (...args) => calls.modals.push(args),
      showRewriteFailure: async (...args) => calls.rewriteFailures.push(args),
      spliceSelectionText,
      syncSuppressMs: 2500,
      ...overrides
    });

  return { orchestration, calls, redactedText };
}

async function testSanitizedFileHandoffWinsBeforeTextFallback() {
  const { orchestration, calls, redactedText } = createHarness();
  const event = {};
  const input = { text: "", selection: { start: 0, end: 0 } };

  const handled = await orchestration.maybeHandleChatGptLargeTextPaste(
    event,
    input,
    "alpha secret beta ".repeat(2),
    { findings: [{ raw: "secret" }], secretFindings: [{ raw: "secret" }] }
  );

  assert.strictEqual(handled, true);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.consumed, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.deepStrictEqual(calls.createdFiles[0], {
    file: { name: "leakguard-redacted-paste.txt", type: "text/plain" },
    text: redactedText,
    sanitizedFile: {
      name: "leakguard-redacted-paste.txt",
      type: "text/plain",
      text: redactedText
    }
  });
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "paste");
  assert.deepStrictEqual(calls.syncWrites, []);
  assert.deepStrictEqual(calls.clearOptimization, [
    { sizeInfo: { zone: "optimized", bytes: 1024 }, cleanup: "complete" }
  ]);
  assert.ok(calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:file-handoff-attempt"));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:file-handoff-success"));
  assert.deepStrictEqual(calls.modals, []);
}

async function testTextFallbackRunsOnlyAfterFileHandoffFails() {
  const { orchestration, calls, redactedText } = createHarness({
    handOffSanitizedLocalFile: async (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    }
  });
  const event = {};
  const input = { text: "Prefix:\n", selection: { start: "Prefix:\n".length, end: "Prefix:\n".length } };

  const handled = await orchestration.maybeHandleChatGptLargeTextPaste(
    event,
    input,
    "alpha secret beta ".repeat(2),
    { findings: [{ raw: "secret" }], secretFindings: [{ raw: "secret" }] }
  );

  assert.strictEqual(handled, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.syncWrites.length, 1);
  assert.strictEqual(calls.syncWrites[0].text, `Prefix:\n${redactedText}`);
  assert.strictEqual(calls.syncWrites[0].options.context, "large-paste-text-fallback");
  assert.deepStrictEqual(calls.syncWrites[0].options.dependencies, { marker: "sync-deps" });
  assert.strictEqual(input.text, `Prefix:\n${redactedText}`);
  assert.ok(calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:file-handoff-failed"));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:text-fallback-start"));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:text-fallback-success"));
  assert.deepStrictEqual(calls.rewriteFailures, []);
  assert.deepStrictEqual(calls.clearOptimization, [
    { sizeInfo: { zone: "optimized", bytes: 1024 }, cleanup: "complete" }
  ]);
}

async function testHardBlockStopsBeforeRedactionOrEventConsumption() {
  const blockedSizeInfo = { zone: "blocked", bytes: 8192 };
  const { orchestration, calls } = createHarness({
    classifyLocalTextPayloadSize: () => blockedSizeInfo,
    getLocalTextPayloadByteLength: () => 8192,
    localTextHardBlockBytes: 4096
  });
  const event = {};
  const input = { text: "", selection: { start: 0, end: 0 } };

  const handled = await orchestration.maybeHandleChatGptLargeTextPaste(
    event,
    input,
    "alpha secret beta",
    { findings: [{ raw: "secret" }], secretFindings: [{ raw: "secret" }] }
  );

  assert.strictEqual(handled, true);
  assert.strictEqual(event.defaultPrevented, undefined);
  assert.deepStrictEqual(calls.blockedPayloads, [{ event, sizeInfo: blockedSizeInfo }]);
  assert.strictEqual(calls.consumed, 0);
  assert.deepStrictEqual(calls.redactions, []);
  assert.deepStrictEqual(calls.createdFiles, []);
  assert.deepStrictEqual(calls.handoffs, []);
}

(async () => {
  await testSanitizedFileHandoffWinsBeforeTextFallback();
  await testTextFallbackRunsOnlyAfterFileHandoffFails();
  await testHardBlockStopsBeforeRedactionOrEventConsumption();
  console.log("PASS ChatGPT large paste orchestration");
})();
