const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const datasetPath = path.join(repoRoot, "ai/dataset/generated/initial_dataset.jsonl");
const realSanitizedEvalPath = path.join(repoRoot, "ai/dataset/test/onix_real_sanitized_eval.jsonl");
const generatorPath = path.join(repoRoot, "ai/scripts/generate_dataset.py");
const evalPath = path.join(repoRoot, "ai/scripts/evaluate_model.py");
const trainPath = path.join(repoRoot, "ai/scripts/train_classifier.py");
const prepareBuildPath = path.join(repoRoot, "scripts/prepare-build.mjs");
const featuresPath = path.join(repoRoot, "ai/scripts/features.py");
const detectorPath = path.join(repoRoot, "src/shared/detector.js");
const aiTransformPath = path.join(repoRoot, "src/shared/transformOutboundPromptWithAi.js");
const aiGatePath = path.join(repoRoot, "src/shared/aiCandidateGate.js");
const patternsPath = path.join(repoRoot, "src/shared/patterns.js");

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: ${error.message}`);
      }
    });
}

function findPython() {
  const venvPython =
    process.platform === "win32"
      ? path.join(repoRoot, "ai/.venv/Scripts/python.exe")
      : path.join(repoRoot, "ai/.venv/bin/python");
  const candidates = [venvPython, "python", "python3"];

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (!result.error && result.status === 0) return candidate;
  }

  throw new Error("Python is required for Onix dataset generator determinism tests");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function recordsMatching(records, textOrPattern) {
  return records.filter((record) => {
    const text = normalizeText(record.text);
    return typeof textOrPattern === "string" ? text === textOrPattern : textOrPattern.test(text);
  });
}

function requireRecord(records, textOrPattern, expected) {
  const matches = recordsMatching(records, textOrPattern);
  assert.ok(matches.length > 0, `missing Onix dataset example: ${textOrPattern}`);
  assert.ok(
    matches.some((record) =>
      Object.entries(expected).every(([key, value]) => record[key] === value)
    ),
    `example ${textOrPattern} did not include expected metadata ${JSON.stringify(expected)}`
  );
}

function testDatasetSchemaAndSize() {
  const records = readJsonl(datasetPath);
  const allowedLabels = new Set(["SECRET", "NOT_SECRET", "UNSURE"]);
  const allowedActions = new Set(["redact", "keep", "warn"]);

  assert.ok(records.length >= 50000, `expected at least 50000 generated records, got ${records.length}`);

  for (const [index, record] of records.entries()) {
    assert.strictEqual(typeof record.text, "string", `record ${index} missing text`);
    assert.ok(record.text.trim(), `record ${index} has blank text`);
    assert.ok(allowedLabels.has(record.label), `record ${index} has unsupported label ${record.label}`);
    assert.strictEqual(typeof record.source, "string", `record ${index} missing source`);
    assert.strictEqual(typeof record.category, "string", `record ${index} missing category`);
    assert.ok(allowedActions.has(record.action), `record ${index} has unsupported action ${record.action}`);
    assert.ok(
      record.layer_hint === undefined || typeof record.layer_hint === "string",
      `record ${index} has invalid layer_hint`
    );
  }
}

function testRequiredCategoriesArePresent() {
  const records = readJsonl(datasetPath);
  const categories = new Set(records.map((record) => record.category));
  const patternsSource = fs.readFileSync(patternsPath, "utf8");

  for (const category of [
    "secret",
    "identity",
    "email",
    "credential_context",
    "metadata_sensitive",
    "metadata_safe",
    "normal_text_safe",
    "onix_gray_zone",
    "adversarial_safe",
    "unknown_or_ambiguous"
  ]) {
    assert.ok(categories.has(category), `generated dataset missing category ${category}`);
    assert.ok(patternsSource.includes(`"${category}"`), `ONIX_DATASET_CATEGORIES missing ${category}`);
  }
}

function testGrayZoneRedactExamples() {
  const records = readJsonl(datasetPath);
  const redact = { label: "SECRET", action: "redact", layer_hint: "onix_gray_zone" };

  for (const text of [
    "password=Summer2026",
    "password=Welcome123",
    "pwd=Qwerty123",
    "passphrase=correct horse battery staple",
    "token=blue-team-prod",
    "secret=backup-prod",
    "api_key=dev-test-key",
    "shared_secret=company-internal",
    "client_secret=manual-rotation-needed",
    "username=admin",
    "login=svc-prod-deploy",
    "samaccountname=pbahtiri",
    "DOMAIN\\svc-backup in username field",
    "admin portal: https://internal-admin.corp.local",
    "vault path for prod secrets: secret/data/prod/database",
    "The temporary password for the new user is Welcome2026.",
    "The shared secret is blue-team-prod for now."
  ]) {
    requireRecord(records, text, redact);
  }
}

function testEmailRedactExamplesAreGlobal() {
  const records = readJsonl(datasetPath);
  const emailRecords = records.filter((record) =>
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(record.text)
  );

  assert.ok(emailRecords.length >= 200, "expected broad email training coverage");
  assert.deepStrictEqual(
    [...new Set(emailRecords.map((record) => record.label))],
    ["SECRET"],
    "every generated email example should train as redact"
  );

  for (const text of [
    "Contact user@example.com for access.",
    "admin@company.com",
    "first.last+tag@example.co.uk",
    "service-account@project.iam.gserviceaccount.com",
    "owner email: security-team@example.org"
  ]) {
    requireRecord(records, text, {
      label: "SECRET",
      action: "redact",
      layer_hint: "onix_gray_zone"
    });
  }
}

function testSafeContrastExamples() {
  const records = readJsonl(datasetPath);
  const keep = { label: "NOT_SECRET", action: "keep" };

  for (const text of [
    "A password should be rotated regularly.",
    "Never share tokens in chat.",
    "The database password field should be stored in Key Vault.",
    "This document explains how secrets are managed.",
    "Jane Doe and Sam Patel reviewed the deployment plan.",
    "Normal paragraph about AWS migration.",
    "Normal Windows path: C:\\Users\\qa\\Documents\\release-notes.txt",
    "Normal Linux path: /var/log/app/service.log",
    "Normal GitHub URL: https://github.com/example/project",
    "Normal UUID: 123e4567-e89b-12d3-a456-426614174000",
    "Normal AWS ARN: arn:aws:iam::123456789012:role/AdminRole",
    "Clean placeholder [PWM_7] should remain trusted.",
    "Azure tenant_id is a UUID used to identify a directory.",
    "The example path is /docs/examples/config.",
    "Example hostname: server.example.local"
  ]) {
    requireRecord(records, text, keep);
  }
}

function testMetadataSensitiveSafeContrastExists() {
  const records = readJsonl(datasetPath);

  requireRecord(records, "tenant_id used for production admin login: 72f988bf-86f1-41af-91ab-2d7cd011db47", {
    label: "SECRET",
    action: "redact",
    category: "metadata_sensitive",
    layer_hint: "onix_gray_zone"
  });
  requireRecord(records, "Azure tenant_id is a UUID used to identify a directory.", {
    label: "NOT_SECRET",
    action: "keep",
    category: "metadata_safe"
  });
}

function testGeneratorIsDeterministic() {
  const python = findPython();
  const script = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(path.dirname(generatorPath))})`,
    "import generate_dataset",
    "records = generate_dataset.build_records(240)",
    "print(json.dumps(records, sort_keys=True, separators=(',', ':')))"
  ].join("; ");
  const first = spawnSync(python, ["-c", script], { encoding: "utf8", cwd: repoRoot });
  const second = spawnSync(python, ["-c", script], { encoding: "utf8", cwd: repoRoot });

  assert.strictEqual(first.status, 0, first.stderr || first.stdout);
  assert.strictEqual(second.status, 0, second.stderr || second.stdout);
  assert.strictEqual(first.stdout, second.stdout, "Onix dataset generation must be deterministic");
}

function testTrainingEvaluationSeparationAndMetrics() {
  const trainSource = fs.readFileSync(trainPath, "utf8");
  const evalSource = fs.readFileSync(evalPath, "utf8");
  const prepareBuildSource = fs.readFileSync(prepareBuildPath, "utf8");

  assert.ok(
    trainSource.includes('DATASET_ROOT / "generated"') && trainSource.includes('DATASET_ROOT / "labeled"'),
    "training should load generated and labeled training data"
  );
  assert.ok(evalSource.includes('DATASET_ROOT / "test"'), "evaluation should load held-out test data");
  assert.ok(!evalSource.includes('DATASET_ROOT / "generated"'), "evaluation must not load generated training data");
  assert.ok(!evalSource.includes('DATASET_ROOT / "labeled"'), "evaluation must not load labeled training data");
  assert.ok(
    prepareBuildSource.includes("modelTrainingSourcePaths"),
    "prepare-build should separate model training inputs from eval-only inputs"
  );
  assert.ok(
    !prepareBuildSource.includes('path.join(aiRoot, "dataset", "test")'),
    "eval-only ai/dataset/test changes must not force retraining"
  );
  assert.ok(
    !prepareBuildSource.includes('path.join(aiRoot, "scripts", "evaluate_model.py")'),
    "eval script changes must not force retraining"
  );

  for (const metricText of [
    "Category breakdown",
    "Provider/category breakdown",
    "Source-type breakdown",
    "Real-sanitized eval metrics",
    "Email recall",
    "Gray-zone SECRET recall",
    "Normal-text false positives"
  ]) {
    assert.ok(evalSource.includes(metricText), `evaluation output missing ${metricText}`);
  }
}

function testRealSanitizedEvalPackExistsAndIsSafe() {
  assert.ok(fs.existsSync(realSanitizedEvalPath), "real-sanitized Onix eval pack should exist");
  const records = readJsonl(realSanitizedEvalPath);
  const allowedLabels = new Set(["SECRET", "NOT_SECRET", "UNSURE"]);
  const allowedActions = new Set(["redact", "keep", "warn"]);
  const forbiddenPatterns = [
    /\bAKIA(?!-?SYNTH)[0-9A-Z]{16}\b/,
    /\bASIA(?!-?SYNTH)[0-9A-Z]{16}\b/,
    /\bgh[pousr]_(?!synthetic|x{10,})[A-Za-z0-9_]{30,}\b/,
    /\bxox[baprs]-((?!synthetic|<workspace>)[A-Za-z0-9-]{20,})\b/,
    /\bsk-(?:live|test)-(?!synthetic|x{10,})[A-Za-z0-9]{20,}\b/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b\d{3}[-.]\d{3}[-.]\d{4}\b/,
    /\b\+1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/
  ];
  const allowedEmailDomains =
    /@(example\.com|example\.org|corp\.example|internal\.example|project\.iam\.gserviceaccount\.com)\b/i;

  assert.ok(records.length >= 80, `expected at least 80 real-sanitized eval records, got ${records.length}`);

  for (const [index, record] of records.entries()) {
    assert.strictEqual(typeof record.text, "string", `record ${index} missing text`);
    assert.ok(record.text.trim(), `record ${index} has blank text`);
    assert.ok(allowedLabels.has(record.label), `record ${index} has unsupported label ${record.label}`);
    assert.ok(allowedActions.has(record.action), `record ${index} has unsupported action ${record.action}`);
    assert.strictEqual(record.source_type, "real_sanitized", `record ${index} missing source_type`);
    assert.strictEqual(record.sanitized, true, `record ${index} must be marked sanitized`);
    assert.strictEqual(record.difficulty, "realistic", `record ${index} missing difficulty`);
    assert.strictEqual(typeof record.category, "string", `record ${index} missing category`);
    assert.ok(record.reason, `record ${index} missing reason`);
    if (record.label === "SECRET") {
      assert.strictEqual(record.layer_hint, "onix_gray_zone", `record ${index} SECRET missing layer_hint`);
    }

    for (const pattern of forbiddenPatterns) {
      assert.ok(!pattern.test(record.text), `record ${index} contains forbidden real-secret-like text`);
    }

    const emailMatches = record.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    for (const email of emailMatches) {
      assert.ok(allowedEmailDomains.test(email), `record ${index} uses non-example email domain: ${email}`);
    }
  }
}

function testRealSanitizedRequiredCases() {
  const records = readJsonl(realSanitizedEvalPath);

  for (const text of [
    "The service is named svc-prod-backup.",
    "The deployment uses worker-prod-sync as a component name.",
    "The Kubernetes deployment is called api-prod-runner.",
    "The Terraform module creates svc-reporting.",
    "The runbook references service name backup-prod."
  ]) {
    requireRecord(records, text, { label: "NOT_SECRET", action: "keep", source_type: "real_sanitized" });
  }

  for (const text of [
    "username=svc-prod-backup",
    "login=worker-prod-sync",
    "service_account=api-prod-runner",
    "principal=svc-reporting",
    "account_name=backup-prod",
    "break-glass account: svc-prod-backup",
    "privileged service principal: api-prod-runner"
  ]) {
    requireRecord(records, text, {
      label: "SECRET",
      action: "redact",
      source_type: "real_sanitized",
      layer_hint: "onix_gray_zone"
    });
  }
}

function testRealSanitizedEmailAndPlaceholderPolicy() {
  const records = readJsonl(realSanitizedEvalPath);
  const emailRecords = records.filter((record) =>
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(record.text)
  );
  const placeholderRecords = records.filter((record) => /\[PWM_\d+\]/.test(record.text));

  assert.ok(emailRecords.length >= 5, "real-sanitized pack should include email cases");
  assert.ok(
    emailRecords.every((record) => record.label === "SECRET" && record.action === "redact"),
    "emails in real-sanitized eval pack should be expected redact"
  );
  assert.ok(placeholderRecords.length >= 2, "real-sanitized pack should include trusted placeholder cases");
  assert.ok(
    placeholderRecords.every((record) => record.label === "NOT_SECRET" && record.action === "keep"),
    "[PWM_N] placeholders in real-sanitized eval pack should be expected keep"
  );
}

function testFeatureHintsTreatIdentityAsSensitive() {
  const featuresSource = fs.readFileSync(featuresPath, "utf8");
  const safeBlock = /SAFE_KEYWORDS\s*=\s*\(([\s\S]*?)\)/.exec(featuresSource)?.[1] || "";
  const secretBlock = /SECRET_KEYWORDS\s*=\s*\(([\s\S]*?)\)/.exec(featuresSource)?.[1] || "";

  assert.ok(!safeBlock.includes('"username"'), "structured usernames should not be a safe Onix feature");
  for (const keyword of ["username", "login", "service_account", "tenant_id", "vault", "admin"]) {
    assert.ok(secretBlock.includes(`"${keyword}"`), `SECRET_KEYWORDS missing ${keyword}`);
  }
}

function testNoObviousProductionSecrets() {
  const records = readJsonl(datasetPath);

  for (const [index, record] of records.entries()) {
    const text = String(record.text || "");
    assert.ok(!/\bAKIA(?!-?SYNTH)[0-9A-Z]{16}\b/.test(text), `record ${index} has live-looking AWS key`);
    assert.ok(!/\bASIA(?!-?SYNTH)[0-9A-Z]{16}\b/.test(text), `record ${index} has live-looking AWS session key`);
    assert.ok(!/\bgh[pousr]_(?!synthetic|x{10,})[A-Za-z0-9_]{30,}\b/.test(text), `record ${index} has live-looking GitHub token`);
    assert.ok(!/\bxox[baprs]-((?!synthetic|<workspace>)[A-Za-z0-9-]{20,})\b/.test(text), `record ${index} has live-looking Slack token`);
    assert.ok(!/\bsk-(?:live|test)-(?!synthetic|x{10,})[A-Za-z0-9]{20,}\b/.test(text), `record ${index} has live-looking payment key`);
  }
}

function testLifecycleRemainsRegexEntropyThenOnix() {
  const detectorSource = fs.readFileSync(detectorPath, "utf8");
  const aiTransformSource = fs.readFileSync(aiTransformPath, "utf8");
  const aiGateSource = fs.readFileSync(aiGatePath, "utf8");
  const regexIndex = detectorSource.indexOf("...this.scanProviderRegistry(input)");
  const entropyIndex = detectorSource.indexOf("...this.scanEntropyFallback(input)");
  const deterministicIndex = aiTransformSource.indexOf("deterministicFindings");
  const candidateGateIndex = aiTransformSource.indexOf("const candidates = extractAiCandidates");
  const classifierIndex = aiTransformSource.indexOf("classifier.classify");

  assert.ok(regexIndex >= 0, "deterministic provider registry should be part of Detector.scan");
  assert.ok(entropyIndex > regexIndex, "regex/provider registry must run before entropy fallback");
  assert.ok(candidateGateIndex > deterministicIndex, "Onix candidate gate must run after deterministic findings");
  assert.ok(classifierIndex > candidateGateIndex, "Onix classifier must run after candidate extraction");
  assert.ok(
    aiGateSource.includes("deterministicRanges") && aiGateSource.includes("overlapsAnyRange"),
    "candidate gate should keep deterministic ranges out of Onix"
  );
}

testDatasetSchemaAndSize();
testRequiredCategoriesArePresent();
testGrayZoneRedactExamples();
testEmailRedactExamplesAreGlobal();
testSafeContrastExamples();
testMetadataSensitiveSafeContrastExists();
testGeneratorIsDeterministic();
testTrainingEvaluationSeparationAndMetrics();
testRealSanitizedEvalPackExistsAndIsSafe();
testRealSanitizedRequiredCases();
testRealSanitizedEmailAndPlaceholderPolicy();
testFeatureHintsTreatIdentityAsSensitive();
testNoObviousProductionSecrets();
testLifecycleRemainsRegexEntropyThenOnix();

console.log("PASS Onix dataset and lifecycle regressions");
