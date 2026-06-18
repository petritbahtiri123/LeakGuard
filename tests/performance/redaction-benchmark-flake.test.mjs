import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

process.env.LEAKGUARD_BENCH_SKIP_MAIN = "1";
const benchmark = await import(pathToFileURL(path.resolve("tests/performance/redaction-benchmark.mjs")).href);

function testProfileNpmWrapperUsesDirectBenchmarkInvocation() {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
  const profileScript = packageJson.scripts?.["bench:redaction:profile"] || "";

  assert.doesNotMatch(profileScript, /\bnode\s+-e\b/, "profile benchmark wrapper should not use node -e");
  assert.match(
    profileScript,
    /^node\s+tests\/performance\/redaction-benchmark\.mjs\s+--profile(?:\s|$)/,
    "profile benchmark wrapper should invoke the benchmark file directly with --profile"
  );
}

function testBenchmarkImportDoesNotRequireCliScriptArgv() {
  const env = { ...process.env };
  delete env.LEAKGUARD_BENCH_SKIP_MAIN;
  const result = spawnSync(process.execPath, ["-e", "import('./tests/performance/redaction-benchmark.mjs')"], {
    cwd: path.resolve("."),
    encoding: "utf8",
    env
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function testSummaryRowsKeepRequiredReportingFields() {
  const rows = benchmark.formatSummaryRows([
    {
      test: "sample",
      chars: 1024,
      iterations: 5,
      findings: 1,
      avg_wall_ms: 12.3456,
      avg_cpu_ms: 10,
      p50_wall_ms: 11,
      p95_wall_ms: 14,
      p99_wall_ms: 15,
      p50_cpu_ms: 9,
      p95_cpu_ms: 12,
      p99_cpu_ms: 13,
      max_wall_ms: 16,
      avg_heap_delta_bytes: 1024,
      avg_heap_growth_bytes: 2048,
      max_heap_delta_bytes: 4096,
      avg_ms_per_kib: 12.3456
    }
  ]);

  assert.deepStrictEqual(
    {
      test: rows[0].test,
      iterations: rows[0].iterations,
      avg_wall_ms: rows[0].avg_wall_ms,
      p95_wall_ms: rows[0].p95_wall_ms
    },
    {
      test: "sample",
      iterations: 5,
      avg_wall_ms: "12.346",
      p95_wall_ms: "14.000"
    }
  );
}

function testProfileModeReportsEnvironmentContext() {
  const profile = benchmark.getBenchmarkEnvironmentProfile({
    profileEnabled: true,
    iterations: 5
  });

  assert.equal(profile.profile_enabled, "yes");
  assert.equal(profile.iterations, 5);
  assert.ok(profile.node);
  assert.ok(profile.platform);
  assert.ok(profile.arch);
  assert.ok(Object.prototype.hasOwnProperty.call(profile, "cpu_count"));
}

function testDefaultBenchmarkTimingIsAdvisory() {
  const sample = {
    name: "env_file_2kb",
    maxP95Ms: 35,
    maxMsPerKb: 18
  };
  const result = {
    p95_wall_ms: 59.373,
    avg_ms_per_kib: 13.2
  };

  assert.equal(
    benchmark.getPerformanceFailure(sample, result, { profileEnabled: false }),
    null,
    "default benchmark smoke runs should not fail on advisory timing rows"
  );
}

function testProfileBenchmarkTimingIsEnforced() {
  const sample = {
    name: "env_file_2kb",
    maxP95Ms: 35,
    maxMsPerKb: 18
  };
  const result = {
    p95_wall_ms: 59.373,
    avg_ms_per_kib: 13.2
  };

  assert.equal(
    benchmark.getPerformanceFailure(sample, result, { profileEnabled: true }),
    "env_file_2kb: p95 59.373ms exceeded 35ms"
  );
}

function testProfileCliOptionSetsProfileDefaults() {
  const env = {};
  const result = benchmark.applyBenchmarkCliOptions(["--profile"], env);

  assert.equal(result.profileRequested, true);
  assert.equal(env.LEAKGUARD_BENCH_PROFILE, "1");
  assert.equal(env.LEAKGUARD_BENCH_ITERATIONS, "12");
}

function testProfileCliOptionPreservesConfiguredIterations() {
  const env = { LEAKGUARD_BENCH_ITERATIONS: "20" };
  benchmark.applyBenchmarkCliOptions(["--profile"], env);

  assert.equal(env.LEAKGUARD_BENCH_PROFILE, "1");
  assert.equal(env.LEAKGUARD_BENCH_ITERATIONS, "20");
}

function testBenchmarkSamplesKeepDetectorOptimizationCoverage() {
  const summaries = benchmark.getBenchmarkSampleSummaries();
  const coverage = new Set(summaries.flatMap((sample) => sample.coverage));

  for (const required of [
    "overlap-correctness",
    "repeated-env-like-secrets",
    "safe-text-no-false-positives",
    "known-secret-reuse"
  ]) {
    assert.ok(coverage.has(required), `benchmark samples should keep coverage marker: ${required}`);
  }

  const safeText = summaries.find((sample) => sample.name === "long_safe_logs_120kb");
  assert.equal(safeText?.maxFindings, 0, "large safe text sample should remain a no-finding guard");
}

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

testProfileNpmWrapperUsesDirectBenchmarkInvocation();
testBenchmarkImportDoesNotRequireCliScriptArgv();
testSummaryRowsKeepRequiredReportingFields();
testProfileModeReportsEnvironmentContext();
testDefaultBenchmarkTimingIsAdvisory();
testProfileBenchmarkTimingIsEnforced();
testProfileCliOptionSetsProfileDefaults();
testProfileCliOptionPreservesConfiguredIterations();
testBenchmarkSamplesKeepDetectorOptimizationCoverage();
testTinyOutlierRetryEligibility();
testSustainedTinyRegressionIsNotRetryEligible();
testLargeSampleIsNotRetryEligible();
testHealthyWindowsFullSuiteOutlierIsRetryEligible();
testHealthyWindowsFullSuiteP50NearThresholdIsRetryEligible();
testSustainedP95RegressionIsNotRetryEligible();
testThroughputRegressionIsNotRetryEligible();
console.log("PASS redaction benchmark flake policy regressions");
