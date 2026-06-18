const assert = require("assert");
const { loadCore } = require("../helpers/load_core.js");
loadCore();
const { Detector } = globalThis.PWM;
const { classifyStructuredMetadataValue } = globalThis.PWM.DetectionStructuredMetadata;

function findingsFor(text) {
  return new Detector().scan(text).filter((finding) => finding.method.includes("structured-metadata"));
}

function assertStructuredFinding(text, raw, expected) {
  const findings = findingsFor(text);
  const finding = findings.find((candidate) => candidate.raw === raw);
  assert.ok(finding, `missing structured metadata finding for ${raw}: ${JSON.stringify(findings)}`);
  assert.deepStrictEqual(
    {
      raw: finding.raw,
      start: finding.start,
      end: finding.end,
      type: finding.type,
      category: finding.category,
      score: finding.score,
      method: finding.method
    },
    {
      raw,
      start: text.indexOf(raw),
      end: text.indexOf(raw) + raw.length,
      ...expected
    }
  );
}

function run() {
  assertStructuredFinding("Group,Name,Value\nStorage,File Share,FSA1234567", "FSA1234567", {
    type: "FILE_SHARE",
    category: "internal_metadata",
    score: 99,
    method: ["structured-metadata", "csv-table-row", "full-value", "exact-key"]
  });

  assertStructuredFinding("| Group | Name | Value |\n| --- | --- | --- |\n| LDAP | Account | CORP\\adm-test.user |", "CORP\\adm-test.user", {
    type: "USERNAME",
    category: "identity",
    score: 99,
    method: ["structured-metadata", "pipe-table-row", "full-value", "exact-key"]
  });

  assertStructuredFinding("Type: LDAP Distinguished Name\nValue: CN=File Admins,OU=SH070,DC=corp,DC=local", "CN=File Admins,OU=SH070,DC=corp,DC=local", {
    type: "LDAP_DN",
    category: "internal_metadata",
    score: 100,
    method: ["structured-metadata", "table-row", "full-value", "exact-key"]
  });

  const cloudMetadata = "Name,Value\nTenant ID,99999999-8888-7777-6666-555555555555\nAzure resource group,rg-prod-weu-files-001\nStorage Account,stdeberfileprd1234567";
  const cloudFindings = new Detector().scan(cloudMetadata);
  assert.ok(cloudFindings.some((finding) => finding.type === "AZURE_RG" && finding.raw === "rg-prod-weu-files-001"));
  assert.ok(cloudFindings.some((finding) => finding.type === "STORAGE_ACCOUNT" && finding.raw === "stdeberfileprd1234567"));
  assert.strictEqual(classifyStructuredMetadataValue("Storage Account", "stdeberfileprd1234567"), "STORAGE_ACCOUNT");
  assert.strictEqual(classifyStructuredMetadataValue("Azure resource group", "rg-prod-weu-files-001"), null);

  const adGroupText = "AD group: AD123-SH070-FILE-L-STFSA1234567R";
  assert.ok(new Detector().scan(adGroupText).some((finding) => finding.type === "AD_GROUP"));

  const negative = [
    "Name,Value",
    "File share,FSA7654321 is mentioned in free text but not an exact metadata value",
    "AWS account,invoice 123456789012",
    "Storage Account,storage account docs",
    "Azure resource group,rg-blue"
  ].join("\n");
  assert.deepStrictEqual(findingsFor(negative), []);

  console.log("PASS structured metadata extraction helpers");
}

run();
