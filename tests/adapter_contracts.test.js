const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const expectedProviderIds = ["chatgpt", "openai", "gemini", "claude", "grok", "x"];
const pendingAttachEnabled = Object.freeze({
  gemini: true,
  grok: true,
  chatgpt: true,
  claude: true,
  openai: true,
  x: true
});

require(path.join(repoRoot, "src/content/adapters/hostMatching.js"));
require(path.join(repoRoot, "src/content/adapters/chatgptAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/openaiAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/geminiDiagnosticsAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/geminiAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/claudeAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/grokAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/xAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/index.js"));

const hostMatching = globalThis.PWM.HostMatching;

function createNoopHooks() {
  return {
    findGeminiUploadMenuButton: () => null,
    findGeminiUploadFilesMenuItem: () => null,
    findGeminiFileInput: () => ({ fileInput: null }),
    isLikelyGeminiUploadClickTarget: () => false,
    performPendingGeminiUserAttach: async () => false,
    findGrokUploadButton: () => null,
    discoverGrokPendingFileInput: () => ({ fileInput: null }),
    isLikelyGrokUploadClickTarget: () => false,
    performPendingGrokUserAttach: async () => false,
    findGenericAdapterUploadTrigger: () => null,
    resolveGenericAdapterFileInput: () => null,
    isLikelyGenericUploadClickTarget: () => false,
    attachGenericPendingWithTrustedActivation: async () => false
  };
}

function createAdapters() {
  return globalThis.PWM.SiteAdapters.createFileHandoffAdapters({
    pendingAttachEnabled,
    hooks: createNoopHooks()
  });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function extractDynamicContentScripts() {
  const source = fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8");
  const match = /const CONTENT_SCRIPT_FILES = \[([\s\S]*?)\];/.exec(source);
  assert.ok(match, "expected background CONTENT_SCRIPT_FILES list");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function testAdapterRegistryExposesExpectedProviders() {
  const adapters = createAdapters();

  assert.deepStrictEqual(Object.keys(adapters).sort(), [...expectedProviderIds].sort());
  expectedProviderIds.forEach((id) => {
    assert.strictEqual(adapters[id].id, id, `expected ${id} adapter id`);
    assert.ok(Array.isArray(adapters[id].hosts), `expected ${id} adapter hosts`);
    assert.ok(adapters[id].hosts.length > 0, `expected ${id} adapter host entries`);
  });
}

function testHostMatchingRoutesExpectedUrlsToAdapters() {
  const adapters = createAdapters();
  const cases = [
    ["https://chatgpt.com/c/123", "chatgpt"],
    ["https://chat.openai.com/c/123", "openai"],
    ["https://gemini.google.com/app", "gemini"],
    ["https://claude.ai/new", "claude"],
    ["https://console.grok.com/chat", "grok"],
    ["https://x.com/compose/post", "x"]
  ];

  cases.forEach(([url, expectedId]) => {
    const location = new URL(url);
    const adapter = hostMatching.getFileHandoffAdapterForLocation(adapters, location);

    assert.strictEqual(adapter?.id, expectedId, `${url} should route to ${expectedId}`);
    assert.strictEqual(
      hostMatching.getCurrentHandoffDriverId(location.hostname),
      expectedId,
      `${url} should report ${expectedId} as the current handoff driver`
    );
  });
}

function testUnsupportedHostnamesDoNotReceiveSpecialAdapterBehavior() {
  const adapters = createAdapters();
  const unsupportedUrls = [
    "https://chatgpt.com.evil.test/c/123",
    "https://openai.example.test/chat",
    "https://gemini.google.com.evil.test/app",
    "https://claude.ai.evil.test/new",
    "https://grok.example.test/chat",
    "https://x.example.test/compose/post",
    "https://example.test/"
  ];

  unsupportedUrls.forEach((url) => {
    const location = new URL(url);
    assert.strictEqual(
      hostMatching.getFileHandoffAdapterForLocation(adapters, location),
      null,
      `${url} should not resolve to a provider adapter`
    );
    assert.strictEqual(
      hostMatching.getCurrentHandoffDriverId(location.hostname),
      "generic",
      `${url} should use the generic handoff driver`
    );
  });
}

function testAdapterParityCapabilitiesStayStable() {
  const adapters = createAdapters();
  const expectedCapabilities = {
    chatgpt: { directFileInput: true, directDropReplay: false, pendingAttach: true },
    openai: { directFileInput: true, directDropReplay: false, pendingAttach: true },
    gemini: { directFileInput: true, directDropReplay: false, pendingAttach: true },
    grok: { directFileInput: true, directDropReplay: true, pendingAttach: true },
    claude: { directFileInput: true, directDropReplay: false, pendingAttach: true },
    x: { directFileInput: true, directDropReplay: false, pendingAttach: true }
  };

  for (const [id, expected] of Object.entries(expectedCapabilities)) {
    const description = hostMatching.describeFileHandoffAdapter(adapters[id]);
    assert.strictEqual(
      adapters[id].supportsDirectFileInputAssignment,
      expected.directFileInput,
      `${id} direct file input capability should stay stable`
    );
    assert.strictEqual(
      description.supportsDirectDropReplay,
      expected.directDropReplay,
      `${id} direct drop replay capability should stay stable`
    );
    assert.strictEqual(
      description.pendingAttachEnabled,
      expected.pendingAttach,
      `${id} pending attach effective state should stay stable`
    );
    assert.strictEqual(
      description.supportsTrustedAttachButton,
      true,
      `${id} trusted attach button capability should stay declared`
    );
  }
}

function testPendingAttachIsEnabledForBuiltInProviders() {
  const adapters = createAdapters();

  expectedProviderIds.forEach((id) => {
    assert.strictEqual(adapters[id].pendingAttachEnabled, true, `${id} pending attach should stay enabled`);
    assert.strictEqual(
      hostMatching.isFileHandoffAdapterPendingAttachEnabled(adapters[id]),
      true,
      `${id} pending attach gate should stay enabled`
    );
  });
}

function testUploadAndUnsafeClickPredicatesStayPresent() {
  const adapters = createAdapters();

  expectedProviderIds.forEach((id) => {
    const adapter = adapters[id];
    assert.ok(adapter.uploadButtonSelectors.length > 0, `${id} should keep upload trigger selectors`);
    assert.ok(adapter.fileInputSelectors.length > 0, `${id} should keep file input selectors`);
    assert.ok(adapter.unsafeClickSelectors.length > 0, `${id} should keep unsafe click selectors`);
    assert.strictEqual(typeof adapter.resolveUploadTrigger, "function", `${id} should resolve upload triggers`);
    assert.strictEqual(typeof adapter.resolveFileInput, "function", `${id} should resolve file inputs`);
    assert.strictEqual(typeof adapter.isUploadClickTarget, "function", `${id} should expose upload click predicate`);
    assert.strictEqual(
      typeof adapter.attachWithTrustedActivation,
      "function",
      `${id} should expose trusted attach activation`
    );
  });

  ["gemini", "grok"].forEach((id) => {
    assert.strictEqual(
      typeof adapters[id].resolveUploadMenuItem,
      "function",
      `${id} should keep upload menu predicate wiring`
    );
  });
}

function testGeminiFallbackWriterLoadsAfterAdaptersBeforeContentWiring() {
  const manifestScripts = readJson("manifests/base.json").content_scripts[0].js;
  const dynamicScripts = extractDynamicContentScripts();

  [manifestScripts, dynamicScripts].forEach((scripts) => {
    const adapterIndex = scripts.indexOf("content/adapters/index.js");
    const fallbackWriterIndex = scripts.indexOf("content/adapters/geminiFallbackWriter.js");
    const safeSnapshotsIndex = scripts.indexOf("content/diagnostics/safeSnapshots.js");
    const fileAttachPipelineIndex = scripts.indexOf("content/files/fileAttachPipeline.js");
    const contentIndex = scripts.indexOf("content/content.js");

    assert.ok(adapterIndex > -1, "adapter registry should be present");
    assert.ok(fallbackWriterIndex > -1, "Gemini fallback writer should be present");
    assert.ok(
      adapterIndex < fallbackWriterIndex,
      "Gemini fallback writer should load after adapter registration"
    );
    assert.ok(
      fallbackWriterIndex < safeSnapshotsIndex &&
        fallbackWriterIndex < fileAttachPipelineIndex &&
        fallbackWriterIndex < contentIndex,
      "Gemini fallback writer should load before dependent content wiring"
    );
  });

  assert.deepStrictEqual(
    dynamicScripts,
    manifestScripts,
    "dynamic user-site injection should keep adapter load order aligned with the manifest"
  );
}

testAdapterRegistryExposesExpectedProviders();
testHostMatchingRoutesExpectedUrlsToAdapters();
testUnsupportedHostnamesDoNotReceiveSpecialAdapterBehavior();
testAdapterParityCapabilitiesStayStable();
testPendingAttachIsEnabledForBuiltInProviders();
testUploadAndUnsafeClickPredicatesStayPresent();
testGeminiFallbackWriterLoadsAfterAdaptersBeforeContentWiring();

console.log("PASS adapter contract regressions");
