const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const popupSource = fs.readFileSync(path.join(repoRoot, "src/popup/popup.js"), "utf8");
const optionsSource = fs.readFileSync(path.join(repoRoot, "src/options/options.js"), "utf8");
const backgroundSource = [
  fs.readFileSync(path.join(repoRoot, "src/background/protectedSiteRegistry.js"), "utf8"),
  fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8")
].join("\n");
require(path.join(repoRoot, "src/shared/runtime_scripts.js"));
const {
  BUILTIN_PROTECTED_SITES,
  normalizeProtectedSiteInput,
  normalizeProtectedSiteList,
  getProtectedSiteStatus
} = require(path.join(repoRoot, "src/shared/protected_sites.js"));

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
  const whatsapp = getProtectedSiteStatus("https://web.whatsapp.com/", []);

  assert.strictEqual(builtin.protected, true, "expected built-in protected chat hosts to stay active");
  assert.strictEqual(builtin.source, "builtin");
  assert.strictEqual(whatsapp.protected, true, "expected WhatsApp Web to be a built-in protected site");
  assert.strictEqual(whatsapp.source, "builtin");
  assert.ok(
    BUILTIN_PROTECTED_SITES.some((rule) => rule.origin === "https://chatgpt.com"),
    "expected ChatGPT to remain in the built-in protected site list"
  );
  assert.ok(
    BUILTIN_PROTECTED_SITES.some((rule) => rule.origin === "https://web.whatsapp.com"),
    "expected WhatsApp Web to remain in the built-in protected site list"
  );
}

function testBackgroundLoadsProtectedSiteRegistryBeforeCore() {
  const backgroundScripts = globalThis.PWM.RuntimeScripts.backgroundScripts;
  assert.ok(
    backgroundScripts.includes("background/protectedSiteRegistry.js"),
    "background runtime should include the protected-site registry module"
  );
  assert.ok(
    backgroundScripts.indexOf("background/protectedSiteRegistry.js") <
      backgroundScripts.indexOf("background/core.js"),
    "protected-site registry should load before background core"
  );
}

function testDynamicContentScriptsMatchManifestRuntimeStack() {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"));
  const manifestScripts = manifest.content_scripts?.[0]?.js || [];
  const dynamicScripts = globalThis.PWM.RuntimeScripts.contentScripts;

  assert.deepStrictEqual(
    dynamicScripts,
    manifestScripts,
    "dynamic user-site injection should load the same runtime stack as manifest content scripts"
  );
  assert.ok(
    dynamicScripts.includes("vendor/onnxruntime/ort.wasm.min.js") &&
      dynamicScripts.includes("shared/ai/classifier.js") &&
      dynamicScripts.includes("shared/aiCandidateGate.js") &&
      dynamicScripts.includes("shared/transformOutboundPromptWithAi.js"),
    "dynamic user-site injection should include optional local AI assist dependencies"
  );
}

function testCustomSitePermissionRequestsUseExactOriginPatterns() {
  const normalized = normalizeProtectedSiteInput(
    "https://app.example.com/chat/new?token=raw-secret#composer"
  );
  assert.strictEqual(normalized.ok, true);
  assert.strictEqual(normalized.rule.origin, "https://app.example.com");
  assert.strictEqual(normalized.rule.matchPattern, "https://app.example.com/*");

  assert.ok(
    popupSource.includes("origins: [site.rule.matchPattern]") &&
      popupSource.includes("origins: [normalized.rule.matchPattern]") &&
      popupSource.includes("origins: [rule.matchPattern]"),
    "popup custom-site grants should request normalized exact-origin match patterns"
  );
  assert.ok(
    optionsSource.includes("origins: [normalized.rule.matchPattern]") &&
      optionsSource.includes("origins: [rule.matchPattern]"),
    "options custom-site grants should request normalized exact-origin match patterns"
  );
  assert.ok(
    backgroundSource.includes("origins: [rule.matchPattern]") &&
      backgroundSource.includes("matches: [rule.matchPattern]"),
    "background permission checks and dynamic registrations should use exact-origin match patterns"
  );

  for (const source of [popupSource, optionsSource, backgroundSource]) {
    assert.strictEqual(
      /origins:\s*\[\s*(?:inputEl\.value|activeTab\.url|message\.url|normalized\.rule\.origin|rule\.origin)\s*\]/.test(
        source
      ),
      false,
      "custom-site permission requests must not use raw URLs or origin strings directly"
    );
  }
}

function run() {
  testNormalizesFullUrlToOriginRule();
  testNormalizesBareHostnameToHttpsRule();
  testNormalizesHttpLocalhostWithoutPersistingPathOrPort();
  testRejectsInvalidProtectedSiteInputs();
  testPreventsDuplicatesAcrossNormalizedRules();
  testSafeOriginMatchingStaysExactAndDeterministic();
  testBuiltInSitesRemainRecognizedWithoutUserRules();
  testBackgroundLoadsProtectedSiteRegistryBeforeCore();
  testDynamicContentScriptsMatchManifestRuntimeStack();
  testCustomSitePermissionRequestsUseExactOriginPatterns();
  console.log("PASS protected site normalization and matching regressions");
}

run();
