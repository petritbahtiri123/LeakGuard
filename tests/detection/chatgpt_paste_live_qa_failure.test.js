const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadCore, root } = require("../helpers/load_core.js");
loadCore();

const { Detector, PlaceholderManager, transformOutboundPrompt } = globalThis.PWM;

const fixtureDir = path.join(root, "tests/fixtures/detection");
const originalPayloadPath = path.join(fixtureDir, "chatgpt_paste_live_qa_original_payload.txt");
const capturedFailurePath = path.join(fixtureDir, "chatgpt_paste_live_qa_failure_redacted_regression.txt");
const csvTablePayloadPath = path.join(fixtureDir, "enterprise_metadata_live_qa_csv_table_payload.csv");
const htmlRenderedCopyPayloadPath = path.join(fixtureDir, "enterprise_metadata_live_qa_html_rendered_copy.txt");
const htmlSourcePayloadPath = path.join(fixtureDir, "enterprise_metadata_live_qa.html");

const expectedFamilies = [
  "AZURE_RG",
  "STORAGE_ACCOUNT",
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "AWS_ARN",
  "AWS_ACCOUNT_ID",
  "GCP_PROJECT",
  "GCP_PROJECT_NUMBER",
  "OTC_RESOURCE",
  "OPENSTACK_PROJECT_ID",
  "OPENSTACK_TENANT_ID",
  "OPENSTACK_DOMAIN_ID",
  "OPENSTACK_RESOURCE_ID",
  "K8S_NAMESPACE",
  "K8S_SECRET",
  "FILE_SHARE",
  "USERNAME",
  "EMAIL",
  "LDAP_DN"
];

const csvExpectedFamilies = [
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "AWS_ACCOUNT_ID",
  "GCP_PROJECT",
  "GCP_PROJECT_NUMBER",
  "OPENSTACK_PROJECT_ID",
  "OPENSTACK_TENANT_ID",
  "OPENSTACK_DOMAIN_ID",
  "OPENSTACK_RESOURCE_ID",
  "K8S_NAMESPACE",
  "K8S_SECRET",
  "FILE_SHARE",
  "USERNAME",
  "EMAIL"
];

const liveQaCsvTableExpectedFamilies = [
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

const rawSensitiveValues = [
  "rg-prod-weu-files-001",
  "stdeberfileprd1234567",
  "99999999-8888-7777-6666-555555555555",
  "11111111-2222-3333-4444-555555555555",
  "arn:aws:iam::123456789012:role/LeakGuardQaRole",
  "210987654321",
  "lg-prod-project-123",
  "987654321098",
  "otc-prod-de-ecs-001",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "cccccccccccccccccccccccccccccccc",
  "dddddddddddddddddddddddddddddddd",
  "prod-payments",
  "secret/db-password",
  "10.10.20.30",
  "10.10.20.0/24",
  "\\\\fs-prod-weu-01\\FSA1234567",
  "cifs/stdeberfileprd1234567.file.core.windows.net",
  "CN=svc-backup-prod,OU=Service Accounts,OU=SH070,DC=corp,DC=local",
  "AD123-SH070-FILE-L-STFSA1234567R",
  "fs-prod-weu-01.corp.local",
  "CORP\\\\adm-test.user",
  "svc-backup-prod",
  "jane.doe",
  "test.user@example.com"
];

const harmlessControls = [
  "rg-blue",
  "rg-test",
  "product-roadmap-item",
  "invoice 123456789012",
  "docs/page",
  "service/name",
  "random GUID 123e4567-e89b-12d3-a456-426614174000",
  "random FSA1234567 without context",
  "report.final.docx",
  "package.name"
];

function transformLikeChatGptPaste(text) {
  const manager = new PlaceholderManager();
  const detector = new Detector();
  const findings = detector.scan(text, { manager });
  return transformOutboundPrompt(text, {
    manager,
    findings,
    mode: "hide_public"
  });
}

function assertPlaceholderFamily(redactedText, family, label = "payload") {
  assert.ok(
    new RegExp(`\\[${family}_\\d+\\]`).test(redactedText),
    `${label} missing ${family}: ${redactedText}`
  );
}

function assertNoLdapQuoteCorruption(redactedText) {
  assert.doesNotMatch(
    redactedText,
    /"Value"\s*:\s*"\[LDAP_DN_\d+\],/,
    "LDAP replacement must not swallow the JSON closing quote"
  );
  assert.doesNotMatch(
    redactedText,
    /\[LDAP_DN_\d+\],\s*\r?\n\s*"Expected"/,
    "LDAP replacement must not leave a placeholder comma before the Expected field"
  );
}

function testCapturedEvidenceFixture() {
  assert.ok(fs.existsSync(capturedFailurePath), `missing captured failure fixture: ${capturedFailurePath}`);
  const capturedFailure = fs.readFileSync(capturedFailurePath, "utf8");

  for (const leaked of [
    "99999999-8888-7777-6666-555555555555",
    "11111111-2222-3333-4444-555555555555",
    "210987654321",
    "lg-prod-project-123",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "prod-payments",
    "secret/db-password",
    "FSA1234567",
    "CORP\\\\adm-test.user",
    "test.user@example.com"
  ]) {
    assert.ok(capturedFailure.includes(leaked), `captured fixture should preserve leaked evidence ${leaked}`);
  }

  assert.ok(
    capturedFailure.includes('"Value":  "[LDAP_DN_1],'),
    "captured fixture should preserve the malformed LDAP placeholder line"
  );
}

function testOriginalStructuredPayloadRedactsThroughChatGptPastePath() {
  const payload = fs.readFileSync(originalPayloadPath, "utf8");
  assert.doesNotThrow(() => JSON.parse(payload), "original structured QA payload should remain valid JSON");

  const { redactedText } = transformLikeChatGptPaste(payload);

  assert.doesNotThrow(() => JSON.parse(redactedText), redactedText);
  for (const family of expectedFamilies) {
    assertPlaceholderFamily(redactedText, family);
  }

  for (const raw of rawSensitiveValues) {
    assert.strictEqual(redactedText.includes(raw), false, `redacted output leaked ${raw}`);
  }

  assert.doesNotMatch(
    redactedText,
    /"Name":\s*"FILE_SHARE"[\s\S]{0,160}"Value":\s*"FSA1234567"/,
    "contextual file-share row should redact FSA1234567"
  );

  for (const harmless of harmlessControls) {
    assert.ok(redactedText.includes(harmless), `harmless value should remain visible: ${harmless}`);
  }

  const parsed = JSON.parse(redactedText);
  const ldapRow = parsed.sensitiveSyntheticValues.find((row) => row.Name === "LDAP_DN");
  assert.ok(ldapRow, "LDAP row should remain present");
  assert.match(ldapRow.Value, /^\[LDAP_DN_\d+\]$/, "LDAP value should be only the placeholder");

  const storageAccountRow = parsed.sensitiveSyntheticValues.find((row) => row.Name === "Azure storage account");
  assert.ok(storageAccountRow, "storage account row should remain present");
  assert.match(
    storageAccountRow.Value,
    /^\[STORAGE_ACCOUNT_\d+\]$/,
    "Azure storage account should keep the STORAGE_ACCOUNT placeholder family"
  );

  const otcResourceRow = parsed.sensitiveSyntheticValues.find((row) => row.Name === "OTC resource");
  assert.ok(otcResourceRow, "OTC resource row should remain present");
  assert.match(
    otcResourceRow.Value,
    /^\[OTC_RESOURCE_\d+\]$/,
    "OTC resource should keep the OTC_RESOURCE placeholder family"
  );

  assertNoLdapQuoteCorruption(redactedText);
}

function testCsvAndTableStructuredRows() {
  const csv = [
    "Type,Value,Notes",
    "tenantId,99999999-8888-7777-6666-555555555555,synthetic",
    "subscriptionId,11111111-2222-3333-4444-555555555555,synthetic",
    "AWS account,210987654321,synthetic",
    "project_id,lg-prod-project-123,synthetic",
    "project_number,987654321098,synthetic",
    "OpenStack project_id,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,synthetic",
    "OpenStack tenant_id,bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,synthetic",
    "OpenStack domain_id,cccccccccccccccccccccccccccccccc,synthetic",
    "OpenStack server_id,dddddddddddddddddddddddddddddddd,synthetic",
    "namespace,prod-payments,synthetic",
    "k8s resource,secret/db-password,synthetic",
    "file share,FSA1234567,synthetic",
    "username,CORP\\\\adm-test.user,synthetic",
    "email,test.user@example.com,synthetic",
    "invoice,123456789012,synthetic",
    "path,docs/page,synthetic",
    "random,package.name,synthetic"
  ].join("\n");

  const csvRedacted = transformLikeChatGptPaste(csv).redactedText;
  for (const family of csvExpectedFamilies) {
    assertPlaceholderFamily(csvRedacted, family, "csv");
  }
  assert.strictEqual(csvRedacted.includes("210987654321"), false, "CSV AWS account leaked");
  assert.strictEqual(csvRedacted.includes("secret/db-password"), false, "CSV Kubernetes secret leaked");
  assert.ok(csvRedacted.includes("invoice,123456789012,synthetic"), "CSV invoice control should remain");
  assert.ok(csvRedacted.includes("path,docs/page,synthetic"), "CSV path control should remain");
  assert.ok(csvRedacted.includes("random,package.name,synthetic"), "CSV package control should remain");

  const table = [
    "Type: tenantId",
    "Value: 99999999-8888-7777-6666-555555555555",
    "",
    "Type: LDAP",
    "Value: CN=svc-backup-prod,OU=Service Accounts,OU=SH070,DC=corp,DC=local",
    "",
    "Type: username",
    "Value: jane.doe"
  ].join("\n");

  const tableRedacted = transformLikeChatGptPaste(table).redactedText;
  assertPlaceholderFamily(tableRedacted, "AZURE_TENANT_ID", "table");
  assertPlaceholderFamily(tableRedacted, "LDAP_DN", "table");
  assertPlaceholderFamily(tableRedacted, "USERNAME", "table");
  assert.strictEqual(
    tableRedacted.includes("99999999-8888-7777-6666-555555555555"),
    false,
    "table tenant ID leaked"
  );
  assert.strictEqual(tableRedacted.includes("jane.doe"), false, "table username leaked");
  assertNoLdapQuoteCorruption(tableRedacted);
}

function testLiveQaCsvTableResultShapeRedactsThroughChatGptPastePath() {
  const csv = fs.readFileSync(csvTablePayloadPath, "utf8");
  const { redactedText } = transformLikeChatGptPaste(csv);
  assertLiveQaTablePayloadRedacted(redactedText, "live QA CSV table");
}

function assertLiveQaTablePayloadRedacted(redactedText, label) {
  for (const family of liveQaCsvTableExpectedFamilies) {
    assertPlaceholderFamily(redactedText, family, label);
  }

  for (const raw of [
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
  ]) {
    assert.strictEqual(redactedText.includes(raw), false, `${label} leaked ${raw}`);
  }

  for (const harmless of [
    "rg-blue",
    "rg-test",
    "product-roadmap-item",
    "invoice 123456789012",
    "docs/page",
    "service/name",
    "random GUID 123e4567-e89b-12d3-a456-426614174000",
    "report.final.docx",
    "package.name"
  ]) {
    assert.ok(redactedText.includes(harmless), `${label} should preserve ${harmless}`);
  }
}

function testLiveQaHtmlRenderedTableRedactsThroughChatGptPastePath() {
  const renderedCopy = fs.readFileSync(htmlRenderedCopyPayloadPath, "utf8");
  const { redactedText } = transformLikeChatGptPaste(renderedCopy);

  assertLiveQaTablePayloadRedacted(redactedText, "live QA HTML rendered table");
}

function testLiveQaHtmlSourceTableRedactsThroughChatGptPastePath() {
  const html = fs.readFileSync(htmlSourcePayloadPath, "utf8");
  const { redactedText } = transformLikeChatGptPaste(html);

  assertLiveQaTablePayloadRedacted(redactedText, "live QA HTML source table");
  assert.ok(redactedText.includes("<td>[OPENSTACK_PROJECT_ID_"), "HTML value cell punctuation should be preserved");
  assert.ok(redactedText.includes("<li>docs/page</li>"), "HTML harmless list item should remain structurally intact");
  assert.doesNotMatch(redactedText, /\[PWM_\d+\]\/li>/, "HTML tags must not be partially consumed by password fallback");
}

function run() {
  testCapturedEvidenceFixture();
  testOriginalStructuredPayloadRedactsThroughChatGptPastePath();
  testCsvAndTableStructuredRows();
  testLiveQaCsvTableResultShapeRedactsThroughChatGptPastePath();
  testLiveQaHtmlRenderedTableRedactsThroughChatGptPastePath();
  testLiveQaHtmlSourceTableRedactsThroughChatGptPastePath();
  console.log("PASS ChatGPT paste live QA failure regression");
}

run();
