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
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/content/composer_helpers.js"));

const {
  Detector,
  normalizeVisiblePlaceholders,
  buildNetworkUiFindings,
  ComposerHelpers
} = globalThis.PWM;
const {
  spliceSelectionText,
  shouldInterceptBeforeInput,
  selectFindingsOverlappingInsertion,
  deriveRewriteCaretOffset
} = ComposerHelpers;

const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");

function analyze(text) {
  return new Detector().scan(text).filter((finding) => finding.severity !== "low");
}

function testBeforeInputGuardStaysConservative() {
  assert.strictEqual(
    shouldInterceptBeforeInput({ inputType: "insertText", data: "a" }),
    true,
    "plain text insertion should be intercepted before commit"
  );
  assert.strictEqual(
    shouldInterceptBeforeInput({ inputType: "insertReplacementText", data: "secret" }),
    true,
    "replacement text insertion should be intercepted before commit"
  );
  assert.strictEqual(
    shouldInterceptBeforeInput({ inputType: "insertFromPaste", data: "secret" }),
    false,
    "paste-like beforeinput should stay on the dedicated paste path"
  );
  assert.strictEqual(
    shouldInterceptBeforeInput({ inputType: "insertCompositionText", data: "s", isComposing: true }),
    false,
    "composition input should remain on the conservative fallback path"
  );
}

function testTypedAssignmentSecretIsCaughtBeforeCommit() {
  const currentText = "API_KEY=";
  const selection = { start: currentText.length, end: currentText.length };
  const next = spliceSelectionText(currentText, selection, "abc123secretvalue");
  const findings = analyze(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, "abc123secretvalue");

  assert.ok(findings.length > 0, "typed assignment secret should produce findings");
  assert.ok(relevant.length > 0, "typed insertion should surface relevant findings before commit");
  assert.strictEqual(
    relevant[0].raw,
    "abc123secretvalue",
    "the typed raw secret should be the finding targeted by beforeinput interception"
  );
}

function testTypedPublicIpUsesSameDecisionFlow() {
  const currentText = "Allow ";
  const selection = { start: currentText.length, end: currentText.length };
  const next = spliceSelectionText(currentText, selection, "8.8.8.8");
  const findings = buildNetworkUiFindings(next.text, { mode: "hide_public" });
  const relevant = selectFindingsOverlappingInsertion(findings, selection, "8.8.8.8");

  assert.ok(findings.length > 0, "typed public IP should produce UI findings");
  assert.ok(relevant.length > 0, "typed public IP should feed the same allow-once/redact modal");
  assert.strictEqual(relevant[0].raw, "8.8.8.8");
}

function testPlaceholderNormalizationCanHappenBeforeCommit() {
  const currentText = "DB_PASSWORD=";
  const selection = { start: currentText.length, end: currentText.length };
  const next = spliceSelectionText(currentText, selection, "[PASSWORD_2]");
  const normalized = normalizeVisiblePlaceholders(next.text);

  assert.ok(
    /^DB_PASSWORD=\[PWM_\d+\]$/.test(normalized),
    "legacy typed placeholders should normalize to canonical PWM placeholders before commit"
  );
}

function testCaretDerivationPrefersOriginalSuffixAnchor() {
  const expectedText = "prefix [PWM_1] suffix";
  const caretOffset = deriveRewriteCaretOffset(expectedText, " suffix");

  assert.strictEqual(
    caretOffset,
    expectedText.indexOf(" suffix"),
    "caret restoration should stay anchored ahead of the untouched suffix when possible"
  );
}

function testContentScriptBindsBeforeInputAndKeepsFallbackGuard() {
  assert.ok(
    contentSource.includes('"beforeinput"'),
    "content script should bind a beforeinput listener for early typed interception"
  );
  assert.ok(
    contentSource.includes("suppressInputScanUntil"),
    "content script should guard against reprocessing PWM-authored writes"
  );
  assert.ok(
    contentSource.includes('document.addEventListener("input", scheduleInputScan, true);'),
    "content script should keep the delayed input scan as a fallback safety net"
  );
  assert.ok(
    contentSource.includes('event.key === "Enter" || event.key === " "'),
    "decision modal should consume Enter and Space so modal confirmation does not leak through to host send handlers"
  );
  assert.ok(
    contentSource.includes("event.stopPropagation();"),
    "decision modal keyboard handling should stop propagation before the host page sees modal confirmation keys"
  );
  assert.ok(
    contentSource.includes("event.stopImmediatePropagation"),
    "decision modal keyboard handling should stop immediate propagation to block host-level send races"
  );
  assert.ok(
    contentSource.includes("consumeInterceptionEvent(event);"),
    "intercepted rewrite paths should fully consume host events when PWM takes ownership"
  );
  assert.ok(
    contentSource.includes('window.addEventListener("keyup", onKeyPassthrough, true);') &&
      contentSource.includes('window.addEventListener("keypress", onKeyPassthrough, true);'),
    "decision modal should consume confirm/cancel keys across keydown, keypress, and keyup while open"
  );
  assert.ok(
    contentSource.includes('finish({ action: getFocusedAction() || "redact" });'),
    "decision modal should fail closed to redaction when Enter is pressed and focus is ambiguous"
  );
  assert.ok(
    contentSource.includes("normalizeVerificationText") &&
      contentSource.includes("matchesComposerPlan"),
    "composer rewrite verification should allow safe normalized-equivalent editor states"
  );
  assert.ok(
    contentSource.includes("const latestInput = findComposer(input);") &&
      contentSource.includes("const latestText = getInputText(latestInput);"),
    "paste rewrite flow should re-resolve the composer after modal decisions before applying redaction"
  );
}

function run() {
  testBeforeInputGuardStaysConservative();
  testTypedAssignmentSecretIsCaughtBeforeCommit();
  testTypedPublicIpUsesSameDecisionFlow();
  testPlaceholderNormalizationCanHappenBeforeCommit();
  testCaretDerivationPrefersOriginalSuffixAnchor();
  testContentScriptBindsBeforeInputAndKeepsFallbackGuard();
  console.log("PASS typed beforeinput interception regressions");
}

run();
