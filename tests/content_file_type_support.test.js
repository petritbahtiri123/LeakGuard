const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileTypeSupport.js"));

function createSupport(overrides = {}) {
  const calls = {
    contentPipelineChecks: []
  };
  const support = globalThis.PWM.ContentFileTypeSupport.createContentFileTypeSupport({
    fileScanner: {
      getFileExtension(fileName) {
        const name = String(fileName || "").toLowerCase();
        const index = name.lastIndexOf(".");
        return index > 0 ? name.slice(index) : "";
      },
      isSupportedTextFile(fileName, mimeType) {
        return /\.txt$/i.test(String(fileName || "")) || String(mimeType || "").toLowerCase() === "text/plain";
      },
      ...(overrides.fileScanner || {})
    },
    fileTypeRegistry: {
      FILE_TYPE_STATUS: {
        SUPPORTED: "supported"
      },
      classifyFileType({ fileName, mimeType }) {
        if (/\.txt$/i.test(String(fileName || "")) || String(mimeType || "").toLowerCase() === "text/plain") {
          return {
            status: "supported",
            family: "text"
          };
        }
        return {
          status: "unsupported",
          family: "binary"
        };
      },
      ...(overrides.fileTypeRegistry || {})
    },
    shouldUseContentFileExtractionPipeline(file) {
      calls.contentPipelineChecks.push(file);
      return file?.pipelineEligible !== false;
    },
    dataTransferHasFiles(dataTransfer) {
      return Array.from(dataTransfer?.types || []).includes("Files") || Number(dataTransfer?.files?.length || 0) > 0;
    },
    listLocalTransferFiles(dataTransfer) {
      return Array.from(dataTransfer?.files || []).filter(Boolean);
    },
    maxWhatsAppMultiFileAttachments: 20,
    ...overrides
  });

  return { support, calls };
}

function file(name, type, extra = {}) {
  return {
    name,
    type,
    size: 128,
    ...extra
  };
}

function transfer(files) {
  return {
    files,
    types: files.length ? ["Files"] : [],
    items: []
  };
}

function testSupportedWhatsAppImageAttachFilesRequirePipelineExtensionAndMime() {
  const { support, calls } = createSupport();

  assert.strictEqual(support.isSupportedWhatsAppAttachImageFile(file("photo.png", "image/png")), true);
  assert.strictEqual(support.isSupportedWhatsAppAttachImageFile(file("photo.gif", "image/gif")), false);
  assert.strictEqual(
    support.isSupportedWhatsAppAttachImageFile(file("photo.png", "image/png", { pipelineEligible: false })),
    false
  );
  assert.strictEqual(calls.contentPipelineChecks.length, 3);
}

function testSupportedWhatsAppTextDocumentFilesUseRegistryAndScanner() {
  const { support } = createSupport();

  assert.strictEqual(support.isSupportedWhatsAppTextDocumentAttachFile(file("notes.txt", "text/plain")), true);
  assert.strictEqual(support.isSupportedWhatsAppTextDocumentAttachFile(file("notes.bin", "application/octet-stream")), false);

  const scannerRejects = createSupport({
    fileScanner: {
      isSupportedTextFile: () => false
    }
  }).support;
  assert.strictEqual(scannerRejects.isSupportedWhatsAppTextDocumentAttachFile(file("notes.txt", "text/plain")), false);
}

function testSupportedWhatsAppStructuredAttachFilesRequireExactExtensionAndMime() {
  const { support } = createSupport();

  assert.strictEqual(support.isSupportedWhatsAppPdfAttachFile(file("report.pdf", "application/pdf")), true);
  assert.strictEqual(support.isSupportedWhatsAppPdfAttachFile(file("report.pdf", "application/octet-stream")), false);
  assert.strictEqual(
    support.isSupportedWhatsAppDocxAttachFile(
      file("brief.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ),
    true
  );
  assert.strictEqual(
    support.isSupportedWhatsAppXlsxAttachFile(
      file("book.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ),
    true
  );
}

function testSupportedWhatsAppDataTransfersPreserveSingleAndMultiFileLimits() {
  const { support } = createSupport();
  const supportedFiles = [
    file("one.txt", "text/plain"),
    file("two.pdf", "application/pdf"),
    file("three.png", "image/png")
  ];

  assert.strictEqual(
    support.isSingleSupportedWhatsAppFileAttach(transfer([supportedFiles[0]]), support.isSupportedWhatsAppTextDocumentAttachFile),
    true
  );
  assert.strictEqual(
    support.isSingleSupportedWhatsAppFileAttach(transfer(supportedFiles), support.isSupportedWhatsAppTextDocumentAttachFile),
    false
  );
  assert.strictEqual(support.isSupportedWhatsAppMultiFileAttach(transfer(supportedFiles)), true);
  assert.strictEqual(
    support.isSupportedWhatsAppMultiFileAttach(transfer(Array.from({ length: 20 }, (_, index) => file(`${index}.txt`, "text/plain")))),
    true
  );
  assert.strictEqual(
    support.isSupportedWhatsAppMultiFileAttach(transfer(Array.from({ length: 21 }, (_, index) => file(`${index}.txt`, "text/plain")))),
    false
  );
  assert.strictEqual(
    support.isSupportedWhatsAppMultiFileAttach(transfer([file("one.txt", "text/plain"), file("bad.bin", "application/octet-stream")])),
    false
  );
}

testSupportedWhatsAppImageAttachFilesRequirePipelineExtensionAndMime();
testSupportedWhatsAppTextDocumentFilesUseRegistryAndScanner();
testSupportedWhatsAppStructuredAttachFilesRequireExactExtensionAndMime();
testSupportedWhatsAppDataTransfersPreserveSingleAndMultiFileLimits();

console.log("PASS content file type support");
