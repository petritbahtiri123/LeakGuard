const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadCore, root } = require("../helpers/load_core.js");
loadCore();

const { Detector, PlaceholderManager, Redactor } = globalThis.PWM;

const fixtureDir = path.join(root, "tests/fixtures/manual/live-site-qa");
const fullMatrixUploadPath = path.join(
  fixtureDir,
  "full-redaction-matrix",
  "uploads",
  "full-redaction-smoke-js.js"
);
const payloadFiles = [
  "chatgpt_gemini_typed_paste_payload.txt",
  "file_upload_payload.txt",
  "image_ocr_payload.txt"
];

const expectedFamilies = [
  "AZURE_RG",
  "STORAGE_ACCOUNT",
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "AWS_ARN",
  "AWS_ACCOUNT_ID",
  "GCP_PROJECT",
  "OTC_RESOURCE",
  "OPENSTACK_PROJECT_ID",
  "K8S_NAMESPACE",
  "K8S_SECRET",
  "PRIVATE_IP",
  "PRIVATE_CIDR",
  "UNC_PATH",
  "SPN",
  "LDAP_DN",
  "FILE_SHARE",
  "AD_GROUP",
  "HOSTNAME",
  "USERNAME",
  "EMAIL"
];

const fullMatrixExpectedFamilies = [
  ...expectedFamilies.filter((family) => family !== "HOSTNAME"),
  "GCP_PROJECT_NUMBER",
  "AWS_ENDPOINT",
  "CLOUD_ENDPOINT",
  "INTERNAL_ENDPOINT"
];

const rawSensitiveValues = [
  "rg-prod-weu-files-001",
  "stdeberfileprd1234567",
  "99999999-8888-7777-6666-555555555555",
  "11111111-2222-3333-4444-555555555555",
  "arn:aws:iam::123456789012:role/LeakGuardQaRole",
  "210987654321",
  "lg-prod-project-123",
  "otc-prod-de-ecs-001",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "prod-payments",
  "secret/db-password",
  "10.10.20.30",
  "10.10.20.0/24",
  "\\\\fs-prod-weu-01\\FSA1234567",
  "cifs/stdeberfileprd1234567.file.core.windows.net",
  "CN=svc-backup-prod,OU=Service Accounts,OU=SH070,DC=corp,DC=local",
  "FSA1234567",
  "AD123-SH070-FILE-L-STFSA1234567R",
  "fs-prod-weu-01.corp.local",
  "CORP\\adm-test.user",
  "test.user@example.com"
];

const fullMatrixRawSensitiveValues = [
  ...rawSensitiveValues,
  "123456789012",
  "123456789012:role/LeakGuardQaRole",
  "prod-weu-kv.vault.azure.net",
  "vpce-0abc123def4567890.execute-api.eu-central-1.vpce.amazonaws.com",
  "https://api.prod.internal/v1/payments",
  "api.prod.internal"
];

const harmlessValues = [
  "rg-blue",
  "rg-test",
  "product-roadmap-item",
  "invoice 123456789012",
  "8.8.8.8",
  "192.0.2.44",
  "192.0.2.0/24",
  "docs/page",
  "service/name",
  "123e4567-e89b-12d3-a456-426614174000",
  "report.final.docx",
  "package.name"
];

function assertSyntheticOnly(fileName, text) {
  assert.match(text, /synthetic|fake|example|test|qa/i, `${fileName} should identify itself as synthetic`);
  assert.doesNotMatch(text, /\b(?:password|secret|token)\s*[:=]\s*(?!synthetic|fake|example|redacted)/i);
  assert.doesNotMatch(text, /\b(?:customer|client|prod customer|internal only)\b/i);
}

function redact(text) {
  const manager = new PlaceholderManager();
  const findings = new Detector().scan(text, { manager });
  return new Redactor(manager).redact(text, findings).redactedText;
}

function run() {
  for (const fileName of payloadFiles) {
    const filePath = path.join(fixtureDir, fileName);
    assert.ok(fs.existsSync(filePath), `missing live-site QA payload: ${filePath}`);
    const text = fs.readFileSync(filePath, "utf8");
    assertSyntheticOnly(fileName, text);

    const redactedText = redact(text);
    for (const family of expectedFamilies) {
      assert.ok(new RegExp(`\\[${family}_\\d+\\]`).test(redactedText), `${fileName} missing ${family}`);
    }
    for (const raw of rawSensitiveValues) {
      assert.strictEqual(redactedText.includes(raw), false, `${fileName} leaked ${raw}`);
    }
    for (const harmless of harmlessValues) {
      assert.ok(redactedText.includes(harmless), `${fileName} should preserve harmless value ${harmless}`);
    }
  }

  assert.ok(fs.existsSync(fullMatrixUploadPath), `missing full redaction matrix upload: ${fullMatrixUploadPath}`);
  const fullMatrixText = fs.readFileSync(fullMatrixUploadPath, "utf8");
  assert.match(fullMatrixText, /synthetic|fake|example|test|qa/i, "full-redaction-smoke-js.js should identify itself as synthetic");
  const fullMatrixRedacted = redact(fullMatrixText);
  for (const family of fullMatrixExpectedFamilies) {
    assert.ok(new RegExp(`\\[${family}_\\d+\\]`).test(fullMatrixRedacted), `full matrix missing ${family}`);
  }
  for (const raw of fullMatrixRawSensitiveValues) {
    assert.strictEqual(fullMatrixRedacted.includes(raw), false, `full matrix leaked ${raw}`);
  }

  const notesPath = path.join(fixtureDir, "expected_redaction_notes.md");
  assert.ok(fs.existsSync(notesPath), `missing live-site QA notes: ${notesPath}`);
  const notes = fs.readFileSync(notesPath, "utf8");
  for (const family of expectedFamilies) {
    assert.ok(notes.includes(`[${family}_N]`), `notes should document ${family}`);
  }
  for (const harmless of harmlessValues) {
    assert.ok(notes.includes(harmless), `notes should document preserved harmless value ${harmless}`);
  }

  console.log("PASS live-site QA synthetic payload regressions");
}

run();
