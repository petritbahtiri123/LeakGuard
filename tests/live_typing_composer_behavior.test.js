const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/knownSecretReuse.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/content/composer_helpers.js"));

const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const typingRunbook = fs.readFileSync(path.join(repoRoot, "docs/qa/live-typing-composer-qa.md"), "utf8");

const { Detector, ComposerHelpers } = globalThis.PWM;
const {
  shouldInterceptBeforeInput,
  spliceSelectionText,
  selectFindingsOverlappingInsertion
} = ComposerHelpers;

function extractFunctionSource(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `expected to find function ${name}`);
  const start = match.index;
  const openBrace = source.indexOf("{", source.indexOf("(", start));
  assert.notStrictEqual(openBrace, -1, `expected ${name} body`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`expected ${name} function to close`);
}

function scan(text) {
  return new Detector().scan(text).filter((finding) => finding.severity !== "low");
}

function assertIncludesAll(label, text, values) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} should include ${value}`);
  }
}

function testHarmlessTypingHasNoRelevantFindingsOrPlaceholders() {
  const originalText = "Write a concise troubleshooting plan";
  const insertedText = " for a slow dashboard";
  const selection = { start: originalText.length, end: originalText.length };
  const next = spliceSelectionText(originalText, selection, insertedText);
  const findings = scan(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, insertedText);

  assert.strictEqual(next.text, `${originalText}${insertedText}`);
  assert.strictEqual(relevant.length, 0, "harmless ordinary typing should not create relevant findings");
  assert.strictEqual(/\[PWM_\d+\]/.test(next.text), false, "harmless typing should not contain placeholders");
}

function testCompositionBeforeInputIsNotIntercepted() {
  assert.strictEqual(
    shouldInterceptBeforeInput({ inputType: "insertCompositionText", data: "かな", isComposing: true }),
    false,
    "IME composition text should not be intercepted mid-composition"
  );
}

function testSecretLikeTypingIsCurrentLiveRedactionSurface() {
  const originalText = "API_KEY=";
  const insertedText = "sk-test-abcdefghijklmnopqrstuvwxyz123456";
  const selection = { start: originalText.length, end: originalText.length };
  const next = spliceSelectionText(originalText, selection, insertedText);
  const findings = scan(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, insertedText);

  assert.ok(relevant.length > 0, "typed synthetic secret should be recognized before submit");
  assert.ok(
    contentSource.includes("applyTypedInterceptionRewrite(") && contentSource.includes("maybeHandleTypedSecrets"),
    "current architecture includes a pre-submit typed redaction surface for risky text"
  );
}

function testHarmlessBeforeInputReturnsBeforeConsumingOrRewriting() {
  const beforeInputSource = extractFunctionSource(contentSource, "maybeHandleBeforeInput");
  const noRiskReturn = "if (!quickRelevantFindings.length && !quickPlaceholderNormalizationChanged) {\n      return;\n    }";
  assert.ok(beforeInputSource.includes(noRiskReturn), "beforeinput should return for harmless typed text");
  assert.ok(
    beforeInputSource.indexOf(noRiskReturn) < beforeInputSource.indexOf("if (!event.defaultPrevented)"),
    "non-Firefox harmless beforeinput return should occur before event consumption"
  );
  assert.ok(
    beforeInputSource.indexOf(noRiskReturn) < beforeInputSource.indexOf("applyTypedInterceptionRewrite("),
    "harmless beforeinput return should occur before composer rewrite"
  );
}

function testDelayedTypedScanGuardsAgainstStaleComposerOverwrite() {
  const typedScanSource = extractFunctionSource(contentSource, "maybeHandleTypedSecrets");
  assert.ok(
    typedScanSource.includes("if (scanGeneration !== typedScanGeneration) return;"),
    "delayed typed scan should abandon stale scan generations before decisions"
  );
  assert.ok(
    typedScanSource.includes("const latestText = getInputText(latestInput);") &&
      typedScanSource.includes("if (latestText !== text)"),
    "delayed typed scan should re-read the current composer before rewriting"
  );
  assert.ok(
    typedScanSource.indexOf("if (latestText !== text)") < typedScanSource.indexOf("applyComposerText(latestInput"),
    "stale composer check should happen before delayed live rewrite"
  );
  assert.ok(
    typedScanSource.includes("restoreText: analysis.normalizedText") &&
      typedScanSource.includes("restoreCaretOffset: analysis.normalizedText.length"),
    "delayed live rewrite should provide restore text/caret data on failure"
  );
}

function testNormalTypingDoesNotCreateFilePendingPayloads() {
  const beforeInputSource = extractFunctionSource(contentSource, "maybeHandleBeforeInput");
  const typedScanSource = extractFunctionSource(contentSource, "maybeHandleTypedSecrets");
  assert.strictEqual(beforeInputSource.includes("queuePendingSanitizedFileHandoff"), false);
  assert.strictEqual(typedScanSource.includes("queuePendingSanitizedFileHandoff"), false);
  assert.strictEqual(typedScanSource.includes("pendingSanitizedFileHandoff"), false);
}

function testRunbookDocumentsLiveTypingRiskAndQa() {
  assertIncludesAll("live typing runbook", typingRunbook, [
    "Normal typing role",
    "Harmless text: no rewrite",
    "not strictly submit-only",
    "typed high-confidence secrets can be redacted before submit",
    "Cursor remains where the user left it",
    "Mid-paragraph insertion",
    "Undo/redo still works",
    "IME/composition safety",
    "Gemini and ChatGPT risk checks",
    "policy-gated"
  ]);
}

function run() {
  testHarmlessTypingHasNoRelevantFindingsOrPlaceholders();
  testCompositionBeforeInputIsNotIntercepted();
  testSecretLikeTypingIsCurrentLiveRedactionSurface();
  testHarmlessBeforeInputReturnsBeforeConsumingOrRewriting();
  testDelayedTypedScanGuardsAgainstStaleComposerOverwrite();
  testNormalTypingDoesNotCreateFilePendingPayloads();
  testRunbookDocumentsLiveTypingRiskAndQa();
  console.log("PASS live typing composer behavior regressions");
}

run();
