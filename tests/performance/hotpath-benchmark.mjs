import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

[
  "src/shared/placeholders.js",
  "src/shared/entropy.js",
  "src/shared/patterns.js",
  "src/shared/detection/urlUserinfo.js",
  "src/shared/detector.js",
  "src/shared/ipClassification.js",
  "src/shared/ipDetection.js",
  "src/shared/networkHierarchy.js",
  "src/shared/placeholderAllocator.js",
  "src/shared/sessionMapStore.js",
  "src/shared/knownSecretReuse.js",
  "src/shared/transformOutboundPrompt.js",
  "src/shared/fileLimits.js",
  "src/shared/fileTypeRegistry.js",
  "src/shared/fileExtractors.js",
  "src/shared/fileScanner.js",
  "src/content/file_paste_helpers.js",
  "src/content/files/fileExtractionSessionCache.js",
  "src/content/files/contentFileExtractionPipeline.js",
  "src/content/files/fileInputChangeOrchestration.js"
].forEach((relativePath) => {
  require(path.join(repoRoot, relativePath));
});

const {
  ContentFileExtractionPipeline,
  Detector,
  FileExtractionSessionCache,
  FileInputChangeOrchestration,
  PlaceholderManager,
  transformOutboundPrompt
} = globalThis.PWM;

const RAW_SECRET = "sk-proj-HotpathBenchmarkSecret1234567890abcdef";
const RAW_PASSWORD = "HotpathBenchmarkPassword123!";
const DEFAULT_ITERATIONS = 7;
const WARMUP_ITERATIONS = 2;
const ITERATIONS = Math.max(
  3,
  Number.parseInt(process.env.LEAKGUARD_HOTPATH_BENCH_ITERATIONS || `${DEFAULT_ITERATIONS}`, 10)
);

class TestFile {
  constructor(parts, name, options = {}) {
    this.parts = parts.map((part) => Buffer.from(String(part), "utf8"));
    this.name = name;
    this.type = options.type || "text/plain";
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

function buildEnvPayload(repeats) {
  return `${[
    "DB_USER=admin",
    `DB_PASSWORD=${RAW_PASSWORD}`,
    `OPENAI_API_KEY=${RAW_SECRET}`,
    "PUBLIC_IP=8.8.8.8",
    "PRIVATE_IP=10.0.0.5",
    "REGION=eu-central-1",
    "TOKEN_LIMIT=4096"
  ].join("\n")}\n`.repeat(repeats);
}

function buildSafeLogPayload(repeats) {
  return "2026-07-07 INFO request_id=req-01HV7M7A2B3C4D5E6F7G8H9J0K region=eu-central-1 token_limit=4096\n"
    .repeat(repeats);
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function cpuUsageMs(startUsage) {
  const usage = process.cpuUsage(startUsage);
  return (usage.user + usage.system) / 1000;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1024 * 1024) return `${sign}${(absolute / 1024 / 1024).toFixed(2)} MiB`;
  if (absolute >= 1024) return `${sign}${(absolute / 1024).toFixed(2)} KiB`;
  return `${sign}${absolute.toFixed(0)} B`;
}

function redactPrompt(text) {
  const manager = new PlaceholderManager();
  const detector = new Detector();
  const scanStart = performance.now();
  const findings = detector.scan(text, { manager });
  const scanMs = performance.now() - scanStart;
  const transformStart = performance.now();
  const result = transformOutboundPrompt(text, {
    manager,
    findings,
    mode: "hide_public"
  });
  const transformMs = performance.now() - transformStart;
  return {
    findings,
    redactedText: result.redactedText,
    stageMs: {
      scan: scanMs,
      transform: transformMs
    }
  };
}

async function processTextFile(text) {
  FileExtractionSessionCache.clear();
  const file = new TestFile([text], "hotpath.env", { type: "text/plain" });
  const result = await ContentFileExtractionPipeline.processFileForAdapterHandoff({
    file,
    context: "hotpath-benchmark"
  });
  return {
    findings: new Array(Number(result?.metadata?.scan?.findingsCount || 0)),
    redactedText: result?.sanitizedText || "",
    status: result?.status || "",
    safeForUpload: result?.safeForUpload === true
  };
}

function createFileInputEvent(target, type) {
  return {
    type,
    target,
    defaultPrevented: false,
    stopPropagation() {},
    stopImmediatePropagation() {},
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
}

function createFileInputHarness(eventType) {
  const sourceFile = { name: "hotpath.env", type: "text/plain", size: 2048 };
  const fileInput = {
    tagName: "INPUT",
    type: "file",
    files: [sourceFile]
  };
  const selectedTransfer = {
    files: [sourceFile],
    types: ["Files"],
    items: []
  };
  const fileInputProcessingSignatures = new WeakMap();
  const orchestration = FileInputChangeOrchestration.createFileInputChangeOrchestration({
    contentDebugEvents: {
      FILE_HANDOFF_PENDING_DUPLICATE_SUPPRESSED: "file-input:duplicate-suppressed"
    },
    dateNow: () => 1000,
    describeFileInputForDebug: () => ({ kind: "benchmark" }),
    fileInputProcessingSignatures,
    findComposer: () => ({ tagName: "TEXTAREA" }),
    getCurrentHandoffDriverId: () => "chatgpt",
    getFileInputInterception: () => ({
      shouldHandleFileInputChange: () => true,
      createSelectedTransfer: () => selectedTransfer,
      hasSelectedFiles: (files) => Array.from(files || []).length > 0,
      shouldContinueWithoutComposer: () => true
    }),
    getFileListMetadataSignature: (files) =>
      Array.from(files || []).map((file) => `${file.name}:${file.type}:${file.size}`).join("|"),
    isExtensionRuntimeAvailable: () => true,
    maybeHandleLocalFileInsert: async () => ({ handled: true, ok: true }),
    resolveLocalFileTransferPolicy: () => ({ action: "redact" }),
    shouldUseContentFileExtractionPipeline: () => true
  });

  return {
    run: () => orchestration.maybeHandleFileInputChange(createFileInputEvent(fileInput, eventType))
  };
}

function assertOutputSafe(sample, output) {
  const redactedText = String(output?.redactedText || "");
  if (sample.expectRedaction) {
    assert.equal(redactedText.includes(RAW_SECRET), false, `${sample.name} leaked raw token`);
    assert.equal(redactedText.includes(RAW_PASSWORD), false, `${sample.name} leaked raw password`);
    assert.match(redactedText, /\[PWM_\d+\]/, `${sample.name} should contain placeholders`);
  }
  if (sample.expectReady) {
    assert.equal(output.status, "ready", `${sample.name} should produce a ready file handoff`);
    assert.equal(output.safeForUpload, true, `${sample.name} should be safe for upload`);
  }
}

async function measureSample(sample) {
  let lastOutput = null;
  for (let index = 0; index < WARMUP_ITERATIONS; index += 1) {
    lastOutput = await sample.run();
  }
  assertOutputSafe(sample, lastOutput);

  const wallTimes = [];
  const cpuTimes = [];
  const heapDeltas = [];
  const stageTotals = {};

  for (let index = 0; index < ITERATIONS; index += 1) {
    const heapBefore = process.memoryUsage().heapUsed;
    const cpuBefore = process.cpuUsage();
    const wallStart = performance.now();
    lastOutput = await sample.run();
    const wallMs = performance.now() - wallStart;
    wallTimes.push(wallMs);
    cpuTimes.push(cpuUsageMs(cpuBefore));
    heapDeltas.push(process.memoryUsage().heapUsed - heapBefore);
    for (const [stage, value] of Object.entries(lastOutput?.stageMs || {})) {
      stageTotals[stage] = (stageTotals[stage] || 0) + Number(value || 0);
    }
  }

  assertOutputSafe(sample, lastOutput);
  const inputBytes = Number(sample.inputBytes || 0);
  const inputKiB = inputBytes > 0 ? inputBytes / 1024 : null;
  return {
    hot_path: sample.name,
    category: sample.category,
    input_bytes: sample.inputBytes,
    iterations: ITERATIONS,
    findings: Number(lastOutput?.findings?.length || 0),
    avg_wall_ms: mean(wallTimes),
    p50_wall_ms: percentile(wallTimes, 50),
    p95_wall_ms: percentile(wallTimes, 95),
    max_wall_ms: Math.max(...wallTimes),
    avg_cpu_ms: mean(cpuTimes),
    avg_heap_delta_bytes: mean(heapDeltas),
    avg_ms_per_kib: inputKiB ? mean(wallTimes) / inputKiB : null,
    stage_avg_ms: Object.fromEntries(
      Object.entries(stageTotals).map(([stage, value]) => [stage, value / ITERATIONS])
    )
  };
}

function formatRows(results) {
  return results.map((result) => ({
    hot_path: result.hot_path,
    category: result.category,
    input_bytes: result.input_bytes,
    iterations: result.iterations,
    findings: result.findings,
    avg_wall_ms: result.avg_wall_ms.toFixed(3),
    p50_wall_ms: result.p50_wall_ms.toFixed(3),
    p95_wall_ms: result.p95_wall_ms.toFixed(3),
    max_wall_ms: result.max_wall_ms.toFixed(3),
    avg_cpu_ms: result.avg_cpu_ms.toFixed(3),
    avg_heap_delta: formatBytes(result.avg_heap_delta_bytes),
    avg_ms_per_kib: Number.isFinite(result.avg_ms_per_kib) ? result.avg_ms_per_kib.toFixed(3) : "",
    scan_ms: result.stage_avg_ms.scan?.toFixed(3) || "",
    transform_ms: result.stage_avg_ms.transform?.toFixed(3) || ""
  }));
}

function makeSamples() {
  const smallSecret = `Please redact OPENAI_API_KEY=${RAW_SECRET} and DB_PASSWORD=${RAW_PASSWORD}`;
  const safeLog = buildSafeLogPayload(1200);
  const envText = buildEnvPayload(48);
  const largeEnvText = buildEnvPayload(900);
  return [
    {
      name: "detector_transform_small_secret",
      category: "detector",
      inputBytes: Buffer.byteLength(smallSecret),
      expectRedaction: true,
      run: () => redactPrompt(smallSecret)
    },
    {
      name: "detector_transform_safe_log_120kb",
      category: "detector",
      inputBytes: Buffer.byteLength(safeLog),
      run: () => redactPrompt(safeLog)
    },
    {
      name: "detector_transform_env_100kb",
      category: "detector",
      inputBytes: Buffer.byteLength(largeEnvText),
      expectRedaction: true,
      run: () => redactPrompt(largeEnvText)
    },
    {
      name: "file_handoff_env_text",
      category: "file-handoff",
      inputBytes: Buffer.byteLength(envText),
      expectRedaction: true,
      expectReady: true,
      run: () => processTextFile(envText)
    },
    {
      name: "file_input_raw_input_suppression",
      category: "file-input",
      inputBytes: 0,
      run: createFileInputHarness("input").run
    },
    {
      name: "file_input_change_stub_handoff",
      category: "file-input",
      inputBytes: 0,
      run: createFileInputHarness("change").run
    }
  ];
}

async function runBenchmarkSuite() {
  const results = [];
  for (const sample of makeSamples()) {
    results.push(await measureSample(sample));
  }
  const rows = formatRows(results);
  const serializedRows = JSON.stringify(rows);
  assert.equal(serializedRows.includes(RAW_SECRET), false, "hotpath benchmark table leaked raw token");
  assert.equal(serializedRows.includes(RAW_PASSWORD), false, "hotpath benchmark table leaked raw password");
  console.table(rows);
  console.log("PASS hotpath performance benchmark");
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBenchmarkSuite().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  formatRows,
  makeSamples,
  measureSample,
  runBenchmarkSuite
};
