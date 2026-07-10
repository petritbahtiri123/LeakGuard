const fs = require("node:fs");

const MAX_CONTEXT_CHARS = 600;

const ROUTES = [
  {
    name: "Allow Once popup loop",
    path: "docs/codex-playbooks/allow-once-popup-loop.md",
    required: [["allow once"], ["popup", "modal"], ["reopen", "reopens", "loop", "same finding", "suppress"]],
  },
  {
    name: "Gemini drag/drop file ingestion",
    path: "docs/codex-playbooks/gemini-drag-drop-file-ingestion.md",
    required: [["gemini"], ["drag", "drop", "file ingestion"], ["fail", "freeze", "duplicate", "duplicates", "wrong place", "miss"]],
  },
  {
    name: "Firefox Add-ons submission",
    path: "docs/codex-playbooks/firefox-addon-submission.md",
    required: [["firefox"], ["addon", "add-ons"], ["reject", "rejects", "submission", "source zip", "data_collection_permissions"]],
  },
];

function cap(text, limit) {
  if (text.length <= limit) return text;
  const marker = "\n[truncated: router context cap reached]";
  return `${text.slice(0, Math.max(0, limit - marker.length)).trimEnd()}${marker}`;
}

function extractPrompt(payload) {
  if (!payload || typeof payload !== "object") return "";
  for (const key of ["prompt", "user_prompt", "input"]) {
    if (typeof payload[key] === "string") return payload[key];
  }
  if (Array.isArray(payload.messages)) {
    return payload.messages
      .map((message) => (typeof message?.content === "string" ? message.content : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function termMatches(text, term) {
  if (term.includes(" ") || term.includes("-") || term.includes("_")) return text.includes(term);
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
}

function routeMatch(text, route) {
  const matches = route.required.map((group) => group.find((term) => termMatches(text, term)));
  return matches.every(Boolean) ? matches : null;
}

function main() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    const payload = raw.trim() ? JSON.parse(raw) : {};
    const prompt = extractPrompt(payload).toLowerCase();
    if (!prompt) {
      process.stdout.write(JSON.stringify({ continue: true }));
      return;
    }

    for (const route of ROUTES) {
      const matches = routeMatch(prompt, route);
      if (!matches) continue;
      const context = [
        "Reusable playbook candidate detected.",
        `Read ${route.path} before proposing a fix.`,
        "Verify current evidence first.",
        `Matched fingerprint: ${matches.join(", ")}.`,
      ].join(" ");
      process.stdout.write(JSON.stringify({
        continue: true,
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: cap(context, MAX_CONTEXT_CHARS),
        },
      }));
      return;
    }
    process.stdout.write(JSON.stringify({ continue: true }));
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        continue: true,
        systemMessage: `Playbook router warning: ${String(error.message || error).slice(0, 160)}`,
      })
    );
  }
}

main();
