#!/usr/bin/env python3
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

MAX_PREVIEW_CHARS = 2000
MAX_SUMMARY_CHARS = 500


def compact_string(value, limit):
    if value is None:
        return None
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=True, sort_keys=True)
    text = text.replace("\r\n", "\n")
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 32)].rstrip() + "\n[truncated for repro capture]"


def patch_summary(tool_input):
    text = ""
    if isinstance(tool_input, dict):
        text = tool_input.get("patch") or tool_input.get("input") or tool_input.get("command") or ""
    elif isinstance(tool_input, str):
        text = tool_input
    if not isinstance(text, str):
        text = json.dumps(text, ensure_ascii=True, sort_keys=True)

    added = sum(1 for line in text.splitlines() if line.startswith("+") and not line.startswith("+++"))
    removed = sum(1 for line in text.splitlines() if line.startswith("-") and not line.startswith("---"))
    files = [line.split(":", 1)[1].strip() for line in text.splitlines() if line.startswith("*** Update File:")]
    files += [line.split(":", 1)[1].strip() for line in text.splitlines() if line.startswith("*** Add File:")]
    files += [line.split(":", 1)[1].strip() for line in text.splitlines() if line.startswith("*** Delete File:")]
    summary = {"added_lines": added, "removed_lines": removed, "files": files[:20]}
    if not files and text:
        summary["preview"] = compact_string(text, MAX_SUMMARY_CHARS)
    return summary


def output_preview(tool_response):
    if isinstance(tool_response, dict):
        for key in ("output", "stdout", "stderr", "message", "text"):
            value = tool_response.get(key)
            if value:
                return compact_string(value, MAX_PREVIEW_CHARS)
    return compact_string(tool_response, MAX_PREVIEW_CHARS)


def status_from_response(tool_response):
    if isinstance(tool_response, dict):
        for key in ("exit_code", "exitCode", "status", "success", "ok"):
            if key in tool_response:
                return tool_response.get(key)
    return None


def command_or_patch(payload):
    tool_input = payload.get("tool_input")
    tool_name = payload.get("tool_name")
    if isinstance(tool_input, dict):
        command = tool_input.get("command")
        if isinstance(command, str):
            return {"command": compact_string(command, MAX_SUMMARY_CHARS)}
    if tool_name == "apply_patch":
        return {"patch_summary": patch_summary(tool_input)}
    return {"input_summary": compact_string(tool_input, MAX_SUMMARY_CHARS)}


def main():
    root = Path(__file__).resolve().parents[2]
    runs_dir = root / "docs" / "codex-runs"
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as error:
        print(
            json.dumps(
                {
                    "continue": True,
                    "systemMessage": f"Repro capture skipped: invalid hook JSON ({str(error)[:120]})",
                },
                ensure_ascii=True,
            )
        )
        return

    try:
        timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        metadata = {
            "timestamp": timestamp,
            "hook_event_name": payload.get("hook_event_name"),
            "tool_name": payload.get("tool_name"),
            "tool_use_id": payload.get("tool_use_id"),
            "turn_id": payload.get("turn_id"),
            "cwd": payload.get("cwd"),
            "status": status_from_response(payload.get("tool_response")),
            "output_preview": output_preview(payload.get("tool_response")),
        }
        metadata.update(command_or_patch(payload))

        runs_dir.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(json.dumps(metadata, sort_keys=True).encode("utf-8")).hexdigest()[:10]
        safe_time = timestamp.replace(":", "").replace("+", "Z")
        filename = f"{safe_time}-{payload.get('tool_name') or 'tool'}-{digest}.json"
        filename = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in filename)
        path = runs_dir / filename
        path.write_text(json.dumps(metadata, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

        print(
            json.dumps(
                {
                    "continue": True,
                    "systemMessage": f"Captured reproducibility metadata: docs/codex-runs/{filename}",
                },
                ensure_ascii=True,
            )
        )
    except Exception as error:
        print(
            json.dumps(
                {
                    "continue": True,
                    "systemMessage": f"Repro capture warning: {str(error)[:160]}",
                },
                ensure_ascii=True,
            )
        )


if __name__ == "__main__":
    main()
