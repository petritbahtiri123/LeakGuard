# LeakGuard Codex Playbook Index

Use this as a compact router. Read a full playbook only when the current task matches its fingerprint.

## Allow Once popup loop
- Path: `docs/codex-playbooks/allow-once-popup-loop.md`
- Use when: clicking Allow Once suppresses nothing, the warning popup reopens for the same finding, or suppression loops.
- Do not use when: the issue is permanent allowlisting, policy configuration, or unrelated modal rendering.
- Keywords: allow once, popup, reopens, loop, suppress, fingerprint

## Detector bug
- Path: `docs/codex-playbooks/detector-bug.md`
- Use when: a secret, sensitive header value, URL credential, email, provider/cloud identifier, public network value, or natural-language disclosure is missed.
- Do not use when: the primary issue is safe text over-redacted, file handoff, browser QA, or model training.
- Keywords: missed secret, false negative, detector, regex, provider, entropy, Onix, email, header, URL credential

## False positive
- Path: `docs/codex-playbooks/false-positive.md`
- Use when: safe text, examples, versions, regions, usernames, service names, ordinary IDs, or placeholders are over-redacted.
- Do not use when: a real secret is missed or a raw file reaches a site.
- Keywords: false positive, over-redacted, safe text, allowlist, suppression, username, example, placeholder

## Gemini drag/drop file ingestion
- Path: `docs/codex-playbooks/gemini-drag-drop-file-ingestion.md`
- Use when: Gemini drag/drop or contenteditable file ingestion fails, duplicates content, freezes, or misses text.
- Do not use when: the issue is generic detector scoring or non-Gemini upload scanning.
- Keywords: gemini, drag, drop, file ingestion, quill, contenteditable, editor

## WhatsApp multiline rewrite mismatch
- Path: `docs/codex-playbooks/whatsapp-multiline-rewrite-mismatch.md`
- Use when: WhatsApp Web receives sanitized multiline placeholders, but LeakGuard still shows `Rewrite mismatch blocked` or `Rewrite verification failed`.
- Do not use when: raw values remain visible in the composer, a detector misses the secret, or the issue is unrelated to WhatsApp editor verification.
- Keywords: whatsapp, multiline, paste, rewrite mismatch, rewrite verification, defaultPrevented, placeholder

## File handoff/fail closed
- Path: `docs/codex-playbooks/file-handoff-fail-closed.md`
- Use when: protected-site paste/drop/file input, sanitized handoff, pending attach, regenerated document output, image redaction, or unsupported-file handling fails.
- Do not use when: the issue is a pure detector false positive/negative with no file ingress.
- Keywords: file handoff, fail closed, upload, pending attach, sanitized file, unsupported file, image redaction, raw upload

## Debug safety
- Path: `docs/codex-playbooks/debug-safety.md`
- Use when: adding or changing diagnostics, debug logs, snapshots, QA reports, audit summaries, or failure metadata.
- Do not use when: no logging/reporting/diagnostic output is touched.
- Keywords: debug, diagnostics, metadata-only, raw logs, snapshot, audit, report, pwm:debug

## Onix training/eval
- Path: `docs/codex-playbooks/onix-training-eval.md`
- Use when: changing Onix dataset generation, features, training, evaluation, model export, candidate gating, or gray-zone classifier behavior.
- Do not use when: deterministic regex/provider rules can own the issue and no Onix data/code changes are needed.
- Keywords: Onix, ONNX, AI assist, dataset, generated, heldout, real-sanitized, evaluate_model, train, classifier

## Browser QA
- Path: `docs/codex-playbooks/browser-qa.md`
- Use when: Chrome, Edge, Firefox, browser smoke, or extension QA harness checks fail.
- Do not use when: the failure is already isolated to a unit test with no browser or harness surface.
- Keywords: browser QA, smoke, Chrome, Firefox, Edge, harness, canary, safe JSON

## Firefox Add-ons submission
- Path: `docs/codex-playbooks/firefox-addon-submission.md`
- Use when: Firefox Add-ons upload rejects manifests, source zips, data collection declarations, or Gecko metadata.
- Do not use when: the issue is Chrome-only packaging, runtime extension behavior, or privacy copy rewrite without store submission evidence.
- Keywords: firefox, addon, add-ons, manifest, data_collection_permissions, source zip, gecko
