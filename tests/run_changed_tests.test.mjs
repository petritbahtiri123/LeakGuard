import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { selectValidationCommands } = await import("../scripts/run-changed-tests.mjs");

const cases = [
  [["docs/guide.md"], ["npm run docs:check-links"]],
  [["AGENTS.md"], ["npm run validate:codex-memory", "npm run docs:check-links"]],
  [[".codex/hooks.json"], ["node tests/codex_hooks.test.mjs", "npm run validate:codex-memory"]],
  [["src/shared/detector.js"], ["node tests/detector.test.js"]],
  [["src/content/files/fileDropOrchestration.js"], ["node tests/content_file_drop_interception.test.js"]],
  [
    ["src/shared/runtime_scripts.js"],
    [
      "npm test",
      "node tests/runtime_script_order.test.js",
      "node tests/runtime_script_order_contract.test.js",
      "node tests/build_targets.test.js",
      "node tests/security.test.js"
    ]
  ],
  [["package.json"], ["npm test"]],
  [["src/unknown/new-module.js"], ["npm test"]],
  [[], []]
];

for (const [files, expected] of cases) {
  assert.deepEqual(selectValidationCommands(files), expected, `unexpected commands for ${files.join(", ")}`);
}

assert.deepEqual(
  selectValidationCommands(["docs/one.md", "docs/two.md", "AGENTS.md"]),
  ["npm run docs:check-links", "npm run validate:codex-memory"],
  "commands should be deduplicated in stable first-match order"
);

const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
assert.equal(packageJson.scripts["test:changed"], "node scripts/run-changed-tests.mjs");
assert.equal(packageJson.scripts["test:fast"], "npm test");
assert.equal(packageJson.scripts["test:ci"], "npm run test:fast");

console.log("PASS change-aware test selection");
