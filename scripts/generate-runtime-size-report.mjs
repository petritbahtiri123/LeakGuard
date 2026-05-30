#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const buildTargets = ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"];
const KiB = 1024;
const MiB = 1024 * KiB;
const warningBudgets = {
  targetTotalBytes: 20 * MiB,
  onnxRuntimeBytes: 16 * MiB,
  onnxModelBytes: 512 * KiB,
  largestFileBytes: 14 * MiB
};

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

function collectBudgetWarnings(entry) {
  const warnings = [];
  if (entry.total.bytes > warningBudgets.targetTotalBytes) {
    warnings.push(
      `${entry.target} total size ${formatBytes(entry.total.bytes)} exceeds warning budget ${formatBytes(
        warningBudgets.targetTotalBytes
      )}`
    );
  }
  if (entry.onnxRuntime.bytes > warningBudgets.onnxRuntimeBytes) {
    warnings.push(
      `${entry.target} ONNX Runtime size ${formatBytes(
        entry.onnxRuntime.bytes
      )} exceeds warning budget ${formatBytes(warningBudgets.onnxRuntimeBytes)}`
    );
  }
  if (entry.onnxModel.bytes > warningBudgets.onnxModelBytes) {
    warnings.push(
      `${entry.target} ONNX model size ${formatBytes(entry.onnxModel.bytes)} exceeds warning budget ${formatBytes(
        warningBudgets.onnxModelBytes
      )}`
    );
  }
  const largestFile = entry.total.largestFiles[0];
  if (largestFile && largestFile.bytes > warningBudgets.largestFileBytes) {
    warnings.push(
      `${entry.target} largest file ${largestFile.path} is ${formatBytes(
        largestFile.bytes
      )}, exceeding warning budget ${formatBytes(warningBudgets.largestFileBytes)}`
    );
  }
  return warnings;
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
  const entry = {
    target,
    total,
    onnxRuntime,
    onnxModel
  };
  return {
    ...entry,
    warnings: collectBudgetWarnings(entry)
  };
});

const warnings = targets.flatMap((entry) => entry.warnings);

const report = {
  generatedAt: new Date().toISOString(),
  source: "dist/",
  thresholds: {
    mode: "warning-only",
    budgets: warningBudgets
  },
  warnings,
  targets
};

const markdown = [
  "# Runtime Size Report",
  "",
  "Warning-only budgets. CI does not fail on these thresholds yet.",
  "",
  "| Budget | Warning Threshold |",
  "| --- | ---: |",
  `| Target total | ${formatBytes(warningBudgets.targetTotalBytes)} |`,
  `| ONNX Runtime assets | ${formatBytes(warningBudgets.onnxRuntimeBytes)} |`,
  `| ONNX model assets | ${formatBytes(warningBudgets.onnxModelBytes)} |`,
  `| Largest single file | ${formatBytes(warningBudgets.largestFileBytes)} |`,
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
  "## Budget Warnings",
  "",
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ["No warning-only budget thresholds exceeded."]),
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
if (warnings.length) {
  for (const warning of warnings) {
    console.warn(`Runtime size warning: ${warning}`);
  }
} else {
  console.log("Runtime size warning check: no warning-only thresholds exceeded");
}
