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

function testHealthyWindowsFullSuiteOutlierIsRetryEligible() {
  const sample = {
    name: "env_file_2kb",
    text: "x".repeat(2656),
    maxP95Ms: 35,
    maxMsPerKb: 18,
    retryHealthyP95Outlier: true
  };
  assert.equal(
    benchmark.shouldRetryHealthyP95Outlier(sample, {
      p95_wall_ms: 39.013,
      p50_wall_ms: 11.5,
      avg_wall_ms: 14.8,
      avg_ms_per_kib: 5.8
    }),
    true
  );
}

function testHealthyWindowsFullSuiteP50NearThresholdIsRetryEligible() {
  const sample = {
    name: "env_file_2kb",
    text: "x".repeat(2656),
    maxP95Ms: 35,
    maxMsPerKb: 18,
    retryHealthyP95Outlier: true
  };
  assert.equal(
    benchmark.shouldRetryHealthyP95Outlier(sample, {
      p95_wall_ms: 59.373,
      p50_wall_ms: 31.4,
      avg_wall_ms: 34.2,
      avg_ms_per_kib: 13.2
    }),
    true
  );
}

function testSustainedP95RegressionIsNotRetryEligible() {
  const sample = {
    name: "env_file_2kb",
    text: "x".repeat(2656),
    maxP95Ms: 35,
    maxMsPerKb: 18,
    retryHealthyP95Outlier: true
  };
  assert.equal(
    benchmark.shouldRetryHealthyP95Outlier(sample, {
      p95_wall_ms: 39.013,
      p50_wall_ms: 37.2,
      avg_wall_ms: 38.1,
      avg_ms_per_kib: 14.7
    }),
    false
  );
}

function testThroughputRegressionIsNotRetryEligible() {
  const sample = {
    name: "env_file_2kb",
    text: "x".repeat(2656),
    maxP95Ms: 35,
    maxMsPerKb: 18,
    retryHealthyP95Outlier: true
  };
  assert.equal(
    benchmark.shouldRetryHealthyP95Outlier(sample, {
      p95_wall_ms: 39.013,
      p50_wall_ms: 11.5,
      avg_wall_ms: 55,
      avg_ms_per_kib: 21
    }),
    false
  );
}

testTinyOutlierRetryEligibility();
testSustainedTinyRegressionIsNotRetryEligible();
testLargeSampleIsNotRetryEligible();
testHealthyWindowsFullSuiteOutlierIsRetryEligible();
testHealthyWindowsFullSuiteP50NearThresholdIsRetryEligible();
testSustainedP95RegressionIsNotRetryEligible();
testThroughputRegressionIsNotRetryEligible();
console.log("PASS redaction benchmark flake policy regressions");
