#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.join(__dirname, "..");
const sourceRoot = path.join(repoRoot, "src");
const manifestsRoot = path.join(repoRoot, "manifests");
const distRoot = path.join(repoRoot, "dist");
const assetDirs = ["background", "content", "popup", "options", "ui", "shared", "compat"];
const staticDirs = ["icons", "config"];
const supportedBrowsers = new Set(["chrome", "firefox"]);
const supportedModes = new Set(["consumer", "enterprise"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  buildManifest,
  buildTarget,
  buildInfoSource,
  mergeValue,
  parseArgs,
  resolveTargetName
};
