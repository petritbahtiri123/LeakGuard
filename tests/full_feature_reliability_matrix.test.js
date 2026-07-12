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
const nonWhatsAppProviderFeatureIds = featureIds.filter(
  (id) => !["FEATURE-SCANNER", "FEATURE-WHATSAPP", "FEATURE-BUILD-PRIVACY"].includes(id)
);
const edgeSmokeFeatureIds = [
  "FEATURE-SITE-ROUTING",
  "FEATURE-COMPOSER",
  "FEATURE-DECISIONS-POLICY",
  "FEATURE-DETECTION",
  "FEATURE-PLACEHOLDERS-REVEAL",
  "FEATURE-UI",
  "FEATURE-SCANNER",
  "FEATURE-IMAGES-OCR",
  "FEATURE-DIAGNOSTICS-AUDIT",
  "FEATURE-BUILD-PRIVACY"
];
const coverageContracts = {
  "COVERAGE-PACKAGE-FULL": featureIds,
  "COVERAGE-EDGE-SMOKE": edgeSmokeFeatureIds,
  "COVERAGE-CHATGPT": nonWhatsAppProviderFeatureIds,
  "COVERAGE-OPENAI": nonWhatsAppProviderFeatureIds,
  "COVERAGE-CLAUDE": nonWhatsAppProviderFeatureIds,
  "COVERAGE-GEMINI": nonWhatsAppProviderFeatureIds,
  "COVERAGE-GROK": nonWhatsAppProviderFeatureIds,
  "COVERAGE-X": nonWhatsAppProviderFeatureIds,
  "COVERAGE-WHATSAPP": featureIds.filter(
    (id) => !["FEATURE-SCANNER", "FEATURE-BUILD-PRIVACY"].includes(id)
  ),
  "COVERAGE-MANAGED": nonWhatsAppProviderFeatureIds
};
const contractObligations = {
  "COVERAGE-CHATGPT": ["temporary chat", "large paste"],
  "COVERAGE-OPENAI": ["legacy route"],
  "COVERAGE-CLAUDE": ["remount", "current composer"],
  "COVERAGE-GEMINI": ["pending attach"],
  "COVERAGE-GROK": ["pending attach"],
  "COVERAGE-X": ["send click/submit", "media-only applicability"],
  "COVERAGE-WHATSAPP": ["controlled chat", "image/attach/drop", "all-or-nothing", "no-file-paste"],
  "COVERAGE-MANAGED": ["exact-origin permission grant/revoke/regrant", "registration/reload"]
};

const providers = ["CHATGPT", "OPENAI", "CLAUDE", "GEMINI", "GROK", "X", "WHATSAPP", "MANAGED"];
const browsers = ["CHROME", "FIREFOX"];
const modes = ["CONSUMER", "ENTERPRISE"];
const packageCoverage = {
  "PKG-CHROME-CONSUMER": "COVERAGE-PACKAGE-FULL",
  "PKG-CHROME-ENTERPRISE": "COVERAGE-PACKAGE-FULL",
  "PKG-FIREFOX-CONSUMER": "COVERAGE-PACKAGE-FULL",
  "PKG-FIREFOX-ENTERPRISE": "COVERAGE-PACKAGE-FULL",
  "PKG-EDGE-SMOKE": "COVERAGE-EDGE-SMOKE"
};
const packageIds = Object.keys(packageCoverage);
const authIds = providers.flatMap((provider) =>
  browsers.flatMap((browser) => modes.map((mode) => `AUTH-${provider}-${browser}-${mode}`))
);
const authCoverage = Object.fromEntries(
  authIds.map((id) => {
    const provider = providers.find((candidate) => id.startsWith(`AUTH-${candidate}-`));
    return [id, `COVERAGE-${provider}`];
  })
);
const expectedCoverageByRow = { ...packageCoverage, ...authCoverage };

const detailFieldNames = [
  "Next action",
  "Failure",
  "Evidence",
  "Coverage",
  "Owner",
  "Date",
  "Reason",
  "Affected public claim",
  "Scope citation"
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tableCells(line) {
  if (!line.trim().startsWith("|")) return null;
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}

function uniqueCellsForId(source, id, kind) {
  const matches = source
    .split(/\r?\n/)
    .map(tableCells)
    .filter((cells) => cells?.[0] === id);
  assert.ok(matches.length, `missing ${kind} ${id}`);
  assert.strictEqual(matches.length, 1, `duplicate ${kind} ${id}`);
  return matches[0];
}

function detailField(detail, name) {
  const normalized = detail.replace(/<br\s*\/?>/gi, "\n");
  const boundaries = detailFieldNames.map(escapeRegex).join("|");
  const match = normalized.match(
    new RegExp(`(?:^|\\s)${escapeRegex(name)}:\\s*(.*?)(?=\\s+(?:${boundaries}):|$)`, "i")
  );
  return match?.[1].trim() || "";
}

function requiredDetailField(row, name) {
  const value = detailField(row.detail, name);
  assert.ok(value, `${row.id}: ${row.status} requires nonempty ${name}:`);
  return value;
}

function assertMarkdownLink(value, row, name) {
  assert.match(value, /\[[^\]]+\]\([^)]+\)/, `${row.id}: ${row.status} requires Markdown ${name}: link`);
}

function isIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateStateDetail(row) {
  switch (row.status) {
    case "PENDING":
      requiredDetailField(row, "Next action");
      break;
    case "FAIL": {
      requiredDetailField(row, "Failure");
      const evidence = requiredDetailField(row, "Evidence");
      assertMarkdownLink(evidence, row, "Evidence");
      requiredDetailField(row, "Next action");
      break;
    }
    case "PASS": {
      const evidence = requiredDetailField(row, "Evidence");
      assertMarkdownLink(evidence, row, "Evidence");
      assert.strictEqual(
        requiredDetailField(row, "Coverage"),
        row.expectedCoverage,
        `${row.id}: PASS Coverage: must match ${row.expectedCoverage}`
      );
      break;
    }
    case "WAIVED": {
      requiredDetailField(row, "Owner");
      const date = requiredDetailField(row, "Date");
      assert.ok(isIsoDate(date), `${row.id}: WAIVED requires valid ISO Date:`);
      requiredDetailField(row, "Reason");
      requiredDetailField(row, "Affected public claim");
      break;
    }
    case "NOT APPLICABLE": {
      requiredDetailField(row, "Reason");
      const citation = requiredDetailField(row, "Scope citation");
      assertMarkdownLink(citation, row, "Scope citation");
      break;
    }
    default:
      assert.fail(`${row.id}: unhandled status ${row.status}`);
  }
}

function rowFor(id) {
  const cells = uniqueCellsForId(matrix, id, "required row ID");
  const status = cells.at(-2);
  const detail = cells.at(-1);
  assert.ok(allowedStatuses.has(status), `${id}: invalid status ${status}`);
  assert.ok(detail, `${id}: missing evidence/blocker detail`);

  const expectedCoverage = expectedCoverageByRow[id] || id;
  if (expectedCoverageByRow[id]) {
    assert.strictEqual(cells.at(-3), expectedCoverage, `${id}: invalid coverage contract ${cells.at(-3)}`);
  }

  const row = { id, status, detail, expectedCoverage };
  validateStateDetail(row);
  return row;
}

function validateCoverageContracts() {
  const contractRows = matrix
    .split(/\r?\n/)
    .map(tableCells)
    .filter((cells) => cells?.[0]?.startsWith("COVERAGE-"));
  const contractIds = contractRows.map((cells) => cells[0]);
  assert.strictEqual(new Set(contractIds).size, contractIds.length, "duplicate coverage-contract ID");
  assert.deepStrictEqual(
    [...contractIds].sort(),
    Object.keys(coverageContracts).sort(),
    "coverage contract IDs must match the required contract set"
  );

  for (const [id, expectedFeatureIds] of Object.entries(coverageContracts)) {
    const cells = uniqueCellsForId(matrix, id, "coverage-contract ID");
    const actualFeatureIds = [...cells[1].matchAll(/`(FEATURE-[A-Z-]+)`/g)].map((match) => match[1]);
    assert.deepStrictEqual(
      [...actualFeatureIds].sort(),
      [...expectedFeatureIds].sort(),
      `${id}: feature IDs must match its required coverage set`
    );
    for (const obligation of contractObligations[id] || []) {
      assert.ok(
        cells[2].toLowerCase().includes(obligation.toLowerCase()),
        `${id}: missing required action/exclusion ${obligation}`
      );
    }
  }
}

function runValidatorSelfTests() {
  assert.throws(
    () => validateStateDetail({
      id: "SYNTHETIC-PASS",
      status: "PASS",
      detail: "Next action: reuse stale action text.",
      expectedCoverage: "FEATURE-DETECTION"
    }),
    /PASS requires nonempty Evidence:/
  );
  assert.throws(
    () => validateStateDetail({
      id: "SYNTHETIC-WAIVER",
      status: "WAIVED",
      detail: "Owner: QA <br> Date: July 12 <br> Reason: synthetic <br> Affected public claim: none",
      expectedCoverage: "FEATURE-DETECTION"
    }),
    /WAIVED requires valid ISO Date:/
  );
  assert.throws(
    () => validateStateDetail({
      id: "SYNTHETIC-NA",
      status: "NOT APPLICABLE",
      detail: "Reason: synthetic only",
      expectedCoverage: "FEATURE-DETECTION"
    }),
    /NOT APPLICABLE requires nonempty Scope citation:/
  );
  assert.doesNotThrow(() => validateStateDetail({
    id: "SYNTHETIC-PASS",
    status: "PASS",
    detail: "Evidence: [synthetic record](synthetic/evidence.md) <br> Coverage: FEATURE-DETECTION",
    expectedCoverage: "FEATURE-DETECTION"
  }));
  assert.throws(
    () => uniqueCellsForId("| FEATURE-DETECTION | one |\n| FEATURE-DETECTION | two |", "FEATURE-DETECTION", "required row ID"),
    /duplicate required row ID FEATURE-DETECTION/
  );
  assert.throws(
    () => uniqueCellsForId("| COVERAGE-X | one |\n| COVERAGE-X | two |", "COVERAGE-X", "coverage-contract ID"),
    /duplicate coverage-contract ID COVERAGE-X/
  );
}

runValidatorSelfTests();
validateCoverageContracts();

const rows = [...featureIds, ...packageIds, ...authIds].map(rowFor);
assert.match(matrix, /Exactly one send\/upload\/event sequence/);
assert.match(matrix, /Raw synthetic value absent/);
assert.match(matrix, /Owner-approved waiver/);
assert.match(matrix, /Unsupported provider ingress.*subcase exclusion.*evidence/i);

if (requireComplete) {
  const incomplete = rows.filter((row) => row.status === "PENDING" || row.status === "FAIL");
  assert.deepStrictEqual(incomplete, [], `release matrix incomplete: ${incomplete.map((row) => row.id).join(", ")}`);
}

console.log(`PASS full-feature reliability matrix contract (${rows.length} required rows)`);
