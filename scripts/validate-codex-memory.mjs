import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  ".codex/config.toml",
  ".codex/hooks.json",
  ".codex/hooks/user_prompt_playbook_router.cjs",
  "docs/codex-playbooks/INDEX.md",
  ".agents/skills/leakguard-playbook-promoter/SKILL.md",
];

const errors = [];
const warnings = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`Missing required file: ${file}`);
  }
}

const hooksPath = path.join(root, ".codex/hooks.json");
if (fs.existsSync(hooksPath)) {
  try {
    const hooksConfig = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
    const hooks = hooksConfig.hooks;
    const eventNames = Object.keys(hooks || {});
    if (eventNames.length !== 1 || eventNames[0] !== "UserPromptSubmit") {
      errors.push(".codex/hooks.json must configure only UserPromptSubmit");
    }
    const commands = [];
    for (const [eventName, eventConfigs] of Object.entries(hooks || {})) {
      if (!Array.isArray(eventConfigs)) continue;
      for (const eventConfig of eventConfigs) {
        for (const hook of eventConfig?.hooks || []) {
          if (hook?.type === "command") {
            commands.push({ eventName, command: String(hook.command || "") });
          }
        }
      }
    }
    for (const { eventName, command } of commands) {
      if (!command.trim()) {
        errors.push(`Empty hook command for ${eventName}`);
      }
      if (/\bpython3\b/.test(command)) {
        errors.push(`Hook command for ${eventName} uses python3, which is not portable on Windows`);
      }
      if (command.includes("$(")) {
        errors.push(`Hook command for ${eventName} uses POSIX command substitution, which is not portable on Windows`);
      }
      if (!/\bnode\b/.test(command)) {
        warnings.push(`Hook command for ${eventName} does not use the dependency-free Node hook runner`);
      }
      if (!command.includes("user_prompt_playbook_router.cjs")) {
        errors.push(`Hook command for ${eventName} does not use the compact prompt router`);
      }
    }
  } catch (error) {
    errors.push(`Invalid .codex/hooks.json: ${error.message}`);
  }
}

const configPath = path.join(root, ".codex/config.toml");
if (fs.existsSync(configPath)) {
  const configText = fs.readFileSync(configPath, "utf8");
  if (!configText.includes("[features]") || !configText.includes("hooks = true")) {
    errors.push(".codex/config.toml must enable [features] hooks = true");
  }
}

const routerPath = path.join(root, ".codex/hooks/user_prompt_playbook_router.cjs");
if (fs.existsSync(routerPath)) {
  const routerText = fs.readFileSync(routerPath, "utf8");
  if (!/MAX_CONTEXT_CHARS\s*=\s*600\b/.test(routerText)) {
    errors.push("Prompt router context cap must be 600 characters");
  }
}

if (errors.length > 0) {
  console.error("Codex memory validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn("Codex memory validation warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

console.log("Codex memory validation passed.");
