const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadCore, root } = require("./helpers/load_core.js");

loadCore();
require(path.join(root, "src/shared/fileLimits.js"));
require(path.join(root, "src/shared/fileTypeRegistry.js"));
require(path.join(root, "src/shared/fileScanner.js"));

const { scanTextContent, buildSanitizedReport } = globalThis.PWM.FileScanner;

const ARTIFACT_DIR = path.join(root, "artifacts/manual-qa/enterprise-metadata");
const EXPECTED_ARTIFACT_FILES = [
  "enterprise_metadata_live_qa.txt",
  "enterprise_metadata_live_qa.md",
  "enterprise_metadata_live_qa.json",
  "enterprise_metadata_live_qa.csv",
  "enterprise_metadata_live_qa.html"
];

const SENSITIVE_ROWS = [
  ["Azure", "tenantId", "99999999-8888-7777-6666-555555555555", "AZURE_TENANT_ID"],
  ["Azure", "subscriptionId", "11111111-2222-3333-4444-555555555555", "AZURE_SUBSCRIPTION_ID"],
  ["AWS", "AWS account id", "210987654321", "AWS_ACCOUNT_ID"],
  ["GCP", "project_id", "lg-prod-project-123", "GCP_PROJECT"],
  ["OpenStack", "OpenStack project_id", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "OPENSTACK_PROJECT_ID"],
  ["OpenStack", "OpenStack tenant_id", "22222222-2222-2222-2222-222222222222", "OPENSTACK_TENANT_ID"],
  ["Kubernetes", "Kubernetes namespace", "prod-payments", "K8S_NAMESPACE"],
  ["Kubernetes", "Kubernetes resource", "secret/db-password", "K8S_SECRET"],
  ["Internal", "PRIVATE_IP", "10.10.20.30", "PRIVATE_IP"],
  ["Internal", "PRIVATE_CIDR", "10.10.20.0/24", "PRIVATE_CIDR"],
  ["Internal", "LDAP_DN", "CN=svc-backup-prod,OU=Service Accounts,OU=SH070,DC=corp,DC=local", "LDAP_DN"],
  ["Internal", "SPN", "cifs/stdeberfileprd1234567.file.core.windows.net", "SPN"],
  ["Internal", "UNC_PATH", "\\\\fs-prod-weu-01\\FSA1234567", "UNC_PATH"],
  ["Internal", "FILE_SHARE", "FSA1234567", "FILE_SHARE"],
  ["Internal", "AD_GROUP", "AD123-SH070-FILE-L-STFSA1234567R", "AD_GROUP"],
  ["Internal", "HOSTNAME", "fs-prod-weu-01.corp.local", "HOSTNAME"],
  ["Internal", "USERNAME", "CORP\\adm-test.user", "USERNAME"],
  ["Internal", "EMAIL", "test.user@example.com", "EMAIL"]
];

const RAW_SENSITIVE_VALUES = SENSITIVE_ROWS.map(([, , value]) => value);
const EXPECTED_FAMILIES = SENSITIVE_ROWS.map(([, , , family]) => family);
const HARMLESS_VALUES = [
  "rg-blue",
  "rg-test",
  "product-roadmap-item",
  "invoice 123456789012",
  "8.8.8.8",
  "192.0.2.44",
  "192.0.2.0/24",
  "docs/page",
  "service/name",
  "random GUID 123e4567-e89b-12d3-a456-426614174000",
  "random FSA7654321 without context",
  "report.final.docx",
  "package.name"
];

function csvEscape(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function syntheticArtifactText(fileName) {
  if (fileName.endsWith(".json")) {
    return JSON.stringify(
      {
        product: "LeakGuard",
        purpose: "synthetic enterprise metadata live-site QA",
        localOnly: true,
        sensitiveSyntheticValues: SENSITIVE_ROWS.map(([group, name, value, family]) => ({
          Group: group,
          Name: name,
          Value: value,
          Expected: `[${family}_N]`
        })),
        harmlessControls: HARMLESS_VALUES
      },
      null,
      2
    );
  }

  if (fileName.endsWith(".csv")) {
    return [
      "Kind,Group,Name,Value,Expected",
      ...SENSITIVE_ROWS.map(([group, name, value, family]) =>
        ["sensitive_synthetic", group, name, value, `[${family}_N]`].map(csvEscape).join(",")
      ),
      ...HARMLESS_VALUES.map((value) => ["harmless_control", "Harmless", "preserve", value, "visible"].map(csvEscape).join(","))
    ].join("\n");
  }

  if (fileName.endsWith(".html")) {
    const rows = SENSITIVE_ROWS.map(
      ([group, name, value, family]) =>
        `<tr><td>${htmlEscape(group)}</td><td>${htmlEscape(name)}</td><td>${htmlEscape(value)}</td><td>[${family}_N]</td></tr>`
    ).join("\n");
    const harmless = HARMLESS_VALUES.map((value) => `<li>${htmlEscape(value)}</li>`).join("\n");
    return `<!doctype html><html><body><p>synthetic enterprise metadata live-site QA</p><table><thead><tr><th>Group</th><th>Name</th><th>Value</th><th>Expected</th></tr></thead><tbody>${rows}</tbody></table><ul>${harmless}</ul></body></html>`;
  }

  if (fileName.endsWith(".md")) {
    return [
      "# Enterprise Metadata Live QA Synthetic Upload",
      "",
      "All values are synthetic examples for manual QA only.",
      "",
      ...SENSITIVE_ROWS.map(([group, name, value, family]) =>
        name === "FILE_SHARE"
          ? `- ${group} / Azure Files share: ${value} -> [${family}_N]`
          : `- ${group} / ${name}: ${value} -> [${family}_N]`
      ),
      "",
      "## Harmless Controls",
      ...HARMLESS_VALUES.map((value) => `- ${value}`)
    ].join("\n");
  }

  return [
    "LeakGuard synthetic enterprise metadata live-site QA upload fixture.",
    "All values are fake examples for manual QA only.",
    "",
    ...SENSITIVE_ROWS.map(([, name, value]) => (name === "FILE_SHARE" ? `Azure Files share ${value}` : `${name}: ${value}`)),
    "",
    "Harmless controls:",
    ...HARMLESS_VALUES
  ].join("\n");
}

function loadManualQaArtifactCases() {
  return EXPECTED_ARTIFACT_FILES.map((fileName) => {
    const artifactPath = path.join(ARTIFACT_DIR, fileName);
    return {
      fileName,
      source: fs.existsSync(artifactPath) ? "generated-artifact" : "node-synthetic-equivalent",
      text: fs.existsSync(artifactPath) ? fs.readFileSync(artifactPath, "utf8") : syntheticArtifactText(fileName)
    };
  });
}

function scanArtifact(fileName, text) {
  return scanTextContent({
    fileName,
    mimeType: fileName.endsWith(".csv") ? "text/csv" : fileName.endsWith(".html") ? "text/html" : "text/plain",
    sizeBytes: new TextEncoder().encode(text).byteLength,
    text,
    mode: "raw"
  });
}

function assertNoRawSensitiveValues(label, output) {
  for (const raw of RAW_SENSITIVE_VALUES) {
    assert.strictEqual(String(output).includes(raw), false, `${label} leaked raw sensitive value: ${raw}`);
  }
}

function assertExpectedPlaceholders(label, output) {
  for (const family of EXPECTED_FAMILIES) {
    assert.match(String(output), new RegExp(`\\[${family}_\\d+\\]`), `${label} missing ${family} placeholder`);
  }
}

function assertHarmlessValuesRemain(label, output) {
  for (const harmless of HARMLESS_VALUES) {
    assert.ok(String(output).includes(harmless), `${label} should preserve harmless value: ${harmless}`);
  }
}

function assertReportSafe(label, report, originalText) {
  const reportJson = JSON.stringify(report);
  assertNoRawSensitiveValues(`${label} report`, reportJson);
  assertExpectedPlaceholders(`${label} report`, reportJson);
  assert.strictEqual(reportJson.includes(originalText), false, `${label} report must not include full raw file content`);
  assert.ok(report.file?.name, `${label} report may include safe file name metadata`);
  assert.strictEqual(typeof report.file?.sizeBytes, "number", `${label} report may include file size metadata`);
  assert.strictEqual(typeof report.summary?.findingsCount, "number", `${label} report may include finding counts`);
  for (const warning of report.reportWarnings || []) {
    assertNoRawSensitiveValues(`${label} warning`, warning);
  }
}

function assertCsvStructureStable(result) {
  assert.match(result.redactedText, /"sensitive_synthetic","Azure","tenantId","\[AZURE_TENANT_ID_\d+\]","\[AZURE_TENANT_ID_N\]"/);
  assert.match(result.redactedText, /"harmless_control","Harmless","preserve","invoice 123456789012","visible"/);
}

function run() {
  const cases = loadManualQaArtifactCases();
  assert.strictEqual(cases.length, EXPECTED_ARTIFACT_FILES.length);

  for (const { fileName, source, text } of cases) {
    assert.match(text, /synthetic|fake|example|qa/i, `${fileName} (${source}) should identify itself as synthetic`);
    const result = scanArtifact(fileName, text);
    const report = buildSanitizedReport(result);
    const label = `${fileName} (${source})`;

    assertNoRawSensitiveValues(`${label} redactedText`, result.redactedText);
    assertNoRawSensitiveValues(`${label} redactedPreview`, result.redactedPreview);
    assertExpectedPlaceholders(`${label} redactedText`, result.redactedText);
    assertExpectedPlaceholders(`${label} redactedPreview`, result.redactedPreview);
    assertHarmlessValuesRemain(`${label} redactedText`, result.redactedText);
    assertHarmlessValuesRemain(`${label} redactedPreview`, result.redactedPreview);
    assertReportSafe(label, report, text);

    for (const finding of result.findings) {
      assert.strictEqual("raw" in finding, false, `${label} finding metadata must not expose raw`);
      assertNoRawSensitiveValues(`${label} finding metadata`, JSON.stringify(finding));
      assert.ok(Number.isInteger(finding.line), `${label} finding should include safe line metadata`);
      assert.ok(Number.isInteger(finding.column), `${label} finding should include safe column metadata`);
    }

    if (fileName.endsWith(".csv")) {
      assertCsvStructureStable(result);
    }
  }

  console.log("PASS manual QA artifact scanner safety regressions");
}

run();
