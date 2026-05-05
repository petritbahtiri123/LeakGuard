const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const overlaySource = fs.readFileSync(path.join(repoRoot, "src/content/overlay.css"), "utf8");
const popupHtml = fs.readFileSync(path.join(repoRoot, "src/popup/popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(repoRoot, "src/popup/popup.js"), "utf8");
const scannerHtml = fs.readFileSync(path.join(repoRoot, "src/scanner/scanner.html"), "utf8");
const scannerJs = fs.readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");
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

function testManifestBrandingAndProductPagesExist(manifest) {
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
  assert.ok(fileExists("src/scanner/scanner.html"), "expected scanner HTML to exist");
  assert.ok(fileExists("src/scanner/scanner.js"), "expected scanner JS to exist");
  assert.ok(fileExists("src/scanner/scanner.css"), "expected scanner CSS to exist");
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
  assert.ok(scannerHtml.includes("LeakGuard File Scanner"), "scanner HTML should use LeakGuard branding");
  assert.ok(scannerJs.includes("LeakGuard"), "scanner JS should use LeakGuard copy");
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

function testBuiltInProtectedSitesRemainStaticAndAligned(manifest) {
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
  assert.ok(contentSource.includes("pwm-panel"), "content script should create the top-center status menu");
  assert.ok(contentSource.includes("Manage Sites"), "panel should expose a settings shortcut");
  assert.ok(overlaySource.includes(".pwm-panel"), "panel styles should live in overlay.css");
  assert.ok(
    /\.pwm-panel-header\s*\{[\s\S]*?flex-wrap:\s*wrap;/.test(overlaySource),
    "panel header should wrap instead of overlapping controls on narrow widths"
  );
  assert.ok(
    /\.pwm-panel-brand\s*\{[\s\S]*?flex:\s*1 1 170px;[\s\S]*?min-width:\s*0;/.test(overlaySource),
    "panel brand should be allowed to shrink and share space with the toggle"
  );
  assert.ok(
    /\.pwm-panel-toggle\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?white-space:\s*nowrap;/.test(
      overlaySource
    ),
    "panel toggle should stay readable and clickable without overlapping the title"
  );
  assert.ok(popupHtml.includes("Open File Scanner"), "popup should expose the file scanner");
  assert.ok(popupJs.includes("scanner/scanner.html"), "popup should open the extension-owned scanner page");
  assert.ok(
    popupJs.includes("PWM_GET_PROTECTED_SITE_OVERVIEW") &&
      popupJs.includes("PWM_EXTENSION_REVEAL_SECRET") &&
      optionsJs.includes("PWM_SET_PROTECTED_SITE_ENABLED"),
    "popup and options should use the protected-site and secure-reveal flows"
  );
}

function testHydratedPlaceholdersStayVisibleAcrossThemes() {
  assert.ok(
    contentSource.includes("span.dataset.pwmTone"),
    "hydrated placeholder chips should receive deterministic tone attributes"
  );
  assert.ok(
    /\.pwm-secret\s*\{[\s\S]*?color:\s*#0f172a;[\s\S]*?background:\s*linear-gradient/.test(
      overlaySource
    ),
    "placeholder chips should use high-contrast foreground and filled backgrounds"
  );
  for (const tone of ["amber", "violet", "rose", "emerald"]) {
    assert.ok(
      overlaySource.includes(`.pwm-secret[data-pwm-tone="${tone}"]`),
      `placeholder chip tone ${tone} should be styled`
    );
  }
  assert.ok(
    overlaySource.includes("0 0 0 2px var(--pwm-secret-ring)") &&
      overlaySource.includes("text-shadow: 0 1px 0"),
    "placeholder chips should keep contrast on both light and dark host pages"
  );
}

function testDynamicSiteSupportIsDeclaredMinimally(manifest) {
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
  assert.ok(
    !manifest.content_scripts[0].js.some((script) => script.includes("scanner")),
    "scanner scripts should not be injected into protected sites"
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

async function run() {
  const { buildManifest } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
  );
  const manifest = buildManifest("chrome", "consumer");

  testManifestBrandingAndProductPagesExist(manifest);
  testLeakGuardBrandingShowsUpInUiAndDocs();
  testBuiltInProtectedSitesRemainStaticAndAligned(manifest);
  testPanelAndManagementUiAreWired();
  testHydratedPlaceholdersStayVisibleAcrossThemes();
  testDynamicSiteSupportIsDeclaredMinimally(manifest);
  testPublishReadinessDocsCoverStorePrivacyAndQa();
  console.log("PASS productization static regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
