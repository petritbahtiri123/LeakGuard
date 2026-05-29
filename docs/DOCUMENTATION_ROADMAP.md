# LeakGuard Documentation Roadmap

Last updated: 2026-05-29

This file is the current documentation inventory, cleanup record, and roadmap. It intentionally separates product/user docs, developer docs, enterprise/admin docs, release/store docs, QA docs, and internal architecture notes so future changes can update the right audience without duplicating the same claims everywhere.

Inventory scope for this pass:

- Included root documentation files, `docs/**`, `ai/README.md`, `.github/copilot-instructions.md`, `.agents/skills/leakguard-playbook-promoter/SKILL.md`, and the manual QA fixture under `tests/`.
- Excluded generated or vendored content such as `dist/`, `node_modules/`, `ai/.venv/`, and `ai/models/`.
- No `.codex/` documentation directory was present in the repository.

## Current Documentation Map

### Product and user-facing docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [README.md](../README.md) | Primary project overview, v1.7.0 snapshot, supported sites, security model, build/load basics, and navigation. | Good / keep, but should stay high-level and avoid absorbing detailed guides. |
| [docs/README.md](README.md) | Central documentation index grouped by audience and use case. | Good / keep. Added in this cleanup. |
| [NON_GOALS.md](NON_GOALS.md) | Maintained non-goals and unsupported surfaces. | Good / keep. Use when adjusting product claims. |
| [DETECTION_ENHANCEMENTS.md](DETECTION_ENHANCEMENTS.md) | Current redaction hardening notes for placeholders, prose disclosures, headers, and known-secret reuse. | Good / keep, but review release timeline details during future releases. |
| [FILE_SCANNER_PLAN.md](FILE_SCANNER_PLAN.md) | File Scanner architecture and future scanner phases. | Needs update. It has a launch status section, but much of the lower roadmap is historical implementation planning rather than user guidance. |

### Privacy and security docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [PRIVACY_POLICY.md](PRIVACY_POLICY.md) | User-facing privacy policy draft for local-only processing, storage, file handling, secure reveal, and limitations. | Needs human/legal review before publishing. Contact placeholder still needs replacement. |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting policy. | Good / keep. |
| [SECURITY_REVIEW.md](../SECURITY_REVIEW.md) | Technical security review and residual risks around reveal, storage, DOM, logs, and CSP. | Good / keep, but should be refreshed after major security changes. |
| [BROWSER_COMPAT.md](../BROWSER_COMPAT.md) | Chrome/Firefox compatibility notes and fallback behavior. | Needs update. This cleanup aligned session fallback wording with the current ephemeral-memory implementation. |
| [deep-research-report.md](deep-research-report.md) | Internal review of privacy posture, packaging, release risks, testing, and future hardening. | Needs update. Useful evidence record, but citation artifacts and date-sensitive claims require periodic review. |

### Enterprise and admin docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [ENTERPRISE_DEPLOYMENT.md](ENTERPRISE_DEPLOYMENT.md) | Managed deployment guidance for Chrome/Edge, policy expectations, audit mode, and limitations. | Needs update before enterprise publication. This cleanup corrected stale file-upload limitation wording. |
| [BUILD_TARGETS.md](BUILD_TARGETS.md) | Consumer/enterprise build targets, manifest overlays, and managed-policy loading. | Good / keep. |

### Developer and contributor docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contributor setup, local development, testing, PR process, and docs expectations. | Needs update. This cleanup fixed obvious encoding artifacts and stale module references; a fuller contributor refresh can come later. |
| [REPO_MAP.md](REPO_MAP.md) | Compact repo map, high-risk regression areas, and test ownership. | Good / keep. |
| [BUG_PLAYBOOK.md](BUG_PLAYBOOK.md) | Common bug routing, debugging hints, and focused test commands. | Good / keep. |
| [AI_ASSIST.md](AI_ASSIST.md) | Browser-facing local AI assist design, smoke tests, and training flow. | Good / keep after this cleanup aligned the training command/count. |
| [ai/README.md](../ai/README.md) | Local AI training, evaluation, and ONNX export workflow. | Needs update. This cleanup corrected the generator command and routed browser threshold details to `docs/AI_ASSIST.md`. |
| [code-quality-audit.md](code-quality-audit.md) | Internal code quality findings and suggested PR sequence. | Good / keep as an internal planning note. |

### Testing and QA docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md) | Release-gating manual QA across packaging, protected sites, scanner, file handling, and store assets. | Good / keep. Long but purposeful. |
| [qa/cross-site-manual-checklist.md](qa/cross-site-manual-checklist.md) | Detailed manual matrix for Chrome/Firefox and supported AI sites. | Good / keep. |
| [tests/manual_detection_paste_block.txt](../tests/manual_detection_paste_block.txt) | Synthetic redaction smoke fixture. | Good / keep as a QA artifact rather than prose docs. |

### Release and store docs

| Document | Purpose | Current status |
| --- | --- | --- |
| [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md) | Chrome listing copy, permission justifications, screenshots, and reviewer notes. | Needs product/store review before submission. Wording is conservative and local-only. |
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
| [codex-playbooks/gemini-drag-drop-file-ingestion.md](codex-playbooks/gemini-drag-drop-file-ingestion.md) | Gemini drag/drop remediation playbook. | Good / keep. |
| [codex-playbooks/firefox-addon-submission.md](codex-playbooks/firefox-addon-submission.md) | Firefox Add-ons submission remediation playbook. | Good / keep. |
| [.github/copilot-instructions.md](../.github/copilot-instructions.md) | Short GitHub Copilot review focus. | Good / keep. |
| [.agents/skills/leakguard-playbook-promoter/SKILL.md](../.agents/skills/leakguard-playbook-promoter/SKILL.md) | Local skill for promoting solved issues into playbooks. | Good / keep. |

## Documentation Quality Status

### Good / keep

- `docs/README.md`
- `docs/NON_GOALS.md`
- `docs/REPO_MAP.md`
- `docs/BUG_PLAYBOOK.md`
- `docs/BUILD_TARGETS.md`
- `docs/RELEASE_QA_CHECKLIST.md`
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
- `docs/PRIVACY_POLICY.md` - needs support/privacy contact replacement and human/legal review.
- `docs/CHROME_WEB_STORE_LISTING.md` - needs final store/product review and final screenshots.
- `docs/ENTERPRISE_DEPLOYMENT.md` - needs admin review against current browser policy docs before publication.
- `BROWSER_COMPAT.md` - should be refreshed after each browser-specific release hardening pass.
- `CONTRIBUTING.md` - needs a fuller pass for current module names, modern setup details, and links to the new docs index.
- `docs/AI_ASSIST.md` and `ai/README.md` - keep in sync when AI pipeline scripts, counts, or thresholds change.
- `docs/FILE_SCANNER_PLAN.md` - split current user behavior from historical design plan when a dedicated file-scanner user guide is created.
- `docs/deep-research-report.md` - refresh or archive citation-heavy/date-sensitive findings after the next major architecture review.

### Duplicated / consolidate later

- `docs/CODEX_PROMPT_TEMPLATES.md`, `docs/Prompt_Templates.md`, and `docs/Cost-aware-coding-instructions.md` overlap around cost-aware Codex usage.
- README, privacy policy, Chrome listing, and release checklist all repeat local-only/file-handling claims. They serve different audiences, so they should remain separate but must be checked together before release.
- File Scanner behavior appears in README, privacy policy, Chrome listing, release QA, `FILE_SCANNER_PLAN.md`, and `file-handoff-architecture.md`. Keep audience-specific docs, but create a shorter canonical user guide later.

### Missing / should be created

- Dedicated install guide for Chrome and Firefox users.
- Protected-sites behavior guide.
- Placeholder, secure reveal, and placeholder reuse guide.
- File upload/scanning user guide that distinguishes scanner page, composer paste/drop/select flows, unsupported files, and size limits.
- Chrome vs Firefox release notes and compatibility matrix.
- Managed policy schema guide that maps `config/managed_policy_schema.json` to admin-facing examples.
- Full enterprise deployment guide with tested Chrome/Edge/Firefox policy examples.
- Release versioning policy.
- Firefox AMO listing/submission checklist, separate from the internal playbook.
- Screenshot/store assets checklist.
- Troubleshooting guide for common popup, protected-site, upload, and reveal issues.
- Documentation lint/link checker if the repo keeps growing docs.

### Deprecated / candidate for archive

- `docs/Prompt_Templates.md` - legacy duplicate now redirects to `docs/CODEX_PROMPT_TEMPLATES.md`.
- Historical planning sections inside `docs/FILE_SCANNER_PLAN.md` - keep for now, but split or archive once a stable file-scanner user guide exists.
- Date-sensitive findings in `docs/deep-research-report.md` - keep as internal evidence until a refreshed architecture/threat-model document replaces it.

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

## Remaining Documentation Roadmap

### Phase 1 - Foundation cleanup

- Fix broken links.
- Create/refresh docs index.
- Align README with current features.
- Remove obvious duplication.
- Decide whether `docs/INDEX.md` is also needed, or whether `docs/README.md` is sufficient.
- Add a lightweight markdown link checker if this repo keeps accumulating docs.

### Phase 2 - Product/user documentation

- Create a clear install guide.
- Explain protected-sites behavior, built-in sites, and user-managed exact-origin rules.
- Explain placeholder/reveal behavior, including session scope and unknown-placeholder handling.
- Explain file upload scanning behavior, including scanner page vs composer paste/drop/select flows.
- Add Chrome vs Firefox user notes for loading, permissions, and known limitations.

### Phase 3 - Enterprise/admin documentation

- Create a managed policy schema guide.
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
- Create a Firefox AMO checklist.
- Define versioning policy.
- Maintain release QA checklist.
- Create screenshots/store assets checklist.
- Keep privacy/store wording aligned and conservative across README, privacy policy, Chrome listing, AMO listing, and release QA.

### Phase 6 - Long-term documentation hardening

- Create a formal threat model.
- Add architecture diagrams for redaction, placeholder state, secure reveal, and file handoff.
- Maintain known limitations in one canonical place and cross-link from public docs.
- Create a compatibility matrix for browser/version/site/file-flow support.
- Create a troubleshooting guide.
- Add documentation lint/link checker if not already present.

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
