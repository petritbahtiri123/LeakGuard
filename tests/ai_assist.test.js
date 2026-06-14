const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/ai/classifier.js"));
const Detector = require(path.join(repoRoot, "src/shared/detector.js"));

async function testMissingFeatureSpecFallsBackQuietly() {
  const classifier = globalThis.PWM.LeakGuardAiClassifier;
  const previousExt = globalThis.PWM.ext;
  const previousFetch = globalThis.fetch;
  const previousWarn = console.warn;
  const warnings = [];

  globalThis.PWM.ext = {
    runtime: {
      getURL: (relativePath) => `chrome-extension://leakguard-test/${relativePath}`
    }
  };
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => {
      throw new Error("feature spec JSON should not be parsed after a 404");
    }
  });
  console.warn = (...args) => warnings.push(args);

  try {
    const result = await classifier.loadFeatureSpec();
    assert.strictEqual(result, null);
    assert.deepStrictEqual(warnings, [], "missing optional feature spec should fall back without page warnings");
  } finally {
    globalThis.PWM.ext = previousExt;
    globalThis.fetch = previousFetch;
    console.warn = previousWarn;
  }
}

async function testAiAssistUpgradesOnlyUncertainSpans() {
  const detector = new Detector();
  const classifier = {
    classify: async () => ({ risk: "SECRET", confidence: 0.91 })
  };

  const findings = await detector.scanWithAiAssist("auth=abcdefghijklmnop", {
    policy: { aiAssistEnabled: true },
    classifier
  });

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].severity, "high", "AI assist should upgrade high-confidence uncertain spans");
  assert.ok(findings[0].method.includes("ai-assist"));
}

async function testAiAssistIsEnabledByDefaultWhenPolicyIsOmitted() {
  const detector = new Detector();
  const classifier = {
    classify: async () => ({ risk: "SECRET", confidence: 0.91 })
  };

  const findings = await detector.scanWithAiAssist("auth=abcdefghijklmnop", { classifier });

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].severity, "high", "AI assist should run by default when no policy disables it");
  assert.ok(findings[0].method.includes("ai-assist"));
}

async function testAiAssistExplicitPolicyFalseStillDisablesClassifier() {
  const detector = new Detector();
  let calls = 0;
  const classifier = {
    classify: async () => {
      calls += 1;
      return { risk: "SECRET", confidence: 0.91 };
    }
  };

  const findings = await detector.scanWithAiAssist("auth=abcdefghijklmnop", {
    policy: { aiAssistEnabled: false },
    classifier
  });

  assert.strictEqual(calls, 0);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].severity, "medium", "explicit policy disable should keep deterministic result");
}

async function testAiAssistDoesNotDowngradeHighConfidenceDeterministicMatches() {
  const detector = new Detector();
  const classifier = {
    classify: async () => ({ risk: "NOT_SECRET", confidence: 0.99 })
  };

  const findings = await detector.scanWithAiAssist("password=Summer2026!", {
    policy: { aiAssistEnabled: true },
    classifier
  });

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].severity, "high");
  assert.ok(!findings[0].method.includes("ai-assist"), "high-confidence deterministic matches stay authoritative");
}

async function testBrowserIntegrationIsOptionalAndPolicyControlled() {
  const detectorSource = fs.readFileSync(path.join(repoRoot, "src/shared/detector.js"), "utf8");
  const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
  const policySource = fs.readFileSync(path.join(repoRoot, "src/shared/policy.js"), "utf8");
  const classifierSource = fs.readFileSync(path.join(repoRoot, "src/shared/ai/classifier.js"), "utf8");
  const { buildManifest, getOnnxRuntimeWebAccessibleResources } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
  );
  const manifest = buildManifest("chrome", "consumer");
  const runtimeResources = getOnnxRuntimeWebAccessibleResources();

  assert.ok(detectorSource.includes("scanWithAiAssist"), "detector should expose async AI assist scanning");
  assert.ok(contentSource.includes("analyzeTextWithAiAssist"), "content pipeline should call AI assist path");
  assert.ok(policySource.includes("aiAssistEnabled"), "policy should expose an AI assist toggle");
  assert.ok(
    manifest.content_scripts[0].js.includes("shared/ai/classifier.js"),
    "content scripts should load the browser-side classifier module"
  );
  assert.ok(
    manifest.content_scripts[0].js.includes("vendor/onnxruntime/ort.wasm.min.js"),
    "content scripts should load the WASM-only ONNX Runtime bundle"
  );
  assert.ok(
    runtimeResources.includes("vendor/onnxruntime/ort-wasm-simd-threaded.mjs") &&
      runtimeResources.includes("vendor/onnxruntime/ort-wasm-simd-threaded.wasm"),
    "ONNX Runtime resources should include the packaged CPU WASM module loader and binary"
  );
  assert.ok(
    runtimeResources.every((resource) => !/(?:asyncify|jsep|jspi)/.test(resource)),
    "ONNX Runtime resources should not package unused async, JSEP, or JSPI variants"
  );
  assert.ok(
    manifest.web_accessible_resources?.[0]?.resources.includes(
      "ai/models/leakguard_secret_classifier.features.json"
    ) &&
      manifest.web_accessible_resources?.[0]?.resources.includes("ai/models/leakguard_secret_classifier.onnx") &&
      runtimeResources.every((resource) =>
        manifest.web_accessible_resources?.[0]?.resources.includes(resource)
      ),
    "content scripts should be allowed to fetch the packaged feature spec, model, and ONNX WASM runtime"
  );
  assert.ok(
    classifierSource.includes("chrome-extension://invalid"),
    "classifier should reject invalid Chrome runtime URLs before fetching model assets"
  );
  assert.ok(
    classifierSource.includes("runExclusiveInference"),
    "classifier should serialize ONNX inference calls because the WASM backend rejects overlapping session runs"
  );
  assert.ok(
    classifierSource.includes("getOnnxRuntimeWasmPaths") &&
      classifierSource.includes("ort-wasm-simd-threaded.mjs") &&
      classifierSource.includes("ort-wasm-simd-threaded.wasm") &&
      classifierSource.includes("runtime.env.wasm.wasmPaths = getOnnxRuntimeWasmPaths();"),
    "classifier should configure ONNX Runtime sidecar imports with explicit extension URLs"
  );
}

function testOnnxRuntimeSidecarUrlsUseExtensionOrigin() {
  const previousExt = globalThis.PWM.ext;
  globalThis.PWM.ext = {
    runtime: {
      getURL: (relativePath) => `moz-extension://leakguard-test/${relativePath}`
    }
  };

  try {
    const paths = globalThis.PWM.LeakGuardAiClassifier.getOnnxRuntimeWasmPaths();
    assert.strictEqual(
      paths.mjs,
      "moz-extension://leakguard-test/vendor/onnxruntime/ort-wasm-simd-threaded.mjs"
    );
    assert.strictEqual(
      paths.wasm,
      "moz-extension://leakguard-test/vendor/onnxruntime/ort-wasm-simd-threaded.wasm"
    );

    const runtime = { env: { wasm: {} } };
    globalThis.PWM.LeakGuardAiClassifier.configureOnnxRuntime(runtime);
    assert.deepStrictEqual(runtime.env.wasm.wasmPaths, paths);
    assert.strictEqual(runtime.env.wasm.numThreads, 1);
  } finally {
    globalThis.PWM.ext = previousExt;
  }
}

async function run() {
  await testMissingFeatureSpecFallsBackQuietly();
  await testAiAssistUpgradesOnlyUncertainSpans();
  await testAiAssistIsEnabledByDefaultWhenPolicyIsOmitted();
  await testAiAssistExplicitPolicyFalseStillDisablesClassifier();
  await testAiAssistDoesNotDowngradeHighConfidenceDeterministicMatches();
  await testBrowserIntegrationIsOptionalAndPolicyControlled();
  testOnnxRuntimeSidecarUrlsUseExtensionOrigin();
  console.log("PASS local AI assist regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
