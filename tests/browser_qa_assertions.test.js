const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  BROWSER_QA_FAILURE_CODES,
  BrowserQaAssertionError,
  assertBrowserQaStep,
  assertDebugOutputMetadataOnly,
  assertExpectedPlaceholdersVisible,
  assertFileHandoffResult,
  assertNoRawFileFallback,
  assertNoRawSecretVisible,
  assertSafeControlsVisible,
  createBrowserQaReporter,
  safeBrowserQaScreenshotPath,
  sanitizeBrowserQaText,
  summarizeBrowserConsoleLogs
} = require("./helpers/browserQaAssertions.js");

const rawCanary = "synthetic-LGQA-AWS-001-raw-token-value";
const rawCanaryTwo = "synthetic-LGQA-DB-002-raw-password-value";
const canaries = [
  { id: "LGQA_AWS_001", value: rawCanary, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_DB_002", value: rawCanaryTwo, expectedPlaceholder: "[PWM_N]" }
];

const baseContext = {
  browserName: "Chrome",
  siteLabel: "local protected QA page",
  adapter: "generic protected site",
  inputPath: "paste",
  stage: "UI rewrite failed",
  secretCanaries: canaries,
  expected: "raw absent + placeholder present",
  recommendation: "Likely cause: detector miss or rewrite pipeline skipped."
};

function assertNoRawCanaries(value, label) {
  const text = JSON.stringify(value);
  assert.strictEqual(text.includes(rawCanary), false, `${label} leaked first raw canary`);
  assert.strictEqual(text.includes(rawCanaryTwo), false, `${label} leaked second raw canary`);
}

function testFailureCodesAreStable() {
  for (const code of [
    "EXTENSION_NOT_LOADED",
    "PROTECTED_SITE_INACTIVE",
    "CONTENT_SCRIPT_NOT_READY",
    "ADAPTER_SELECTOR_MISSING",
    "TEXT_TYPED_REDACTION_FAILED",
    "TEXT_PASTE_REDACTION_FAILED",
    "FILE_INPUT_REDACTION_FAILED",
    "FILE_DROP_REDACTION_FAILED",
    "MULTI_FILE_LIMIT_EXCEEDED",
    "MULTI_FILE_PARTIAL_BLOCKED",
    "DETECTOR_MISS",
    "ENTROPY_MISS",
    "ONIX_MISS",
    "PLACEHOLDER_MISSING",
    "PLACEHOLDER_REREDACTED",
    "RAW_SECRET_VISIBLE",
    "RAW_FILE_FALLBACK",
    "SAFE_CONTROL_REDACTED",
    "FILE_EXTRACTION_FAILED",
    "REDACTED_FILE_MISSING",
    "SANITIZED_HANDOFF_FAILED",
    "UNSUPPORTED_FILE_NOT_BLOCKED",
    "DEBUG_RAW_LEAK",
    "QA_FIXTURE_INVALID",
    "UI_TIMEOUT",
    "BROWSER_PERMISSION_FAILURE",
    "SCRIPT_ORDER_REGRESSION"
  ]) {
    assert.strictEqual(BROWSER_QA_FAILURE_CODES[code], code, `missing stable browser QA code ${code}`);
  }
  assert.ok(Object.isFrozen(BROWSER_QA_FAILURE_CODES), "failure taxonomy should be immutable");
}

function testSanitizesRawCanariesButKeepsIds() {
  const message = sanitizeBrowserQaText(
    `before ${rawCanary} and ${rawCanaryTwo} after sk-proj-1234567890abcdef1234567890abcdef`,
    canaries
  );

  assertNoRawCanaries(message, "sanitized text");
  assert.match(message, /LGQA_AWS_001/);
  assert.match(message, /LGQA_DB_002/);
  assert.match(message, /\[REDACTED_SYNTHETIC_TOKEN\]/);
}

function testByteDiagnosticsAreSummarized() {
  const byteValues = Array.from(Buffer.from(`prefix ${rawCanary} suffix`, "utf8"));
  const message = sanitizeBrowserQaText(
    `Diagnostic: {"byteValues":[${byteValues.join(",")}],"safe":true}`,
    canaries
  );

  assertNoRawCanaries(message, "byte diagnostic text");
  assert.match(message, /"byteValues":"\[ByteArray omitted\]"/);
  assert.equal(message.includes(byteValues.join(",")), false);
}

function testNoRawSecretAssertionIsSanitized() {
  assert.throws(
    () =>
      assertNoRawSecretVisible(
        { text: `Composer still shows ${rawCanary}`, placeholderCount: 0 },
        canaries,
        baseContext
      ),
    (error) => {
      assert.ok(error instanceof BrowserQaAssertionError);
      assert.strictEqual(error.failureCode, "RAW_SECRET_VISIBLE");
      assert.match(error.message, /RAW_SECRET_VISIBLE: Chrome \/ local protected QA page \/ paste \/ UI rewrite failed/);
      assert.match(error.message, /LGQA_AWS_001/);
      assert.match(error.message, /placeholderCount=0/);
      assertNoRawCanaries(error.message, "raw secret assertion error");
      return true;
    }
  );
}

function testPlaceholderAndSafeControlAssertionsExplainRisk() {
  assert.doesNotThrow(() =>
    assertExpectedPlaceholdersVisible("safe text [PWM_7]", 1, {
      ...baseContext,
      stage: "placeholder allocation failed"
    })
  );

  assert.throws(
    () =>
      assertSafeControlsVisible("safe page text without the control", ["LGQA_SAFE_CONTROL_001"], {
        ...baseContext,
        stage: "UI rewrite failed"
      }),
    (error) => {
      assert.strictEqual(error.failureCode, "SAFE_CONTROL_REDACTED");
      assert.match(error.message, /LGQA_SAFE_CONTROL_001/);
      assert.match(error.message, /UI\/test harness issue/);
      assertNoRawCanaries(error.message, "safe control assertion error");
      return true;
    }
  );
}

function testFileAndDebugAssertionsStayMetadataOnly() {
  assert.throws(
    () =>
      assertNoRawFileFallback(
        [{ source: "file-input", items: [{ name: "raw.env", text: `KEY=${rawCanary}` }] }],
        baseContext
      ),
    (error) => {
      assert.strictEqual(error.failureCode, "RAW_FILE_FALLBACK");
      assert.match(error.message, /LGQA_AWS_001/);
      assertNoRawCanaries(error.message, "raw file fallback error");
      return true;
    }
  );

  assert.throws(
    () => assertDebugOutputMetadataOnly([`debug text ${rawCanary}`], baseContext),
    (error) => {
      assert.strictEqual(error.failureCode, "DEBUG_RAW_LEAK");
      assert.match(error.message, /LGQA_AWS_001/);
      assertNoRawCanaries(error.message, "debug output assertion error");
      return true;
    }
  );

  assert.doesNotThrow(() =>
    assertFileHandoffResult(
      {
        ok: true,
        fileName: "fixture.redacted.env",
        fileType: "text/plain",
        rawFallback: false,
        placeholderCount: 1
      },
      { placeholderRequired: true, rawFallbackBlocked: true },
      baseContext
    )
  );

  assert.doesNotThrow(() =>
    assertDebugOutputMetadataOnly(
      [
        {
          stage: "multi-file",
          fileCount: 5,
          files: [
            { index: 0, label: "file-1", extension: ".env", status: "sanitized" },
            { index: 1, label: "file-2", extension: ".svg", status: "blocked", code: "unsupported_file_type" }
          ]
        }
      ],
      { ...baseContext, stage: "multi-file metadata" }
    )
  );
}

async function testStepWrapperWritesSafeFailureReport() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "leakguard-browser-qa-report-test-"));
  const outputPath = path.join(tempDir, "browser-qa-report.json");
  const reporter = createBrowserQaReporter({
    outputPath,
    runId: "browser-qa-test-run",
    browser: "Chrome",
    extensionBuildPath: "dist/chrome",
    secretCanaries: canaries
  });

  await assert.rejects(
    () =>
      assertBrowserQaStep(
        "paste rewrite",
        async () => {
          throw new Error(`Unexpected raw diagnostic ${rawCanary}`);
        },
        {
          ...baseContext,
          failureCode: "UI_TIMEOUT",
          actualSummary: { textareaLength: rawCanary.length, leakedValue: rawCanary }
        },
        reporter
      ),
    (error) => {
      assert.ok(error instanceof BrowserQaAssertionError);
      assert.strictEqual(error.failureCode, "UI_TIMEOUT");
      assertNoRawCanaries(error.message, "wrapped step failure");
      assertNoRawCanaries(error.cause, "wrapped step failure cause");
      return true;
    }
  );

  reporter.write();
  const report = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.strictEqual(report.runId, "browser-qa-test-run");
  assert.strictEqual(report.browser, "Chrome");
  assert.strictEqual(report.steps.length, 1);
  assert.strictEqual(report.steps[0].status, "failed");
  assert.strictEqual(report.steps[0].failureCode, "UI_TIMEOUT");
  assert.deepStrictEqual(report.steps[0].secretIdsChecked, ["LGQA_AWS_001", "LGQA_DB_002"]);
  assertNoRawCanaries(report, "browser QA report");

  fs.rmSync(tempDir, { recursive: true, force: true });
}

function testScreenshotNamesAndConsoleSummariesAreSafe() {
  const screenshotPath = safeBrowserQaScreenshotPath({
    screenshotsDir: path.join(os.tmpdir(), "leakguard-browser-qa-screenshots"),
    browserName: "Chrome",
    testName: `paste ${rawCanary}`,
    stepName: "rewrite stage"
  });
  assert.match(path.basename(screenshotPath), /^chrome-paste-redacted-canary-rewrite-stage-[a-f0-9]{8}\.png$/);
  assertNoRawCanaries(screenshotPath, "screenshot path");

  const summary = summarizeBrowserConsoleLogs(
    [
      { method: "Runtime.consoleAPICalled", params: { type: "error", args: [{ value: `raw ${rawCanary}` }] } },
      { method: "Log.entryAdded", params: { entry: { level: "warning", text: "content script missing" } } }
    ],
    canaries
  );
  assert.strictEqual(summary.errorCount, 1);
  assert.strictEqual(summary.warningCount, 1);
  assert.ok(summary.classifications.includes("debug leak detected"));
  assert.ok(summary.classifications.includes("content script missing"));
  assertNoRawCanaries(summary, "console summary");
}

async function run() {
  testFailureCodesAreStable();
  testSanitizesRawCanariesButKeepsIds();
  testByteDiagnosticsAreSummarized();
  testNoRawSecretAssertionIsSanitized();
  testPlaceholderAndSafeControlAssertionsExplainRisk();
  testFileAndDebugAssertionsStayMetadataOnly();
  await testStepWrapperWritesSafeFailureReport();
  testScreenshotNamesAndConsoleSummariesAreSafe();
  console.log("PASS browser QA assertion helper regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
