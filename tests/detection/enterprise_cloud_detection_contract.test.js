const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadCore, root } = require("../helpers/load_core.js");
loadCore();

const { Detector, PlaceholderManager, Redactor } = globalThis.PWM;
const fixtureDir = path.join(root, "tests/fixtures/detection");

function redact(text) {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const findings = detector.scan(text);
  return new Redactor(manager).redact(text, findings).redactedText;
}

const expected = {
  "cloud_provider_azure_positive.txt": ["[AZURE_RG_1]", "[CLOUD_RESOURCE_1]", "[STORAGE_ACCOUNT_1]", "[CLOUD_ENDPOINT_1]"],
  "cloud_provider_aws_positive.txt": ["[AWS_ACCOUNT_ID_1]", "[AWS_ARN_1]", "[S3_BUCKET_1]", "[AWS_ENDPOINT_1]"],
  "cloud_provider_gcp_positive.txt": ["[GCP_PROJECT_1]", "[GCP_PROJECT_NUMBER_1]", "[GCP_SERVICE_ACCOUNT_1]", "[GCP_RESOURCE_1]", "[GCS_BUCKET_1]"],
  "cloud_provider_otc_openstack_positive.txt": ["[OTC_RESOURCE_1]", "[OPENSTACK_PROJECT_ID_1]", "[OPENSTACK_TENANT_ID_1]", "[OPENSTACK_DOMAIN_ID_1]", "[OTC_ENDPOINT_1]"],
  "cloud_provider_kubernetes_positive.txt": ["[K8S_NAMESPACE_1]", "[K8S_CLUSTER_1]", "[K8S_RESOURCE_1]", "[K8S_SECRET_1]", "[KUBECONFIG_SECRET_1]"]
};

function run() {
  for (const [file, placeholders] of Object.entries(expected)) {
    const text = fs.readFileSync(path.join(fixtureDir, file), "utf8");
    const redactedText = redact(text);
    for (const placeholder of placeholders) {
      assert.ok(redactedText.includes(placeholder), `${file} missing ${placeholder}: ${redactedText}`);
    }
  }

  const negative = fs.readFileSync(path.join(fixtureDir, "cloud_provider_negative.txt"), "utf8");
  assert.strictEqual(redact(negative), negative);

  const mixed = fs.readFileSync(path.join(fixtureDir, "mixed_multicloud_enterprise_sample.txt"), "utf8");
  const mixedRedacted = redact(mixed);
  assert.ok(mixedRedacted.includes("[AZURE_RG_1]"));
  assert.ok(mixedRedacted.includes("[AWS_ARN_1]"));
  assert.ok(mixedRedacted.includes("[GCP_PROJECT_1]"));
  assert.ok(mixedRedacted.includes("[OTC_RESOURCE_1]"));
  assert.ok(mixedRedacted.includes("[OPENSTACK_PROJECT_ID_1]"));
  assert.ok(mixedRedacted.includes("[K8S_NAMESPACE_1]"));
  assert.ok(mixedRedacted.includes("rg-blue"));
  assert.ok(mixedRedacted.includes("invoice 123456789012"));

  console.log("PASS enterprise/cloud detection contract regressions");
}

run();
