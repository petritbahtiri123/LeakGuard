const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/diagnostics/safeSnapshots.js"));
require(path.join(repoRoot, "src/shared/fileLimits.js"));
require(path.join(repoRoot, "src/content/files/fileAttachPipeline.js"));
require(path.join(repoRoot, "src/content/files/sanitizedFileBatchProcessor.js"));

function file(name, type, extra = {}) {
  return {
    name,
    type,
    size: 256,
    ...extra
  };
}

function createProcessor(overrides = {}) {
  const calls = {
    readLocal: [],
    extraction: [],
    stream: [],
    redaction: [],
    created: [],
    debug: []
  };
  const processor = globalThis.PWM.SanitizedFileBatchProcessor.createSanitizedFileBatchProcessor({
    fileAttachPipeline: globalThis.PWM.FileAttachPipeline,
    shouldUseContentFileExtractionPipeline: () => false,
    processFileForAdapterHandoff: async ({ file, context }) => {
      calls.extraction.push({ file, context });
      return null;
    },
    localFileFromContentExtractionResult: (result) => result.localFile,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.readLocal.push(transfer);
      const sourceFile = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: "TOKEN=raw",
        file: {
          name: sourceFile.name,
          type: sourceFile.type,
          sizeBytes: sourceFile.size
        }
      };
    },
    createSingleFileDataTransfer: (sourceFile) => ({
      files: [sourceFile],
      types: ["Files"],
      items: []
    }),
    streamRedactLocalTextFile: async (sourceFile, metadata) => {
      calls.stream.push({ sourceFile, metadata });
      return {
        action: "redacted",
        sanitizedFile: file("stream.redacted.txt", "text/plain"),
        findingsCount: 1
      };
    },
    classifyLocalTextPayloadSize: () => ({
      zone: "fast",
      bytes: 256
    }),
    analyzeText: (text) => ({
      normalizedText: text,
      secretFindings: text.includes("raw") ? [{ raw: "redacted" }] : [],
      findings: []
    }),
    requestRedaction: async (text, findings) => {
      calls.redaction.push({ text, findings });
      return {
        redactedText: text.replace("raw", "[PWM_1]"),
        replacements: [{ placeholder: "[PWM_1]" }]
      };
    },
    createSanitizedTextFile: (metadata, text) => {
      const sanitizedFile = file(`${metadata.name}.redacted.txt`, "text/plain", { text });
      calls.created.push({ metadata, text, sanitizedFile });
      return sanitizedFile;
    },
    getLocalFileSafeMetadata: (sourceFile) => ({
      extension: ".txt",
      mimeCategory: String(sourceFile?.type || "").split("/")[0],
      sizeBytes: Number(sourceFile?.size || 0)
    }),
    debugFileAttachMetadata: (label, payload) => calls.debug.push({ label, payload }),
    ...overrides
  });

  return { processor, calls };
}

async function testTextFileProcessingCreatesSanitizedFile() {
  const { processor, calls } = createProcessor();
  const result = await processor.processLocalFileForSanitizedBatch(file("secrets.txt", "text/plain"), 0, "drop");

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, "sanitized");
  assert.strictEqual(result.sanitizedFile.text, "TOKEN=[PWM_1]");
  assert.strictEqual(calls.readLocal.length, 1);
  assert.strictEqual(calls.redaction.length, 1);
  assert.strictEqual(result.summary.label, "file-1");
  assert.strictEqual(result.summary.status, "sanitized");
}

async function testContentExtractionReadySkipsTextFallback() {
  const sanitizedFile = file("report.redacted.pdf", "application/pdf");
  const { processor, calls } = createProcessor({
    shouldUseContentFileExtractionPipeline: () => true,
    processFileForAdapterHandoff: async ({ file: sourceFile, context }) => {
      calls.extraction.push({ file: sourceFile, context });
      return {
        status: "ready",
        sanitizedFile,
        sanitizedText: "safe text",
        metadata: {
          scan: {
            findingsCount: 2
          }
        },
        localFile: {
          handled: true,
          ok: true,
          text: "safe text",
          file: {
            name: "report.pdf",
            type: "application/pdf",
            sizeBytes: 512
          },
          fileOnlyUpload: true
        }
      };
    }
  });

  const result = await processor.processLocalFileForSanitizedBatch(file("report.pdf", "application/pdf"), 1, "file-input");

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.sanitizedFile, sanitizedFile);
  assert.strictEqual(result.imageRedactionMode, true);
  assert.strictEqual(result.analysis.secretFindings.length, 2);
  assert.strictEqual(calls.readLocal.length, 0);
  assert.strictEqual(calls.extraction.length, 1);
}

async function testStreamingRequiredCanReturnSanitizedItem() {
  const streamedFile = file("large.redacted.txt", "text/plain");
  const { processor, calls } = createProcessor({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.readLocal.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "streaming_required",
        sourceFile: transfer.files[0],
        file: {
          name: "large.txt",
          type: "text/plain",
          sizeBytes: 5 * 1024 * 1024
        }
      };
    },
    streamRedactLocalTextFile: async (sourceFile, metadata) => {
      calls.stream.push({ sourceFile, metadata });
      return {
        action: "redacted",
        sanitizedFile: streamedFile,
        findingsCount: 3
      };
    }
  });

  const result = await processor.processLocalFileForSanitizedBatch(file("large.txt", "text/plain"), 2, "paste");

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.streamed, true);
  assert.strictEqual(result.sanitizedFile, streamedFile);
  assert.strictEqual(result.analysis.secretFindings.length, 3);
  assert.strictEqual(calls.stream.length, 1);
}

async function testBlockedLocalFileReturnsSafeSummary() {
  const { processor } = createProcessor({
    readLocalTextFileFromDataTransfer: async () => ({
      handled: true,
      ok: false,
      code: "unsupported_file_type",
      message: "blocked"
    })
  });

  const result = await processor.processLocalFileForSanitizedBatch(file("archive.zip", "application/zip"), 3, "drop");

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, "blocked");
  assert.strictEqual(result.code, "unsupported_file_type");
  assert.strictEqual(result.summary.label, "file-4");
  assert.strictEqual(result.summary.code, "unsupported_file_type");
}

async function testBatchProcessingPreservesOrder() {
  const { processor } = createProcessor();
  const results = await processor.processLocalFilesForSanitizedBatch(
    [file("one.txt", "text/plain"), file("two.txt", "text/plain")],
    "drop"
  );

  assert.deepStrictEqual(results.map((item) => item.summary.label), ["file-1", "file-2"]);
  assert.deepStrictEqual(results.map((item) => item.ok), [true, true]);
}

(async () => {
  await testTextFileProcessingCreatesSanitizedFile();
  await testContentExtractionReadySkipsTextFallback();
  await testStreamingRequiredCanReturnSanitizedItem();
  await testBlockedLocalFileReturnsSafeSummary();
  await testBatchProcessingPreservesOrder();
  console.log("PASS sanitized file batch processor");
})();
