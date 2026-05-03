import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

[
  "src/shared/placeholders.js",
  "src/shared/entropy.js",
  "src/shared/patterns.js",
  "src/shared/detector.js",
  "src/shared/ipClassification.js",
  "src/shared/ipDetection.js",
  "src/shared/networkHierarchy.js",
  "src/shared/placeholderAllocator.js",
  "src/shared/sessionMapStore.js",
  "src/shared/transformOutboundPrompt.js"
].forEach((relativePath) => {
  require(path.join(repoRoot, relativePath));
});

const { Detector, PlaceholderManager, transformOutboundPrompt } = globalThis.PWM;
const DETECTOR_PROFILE_METHODS = [
  "scanSensitiveHttpHeaders",
  "scanStructuredAssignments",
  "scanUrlCredentials",
  "scanPatterns",
  "scanAssignments",
  "scanExplicitCredentialAssignments",
  "scanAdversarialAssignments",
  "scanIdentityAssignments",
  "scanJsonIdentityFields",
  "scanUnknownPlaceholderTokens",
  "scanNaturalLanguageDisclosures",
  "scanExtraAtUriCredentialSecrets",
  "scanPlaceholderSuffixSecrets",
  "scanBarePasswordCandidates",
  "scanEntropyFallback",
  "dedupe",
  "resolveOverlaps"
];

const DEFAULT_ITERATIONS = 8;
const WARMUP_ITERATIONS = 2;
const ITERATIONS = Math.max(
  3,
  Number.parseInt(process.env.LEAKGUARD_BENCH_ITERATIONS || `${DEFAULT_ITERATIONS}`, 10)
);
const PROFILE_ENABLED = process.env.LEAKGUARD_BENCH_PROFILE === "1";

const samples = [
  {
    name: "small_safe_text",
    text: "Hello, this is a normal message with no secrets. token_limit=4096 region=eu-central-1",
    maxP95Ms: 6,
    maxMsPerKb: 35,
    forbidden: [],
    expected: ["token_limit=4096", "region=eu-central-1"]
  },
  {
    name: "small_secret_prompt",
    text: [
      "My API key is sk-test-1234567890abcdef1234567890abcdef",
      "Authorization: Bearer LeakGuardBearerToken1234567890"
    ].join("\n"),
    maxP95Ms: 8,
    maxMsPerKb: 55,
    forbidden: [
      "sk-test-1234567890abcdef1234567890abcdef",
      "LeakGuardBearerToken1234567890"
    ],
    expected: ["My API key is [PWM_"]
  },
  {
    name: "env_file_2kb",
    text: [
      "DB_USER=admin",
      "DB_PASSWORD=SuperSecret123!",
      "OPENAI_API_KEY=sk-proj-1234567890abcdef1234567890abcdef",
      "PUBLIC_URL=https://example.com",
      "PUBLIC_IP=8.8.8.8",
      "PRIVATE_IP=10.0.0.5"
    ].join("\n").repeat(16),
    maxP95Ms: 35,
    maxMsPerKb: 18,
    forbidden: [
      "SuperSecret123!",
      "sk-proj-1234567890abcdef1234567890abcdef",
      "8.8.8.8"
    ],
    expected: ["PUBLIC_URL=https://example.com", "PRIVATE_IP=10.0.0.5", "[PUB_HOST_"]
  },
  {
    name: "large_log_blob_45kb",
    text: [
      "2026-05-03 INFO normal application log line request_id=abc123",
      "Authorization: Bearer LeakGuardBearerToken_1234567890_abcdefghijklmnopqrstuvwxyz",
      "password = \"VeryBadPassword123!\"",
      "token=ghp_1234567890abcdefghijklmnopqrstuvwxyz",
      "public_ip=1.1.1.1 private_ip=192.168.1.10"
    ].join("\n").repeat(180),
    maxP95Ms: 150,
    maxMsPerKb: 18,
    assertEquivalentToBaseline: true,
    forbidden: [
      "LeakGuardBearerToken_1234567890_abcdefghijklmnopqrstuvwxyz",
      "VeryBadPassword123!",
      "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
      "1.1.1.1"
    ],
    expected: ["2026-05-03 INFO normal application log line", "private_ip=192.168.1.10"]
  }
];

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function cpuUsageMs(startUsage) {
  const usage = process.cpuUsage(startUsage);
  return (usage.user + usage.system) / 1000;
}

function heapUsedBytes() {
  return process.memoryUsage().heapUsed;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1024 * 1024) return `${sign}${(absolute / 1024 / 1024).toFixed(2)} MiB`;
  if (absolute >= 1024) return `${sign}${(absolute / 1024).toFixed(2)} KiB`;
  return `${sign}${absolute.toFixed(0)} B`;
}

function emptyStageTotals() {
  return {
    manager_ms: 0,
    detector_construct_ms: 0,
    scan_ms: 0,
    transform_ms: 0
  };
}

function emptyDetectorMethodTotals() {
  return Object.fromEntries(
    DETECTOR_PROFILE_METHODS.map((method) => [
      method,
      {
        ms: 0,
        calls: 0,
        findings: 0
      }
    ])
  );
}

function addStageTotals(target, source) {
  for (const key of Object.keys(target)) {
    target[key] += Number(source?.[key] || 0);
  }
}

function addDetectorMethodTotals(target, source) {
  for (const [method, value] of Object.entries(source || {})) {
    if (!target[method]) {
      target[method] = { ms: 0, calls: 0, findings: 0 };
    }
    target[method].ms += Number(value?.ms || 0);
    target[method].calls += Number(value?.calls || 0);
    target[method].findings += Number(value?.findings || 0);
  }
}

function wrapDetectorForProfiling(detector, totals) {
  for (const method of DETECTOR_PROFILE_METHODS) {
    const original = detector[method];
    if (typeof original !== "function") continue;

    detector[method] = function profiledDetectorMethod(...args) {
      const start = performance.now();
      const output = original.apply(this, args);
      const elapsed = performance.now() - start;
      totals[method].ms += elapsed;
      totals[method].calls += 1;
      if (Array.isArray(output)) {
        totals[method].findings += output.length;
      }
      return output;
    };
  }
}

function redactPipeline(text, options = {}) {
  const profile = Boolean(options.profile);
  const stages = profile ? emptyStageTotals() : null;
  const detectorMethods = profile ? emptyDetectorMethodTotals() : null;
  let stageStart = profile ? performance.now() : 0;
  const manager = new PlaceholderManager();

  if (profile) {
    stages.manager_ms += performance.now() - stageStart;
    stageStart = performance.now();
  }

  const detector = new Detector();
  if (profile) {
    wrapDetectorForProfiling(detector, detectorMethods);
  }

  if (profile) {
    stages.detector_construct_ms += performance.now() - stageStart;
    stageStart = performance.now();
  }

  const findings = detector.scan(text, {
    manager,
    disableRepeatedLineCache: Boolean(options.disableRepeatedLineCache)
  });

  if (profile) {
    stages.scan_ms += performance.now() - stageStart;
    stageStart = performance.now();
  }

  const transformed = transformOutboundPrompt(text, {
    manager,
    findings,
    mode: "hide_public"
  });

  if (profile) {
    stages.transform_ms += performance.now() - stageStart;
  }

  return {
    findings,
    ...transformed,
    stages,
    detectorMethods
  };
}

function assertCorrectness(sample, output) {
  const redactedText = String(output.redactedText || "");

  for (const raw of sample.forbidden) {
    assert.equal(redactedText.includes(raw), false, `${sample.name}: raw value survived: ${raw}`);
  }

  for (const expected of sample.expected) {
    assert.ok(redactedText.includes(expected), `${sample.name}: expected output fragment: ${expected}`);
  }
}

function assertEquivalentToBaseline(sample) {
  if (!sample.assertEquivalentToBaseline) return;

  const optimized = redactPipeline(sample.text);
  const baseline = redactPipeline(sample.text, {
    disableRepeatedLineCache: true
  });

  assert.equal(
    optimized.redactedText,
    baseline.redactedText,
    `${sample.name}: repeated-line fast path changed redacted output`
  );
  assert.equal(
    optimized.findings.length,
    baseline.findings.length,
    `${sample.name}: repeated-line fast path changed replacement count`
  );
}

function benchmark(sample) {
  let lastOutput = null;
  assertEquivalentToBaseline(sample);

  for (let index = 0; index < WARMUP_ITERATIONS; index += 1) {
    lastOutput = redactPipeline(sample.text, { profile: PROFILE_ENABLED });
  }
  assertCorrectness(sample, lastOutput);

  const wallTimes = [];
  const cpuTimes = [];
  const heapDeltas = [];
  const stageTotals = emptyStageTotals();
  const detectorMethodTotals = emptyDetectorMethodTotals();

  for (let index = 0; index < ITERATIONS; index += 1) {
    const heapBefore = heapUsedBytes();
    const cpuBefore = process.cpuUsage();
    const wallStart = performance.now();

    lastOutput = redactPipeline(sample.text, { profile: PROFILE_ENABLED });

    wallTimes.push(performance.now() - wallStart);
    cpuTimes.push(cpuUsageMs(cpuBefore));
    heapDeltas.push(heapUsedBytes() - heapBefore);
    if (PROFILE_ENABLED) {
      addStageTotals(stageTotals, lastOutput.stages);
      addDetectorMethodTotals(detectorMethodTotals, lastOutput.detectorMethods);
    }
  }
  assertCorrectness(sample, lastOutput);

  const chars = sample.text.length;
  const kib = Math.max(chars / 1024, 0.001);
  const avgMs = mean(wallTimes);
  const p95Ms = percentile(wallTimes, 95);
  const msPerKb = avgMs / kib;
  const heapPositiveDeltas = heapDeltas.filter((value) => value > 0);
  const avgHeapDelta = mean(heapDeltas);
  const avgHeapGrowth = heapPositiveDeltas.length ? mean(heapPositiveDeltas) : 0;

  assert.ok(
    p95Ms <= sample.maxP95Ms,
    `${sample.name}: p95 ${p95Ms.toFixed(3)}ms exceeded ${sample.maxP95Ms}ms`
  );
  assert.ok(
    msPerKb <= sample.maxMsPerKb,
    `${sample.name}: avg ${msPerKb.toFixed(3)}ms/KiB exceeded ${sample.maxMsPerKb}ms/KiB`
  );

  return {
    test: sample.name,
    chars,
    iterations: ITERATIONS,
    findings: lastOutput.findings.length,
    avg_wall_ms: avgMs,
    p50_wall_ms: percentile(wallTimes, 50),
    p95_wall_ms: p95Ms,
    p99_wall_ms: percentile(wallTimes, 99),
    max_wall_ms: Math.max(...wallTimes),
    avg_cpu_ms: mean(cpuTimes),
    p50_cpu_ms: percentile(cpuTimes, 50),
    p95_cpu_ms: percentile(cpuTimes, 95),
    p99_cpu_ms: percentile(cpuTimes, 99),
    avg_heap_delta_bytes: avgHeapDelta,
    avg_heap_growth_bytes: avgHeapGrowth,
    max_heap_delta_bytes: Math.max(...heapDeltas),
    avg_ms_per_kib: msPerKb,
    stage_avg_ms: Object.fromEntries(
      Object.entries(stageTotals).map(([key, value]) => [key, PROFILE_ENABLED ? value / ITERATIONS : 0])
    ),
    detector_method_avg_ms: Object.fromEntries(
      Object.entries(detectorMethodTotals).map(([key, value]) => [
        key,
        {
          ms: PROFILE_ENABLED ? value.ms / ITERATIONS : 0,
          calls: PROFILE_ENABLED ? value.calls / ITERATIONS : 0,
          findings: PROFILE_ENABLED ? value.findings / ITERATIONS : 0
        }
      ])
    )
  };
}

const results = samples.map(benchmark);

console.table(
  results.map((result) => ({
    test: result.test,
    chars: result.chars,
    findings: result.findings,
    avg_wall_ms: result.avg_wall_ms.toFixed(3),
    avg_cpu_ms: result.avg_cpu_ms.toFixed(3),
    p50_wall_ms: result.p50_wall_ms.toFixed(3),
    p95_wall_ms: result.p95_wall_ms.toFixed(3),
    p99_wall_ms: result.p99_wall_ms.toFixed(3),
    p50_cpu_ms: result.p50_cpu_ms.toFixed(3),
    p95_cpu_ms: result.p95_cpu_ms.toFixed(3),
    p99_cpu_ms: result.p99_cpu_ms.toFixed(3),
    max_ms: result.max_wall_ms.toFixed(3),
    avg_heap_delta: formatBytes(result.avg_heap_delta_bytes),
    avg_heap_growth: formatBytes(result.avg_heap_growth_bytes),
    max_heap_delta: formatBytes(result.max_heap_delta_bytes),
    avg_ms_per_kib: result.avg_ms_per_kib.toFixed(3)
  }))
);

if (PROFILE_ENABLED) {
  console.table(
    results.map((result) => ({
      test: result.test,
      manager_ms: result.stage_avg_ms.manager_ms.toFixed(3),
      detector_construct_ms: result.stage_avg_ms.detector_construct_ms.toFixed(3),
      scan_ms: result.stage_avg_ms.scan_ms.toFixed(3),
      transform_ms: result.stage_avg_ms.transform_ms.toFixed(3)
    }))
  );
  for (const result of results) {
    console.log(`Detector method profile: ${result.test}`);
    console.table(
      Object.entries(result.detector_method_avg_ms)
        .map(([method, value]) => ({
          method,
          avg_ms: value.ms.toFixed(3),
          avg_calls: value.calls.toFixed(1),
          avg_findings: value.findings.toFixed(1)
        }))
        .filter((row) => Number(row.avg_calls) > 0)
        .sort((left, right) => Number(right.avg_ms) - Number(left.avg_ms))
    );
  }
}

console.log("PASS redaction performance benchmark");
