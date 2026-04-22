const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "shared/placeholders.js"));
require(path.join(repoRoot, "shared/entropy.js"));
require(path.join(repoRoot, "shared/patterns.js"));
require(path.join(repoRoot, "shared/detector.js"));
require(path.join(repoRoot, "shared/ipClassification.js"));
require(path.join(repoRoot, "shared/ipDetection.js"));
require(path.join(repoRoot, "shared/networkHierarchy.js"));
require(path.join(repoRoot, "shared/placeholderAllocator.js"));
require(path.join(repoRoot, "shared/sessionMapStore.js"));
require(path.join(repoRoot, "shared/transformOutboundPrompt.js"));

const {
  Detector,
  PlaceholderManager,
  buildNetworkUiFindings,
  classifyNetworkToken,
  hasTransformableNetworkData,
  transformOutboundPrompt,
  normalizeTransformMode
} = globalThis.PWM;

function transform(text, options = {}) {
  const manager = options.manager || new PlaceholderManager();
  return {
    manager,
    result: transformOutboundPrompt(text, {
      manager,
      findings: options.findings || [],
      mode: options.mode || "hide_public"
    })
  };
}

function testClassificationDefaults() {
  const privateHost = classifyNetworkToken("192.168.1.10");
  const loopback = classifyNetworkToken("127.0.0.1");
  const linkLocal = classifyNetworkToken("169.254.10.20");
  const publicHost = classifyNetworkToken("8.8.8.8");
  const publicCidr = classifyNetworkToken("188.188.188.0/24");

  assert.strictEqual(privateHost.isPublic, false);
  assert.strictEqual(loopback.scope, "loopback");
  assert.strictEqual(linkLocal.scope, "link_local");
  assert.strictEqual(publicHost.isPublic, true);
  assert.strictEqual(publicCidr.isSubnet, true);
  assert.strictEqual(classifyNetworkToken("10.0.0.0/7").isPublic, true);
  assert.strictEqual(classifyNetworkToken("192.168.0.0/15").isPublic, true);
  assert.strictEqual(classifyNetworkToken("0.0.0.255").isPublic, false);
  assert.strictEqual(classifyNetworkToken("0.0.0.0/0").isPublic, false);

  assert.strictEqual(hasTransformableNetworkData("allow 192.168.1.10", { mode: "hide_public" }), false);
  assert.strictEqual(hasTransformableNetworkData("allow 127.0.0.1", { mode: "hide_public" }), false);
  assert.strictEqual(hasTransformableNetworkData("allow 169.254.10.20", { mode: "hide_public" }), false);
  assert.strictEqual(hasTransformableNetworkData("allow 8.8.8.8", { mode: "hide_public" }), true);
  assert.strictEqual(
    hasTransformableNetworkData("route 188.188.188.0/24", { mode: "hide_public" }),
    true
  );

  const uiFindings = buildNetworkUiFindings(
    "Allow 192.168.1.10 and 8.8.8.8 and route 188.188.188.0/24",
    { mode: "hide_public" }
  );

  assert.deepStrictEqual(
    uiFindings.map((finding) => finding.raw),
    ["8.8.8.8", "188.188.188.0/24"],
    "UI findings should expose only public IPv4 data in default mode"
  );
}

function testDeterministicMapping() {
  const manager = new PlaceholderManager();
  const text = "DNS 8.8.8.8 mirrors 8.8.8.8 and route 188.188.188.0/24 then 188.188.188.0/24";
  const first = transform(text, { manager }).result.redactedText;
  const second = transform(text, { manager }).result.redactedText;

  assert.strictEqual(first, second, "same session text should transform deterministically");
  assert.strictEqual((first.match(/\[PUB_HOST_1(?:_DNS)?\]/g) || []).length, 2);
  assert.strictEqual((first.match(/\[NET_1\]/g) || []).length, 2);

  const distinct = transform("Firewall allows 8.8.8.8 and 1.1.1.1", {
    manager: new PlaceholderManager()
  }).result.redactedText;

  assert.ok(distinct.includes("[PUB_HOST_1]"));
  assert.ok(distinct.includes("[PUB_HOST_2]"));
}

function testHierarchyPreservation() {
  const manager = new PlaceholderManager();
  const { result } = transform(
    "Route 188.188.188.0/24 into 188.188.188.0/25 and 188.188.188.128/25",
    { manager }
  );
  const objects = manager.exportPrivateState().objects;
  const root = objects.find((object) => object.original === "188.188.188.0/24");
  const childA = objects.find((object) => object.original === "188.188.188.0/25");
  const childB = objects.find((object) => object.original === "188.188.188.128/25");

  assert.strictEqual(
    result.redactedText,
    "Route [NET_1] into [NET_1_SUB_1] and [NET_1_SUB_2]"
  );
  assert.strictEqual(root.parent, null);
  assert.strictEqual(childA.parent, "[NET_1]");
  assert.strictEqual(childB.parent, "[NET_1]");
  assert.strictEqual(childA.prefix, 25);
  assert.strictEqual(childB.prefix, 25);
}

function testModes() {
  const sample = "Allow 192.168.1.10 to reach 8.8.8.8 and route 10.0.0.0/8 to 188.188.188.0/24";
  const hidePublic = transform(sample, { mode: "hide_public" }).result.redactedText;
  const hideAll = transform(sample, { mode: "hide_all" }).result.redactedText;
  const raw = transform(sample, { mode: "raw" }).result.redactedText;

  assert.ok(hidePublic.includes("192.168.1.10"));
  assert.ok(hidePublic.includes("10.0.0.0/8"));
  assert.ok(/\[PUB_HOST_1(?:_(?:GW|VIP|DNS))?\]/.test(hidePublic));
  assert.ok(hidePublic.includes("[NET_1]"));

  assert.strictEqual(hideAll.includes("192.168.1.10"), false);
  assert.strictEqual(hideAll.includes("10.0.0.0/8"), false);
  assert.ok(/\[PUB_HOST_1(?:_(?:GW|VIP|DNS))?\]/.test(hideAll));
  assert.ok(/\[NET_\d+\]/.test(hideAll));

  assert.strictEqual(raw, sample);
  assert.strictEqual(normalizeTransformMode("bogus"), "hide_public");
}

function testMixedTextCases() {
  const exampleOne = transform(
    "Allow 192.168.1.10 to talk to 188.188.188.10 via gateway 188.188.188.1"
  ).result.redactedText;
  const roleOrdering = transform(
    "net 188.188.188.0/24 host 188.188.188.10 gw 188.188.188.1"
  ).result.redactedText;
  const exampleTwo = transform("Firewall allows 8.8.8.8 and 1.1.1.1").result.redactedText;

  assert.ok(exampleOne.includes("192.168.1.10"));
  assert.ok(/\[PUB_HOST_\d+\]/.test(exampleOne));
  assert.ok(
    /\[PUB_HOST_\d+_GW\]|\[PUB_HOST_\d+\]/.test(exampleOne),
    "gateway host should optionally carry a semantic role when context is explicit"
  );
  assert.strictEqual(
    roleOrdering,
    "net [NET_1] host [NET_1_HOST_1] gw [NET_1_GW]",
    "role inference should stay conservative and not label the wrong host as gateway"
  );
  assert.strictEqual(exampleTwo, "Firewall allows [PUB_HOST_1] and [PUB_HOST_2]");
}

function testNoFalseCorruption() {
  const text = [
    "Invalid 999.999.999.999 should stay.",
    "Version 1.2.3 should stay.",
    "Build v1.2.3-beta should stay.",
    "Ticket 12345 should stay.",
    "Default route 0.0.0.0/0 should stay.",
    "Wildcard mask 0.0.0.255 should stay."
  ].join(" ");
  const { result } = transform(text);

  assert.strictEqual(result.redactedText, text);
}

function testSessionResetBehavior() {
  const firstManager = new PlaceholderManager();
  const first = transform("Allow 8.8.8.8 and 1.1.1.1", { manager: firstManager }).result.redactedText;
  const persisted = firstManager.exportPrivateState();
  const secondManager = new PlaceholderManager();
  secondManager.setPrivateState(persisted);
  const second = transform("Allow 8.8.8.8 and 1.1.1.1", { manager: secondManager }).result.redactedText;
  const fresh = transform("Allow 8.8.8.8 and 1.1.1.1", { manager: new PlaceholderManager() }).result.redactedText;

  assert.strictEqual(first, second, "rehydrated same session should preserve mappings");
  assert.strictEqual(fresh, "Allow [PUB_HOST_1] and [PUB_HOST_2]");
}

function testLeakageRegression() {
  const samples = [
    "Route 188.188.188.0/24 into 188.188.188.0/25 and 188.188.188.128/25",
    "Allow 192.168.1.10 to talk to 188.188.188.10 via gateway 188.188.188.1",
    '{"dns":"8.8.8.8","lan":"192.168.1.1","cidr":"188.188.188.0/24"}',
    "iptables -A INPUT -s 188.188.188.0/24 -j ACCEPT && ping 8.8.8.8",
    "traceroute 8.8.8.8 via 1.1.1.1 and route add 188.188.188.0/24 gw 188.188.188.1",
    "/ip firewall address-list add address=188.188.188.0/24 list=wan\n/ip route add gateway=188.188.188.1 dst-address=0.0.0.0/0"
  ];

  for (const sample of samples) {
    const output = transform(sample).result.redactedText;
    assert.strictEqual(
      /\b(?:8\.8\.8\.8|1\.1\.1\.1|188\.188\.188\.(?:0\/24|0\/25|128\/25|1|10))\b/.test(output),
      false,
      `public IP data leaked in transformed output: ${output}`
    );
  }
}

function testMixedSecretAndIpBlockStillRedactsOnFirstPass() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const text = [
    "AWS_ACCESS_KEY_ID=[PWM_1]",
    "AWS_SECRET_ACCESS_KEY=[PWM_2]",
    "OPENAI_API_KEY=sk-test-example-1234567890abcdef",
    "DB_PASSWORD=SuperSecret123!",
    "resolver=8.8.8.8",
    "LAN=192.168.1.10"
  ].join("\n");

  const findings = detector.scan(text);
  const output = transform(text, {
    manager,
    findings
  }).result.redactedText;
  const lines = output.split("\n");

  assert.strictEqual(lines[0], "AWS_ACCESS_KEY_ID=[PWM_1]");
  assert.strictEqual(lines[1], "AWS_SECRET_ACCESS_KEY=[PWM_2]");
  assert.ok(/^OPENAI_API_KEY=\[PWM_\d+\]$/.test(lines[2]));
  assert.ok(/^DB_PASSWORD=\[PWM_\d+\]$/.test(lines[3]));
  assert.ok(/^resolver=\[PUB_HOST_\d+(?:_DNS)?\]$/.test(lines[4]));
  assert.strictEqual(lines[5], "LAN=192.168.1.10");
  assert.strictEqual(output.includes("sk-test-example-1234567890abcdef"), false);
  assert.strictEqual(output.includes("SuperSecret123!"), false);
  assert.strictEqual(output.includes("8.8.8.8"), false);
}

function testKnownPlaceholderSecretReusesSameMappingAcrossMixedPrompt() {
  const manager = new PlaceholderManager();
  manager.getPlaceholder("abc123secret");

  const text = ["API_KEY=[PWM_1]", "mirror=abc123secret"].join("\n");
  const output = transform(text, { manager }).result.redactedText;

  assert.strictEqual(output, ["API_KEY=[PWM_1]", "mirror=[PWM_1]"].join("\n"));
}

function testDetectedSecretAlsoRedactsLaterDuplicateOccurrences() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const text = ["API_KEY=abc123secret", "mirror=abc123secret"].join("\n");
  const findings = detector.scan(text);
  const output = transform(text, { manager, findings }).result.redactedText;

  assert.strictEqual(output, ["API_KEY=[PWM_1]", "mirror=[PWM_1]"].join("\n"));
}

function testSyntheticMixedNetworkAndSecretBlock() {
  const detector = new Detector();
  const manager = new PlaceholderManager();
  const text = [
    "GITHUB_TOKEN=ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3",
    "DB_PASSWORD=HarborLock4455!",
    "WAN_CIDR=45.67.89.0/24",
    "WAN_CANARY=45.67.89.128/25",
    "PUBLIC_HOST=45.67.89.10",
    "PUBLIC_GW=45.67.89.1",
    "DNS_RESOLVER=9.9.9.9",
    "PRIVATE_HOST=192.168.1.10",
    "PRIVATE_CIDR=10.0.0.0/8",
    "LOOPBACK=127.0.0.1",
    "LINK_LOCAL=169.254.10.20",
    "DEFAULT_ROUTE=0.0.0.0/0",
    "WILDCARD_MASK=0.0.0.255",
    "INVALID_HOST=999.999.999.999",
    "BUILD=v1.2.3-beta"
  ].join("\n");

  const findings = detector.scan(text);
  const output = transform(text, {
    manager,
    findings
  }).result.redactedText;

  assert.strictEqual(output.includes("ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3"), false);
  assert.strictEqual(output.includes("HarborLock4455!"), false);
  assert.strictEqual(output.includes("45.67.89.0/24"), false);
  assert.strictEqual(output.includes("45.67.89.128/25"), false);
  assert.strictEqual(output.includes("45.67.89.10"), false);
  assert.strictEqual(output.includes("45.67.89.1"), false);
  assert.strictEqual(output.includes("9.9.9.9"), false);

  assert.ok(output.includes("PRIVATE_HOST=192.168.1.10"));
  assert.ok(output.includes("PRIVATE_CIDR=10.0.0.0/8"));
  assert.ok(output.includes("LOOPBACK=127.0.0.1"));
  assert.ok(output.includes("LINK_LOCAL=169.254.10.20"));
  assert.ok(output.includes("DEFAULT_ROUTE=0.0.0.0/0"));
  assert.ok(output.includes("WILDCARD_MASK=0.0.0.255"));
  assert.ok(output.includes("INVALID_HOST=999.999.999.999"));
  assert.ok(output.includes("BUILD=v1.2.3-beta"));

  assert.ok(/WAN_CIDR=\[NET_1\]/.test(output));
  assert.ok(/WAN_CANARY=\[(?:NET_1_SUB_1|NET_1_SUB_2)\]/.test(output));
  assert.ok(/PUBLIC_HOST=\[NET_1_HOST_1\]/.test(output));
  assert.ok(/PUBLIC_GW=\[NET_1_HOST_\d+\]/.test(output));
  assert.ok(/DNS_RESOLVER=\[PUB_HOST_\d+(?:_DNS)?\]/.test(output));
}

function run() {
  testClassificationDefaults();
  testDeterministicMapping();
  testHierarchyPreservation();
  testModes();
  testMixedTextCases();
  testMixedSecretAndIpBlockStillRedactsOnFirstPass();
  testKnownPlaceholderSecretReusesSameMappingAcrossMixedPrompt();
  testDetectedSecretAlsoRedactsLaterDuplicateOccurrences();
  testSyntheticMixedNetworkAndSecretBlock();
  testNoFalseCorruption();
  testSessionResetBehavior();
  testLeakageRegression();
  console.log("PASS network-aware outbound transform regressions");
}

run();
