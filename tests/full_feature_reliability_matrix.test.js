const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const matrixPath = path.join(repoRoot, "docs/qa/3.0-full-feature-reliability-matrix.md");
const matrix = fs.readFileSync(matrixPath, "utf8");
const requireComplete = process.argv.includes("--require-complete");
const allowedStatuses = new Set(["PASS", "FAIL", "PENDING", "NOT APPLICABLE", "WAIVED"]);

const featureIds = [
  "FEATURE-SITE-ROUTING",
  "FEATURE-COMPOSER",
  "FEATURE-DECISIONS-POLICY",
  "FEATURE-DETECTION",
  "FEATURE-NETWORK-METADATA",
  "FEATURE-ONIX",
  "FEATURE-PLACEHOLDERS-REVEAL",
  "FEATURE-UI",
  "FEATURE-SCANNER",
  "FEATURE-GENERATED-DOCUMENTS",
  "FEATURE-IMAGES-OCR",
  "FEATURE-PROTECTED-FILES",
  "FEATURE-WHATSAPP",
  "FEATURE-DIAGNOSTICS-AUDIT",
  "FEATURE-BUILD-PRIVACY"
];
const providers = ["CHATGPT", "OPENAI", "CLAUDE", "GEMINI", "GROK", "X", "WHATSAPP", "MANAGED"];
const browsers = ["CHROME", "FIREFOX"];
const modes = ["CONSUMER", "ENTERPRISE"];
const packageIds = [
  "PKG-CHROME-CONSUMER",
  "PKG-CHROME-ENTERPRISE",
  "PKG-FIREFOX-CONSUMER",
  "PKG-FIREFOX-ENTERPRISE",
  "PKG-EDGE-SMOKE"
];
const authIds = providers.flatMap((provider) =>
  browsers.flatMap((browser) => modes.map((mode) => `AUTH-${provider}-${browser}-${mode}`))
);

function rowFor(id) {
  const line = matrix.split(/\r?\n/).find((candidate) => candidate.startsWith(`| ${id} |`));
  assert.ok(line, `missing reliability matrix row ${id}`);
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  assert.ok(allowedStatuses.has(cells.at(-2)), `${id}: invalid status ${cells.at(-2)}`);
  assert.ok(cells.at(-1), `${id}: missing evidence/blocker detail`);
  return { id, status: cells.at(-2), detail: cells.at(-1) };
}

const rows = [...featureIds, ...packageIds, ...authIds].map(rowFor);
assert.match(matrix, /Exactly one send\/upload\/event sequence/);
assert.match(matrix, /Raw synthetic value absent/);
assert.match(matrix, /Owner-approved waiver/);

if (requireComplete) {
  const incomplete = rows.filter((row) => row.status === "PENDING" || row.status === "FAIL");
  assert.deepStrictEqual(incomplete, [], `release matrix incomplete: ${incomplete.map((row) => row.id).join(", ")}`);
}

console.log(`PASS full-feature reliability matrix contract (${rows.length} required rows)`);
