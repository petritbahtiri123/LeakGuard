(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const DEBUG_STORAGE_KEY = "pwm:debug";
  const DEFAULT_MAX_DEPTH = 5;
  const DEFAULT_MAX_ARRAY_LENGTH = 25;
  const SAFE_LABEL_PATTERN = /^[A-Za-z0-9 _.:/-]{1,80}$/;
  const SENSITIVE_KEY_PATTERN =
    /(?:authorization|bearer|cookie|credential|file(?:text|content)?|header|key|password|prompt|raw|reveal|secret|text|token|url|value)/i;
  const SECRET_TEXT_PATTERN =
    /(?:bearer\s+[a-z0-9._~+/=-]+|api[_-]?key|authorization|cookie|password|secret|token|sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16})/i;
  const HIGH_ENTROPY_PATTERN = /[A-Za-z0-9+/=_-]{24,}/;
  const PATH_LIKE_PATTERN = /(?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|[\\/][^\\/]+[\\/]|[\\/][^\\/]+\.[A-Za-z0-9]{1,12}(?:$|[?#]))/;

  function getOption(options, name, fallback) {
    return Object.prototype.hasOwnProperty.call(options || {}, name) ? options[name] : fallback;
  }

  function getStorageValue(storage, key) {
    try {
      return storage?.getItem?.(key);
    } catch {
      return null;
    }
  }

  function isDebugEnabled(options = {}) {
    const targetRoot = getOption(options, "root", root);
    const localStorage = getOption(options, "localStorage", targetRoot?.localStorage);
    const sessionStorage = getOption(options, "sessionStorage", targetRoot?.sessionStorage);

    return getStorageValue(localStorage, DEBUG_STORAGE_KEY) === "1" ||
      getStorageValue(sessionStorage, DEBUG_STORAGE_KEY) === "1";
  }

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function isSafeLabel(value) {
    return SAFE_LABEL_PATTERN.test(value) &&
      !SECRET_TEXT_PATTERN.test(value) &&
      !HIGH_ENTROPY_PATTERN.test(value) &&
      !PATH_LIKE_PATTERN.test(value) &&
      !hasUrlCredentials(value);
  }

  function hasUrlCredentials(value) {
    try {
      const parsed = new URL(value);
      return Boolean(parsed.username || parsed.password);
    } catch {
      return false;
    }
  }

  function summarizeString(value, keyName = "", options = {}) {
    const text = String(value);
    const sensitiveKey = SENSITIVE_KEY_PATTERN.test(String(keyName || ""));
    const suspicious =
      SECRET_TEXT_PATTERN.test(text) ||
      HIGH_ENTROPY_PATTERN.test(text) ||
      PATH_LIKE_PATTERN.test(text) ||
      hasUrlCredentials(text);
    const preserveSafeStrings = getOption(options, "preserveSafeStrings", true);

    if (!sensitiveKey && !suspicious && preserveSafeStrings && isSafeLabel(text)) {
      return text;
    }

    return {
      type: "string",
      length: text.length,
      lineCount: text ? text.split(/\r\n|\r|\n/).length : 0,
      redacted: true
    };
  }

  function sanitizeError(error) {
    const name = typeof error?.name === "string" && isSafeLabel(error.name) ? error.name : "Error";
    const code = typeof error?.code === "string" && isSafeLabel(error.code) ? error.code : undefined;
    const output = {
      type: "error",
      name,
      messageLength: typeof error?.message === "string" ? error.message.length : 0
    };

    if (code) {
      output.code = code;
    }

    return output;
  }

  function sanitizeValue(value, options, seen, depth, keyName) {
    if (value === null || typeof value === "boolean" || typeof value === "number") {
      return value;
    }

    if (typeof value === "undefined") {
      return { type: "undefined" };
    }

    if (typeof value === "bigint") {
      return { type: "bigint" };
    }

    if (typeof value === "symbol" || typeof value === "function") {
      return { type: typeof value };
    }

    if (typeof value === "string") {
      return summarizeString(value, keyName, options);
    }

    if (value instanceof Error) {
      return sanitizeError(value);
    }

    if (typeof value !== "object") {
      return { type: typeof value };
    }

    if (seen.has(value)) {
      return { type: "cycle" };
    }

    const maxDepth = Number(getOption(options, "maxDepth", DEFAULT_MAX_DEPTH));
    if (depth >= maxDepth) {
      return { type: Array.isArray(value) ? "array" : "object", truncated: true };
    }

    seen.add(value);

    if (Array.isArray(value)) {
      const maxArrayLength = Number(getOption(options, "maxArrayLength", DEFAULT_MAX_ARRAY_LENGTH));
      const items = value
        .slice(0, maxArrayLength)
        .map((item, index) => sanitizeValue(item, options, seen, depth + 1, `${keyName || "item"}[${index}]`));
      if (value.length > maxArrayLength) {
        items.push({ type: "truncated", remaining: value.length - maxArrayLength });
      }
      seen.delete(value);
      return items;
    }

    if (!isPlainObject(value)) {
      seen.delete(value);
      return { type: Object.prototype.toString.call(value).slice(8, -1).toLowerCase() || "object" };
    }

    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = sanitizeValue(entry, options, seen, depth + 1, key);
    }

    seen.delete(value);
    return output;
  }

  function sanitizeDebugPayload(payload, options = {}) {
    return sanitizeValue(payload, options, new WeakSet(), 0, "");
  }

  function safeConsoleCall(callback) {
    try {
      callback();
    } catch {
      // Debug logging must never affect page protection.
    }
  }

  function debugEvent(label, payload = {}, options = {}) {
    if (!isDebugEnabled(options)) return;

    const targetRoot = getOption(options, "root", root);
    const targetConsole = getOption(options, "console", targetRoot?.console);
    if (!targetConsole) return;

    const safeLabel = isSafeLabel(String(label || "")) ? String(label) : "debug-event";
    const safePayload = sanitizeDebugPayload(payload, options);

    safeConsoleCall(() => targetConsole.groupCollapsed?.(`[PWM] ${safeLabel}`));
    safeConsoleCall(() => targetConsole.log?.(safePayload));
    safeConsoleCall(() => targetConsole.groupEnd?.());
  }

  function debugSnapshot(label, snapshot = {}, options = {}) {
    debugEvent(label, snapshot, options);
  }

  function summarizeDebugText(text, options = {}) {
    const normalizeText =
      typeof options.normalizeText === "function" ? options.normalizeText : (value) => String(value || "");
    const normalizeVisiblePlaceholders =
      typeof options.normalizeVisiblePlaceholders === "function"
        ? options.normalizeVisiblePlaceholders
        : (value) => String(value || "");
    const normalized = normalizeText(normalizeVisiblePlaceholders(text));
    const placeholderTokenRegex = options.placeholderTokenRegex || /\[[A-Z_]+_\d+\]/g;
    const matches = normalized.match(new RegExp(placeholderTokenRegex.source, "g")) || [];

    return {
      length: normalized.length,
      lineCount: normalized ? normalized.split("\n").length : 0,
      placeholderCount: matches.length
    };
  }

  function collectComposerDebugSnapshot(input, expected, writeText, options = {}) {
    const getInputText = typeof options.getInputText === "function" ? options.getInputText : () => "";
    const normalizeText =
      typeof options.normalizeText === "function" ? options.normalizeText : (value) => String(value || "");
    const normalizeEditorInnerText =
      typeof options.normalizeEditorInnerText === "function" ? options.normalizeEditorInnerText : normalizeText;
    const normalizedExpected = normalizeText(expected);
    const normalizedWriteText = typeof writeText === "string" ? normalizeText(writeText) : normalizedExpected;
    const actual = getInputText(input);
    const innerText = normalizeText(input?.innerText || "");
    const snapshotOptions = {
      normalizeText,
      normalizeVisiblePlaceholders: options.normalizeVisiblePlaceholders,
      placeholderTokenRegex: options.placeholderTokenRegex
    };

    return {
      expected: summarizeDebugText(normalizedExpected, snapshotOptions),
      writeText: summarizeDebugText(normalizedWriteText, snapshotOptions),
      getInputText: summarizeDebugText(actual, snapshotOptions),
      innerText: summarizeDebugText(innerText, snapshotOptions),
      normalizedInnerText: summarizeDebugText(normalizeEditorInnerText(input?.innerText || ""), snapshotOptions),
      textContent: summarizeDebugText(input?.textContent || "", snapshotOptions),
      actualMatchesExpected: actual === normalizedExpected,
      actualMatchesWriteText: actual === normalizedWriteText
    };
  }

  root.PWM.DebugLogger = {
    isDebugEnabled,
    sanitizeDebugPayload,
    debugEvent,
    debugSnapshot,
    summarizeDebugText,
    collectComposerDebugSnapshot
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.DebugLogger;
  }
})();
