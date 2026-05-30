#!/usr/bin/env node

import fs from "fs";
import path from "path";
import yazl from "yazl";
import { fileURLToPath } from "url";
import { BUILD_TARGETS } from "./build-extension.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function positionalArgs() {
  const values = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg.startsWith("--")) {
      index += 1;
      continue;
    }
    values.push(arg);
  }
  return values;
}

const positionals = positionalArgs();
const target = positionals[0];
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const version = positionals[1] || packageJson.version;

if (!target) {
  const targetList = BUILD_TARGETS.map((buildTarget) => buildTarget.folder).join("|");
  console.error(`Usage: node scripts/package-extension.mjs <${targetList}> [version]`);
  process.exit(1);
}

const sourceRoot = path.join(repoRoot, "dist", target);
const releaseRoot = path.resolve(repoRoot, getArg("--release-dir", "release"));
const zipPath = path.join(releaseRoot, `leakguard-${target}-v${version}.zip`);

const excludeNames = new Set([
  ".gitkeep",
  ".DS_Store",
  "Thumbs.db"
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (excludeNames.has(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`Missing source folder: ${sourceRoot}`);
  process.exit(1);
}

fs.mkdirSync(releaseRoot, { recursive: true });

if (fs.existsSync(zipPath)) {
  fs.rmSync(zipPath, { force: true });
}

const zip = new yazl.ZipFile();
const files = walk(sourceRoot);

for (const file of files) {
  const relativePath = path.relative(sourceRoot, file).split(path.sep).join("/");
  zip.addFile(file, relativePath);
}

zip.end();

await new Promise((resolve, reject) => {
  zip.outputStream
    .pipe(fs.createWriteStream(zipPath))
    .on("close", resolve)
    .on("error", reject);
});

console.log(`Created ${zipPath}`);
console.log(`Files: ${files.length}`);
