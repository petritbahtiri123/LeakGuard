# LeakGuard Documentation Roadmap

Last updated: 2026-07-06

This file is the current documentation inventory, cleanup record, and roadmap. It intentionally separates product/user docs, developer docs, enterprise/admin docs, release/store docs, QA docs, and internal architecture notes so future changes can update the right audience without duplicating the same claims everywhere.

Inventory scope for this pass:

- Included root documentation files, `docs/**`, `ai/README.md`, `.github/copilot-instructions.md`, `.agents/skills/leakguard-playbook-promoter/SKILL.md`, and the manual QA fixture under `tests/`.
- Excluded generated or vendored content such as `dist/`, `node_modules/`, `ai/.venv/`, and `ai/models/`.
- No `.codex/` documentation directory was present in the repository.

## Current Documentation Map

### Product and user-facing docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [README.md](../README.md) | Primary project overview, v2.2.1 snapshot, supported sites, security model, build/load basics, and navigation. | Good / keep, but should stay high-level and avoid absorbing detailed guides. |
| [docs/README.md](README.md) | Central documentation index grouped by audience and use case. | Good / keep. Added in this cleanup. |
| [INSTALL_GUIDE.md](INSTALL_GUIDE.md) | Local build, browser load, and first-smoke guide for Chrome, Edge-compatible Chromium, and Firefox. | Good / keep. Added in the roadmap follow-up pass. |
| [PROTECTED_SITES_GUIDE.md](PROTECTED_SITES_GUIDE.md) | Built-in protected sites, user-managed exact-origin rules, optional permission behavior, and enterprise-managed site notes. | Good / keep. Added in the roadmap follow-up pass. |
| [PLACEHOLDERS_AND_REVEAL.md](PLACEHOLDERS_AND_REVEAL.md) | Placeholder stability, session scope, trusted-placeholder pass-through, file-scanner placeholder isolation, and popup-only secure reveal. | Good / keep. Added in the roadmap follow-up pass. |
| [FILE_UPLOAD_SCANNING_GUIDE.md](FILE_UPLOAD_SCANNING_GUIDE.md) | User-facing File Scanner and protected composer file handling guide with supported text files, size limits, unsupported-format boundaries, and WhatsApp file-path limits. | Good / keep. Added in the roadmap follow-up pass and refreshed for WhatsApp support. |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common popup, protected-site, reveal, rewrite, upload, Firefox, and enterprise-policy troubleshooting. | Good / keep. Added in the roadmap follow-up pass. |
| [WHATSAPP_SUPPORT_MATRIX.md](WHATSAPP_SUPPORT_MATRIX.md) | Current WhatsApp Web text, paste, clipboard image, attach-button, drag/drop, multi-file, unsupported-path, browser, and safety matrix. | Good / keep. Added in the WhatsApp docs completion pass. |
| [NON_GOALS.md](NON_GOALS.md) | Maintained non-goals and unsupported surfaces. | Good / keep. Use when adjusting product claims. |
| [DETECTION_ENHANCEMENTS.md](DETECTION_ENHANCEMENTS.md) | Current redaction hardening notes for placeholders, prose disclosures, headers, and known-secret reuse. | Good / keep, but review release timeline details during future releases. |
| [FILE_SCANNER_PLAN.md](FILE_SCANNER_PLAN.md) | File Scanner architecture and future scanner phases. | Historical / keep for architecture context. User-facing behavior now lives in `FILE_UPLOAD_SCANNING_GUIDE.md`. |

### Privacy and security docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [PRIVACY_POLICY.md](PRIVACY_POLICY.md) | User-facing privacy policy draft for local-only processing, storage, file handling, secure reveal, and limitations. | Needs human/legal review before publishing. Contact TODOs still need real project contacts. |
| [THREAT_MODEL.md](THREAT_MODEL.md) | Formal engineering threat model with assets, trust boundaries, architecture diagrams, residual risks, and security test mapping. | Good / keep. Added in the implementation roadmap completion pass. |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting policy. | Good / keep. |
| [SECURITY_REVIEW.md](../SECURITY_REVIEW.md) | Technical security review and residual risks around reveal, storage, DOM, logs, and CSP. | Good / keep, but should be refreshed after major security changes. |
| [BROWSER_COMPAT.md](../BROWSER_COMPAT.md) | Chrome/Firefox compatibility notes and fallback behavior. | Needs update. This cleanup aligned session fallback wording with the current ephemeral-memory implementation. |
| [BROWSER_COMPATIBILITY_MATRIX.md](BROWSER_COMPATIBILITY_MATRIX.md) | User/release-facing browser target matrix, known Chrome/Firefox differences, and compatibility review checklist. | Good / keep. Added in the roadmap follow-up pass. |
| [deep-research-report.md](deep-research-report.md) | Internal review of privacy posture, packaging, release risks, testing, and future hardening. | Good / keep after refresh. Recheck after major architecture, release, or browser-support changes. |

### Enterprise and admin docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [ENTERPRISE_DEPLOYMENT.md](ENTERPRISE_DEPLOYMENT.md) | Managed deployment guidance for Chrome/Edge, policy expectations, audit mode, and limitations. | Needs update before enterprise publication. This cleanup corrected stale file-upload limitation wording. |
| [MANAGED_POLICY_SCHEMA.md](MANAGED_POLICY_SCHEMA.md) | Admin-facing managed policy field guide with defaults, examples, destination policy behavior, and validation commands. | Good / keep. Added in the roadmap follow-up pass. |
| [BUILD_TARGETS.md](BUILD_TARGETS.md) | Consumer/enterprise build targets, manifest overlays, and managed-policy loading. | Good / keep. |

### Developer and contributor docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contributor setup, local development, testing, PR process, and docs expectations. | Needs update. This cleanup fixed obvious encoding artifacts and stale module references; a fuller contributor refresh can come later. |
| [REPO_MAP.md](REPO_MAP.md) | Compact repo map, high-risk regression areas, and test ownership. | Good / keep. |
| [BUG_PLAYBOOK.md](BUG_PLAYBOOK.md) | Common bug routing, debugging hints, and focused test commands. | Good / keep. |
| [AI_ASSIST.md](AI_ASSIST.md) | Browser-facing local AI assist design, smoke tests, and training flow. | Good / keep after this cleanup aligned the training command/count. |
| [ai/README.md](../ai/README.md) | Local AI training, evaluation, and ONNX export workflow. | Good / keep. Current Onix lifecycle, 50,000-record default, held-out eval, and safety rules are documented. |
| [code-quality-audit.md](code-quality-audit.md) | Historical internal code quality findings and suggested PR sequence. | Historical / keep for context. Current ownership lives in `REPO_MAP.md`. |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | Ordered implementation roadmap for deep-research, documentation, release, and code-quality hardening work. | Good / keep. Added after refreshing `deep-research-report.md`. |
| [roadmap/content-script-modularization-plan.md](roadmap/content-script-modularization-plan.md) | Plan to reduce `src/content/content.js` through test-gated module extraction without behavior changes. | Good / keep. Added in the WhatsApp docs completion pass. |
| [roadmap/content-script-modularization-inventory.md](roadmap/content-script-modularization-inventory.md) | Current progress inventory for extracted content-script modules, focused tests, and remaining large `content.js` clusters. | Good / keep. Refresh after each modularization pass. |

### Testing and QA docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md) | Release-gating manual QA across packaging, protected sites, scanner, file handling, and store assets. | Good / keep. Long but purposeful. |
| [qa/cross-site-manual-checklist.md](qa/cross-site-manual-checklist.md) | Detailed manual matrix for Chrome/Firefox and supported AI sites. | Good / keep. |
| [tests/manual_detection_paste_block.txt](../tests/manual_detection_paste_block.txt) | Synthetic redaction smoke fixture. | Good / keep as a QA artifact rather than prose docs. |
| [scripts/check-doc-links.mjs](../scripts/check-doc-links.mjs) | Lightweight local markdown link checker for repository docs. | Good / keep. Added in the roadmap follow-up pass and exposed as `npm run docs:check-links`. |

### Release and store docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md) | Chrome listing copy, permission justifications, screenshots, and reviewer notes. | Needs product/store review before submission. Wording is conservative and local-only. |
| [FIREFOX_AMO_CHECKLIST.md](FIREFOX_AMO_CHECKLIST.md) | Firefox Add-ons listing and submission checklist for manifest, data declaration, source package, reviewer notes, and QA. | Good / keep. Added in the roadmap follow-up pass. |
| [STORE_ASSETS_CHECKLIST.md](STORE_ASSETS_CHECKLIST.md) | Screenshot, copy, image hygiene, and submission-asset checklist for store review. | Good / keep. Added in the roadmap follow-up pass. |
| [RELEASE_PROVENANCE_CHECKLIST.md](RELEASE_PROVENANCE_CHECKLIST.md) | Release-record checklist for source commit, build command, artifact hashes, SBOM, dependency scans, QA signoff, and residual risks. | Good / keep. Updated in the implementation roadmap completion pass. |
| [VERSIONING_POLICY.md](VERSIONING_POLICY.md) | Version bump, release-note, QA, and artifact expectations. | Good / keep. Added in the roadmap follow-up pass. |
| [codex-playbooks/firefox-addon-submission.md](codex-playbooks/firefox-addon-submission.md) | Operational playbook for AMO manifest, source zip, and data declaration issues. | Good / keep as an internal playbook; not a full public AMO checklist. |

### Codex and agent workflow docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [AGENTS.md](../AGENTS.md) | Repository agent guide and non-negotiable rules. | Good / keep. |
| [CODEX_FAST_CONTEXT.md](CODEX_FAST_CONTEXT.md) | Smallest context for routine Codex tasks. | Good / keep. |
| [CODEX_CONTEXT_ROUTER.md](CODEX_CONTEXT_ROUTER.md) | FAST/STANDARD/DEEP routing. | Good / keep. |
| [CODEX_MEMORY.md](CODEX_MEMORY.md) | Local Codex memory and playbook workflow. | Good / keep. |
| [CODEX_PROMPT_TEMPLATES.md](CODEX_PROMPT_TEMPLATES.md) | Canonical cost-aware Codex prompt template. | Good / keep after this cleanup removed duplicate content. |
| [Prompt_Templates.md](Prompt_Templates.md) | Legacy prompt-template filename. | Deprecated / candidate for archive. Now redirects to the canonical file. |
| [Cost-aware-coding-instructions.md](Cost-aware-coding-instructions.md) | Standalone copy of cost-aware agent instructions. | Duplicated / consolidate later with `AGENTS.md` and Codex context docs. |
| [CODEX_CHANGELOG.md](CODEX_CHANGELOG.md) | AI-agent handoff log. | Good / keep, but periodically prune or archive old entries if it becomes noisy. |
| [codex-playbooks/INDEX.md](codex-playbooks/INDEX.md) | Playbook router. | Good / keep. |
| [codex-playbooks/allow-once-popup-loop.md](codex-playbooks/allow-once-popup-loop.md) | Allow-once popup loop remediation playbook. | Good / keep. |
| [codex-playbooks/detector-bug.md](codex-playbooks/detector-bug.md) | Detector miss remediation playbook. | Good / keep. |
| [codex-playbooks/false-positive.md](codex-playbooks/false-positive.md) | False-positive remediation playbook. | Good / keep. |
| [codex-playbooks/file-handoff-fail-closed.md](codex-playbooks/file-handoff-fail-closed.md) | File handoff and fail-closed remediation playbook. | Good / keep. |
| [codex-playbooks/debug-safety.md](codex-playbooks/debug-safety.md) | Metadata-only diagnostics playbook. | Good / keep. |
| [codex-playbooks/onix-training-eval.md](codex-playbooks/onix-training-eval.md) | Onix dataset/training/eval playbook. | Good / keep. |
| [codex-playbooks/browser-qa.md](codex-playbooks/browser-qa.md) | Browser QA failure playbook. | Good / keep. |
| [codex-playbooks/gemini-drag-drop-file-ingestion.md](codex-playbooks/gemini-drag-drop-file-ingestion.md) | Gemini drag/drop remediation playbook. | Good / keep. |
| [codex-playbooks/firefox-addon-submission.md](codex-playbooks/firefox-addon-submission.md) | Firefox Add-ons submission remediation playbook. | Good / keep. |
| [.github/copilot-instructions.md](../.github/copilot-instructions.md) | Short GitHub Copilot review focus. | Good / keep. |
| [.agents/skills/leakguard-playbook-promoter/SKILL.md](../.agents/skills/leakguard-playbook-promoter/SKILL.md) | Local skill for promoting solved issues into playbooks. | Good / keep. |

## Documentation Quality Status

### Good / keep

- `docs/README.md`
- `docs/NON_GOALS.md`
- `docs/INSTALL_GUIDE.md`
- `docs/PROTECTED_SITES_GUIDE.md`
- `docs/PLACEHOLDERS_AND_REVEAL.md`
- `docs/FILE_UPLOAD_SCANNING_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/IMPLEMENTATION_ROADMAP.md`
- `docs/THREAT_MODEL.md`
- `docs/REPO_MAP.md`
- `docs/BUG_PLAYBOOK.md`
- `docs/BUILD_TARGETS.md`
- `docs/BROWSER_COMPATIBILITY_MATRIX.md`
- `docs/WHATSAPP_SUPPORT_MATRIX.md`
- `docs/MANAGED_POLICY_SCHEMA.md`
- `docs/FIREFOX_AMO_CHECKLIST.md`
- `docs/STORE_ASSETS_CHECKLIST.md`
- `docs/RELEASE_PROVENANCE_CHECKLIST.md`
- `docs/VERSIONING_POLICY.md`
- `docs/RELEASE_QA_CHECKLIST.md`
- `docs/qa/whatsapp-web-multi-file-qa.md`
- `docs/qa/cross-site-manual-checklist.md`
- `docs/file-handoff-architecture.md`
- `docs/DETECTION_ENHANCEMENTS.md`
- `SECURITY.md`
- `SECURITY_REVIEW.md`
- `AGENTS.md`
- `docs/CODEX_FAST_CONTEXT.md`
- `docs/CODEX_CONTEXT_ROUTER.md`
- `docs/CODEX_MEMORY.md`
- `docs/CODEX_CHANGELOG.md`
- `docs/codex-playbooks/*`
- `.github/copilot-instructions.md`
- `.agents/skills/leakguard-playbook-promoter/SKILL.md`

### Needs update

- `README.md` - should remain high-level; future work should avoid adding every feature detail here.
- `docs/PRIVACY_POLICY.md` - needs real support/privacy contact details and human/legal review.
- `docs/CHROME_WEB_STORE_LISTING.md` - needs final store/product review and final screenshots.
- `docs/ENTERPRISE_DEPLOYMENT.md` - needs admin review against current browser policy docs before publication.
- `BROWSER_COMPAT.md` - should be refreshed after each browser-specific release hardening pass; the user/release matrix now lives in `docs/BROWSER_COMPATIBILITY_MATRIX.md`.
- `CONTRIBUTING.md` - needs a fuller pass for current module names and modern setup details; this pass added the docs link-check command.
- `docs/AI_ASSIST.md` and `ai/README.md` - keep in sync when AI pipeline scripts, counts, or thresholds change.
- `docs/FILE_SCANNER_PLAN.md` - now has a dedicated user-facing companion in `docs/FILE_UPLOAD_SCANNING_GUIDE.md`; later work can archive historical planning sections.
- `docs/deep-research-report.md` - refreshed on 2026-05-29; recheck after the next major architecture, release, or browser-support change.

### Duplicated / consolidate later

- `docs/CODEX_PROMPT_TEMPLATES.md`, `docs/Prompt_Templates.md`, and `docs/Cost-aware-coding-instructions.md` overlap around cost-aware Codex usage.
- README, privacy policy, Chrome listing, and release checklist all repeat local-only/file-handling claims. They serve different audiences, so they should remain separate but must be checked together before release.
- File Scanner behavior appears in README, privacy policy, Chrome listing, release QA, `FILE_SCANNER_PLAN.md`, and `file-handoff-architecture.md`. Keep audience-specific docs, but create a shorter canonical user guide later.

### Created in the roadmap follow-up pass

- Dedicated local install guide for Chrome, Edge-compatible Chromium, and Firefox users.
- Protected-sites behavior guide.
- Placeholder, secure reveal, and placeholder reuse guide.
- File upload/scanning user guide that distinguishes scanner page, composer paste/drop/select flows, unsupported files, and size limits.
- Chrome vs Firefox compatibility matrix.
- Managed policy schema guide that maps `config/managed_policy_schema.json` to admin-facing examples.
- Release versioning policy.
- Firefox AMO listing/submission checklist, separate from the internal playbook.
- Screenshot/store assets checklist.
- Troubleshooting guide for common popup, protected-site, upload, reveal, Firefox, and enterprise-policy issues.
- Lightweight markdown link checker exposed as `npm run docs:check-links`.

### Still missing / should be created later

- Full enterprise deployment examples rechecked against current Chrome, Edge, and Firefox policy documentation immediately before publication.
- Store/legal/product signoff for privacy contact details and public release wording.
- Canonical known-limitations page if `docs/NON_GOALS.md` becomes too broad for user-facing limitations.
- Firefox ESR smoke CI and broader browser/site/file-flow coverage if the repo starts claiming release-tested support beyond the current Chrome, Firefox, and basic Edge smoke gates.

### Deprecated / candidate for archive

- `docs/Prompt_Templates.md` - legacy duplicate now redirects to `docs/CODEX_PROMPT_TEMPLATES.md`.
- Historical planning sections inside `docs/FILE_SCANNER_PLAN.md` - keep for now, but split or archive once a stable file-scanner user guide exists.
- Older date-sensitive findings in `docs/deep-research-report.md` history - keep as internal evidence until a formal threat model supersedes them.

## Cleanup Decisions Made In This PR

- Added [docs/README.md](README.md) as the central documentation index.
- Added this roadmap as the inventory, quality-status record, and future cleanup plan.
- Updated the root [README](../README.md) documentation section to point to the docs index and roadmap instead of being the only navigation hub.
- Fixed visible README encoding artifacts in the support section and removed stale "upcoming file scanning" wording now that text-file scanning exists.
- Clarified [BROWSER_COMPAT.md](../BROWSER_COMPAT.md) so session-state fallback matches the current ephemeral-memory implementation, not `storage.local`.
- Corrected stale [ENTERPRISE_DEPLOYMENT.md](ENTERPRISE_DEPLOYMENT.md) limitations so it no longer says file upload/drag-drop payload inspection is absent in all cases.
- Consolidated the duplicated Codex prompt template by making `docs/CODEX_PROMPT_TEMPLATES.md` canonical and turning `docs/Prompt_Templates.md` into a deprecation pointer.
- Corrected AI training generator references in [docs/AI_ASSIST.md](AI_ASSIST.md) and [ai/README.md](../ai/README.md).
- Fixed obvious `CONTRIBUTING.md` encoding artifacts and stale module names without changing its broader structure.

## Roadmap Follow-Up Decisions

- Added user guides for install, protected sites, placeholders/reveal, file upload scanning, and troubleshooting.
- Added release/admin guides for browser compatibility, managed policy schema, versioning, Firefox AMO submission, and store assets.
- Routed the new guides from [docs/README.md](README.md), the root [README](../README.md), and relevant existing docs.
- Added [scripts/check-doc-links.mjs](../scripts/check-doc-links.mjs) and exposed it as `npm run docs:check-links`.
- Refreshed [deep-research-report.md](deep-research-report.md) to remove stale citation artifacts and mark completed versus open hardening items.
- Added [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) as the ordered implementation plan for remaining deep-research/code-quality work.
- Kept runtime behavior untouched and did not modify generated artifacts.

## WhatsApp Support Documentation Pass

- Added [WHATSAPP_SUPPORT_MATRIX.md](WHATSAPP_SUPPORT_MATRIX.md) as the current support matrix for WhatsApp Web text, paste, clipboard image paste, attach-button, drag/drop, multi-file limits, unsupported paths, browser notes, and safety invariants.
- Added [qa/whatsapp-web-multi-file-qa.md](qa/whatsapp-web-multi-file-qa.md) for 2-5 file attach/drop batches, 6+ before-read blocks, unsupported/failing batch all-or-nothing behavior, and attach/drop parity.
- Refreshed WhatsApp QA docs so single-file, 2-5 file, 6+ blocked, file-paste-out-of-scope, and no-extracted-text-fallback language is consistent.
- Added [roadmap/content-script-modularization-plan.md](roadmap/content-script-modularization-plan.md) as the content-script modularization plan.
- Updated release, browser compatibility, protected-site, file capability, Chrome listing, README, and E2E docs to reflect completed WhatsApp support without changing runtime behavior.

## Implementation Roadmap Completion Pass

- Added [THREAT_MODEL.md](THREAT_MODEL.md) with assets, trust boundaries, hostile-page assumptions, extension UI trust, session storage fallback, file handoff boundaries, local AI assist boundaries, enterprise audit metadata boundaries, Mermaid diagrams, residual risks, and existing security test mapping.
- Updated release provenance expectations so release notes must record source commit, build command, package/artifact hash, SBOM artifact, dependency scan result, QA signoff, and residual risks.
- Replaced the privacy contact placeholder with explicit TODO checklist items because no correct project support or privacy contact was locally discoverable.
- Kept publication/legal/store review and browser-policy rechecks pending for humans before submission.

## Remaining Documentation Roadmap

### Phase 1 - Foundation cleanup

- Fix broken links. Current follow-up pass added `npm run docs:check-links` and verified local markdown links.
- Create/refresh docs index. Current follow-up pass refreshed `docs/README.md`.
- Align README with current features. Current follow-up pass kept README high-level and routed detail to audience-specific guides.
- Remove obvious duplication. Current follow-up pass moved detailed user/admin guidance into dedicated docs and linked from central entry points.
- Decide whether `docs/INDEX.md` is also needed, or whether `docs/README.md` is sufficient.
- Add a lightweight markdown link checker. Completed with `scripts/check-doc-links.mjs`.

### Phase 2 - Product/user documentation

- Create a clear install guide. Completed with `docs/INSTALL_GUIDE.md`.
- Explain protected-sites behavior, built-in sites, and user-managed exact-origin rules. Completed with `docs/PROTECTED_SITES_GUIDE.md`.
- Explain placeholder/reveal behavior, including session scope and unknown-placeholder handling. Completed with `docs/PLACEHOLDERS_AND_REVEAL.md`.
- Explain file upload scanning behavior, including scanner page vs composer paste/drop/select flows. Completed with `docs/FILE_UPLOAD_SCANNING_GUIDE.md`.
- Add Chrome vs Firefox user notes for loading, permissions, and known limitations. Completed with `docs/BROWSER_COMPATIBILITY_MATRIX.md`.

### Phase 3 - Enterprise/admin documentation

- Create a managed policy schema guide. Completed with `docs/MANAGED_POLICY_SCHEMA.md`.
- Create a deployment guide with browser policy examples and tested assumptions.
- Explain audit/session retention behavior in admin-facing terms.
- Add privacy/security admin notes that stay conservative and avoid compliance overclaims.
- Review enterprise copy against current Chrome, Edge, and Firefox policy docs before publishing.

### Phase 4 - Developer documentation

- Keep repo structure current and link to `docs/REPO_MAP.md`.
- Keep build instructions aligned with `package.json` scripts.
- Keep test commands aligned with `scripts/run-tests.mjs`.
- Document release packaging expectations and generated-artifact boundaries.
- Add browser-specific debugging notes for Chrome service worker and Firefox background-script behavior.

### Phase 5 - Release/store documentation

- Maintain a Chrome Web Store checklist.
- Create a Firefox AMO checklist. Completed with `docs/FIREFOX_AMO_CHECKLIST.md`.
- Define versioning policy. Completed with `docs/VERSIONING_POLICY.md`.
- Maintain release QA checklist.
- Create screenshots/store assets checklist. Completed with `docs/STORE_ASSETS_CHECKLIST.md`.
- Keep privacy/store wording aligned and conservative across README, privacy policy, Chrome listing, AMO listing, and release QA.

### Phase 6 - Long-term documentation hardening

- Create a formal threat model. Completed with `docs/THREAT_MODEL.md`.
- Add architecture diagrams for redaction, placeholder state, secure reveal, file handoff, and AI candidate gate. Completed with `docs/THREAT_MODEL.md`.
- Maintain known limitations in one canonical place and cross-link from public docs.
- Create a compatibility matrix for browser/version/site/file-flow support. Initial browser-target matrix completed with `docs/BROWSER_COMPATIBILITY_MATRIX.md`; site/file-flow coverage still belongs in release QA.
- Create a troubleshooting guide. Completed with `docs/TROUBLESHOOTING.md`.
- Add documentation lint/link checker if not already present. Completed with `npm run docs:check-links`.

## Risk Notes

- Privacy, enterprise, legal, and store submission wording still needs human review before publication.
- LeakGuard should continue to say it reduces leak risk; it should not claim perfect protection, guaranteed detection, enterprise compliance certification, or support for every site/editor/upload path.
- Enterprise deployment docs should be rechecked against current browser policy documentation before public use because browser admin controls change over time.
- Store docs need final screenshots and real support/privacy contact details.
- The docs still contain multiple audience-specific versions of local-only and file-handling claims. That is acceptable only if they are reviewed together before release.

## Acceptance Criteria

Documentation cleanup is complete when:

- A documentation index exists and is linked from the root README.
- `docs/DOCUMENTATION_ROADMAP.md` exists and stays current enough to route future cleanup work.
- User-facing docs make conservative privacy and security claims.
- Enterprise and store docs do not overpromise coverage, compliance, or detection guarantees.
- Chrome and Firefox docs remain aligned where features are shared and explicitly call out known differences where they are not shared.
- Duplicate docs are either consolidated, cross-linked, or marked deprecated.
- Broken links are fixed or tracked.
- Documentation-only changes do not modify runtime extension behavior, tests, generated artifacts, `dist/`, `node_modules/`, `ai/models/`, or package lock files.
