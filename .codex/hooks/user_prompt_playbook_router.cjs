const fs = require("node:fs");

const MAX_CONTEXT_CHARS = 1200;

const ROUTES = [
  {
    name: "Allow Once popup loop",
    path: "docs/codex-playbooks/allow-once-popup-loop.md",
    terms: ["allow once", "popup", "reopens", "loop", "suppress"],
    specific: [],
  },
  {
    name: "Gemini drag/drop file ingestion",
    path: "docs/codex-playbooks/gemini-drag-drop-file-ingestion.md",
    terms: ["gemini", "drag", "drop", "file ingestion", "quill", "contenteditable"],
    specific: [],
  },
  {
    name: "Firefox Add-ons submission",
    path: "docs/codex-playbooks/firefox-addon-submission.md",
    terms: ["firefox", "addon", "add-ons", "manifest", "source zip"],
    specific: ["data_collection_permissions"],
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

function routeScore(text, route) {
  const matches = route.terms.filter((term) => termMatches(text, term));
  const specific = route.specific.filter((term) => text.includes(term));
  if (specific.length > 0) return [100 + matches.length, matches.concat(specific)];
  if (matches.length >= 2) return [matches.length, matches];
  return [0, matches];
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

    const candidates = [];
    for (const route of ROUTES) {
      const [score, matches] = routeScore(prompt, route);
      if (score) candidates.push({ score, route, matches });
    }
    if (candidates.length === 0) {
      process.stdout.write(JSON.stringify({ continue: true }));
      return;
    }

    candidates.sort((a, b) => b.score - a.score);
    const lines = candidates.slice(0, 3).map(({ route, matches }) =>
      [
        "Reusable playbook candidate detected.",
        `Read ${route.path} before proposing a new fix.`,
        "Use it as prior art, but verify current evidence.",
        `Reason: matched ${route.name} keywords (${matches.slice(0, 5).join(", ")}).`,
      ].join(" ")
    );
    process.stdout.write(
      JSON.stringify({
        continue: true,
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: cap(lines.join("\n"), MAX_CONTEXT_CHARS),
        },
      })
    );
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
