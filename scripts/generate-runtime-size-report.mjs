#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const buildTargets = ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"];

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function walkFiles(rootDir) {
  const files = [];
  if (!fs.existsSync(rootDir)) return files;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function formatBytes(bytes) {
  const units = ["B", "KiB", "MiB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function summarizeFiles(rootDir, filter = () => true) {
  const files = walkFiles(rootDir)
    .filter(filter)
    .map((file) => {
      const stat = fs.statSync(file);
      return {
        path: path.relative(rootDir, file).split(path.sep).join("/"),
        bytes: stat.size
      };
    })
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

  return {
    fileCount: files.length,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    largestFiles: files.slice(0, 10)
  };
}

const outputDir = path.resolve(repoRoot, getArg("--output-dir", "artifacts/runtime-budgets"));
const distRoot = path.join(repoRoot, "dist");

const missingTargets = buildTargets.filter(
  (target) => !fs.existsSync(path.join(distRoot, target, "manifest.json"))
);
if (missingTargets.length) {
  console.error(
    `Missing built target(s): ${missingTargets.join(", ")}. Run npm run build:all before report:sizes.`
  );
  process.exit(1);
}

const targets = buildTargets.map((target) => {
  const targetRoot = path.join(distRoot, target);
  const total = summarizeFiles(targetRoot);
  const onnxRuntime = summarizeFiles(targetRoot, (file) =>
    path.relative(targetRoot, file).split(path.sep).join("/").startsWith("vendor/onnxruntime/")
  );
  const onnxModel = summarizeFiles(targetRoot, (file) =>
    path.relative(targetRoot, file).split(path.sep).join("/").startsWith("ai/models/")
  );
  return {
    target,
    total,
    onnxRuntime,
    onnxModel
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  source: "dist/",
  thresholds: "reporting-only",
  targets
};

const markdown = [
  "# Runtime Size Report",
  "",
  "Reporting-only baseline. No CI threshold is enforced by this report.",
  "",
  "| Target | Total | Files | ONNX Runtime | ONNX Model |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...targets.map(
    (entry) =>
      `| ${entry.target} | ${formatBytes(entry.total.bytes)} | ${entry.total.fileCount} | ${formatBytes(
        entry.onnxRuntime.bytes
      )} | ${formatBytes(entry.onnxModel.bytes)} |`
  ),
  "",
  "## Largest Files",
  "",
  ...targets.flatMap((entry) => [
    `### ${entry.target}`,
    "",
    "| File | Size |",
    "| --- | ---: |",
    ...entry.total.largestFiles.map((file) => `| ${file.path} | ${formatBytes(file.bytes)} |`),
    ""
  ])
].join("\n");

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "runtime-size-report.json"), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, "runtime-size-report.md"), `${markdown}\n`);

console.log(`Wrote runtime size report to ${path.relative(repoRoot, outputDir)}`);
