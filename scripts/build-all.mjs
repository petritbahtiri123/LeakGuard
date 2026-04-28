#!/usr/bin/env node

import { buildTarget } from "./build-extension.mjs";

const targets = [
  { browser: "chrome", mode: "consumer" },
  { browser: "chrome", mode: "enterprise" },
  { browser: "firefox", mode: "consumer" },
  { browser: "firefox", mode: "enterprise" }
];

for (const target of targets) {
  const result = buildTarget(target.browser, target.mode);
  process.stdout.write(`Built ${result.target} extension at ${result.targetRoot}\n`);
}
