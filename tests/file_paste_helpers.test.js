const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/fileLimits.js"));
require(path.join(repoRoot, "src/shared/fileScanner.js"));
require(path.join(repoRoot, "src/content/file_paste_helpers.js"));

const {
  LOCAL_FILE_MULTI_MESSAGE,
  LOCAL_FILE_STREAMING_REQUIRED_MESSAGE,
  LOCAL_FILE_UNSUPPORTED_WARNING,
  LOCAL_FILE_TEXT_INSERTION_FALLBACK_ENABLED,
  dataTransferHasFiles,
  listDataTransferFiles,
  dataTransferHasUnavailableFileItems,
  readLocalTextFileFromDataTransfer,
  createSanitizedTextFile
} = globalThis.PWM.FilePasteHelpers;
const FileScanner = globalThis.PWM.FileScanner;

function assertExplicitUnsupportedWarning(message) {
  const text = String(message || "").toLowerCase();
  assert.ok(text.includes("did not scan"), "warning should say the file was not scanned");
  assert.ok(text.includes("redact"), "warning should say the file was not redacted");
  assert.ok(text.includes("unsupported file types"), "warning should identify unsupported file types");
  assert.ok(text.includes("not protected in this release"), "warning should say unsupported files are not protected in this release");
  assert.ok(text.includes("normal upload may continue"), "warning should say normal upload may continue");
  assert.strictEqual(text.includes("sanitized"), false, "warning must not claim sanitization");
}

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
      getAsFile: () => (options.getAsFileReturnsNull ? null : file)
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

async function testFirefoxStyleEnvFileWithEmptyMimeDecodesLocally() {
  const text = [
    "OPENAI_API_KEY=LeakGuardFileApiKey1234567890",
    "DB_PASSWORD=LeakGuardDbPassword123!"
  ].join("\r\n");
  const file = createFile({ name: "01-basic-secrets.env", type: "", text });
  const result = await readLocalTextFileFromDataTransfer(createDataTransfer([file]));

  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.file.extension, ".env");
  assert.strictEqual(result.file.type, "");
  assert.strictEqual(result.text, text.replace(/\r\n/g, "\n"));
}

async function readFileLikeText(fileLike) {
  const buffer = await fileLike.arrayBuffer();
  return new TextDecoder().decode(buffer);
}

async function testSanitizedFileProducedForHandoff() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const redactedText = "API_KEY=[PWM_1]\ntoken_limit=4096";
  const sanitizedFile = createSanitizedTextFile(
    {
      name: "secrets.env",
      type: "text/plain"
    },
    redactedText
  );
  const sanitizedText = await readFileLikeText(sanitizedFile);

  assert.ok(sanitizedFile, "expected an in-memory sanitized File/Blob");
  assert.strictEqual(sanitizedFile.name, "secrets.env");
  assert.strictEqual(sanitizedFile.type, "text/plain");
  assert.strictEqual(sanitizedText, redactedText);
  assert.strictEqual(sanitizedText.includes(rawSecret), false);
  assert.strictEqual(
    LOCAL_FILE_TEXT_INSERTION_FALLBACK_ENABLED,
    false,
    "file-to-text insertion fallback should stay disabled by default"
  );
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

async function testFirefoxItemsOnlyFilePathDecodesLocally() {
  const text = "OPENAI_API_KEY=LeakGuardFirefoxItemApiKey1234567890";
  const file = createFile({ name: "items-only.env", type: "text/plain", text });
  const dataTransfer = createDataTransfer([file], {
    omitFiles: true
  });
  const result = await readLocalTextFileFromDataTransfer(dataTransfer);

  assert.strictEqual(dataTransferHasFiles(dataTransfer), true);
  assert.deepStrictEqual(listDataTransferFiles(dataTransfer), [file]);
  assert.strictEqual(dataTransferHasUnavailableFileItems(dataTransfer), false);
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.text, text);
}

async function testFirefoxItemsOnlyNullFileFailsClosed() {
  const file = createFile({ name: "unavailable.env", type: "text/plain", text: "API_KEY=secret" });
  const dataTransfer = createDataTransfer([file], {
    omitFiles: true,
    getAsFileReturnsNull: true
  });
  const result = await readLocalTextFileFromDataTransfer(dataTransfer);

  assert.strictEqual(dataTransferHasFiles(dataTransfer), true);
  assert.deepStrictEqual(listDataTransferFiles(dataTransfer), []);
  assert.strictEqual(dataTransferHasUnavailableFileItems(dataTransfer), true);
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "firefox_data_transfer_file_unavailable");
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

async function testUnsupportedFilesPassThroughAndTextBinaryFilesRejected() {
  const unsupported = await readLocalTextFileFromDataTransfer(
    createDataTransfer([createFile({ name: "secret.pdf", type: "application/pdf", text: "not scanned" })])
  );
  const binary = await readLocalTextFileFromDataTransfer(
    createDataTransfer([createFile({ name: "binary.txt", bytes: [0, 65, 0, 66, 0, 67, 0, 68] })])
  );
  const invalidUtf8 = await readLocalTextFileFromDataTransfer(
    createDataTransfer([createFile({ name: "bad.txt", bytes: [0xff, 0xfe, 0xfd] })])
  );

  assert.strictEqual(unsupported.handled, false);
  assert.strictEqual(unsupported.ok, false);
  assert.strictEqual(unsupported.code, "unsupported_binary_or_document");
  assertExplicitUnsupportedWarning(unsupported.message);
  assert.strictEqual(binary.handled, false);
  assert.strictEqual(binary.ok, false);
  assert.strictEqual(binary.code, "binary_content");
  assertExplicitUnsupportedWarning(binary.message);
  assert.strictEqual(invalidUtf8.handled, true);
  assert.strictEqual(invalidUtf8.ok, true);
  assert.strictEqual(invalidUtf8.text, "\ufffd\ufffd\ufffd");
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

async function testOptimizedZoneFileStillDecodesAndOversizedFileBlocks() {
  assert.strictEqual(
    LOCAL_FILE_STREAMING_REQUIRED_MESSAGE,
    FileScanner.LOCAL_FILE_STREAMING_REQUIRED_MESSAGE
  );
  assert.strictEqual(LOCAL_FILE_UNSUPPORTED_WARNING, FileScanner.UNSUPPORTED_COMPOSER_FILE_MESSAGE);

  const optimizedText = "x".repeat(2 * 1024 * 1024 + 1024);
  const optimized = await readLocalTextFileFromDataTransfer(
    createDataTransfer([createFile({ name: "optimized.log", text: optimizedText })])
  );
  const oversized = await readLocalTextFileFromDataTransfer(
    createDataTransfer([createFile({ name: "oversized.log", text: "x".repeat(4 * 1024 * 1024 + 1) })])
  );

  assert.strictEqual(optimized.handled, true);
  assert.strictEqual(optimized.ok, true);
  assert.strictEqual(optimized.text.length, optimizedText.length);
  assert.strictEqual(oversized.handled, true);
  assert.strictEqual(oversized.ok, false);
  assert.strictEqual(oversized.code, "streaming_required");
  assert.ok(oversized.message.includes("stream-redact"));
  assert.ok(oversized.sourceFile);
  assert.strictEqual(oversized.file.name, "oversized.log");
}

async function testOversizedTextFileRequiresStreamingWithoutWholeFileRead() {
  const readCalls = {
    text: 0,
    arrayBuffer: 0
  };
  const file = {
    name: "stream-me.env",
    type: "text/plain",
    size: 4 * 1024 * 1024 + 1,
    async text() {
      readCalls.text += 1;
      throw new Error("streaming-required ingress must not call file.text()");
    },
    async arrayBuffer() {
      readCalls.arrayBuffer += 1;
      throw new Error("streaming-required ingress must not call file.arrayBuffer()");
    }
  };
  const result = await readLocalTextFileFromDataTransfer(createDataTransfer([file]));

  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "streaming_required");
  assert.strictEqual(result.sourceFile, file);
  assert.strictEqual(readCalls.text, 0);
  assert.strictEqual(readCalls.arrayBuffer, 0);
}

(async () => {
  await testSupportedEnvFileDecodesLocally();
  await testFirefoxStyleEnvFileWithEmptyMimeDecodesLocally();
  await testSanitizedFileProducedForHandoff();
  await testClipboardFilesArrayPathDecodesLocally();
  await testClipboardItemsFilePathDecodesLocally();
  await testFirefoxItemsOnlyFilePathDecodesLocally();
  await testFirefoxItemsOnlyNullFileFailsClosed();
  await testMultipleFilesRejectedWithoutReading();
  await testUnsupportedFilesPassThroughAndTextBinaryFilesRejected();
  await testNoFileTransferIgnored();
  await testOptimizedZoneFileStillDecodesAndOversizedFileBlocks();
  await testOversizedTextFileRequiresStreamingWithoutWholeFileRead();
  console.log("PASS local file paste helper regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
