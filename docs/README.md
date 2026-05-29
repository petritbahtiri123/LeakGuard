# LeakGuard Documentation Index

Use this index as the entry point for repository documentation. The root [README](../README.md) stays product-focused; this page routes to detailed user, developer, enterprise, security, QA, and release docs.

For the full documentation inventory, quality status, and cleanup backlog, see [DOCUMENTATION_ROADMAP.md](DOCUMENTATION_ROADMAP.md).

## Product Overview

- [Root README](../README.md) - high-level product overview, current release snapshot, supported sites, build/load basics, and links into detailed docs.
- [NON_GOALS.md](NON_GOALS.md) - maintained list of what LeakGuard does not try to provide.
- [DETECTION_ENHANCEMENTS.md](DETECTION_ENHANCEMENTS.md) - current deterministic redaction hardening notes for placeholders, prose disclosures, sensitive headers, and known-secret reuse.

## Installation And Usage

- [INSTALL_GUIDE.md](INSTALL_GUIDE.md) - local build and load steps for Chrome, Edge-compatible Chromium, and Firefox.
- [Root README - Build And Load](../README.md#build-and-load) - quickest local build and browser loading path.
- [Root README - Extension UI](../README.md#extension-ui) - popup, protected-sites management, File Scanner, and secure reveal overview.
- [Root README - Local File Scanner](../README.md#local-file-scanner) - supported text-file scanning and protected composer file handling at a user-facing level.
- [PROTECTED_SITES_GUIDE.md](PROTECTED_SITES_GUIDE.md) - built-in sites, user-managed exact-origin rules, and permission behavior.
- [PLACEHOLDERS_AND_REVEAL.md](PLACEHOLDERS_AND_REVEAL.md) - placeholder stability, session scope, trusted placeholder pass-through, and popup-only secure reveal.
- [FILE_UPLOAD_SCANNING_GUIDE.md](FILE_UPLOAD_SCANNING_GUIDE.md) - File Scanner and protected composer file upload behavior, supported text files, limits, and unsupported formats.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - common popup, protected-site, reveal, upload, Firefox, and enterprise-policy issues.

## Privacy And Security Model

- [PRIVACY_POLICY.md](PRIVACY_POLICY.md) - user-facing privacy policy draft with local-only processing, storage, secure reveal, and limitations.
- [SECURITY.md](../SECURITY.md) - vulnerability reporting policy.
- [SECURITY_REVIEW.md](../SECURITY_REVIEW.md) - technical security review and current residual risks.
- [NON_GOALS.md](NON_GOALS.md) - explicit boundaries against perfect privacy, full DLP, cloud scanning, and credential lifecycle claims.

## Enterprise Deployment

- [ENTERPRISE_DEPLOYMENT.md](ENTERPRISE_DEPLOYMENT.md) - Chrome and Edge managed deployment guidance, policy expectations, audit-mode notes, and limitations.
- [MANAGED_POLICY_SCHEMA.md](MANAGED_POLICY_SCHEMA.md) - admin-facing map of managed policy fields, defaults, examples, and validation commands.
- [BUILD_TARGETS.md](BUILD_TARGETS.md) - consumer and enterprise build targets, manifest overlays, and managed-policy loading model.

## Developer Setup

- [CONTRIBUTING.md](../CONTRIBUTING.md) - local setup, workflow, code style, testing, and contribution expectations.
- [REPO_MAP.md](REPO_MAP.md) - compact map of runtime modules, shared core, high-risk regression areas, and test ownership.
- [BUG_PLAYBOOK.md](BUG_PLAYBOOK.md) - focused bug routing and narrow validation commands.
- [AI_ASSIST.md](AI_ASSIST.md) - browser-facing local AI assist design, policy thresholds, smoke tests, and training flow.
- [ai/README.md](../ai/README.md) - local AI training, evaluation, and ONNX export workflow.

## Testing And QA

- [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md) - release-gating manual QA checklist.
- [qa/cross-site-manual-checklist.md](qa/cross-site-manual-checklist.md) - detailed Chrome/Firefox cross-site manual QA matrix.
- [tests/manual_detection_paste_block.txt](../tests/manual_detection_paste_block.txt) - synthetic paste block for manual redaction smoke testing.
- [code-quality-audit.md](code-quality-audit.md) - internal code quality findings and follow-up plan.
- `npm run docs:check-links` - local markdown link checker for repository docs.

## Release And Store Publishing

- [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md) - Chrome Web Store copy, permission justifications, screenshot plan, and reviewer notes.
- [FIREFOX_AMO_CHECKLIST.md](FIREFOX_AMO_CHECKLIST.md) - Firefox Add-ons listing and submission checklist.
- [STORE_ASSETS_CHECKLIST.md](STORE_ASSETS_CHECKLIST.md) - screenshot, copy, and submission asset checklist.
- [VERSIONING_POLICY.md](VERSIONING_POLICY.md) - version bump, release-note, QA, and artifact expectations.
- [PRIVACY_POLICY.md](PRIVACY_POLICY.md) - required review before store submission; replace contact placeholders before publishing.
- [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md) - packaging and submission safety checklist.
- [codex-playbooks/firefox-addon-submission.md](codex-playbooks/firefox-addon-submission.md) - operational playbook for Firefox Add-ons submission issues.

## Architecture And Internal Design

- [file-handoff-architecture.md](file-handoff-architecture.md) - sanitized text-file upload handoff architecture and adapter rules.
- [FILE_SCANNER_PLAN.md](FILE_SCANNER_PLAN.md) - file scanner architecture and implementation plan; useful for historical context and future scanner phases.
- [deep-research-report.md](deep-research-report.md) - internal repository review, roadmap, and risk notes.
- [BROWSER_COMPAT.md](../BROWSER_COMPAT.md) - Chrome/Firefox compatibility notes and fallback behavior.
- [BROWSER_COMPATIBILITY_MATRIX.md](BROWSER_COMPATIBILITY_MATRIX.md) - browser support matrix, target folders, and compatibility review checklist.

## Codex And Agent Workflow

- [CODEX_FAST_CONTEXT.md](CODEX_FAST_CONTEXT.md) - smallest context file for routine coding tasks.
- [CODEX_CONTEXT_ROUTER.md](CODEX_CONTEXT_ROUTER.md) - FAST/STANDARD/DEEP context routing.
- [CODEX_MEMORY.md](CODEX_MEMORY.md) - local playbook and memory workflow.
- [CODEX_PROMPT_TEMPLATES.md](CODEX_PROMPT_TEMPLATES.md) - canonical cost-aware Codex prompt templates.
- [CODEX_CHANGELOG.md](CODEX_CHANGELOG.md) - short AI-agent handoff log.
- [codex-playbooks/INDEX.md](codex-playbooks/INDEX.md) - reusable issue playbook router.

## Known Limitations And Future Work

- [NON_GOALS.md](NON_GOALS.md) - current non-goals and unsupported surfaces.
- [DOCUMENTATION_ROADMAP.md](DOCUMENTATION_ROADMAP.md) - documentation cleanup phases, missing docs, duplication to consolidate later, and review risks.
