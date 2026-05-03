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
### 2026-05-03 - Deep research report alignment
- Goal: Remove stale README AI-assist drift notes from the research report and align it with the new public non-goals documentation.
- Files: `docs/deep-research-report.md`, `docs/CODEX_CHANGELOG.md`
- Tests: docs validation unavailable -> no docs-only validation script exists in `package.json`
- Notes: Docs-only follow-up; no source, tests, generated outputs, model artifacts, or package lock changes.

### 2026-05-03 - Public docs non-goals cleanup
- Goal: Align README AI-assist wording with the candidate-gated local architecture and add a public non-goals page.
- Files: `README.md`, `docs/NON_GOALS.md`, `docs/CODEX_CHANGELOG.md`
- Tests: docs validation unavailable -> no docs-only validation script exists in `package.json`
- Notes: Docs-only change; no source, tests, generated outputs, model artifacts, or package lock changes.

### 2026-05-03 - Deep research report refresh
- Goal: Replace the deep research report with a repo- and GitHub-history-verified status update for v1.3.0 redaction hardening, local AI assist, file scanner, build targets, and remaining gaps.
- Files: `docs/deep-research-report.md`, `docs/CODEX_CHANGELOG.md`
- Tests: docs validation unavailable -> no docs-only validation script exists in `package.json`
- Notes: Docs-only change; records README AI-assist wording drift and avoids enterprise-grade or remote-scanning claims.

### 2026-05-02 - Bounded placeholder rehydration
- Goal: Avoid TreeWalker rescans for large added DOM subtrees that contain no placeholders, while preserving secure reveal hydration boundaries.
- Files: `src/content/content.js`, `tests/security.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/security.test.js` -> pass; `npm test` -> pass
- Notes: Narrow content-script performance guard; no privacy model, reveal, or placeholder trust changes.

### 2026-05-02 - Dynamic protected-site AI assist alignment
- Goal: Keep dynamic user-added protected-site injection aligned with manifest content scripts so optional local AI assist is available wherever protection is injected.
- Files: `src/background/core.js`, `tests/protected_sites.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/protected_sites.test.js` -> pass; `node tests/build_targets.test.js` -> pass; `npm test` -> pass
- Notes: Preserves local-only AI assist; no remote calls, telemetry, model changes, or generated outputs.

### 2026-05-02 - Natural-language real-value detection audit fix
- Goal: Catch "real/actual <secret type> value ..." disclosures without broadening source code rewrites or weakening false-positive controls.
- Files: `src/shared/detector.js`, `tests/natural_language_context.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/natural_language_context.test.js` -> pass; `npm test` -> pass
- Notes: Synthetic-only regression cases; preserves deterministic-first detection and local-only processing.

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
