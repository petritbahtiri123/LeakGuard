#!/usr/bin/env node

/**
 * Minimal test runner to verify the fix doesn't break core functionality.
 * This runs just the composer_helpers test which has multiline validation.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const process = require("process");

const repoDir = path.dirname(__filename);

console.log("=============================================================");
console.log("Running Minimal Test Suite for ChatGPT Multiline Fix");
console.log("=============================================================\n");

// Step 1: Prepare build
console.log("Step 1: Preparing build...\n");
const prepareResult = spawnSync(process.execPath, ["scripts/prepare-build.mjs"], {
  cwd: repoDir,
  stdio: "inherit"
});

if (prepareResult.status !== 0) {
  console.error("\n❌ Build preparation failed!");
  process.exit(1);
}

// Step 2: Run composer_helpers test (has multiline validation)
console.log("\n=============================================================");
console.log("Step 2: Running Composer Helpers Test (includes multiline tests)...\n");
const composerTestResult = spawnSync(process.execPath, ["tests/composer_helpers.test.js"], {
  cwd: repoDir,
  stdio: "inherit"
});

if (composerTestResult.status !== 0) {
  console.error("\n❌ Composer helpers test failed!");
  process.exit(1);
}

// Step 3: Run content file drop interception test (has ChatGPT tests)
console.log("\n=============================================================");
console.log("Step 3: Running Content File Drop Test (includes ChatGPT multiline tests)...\n");
const contentTestResult = spawnSync(process.execPath, ["tests/content_file_drop_interception.test.js"], {
  cwd: repoDir,
  stdio: "inherit"
});

if (contentTestResult.status !== 0) {
  console.error("\n❌ Content file drop test failed!");
  process.exit(1);
}

console.log("\n=============================================================");
console.log("✅ SUCCESS: All critical tests passed!");
console.log("=============================================================\n");
console.log("Summary:");
console.log("  ✅ Build preparation: PASS");
console.log("  ✅ Composer helpers (multiline): PASS");
console.log("  ✅ Content file drop (ChatGPT): PASS");
console.log("\nThe ChatGPT multiline Firefox fix is working correctly!");
process.exit(0);
