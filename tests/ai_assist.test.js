const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/ai/classifier.js"));
const Detector = require(path.join(repoRoot, "src/shared/detector.js"));

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

function testBrowserIntegrationIsOptionalAndPolicyControlled() {
  const detectorSource = fs.readFileSync(path.join(repoRoot, "src/shared/detector.js"), "utf8");
  const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
  const policySource = fs.readFileSync(path.join(repoRoot, "src/shared/policy.js"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"));

  assert.ok(detectorSource.includes("scanWithAiAssist"), "detector should expose async AI assist scanning");
  assert.ok(contentSource.includes("analyzeTextWithAiAssist"), "content pipeline should call AI assist path");
  assert.ok(policySource.includes("aiAssistEnabled"), "policy should expose an AI assist toggle");
  assert.ok(
    manifest.content_scripts[0].js.includes("shared/ai/classifier.js"),
    "content scripts should load the browser-side classifier module"
  );
  assert.ok(
    manifest.web_accessible_resources?.[0]?.resources.includes(
      "ai/models/leakguard_secret_classifier.features.json"
    ) &&
      manifest.web_accessible_resources?.[0]?.resources.includes("ai/models/leakguard_secret_classifier.onnx") &&
      manifest.web_accessible_resources?.[0]?.resources.includes("vendor/onnxruntime/ort-wasm.wasm"),
    "content scripts should be allowed to fetch the packaged feature spec, model, and ONNX WASM runtime"
  );
  assert.ok(
    fs
      .readFileSync(path.join(repoRoot, "src/shared/ai/classifier.js"), "utf8")
      .includes("chrome-extension://invalid"),
    "classifier should reject invalid Chrome runtime URLs before fetching model assets"
  );
}

async function run() {
  await testAiAssistUpgradesOnlyUncertainSpans();
  await testAiAssistDoesNotDowngradeHighConfidenceDeterministicMatches();
  testBrowserIntegrationIsOptionalAndPolicyControlled();
  console.log("PASS local AI assist regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

