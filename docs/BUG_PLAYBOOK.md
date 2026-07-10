# Bug Playbook

Use the narrowest relevant playbook and test first. Preserve the lifecycle:

```text
regex/provider deterministic rules
  -> entropy/context fallback
  -> Onix gray-zone classifier
  -> final redaction policy
```

Regex/provider rules are first authority. Entropy is fallback. Onix handles gray-zone leftover candidates only.

## Dedicated Codex Playbooks
- Secret missed: `docs/codex-playbooks/detector-bug.md`
- Safe text over-redacted: `docs/codex-playbooks/false-positive.md`
- File handoff/fail-closed issue: `docs/codex-playbooks/file-handoff-fail-closed.md`
- Debug/diagnostics change: `docs/codex-playbooks/debug-safety.md`
- Onix dataset/training/eval improvement: `docs/codex-playbooks/onix-training-eval.md`
- Browser QA failure: `docs/codex-playbooks/browser-qa.md`
- Allow Once popup loop: `docs/codex-playbooks/allow-once-popup-loop.md`
- Gemini drag/drop ingestion: `docs/codex-playbooks/gemini-drag-drop-file-ingestion.md`
- Firefox Add-ons submission: `docs/codex-playbooks/firefox-addon-submission.md`

## Common Bugs
- Secret not detected: add a failing detector/unit test first, then check `src/shared/patterns.js`, relevant `src/shared/detection/*`, `src/shared/detector.js`, then Onix only for gray-zone leftovers.
- False positive safe value: add a safe-control regression test first, then check allowlists/context in `patterns.js`, `detector.js`, `aiCandidateGate.js`, and relevant detection helpers.
- Partial sensitive header redaction: check `src/shared/detection/httpHeaders.js`, `scanSensitiveHttpHeaders()` in `src/shared/detector.js`, overlap resolution, then `tests/break_pack.test.js`.
- URL credential leak or broken URI shape: check `src/shared/detection/urlUserinfo.js`, URL helpers in `detector.js`, overlap resolution, and `tests/break_pack.test.js`.
- Labelled repeated secret leaks such as `ApiKey[PWM_N]`: check natural-language label ranges in `detector.js`, known-secret reuse in `knownSecretReuse.js`, `redactor.js`, and `transformOutboundPrompt.js`.
- Placeholder changed, reused wrongly, or remapped: check `src/shared/placeholders.js`, `src/shared/knownSecretReuse.js`, `redactor.js`, `transformOutboundPrompt.js`, and `tests/placeholder_trust.test.js`.
- Clean `[PWM_N]` placeholder re-redacted: check trusted placeholder context in `detector.js`, candidate skipping in `aiCandidateGate.js`, and placeholder trust tests.
- Network/IP placeholder wrong: check `ipClassification.js`, `ipDetection.js`, `networkHierarchy.js`, `placeholderAllocator.js`, and `tests/ip_transform.test.js`.
- Composer rewrite fails or loses text: check `src/content/content.js` as orchestration, then `composer_helpers.js`, `input/rewriteVerificationText.js`, and site adapter helpers.
- File upload/scanner issue: check `src/content/files/*`, `src/content/file_handoff_*.js`, `src/shared/fileScanner.js`, `src/shared/fileExtractors.js`, and `src/shared/streamingFileRedactor.js`.
- Protected site cannot be added/removed: check `src/shared/protected_sites.js`, `src/background/protectedSiteRegistry.js`, `src/background/core.js`, popup/options callers, and `tests/protected_sites.test.js`.
- Enterprise allow/block/redact wrong: check `src/shared/policy.js`, `src/background/core.js`, and `tests/enterprise_policy.test.js`.
- Runtime loading issue: check `src/shared/runtime_scripts.js`, `manifests/base.json`, `manifests/firefox.json`, `src/background/service_worker.js`, and runtime order tests.
- CSP or inline-script regression: check extension HTML files, `tests/security.test.js`, and build target tests.
- Debug/logging leak: check `src/content/diagnostics/*`, `src/background/auditLog.js`, `tests/debug_logger.test.js`, `tests/file_debug_metadata.test.js`, and `tests/security.test.js`.
- Local-only/privacy regression: check touched code for network calls, telemetry, raw-secret storage, raw debug output, raw exports, and reveal paths.

## Debugging Hints
- Start with the narrowest test: `node tests/<area>.test.js`.
- For detector bugs, inspect findings as metadata only: `{ start, end, type, method, score, severity, length }`. Do not print raw values.
- Always verify output excludes raw secret tails, not only full original values.
- For repeated raw secrets, verify the same placeholder appears across all contexts and no raw prefix/suffix remains beside a new placeholder.
- Preserve safe literals: versions, regions, token limits, `secret_santa`, `password_hint`, docs/examples, and trusted placeholders.
- Emails globally redact. Usernames stay context-aware.
- If changing URL parsing, assert host and path remain visible where safe.
- If touching content scripts, test textarea and contenteditable behavior.
- If touching file handling, verify unsupported/unsafe protected flows fail closed and sanitized handoff failure blocks raw upload.
- If touching policy, test consumer and enterprise defaults.
- After focused tests pass, use `npm run test:changed`; follow `docs/CODEX_CONTEXT_ROUTER.md` for full-suite escalation.

## Narrow Test Guide
- Pattern/provider/suppression rule: `node tests/detector.test.js`
- Header, URL, repeated secret redaction: `node tests/break_pack.test.js`
- Placeholder trust or reuse: `node tests/placeholder_trust.test.js`
- Natural-language context: `node tests/natural_language_context.test.js`
- Prompt transform or network placeholders: `node tests/ip_transform.test.js`
- Local Onix candidate/assist: `node tests/ai_candidate_gate.test.js`, `node tests/transform_with_ai.test.js`, `node tests/ai_assist.test.js`
- Onix dataset/eval safety: `node tests/onix_dataset.test.js`
- Composer/input interception: `node tests/composer_helpers.test.js`, `node tests/typed_interception.test.js`
- Content file handoff: `node tests/content_file_drop_interception.test.js`
- File scanner/extractors: `node tests/file_scanner.test.js`, `node tests/file_extractors.test.js`
- Debug safety: `node tests/debug_logger.test.js`, `node tests/file_debug_metadata.test.js`, `node tests/security.test.js`
- Protected sites or enterprise policy: `node tests/protected_sites.test.js`, `node tests/enterprise_policy.test.js`
- Runtime order/build/security: `node tests/runtime_script_order.test.js`, `node tests/runtime_script_order_contract.test.js`, `node tests/build_targets.test.js`, `node tests/security.test.js`
- Full suite: `npm test`

## Fix Rules
- Keep the diff local to the failing surface unless shared behavior is the cause.
- Add or update a regression test for every bug fix that changes behavior.
- Do not weaken safe/example/template suppression to make a positive case pass.
- Do not lower safety globally to clean up one false positive.
- Preserve right-to-left replacement safety and full intended value ranges.
- Verify raw secrets are absent after redaction, including prefixes/suffixes next to placeholders.
- Keep generated `dist/`, `node_modules/`, `ai/models/`, and generated datasets out of patches unless explicitly required.
