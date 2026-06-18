# Codex Context Router

Start in FAST mode. Escalate only when the narrow path is unclear, fails, or the task explicitly touches public/release/architecture claims.

## FAST Mode
Use for small bugfixes, focused tests, docs-only context edits, and known-area changes.

Read:
- `docs/CODEX_FAST_CONTEXT.md`
- directly relevant source files
- directly relevant tests or playbooks

Do not read by default:
- `deep-research-report.md`
- `PRIVACY_POLICY.md`
- full README
- release/store docs
- historical phase plans

## STANDARD Mode
Use when behavior crosses modules or changes runtime loading, file handoff, policy, or AI assist boundaries.

Read:
- `docs/CODEX_FAST_CONTEXT.md`
- `docs/REPO_MAP.md`
- `docs/BUG_PLAYBOOK.md`
- relevant playbook under `docs/codex-playbooks/`
- relevant source/tests

## DEEP Mode
Use only for:
- release notes
- privacy wording
- Chrome Web Store or Firefox Add-ons text
- enterprise claims
- architecture docs
- README claim alignment
- AI assist or file scanner public-scope claims

Read:
- `docs/CODEX_FAST_CONTEXT.md`
- `docs/REPO_MAP.md`
- `deep-research-report.md`
- `PRIVACY_POLICY.md`
- `README.md`
- `docs/NON_GOALS.md`
- `docs/AI_ASSIST.md`
- relevant release/store/source docs

## Lifecycle Rule
Preserve the current detection order:

```text
regex/provider deterministic rules
  -> entropy/context fallback
  -> Onix gray-zone classifier
  -> final redaction policy
```

Regex/provider rules are first authority. Entropy is fallback, not a global aggressive detector. Onix runs after deterministic findings and cannot downgrade them.

## Routing Table
| Task | Mode | Read | Tests |
|---|---|---|---|
| Secret not detected | FAST | `docs/codex-playbooks/detector-bug.md`, `src/shared/patterns.js`, `src/shared/detector.js`, relevant `src/shared/detection/*`, `tests/detector.test.js` | `node tests/detector.test.js` |
| False positive | FAST | `docs/codex-playbooks/false-positive.md`, `src/shared/patterns.js`, `src/shared/detector.js`, `src/shared/aiCandidateGate.js`, relevant safe-control tests | `node tests/detector.test.js` |
| Header/URL/raw suffix leak | FAST | `src/shared/detector.js`, `src/shared/detection/httpHeaders.js`, `src/shared/detection/urlUserinfo.js`, `src/shared/redactor.js`, `src/shared/transformOutboundPrompt.js`, `tests/break_pack.test.js` | `node tests/break_pack.test.js` |
| Placeholder reuse/trust | FAST | `src/shared/placeholders.js`, `src/shared/knownSecretReuse.js`, `src/shared/redactor.js`, `src/shared/transformOutboundPrompt.js` | `node tests/placeholder_trust.test.js` |
| Natural language detection | FAST | `src/shared/detector.js`, `tests/natural_language_context.test.js` | `node tests/natural_language_context.test.js` |
| IP/network issue | FAST | `src/shared/ipClassification.js`, `src/shared/ipDetection.js`, `src/shared/networkHierarchy.js`, `src/shared/placeholderAllocator.js` | `node tests/ip_transform.test.js` |
| Onix candidate/training/eval | STANDARD | `docs/codex-playbooks/onix-training-eval.md`, `docs/AI_ASSIST.md`, `ai/README.md`, `src/shared/aiCandidateGate.js`, `src/shared/transformOutboundPromptWithAi.js`, `ai/scripts/*` | `node tests/ai_candidate_gate.test.js && node tests/onix_dataset.test.js` |
| Composer rewrite | STANDARD | `src/content/content.js`, `src/content/composer_helpers.js`, `src/content/input/rewriteVerificationText.js`, `src/content/composer/chatgptComposerSync.js` | `node tests/composer_helpers.test.js && node tests/typed_interception.test.js` |
| File upload/scanner/handoff | STANDARD | `docs/codex-playbooks/file-handoff-fail-closed.md`, `docs/file-handoff-architecture.md`, `src/content/files/*`, `src/content/file_handoff_*.js`, `src/shared/fileScanner.js`, `src/shared/streamingFileRedactor.js` | `node tests/file_scanner.test.js && node tests/file_extractors.test.js && node tests/content_file_drop_interception.test.js` |
| Debug/diagnostics | STANDARD | `docs/codex-playbooks/debug-safety.md`, `src/content/diagnostics/*`, `tests/debug_logger.test.js`, `tests/file_debug_metadata.test.js`, `tests/security.test.js` | `node tests/debug_logger.test.js && node tests/file_debug_metadata.test.js && node tests/security.test.js` |
| Browser QA failure | STANDARD | `docs/codex-playbooks/browser-qa.md`, failing browser report/harness file, `tests/helpers/browserQaAssertions.js` | failing smoke or harness command |
| Policy/protected sites | STANDARD | `src/shared/policy.js`, `src/shared/protected_sites.js`, `src/background/protectedSiteRegistry.js`, `src/background/core.js` | `node tests/protected_sites.test.js && node tests/enterprise_policy.test.js` |
| Runtime script order | STANDARD | `src/shared/runtime_scripts.js`, `manifests/base.json`, `manifests/firefox.json`, `src/background/service_worker.js` | `node tests/runtime_script_order.test.js && node tests/runtime_script_order_contract.test.js && node tests/build_targets.test.js && node tests/security.test.js` |
| Build/manifest/CSP | STANDARD | `scripts/build-extension.mjs`, `scripts/build-all.mjs`, `manifests/*.json`, `src/shared/runtime_scripts.js` | `node tests/build_targets.test.js && node tests/security.test.js` |
| Privacy/product/release claims | DEEP | `deep-research-report.md`, `PRIVACY_POLICY.md`, `README.md`, `docs/NON_GOALS.md`, relevant release/store docs | docs-only unless behavior changed; always run `npm run docs:check-links` |
