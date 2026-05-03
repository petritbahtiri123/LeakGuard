const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
const policyModule = require(path.join(repoRoot, "src/shared/policy.js"));

async function run() {
  const { buildTarget } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
  );

  const targets = [
    { browser: "chrome", mode: "consumer", folder: "chrome" },
    { browser: "chrome", mode: "enterprise", folder: "chrome-enterprise" },
    { browser: "firefox", mode: "consumer", folder: "firefox" },
    { browser: "firefox", mode: "enterprise", folder: "firefox-enterprise" }
  ];

  const results = targets.map((target) => buildTarget(target.browser, target.mode));

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
  const contentScripts = chromeManifest.content_scripts[0].js;
  const fileScannerIndex = contentScripts.indexOf("shared/fileScanner.js");
  const filePasteHelperIndex = contentScripts.indexOf("content/file_paste_helpers.js");
  const contentIndex = contentScripts.indexOf("content/content.js");

  assert.ok(fileScannerIndex > -1, "content scripts should include shared file scanner helpers");
  assert.ok(filePasteHelperIndex > -1, "content scripts should include local file paste helpers");
  assert.ok(
    fileScannerIndex < filePasteHelperIndex && filePasteHelperIndex < contentIndex,
    "file scanner, file paste helper, and content script injection order should stay aligned"
  );
  assert.strictEqual(
    chromeEnterpriseManifest.storage?.managed_schema,
    "config/managed_policy_schema.json",
    "chrome enterprise manifest should declare managed policy schema support"
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

  console.log("PASS multi-target build regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
