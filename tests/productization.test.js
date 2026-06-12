const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const revealControllerSource = fs.readFileSync(
  path.join(repoRoot, "src/content/rehydration/revealController.js"),
  "utf8"
);
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
const fileCapabilityMatrix = fs.readFileSync(
  path.join(repoRoot, "docs/FILE_CAPABILITY_MATRIX.md"),
  "utf8"
);
const phase14cProtectedSitePdfPlanPath = path.join(
  repoRoot,
  "docs/phase-14c-protected-site-pdf-redacted-output-plan.md"
);
const phase14cProtectedSitePdfPlan = fs.existsSync(phase14cProtectedSitePdfPlanPath)
  ? fs.readFileSync(phase14cProtectedSitePdfPlanPath, "utf8")
  : "";
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const testWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/test.yml"), "utf8");
const chromeSmokeSource = fs.readFileSync(path.join(repoRoot, "tests/browser/chrome_smoke.test.mjs"), "utf8");
const edgeSmokeSource = fs.readFileSync(path.join(repoRoot, "tests/browser/edge_smoke.test.mjs"), "utf8");
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
    revealControllerSource.includes("span.dataset.pwmTone"),
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

function testPendingAttachPromptDoesNotBlockPageClicks() {
  assert.ok(
    contentSource.includes("showPendingSanitizedAttachPrompt"),
    "content script should use the compact pending attach prompt"
  );
  assert.ok(
    /\.pwm-pending-attach-prompt\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?right:\s*18px;[\s\S]*?bottom:\s*72px;[\s\S]*?pointer-events:\s*none;/.test(
      overlaySource
    ),
    "pending attach prompt container should be compact and let page clicks pass through"
  );
  assert.ok(
    /\.pwm-pending-attach-card\s*\{[\s\S]*?pointer-events:\s*auto;/.test(overlaySource) &&
      /\.pwm-pending-attach-btn\s*\{[\s\S]*?pointer-events:\s*auto;/.test(overlaySource),
    "pending attach card and buttons should remain clickable"
  );
  assert.ok(
    !/\.pwm-pending-attach-prompt\s*\{[\s\S]*?inset:\s*0;/.test(overlaySource),
    "pending attach prompt must not reuse the full-screen DMZ overlay shape"
  );
}

function testFileProcessingUiIsGenericAndProgressive() {
  for (const functionName of [
    "showFileProcessingOverlay",
    "updateFileProcessingOverlay",
    "hideFileProcessingOverlay",
    "showPendingSanitizedAttachPrompt",
    "clearPendingSanitizedAttachPrompt"
  ]) {
    assert.ok(contentSource.includes(`function ${functionName}`), `expected ${functionName}`);
  }
  for (const label of [
    "file-ui:processing-shown",
    "file-ui:processing-updated",
    "file-ui:processing-hidden",
    "file-ui:pending-prompt-shown",
    "file-ui:pending-prompt-cleared",
    "file-ui:success-shown",
    "file-ui:error-shown"
  ]) {
    assert.ok(contentSource.includes(label), `expected ${label}`);
  }
  for (const className of [
    "pwm-file-processing-overlay",
    "pwm-file-processing-card",
    "pwm-file-processing-title",
    "pwm-file-processing-status",
    "pwm-file-processing-progress",
    "pwm-pending-attach-prompt",
    "pwm-pending-attach-card"
  ]) {
    assert.ok(overlaySource.includes(`.${className}`), `expected ${className} CSS`);
  }
  assert.ok(
    /\.pwm-file-processing-overlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?pointer-events:\s*auto;/.test(
      overlaySource
    ),
    "processing overlay should be centered and may block while raw file processing is active"
  );
  assert.ok(
    /\.pwm-file-processing-overlay\[data-pwm-blocking="false"\]\s*\{[\s\S]*?pointer-events:\s*none;/.test(
      overlaySource
    ),
    "processing success state should support non-blocking cleanup"
  );
  assert.ok(
    /\.pwm-file-processing-progress::before\s*\{[\s\S]*?animation:\s*pwm-file-processing-spin/.test(
      overlaySource
    ),
    "processing progress should expose a spinner"
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
    backgroundSource.includes("matchOriginAsFallback: true") &&
      !backgroundSource.includes("matchAboutBlank"),
    "dynamic site sync should use the supported scripting related-frame option"
  );
  assert.ok(
    !manifest.content_scripts[0].js.some((script) => script.startsWith("scanner/")),
    "scanner scripts should not be injected into protected sites"
  );
}

function testDocumentScannerCopyStaysV1Scoped() {
  assert.ok(
    scannerHtml.includes("text file, text PDF, DOCX, XLSX, or image") &&
      scannerHtml.includes("Text files, text PDFs, DOCX text, XLSX spreadsheet text, and PNG/JPG/JPEG/WEBP images") &&
      scannerHtml.includes("XLSX formulas are scanned as text only and are not executed"),
    "scanner UI should describe PDF, DOCX, XLSX, and scanner image support as scoped extraction only"
  );
  assert.ok(
      scannerHtml.includes("Image OCR is English-only") &&
      scannerHtml.includes("runs only after you select an image and click Scan File") &&
      scannerHtml.includes("limited to image files on this scanner page") &&
      scannerHtml.includes("Protected-site upload OCR is off by default") &&
      scannerHtml.includes("flattened redacted PNG only when OCR box confidence is eligible") &&
      scannerHtml.includes("Text PDF scanner results can also export a .redacted.pdf regenerated from sanitized extracted text") &&
      scannerHtml.includes("not layout-preserving") &&
      scannerHtml.includes(".redacted.txt remains available as the fallback") &&
      scannerHtml.includes("Protected-site text PDF output can hand off a regenerated .redacted.pdf when complete") &&
      scannerHtml.includes("Scanned PDF OCR") &&
      scannerHtml.includes("DOCX/XLSX rebuilds") &&
      scannerHtml.includes("image format preservation") &&
      scannerHtml.includes("legacy XLS") &&
      scannerHtml.includes("XLSM") &&
      scannerHtml.includes("embedded media") &&
      /visual redaction|redacted PNG/i.test(scannerHtml),
    "scanner UI should explicitly scope English/local/images-only OCR, default-off confidence-gated protected-site OCR, and avoid scanned PDF, legacy XLS, XLSM, media, rebuild, and format-preservation claims"
  );
  assert.ok(
    !/image PDF support|full PDF|full DOCX|full XLSX|full image|rebuilt DOCX|rebuilt XLSX|rebuilt image|macro support/i.test(scannerHtml),
    "scanner UI must not claim image-PDF support, macro support, full visual image scanning, or full PDF/DOCX/XLSX/image rebuild support"
  );
  assert.ok(
    scannerHtml.includes("../shared/ocr/ocrRuntime.js") &&
      scannerHtml.includes("../shared/pdfRedactor.js") &&
      scannerHtml.includes("../shared/scannerOcr.js") &&
      scannerJs.includes('extension === ".pdf"') &&
      scannerJs.includes('extension === ".docx"') &&
      scannerJs.includes('extension === ".xlsx"') &&
      scannerJs.includes('extension === ".png"') &&
      scannerJs.includes('extension === ".webp"') &&
      scannerJs.includes('redacted.txt') &&
      scannerJs.includes('redacted.pdf') &&
      scannerJs.includes('redacted.png'),
    "scanner redacted exports should keep text fallback, add scanner PDF proof output, and keep eligible image visual redaction PNG-only"
  );
}

function testProtectedSiteOcrSettingsCopyIsAccurateAndScoped() {
  assert.ok(
    optionsHtml.includes("Enable image OCR for protected-site uploads"),
    "options should expose the protected-site OCR opt-in label"
  );
  for (const copy of [
    "English-only",
    "local-only",
    "may be slower",
    "images only",
    "flattened .redacted.png",
    "OCR box confidence is eligible",
    "JPG, JPEG, and WEBP inputs are exported as PNG",
    "No scanned PDF OCR",
    "layout-preserving PDF redaction",
    "DOCX/XLSX rebuilds",
    "image format preservation",
    "non-English OCR",
    "Raw image bytes and OCR text never leave your device"
  ]) {
    assert.ok(optionsHtml.includes(copy), `protected-site OCR settings copy should include: ${copy}`);
  }
  assert.ok(
    optionsJs.includes("PWM_GET_PROTECTED_SITE_OCR_SETTING") &&
      optionsJs.includes("PWM_SET_PROTECTED_SITE_OCR_SETTING"),
    "options should load and persist protected-site OCR through explicit settings messages"
  );
  assert.ok(
    !/full image OCR|all image text|scanned PDF OCR enabled|supports image redaction|supports image rebuild|cloud OCR|remote OCR/i.test(optionsHtml),
    "protected-site OCR settings copy must not overclaim scope or imply remote/cloud processing"
  );
}

function testImageMetadataScannerAvoidsOcrDependencies() {
  const dependencyText = JSON.stringify({
    dependencies: packageJson.dependencies || {},
    devDependencies: packageJson.devDependencies || {}
  }).toLowerCase();

  assert.strictEqual(dependencyText.includes("tesseract"), false, "image metadata scanner must not add Tesseract OCR");
  assert.strictEqual(dependencyText.includes("tensorflow"), false, "image metadata scanner must not add TensorFlow");
  assert.strictEqual(dependencyText.includes("tfjs"), false, "image metadata scanner must not add TensorFlow.js");
}

function testPublishReadinessDocsCoverStorePrivacyAndQa() {
  assert.ok(
    storeListing.includes("Chrome Web Store") && storeListing.includes("Permission Justification"),
    "store listing doc should include reviewer-facing store copy and permission notes"
  );
  assert.ok(
    privacyPolicy.includes("does not use a backend service") &&
      privacyPolicy.includes("chrome.storage.session") &&
      privacyPolicy.includes("ephemeral extension memory") &&
      privacyPolicy.includes("configured retention window"),
    "privacy policy should describe local-only handling, session storage, ephemeral fallback, and audit retention"
  );
  assert.ok(
    releaseChecklist.includes("Manage Protected Sites") &&
      releaseChecklist.includes("manual smoke block"),
    "release checklist should cover popup flows and the manual smoke test"
  );
}

function testFileCapabilityMatrixDocumentsCurrentFileScope() {
  assert.ok(fileExists("docs/FILE_CAPABILITY_MATRIX.md"), "file capability matrix should exist");

  const matrixLower = fileCapabilityMatrix.toLowerCase();
  for (const required of [
    "local-only",
    "text pdf",
    "DOCX",
    "XLSX",
    "image metadata",
    "Scanner image OCR",
    "Protected-site image OCR opt-in",
    "default off",
    ".redacted.txt",
    ".redacted.png",
    "no scanned-PDF OCR",
    "no non-English OCR",
    "no remote OCR/backend",
    "no image format preservation",
    "Protected-site PDF output is regenerated from sanitized text only",
    "DOCX/XLSX rebuild support"
  ]) {
    assert.ok(matrixLower.includes(required.toLowerCase()), `capability matrix should include: ${required}`);
  }

  assert.ok(
    /Text PDF[\s\S]*Scanner: `\.redacted\.txt` and regenerated `\.redacted\.pdf`[\s\S]*Protected sites: regenerated `\.redacted\.pdf` only when complete/.test(fileCapabilityMatrix),
    "matrix should state scanner and protected-site text PDFs can export regenerated PDFs with protected-site completeness gating"
  );
  assert.ok(
    /DOCX[\s\S]*\.redacted\.txt[\s\S]*does not rebuild a DOCX/.test(fileCapabilityMatrix),
    "matrix should state DOCX exports redacted text, not rebuilt DOCX"
  );
  assert.ok(
    /XLSX[\s\S]*\.redacted\.txt[\s\S]*does not rebuild an XLSX/.test(fileCapabilityMatrix),
    "matrix should state XLSX exports redacted text, not rebuilt XLSX"
  );
  assert.ok(
    /Protected-site image OCR opt-in[\s\S]*default off[\s\S]*\.redacted\.png/.test(fileCapabilityMatrix),
    "matrix should state protected-site OCR is opt-in/default off and PNG-only for visual upload"
  );
  assert.ok(
    fileCapabilityMatrix.includes("Truncated regenerated PDFs are not handed off"),
    "matrix should state truncated protected-site regenerated PDFs are not handed off"
  );
}

function testPhase14cProtectedSitePdfPlanIsPlanningOnly() {
  assert.ok(fileExists("docs/phase-14c-protected-site-pdf-redacted-output-plan.md"), "Phase 14C plan should exist");
  for (const required of [
    "protected-site PDF uploads only",
    "text PDFs only",
    "application/pdf",
    ".redacted.pdf",
    ".redacted.txt fallback",
    "Gemini/Grok pending attach gates unchanged",
    "do not upload raw PDF",
    "prefer .redacted.txt fallback",
    "not layout-preserving",
    "original PDF streams are not copied",
    "Do not implement in this phase"
  ]) {
    assert.ok(
      phase14cProtectedSitePdfPlan.includes(required),
      `Phase 14C plan should include: ${required}`
    );
  }
}

function testPublicDocsAlignWithCurrentFileCapabilities() {
  const docs = {
    readme,
    storeListing,
    privacyPolicy,
    releaseChecklist,
    fileCapabilityMatrix
  };

  for (const [label, doc] of Object.entries(docs)) {
    for (const required of [
      "remote OCR",
      ".redacted.txt",
      ".redacted.png",
      "scanned-PDF OCR",
      "non-English OCR"
    ]) {
      assert.ok(doc.includes(required), `${label} should mention current file capability boundary: ${required}`);
    }
  }

  for (const forbidden of [
    /PDF, DOCX, and image redaction are planned but not enabled/i,
    /OCR is not implemented yet/i,
    /no PDF, DOCX, image OCR, or visual image redaction in this release/i,
    /Unsupported formats such as PDFs, DOCX files, images, archives, executables, and binary files are not scanned/i
  ]) {
    for (const [label, doc] of Object.entries(docs)) {
      assert.strictEqual(forbidden.test(doc), false, `${label} should not contain stale file capability copy`);
    }
  }
}

function testBrowserQaScriptOwnsFirefoxSmokeCoverage() {
  const qaBrowser = packageJson.scripts["qa:browser"] || "";
  const testRelease = packageJson.scripts["test:release"] || "";
  const smokeFirefox = packageJson.scripts["smoke:firefox"] || "";

  assert.ok(
    qaBrowser.includes("extension_qa_harness.test.mjs") &&
      qaBrowser.includes("chrome_smoke.test.mjs") &&
      qaBrowser.includes("edge_smoke.test.mjs") &&
      qaBrowser.includes("firefox_smoke.test.mjs"),
    "qa:browser should run the browser QA harness plus Chrome, Edge, and Firefox smoke coverage"
  );
  assert.ok(
    testRelease.includes("npm run qa:browser") && !testRelease.includes("npm run smoke:firefox"),
    "test:release should use qa:browser as the single browser QA entrypoint"
  );
  assert.strictEqual(
    smokeFirefox,
    "npm run build:firefox && node tests/browser/firefox_smoke.test.mjs",
    "smoke:firefox should remain available as the standalone Firefox smoke command"
  );
  assert.ok(
    testWorkflow.includes("xvfb-run -a npm run smoke:chrome") &&
      testWorkflow.includes("xvfb-run -a npm run smoke:firefox") &&
      testWorkflow.includes("xvfb-run -a npm run smoke:edge") &&
      !testWorkflow.includes("xvfb-run -a npm run qa:browser"),
    "CI should isolate browser smoke runs in separate Xvfb sessions"
  );
  assert.ok(
    chromeSmokeSource.includes('remoteDebuggingMode = "port"') &&
    edgeSmokeSource.includes('remoteDebuggingMode: "port"'),
    "Chromium smoke should use port CDP because GitHub browser Linux runs do not reliably answer pipe CDP"
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
  testPendingAttachPromptDoesNotBlockPageClicks();
  testFileProcessingUiIsGenericAndProgressive();
  testDynamicSiteSupportIsDeclaredMinimally(manifest);
testDocumentScannerCopyStaysV1Scoped();
testProtectedSiteOcrSettingsCopyIsAccurateAndScoped();
testImageMetadataScannerAvoidsOcrDependencies();
testPublishReadinessDocsCoverStorePrivacyAndQa();
testFileCapabilityMatrixDocumentsCurrentFileScope();
testPhase14cProtectedSitePdfPlanIsPlanningOnly();
testPublicDocsAlignWithCurrentFileCapabilities();
  testBrowserQaScriptOwnsFirefoxSmokeCoverage();
  console.log("PASS productization static regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
