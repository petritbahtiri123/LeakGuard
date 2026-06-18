import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

[
  "src/shared/entropy.js",
  "src/shared/patterns.js",
  "src/shared/detection/urlUserinfo.js",
  "src/shared/detector.js",
  "src/shared/placeholders.js",
  "src/shared/sessionMapStore.js",
  "src/shared/ipClassification.js",
  "src/shared/ipDetection.js",
  "src/shared/networkHierarchy.js",
  "src/shared/placeholderAllocator.js",
  "src/shared/knownSecretReuse.js",
  "src/shared/transformOutboundPrompt.js",
  "src/shared/fileLimits.js",
  "src/shared/fileTypeRegistry.js",
  "src/shared/fileExtractors.js",
  "src/shared/fileScanner.js",
  "src/content/file_paste_helpers.js",
  "src/content/files/fileExtractionSessionCache.js",
  "src/content/files/contentFileExtractionPipeline.js"
].forEach((relativePath) => {
  require(path.join(repoRoot, relativePath));
});

const { processFileForAdapterHandoff } = globalThis.PWM.ContentFileExtractionPipeline;
const ExtractionCache = globalThis.PWM.FileExtractionSessionCache;

const RAW_SECRET = "sk-proj-FileExtractionBenchmarkSecret1234567890abcdef";
const RAW_PASSWORD = "FileExtractionBenchmarkPassword123!";
const DEFAULT_ITERATIONS = 6;
const WARMUP_ITERATIONS = 1;
const ITERATIONS = Math.max(
  3,
  Number.parseInt(process.env.LEAKGUARD_FILE_BENCH_ITERATIONS || `${DEFAULT_ITERATIONS}`, 10)
);

class TestFile {
  constructor(parts, name, options = {}) {
    this.parts = parts.map((part) => {
      if (part instanceof ArrayBuffer) return Buffer.from(part);
      if (ArrayBuffer.isView(part)) return Buffer.from(part.buffer, part.byteOffset, part.byteLength);
      return Buffer.from(String(part), "utf8");
    });
    this.name = name;
    this.type = options.type || "";
    this.lastModified = options.lastModified || 1234;
    this.size = this.parts.reduce((total, part) => total + part.length, 0);
  }

  async arrayBuffer() {
    const buffer = Buffer.concat(this.parts);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  async text() {
    return Buffer.concat(this.parts).toString("utf8");
  }
}

globalThis.File = TestFile;

function bufferFromText(text) {
  return new TextEncoder().encode(text).buffer;
}

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function makePdf(text, options = {}) {
  if (options.malformed) return bufferFromText(`not a pdf ${RAW_SECRET}`);
  const streamText = options.imageOnly
    ? "q\n10 0 0 10 0 0 cm\n/Im1 Do\nQ\n"
    : `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\n`;
  const stream = options.flate ? zlib.deflateSync(Buffer.from(streamText, "binary")) : streamText;
  const streamHeader = options.flate
    ? `<< /Length ${stream.length} /Filter /FlateDecode >>`
    : `<< /Length ${stream.length} >>`;
  const parts = [
    "%PDF-1.4",
    "1 0 obj",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "endobj",
    "2 0 obj",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "endobj",
    "3 0 obj",
    "<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>",
    "endobj",
    "4 0 obj",
    streamHeader,
    "stream",
    stream,
    "endstream",
    "endobj",
    "trailer",
    "<< /Root 1 0 R >>",
    "%%EOF"
  ];
  const buffer = Buffer.concat(parts.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(`${part}\n`, "binary")));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function writeUInt32LE(buffer, value, offset) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function makeZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(String(entry.data || ""), "utf8");
    const compressed = zlib.deflateRawSync(raw);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    writeUInt32LE(header, 0, 14);
    writeUInt32LE(header, compressed.length, 18);
    writeUInt32LE(header, raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, name, compressed);
  }
  const buffer = Buffer.concat(chunks);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeDocx(text) {
  return makeZip([
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`
    }
  ]);
}

function makeXlsx(text) {
  return makeZip([
    {
      name: "xl/workbook.xml",
      data: '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Secrets" sheetId="1"/></sheets></workbook>'
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c></row></sheetData></worksheet>`
    }
  ]);
}

function fileFromBuffer(name, type, buffer, lastModified = 1234) {
  return new TestFile([buffer], name, { type, lastModified });
}

function buildEnvText(lineCount = 30) {
  return `${[
    "DB_USER=admin",
    `DB_PASSWORD=${RAW_PASSWORD}`,
    `OPENAI_API_KEY=${RAW_SECRET}`,
    "PUBLIC_IP=8.8.8.8",
    "PRIVATE_IP=10.0.0.5",
    "REGION=eu-central-1"
  ].join("\n")}\n`.repeat(lineCount);
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute < 1024) return `${sign}${absolute.toFixed(0)} B`;
  if (absolute < 1024 * 1024) return `${sign}${(absolute / 1024).toFixed(2)} KiB`;
  return `${sign}${(absolute / (1024 * 1024)).toFixed(2)} MiB`;
}

function getBudget(sample) {
  if (sample.budgetP95Ms) return sample.budgetP95Ms;
  if (sample.expectedCacheStatus === "hit") return 25;
  if (sample.fileType === "text_small") return 25;
  if (sample.fileType === "text_env") return 75;
  if (sample.fileType === "image_metadata") return 50;
  if (sample.safeFailure) return 150;
  return 250;
}

function getCacheStatus(result, sample) {
  if (sample.cacheMode === "disabled") return "disabled";
  return result?.metadata?.cache?.status || "disabled";
}

function assertResultSafe(sample, result) {
  const serialized = JSON.stringify({
    sample: sample.name,
    metadata: result?.metadata,
    warnings: result?.warnings,
    outputName: result?.outputName,
    fallbackReason: result?.fallbackReason
  });
  assert.equal(serialized.includes(RAW_SECRET), false, `${sample.name} metadata output leaked raw token`);
  assert.equal(serialized.includes(RAW_PASSWORD), false, `${sample.name} metadata output leaked raw password`);
  assert.equal(serialized.includes("secret-filename"), false, `${sample.name} metadata output leaked raw filename`);
}

async function runOneIteration(sample, index) {
  if (sample.cacheMode !== "hit") ExtractionCache.clear();
  const file = sample.createFile(index);
  if (sample.cacheMode === "hit") {
    ExtractionCache.clear();
    await processFileForAdapterHandoff({ file, context: "benchmark" });
  }
  const heapBefore = process.memoryUsage?.().heapUsed || 0;
  const started = performance.now();
  const result = await processFileForAdapterHandoff({ file, context: "benchmark" });
  const elapsed = performance.now() - started;
  const heapAfter = process.memoryUsage?.().heapUsed || heapBefore;
  assertResultSafe(sample, result);
  return {
    elapsed,
    heapDelta: heapAfter - heapBefore,
    result,
    inputSize: file.size
  };
}

async function measureSample(sample) {
  for (let index = 0; index < WARMUP_ITERATIONS; index += 1) {
    await runOneIteration(sample, index);
  }
  const timings = [];
  const heapDeltas = [];
  let lastResult = null;
  let inputSize = 0;
  for (let index = 0; index < ITERATIONS; index += 1) {
    const measurement = await runOneIteration(sample, index + WARMUP_ITERATIONS);
    timings.push(measurement.elapsed);
    heapDeltas.push(measurement.heapDelta);
    lastResult = measurement.result;
    inputSize = measurement.inputSize;
  }
  const extractedTextLength = Number(
    lastResult?.metadata?.extraction?.textLength || lastResult?.sanitizedText?.length || 0
  );
  const findingsCount = Number(lastResult?.metadata?.scan?.findingsCount || 0);
  const avgWallMs = timings.reduce((sum, value) => sum + value, 0) / timings.length;
  const avgHeapDelta = heapDeltas.reduce((sum, value) => sum + value, 0) / heapDeltas.length;
  const inputKiB = Math.max(1, inputSize / 1024);
  return {
    test: sample.name,
    file_type: sample.fileType,
    input_size_bytes: inputSize,
    input_size_bucket: sample.sizeBucket,
    extracted_text_length: extractedTextLength,
    findings_count: findingsCount,
    cache_status: getCacheStatus(lastResult, sample),
    iterations: ITERATIONS,
    avg_wall_ms: avgWallMs,
    p50_wall_ms: percentile(timings, 50),
    p95_wall_ms: percentile(timings, 95),
    p99_wall_ms: percentile(timings, 99),
    max_wall_ms: Math.max(...timings),
    avg_heap_delta_bytes: avgHeapDelta,
    avg_ms_per_kib: avgWallMs / inputKiB,
    budget_p95_ms: getBudget(sample),
    safe_failure: sample.safeFailure === true
  };
}

function getPerformanceFailure(result) {
  if (result.p95_wall_ms > result.budget_p95_ms) {
    return `${result.test}: p95 ${result.p95_wall_ms.toFixed(3)}ms exceeded ${result.budget_p95_ms}ms`;
  }
  return null;
}

function shouldRetryTimingSpike(result) {
  return (
    result.p95_wall_ms > result.budget_p95_ms &&
    result.p50_wall_ms <= result.budget_p95_ms &&
    result.avg_wall_ms <= result.budget_p95_ms * 1.25
  );
}

async function benchmark(sample) {
  const firstResult = await measureSample(sample);
  const firstFailure = getPerformanceFailure(firstResult);
  if (!firstFailure) return firstResult;
  if (shouldRetryTimingSpike(firstResult)) {
    console.warn(`${sample.name}: timing spike detected; rerunning once before failing. ${firstFailure}`);
    const retryResult = await measureSample(sample);
    const retryFailure = getPerformanceFailure(retryResult);
    if (!retryFailure) return { ...retryResult, retried_timing_spike: true };
    assert.fail(`${retryFailure}; first run also failed with ${firstFailure}`);
  }
  assert.fail(firstFailure);
}

function makeSamples() {
  const smallText = `hello\nOPENAI_API_KEY=${RAW_SECRET}\n`;
  const envText = buildEnvText(32);
  const largeText = buildEnvText(384);
  const largeDocumentText = buildEnvText(192);
  const documentText = `Document token ${RAW_SECRET} and password ${RAW_PASSWORD}`;
  return [
    {
      name: "small_text_file",
      fileType: "text_small",
      sizeBucket: "lt_1kb",
      createFile: () => new TestFile([smallText], "small.env", { type: "text/plain" })
    },
    {
      name: "env_many_secrets",
      fileType: "text_env",
      sizeBucket: "2_10kb",
      createFile: () => new TestFile([envText], "service.env", { type: "text/plain" })
    },
    {
      name: "large_text_env_phase17d",
      fileType: "text_large",
      sizeBucket: "100_500kb",
      budgetP95Ms: 1500,
      createFile: () => new TestFile([largeText], "phase17d-large.env", { type: "text/plain" })
    },
    {
      name: "text_pdf",
      fileType: "pdf",
      sizeBucket: "lt_10kb",
      createFile: () => fileFromBuffer("report.pdf", "application/pdf", makePdf(documentText))
    },
    {
      name: "compressed_text_pdf",
      fileType: "pdf_compressed",
      sizeBucket: "lt_10kb",
      createFile: () => fileFromBuffer("report-compressed.pdf", "application/pdf", makePdf(documentText, { flate: true }))
    },
    {
      name: "large_text_pdf_phase17d",
      fileType: "pdf_large",
      sizeBucket: "100_500kb",
      budgetP95Ms: 1500,
      createFile: () => fileFromBuffer("phase17d-large.pdf", "application/pdf", makePdf(largeDocumentText))
    },
    {
      name: "docx_text",
      fileType: "docx",
      sizeBucket: "lt_10kb",
      createFile: () =>
        fileFromBuffer(
          "brief.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          makeDocx(documentText)
        )
    },
    {
      name: "large_docx_phase17d",
      fileType: "docx_large",
      sizeBucket: "100_500kb",
      budgetP95Ms: 1500,
      createFile: () =>
        fileFromBuffer(
          "phase17d-large.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          makeDocx(largeDocumentText)
        )
    },
    {
      name: "xlsx_text",
      fileType: "xlsx",
      sizeBucket: "lt_10kb",
      createFile: () =>
        fileFromBuffer(
          "sheet.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          makeXlsx(documentText)
        )
    },
    {
      name: "large_xlsx_phase17d",
      fileType: "xlsx_large",
      sizeBucket: "100_500kb",
      budgetP95Ms: 1500,
      createFile: () =>
        fileFromBuffer(
          "phase17d-large.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          makeXlsx(largeDocumentText)
        )
    },
    {
      name: "image_metadata",
      fileType: "image_metadata",
      sizeBucket: "lt_1kb",
      createFile: () =>
        fileFromBuffer(`diagram-secret-filename-${RAW_SECRET}.png`, "image/png", bufferFromText("png bytes"))
    },
    {
      name: "large_image_metadata_phase17d",
      fileType: "image_metadata_large",
      sizeBucket: "gt_1mb",
      budgetP95Ms: 75,
      createFile: () =>
        fileFromBuffer(
          `phase17d-image-secret-filename-${RAW_SECRET}.webp`,
          "image/webp",
          new Uint8Array(2 * 1024 * 1024).fill(0x61)
        )
    },
    {
      name: "scanned_pdf_failure",
      fileType: "pdf_image_only",
      sizeBucket: "lt_10kb",
      safeFailure: true,
      createFile: () => fileFromBuffer("scan.pdf", "application/pdf", makePdf("", { imageOnly: true }))
    },
    {
      name: "malformed_pdf_failure",
      fileType: "pdf_malformed",
      sizeBucket: "lt_1kb",
      safeFailure: true,
      createFile: () => fileFromBuffer("malformed.pdf", "application/pdf", makePdf("", { malformed: true }))
    },
    {
      name: "malformed_docx_failure",
      fileType: "docx_malformed",
      sizeBucket: "lt_1kb",
      safeFailure: true,
      createFile: () =>
        fileFromBuffer(
          "malformed.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bufferFromText(`not a docx ${RAW_SECRET}`)
        )
    },
    {
      name: "malformed_xlsx_failure",
      fileType: "xlsx_malformed",
      sizeBucket: "lt_1kb",
      safeFailure: true,
      createFile: () =>
        fileFromBuffer(
          "malformed.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          bufferFromText(`not an xlsx ${RAW_SECRET}`)
        )
    },
    {
      name: "cache_miss_pdf",
      fileType: "pdf_cache_miss",
      sizeBucket: "lt_10kb",
      expectedCacheStatus: "miss",
      createFile: () => fileFromBuffer("cache-miss.pdf", "application/pdf", makePdf(documentText), 7777)
    },
    {
      name: "cache_hit_pdf",
      fileType: "pdf_cache_hit",
      sizeBucket: "lt_10kb",
      cacheMode: "hit",
      expectedCacheStatus: "hit",
      createFile: () => fileFromBuffer("cache-hit.pdf", "application/pdf", makePdf(documentText), 8888)
    }
  ];
}

function printResults(results) {
  const rows = results.map((result) => ({
    test: result.test,
    file_type: result.file_type,
    input_size: result.input_size_bytes,
    size_bucket: result.input_size_bucket,
    extracted_len: result.extracted_text_length,
    findings: result.findings_count,
    cache: result.cache_status,
    avg_wall_ms: result.avg_wall_ms.toFixed(3),
    p50_wall_ms: result.p50_wall_ms.toFixed(3),
    p95_wall_ms: result.p95_wall_ms.toFixed(3),
    p99_wall_ms: result.p99_wall_ms.toFixed(3),
    max_wall_ms: result.max_wall_ms.toFixed(3),
    avg_heap_delta: formatBytes(result.avg_heap_delta_bytes),
    avg_ms_per_kib: result.avg_ms_per_kib.toFixed(3),
    budget_p95_ms: result.budget_p95_ms,
    retried: result.retried_timing_spike ? "yes" : ""
  }));
  const serializedRows = JSON.stringify(rows);
  assert.equal(serializedRows.includes(RAW_SECRET), false, "benchmark table leaked raw token");
  assert.equal(serializedRows.includes(RAW_PASSWORD), false, "benchmark table leaked raw password");
  assert.equal(serializedRows.includes("secret-filename"), false, "benchmark table leaked raw filename");
  console.table(rows);
}

async function runBenchmarkSuite() {
  ExtractionCache.clear();
  const results = [];
  for (const sample of makeSamples()) {
    results.push(await benchmark(sample));
  }
  printResults(results);
  console.log("PASS file extraction pipeline performance benchmark");
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBenchmarkSuite().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  benchmark,
  getPerformanceFailure,
  measureSample,
  runBenchmarkSuite,
  shouldRetryTimingSpike
};
