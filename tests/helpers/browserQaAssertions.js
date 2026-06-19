const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BROWSER_QA_FAILURE_CODES = Object.freeze({
  EXTENSION_NOT_LOADED: "EXTENSION_NOT_LOADED",
  PROTECTED_SITE_INACTIVE: "PROTECTED_SITE_INACTIVE",
  CONTENT_SCRIPT_NOT_READY: "CONTENT_SCRIPT_NOT_READY",
  ADAPTER_SELECTOR_MISSING: "ADAPTER_SELECTOR_MISSING",
  TEXT_TYPED_REDACTION_FAILED: "TEXT_TYPED_REDACTION_FAILED",
  TEXT_PASTE_REDACTION_FAILED: "TEXT_PASTE_REDACTION_FAILED",
  FILE_INPUT_REDACTION_FAILED: "FILE_INPUT_REDACTION_FAILED",
  FILE_DROP_REDACTION_FAILED: "FILE_DROP_REDACTION_FAILED",
  MULTI_FILE_LIMIT_EXCEEDED: "MULTI_FILE_LIMIT_EXCEEDED",
  MULTI_FILE_PARTIAL_BLOCKED: "MULTI_FILE_PARTIAL_BLOCKED",
  MULTI_FILE_PENDING_ATTACH_FAILED: "MULTI_FILE_PENDING_ATTACH_FAILED",
  DETECTOR_MISS: "DETECTOR_MISS",
  ENTROPY_MISS: "ENTROPY_MISS",
  ONIX_MISS: "ONIX_MISS",
  PLACEHOLDER_MISSING: "PLACEHOLDER_MISSING",
  PLACEHOLDER_REREDACTED: "PLACEHOLDER_REREDACTED",
  RAW_SECRET_VISIBLE: "RAW_SECRET_VISIBLE",
  RAW_FILE_FALLBACK: "RAW_FILE_FALLBACK",
  SAFE_CONTROL_REDACTED: "SAFE_CONTROL_REDACTED",
  FILE_EXTRACTION_FAILED: "FILE_EXTRACTION_FAILED",
  REDACTED_FILE_MISSING: "REDACTED_FILE_MISSING",
  SANITIZED_HANDOFF_FAILED: "SANITIZED_HANDOFF_FAILED",
  UNSUPPORTED_FILE_NOT_BLOCKED: "UNSUPPORTED_FILE_NOT_BLOCKED",
  DEBUG_RAW_LEAK: "DEBUG_RAW_LEAK",
  QA_FIXTURE_INVALID: "QA_FIXTURE_INVALID",
  UI_TIMEOUT: "UI_TIMEOUT",
  BROWSER_PERMISSION_FAILURE: "BROWSER_PERMISSION_FAILURE",
  SCRIPT_ORDER_REGRESSION: "SCRIPT_ORDER_REGRESSION"
});

const PLACEHOLDER_PATTERN = /\[[A-Z_]+_\d+(?:_[A-Z]+_\d+|_[A-Z]+)*\]/g;
const SYNTHETIC_TOKEN_PATTERNS = [
  /\bsk-proj-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk-ant-api03-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk_live_[A-Za-z0-9_-]{12,}\b/g,
  /\bghp_[A-Za-z0-9_-]{12,}\b/g,
  /\bsynthetic-LGQA-[A-Za-z0-9_-]+-raw-[A-Za-z0-9_-]+\b/g
];

const REAL_RISK_CODES = new Set([
  BROWSER_QA_FAILURE_CODES.RAW_SECRET_VISIBLE,
  BROWSER_QA_FAILURE_CODES.RAW_FILE_FALLBACK,
  BROWSER_QA_FAILURE_CODES.DEBUG_RAW_LEAK,
  BROWSER_QA_FAILURE_CODES.SANITIZED_HANDOFF_FAILED,
  BROWSER_QA_FAILURE_CODES.MULTI_FILE_LIMIT_EXCEEDED,
  BROWSER_QA_FAILURE_CODES.UNSUPPORTED_FILE_NOT_BLOCKED,
  BROWSER_QA_FAILURE_CODES.PLACEHOLDER_REREDACTED
]);

function normalizeCanaries(canaries = []) {
  return (canaries || [])
    .filter((canary) => canary && canary.id)
    .map((canary) => ({
      id: String(canary.id),
      value: canary.value == null ? "" : String(canary.value),
      expectedPlaceholder: canary.expectedPlaceholder || "[PWM_N]",
      safeControlId: canary.safeControlId || ""
    }))
    .filter((canary) => canary.value);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function placeholderCount(value) {
  return (String(value || "").match(PLACEHOLDER_PATTERN) || []).length;
}

function stringifyForScan(value, seen = new WeakSet()) {
  if (value == null) return "";
  if (Buffer.isBuffer(value)) return value.toString("latin1");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("latin1");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "symbol" || typeof value === "function") return String(value);
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    try {
      return JSON.stringify(value, (_key, item) => {
        if (Buffer.isBuffer(item)) {
          return { type: "Buffer", byteLength: item.byteLength };
        }
        if (item instanceof Uint8Array) {
          return { type: "Uint8Array", byteLength: item.byteLength };
        }
        if (typeof item === "bigint") return String(item);
        return item;
      });
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function findLeakedCanaryIds(value, canaries = []) {
  const text = stringifyForScan(value);
  return normalizeCanaries(canaries)
    .filter((canary) => canary.value && text.includes(canary.value))
    .map((canary) => canary.id);
}

function hasSyntheticTokenLikeValue(value) {
  const text = stringifyForScan(value);
  return SYNTHETIC_TOKEN_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function sanitizeBrowserQaText(value, canaries = []) {
  let text = stringifyForScan(value);
  text = text
    .replace(/"byteValues"\s*:\s*\[(?:\s*\d+\s*,?)*\]/g, '"byteValues":"[ByteArray omitted]"')
    .replace(/"data"\s*:\s*\[(?:\s*\d+\s*,?)*\]/g, '"data":"[ByteArray omitted]"');
  const sortedCanaries = normalizeCanaries(canaries).sort((left, right) => right.value.length - left.value.length);
  for (const canary of sortedCanaries) {
    text = text.split(canary.value).join(`[${canary.id}]`);
  }
  for (const pattern of SYNTHETIC_TOKEN_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, "[REDACTED_SYNTHETIC_TOKEN]");
  }
  return text;
}

function truncate(text, maxLength = 240) {
  const source = String(text || "");
  if (source.length <= maxLength) return source;
  return `${source.slice(0, maxLength)}...<truncated:${source.length - maxLength}>`;
}

function sanitizeBrowserQaValue(value, canaries = [], depth = 0) {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return truncate(sanitizeBrowserQaText(value, canaries));
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const text = stringifyForScan(value);
    return {
      byteLength: value.byteLength,
      placeholderCount: placeholderCount(text),
      canaryIdsVisible: findLeakedCanaryIds(text, canaries)
    };
  }
  if (depth > 6) return "[MaxDepth]";
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeBrowserQaValue(item, canaries, depth + 1));
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      if (
        Array.isArray(item) &&
        /^(?:byteValues|data)$/i.test(key) &&
        item.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255)
      ) {
        output[key] = {
          byteLength: item.length,
          bytePrefix: item.slice(0, 12),
          byteSum: item.reduce((sum, entry) => sum + entry, 0)
        };
      } else {
        output[key] = sanitizeBrowserQaValue(item, canaries, depth + 1);
      }
    }
    return output;
  }
  return sanitizeBrowserQaText(String(value), canaries);
}

function summarizeBrowserQaValue(value, canaries = []) {
  const text = stringifyForScan(value);
  const summary = {
    type: Buffer.isBuffer(value) ? "buffer" : Array.isArray(value) ? "array" : typeof value,
    length: text.length,
    placeholderCount: placeholderCount(text),
    canaryIdsVisible: findLeakedCanaryIds(text, canaries)
  };
  if (typeof value === "object" && value && !Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    Object.assign(summary, sanitizeBrowserQaValue(value, canaries));
  } else if (typeof value === "string") {
    summary.safePreview = truncate(sanitizeBrowserQaText(value, canaries));
  }
  return summary;
}

function formatSummary(summary, canaries = []) {
  const safeSummary = sanitizeBrowserQaValue(summary, canaries);
  if (typeof safeSummary === "string") return safeSummary;
  if (!safeSummary || typeof safeSummary !== "object") return String(safeSummary);
  return Object.entries(safeSummary)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ");
}

function classifyRisk(failureCode) {
  return REAL_RISK_CODES.has(failureCode) ? "real security risk" : "UI/test harness issue";
}

function normalizeContext(context = {}) {
  const secretCanaries = normalizeCanaries(context.secretCanaries || context.canaries || []);
  return {
    browserName: context.browserName || context.browser || "unknown browser",
    siteLabel: context.siteLabel || context.site || "unknown site",
    adapter: context.adapter || context.siteLabel || "unknown adapter",
    inputPath: context.inputPath || "unknown input path",
    stage: context.stage || "unknown stage",
    testName: context.testName || "browser QA",
    stepName: context.stepName || "",
    expected: context.expected || "expected browser QA condition to hold",
    actualSummary: context.actualSummary,
    secretCanaries,
    secretIdsChecked: context.secretIdsChecked || secretCanaries.map((canary) => canary.id),
    safeControlIdsChecked: context.safeControlIdsChecked || [],
    placeholderCount: context.placeholderCount,
    screenshotPath: context.screenshotPath || "",
    consoleLogSummary: context.consoleLogSummary || null,
    networkSummary: context.networkSummary || null,
    recommendation: context.recommendation || context.hint || "Inspect the classified stage and nearest adapter/harness assertion.",
    failureCode: context.failureCode || BROWSER_QA_FAILURE_CODES.UI_TIMEOUT,
    risk: context.risk || null
  };
}

function buildFailureMessage(details) {
  const context = normalizeContext(details);
  const failureCode = details.failureCode || context.failureCode;
  const actualSummary =
    details.actualSummary === undefined ? context.actualSummary : details.actualSummary;
  const summary =
    actualSummary === undefined
      ? "no safe actual summary provided"
      : formatSummary(actualSummary, context.secretCanaries);
  const secretIds = unique([
    ...(details.secretIdsChecked || []),
    ...context.secretIdsChecked,
    ...findLeakedCanaryIds(actualSummary, context.secretCanaries)
  ]);
  const risk = details.risk || context.risk || classifyRisk(failureCode);

  return sanitizeBrowserQaText(
    [
      `${failureCode}: ${context.browserName} / ${context.siteLabel} / ${context.inputPath} / ${context.stage}.`,
      details.reason || "Browser QA assertion failed.",
      `Expected ${context.expected}.`,
      `Actual summary: ${summary}.`,
      secretIds.length ? `Secret canaries checked: ${secretIds.join(", ")}.` : "",
      context.safeControlIdsChecked.length
        ? `Safe controls checked: ${context.safeControlIdsChecked.join(", ")}.`
        : "",
      `Safety assessment: ${risk}.`,
      context.recommendation
    ]
      .filter(Boolean)
      .join(" "),
    context.secretCanaries
  );
}

class BrowserQaAssertionError extends Error {
  constructor(details = {}) {
    const context = normalizeContext(details);
    const failureCode = details.failureCode || context.failureCode;
    const actualSummary =
      details.actualSummary === undefined ? context.actualSummary : details.actualSummary;
    const message = buildFailureMessage({ ...context, ...details, failureCode, actualSummary });
    super(message);
    this.name = "BrowserQaAssertionError";
    this.failureCode = failureCode;
    this.browserName = context.browserName;
    this.siteLabel = context.siteLabel;
    this.adapter = context.adapter;
    this.inputPath = context.inputPath;
    this.stage = context.stage;
    this.testName = context.testName;
    this.stepName = details.stepName || context.stepName;
    this.expected = context.expected;
    this.actualSummary = sanitizeBrowserQaValue(actualSummary, context.secretCanaries);
    this.secretIdsChecked = unique([
      ...(details.secretIdsChecked || []),
      ...context.secretIdsChecked,
      ...findLeakedCanaryIds(actualSummary, context.secretCanaries)
    ]);
    this.safeControlIdsChecked = unique([
      ...(details.safeControlIdsChecked || []),
      ...context.safeControlIdsChecked
    ]);
    this.placeholderCount =
      details.placeholderCount ?? context.placeholderCount ?? placeholderCount(stringifyForScan(actualSummary));
    this.screenshotPath = context.screenshotPath;
    this.consoleLogSummary = sanitizeBrowserQaValue(context.consoleLogSummary, context.secretCanaries);
    this.networkSummary = sanitizeBrowserQaValue(context.networkSummary, context.secretCanaries);
    this.recommendation = sanitizeBrowserQaText(context.recommendation, context.secretCanaries);
    this.risk = details.risk || context.risk || classifyRisk(failureCode);
    if (details.cause) {
      this.cause = {
        name: details.cause?.name || "Error",
        message: sanitizeBrowserQaText(details.cause?.message || details.cause, context.secretCanaries)
      };
    }
  }

  toReportEntry() {
    return {
      browser: this.browserName,
      siteLabel: this.siteLabel,
      adapter: this.adapter,
      testName: this.testName,
      stepName: this.stepName,
      inputPath: this.inputPath,
      stage: this.stage,
      status: "failed",
      failureCode: this.failureCode,
      expected: this.expected,
      actualSummary: this.actualSummary,
      secretIdsChecked: this.secretIdsChecked,
      safeControlIdsChecked: this.safeControlIdsChecked,
      placeholderCount: this.placeholderCount,
      screenshotPath: this.screenshotPath || undefined,
      consoleLogSummary: this.consoleLogSummary || undefined,
      networkSummary: this.networkSummary || undefined,
      recommendation: this.recommendation,
      risk: this.risk
    };
  }
}

function createBrowserQaError(details) {
  return new BrowserQaAssertionError(details);
}

function throwBrowserQaError(details) {
  throw createBrowserQaError(details);
}

function assertExtensionLoaded(extensionState, context = {}) {
  const id =
    typeof extensionState === "string"
      ? extensionState
      : extensionState?.extensionId || extensionState?.id || "";
  if (!id) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.EXTENSION_NOT_LOADED,
      stage: context.stage || "extension not loaded",
      expected: context.expected || "extension id available after browser startup",
      actualSummary: extensionState,
      reason: "LeakGuard extension was not loaded into the browser context."
    });
  }
  return true;
}

function assertProtectedSiteActive(state, siteLabel, context = {}) {
  const panelText = typeof state === "string" ? state : state?.panelText || state?.text || "";
  const active =
    state?.protected === true ||
    state?.active === true ||
    (/LeakGuard/i.test(panelText) && /PROTECTION\s+Active/i.test(panelText));
  if (!active) {
    throwBrowserQaError({
      ...context,
      siteLabel: siteLabel || context.siteLabel,
      failureCode: BROWSER_QA_FAILURE_CODES.PROTECTED_SITE_INACTIVE,
      stage: context.stage || "protected site not active",
      expected: context.expected || "LeakGuard protected-site panel reports PROTECTION Active",
      actualSummary: state,
      reason: "Protected-site activation was not observed."
    });
  }
  return true;
}

function assertContentScriptReady(state, context = {}) {
  const ready =
    state === true ||
    state?.ready === true ||
    state?.contentScriptReady === true ||
    Boolean(state?.panelText || state?.hasPanel);
  if (!ready) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.CONTENT_SCRIPT_NOT_READY,
      stage: context.stage || "content script not injected",
      expected: context.expected || "content script readiness marker or protected panel present",
      actualSummary: state,
      reason: "Content script readiness was not observed."
    });
  }
  return true;
}

function assertNoRawSecretVisible(state, secretIdsOrCanaries, context = {}) {
  const canaries =
    Array.isArray(secretIdsOrCanaries) && secretIdsOrCanaries.every((item) => typeof item === "string")
      ? normalizeCanaries(context.secretCanaries).filter((canary) => secretIdsOrCanaries.includes(canary.id))
      : normalizeCanaries(secretIdsOrCanaries || context.secretCanaries);
  const leakedIds = findLeakedCanaryIds(state, canaries);
  if (leakedIds.length) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.RAW_SECRET_VISIBLE,
      stage: context.stage || "UI rewrite failed",
      expected: context.expected || "raw canary absent from visible page state",
      actualSummary: summarizeBrowserQaValue(state, canaries),
      secretIdsChecked: canaries.map((canary) => canary.id),
      reason: `Secret canary ${leakedIds.join(", ")} was still visible after browser QA action.`,
      recommendation:
        context.recommendation ||
        "Likely cause: detector miss, placeholder allocation failure, or rewrite pipeline skipped."
    });
  }
  return true;
}

function assertExpectedPlaceholdersVisible(state, expectedCountOrIds = 1, context = {}) {
  const text = stringifyForScan(state);
  const count = placeholderCount(text);
  let ok = false;
  if (typeof expectedCountOrIds === "number") {
    ok = count >= expectedCountOrIds;
  } else if (Array.isArray(expectedCountOrIds)) {
    ok = expectedCountOrIds.every((expected) => text.includes(expected));
  } else {
    ok = count > 0;
  }

  if (!ok) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.PLACEHOLDER_MISSING,
      stage: context.stage || "placeholder allocation failed",
      expected:
        context.expected ||
        `at least ${typeof expectedCountOrIds === "number" ? expectedCountOrIds : 1} placeholder(s) visible`,
      actualSummary: summarizeBrowserQaValue(state, context.secretCanaries),
      placeholderCount: count,
      reason: "Expected placeholder visibility was not observed.",
      recommendation:
        context.recommendation ||
        "Likely cause: detector did not match, entropy did not trigger, or placeholder allocation failed."
    });
  }
  return true;
}

function assertSafeControlsVisible(state, safeControlIds = [], context = {}) {
  const text = stringifyForScan(state);
  const missing = safeControlIds.filter((controlId) => !text.includes(controlId));
  if (missing.length) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.SAFE_CONTROL_REDACTED,
      stage: context.stage || "UI rewrite failed",
      expected: context.expected || "paired safe controls remain visible",
      actualSummary: summarizeBrowserQaValue(state, context.secretCanaries),
      safeControlIdsChecked: safeControlIds,
      reason: `Safe control(s) missing after browser QA action: ${missing.join(", ")}.`,
      recommendation:
        context.recommendation ||
        "Likely cause: rewrite scope was too broad or the local QA fixture changed unexpectedly."
    });
  }
  return true;
}

function assertNoRawFileFallback(eventLog, context = {}) {
  const canaries = normalizeCanaries(context.secretCanaries);
  const text = stringifyForScan(eventLog);
  const leakedIds = findLeakedCanaryIds(text, canaries);
  const rawFallback =
    /rawFallback["']?\s*:\s*true/i.test(text) ||
    /original(?:File|Upload|Image|Docx|Xlsx|Pdf)Present["']?\s*:\s*true/i.test(text);
  if (rawFallback || leakedIds.length) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.RAW_FILE_FALLBACK,
      stage: context.stage || "raw fallback happened",
      expected: context.expected || "sanitized handoff succeeds or raw upload is blocked",
      actualSummary: summarizeBrowserQaValue(eventLog, canaries),
      secretIdsChecked: canaries.map((canary) => canary.id),
      reason: leakedIds.length
        ? `Raw file fallback exposed canary ${leakedIds.join(", ")}.`
        : "Raw file fallback marker was present in the file handoff event log.",
      recommendation:
        context.recommendation ||
        "Likely cause: sanitized handoff failed and the adapter allowed the original file path to continue."
    });
  }
  return true;
}

function assertDebugOutputMetadataOnly(logs, context = {}) {
  const canaries = normalizeCanaries(context.secretCanaries);
  const leakedIds = findLeakedCanaryIds(logs, canaries);
  if (leakedIds.length || hasSyntheticTokenLikeValue(logs)) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.DEBUG_RAW_LEAK,
      stage: context.stage || "debug leak detected",
      expected: context.expected || "debug output contains metadata only",
      actualSummary: summarizeBrowserQaValue(logs, canaries),
      secretIdsChecked: canaries.map((canary) => canary.id),
      reason: leakedIds.length
        ? `Debug output contained raw canary ${leakedIds.join(", ")}.`
        : "Debug output contained a synthetic token-shaped value.",
      recommendation:
        context.recommendation ||
        "Likely cause: debug logging used raw payload text instead of safe metadata summaries."
    });
  }
  return true;
}

function assertFileHandoffResult(result, expected = {}, context = {}) {
  const canaries = normalizeCanaries(context.secretCanaries);
  assertNoRawSecretVisible(result, canaries, {
    ...context,
    stage: context.stage || "sanitized handoff failed",
    expected: context.expected || "file handoff result is sanitized"
  });
  if (expected.rawFallbackBlocked && result?.rawFallback) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.RAW_FILE_FALLBACK,
      stage: context.stage || "raw fallback happened",
      expected: "raw fallback blocked",
      actualSummary: result,
      reason: "File handoff reported rawFallback=true."
    });
  }
  if (result?.ok === false) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.SANITIZED_HANDOFF_FAILED,
      stage: context.stage || "sanitized handoff failed",
      expected: context.expected || "sanitized file handoff succeeds or blocks safely",
      actualSummary: result,
      reason: "File handoff reported failure."
    });
  }
  const resultText = stringifyForScan(result);
  if (expected.placeholderRequired && placeholderCount(resultText) < 1 && Number(result?.placeholderCount || 0) < 1) {
    throwBrowserQaError({
      ...context,
      failureCode: BROWSER_QA_FAILURE_CODES.REDACTED_FILE_MISSING,
      stage: context.stage || "redacted file generation failed",
      expected: context.expected || "redacted file contains at least one placeholder",
      actualSummary: result,
      reason: "Redacted handoff result did not include a placeholder marker."
    });
  }
  return true;
}

function inferFailureCode(error, context = {}) {
  if (context.failureCode) return context.failureCode;
  const message = String(error?.message || error || "");
  if (/extension.*not.*load|load.*extension/i.test(message)) return BROWSER_QA_FAILURE_CODES.EXTENSION_NOT_LOADED;
  if (/content script/i.test(message)) return BROWSER_QA_FAILURE_CODES.CONTENT_SCRIPT_NOT_READY;
  if (/selector|element.*not.*found/i.test(message)) return BROWSER_QA_FAILURE_CODES.ADAPTER_SELECTOR_MISSING;
  if (/permission/i.test(message)) return BROWSER_QA_FAILURE_CODES.BROWSER_PERMISSION_FAILURE;
  if (/timed out|timeout/i.test(message)) return BROWSER_QA_FAILURE_CODES.UI_TIMEOUT;
  return BROWSER_QA_FAILURE_CODES.UI_TIMEOUT;
}

async function assertBrowserQaStep(stepName, fn, context = {}, reporter = null) {
  const startedAt = Date.now();
  const stepContext = normalizeContext({ ...context, stepName });
  try {
    const result = await fn();
    reporter?.recordStep({
      ...stepContext,
      stepName,
      status: "passed",
      durationMs: Date.now() - startedAt,
      actualSummary: context.actualSummary || summarizeBrowserQaValue(result, stepContext.secretCanaries),
      failureCode: null
    });
    return result;
  } catch (error) {
    const qaError =
      error instanceof BrowserQaAssertionError
        ? error
        : new BrowserQaAssertionError({
            ...stepContext,
            stepName,
            failureCode: inferFailureCode(error, stepContext),
            actualSummary: context.actualSummary || error?.message || error,
            reason: error?.message || "Browser QA step failed.",
            cause: error
          });
    qaError.stepName = stepName;
    reporter?.recordStep({
      ...qaError.toReportEntry(),
      stepName,
      durationMs: Date.now() - startedAt,
      status: "failed"
    });
    throw qaError;
  }
}

function createBrowserQaReporter(options = {}) {
  const secretCanaries = normalizeCanaries(options.secretCanaries || []);
  const report = {
    runId:
      options.runId ||
      `browser-qa-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}`,
    timestamp: options.timestamp || new Date().toISOString(),
    browser: options.browser || options.browserName || "unknown browser",
    extensionBuildPath: options.extensionBuildPath || "",
    siteLabel: options.siteLabel || "",
    adapter: options.adapter || "",
    testName: options.testName || "browser QA",
    steps: []
  };
  const outputPath =
    options.outputPath ||
    path.join(process.cwd(), "artifacts", "browser-qa", "browser-qa-report.json");

  return {
    report,
    outputPath,
    recordStep(step = {}) {
      const context = normalizeContext({
        ...step,
        browserName: step.browserName || step.browser || report.browser,
        siteLabel: step.siteLabel || report.siteLabel,
        adapter: step.adapter || report.adapter,
        testName: step.testName || report.testName,
        secretCanaries
      });
      const entry = {
        timestamp: new Date().toISOString(),
        browser: context.browserName,
        extensionBuildPath: report.extensionBuildPath,
        siteLabel: context.siteLabel,
        adapter: context.adapter,
        testName: context.testName,
        stepName: step.stepName || context.stepName,
        inputPath: context.inputPath,
        stage: context.stage,
        status: step.status || "unknown",
        failureCode: step.failureCode || null,
        expected: context.expected,
        actualSummary: sanitizeBrowserQaValue(step.actualSummary ?? context.actualSummary, secretCanaries),
        secretIdsChecked: unique(step.secretIdsChecked || context.secretIdsChecked),
        safeControlIdsChecked: unique(step.safeControlIdsChecked || context.safeControlIdsChecked),
        placeholderCount:
          step.placeholderCount ??
          context.placeholderCount ??
          placeholderCount(stringifyForScan(step.actualSummary ?? context.actualSummary)),
        screenshotPath: step.screenshotPath || context.screenshotPath || undefined,
        consoleLogSummary: sanitizeBrowserQaValue(
          step.consoleLogSummary || context.consoleLogSummary || undefined,
          secretCanaries
        ),
        networkSummary: sanitizeBrowserQaValue(
          step.networkSummary || context.networkSummary || undefined,
          secretCanaries
        ),
        recommendation: sanitizeBrowserQaText(step.recommendation || context.recommendation, secretCanaries),
        risk: step.risk || context.risk || (step.failureCode ? classifyRisk(step.failureCode) : "none"),
        durationMs: step.durationMs
      };
      report.steps.push(entry);
      return entry;
    },
    write() {
      const safeReport = sanitizeBrowserQaValue(report, secretCanaries);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(safeReport, null, 2)}\n`);
      return outputPath;
    }
  };
}

function safeSlug(value, canaries = []) {
  return sanitizeBrowserQaText(value, canaries)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, "redacted-canary")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "browser-qa";
}

function safeBrowserQaScreenshotPath({
  screenshotsDir = path.join(process.cwd(), "artifacts", "browser-qa", "screenshots"),
  browserName = "browser",
  testName = "browser QA",
  stepName = "failure",
  secretCanaries = []
} = {}) {
  const nameBase = `${safeSlug(browserName, secretCanaries)}-${safeSlug(testName, secretCanaries)}-${safeSlug(
    stepName,
    secretCanaries
  )}`;
  const hash = crypto
    .createHash("sha256")
    .update(`${browserName}\0${testName}\0${stepName}`)
    .digest("hex")
    .slice(0, 8);
  return path.join(screenshotsDir, `${nameBase}-${hash}.png`);
}

function extractConsoleMessage(event) {
  if (!event) return "";
  if (event.method === "Runtime.consoleAPICalled") {
    return (event.params?.args || [])
      .map((arg) => arg.value ?? arg.description ?? arg.unserializableValue ?? "")
      .join(" ");
  }
  if (event.method === "Log.entryAdded") {
    return event.params?.entry?.text || "";
  }
  if (event.method === "Runtime.exceptionThrown") {
    return event.params?.exceptionDetails?.text || event.params?.exceptionDetails?.exception?.description || "";
  }
  return event.message || event.text || "";
}

function classifyConsoleMessage(message, leakedIds = []) {
  const text = String(message || "");
  const classes = [];
  if (leakedIds.length || hasSyntheticTokenLikeValue(text)) classes.push("debug leak detected");
  if (/content script/i.test(text)) classes.push("content script missing");
  if (/selector|querySelector|element.*not.*found/i.test(text)) classes.push("adapter selector failed");
  if (/handoff|upload|file/i.test(text) && /fail|error/i.test(text)) classes.push("file handoff failed");
  if (/content security policy|CSP|blocked/i.test(text)) classes.push("CSP/blocking issue");
  if (/runtime\.lastError|extension context invalidated|moz-extension|chrome-extension/i.test(text)) {
    classes.push("extension runtime error");
  }
  return classes;
}

function summarizeBrowserConsoleLogs(events = [], canaries = []) {
  const secretCanaries = normalizeCanaries(canaries);
  const entries = [];
  let errorCount = 0;
  let warningCount = 0;
  const classifications = [];

  for (const event of events || []) {
    if (!event || !["Runtime.consoleAPICalled", "Log.entryAdded", "Runtime.exceptionThrown"].includes(event.method)) {
      continue;
    }
    const level =
      event.params?.type ||
      event.params?.entry?.level ||
      (event.method === "Runtime.exceptionThrown" ? "error" : "log");
    const message = extractConsoleMessage(event);
    const leakedIds = findLeakedCanaryIds(message, secretCanaries);
    const eventClasses = classifyConsoleMessage(message, leakedIds);
    if (/error|assert/i.test(level) || event.method === "Runtime.exceptionThrown") errorCount += 1;
    if (/warn/i.test(level)) warningCount += 1;
    classifications.push(...eventClasses);
    entries.push({
      level,
      messageLength: String(message || "").length,
      safeMessage: truncate(sanitizeBrowserQaText(message, secretCanaries), 160),
      canaryIdsVisible: leakedIds,
      classifications: eventClasses
    });
  }

  return {
    errorCount,
    warningCount,
    classifications: unique(classifications),
    entries: entries.slice(-20)
  };
}

module.exports = {
  BROWSER_QA_FAILURE_CODES,
  BrowserQaAssertionError,
  assertBrowserQaStep,
  assertContentScriptReady,
  assertDebugOutputMetadataOnly,
  assertExpectedPlaceholdersVisible,
  assertExtensionLoaded,
  assertFileHandoffResult,
  assertNoRawFileFallback,
  assertNoRawSecretVisible,
  assertProtectedSiteActive,
  assertSafeControlsVisible,
  createBrowserQaError,
  createBrowserQaReporter,
  findLeakedCanaryIds,
  placeholderCount,
  safeBrowserQaScreenshotPath,
  sanitizeBrowserQaText,
  sanitizeBrowserQaValue,
  summarizeBrowserConsoleLogs,
  summarizeBrowserQaValue
};
