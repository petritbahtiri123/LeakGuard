#!/usr/bin/env node

import { createHash } from "node:crypto";
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

async function sha256File(filePath) {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

const releaseDir = path.resolve(repoRoot, getArg("--release-dir", "release"));
const textOutputPath = path.resolve(
  repoRoot,
  getArg("--output", path.join(releaseDir, "SHA256SUMS"))
);
const jsonOutputPath = path.resolve(
  repoRoot,
  getArg("--json-output", path.join(releaseDir, "release-checksums.json"))
);

if (!fs.existsSync(releaseDir)) {
  console.error(`Missing release artifact directory: ${releaseDir}`);
  process.exit(1);
}

const artifacts = fs
  .readdirSync(releaseDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.zip$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

if (!artifacts.length) {
  console.error(`No .zip release artifacts found in ${releaseDir}`);
  process.exit(1);
}

const checksums = [];
for (const artifact of artifacts) {
  const artifactPath = path.join(releaseDir, artifact);
  const stat = fs.statSync(artifactPath);
  checksums.push({
    file: artifact,
    bytes: stat.size,
    sha256: await sha256File(artifactPath)
  });
}

fs.mkdirSync(path.dirname(textOutputPath), { recursive: true });
fs.mkdirSync(path.dirname(jsonOutputPath), { recursive: true });

fs.writeFileSync(
  textOutputPath,
  `${checksums.map((entry) => `${entry.sha256}  ${entry.file}`).join("\n")}\n`
);

fs.writeFileSync(
  jsonOutputPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      algorithm: "sha256",
      releaseDir: path.relative(repoRoot, releaseDir) || ".",
      artifactCount: checksums.length,
      artifacts: checksums
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${checksums.length} release checksum(s) to ${path.relative(repoRoot, textOutputPath)}`);
