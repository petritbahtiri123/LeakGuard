#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const sourceRoot = path.join(repoRoot, "src");
const manifestsRoot = path.join(repoRoot, "manifests");
const distRoot = path.join(repoRoot, "dist");
const assetDirs = ["background", "content", "popup", "options", "ui", "shared", "compat"];
const staticDirs = ["icons"];
const supportedTargets = new Set(["chrome", "firefox"]);

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

function buildManifest(target) {
  const baseManifest = readJson(path.join(manifestsRoot, "base.json"));
  const targetManifest = readJson(path.join(manifestsRoot, `${target}.json`));
  return mergeValue(baseManifest, targetManifest);
}

function buildTarget(target) {
  if (!supportedTargets.has(target)) {
    throw new Error(`Unsupported target "${target}". Expected one of: chrome, firefox.`);
  }

  const targetRoot = path.join(distRoot, target);
  resetDir(targetRoot);

  for (const dir of assetDirs) {
    copyDirContents(path.join(sourceRoot, dir), path.join(targetRoot, dir));
  }

  for (const dir of staticDirs) {
    copyDirContents(path.join(repoRoot, dir), path.join(targetRoot, dir));
  }

  const manifest = buildManifest(target);
  fs.writeFileSync(path.join(targetRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  return targetRoot;
}

function main() {
  const requestedTarget = process.argv[2];
  const targets = requestedTarget ? [requestedTarget] : ["chrome", "firefox"];

  for (const target of targets) {
    const targetRoot = buildTarget(target);
    process.stdout.write(`Built ${target} extension at ${targetRoot}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildManifest,
  buildTarget,
  mergeValue
};
