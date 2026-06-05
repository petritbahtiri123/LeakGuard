const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
delete globalThis.PWM;
const DebugLogger = require(path.join(repoRoot, "src/content/diagnostics/debugLogger.js"));

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

console.log("PASS raw-safe debug logger shell regressions");
