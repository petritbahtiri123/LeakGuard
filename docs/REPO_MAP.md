# Repo Map

## Root
- `package.json`: npm scripts and dependencies.
- `scripts/run-tests.mjs`: ordered Node regression suite.
- `scripts/prepare-build.mjs`: prepares local build assets and checks local AI classifier state before tests/builds.
- `scripts/build-all.mjs`: builds all Chrome/Firefox consumer/enterprise targets.
- `scripts/build-extension.mjs`: copies runtime assets, manifests, config, AI model, and ONNX runtime into `dist/`.
- `scripts/export-icons.mjs`: regenerates extension icon assets.
- `manifests/*.json`: MV3 base plus Chrome/Firefox and enterprise overlays.
- `config/policy.*.json`: bundled consumer/enterprise policy defaults.
- `config/managed_policy_schema.json`: browser managed-policy schema.
- `dist/`: generated extension builds.

## Runtime
- `src/background/service_worker.js`: import order for background runtime.
- `src/background/core.js`: session state, message handlers, protected-site sync, reveal staging, enterprise audit/policy enforcement.
- `src/compat/browser_api.js`: browser API wrapper for Chrome/Firefox compatibility.
- `src/compat/platform.js`: platform detection helpers.
- `src/content/content.js`: composer detection, paste/type/send interception, modal decisions, safe rewrite verification.
- `src/content/composer_helpers.js`: textarea/contenteditable text IO, selection, rewrite, beforeinput helpers.
- `src/popup/*`: popup UI, protected-site management, secure reveal view.
- `src/options/*`: options page for protected-site management.
- `src/scanner/*`: local file scanner UI.
- `src/ui/reveal_panel.*`: extension-owned reveal surface.

## Shared Core
- `src/shared/entropy.js`: entropy scoring helpers used by deterministic detection.
- `src/shared/patterns.js`: regex patterns, keyword lists, safe/example suppression constants.
- `src/shared/detector.js`: deterministic secret detector, sensitive HTTP header ranges, URL credential parsing, trust-aware placeholder handling, labelled/natural-language disclosures, and overlap resolution.
- `src/shared/redactor.js`: right-to-left finding replacement plus known-secret reuse that can suppress shorter contained findings.
- `src/shared/placeholders.js`: placeholder allocation, canonicalization, trust checks, visible index reservation, state export/import.
- `src/shared/sessionMapStore.js`: in-memory/private placeholder mapping support.
- `src/shared/policy.js`: consumer/enterprise policy decisions.
- `src/shared/protected_sites.js`: protected-site normalization and matching.
- `src/shared/transformOutboundPrompt.js`: prompt redaction plus network pseudonymization, sharing the same known-secret reuse behavior as `redactor.js`.
- `src/shared/transformOutboundPromptWithAi.js`: deterministic transform with optional AI assist.
- `src/shared/fileScanner.js`: text-file validation, scan, redacted report/export data.

## Network + AI
- `src/shared/ipClassification.js`: IPv4 parsing and public/private classification.
- `src/shared/ipDetection.js`: IP/CIDR candidate extraction and role hints.
- `src/shared/networkHierarchy.js`: subnet/host parent relationships.
- `src/shared/placeholderAllocator.js`: network placeholder allocation.
- `src/shared/aiCandidateGate.js`: medium-confidence candidate extraction for AI assist.
- `src/shared/ai/classifier.js`: local ONNX classifier loader/inference.
- `ai/scripts/*`, `ai/models/*`, `ai/dataset/*`: local model training/export/evaluation assets.

## Relationships
- `patterns.js` + `entropy.js` feed `detector.js`.
- `detector.js` emits findings; `redactor.js` applies secret placeholders through `PlaceholderManager`.
- `transformOutboundPrompt.js` combines secret findings with IP findings and network placeholders.
- `content.js` asks `background/core.js` to transform text; background owns private placeholder state.
- `popup.js` can reveal only placeholders known to the background session.
- `policy.js` and `protected_sites.js` gate destination actions and content-script coverage.
- Tests mirror these boundaries: detector, placeholder trust, transform, content helpers, policy, build, security.

## High-Risk Regression Areas
- Header redaction: keep names and separators visible while replacing full sensitive values.
- Placeholder trust: preserve only placeholders known by the active session/public state.
- Known-secret reuse: repeated raw secrets must reuse placeholders across headers, assignments, and labelled prose.
- Composer rewrites: contenteditable and textarea verification must compare the final composer text to the expected redacted text before submission.
- Browser compatibility: MV3 manifests, CSP, and wrapper APIs must keep Chrome and Firefox targets working.
- Local-only processing: AI assist, file scanning, reveal, and audit data must not send secrets to remote services.

## Test Ownership
- `tests/detector.test.js`: deterministic patterns, suppression, natural-language/labelled findings, placeholder formatting.
- `tests/break_pack.test.js`: end-to-end redaction regressions for headers, URLs, repeated secrets, and safe literals.
- `tests/placeholder_trust.test.js`: trusted placeholder preservation and remapping behavior.
- `tests/natural_language_context.test.js`: prose and labelled disclosure detection boundaries.
- `tests/ai_candidate_gate.test.js`, `tests/transform_with_ai.test.js`, `tests/ai_assist.test.js`: local AI candidate and assist behavior.
- `tests/ip_transform.test.js`, `tests/ip_child_first_audit.test.js`: IP/CIDR pseudonymization and hierarchy behavior.
- `tests/composer_helpers.test.js`, `tests/typed_interception.test.js`: textarea/contenteditable rewrite and typed interception behavior.
- `tests/protected_sites.test.js`, `tests/enterprise_policy.test.js`: protected-site and policy behavior.
- `tests/file_scanner.test.js`: local file scanner behavior.
- `tests/productization.test.js`, `tests/security.test.js`, `tests/build_targets.test.js`: static packaging, CSP/security, and build target coverage.
- `tests/synthetic_pack.test.js`, `tests/adversarial_redaction.test.js`: broad synthetic and adversarial redaction coverage.

## Exact Commands
- `npm run prepare:build`
- `npm test`
- `node tests/<file>.test.js`
- `npm run build`
- `npm run build:all`
- `npm run build:chrome`
- `npm run build:chrome-enterprise`
- `npm run build:firefox`
- `npm run build:firefox-enterprise`
- `npm run icons:export`
