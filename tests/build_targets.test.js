const assert = require("assert");
const fs = require("fs");
const path = require("path");
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

function assertReleaseArtifactsAreSanitized(results) {
  const sourceContent = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
  assert.ok(
    sourceContent.includes("debugReveal") && sourceContent.includes("pwm:debug"),
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
  }
}

async function run() {
  const { BUILD_TARGETS, buildTarget } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
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
  assert.strictEqual(chromeEnterpriseBuildInfo.enterprise, true, "chrome enterprise build should mark enterprise");
  assert.strictEqual(
    firefoxEnterpriseBuildInfo.enterprise,
    true,
    "firefox enterprise build should mark enterprise"
  );

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
  const contentScripts = chromeManifest.content_scripts[0].js;
  const knownSecretReuseIndex = contentScripts.indexOf("shared/knownSecretReuse.js");
  const transformOutboundPromptIndex = contentScripts.indexOf("shared/transformOutboundPrompt.js");
  const redactorIndex = contentScripts.indexOf("shared/redactor.js");
  const fileLimitsIndex = contentScripts.indexOf("shared/fileLimits.js");
  const fileScannerIndex = contentScripts.indexOf("shared/fileScanner.js");
  const streamingRedactorIndex = contentScripts.indexOf("shared/streamingFileRedactor.js");
  const filePasteHelperIndex = contentScripts.indexOf("content/file_paste_helpers.js");
  const fileHandoffStateIndex = contentScripts.indexOf("content/file_handoff_state.js");
  const fileHandoffPendingIndex = contentScripts.indexOf("content/file_handoff_pending.js");
  const fileHandoffFlowIndex = contentScripts.indexOf("content/file_handoff_flow.js");
  const contentIndex = contentScripts.indexOf("content/content.js");

  assert.ok(knownSecretReuseIndex > -1, "content scripts should include known-secret reuse helpers");
  assert.ok(
    knownSecretReuseIndex < transformOutboundPromptIndex && knownSecretReuseIndex < redactorIndex,
    "known-secret reuse helpers should load before prompt transform and redactor modules"
  );
  assert.ok(fileScannerIndex > -1, "content scripts should include shared file scanner helpers");
  assert.ok(fileLimitsIndex > -1, "content scripts should include shared file limit constants");
  assert.ok(streamingRedactorIndex > -1, "content scripts should include streaming file redactor helpers");
  assert.ok(filePasteHelperIndex > -1, "content scripts should include local file paste helpers");
  assert.ok(fileHandoffStateIndex > -1, "content scripts should include file handoff state helpers");
  assert.ok(fileHandoffPendingIndex > -1, "content scripts should include file handoff pending helpers");
  assert.ok(fileHandoffFlowIndex > -1, "content scripts should include file handoff flow helpers");
  assert.ok(
    fileScannerIndex < streamingRedactorIndex &&
      fileLimitsIndex < fileScannerIndex &&
      streamingRedactorIndex < filePasteHelperIndex &&
      filePasteHelperIndex < fileHandoffStateIndex &&
      fileHandoffStateIndex < fileHandoffPendingIndex &&
      fileHandoffPendingIndex < fileHandoffFlowIndex &&
      fileHandoffFlowIndex < contentIndex,
    "file scanner, streaming redactor, file paste helper, file handoff state, file handoff pending, file handoff flow, and content script injection order should stay aligned"
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
