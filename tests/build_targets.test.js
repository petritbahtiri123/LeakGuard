const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
const policyModule = require(path.join(repoRoot, "src/shared/policy.js"));
const protectedSitesModule = require(path.join(repoRoot, "src/shared/protected_sites.js"));

const restrictiveExtensionPageCsp =
  "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';";
const forbiddenPackageDirectories = new Set([
  ".git",
  ".github",
  "artifacts",
  "dist",
  "docs",
  "manifests",
  "node_modules",
  "scripts",
  "src",
  "tests"
]);
const forbiddenPackageBasenames = new Set([
  ".env",
  ".gitignore",
  ".npmrc",
  "AGENTS.md",
  "package-lock.json",
  "package.json",
  "README.md"
]);
const forbiddenPackageExtensions = new Set([
  ".crx",
  ".pem",
  ".pfx",
  ".p12",
  ".log",
  ".xpi",
  ".zip"
]);

function walkFiles(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function dirSizeBytes(rootDir) {
  return walkFiles(rootDir).reduce((total, file) => total + fs.statSync(file).size, 0);
}

function assertReleaseArtifactsAreSanitized(results) {
  const sourceContent = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
  const debugLoggerSource = fs.readFileSync(
    path.join(repoRoot, "src/content/diagnostics/debugLogger.js"),
    "utf8"
  );
  assert.ok(
    sourceContent.includes("debugReveal") && debugLoggerSource.includes("pwm:debug"),
    "developer source diagnostics should remain available outside release builds"
  );

  for (const result of results) {
    const files = walkFiles(result.targetRoot);
    const mapFiles = files.filter(
      (file) => file.endsWith(".map") || path.basename(file).toLowerCase().includes(".map.")
    );
    assert.deepStrictEqual(mapFiles, [], `${result.target} release should not ship sourcemaps`);

    for (const file of files.filter((entry) => /\.(?:js|json|html|css)$/i.test(entry))) {
      const relativePath = path.relative(result.targetRoot, file).split(path.sep).join("/");
      const source = fs.readFileSync(file, "utf8");
      assert.strictEqual(
        source.includes("sourceMappingURL"),
        false,
        `${result.target}:${relativePath} should not contain sourceMappingURL`
      );
    }

    for (const relativeContentScript of [
      "content/content.js",
      "content/file_handoff_state.js",
      "content/file_handoff_pending.js",
      "content/file_handoff_flow.js"
    ]) {
      const contentSource = fs.readFileSync(path.join(result.targetRoot, relativeContentScript), "utf8");
      for (const banned of [
        "pwm:debug",
        "debugReveal",
        "debugLogSnapshot",
        "console.group(",
        "console.groupCollapsed(",
        "console.groupEnd(",
        "console.log("
      ]) {
        assert.strictEqual(
          contentSource.includes(banned),
          false,
          `${result.target} release ${relativeContentScript} should not contain ${banned}`
        );
      }
    }

    const debugLoggerSource = fs.readFileSync(
      path.join(result.targetRoot, "content/diagnostics/debugLogger.js"),
      "utf8"
    );
    for (const banned of [
      "pwm:debug",
      "console.groupCollapsed",
      "console.groupEnd",
      "console.log",
      "localStorage",
      "sessionStorage"
    ]) {
      assert.strictEqual(
        debugLoggerSource.includes(banned),
        false,
        `${result.target} release debug logger should not contain ${banned}`
      );
    }
  }
}

function relativePackagePath(targetRoot, file) {
  return path.relative(targetRoot, file).split(path.sep).join("/");
}

function assertNoInlineJavaScript(target, targetRoot, file) {
  if (!file.endsWith(".html")) return;

  const relativePath = relativePackagePath(targetRoot, file);
  const source = fs.readFileSync(file, "utf8");
  assert.strictEqual(
    /<script\b(?![^>]*\bsrc=)[^>]*>/i.test(source),
    false,
    `${target}:${relativePath} must not contain inline script tags`
  );
  assert.strictEqual(
    /\son[a-z]+\s*=/i.test(source),
    false,
    `${target}:${relativePath} must not contain inline event handlers`
  );
}

function assertPackageContentsAreRuntimeOnly(result) {
  const files = walkFiles(result.targetRoot);
  const requiredFiles = [
    "manifest.json",
    "compat/browser_api.js",
    "content/content.js",
    "content/overlay.css",
    "popup/popup.html",
    "options/options.html",
    "scanner/scanner.html",
    "scanner/scanner.js",
    "shared/fileLimits.js",
    "shared/fileTypeRegistry.js",
    "shared/fileExtractors.js",
    "shared/fileScanner.js",
    "vendor/onnxruntime/ort.wasm.min.js",
    "ai/models/leakguard_secret_classifier.features.json",
    "ai/models/leakguard_secret_classifier.onnx"
  ];

  requiredFiles.forEach((relativePath) => {
    assert.ok(
      fs.existsSync(path.join(result.targetRoot, relativePath)),
      `${result.target} package should include ${relativePath}`
    );
  });
  const extractorBytes = fs.statSync(path.join(result.targetRoot, "shared/fileExtractors.js")).size;
  assert.ok(
    extractorBytes < 36000,
    `${result.target} document extractor support should stay below the lightweight bundle budget`
  );

  for (const file of files) {
    const relativePath = relativePackagePath(result.targetRoot, file);
    const parts = relativePath.split("/");
    const basename = path.basename(relativePath);
    const extension = path.extname(relativePath).toLowerCase();

    for (const part of parts) {
      assert.strictEqual(
        forbiddenPackageDirectories.has(part),
        false,
        `${result.target} package should not include source-only directory ${relativePath}`
      );
    }

    assert.strictEqual(
      forbiddenPackageBasenames.has(basename),
      false,
      `${result.target} package should not include source-only file ${relativePath}`
    );
    assert.strictEqual(
      forbiddenPackageExtensions.has(extension),
      false,
      `${result.target} package should not include forbidden artifact ${relativePath}`
    );

    assertNoInlineJavaScript(result.target, result.targetRoot, file);
  }
}

function assertOcrRuntimeAssets(result) {
  const files = walkFiles(result.targetRoot);
  const ocrFiles = files
    .map((file) => relativePackagePath(result.targetRoot, file).split("\\").join("/"))
    .filter((relativePath) => relativePath.startsWith("shared/ocr/"))
    .sort();

  assert.deepStrictEqual(
    ocrFiles,
    ["shared/ocr/ocrRuntime.js", "shared/ocr/ocrWorker.js"],
    `${result.target} should include only the local OCR proof shell files`
  );

  for (const file of files) {
    const relativePath = relativePackagePath(result.targetRoot, file).toLowerCase();
    assert.strictEqual(
      /tesseract|ocrad|traineddata|ocr[-_.].*\.wasm|\.traineddata|ocr-model|ocr-assets/.test(relativePath),
      false,
      `${result.target} should not contain OCR engine/model asset ${relativePath}`
    );
    if (/\.(?:js|json|html|css|txt|md)$/i.test(file)) {
      const source = fs.readFileSync(file, "utf8").toLowerCase();
      for (const forbidden of ["tesseract", "ocrad", "traineddata", "cdn.jsdelivr", "unpkg.com"]) {
        assert.strictEqual(
          source.includes(forbidden),
          false,
          `${result.target}:${relativePath} should not contain OCR dependency or remote asset string ${forbidden}`
        );
      }
    }
  }
}

function plainObject(value) {
  return JSON.parse(JSON.stringify(value));
}

async function assertOcrRuntimeProbeShell(targetRoot) {
  const runtimeSource = fs.readFileSync(path.join(targetRoot, "shared/ocr/ocrRuntime.js"), "utf8");
  const createdWorkers = [];
  class ProbeWorker {
    constructor(url) {
      this.url = String(url);
      this.messages = [];
      this.terminated = false;
      createdWorkers.push(this);
    }

    postMessage(message) {
      this.messages.push(message);
      if (message?.type === "ocr_engine_probe") {
        this.onmessage?.({
          data: {
            ok: false,
            status: "engine_blocked",
            ocrImplemented: false,
            engine: null,
            reason: "no_candidate_passed_security_size_csp_gates"
          }
        });
        return;
      }
      this.onmessage?.({
        data: {
          ok: true,
          status: "worker_ready",
          ocrImplemented: false
        }
      });
    }

    terminate() {
      this.terminated = true;
    }
  }

  const sandbox = {
    globalThis: {
      PWM: {},
      PWM_BUILD_INFO: {
        features: {
          ocr: {
            enabled: false,
            status: "disabled",
            reason: "ocr_runtime_not_implemented"
          }
        }
      },
      chrome: {
        runtime: {
          getURL: (resourcePath) => `chrome-extension://test-id/${resourcePath}`
        }
      },
      setTimeout,
      clearTimeout,
      Worker: ProbeWorker
    }
  };
  sandbox.globalThis.globalThis = sandbox.globalThis;
  sandbox.globalThis.self = sandbox.globalThis;
  sandbox.globalThis.window = sandbox.globalThis;

  vm.runInNewContext(runtimeSource, sandbox, {
    filename: "ocrRuntime.js"
  });

  const runtime = sandbox.globalThis.PWM.OcrRuntime;
  assert.strictEqual(runtime.isAvailable(), true, "OCR runtime shell should be available in normal builds");
  assert.deepStrictEqual(
    plainObject(runtime.getStatus()),
    {
      available: true,
      status: "not_implemented",
      ocrImplemented: false,
      workerStatus: "idle"
    },
    "OCR runtime shell should report not-implemented idle status before probing"
  );
  assert.strictEqual(createdWorkers.length, 0, "OCR runtime should not create a worker before an explicit probe");

  const probe = plainObject(await runtime.createWorkerProbe());
  assert.deepStrictEqual(
    probe,
    {
      ok: true,
      status: "worker_ready",
      ocrImplemented: false
    },
    "OCR runtime shell should round-trip the worker probe payload"
  );
  assert.strictEqual(
    createdWorkers[0].url,
    "chrome-extension://test-id/shared/ocr/ocrWorker.js",
    "OCR runtime shell should load the packaged worker URL"
  );
  assert.deepStrictEqual(
    plainObject(createdWorkers[0].messages),
    [{ type: "ocr_probe" }],
    "OCR runtime shell should only send the harmless probe message"
  );

  const engineProbe = plainObject(await runtime.createEngineProbe());
  assert.deepStrictEqual(
    engineProbe,
    {
      ok: false,
      status: "engine_blocked",
      ocrImplemented: false,
      engine: null,
      reason: "no_candidate_passed_security_size_csp_gates"
    },
    "OCR engine proof should report blocked when no candidate passes local/CSP/size gates"
  );
  assert.deepStrictEqual(
    plainObject(createdWorkers[0].messages),
    [{ type: "ocr_probe" }, { type: "ocr_engine_probe" }],
    "OCR engine proof should only send the explicit engine probe message after the worker probe"
  );

  runtime.terminate();
  assert.strictEqual(createdWorkers[0].terminated, true, "OCR runtime shell should terminate its worker");
}

function assertOcrWorkerEngineProof(targetRoot) {
  const workerSource = fs.readFileSync(path.join(targetRoot, "shared/ocr/ocrWorker.js"), "utf8");
  const postedMessages = [];
  const sandbox = {
    self: {
      postMessage(message) {
        postedMessages.push(message);
      }
    }
  };
  sandbox.globalThis = sandbox.self;

  vm.runInNewContext(workerSource, sandbox, {
    filename: "ocrWorker.js"
  });

  sandbox.self.onmessage({ data: { type: "ocr_engine_probe" } });
  assert.deepStrictEqual(
    plainObject(postedMessages),
    [
      {
        ok: false,
        status: "engine_blocked",
        ocrImplemented: false,
        engine: null,
        reason: "no_candidate_passed_security_size_csp_gates"
      }
    ],
    "OCR worker should report engine_blocked without loading dependencies or processing image data"
  );
}

function assertManifestStructure(result, expectedHostPermissions) {
  const manifest = result.manifest;
  const contentScript = manifest.content_scripts?.[0] || {};

  assert.strictEqual(manifest.manifest_version, 3, `${result.target} should remain MV3`);
  assert.deepStrictEqual(
    manifest.content_security_policy,
    { extension_pages: restrictiveExtensionPageCsp },
    `${result.target} should keep the restrictive extension-page CSP`
  );
  assert.deepStrictEqual(
    [...(manifest.host_permissions || [])].sort(),
    expectedHostPermissions,
    `${result.target} host permissions should stay limited to built-in protected sites`
  );
  assert.deepStrictEqual(
    [...(contentScript.matches || [])].sort(),
    expectedHostPermissions,
    `${result.target} content-script matches should stay aligned with host permissions`
  );
  assert.deepStrictEqual(
    [...(manifest.optional_host_permissions || [])].sort(),
    ["http://*/*", "https://*/*"].sort(),
    `${result.target} optional host permissions should remain user-managed-site scoped`
  );
  assert.strictEqual(
    (contentScript.js || []).some((script) => script.startsWith("scanner/")),
    false,
    `${result.target} should not inject scanner pages into protected sites`
  );
  assert.strictEqual(
    (manifest.web_accessible_resources || []).some((entry) =>
      (entry.resources || []).some((resource) => resource.startsWith("scanner/"))
    ),
    false,
    `${result.target} should not expose scanner pages as web-accessible resources`
  );
  assert.strictEqual(
    (manifest.host_permissions || []).some((pattern) =>
      pattern === "<all_urls>" || pattern === "*://*/*" || pattern.includes("127.0.0.1")
    ),
    false,
    `${result.target} package manifest should not include test-only or all-site host permissions`
  );

  if (result.browser === "chrome") {
    assert.strictEqual(
      manifest.background?.service_worker,
      "background/service_worker.js",
      `${result.target} should use the Chrome MV3 service worker entry`
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(manifest.background || {}, "scripts"),
      false,
      `${result.target} should not use Firefox background scripts`
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(manifest, "browser_specific_settings"),
      false,
      `${result.target} should not include Firefox-only manifest metadata`
    );
  } else {
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(manifest.background || {}, "service_worker"),
      false,
      `${result.target} should not use a Chrome service worker entry`
    );
    assert.ok(
      (manifest.background?.scripts || []).includes("background/core.js"),
      `${result.target} should include Firefox background scripts`
    );
    assert.deepStrictEqual(
      manifest.browser_specific_settings?.gecko?.data_collection_permissions,
      { required: ["none"] },
      `${result.target} should disclose no transmitted data collection for Firefox`
    );
  }
}

function assertPackageStructure(results) {
  const expectedHostPermissions = protectedSitesModule.BUILTIN_PROTECTED_SITES
    .map((rule) => rule.matchPattern)
    .sort();

  for (const result of results) {
    assertManifestStructure(result, expectedHostPermissions);
    assertPackageContentsAreRuntimeOnly(result);
    assertOcrRuntimeAssets(result);
  }
}

async function run() {
  const { BUILD_TARGETS, OCR_SIZE_BUDGETS, buildTarget } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
  );
  assert.deepStrictEqual(
    BUILD_TARGETS.map((target) => target.folder).sort(),
    ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"].sort(),
    "build target matrix should stay single-extension without optional OCR editions"
  );
  assert.deepStrictEqual(
    OCR_SIZE_BUDGETS,
    Object.freeze({
      currentInstalledWarningBytes: 50 * 1024 * 1024,
      hardReviewInstalledBytes: 100 * 1024 * 1024,
      firefoxUploadHardLimitBytes: 200 * 1000 * 1000,
      chromeZipHardLimitBytes: 2 * 1024 * 1024 * 1024
    }),
    "OCR size budget should document internal warning/review gates and external store limits"
  );

  const results = BUILD_TARGETS.map((target) => buildTarget(target.browser, target.mode));
  assertReleaseArtifactsAreSanitized(results);
  assertPackageStructure(results);

  results.forEach((result) => {
    const manifestPath = path.join(result.targetRoot, "manifest.json");
    assert.ok(fs.existsSync(manifestPath), `expected manifest to exist for ${result.target}`);
    assert.ok(
      fs.existsSync(path.join(result.targetRoot, "scanner/scanner.html")),
      `expected scanner page to be packaged for ${result.target}`
    );
  });

  const consumerBuildInfo = require(path.join(repoRoot, "dist/chrome/shared/build_info.js"));
  const chromeEnterpriseBuildInfo = require(
    path.join(repoRoot, "dist/chrome-enterprise/shared/build_info.js")
  );
  const firefoxEnterpriseBuildInfo = require(
    path.join(repoRoot, "dist/firefox-enterprise/shared/build_info.js")
  );

  assert.strictEqual(consumerBuildInfo.enterprise, false, "consumer build should stay non-enterprise");
  assert.deepStrictEqual(
    consumerBuildInfo.features?.ocr,
    {
      enabled: false,
      status: "disabled",
      reason: "ocr_runtime_not_implemented"
    },
    "default consumer build should keep OCR disabled"
  );
  assert.strictEqual(chromeEnterpriseBuildInfo.enterprise, true, "chrome enterprise build should mark enterprise");
  assert.strictEqual(
    firefoxEnterpriseBuildInfo.enterprise,
    true,
    "firefox enterprise build should mark enterprise"
  );
  for (const target of ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"]) {
    const buildInfo = require(path.join(repoRoot, `dist/${target}/shared/build_info.js`));
    assert.deepStrictEqual(
      buildInfo.features?.ocr,
      {
        enabled: false,
        status: "disabled",
        reason: "ocr_runtime_not_implemented"
      },
      `${target} should keep OCR disabled metadata`
    );
    await assertOcrRuntimeProbeShell(path.join(repoRoot, "dist", target));
    assertOcrWorkerEngineProof(path.join(repoRoot, "dist", target));
  }

  const chromeEnterpriseManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "dist/chrome-enterprise/manifest.json"), "utf8")
  );
  const chromeManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "dist/chrome/manifest.json"), "utf8")
  );
  const firefoxManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "dist/firefox/manifest.json"), "utf8")
  );
  const firefoxEnterpriseManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "dist/firefox-enterprise/manifest.json"), "utf8")
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const scannerHtml = fs.readFileSync(path.join(repoRoot, "dist/chrome/scanner/scanner.html"), "utf8");
  assert.ok(
    scannerHtml.includes("OCR, visual text scanning") &&
      scannerHtml.includes("are not enabled in this release"),
    "scanner UI should continue to say OCR and visual text scanning are not enabled"
  );
  for (const [target, manifest] of [
    ["chrome", chromeManifest],
    ["chrome-enterprise", chromeEnterpriseManifest],
    ["firefox", firefoxManifest],
    ["firefox-enterprise", firefoxEnterpriseManifest]
  ]) {
    assert.strictEqual(
      manifest.version,
      packageJson.version,
      `${target} manifest should inherit package release version`
    );
  }
  assert.strictEqual(
    Object.keys(packageJson.scripts || {}).some((scriptName) =>
      ["build:chrome-ocr", "prebuild:chrome-ocr", "build:firefox-ocr", "prebuild:firefox-ocr"].includes(scriptName)
    ) || Object.values(packageJson.scripts || {}).some((script) => String(script).includes("--mode ocr")),
    false,
    "single-extension architecture should not expose optional OCR edition build scripts"
  );
  for (const dependencySet of [packageJson.dependencies || {}, packageJson.devDependencies || {}]) {
    for (const forbidden of ["tesseract.js", "tesseract.js-core", "@tesseract.js-data/eng", "ocrad.js"]) {
      assert.strictEqual(
        Object.prototype.hasOwnProperty.call(dependencySet, forbidden),
        false,
        `OCR package ${forbidden} should not be installed for optional build scaffolding`
      );
    }
  }
  const chromeBytes = dirSizeBytes(path.join(repoRoot, "dist/chrome"));
  const firefoxBytes = dirSizeBytes(path.join(repoRoot, "dist/firefox"));
  assert.ok(chromeBytes < 15 * 1024 * 1024, "default Chrome build should remain within current size budget");
  assert.ok(firefoxBytes < 15 * 1024 * 1024, "default Firefox build should remain within current size budget");
  assert.ok(
    chromeBytes < OCR_SIZE_BUDGETS.currentInstalledWarningBytes,
    "Chrome installed package should stay below OCR planning warning threshold before OCR assets exist"
  );
  assert.ok(
    firefoxBytes < OCR_SIZE_BUDGETS.currentInstalledWarningBytes,
    "Firefox installed package should stay below OCR planning warning threshold before OCR assets exist"
  );
  for (const target of ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"]) {
    const releaseZip = path.join(repoRoot, "artifacts", "release", `leakguard-${target}-v${packageJson.version}.zip`);
    if (fs.existsSync(releaseZip)) {
      assert.ok(
        fs.statSync(releaseZip).size < OCR_SIZE_BUDGETS.currentInstalledWarningBytes,
        `${target} release zip should stay below OCR planning warning threshold before OCR assets exist`
      );
    }
  }
  const contentScripts = chromeManifest.content_scripts[0].js;
  const knownSecretReuseIndex = contentScripts.indexOf("shared/knownSecretReuse.js");
  const transformOutboundPromptIndex = contentScripts.indexOf("shared/transformOutboundPrompt.js");
  const redactorIndex = contentScripts.indexOf("shared/redactor.js");
  const fileLimitsIndex = contentScripts.indexOf("shared/fileLimits.js");
  const fileTypeRegistryIndex = contentScripts.indexOf("shared/fileTypeRegistry.js");
  const fileExtractorsIndex = contentScripts.indexOf("shared/fileExtractors.js");
  const fileScannerIndex = contentScripts.indexOf("shared/fileScanner.js");
  const streamingRedactorIndex = contentScripts.indexOf("shared/streamingFileRedactor.js");
  const filePasteHelperIndex = contentScripts.indexOf("content/file_paste_helpers.js");
  const fileHandoffStateIndex = contentScripts.indexOf("content/file_handoff_state.js");
  const fileHandoffPendingIndex = contentScripts.indexOf("content/file_handoff_pending.js");
  const fileHandoffFlowIndex = contentScripts.indexOf("content/file_handoff_flow.js");
  const rewriteVerificationTextIndex = contentScripts.indexOf("content/input/rewriteVerificationText.js");
  const fileTransferPolicyIndex = contentScripts.indexOf("content/files/fileTransferPolicy.js");
  const fileExtractionSessionCacheIndex = contentScripts.indexOf("content/files/fileExtractionSessionCache.js");
  const contentFileExtractionPipelineIndex = contentScripts.indexOf("content/files/contentFileExtractionPipeline.js");
  const hostMatchingIndex = contentScripts.indexOf("content/adapters/hostMatching.js");
  const adapterScripts = [
    "content/adapters/chatgptAdapter.js",
    "content/adapters/openaiAdapter.js",
    "content/adapters/geminiDiagnosticsAdapter.js",
    "content/adapters/geminiAdapter.js",
    "content/adapters/claudeAdapter.js",
    "content/adapters/grokAdapter.js",
    "content/adapters/xAdapter.js",
    "content/adapters/index.js"
  ];
  const adapterIndexes = adapterScripts.map((script) => contentScripts.indexOf(script));
  const geminiFallbackWriterIndex = contentScripts.indexOf("content/adapters/geminiFallbackWriter.js");
  const safeSnapshotsIndex = contentScripts.indexOf("content/diagnostics/safeSnapshots.js");
  const fileAttachPipelineIndex = contentScripts.indexOf("content/files/fileAttachPipeline.js");
  const placeholderRehydratorIndex = contentScripts.indexOf("content/rehydration/placeholderRehydrator.js");
  const responseObserverIndex = contentScripts.indexOf("content/rehydration/responseObserver.js");
  const revealControllerIndex = contentScripts.indexOf("content/rehydration/revealController.js");
  const debugLoggerIndex = contentScripts.indexOf("content/diagnostics/debugLogger.js");
  const contentEventBindingsIndex = contentScripts.indexOf("content/bootstrap/eventBindings.js");
  const contentIndex = contentScripts.indexOf("content/content.js");

  assert.ok(knownSecretReuseIndex > -1, "content scripts should include known-secret reuse helpers");
  assert.ok(
    knownSecretReuseIndex < transformOutboundPromptIndex && knownSecretReuseIndex < redactorIndex,
    "known-secret reuse helpers should load before prompt transform and redactor modules"
  );
  assert.ok(fileScannerIndex > -1, "content scripts should include shared file scanner helpers");
  assert.ok(fileLimitsIndex > -1, "content scripts should include shared file limit constants");
  assert.ok(fileTypeRegistryIndex > -1, "content scripts should include shared file type registry helpers");
  assert.ok(fileExtractorsIndex > -1, "content scripts should include shared file extractor helpers");
  assert.ok(streamingRedactorIndex > -1, "content scripts should include streaming file redactor helpers");
  assert.ok(filePasteHelperIndex > -1, "content scripts should include local file paste helpers");
  assert.ok(fileHandoffStateIndex > -1, "content scripts should include file handoff state helpers");
  assert.ok(fileHandoffPendingIndex > -1, "content scripts should include file handoff pending helpers");
  assert.ok(fileHandoffFlowIndex > -1, "content scripts should include file handoff flow helpers");
  assert.ok(rewriteVerificationTextIndex > -1, "content scripts should include rewrite verification text helpers");
  assert.ok(fileTransferPolicyIndex > -1, "content scripts should include file transfer policy helpers");
  assert.ok(fileExtractionSessionCacheIndex > -1, "content scripts should include file extraction session cache helpers");
  assert.ok(
    contentFileExtractionPipelineIndex > -1,
    "content scripts should include content file extraction pipeline helpers"
  );
  assert.ok(hostMatchingIndex > -1, "content scripts should include host matching helpers");
  assert.ok(adapterIndexes.every((index) => index > -1), "content scripts should include site adapter helpers");
  assert.ok(geminiFallbackWriterIndex > -1, "content scripts should include Gemini fallback writer helpers");
  assert.ok(safeSnapshotsIndex > -1, "content scripts should include safe snapshot helpers");
  assert.ok(fileAttachPipelineIndex > -1, "content scripts should include file attach pipeline helpers");
  assert.ok(placeholderRehydratorIndex > -1, "content scripts should include placeholder rehydration helpers");
  assert.ok(responseObserverIndex > -1, "content scripts should include response observer helpers");
  assert.ok(revealControllerIndex > -1, "content scripts should include reveal controller helpers");
  assert.ok(debugLoggerIndex > -1, "content scripts should include raw-safe debug logger helpers");
  assert.ok(contentEventBindingsIndex > -1, "content scripts should include content event binding helpers");
  const adapterOrderAligned = adapterIndexes.every(
    (index, offset) => offset === 0 || adapterIndexes[offset - 1] < index
  );
  assert.ok(
    fileLimitsIndex < fileTypeRegistryIndex &&
      fileTypeRegistryIndex < fileExtractorsIndex &&
      fileExtractorsIndex < fileScannerIndex &&
      fileScannerIndex < streamingRedactorIndex &&
      streamingRedactorIndex < filePasteHelperIndex &&
      filePasteHelperIndex < fileHandoffStateIndex &&
      fileHandoffStateIndex < fileHandoffPendingIndex &&
      fileHandoffPendingIndex < fileHandoffFlowIndex &&
      fileHandoffFlowIndex < rewriteVerificationTextIndex &&
      rewriteVerificationTextIndex < fileTransferPolicyIndex &&
      fileTransferPolicyIndex < fileExtractionSessionCacheIndex &&
      fileExtractionSessionCacheIndex < contentFileExtractionPipelineIndex &&
      contentFileExtractionPipelineIndex < hostMatchingIndex &&
      hostMatchingIndex < adapterIndexes[0] &&
      adapterOrderAligned &&
      adapterIndexes.at(-1) < geminiFallbackWriterIndex &&
      geminiFallbackWriterIndex < safeSnapshotsIndex &&
      safeSnapshotsIndex < fileAttachPipelineIndex &&
      fileAttachPipelineIndex < placeholderRehydratorIndex &&
      placeholderRehydratorIndex < responseObserverIndex &&
      responseObserverIndex < revealControllerIndex &&
      revealControllerIndex < debugLoggerIndex &&
      debugLoggerIndex < contentEventBindingsIndex &&
      contentEventBindingsIndex < contentIndex,
    "file scanner, streaming redactor, file paste helper, file handoff, pure helper, adapter, and content script injection order should stay aligned"
  );
  assert.strictEqual(
    chromeEnterpriseManifest.storage?.managed_schema,
    "config/managed_policy_schema.json",
    "chrome enterprise manifest should declare managed policy schema support"
  );
  assert.deepStrictEqual(
    firefoxManifest.browser_specific_settings?.gecko?.data_collection_permissions,
    { required: ["none"] },
    "firefox manifest should disclose no transmitted data collection"
  );

  const firefoxOnnxLoader = fs.readFileSync(
    path.join(repoRoot, "dist/firefox/vendor/onnxruntime/ort.wasm.min.js"),
    "utf8"
  );
  assert.ok(
    firefoxOnnxLoader.includes("import(e)"),
    "packaged ONNX loader should import the runtime-selected extension URL for the WASM sidecar"
  );
  assert.ok(
    !firefoxOnnxLoader.includes("/*@vite-ignore*/e"),
    "packaged ONNX loader should not keep the dynamic import target flagged by AMO lint"
  );
  assert.ok(
    !firefoxOnnxLoader.includes('import("./ort-wasm-simd-threaded.mjs")'),
    "packaged ONNX loader must not use a page-relative sidecar import in Firefox content scripts"
  );

  const consumerDefaults = await policyModule.loadDefaultPolicy({
    browser: "chrome",
    mode: "consumer",
    enterprise: false
  });
  const enterpriseDefaults = await policyModule.loadDefaultPolicy({
    browser: "chrome",
    mode: "enterprise",
    enterprise: true
  });

  assert.strictEqual(
    consumerDefaults.enterpriseMode,
    false,
    "consumer build should not enable enterprise policy defaults"
  );
  assert.strictEqual(
    enterpriseDefaults.allowReveal,
    false,
    "enterprise build should disable reveal by default"
  );
  assert.strictEqual(
    enterpriseDefaults.blockHttpSecrets,
    true,
    "enterprise build should block HTTP secrets by default"
  );
  assert.strictEqual(
    enterpriseDefaults.auditRetentionDays,
    30,
    "enterprise build should default to bounded audit retention"
  );

  console.log("PASS multi-target build regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
