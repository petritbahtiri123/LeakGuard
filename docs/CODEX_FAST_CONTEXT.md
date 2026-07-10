# LeakGuard Codex Fast Context

Use this file with directly relevant source and tests for routine work. Mandatory policy lives in `AGENTS.md`; escalation rules live in `docs/CODEX_CONTEXT_ROUTER.md`.

## Product and lifecycle

LeakGuard locally redacts secrets, sensitive identity data, and public network details before protected AI/chat composers receive text or files. Core placeholders include `[PWM_1]`, `[NET_1]`, and `[PUB_HOST_1]`.

```text
deterministic rules -> entropy/context fallback -> Onix gray-zone classifier -> final redaction policy
```

Deterministic findings stay authoritative. Onix evaluates gated leftovers only and cannot downgrade them. Emails globally redact; usernames remain context-aware.

## Area router

| Area | Start with | Focused validation |
|---|---|---|
| Detector/provider | `src/shared/detector.js`, `src/shared/patterns.js`, relevant `src/shared/detection/*` | `node tests/detector.test.js` |
| Header/URL/reuse | `src/shared/detection/httpHeaders.js`, `urlUserinfo.js`, `knownSecretReuse.js`, `redactor.js` | `node tests/break_pack.test.js` |
| Placeholder trust | `src/shared/placeholders.js`, `knownSecretReuse.js`, transform/redactor | `node tests/placeholder_trust.test.js` |
| Network/IP | `ipClassification.js`, `ipDetection.js`, `networkHierarchy.js`, `placeholderAllocator.js` | `node tests/ip_transform.test.js` |
| Onix | `aiCandidateGate.js`, `transformOutboundPromptWithAi.js`, matching AI script | `node tests/ai_candidate_gate.test.js` |
| Composer/input | `src/content/composer/*`, `src/content/input/*`, `composer_helpers.js` | `node tests/composer_helpers.test.js` and `node tests/typed_interception.test.js` |
| File handoff | `src/content/files/*`, `src/content/file_handoff_*.js`, shared scanner/extractors | `node tests/content_file_drop_interception.test.js` |
| Diagnostics | `src/content/diagnostics/*`, `src/background/auditLog.js` | `node tests/security.test.js` |
| Policy/sites | `src/shared/policy.js`, `protected_sites.js`, `protectedSiteRegistry.js` | `node tests/protected_sites.test.js` and `node tests/enterprise_policy.test.js` |
| Runtime/build | `runtime_scripts.js`, manifests, service worker, build scripts | runtime-order, build-target, and security guards |

Use `docs/REPO_MAP.md` only when this table is insufficient. Use `docs/BUG_PLAYBOOK.md` or one file from `docs/codex-playbooks/` only for a matching failure fingerprint.

## Runtime order

Keep `src/shared/runtime_scripts.js`, `manifests/base.json`, `manifests/firefox.json`, and `src/background/service_worker.js` aligned. Dependencies load before consumers; `src/content/content.js` and `src/background/core.js` remain final orchestrators.

```powershell
node tests/runtime_script_order.test.js
node tests/runtime_script_order_contract.test.js
node tests/build_targets.test.js
node tests/security.test.js
```

## Commands

```powershell
npm run test:changed
npm test
npm run docs:check-links
npm run smoke:chrome
npm run smoke:firefox
node --check <touched-js-file>
git diff --check
```

Use `npm test` and browser/release gates according to `docs/CODEX_CONTEXT_ROUTER.md`, not automatically for every change.
