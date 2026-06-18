const assert = require("assert");
const { loadCore } = require("../helpers/load_core.js");
loadCore();

const { PlaceholderManager, Redactor, Detector, canonicalizePlaceholderToken, extractPlaceholderTokens } = globalThis.PWM;
const { PlaceholderFamilies } = globalThis.PWM;

function run() {
  assert.ok(PlaceholderFamilies.isTypedPlaceholderFamily("AWS_ARN"));
  assert.ok(PlaceholderFamilies.isTypedPlaceholderFamily("private_ip"));
  assert.strictEqual(PlaceholderFamilies.normalizePlaceholderFamily(" aws_arn "), "AWS_ARN");
  assert.strictEqual(canonicalizePlaceholderToken("[AWS_ARN_1]"), "[AWS_ARN_1]");

  const tokens = extractPlaceholderTokens("[PWM_1] [NET_1] [PUB_HOST_1] [AWS_ARN_1]");
  assert.deepStrictEqual(tokens, ["[PWM_1]", "[NET_1]", "[PUB_HOST_1]", "[AWS_ARN_1]"]);

  const manager = new PlaceholderManager();
  const first = manager.getPlaceholder("arn:aws:iam::123456789012:role/AdminRole", "AWS_ARN");
  const second = manager.getPlaceholder("arn:aws:iam::123456789012:role/AdminRole", "AWS_ARN");
  const pwm = manager.getPlaceholder("SuperSecretPassword123!", "PASSWORD");
  assert.strictEqual(first, "[AWS_ARN_1]");
  assert.strictEqual(second, first);
  assert.strictEqual(pwm, "[PWM_1]");

  manager.trackKnownPlaceholder("[NET_1]");
  manager.trackKnownPlaceholder("[PUB_HOST_1]");
  assert.ok(manager.knowsPlaceholder("[AWS_ARN_1]"));
  assert.ok(manager.knowsPlaceholder("[NET_1]"));
  assert.ok(manager.knowsPlaceholder("[PUB_HOST_1]"));

  const detector = new Detector();
  const redactor = new Redactor(manager);
  const alreadyRedacted = "AWS arn [AWS_ARN_1] and password [PWM_1] and host [NET_1]";
  assert.deepStrictEqual(detector.scan(alreadyRedacted, { manager }), []);
  assert.strictEqual(redactor.redact(alreadyRedacted, []).redactedText, alreadyRedacted);

  console.log("PASS typed placeholder family contract regressions");
}

run();
