#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

const releaseRoot = path.resolve(repoRoot, getArg("--release-dir", path.join("artifacts", "release")));
const allowedRoots = new Set([
  path.resolve(repoRoot, "release"),
  path.resolve(repoRoot, "artifacts", "release")
]);

if (!allowedRoots.has(releaseRoot)) {
  console.error(`Refusing to clean unexpected release path: ${releaseRoot}`);
  process.exit(1);
}

fs.rmSync(releaseRoot, { recursive: true, force: true });
fs.mkdirSync(releaseRoot, { recursive: true });

console.log(`Cleaned ${path.relative(repoRoot, releaseRoot)}`);
