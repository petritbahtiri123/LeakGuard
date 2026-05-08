const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MAX_SUMMARY_CHARS = 500;

function compactString(value, limit) {
  if (value == null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const normalized = text.replace(/\r\n/g, "\n");
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 32)).trimEnd()}\n[truncated for repro capture]`;
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function patchSummary(toolInput) {
  let text = "";
  if (toolInput && typeof toolInput === "object") {
    text = toolInput.patch || toolInput.input || toolInput.command || "";
  } else if (typeof toolInput === "string") {
    text = toolInput;
  } else {
    text = JSON.stringify(toolInput ?? null);
  }

  const lines = text.split(/\r?\n/);
  const files = [];
  for (const line of lines) {
    for (const prefix of ["*** Update File:", "*** Add File:", "*** Delete File:"]) {
      if (line.startsWith(prefix)) files.push(line.slice(prefix.length).trim());
    }
  }

  return {
    added_lines: lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
    removed_lines: lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length,
    files: files.slice(0, 20),
  };
}

function statusFromResponse(toolResponse) {
  if (toolResponse && typeof toolResponse === "object") {
    for (const key of ["exit_code", "exitCode", "status", "success", "ok"]) {
      if (Object.prototype.hasOwnProperty.call(toolResponse, key)) return toolResponse[key];
    }
  }
  return null;
}

function summarizeCommand(command) {
  const normalized = command.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "empty command";
  const lineCount = normalized.split("\n").length;
  return compactString(
    `shell command (${normalized.length} chars, ${lineCount} line${lineCount === 1 ? "" : "s"})`,
    MAX_SUMMARY_CHARS
  );
}

function commandOrPatch(payload) {
  const toolInput = payload.tool_input;
  if (toolInput && typeof toolInput === "object" && typeof toolInput.command === "string") {
    return {
      command_hash: stableHash(toolInput.command),
      command_summary: summarizeCommand(toolInput.command),
    };
  }
  if (payload.tool_name === "apply_patch") {
    return {
      command_hash: stableHash(toolInput),
      patch_summary: patchSummary(toolInput),
    };
  }
  return {
    command_hash: stableHash(toolInput),
    command_summary: "non-shell tool input",
  };
}

function main() {
  const root = path.resolve(__dirname, "..", "..");
  const runsDir = path.join(root, "docs", "codex-runs");
  let payload = {};

  try {
    const raw = fs.readFileSync(0, "utf8");
    payload = raw.trim() ? JSON.parse(raw) : {};
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        continue: true,
        systemMessage: `Repro capture skipped: invalid hook JSON (${String(error.message || error).slice(0, 120)})`,
      })
    );
    return;
  }

  try {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const metadata = {
      timestamp,
      hook_event_name: payload.hook_event_name,
      tool_name: payload.tool_name,
      status: statusFromResponse(payload.tool_response),
      ...commandOrPatch(payload),
    };

    fs.mkdirSync(runsDir, { recursive: true });
    const digest = stableHash(metadata).slice(0, 10);
    const safeTime = timestamp.replace(/:/g, "").replace(/\+/g, "Z");
    const rawName = `${safeTime}-${payload.tool_name || "tool"}-${digest}.json`;
    const filename = rawName.replace(/[^A-Za-z0-9._-]/g, "_");
    fs.writeFileSync(path.join(runsDir, filename), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

    process.stdout.write(
      JSON.stringify({
        continue: true,
        systemMessage: `Captured reproducibility metadata: docs/codex-runs/${filename}`,
      })
    );
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        continue: true,
        systemMessage: `Repro capture warning: ${String(error.message || error).slice(0, 160)}`,
      })
    );
  }
}

main();
