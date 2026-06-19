const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
const {
  BROWSER_QA_FAILURE_CODES
} = require(path.join(repoRoot, "tests/helpers/browserQaAssertions.js"));

const REQUIRED_SUPPORTED_EXTENSIONS = [
  ".txt",
  ".env",
  ".json",
  ".yaml",
  ".yml",
  ".log",
  ".md",
  ".html",
  ".js",
  ".ps1",
  ".ini",
  ".xml",
  ".csv",
  ".pdf",
  ".docx",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp"
];

const REQUIRED_UNSUPPORTED_IDS = [
  "unsupported-gif",
  "unsupported-bmp",
  "unsupported-ico",
  "unsupported-svg",
  "unsupported-unknown-binary",
  "malformed-pdf",
  "encrypted-pdf",
  "image-only-pdf"
];

const REQUIRED_FOLLOW_UP_EXTENSIONS = [".tf", ".tfvars", ".properties"];

function assertRequiredFailureCodesExist() {
  for (const code of [
    "TEXT_TYPED_REDACTION_FAILED",
    "TEXT_PASTE_REDACTION_FAILED",
    "FILE_INPUT_REDACTION_FAILED",
    "FILE_DROP_REDACTION_FAILED",
    "FILE_EXTRACTION_FAILED",
    "REDACTED_FILE_MISSING",
    "SANITIZED_HANDOFF_FAILED",
    "MULTI_FILE_PENDING_DIRECT_HANDOFF_FAILED",
    "MULTI_FILE_PENDING_QUEUED",
    "MULTI_FILE_PENDING_EXPIRED",
    "MULTI_FILE_PENDING_RETRY_FAILED",
    "MULTI_FILE_PENDING_ATTACH_FAILED",
    "RAW_SECRET_VISIBLE",
    "RAW_FILE_FALLBACK",
    "SAFE_CONTROL_REDACTED",
    "PLACEHOLDER_REREDACTED",
    "UNSUPPORTED_FILE_NOT_BLOCKED",
    "DEBUG_RAW_LEAK",
    "QA_FIXTURE_INVALID",
    "UI_TIMEOUT"
  ]) {
    assert.strictEqual(BROWSER_QA_FAILURE_CODES[code], code, `missing browser QA failure code ${code}`);
  }
}

function assertFullBrowserQaScriptIsOptIn() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.ok(packageJson.scripts["qa:browser"], "qa:browser should remain available");
  assert.ok(packageJson.scripts["qa:browser:full"], "qa:browser:full should run the full browser matrix");
  assert.match(packageJson.scripts["qa:browser:full"], /--full-matrix/);
  assert.match(packageJson.scripts["qa:browser:full"], /extension_qa_harness\.test\.mjs/);
  assert.match(packageJson.scripts["qa:browser:full"], /firefox_smoke\.test\.mjs/);
}

async function loadHarness() {
  return await import(pathToFileURL(path.join(repoRoot, "tests/browser/extension_qa_harness.test.mjs")).href);
}

function assertSupportedFileCaseShape(testCase) {
  assert.ok(testCase.id, "supported case should have an id");
  assert.ok(testCase.fileName, `${testCase.id}: supported case should have a file name`);
  assert.ok(testCase.inputPath, `${testCase.id}: supported case should identify input path`);
  assert.ok(testCase.secretId?.startsWith("LGQA_SECRET_"), `${testCase.id}: missing LGQA_SECRET canary id`);
  assert.ok(testCase.emailId?.startsWith("LGQA_EMAIL_"), `${testCase.id}: missing LGQA_EMAIL canary id`);
  assert.ok(testCase.safeControlId?.startsWith("LGQA_SAFE_"), `${testCase.id}: missing LGQA_SAFE canary id`);
  assert.ok(testCase.placeholderId?.startsWith("LGQA_PLACEHOLDER_"), `${testCase.id}: missing placeholder canary id`);
}

async function assertFullCoverageMatrix() {
  const harness = await loadHarness();
  const matrix = harness.getBrowserQaCoverageMatrix({ matrixMode: "full" });
  const supportedExtensions = new Set(matrix.supportedFiles.map((entry) => entry.extension));
  const unsupportedIds = new Set(matrix.unsupportedFiles.map((entry) => entry.id));
  const followUpExtensions = new Set(matrix.followUpFiles.map((entry) => entry.extension));

  for (const extension of REQUIRED_SUPPORTED_EXTENSIONS) {
    assert.ok(supportedExtensions.has(extension), `full matrix should include ${extension}`);
  }
  for (const id of REQUIRED_UNSUPPORTED_IDS) {
    assert.ok(unsupportedIds.has(id), `full matrix should include ${id}`);
  }
  for (const extension of REQUIRED_FOLLOW_UP_EXTENSIONS) {
    assert.ok(followUpExtensions.has(extension), `full matrix should document ${extension} as follow-up`);
  }
  for (const inputPath of [
    "typed text",
    "paste text",
    "file input upload",
    "drag/drop file upload",
    "paste file attachment",
    "debug mode",
    "sanitized handoff",
    "Gemini/Grok sanitized pending queue",
    "unsupported-file fail-closed"
  ]) {
    assert.ok(matrix.inputPaths.includes(inputPath), `full matrix should include input path ${inputPath}`);
  }
  assert.deepStrictEqual(matrix.multiFilePolicy.small, { maxFiles: 20, maxBytes: 4 * 1024 * 1024 });
  assert.deepStrictEqual(matrix.multiFilePolicy.large, { maxFiles: 5, maxBytes: 50 * 1024 * 1024 });
  for (const inputPath of [
    "drag/drop file upload",
    "file input upload",
    "paste file attachment",
    "sanitized handoff",
    "Gemini/Grok sanitized pending queue"
  ]) {
    assert.ok(matrix.multiFilePolicy.entryPaths.includes(inputPath), `multi-file policy should include ${inputPath}`);
  }
  for (const requiredCase of [
    "5 large supported files",
    "20 small supported files",
    "10 small + 3 large supported files",
    "10 small + 6 large blocked before processing",
    "unsupported mixed file excluded from sanitized handoff"
  ]) {
    assert.ok(matrix.multiFilePolicy.requiredCases.includes(requiredCase), `multi-file policy should include ${requiredCase}`);
  }
  assert.ok(matrix.followUpInputPaths.includes("drag/drop text"), "text drag/drop should be documented as follow-up");

  for (const testCase of matrix.supportedFiles) {
    assertSupportedFileCaseShape(testCase);
  }

  assert.equal(harness.isHarnessTextCaptureFileName("sample.yaml", "text/yaml"), true);
  assert.equal(harness.isHarnessTextCaptureFileName("sample.tfvars", ""), false);
  assert.equal(harness.isHarnessTextCaptureFileName("sample.properties", ""), false);
  assert.equal(harness.isHarnessTextCaptureFileName("sample.png", "image/png"), false);
}

async function run() {
  assertRequiredFailureCodesExist();
  assertFullBrowserQaScriptIsOptIn();
  await assertFullCoverageMatrix();
  console.log("PASS browser QA full matrix metadata regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
