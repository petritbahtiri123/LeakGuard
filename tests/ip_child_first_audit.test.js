const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "shared/placeholders.js"));
require(path.join(repoRoot, "shared/ipClassification.js"));
require(path.join(repoRoot, "shared/ipDetection.js"));
require(path.join(repoRoot, "shared/networkHierarchy.js"));
require(path.join(repoRoot, "shared/placeholderAllocator.js"));
require(path.join(repoRoot, "shared/sessionMapStore.js"));
require(path.join(repoRoot, "shared/transformOutboundPrompt.js"));

const { PlaceholderManager, transformOutboundPrompt } = globalThis.PWM;

function transform(manager, text) {
  return transformOutboundPrompt(text, {
    manager,
    mode: "hide_public",
    findings: []
  });
}

function run() {
  const manager = new PlaceholderManager();

  const first = transform(manager, "first 188.188.188.0/25");
  const second = transform(manager, "second 188.188.188.0/24");
  const third = transform(manager, "third 188.188.188.128/25");
  const objects = manager.exportPrivateState().objects;
  const parent = objects.find((object) => object.original === "188.188.188.0/24");
  const firstChild = objects.find((object) => object.original === "188.188.188.0/25");
  const sibling = objects.find((object) => object.original === "188.188.188.128/25");

  assert.strictEqual(first.redactedText, "first [NET_1]");
  assert.strictEqual(second.redactedText, "second [NET_2]");
  assert.strictEqual(third.redactedText, "third [NET_2_SUB_1]");
  assert.strictEqual(firstChild.parent, null);
  assert.strictEqual(parent.parent, null);
  assert.strictEqual(sibling.parent, "[NET_2]");
  assert.notStrictEqual(
    firstChild.placeholder.split("_SUB_")[0],
    parent.placeholder.replace(/^\[/, "").replace(/\]$/, ""),
    "child-first audit expects the current implementation to keep the first child in a separate family"
  );

  console.log("PASS child-first hierarchy audit reproduced current cross-session family instability");
}

run();
