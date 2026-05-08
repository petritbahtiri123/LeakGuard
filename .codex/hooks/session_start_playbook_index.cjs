const fs = require("node:fs");
const path = require("node:path");

const MAX_CONTEXT_CHARS = 2000;

function cap(text, limit) {
  if (text.length <= limit) return text;
  const marker = "\n\n[truncated: compact playbook index cap reached]";
  return `${text.slice(0, Math.max(0, limit - marker.length)).trimEnd()}${marker}`;
}

function main() {
  try {
    const root = path.resolve(__dirname, "..", "..");
    const indexPath = path.join(root, "docs", "codex-playbooks", "INDEX.md");
    if (!fs.existsSync(indexPath)) return;

    const indexText = fs.readFileSync(indexPath, "utf8").trim();
    if (!indexText) return;

    process.stdout.write(
      JSON.stringify({
        continue: true,
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: cap(indexText, MAX_CONTEXT_CHARS),
        },
      })
    );
  } catch {
    // Hooks must fail open.
  }
}

main();
