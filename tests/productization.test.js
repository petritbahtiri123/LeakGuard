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
const phase15cProtectedSiteDocxPlanPath = path.join(
  repoRoot,
  "docs/phase-15c-protected-site-docx-redacted-output-plan.md"
);
const phase15cProtectedSiteDocxPlan = fs.existsSync(phase15cProtectedSiteDocxPlanPath)
  ? fs.readFileSync(phase15cProtectedSiteDocxPlanPath, "utf8")
  : "";
const phase15eDocxCloseoutPath = path.join(
  repoRoot,
  "docs/phase-15e-docx-rebuilt-output-closeout.md"
);
const phase15eDocxCloseout = fs.existsSync(phase15eDocxCloseoutPath)
  ? fs.readFileSync(phase15eDocxCloseoutPath, "utf8")
  : "";
const phase16cProtectedSiteXlsxPlanPath = path.join(
  repoRoot,
  "docs/phase-16c-protected-site-xlsx-redacted-output-plan.md"
);
const phase16cProtectedSiteXlsxPlan = fs.existsSync(phase16cProtectedSiteXlsxPlanPath)
  ? fs.readFileSync(phase16cProtectedSiteXlsxPlanPath, "utf8")
  : "";
const phase16eXlsxCloseoutPath = path.join(
  repoRoot,
  "docs/phase-16e-xlsx-rebuilt-output-closeout.md"
);
const phase16eXlsxCloseout = fs.existsSync(phase16eXlsxCloseoutPath)
  ? fs.readFileSync(phase16eXlsxCloseoutPath, "utf8")
  : "";
const phase17aTestingGapAnalysisPath = path.join(
  repoRoot,
  "docs/phase-17a-testing-gap-analysis.md"
);
const phase17aTestingGapAnalysis = fs.existsSync(phase17aTestingGapAnalysisPath)
  ? fs.readFileSync(phase17aTestingGapAnalysisPath, "utf8")
  : "";
const phase17bBrowserAutomationPath = path.join(
  repoRoot,
  "docs/phase-17b-p0-browser-automation.md"
);
const phase17bBrowserAutomation = fs.existsSync(phase17bBrowserAutomationPath)
  ? fs.readFileSync(phase17bBrowserAutomationPath, "utf8")
  : "";
const phase17cProviderBrowserParityPath = path.join(
  repoRoot,
  "docs/phase-17c-provider-browser-parity-automation.md"
);
const phase17cProviderBrowserParity = fs.existsSync(phase17cProviderBrowserParityPath)
  ? fs.readFileSync(phase17cProviderBrowserParityPath, "utf8")
  : "";
const phase17dCorruptedLargeFileFuzzPath = path.join(
  repoRoot,
  "docs/phase-17d-corrupted-large-file-fuzz-automation.md"
);
const phase17dCorruptedLargeFileFuzz = fs.existsSync(phase17dCorruptedLargeFileFuzzPath)
  ? fs.readFileSync(phase17dCorruptedLargeFileFuzzPath, "utf8")
  : "";
const phase17eReleaseArtifactStoreReadinessPath = path.join(
  repoRoot,
  "docs/phase-17e-release-artifact-store-readiness-automation.md"
);
const phase17eReleaseArtifactStoreReadiness = fs.existsSync(phase17eReleaseArtifactStoreReadinessPath)
  ? fs.readFileSync(phase17eReleaseArtifactStoreReadinessPath, "utf8")
  : "";
const phase17fCiNightlyMatrixPath = path.join(
  repoRoot,
  "docs/phase-17f-ci-nightly-matrix-hardening.md"
);
const phase17fCiNightlyMatrix = fs.existsSync(phase17fCiNightlyMatrixPath)
  ? fs.readFileSync(phase17fCiNightlyMatrixPath, "utf8")
  : "";
const phase18FinalPrStabilizationCloseoutPath = path.join(
  repoRoot,
  "docs/phase-18-final-pr-stabilization-closeout.md"
);
const phase18FinalPrStabilizationCloseout = fs.existsSync(phase18FinalPrStabilizationCloseoutPath)
  ? fs.readFileSync(phase18FinalPrStabilizationCloseoutPath, "utf8")
  : "";
const phase19ManualReleaseQaChecklistPath = path.join(
  repoRoot,
  "docs/phase-19-manual-release-qa-checklist.md"
);
const phase19ManualReleaseQaChecklist = fs.existsSync(phase19ManualReleaseQaChecklistPath)
  ? fs.readFileSync(phase19ManualReleaseQaChecklistPath, "utf8")
  : "";
const phase19LiveBrowserQaResultsPath = path.join(
  repoRoot,
  "docs/phase-19-live-browser-mcp-qa-results.md"
);
const phase19LiveBrowserQaResults = fs.existsSync(phase19LiveBrowserQaResultsPath)
  ? fs.readFileSync(phase19LiveBrowserQaResultsPath, "utf8")
  : "";
const phase20aQualityPerformanceSecurityPlanPath = path.join(
  repoRoot,
  "docs/phase-20a-quality-performance-security-plan.md"
);
const phase20aQualityPerformanceSecurityPlan = fs.existsSync(phase20aQualityPerformanceSecurityPlanPath)
  ? fs.readFileSync(phase20aQualityPerformanceSecurityPlanPath, "utf8")
  : "";
const phase20cQualityPerformanceSecurityCloseoutPath = path.join(
  repoRoot,
  "docs/phase-20c-quality-performance-security-closeout.md"
);
const phase20cQualityPerformanceSecurityCloseout = fs.existsSync(phase20cQualityPerformanceSecurityCloseoutPath)
  ? fs.readFileSync(phase20cQualityPerformanceSecurityCloseoutPath, "utf8")
  : "";
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const testWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/test.yml"), "utf8");
const releaseArtifactsWorkflow = fs.readFileSync(
  path.join(repoRoot, ".github/workflows/release-artifacts.yml"),
  "utf8"
);
const browserNightlyWorkflow = fs.readFileSync(
  path.join(repoRoot, ".github/workflows/browser-nightly.yml"),
  "utf8"
);
const chromeSmokeSource = fs.readFileSync(path.join(repoRoot, "tests/browser/chrome_smoke.test.mjs"), "utf8");
const edgeSmokeSource = fs.readFileSync(path.join(repoRoot, "tests/browser/edge_smoke.test.mjs"), "utf8");
const firefoxSmokeSource = fs.readFileSync(path.join(repoRoot, "tests/browser/firefox_smoke.test.mjs"), "utf8");
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

function testScannerLoadsTypedDetectionRuntimeBeforeDetector() {
  const scripts = [...scannerHtml.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  const placeholderFamiliesIndex = scripts.indexOf("../shared/placeholders/families.js");
  const placeholdersIndex = scripts.indexOf("../shared/placeholders.js");
  const detectorIndex = scripts.indexOf("../shared/detector.js");
  const detectionModuleScripts = [
    "../shared/detection/constants/enterpriseTokens.js",
    "../shared/detection/constants/providerTokens.js",
    "../shared/detection/constants/contextRegexes.js",
    "../shared/detection/contextWindow.js",
    "../shared/detection/cloudScoring.js",
    "../shared/detection/enterprise/shared.js",
    "../shared/detection/enterprise/uncPaths.js",
    "../shared/detection/enterprise/directoryMetadata.js",
    "../shared/detection/enterprise/internalNetwork.js",
    "../shared/detection/enterprise/fileShares.js",
    "../shared/detection/enterprise/adGroups.js",
    "../shared/detection/enterprise/hostnames.js",
    "../shared/detection/enterprise/identity.js",
    "../shared/detection/enterprise/storageAccounts.js",
    "../shared/detection/enterprise/azureResourceGroups.js",
    "../shared/detection/enterprise/cloudResourceNames.js",
    "../shared/detection/enterprise/index.js",
    "../shared/detection/providers/azure.js",
    "../shared/detection/providers/azureIds.js",
    "../shared/detection/providers/aws.js",
    "../shared/detection/providers/gcp.js",
    "../shared/detection/providers/otcOpenStack.js",
    "../shared/detection/providers/kubernetes.js",
    "../shared/detection/providers/genericEndpoints.js",
    "../shared/detection/providers/index.js",
    "../shared/detection/urlUserinfo.js"
  ];
  const detectionModuleIndexes = detectionModuleScripts.map((script) => scripts.indexOf(script));

  assert.ok(placeholderFamiliesIndex > -1, "scanner should load placeholder family registry");
  assert.ok(placeholdersIndex > -1, "scanner should load placeholder manager");
  assert.ok(detectorIndex > -1, "scanner should load detector");
  assert.ok(
    detectionModuleIndexes.every((index) => index > -1),
    "scanner should load modular enterprise/cloud detection helpers"
  );
  assert.ok(
    placeholderFamiliesIndex < placeholdersIndex &&
      detectionModuleIndexes.every((index) => index < detectorIndex),
    "scanner should load typed placeholder families before placeholders.js and detection modules before detector.js"
  );
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
      scannerHtml.includes("Protected-site upload OCR is on by default for supported image uploads") &&
      scannerHtml.includes("can be turned off in settings") &&
      scannerHtml.includes("flattened redacted PNG only when OCR box confidence is eligible") &&
      scannerHtml.includes("Text PDF scanner results can also export a .redacted.pdf regenerated from sanitized extracted text") &&
      scannerHtml.includes("DOCX scanner results can also export a .redacted.docx regenerated from sanitized extracted text") &&
      scannerHtml.includes("Protected-site DOCX output can hand off a regenerated .redacted.docx when complete") &&
      scannerHtml.includes("truncated or unsafe DOCX regeneration falls back to .redacted.txt or blocks raw upload") &&
      scannerHtml.includes("does not copy original DOCX XML parts") &&
      scannerHtml.includes("XLSX scanner results can also export a .redacted.xlsx regenerated from sanitized extracted text") &&
      scannerHtml.includes("original XLSX XML parts are not copied") &&
      scannerHtml.includes("formulas, charts, styles, comments, hidden sheets, metadata, custom XML, calc chains, and media are not preserved") &&
      scannerHtml.includes("Protected-site XLSX output can hand off a regenerated .redacted.xlsx when complete") &&
      scannerHtml.includes("truncated or unsafe XLSX regeneration falls back to .redacted.txt or blocks raw upload") &&
      scannerHtml.includes("not layout-preserving") &&
      scannerHtml.includes(".redacted.txt remains available as the fallback") &&
      scannerHtml.includes("Protected-site text PDF output can hand off a regenerated .redacted.pdf when complete") &&
      scannerHtml.includes("Scanned PDF OCR") &&
      scannerHtml.includes("layout-preserving PDF/DOCX/XLSX redaction") &&
      scannerHtml.includes("legacy DOC") &&
      scannerHtml.includes("DOCM") &&
      scannerHtml.includes("image format preservation") &&
      scannerHtml.includes("legacy XLS") &&
      scannerHtml.includes("XLSM") &&
      scannerHtml.includes("embedded media") &&
      /visual redaction|redacted PNG/i.test(scannerHtml),
    "scanner UI should explicitly scope English/local/images-only OCR, settings-controlled confidence-gated protected-site OCR, and avoid scanned PDF, legacy XLS, XLSM, media, rebuild, and format-preservation claims"
  );
  assert.ok(
    !/image PDF support|full PDF|full DOCX|full XLSX|full image|layout-preserving DOCX|layout-preserving XLSX|rebuilt image|macro support/i.test(scannerHtml),
    "scanner UI must not claim image-PDF support, macro support, full visual image scanning, layout-preserving DOCX, or full PDF/XLSX/image rebuild support"
  );
  assert.ok(
    scannerHtml.includes("../shared/ocr/ocrRuntime.js") &&
      scannerHtml.includes("../shared/pdfRedactor.js") &&
      scannerHtml.includes("../shared/docxRedactor.js") &&
      scannerHtml.includes("../shared/xlsxRedactor.js") &&
      scannerHtml.includes("../shared/scannerOcr.js") &&
      scannerJs.includes('extension === ".pdf"') &&
      scannerJs.includes('extension === ".docx"') &&
      scannerJs.includes('extension === ".xlsx"') &&
      scannerJs.includes('extension === ".png"') &&
      scannerJs.includes('extension === ".webp"') &&
      scannerJs.includes('redacted.txt') &&
      scannerJs.includes('redacted.pdf') &&
      scannerJs.includes('redacted.docx') &&
      scannerJs.includes('redacted.xlsx') &&
      scannerJs.includes('redacted.png'),
    "scanner redacted exports should keep text fallback, add scanner PDF/DOCX/XLSX regenerated outputs, and keep eligible image visual redaction PNG-only"
  );
  assert.ok(
    scannerHtml.includes("download-redacted-image-btn") &&
      scannerJs.includes("currentRedactedImage") &&
      scannerJs.includes("downloadExistingBlob(currentRedactedImage.blob"),
    "scanner UI should expose the generated redacted image output for download"
  );
}

function testProtectedSiteOcrSettingsCopyIsAccurateAndScoped() {
  assert.ok(
    optionsHtml.includes("Use image OCR for protected-site uploads"),
    "options should expose the protected-site OCR settings label"
  );
  for (const copy of [
    "English-only",
    "local-only",
    "enabled by default",
    "may be slower",
    "images only",
    "flattened .redacted.png",
    "OCR box confidence is eligible",
    "JPG, JPEG, and WEBP inputs are exported as PNG",
    "No scanned PDF OCR",
    "layout-preserving PDF/DOCX/XLSX redaction",
    "original XLSX reconstruction",
    "macro spreadsheet support",
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
    "Protected-site image OCR",
    "enabled by default",
    ".redacted.txt",
    ".redacted.png",
    "no scanned-PDF OCR",
    "no non-English OCR",
    "no remote OCR/backend",
    "no image format preservation",
    "Protected-site PDF output is regenerated from sanitized text only",
    "Protected-site DOCX `.redacted.docx` handoff is limited to safe regenerated output",
    "Scanner and protected-site DOCX can export regenerated `.redacted.docx` from sanitized text only",
    "Scanner and protected-site XLSX can export regenerated `.redacted.xlsx` from sanitized text only",
    "original DOCX XML parts are not copied",
    "Truncated regenerated DOCX files are not handed off",
    "Truncated regenerated XLSX files are not handed off"
  ]) {
    assert.ok(matrixLower.includes(required.toLowerCase()), `capability matrix should include: ${required}`);
  }

  assert.ok(
    /Text PDF[\s\S]*Scanner: `\.redacted\.txt` and regenerated `\.redacted\.pdf`[\s\S]*Protected sites: regenerated `\.redacted\.pdf` only when complete/.test(fileCapabilityMatrix),
    "matrix should state scanner and protected-site text PDFs can export regenerated PDFs with protected-site completeness gating"
  );
  assert.ok(
    /DOCX[\s\S]*Scanner: `\.redacted\.txt` and regenerated `\.redacted\.docx`[\s\S]*Protected sites: regenerated `\.redacted\.docx` only when complete/.test(fileCapabilityMatrix),
    "matrix should state scanner and protected-site DOCX exports regenerated DOCX with protected-site completeness gating"
  );
  assert.ok(
    /XLSX[\s\S]*Scanner: `\.redacted\.txt` and regenerated `\.redacted\.xlsx`[\s\S]*Protected sites: regenerated `\.redacted\.xlsx` only when complete/.test(fileCapabilityMatrix),
    "matrix should state scanner and protected-site XLSX exports regenerated XLSX with protected-site completeness gating"
  );
  assert.ok(
    /Protected-site image OCR[\s\S]*enabled by default[\s\S]*\.redacted\.png/.test(fileCapabilityMatrix),
    "matrix should state protected-site OCR is settings-controlled/default-on and PNG-only for visual upload"
  );
  assert.ok(
    fileCapabilityMatrix.includes("Truncated regenerated PDFs are not handed off"),
    "matrix should state truncated protected-site regenerated PDFs are not handed off"
  );
}

function testUnsupportedProtectedImageReleaseSafetyIsGuarded() {
  assert.ok(
    contentSource.includes("UNSUPPORTED_PROTECTED_IMAGE_EXTENSIONS"),
    "content script should keep an explicit unsupported protected-image denylist"
  );
  assert.ok(
    contentSource.includes('new Set([".gif", ".bmp", ".ico", ".svg"])'),
    "unsupported protected-image denylist should cover GIF, BMP, ICO, and SVG"
  );
  assert.ok(
    contentSource.includes('mimeType.startsWith("image/")'),
    "unsupported protected-image guard should include unsupported image/* MIME types"
  );
  assert.ok(
    contentSource.includes("Raw image upload blocked. This image type is not supported for safe redaction."),
    "protected unsupported image UX should fail closed with clear release-safe copy"
  );
  const blockIndex = contentSource.indexOf("shouldFailClosedProtectedUnsupportedFileTransfer(transferPolicy)");
  const replayIndex = contentSource.indexOf('handOffOriginalLocalFile(event, snapshotDataTransfer, "drop")');
  assert.notStrictEqual(blockIndex, -1, "drop handler should check protected unsupported fail-closed policy");
  if (replayIndex !== -1) {
    assert.ok(blockIndex < replayIndex, "protected unsupported image blocking should run before Gemini raw replay");
  }
}

function testPhase15cProtectedSiteDocxPlanIsSupersededByPhase15eCloseout() {
  assert.ok(fileExists("docs/phase-15c-protected-site-docx-redacted-output-plan.md"), "Phase 15C plan should exist");
  for (const required of [
    "protected-site DOCX uploads only",
    "`.docx` only",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".redacted.docx",
    ".redacted.txt fallback",
    "Gemini/Grok pending attach gates unchanged",
    "do not upload raw DOCX",
    "prefer `.redacted.txt fallback`",
    "not layout-preserving",
    "no original DOCX XML parts copied"
  ]) {
    assert.ok(
      phase15cProtectedSiteDocxPlan.includes(required),
      `Phase 15C plan should include: ${required}`
    );
  }
  assert.ok(fileExists("docs/phase-15e-docx-rebuilt-output-closeout.md"), "Phase 15E DOCX closeout should exist");
  for (const required of [
    "Phase 15D completed",
    "supersedes the Phase 15C planning-only assertions",
    "scanner DOCX `.redacted.docx`",
    "protected-site DOCX `.redacted.docx`",
    "sanitized/redacted extracted text only",
    "not layout-preserving",
    "styles, images, comments, and metadata are not preserved",
    "embedded images are not redacted",
    ".doc, .docm, and macros remain unsupported",
    "Phase 16E supersedes this document's XLSX limitation note",
    "XLSX rebuilt-output status is superseded by Phase 16E",
    ".redacted.txt fallback"
  ]) {
    assert.ok(
      phase15eDocxCloseout.includes(required),
      `Phase 15E closeout should include: ${required}`
    );
  }
}

function testPhase16cProtectedSiteXlsxPlanIsSupersededByPhase16eCloseout() {
  assert.ok(fileExists("docs/phase-16c-protected-site-xlsx-redacted-output-plan.md"), "Phase 16C plan should exist");
  for (const required of [
    "Phase 16D completed protected-site XLSX `.redacted.xlsx` handoff",
    "Phase 16E closeout is tracked",
    "supersedes this document's planning-only status"
  ]) {
    assert.ok(
      phase16cProtectedSiteXlsxPlan.includes(required),
      `Phase 16C plan should include implementation note: ${required}`
    );
  }

  assert.ok(fileExists("docs/phase-16e-xlsx-rebuilt-output-closeout.md"), "Phase 16E XLSX closeout should exist");
  for (const required of [
    "Phase 16D completed",
    "supersedes the Phase 16C planning-only assertions",
    "scanner XLSX `.redacted.xlsx`",
    "protected-site XLSX `.redacted.xlsx`",
    "sanitized/redacted extracted text only",
    "not layout-preserving",
    "Original XLSX XML/OOXML parts are not copied",
    "Formulas, charts, styles, comments, hidden sheets, metadata, custom XML, calc chains, and media are not preserved",
    ".xls, .xlsm, .xlsb, .xltm",
    ".redacted.txt fallback",
    "Truncated or bounded protected-site regenerated XLSX output falls back to sanitized `.redacted.txt`",
    "No raw XLSX extracted text in logs",
    "JSON reports remain sanitized/redacted only",
    "Release packages must not include raw XLSX fixture secrets",
    "Generated XLSX bytes must not include original `xl/sharedStrings.xml`",
    "Gemini/Grok pending attach gates"
  ]) {
    assert.ok(
      phase16eXlsxCloseout.includes(required),
      `Phase 16E closeout should include: ${required}`
    );
  }

  assert.strictEqual(
    /XLSX rebuilds are not supported yet/.test(phase15eDocxCloseout),
    false,
    "productization should not require stale planned-only XLSX wording after Phase 16D"
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
    !testWorkflow.includes("xvfb-run -a npm run smoke:chrome") &&
      !testWorkflow.includes("xvfb-run -a npm run smoke:firefox") &&
      !testWorkflow.includes("xvfb-run -a npm run smoke:edge") &&
      browserNightlyWorkflow.includes("xvfb-run -a npm run test:browser-gates"),
    "PR CI should avoid browser smoke while browser-nightly owns Tier C browser gates"
  );
  assert.ok(
    chromeSmokeSource.includes('remoteDebuggingMode = "port"') &&
    edgeSmokeSource.includes('remoteDebuggingMode: "port"'),
    "Chromium smoke should use port CDP because GitHub browser Linux runs do not reliably answer pipe CDP"
  );
}

function testPhase17aTestingGapAnalysisDocumentsAutomationGaps() {
  assert.ok(fileExists("docs/phase-17a-testing-gap-analysis.md"), "Phase 17A testing gap analysis should exist");

  for (const required of [
    "## Test Entry Point Inventory",
    "## Current Coverage Strengths",
    "## Gap Matrix",
    "## P0 Gaps",
    "## P1 Gaps",
    "## P2 Gaps",
    "scanner",
    "protected-site",
    "PDF",
    "DOCX",
    "XLSX",
    "OCR",
    "adapters",
    "security",
    "package"
  ]) {
    assert.ok(
      phase17aTestingGapAnalysis.includes(required),
      `Phase 17A testing gap analysis should include: ${required}`
    );
  }
}

function testPhase17bBrowserAutomationDocumentsP0Coverage() {
  assert.ok(fileExists("docs/phase-17b-p0-browser-automation.md"), "Phase 17B browser automation doc should exist");

  for (const required of [
    "file drop",
    "file picker",
    "scanner downloads",
    "raw marker sweep",
    "reload/session cache",
    "synthetic provider",
    "no raw upload"
  ]) {
    assert.ok(
      phase17bBrowserAutomation.includes(required),
      `Phase 17B browser automation doc should include: ${required}`
    );
  }
}

function testPhase17cProviderBrowserParityAutomationIsDocumented() {
  assert.ok(
    fileExists("docs/phase-17c-provider-browser-parity-automation.md"),
    "Phase 17C provider/browser parity automation doc should exist"
  );

  for (const required of [
    "Chrome",
    "Firefox",
    "Edge",
    "ChatGPT/OpenAI",
    "Gemini",
    "Grok",
    "Claude",
    "X",
    "synthetic provider",
    "file picker",
    "file drop",
    "typed",
    "paste",
    "contenteditable",
    "rebuilt file handoff",
    "fail-closed behavior"
  ]) {
    assert.ok(
      phase17cProviderBrowserParity.includes(required),
      `Phase 17C provider/browser parity doc should include: ${required}`
    );
  }
}

function testPhase17dCorruptedLargeFileFuzzAutomationIsDocumented() {
  assert.ok(
    fileExists("docs/phase-17d-corrupted-large-file-fuzz-automation.md"),
    "Phase 17D corrupted/large-file fuzz automation doc should exist"
  );

  for (const required of [
    "malformed PDF",
    "malformed DOCX",
    "malformed XLSX",
    "oversized",
    "deterministic seed",
    "raw marker sweep",
    "fail closed",
    "no raw upload",
    "scanner",
    "protected-site"
  ]) {
    assert.ok(
      phase17dCorruptedLargeFileFuzz.includes(required),
      `Phase 17D fuzz automation doc should include: ${required}`
    );
  }
}

function testPhase17eReleaseArtifactStoreReadinessAutomationIsDocumented() {
  assert.ok(
    fileExists("docs/phase-17e-release-artifact-store-readiness-automation.md"),
    "Phase 17E release artifact/store-readiness automation doc should exist"
  );

  for (const required of [
    "release artifact",
    "store-readiness",
    "dist/chrome",
    "dist/firefox",
    "artifacts/release",
    "manifest.json",
    "unsafe-eval",
    "web_accessible_resources",
    "local-only processing",
    "no backend",
    "no telemetry",
    "no remote OCR",
    "no cloud verification",
    "English-only",
    "settings-controlled/default-on",
    ".redacted.txt",
    "raw marker",
    "secret",
    "size",
    "file count",
    "release blockers",
    "test:release-artifacts"
  ]) {
    assert.ok(
      phase17eReleaseArtifactStoreReadiness.includes(required),
      `Phase 17E release artifact/store-readiness doc should include: ${required}`
    );
  }
  assert.strictEqual(
    packageJson.scripts["test:release-artifacts"],
    "node tests/release_artifacts.test.js",
    "package.json should expose Phase 17E release artifact automation"
  );
}

function testPhase17fCiNightlyMatrixHardeningIsDocumented() {
  assert.ok(
    fileExists("docs/phase-17f-ci-nightly-matrix-hardening.md"),
    "Phase 17F CI/nightly matrix hardening doc should exist"
  );

  for (const required of [
    "Tier A",
    "fast PR checks",
    "Tier B",
    "release artifact checks",
    "Tier C",
    "browser/nightly checks",
    "test:fast",
    "test:release-gates",
    "test:browser-gates",
    "test:nightly",
    "test:ci",
    "privacy contact release blocker",
    "Chrome executable",
    "Edge executable",
    "Firefox executable",
    "geckodriver",
    "GPU/CDP",
    "environment failure",
    "product failure"
  ]) {
    assert.ok(
      phase17fCiNightlyMatrix.includes(required),
      `Phase 17F CI/nightly matrix doc should include: ${required}`
    );
  }
}

function testPhase17fScriptsAndWorkflowsAreTiered() {
  assert.strictEqual(
    packageJson.scripts["test:fast"],
    "npm test && node tests/productization.test.js && node tests/security.test.js && node tests/build_targets.test.js",
    "test:fast should own Tier A fast PR validation"
  );
  assert.strictEqual(
    packageJson.scripts["test:release-gates"],
    "npm run build:all && npm run package:release && npm run test:release-artifacts && npm run bench:file-extraction",
    "test:release-gates should own Tier B release artifact validation"
  );
  assert.strictEqual(
    packageJson.scripts["test:browser-gates"],
    "node scripts/check-browser-environment.mjs && npm run smoke:chrome && npm run smoke:firefox && npm run smoke:edge && npm run qa:browser && node tests/browser/extension_qa_harness.test.mjs",
    "test:browser-gates should own Tier C browser validation"
  );
  assert.strictEqual(
    packageJson.scripts["test:nightly"],
    "npm run test:fast && npm run test:release-gates && npm run test:browser-gates",
    "test:nightly should compose all tiers"
  );
  assert.strictEqual(
    packageJson.scripts["test:ci"],
    "npm run test:fast",
    "test:ci should stay PR-safe and avoid browser flake by default"
  );
  assert.ok(
    packageJson.scripts["preflight:browser"] === "node scripts/check-browser-environment.mjs",
    "preflight:browser should expose browser environment diagnostics"
  );

  assert.ok(testWorkflow.includes("npm run test:ci"), "PR workflow should run Tier A through test:ci");
  assert.strictEqual(
    /smoke:(?:chrome|firefox|edge)|qa:browser/.test(testWorkflow),
    false,
    "PR workflow should not run browser smoke/QA on every PR"
  );
  assert.ok(
    releaseArtifactsWorkflow.includes("npm run test:fast") &&
      releaseArtifactsWorkflow.includes("npm run test:release-gates"),
    "release workflow should run Tier A and Tier B"
  );
  assert.ok(
    releaseArtifactsWorkflow.includes("workflow_dispatch") && releaseArtifactsWorkflow.includes("schedule"),
    "release workflow should support manual and scheduled runs"
  );
}

function testPublicationContactsAreFinalized() {
  const finalizedContact = "petritbahtiri24@gmail.com";
  for (const [label, text] of Object.entries({
    privacyPolicy,
    releaseChecklist,
    phase18FinalPrStabilizationCloseout
  })) {
    assert.strictEqual(
      /Release blocker: publication contacts are not finalized|publication contacts are not finalized|NO until contact blocker resolved|TODO|TBD|CONTACT_PLACEHOLDER|contact@example\.com|your-email@example\.com/i.test(text),
      false,
      `${label} should not contain unresolved publication-contact blocker or placeholder text`
    );
  }
  for (const prefix of ["Support", "Privacy", "Security"]) {
    assert.ok(
      privacyPolicy.includes(`${prefix}: ${finalizedContact}`),
      `privacy policy should include finalized ${prefix.toLowerCase()} contact`
    );
  }
  assert.ok(
    releaseChecklist.includes("publication contacts are finalized") &&
      releaseChecklist.includes(finalizedContact),
    "release QA checklist should mark publication contacts finalized"
  );
}

function testPhase18FinalPrStabilizationCloseoutIsDocumented() {
  assert.ok(
    fileExists("docs/phase-18-final-pr-stabilization-closeout.md"),
    "Phase 18 final PR stabilization closeout should exist"
  );

  for (const required of [
    "Dirty Tree Inventory",
    "Files to Include",
    "Files to Exclude/Review",
    "Generated Artifact Status",
    "Release Blocker Status",
    "Publication contact blocker is resolved",
    "Support: `petritbahtiri24@gmail.com`",
    "Privacy: `petritbahtiri24@gmail.com`",
    "Security: `petritbahtiri24@gmail.com`",
    "Suggested PR Title",
    "Suggested PR Body",
    "Store/Publish Readiness Checklist",
    "privacy contacts finalized: YES",
    "human store listing review required: YES",
    "release publish-ready: YES after human store listing review"
  ]) {
    assert.ok(
      phase18FinalPrStabilizationCloseout.includes(required),
      `Phase 18 closeout should include: ${required}`
    );
  }
}

function testPhase19ManualReleaseQaChecklistIsDocumented() {
  assert.ok(
    fileExists("docs/phase-19-manual-release-qa-checklist.md"),
    "Phase 19 manual release QA checklist should exist"
  );

  for (const required of [
    "Chrome",
    "Firefox",
    "scanner",
    "protected-site",
    "ChatGPT",
    "Gemini",
    "Grok",
    "privacy policy",
    "go/no-go",
    "Supported image redaction formats: PNG, JPG, JPEG, and WEBP",
    "Gemini image upload check",
    "Open the redacted image",
    "search for the raw fake secret",
    "NO-GO if image OCR, visual redaction, sanitized export, or provider handoff fails"
  ]) {
    assert.ok(
      phase19ManualReleaseQaChecklist.includes(required),
      `Phase 19 manual release QA checklist should include: ${required}`
    );
  }
}

function testPhase19LiveBrowserQaCloseoutAlignsProductization() {
  assert.ok(
    fileExists("docs/phase-19-live-browser-mcp-qa-results.md"),
    "Phase 19 live-browser MCP QA results should exist"
  );

  for (const required of [
    "## Closeout Alignment",
    "Chrome: GO for release readiness after human store listing review",
    "Edge: LIMITED GO for basic Chromium compatibility",
    "Edge live-provider claims require manual retest",
    "No P0 raw leak found",
    "No proven P1 provider/fail-closed bug found",
    "Live provider file upload was not attempted without QA/test accounts",
    "Screenshots were intentionally skipped to avoid capturing account/bot-check data"
  ]) {
    assert.ok(
      phase19LiveBrowserQaResults.includes(required),
      `Phase 19 live-browser QA closeout should include: ${required}`
    );
  }

  for (const required of [
    "Chrome live QA completed",
    "Edge basic Chromium compatibility completed",
    "Edge live-provider retest remains a follow-up before strong Edge claims",
    "Human store listing review remains required before Chrome publishing"
  ]) {
    assert.ok(
      releaseChecklist.includes(required),
      `release QA checklist should include Phase 19 live QA status: ${required}`
    );
  }
}

function testPhase20aQualityPerformanceSecurityPlanIsDocumented() {
  assert.ok(
    fileExists("docs/phase-20a-quality-performance-security-plan.md"),
    "Phase 20A quality/performance/security plan should exist"
  );

  for (const required of [
    "Quality",
    "Performance",
    "Security",
    "rollback",
    "behavior is proven unchanged",
    "Detector rule changes",
    "No permissions",
    "no backend calls",
    "remote calls",
    "telemetry"
  ]) {
    assert.ok(
      phase20aQualityPerformanceSecurityPlan.includes(required),
      `Phase 20A quality/performance/security plan should include: ${required}`
    );
  }
}

function testPhase20cQualityPerformanceSecurityCloseoutIsDocumented() {
  assert.ok(
    fileExists("docs/phase-20c-quality-performance-security-closeout.md"),
    "Phase 20C quality/performance/security closeout should exist"
  );

  for (const required of [
    "Performance",
    "Quality",
    "Security",
    "detector",
    "file extraction",
    "XLSX",
    "OCR",
    "deferred",
    "rollback",
    "no behavior change"
  ]) {
    assert.ok(
      phase20cQualityPerformanceSecurityCloseout.includes(required),
      `Phase 20C quality/performance/security closeout should include: ${required}`
    );
  }
}

function testPhase17fBrowserDiagnosticsAreActionable() {
  assert.ok(fileExists("scripts/check-browser-environment.mjs"), "browser preflight script should exist");
  const preflightSource = fs.readFileSync(path.join(repoRoot, "scripts/check-browser-environment.mjs"), "utf8");

  for (const required of [
    "Chrome executable",
    "Edge executable",
    "Firefox executable",
    "geckodriver",
    "temp profile directory",
    "headless",
    "environment failure"
  ]) {
    assert.ok(preflightSource.includes(required), `browser preflight should include: ${required}`);
  }

  for (const required of [
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--headless=new",
    "environment failure",
    "browser crashed before extension load",
    "stderr log"
  ]) {
    assert.ok(chromeSmokeSource.includes(required), `Chromium smoke diagnostics should include: ${required}`);
  }
  assert.ok(edgeSmokeSource.includes("runChromiumSmoke"), "Edge smoke should continue using Chromium smoke diagnostics");
  for (const required of [
    "geckodriver version",
    "Firefox version",
    "status endpoint",
    "environment failure",
    "run smoke:firefox alone"
  ]) {
    assert.ok(firefoxSmokeSource.includes(required), `Firefox smoke diagnostics should include: ${required}`);
  }
}

function testCodexCloudReleaseValidationEnvironmentIsDocumented() {
  const docPath = "docs/codex-cloud-release-validation-environment.md";
  const setupPath = "scripts/setup-codex-cloud-release-env.mjs";
  const validatePath = "scripts/validate-codex-cloud-release-env.mjs";
  assert.ok(fileExists(docPath), "Codex Cloud release validation environment doc should exist");
  assert.ok(fileExists(setupPath), "Codex Cloud release environment setup script should exist");
  assert.ok(fileExists(validatePath), "Codex Cloud release environment validation script should exist");
  assert.strictEqual(
    packageJson.scripts["setup:codex-release-env"],
    "node scripts/setup-codex-cloud-release-env.mjs",
    "package.json should expose the Codex Cloud release environment setup script"
  );
  assert.strictEqual(
    packageJson.scripts["validate:codex-release-env"],
    "node scripts/validate-codex-cloud-release-env.mjs",
    "package.json should expose the Codex Cloud release environment validation script"
  );

  const doc = fs.readFileSync(path.join(repoRoot, docPath), "utf8");
  for (const required of [
    "proxy",
    "pip",
    "browser binaries",
    "Chromium fallback",
    "Chrome Web Store release validation",
    "Do not claim full Chrome or Edge release GO from Chromium-only validation",
    "npm run validate:codex-release-env",
    "npm run build:all",
    "npm run test:browser-gates"
  ]) {
    assert.ok(doc.includes(required), `Codex Cloud environment doc should include: ${required}`);
  }

  const setupSource = fs.readFileSync(path.join(repoRoot, setupPath), "utf8");
  for (const required of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "joblib",
    "playwright install --with-deps",
    "Chromium fallback",
    "SETUP FAILURE"
  ]) {
    assert.ok(setupSource.includes(required), `Codex Cloud setup script should include: ${required}`);
  }

  const validateSource = fs.readFileSync(path.join(repoRoot, validatePath), "utf8");
  for (const required of [
    "PASS",
    "FAIL",
    "remediation",
    "scripts/check-browser-environment.mjs",
    "Build prerequisites before prepare:build",
    "Chrome/Chromium launch sanity"
  ]) {
    assert.ok(validateSource.includes(required), `Codex Cloud validation script should include: ${required}`);
  }
}

async function run() {
  const { buildManifest } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
  );
  const manifest = buildManifest("chrome", "consumer");

  testManifestBrandingAndProductPagesExist(manifest);
  testLeakGuardBrandingShowsUpInUiAndDocs();
  testScannerLoadsTypedDetectionRuntimeBeforeDetector();
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
  testUnsupportedProtectedImageReleaseSafetyIsGuarded();
  testPhase15cProtectedSiteDocxPlanIsSupersededByPhase15eCloseout();
  testPhase16cProtectedSiteXlsxPlanIsSupersededByPhase16eCloseout();
  testPhase14cProtectedSitePdfPlanIsPlanningOnly();
  testPublicDocsAlignWithCurrentFileCapabilities();
  testBrowserQaScriptOwnsFirefoxSmokeCoverage();
  testPhase17aTestingGapAnalysisDocumentsAutomationGaps();
  testPhase17bBrowserAutomationDocumentsP0Coverage();
  testPhase17cProviderBrowserParityAutomationIsDocumented();
  testPhase17dCorruptedLargeFileFuzzAutomationIsDocumented();
  testPhase17eReleaseArtifactStoreReadinessAutomationIsDocumented();
  testPhase17fCiNightlyMatrixHardeningIsDocumented();
  testPhase17fScriptsAndWorkflowsAreTiered();
  testPublicationContactsAreFinalized();
  testPhase18FinalPrStabilizationCloseoutIsDocumented();
  testPhase19ManualReleaseQaChecklistIsDocumented();
  testPhase19LiveBrowserQaCloseoutAlignsProductization();
  testPhase20aQualityPerformanceSecurityPlanIsDocumented();
  testPhase20cQualityPerformanceSecurityCloseoutIsDocumented();
  testPhase17fBrowserDiagnosticsAreActionable();
  testCodexCloudReleaseValidationEnvironmentIsDocumented();
  console.log("PASS productization static regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
