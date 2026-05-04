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
  PlaceholderManager,
  normalizeVisiblePlaceholders,
  buildNetworkUiFindings,
  transformOutboundPrompt,
  ComposerHelpers
} = globalThis.PWM;
const {
  spliceSelectionText,
  shouldInterceptBeforeInput,
  selectFindingsOverlappingInsertion,
  deriveRewriteCaretOffset
} = ComposerHelpers;

const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");

function extractFunctionSource(source, name) {
  const match = source.match(new RegExp(`(?:async\\s+)?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`));
  assert.ok(match, `expected to find function ${name}`);
  return match[0];
}

function analyze(text, options = {}) {
  return new Detector().scan(text, options).filter((finding) => finding.severity !== "low");
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

function testTypedStandalonePasswordHeuristicIsHighConfidence() {
  const currentText = "";
  const selection = { start: 0, end: 0 };
  const next = spliceSelectionText(currentText, selection, "HarborLock4455!");
  const findings = analyze(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, "HarborLock4455!");

  assert.ok(relevant.length > 0, "typed standalone password should produce findings");
  assert.strictEqual(relevant[0].type, "PASSWORD");
  assert.strictEqual(relevant[0].severity, "high");
  assert.ok(
    relevant[0].method.includes("bare-password"),
    "typed standalone password should use the bare-password heuristic path"
  );
}

function testTypedSecretKeywordPasswordHeuristicIsHighConfidence() {
  const currentText = "";
  const selection = { start: 0, end: 0 };
  const next = spliceSelectionText(currentText, selection, "secret1234");
  const findings = analyze(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, "secret1234");

  assert.ok(relevant.length > 0, "typed secret-prefixed password should produce findings");
  assert.strictEqual(relevant[0].type, "PASSWORD");
  assert.strictEqual(relevant[0].severity, "high");
  assert.ok(relevant[0].method.includes("bare-password"));
}

function testTypedNaturalLanguageSecretDisclosureIsHighConfidence() {
  const currentText = "";
  const selection = { start: 0, end: 0 };
  const next = spliceSelectionText(currentText, selection, "my secret is petrit123");
  const findings = analyze(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, "my secret is petrit123");

  assert.ok(relevant.length > 0, "typed natural-language secret disclosure should produce findings");
  assert.strictEqual(relevant[0].raw, "petrit123");
  assert.strictEqual(relevant[0].type, "SECRET");
  assert.strictEqual(relevant[0].severity, "high");
}

function testTypedNumericNaturalLanguageSecretDisclosureIsHighConfidence() {
  const currentText = "";
  const selection = { start: 0, end: 0 };
  const next = spliceSelectionText(currentText, selection, "this is my secret 9876543210");
  const findings = analyze(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, "this is my secret 9876543210");

  assert.ok(relevant.length > 0, "typed numeric natural-language secret should produce findings");
  assert.strictEqual(relevant[0].raw, "9876543210");
  assert.strictEqual(relevant[0].type, "SECRET");
  assert.strictEqual(relevant[0].severity, "high");
}

function testTypedUsernameAssignmentStaysMediumConfidence() {
  const currentText = "username=";
  const selection = { start: currentText.length, end: currentText.length };
  const next = spliceSelectionText(currentText, selection, "wayland.dev");
  const findings = analyze(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, "wayland.dev");

  assert.ok(relevant.length > 0, "typed username should surface a contextual identity finding");
  assert.strictEqual(relevant[0].type, "USERNAME");
  assert.strictEqual(relevant[0].severity, "medium");
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

function testTypedUnknownPlaceholderLikeSecretIsCaughtBeforeCommit() {
  const currentText = "password=";
  const selection = { start: currentText.length, end: currentText.length };
  const next = spliceSelectionText(currentText, selection, "[PWM_99999]");
  const findings = analyze(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, "[PWM_99999]");

  assert.ok(relevant.length > 0, "typed unknown placeholder-like password should produce findings");
  assert.strictEqual(relevant[0].raw, "[PWM_99999]");
  assert.strictEqual(relevant[0].type, "PASSWORD");
}

function testTypedTrustedPlaceholderTailTargetsOnlyTailBeforeCommit() {
  const manager = new PlaceholderManager();
  manager.trackKnownPlaceholder("[PWM_5]");
  const currentText = "password=";
  const inserted = "[PWM_5]4512341234";
  const selection = { start: currentText.length, end: currentText.length };
  const next = spliceSelectionText(currentText, selection, inserted);
  const findings = analyze(next.text, { manager });
  const relevant = selectFindingsOverlappingInsertion(findings, selection, inserted);

  assert.ok(relevant.length > 0, "trusted-placeholder tail should produce a finding");
  assert.strictEqual(relevant[0].raw, "4512341234");
  assert.ok(relevant[0].method.includes("placeholder-suffix"));
}

function testTypedRepeatedSecretRewriteDoesNotLeakRawBoundaries() {
  const repeatedSecret = "TypedBoundaryApiKey1234567890";
  const currentText = "";
  const inserted = [
    `API_KEY=${repeatedSecret}`,
    `Again same key: ${repeatedSecret}`,
    `Plain repeat: ${repeatedSecret}`
  ].join("\n");
  const selection = { start: 0, end: 0 };
  const next = spliceSelectionText(currentText, selection, inserted);
  const findings = analyze(next.text);
  const relevant = selectFindingsOverlappingInsertion(findings, selection, inserted);
  const manager = new PlaceholderManager();
  const result = transformOutboundPrompt(next.text, {
    manager,
    findings,
    mode: "hide_public"
  });
  const placeholders = result.redactedText.match(/\[PWM_\d+\]/g) || [];

  assert.ok(relevant.length > 0, "typed repeated secret should be detected before commit");
  assert.strictEqual(result.redactedText.includes(repeatedSecret), false, "redacted typed text leaked raw repeated secret");
  assert.strictEqual(new Set(placeholders).size, 1, "same typed raw secret should reuse one placeholder");
  assert.ok(/^API_KEY=\[PWM_\d+\]$/m.test(result.redactedText), "assignment should redact to a clean placeholder");
  assert.ok(/^Again same key: \[PWM_\d+\]$/m.test(result.redactedText), "labelled repeat should redact cleanly");
  assert.ok(/^Plain repeat: \[PWM_\d+\]$/m.test(result.redactedText), "known raw repeat should redact cleanly");
  assert.strictEqual(/\b[A-Za-z]+\[PWM_\d+\]/.test(result.redactedText), false, "raw prefixes must not attach to placeholders");
  assert.strictEqual(/\[PWM_\d+\][A-Za-z0-9]/.test(result.redactedText), false, "raw suffixes must not attach to placeholders");
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
  const applyComposerTextSource = extractFunctionSource(contentSource, "applyComposerText");
  const typedRewriteSource = extractFunctionSource(contentSource, "applyTypedInterceptionRewrite");
  const beforeInputSource = extractFunctionSource(contentSource, "maybeHandleBeforeInput");
  const fileInsertSource = extractFunctionSource(contentSource, "maybeHandleLocalFileInsert");
  const fileDragSource = extractFunctionSource(contentSource, "maybeHandleFileDrag");
  const dropSource = extractFunctionSource(contentSource, "maybeHandleDrop");
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"));
  const manifestScripts = manifest.content_scripts[0].js;
  const pasteSource = extractFunctionSource(contentSource, "maybeHandlePaste");
  const submitSource = extractFunctionSource(contentSource, "maybeHandleSubmit");
  const fallbackSendSource = extractFunctionSource(contentSource, "maybeHandleFallbackSendKey");

  assert.ok(
    contentSource.includes('"beforeinput"'),
    "content script should bind a beforeinput listener for early typed interception"
  );
  assert.ok(
    contentSource.includes('"drop"') &&
      contentSource.includes('"dragenter"') &&
      contentSource.includes('"dragover"') &&
      contentSource.includes('"change"') &&
      contentSource.includes("readLocalTextFileFromDataTransfer") &&
      contentSource.includes("createSanitizedTextFile"),
    "content script should intercept local file paste/drop/file-input before host pages receive raw files"
  );
  assert.strictEqual(
    manifestScripts[0],
    "content/file_drag_guard.js",
    "early file drag guard should load before the full runtime stack"
  );
  assert.strictEqual(
    manifest.content_scripts[0].run_at,
    "document_start",
    "file drag/drop interception should install before host page capture listeners"
  );
  assert.strictEqual(
    manifest.content_scripts[0].all_frames,
    true,
    "file drag/drop interception should cover protected-site frames"
  );
  assert.strictEqual(
    manifest.content_scripts[0].match_about_blank,
    true,
    "file drag/drop interception should cover about:blank protected-site child frames"
  );
  assert.ok(
      fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8").includes('runAt: "document_start"') &&
      fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8").includes("allFrames: true") &&
      fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8").includes("matchAboutBlank: true"),
    "dynamic protected-site content scripts should also install at document_start in all frames"
  );
  assert.ok(
    contentSource.includes("function bindFileDragEvents") &&
      contentSource.includes("fileDragEventRoots") &&
      contentSource.includes("bindFileDragEvents(window, onFileDrop)") &&
      contentSource.includes("bindFileDragEvents(document, onFileDrop)") &&
      contentSource.includes("bindFileDragEvents(document.documentElement, onFileDrop)") &&
      contentSource.includes("bindFileDragEvents(document.body, onFileDrop)"),
    "file drag/drop interception should bind at window, document, and DOM-root capture before nested targets"
  );
  assert.ok(
    fileDragSource.includes("event.preventDefault();") &&
      fileDragSource.includes("event.stopPropagation();") &&
      fileDragSource.includes("event.stopImmediatePropagation();") &&
      fileDragSource.includes("event.dataTransfer.dropEffect = \"copy\"") &&
      fileDragSource.includes("dataTransferLooksLikeFiles(event.dataTransfer)") &&
      !fileDragSource.includes("findComposer(") &&
      !fileDragSource.includes("consumeInterceptionEvent(event);") &&
      !fileDragSource.includes("querySelectorAll") &&
      !fileDragSource.includes("getBoundingClientRect") &&
      !fileDragSource.includes("getClientRects") &&
      !fileDragSource.includes("offsetWidth") &&
      !fileDragSource.includes("offsetHeight"),
    "file dragenter/dragover should synchronously own file drags without composer detection, DOM traversal, or layout reads"
  );
  assert.ok(
    dropSource.indexOf("consumeInterceptionEvent(event);") <
      dropSource.indexOf("findComposer(event.target) || findComposer(document.activeElement)") &&
      dropSource.includes("rawFileDropInterceptions") &&
      dropSource.includes("dataTransferLooksLikeFiles(event.dataTransfer)") &&
      dropSource.includes('maybeHandleLocalFileInsert(event, input, event.dataTransfer, "drop")') &&
      !dropSource.includes("if (!input) return"),
    "file drop should consume raw files immediately and continue local handling without a composer target"
  );
  assert.ok(
    contentSource.includes("async function maybeHandleFileInputChange") &&
      contentSource.includes("event.target.value = \"\"") &&
      contentSource.includes('"file-input"'),
    "file input changes should be captured, cleared, and routed through local redaction"
  );
  assert.ok(
    pasteSource.indexOf("dataTransferHasFiles(event.clipboardData)") <
      pasteSource.indexOf('event.clipboardData?.getData("text/plain")'),
    "file paste handling should run before ordinary text paste extraction"
  );
  assert.ok(
    fileInsertSource.includes("consumeInterceptionEvent(event);") &&
      fileInsertSource.indexOf("consumeInterceptionEvent(event);") <
        fileInsertSource.indexOf("readLocalTextFileFromDataTransfer(dataTransfer)") &&
      fileInsertSource.includes("requestRedaction(analysis.normalizedText, analysis.secretFindings)") &&
      fileInsertSource.includes("createSanitizedTextFile(localFile.file, result.redactedText)") &&
      fileInsertSource.includes("handOffSanitizedLocalFile(event, input, sanitizedFile, context)") &&
      !fileInsertSource.includes("scanTextContent"),
    "local file handoff should consume first, use background redaction, and avoid independent scanner managers"
  );
  assert.ok(
    contentSource.includes("function handOffSanitizedLocalFile") &&
      contentSource.includes("fileInput.files = transfer.files") &&
      contentSource.includes("function handOffSanitizedFileInput") &&
      contentSource.includes("resolveFileInputForHandoff(event, input)") &&
      contentSource.includes("isGeminiHost()") &&
      contentSource.includes("file-handoff:gemini-file-upload-skipped") &&
      contentSource.includes('dispatchSanitizedFileEvent(target, "drop", transfer)') &&
      contentSource.includes('dispatchSanitizedFileEvent(target, "paste", transfer)'),
    "local file handling should hand off sanitized files on non-Gemini sites while Gemini skips file-upload handoff"
  );
  assert.ok(
    contentSource.includes("async function applyGeminiSanitizedTextFallback") &&
      contentSource.includes("Sanitized content inserted as text because Gemini rejected sanitized file upload.") &&
      contentSource.includes("isGeminiHost()") &&
      !contentSource.includes("async function applyLocalFileRedactedText") &&
      !contentSource.includes("setInputTextDirect(input, next.text") &&
      !contentSource.includes("insertContentEditableTextCommand(input, next.text"),
    "local file handling should only fall back to sanitized composer text for Gemini handoff rejection"
  );
  assert.ok(
    fileInsertSource.includes("sanitized_file_handoff_failed") &&
      fileInsertSource.includes("LeakGuard blocked raw file upload. Sanitized file handoff failed"),
    "local file handoff failure should block raw upload with a clear local message"
  );
  assert.ok(
    fileInsertSource.includes("LeakGuard attached a sanitized local file."),
    "local file handling should show the sanitized attachment status"
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
    beforeInputSource.includes("consumeInterceptionEvent(event);") &&
      submitSource.includes("consumeInterceptionEvent(event);") &&
      fallbackSendSource.includes("consumeInterceptionEvent(event);"),
    "beforeinput, submit, and Enter-send interception should all stop immediate propagation to block host races"
  );
  assert.ok(
    contentSource.includes("shouldAutoRedactTypedSecrets"),
    "content script should distinguish high-confidence typed secrets from warning-only detections"
  );
  assert.ok(
    contentSource.includes("High-confidence secret redacted"),
    "content script should auto-redact high-confidence typed secrets without forcing the same modal every time"
  );
  assert.ok(
    contentSource.includes("Review possible sensitive content"),
    "content script should surface a softer warning state for medium-confidence typed detections"
  );
  assert.ok(
    contentSource.includes('window.addEventListener("keyup", onKeyPassthrough, true);') &&
      contentSource.includes('window.addEventListener("keypress", onKeyPassthrough, true);'),
    "decision modal should consume confirm/cancel keys across keydown, keypress, and keyup while open"
  );
  assert.ok(
    contentSource.includes('window.addEventListener("beforeinput", onModalPassthrough, true);') &&
      contentSource.includes('window.addEventListener("input", onModalPassthrough, true);') &&
      contentSource.includes('window.addEventListener("paste", onModalPassthrough, true);'),
    "message modals should consume typing and paste events so host composers cannot change underneath errors"
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
    applyComposerTextSource.includes("const actualAfterPrimary = await readStableComposerText(input);") &&
      applyComposerTextSource.includes("forceRewriteInputText(input, writeText") &&
      applyComposerTextSource.includes("matchesComposerPlan(plan, actual)"),
    "contenteditable rewrites should verify stable final text against the expected redacted text"
  );
  assert.ok(
    typedRewriteSource.includes("ensureExactComposerState(input, expectedText)") &&
      typedRewriteSource.includes("collectFailureDetails(input, expectedText"),
    "typed rewrite flow should confirm final composer text equals the expected redacted text"
  );
  assert.ok(
    fs
      .readFileSync(path.join(repoRoot, "src/content/composer_helpers.js"), "utf8")
      .includes('normalized.includes("\\n") ? "insertHTML" : "insertText"'),
    "multiline contenteditable rewrites should use HTML insertion after clearing host editor state"
  );
  assert.ok(
    contentSource.includes("const latestInput = findComposer(input);") &&
      contentSource.includes("const latestText = getInputText(latestInput);"),
    "paste rewrite flow should re-resolve the composer after modal decisions before applying redaction"
  );
  assert.ok(
    pasteSource.indexOf("consumeInterceptionEvent(event);") <
      pasteSource.indexOf("await analyzeTextWithAiAssist(pasted)"),
    "paste handler should consume sensitive paste events before async AI analysis can let the host insert raw text"
  );
}

function run() {
  testBeforeInputGuardStaysConservative();
  testTypedAssignmentSecretIsCaughtBeforeCommit();
  testTypedStandalonePasswordHeuristicIsHighConfidence();
  testTypedSecretKeywordPasswordHeuristicIsHighConfidence();
  testTypedNaturalLanguageSecretDisclosureIsHighConfidence();
  testTypedNumericNaturalLanguageSecretDisclosureIsHighConfidence();
  testTypedUsernameAssignmentStaysMediumConfidence();
  testTypedPublicIpUsesSameDecisionFlow();
  testPlaceholderNormalizationCanHappenBeforeCommit();
  testTypedUnknownPlaceholderLikeSecretIsCaughtBeforeCommit();
  testTypedTrustedPlaceholderTailTargetsOnlyTailBeforeCommit();
  testTypedRepeatedSecretRewriteDoesNotLeakRawBoundaries();
  testCaretDerivationPrefersOriginalSuffixAnchor();
  testContentScriptBindsBeforeInputAndKeepsFallbackGuard();
  console.log("PASS typed beforeinput interception regressions");
}

run();
