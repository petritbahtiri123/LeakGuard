const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadCore, root } = require("../helpers/load_core.js");

loadCore();

const { Detector, PlaceholderManager, transformOutboundPrompt } = globalThis.PWM;
const FIXTURE = path.join(root, "tests/fixtures/detection/structured_payload_pipeline_regression.txt");

const RAW_SENSITIVE_VALUES = [
  "99999999-8888-7777-6666-555555555555",
  "11111111-2222-3333-4444-555555555555",
  "CN=svc-api,OU=Apps,OU=SH070,DC=corp,DC=local",
  "test.user@example.com",
  "CORP\\adm-test.user",
  "my-prod-project",
  "11111111111111111111111111111111",
  "22222222-2222-2222-2222-222222222222",
  "prod-payments",
  "secret/db-password"
];

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

const EXPECTED_FAMILIES = [
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "AWS_ACCOUNT_ID",
  "GCP_PROJECT",
  "OPENSTACK_PROJECT_ID",
  "OPENSTACK_TENANT_ID",
  "K8S_NAMESPACE",
  "K8S_SECRET",
  "FILE_SHARE",
  "USERNAME",
  "EMAIL",
  "LDAP_DN"
];

function redactStructuredPayload(text, manager = new PlaceholderManager()) {
  const detector = new Detector();
  const findings = detector.scan(text, { manager });
  const result = transformOutboundPrompt(text, {
    manager,
    findings,
    mode: "raw"
  });
  return {
    ...result,
    findings,
    manager
  };
}

function placeholdersByFamily(redactedText, family) {
  return redactedText.match(new RegExp(`\\[${family}_\\d+\\]`, "g")) || [];
}

function assertExpectedFamilies(redactedText) {
  for (const family of EXPECTED_FAMILIES) {
    assert.ok(
      placeholdersByFamily(redactedText, family).length > 0,
      `missing ${family} placeholder in:\n${redactedText}`
    );
  }
}

function assertRawSensitiveValuesRedacted(redactedText) {
  for (const raw of RAW_SENSITIVE_VALUES) {
    assert.strictEqual(redactedText.includes(raw), false, `raw sensitive value leaked: ${raw}`);
  }
}

function assertHarmlessValuesPreserved(redactedText) {
  for (const harmless of HARMLESS_VALUES) {
    assert.ok(redactedText.includes(harmless), `harmless value should remain visible: ${harmless}`);
  }
}

function assertStructuredSyntaxPreserved(redactedText) {
  assert.match(
    redactedText,
    /\{ "Type": "LDAP DN", "Value": "\[LDAP_DN_\d+\]", "Notes": "contains commas" \}/,
    "JSON-ish LDAP DN line should keep balanced quotes and punctuation"
  );
  assert.match(
    redactedText,
    /"LDAP DN","\[LDAP_DN_\d+\]","quoted value contains commas"/,
    "quoted CSV LDAP DN row should keep its CSV columns and quotes"
  );
  assert.match(
    redactedText,
    /\| LDAP DN \| \[LDAP_DN_\d+\] \| comma value \|/,
    "table-ish LDAP DN row should keep cell delimiters"
  );
  assert.strictEqual(redactedText.includes('"Value":  "[LDAP_DN_1],'), false);
  assert.strictEqual(redactedText.includes('"Value": "[LDAP_DN_1],'), false);
  assert.strictEqual(redactedText.includes('[LDAP_DN_1],"quoted'), false);
}

function assertRerunStable(firstRedacted, secondRedacted, secondFindings) {
  assert.strictEqual(secondRedacted, firstRedacted, "rerun should not change redacted structured payload");
  assert.deepStrictEqual(secondFindings, [], "trusted structured placeholders should not be re-detected");
  assertStructuredSyntaxPreserved(secondRedacted);
  assertHarmlessValuesPreserved(secondRedacted);
}

function testStructuredPayloadFullPipeline() {
  const text = fs.readFileSync(FIXTURE, "utf8");
  const { redactedText } = redactStructuredPayload(text);

  assertExpectedFamilies(redactedText);
  assertRawSensitiveValuesRedacted(redactedText);
  assertHarmlessValuesPreserved(redactedText);
  assertStructuredSyntaxPreserved(redactedText);
}

function testStructuredPayloadRerunSafety() {
  const text = `${fs.readFileSync(FIXTURE, "utf8")}\nunknown placeholder [FAKE_SECRET_999]\n`;
  const manager = new PlaceholderManager();
  const first = redactStructuredPayload(text, manager);
  const second = redactStructuredPayload(first.redactedText, manager);

  assert.strictEqual(manager.knowsPlaceholder("[FAKE_SECRET_999]"), false, "fake placeholder should not become trusted session state");
  assertRerunStable(first.redactedText, second.redactedText, second.findings);

  for (const family of EXPECTED_FAMILIES) {
    assert.deepStrictEqual(
      placeholdersByFamily(second.redactedText, family),
      placeholdersByFamily(first.redactedText, family),
      `${family} placeholders should not be reallocated on rerun`
    );
  }
}

testStructuredPayloadFullPipeline();
testStructuredPayloadRerunSafety();
console.log("PASS structured payload full-pipeline regressions");
