#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.join(__dirname, "..");
const sourceRoot = path.join(repoRoot, "src");
const manifestsRoot = path.join(repoRoot, "manifests");
const distRoot = path.join(repoRoot, "dist");
const assetDirs = ["background", "content", "popup", "options", "ui", "scanner", "shared", "compat"];
const staticDirs = ["icons", "config", "ai/models"];
const onnxRuntimeFiles = [
  "ort.wasm.min.js",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm"
];
const onnxRuntimeSidecarPattern = /^ort-wasm-simd-threaded\.(?:mjs|wasm)$/;
const BUILD_TARGETS = Object.freeze([
  Object.freeze({ browser: "chrome", mode: "consumer", folder: "chrome" }),
  Object.freeze({ browser: "chrome", mode: "enterprise", folder: "chrome-enterprise" }),
  Object.freeze({ browser: "firefox", mode: "consumer", folder: "firefox" }),
  Object.freeze({ browser: "firefox", mode: "enterprise", folder: "firefox-enterprise" })
]);
const OCR_SIZE_BUDGETS = Object.freeze({
  currentInstalledWarningBytes: 50 * 1024 * 1024,
  hardReviewInstalledBytes: 100 * 1024 * 1024,
  firefoxUploadHardLimitBytes: 200 * 1000 * 1000,
  chromeZipHardLimitBytes: 2 * 1024 * 1024 * 1024
});
const supportedBrowsers = new Set(BUILD_TARGETS.map((target) => target.browser));
const supportedModes = new Set(BUILD_TARGETS.map((target) => target.mode));

function pathExists(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getOnnxRuntimeDistDir() {
  return path.join(repoRoot, "node_modules", "onnxruntime-web", "dist");
}

function listOnnxRuntimeFiles() {
  const sourceDir = getOnnxRuntimeDistDir();
  if (!pathExists(sourceDir)) {
    throw new Error(
      `Missing ONNX Runtime browser assets at ${sourceDir}. Run "npm install" before building.`
    );
  }

  const files = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  for (const file of onnxRuntimeFiles) {
    if (!files.includes(file)) {
      throw new Error(`Missing ONNX Runtime loader asset ${path.join(sourceDir, file)}.`);
    }
  }

  return [...onnxRuntimeFiles].sort();
}

function getOnnxRuntimeWebAccessibleResources() {
  return listOnnxRuntimeFiles()
    .filter((file) => onnxRuntimeSidecarPattern.test(file))
    .map((file) => `vendor/onnxruntime/${file}`);
}

function mergeValue(baseValue, overrideValue) {
  if (overrideValue === null) {
    return undefined;
  }

  if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
    return overrideValue;
  }

  if (
    baseValue &&
    overrideValue &&
    typeof baseValue === "object" &&
    typeof overrideValue === "object"
  ) {
    const output = { ...baseValue };
    for (const [key, value] of Object.entries(overrideValue)) {
      const merged = mergeValue(baseValue[key], value);
      if (merged === undefined) {
        delete output[key];
      } else {
        output[key] = merged;
      }
    }
    return output;
  }

  return overrideValue === undefined ? baseValue : overrideValue;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function copyDirContents(sourceDir, targetDir) {
  ensureDir(targetDir);
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function walkFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function replaceFunctionSource(source, functionName, replacement = "") {
  const signature = `  function ${functionName}`;
  const start = source.indexOf(signature);
  if (start === -1) {
    throw new Error(`Expected ${functionName}() in content script before release sanitization.`);
  }

  const bodyStart = source.indexOf("{", start);
  if (bodyStart === -1) {
    throw new Error(`Could not locate ${functionName}() body for release sanitization.`);
  }

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return `${source.slice(0, start)}${replacement}${source.slice(index + 1)}`;
      }
    }
  }

  throw new Error(`Could not replace ${functionName}() for release sanitization.`);
}

function stripContentDebugDiagnostics(targetRoot) {
  const contentPath = path.join(targetRoot, "content", "content.js");
  let source = fs.readFileSync(contentPath, "utf8");

  source = replaceFunctionSource(source, "isDebugEnabled", "  function leakGuardBuildNoop() {}\n");
  for (const functionName of [
    "debugLogSnapshot",
    "debugReveal",
    "debugFileAttachMetadata",
    "debugResponseRehydration",
    "debugRewriteVerification",
    "logFailureDetails",
    "logFileInterception"
  ]) {
    source = replaceFunctionSource(source, functionName);
  }

  source = source
    .replace(/^\s*emitDebug:\s*debugReveal,\r?\n/gm, "")
    .replace(/^\s*emitFileAttachMetadata:\s*debugFileAttachMetadata,\r?\n/gm, "")
    .replace(/^\s*debug:\s*debugReveal,\r?\n/gm, "")
    .replace(/^\s*debug:\s*debugResponseRehydration,\r?\n/gm, "")
    .replace(/^\s*debug:\s*debugRewriteVerification,?\r?\n/gm, "")
    .replace(/\bdebugLogSnapshot\s*\(/g, "false && leakGuardBuildNoop(")
    .replace(/\bdebugReveal\s*\(/g, "false && leakGuardBuildNoop(")
    .replace(/\bdebugFileAttachMetadata\s*\(/g, "false && leakGuardBuildNoop(")
    .replace(/\bdebugResponseRehydration\s*\(/g, "false && leakGuardBuildNoop(")
    .replace(/\bdebugRewriteVerification\s*\(/g, "false && leakGuardBuildNoop(")
    .replace(/\blogFailureDetails\s*\(/g, "false && leakGuardBuildNoop(")
    .replace(/\blogFileInterception\s*\(/g, "false && leakGuardBuildNoop(");

  for (const banned of [
    "pwm:debug",
    "debugLogSnapshot",
    "debugReveal",
    "debugFileAttachMetadata",
    "debugResponseRehydration",
    "debugRewriteVerification",
    "console.group(",
    "console.groupCollapsed(",
    "console.groupEnd(",
    "console.log("
  ]) {
    if (source.includes(banned)) {
      throw new Error(`Release content script still contains debug artifact: ${banned}`);
    }
  }

  fs.writeFileSync(contentPath, source);
}

function stripDebugLoggerDiagnostics(targetRoot) {
  const loggerPath = path.join(targetRoot, "content", "diagnostics", "debugLogger.js");
  fs.writeFileSync(
    loggerPath,
    `(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.DebugLogger = {
    isDebugEnabled: () => false,
    sanitizeDebugPayload: () => ({ type: "debug-disabled" }),
    debugEvent: () => {},
    debugSnapshot: () => {},
    summarizeDebugText: (text) => ({
      length: String(text || "").length,
      lineCount: String(text || "") ? String(text || "").split("\\n").length : 0,
      placeholderCount: (String(text || "").match(/\\[[A-Z_]+_\\d+\\]/g) || []).length
    }),
    collectComposerDebugSnapshot: () => ({})
  };
})();
`
  );
}

function stripSourceMappingUrls(targetRoot) {
  const sourceMapPattern = /(?:\/\/[#@]\s*sourceMappingURL=.*|\/\*[#@]\s*sourceMappingURL=[\s\S]*?\*\/)/g;
  for (const file of walkFiles(targetRoot)) {
    if (!/\.(?:js|mjs|css|json|html)$/i.test(file)) {
      continue;
    }

    const source = fs.readFileSync(file, "utf8");
    if (!source.includes("sourceMappingURL")) {
      continue;
    }

    fs.writeFileSync(file, source.replace(sourceMapPattern, ""));
  }
}

function assertNoReleaseSourceMaps(targetRoot) {
  for (const file of walkFiles(targetRoot)) {
    if (file.endsWith(".map") || path.basename(file).toLowerCase().includes(".map.")) {
      throw new Error(`Release artifact must not include sourcemap file: ${file}`);
    }
    if (/\.(?:js|mjs|css|json|html)$/i.test(file)) {
      const source = fs.readFileSync(file, "utf8");
      if (source.includes("sourceMappingURL")) {
        throw new Error(`Release artifact still references a sourcemap: ${file}`);
      }
    }
  }
}

function resolveTargetName(browser, mode = "consumer") {
  return mode === "enterprise" ? `${browser}-enterprise` : browser;
}

function buildManifest(browser, mode = "consumer") {
  if (!supportedBrowsers.has(browser)) {
    throw new Error(`Unsupported browser "${browser}". Expected chrome or firefox.`);
  }
  if (!supportedModes.has(mode)) {
    throw new Error(`Unsupported mode "${mode}". Expected consumer or enterprise.`);
  }

  const baseManifest = readJson(path.join(manifestsRoot, "base.json"));
  const browserManifest = readJson(path.join(manifestsRoot, `${browser}.json`));
  let manifest = mergeValue(baseManifest, browserManifest);

  if (mode === "enterprise") {
    const enterpriseOverlay = readJson(path.join(manifestsRoot, `${browser}-enterprise.json`));
    manifest = mergeValue(manifest, enterpriseOverlay);
  }

  const webAccessibleResources = Array.isArray(manifest.web_accessible_resources)
    ? manifest.web_accessible_resources
    : [];
  if (webAccessibleResources[0]) {
    const staticResources = (webAccessibleResources[0].resources || []).filter(
      (resource) => !resource.startsWith("vendor/onnxruntime/")
    );
    webAccessibleResources[0] = {
      ...webAccessibleResources[0],
      resources: [...staticResources, ...getOnnxRuntimeWebAccessibleResources()]
    };
    manifest.web_accessible_resources = webAccessibleResources;
  }

  return manifest;
}

function buildInfoSource({ browser, mode, builtAt }) {
  const enterprise = mode === "enterprise";
  const target = resolveTargetName(browser, mode);

  return `globalThis.PWM_BUILD_INFO = Object.freeze({
  browser: ${JSON.stringify(browser)},
  mode: ${JSON.stringify(mode)},
  enterprise: ${enterprise},
  features: Object.freeze({
    ocr: Object.freeze({
      enabled: true,
      status: "image_ocr_v1",
      scope: "scanner_and_protected_site_image_english_only_default_off"
    })
  }),
  target: ${JSON.stringify(target)},
  builtAt: ${JSON.stringify(builtAt)}
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.PWM_BUILD_INFO;
}
`;
}

function writeBuildInfo(targetRoot, buildInfo) {
  const sharedRoot = path.join(targetRoot, "shared");
  ensureDir(sharedRoot);
  fs.writeFileSync(path.join(sharedRoot, "build_info.js"), buildInfoSource(buildInfo));
}

function copyOnnxRuntime(targetRoot) {
  const sourceDir = getOnnxRuntimeDistDir();
  const targetDir = path.join(targetRoot, "vendor", "onnxruntime");

  ensureDir(targetDir);

  for (const file of listOnnxRuntimeFiles()) {
    const sourceFile = path.join(sourceDir, file);
    const targetFile = path.join(targetDir, file);
    fs.copyFileSync(sourceFile, targetFile);
    if (file === "ort.wasm.min.js") {
      sanitizeOnnxRuntimeLoader(targetFile);
    }
  }
}

function sanitizeOnnxRuntimeLoader(targetFile) {
  const source = fs.readFileSync(targetFile, "utf8");
  const dynamicImportLoader = "(await import(/*webpackIgnore:true*/ /*@vite-ignore*/e)).default";
  const fixedImportLoader = "(await import(e)).default";
  if (!source.includes(dynamicImportLoader)) {
    throw new Error(`ONNX Runtime loader import pattern changed in ${targetFile}.`);
  }
  fs.writeFileSync(targetFile, source.replace(dynamicImportLoader, fixedImportLoader));
}

function buildTarget(browser, mode = "consumer") {
  const target = resolveTargetName(browser, mode);
  const targetRoot = path.join(distRoot, target);
  const builtAt = new Date().toISOString();

  resetDir(targetRoot);

  for (const dir of assetDirs) {
    copyDirContents(path.join(sourceRoot, dir), path.join(targetRoot, dir));
  }

  for (const dir of staticDirs) {
    copyDirContents(path.join(repoRoot, dir), path.join(targetRoot, dir));
  }

  stripContentDebugDiagnostics(targetRoot);
  stripDebugLoggerDiagnostics(targetRoot);
  copyOnnxRuntime(targetRoot);
  stripSourceMappingUrls(targetRoot);
  assertNoReleaseSourceMaps(targetRoot);

  writeBuildInfo(targetRoot, { browser, mode, builtAt });

  const manifest = buildManifest(browser, mode);
  fs.writeFileSync(path.join(targetRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    browser,
    mode,
    target,
    targetRoot,
    manifest
  };
}

function parseArgs(argv) {
  const args = {
    browser: null,
    mode: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--browser") {
      args.browser = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (token === "--mode") {
      args.mode = argv[index + 1] || null;
      index += 1;
    }
  }

  return args;
}

function printUsage() {
  process.stderr.write(
    "Usage: node scripts/build-extension.mjs --browser chrome|firefox --mode consumer|enterprise\n"
  );
}

function validateArgs(browser, mode) {
  if (!supportedBrowsers.has(browser) || !supportedModes.has(mode)) {
    printUsage();
    process.exitCode = 1;
    return false;
  }

  return true;
}

async function main() {
  const { browser, mode } = parseArgs(process.argv.slice(2));
  if (!validateArgs(browser, mode)) {
    return;
  }

  const result = buildTarget(browser, mode);
  process.stdout.write(`Built ${result.target} extension at ${result.targetRoot}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export {
  BUILD_TARGETS,
  OCR_SIZE_BUDGETS,
  buildManifest,
  buildTarget,
  buildInfoSource,
  getOnnxRuntimeWebAccessibleResources,
  mergeValue,
  parseArgs,
  resolveTargetName
};
