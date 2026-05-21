#!/usr/bin/env node

import fs from "fs";
import path from "path";
import yazl from "yazl";
import { fileURLToPath } from "url";
import { BUILD_TARGETS } from "./build-extension.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const target = process.argv[2];
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const version = process.argv[3] || packageJson.version;

if (!target) {
  const targetList = BUILD_TARGETS.map((buildTarget) => buildTarget.folder).join("|");
  console.error(`Usage: node scripts/package-extension.mjs <${targetList}> [version]`);
  process.exit(1);
}

const sourceRoot = path.join(repoRoot, "dist", target);
const releaseRoot = path.join(repoRoot, "release");
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
