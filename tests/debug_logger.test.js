const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
delete globalThis.PWM;
const DebugLogger = require(path.join(repoRoot, "src/content/diagnostics/debugLogger.js"));
const RewriteVerificationText = require(path.join(repoRoot, "src/content/input/rewriteVerificationText.js"));

function createStorage(value, { throws = false } = {}) {
  return {
    getItem(key) {
      if (throws) {
        throw new Error("storage unavailable");
      }
      return key === "pwm:debug" ? value : null;
    }
  };
}

function createConsoleSink({ throws = false } = {}) {
  const calls = [];
  return {
    calls,
    groupCollapsed(label) {
      if (throws) throw new Error("console unavailable");
      calls.push(["groupCollapsed", label]);
    },
    log(payload) {
      if (throws) throw new Error("console unavailable");
      calls.push(["log", payload]);
    },
    groupEnd() {
      if (throws) throw new Error("console unavailable");
      calls.push(["groupEnd"]);
    }
  };
}

assert.strictEqual(
  DebugLogger.isDebugEnabled({
    localStorage: createStorage(null),
    sessionStorage: createStorage(null)
  }),
  false,
  "debug should be disabled by default"
);

assert.strictEqual(
  DebugLogger.isDebugEnabled({
    localStorage: createStorage("1"),
    sessionStorage: createStorage(null)
  }),
  true,
  "localStorage pwm:debug=1 should enable debug"
);

assert.strictEqual(
  DebugLogger.isDebugEnabled({
    localStorage: createStorage(null),
    sessionStorage: createStorage("1")
  }),
  true,
  "sessionStorage pwm:debug=1 should enable debug"
);

assert.doesNotThrow(() =>
  DebugLogger.isDebugEnabled({
    localStorage: createStorage(null, { throws: true }),
    sessionStorage: createStorage(null, { throws: true })
  })
);

{
  const rawSecret = "sk-live-abcdefghijklmnopqrstuvwxyz123456";
  const sanitized = DebugLogger.sanitizeDebugPayload({
    apiKey: rawSecret,
    authorization: `Bearer ${rawSecret}`,
    label: "file-handoff:assignment-success"
  });
  const serialized = JSON.stringify(sanitized);
  assert.strictEqual(serialized.includes(rawSecret), false, "raw-looking secrets must not survive");
  assert.strictEqual(sanitized.label, "file-handoff:assignment-success", "short safe labels can pass through");
}

{
  const prompt = `BEGIN PROMPT\n${"customer secret text ".repeat(40)}`;
  const sanitized = DebugLogger.sanitizeDebugPayload({
    promptText: prompt,
    fileContent: prompt
  });
  assert.strictEqual(JSON.stringify(sanitized).includes("customer secret text"), false);
  assert.deepStrictEqual(Object.keys(sanitized.promptText).sort(), ["length", "lineCount", "redacted", "type"]);
}

{
  const error = new Error("raw secret sk-live-abcdefghijklmnopqrstuvwxyz123456 leaked in message");
  error.code = "E_SAFE";
  error.stack = "STACK SHOULD NOT APPEAR";
  const sanitized = DebugLogger.sanitizeDebugPayload({ error });
  const serialized = JSON.stringify(sanitized);
  assert.strictEqual(serialized.includes("sk-live"), false);
  assert.strictEqual(serialized.includes("STACK SHOULD NOT APPEAR"), false);
  assert.strictEqual(sanitized.error.name, "Error");
  assert.strictEqual(sanitized.error.code, "E_SAFE");
  assert.ok(sanitized.error.messageLength > 0);
}

{
  const cycle = { label: "safe-cycle" };
  cycle.self = cycle;
  const sanitized = DebugLogger.sanitizeDebugPayload({
    items: ["safe-label", "AKIAABCDEFGHIJKLMNOP", cycle]
  });
  assert.strictEqual(sanitized.items[0], "safe-label");
  assert.notStrictEqual(sanitized.items[1], "AKIAABCDEFGHIJKLMNOP");
  assert.deepStrictEqual(sanitized.items[2].self, { type: "cycle" });
}

{
  const consoleSink = createConsoleSink();
  const rawSecret = "password=SuperSecretTokenValue1234567890";
  DebugLogger.debugEvent(
    "debug:test",
    { rawSecret, ok: true },
    {
      localStorage: createStorage("1"),
      sessionStorage: createStorage(null),
      console: consoleSink
    }
  );
  assert.deepStrictEqual(consoleSink.calls.map((call) => call[0]), ["groupCollapsed", "log", "groupEnd"]);
  assert.strictEqual(JSON.stringify(consoleSink.calls).includes(rawSecret), false);
  assert.strictEqual(consoleSink.calls[1][1].ok, true);
}

{
  const consoleSink = createConsoleSink();
  DebugLogger.debugEvent(
    "debug:test",
    { label: "safe" },
    {
      localStorage: createStorage(null),
      sessionStorage: createStorage(null),
      console: consoleSink
    }
  );
  assert.deepStrictEqual(consoleSink.calls, []);
}

{
  const consoleSink = createConsoleSink({ throws: true });
  assert.doesNotThrow(() =>
    DebugLogger.debugEvent(
      "debug:test",
      { label: "safe" },
      {
        localStorage: createStorage("1"),
        sessionStorage: createStorage(null),
        console: consoleSink
      }
    )
  );
}

{
  const rawComposerText = "please send RawSecretABCDE12345 to [PWM_1]\nnext line";
  const snapshot = DebugLogger.collectComposerDebugSnapshot(
    {
      text: rawComposerText,
      innerText: rawComposerText,
      textContent: rawComposerText
    },
    rawComposerText,
    rawComposerText,
    {
      getInputText: (input) => input.text,
      normalizeText: (value) => String(value || ""),
      normalizeEditorInnerText: (value) => String(value || ""),
      normalizeVisiblePlaceholders: (value) => String(value || ""),
      placeholderTokenRegex: /\[PWM_\d+\]/g
    }
  );
  const serialized = JSON.stringify(snapshot);
  assert.strictEqual(serialized.includes("RawSecretABCDE12345"), false);
  assert.deepStrictEqual(Object.keys(snapshot.expected).sort(), ["length", "lineCount", "placeholderCount"]);
  assert.strictEqual(snapshot.expected.lineCount, 2);
  assert.strictEqual(snapshot.expected.placeholderCount, 1);
}

{
  const consoleSink = createConsoleSink();
  DebugLogger.debugSnapshot(
    "rewrite:primary-rewrite",
    { expected: { length: 42, lineCount: 1, placeholderCount: 1 } },
    {
      localStorage: createStorage("1"),
      sessionStorage: createStorage(null),
      console: consoleSink
    }
  );
  assert.strictEqual(consoleSink.calls[0][1], "[PWM] rewrite:primary-rewrite");
  assert.deepStrictEqual(consoleSink.calls[1][1], {
    expected: { length: 42, lineCount: 1, placeholderCount: 1 }
  });
}

{
  const rawSecret = "RawSecretABCDE12345";
  const events = [];
  RewriteVerificationText.evaluateComposerVerificationCandidates(
    {
      candidates: [{ source: "actual", text: `password is ${rawSecret}` }],
      expectedText: "password is [PWM_1]",
      originalText: `password is ${rawSecret}`,
      findings: [{ raw: rawSecret, severity: "high" }],
      context: "submit"
    },
    {
      debug: (label, payload) => events.push({ label, payload }),
      analyzeText: (text) => ({
        secretFindings: String(text || "").includes(rawSecret)
          ? [{ raw: rawSecret, severity: "high" }]
          : []
      })
    }
  );
  const serialized = JSON.stringify(events);
  assert.ok(events.some((event) => event.label === "rewrite:verification-candidate"));
  assert.ok(events.some((event) => event.label === "rewrite:verification-failed-raw-secret-present"));
  assert.strictEqual(serialized.includes(rawSecret), false);
  for (const event of events) {
    for (const value of Object.values(event.payload)) {
      assert.ok(
        value == null || ["boolean", "number", "string"].includes(typeof value),
        "rewrite debug payload values should stay scalar metadata"
      );
    }
  }
}

console.log("PASS raw-safe debug logger shell regressions");
