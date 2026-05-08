import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  ".codex/config.toml",
  ".codex/hooks.json",
  ".codex/hooks/session_start_playbook_index.cjs",
  ".codex/hooks/user_prompt_playbook_router.cjs",
  ".codex/hooks/post_tool_repro_capture.cjs",
  ".codex/hooks/session_start_playbook_index.py",
  ".codex/hooks/user_prompt_playbook_router.py",
  ".codex/hooks/post_tool_repro_capture.py",
  "docs/codex-playbooks/INDEX.md",
  ".agents/skills/leakguard-playbook-promoter/SKILL.md",
  "docs/codex-runs/.gitkeep",
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
    for (const eventName of ["SessionStart", "UserPromptSubmit", "PostToolUse"]) {
      if (!Array.isArray(hooks?.[eventName]) || hooks[eventName].length === 0) {
        errors.push(`Missing hook event configuration: ${eventName}`);
      }
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

const gitignorePath = path.join(root, ".gitignore");
if (fs.existsSync(gitignorePath)) {
  const gitignoreText = fs.readFileSync(gitignorePath, "utf8");
  if (!gitignoreText.includes("/docs/codex-runs/*.json")) {
    errors.push(".gitignore must ignore docs/codex-runs/*.json");
  }
  if (!gitignoreText.includes("!/docs/codex-runs/.gitkeep")) {
    errors.push(".gitignore must keep docs/codex-runs/.gitkeep trackable");
  }
} else {
  errors.push("Missing .gitignore");
}

for (const captureScript of [
  ".codex/hooks/post_tool_repro_capture.cjs",
  ".codex/hooks/post_tool_repro_capture.py",
]) {
  const scriptPath = path.join(root, captureScript);
  if (!fs.existsSync(scriptPath)) continue;
  const scriptText = fs.readFileSync(scriptPath, "utf8");
  if (/\boutput_preview\b/.test(scriptText)) {
    errors.push(`${captureScript} must not persist output_preview`);
  }
  if (/(tool_response|toolResponse).*?["'](?:output|stdout|stderr|message|text)["']/s.test(scriptText)) {
    errors.push(`${captureScript} appears to read raw output fields from tool_response`);
  }
}

const runsDir = path.join(root, "docs/codex-runs");
if (fs.existsSync(runsDir)) {
  for (const entry of fs.readdirSync(runsDir)) {
    if (!entry.endsWith(".json")) continue;
    const capturePath = path.join(runsDir, entry);
    try {
      const capture = JSON.parse(fs.readFileSync(capturePath, "utf8"));
      for (const forbiddenKey of ["output_preview", "output", "stdout", "stderr", "prompt", "full_log"]) {
        if (Object.prototype.hasOwnProperty.call(capture, forbiddenKey)) {
          errors.push(`docs/codex-runs/${entry} contains forbidden raw-output field: ${forbiddenKey}`);
        }
      }
    } catch (error) {
      errors.push(`Invalid repro capture JSON docs/codex-runs/${entry}: ${error.message}`);
    }
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
