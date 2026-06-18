const assert = require("assert");
const path = require("path");
const { loadCore, root } = require("../helpers/load_core.js");
loadCore();
require(path.join(root, "src/content/rehydration/placeholderRehydrator.js"));

const {
  ANY_PLACEHOLDER_TOKEN_REGEX,
  Detector,
  PlaceholderManager,
  PlaceholderRehydrator,
  Redactor,
  normalizeVisiblePlaceholders,
  transformOutboundPrompt
} = globalThis.PWM;

const SAMPLE = [
  "Azure resource group rg-prod-weu-files-001",
  "storage account stdeberfileprd1234567",
  "tenantId: 99999999-8888-7777-6666-555555555555",
  "subscriptionId: 11111111-2222-3333-4444-555555555555",
  "Private IP 10.10.20.30",
  "Private CIDR 10.10.20.0/24",
  "UNC \\\\fs-prod-weu-01\\FSA1234567",
  "SPN cifs/stdeberfileprd1234567.file.core.windows.net",
  "LDAP CN=svc-backup-prod,OU=Service Accounts,OU=SH070,DC=corp,DC=local",
  "Azure Files share FSA1234567",
  "host fs-prod-weu-01.corp.local",
  "user CORP\\adm-test.user",
  "EMAIL=test.user@example.com"
].join("\n");

const EXPECTED_TYPED_FAMILIES = [
  "AZURE_RG",
  "STORAGE_ACCOUNT",
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "PRIVATE_IP",
  "PRIVATE_CIDR",
  "UNC_PATH",
  "SPN",
  "LDAP_DN",
  "FILE_SHARE",
  "HOSTNAME",
  "USERNAME",
  "EMAIL"
];

function run() {
  const manager = new PlaceholderManager();
  const detector = new Detector();
  const findings = detector.scan(SAMPLE, { manager });
  const result = transformOutboundPrompt(SAMPLE, {
    manager,
    findings,
    mode: "hide_public"
  });
  const trustedPlaceholders = manager.exportPublicState().knownPlaceholders;
  const redactedText = result.redactedText;

  for (const family of EXPECTED_TYPED_FAMILIES) {
    assert.match(redactedText, new RegExp(`\\[${family}_\\d+\\]`), `missing ${family}`);
  }

  const trustedTyped = trustedPlaceholders.filter((placeholder) =>
    EXPECTED_TYPED_FAMILIES.some((family) => placeholder.startsWith(`[${family}_`))
  );
  assert.strictEqual(trustedTyped.length >= EXPECTED_TYPED_FAMILIES.length, true);

  const segments = PlaceholderRehydrator.tokenizePlaceholderText(redactedText, {
    normalizeVisiblePlaceholders,
    placeholderTokenRegex: ANY_PLACEHOLDER_TOKEN_REGEX,
    trustedPlaceholders
  });
  const secretPlaceholders = segments
    .filter((segment) => segment.type === "secret")
    .map((segment) => segment.placeholder);

  for (const placeholder of trustedTyped) {
    assert.ok(secretPlaceholders.includes(placeholder), `trusted typed placeholder did not hydrate: ${placeholder}`);
  }

  const unknownSegments = PlaceholderRehydrator.tokenizePlaceholderText("fake [PRIVATE_IP_999]", {
    normalizeVisiblePlaceholders,
    placeholderTokenRegex: ANY_PLACEHOLDER_TOKEN_REGEX,
    trustedPlaceholders
  });
  assert.deepStrictEqual(unknownSegments, [
    {
      type: "text",
      value: "fake "
    },
    {
      type: "text",
      value: "[PRIVATE_IP_999]"
    }
  ]);

  const rerunFindings = new Detector().scan(redactedText, { manager, trustedPlaceholders });
  assert.deepStrictEqual(rerunFindings, [], "trusted typed placeholders should not be re-detected");
  assert.strictEqual(new Redactor(manager).redact(redactedText, rerunFindings).redactedText, redactedText);

  console.log("PASS typed placeholder rehydration contract regressions");
}

run();
