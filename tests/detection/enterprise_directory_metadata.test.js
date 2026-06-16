const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadCore, root } = require("../helpers/load_core.js");
loadCore();
const { Detector, PlaceholderManager, Redactor } = globalThis.PWM;
const dir = path.join(root, "tests/fixtures/detection");
function redact(text) { const detector = new Detector(); const manager = new PlaceholderManager(); const findings = detector.scan(text); return { findings, redactedText: new Redactor(manager).redact(text, findings).redactedText }; }
function run() {
  const positive = fs.readFileSync(path.join(dir, "enterprise_directory_positive.txt"), "utf8");
  const { findings, redactedText } = redact(positive);
  for (const type of ["UNC_PATH", "SPN", "LDAP_DN"]) assert.ok(findings.some((f) => f.type === type), `missing ${type}`);
  assert.ok(redactedText.includes("[UNC_PATH_1]"));
  assert.ok(redactedText.includes("[SPN_1]"));
  assert.ok(redactedText.includes("[LDAP_DN_1]"));
  assert.strictEqual(findings.some((f) => f.type === "HOSTNAME" && f.raw === "fs-prod-weu-01"), false, "UNC should win over hostname");
  assert.strictEqual(findings.some((f) => f.type === "HOSTNAME" && f.raw === "app-prod-weu.internal"), false, "SPN should win over hostname");
  assert.strictEqual(findings.some((f) => f.type === "USERNAME" && /svc-backup-prod/.test(f.raw)), false, "LDAP DN should win over username");

  const repeat = redact("cifs/stdeberfileprd1234567.file.core.windows.net cifs/stdeberfileprd1234567.file.core.windows.net").redactedText;
  assert.strictEqual(new Set(repeat.match(/\[SPN_\d+\]/g)).size, 1);

  const negative = fs.readFileSync(path.join(dir, "enterprise_directory_negative.txt"), "utf8");
  assert.deepStrictEqual(new Detector().scan(negative), []);
  console.log("PASS enterprise directory metadata detectors");
}
run();
