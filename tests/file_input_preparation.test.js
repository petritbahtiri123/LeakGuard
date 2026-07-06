const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileInputPreparation.js"));

function createInput({ accept = "", multiple = false } = {}) {
  return {
    type: "file",
    accept,
    multiple,
    attributes: accept ? { accept } : {},
    getAttribute(name) {
      return this.attributes[name];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === "accept") this.accept = String(value);
      if (name === "multiple") this.multiple = true;
    },
    removeAttribute(name) {
      delete this.attributes[name];
      if (name === "accept") this.accept = "";
      if (name === "multiple") this.multiple = false;
    }
  };
}

function createPreparation() {
  return globalThis.PWM.FileInputPreparation.createFileInputPreparation({
    isFileInputElement: (input) => input?.type === "file"
  });
}

function testAcceptMatchingCoversExtensionMimeWildcardAndMultiple() {
  const prep = createPreparation();
  const pdf = { name: "report.PDF", type: "application/pdf" };
  const png = { name: "image.png", type: "image/png" };

  assert.strictEqual(prep.getSafeFileExtensionForAccept(pdf), ".pdf");
  assert.strictEqual(prep.fileMatchesAcceptTokenForHandoff(pdf, ".pdf"), true);
  assert.strictEqual(prep.fileMatchesAcceptTokenForHandoff(png, "image/*"), true);
  assert.strictEqual(prep.fileMatchesAcceptTokenForHandoff(pdf, "application/pdf"), true);
  assert.strictEqual(prep.fileMatchesAcceptTokenForHandoff(pdf, "image/*"), false);
  assert.strictEqual(prep.fileInputAcceptsHandoffFiles(createInput({ accept: ".pdf" }), [pdf]), true);
  assert.strictEqual(prep.fileInputAcceptsHandoffFiles(createInput({ accept: ".txt" }), [pdf]), false);
  assert.strictEqual(
    prep.fileInputAcceptsHandoffFiles(createInput({ accept: "*" }), [pdf, png]),
    false,
    "multi-file handoff still requires a multiple file input"
  );
  assert.strictEqual(
    prep.fileInputAcceptsHandoffFiles(createInput({ accept: "*", multiple: true }), [pdf, png]),
    true
  );
}

function testPrepareAddsAcceptAndMultipleThenRestores() {
  const prep = createPreparation();
  const input = createInput({ accept: ".txt", multiple: false });
  const restore = prep.prepareFileInputForSanitizedHandoff(input, [
    { name: "safe.pdf", type: "application/pdf" },
    { name: "safe.png", type: "image/png" }
  ]);

  assert.ok(input.accept.includes(".txt"));
  assert.ok(input.accept.includes(".pdf"));
  assert.ok(input.accept.includes("application/pdf"));
  assert.ok(input.accept.includes(".png"));
  assert.strictEqual(input.multiple, true);

  restore();
  assert.strictEqual(input.accept, ".txt");
  assert.strictEqual(input.multiple, false);
}

testAcceptMatchingCoversExtensionMimeWildcardAndMultiple();
testPrepareAddsAcceptAndMultipleThenRestores();

console.log("PASS file input preparation");
