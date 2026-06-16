const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadCore, root } = require("../helpers/load_core.js");
loadCore();
const { Detector, PlaceholderManager, Redactor } = globalThis.PWM;
const dir = path.join(root, "tests/fixtures/detection");
function redact(text) { const detector = new Detector(); const manager = new PlaceholderManager(); const findings = detector.scan(text); return { findings, redactedText: new Redactor(manager).redact(text, findings).redactedText }; }
function run() {
  const positive = fs.readFileSync(path.join(dir, "file_share_positive.txt"), "utf8");
  const { findings, redactedText } = redact(positive);
  assert.ok(findings.some((f) => f.type === "FILE_SHARE"));
  assert.ok(redactedText.includes("[FILE_SHARE_1]"));
  const repeat = redact("file share FSA1234567 and ACL for FSA1234567").redactedText;
  assert.strictEqual(new Set(repeat.match(/\[FILE_SHARE_\d+\]/g)).size, 1);

  const mixed = fs.readFileSync(path.join(dir, "mixed_internal_metadata_sample.txt"), "utf8");
  const mixedResult = redact(mixed);
  for (const type of ["PRIVATE_IP", "PRIVATE_CIDR", "UNC_PATH", "SPN", "LDAP_DN", "FILE_SHARE", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID"]) assert.ok(mixedResult.findings.some((f) => f.type === type), `mixed missing ${type}`);
  assert.ok(mixedResult.redactedText.includes("8.8.8.8"));
  assert.ok(mixedResult.redactedText.includes("192.0.2.10"));
  assert.ok(mixedResult.redactedText.includes("random FSB1234567 prose"));

  const negative = fs.readFileSync(path.join(dir, "file_share_negative.txt"), "utf8");
  assert.deepStrictEqual(new Detector().scan(negative), []);
  console.log("PASS file share metadata detectors");
}
run();
