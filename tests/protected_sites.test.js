const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const {
  BUILTIN_PROTECTED_SITES,
  normalizeProtectedSiteInput,
  normalizeProtectedSiteList,
  getProtectedSiteStatus
} = require(path.join(repoRoot, "src/shared/protected_sites.js"));

function extractContentScriptFilesFromBackground() {
  const source = fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8");
  const match = /const CONTENT_SCRIPT_FILES = \[([\s\S]*?)\];/.exec(source);
  assert.ok(match, "expected background CONTENT_SCRIPT_FILES list");

  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function testNormalizesFullUrlToOriginRule() {
  const normalized = normalizeProtectedSiteInput("https://app.example.com/chat/new?model=gpt#composer");

  assert.strictEqual(normalized.ok, true, "expected a valid protected site rule");
  assert.strictEqual(normalized.rule.origin, "https://app.example.com");
  assert.strictEqual(normalized.rule.matchPattern, "https://app.example.com/*");
  assert.strictEqual(normalized.rule.hostname, "app.example.com");
}

function testNormalizesBareHostnameToHttpsRule() {
  const normalized = normalizeProtectedSiteInput("portal.example.com/review");

  assert.strictEqual(normalized.ok, true, "expected bare hostnames to normalize safely");
  assert.strictEqual(normalized.rule.origin, "https://portal.example.com");
  assert.strictEqual(normalized.rule.matchPattern, "https://portal.example.com/*");
}

function testNormalizesHttpLocalhostWithoutPersistingPathOrPort() {
  const normalized = normalizeProtectedSiteInput("http://localhost:3000/dashboard");

  assert.strictEqual(normalized.ok, true, "expected localhost to stay eligible");
  assert.strictEqual(normalized.rule.origin, "http://localhost");
  assert.strictEqual(normalized.rule.matchPattern, "http://localhost/*");
}

function testRejectsInvalidProtectedSiteInputs() {
  const invalidInputs = [
    "",
    "   ",
    "https://*.example.com",
    "ftp://example.com",
    "https://user:pass@example.com/path",
    "chrome://extensions",
    "*"
  ];

  invalidInputs.forEach((input) => {
    const normalized = normalizeProtectedSiteInput(input);
    assert.strictEqual(normalized.ok, false, `expected ${JSON.stringify(input)} to be rejected`);
  });
}

function testPreventsDuplicatesAcrossNormalizedRules() {
  const first = normalizeProtectedSiteInput("https://app.example.com/chat").rule;
  const duplicate = normalizeProtectedSiteInput("https://app.example.com/settings").rule;
  const different = normalizeProtectedSiteInput("http://app.example.com/home").rule;
  const normalizedList = normalizeProtectedSiteList([first, duplicate, different]);

  assert.strictEqual(normalizedList.length, 2, "expected duplicate site rules to collapse safely");
  assert.strictEqual(
    normalizedList.filter((rule) => rule.origin === "https://app.example.com").length,
    1,
    "expected only one https rule for the same host"
  );
}

function testSafeOriginMatchingStaysExactAndDeterministic() {
  const userRules = normalizeProtectedSiteList([
    {
      ...normalizeProtectedSiteInput("https://app.example.com/path").rule,
      enabled: true
    }
  ]);

  const exact = getProtectedSiteStatus("https://app.example.com/compose", userRules);
  const wrongProtocol = getProtectedSiteStatus("http://app.example.com/compose", userRules);
  const wrongSubdomain = getProtectedSiteStatus("https://other.example.com/compose", userRules);

  assert.strictEqual(exact.protected, true, "expected exact origin matches to stay protected");
  assert.strictEqual(exact.source, "user");
  assert.strictEqual(wrongProtocol.protected, false, "expected protocol changes to stay distinct");
  assert.strictEqual(wrongSubdomain.protected, false, "expected subdomains to require explicit rules");
}

function testBuiltInSitesRemainRecognizedWithoutUserRules() {
  const builtin = getProtectedSiteStatus("https://chatgpt.com/c/123", []);

  assert.strictEqual(builtin.protected, true, "expected built-in protected AI hosts to stay active");
  assert.strictEqual(builtin.source, "builtin");
  assert.ok(
    BUILTIN_PROTECTED_SITES.some((rule) => rule.origin === "https://chatgpt.com"),
    "expected ChatGPT to remain in the built-in protected site list"
  );
}

function testDynamicContentScriptsMatchManifestRuntimeStack() {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"));
  const manifestScripts = manifest.content_scripts?.[0]?.js || [];
  const dynamicScripts = extractContentScriptFilesFromBackground();

  assert.deepStrictEqual(
    dynamicScripts,
    manifestScripts,
    "dynamic user-site injection should load the same runtime stack as manifest content scripts"
  );
  assert.ok(
    dynamicScripts.includes("vendor/onnxruntime/ort.min.js") &&
      dynamicScripts.includes("shared/ai/classifier.js") &&
      dynamicScripts.includes("shared/aiCandidateGate.js") &&
      dynamicScripts.includes("shared/transformOutboundPromptWithAi.js"),
    "dynamic user-site injection should include optional local AI assist dependencies"
  );
}

function run() {
  testNormalizesFullUrlToOriginRule();
  testNormalizesBareHostnameToHttpsRule();
  testNormalizesHttpLocalhostWithoutPersistingPathOrPort();
  testRejectsInvalidProtectedSiteInputs();
  testPreventsDuplicatesAcrossNormalizedRules();
  testSafeOriginMatchingStaysExactAndDeterministic();
  testBuiltInSitesRemainRecognizedWithoutUserRules();
  testDynamicContentScriptsMatchManifestRuntimeStack();
  console.log("PASS protected site normalization and matching regressions");
}

run();
