const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifest.json"), "utf8"));
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const contentSource = fs.readFileSync(path.join(repoRoot, "content/content.js"), "utf8");
const overlaySource = fs.readFileSync(path.join(repoRoot, "content/overlay.css"), "utf8");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup/popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(repoRoot, "popup/popup.js"), "utf8");
const optionsHtml = fs.readFileSync(path.join(repoRoot, "options/options.html"), "utf8");
const optionsJs = fs.readFileSync(path.join(repoRoot, "options/options.js"), "utf8");
const backgroundSource = fs.readFileSync(
  path.join(repoRoot, "background/service_worker.js"),
  "utf8"
);
const { BUILTIN_PROTECTED_SITES } = require(path.join(repoRoot, "shared/protected_sites.js"));

function fileExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function testManifestBrandingAndProductPagesExist() {
  assert.strictEqual(manifest.name, "LeakGuard");
  assert.ok(
    manifest.description.includes("Local-only prompt protection"),
    "expected manifest description to describe LeakGuard clearly"
  );
  assert.strictEqual(manifest.action?.default_title, "LeakGuard");
  assert.strictEqual(manifest.action?.default_popup, "popup/popup.html");
  assert.strictEqual(manifest.options_page, "options/options.html");
  assert.ok(fileExists("popup/popup.html"), "expected popup HTML to exist");
  assert.ok(fileExists("popup/popup.js"), "expected popup JS to exist");
  assert.ok(fileExists("popup/popup.css"), "expected popup CSS to exist");
  assert.ok(fileExists("options/options.html"), "expected options HTML to exist");
  assert.ok(fileExists("options/options.js"), "expected options JS to exist");
  assert.ok(fileExists("options/options.css"), "expected options CSS to exist");
}

function testLeakGuardBrandingShowsUpInUiAndDocs() {
  assert.ok(readme.includes("public product name is LeakGuard"), "README should explain the public product name");
  assert.ok(popupHtml.includes("LeakGuard"), "popup HTML should use LeakGuard branding");
  assert.ok(popupJs.includes("LeakGuard"), "popup JS should use LeakGuard copy");
  assert.ok(optionsHtml.includes("LeakGuard"), "options HTML should use LeakGuard branding");
  assert.ok(optionsJs.includes("LeakGuard"), "options JS should use LeakGuard copy");
  assert.ok(
    popupHtml.includes("Inspect redacted content"),
    "popup HTML should include the secure reveal view"
  );
  assert.ok(
    popupHtml.includes("Manage protected sites"),
    "popup HTML should include protected-site management"
  );
}

function testBuiltInProtectedSitesRemainStaticAndAligned() {
  const manifestMatches = manifest.content_scripts[0].matches;
  const hostPermissions = manifest.host_permissions;
  const builtinMatches = BUILTIN_PROTECTED_SITES.map((rule) => rule.matchPattern);

  assert.deepStrictEqual(
    [...manifestMatches].sort(),
    [...hostPermissions].sort(),
    "built-in content-script matches should stay aligned with static host permissions"
  );
  assert.deepStrictEqual(
    [...builtinMatches].sort(),
    [...manifestMatches].sort(),
    "shared built-in protected sites should match the static AI host list"
  );
}

function testPanelAndManagementUiAreWired() {
  assert.ok(contentSource.includes("pwm-panel"), "content script should create the right-side status panel");
  assert.ok(contentSource.includes("Manage Sites"), "panel should expose a settings shortcut");
  assert.ok(overlaySource.includes(".pwm-panel"), "panel styles should live in overlay.css");
  assert.ok(
    popupJs.includes("PWM_GET_PROTECTED_SITE_OVERVIEW") &&
      popupJs.includes("PWM_EXTENSION_REVEAL_SECRET") &&
      optionsJs.includes("PWM_SET_PROTECTED_SITE_ENABLED"),
    "popup and options should use the protected-site and secure-reveal flows"
  );
}

function testDynamicSiteSupportIsDeclaredMinimally() {
  assert.ok(
    manifest.permissions.includes("scripting") && manifest.permissions.includes("activeTab"),
    "manifest should include only the runtime permissions needed for popup-driven site activation"
  );
  assert.deepStrictEqual(
    [...manifest.optional_host_permissions].sort(),
    ["http://*/*", "https://*/*"].sort(),
    "dynamic protected sites should use optional host permissions rather than broad default access"
  );
  assert.ok(
    backgroundSource.includes("unregisterContentScripts") &&
      !backgroundSource.includes("removeContentScripts"),
    "dynamic site sync should use the supported MV3 unregisterContentScripts API"
  );
}

function run() {
  testManifestBrandingAndProductPagesExist();
  testLeakGuardBrandingShowsUpInUiAndDocs();
  testBuiltInProtectedSitesRemainStaticAndAligned();
  testPanelAndManagementUiAreWired();
  testDynamicSiteSupportIsDeclaredMinimally();
  console.log("PASS productization static regressions");
}

run();
