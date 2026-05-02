# Codex Changelog

Use this file as a short handoff log for AI-made changes. Add newest entries first.

## Template
```md
### YYYY-MM-DD - <short title>
- Goal: <what changed>
- Files: `<file>`, `<file>`
- Tests: `<command>` -> <pass/fail/not run>
- Notes: <risks, follow-ups, or compatibility constraints>
```

## Entries
### 2026-05-02 - Deep research report cleanup
- Goal: Replace internal citation artifacts with concise repo-grounded Markdown and add an implementation handoff for future detection work.
- Files: `docs/deep-research-report.md`, `docs/CODEX_CHANGELOG.md`
- Tests: docs validation unavailable -> no docs-only validation script exists in `package.json`
- Notes: Docs-only change; preserves local-only privacy constraints and avoids new feature or enterprise-grade claims.

### 2026-05-02 - Codex agent guidance refresh
- Goal: Make repo rules, paths, commands, prompt templates, and final output expectations self-contained for future Codex tasks.
- Files: `AGENTS.md`, `docs/REPO_MAP.md`, `docs/CODEX_PROMPT_TEMPLATES.md`, `docs/BUG_PLAYBOOK.md`, `docs/CODEX_CHANGELOG.md`
- Tests: not run -> docs-only change
- Notes: Preserves local-only, minimal-diff, regression-test, placeholder reuse, Chrome/Firefox, and no-inline-JS guidance.

### 2026-05-01 - v1.3.0 redaction hardening
- Goal: Harden placeholder trust, sensitive HTTP header redaction, URL credential parsing, labelled secret ranges, and known-secret placeholder reuse.
- Files: `src/shared/detector.js`, `src/shared/redactor.js`, `src/shared/transformOutboundPrompt.js`, `src/shared/placeholders.js`, `src/content/content.js`, `tests/break_pack.test.js`, `tests/detector.test.js`, `tests/placeholder_trust.test.js`, `tests/natural_language_context.test.js`, `tests/typed_interception.test.js`
- Tests: `npm test` -> pass
- Notes: Release version bumped to `1.3.0`; generated `dist/` output remains excluded.

<!-- Add entries here. -->
