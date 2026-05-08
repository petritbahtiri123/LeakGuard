# LeakGuard Codex Playbook Index

Use this as a compact router. Read a full playbook only when the current task matches its fingerprint.

## Allow Once popup loop
- Path: `docs/codex-playbooks/allow-once-popup-loop.md`
- Use when: clicking Allow Once suppresses nothing, the warning popup reopens for the same finding, or suppression loops.
- Do not use when: the issue is permanent allowlisting, policy configuration, or unrelated modal rendering.
- Keywords: allow once, popup, reopens, loop, suppress, fingerprint

## Gemini drag/drop file ingestion
- Path: `docs/codex-playbooks/gemini-drag-drop-file-ingestion.md`
- Use when: Gemini drag/drop or contenteditable file ingestion fails, duplicates content, freezes, or misses text.
- Do not use when: the issue is generic detector scoring or non-Gemini upload scanning.
- Keywords: gemini, drag, drop, file ingestion, quill, contenteditable, editor

## Firefox Add-ons submission
- Path: `docs/codex-playbooks/firefox-addon-submission.md`
- Use when: Firefox Add-ons upload rejects manifests, source zips, data collection declarations, or Gecko metadata.
- Do not use when: the issue is Chrome-only packaging, runtime extension behavior, or privacy copy rewrite without store submission evidence.
- Keywords: firefox, addon, add-ons, manifest, data_collection_permissions, source zip, gecko
