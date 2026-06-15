const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const repoRoot = path.join(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");
const releaseRoot = path.join(repoRoot, "artifacts", "release");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

const defaultDistTargets = ["chrome", "firefox"];
const optionalDistTargets = ["edge"];
const releaseTargets = ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"];
const expectedRuntimeFiles = [
  "manifest.json",
  "background/core.js",
  "compat/browser_api.js",
  "content/content.js",
  "content/overlay.css",
  "popup/popup.html",
  "popup/popup.js",
  "options/options.html",
  "options/options.js",
  "scanner/scanner.html",
  "scanner/scanner.js",
  "shared/fileScanner.js",
  "shared/fileExtractors.js",
  "shared/pdfRedactor.js",
  "shared/docxRedactor.js",
  "shared/xlsxRedactor.js",
  "shared/ocr/ocrRuntime.js",
  "shared/ocr/ocrWorker.js",
  "shared/ocr/tesseract-core/tesseract-core.js",
  "shared/ocr/tesseract-core/tesseract-core.wasm",
  "shared/ocr/tessdata/eng.traineddata.gz",
  "shared/scannerOcr.js",
  "shared/imageRedactor.js",
  "content/files/protectedSiteOcrBroker.js",
  "content/files/contentFileExtractionPipeline.js",
  "content/protected_site_ocr_broker.html",
  "content/protected_site_ocr_broker_page.js",
  "vendor/onnxruntime/ort.wasm.min.js",
  "vendor/onnxruntime/ort-wasm-simd-threaded.wasm",
  "ai/models/leakguard_secret_classifier.onnx"
];
const allowedPermissions = ["activeTab", "downloads", "scripting", "storage"];
const allowedOptionalHostPermissions = ["http://*/*", "https://*/*"];
const allowedWebAccessibleResources = [
  "ai/models/leakguard_secret_classifier.features.json",
  "ai/models/leakguard_secret_classifier.onnx",
  "vendor/onnxruntime/ort-wasm-simd-threaded.mjs",
  "vendor/onnxruntime/ort-wasm-simd-threaded.wasm",
  "shared/ocr/ocrWorker.js",
  "shared/ocr/ocrWasmProbe.wasm",
  "shared/ocr/tesseract-core/tesseract-core.js",
  "shared/ocr/tesseract-core/tesseract-core.wasm",
  "shared/ocr/tessdata/eng.traineddata.gz",
  "shared/ocr/fixtures/synthetic-test-ocr.png",
  "content/protected_site_ocr_broker.html",
  "content/protected_site_ocr_broker_page.js"
];
const forbiddenPackagePathPatterns = [
  /(?:^|\/)\.env(?:$|\/)/i,
  /(?:^|\/)node_modules(?:$|\/)/i,
  /(?:^|\/)tests?(?:$|\/)/i,
  /(?:^|\/)fixtures?(?:$|\/)/i,
  /(?:^|\/)raw[-_ ]?fixtures?(?:$|\/)/i,
  /(?:^|\/)docs?(?:$|\/)/i,
  /(?:^|\/)package-lock\.json$/i,
  /(?:^|\/)pnpm-lock\.yaml$/i,
  /(?:^|\/)yarn\.lock$/i,
  /(?:^|\/)package\.json$/i,
  /(?:^|\/)screenshots?(?:$|\/)/i,
  /(?:^|\/)tmp(?:$|\/)/i,
  /(?:^|\/)temp(?:$|\/)/i,
  /\.(?:map|pem|p12|pfx|crt|key)$/i
];
const secretPatterns = [
  /OPENAI_API_KEY=/,
  /ANTHROPIC_API_KEY=/,
  /GITHUB_TOKEN=/,
  /STRIPE_SECRET_KEY=/,
  /DATABASE_URL=/,
  /AWS_ACCESS_KEY_ID=/,
  /AWS_SECRET_ACCESS_KEY=/,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/
];
const remoteCodePatterns = [
  /https?:\/\/[^"'\s)]+\.js\b/i,
  /importScripts\s*\(\s*["']https?:\/\//i,
  /import\s*\(\s*["']https?:\/\//i
];
const syntheticRawMarkers = [
  "LeakGuardBrowserPathRawSecret",
  "LeakGuardProviderParityRawSecret",
  "LeakGuardFuzzRawSecret",
  "LeakGuardSyntheticRawSecret",
  "LeakGuardScannerOcrApiKey"
];
const sizeWarningBytes = 50 * 1024 * 1024;
const sizeHardGateBytes = 100 * 1024 * 1024;

function walkFiles(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function toPackagePath(file) {
  return file.split(path.sep).join("/");
}

function readZipEntries(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  assert.notStrictEqual(eocdOffset, -1, `${zipPath} should contain a ZIP end-of-central-directory record`);

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    assert.strictEqual(buffer.readUInt32LE(cursor), 0x02014b50, `${zipPath} central directory entry ${index}`);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8")
      .replace(/\\/g, "/");
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let content = null;
    if (method === 0) content = compressed;
    if (method === 8) content = zlib.inflateRawSync(compressed);
    assert.ok(content, `${zipPath}:${name} should use stored or deflated ZIP compression`);
    assert.strictEqual(content.length, uncompressedSize, `${zipPath}:${name} uncompressed size should match`);
    entries.push({ name, content, size: uncompressedSize });
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readPackageEntries(rootDir) {
  return walkFiles(rootDir).map((file) => ({
    name: toPackagePath(path.relative(rootDir, file)),
    content: fs.readFileSync(file),
    size: fs.statSync(file).size
  }));
}

function readText(entry) {
  if (!/\.(?:js|json|html|css|txt|md|svg)$/i.test(entry.name)) return null;
  return entry.content.toString("utf8");
}

function assertPackageHygiene(label, entries) {
  const names = entries.map((entry) => entry.name).sort();
  assert.ok(names.includes("manifest.json"), `${label} should include manifest.json`);
  for (const expected of expectedRuntimeFiles) {
    assert.ok(names.includes(expected), `${label} should include expected runtime file ${expected}`);
  }
  for (const name of names) {
    const allowedPackagedFixture = name === "shared/ocr/fixtures/synthetic-test-ocr.png";
    for (const pattern of forbiddenPackagePathPatterns) {
      if (allowedPackagedFixture && /fixtures/.test(String(pattern))) continue;
      assert.strictEqual(pattern.test(name), false, `${label} should not package forbidden file ${name}`);
    }
  }
  for (const entry of entries) {
    const text = readText(entry);
    if (!text) continue;
    assert.strictEqual(text.includes("sourceMappingURL"), false, `${label}:${entry.name} should not reference sourcemaps`);
    for (const pattern of secretPatterns) {
      const allowedDetectorPatternReference = entry.name === "shared/patterns.js" && pattern.source.includes("PRIVATE KEY");
      if (allowedDetectorPatternReference) continue;
      assert.strictEqual(pattern.test(text), false, `${label}:${entry.name} should not contain ${pattern}`);
    }
    for (const marker of syntheticRawMarkers) {
      const allowedSyntheticOcrFixture =
        entry.name === "shared/ocr/fixtures/synthetic-test-ocr.png" ||
        (entry.name === "shared/ocr/ocrWorker.js" && marker === "LeakGuardScannerOcrApiKey");
      if (!allowedSyntheticOcrFixture) {
        assert.strictEqual(text.includes(marker), false, `${label}:${entry.name} should not contain raw test marker ${marker}`);
      }
    }
    for (const pattern of remoteCodePatterns) {
      assert.strictEqual(pattern.test(text), false, `${label}:${entry.name} should not contain remote code URL ${pattern}`);
    }
  }
}

function assertManifestSecurity(label, entries) {
  const manifestEntry = entries.find((entry) => entry.name === "manifest.json");
  assert.ok(manifestEntry, `${label} should include manifest.json`);
  const manifest = JSON.parse(manifestEntry.content.toString("utf8"));

  assert.strictEqual(manifest.manifest_version, 3, `${label} should remain MV3`);
  assert.deepStrictEqual([...(manifest.permissions || [])].sort(), allowedPermissions, `${label} should not add broad permissions`);
  assert.deepStrictEqual(
    [...(manifest.optional_host_permissions || [])].sort(),
    allowedOptionalHostPermissions,
    `${label} host permissions should remain optional/user-managed`
  );
  const hasExpectedBackground =
    manifest.background?.service_worker === "background/service_worker.js" ||
    (Array.isArray(manifest.background?.scripts) && manifest.background.scripts.includes("background/core.js"));
  assert.ok(hasExpectedBackground, `${label} should declare the expected local background entry point`);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(manifest.background || {}, "page"), false, `${label} must not use MV2 background pages`);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(manifest, "externally_connectable"), false, `${label} should not expose externally_connectable`);

  const cspText = JSON.stringify(manifest.content_security_policy || {});
  assert.strictEqual(cspText.includes("'unsafe-eval'"), false, `${label} CSP must not include unsafe-eval`);
  assert.ok(cspText.includes("'wasm-unsafe-eval'"), `${label} CSP should document local WASM allowance for OCR/ONNX assets`);
  assert.strictEqual(/https?:\/\/|wss?:\/\/|cdn|unpkg/i.test(cspText), false, `${label} CSP must not allow remote code origins`);

  const resources = (manifest.web_accessible_resources || []).flatMap((entry) => entry.resources || []).sort();
  assert.deepStrictEqual(resources, [...allowedWebAccessibleResources].sort(), `${label} web_accessible_resources should stay narrow`);
}

function assertStoreDocsConsistency() {
  const finalizedContact = "petritbahtiri24@gmail.com";
  const docs = {
    README: fs.readFileSync(path.join(repoRoot, "README.md"), "utf8"),
    PRIVACY_POLICY: fs.readFileSync(path.join(repoRoot, "docs/PRIVACY_POLICY.md"), "utf8"),
    CHROME_WEB_STORE_LISTING: fs.readFileSync(path.join(repoRoot, "docs/CHROME_WEB_STORE_LISTING.md"), "utf8"),
    FIREFOX_AMO_CHECKLIST: fs.readFileSync(path.join(repoRoot, "docs/FIREFOX_AMO_CHECKLIST.md"), "utf8"),
    RELEASE_QA_CHECKLIST: fs.readFileSync(path.join(repoRoot, "docs/RELEASE_QA_CHECKLIST.md"), "utf8"),
    THREAT_MODEL: fs.readFileSync(path.join(repoRoot, "docs/THREAT_MODEL.md"), "utf8"),
    PROTECTED_SITES_GUIDE: fs.readFileSync(path.join(repoRoot, "docs/PROTECTED_SITES_GUIDE.md"), "utf8"),
    OCR_BUILD_STRATEGY: fs.readFileSync(path.join(repoRoot, "docs/OCR_BUILD_STRATEGY.md"), "utf8"),
    FILE_CAPABILITY_MATRIX: fs.readFileSync(path.join(repoRoot, "docs/FILE_CAPABILITY_MATRIX.md"), "utf8")
  };
  const requiredPatterns = [
    /local-only|locally|local processing/i,
    /no backend|does not use a backend|remote OCR\/backend|backend[\s\S]{0,24}processing/i,
    /no telemetry|does not use telemetry|does not collect telemetry|telemetry/i,
    /remote OCR/i,
    /cloud verification|remote verification|cloud processing/i,
    /English-only/i,
    /settings-controlled|enabled by default|can be turned off|opt-in|default off/i,
    /\.redacted\.(?:png|pdf|docx|xlsx)/i,
    /not layout-preserving|layout-preserving|does not preserve .*layout|no .*layout preservation|layout preservation/i,
    /unsupported|not supported|limitations/i,
    /\.redacted\.txt/i
  ];
  for (const [label, text] of Object.entries(docs)) {
    for (const pattern of requiredPatterns) {
      assert.ok(pattern.test(text), `${label} should cover release/store privacy claim: ${pattern}`);
    }
  }

  const blockers = [];
  for (const [label, text] of Object.entries(docs)) {
    const matches =
      text.match(
        /\b(?:TODO|TBD|CONTACT_PLACEHOLDER|contact@example\.com|your-email@example\.com)\b|Release blocker: publication contacts are not finalized/gi
      ) || [];
    if (matches.length) blockers.push(`${label}: ${[...new Set(matches)].join(", ")}`);
  }
  for (const prefix of ["Support", "Privacy", "Security"]) {
    assert.ok(
      docs.PRIVACY_POLICY.includes(`${prefix}: ${finalizedContact}`),
      `PRIVACY_POLICY should include finalized ${prefix.toLowerCase()} contact`
    );
  }
  assert.deepStrictEqual(blockers, [], `release docs should not contain unresolved blockers: ${blockers.join("; ")}`);
}

function summarizePackage(label, entries, packageBytes) {
  const largest = [...entries]
    .sort((left, right) => right.size - left.size)
    .slice(0, 5)
    .map((entry) => `${entry.name}=${entry.size}`);
  console.log(`${label}: bytes=${packageBytes} files=${entries.length} largest=${largest.join(", ")}`);
  assert.ok(packageBytes < sizeHardGateBytes, `${label} must stay below hard release package gate`);
  if (packageBytes > sizeWarningBytes) {
    console.warn(`${label} exceeds release package warning gate: ${packageBytes}`);
  }
  const ocrEntries = entries.filter((entry) => entry.name.startsWith("shared/ocr/"));
  assert.ok(ocrEntries.length > 0, `${label} should include expected local OCR assets`);
  assert.ok(
    ocrEntries.some((entry) => entry.name === "shared/ocr/tessdata/eng.traineddata.gz"),
    `${label} should include local English OCR traineddata`
  );
}

function run() {
  assert.strictEqual(
    packageJson.scripts?.["test:release-artifacts"],
    "node tests/release_artifacts.test.js",
    "package.json should expose the focused release artifact test script"
  );
  assert.ok(
    fs.existsSync(path.join(repoRoot, "docs/phase-17e-release-artifact-store-readiness-automation.md")),
    "Phase 17E release artifact/store-readiness automation doc should exist"
  );

  for (const target of [...defaultDistTargets, ...optionalDistTargets]) {
    const targetRoot = path.join(distRoot, target);
    if (!fs.existsSync(targetRoot)) {
      assert.ok(optionalDistTargets.includes(target), `dist/${target} should exist before release artifact inspection`);
      continue;
    }
    const entries = readPackageEntries(targetRoot);
    assertPackageHygiene(`dist/${target}`, entries);
    assertManifestSecurity(`dist/${target}`, entries);
    summarizePackage(`dist/${target}`, entries, entries.reduce((total, entry) => total + entry.size, 0));
  }

  for (const target of releaseTargets) {
    const zipPath = path.join(releaseRoot, `leakguard-${target}-v${packageJson.version}.zip`);
    assert.ok(fs.existsSync(zipPath), `${zipPath} should exist before release artifact inspection`);
    const entries = readZipEntries(zipPath);
    assertPackageHygiene(`release/${path.basename(zipPath)}`, entries);
    assertManifestSecurity(`release/${path.basename(zipPath)}`, entries);
    summarizePackage(`release/${path.basename(zipPath)}`, entries, fs.statSync(zipPath).size);
  }

  assertStoreDocsConsistency();
  console.log("PASS release artifact and store-readiness checks");
}

run();
