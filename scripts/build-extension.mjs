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
const onnxRuntimeLoaderFiles = ["ort.min.js"];
const onnxRuntimeSidecarFiles = [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm"
];
const supportedBrowsers = new Set(["chrome", "firefox"]);
const supportedModes = new Set(["consumer", "enterprise"]);

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
  const runtimeFiles = [...onnxRuntimeLoaderFiles, ...onnxRuntimeSidecarFiles].sort();

  for (const file of runtimeFiles) {
    if (!files.includes(file)) {
      throw new Error(`Missing ONNX Runtime loader asset ${path.join(sourceDir, file)}.`);
    }
  }

  return runtimeFiles;
}

function getOnnxRuntimeWebAccessibleResources() {
  return listOnnxRuntimeFiles()
    .filter((file) => onnxRuntimeSidecarFiles.includes(file))
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
    fs.copyFileSync(sourceFile, path.join(targetDir, file));
  }
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

  copyOnnxRuntime(targetRoot);

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
  buildManifest,
  buildTarget,
  buildInfoSource,
  getOnnxRuntimeWebAccessibleResources,
  mergeValue,
  parseArgs,
  resolveTargetName
};
