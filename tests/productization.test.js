const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const { buildManifest } = require(path.join(repoRoot, "scripts/build-extension.js"));
const manifest = buildManifest("chrome");
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const overlaySource = fs.readFileSync(path.join(repoRoot, "src/content/overlay.css"), "utf8");
const popupHtml = fs.readFileSync(path.join(repoRoot, "src/popup/popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(repoRoot, "src/popup/popup.js"), "utf8");
const optionsHtml = fs.readFileSync(path.join(repoRoot, "src/options/options.html"), "utf8");
const optionsJs = fs.readFileSync(path.join(repoRoot, "src/options/options.js"), "utf8");
const backgroundSource = fs.readFileSync(
  path.join(repoRoot, "src/background/core.js"),
  "utf8"
);
const storeListing = fs.readFileSync(
  path.join(repoRoot, "docs/CHROME_WEB_STORE_LISTING.md"),
  "utf8"
);
const privacyPolicy = fs.readFileSync(path.join(repoRoot, "docs/PRIVACY_POLICY.md"), "utf8");
const releaseChecklist = fs.readFileSync(
  path.join(repoRoot, "docs/RELEASE_QA_CHECKLIST.md"),
  "utf8"
);
const { BUILTIN_PROTECTED_SITES } = require(path.join(repoRoot, "src/shared/protected_sites.js"));

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
  assert.ok(fileExists("src/popup/popup.html"), "expected popup HTML to exist");
  assert.ok(fileExists("src/popup/popup.js"), "expected popup JS to exist");
  assert.ok(fileExists("src/popup/popup.css"), "expected popup CSS to exist");
  assert.ok(fileExists("src/options/options.html"), "expected options HTML to exist");
  assert.ok(fileExists("src/options/options.js"), "expected options JS to exist");
  assert.ok(fileExists("src/options/options.css"), "expected options CSS to exist");
  assert.ok(fileExists("docs/CHROME_WEB_STORE_LISTING.md"), "expected store listing doc to exist");
  assert.ok(fileExists("docs/PRIVACY_POLICY.md"), "expected privacy policy doc to exist");
  assert.ok(fileExists("docs/RELEASE_QA_CHECKLIST.md"), "expected release QA checklist doc to exist");
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
  assert.ok(readme.includes("Publish Readiness"), "README should link publish assets");
  assert.ok(storeListing.includes("LeakGuard"), "store listing should use LeakGuard branding");
  assert.ok(privacyPolicy.includes("LeakGuard"), "privacy policy should use LeakGuard branding");
  assert.ok(releaseChecklist.includes("LeakGuard"), "QA checklist should use LeakGuard branding");
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

function testPublishReadinessDocsCoverStorePrivacyAndQa() {
  assert.ok(
    storeListing.includes("Chrome Web Store") && storeListing.includes("Permission Justification"),
    "store listing doc should include reviewer-facing store copy and permission notes"
  );
  assert.ok(
    privacyPolicy.includes("does not use a backend service") &&
      privacyPolicy.includes("chrome.storage.session"),
    "privacy policy should describe local-only handling and session storage use"
  );
  assert.ok(
    releaseChecklist.includes("Manage Protected Sites") &&
      releaseChecklist.includes("manual smoke block"),
    "release checklist should cover popup flows and the manual smoke test"
  );
}

function run() {
  testManifestBrandingAndProductPagesExist();
  testLeakGuardBrandingShowsUpInUiAndDocs();
  testBuiltInProtectedSitesRemainStaticAndAligned();
  testPanelAndManagementUiAreWired();
  testDynamicSiteSupportIsDeclaredMinimally();
  testPublishReadinessDocsCoverStorePrivacyAndQa();
  console.log("PASS productization static regressions");
}

run();
