const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { loadCore, root } = require("./helpers/load_core.js");
loadCore();

require(path.join(root, "src/shared/aiCandidateGate.js"));
require(path.join(root, "src/shared/transformOutboundPromptWithAi.js"));
require(path.join(root, "src/shared/fileLimits.js"));
require(path.join(root, "src/shared/fileTypeRegistry.js"));
require(path.join(root, "src/shared/fileExtractors.js"));
require(path.join(root, "src/shared/fileScanner.js"));
require(path.join(root, "src/content/diagnostics/safeSnapshots.js"));
require(path.join(root, "src/content/diagnostics/fileDebugMetadata.js"));
require(path.join(root, "src/content/diagnostics/debugLogger.js"));
require(path.join(root, "src/content/diagnostics/contentDebugFacade.js"));
require(path.join(root, "src/content/files/fileAttachPipeline.js"));
require(path.join(root, "src/shared/runtime_scripts.js"));

const {
  AI_GRAY_ZONE_KEEP_CASES,
  AI_GRAY_ZONE_REDACT_CASES,
  DEBUG_FORBIDDEN_STRINGS,
  IMAGE_FIXTURES,
  MUTATION_CASES,
  POSITIVE_CASES,
  SAFE_CONTROL_CASES,
  TEXT_FILE_FIXTURES,
  TRUSTED_PLACEHOLDER,
  UNSUPPORTED_FILE_FIXTURES,
  bufferFromText,
  createDocumentFixtures
} = require("./fixtures/extreme_redaction_fixtures.js");

const {
  Detector,
  PlaceholderManager,
  Redactor,
  transformOutboundPromptWithAi,
  RuntimeScripts
} = globalThis.PWM;
const { EXTRACTOR_STATUS, prepareFileExtraction, prepareFileExtractionAsync } =
  globalThis.PWM.FileExtractors;
const { validateFileForTextScan, scanTextContent, buildSanitizedReport } =
  globalThis.PWM.FileScanner;
const DebugLogger = globalThis.PWM.DebugLogger;
const FileDebugMetadata = globalThis.PWM.FileDebugMetadata;
const ContentDebugFacade = globalThis.PWM.ContentDebugFacade;
const FileAttachPipeline = globalThis.PWM.FileAttachPipeline;

const PLACEHOLDER_PATTERN = /\[[A-Z][A-Z0-9_]*_\d+\]/;
const PWM_ANY_PATTERN = /\[PWM_\d+\]/;
const PWM_PATTERN = /\[PWM_\d+\]/g;

function createManagerWithTrustedPlaceholders() {
  const manager = new PlaceholderManager();
  manager.trackKnownPlaceholder(TRUSTED_PLACEHOLDER);
  manager.trackKnownPlaceholder("[PWM_12]");
  manager.trackKnownPlaceholder("[PWM_22]");
  manager.trackKnownPlaceholder("[PWM_999]");
  return manager;
}

function scanAndRedact(text) {
  const detector = new Detector();
  const manager = createManagerWithTrustedPlaceholders();
  const input = `${text}\ntrusted_placeholder=${TRUSTED_PLACEHOLDER}`;
  const findings = detector.scan(input, { manager });
  const result = new Redactor(manager).redact(input, findings);
  return { detector, manager, input, findings, redactedText: result.redactedText };
}

function methodText(finding) {
  return (finding?.method || []).join("|");
}

function assertForbiddenAbsent(text, forbidden, label) {
  for (const raw of forbidden) {
    assert.strictEqual(text.includes(raw), false, `${label}: raw value survived: ${raw}`);
  }
}

function assertPreserved(text, expected, label) {
  for (const value of expected) {
    assert.ok(text.includes(value), `${label}: expected safe value to remain: ${value}`);
  }
}

function testDetectorAdversarialTruePositiveMatrix() {
  for (const testCase of POSITIVE_CASES) {
    const { findings, redactedText } = scanAndRedact(testCase.text);
    const finding = findings.find((entry) => entry.raw === testCase.raw);

    assert.ok(
      finding,
      `${testCase.name}: expected exact finding for ${testCase.raw}; got ${findings
        .map((entry) => `${entry.type}:${entry.raw}:${methodText(entry)}`)
        .join(", ")}`
    );
    assertForbiddenAbsent(redactedText, [testCase.raw], testCase.name);
    assert.ok(PLACEHOLDER_PATTERN.test(redactedText), `${testCase.name}: expected a placeholder`);
    if (testCase.placeholderFamily === "EMAIL") {
      assert.ok(/\[EMAIL_\d+\]/.test(redactedText), `${testCase.name}: expected email placeholder`);
    } else {
      assert.ok(PWM_ANY_PATTERN.test(redactedText), `${testCase.name}: expected PWM placeholder`);
    }
    assert.ok(
      redactedText.includes(`trusted_placeholder=${TRUSTED_PLACEHOLDER}`),
      `${testCase.name}: trusted PWM placeholder should pass through unchanged`
    );
    assert.strictEqual(
      findings.some((entry) => entry.raw === TRUSTED_PLACEHOLDER),
      false,
      `${testCase.name}: trusted PWM placeholder must not be re-redacted`
    );
    if (testCase.deterministicReason) {
      assert.ok(
        finding.method.includes("provider-registry"),
        `${testCase.name}: known provider finding should come from provider registry, got ${methodText(finding)}`
      );
      assert.ok(
        finding.method.includes(testCase.deterministicReason),
        `${testCase.name}: expected stable reason ${testCase.deterministicReason}, got ${methodText(finding)}`
      );
      assert.strictEqual(
        finding.method.includes("ai-assist"),
        false,
        `${testCase.name}: deterministic provider secret should not rely on Onix`
      );
    }
    if (testCase.expectedMethod) {
      assert.ok(
        finding.method.includes(testCase.expectedMethod),
        `${testCase.name}: expected method ${testCase.expectedMethod}, got ${methodText(finding)}`
      );
      assert.strictEqual(
        finding.method.includes("ai-assist"),
        false,
        `${testCase.name}: deterministic scanner should not rely on Onix`
      );
    }
  }
}

function testFalsePositiveMatrix() {
  for (const testCase of SAFE_CONTROL_CASES) {
    const { findings, redactedText } = scanAndRedact(testCase.text);
    const inputPwm = testCase.text.match(PWM_PATTERN) || [];
    const outputPwm = redactedText.match(PWM_PATTERN) || [];

    assertPreserved(redactedText, testCase.preserved, testCase.name);
    assert.deepStrictEqual(
      outputPwm,
      inputPwm.length ? inputPwm.concat([TRUSTED_PLACEHOLDER]) : [TRUSTED_PLACEHOLDER],
      `${testCase.name}: no unexpected PWM placeholders should be introduced`
    );

    if (testCase.redactedEmails) {
      assertForbiddenAbsent(redactedText, testCase.redactedEmails, testCase.name);
      assert.ok(/\[EMAIL_\d+\]/.test(redactedText), `${testCase.name}: expected email comment redaction`);
      continue;
    }

    const nonPlaceholderFindings = findings.filter((finding) => finding.raw !== TRUSTED_PLACEHOLDER);
    assert.deepStrictEqual(nonPlaceholderFindings, [], `${testCase.name}: safe control should not redact`);
  }
}

function testSeparatorAndFormatMutations() {
  for (const testCase of MUTATION_CASES) {
    const { findings, redactedText } = scanAndRedact(testCase.text);

    assert.ok(
      findings.some((finding) => finding.raw.includes(testCase.raw) || testCase.raw.includes(finding.raw)),
      `${testCase.name}: expected mutation finding for ${testCase.raw}; got ${findings
        .map((finding) => `${finding.raw}:${methodText(finding)}`)
        .join(", ")}`
    );
    assertForbiddenAbsent(redactedText, [testCase.raw], testCase.name);
    assert.ok(PLACEHOLDER_PATTERN.test(redactedText), `${testCase.name}: expected placeholder`);
    assert.ok(
      redactedText.includes(`trusted_placeholder=${TRUSTED_PLACEHOLDER}`),
      `${testCase.name}: trusted placeholder should pass through`
    );
  }
}

function scanFixtureText(testCase) {
  return scanTextContent({
    fileName: testCase.fileName,
    mimeType: testCase.mimeType,
    sizeBytes: bufferFromText(testCase.text).byteLength,
    text: testCase.text,
    mode: "hide_public"
  });
}

function assertSanitizedFileScan(scan, testCase) {
  const reportJson = JSON.stringify(buildSanitizedReport(scan));
  assert.ok(scan.summary.findingsCount >= testCase.secrets.length, `${testCase.label}: expected findings`);
  assert.ok(PLACEHOLDER_PATTERN.test(scan.redactedText), `${testCase.label}: expected placeholders`);
  assertForbiddenAbsent(scan.redactedText, testCase.secrets, `${testCase.label} redacted text`);
  assertForbiddenAbsent(reportJson, testCase.secrets, `${testCase.label} report`);
  assertPreserved(scan.redactedText, testCase.safeValues, testCase.label);
}

async function testFileScannerAndExtractorAdversarialPack() {
  for (const testCase of TEXT_FILE_FIXTURES) {
    const validation = validateFileForTextScan({
      fileName: testCase.fileName,
      mimeType: testCase.mimeType,
      sizeBytes: bufferFromText(testCase.text).byteLength,
      buffer: bufferFromText(testCase.text)
    });
    assert.strictEqual(validation.ok, true, `${testCase.label}: supported text fixture should validate`);
    assertSanitizedFileScan(scanFixtureText(testCase), testCase);
  }

  for (const testCase of createDocumentFixtures()) {
    const extraction = await prepareFileExtractionAsync({
      fileName: testCase.fileName,
      mimeType: testCase.mimeType,
      sizeBytes: testCase.buffer.byteLength,
      buffer: testCase.buffer
    });
    assert.strictEqual(extraction.status, EXTRACTOR_STATUS.OK, `${testCase.label}: extraction should succeed`);
    assert.strictEqual(extraction.safeForScan, true, `${testCase.label}: extraction should be scan-safe`);
    const scan = scanTextContent({
      fileName: testCase.fileName,
      mimeType: testCase.mimeType,
      sizeBytes: extraction.metadata.textLength,
      text: extraction.text,
      extractedText: true,
      mode: "hide_public"
    });
    assertSanitizedFileScan(scan, testCase);
  }

  for (const testCase of IMAGE_FIXTURES) {
    const extraction = await prepareFileExtractionAsync({
      fileName: testCase.fileName,
      mimeType: testCase.mimeType,
      sizeBytes: testCase.buffer.byteLength,
      buffer: testCase.buffer
    });
    assert.strictEqual(extraction.status, EXTRACTOR_STATUS.OK, `${testCase.label}: image metadata route should succeed`);
    assert.strictEqual(extraction.kind, "image_metadata", `${testCase.label}: should stay image metadata only`);
    assert.strictEqual(extraction.safeForScan, true, `${testCase.label}: image metadata should be scan-safe`);
    assert.strictEqual(
      extraction.text.includes(testCase.forbiddenPixelText),
      false,
      `${testCase.label}: pixel/OCR fallback text must not be inserted`
    );
    assert.strictEqual(
      JSON.stringify(extraction.metadata).includes(testCase.forbiddenPixelText),
      false,
      `${testCase.label}: image metadata must not include raw pixel bytes`
    );
  }

  for (const testCase of UNSUPPORTED_FILE_FIXTURES) {
    const validation = validateFileForTextScan({
      fileName: testCase.fileName,
      mimeType: testCase.mimeType,
      sizeBytes: bufferFromText(testCase.text).byteLength,
      buffer: bufferFromText(testCase.text)
    });
    const extraction = prepareFileExtraction({
      fileName: testCase.fileName,
      mimeType: testCase.mimeType,
      text: testCase.text
    });
    assert.strictEqual(validation.ok, false, `${testCase.fileName}: unsupported fixture should fail validation`);
    assert.notStrictEqual(extraction.status, EXTRACTOR_STATUS.OK, `${testCase.fileName}: extraction must not succeed`);
    assert.strictEqual(extraction.safeForScan, false, `${testCase.fileName}: unsupported extraction must fail closed`);
    assert.strictEqual(extraction.text, "", `${testCase.fileName}: unsupported extraction must not expose raw text`);
    assert.strictEqual(
      JSON.stringify(extraction).includes(testCase.text),
      false,
      `${testCase.fileName}: safe state must not include raw unsupported content`
    );
  }
}

async function testAiOnixGrayZoneAndLifecycle() {
  for (const testCase of AI_GRAY_ZONE_REDACT_CASES) {
    const calls = [];
    const result = await transformOutboundPromptWithAi(testCase.text, {
      manager: createManagerWithTrustedPlaceholders(),
      detector: { scan: () => [] },
      policyMode: "enterprise",
      classifier: {
        classify: async (contextText) => {
          calls.push(contextText);
          return { risk: "SECRET", confidence: 0.95 };
        }
      }
    });

    assert.ok(calls.length > 0, `${testCase.text}: gray-zone candidate should reach local AI`);
    assertForbiddenAbsent(result.redactedText, [testCase.raw], `${testCase.text} AI redaction`);
    assert.ok(PWM_ANY_PATTERN.test(result.redactedText), `${testCase.text}: expected PWM placeholder from AI`);
    assert.ok(
      calls.every((call) => call.includes(testCase.raw) && call.length < Math.max(96, testCase.text.length + 48)),
      `${testCase.text}: classifier should receive bounded candidate context`
    );
  }

  for (const text of AI_GRAY_ZONE_KEEP_CASES) {
    let calls = 0;
    const result = await transformOutboundPromptWithAi(text, {
      manager: createManagerWithTrustedPlaceholders(),
      policyMode: "enterprise",
      classifier: {
        classify: async () => {
          calls += 1;
          return { risk: "SECRET", confidence: 0.99 };
        }
      }
    });

    assert.strictEqual(result.redactedText, text, `${text}: safe gray-zone contrast should remain visible`);
    assert.strictEqual(calls, 0, `${text}: safe contrast should not reach Onix candidate classification`);
  }

  const deterministicRaw = "AKIASYNTHETIC1234567";
  const text = `AWS_ACCESS_KEY_ID=${deterministicRaw}\nleftover=UnknownAiToken12345`;
  const deterministic = new Detector().scan(text);
  const classifierCalls = [];
  await transformOutboundPromptWithAi(text, {
    manager: createManagerWithTrustedPlaceholders(),
    findings: deterministic,
    policyMode: "enterprise",
    classifier: {
      classify: async (contextText) => {
        classifierCalls.push(contextText);
        return { risk: "SECRET", confidence: 0.95 };
      }
    }
  });

  assert.ok(deterministic.some((finding) => finding.raw === deterministicRaw), "regex/provider should run first");
  assert.ok(classifierCalls.length > 0, "leftover gray-zone value should still reach Onix");
  assert.strictEqual(
    classifierCalls.some((call) => call.includes(deterministicRaw)),
    false,
    "Onix must not reclassify deterministic provider ranges"
  );

  const detectorSource = fs.readFileSync(path.join(root, "src/shared/detector.js"), "utf8");
  const aiTransformSource = fs.readFileSync(
    path.join(root, "src/shared/transformOutboundPromptWithAi.js"),
    "utf8"
  );
  assert.ok(
    detectorSource.indexOf("...this.scanProviderRegistry(input)") <
      detectorSource.indexOf("...this.scanEntropyFallback(input)"),
    "regex/provider registry must run before entropy"
  );
  assert.ok(
    aiTransformSource.indexOf("const candidates = extractAiCandidates") >
      aiTransformSource.indexOf("deterministicFindings"),
    "Onix candidate extraction must run after deterministic findings"
  );
}

async function testDebugOutputSafety() {
  const dangerousPayload = {
    password: "DebugPassword123!",
    token: "DebugToken1234567890",
    apiKey: "sk-proj-DebugApiKey1234567890",
    fileName: "customer-secret.env",
    path: "C:\\Users\\qa\\Documents\\customer-secret.env",
    linuxPath: "/home/qa/customer-secret.env",
    composerText: "composer full user content with DebugToken1234567890",
    privateKey: "-----BEGIN PRIVATE KEY-----\nDebugPrivateKeyBody\n-----END PRIVATE KEY-----",
    className: "button-DebugToken1234567890",
    id: "input-DebugToken1234567890",
    counts: { findings: 3, placeholders: 2 },
    reason: "sanitized_handoff_failed"
  };
  const sanitized = DebugLogger.sanitizeDebugPayload(dangerousPayload);
  const sanitizedJson = JSON.stringify(sanitized);

  assertForbiddenAbsent(sanitizedJson, DEBUG_FORBIDDEN_STRINGS, "debug logger payload");
  assert.strictEqual(sanitized.counts.findings, 3);
  assert.strictEqual(sanitized.counts.placeholders, 2);
  assert.strictEqual(typeof sanitized.reason, "object");
  assert.strictEqual(sanitized.reason.redacted, true);
  assert.deepStrictEqual(sanitized.password, {
    type: "string",
    length: "DebugPassword123!".length,
    lineCount: 1,
    redacted: true
  });

  const consoleCalls = [];
  DebugLogger.debugEvent("token DebugToken1234567890", dangerousPayload, {
    root: {
      localStorage: { getItem: () => "1" },
      sessionStorage: { getItem: () => null },
      console: {
        groupCollapsed: (...args) => consoleCalls.push(["groupCollapsed", ...args]),
        log: (...args) => consoleCalls.push(["log", ...args]),
        groupEnd: (...args) => consoleCalls.push(["groupEnd", ...args])
      }
    }
  });
  const consoleJson = JSON.stringify(consoleCalls);
  assertForbiddenAbsent(consoleJson, DEBUG_FORBIDDEN_STRINGS, "debug event console calls");
  assert.ok(consoleJson.includes("debug-event"), "unsafe debug label should be replaced");

  const safeFilePayload = FileDebugMetadata.createSafeFileAttachDebugPayload({
    file: {
      name: "customer-secret.env",
      type: "text/plain;token=DebugToken1234567890",
      size: 42,
      supportedText: true,
      sanitized: false
    },
    error: {
      name: "Error",
      message: "DebugPassword123!",
      code: "UPLOAD_BLOCKED"
    },
    events: ["drop DebugToken1234567890", "C:\\Users\\qa\\Documents\\customer-secret.env"]
  });
  assertForbiddenAbsent(JSON.stringify(safeFilePayload), DEBUG_FORBIDDEN_STRINGS, "file debug payload");
  assert.strictEqual(safeFilePayload.file.sizeBytes, 42);
  assert.strictEqual(safeFilePayload.messageLength, "DebugPassword123!".length);

  const facade = ContentDebugFacade.createContentDebugFacade({
    DebugLogger,
    FileDebugMetadata,
    createSafeFileAttachDebugPayload: FileDebugMetadata.createSafeFileAttachDebugPayload
  });
  const element = facade.describeElementForDebug(
    {
      tagName: "BUTTON",
      id: "input-DebugToken1234567890",
      className: "button-DebugToken1234567890",
      hidden: false,
      disabled: false,
      getAttribute(name) {
        if (name === "aria-label") return "Attach DebugToken1234567890";
        if (name === "title") return "C:\\Users\\qa\\Documents\\customer-secret.env";
        return "";
      }
    },
    "extreme-debug"
  );
  assertForbiddenAbsent(JSON.stringify(element), DEBUG_FORBIDDEN_STRINGS, "content debug facade");
  assert.strictEqual(element.idLength, "input-DebugToken1234567890".length);
  assert.strictEqual(element.classLength, "button-DebugToken1234567890".length);

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    const detector = new Detector();
    await detector.scanWithAiAssist("auth=abcdefghijklmnop", {
      policy: { aiAssistEnabled: true },
      classifier: {
        classify: async () => {
          throw new Error("classifier failed on DebugToken1234567890");
        }
      }
    });
  } finally {
    console.warn = originalWarn;
  }
  const warningText = warnings
    .flat()
    .map((entry) => (entry instanceof Error ? `${entry.name}:${entry.message}` : JSON.stringify(entry) || String(entry)))
    .join("\n");
  assert.strictEqual(
    warningText.includes("DebugToken1234567890"),
    false,
    "AI assist warning output must not include raw classifier error text"
  );
}

async function testHandoffFailurePathsFailClosed() {
  let fallbackCalls = 0;
  const result = await FileAttachPipeline.runSanitizedFileAttachFlow({
    trySanitizedHandoff: async () => false,
    shouldSkipFallback: () => true,
    skipFallbackReason: "sanitized_handoff_failed",
    insertFallbackText: async () => {
      fallbackCalls += 1;
      return true;
    },
    failureReason: "sanitized_file_handoff_failed"
  });

  assert.strictEqual(result.action, "fail-closed");
  assert.strictEqual(result.ok, false);
  assert.strictEqual(fallbackCalls, 0, "redaction/handoff failure must not continue to text fallback when skipped");

  const imagePlan = FileAttachPipeline.classifyFileAttachPreflightPlan({
    imageRedactionMode: true,
    skipTextFallback: true
  });
  assert.strictEqual(
    imagePlan.attachFlowOptions.skipFallbackReason,
    "image_text_fallback_disabled",
    "file-only image redaction must disable OCR text insertion fallback"
  );

  const streamingFailure = FileAttachPipeline.classifyStreamingAttachPlan({
    streamResultAction: "failed",
    hasSanitizedFile: false
  });
  assert.strictEqual(streamingFailure.failedResult.shouldBlock, true);
  assert.ok(streamingFailure.failedResult.message.includes("blocked raw file upload"));
}

function assertBefore(scripts, dependency, consumer, label) {
  const dependencyIndex = scripts.indexOf(dependency);
  const consumerIndex = scripts.indexOf(consumer);
  assert.notStrictEqual(dependencyIndex, -1, `${label}: missing ${dependency}`);
  assert.notStrictEqual(consumerIndex, -1, `${label}: missing ${consumer}`);
  assert.ok(dependencyIndex < consumerIndex, `${label}: ${dependency} must load before ${consumer}`);
}

function testRuntimeOrderProtectsNewSurfaces() {
  const contentScripts = RuntimeScripts.contentScripts;
  const backgroundScripts = RuntimeScripts.backgroundScripts;

  assertBefore(contentScripts, "shared/aiCandidateGate.js", "shared/transformOutboundPromptWithAi.js", "content scripts");
  assertBefore(contentScripts, "shared/transformOutboundPromptWithAi.js", "content/content.js", "content scripts");
  assertBefore(contentScripts, "content/diagnostics/fileDebugMetadata.js", "content/files/fileAttachPipeline.js", "content scripts");
  assertBefore(contentScripts, "content/diagnostics/safeSnapshots.js", "content/files/fileAttachPipeline.js", "content scripts");
  assertBefore(contentScripts, "content/files/fileAttachPipeline.js", "content/files/pendingSanitizedFileHandoff.js", "content scripts");
  assertBefore(contentScripts, "content/diagnostics/debugLogger.js", "content/diagnostics/contentDebugFacade.js", "content scripts");
  assertBefore(contentScripts, "content/diagnostics/contentDebugFacade.js", "content/bootstrap/eventBindings.js", "content scripts");
  assertBefore(contentScripts, "shared/runtime_scripts.js", "content/content.js", "content scripts");
  assertBefore(backgroundScripts, "shared/runtime_scripts.js", "background/core.js", "background scripts");

  const baseManifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/base.json"), "utf8"));
  const firefoxManifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/firefox.json"), "utf8"));
  const serviceWorker = fs.readFileSync(path.join(root, "src/background/service_worker.js"), "utf8");
  const importScriptsMatch = serviceWorker.match(/importScripts\(([\s\S]*?)\);/);
  assert.ok(importScriptsMatch, "service worker should declare importScripts()");
  const serviceWorkerScripts = [...importScriptsMatch[1].matchAll(/"([^"]+)"/g)].map(([, script]) =>
    path.posix.normalize(path.posix.join("background", script))
  );
  assert.deepStrictEqual(baseManifest.content_scripts[0].js, contentScripts);
  assert.deepStrictEqual(firefoxManifest.background.scripts, backgroundScripts);
  assert.deepStrictEqual(serviceWorkerScripts, backgroundScripts);
}

(async () => {
  testDetectorAdversarialTruePositiveMatrix();
  testFalsePositiveMatrix();
  testSeparatorAndFormatMutations();
  await testFileScannerAndExtractorAdversarialPack();
  await testAiOnixGrayZoneAndLifecycle();
  await testDebugOutputSafety();
  await testHandoffFailurePathsFailClosed();
  testRuntimeOrderProtectsNewSurfaces();

  const newPositiveCases =
    POSITIVE_CASES.length +
    MUTATION_CASES.length +
    TEXT_FILE_FIXTURES.reduce((sum, fixture) => sum + fixture.secrets.length, 0) +
    createDocumentFixtures().reduce((sum, fixture) => sum + fixture.secrets.length, 0) +
    AI_GRAY_ZONE_REDACT_CASES.length;
  const newSafeControls =
    SAFE_CONTROL_CASES.length +
    TEXT_FILE_FIXTURES.reduce((sum, fixture) => sum + fixture.safeValues.length, 0) +
    createDocumentFixtures().reduce((sum, fixture) => sum + fixture.safeValues.length, 0) +
    AI_GRAY_ZONE_KEEP_CASES.length;
  const fileTypes = [
    ...new Set([
      ...TEXT_FILE_FIXTURES.map((fixture) => fixture.label),
      ...createDocumentFixtures().map((fixture) => fixture.label),
      ...IMAGE_FIXTURES.map((fixture) => fixture.fileName.slice(fixture.fileName.lastIndexOf("."))),
      ...UNSUPPORTED_FILE_FIXTURES.map((fixture) => fixture.fileName.slice(fixture.fileName.lastIndexOf(".")))
    ])
  ].sort();

  console.log(
    `PASS extreme redaction matrix (${newPositiveCases} positive checks, ${newSafeControls} safe controls, ${fileTypes.length} file types)`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
