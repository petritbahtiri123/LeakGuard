#!/usr/bin/env node

import { spawnSync } from "child_process";

const testFiles = [
  "tests/detector.test.js",
  "tests/placeholder_trust.test.js",
  "tests/natural_language_context.test.js",
  "tests/break_pack.test.js",
  "tests/ai_candidate_gate.test.js",
  "tests/transform_with_ai.test.js",
  "tests/ip_transform.test.js",
  "tests/ip_child_first_audit.test.js",
  "tests/composer_helpers.test.js",
  "tests/placeholder_rehydrator.test.js",
  "tests/response_observer.test.js",
  "tests/reveal_controller.test.js",
  "tests/typed_interception.test.js",
  "tests/adapter_contracts.test.js",
  "tests/content_event_bindings.test.js",
  "tests/file_drop_payload_shape.test.js",
  "tests/file_drop_streaming_guards.test.js",
  "tests/file_drag_guard.test.js",
  "tests/content_allow_once_interaction.test.js",
  "tests/content_file_drop_interception.test.js",
  "tests/protected_sites.test.js",
  "tests/enterprise_policy.test.js",
  "tests/ai_assist.test.js",
  "tests/file_type_registry.test.js",
  "tests/file_scanner.test.js",
  "tests/file_paste_helpers.test.js",
  "tests/streaming_file_redactor.test.js",
  "tests/productization.test.js",
  "tests/security.test.js",
  "tests/synthetic_pack.test.js",
  "tests/adversarial_redaction.test.js",
  "tests/performance/redaction-benchmark-flake.test.mjs",
  "tests/performance/redaction-benchmark.mjs",
  "tests/browser/extension_qa_harness_cleanup.test.mjs",
  "tests/build_targets.test.js"
];

// Set environment variables to disable Chrome extension permission prompts in headless mode
const env = {
  ...process.env,
  // Disable interactive prompts and permission dialogs
  CHROME_HEADLESS: "1",
  // Suppress DBus errors from headless Chrome
  NO_SANDBOX: "1"
};

for (const file of testFiles) {
  const result = spawnSync(process.execPath, [file], {
    cwd: process.cwd(),
    stdio: "inherit",
    env
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
