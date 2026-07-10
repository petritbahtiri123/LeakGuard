import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const routerPath = path.join(root, ".codex", "hooks", "user_prompt_playbook_router.cjs");

function runRouter(payload) {
  const result = spawnSync(process.execPath, [routerPath], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify(payload)
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout || "{}");
}

function context(payload) {
  return runRouter(payload).hookSpecificOutput?.additionalContext;
}

function testIncidentalBackgroundTermsDoNotRoute() {
  assert.equal(
    context({ prompt: "Optimize agent hooks; prior notes mention Gemini drag and drop." }),
    undefined
  );
}

function testSpecificIssueFingerprintsRoute() {
  assert.match(
    context({ prompt: "Gemini file drop duplicates content in the editor" }),
    /gemini-drag-drop-file-ingestion\.md/
  );
  assert.match(
    context({ prompt: "Allow Once popup reopens for the same finding" }),
    /allow-once-popup-loop\.md/
  );
  assert.match(
    context({ prompt: "Firefox Add-ons rejects data_collection_permissions" }),
    /firefox-addon-submission\.md/
  );
}

function testRouterOutputStaysCompact() {
  const output = JSON.stringify(runRouter({ prompt: "Gemini file drop freezes the editor" }));
  assert.ok(output.length < 900, `router output was ${output.length} characters`);
}

function testOnlyPromptRouterIsConfigured() {
  const config = JSON.parse(fs.readFileSync(path.join(root, ".codex", "hooks.json"), "utf8"));
  assert.deepEqual(Object.keys(config.hooks), ["UserPromptSubmit"]);
  const serialized = JSON.stringify(config);
  assert.match(serialized, /user_prompt_playbook_router\.cjs/);
  assert.doesNotMatch(serialized, /SessionStart|PostToolUse|post_tool_repro_capture|\.py/);
}

testIncidentalBackgroundTermsDoNotRoute();
testSpecificIssueFingerprintsRoute();
testRouterOutputStaysCompact();
testOnlyPromptRouterIsConfigured();
console.log("PASS compact Codex hook routing");
