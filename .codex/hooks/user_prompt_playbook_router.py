#!/usr/bin/env python3
import json
import re
import sys

MAX_CONTEXT_CHARS = 1200

ROUTES = [
    {
        "name": "Allow Once popup loop",
        "path": "docs/codex-playbooks/allow-once-popup-loop.md",
        "terms": ["allow once", "popup", "reopens", "loop", "suppress"],
        "specific": [],
    },
    {
        "name": "Gemini drag/drop file ingestion",
        "path": "docs/codex-playbooks/gemini-drag-drop-file-ingestion.md",
        "terms": ["gemini", "drag", "drop", "file ingestion", "quill", "contenteditable"],
        "specific": [],
    },
    {
        "name": "Firefox Add-ons submission",
        "path": "docs/codex-playbooks/firefox-addon-submission.md",
        "terms": ["firefox", "addon", "add-ons", "manifest", "source zip"],
        "specific": ["data_collection_permissions"],
    },
]


def cap(text, limit):
    if len(text) <= limit:
        return text
    marker = "\n[truncated: router context cap reached]"
    return text[: max(0, limit - len(marker))].rstrip() + marker


def extract_prompt(payload):
    if isinstance(payload, dict):
        for key in ("prompt", "user_prompt", "input"):
            value = payload.get(key)
            if isinstance(value, str):
                return value
        messages = payload.get("messages")
        if isinstance(messages, list):
            parts = []
            for message in messages:
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str):
                        parts.append(content)
            return "\n".join(parts)
    return ""


def term_matches(text, term):
    if " " in term or "-" in term or "_" in term:
        return term in text
    return re.search(r"\b" + re.escape(term) + r"\b", text) is not None


def route_score(text, route):
    matches = [term for term in route["terms"] if term_matches(text, term)]
    specific = [term for term in route["specific"] if term in text]
    if specific:
        return 100 + len(matches), matches + specific
    if len(matches) >= 2:
        return len(matches), matches
    return 0, matches


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        prompt = extract_prompt(payload).lower()
        if not prompt:
            print(json.dumps({"continue": True}))
            return

        candidates = []
        for route in ROUTES:
            score, matches = route_score(prompt, route)
            if score:
                candidates.append((score, route, matches))

        if not candidates:
            print(json.dumps({"continue": True}))
            return

        candidates.sort(key=lambda item: item[0], reverse=True)
        lines = []
        for _, route, matches in candidates[:3]:
            lines.append(
                "Reusable playbook candidate detected. "
                f"Read {route['path']} before proposing a new fix. "
                "Use it as prior art, but verify current evidence. "
                f"Reason: matched {route['name']} keywords ({', '.join(matches[:5])})."
            )
        context = cap("\n".join(lines), MAX_CONTEXT_CHARS)
        print(
            json.dumps(
                {
                    "continue": True,
                    "hookSpecificOutput": {
                        "hookEventName": "UserPromptSubmit",
                        "additionalContext": context,
                    },
                },
                ensure_ascii=True,
            )
        )
    except Exception as error:
        print(
            json.dumps(
                {
                    "continue": True,
                    "systemMessage": f"Playbook router warning: {str(error)[:160]}",
                },
                ensure_ascii=True,
            )
        )


if __name__ == "__main__":
    main()
