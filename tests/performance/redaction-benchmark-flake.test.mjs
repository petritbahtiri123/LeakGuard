import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

process.env.LEAKGUARD_BENCH_SKIP_MAIN = "1";
const benchmark = await import(pathToFileURL(path.resolve("tests/performance/redaction-benchmark.mjs")).href);

function testTinyOutlierRetryEligibility() {
  const sample = {
    name: "small_safe_text",
    text: "safe text",
    maxP95Ms: 6,
    maxMsPerKb: 35
  };
  assert.equal(
    benchmark.shouldRetryTinyTimingOutlier(sample, {
      p95_wall_ms: 18.59,
      p50_wall_ms: 0.7,
      avg_ms_per_kib: 7
    }),
    true
  );
}

function testSustainedTinyRegressionIsNotRetryEligible() {
  const sample = {
    name: "small_safe_text",
    text: "safe text",
    maxP95Ms: 6,
    maxMsPerKb: 35
  };
  assert.equal(
    benchmark.shouldRetryTinyTimingOutlier(sample, {
      p95_wall_ms: 18.59,
      p50_wall_ms: 12,
      avg_ms_per_kib: 60
    }),
    false
  );
}

function testLargeSampleIsNotRetryEligible() {
  const sample = {
    name: "large_sample",
    text: "x".repeat(1024),
    maxP95Ms: 6,
    maxMsPerKb: 35
  };
  assert.equal(
    benchmark.shouldRetryTinyTimingOutlier(sample, {
      p95_wall_ms: 18.59,
      p50_wall_ms: 0.7,
      avg_ms_per_kib: 7
    }),
    false
  );
}

testTinyOutlierRetryEligibility();
testSustainedTinyRegressionIsNotRetryEligible();
testLargeSampleIsNotRetryEligible();
console.log("PASS redaction benchmark flake policy regressions");
