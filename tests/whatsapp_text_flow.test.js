const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/whatsapp/whatsappTextFlow.js"));

function createFlow(overrides = {}) {
  let now = 1000;
  const debug = [];
  const flow = globalThis.PWM.WhatsAppTextFlow.createWhatsAppTextFlow({
    isWhatsAppHost: () => true,
    isTextPasteInterceptionEvent: (event) => event?.type === "paste" || event?.inputType === "insertFromPaste",
    normalizeComposerText: (text) => String(text || "").replace(/\r\n?/g, "\n"),
    debugReveal: (label, payload) => debug.push({ label, payload }),
    now: () => now,
    duplicateTextPasteSuppressMs: 1200,
    ...overrides
  });
  return {
    flow,
    debug,
    advance(ms) {
      now += ms;
    }
  };
}

function testDuplicateTextPastePairsAreSuppressedOnce() {
  const { flow, debug } = createFlow();
  const input = {};
  const pasted = "one\r\ntwo";

  flow.rememberWhatsAppTextPaste(input, pasted, { type: "paste" });

  assert.strictEqual(
    flow.shouldSuppressDuplicateWhatsAppTextPaste(input, "one\ntwo", {
      type: "beforeinput",
      inputType: "insertFromPaste"
    }),
    true
  );
  assert.strictEqual(
    flow.shouldSuppressDuplicateWhatsAppTextPaste(input, pasted, {
      type: "beforeinput",
      inputType: "insertFromPaste"
    }),
    false,
    "the paired event should only be suppressed once"
  );
  assert.deepStrictEqual(debug.map((entry) => entry.label), [
    "whatsapp:text-paste-duplicate-event-suppressed"
  ]);
}

function testDuplicatePasteGateRequiresFreshWhatsAppTextEvent() {
  const input = {};
  const { flow, advance } = createFlow();
  flow.rememberWhatsAppTextPaste(input, "secret", { type: "paste" });
  advance(1300);
  assert.strictEqual(
    flow.shouldSuppressDuplicateWhatsAppTextPaste(input, "secret", {
      type: "beforeinput",
      inputType: "insertFromPaste"
    }),
    false
  );

  const nonWhatsApp = createFlow({ isWhatsAppHost: () => false }).flow;
  nonWhatsApp.rememberWhatsAppTextPaste(input, "secret", { type: "paste" });
  assert.strictEqual(
    nonWhatsApp.shouldSuppressDuplicateWhatsAppTextPaste(input, "secret", {
      type: "beforeinput",
      inputType: "insertFromPaste"
    }),
    false
  );
}

function testTextPasteSignatureNormalizesShape() {
  const { flow } = createFlow();

  assert.strictEqual(flow.buildTextPasteSignature("a\r\nb"), flow.buildTextPasteSignature("a\nb"));
  assert.notStrictEqual(flow.buildTextPasteSignature("a\nb"), flow.buildTextPasteSignature("ab"));
}

testDuplicateTextPastePairsAreSuppressedOnce();
testDuplicatePasteGateRequiresFreshWhatsAppTextEvent();
testTextPasteSignatureNormalizesShape();

console.log("PASS WhatsApp text flow");
