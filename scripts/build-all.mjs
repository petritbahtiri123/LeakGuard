#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BUILD_TARGETS, buildTarget } from "./build-extension.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");
const obsoleteTargetFolders = ["chrome-ocr", "firefox-ocr"];

for (const folder of obsoleteTargetFolders) {
  fs.rmSync(path.join(distRoot, folder), { recursive: true, force: true });
}

for (const target of BUILD_TARGETS) {
  const result = buildTarget(target.browser, target.mode);
  process.stdout.write(`Built ${result.target} extension at ${result.targetRoot}\n`);
}
