#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Check that the file can be parsed as JavaScript
const filePath = path.join(__dirname, "src/content/content.js");
const source = fs.readFileSync(filePath, "utf8");

try {
  // Try to parse a minimal subset to validate syntax
  const match = source.match(/function tryChatGptDirectWrite\([^)]*\) \{[\s\S]*?\n  \}/);
  if (!match) {
    console.error("ERROR: Could not find tryChatGptDirectWrite function");
    process.exit(1);
  }

  const func = match[0];
  console.log("Found tryChatGptDirectWrite function:");
  console.log("=====================================");
  console.log(func);
  console.log("=====================================\n");

  // Check that writeText is passed to dispatchChatGptComposerInputEvent
  if (func.includes("dispatchChatGptComposerInputEvent(input, \"insertReplacementText\", writeText)")) {
    console.log("✓ PASS: tryChatGptDirectWrite now passes writeText to dispatchChatGptComposerInputEvent");
    process.exit(0);
  } else if (func.includes("dispatchChatGptComposerInputEvent(input, \"insertReplacementText\", null)")) {
    console.error("✗ FAIL: tryChatGptDirectWrite still passes null instead of writeText");
    process.exit(1);
  } else {
    console.error("✗ FAIL: Could not find expected dispatchChatGptComposerInputEvent call");
    process.exit(1);
  }
} catch (error) {
  console.error("Error analyzing file:", error.message);
  process.exit(1);
}
