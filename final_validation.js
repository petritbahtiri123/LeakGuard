#!/usr/bin/env node

/**
 * Final validation that the ChatGPT multiline Firefox fix is correctly applied.
 */

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/content/content.js");
const source = fs.readFileSync(filePath, "utf8");

console.log("=============================================================");
console.log("ChatGPT Multiline Firefox Fix - Final Validation");
console.log("=============================================================\n");

// Extract the tryChatGptDirectWrite function
const funcMatch = source.match(/function tryChatGptDirectWrite\([^)]*\) \{[\s\S]*?\n  \}/);
if (!funcMatch) {
  console.error("❌ FAIL: Could not find tryChatGptDirectWrite function");
  process.exit(1);
}

const func = funcMatch[0];

// Validation checks
const checks = [
  {
    name: "Function exists",
    test: () => !!func,
  },
  {
    name: "Function calls setInputTextDirect",
    test: () => func.includes("setInputTextDirect"),
  },
  {
    name: "Function calls dispatchChatGptComposerInputEvent",
    test: () => func.includes("dispatchChatGptComposerInputEvent"),
  },
  {
    name: "Function passes writeText to dispatchChatGptComposerInputEvent",
    test: () => func.includes('dispatchChatGptComposerInputEvent(input, "insertReplacementText", writeText)'),
  },
  {
    name: "Function does NOT pass null to dispatchChatGptComposerInputEvent",
    test: () => !func.includes('dispatchChatGptComposerInputEvent(input, "insertReplacementText", null)'),
  },
  {
    name: "Function calls dispatchChatGptComposerChange",
    test: () => func.includes("dispatchChatGptComposerChange"),
  }
];

let passed = 0;
let failed = 0;

console.log("Running validation checks:\n");

for (const check of checks) {
  if (check.test()) {
    console.log(`✅ PASS: ${check.name}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${check.name}`);
    failed++;
  }
}

console.log("\n=============================================================");

if (failed === 0) {
  console.log(`✅ SUCCESS: All ${passed} validation checks passed!`);
  console.log("\nThe ChatGPT multiline Firefox fix has been successfully applied.");
  console.log("\nFixed function:");
  console.log("--------------------------------------------------------------");
  console.log(func);
  console.log("--------------------------------------------------------------");
  process.exit(0);
} else {
  console.error(`❌ FAILURE: ${failed} validation check(s) failed!`);
  process.exit(1);
}
