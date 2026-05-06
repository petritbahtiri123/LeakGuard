# Codex Context Router

Start in FAST mode. Escalate only if needed.

## FAST mode

Use for small bugfixes, focused tests, small refactors, and known-area changes.

Read:
- docs/CODEX_FAST_CONTEXT.md
- relevant source files
- relevant tests

Do not read:
- deep-research-report.md
- PRIVACY_POLICY.md
- full README
- release/store docs

## STANDARD mode

Use when behavior crosses multiple modules.

Read:
- docs/CODEX_FAST_CONTEXT.md
- docs/REPO_MAP.md
- docs/BUG_PLAYBOOK.md
- relevant source/tests

## DEEP mode

Use only for:
- release notes
- privacy wording
- Chrome Web Store text
- enterprise claims
- architecture docs
- README claim alignment
- AI assist or file scanner public-scope claims

Read:
- deep-research-report.md
- PRIVACY_POLICY.md
- README.md
- docs/NON_GOALS.md
- docs/AI_ASSIST.md
- relevant docs/source

## Routing table

| Task | Mode | Read | Tests |
|---|---|---|---|
| Secret not detected | FAST | src/shared/patterns.js, src/shared/detector.js, tests/detector.test.js | node tests/detector.test.js |
| False positive | FAST | src/shared/patterns.js, src/shared/detector.js, src/shared/aiCandidateGate.js | node tests/detector.test.js |
| Header/URL/raw suffix leak | FAST | src/shared/detector.js, src/shared/redactor.js, src/shared/transformOutboundPrompt.js, tests/break_pack.test.js | node tests/break_pack.test.js |
| Placeholder reuse/trust | FAST | src/shared/placeholders.js, src/shared/redactor.js, src/shared/transformOutboundPrompt.js | node tests/placeholder_trust.test.js |
| Natural language detection | FAST | src/shared/detector.js, tests/natural_language_context.test.js | node tests/natural_language_context.test.js |
| IP/network issue | FAST | src/shared/ipClassification.js, src/shared/ipDetection.js, src/shared/networkHierarchy.js, src/shared/placeholderAllocator.js | node tests/ip_transform.test.js |
| Composer rewrite | STANDARD | src/content/content.js, src/content/composer_helpers.js | node tests/composer_helpers.test.js && node tests/typed_interception.test.js |
| File upload/scanner | STANDARD | src/shared/fileScanner.js, src/shared/streamingFileRedactor.js, src/content/file_paste_helpers.js, src/content/content.js | node tests/file_scanner.test.js && node tests/streaming_file_redactor.test.js |
| AI assist | STANDARD | src/shared/aiCandidateGate.js, src/shared/transformOutboundPromptWithAi.js, src/shared/ai/classifier.js | node tests/ai_candidate_gate.test.js && node tests/transform_with_ai.test.js && node tests/ai_assist.test.js |
| Policy/protected sites | STANDARD | src/shared/policy.js, src/shared/protected_sites.js, src/background/core.js | node tests/protected_sites.test.js && node tests/enterprise_policy.test.js |
| Build/manifest/CSP | STANDARD | scripts/build-extension.mjs, scripts/build-all.mjs, manifests/*.json | node tests/build_targets.test.js && node tests/security.test.js |
| Privacy/product claims | DEEP | deep-research-report.md, PRIVACY_POLICY.md, README.md, docs/NON_GOALS.md | docs-only unless behavior changed |