const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
const {
  BROWSER_QA_FAILURE_CODES
} = require(path.join(repoRoot, "tests/helpers/browserQaAssertions.js"));
const {
  SUPPORTED_TEXT_EXTENSIONS,
  SUPPORTED_TEXT_BASENAMES
} = require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));

const REQUIRED_SUPPORTED_EXTENSIONS = [
  ...Array.from(SUPPORTED_TEXT_EXTENSIONS).sort(),
  ".pdf",
  ".docx",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp"
];
const REQUIRED_SUPPORTED_BASENAMES = Array.from(SUPPORTED_TEXT_BASENAMES).sort();

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
  const compatibility = fs.readFileSync(path.join(repoRoot, "docs/BROWSER_COMPATIBILITY_MATRIX.md"), "utf8");
  const count = (source, value) => source.split(value).length - 1;
  assert.ok(packageJson.scripts["qa:browser"], "qa:browser should remain available");
  assert.ok(packageJson.scripts["qa:browser:full"], "qa:browser:full should run the full browser matrix");
  assert.strictEqual(
    packageJson.scripts["preflight:browser"],
    "node scripts/check-browser-environment.mjs --targets=chrome,edge",
    "browser gates should preflight Chrome and Edge only"
  );
  assert.strictEqual(
    packageJson.scripts["build:release"],
    "npm run prepare:build && node scripts/build-extension.mjs --browser chrome --mode consumer && node scripts/build-extension.mjs --browser chrome --mode enterprise",
    "release gates should build Chrome consumer and enterprise only"
  );
  for (const scriptName of ["release:artifacts", "test:release-gates"]) {
    const script = packageJson.scripts[scriptName];
    assert.match(script, /npm run build:release/);
    assert.doesNotMatch(script, /build:all|firefox|geckodriver/i, `${scriptName} should exclude Firefox build paths`);
  }
  assert.match(packageJson.scripts["qa:browser:full"], /--full-matrix/);
  for (const scriptName of ["qa:browser", "qa:browser:full"]) {
    const script = packageJson.scripts[scriptName];
    assert.strictEqual(count(script, "extension_qa_harness.test.mjs"), 1, `${scriptName} should run the Chrome consumer harness exactly once`);
    assert.strictEqual(count(script, "chrome_smoke.test.mjs"), scriptName === "qa:browser:full" ? 2 : 1, `${scriptName} should run each required Chrome smoke exactly once`);
    assert.strictEqual(count(script, "edge_smoke.test.mjs"), 1, `${scriptName} should run Edge smoke exactly once`);
    assert.doesNotMatch(script, /firefox|geckodriver/i, `${scriptName} should exclude Firefox gates`);
  }
  assert.match(compatibility, /Firefox[^\n]*(?:excluded)[^\n]*(?:unverified)/i);
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
  const supportedFileNames = new Set(matrix.supportedFiles.map((entry) => String(entry.fileName || "")));
  const unsupportedIds = new Set(matrix.unsupportedFiles.map((entry) => entry.id));
  const followUpExtensions = new Set(matrix.followUpFiles.map((entry) => entry.extension));

  for (const extension of REQUIRED_SUPPORTED_EXTENSIONS) {
    assert.ok(supportedExtensions.has(extension), `full matrix should include ${extension}`);
  }
  for (const basename of REQUIRED_SUPPORTED_BASENAMES) {
    const expectedFileName = basename.charAt(0).toUpperCase() + basename.slice(1);
    assert.ok(supportedFileNames.has(expectedFileName), `full matrix should include ${expectedFileName}`);
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
    "WhatsApp Web text/send guard",
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
  assert.strictEqual(matrix.whatsAppTextOnly.target, "https://web.whatsapp.com/*");
  for (const inputPath of [
    "send button click",
    "Enter-to-send",
    "text paste",
    "clipboard image paste",
    "single text-document attachment",
    "single PDF attachment",
    "single DOCX attachment",
    "single XLSX attachment",
    "attach-button multi-file attachment",
    "drag/drop single file attachment",
    "drag/drop multi-file attachment",
    "over-cap file block",
    "unsupported file attachment attempt"
  ]) {
    assert.ok(matrix.whatsAppTextOnly.inputPaths.includes(inputPath), `WhatsApp QA should include ${inputPath}`);
  }
  for (const requiredCase of [
    "first click sends sanitized text",
    "Enter sends sanitized text",
    "raw fake secret is never sent",
    "trusted [PWM_1] and [PWM_2] placeholders do not loop",
    "redaction failure blocks send",
    "composer-not-found blocks send",
    "rewrite verification failure blocks send",
    "programmatic replay does not recurse",
    "second-click retry is not accepted as success",
    "single canonical LeakGuard text-like attachment assigns only a sanitized document",
    "Dockerfile and Makefile attachments assign only sanitized documents",
    "single PDF attachment assigns only a sanitized rebuilt PDF",
    "single DOCX attachment assigns only a sanitized rebuilt DOCX",
    "single XLSX attachment assigns only a sanitized rebuilt XLSX",
    "encrypted/malformed/image-only PDF attachment remains blocked",
    "in-cap supported multi-file attachments assign only sanitized files",
    "over-cap WhatsApp multi-file attachments block before read",
    "unsupported extensionless WhatsApp attachment remains blocked",
    "unsupported or failing WhatsApp multi-file batch blocks all-or-nothing",
    "single-file and in-cap supported WhatsApp drag/drop files assign only sanitized files",
    "over-cap WhatsApp drag/drop files block before read",
    "unsupported or failing WhatsApp drag/drop batch blocks all-or-nothing"
  ]) {
    assert.ok(
      matrix.whatsAppTextOnly.requiredCases.includes(requiredCase),
      `WhatsApp QA should include ${requiredCase}`
    );
  }

  for (const testCase of matrix.supportedFiles) {
    assertSupportedFileCaseShape(testCase);
  }

  assert.equal(harness.isHarnessTextCaptureFileName("sample.yaml", "text/yaml"), true);
  assert.equal(harness.isHarnessTextCaptureFileName("Dockerfile", ""), true);
  assert.equal(harness.isHarnessTextCaptureFileName("Makefile", ""), true);
  assert.equal(harness.isHarnessTextCaptureFileName("extensionless", "text/yaml"), true);
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
