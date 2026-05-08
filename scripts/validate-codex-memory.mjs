import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  ".codex/config.toml",
  ".codex/hooks.json",
  ".codex/hooks/session_start_playbook_index.py",
  ".codex/hooks/user_prompt_playbook_router.py",
  ".codex/hooks/post_tool_repro_capture.py",
  "docs/codex-playbooks/INDEX.md",
  ".agents/skills/leakguard-playbook-promoter/SKILL.md",
  "docs/codex-runs/.gitkeep",
];

const errors = [];

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
    for (const eventName of ["SessionStart", "UserPromptSubmit", "PostToolUse"]) {
      if (!Array.isArray(hooks?.[eventName]) || hooks[eventName].length === 0) {
        errors.push(`Missing hook event configuration: ${eventName}`);
      }
    }
  } catch (error) {
    errors.push(`Invalid .codex/hooks.json: ${error.message}`);
  }
}

const configPath = path.join(root, ".codex/config.toml");
if (fs.existsSync(configPath)) {
  const configText = fs.readFileSync(configPath, "utf8");
  if (!configText.includes("[features]") || !configText.includes("codex_hooks = true")) {
    errors.push(".codex/config.toml must enable [features] codex_hooks = true");
  }
}

if (errors.length > 0) {
  console.error("Codex memory validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Codex memory validation passed.");
