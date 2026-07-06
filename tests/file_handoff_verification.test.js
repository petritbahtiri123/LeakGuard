const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileHandoffVerification.js"));

function createVerifier() {
  return globalThis.PWM.FileHandoffVerification.createFileHandoffVerification({
    getLocalFileExtension(file) {
      const name = String(file?.name || "").toLowerCase();
      const index = name.lastIndexOf(".");
      return index > 0 ? name.slice(index) : "";
    },
    getLocalFileMimeType(file) {
      return String(file?.type || "").toLowerCase();
    },
    isSupportedWhatsAppTextDocumentAttachFile(file) {
      return /\.txt$/i.test(String(file?.name || "")) && String(file?.type || "") === "text/plain";
    }
  });
}

function file(name, type) {
  return {
    name,
    type
  };
}

function inputWithFiles(files) {
  return {
    files
  };
}

function testVerifierAcceptsExactSanitizedFilesInOrder() {
  const verifier = createVerifier();
  const pdf = file("report.redacted.pdf", "application/pdf");
  const docx = file(
    "brief.redacted.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  const xlsx = file(
    "book.redacted.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  const image = file("photo.redacted.png", "image/png");
  const text = file("notes.txt", "text/plain");

  const result = verifier.verifyWhatsAppSanitizedMultiFileAttach(
    inputWithFiles([pdf, docx, xlsx, image, text]),
    [pdf, docx, xlsx, image, text],
    [file("report.pdf", "application/pdf")]
  );

  assert.deepStrictEqual(result, {
    ok: true,
    reason: "",
    assignedCount: 5,
    expectedCount: 5
  });
}

function testVerifierRejectsCountMismatch() {
  const verifier = createVerifier();
  const expected = file("one.redacted.png", "image/png");
  const result = verifier.verifyWhatsAppSanitizedMultiFileAttach(inputWithFiles([]), [expected], []);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "assigned_file_count_mismatch");
  assert.strictEqual(result.assignedCount, 0);
  assert.strictEqual(result.expectedCount, 1);
}

function testVerifierRejectsOrderOrIdentityMismatch() {
  const verifier = createVerifier();
  const first = file("one.redacted.png", "image/png");
  const second = file("two.redacted.png", "image/png");
  const result = verifier.verifyWhatsAppSanitizedMultiFileAttach(
    inputWithFiles([second, first]),
    [first, second],
    []
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "assigned_file_order_or_identity_mismatch");
}

function testVerifierRejectsRawOriginalAssignment() {
  const verifier = createVerifier();
  const raw = file("raw.txt", "text/plain");
  const result = verifier.verifyWhatsAppSanitizedMultiFileAttach(inputWithFiles([raw]), [raw], [raw]);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "raw_original_file_assigned");
}

function testVerifierRejectsInvalidSanitizedType() {
  const verifier = createVerifier();
  const invalid = file("photo.redacted.gif", "image/gif");
  const result = verifier.verifyWhatsAppSanitizedMultiFileAttach(inputWithFiles([invalid]), [invalid], []);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "assigned_file_type_invalid");
}

testVerifierAcceptsExactSanitizedFilesInOrder();
testVerifierRejectsCountMismatch();
testVerifierRejectsOrderOrIdentityMismatch();
testVerifierRejectsRawOriginalAssignment();
testVerifierRejectsInvalidSanitizedType();

console.log("PASS file handoff verification");
