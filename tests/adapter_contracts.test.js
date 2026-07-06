const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const expectedProviderIds = ["chatgpt", "openai", "gemini", "claude", "grok", "x", "whatsapp"];
const pendingAttachEnabled = Object.freeze({
  gemini: true,
  grok: true,
  chatgpt: true,
  claude: true,
  openai: true,
  x: true,
  whatsapp: false
});

require(path.join(repoRoot, "src/content/adapters/hostMatching.js"));
require(path.join(repoRoot, "src/content/adapters/chatgptAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/openaiAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/geminiDiagnosticsAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/geminiAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/claudeAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/grokAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/xAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/whatsappAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/index.js"));
require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/content/file_handoff_flow.js"));
require(path.join(repoRoot, "src/shared/runtime_scripts.js"));

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
  return globalThis.PWM.RuntimeScripts.contentScripts;
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
    ["https://x.com/compose/post", "x"],
    ["https://web.whatsapp.com/", "whatsapp"]
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
    "https://web.whatsapp.com.evil.test/",
    "https://whatsapp.com/",
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
    chatgpt: { directFileInput: true, directDropReplay: false, pendingAttach: true, multiFile: true },
    openai: { directFileInput: true, directDropReplay: false, pendingAttach: true, multiFile: true },
    gemini: { directFileInput: true, directDropReplay: false, pendingAttach: true, multiFile: true },
    grok: { directFileInput: true, directDropReplay: true, pendingAttach: true, multiFile: true },
    claude: { directFileInput: true, directDropReplay: false, pendingAttach: true, multiFile: true },
    x: { directFileInput: true, directDropReplay: false, pendingAttach: true, multiFile: true },
    whatsapp: { directFileInput: false, directDropReplay: false, pendingAttach: false, multiFile: false }
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
      description.supportsMultiFileHandoff,
      expected.multiFile,
      `${id} multi-file sanitized handoff capability should stay stable`
    );
    assert.strictEqual(
      description.supportsTrustedAttachButton,
      id !== "whatsapp",
      `${id} trusted attach button capability should stay declared only for file-capable adapters`
    );
  }
}

function testPendingAttachIsEnabledForBuiltInProviders() {
  const adapters = createAdapters();

  expectedProviderIds.filter((id) => id !== "whatsapp").forEach((id) => {
    assert.strictEqual(adapters[id].pendingAttachEnabled, true, `${id} pending attach should stay enabled`);
    assert.strictEqual(
      hostMatching.isFileHandoffAdapterPendingAttachEnabled(adapters[id]),
      true,
      `${id} pending attach gate should stay enabled`
    );
  });

  assert.strictEqual(adapters.whatsapp.pendingAttachEnabled, false, "WhatsApp pending attach should stay disabled");
  assert.strictEqual(
    hostMatching.isFileHandoffAdapterPendingAttachEnabled(adapters.whatsapp),
    false,
    "WhatsApp pending attach gate should stay disabled"
  );
}

function testUploadAndUnsafeClickPredicatesStayPresent() {
  const adapters = createAdapters();

  expectedProviderIds.filter((id) => id !== "whatsapp").forEach((id) => {
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

  const whatsapp = adapters.whatsapp;
  assert.deepStrictEqual(whatsapp.uploadButtonSelectors, [], "WhatsApp narrow adapter should not expose generic upload triggers");
  assert.deepStrictEqual(whatsapp.fileInputSelectors, [], "WhatsApp narrow adapter should not expose generic file inputs");
  assert.strictEqual(whatsapp.resolveUploadTrigger(), null, "WhatsApp upload trigger resolution should stay disabled");
  assert.strictEqual(whatsapp.resolveFileInput(), null, "WhatsApp file input resolution should stay disabled");
  assert.strictEqual(whatsapp.isUploadClickTarget(), false, "WhatsApp upload click detection should stay disabled");
  assert.strictEqual(
    whatsapp.supportsSanitizedTextDocumentAttachHandoff,
    true,
    "WhatsApp should expose only the narrow sanitized text-document attach capability"
  );
  assert.strictEqual(
    whatsapp.supportsSanitizedPdfAttachHandoff,
    true,
    "WhatsApp should expose only the narrow sanitized PDF attach capability"
  );
  assert.strictEqual(
    whatsapp.supportsSanitizedDocxAttachHandoff,
    true,
    "WhatsApp should expose only the narrow sanitized DOCX attach capability"
  );
  assert.strictEqual(
    whatsapp.supportsSanitizedXlsxAttachHandoff,
    true,
    "WhatsApp should expose only the narrow sanitized XLSX attach capability"
  );
  assert.strictEqual(
    whatsapp.supportsSanitizedMultiFileAttachHandoff,
    true,
    "WhatsApp should expose only the narrow sanitized multi-file attach capability"
  );
  assert.strictEqual(
    whatsapp.supportsSanitizedDropHandoff,
    true,
    "WhatsApp should expose only the narrow sanitized drag/drop handoff capability"
  );
  assert.strictEqual(
    whatsapp.supportsMultiFileHandoff,
    false,
    "WhatsApp must not enable generic multi-file handoff"
  );
  assert.strictEqual(
    whatsapp.supportsDirectDropReplay,
    false,
    "WhatsApp must not enable raw direct drop replay"
  );
  assert.strictEqual(
    whatsapp.supportsDirectFileInputAssignment,
    false,
    "WhatsApp document support must not enable raw direct file input assignment"
  );

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

async function testWhatsAppXlsxAttachVerifierRequiresRedactedXlsx() {
  const fileInput = {
    tagName: "INPUT",
    type: "file",
    files: [],
    events: [],
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    }
  };
  const sanitizedXlsx = {
    name: "lgqa-wa-doc.redacted.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 256
  };
  const flow = globalThis.PWM.createFileHandoffFlow({
    createSanitizedDataTransfer: (file) => ({ files: [file] }),
    describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
    getCurrentHandoffDriverId: () => "whatsapp",
    getFileHandoffAdapterById: () => ({
      id: "whatsapp",
      supportsSanitizedXlsxAttachHandoff: true
    }),
    getFileHandoffAdapterForLocation: () => ({
      id: "whatsapp",
      supportsSanitizedXlsxAttachHandoff: true
    }),
    handOffSanitizedFileInput: (targetInput, transfer) => {
      targetInput.files = transfer.files;
      targetInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      targetInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });

  const ok = await flow.handOffSanitizedLocalFile(
    { type: "change", target: fileInput },
    null,
    sanitizedXlsx,
    "file-input"
  );

  assert.strictEqual(ok, true, "WhatsApp should accept a sanitized rebuilt XLSX");
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedXlsx);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);

  for (const invalid of [
    { name: "lgqa-wa-doc.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 64 },
    { name: "lgqa-wa-doc.redacted.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 64 },
    { name: "lgqa-wa-doc.redacted.xlsx", type: "application/octet-stream", size: 64 },
    { name: "lgqa-wa-doc.redacted.pdf", type: "application/pdf", size: 64 }
  ]) {
    const invalidFileInput = {
      tagName: "INPUT",
      type: "file",
      files: [],
      events: [],
      dispatchEvent(event) {
        this.events.push(event.type);
        return true;
      }
    };
    const invalidFlow = globalThis.PWM.createFileHandoffFlow({
      createSanitizedDataTransfer: (file) => ({ files: [file] }),
      describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
      getCurrentHandoffDriverId: () => "whatsapp",
      getFileHandoffAdapterById: () => ({
        id: "whatsapp",
        supportsSanitizedXlsxAttachHandoff: true
      }),
      getFileHandoffAdapterForLocation: () => ({
        id: "whatsapp",
        supportsSanitizedXlsxAttachHandoff: true
      }),
      handOffSanitizedFileInput: () => {
        throw new Error(`${invalid.name} must be rejected before XLSX assignment`);
      }
    });

    const invalidOk = await invalidFlow.handOffSanitizedLocalFile(
      { type: "change", target: invalidFileInput },
      null,
      invalid,
      "file-input"
    );

    assert.strictEqual(invalidOk, false, `${invalid.name} should be rejected for WhatsApp Phase 3D`);
    assert.strictEqual(invalidFileInput.files.length, 0);
    assert.deepStrictEqual(invalidFileInput.events, []);
  }
}

(async () => {
  testAdapterRegistryExposesExpectedProviders();
  testHostMatchingRoutesExpectedUrlsToAdapters();
  testUnsupportedHostnamesDoNotReceiveSpecialAdapterBehavior();
  testAdapterParityCapabilitiesStayStable();
  testPendingAttachIsEnabledForBuiltInProviders();
  testUploadAndUnsafeClickPredicatesStayPresent();
  await testWhatsAppXlsxAttachVerifierRequiresRedactedXlsx();
  testGeminiFallbackWriterLoadsAfterAdaptersBeforeContentWiring();

  console.log("PASS adapter contract regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
