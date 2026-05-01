# Repo Map

## Root
- `package.json`: npm scripts and dependencies.
- `scripts/run-tests.mjs`: ordered Node regression suite.
- `scripts/build-extension.mjs`: copies runtime assets, manifests, config, AI model, and ONNX runtime into `dist/`.
- `manifests/*.json`: MV3 base plus Chrome/Firefox and enterprise overlays.
- `config/policy.*.json`: bundled consumer/enterprise policy defaults.
- `dist/`: generated extension builds.

## Runtime
- `src/background/service_worker.js`: import order for background runtime.
- `src/background/core.js`: session state, message handlers, protected-site sync, reveal staging, enterprise audit/policy enforcement.
- `src/content/content.js`: composer detection, paste/type/send interception, modal decisions, safe rewrite verification.
- `src/content/composer_helpers.js`: textarea/contenteditable text IO, selection, rewrite, beforeinput helpers.
- `src/popup/*`: popup UI, protected-site management, secure reveal view.
- `src/options/*`: options page for protected-site management.
- `src/scanner/*`: local file scanner UI.
- `src/ui/reveal_panel.*`: extension-owned reveal surface.

## Shared Core
- `src/shared/patterns.js`: regex patterns, keyword lists, safe/example suppression constants.
- `src/shared/detector.js`: deterministic secret detector, sensitive HTTP header ranges, URL credential parsing, trust-aware placeholder handling, labelled/natural-language disclosures, and overlap resolution.
- `src/shared/redactor.js`: right-to-left finding replacement plus known-secret reuse that can suppress shorter contained findings.
- `src/shared/placeholders.js`: placeholder allocation, canonicalization, trust checks, visible index reservation, state export/import.
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
