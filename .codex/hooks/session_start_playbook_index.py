#!/usr/bin/env python3
import json
from pathlib import Path

MAX_CONTEXT_CHARS = 2000


def cap(text, limit):
    if len(text) <= limit:
        return text
    marker = "\n\n[truncated: compact playbook index cap reached]"
    return text[: max(0, limit - len(marker))].rstrip() + marker


def main():
    try:
        root = Path(__file__).resolve().parents[2]
        index_path = root / "docs" / "codex-playbooks" / "INDEX.md"
        if not index_path.exists():
            return

        index_text = index_path.read_text(encoding="utf-8", errors="replace").strip()
        if not index_text:
            return

        context = cap(index_text, MAX_CONTEXT_CHARS)
        print(
            json.dumps(
                {
                    "continue": True,
                    "hookSpecificOutput": {
                        "hookEventName": "SessionStart",
                        "additionalContext": context,
                    },
                },
                ensure_ascii=True,
            )
        )
    except Exception:
        return


if __name__ == "__main__":
    main()
