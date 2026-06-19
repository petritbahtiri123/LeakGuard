const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadCore, root } = require("../helpers/load_core.js");
loadCore();
const { Detector, PlaceholderManager, Redactor } = globalThis.PWM;
const dir = path.join(root, "tests/fixtures/detection");
function redact(text) { const detector = new Detector(); const manager = new PlaceholderManager(); const findings = detector.scan(text); return { findings, redactedText: new Redactor(manager).redact(text, findings).redactedText }; }
function run() {
  const positive = fs.readFileSync(path.join(dir, "internal_network_positive.txt"), "utf8");
  const { findings, redactedText } = redact(positive);
  for (const type of ["PRIVATE_IP", "PRIVATE_CIDR", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID"]) assert.ok(findings.some((f) => f.type === type), `missing ${type}`);
  assert.ok(redactedText.includes("[PRIVATE_IP_1]"));
  assert.ok(redactedText.includes("[PRIVATE_CIDR_1]"));
  assert.ok(redactedText.includes("tenantId: [AZURE_TENANT_ID_1]"));
  assert.ok(redactedText.includes("subscription_id=[AZURE_SUBSCRIPTION_ID_1]"));
  assert.strictEqual(findings.some((f) => f.type === "PRIVATE_IP" && f.raw === "10.10.20.0"), false, "CIDR should win over embedded IP");

  const repeat = redact("10.10.20.30 again 10.10.20.30 and 10.0.0.0/8 plus 10.0.0.0/8").redactedText;
  assert.strictEqual(new Set(repeat.match(/\[PRIVATE_IP_\d+\]/g)).size, 1);
  assert.strictEqual(new Set(repeat.match(/\[PRIVATE_CIDR_\d+\]/g)).size, 1);

  const negative = fs.readFileSync(path.join(dir, "internal_network_negative.txt"), "utf8");
  assert.deepStrictEqual(new Detector().scan(negative), []);
  console.log("PASS internal network metadata detectors");
}
run();
