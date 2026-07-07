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
require(path.join(repoRoot, "src/content/input/rewriteVerificationText.js"));
require(path.join(repoRoot, "src/content/composer/replayVerification.js"));
require(path.join(repoRoot, "src/content/diagnostics/debugLogger.js"));
const ContentDebugFacade = require(path.join(repoRoot, "src/content/diagnostics/contentDebugFacade.js"));

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
const geminiEditorPasteSource = fs.readFileSync(
  path.join(repoRoot, "src/content/composer/geminiEditorPasteOrchestration.js"),
  "utf8"
);
const contentModalUiSource = fs.readFileSync(path.join(repoRoot, "src/content/ui/contentModalUi.js"), "utf8");
const rewriteVerificationTextSource = fs.readFileSync(
  path.join(repoRoot, "src/content/input/rewriteVerificationText.js"),
  "utf8"
);
const fileHandoffFlowSource = fs.readFileSync(
  path.join(repoRoot, "src/content/file_handoff_flow.js"),
  "utf8"
);
const sanitizedFileHandoffSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/sanitizedFileHandoff.js"),
  "utf8"
);
const geminiFallbackWriterSource = fs.readFileSync(
  path.join(repoRoot, "src/content/adapters/geminiFallbackWriter.js"),
  "utf8"
);
const fileAttachPipelineSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/fileAttachPipeline.js"),
  "utf8"
);
const localFileReadOrchestrationSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/localFileReadOrchestration.js"),
  "utf8"
);
const localFileSanitizationOrchestrationSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/localFileSanitizationOrchestration.js"),
  "utf8"
);
const sanitizedFileInsertOrchestrationSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/sanitizedFileInsertOrchestration.js"),
  "utf8"
);
const fileDropInterceptionSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/fileDropInterception.js"),
  "utf8"
);
const contentEventBindingsSource = fs.readFileSync(
  path.join(repoRoot, "src/content/bootstrap/eventBindings.js"),
  "utf8"
);

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
  const geminiPasteSource = extractFunctionSource(geminiEditorPasteSource, "maybeHandleGeminiEditorPaste");

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
  const submitTransactionalSource = extractFunctionSource(contentSource, "applySubmitRedactionTransactionally");
  const queueVerifiedSendSource = extractFunctionSource(contentSource, "queueVerifiedComposerSend");
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
  const modalSource = `${contentSource}\n${contentModalUiSource}`;

  assert.ok(
    contentSource.includes('"beforeinput"'),
    "content script should bind a beforeinput listener for early typed interception"
  );
  assert.ok(
    contentEventBindingsSource.includes('"drop"') &&
      contentEventBindingsSource.includes('"dragenter"') &&
      contentEventBindingsSource.includes('"dragover"') &&
      contentSource.includes('"change"') &&
      contentSource.includes("readLocalTextFileFromDataTransfer") &&
      contentSource.includes("createSanitizedTextFile"),
    "content script should intercept local file paste/drop/file-input before host pages receive raw files"
  );
  assert.ok(
    fallbackSendSource.includes('event.key !== "Enter"') &&
      !/\bevent\.key\s*={2,3}\s*["']v["']/i.test(fallbackSendSource) &&
      !fallbackSendSource.includes("clipboardData"),
    "keydown guards should not block Ctrl+V/Ctrl+Alt+V before paste clipboardData can be inspected"
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
      fs
        .readFileSync(path.join(repoRoot, "src/background/protectedSiteRegistry.js"), "utf8")
        .includes('runAt: "document_start"') &&
      fs
        .readFileSync(path.join(repoRoot, "src/background/protectedSiteRegistry.js"), "utf8")
        .includes("allFrames: true") &&
      fs
        .readFileSync(path.join(repoRoot, "src/background/protectedSiteRegistry.js"), "utf8")
        .includes("matchOriginAsFallback: true"),
    "dynamic protected-site content scripts should also install at document_start in related frames"
  );
  assert.ok(
    contentSource.includes("function bindFileDragEvents") &&
      contentSource.includes("fileDragEventRoots") &&
      contentSource.includes("ContentEventBindings.bindFileDragRoot") &&
      contentSource.includes("bindFileDragEvents(window, onFileDrop)") &&
      contentSource.includes("bindFileDragEvents(document, onFileDrop)") &&
      contentSource.includes("bindFileDragEvents(document.documentElement, onFileDrop)") &&
      contentSource.includes("bindFileDragEvents(document.body, onFileDrop)") &&
      contentEventBindingsSource.includes("eventRoots?.has(rootTarget)") &&
      contentEventBindingsSource.includes('rootTarget.addEventListener("dragenter", options.onFileDrag') &&
      contentEventBindingsSource.includes('rootTarget.addEventListener("dragover", options.onFileDrag') &&
      contentEventBindingsSource.includes('rootTarget.addEventListener("drop", options.onFileDrop') &&
      contentEventBindingsSource.includes('rootTarget.addEventListener("dragend", options.onDragEnd'),
    "file drag/drop interception should bind at window, document, and DOM-root capture before nested targets"
  );
  assert.ok(
    fileDragSource.includes("getFileDropInterception().maybeHandleFileDrag(event") &&
      fileDropInterceptionSource.includes("event.preventDefault();") &&
      fileDropInterceptionSource.includes("event.stopPropagation();") &&
      fileDropInterceptionSource.includes("event.stopImmediatePropagation();") &&
      fileDropInterceptionSource.includes("event.dataTransfer.dropEffect = \"copy\"") &&
      fileDropInterceptionSource.includes("dataTransferLooksLikeFiles(event?.dataTransfer)") &&
      !fileDragSource.includes("findComposer(") &&
      !fileDragSource.includes("consumeInterceptionEvent(event);") &&
      !fileDropInterceptionSource.includes("findComposer(") &&
      !fileDropInterceptionSource.includes("consumeInterceptionEvent(event);") &&
      !fileDropInterceptionSource.includes("querySelectorAll") &&
      !fileDropInterceptionSource.includes("getBoundingClientRect") &&
      !fileDropInterceptionSource.includes("getClientRects") &&
      !fileDropInterceptionSource.includes("offsetWidth") &&
      !fileDropInterceptionSource.includes("offsetHeight"),
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
        fileInsertSource.indexOf("getLocalFileReadOrchestration().readLocalFileForInsert") &&
      localFileReadOrchestrationSource.includes("readLocalTextFileFromDataTransfer(dataTransfer)") &&
      localFileSanitizationOrchestrationSource.includes(
        "requestRedaction(analysis.normalizedText, analysis.secretFindings)"
      ) &&
      localFileSanitizationOrchestrationSource.includes(
        "createSanitizedTextFile(localFile.file, result.redactedText)"
      ) &&
      sanitizedFileInsertOrchestrationSource.includes(
        "handOffSanitizedLocalFile(event, input, sanitizedFile, context)"
      ) &&
      !fileInsertSource.includes("scanTextContent"),
    "local file handoff should consume first, use background redaction, and avoid independent scanner managers"
  );
  assert.ok(
    fileHandoffFlowSource.includes("function handOffSanitizedLocalFile") &&
      sanitizedFileHandoffSource.includes("fileInput.files = transfer.files") &&
      sanitizedFileHandoffSource.includes("function handOffSanitizedFileInput") &&
      fileHandoffFlowSource.includes("resolveFileInputForHandoff(event, input)") &&
      contentSource.includes("isGeminiHost()") &&
      contentSource.includes("isGrokHost()") &&
      contentSource.includes("function handOffGeminiSanitizedFileUpload") &&
      contentSource.includes("function handOffGrokSanitizedFileUpload") &&
      sanitizedFileInsertOrchestrationSource.includes("file-handoff:fail-closed") &&
      sanitizedFileHandoffSource.includes('dispatchSanitizedFileEvent(target, "drop", transfer)') &&
      sanitizedFileHandoffSource.includes('dispatchSanitizedFileEvent(target, "paste", transfer)'),
    "local file handling should hand off sanitized files through native site upload adapters and fail closed when required handoff fails"
  );
  assert.ok(
    contentSource.includes("async function applySanitizedTextFallback") &&
      geminiFallbackWriterSource.includes("async function applyGeminiSanitizedTextFallback") &&
      contentSource.includes("createGeminiFallbackWriter") &&
      contentSource.includes("Sanitized content inserted as text because the site did not accept a sanitized file upload.") &&
      contentSource.includes("Sanitized content inserted as text because Gemini rejected sanitized file upload.") &&
      !contentSource.includes("async function applyLocalFileRedactedText") &&
      !contentSource.includes("setInputTextDirect(input, next.text") &&
      !contentSource.includes("insertContentEditableTextCommand(input, next.text"),
    "local file handling should fall back to sanitized composer text only after supported file redaction and failed sanitized handoff"
  );
  assert.ok(
    (fileInsertSource.includes("sanitized_file_handoff_failed") ||
      fileAttachPipelineSource.includes("sanitized_file_handoff_failed")) &&
      sanitizedFileInsertOrchestrationSource.includes(
        "LeakGuard blocked raw file upload. Sanitized file handoff failed"
      ),
    "local file handoff failure should block raw upload with a clear local message"
  );
  assert.ok(
    sanitizedFileInsertOrchestrationSource.includes("LeakGuard attached a sanitized local file."),
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
    modalSource.includes('event.key === "Enter" || event.key === " "'),
    "decision modal should consume Enter and Space so modal confirmation does not leak through to host send handlers"
  );
  assert.ok(
    modalSource.includes("event.stopPropagation();"),
    "decision modal keyboard handling should stop propagation before the host page sees modal confirmation keys"
  );
  assert.ok(
    modalSource.includes("event.stopImmediatePropagation"),
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
    contentSource.includes("async function maybeHandleSendButtonClick") &&
      contentSource.includes('document.addEventListener(\n      "click"') &&
      contentSource.includes("maybeHandleSendButtonClick(event).catch(handleContentError);"),
    "risky send-button clicks should be captured before host click handlers can submit raw composer text"
  );
  const sendButtonClickSource = extractFunctionSource(contentSource, "maybeHandleSendButtonClick");
  const modalClickGuardIndex = sendButtonClickSource.indexOf(".pwm-modal-backdrop");
  assert.ok(
    modalClickGuardIndex >= 0 && modalClickGuardIndex < sendButtonClickSource.indexOf("if (modalOpen)"),
    "captured send-button click guard must not consume LeakGuard modal button clicks before target handlers run"
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
    beforeInputSource.includes("const quickCurrentAnalysis = analyzeText(originalText);") &&
      beforeInputSource.includes("const quickNextAnalysis = analyzeText(next.text);") &&
      beforeInputSource.includes("const quickRelevantFindings = selectFindingsOverlappingInsertion(") &&
      beforeInputSource.indexOf("const quickNextAnalysis = analyzeText(next.text);") <
        beforeInputSource.lastIndexOf("consumeInterceptionEvent(event);") &&
      beforeInputSource.lastIndexOf("consumeInterceptionEvent(event);") <
        beforeInputSource.indexOf("const currentAnalysis = await analyzeTextWithAiAssist(originalText)") &&
      beforeInputSource.lastIndexOf("consumeInterceptionEvent(event);") <
        beforeInputSource.indexOf("const nextAnalysis = await analyzeTextWithAiAssist(next.text)"),
    "non-Firefox beforeinput should synchronously consume deterministic risky input before async AI analysis"
  );
  assert.ok(
    submitSource.includes("const quickAnalysis = analyzeText(text);") &&
      submitSource.indexOf("const quickAnalysis = analyzeText(text);") <
        submitSource.lastIndexOf("consumeInterceptionEvent(event);") &&
      submitSource.lastIndexOf("consumeInterceptionEvent(event);") <
        submitSource.indexOf("const analysis = await analyzeTextWithAiAssist(text)"),
    "submit should synchronously consume risky composer text before async AI analysis"
  );
  assert.ok(
    fallbackSendSource.includes("const quickAnalysis = analyzeText(text);") &&
      fallbackSendSource.indexOf("const quickAnalysis = analyzeText(text);") <
        fallbackSendSource.lastIndexOf("consumeInterceptionEvent(event);") &&
      fallbackSendSource.lastIndexOf("consumeInterceptionEvent(event);") <
        fallbackSendSource.indexOf("const analysis = await analyzeTextWithAiAssist(text)"),
    "Enter-send fallback should synchronously consume risky composer text before async AI analysis"
  );
  assert.ok(
    !fallbackSendSource.includes('input.closest("form")'),
    "Enter-send fallback should protect form-wrapped ChatGPT composers before host submit handlers can send raw text"
  );
  assert.ok(
    contentSource.includes('window.addEventListener(\n      "keydown"') &&
      contentSource.includes("maybeHandleFallbackSendKey(event).catch(handleContentError);"),
    "Enter-send fallback should bind at window capture so host document-level handlers cannot submit raw text first"
  );
  assert.ok(
    contentSource.includes("maybeConsumeSuppressedFallbackSendKeyEvent") &&
      contentSource.includes('window.addEventListener(\n      "keypress"') &&
      contentSource.includes('window.addEventListener(\n      "keyup"'),
    "Enter-send fallback should suppress related keypress/keyup events while async submit redaction is pending"
  );
  assert.ok(
    contentSource.includes('"form button#send-button"') &&
      contentSource.includes('"button#send-button"'),
    "send-button click guard should cover providers and harnesses that expose only id='send-button'"
  );
  assert.ok(
    contentSource.includes("leakGuardSendButton") &&
      contentSource.includes("leakGuardReplayViaClick") &&
      contentSource.includes('const nativeSubmitEvent = event.type === "submit" && !event.leakGuardSendButton;') &&
      contentSource.includes("event.submitter || (nativeSubmitEvent ? findSendButton(input) : null)") &&
      contentSource.includes("function replayVerifiedSend") &&
      contentSource.includes("replayVerifiedSend(input, form, submitter, replayOptions)") &&
      contentSource.includes("replayViaClick: true"),
    "guarded send-button redaction should retry the exact intercepted button after verified rewrite"
  );
  assert.ok(
    beforeInputSource.indexOf("if (!quickRelevantFindings.length && !quickPlaceholderNormalizationChanged)") <
      beforeInputSource.lastIndexOf("consumeInterceptionEvent(event);") &&
      submitSource.includes("const whatsappOwnsTextSend = shouldOwnWhatsAppTextSend(text);") &&
      submitSource.indexOf("if (!analysisNeedsEventOwnership(quickAnalysis) && !whatsappOwnsTextSend) return;") <
        submitSource.lastIndexOf("consumeInterceptionEvent(event);") &&
      fallbackSendSource.includes("const whatsappOwnsTextSend = shouldOwnWhatsAppTextSend(text);") &&
      fallbackSendSource.indexOf("if (!analysisNeedsEventOwnership(quickAnalysis) && !whatsappOwnsTextSend) return;") <
        fallbackSendSource.lastIndexOf("consumeInterceptionEvent(event);"),
    "safe beforeinput events should stay unowned, while WhatsApp submit and Enter sends must be the explicit verified-replay exception"
  );
  assert.ok(
    beforeInputSource.includes("event?.isTrusted === false") &&
      beforeInputSource.includes("isProgrammaticInputScanSuppressed()") &&
      beforeInputSource.indexOf("event?.isTrusted === false") <
        beforeInputSource.indexOf("shouldInterceptBeforeInput(event)"),
    "programmatic ChatGPT rewrite events should not be re-intercepted as typed user input"
  );
  assert.ok(
    contentSource.includes("function waitForAnimationFrameOrTimeout") &&
      contentSource.includes("window.setTimeout(finish, timeoutMs)") &&
      contentSource.includes("window.requestAnimationFrame(finish)") &&
      extractFunctionSource(contentSource, "settleComposer").includes("waitForAnimationFrameOrTimeout();"),
    "composer settling should not hang indefinitely when requestAnimationFrame is throttled"
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
    modalSource.includes('addEventListener?.("keyup", onKeyPassthrough, true);') &&
      modalSource.includes('addEventListener?.("keypress", onKeyPassthrough, true);'),
    "decision modal should consume confirm/cancel keys across keydown, keypress, and keyup while open"
  );
  assert.ok(
    modalSource.includes('addEventListener?.("beforeinput", onModalPassthrough, true);') &&
      modalSource.includes('addEventListener?.("input", onModalPassthrough, true);') &&
      modalSource.includes('addEventListener?.("paste", onModalPassthrough, true);'),
    "message modals should consume typing and paste events so host composers cannot change underneath errors"
  );
  assert.ok(
    modalSource.includes('finish({ action: getFocusedAction() || "redact" });'),
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
    submitTransactionalSource.includes("rewriteComposerTransactionally(") &&
      submitTransactionalSource.includes("ensureExactComposerState(input, redactedText") &&
      submitTransactionalSource.includes("showRewriteFailure("),
    "submit/Enter redaction helper should use transactional rewrite plus exact verification before any send retry"
  );
  assert.ok(
    queueVerifiedSendSource.includes("ensureExactComposerState(input, expectedText") &&
      queueVerifiedSendSource.indexOf("ensureExactComposerState(input, expectedText") <
        queueVerifiedSendSource.indexOf("send();") &&
      queueVerifiedSendSource.includes("showRewriteFailure("),
    "submit/Enter send retry should re-check exact composer state in the queued send microtask before clicking/submitting"
  );
  assert.ok(
    submitSource.includes("applySubmitRedactionTransactionally(") &&
      submitSource.includes("queueVerifiedComposerSend(input, result.redactedText") &&
      !submitSource.includes("applyComposerText(input, result.redactedText"),
    "risky submit redaction paths should use the transactional raw-leak-resistant helper instead of direct applyComposerText"
  );
  assert.ok(
    fallbackSendSource.includes("applySubmitRedactionTransactionally(") &&
      fallbackSendSource.includes("queueVerifiedComposerSend(input, result.redactedText") &&
      !fallbackSendSource.includes("applyComposerText(input, result.redactedText"),
    "risky Enter-send redaction paths should use the transactional raw-leak-resistant helper instead of direct applyComposerText"
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
    assert.ok(
      `${contentSource}\n${rewriteVerificationTextSource}`.includes(label),
      `content script should keep safe debug label ${label}`
    );
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
    pasteSource.indexOf("rememberWhatsAppTextPaste(input, pasted, event);") <
      pasteSource.indexOf("await maybeHandleChatGptLargeTextPaste(event, input, pasted, quickAnalysis)"),
    "WhatsApp paste dedupe must be remembered before async large-paste checks can let paired beforeinput append duplicates"
  );
  assert.ok(
    pasteSource.includes(
      [
        "rememberWhatsAppTextPaste(input, pasted, event);",
        "    consumeInterceptionEvent(event);",
        "",
        "    if (await maybeHandleChatGptLargeTextPaste(event, input, pasted, quickAnalysis))"
      ].join("\n")
    ),
    "risky paste events must be consumed before awaited branches let the host insert raw or duplicate text"
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
    "ReplayVerification",
    [
      "let replayVerification = null;",
      "function getInputText(input) { return input?.value || input?.text || \"\"; }",
      "function analyzeText() { return { findings: [], secretFindings: [] }; }",
      "function debugRewriteVerification() {}",
      extractFunctionSource(contentSource, "getReplayVerification"),
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
    PLACEHOLDER_TOKEN_REGEX,
    globalThis.PWM.ReplayVerification
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

function testWhatsAppParagraphComposerSerializationAvoidsInnerTextBlankLineInflation() {
  const textNode = (value) => ({
    nodeType: 3,
    nodeValue: value
  });
  const elementNode = (tagName, children = []) => ({
    nodeType: 1,
    tagName,
    childNodes: children,
    textContent: children.map((child) => child.nodeValue || child.textContent || "").join("")
  });
  const lines = [
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "DATABASE_URL=postgres://qa_user:[PWM_3]@db.internal.example:5432/prod",
    "AdminPassword=[PWM_3]",
    "",
    "[PWM_4]"
  ];
  const composer = {
    tagName: "DIV",
    isContentEditable: true,
    getAttribute: (name) => (name === "contenteditable" ? "true" : null),
    innerText: `${lines.join("\n\n")}\n\n`,
    childNodes: lines.concat([""]).map((line) => elementNode("P", line ? [textNode(line)] : []))
  };

  assert.strictEqual(
    ComposerHelpers.getInputText(composer),
    lines.join("\n"),
    "WhatsApp paragraph nodes should serialize without DOM-added blank lines"
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
      "const ReplayVerification = deps.ReplayVerification;",
      "let replayVerification = null;",
      "const window = {};",
      "globalThis.PWM.DebugLogger = { ...(globalThis.PWM.DebugLogger || {}), debugEvent: (label, payload) => deps.logs.push({ label, payload }) };",
      "function debugReveal(label, payload) { deps.logs.push({ label, payload }); }",
      extractFunctionSource(contentSource, "getReplayVerification"),
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
    ReplayVerification: globalThis.PWM.ReplayVerification,
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
    analyzeText: overrides.analyzeText || ((text) => {
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
    })
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

  const enterpriseWrapped = await verifyComposerRewriteSafe({
    input: createVerificationInput("GCP project number:\n[GCP_PROJECT_NUMBER_1]\n", {
      innerText: "GCP project number:\n[GCP_PROJECT_NUMBER_1]\n",
      textContent: "GCP project number:[GCP_PROJECT_NUMBER_1]"
    }),
    expectedText: "GCP project number: [GCP_PROJECT_NUMBER_1]",
    originalText: "GCP project number: 123456789012",
    findings: [{ raw: "123456789012", type: "GCP_PROJECT_NUMBER", severity: "high", score: 90 }],
    context: "enterprise-placeholder-wrapper"
  });
  assert.strictEqual(
    enterpriseWrapped.ok,
    true,
    "enterprise/cloud placeholders should verify after ChatGPT wraps them onto separate lines"
  );

  const placeholderRescanHarness = createRewriteVerificationHarness({
    analyzeText: (text) => {
      const findings = [];
      for (const match of String(text || "").matchAll(/\[(?:PWM|KUBECONFIG_SECRET)_\d+\]/g)) {
        findings.push({
          raw: match[0],
          severity: "high",
          score: 100,
          start: match.index,
          end: match.index + match[0].length
        });
      }
      for (const match of String(text || "").matchAll(/postgres:\/\/[^\s]+/g)) {
        findings.push({
          raw: match[0],
          type: "CONNECTION_STRING",
          severity: "high",
          score: 92,
          start: match.index,
          end: match.index + match[0].length
        });
      }
      for (const match of String(text || "").matchAll(/jdbc:sqlserver:\/\/[^\s;]+:[0-9]+;databaseName=[^;]+;user=/g)) {
        findings.push({
          raw: match[0],
          type: "DB_URI",
          severity: "high",
          score: 92,
          start: match.index,
          end: match.index + match[0].length
        });
      }
      return { findings, secretFindings: findings };
    }
  });
  const placeholderOnly = await placeholderRescanHarness.verifyComposerRewriteSafe({
    input: createVerificationInput("Authorization: Bearer [PWM_1]\nkubeconfig token: [KUBECONFIG_SECRET_1]"),
    expectedText: "Authorization: Bearer [PWM_1]\nkubeconfig token: [KUBECONFIG_SECRET_1]",
    originalText: "Authorization: Bearer RawSecretABCDE12345\nkubeconfig token: OriginalSecretXYZ98765",
    findings: [
      { raw: "RawSecretABCDE12345", severity: "high", score: 90 },
      { raw: "OriginalSecretXYZ98765", severity: "high", score: 90 }
    ],
    context: "placeholder-rescan"
  });
  assert.strictEqual(
    placeholderOnly.ok,
    true,
    "rewrite verification should not fail just because sanitized placeholders rescan as sensitive values"
  );

  const preservedLabel = await placeholderRescanHarness.verifyComposerRewriteSafe({
    input: createVerificationInput("GCP project_id: [GCP_PROJECT_1]"),
    expectedText: "GCP project_id: [GCP_PROJECT_1]",
    originalText: "GCP project_id: my-prod-project",
    findings: [
      {
        raw: "project_id",
        type: "USERNAME",
        severity: "high",
        score: 99,
        method: ["structured-metadata", "csv-row", "full-value", "exact-key"]
      },
      { raw: "my-prod-project", type: "GCP_PROJECT", severity: "high", score: 90 }
    ],
    context: "preserved-structured-label"
  });
  assert.strictEqual(
    preservedLabel.ok,
    true,
    "rewrite verification should allow preserved structured key labels next to redacted values"
  );

  const sanitizedConnectionString = await placeholderRescanHarness.verifyComposerRewriteSafe({
    input: createVerificationInput("DATABASE_URL=postgres://admin:[PWM_1]@db.prod.internal:5432/app"),
    expectedText: "DATABASE_URL=postgres://admin:[PWM_1]@db.prod.internal:5432/app",
    originalText: "DATABASE_URL=postgres://admin:RawSecretABCDE12345@db.prod.internal:5432/app",
    findings: [{ raw: "RawSecretABCDE12345", severity: "high", score: 90 }],
    context: "sanitized-connection-string"
  });
  assert.strictEqual(
    sanitizedConnectionString.ok,
    true,
    "rewrite verification should allow sanitized connection strings whose secret segment is a placeholder"
  );

  const sanitizedJdbc = await placeholderRescanHarness.verifyComposerRewriteSafe({
    input: createVerificationInput(
      "JDBC_URL=jdbc:sqlserver://sql.corp.internal:1433;databaseName=payroll;user=[USERNAME_1];password=[PWM_1]"
    ),
    expectedText:
      "JDBC_URL=jdbc:sqlserver://sql.corp.internal:1433;databaseName=payroll;user=[USERNAME_1];password=[PWM_1]",
    originalText:
      "JDBC_URL=jdbc:sqlserver://sql.corp.internal:1433;databaseName=payroll;user=svc;password=RawSecretABCDE12345",
    findings: [{ raw: "RawSecretABCDE12345", severity: "high", score: 90 }],
    context: "sanitized-jdbc"
  });
  assert.strictEqual(
    sanitizedJdbc.ok,
    true,
    "rewrite verification should allow sanitized JDBC lines when the detector range stops before placeholders"
  );
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

  harness.setModalOpen(false);
  await harness.showRewriteFailure("paste", {
    ...details,
    safeWhatsAppPlaceholderRewrite: true,
    actual: { length: 275, lineCount: 22, placeholderCount: 9 },
    expected: { length: 264, lineCount: 11, placeholderCount: 9 }
  });
  assert.strictEqual(
    calls.modals,
    1,
    "safe WhatsApp placeholder rewrite mismatches should not show a false failure modal"
  );
}

async function testWhatsAppPasteSafePlaceholderVerificationFailureDoesNotShowFalseModal() {
  const safePlaceholderPasteSource = contentSource.includes(
    "function shouldAcceptWhatsAppSafePlaceholderPasteVerification"
  )
    ? extractFunctionSource(contentSource, "shouldAcceptWhatsAppSafePlaceholderPasteVerification")
    : [
        "function shouldAcceptWhatsAppSafePlaceholderPasteVerification(expectedText, actualText) {",
        "  const expected = normalizeComposerText(expectedText);",
        "  const actual = normalizeComposerText(actualText);",
        "  return Boolean(isWhatsAppHost() && expected && actual && containsVisiblePlaceholderToken(expected) && containsVisiblePlaceholderToken(actual) && actualContainsExpectedPlaceholders(expected, actual) && !hasUnsafeVisibleSecret(actual));",
        "}"
      ].join("\n");
  const createHarness = (options = {}) => {
    const factory = new Function(
      "deps",
      [
        "const calls = { rewrites: 0, failures: 0, refreshes: 0, debug: [] };",
        "function normalizeComposerText(value) { return deps.normalizeComposerText(value); }",
        "function spliceSelectionText(originalText, selection, insertedText) { return deps.spliceSelectionText(originalText, selection, insertedText); }",
        "function isWhatsAppHost() { return deps.isWhatsAppHost; }",
        "function containsVisiblePlaceholderToken(text) { return /\\[(?:PWM|NET|PUB_HOST)_\\d+\\]/.test(String(text || '')); }",
        "function actualContainsExpectedPlaceholders(expectedText, actualText) { return deps.actualContainsExpectedPlaceholders(expectedText, actualText); }",
        "function listPlaceholderTokens(text) { return String(text || '').match(/\\[(?:PWM|NET|PUB_HOST)_\\d+\\]/g) || []; }",
        "function isReasonablyCloseRewriteLength(expectedText, actualText) { return Math.abs(normalizeComposerText(expectedText).length - normalizeComposerText(actualText).length) <= Math.max(80, Math.ceil(normalizeComposerText(expectedText).length * 0.35)); }",
        "function hasUnsafeVisibleSecret(text) { return deps.hasUnsafeVisibleSecret(text); }",
        "function getDebugTextLength(text) { return String(text || '').length; }",
        "function countDebugPlaceholders(text) { return (String(text || '').match(/\\[(?:PWM|NET|PUB_HOST)_\\d+\\]/g) || []).length; }",
        "function debugReveal(label, payload) { calls.debug.push({ label, payload }); }",
        "async function rewriteComposerTransactionally() { calls.rewrites += 1; return { ok: false, actual: deps.actualText, strategy: 'forced-failed-verification' }; }",
        "function collectFailureDetails(_input, expectedText, actualText, context) { return { expectedText, actualText, context }; }",
        "async function showRewriteFailure(context, details) { calls.failures += 1; calls.failureContext = context; calls.failureDetails = details; }",
        "function refreshBadgeFromCurrentInput() { calls.refreshes += 1; }",
        safePlaceholderPasteSource,
        extractFunctionSource(contentSource, "applyPasteDecision"),
        "return { applyPasteDecision, calls };"
      ].join("\n\n")
    );
    return factory({
      normalizeComposerText: ComposerHelpers.normalizeComposerText,
      spliceSelectionText,
      isWhatsAppHost: options.isWhatsAppHost !== false,
      actualText: options.actualText,
      actualContainsExpectedPlaceholders:
        globalThis.PWM.RewriteVerificationText.actualContainsExpectedPlaceholders,
      hasUnsafeVisibleSecret:
        options.hasUnsafeVisibleSecret ||
        ((text) => /sk-proj-StillRawSecretValue1234567890abcdef/.test(String(text || "")))
    });
  };
  const rawText = [
    "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
    "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz123456",
    "DATABASE_URL=postgres://qa_user:RawDbSecretValue123456@db.internal.example:5432/prod",
    "AdminPassword=RawDbSecretValue123456"
  ].join("\n");
  const redactedText = [
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "GITHUB_TOKEN=[PWM_3]",
    "DATABASE_URL=postgres://qa_user:[PWM_4]@db.internal.example:5432/prod",
    "AdminPassword=[PWM_4]"
  ].join("\n");

  const safeHarness = createHarness({ actualText: redactedText });
  const safeOk = await safeHarness.applyPasteDecision(
    { text: redactedText },
    rawText,
    { start: 0, end: rawText.length },
    redactedText,
    "paste",
    { rawInsertedText: rawText }
  );

  assert.strictEqual(safeOk, true, "safe WhatsApp placeholder paste should not show a false rewrite failure");
  assert.strictEqual(safeHarness.calls.failures, 0, "safe placeholder paste should suppress the false failure modal");

  const paragraphExpandedText = `${redactedText.split("\n").join("\n\n")}\n\n`;
  const paragraphHarness = createHarness({ actualText: paragraphExpandedText });
  const paragraphOk = await paragraphHarness.applyPasteDecision(
    { text: paragraphExpandedText },
    rawText,
    { start: 0, end: rawText.length },
    redactedText,
    "paste",
    { rawInsertedText: rawText }
  );

  assert.strictEqual(paragraphOk, true, "safe WhatsApp paragraph-expanded paste should verify safely");
  assert.strictEqual(
    paragraphHarness.calls.failures,
    0,
    "WhatsApp DOM-added paragraph blank lines should not show a false rewrite failure"
  );

  const unsafeHarness = createHarness({
    actualText: `${redactedText}\nOPENAI_API_KEY=sk-proj-StillRawSecretValue1234567890abcdef`
  });
  const unsafeOk = await unsafeHarness.applyPasteDecision(
    { text: unsafeHarness.calls.actualText },
    rawText,
    { start: 0, end: rawText.length },
    redactedText,
    "paste",
    { rawInsertedText: rawText }
  );

  assert.strictEqual(unsafeOk, false, "raw visible secrets must still fail closed");
  assert.strictEqual(unsafeHarness.calls.failures, 1, "unsafe actual composer text should still show the failure modal");

  const duplicateHarness = createHarness({
    actualText: `${redactedText}\n${redactedText}`
  });
  const duplicateOk = await duplicateHarness.applyPasteDecision(
    { text: redactedText },
    rawText,
    { start: 0, end: rawText.length },
    redactedText,
    "paste",
    { rawInsertedText: rawText }
  );

  assert.strictEqual(duplicateOk, false, "duplicated sanitized WhatsApp paste should not be accepted");
  assert.strictEqual(duplicateHarness.calls.failures, 1, "duplicated sanitized text should still surface verification failure");

  const nonWhatsAppHarness = createHarness({ actualText: redactedText, isWhatsAppHost: false });
  const nonWhatsAppOk = await nonWhatsAppHarness.applyPasteDecision(
    { text: redactedText },
    rawText,
    { start: 0, end: rawText.length },
    redactedText,
    "paste",
    { rawInsertedText: rawText }
  );

  assert.strictEqual(nonWhatsAppOk, false, "safe placeholder acceptance should stay scoped to WhatsApp paste");
  assert.strictEqual(nonWhatsAppHarness.calls.failures, 1);
}

function testWhatsAppSplitCredentialPlaceholderIsNotUnsafeVisibleSecret() {
  const factory = new Function(
    "deps",
    [
      "const ANY_PLACEHOLDER_TOKEN_REGEX = /\\[(?:PWM|NET|PUB_HOST)_\\d+\\]/g;",
      "const PLACEHOLDER_TOKEN_REGEX = /\\[(?:PWM|NET|PUB_HOST)_\\d+\\]/g;",
      "const ReplayVerification = deps.ReplayVerification;",
      "let replayVerification = null;",
      "function normalizeComposerText(text) { return String(text || \"\"); }",
      "function normalizeEditorInnerText(text) { return String(text || \"\"); }",
      "function getInputText() { return \"\"; }",
      "function analyzeText(text) { return deps.analyzeText(text); }",
      "function debugRewriteVerification() {}",
      extractFunctionSource(contentSource, "getReplayVerification"),
      extractFunctionSource(contentSource, "containsVisiblePlaceholderToken"),
      extractFunctionSource(contentSource, "isHighConfidenceRewriteFinding"),
      extractFunctionSource(contentSource, "hasUnsafeVisibleSecret"),
      "return { hasUnsafeVisibleSecret };"
    ].join("\n\n")
  );
  const harness = factory({
    ReplayVerification: globalThis.PWM.ReplayVerification,
    analyzeText: (text) => {
      const findings = analyze(text);
      return {
        findings,
        secretFindings: findings.filter((finding) => finding.type !== "PUBLIC_IPV4")
      };
    }
  });
  const splitSanitized = [
    "DATABASE_URL=postgres://qa_user:",
    "[PWM_7]@db.internal.example:5432/prod",
    "AdminPassword=[PWM_7]"
  ].join("\n");

  assert.strictEqual(
    harness.hasUnsafeVisibleSecret(splitSanitized),
    false,
    "WhatsApp line wrapping after URL credential prefix should stay safe when the placeholder is visible"
  );
  assert.strictEqual(
    harness.hasUnsafeVisibleSecret("DATABASE_URL=postgres://qa_user:RawDbSecretValue123456@db.internal.example:5432/prod"),
    true,
    "raw DB URL credentials must still be treated as unsafe visible secrets"
  );
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

async function testWhatsAppSendButtonClickOwnsSafeTextForVerifiedReplay() {
  const factory = new Function(
    [
      "let extensionRuntimeAvailable = true;",
      "let modalOpen = false;",
      "let bypassNextSendButtonClick = false;",
      "const calls = { consumed: 0, submitEvents: 0 };",
      "const button = { closest: () => null };",
      "const input = { text: 'LGQA_WHATSAPP_SAFE_TEXT hello team' };",
      "function normalizeTarget(target) { return target; }",
      "function isWhatsAppHost() { return true; }",
      "function findSendButtonClickTarget() { return button; }",
      "function findComposer() { return input; }",
      "function noteActiveRiskEditor() {}",
      "function getInputText(target) { return target.text; }",
      "function analyzeText() { return { findings: [], placeholderNormalized: false }; }",
      "function analysisNeedsEventOwnership() { return false; }",
      "function shouldBypassWhatsAppSanitizedImageSend() { return false; }",
      "function consumeInterceptionEvent() { calls.consumed += 1; }",
      "function createSyntheticSubmitInterceptionEvent(target, options) { return { target, leakGuardSendButton: options.sendButton, leakGuardReplayViaClick: options.replayViaClick }; }",
      "async function maybeHandleSubmit(event) { calls.submitEvents += 1; calls.submitEvent = event; }",
      "async function blockWhatsAppTextSend() { calls.blocked = true; }",
      extractFunctionSource(contentSource, "shouldOwnWhatsAppTextSend"),
      extractFunctionSource(contentSource, "maybeHandleSendButtonClick"),
      "return { maybeHandleSendButtonClick, calls, button, input };"
    ].join("\n\n")
  );
  const { maybeHandleSendButtonClick, calls, button, input } = factory();

  await maybeHandleSendButtonClick({ target: button });

  assert.strictEqual(calls.consumed, 1, "WhatsApp send click should be owned even when quick analysis sees safe text");
  assert.strictEqual(calls.submitEvents, 1, "owned WhatsApp click should route through the verified submit pipeline");
  assert.strictEqual(calls.submitEvent.target, input);
  assert.strictEqual(calls.submitEvent.leakGuardSendButton, button);
  assert.strictEqual(calls.submitEvent.leakGuardReplayViaClick, true);
}

async function testWhatsAppSendButtonClickFailsClosedWithoutComposer() {
  const factory = new Function(
    [
      "let extensionRuntimeAvailable = true;",
      "let modalOpen = false;",
      "let bypassNextSendButtonClick = false;",
      "const calls = { consumed: 0, blocks: 0 };",
      "const button = { closest: () => null };",
      "function normalizeTarget(target) { return target; }",
      "function isWhatsAppHost() { return true; }",
      "function findSendButtonClickTarget() { return button; }",
      "function findComposer() { return null; }",
      "function consumeInterceptionEvent() { calls.consumed += 1; }",
      "async function blockWhatsAppTextSend(reason) { calls.blocks += 1; calls.reason = reason; }",
      extractFunctionSource(contentSource, "maybeHandleSendButtonClick"),
      "return { maybeHandleSendButtonClick, calls, button };"
    ].join("\n\n")
  );
  const { maybeHandleSendButtonClick, calls, button } = factory();

  await maybeHandleSendButtonClick({ target: button });

  assert.strictEqual(calls.consumed, 1, "WhatsApp send click should be consumed when composer detection fails");
  assert.strictEqual(calls.blocks, 1, "WhatsApp send click should show a local block instead of raw passthrough");
  assert.strictEqual(calls.reason, "composer_not_found");
}

function createWhatsAppSubmitHarness(options = {}) {
  const text = Object.prototype.hasOwnProperty.call(options, "text")
    ? options.text
    : "LGQA_WHATSAPP_SAFE_TEXT hello team";
  const factory = new Function(
    "text",
    "queueSettles",
    [
      "let extensionRuntimeAvailable = true;",
      "let modalOpen = false;",
      "let bypassNextSubmit = false;",
      "let whatsAppBypassSanitizedImageSubmitUntil = 0;",
      "const WHATSAPP_TEXT_SEND_GUARD_MS = 5000;",
      "const whatsAppPendingTextSendInputs = new WeakSet();",
      "const whatsAppPendingTextSendTimers = new WeakMap();",
      "const calls = {",
      "  consumed: 0,",
      "  blocks: 0,",
      "  findComposer: 0,",
      "  notes: 0,",
      "  quickAnalyses: 0,",
      "  aiAnalyses: 0,",
      "  normalizedWrites: 0,",
      "  exactChecks: 0,",
      "  queued: 0,",
      "  replayed: 0,",
      "  redactions: 0,",
      "  fallbackPending: 0,",
      "  fallbackCleared: 0,",
      "  timers: 0,",
      "  clearedTimers: 0,",
      "  queuedTexts: []",
      "};",
      "const button = {};",
      "const input = { text, closest: () => null, querySelector: () => null };",
      "function setTimeout(fn, ms) { calls.timers += 1; return { fn, ms }; }",
      "function clearTimeout() { calls.clearedTimers += 1; }",
      "function isWhatsAppHost() { return true; }",
      "function consumeInterceptionEvent(event) { calls.consumed += 1; event.consumed = true; }",
      "async function blockWhatsAppTextSend(reason) { calls.blocks += 1; calls.blockReason = reason; }",
      "function findComposer() { calls.findComposer += 1; return input; }",
      "function findSendButton() { return button; }",
      "function noteActiveRiskEditor() { calls.notes += 1; }",
      "function getInputText(target) { return target.text; }",
      "function analyzeText() { calls.quickAnalyses += 1; return { findings: [], placeholderNormalized: false }; }",
      "function analysisNeedsEventOwnership() { return false; }",
      "function shouldBypassWhatsAppSanitizedImageSend() { return false; }",
      "async function analyzeTextWithAiAssist(value) {",
      "  calls.aiAnalyses += 1;",
      "  return { findings: [], secretFindings: [], placeholderNormalized: false, normalizedText: value };",
      "}",
      "function analysisHasOnlySanitizedPlaceholderFindings() { return false; }",
      "function getActivePolicy() { return {}; }",
      "async function getPolicyForAction() { throw new Error('safe WhatsApp text should not request risky policy'); }",
      "async function handleDestinationPolicy() { throw new Error('safe WhatsApp text should not handle destination findings'); }",
      "function getDestinationPolicyDecision() { return { blocked: false }; }",
      "function shouldForceDestinationRedaction() { return false; }",
      "async function handleHttpSecretPolicy() { return false; }",
      "function isProtectionPauseActiveAfterPolicy() { return false; }",
      "function clearAllRiskSessionState() {}",
      "async function promptForSensitiveContentDecision() { throw new Error('safe WhatsApp text should not prompt'); }",
      "async function requestRedaction(value) { calls.redactions += 1; return { redactedText: value }; }",
      "async function applySubmitRedactionTransactionally() { throw new Error('safe WhatsApp text should not redact transactionally'); }",
      "async function applyNormalizedComposerRewrite(target, value) {",
      "  calls.normalizedWrites += 1;",
      "  target.text = value;",
      "  return { ok: true, text: value };",
      "}",
      "async function ensureExactComposerState(target, expected) {",
      "  calls.exactChecks += 1;",
      "  return target.text === expected;",
      "}",
      "async function showRewriteFailure() { calls.blocks += 1; calls.blockReason = 'rewrite_failure'; }",
      "function collectFailureDetails() { return {}; }",
      "function refreshBadgeFromCurrentInput() {}",
      "function setBadge() {}",
      "function hideBadgeSoon() {}",
      "function markFallbackSendKeyRedactionPending(target) { calls.fallbackPending += 1; fallbackSendKeySuppressionInput = target; }",
      "function clearFallbackSendKeyRedactionPending(target) {",
      "  calls.fallbackCleared += 1;",
      "  if (!target || target === fallbackSendKeySuppressionInput) fallbackSendKeySuppressionInput = null;",
      "}",
      "let fallbackSendKeySuppressionInput = null;",
      "let fallbackSendKeySuppressionUntil = 0;",
      "function queueVerifiedComposerSend(_input, expected, context, replay, verifiedOptions) {",
      "  calls.queued += 1;",
      "  calls.queuedTexts.push(expected);",
      "  calls.queueContext = context;",
      "  calls.queueOptions = verifiedOptions;",
      "  if (queueSettles) {",
      "    replay();",
      "    if (verifiedOptions && typeof verifiedOptions.onSettled === 'function') verifiedOptions.onSettled();",
      "  }",
      "}",
      "function replayVerifiedSend(_input, _form, sendButton, replayOptions) {",
      "  calls.replayed += 1;",
      "  calls.replayButton = sendButton;",
      "  calls.replayOptions = replayOptions || null;",
      "}",
      extractFunctionSource(contentSource, "shouldOwnWhatsAppTextSend"),
      extractFunctionSource(contentSource, "clearWhatsAppTextSendPending"),
      extractFunctionSource(contentSource, "markWhatsAppTextSendPending"),
      extractFunctionSource(contentSource, "createWhatsAppVerifiedSendOptions"),
      extractFunctionSource(contentSource, "maybeHandleSubmit"),
      extractFunctionSource(contentSource, "maybeHandleFallbackSendKey"),
      "return { maybeHandleSubmit, maybeHandleFallbackSendKey, calls, input, button };"
    ].join("\n\n")
  );
  return factory(text, options.queueSettles !== false);
}

async function testWhatsAppShiftEnterDoesNotOwnFallbackSend() {
  const { maybeHandleFallbackSendKey, calls, input } = createWhatsAppSubmitHarness({
    text: "LGQA_WHATSAPP_SHIFT_ENTER should stay multiline"
  });

  await maybeHandleFallbackSendKey({
    target: input,
    key: "Enter",
    shiftKey: true,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    defaultPrevented: false
  });

  assert.strictEqual(calls.consumed, 0, "WhatsApp Shift+Enter should not be consumed as send");
  assert.strictEqual(calls.findComposer, 0, "WhatsApp Shift+Enter should leave multiline typing to the page");
  assert.strictEqual(calls.queued, 0, "WhatsApp Shift+Enter should not queue verified replay");
  assert.strictEqual(calls.blocks, 0, "WhatsApp Shift+Enter should not show a block modal");
}

async function testWhatsAppEmptyComposerClickEnterAndSubmitAreIgnoredSafely() {
  const clickFactory = new Function(
    [
      "let extensionRuntimeAvailable = true;",
      "let modalOpen = false;",
      "let bypassNextSendButtonClick = false;",
      "const calls = { consumed: 0, blocks: 0, submitEvents: 0, analyses: 0 };",
      "const button = { closest: () => null };",
      "const input = { text: '   ' };",
      "function normalizeTarget(target) { return target; }",
      "function isWhatsAppHost() { return true; }",
      "function findSendButtonClickTarget() { return button; }",
      "function findComposer() { return input; }",
      "function noteActiveRiskEditor() {}",
      "function getInputText(target) { return target.text; }",
      "function analyzeText() { calls.analyses += 1; return { findings: [], placeholderNormalized: false }; }",
      "function analysisNeedsEventOwnership() { return false; }",
      "function shouldBypassWhatsAppSanitizedImageSend() { return false; }",
      "function consumeInterceptionEvent() { calls.consumed += 1; }",
      "async function maybeHandleSubmit() { calls.submitEvents += 1; }",
      "async function blockWhatsAppTextSend(reason) { calls.blocks += 1; calls.reason = reason; }",
      extractFunctionSource(contentSource, "shouldOwnWhatsAppTextSend"),
      extractFunctionSource(contentSource, "maybeHandleSendButtonClick"),
      "return { maybeHandleSendButtonClick, calls, button };"
    ].join("\n\n")
  );
  const clickHarness = clickFactory();

  await clickHarness.maybeHandleSendButtonClick({ target: clickHarness.button });

  assert.strictEqual(clickHarness.calls.consumed, 0, "empty WhatsApp send click should be ignored by LeakGuard");
  assert.strictEqual(clickHarness.calls.blocks, 0, "empty WhatsApp send click should not show a false failure");
  assert.strictEqual(clickHarness.calls.submitEvents, 0, "empty WhatsApp send click should not replay send");
  assert.strictEqual(clickHarness.calls.analyses, 0, "empty WhatsApp send click should not analyze empty text");

  const enterHarness = createWhatsAppSubmitHarness({ text: "" });
  await enterHarness.maybeHandleFallbackSendKey({
    target: enterHarness.input,
    key: "Enter",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    defaultPrevented: false
  });
  assert.strictEqual(enterHarness.calls.consumed, 0, "empty WhatsApp Enter should be ignored by LeakGuard");
  assert.strictEqual(enterHarness.calls.blocks, 0, "empty WhatsApp Enter should not show a false failure");
  assert.strictEqual(enterHarness.calls.queued, 0, "empty WhatsApp Enter should not replay send");

  const submitHarness = createWhatsAppSubmitHarness({ text: "" });
  await submitHarness.maybeHandleSubmit({ target: submitHarness.input, type: "submit" });
  assert.strictEqual(submitHarness.calls.consumed, 0, "empty WhatsApp submit should be ignored safely");
  assert.strictEqual(submitHarness.calls.blocks, 0, "empty WhatsApp submit should not report extraction failure");
  assert.strictEqual(submitHarness.calls.queued, 0, "empty WhatsApp submit should not queue verified replay");
}

async function testWhatsAppUntrustedTextExtractionFailsClosed() {
  const clickFactory = new Function(
    [
      "let extensionRuntimeAvailable = true;",
      "let modalOpen = false;",
      "let bypassNextSendButtonClick = false;",
      "const calls = { consumed: 0, blocks: 0, submitEvents: 0 };",
      "const button = { closest: () => null };",
      "const input = {};",
      "function normalizeTarget(target) { return target; }",
      "function isWhatsAppHost() { return true; }",
      "function findSendButtonClickTarget() { return button; }",
      "function findComposer() { return input; }",
      "function noteActiveRiskEditor() {}",
      "function getInputText() { return null; }",
      "function consumeInterceptionEvent() { calls.consumed += 1; }",
      "async function maybeHandleSubmit() { calls.submitEvents += 1; }",
      "async function blockWhatsAppTextSend(reason) { calls.blocks += 1; calls.reason = reason; }",
      extractFunctionSource(contentSource, "shouldOwnWhatsAppTextSend"),
      extractFunctionSource(contentSource, "maybeHandleSendButtonClick"),
      "return { maybeHandleSendButtonClick, calls, button };"
    ].join("\n\n")
  );
  const clickHarness = clickFactory();

  await clickHarness.maybeHandleSendButtonClick({ target: clickHarness.button });

  assert.strictEqual(clickHarness.calls.consumed, 1, "untrusted WhatsApp click extraction should be consumed");
  assert.strictEqual(clickHarness.calls.blocks, 1, "untrusted WhatsApp click extraction should fail closed");
  assert.strictEqual(clickHarness.calls.reason, "text_extraction_failed");
  assert.strictEqual(clickHarness.calls.submitEvents, 0, "untrusted WhatsApp click extraction should not replay");

  const submitHarness = createWhatsAppSubmitHarness({ text: null });
  await submitHarness.maybeHandleSubmit({ target: submitHarness.input, type: "submit" });
  assert.strictEqual(submitHarness.calls.consumed, 1, "untrusted WhatsApp submit extraction should be consumed");
  assert.strictEqual(submitHarness.calls.blocks, 1, "untrusted WhatsApp submit extraction should fail closed");
  assert.strictEqual(submitHarness.calls.blockReason, "text_extraction_failed");
  assert.strictEqual(submitHarness.calls.queued, 0, "untrusted WhatsApp submit extraction should not replay");

  const enterHarness = createWhatsAppSubmitHarness({ text: null });
  await enterHarness.maybeHandleFallbackSendKey({
    target: enterHarness.input,
    key: "Enter",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    defaultPrevented: false
  });
  assert.strictEqual(enterHarness.calls.consumed, 1, "untrusted WhatsApp Enter extraction should be consumed");
  assert.strictEqual(enterHarness.calls.blocks, 1, "untrusted WhatsApp Enter extraction should fail closed");
  assert.strictEqual(enterHarness.calls.blockReason, "text_extraction_failed");
  assert.strictEqual(enterHarness.calls.queued, 0, "untrusted WhatsApp Enter extraction should not replay");
}

async function testWhatsAppSafeTextVariantsUseVerifiedReplayWithoutRedaction() {
  const variants = [
    "LGQA_WHATSAPP_NORMAL_TEXT hello team",
    "LGQA_WHATSAPP_PUNCTUATION !!! ... ???",
    "LGQA_WHATSAPP_EMOJI_ONLY \\u{1F642}",
    "LGQA_WHATSAPP_PLACEHOLDER_1 my password is [PWM_1]",
    "LGQA_WHATSAPP_PLACEHOLDER_2 my password is [PWM_2]"
  ];

  for (const text of variants) {
    const { maybeHandleSubmit, calls, input, button } = createWhatsAppSubmitHarness({ text });

    await maybeHandleSubmit({ target: input, type: "submit" });

    assert.strictEqual(calls.consumed, 1, `${text} should be owned for verified replay`);
    assert.strictEqual(calls.blocks, 0, `${text} should not be blocked`);
    assert.strictEqual(calls.redactions, 0, `${text} should not request redaction`);
    assert.strictEqual(calls.normalizedWrites, 1, `${text} should use normalized same-text verification`);
    assert.strictEqual(calls.exactChecks, 1, `${text} should verify the composer before replay`);
    assert.strictEqual(calls.queued, 1, `${text} should queue exactly one verified send`);
    assert.strictEqual(calls.replayed, 1, `${text} should replay exactly once after verification`);
    assert.deepStrictEqual(calls.queuedTexts, [text], `${text} should not be rewritten into a new value`);
    assert.strictEqual(input.text, text, `${text} should remain unchanged in the composer`);
    assert.strictEqual(calls.replayButton, button, `${text} should replay through the detected send button`);
  }
}

async function testWhatsAppSecondSubmitOrEnterWhilePendingDoesNotStartRetryPath() {
  const clickPath = createWhatsAppSubmitHarness({
    text: "LGQA_WHATSAPP_DOUBLE_CLICK first click only",
    queueSettles: false
  });

  await clickPath.maybeHandleSubmit({ target: clickPath.input, type: "submit" });
  await clickPath.maybeHandleSubmit({ target: clickPath.input, type: "submit" });

  assert.strictEqual(clickPath.calls.consumed, 2, "pending WhatsApp submit retries should still be consumed");
  assert.strictEqual(clickPath.calls.queued, 1, "pending WhatsApp submit retries should not start a second verified send");
  assert.strictEqual(clickPath.calls.replayed, 0, "test harness keeps the first send pending, so retry cannot become success");
  assert.strictEqual(clickPath.calls.blocks, 0, "pending WhatsApp submit retry should not show a false block");

  const enterPath = createWhatsAppSubmitHarness({
    text: "LGQA_WHATSAPP_DOUBLE_ENTER first Enter only",
    queueSettles: false
  });
  const enterEvent = {
    target: enterPath.input,
    key: "Enter",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    defaultPrevented: false
  };

  await enterPath.maybeHandleFallbackSendKey({ ...enterEvent });
  await enterPath.maybeHandleFallbackSendKey({ ...enterEvent });

  assert.strictEqual(enterPath.calls.consumed, 2, "pending WhatsApp Enter retries should still be consumed");
  assert.strictEqual(enterPath.calls.queued, 1, "pending WhatsApp Enter retries should not start a second verified send");
  assert.strictEqual(enterPath.calls.replayed, 0, "test harness keeps the first Enter send pending, so retry cannot become success");
  assert.strictEqual(enterPath.calls.blocks, 0, "pending WhatsApp Enter retry should not show a false block");
}

function testWhatsAppEditorActionEmitsSingleDataBearingInsert() {
  const factory = new Function(
    "normalizeComposerText",
    "options",
    [
      "const calls = { commands: [], events: [] };",
      "const preventDefaultPaste = Boolean(options?.preventDefaultPaste);",
      "let modelText = '';",
      "const selection = { removeAllRanges() {}, addRange() {} };",
      "const range = { selectNodeContents() {} };",
      "const window = { getSelection: () => selection };",
      "class Event { constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); this.composed = Boolean(init.composed); this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } }",
      "class InputEvent extends Event { constructor(type, init = {}) { super(type, init); this.cancelable = Boolean(init.cancelable); this.inputType = init.inputType || ''; this.data = init.data == null ? null : String(init.data); } }",
      "class DataTransfer { constructor() { this.store = new Map(); this.types = []; } setData(type, value) { this.store.set(type, String(value || '')); this.types = Array.from(this.store.keys()); } getData(type) { return this.store.get(type) || ''; } }",
      "class ClipboardEvent extends Event { constructor(type, init = {}) { super(type, init); this.cancelable = Boolean(init.cancelable); this.clipboardData = init.clipboardData || null; } }",
      "const document = {",
      "  createRange: () => range,",
      "  dispatchEvent: () => true,",
      "  execCommand(command, _showUi, value) {",
      "    calls.commands.push({ command, value: value == null ? null : String(value) });",
      "    if (command === 'insertText') { modelText += String(value || ''); return true; }",
      "    return false;",
      "  }",
      "};",
      "const input = {",
      "  focus() {},",
      "  dispatchEvent(event) {",
      "    calls.events.push({ type: event.type, inputType: event.inputType || '', data: event.data == null ? null : String(event.data), clipboardText: event.clipboardData?.getData?.('text/plain') || '' });",
      "    if (event.type === 'paste') { modelText += event.clipboardData?.getData?.('text/plain') || ''; if (preventDefaultPaste) event.preventDefault(); return !event.defaultPrevented; }",
      "    if ((event.type === 'beforeinput' || event.type === 'input') && event.data && /^insert/.test(event.inputType || '')) {",
      "      modelText += event.data;",
      "    }",
      "    return true;",
      "  }",
      "};",
      "function getInputText() { return modelText; }",
      extractFunctionSource(contentSource, "dispatchWhatsAppEditorInputEvent"),
      extractFunctionSource(contentSource, "dispatchWhatsAppEditorChange"),
      extractFunctionSource(contentSource, "focusWhatsAppComposer"),
      extractFunctionSource(contentSource, "selectWhatsAppComposerContents"),
      extractFunctionSource(contentSource, "runWhatsAppEditorCommand"),
      extractFunctionSource(contentSource, "attachEventDataTransfer"),
      extractFunctionSource(contentSource, "createWhatsAppPlainTextTransfer"),
      extractFunctionSource(contentSource, "markSanitizedTextRewriteEvent"),
      extractFunctionSource(contentSource, "dispatchWhatsAppEditorPasteEvent"),
      extractFunctionSource(contentSource, "insertWhatsAppComposerTextThroughEditor"),
      "return { input, calls, insertWhatsAppComposerTextThroughEditor, getText: () => modelText };"
    ].join("\n\n")
  );
  const harness = factory(ComposerHelpers.normalizeComposerText);
  const text = "LGQA_WHATSAPP_SINGLE_WRITE my password is [PWM_1]";

  const inserted = harness.insertWhatsAppComposerTextThroughEditor(harness.input, text);

  assert.strictEqual(inserted, true);
  assert.strictEqual(
    harness.getText(),
    text,
    "WhatsApp sanitized editor write should not duplicate text through data-bearing beforeinput/input events"
  );
  assert.deepStrictEqual(harness.calls.commands, [{ command: "insertText", value: text }]);

  const multilineHarness = factory(ComposerHelpers.normalizeComposerText);
  const multilineText = [
    "LGQA_WHATSAPP_SINGLE_WRITE first [PWM_1]",
    "LGQA_WHATSAPP_SINGLE_WRITE second [PWM_2]",
    "LGQA_WHATSAPP_SINGLE_WRITE third"
  ].join("\n");

  const multilineInserted = multilineHarness.insertWhatsAppComposerTextThroughEditor(
    multilineHarness.input,
    multilineText
  );

  assert.strictEqual(multilineInserted, true);
  assert.strictEqual(
    multilineHarness.getText(),
    multilineText,
    "WhatsApp sanitized editor write should preserve multiline shape without duplicating text"
  );
  assert.deepStrictEqual(multilineHarness.calls.commands, []);
  assert.deepStrictEqual(
    multilineHarness.calls.events.filter((event) => event.type === "paste").map((event) => event.clipboardText),
    [multilineText],
    "WhatsApp multiline rewrite should hand sanitized text to the editor paste path"
  );
  assert.deepStrictEqual(
    multilineHarness.calls.events.filter((event) => event.data),
    [],
    "WhatsApp multiline rewrite should not dispatch extra data-bearing synthetic input events"
  );

  const handledPasteHarness = factory(ComposerHelpers.normalizeComposerText, { preventDefaultPaste: true });
  const handledPasteText = [
    "LGQA_WHATSAPP_PREVENT_DEFAULT first [PWM_1]",
    "LGQA_WHATSAPP_PREVENT_DEFAULT second [PWM_2]"
  ].join("\n");
  const handledPasteInserted = handledPasteHarness.insertWhatsAppComposerTextThroughEditor(
    handledPasteHarness.input,
    handledPasteText
  );

  assert.strictEqual(
    handledPasteInserted,
    true,
    "WhatsApp paste handlers may preventDefault after accepting sanitized text"
  );
  assert.strictEqual(
    handledPasteHarness.getText(),
    handledPasteText,
    "preventDefault on handled paste should still let LeakGuard verify settled sanitized text"
  );
}

async function testWhatsAppEditorActionAcceptsSafePlaceholderVerification() {
  const expected = [
    "DATABASE_URL=postgres://qa_user:[PWM_1]@db.internal.example:5432/prod",
    "AdminPassword=[PWM_1]"
  ].join("\n");
  const actual = [
    "DATABASE_URL=postgres://qa_user:",
    "[PWM_1]@db.internal.example:5432/prod",
    "AdminPassword=[PWM_1]"
  ].join("\n");
  const original = [
    "DATABASE_URL=postgres://qa_user:RawDbSecretValue123456@db.internal.example:5432/prod",
    "AdminPassword=RawDbSecretValue123456"
  ].join("\n");
  const findings = [{ raw: "RawDbSecretValue123456", severity: "high", score: 90 }];
  const factory = new Function(
    "deps",
    [
      "const calls = { verifications: 0 };",
      "const WHATSAPP_REWRITE_INSERT_TIMEOUT_MS = 700;",
      "const input = { text: deps.actual };",
      "function normalizeComposerText(value) { return deps.normalizeComposerText(value); }",
      "function buildComposerWritePlan(_input, text) { const canonical = normalizeComposerText(text); return { canonical, writeText: canonical, acceptableTexts: [canonical] }; }",
      "function debugWhatsAppComposerSync() {}",
      "function suppressFollowupInputScan() {}",
      "async function clearWhatsAppComposerThroughEditor() { return { ok: true, actual: '', strategy: 'test-clear' }; }",
      "function insertWhatsAppComposerTextThroughEditor(target) { target.text = deps.actual; return true; }",
      "async function waitForWhatsAppComposerText(target) { return { ok: false, actual: normalizeComposerText(target.text) }; }",
      "function getInputText(target) { return normalizeComposerText(target.text); }",
      "async function verifyComposerRewriteSafe(args) { calls.verifications += 1; return deps.verifyComposerRewriteSafe(args); }",
      "function shouldAcceptWhatsAppSafePlaceholderPasteVerification(expectedText, actualText) { return deps.acceptSafe(expectedText, actualText); }",
      extractFunctionSource(contentSource, "applyWhatsAppEditorActionComposerText"),
      "return { applyWhatsAppEditorActionComposerText, calls, input };"
    ].join("\n\n")
  );
  const harness = factory({
    actual,
    normalizeComposerText: ComposerHelpers.normalizeComposerText,
    acceptSafe: (expectedText, actualText) => {
      const tokens = (text) => String(text || "").match(/\[(?:PWM|NET|PUB_HOST)_\d+\]/g) || [];
      return (
        globalThis.PWM.RewriteVerificationText.actualContainsExpectedPlaceholders(expectedText, actualText) &&
        tokens(expectedText).length === tokens(actualText).length &&
        !String(actualText || "").includes("RawDbSecretValue123456")
      );
    },
    verifyComposerRewriteSafe: ({ expectedText, originalText, findings: rewriteFindings, context, actualText }) =>
      globalThis.PWM.RewriteVerificationText.evaluateComposerVerificationCandidates(
        {
          candidates: [{ source: "stable", text: actualText }],
          expectedText,
          originalText,
          findings: rewriteFindings,
          context
        },
        {
          normalizeComposerText: ComposerHelpers.normalizeComposerText,
          normalizeEditorInnerText: ComposerHelpers.normalizeEditorInnerText,
          analyzeText: (text) => {
            const secretFindings = [];
            for (const match of String(text || "").matchAll(/RawDbSecretValue123456/g)) {
              secretFindings.push({
                raw: match[0],
                severity: "high",
                score: 90,
                start: match.index,
                end: match.index + match[0].length
              });
            }
            return { findings: secretFindings, secretFindings };
          }
        }
      )
  });

  const result = await harness.applyWhatsAppEditorActionComposerText(harness.input, expected, {
    context: "submit",
    originalText: original,
    findings
  });

  assert.strictEqual(
    result.ok,
    true,
    "WhatsApp send rewrite should accept safe shared verification when layout differs around placeholders"
  );
  assert.strictEqual(harness.calls.verifications, 1, "safe mismatch should be delegated to rewrite verification");
  assert.strictEqual(result.actual, actual);
}

async function testWhatsAppEditorActionAcceptsSafePlaceholderFallbackAfterVerificationMiss() {
  const expected = [
    "DO NOT USE",
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "GITHUB_TOKEN=[PWM_3]",
    "OPENAI_API_KEY=[PWM_4]",
    "STRIPE_SECRET_KEY=[PWM_5]",
    "SLACK_WEBHOOK=[PWM_6]",
    "DATABASE_URL=postgres://qa_user:[PWM_7]@db.internal.example:5432/prod",
    "AdminPassword=[PWM_7]",
    "",
    "[PWM_8]"
  ].join("\n");
  const actual = [
    "DO NOT USE",
    "",
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "",
    "GITHUB_TOKEN=[PWM_3]",
    "",
    "OPENAI_API_KEY=[PWM_4]",
    "",
    "STRIPE_SECRET_KEY=[PWM_5]",
    "",
    "SLACK_WEBHOOK=[PWM_6]",
    "",
    "DATABASE_URL=postgres://qa_user:[PWM_7]@db.internal.example:5432/prod",
    "",
    "AdminPassword=[PWM_7]",
    "",
    "",
    "",
    "",
    "[PWM_8]"
  ].join("\n");
  const original = [
    "DO NOT USE",
    "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
    "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz123456",
    "OPENAI_API_KEY=sk-proj-LGQAFakeOpenAIKey1234567890abcdef",
    "STRIPE_SECRET_KEY=RedactionLayoutStripeValue123456",
    "SLACK_WEBHOOK=RedactionLayoutSlackWebhookValue123456",
    "DATABASE_URL=postgres://qa_user:RawDbSecretValue123456@db.internal.example:5432/prod",
    "AdminPassword=RawDbSecretValue123456",
    "",
    "AnotherSecretValue123456"
  ].join("\n");
  const factory = new Function(
    "deps",
    [
      "const calls = { verifications: 0 };",
      "const WHATSAPP_REWRITE_INSERT_TIMEOUT_MS = 700;",
      "const input = { text: deps.actual };",
      "function normalizeComposerText(value) { return deps.normalizeComposerText(value); }",
      "function buildComposerWritePlan(_input, text) { const canonical = normalizeComposerText(text); return { canonical, writeText: canonical, acceptableTexts: [canonical] }; }",
      "function debugWhatsAppComposerSync() {}",
      "function suppressFollowupInputScan() {}",
      "async function clearWhatsAppComposerThroughEditor() { return { ok: true, actual: '', strategy: 'test-clear' }; }",
      "function insertWhatsAppComposerTextThroughEditor(target) { target.text = deps.actual; return true; }",
      "async function waitForWhatsAppComposerText(target) { return { ok: false, actual: normalizeComposerText(target.text) }; }",
      "function getInputText(target) { return normalizeComposerText(target.text); }",
      "async function verifyComposerRewriteSafe() { calls.verifications += 1; return { ok: false, actual: deps.actual, strategy: 'forced-live-layout-mismatch' }; }",
      "function shouldAcceptWhatsAppSafePlaceholderPasteVerification(expectedText, actualText) { return deps.acceptSafe(expectedText, actualText); }",
      extractFunctionSource(contentSource, "applyWhatsAppEditorActionComposerText"),
      "return { applyWhatsAppEditorActionComposerText, calls, input };"
    ].join("\n\n")
  );
  const harness = factory({
    actual,
    normalizeComposerText: ComposerHelpers.normalizeComposerText,
    acceptSafe: (expectedText, actualText) => {
      const tokens = (text) => String(text || "").match(/\[(?:PWM|NET|PUB_HOST)_\d+\]/g) || [];
      return (
        globalThis.PWM.RewriteVerificationText.actualContainsExpectedPlaceholders(expectedText, actualText) &&
        tokens(expectedText).length === tokens(actualText).length &&
        Math.abs(
          globalThis.PWM.RewriteVerificationText.normalizeVerificationText(expectedText).length -
            globalThis.PWM.RewriteVerificationText.normalizeVerificationText(actualText).length
        ) <= 80 &&
        !String(actualText || "").includes("RawDbSecretValue123456")
      );
    }
  });

  const result = await harness.applyWhatsAppEditorActionComposerText(harness.input, expected, {
    context: "paste",
    originalText: original
  });

  assert.strictEqual(
    result.ok,
    true,
    "WhatsApp paste rewrite should accept safe placeholder layout when strict verification misses"
  );
  assert.strictEqual(harness.calls.verifications, 1);
  assert.strictEqual(result.actual, actual);
}

async function testWhatsAppRewriteUsesSyncedComposerPathBeforeAppendProneStrategies() {
  const factory = new Function(
    "normalizeComposerText",
    [
      "const calls = { genericWrites: 0, forcedWrites: 0, directWrites: 0, syncedWrites: 0, editorActionWrites: 0 };",
      "const ChatGptComposerSync = {",
      "  applyChatGptSyncedComposerText: async () => {",
      "    calls.syncedWrites += 1;",
      "    return { ok: false, actual: '', strategy: 'unexpected-chatgpt-sync' };",
      "  }",
      "};",
      "async function applyWhatsAppEditorActionComposerText(input, text, options) {",
      "  calls.editorActionWrites += 1;",
      "  calls.context = options.context;",
      "  input.text = normalizeComposerText(text);",
      "  return { ok: true, actual: input.text, strategy: 'whatsapp-editor-action-test' };",
      "}",
      "function isChatGptHost() { return false; }",
      "function isWhatsAppHost() { return true; }",
      "function isContentEditable(input) { return input?.contentEditable === true; }",
      "function getWhatsAppComposerSyncDependencies() { return { isChatGptHost: isWhatsAppHost }; }",
      "function buildComposerWritePlan(_input, text) { const canonical = normalizeComposerText(text); return { canonical, writeText: canonical }; }",
      "function matchesComposerPlan(plan, actual) { return normalizeComposerText(actual) === plan.canonical; }",
      "function suppressFollowupInputScan() {}",
      "function setInputText(input, text) { calls.genericWrites += 1; input.text = `${input.text}${text}`; }",
      "function forceRewriteInputText(input, text) { calls.forcedWrites += 1; input.text = `${input.text}${text}`; }",
      "function setInputTextDirect(input, text) { calls.directWrites += 1; input.text = normalizeComposerText(text); return true; }",
      "async function readStableComposerText(input) { return normalizeComposerText(input.text); }",
      "async function verifyComposerRewriteSafe({ input, expectedText, actualText }) { const actual = normalizeComposerText(actualText == null ? input.text : actualText); return { ok: actual === normalizeComposerText(expectedText), actual, strategy: 'test' }; }",
      "function debugLogSnapshot() {}",
      extractFunctionSource(contentSource, "applyWhatsAppSyncedComposerText"),
      extractFunctionSource(contentSource, "applyComposerText"),
      "return { applyComposerText, calls };"
    ].join("\n\n")
  );
  const { applyComposerText, calls } = factory(ComposerHelpers.normalizeComposerText);
  const input = {
    contentEditable: true,
    text: "my password is rawsecret123"
  };

  const result = await applyComposerText(input, "my password is [PWM_1]", {
    context: "submit",
    originalText: input.text,
    rawInsertedText: input.text,
    restoreText: input.text
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(input.text, "my password is [PWM_1]");
  assert.strictEqual(calls.editorActionWrites, 1, "WhatsApp composer should use one editor-action rewrite");
  assert.strictEqual(calls.context, "submit", "WhatsApp editor-action rewrite should receive submit context");
  assert.strictEqual(calls.syncedWrites, 0, "WhatsApp composer should not reuse the ChatGPT synced writer");
  assert.strictEqual(calls.directWrites, 0, "WhatsApp composer should not use direct DOM before synced rewrite");
  assert.strictEqual(calls.genericWrites, 0, "WhatsApp composer should skip append-prone generic rewrite");
  assert.strictEqual(calls.forcedWrites, 0, "WhatsApp composer should skip append-prone forced rewrite");
}

async function testWhatsAppSyncedRewriteFailureDoesNotRestoreThroughAppendProneFallback() {
  const factory = new Function(
    "normalizeComposerText",
    [
      "const calls = { genericWrites: 0, forcedWrites: 0, directWrites: 0, syncedWrites: 0, editorActionWrites: 0 };",
      "const ChatGptComposerSync = {",
      "  applyChatGptSyncedComposerText: async (input) => {",
      "    calls.syncedWrites += 1;",
      "    return { ok: false, actual: input.text, strategy: 'whatsapp-synced-test-failed' };",
      "  }",
      "};",
      "async function applyWhatsAppEditorActionComposerText(input) {",
      "  calls.editorActionWrites += 1;",
      "  return { ok: false, actual: input.text, strategy: 'whatsapp-editor-action-test-failed' };",
      "}",
      "function isChatGptHost() { return false; }",
      "function isWhatsAppHost() { return true; }",
      "function isContentEditable(input) { return input?.contentEditable === true; }",
      "function getWhatsAppComposerSyncDependencies() { return { isChatGptHost: isWhatsAppHost }; }",
      "function buildComposerWritePlan(_input, text) { const canonical = normalizeComposerText(text); return { canonical, writeText: canonical }; }",
      "function matchesComposerPlan(plan, actual) { return normalizeComposerText(actual) === plan.canonical; }",
      "function suppressFollowupInputScan() {}",
      "function setInputText(input, text) { calls.genericWrites += 1; input.text = `${input.text}${text}`; }",
      "function forceRewriteInputText(input, text) { calls.forcedWrites += 1; input.text = `${input.text}${text}`; }",
      "function setInputTextDirect(_input, _text) { calls.directWrites += 1; return false; }",
      "async function readStableComposerText(input) { return normalizeComposerText(input.text); }",
      "async function verifyComposerRewriteSafe({ input, expectedText, actualText }) { const actual = normalizeComposerText(actualText == null ? input.text : actualText); return { ok: actual === normalizeComposerText(expectedText), actual, strategy: 'test' }; }",
      "function debugLogSnapshot() {}",
      extractFunctionSource(contentSource, "applyWhatsAppSyncedComposerText"),
      extractFunctionSource(contentSource, "applyComposerText"),
      "return { applyComposerText, calls };"
    ].join("\n\n")
  );
  const { applyComposerText, calls } = factory(ComposerHelpers.normalizeComposerText);
  const input = {
    contentEditable: true,
    text: "my password is rawsecret123"
  };

  const result = await applyComposerText(input, "my password is [PWM_1]", {
    context: "submit",
    originalText: input.text,
    rawInsertedText: input.text,
    restoreText: input.text
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(input.text, "my password is rawsecret123");
  assert.strictEqual(calls.editorActionWrites, 1, "WhatsApp failed rewrite should return the editor-action failure");
  assert.strictEqual(calls.syncedWrites, 0, "WhatsApp failed rewrite should not call the ChatGPT synced writer");
  assert.strictEqual(calls.directWrites, 0, "WhatsApp failed rewrite should leave restore handling to the editor-action writer");
  assert.strictEqual(calls.genericWrites, 0, "WhatsApp failed rewrite should not append generic text");
  assert.strictEqual(calls.forcedWrites, 0, "WhatsApp failed rewrite should not append restored text");
}

async function testWhatsAppTransactionalSyncedFailureDoesNotAppendFallbackCopies() {
  const factory = new Function(
    "normalizeComposerText",
    [
      "const calls = { genericWrites: 0, forcedWrites: 0, directWrites: 0, syncedWrites: 0, editorActionWrites: 0 };",
      "const ChatGptComposerSync = {",
      "  applyChatGptSyncedComposerText: async (input, text) => {",
      "    calls.syncedWrites += 1;",
      "    input.text = `${input.text}${normalizeComposerText(text)}`;",
      "    return { ok: false, actual: input.text, strategy: 'whatsapp-synced-test-failed' };",
      "  }",
      "};",
      "async function applyWhatsAppEditorActionComposerText(input, text) {",
      "  calls.editorActionWrites += 1;",
      "  input.text = `${input.text}${normalizeComposerText(text)}`;",
      "  return { ok: false, actual: input.text, strategy: 'whatsapp-editor-action-test-failed' };",
      "}",
      "function isChatGptHost() { return false; }",
      "function isWhatsAppHost() { return true; }",
      "function isContentEditable(input) { return input?.contentEditable === true; }",
      "function containsVisiblePlaceholderToken(text) { return /\\[PWM_\\d+\\]/.test(String(text || '')); }",
      "function hasUnsafeVisibleSecret() { return false; }",
      "function getWhatsAppComposerSyncDependencies() { return { isChatGptHost: isWhatsAppHost }; }",
      "function buildComposerWritePlan(_input, text) { const canonical = normalizeComposerText(text); return { canonical, writeText: canonical, acceptableTexts: [canonical] }; }",
      "function matchesComposerPlan(plan, actual) { return normalizeComposerText(actual) === plan.canonical; }",
      "function suppressFollowupInputScan() {}",
      "function setInputText(input, text) { calls.genericWrites += 1; input.text = `${input.text}${normalizeComposerText(text)}`; }",
      "function forceRewriteInputText(input, text) { calls.forcedWrites += 1; input.text = `${input.text}${normalizeComposerText(text)}`; }",
      "function setInputTextDirect(input, text) { calls.directWrites += 1; input.text = `${input.text}${normalizeComposerText(text)}`; return true; }",
      "async function readStableComposerText(input) { return normalizeComposerText(input.text); }",
      "async function verifyComposerRewriteSafe({ input, expectedText, actualText }) { const actual = normalizeComposerText(actualText == null ? input.text : actualText); return { ok: actual === normalizeComposerText(expectedText), actual, strategy: 'test' }; }",
      "function debugLogSnapshot() {}",
      extractFunctionSource(contentSource, "applyWhatsAppSyncedComposerText"),
      extractFunctionSource(contentSource, "applyComposerText"),
      extractFunctionSource(contentSource, "rewriteComposerTransactionally"),
      "return { rewriteComposerTransactionally, calls };"
    ].join("\n\n")
  );
  const { rewriteComposerTransactionally, calls } = factory(ComposerHelpers.normalizeComposerText);
  const rawText = "my password is synthetic1234";
  const redactedText = "my password is [PWM_1]";
  const input = {
    contentEditable: true,
    text: rawText
  };

  const result = await rewriteComposerTransactionally(input, rawText, redactedText, "submit", {
    restoreText: rawText,
    restoreCaretOffset: rawText.length
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(input.text, `${rawText}${redactedText}`);
  assert.strictEqual(calls.editorActionWrites, 1, "WhatsApp transactional rewrite should try the editor-action writer once");
  assert.strictEqual(calls.syncedWrites, 0, "WhatsApp transactional rewrite should not call the ChatGPT synced writer");
  assert.strictEqual(calls.directWrites, 0, "WhatsApp editor-action failure should not fall through to direct DOM append");
  assert.strictEqual(calls.genericWrites, 0, "WhatsApp editor-action failure should not fall through to generic append");
  assert.strictEqual(calls.forcedWrites, 0, "WhatsApp editor-action failure should not force another appended copy");
}

async function testWhatsAppTransactionalCorruptedDraftDoesNotAttemptAnotherRewrite() {
  const factory = new Function(
    "normalizeComposerText",
    [
      "const calls = { syncedWrites: 0, directWrites: 0, forcedWrites: 0 };",
      "const ChatGptComposerSync = {",
      "  applyChatGptSyncedComposerText: async (input, text) => {",
      "    calls.syncedWrites += 1;",
      "    input.text = `${input.text}${normalizeComposerText(text)}`;",
      "    return { ok: false, actual: input.text, strategy: 'whatsapp-synced-test-failed' };",
      "  }",
      "};",
      "async function applyWhatsAppEditorActionComposerText(input, text) {",
      "  calls.syncedWrites += 1;",
      "  input.text = `${input.text}${normalizeComposerText(text)}`;",
      "  return { ok: false, actual: input.text, strategy: 'whatsapp-editor-action-test-failed' };",
      "}",
      "function isChatGptHost() { return false; }",
      "function isWhatsAppHost() { return true; }",
      "function isContentEditable(input) { return input?.contentEditable === true; }",
      "function containsVisiblePlaceholderToken(text) { return /\\[PWM_\\d+\\]/.test(String(text || '')); }",
      "function hasUnsafeVisibleSecret(text) { return /synthetic1234/.test(String(text || '')); }",
      "function getWhatsAppComposerSyncDependencies() { return { isChatGptHost: isWhatsAppHost }; }",
      "function buildComposerWritePlan(_input, text) { const canonical = normalizeComposerText(text); return { canonical, writeText: canonical, acceptableTexts: [canonical] }; }",
      "function matchesComposerPlan(plan, actual) { return normalizeComposerText(actual) === plan.canonical; }",
      "function suppressFollowupInputScan() {}",
      "function setInputText(input, text) { input.text = `${input.text}${normalizeComposerText(text)}`; }",
      "function forceRewriteInputText(input, text) { calls.forcedWrites += 1; input.text = `${input.text}${normalizeComposerText(text)}`; }",
      "function setInputTextDirect(input, text) { calls.directWrites += 1; input.text = `${input.text}${normalizeComposerText(text)}`; return true; }",
      "function getInputText(input) { return normalizeComposerText(input.text); }",
      "async function readStableComposerText(input) { return normalizeComposerText(input.text); }",
      "async function verifyComposerRewriteSafe({ input, expectedText, actualText }) { const actual = normalizeComposerText(actualText == null ? input.text : actualText); return { ok: actual === normalizeComposerText(expectedText), actual, strategy: 'test' }; }",
      "function debugLogSnapshot() {}",
      extractFunctionSource(contentSource, "applyWhatsAppSyncedComposerText"),
      extractFunctionSource(contentSource, "applyComposerText"),
      extractFunctionSource(contentSource, "rewriteComposerTransactionally"),
      "return { rewriteComposerTransactionally, calls };"
    ].join("\n\n")
  );
  const { rewriteComposerTransactionally, calls } = factory(ComposerHelpers.normalizeComposerText);
  const rawText = "my password is synthetic1234";
  const corruptedText = `${rawText}my password is [PWM_1]`;
  const input = {
    contentEditable: true,
    text: corruptedText
  };

  const result = await rewriteComposerTransactionally(input, corruptedText, "my password is [PWM_2]", "submit", {
    restoreText: corruptedText,
    restoreCaretOffset: corruptedText.length
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.strategy, "whatsapp-corrupted-composer-blocked");
  assert.strictEqual(input.text, corruptedText);
  assert.strictEqual(calls.syncedWrites, 0, "corrupted WhatsApp drafts should fail closed before another append-prone rewrite");
  assert.strictEqual(calls.directWrites, 0);
  assert.strictEqual(calls.forcedWrites, 0);
}

async function testSubmitTransactionalHelperFailsClosedOnRawRestore() {
  const factory = new Function(
    [
      "const calls = { transactional: 0, failures: 0, exactChecks: 0, refreshes: 0 };",
      "async function rewriteComposerTransactionally(_input, originalText) { calls.transactional += 1; return { ok: false, actual: originalText, strategy: 'raw-restore-detected' }; }",
      "async function ensureExactComposerState() { calls.exactChecks += 1; return true; }",
      "function collectFailureDetails(_input, expectedText, actualText, context) { return { expectedText, actualText, context }; }",
      "async function showRewriteFailure(context, details) { calls.failures += 1; calls.failureContext = context; calls.failureDetails = details; }",
      "function refreshBadgeFromCurrentInput() { calls.refreshes += 1; }",
      extractFunctionSource(contentSource, "applySubmitRedactionTransactionally"),
      "return { applySubmitRedactionTransactionally, calls };"
    ].join("\n\n")
  );
  const { applySubmitRedactionTransactionally, calls } = factory();
  const rawText = "OPENAI_API_KEY=sk-proj-rawrestoresecretvalue";
  const redactedText = "OPENAI_API_KEY=[PWM_1]";

  const ok = await applySubmitRedactionTransactionally(
    { text: rawText },
    rawText,
    redactedText,
    "submit",
    [{ raw: rawText }]
  );

  assert.strictEqual(ok, false, "submit transactional helper should fail closed when raw restore is detected");
  assert.strictEqual(calls.transactional, 1, "submit helper should attempt the transactional rewrite path");
  assert.strictEqual(calls.failures, 1, "submit helper should show a rewrite failure instead of allowing send");
  assert.strictEqual(calls.exactChecks, 0, "exact verification should not bless a failed transactional rewrite");
  assert.strictEqual(calls.failureDetails.actualText, rawText, "failure details should preserve the unsafe actual text summary input");
}

async function testWhatsAppExactComposerStateAcceptsSafeMultilinePlaceholderLayout() {
  const expected = [
    "DO NOT USE",
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "GITHUB_TOKEN=[PWM_3]",
    "OPENAI_API_KEY=[PWM_4]",
    "STRIPE_SECRET_KEY=[PWM_5]",
    "SLACK_WEBHOOK=[PWM_6]",
    "DATABASE_URL=postgres://qa_user:[PWM_7]@db.internal.example:5432/prod",
    "AdminPassword=[PWM_7]",
    "",
    "[PWM_8]"
  ].join("\n");
  const actual = [
    "DO NOT USE",
    "",
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "",
    "GITHUB_TOKEN=[PWM_3]",
    "",
    "OPENAI_API_KEY=[PWM_4]",
    "",
    "STRIPE_SECRET_KEY=[PWM_5]",
    "",
    "SLACK_WEBHOOK=[PWM_6]",
    "",
    "DATABASE_URL=postgres://qa_user:",
    "[PWM_7]@db.internal.example:5432/prod",
    "",
    "AdminPassword=[PWM_7]",
    "",
    "",
    "[PWM_8]",
    ""
  ].join("\n");
  const factory = new Function(
    "deps",
    [
      "const calls = { verifications: 0 };",
      "const ANY_PLACEHOLDER_TOKEN_REGEX = /\\[(?:PWM|NET|PUB_HOST)_\\d+\\]/g;",
      "const PLACEHOLDER_TOKEN_REGEX = ANY_PLACEHOLDER_TOKEN_REGEX;",
      "const ReplayVerification = deps.ReplayVerification;",
      "let replayVerification = null;",
      "function normalizeComposerText(value) { return deps.normalizeComposerText(value); }",
      "function normalizeEditorInnerText(value) { return deps.normalizeComposerText(value); }",
      "function buildComposerWritePlan(_input, text) { const canonical = normalizeComposerText(text); return { canonical, writeText: canonical, acceptableTexts: [canonical] }; }",
      "async function readStableComposerText() { return deps.actual; }",
      "function debugLogSnapshot() {}",
      "function debugRewriteVerification() {}",
      "async function verifyComposerRewriteSafe() { calls.verifications += 1; return { ok: false, actual: deps.actual, strategy: 'forced-layout-mismatch' }; }",
      "function getInputText() { return deps.actual; }",
      "function isWhatsAppHost() { return true; }",
      "function analyzeText(text) { return deps.analyzeText(text); }",
      "function isReasonablyCloseRewriteLength(expectedText, actualText) { return deps.isReasonablyCloseRewriteLength(expectedText, actualText); }",
      "function listPlaceholderTokens(text) { return deps.listPlaceholderTokens(text); }",
      "function actualContainsExpectedPlaceholders(expectedText, actualText) { return deps.actualContainsExpectedPlaceholders(expectedText, actualText); }",
      extractFunctionSource(contentSource, "getReplayVerification"),
      extractFunctionSource(contentSource, "containsVisiblePlaceholderToken"),
      extractFunctionSource(contentSource, "isHighConfidenceRewriteFinding"),
      extractFunctionSource(contentSource, "hasUnsafeVisibleSecret"),
      extractFunctionSource(contentSource, "shouldAcceptWhatsAppSafePlaceholderPasteVerification"),
      extractFunctionSource(contentSource, "ensureExactComposerState"),
      "return { ensureExactComposerState, calls };"
    ].join("\n\n")
  );
  const harness = factory({
    actual,
    ReplayVerification: globalThis.PWM.ReplayVerification,
    normalizeComposerText: ComposerHelpers.normalizeComposerText,
    isReasonablyCloseRewriteLength:
      globalThis.PWM.RewriteVerificationText.isReasonablyCloseRewriteLength,
    listPlaceholderTokens: globalThis.PWM.RewriteVerificationText.listPlaceholderTokens,
    actualContainsExpectedPlaceholders:
      globalThis.PWM.RewriteVerificationText.actualContainsExpectedPlaceholders,
    analyzeText: (text) => {
      const findings = analyze(text);
      return {
        findings,
        secretFindings: findings.filter((finding) => finding.type !== "PUBLIC_IPV4")
      };
    }
  });

  assert.strictEqual(
    await harness.ensureExactComposerState({}, expected, { context: "submit" }),
    true,
    "final WhatsApp pre-send verification should accept safe multiline placeholder layout"
  );
  assert.strictEqual(harness.calls.verifications, 1);
}

async function testStaleTypedRewriteFailureKeepsSanitizedEditorUsable() {
  const createHarness = (options = {}) => {
    const factory = new Function(
      "deps",
      [
        "const calls = { applies: 0, exactChecks: 0, failures: 0, refreshes: 0 };",
        "let typedRewriteGeneration = 0;",
        "const ANY_PLACEHOLDER_TOKEN_REGEX = /\\[(?:PWM|NET|PUB_HOST)_\\d+\\]/g;",
        "const PLACEHOLDER_TOKEN_REGEX = ANY_PLACEHOLDER_TOKEN_REGEX;",
        "function normalizeComposerText(value) { return deps.normalizeComposerText(value); }",
        "function getInputText(input) { return normalizeComposerText(input.text || ''); }",
        "function analyzeText(text) { return deps.analyzeText(text); }",
        "function isHighConfidenceRewriteFinding(finding) { return finding?.severity === 'high' || Number(finding?.score) >= 80; }",
        "function deriveRewriteCaretOffset() { return 0; }",
        "async function applyComposerText(input, expectedText) {",
        "  calls.applies += 1;",
        "  input.text = normalizeComposerText(expectedText);",
        "  if (deps.simulateNewerRewrite) {",
        "    typedRewriteGeneration += 1;",
        "    input.text = normalizeComposerText(deps.newerText);",
        "  }",
        "  return { ok: true, actual: input.text };",
        "}",
        "async function ensureExactComposerState() { calls.exactChecks += 1; return false; }",
        "async function showRewriteFailure(context, details) { calls.failures += 1; calls.failureContext = context; calls.failureDetails = details; }",
        "function collectFailureDetails(_input, expectedText, actualText, context) { return { expectedText, actualText, context }; }",
        "function refreshBadgeFromCurrentInput() { calls.refreshes += 1; }",
        extractFunctionSource(contentSource, "containsVisiblePlaceholderToken"),
        extractFunctionSource(contentSource, "hasUnsafeVisibleSecret"),
        extractFunctionSource(contentSource, "shouldSuppressStaleTypedRewriteFailure"),
        extractFunctionSource(contentSource, "applyTypedInterceptionRewrite"),
        "return { applyTypedInterceptionRewrite, calls };"
      ].join("\n\n")
    );
    return factory({
      normalizeComposerText: ComposerHelpers.normalizeComposerText,
      analyzeText: options.analyzeText || (() => ({ secretFindings: [], findings: [] })),
      simulateNewerRewrite: Boolean(options.simulateNewerRewrite),
      newerText: options.newerText || ""
    });
  };

  const sanitizedHarness = createHarness({
    simulateNewerRewrite: true,
    newerText: "TYPED_EDITOR_KEY=[PWM_2]"
  });
  const sanitizedInput = { text: "" };
  const sanitizedOk = await sanitizedHarness.applyTypedInterceptionRewrite(
    sanitizedInput,
    "TYPED_EDITOR_KEY=[PWM_1]",
    "",
    { end: 0 },
    "input"
  );

  assert.strictEqual(sanitizedOk, false, "stale typed rewrite should stop its own caller");
  assert.strictEqual(sanitizedHarness.calls.failures, 0, "newer sanitized text should not trigger a stale fail-closed modal");
  assert.strictEqual(sanitizedInput.text, "TYPED_EDITOR_KEY=[PWM_2]");

  const unsafeHarness = createHarness({
    simulateNewerRewrite: true,
    newerText: "TYPED_EDITOR_KEY=[PWM_2] sk-proj-StillRawSecretValue1234567890abcdef",
    analyzeText: (text) => {
      const match = String(text || "").match(/sk-proj-[A-Za-z0-9_-]+/);
      const secretFindings = match
        ? [{ raw: match[0], severity: "high", score: 95 }]
        : [];
      return { secretFindings, findings: secretFindings };
    }
  });
  const unsafeOk = await unsafeHarness.applyTypedInterceptionRewrite(
    { text: "" },
    "TYPED_EDITOR_KEY=[PWM_1]",
    "",
    { end: 0 },
    "input"
  );

  assert.strictEqual(unsafeOk, false);
  assert.strictEqual(unsafeHarness.calls.failures, 1, "stale visible raw secret must still fail closed");
}

function testTypedDebugDiagnosticsSummarizeOnly() {
  const rawSecret = "password=TypedDebugSecretValue1234567890";
  const redactedText = "password=[PWM_1]";
  const facade = ContentDebugFacade.createContentDebugFacade({
    DebugLogger: globalThis.PWM.DebugLogger,
    normalizeText: (value) => String(value || ""),
    normalizeEditorInnerText: (value) => String(value || ""),
    normalizeVisiblePlaceholders,
    placeholderTokenRegex: PLACEHOLDER_TOKEN_REGEX,
    getInputText: (input) => input.text
  });
  const snapshot = facade.collectComposerDebugSnapshot(
    { text: redactedText, innerText: rawSecret, textContent: rawSecret },
    rawSecret,
    redactedText
  );
  const serialized = JSON.stringify(snapshot);

  assert.strictEqual(serialized.includes(rawSecret), false, "typed diagnostics must not expose raw typed secrets");
  assert.strictEqual(snapshot.expected.length, rawSecret.length);
  assert.strictEqual(snapshot.writeText.placeholderCount, 1);
  assert.strictEqual(snapshot.innerText.length, rawSecret.length);
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
  testWhatsAppParagraphComposerSerializationAvoidsInnerTextBlankLineInflation();
  testTypedDebugDiagnosticsSummarizeOnly();
  return Promise.resolve()
    .then(() => testGenericRewriteVerificationSafeCases())
    .then(() => testMultilineCollapseRetryAndFailures())
    .then(() => testRewriteVerificationFailClosedCases())
    .then(() => testRewriteFailureModalSuppression())
    .then(() => testWhatsAppPasteSafePlaceholderVerificationFailureDoesNotShowFalseModal())
    .then(() => testWhatsAppSplitCredentialPlaceholderIsNotUnsafeVisibleSecret())
    .then(() => testTransactionalRewriteFallbackRemovesRawDuplicate())
    .then(() => testWhatsAppSendButtonClickOwnsSafeTextForVerifiedReplay())
    .then(() => testWhatsAppSendButtonClickFailsClosedWithoutComposer())
    .then(() => testWhatsAppShiftEnterDoesNotOwnFallbackSend())
    .then(() => testWhatsAppEmptyComposerClickEnterAndSubmitAreIgnoredSafely())
    .then(() => testWhatsAppUntrustedTextExtractionFailsClosed())
    .then(() => testWhatsAppSafeTextVariantsUseVerifiedReplayWithoutRedaction())
    .then(() => testWhatsAppSecondSubmitOrEnterWhilePendingDoesNotStartRetryPath())
    .then(() => testWhatsAppEditorActionEmitsSingleDataBearingInsert())
    .then(() => testWhatsAppEditorActionAcceptsSafePlaceholderVerification())
    .then(() => testWhatsAppEditorActionAcceptsSafePlaceholderFallbackAfterVerificationMiss())
    .then(() => testWhatsAppRewriteUsesSyncedComposerPathBeforeAppendProneStrategies())
    .then(() => testWhatsAppSyncedRewriteFailureDoesNotRestoreThroughAppendProneFallback())
    .then(() => testWhatsAppTransactionalSyncedFailureDoesNotAppendFallbackCopies())
    .then(() => testWhatsAppTransactionalCorruptedDraftDoesNotAttemptAnotherRewrite())
    .then(() => testSubmitTransactionalHelperFailsClosedOnRawRestore())
    .then(() => testWhatsAppExactComposerStateAcceptsSafeMultilinePlaceholderLayout())
    .then(() => testStaleTypedRewriteFailureKeepsSanitizedEditorUsable())
    .then(() => {
      console.log("PASS typed beforeinput interception regressions");
    });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
