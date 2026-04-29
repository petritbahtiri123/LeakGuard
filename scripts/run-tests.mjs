#!/usr/bin/env node

import { spawnSync } from "child_process";

const testFiles = [
  "tests/detector.test.js",
  "tests/break_pack.test.js",
  "tests/ai_candidate_gate.test.js",
  "tests/transform_with_ai.test.js",
  "tests/ip_transform.test.js",
  "tests/ip_child_first_audit.test.js",
  "tests/composer_helpers.test.js",
  "tests/typed_interception.test.js",
  "tests/protected_sites.test.js",
  "tests/enterprise_policy.test.js",
  "tests/ai_assist.test.js",
  "tests/file_scanner.test.js",
  "tests/productization.test.js",
  "tests/security.test.js",
  "tests/synthetic_pack.test.js",
  "tests/adversarial_redaction.test.js",
  "tests/build_targets.test.js"
];

for (const file of testFiles) {
  const result = spawnSync(process.execPath, [file], {
    cwd: process.cwd(),
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
