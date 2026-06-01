import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const FINDING_LIMIT = 5000;

const ignoredPathParts = [
  "dist/",
  "node_modules/",
  "ai/models/",
  "ai/.venv/",
  "ai/venv/",
  "artifacts/"
];
const ignoredFiles = new Set(["package-lock.json"]);
const ignoredExtensions = new Set([
  ".bmp",
  ".gif",
  ".ico",
  ".jpg",
  ".jpeg",
  ".onnx",
  ".pdf",
  ".png",
  ".webp",
  ".zip"
]);

const rules = [
  {
    id: "private-key-block",
    severity: "high",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g
  },
  {
    id: "aws-access-key-id",
    severity: "high",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g
  },
  {
    id: "github-token",
    severity: "high",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g
  },
  {
    id: "slack-token",
    severity: "high",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g
  },
  {
    id: "stripe-live-secret",
    severity: "high",
    pattern: /\bsk_live_[A-Za-z0-9]{24,}\b/g
  },
  {
    id: "generic-secret-assignment",
    severity: "medium",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|secret)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{20,}/gi
  }
];

function getArg(name, fallback) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex !== -1 && process.argv[exactIndex + 1]) {
    return process.argv[exactIndex + 1];
  }
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot
  });
  return output.toString("utf8").split("\0").filter(Boolean);
}

function normalizeForMatch(filePath) {
  return filePath.replace(/\\/g, "/");
}

function shouldScan(relativePath) {
  const normalized = normalizeForMatch(relativePath);
  if (ignoredFiles.has(normalized)) return false;
  if (ignoredPathParts.some((part) => normalized.includes(part))) return false;
  if (ignoredExtensions.has(path.extname(normalized).toLowerCase())) return false;
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return false;
  return fs.statSync(fullPath).size <= MAX_FILE_BYTES;
}

function fingerprint(file, line, ruleId) {
  return createHash("sha256").update(`${file}:${line}:${ruleId}`).digest("hex").slice(0, 16);
}

function scanFile(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  const text = fs.readFileSync(fullPath, "utf8");
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(line)) continue;
      findings.push({
        file: normalizeForMatch(relativePath),
        line: index + 1,
        ruleId: rule.id,
        severity: rule.severity,
        fingerprint: fingerprint(normalizeForMatch(relativePath), index + 1, rule.id)
      });
    }
  }

  return findings;
}

function summarizeByRule(findings) {
  const counts = new Map();
  for (const finding of findings) {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

const outputDir = path.resolve(repoRoot, getArg("--output-dir", "artifacts/supply-chain"));
const trackedFiles = listTrackedFiles();
const scannedFiles = trackedFiles.filter(shouldScan);
const findings = [];
let truncated = false;

for (const file of scannedFiles) {
  for (const finding of scanFile(file)) {
    if (findings.length >= FINDING_LIMIT) {
      truncated = true;
      break;
    }
    findings.push(finding);
  }
  if (truncated) break;
}

const report = {
  generatedAt: new Date().toISOString(),
  reportingOnly: true,
  matchedValuesIncluded: false,
  scannedFileCount: scannedFiles.length,
  skippedFileCount: trackedFiles.length - scannedFiles.length,
  findingCount: findings.length,
  truncated,
  rules: rules.map(({ id, severity }) => ({ id, severity })),
  ruleCounts: summarizeByRule(findings),
  findings
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "repository-secret-scan.json"), `${JSON.stringify(report, null, 2)}\n`);

const markdown = [
  "# Repository Secret Scan Report",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  "Reporting mode: non-blocking",
  "",
  "Matched secret values and source snippets are intentionally omitted from this artifact.",
  "",
  `Tracked files scanned: ${report.scannedFileCount}`,
  `Tracked files skipped: ${report.skippedFileCount}`,
  `Findings: ${report.findingCount}${report.truncated ? " (truncated)" : ""}`,
  "",
  "## Rule Counts",
  "",
  "| Rule | Count |",
  "| --- | ---: |",
  ...Object.entries(report.ruleCounts).map(([rule, count]) => `| ${rule} | ${count} |`),
  "",
  "## Findings",
  "",
  findings.length
    ? "| File | Line | Rule | Severity | Fingerprint |\n| --- | ---: | --- | --- | --- |\n" +
      findings
        .map(
          (finding) =>
            `| ${finding.file} | ${finding.line} | ${finding.ruleId} | ${finding.severity} | ${finding.fingerprint} |`
        )
        .join("\n")
    : "No rule matches found.",
  ""
].join("\n");

fs.writeFileSync(path.join(outputDir, "repository-secret-scan.md"), markdown);

console.log(
  `Wrote metadata-only repository secret scan report with ${findings.length} finding(s) to ${path.relative(
    repoRoot,
    outputDir
  )}`
);
