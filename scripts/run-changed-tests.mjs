#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

function add(commands, command) {
  if (!commands.includes(command)) commands.push(command);
}

export function selectValidationCommands(files) {
  const commands = [];

  for (const rawFile of files) {
    const file = String(rawFile || "").replaceAll("\\", "/").replace(/^\.\//, "");
    if (!file) continue;

    if (file === "AGENTS.md") {
      add(commands, "npm run validate:codex-memory");
      add(commands, "npm run docs:check-links");
      continue;
    }
    if (file.startsWith(".codex/") || file === "scripts/validate-codex-memory.mjs") {
      add(commands, "node tests/codex_hooks.test.mjs");
      add(commands, "npm run validate:codex-memory");
      continue;
    }
    if (file.startsWith("docs/") || file.endsWith(".md")) {
      add(commands, "npm run docs:check-links");
      continue;
    }
    if (file === "src/shared/runtime_scripts.js" || file.startsWith("manifests/") || file === "src/background/service_worker.js") {
      add(commands, "npm test");
      add(commands, "node tests/runtime_script_order.test.js");
      add(commands, "node tests/runtime_script_order_contract.test.js");
      add(commands, "node tests/build_targets.test.js");
      add(commands, "node tests/security.test.js");
      continue;
    }
    if (file === "src/shared/detector.js" || file.startsWith("src/shared/detection/") || file === "src/shared/patterns.js") {
      add(commands, "node tests/detector.test.js");
      continue;
    }
    if (file.startsWith("src/content/files/") || file.startsWith("src/content/file_handoff_")) {
      add(commands, "node tests/content_file_drop_interception.test.js");
      continue;
    }
    if (file.startsWith("src/content/diagnostics/") || file === "src/background/auditLog.js") {
      add(commands, "node tests/security.test.js");
      continue;
    }
    if (file === "src/shared/policy.js" || file === "src/shared/protected_sites.js" || file === "src/background/protectedSiteRegistry.js") {
      add(commands, "node tests/protected_sites.test.js");
      add(commands, "node tests/enterprise_policy.test.js");
      continue;
    }
    if (file.startsWith("src/content/composer/") || file.startsWith("src/content/input/") || file === "src/content/composer_helpers.js") {
      add(commands, "node tests/composer_helpers.test.js");
      add(commands, "node tests/typed_interception.test.js");
      continue;
    }
    if (file === "scripts/run-changed-tests.mjs" || file === "tests/run_changed_tests.test.mjs") {
      add(commands, "node tests/run_changed_tests.test.mjs");
      continue;
    }
    if (file === "tests/codex_hooks.test.mjs") {
      add(commands, "node tests/codex_hooks.test.mjs");
      continue;
    }
    if (file === "package.json" || file === "package-lock.json" || file.startsWith("src/") || file.startsWith("scripts/") || file.startsWith("tests/")) {
      add(commands, "npm test");
      continue;
    }
    add(commands, "npm test");
  }

  return commands;
}

function gitLines(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function parseArgs(argv) {
  const result = { base: "", files: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--base") result.base = argv[++index] || "";
    else if (argv[index] === "--files") result.files = (argv[++index] || "").split(",").filter(Boolean);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return result;
}

function changedFiles(options) {
  if (options.files) return unique(options.files);
  const files = options.base ? gitLines(["diff", "--name-only", `${options.base}...HEAD`]) : [];
  files.push(...gitLines(["diff", "--name-only"]));
  files.push(...gitLines(["diff", "--cached", "--name-only"]));
  files.push(...gitLines(["ls-files", "--others", "--exclude-standard"]));
  return unique(files);
}

function runCommand(command) {
  const result = spawnSync(command, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = changedFiles(options);
  const commands = selectValidationCommands(files);

  if (commands.length === 0) {
    console.log("No changed files require validation.");
    return;
  }

  console.log(`Changed files (${files.length}):`);
  for (const file of files) console.log(`- ${file}`);
  console.log("Validation commands:");
  for (const command of commands) console.log(`- ${command}`);

  if (process.env.LEAKGUARD_CHANGED_TESTS_DRY_RUN === "1") return;
  for (const command of commands) runCommand(command);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}
