#!/usr/bin/env node

import { BUILD_TARGETS, buildTarget } from "./build-extension.mjs";

for (const target of BUILD_TARGETS) {
  const result = buildTarget(target.browser, target.mode);
  process.stdout.write(`Built ${result.target} extension at ${result.targetRoot}\n`);
}
