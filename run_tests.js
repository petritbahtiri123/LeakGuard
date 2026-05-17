#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");
const process = require("process");

// Change to repo directory
process.chdir(path.dirname(__filename));

// First prepare build
console.log("========================================");
console.log("Preparing build...");
console.log("========================================");
const prepareResult = spawnSync(process.execPath, ["scripts/prepare-build.mjs"], {
  stdio: "inherit"
});

if (prepareResult.status !== 0) {
  console.error("Build preparation failed!");
  process.exit(1);
}

// Run tests
console.log("\n========================================");
console.log("Running full test suite...");
console.log("========================================\n");
const testResult = spawnSync(process.execPath, ["scripts/run-tests.mjs"], {
  stdio: "inherit"
});

process.exit(testResult.status || 0);
