const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
const policyModule = require(path.join(repoRoot, "src/shared/policy.js"));

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

    const contentSource = fs.readFileSync(
      path.join(result.targetRoot, "content/content.js"),
      "utf8"
    );
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
        `${result.target} release content script should not contain ${banned}`
      );
    }
  }
}

async function run() {
  const { BUILD_TARGETS, buildTarget } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
  );

  const results = BUILD_TARGETS.map((target) => buildTarget(target.browser, target.mode));

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
  const fileScannerIndex = contentScripts.indexOf("shared/fileScanner.js");
  const streamingRedactorIndex = contentScripts.indexOf("shared/streamingFileRedactor.js");
  const filePasteHelperIndex = contentScripts.indexOf("content/file_paste_helpers.js");
  const contentIndex = contentScripts.indexOf("content/content.js");

  assert.ok(knownSecretReuseIndex > -1, "content scripts should include known-secret reuse helpers");
  assert.ok(
    knownSecretReuseIndex < transformOutboundPromptIndex && knownSecretReuseIndex < redactorIndex,
    "known-secret reuse helpers should load before prompt transform and redactor modules"
  );
  assert.ok(fileScannerIndex > -1, "content scripts should include shared file scanner helpers");
  assert.ok(streamingRedactorIndex > -1, "content scripts should include streaming file redactor helpers");
  assert.ok(filePasteHelperIndex > -1, "content scripts should include local file paste helpers");
  assert.ok(
    fileScannerIndex < streamingRedactorIndex &&
      streamingRedactorIndex < filePasteHelperIndex &&
      filePasteHelperIndex < contentIndex,
    "file scanner, streaming redactor, file paste helper, and content script injection order should stay aligned"
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
