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

const {
  Detector,
  PlaceholderManager,
  PLACEHOLDER_TOKEN_REGEX,
  normalizeVisiblePlaceholders,
  buildNetworkUiFindings,
  transformOutboundPrompt,
  ComposerHelpers
} = globalThis.PWM;
const {
  spliceSelectionText,
  shouldInterceptBeforeInput,
  selectFindingsOverlappingInsertion,
  deriveRewriteCaretOffset,
  buildRiskFingerprint
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

function combinedFindings(text) {
  return [
    ...analyze(text),
    ...buildNetworkUiFindings(normalizeVisiblePlaceholders(text), { mode: "hide_public" })
  ].sort((a, b) => a.start - b.start);
}

function riskFingerprintForText(text) {
  return buildRiskFingerprint(combinedFindings(text), normalizeVisiblePlaceholders(text));
}

function testRiskFingerprintSurvivesNormalTyping() {
  const initial = "username=wayland.dev";
  const continued = `${initial} is the account name, not a password.`;

  const initialFingerprint = riskFingerprintForText(initial);
  const continuedFingerprint = riskFingerprintForText(continued);

  assert.ok(initialFingerprint, "medium typed detection should produce a stable risk fingerprint");
  assert.strictEqual(
    continuedFingerprint,
    initialFingerprint,
    "continuing with normal explanatory text should not reopen the modal for the same finding set"
  );
}

function testRiskFingerprintChangesWhenNewSuspiciousValueIsAdded() {
  const initial = "username=wayland.dev";
  const withNewRisk = `${initial} public resolver 8.8.8.8`;

  assert.notStrictEqual(
    riskFingerprintForText(withNewRisk),
    riskFingerprintForText(initial),
    "adding a new sensitive-looking value should require a fresh decision"
  );
}

function testRiskFingerprintChangesWhenSuspiciousValueIsReplaced() {
  const initial = "username=wayland.dev";
  const replaced = "username=other.dev";

  assert.notStrictEqual(
    riskFingerprintForText(replaced),
    riskFingerprintForText(initial),
    "replacing a suspicious value should require a fresh decision"
  );
}

function testPauseStateHasNoRawStorageHooks() {
  const rawSecret = "PauseStorageSecret123";
  const fingerprint = buildRiskFingerprint([
    {
      type: "SECRET",
      severity: "medium",
      raw: rawSecret
    }
  ]);

  assert.strictEqual(fingerprint.includes(rawSecret), false, "fingerprint should not contain raw secrets");
  assert.strictEqual(
    /protectionPause[\s\S]{0,240}(raw|secret|findings|localStorage|chrome\.storage\.local)/.test(contentSource),
    false,
    "pause state should not store raw secrets, findings, or local persistent storage hooks"
  );
}

function testPauseBypassRunsAfterPolicyInTypedRedactionPipeline() {
  const typedScanSource = extractFunctionSource(contentSource, "maybeHandleTypedSecrets");
  const pauseCheckIndex = typedScanSource.indexOf("isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)");
  const policyIndex = typedScanSource.indexOf("const destinationPolicy = await handleDestinationPolicy");
  const firstRedactionIndex = typedScanSource.indexOf("requestRedaction(");

  assert.ok(pauseCheckIndex >= 0, "typed scanner should check protection pause");
  assert.ok(firstRedactionIndex >= 0, "typed scanner should still redact when Redact is chosen");
  assert.ok(
    policyIndex >= 0 && policyIndex < pauseCheckIndex,
    "pause must be checked only after destination policy enforcement"
  );
  assert.ok(
    typedScanSource.includes("scanGeneration !== typedScanGeneration") &&
      !typedScanSource.includes("isCurrentRiskSetAllowedOnce"),
    "stale typed scans should still be superseded without allow-once bypasses"
  );
}

function testPauseBypassGatesPasteAndSendAfterPolicy() {
  const pasteSource = extractFunctionSource(contentSource, "maybeHandlePaste");
  const submitSource = extractFunctionSource(contentSource, "maybeHandleSubmit");
  const fallbackSendSource = extractFunctionSource(contentSource, "maybeHandleFallbackSendKey");
  const geminiPasteSource = extractFunctionSource(contentSource, "maybeHandleGeminiEditorPaste");

  assert.ok(
    pasteSource.indexOf("const destinationPolicy = await handleDestinationPolicy") <
      pasteSource.indexOf("isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)"),
    "paste pause bypass should run after destination policy"
  );
  assert.ok(
    submitSource.indexOf("const destinationPolicy = analysis.findings.length") <
      submitSource.indexOf("isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)"),
    "submit pause bypass should run after destination policy"
  );
  assert.ok(
    fallbackSendSource.indexOf("const destinationPolicy = analysis.findings.length") <
      fallbackSendSource.indexOf("isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)"),
    "fallback Enter-send pause bypass should run after destination policy"
  );
  assert.ok(
    geminiPasteSource.includes("promptForSensitiveContentDecision(") &&
      geminiPasteSource.includes('"paste"') &&
      geminiPasteSource.includes("isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)") &&
      geminiPasteSource.includes("applyGeminiEditorText(editor, textToInsert"),
    "Gemini editor paste should share pause-aware decision flow and then use the safe Gemini insertion path"
  );
  assert.ok(
    !geminiPasteSource.includes('decisionAction === "allow"') &&
      geminiPasteSource.indexOf("isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)") <
        geminiPasteSource.indexOf("promptForSensitiveContentDecision("),
    "Gemini editor paste must check pause before prompting and must not offer an allow decision"
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
      fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8").includes("matchOriginAsFallback: true"),
    "dynamic protected-site content scripts should also install at document_start in related frames"
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
      dropSource.includes('maybeHandleLocalFileInsert(event, input, snapshotDataTransfer, "drop")') &&
      !dropSource.includes("if (!input) return"),
    "file drop should consume raw files immediately and continue local handling without a composer target"
  );
  assert.ok(
    contentSource.includes("async function maybeHandleFileInputChange") &&
      contentSource.includes("clearLocalFileInputSelection(event.target)") &&
      contentSource.includes('"file-input"'),
    "file input changes should be captured, cleared, and routed through local redaction"
  );
  assert.ok(
    pasteSource.indexOf("dataTransferHasFiles(pasteTransfer)") <
      pasteSource.indexOf("const pasted = getPastedPlainText(event)"),
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
      contentSource.includes("isGrokHost()") &&
      contentSource.includes("function handOffGeminiSanitizedFileUpload") &&
      contentSource.includes("function handOffGrokSanitizedFileUpload") &&
      contentSource.includes("file-handoff:fail-closed") &&
      contentSource.includes('dispatchSanitizedFileEvent(target, "drop", transfer)') &&
      contentSource.includes('dispatchSanitizedFileEvent(target, "paste", transfer)'),
    "local file handling should hand off sanitized files through native site upload adapters and fail closed when required handoff fails"
  );
  assert.ok(
    contentSource.includes("async function applySanitizedTextFallback") &&
      contentSource.includes("async function applyGeminiSanitizedTextFallback") &&
      contentSource.includes("Sanitized content inserted as text because the site did not accept a sanitized file upload.") &&
      contentSource.includes("Sanitized content inserted as text because Gemini rejected sanitized file upload.") &&
      !contentSource.includes("async function applyLocalFileRedactedText") &&
      !contentSource.includes("setInputTextDirect(input, next.text") &&
      !contentSource.includes("insertContentEditableTextCommand(input, next.text"),
    "local file handling should fall back to sanitized composer text only after supported file redaction and failed sanitized handoff"
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
    /document\.addEventListener\(\s*"input"[\s\S]*maybeHandleFileInputChange\(event\)[\s\S]*true\s*\)/.test(
      contentSource
    ),
    "Firefox file input events should be captured before page handlers and before delayed scanning"
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
      beforeInputSource.includes("isPasteBeforeInput(event)") &&
      beforeInputSource.includes("await maybeHandlePaste(event);") &&
      submitSource.includes("consumeInterceptionEvent(event);") &&
      fallbackSendSource.includes("consumeInterceptionEvent(event);"),
    "beforeinput paste/typing, submit, and Enter-send interception should all stop immediate propagation to block host races"
  );
  assert.ok(
    beforeInputSource.includes("if (isFirefoxRuntime())") &&
      beforeInputSource.indexOf("consumeInterceptionEvent(event);") <
        beforeInputSource.indexOf("await analyzeTextWithAiAssist(originalText)") &&
      beforeInputSource.indexOf("consumeInterceptionEvent(event);") <
        beforeInputSource.indexOf("await analyzeTextWithAiAssist(next.text)"),
    "Firefox beforeinput should synchronously consume risky raw text before any async analysis can yield to the page"
  );
  assert.ok(
    beforeInputSource.includes("event?.isTrusted === false") &&
      beforeInputSource.includes("isProgrammaticInputScanSuppressed()") &&
      beforeInputSource.indexOf("event?.isTrusted === false") <
        beforeInputSource.indexOf("shouldInterceptBeforeInput(event)"),
    "programmatic ChatGPT rewrite events should not be re-intercepted as typed user input"
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
      contentSource.includes("matchesComposerPlan") &&
      contentSource.includes("verifyComposerRewriteSafe"),
    "composer rewrite verification should allow safe normalized-equivalent editor states"
  );
  assert.ok(
    contentSource.includes("async function rewriteComposerTransactionally") &&
      contentSource.includes("rawInsertedText") &&
      contentSource.includes("setInputTextDirect(input, normalizedRedacted") &&
      contentSource.includes("direct-transactional-rewrite"),
    "paste rewrites should have a transactional direct fallback that removes raw landed Firefox input"
  );
  assert.ok(
    applyComposerTextSource.includes("const actualAfterPrimary = await readStableComposerText(input);") &&
      applyComposerTextSource.includes("forceRewriteInputText(input, writeText") &&
      applyComposerTextSource.includes("setInputTextDirect(input, writeText") &&
      applyComposerTextSource.includes("matchesComposerPlan(plan, actual)") &&
      applyComposerTextSource.includes("verifyComposerRewriteSafe"),
    "contenteditable rewrites should verify stable final text and force direct redacted text when raw input remains"
  );
  assert.ok(
    typedRewriteSource.includes("ensureExactComposerState(input, expectedText)") &&
      typedRewriteSource.includes("collectFailureDetails(input, expectedText"),
    "typed rewrite flow should confirm final composer text equals the expected redacted text"
  );
  assert.ok(
    fs
      .readFileSync(path.join(repoRoot, "src/content/composer_helpers.js"), "utf8")
      .includes("writePlainTextToContentEditablePreservingNewlines") &&
      fs
        .readFileSync(path.join(repoRoot, "src/content/composer_helpers.js"), "utf8")
        .includes('normalized.includes("\\n") ? "insertHTML" : "insertText"'),
    "multiline contenteditable rewrites should use HTML insertion after clearing host editor state"
  );
  for (const label of [
    "rewrite:verification-candidate",
    "rewrite:verification-pass-exact",
    "rewrite:verification-pass-normalized",
    "rewrite:verification-pass-placeholder-safe",
    "rewrite:verification-failed-raw-secret-present",
    "rewrite:verification-failed-placeholder-missing",
    "rewrite:multiline-collapse-detected",
    "rewrite:multiline-preserving-retry-start",
    "rewrite:multiline-preserving-retry-success",
    "rewrite:multiline-preserving-retry-failed",
    "rewrite:failure-modal-suppressed-duplicate"
  ]) {
    assert.ok(contentSource.includes(label), `content script should keep safe debug label ${label}`);
  }
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
  assert.ok(
    pasteSource.includes("{ rawInsertedText: pasted }"),
    "paste rewrites should verify that the original pasted text is not left beside redacted content"
  );
  assert.ok(
    contentSource.includes("buildRiskFingerprint") &&
      contentSource.includes("pendingDecisionFingerprint") &&
      contentSource.includes("pendingDecisionPromise"),
    "decision prompts should use a per-editor risk fingerprint and single-flight modal state"
  );
  assert.ok(
    contentSource.includes("clearAllRiskSessionState();") &&
      contentSource.includes("typedScanGeneration"),
    "decision state should reset on lifecycle/send boundaries and stale typed scans should be superseded"
  );
  assert.strictEqual(contentSource.includes("Allow once"), false, "content script must not render Allow once");
  assert.strictEqual(contentSource.includes("isCurrentRiskSetAllowedOnce"), false, "content script must not keep allow-once bypass helpers");
}

function testPerplexityStyleRewriteVerificationToleratesWhitespaceNormalization() {
  const factory = new Function(
    "normalizeVisiblePlaceholders",
    "normalizeComposerText",
    "normalizeEditorInnerText",
    "PLACEHOLDER_TOKEN_REGEX",
    [
      extractFunctionSource(contentSource, "normalizeVerificationText"),
      extractFunctionSource(contentSource, "normalizeLooseVerificationText"),
      extractFunctionSource(contentSource, "listExpectedPlaceholders"),
      extractFunctionSource(contentSource, "actualContainsExpectedPlaceholders"),
      extractFunctionSource(contentSource, "matchesComposerPlan"),
      "return { matchesComposerPlan, normalizeVerificationText };"
    ].join("\n\n")
  );
  const { matchesComposerPlan } = factory(
    normalizeVisiblePlaceholders,
    ComposerHelpers.normalizeComposerText,
    ComposerHelpers.normalizeEditorInnerText,
    PLACEHOLDER_TOKEN_REGEX
  );
  const rawSecret = "blablabmy password is blablabmy password is blablabmy";
  const expected = "password is [PWM_1]";
  const plan = {
    canonical: expected,
    writeText: expected,
    acceptableTexts: [expected]
  };
  const perplexityVisibleText = "password is\n[PWM_1]\n";

  assert.strictEqual(perplexityVisibleText.includes(rawSecret), false);
  assert.ok(perplexityVisibleText.includes("[PWM_1]"));
  assert.strictEqual(
    matchesComposerPlan(plan, perplexityVisibleText),
    true,
    "Perplexity-like contenteditable wrapping should verify after raw secret removal"
  );
  assert.strictEqual(
    matchesComposerPlan(plan, `password is [PWM_1]\n${rawSecret}`),
    false,
    "rewrite verification must still fail if raw sensitive text remains"
  );
}

function createRewriteVerificationHarness(overrides = {}) {
  const logs = [];
  const state = {
    retryWrites: 0,
    retrySucceeds: overrides.retrySucceeds !== false
  };
  const factory = new Function(
    "deps",
    [
      "const { normalizeVisiblePlaceholders, normalizeComposerText, normalizeEditorInnerText, PLACEHOLDER_TOKEN_REGEX } = deps;",
      "const getInputText = deps.getInputText;",
      "const isContentEditable = deps.isContentEditable;",
      "const readStableComposerText = deps.readStableComposerText;",
      "const suppressFollowupInputScan = deps.suppressFollowupInputScan;",
      "const writePlainTextToContentEditablePreservingNewlines = deps.writePlainTextToContentEditablePreservingNewlines;",
      "const analyzeText = deps.analyzeText;",
      "function debugReveal(label, payload) { deps.logs.push({ label, payload }); }",
      extractFunctionSource(contentSource, "normalizeVerificationText"),
      extractFunctionSource(contentSource, "normalizeLooseVerificationText"),
      extractFunctionSource(contentSource, "listExpectedPlaceholders"),
      extractFunctionSource(contentSource, "listPlaceholderTokens"),
      extractFunctionSource(contentSource, "samePlaceholderTokenSet"),
      extractFunctionSource(contentSource, "actualContainsExpectedPlaceholders"),
      extractFunctionSource(contentSource, "countVerificationLineBreaks"),
      extractFunctionSource(contentSource, "countVerificationLines"),
      extractFunctionSource(contentSource, "lineCollapseTokens"),
      extractFunctionSource(contentSource, "detectMultilineCollapse"),
      extractFunctionSource(contentSource, "isReasonablyCloseRewriteLength"),
      extractFunctionSource(contentSource, "collectComposerVerificationCandidates"),
      extractFunctionSource(contentSource, "isHighConfidenceRewriteFinding"),
      extractFunctionSource(contentSource, "collectOriginalRawSecretValues"),
      extractFunctionSource(contentSource, "candidateHasHighConfidenceSecret"),
      extractFunctionSource(contentSource, "summarizeVerificationCandidate"),
      extractFunctionSource(contentSource, "debugRewriteVerification"),
      extractFunctionSource(contentSource, "evaluateComposerVerificationCandidates"),
      extractFunctionSource(contentSource, "verifyComposerRewriteSafe"),
      "return { verifyComposerRewriteSafe, detectMultilineCollapse, logs: deps.logs, state: deps.state };"
    ].join("\n\n")
  );
  return factory({
    logs,
    state,
    normalizeVisiblePlaceholders,
    normalizeComposerText: ComposerHelpers.normalizeComposerText,
    normalizeEditorInnerText: ComposerHelpers.normalizeEditorInnerText,
    PLACEHOLDER_TOKEN_REGEX,
    getInputText: (input) => ComposerHelpers.normalizeComposerText(input.text || ""),
    isContentEditable: (input) => input?.contentEditable === true,
    readStableComposerText: async (input) => ComposerHelpers.normalizeComposerText(input.text || ""),
    suppressFollowupInputScan: () => {},
    writePlainTextToContentEditablePreservingNewlines: (input, text) => {
      state.retryWrites += 1;
      if (!state.retrySucceeds) return false;
      input.text = ComposerHelpers.normalizeComposerText(text);
      input.innerText = input.text;
      input.textContent = input.text.replace(/\n/g, "");
      return true;
    },
    analyzeText: (text) => {
      const rawSecrets = [/RawSecretABCDE12345/g, /OriginalSecretXYZ98765/g];
      const findings = [];
      for (const regex of rawSecrets) {
        for (const match of String(text || "").matchAll(regex)) {
          findings.push({
            raw: match[0],
            severity: "high",
            score: 90,
            start: match.index,
            end: match.index + match[0].length
          });
        }
      }
      return { findings, secretFindings: findings };
    }
  });
}

function createVerificationInput(text, overrides = {}) {
  return {
    contentEditable: overrides.contentEditable !== false,
    text,
    innerText: overrides.innerText ?? text,
    textContent: overrides.textContent ?? text.replace(/\n/g, "")
  };
}

async function testGenericRewriteVerificationSafeCases() {
  const { verifyComposerRewriteSafe } = createRewriteVerificationHarness();
  const expected = "API_KEY=[PWM_1]\nDB_PASSWORD=[PWM_2]";

  const exact = await verifyComposerRewriteSafe({
    input: createVerificationInput(expected),
    expectedText: expected,
    originalText: "API_KEY=OriginalSecretXYZ98765",
    findings: [{ raw: "OriginalSecretXYZ98765", severity: "high", score: 90 }],
    context: "generic-exact"
  });
  assert.strictEqual(exact.ok, true, "generic contenteditable exact rewrite should pass");

  const trailing = await verifyComposerRewriteSafe({
    input: createVerificationInput(`${expected}\n\n`, { textContent: expected.replace(/\n/g, "") }),
    expectedText: expected,
    originalText: "API_KEY=OriginalSecretXYZ98765",
    findings: [{ raw: "OriginalSecretXYZ98765", severity: "high", score: 90 }],
    context: "generic-trailing"
  });
  assert.strictEqual(trailing.ok, true, "trailing editor newlines should not cause false failures");

  const wrapped = await verifyComposerRewriteSafe({
    input: createVerificationInput("API_KEY=\n[PWM_1]\n", {
      innerText: "API_KEY=\n[PWM_1]\n",
      textContent: "API_KEY=[PWM_1]"
    }),
    expectedText: "API_KEY=[PWM_1]",
    originalText: "API_KEY=OriginalSecretXYZ98765",
    findings: [{ raw: "OriginalSecretXYZ98765", severity: "high", score: 90 }],
    context: "chatgpt-wrapper"
  });
  assert.strictEqual(wrapped.ok, true, "ChatGPT/contenteditable wrapper newline differences should pass safely");
}

async function testMultilineCollapseRetryAndFailures() {
  const harness = createRewriteVerificationHarness();
  const expected = "line1\nline2\nline3 [PWM_1]";
  assert.strictEqual(
    harness.detectMultilineCollapse(expected, "line1 line2 line3 [PWM_1]"),
    true,
    "Firefox-style one-line collapse should be detected"
  );

  const input = createVerificationInput("line1 line2 line3 [PWM_1]", {
    textContent: "line1line2line3 [PWM_1]"
  });
  const retried = await harness.verifyComposerRewriteSafe({
    input,
    expectedText: expected,
    originalText: "secret=OriginalSecretXYZ98765",
    findings: [{ raw: "OriginalSecretXYZ98765", severity: "high", score: 90 }],
    context: "firefox-collapse"
  });
  assert.strictEqual(retried.ok, true, "multiline-preserving retry should verify after rewriting line breaks");
  assert.strictEqual(harness.state.retryWrites, 1, "collapse should trigger exactly one newline-preserving retry");
  assert.strictEqual(input.text, expected, "retry should restore the expected logical multiline text");
  assert.ok(
    harness.logs.some((entry) => entry.label === "rewrite:multiline-preserving-retry-success"),
    "successful retry should emit a safe debug label"
  );

  const failingHarness = createRewriteVerificationHarness({ retrySucceeds: false });
  const failed = await failingHarness.verifyComposerRewriteSafe({
    input: createVerificationInput("line1 line2 line3 [PWM_1]"),
    expectedText: expected,
    originalText: "secret=OriginalSecretXYZ98765",
    findings: [{ raw: "OriginalSecretXYZ98765", severity: "high", score: 90 }],
    context: "firefox-collapse-failed"
  });
  assert.strictEqual(
    failed.ok,
    false,
    "expected multiline content collapsed to one line should fail closed when retry fails"
  );
}

async function testRewriteVerificationFailClosedCases() {
  const { verifyComposerRewriteSafe } = createRewriteVerificationHarness();
  const rawSecret = await verifyComposerRewriteSafe({
    input: createVerificationInput("API_KEY=RawSecretABCDE12345"),
    expectedText: "API_KEY=[PWM_1]",
    originalText: "API_KEY=RawSecretABCDE12345",
    findings: [{ raw: "RawSecretABCDE12345", severity: "high", score: 90 }],
    context: "raw-remains"
  });
  assert.strictEqual(rawSecret.ok, false, "raw high-confidence secret remaining after rewrite should fail closed");
  assert.strictEqual(rawSecret.reason, "raw-secret-present");

  const rawInAlternateSurface = await verifyComposerRewriteSafe({
    input: createVerificationInput("API_KEY=[PWM_1]", {
      innerText: "API_KEY=RawSecretABCDE12345",
      textContent: "API_KEY=[PWM_1]"
    }),
    expectedText: "API_KEY=[PWM_1]",
    originalText: "API_KEY=RawSecretABCDE12345",
    findings: [{ raw: "RawSecretABCDE12345", severity: "high", score: 90 }],
    context: "raw-in-alternate-surface"
  });
  assert.strictEqual(
    rawInAlternateSurface.ok,
    false,
    "raw secret on any visible editor surface should fail even if getInputText is sanitized"
  );

  const missingPlaceholder = await verifyComposerRewriteSafe({
    input: createVerificationInput("API_KEY=safe-value"),
    expectedText: "API_KEY=[PWM_1]",
    originalText: "API_KEY=OriginalSecretXYZ98765",
    findings: [{ raw: "OriginalSecretXYZ98765", severity: "high", score: 90 }],
    context: "placeholder-missing"
  });
  assert.strictEqual(missingPlaceholder.ok, false, "missing expected placeholder should fail closed");
  assert.strictEqual(missingPlaceholder.reason, "placeholder-missing");
}

async function testRewriteFailureModalSuppression() {
  const calls = { modals: 0 };
  const logs = [];
  const factory = new Function(
    "deps",
    [
      "const rewriteFailureModalSuppressions = new Map();",
      "const REWRITE_FAILURE_SUPPRESS_MS = 6000;",
      "let modalOpen = false;",
      "function debugRewriteVerification(label, payload) { deps.logs.push({ label, payload }); }",
      "function setBadge() {}",
      "function hideBadgeSoon() {}",
      "function logFailureDetails() {}",
      "async function showMessageModal() { deps.calls.modals += 1; }",
      extractFunctionSource(contentSource, "pruneRewriteFailureSuppressions"),
      extractFunctionSource(contentSource, "buildRewriteFailureFingerprint"),
      extractFunctionSource(contentSource, "shouldSuppressRewriteFailureModal"),
      extractFunctionSource(contentSource, "showRewriteFailure"),
      "return { showRewriteFailure, setModalOpen: (value) => { modalOpen = value; } };"
    ].join("\n\n")
  );
  const harness = factory({ calls, logs });
  const details = {
    expected: { length: 12, lineCount: 1, placeholderCount: 1 },
    actual: { length: 10, lineCount: 1, placeholderCount: 0 },
    normalizedInnerText: { length: 10, lineCount: 1 },
    textContent: { length: 10, lineCount: 1 }
  };

  await harness.showRewriteFailure("paste", details);
  await harness.showRewriteFailure("paste", details);
  assert.strictEqual(calls.modals, 1, "duplicate rewrite verification failures should show one modal per fingerprint");
  assert.ok(
    logs.some((entry) => entry.label === "rewrite:failure-modal-suppressed-duplicate"),
    "duplicate modal suppression should be visible in safe debug logs"
  );

  harness.setModalOpen(true);
  await harness.showRewriteFailure("paste", { ...details, actual: { length: 11, lineCount: 1, placeholderCount: 0 } });
  assert.strictEqual(calls.modals, 1, "open modal should suppress additional rewrite failure modals");
}

async function testTransactionalRewriteFallbackRemovesRawDuplicate() {
  const factory = new Function(
    "normalizeComposerText",
    [
      "const calls = { directWrites: 0 };",
      "function buildComposerWritePlan(_input, text) { const canonical = normalizeComposerText(text); return { canonical, writeText: canonical }; }",
      "function matchesComposerPlan(plan, actual) { return normalizeComposerText(actual) === plan.canonical; }",
      "function suppressFollowupInputScan() {}",
      "function setInputText(input, text) { input.text = `${input.text}\\n${text}`; }",
      "function forceRewriteInputText(input, text) { input.text = `${input.text}\\n${text}`; }",
      "function setInputTextDirect(input, text) { calls.directWrites += 1; input.text = normalizeComposerText(text); return true; }",
      "async function readStableComposerText(input) { return normalizeComposerText(input.text); }",
      "async function verifyComposerRewriteSafe({ input, expectedText, actualText }) { const actual = normalizeComposerText(actualText == null ? input.text : actualText); return { ok: actual === normalizeComposerText(expectedText), actual, strategy: 'test' }; }",
      "function debugLogSnapshot() {}",
      extractFunctionSource(contentSource, "applyComposerText"),
      extractFunctionSource(contentSource, "rewriteComposerTransactionally"),
      "return { rewriteComposerTransactionally, calls };"
    ].join("\n\n")
  );
  const { rewriteComposerTransactionally, calls } = factory(ComposerHelpers.normalizeComposerText);
  const rawText = "api_key=bbbbbbbbbb";
  const redactedText = "api_key=[PWM_1]";
  const input = {
    text: `${rawText}\n${redactedText}`
  };

  const result = await rewriteComposerTransactionally(input, rawText, redactedText, "paste");

  assert.strictEqual(result.ok, true);
  assert.strictEqual(input.text, redactedText);
  assert.strictEqual(input.text.includes(rawText), false);
  assert.strictEqual(calls.directWrites, 1, "raw+redacted duplicate should force one direct rewrite");
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
  testRiskFingerprintSurvivesNormalTyping();
  testRiskFingerprintChangesWhenNewSuspiciousValueIsAdded();
  testRiskFingerprintChangesWhenSuspiciousValueIsReplaced();
  testPauseStateHasNoRawStorageHooks();
  testPauseBypassRunsAfterPolicyInTypedRedactionPipeline();
  testPauseBypassGatesPasteAndSendAfterPolicy();
  testContentScriptBindsBeforeInputAndKeepsFallbackGuard();
  testPerplexityStyleRewriteVerificationToleratesWhitespaceNormalization();
  return Promise.resolve()
    .then(() => testGenericRewriteVerificationSafeCases())
    .then(() => testMultilineCollapseRetryAndFailures())
    .then(() => testRewriteVerificationFailClosedCases())
    .then(() => testRewriteFailureModalSuppression())
    .then(() => testTransactionalRewriteFallbackRemovesRawDuplicate())
    .then(() => {
      console.log("PASS typed beforeinput interception regressions");
    });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
