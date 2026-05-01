# Bug Playbook

## Common Bugs
- Secret not detected: check `src/shared/patterns.js`, `src/shared/detector.js`, then `tests/detector.test.js`.
- False positive safe value: check detector suppression helpers and safe keys in `patterns.js`, `detector.js`, `aiCandidateGate.js`.
- Partial sensitive header redaction: check `scanSensitiveHttpHeaders()` in `src/shared/detector.js`, overlap resolution, then `tests/break_pack.test.js`.
- Labelled repeated secret leaks such as `ApiKey[PWM_N]`: check natural-language label ranges in `detector.js`, known-secret reuse in `redactor.js` and `transformOutboundPrompt.js`, then `tests/break_pack.test.js`.
- URL credential leak or broken URI shape: check URL helpers in `detector.js`, overlap resolution, `tests/break_pack.test.js`.
- Placeholder changed, reused wrongly, or remapped: check `src/shared/placeholders.js`, `redactor.js`, `transformOutboundPrompt.js`, `tests/placeholder_trust.test.js`.
- Raw secret survives after redaction: check finding ranges, overlap resolution, and right-to-left replacement in `redactor.js`.
- Repeated secret gets different placeholders: check `PlaceholderManager.getPlaceholder()` and known-secret reuse.
- Network/IP placeholder wrong: check `ipClassification.js`, `ipDetection.js`, `networkHierarchy.js`, `placeholderAllocator.js`, `tests/ip_transform.test.js`.
- Composer rewrite fails or loses text: check `content.js`, `composer_helpers.js`, `tests/composer_helpers.test.js`, `tests/typed_interception.test.js`.
- Protected site cannot be added/removed: check `protected_sites.js`, `background/core.js`, `popup.js`, `options.js`.
- Enterprise allow/block/redact wrong: check `policy.js`, `background/core.js`, `tests/enterprise_policy.test.js`.
- File scan issue: check `fileScanner.js`, `scanner.js`, `tests/file_scanner.test.js`.
- Build target missing asset/manifest issue: check `scripts/build-extension.mjs`, `manifests/*.json`, `tests/build_targets.test.js`.

## Debugging Hints
- Start with the narrowest test: `node tests/<area>.test.js`.
- For detector bugs, print findings with `{ raw, start, end, type, method, score }`.
- Always verify output excludes raw secret tails, not only full original values.
- For repeated raw secrets, verify the same placeholder appears across all contexts and no raw prefix/suffix remains beside a new placeholder.
- Preserve safe literals: versions, regions, token limits, `secret_santa`, `password_hint`.
- Test already-redacted inputs with clean `[PWM_n]` placeholders.
- If changing URL parsing, assert host and path remain visible.
- If touching content scripts, test textarea and contenteditable behavior.
- If touching policy, test consumer and enterprise defaults.
- Finish with `npm test` unless the task is docs-only.
