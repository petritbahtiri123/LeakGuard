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

const DEFAULT_ITERATIONS = 8;
const WARMUP_ITERATIONS = 2;
const ITERATIONS = Math.max(
  3,
  Number.parseInt(process.env.LEAKGUARD_BENCH_ITERATIONS || `${DEFAULT_ITERATIONS}`, 10)
);

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
    name: "large_log_blob_90kb",
    text: [
      "2026-05-03 INFO normal application log line request_id=abc123",
      "Authorization: Bearer LeakGuardBearerToken_1234567890_abcdefghijklmnopqrstuvwxyz",
      "password = \"VeryBadPassword123!\"",
      "token=ghp_1234567890abcdefghijklmnopqrstuvwxyz",
      "public_ip=1.1.1.1 private_ip=192.168.1.10"
    ].join("\n").repeat(360),
    maxP95Ms: 800,
    maxMsPerKb: 9,
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

function redactPipeline(text) {
  const manager = new PlaceholderManager();
  const detector = new Detector();
  const findings = detector.scan(text, { manager });
  return {
    findings,
    ...transformOutboundPrompt(text, {
      manager,
      findings,
      mode: "hide_public"
    })
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

function benchmark(sample) {
  let lastOutput = null;

  for (let index = 0; index < WARMUP_ITERATIONS; index += 1) {
    lastOutput = redactPipeline(sample.text);
  }
  assertCorrectness(sample, lastOutput);

  const times = [];
  for (let index = 0; index < ITERATIONS; index += 1) {
    const start = performance.now();
    lastOutput = redactPipeline(sample.text);
    times.push(performance.now() - start);
  }
  assertCorrectness(sample, lastOutput);

  const chars = sample.text.length;
  const kib = Math.max(chars / 1024, 0.001);
  const avgMs = mean(times);
  const p95Ms = percentile(times, 95);
  const msPerKb = avgMs / kib;

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
    avg_ms: avgMs,
    p50_ms: percentile(times, 50),
    p95_ms: p95Ms,
    p99_ms: percentile(times, 99),
    max_ms: Math.max(...times),
    avg_ms_per_kib: msPerKb
  };
}

const results = samples.map(benchmark);

console.table(
  results.map((result) => ({
    test: result.test,
    chars: result.chars,
    findings: result.findings,
    avg_ms: result.avg_ms.toFixed(3),
    p50_ms: result.p50_ms.toFixed(3),
    p95_ms: result.p95_ms.toFixed(3),
    p99_ms: result.p99_ms.toFixed(3),
    max_ms: result.max_ms.toFixed(3),
    avg_ms_per_kib: result.avg_ms_per_kib.toFixed(3)
  }))
);

console.log("PASS redaction performance benchmark");
