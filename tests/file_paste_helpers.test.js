const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/fileScanner.js"));
require(path.join(repoRoot, "src/content/file_paste_helpers.js"));

const {
  LOCAL_FILE_MULTI_MESSAGE,
  dataTransferHasFiles,
  listDataTransferFiles,
  readLocalTextFileFromDataTransfer
} = globalThis.PWM.FilePasteHelpers;

function bufferFromText(text) {
  return new TextEncoder().encode(text).buffer;
}

function createFile({ name, type = "text/plain", text = "", bytes = null }) {
  const buffer = bytes ? Uint8Array.from(bytes).buffer : bufferFromText(text);

  return {
    name,
    type,
    size: buffer.byteLength,
    async arrayBuffer() {
      return buffer;
    }
  };
}

function createDataTransfer(files, options = {}) {
  return {
    types: files.length ? ["Files"] : [],
    files: options.omitFiles ? [] : files,
    items: files.map((file) => ({
      kind: options.uppercaseKind ? "FILE" : "file",
      getAsFile: () => file
    }))
  };
}

async function testSupportedEnvFileDecodesLocally() {
  const text = [
    "API_KEY=LeakGuardFileApiKey1234567890",
    "DB_PASSWORD=LeakGuardDbPassword123!",
    "token_limit=4096"
  ].join("\n");
  const file = createFile({ name: ".env", text });
  const dataTransfer = createDataTransfer([file]);
  const result = await readLocalTextFileFromDataTransfer(dataTransfer);

  assert.strictEqual(dataTransferHasFiles(dataTransfer), true);
  assert.deepStrictEqual(listDataTransferFiles(dataTransfer), [file]);
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.text, text);
  assert.strictEqual(result.file.extension, ".env");
}

async function testClipboardFilesArrayPathDecodesLocally() {
  const text = "API_KEY=LeakGuardClipboardFilesApiKey1234567890";
  const file = createFile({ name: "clipboard.env", text });
  const result = await readLocalTextFileFromDataTransfer({
    types: [],
    files: [file],
    items: []
  });

  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.text, text);
}

async function testClipboardItemsFilePathDecodesLocally() {
  const text = "DB_PASSWORD=LeakGuardClipboardItemPassword123!";
  const file = createFile({ name: "clipboard-item.env", text });
  const dataTransfer = createDataTransfer([file], {
    omitFiles: true,
    uppercaseKind: true
  });
  const result = await readLocalTextFileFromDataTransfer(dataTransfer);

  assert.strictEqual(dataTransferHasFiles(dataTransfer), true);
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.text, text);
}

async function testMultipleFilesRejectedWithoutReading() {
  const first = createFile({ name: "one.env", text: "API_KEY=LeakGuardOne1234567890" });
  const second = createFile({ name: "two.env", text: "API_KEY=LeakGuardTwo1234567890" });
  const result = await readLocalTextFileFromDataTransfer(createDataTransfer([first, second]));

  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "multiple_files");
  assert.strictEqual(result.message, LOCAL_FILE_MULTI_MESSAGE);
}

async function testUnsupportedAndBinaryFilesRejected() {
  const unsupported = await readLocalTextFileFromDataTransfer(
    createDataTransfer([createFile({ name: "secret.pdf", type: "application/pdf", text: "not scanned" })])
  );
  const binary = await readLocalTextFileFromDataTransfer(
    createDataTransfer([createFile({ name: "binary.txt", bytes: [0, 65, 0, 66, 0, 67, 0, 68] })])
  );
  const invalidUtf8 = await readLocalTextFileFromDataTransfer(
    createDataTransfer([createFile({ name: "bad.txt", bytes: [0xff, 0xfe, 0xfd] })])
  );

  assert.strictEqual(unsupported.handled, true);
  assert.strictEqual(unsupported.ok, false);
  assert.strictEqual(unsupported.code, "unsupported_binary_or_document");
  assert.strictEqual(binary.handled, true);
  assert.strictEqual(binary.ok, false);
  assert.strictEqual(binary.code, "binary_content");
  assert.strictEqual(invalidUtf8.handled, true);
  assert.strictEqual(invalidUtf8.ok, false);
  assert.strictEqual(invalidUtf8.code, "invalid_utf8");
}

async function testNoFileTransferIgnored() {
  const result = await readLocalTextFileFromDataTransfer({
    types: ["text/plain"],
    files: [],
    items: []
  });

  assert.strictEqual(dataTransferHasFiles({ types: ["text/plain"], files: [], items: [] }), false);
  assert.strictEqual(result.handled, false);
}

(async () => {
  await testSupportedEnvFileDecodesLocally();
  await testClipboardFilesArrayPathDecodesLocally();
  await testClipboardItemsFilePathDecodesLocally();
  await testMultipleFilesRejectedWithoutReading();
  await testUnsupportedAndBinaryFilesRejected();
  await testNoFileTransferIgnored();
  console.log("PASS local file paste helper regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
