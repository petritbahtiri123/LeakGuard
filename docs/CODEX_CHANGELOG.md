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
### 2026-05-05 - High-contrast placeholder chips
- Goal: Make hydrated LeakGuard placeholders visible on light and dark AI chat themes, with rotating accent colors instead of a single blue treatment.
- Files: `src/content/content.js`, `src/content/overlay.css`, `tests/productization.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/productization.test.js` -> pass; `node tests/security.test.js` -> pass; `npm test` -> pass; `npm run build:chrome` -> pass
- Notes: Page placeholders still render only the placeholder token and a generic aria label; no raw secret data is added to styling attributes.

### 2026-05-05 - Prose-label short project-key redaction
- Goal: Fix `05-partial-and-half-keys` so prose labels ending with `:` do not swallow following `another_key=sk-proj-*` assignments, while labelled half-looking `sk-proj-*` key values still redact.
- Files: `src/shared/detector.js`, `tests/detector.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/detector.test.js` -> pass; `node tests/streaming_file_redactor.test.js` -> pass; `node tests/content_file_drop_interception.test.js` -> pass; `node tests/break_pack.test.js` -> pass; `node tests/synthetic_pack.test.js` -> pass; `node tests/adversarial_redaction.test.js` -> pass; `npm test` -> pass; `npm run build:chrome` -> pass
- Notes: Assignment regexes no longer cross line breaks around separators; a narrow labelled provider-key scanner covers `key:` labels followed by supported `sk-*` values on the next line.

### 2026-05-05 - Exact short project-key upload regression
- Goal: Cover 5 MB upload streaming redaction for short assignment-scoped `sk-proj-*` values such as `another_key=sk-proj-BBB222`.
- Files: `tests/content_file_drop_interception.test.js`, `tests/streaming_file_redactor.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/content_file_drop_interception.test.js` -> pass; `node tests/streaming_file_redactor.test.js` -> pass; `node tests/detector.test.js` -> pass; `npm run build:chrome` -> pass; `npm test` -> pass
- Notes: Source redaction already detected the short key; rebuilt `dist/chrome` so the unpacked browser extension uses the current path.

### 2026-05-05 - Gemini file-input raw-change interception
- Goal: Stop Gemini upload-button file input `change` events before native handlers can read raw files, then redispatch one sanitized `change`.
- Files: `src/content/content.js`, `tests/content_file_drop_interception.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/content_file_drop_interception.test.js` -> pass; `node tests/detector.test.js` -> pass; `node tests/break_pack.test.js` -> pass; `node tests/placeholder_trust.test.js` -> pass; `node tests/streaming_file_redactor.test.js` -> pass; `npm test` -> pass
- Notes: Scoped to Gemini file-input uploads; existing drag/drop and paste paths stay covered by focused regressions.

### 2026-05-05 - Friendly invalid UTF-8 streaming file block
- Goal: Replace raw `TextDecoder` errors for invalid large text-file uploads with a clear fail-closed UTF-8 message.
- Files: `src/shared/streamingFileRedactor.js`, `tests/streaming_file_redactor.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/streaming_file_redactor.test.js` -> pass; `node tests/content_file_drop_interception.test.js` -> pass; `npm test` -> pass
- Notes: Raw uploads still fail closed when large-file streaming cannot safely decode the file as UTF-8.

### 2026-05-05 - Gemini upload-button large file handoff
- Goal: Allow Gemini file-select uploads from hidden/detached file inputs to be locally redacted and handed off as sanitized files without composer text insertion.
- Files: `src/content/content.js`, `tests/content_file_drop_interception.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/content_file_drop_interception.test.js` -> pass; `node tests/file_paste_helpers.test.js` -> pass; `node tests/file_scanner.test.js` -> pass; `node tests/streaming_file_redactor.test.js` -> pass; `node tests/protected_sites.test.js` -> pass; `npm test` -> pass
- Notes: Scoped to the upload button/file-input path; drag/drop behavior remains unchanged.

### 2026-05-05 - ONNX runtime package size reduction
- Goal: Debloat extension builds by packaging only LeakGuard's CPU WASM ONNX Runtime sidecar files.
- Files: `scripts/build-extension.mjs`, `src/shared/ai/classifier.js`, `tests/ai_assist.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/ai_assist.test.js` -> pass; `node tests/build_targets.test.js` -> pass; `npm run build:chrome` -> pass; `git diff --check` -> pass with existing LF-to-CRLF normalization warnings
- Notes: Classifier sessions now request the `wasm` execution provider explicitly; browser AI Assist smoke test still needed after loading the rebuilt extension.

### 2026-05-05 - v1.5.0 version bump
- Goal: Bump LeakGuard release/version metadata to `1.5.0`.
- Files: `package.json`, `package-lock.json`, `manifests/base.json`, `README.md`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/build_targets.test.js` -> pass; `git diff --check` -> pass with existing LF-to-CRLF normalization warnings
- Notes: Generated `dist/` output remains excluded.

### 2026-05-05 - Streaming large-file release docs
- Goal: Align release, store, privacy, and research docs with streaming local redaction for supported text-file composer uploads up to 50 MB.
- Files: `README.md`, `docs/RELEASE_QA_CHECKLIST.md`, `docs/CHROME_WEB_STORE_LISTING.md`, `docs/PRIVACY_POLICY.md`, `docs/deep-research-report.md`, `src/scanner/scanner.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `git diff --check` -> pass
- Notes: Docs preserve local-only wording, fail-closed raw-upload blocking, unsupported PDF/DOCX/image boundaries, and Gemini/ChatGPT large-file caveats.

### 2026-05-03 - Short provider key assignment redaction
- Goal: Redact generic `*_key` assignments when their value uses a provider key prefix such as `sk-proj-`, including shorter project-key fixtures.
- Files: `src/shared/detector.js`, `tests/detector.test.js`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/detector.test.js` -> pass
- Notes: Kept the rule assignment-scoped so standalone short `sk-proj-*` text does not become a broad global pattern match.

### 2026-05-03 - Large-input redaction optimization
- Goal: Reduce CPU-bound redaction time for duplicate-heavy large inputs without changing placeholder or detection behavior.
- Files: `src/shared/detector.js`, `src/shared/transformOutboundPrompt.js`, `tests/performance/redaction-benchmark.mjs`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/break_pack.test.js` -> pass; `node tests/synthetic_pack.test.js` -> pass; `node tests/adversarial_redaction.test.js` -> pass; `node tests/performance/redaction-benchmark.mjs` -> pass; `npm run bench:redaction:profile` -> pass; `npm test` -> pass
- Notes: Added per-scan context-score caching, repeated-line detector caching for large duplicate-heavy inputs, and single-pass non-overlapping replacement application. Benchmark asserts large fast-path output matches the uncached baseline.

### 2026-05-03 - Redaction benchmark resource profiling
- Goal: Add CPU, heap, wall-time, percentile, and optional per-stage profiling to the redaction benchmark without changing runtime redaction behavior.
- Files: `tests/performance/redaction-benchmark.mjs`, `package.json`, `CONTRIBUTING.md`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/performance/redaction-benchmark.mjs` -> pass; `npm run bench:redaction:profile` -> pass; `npm test` -> pass
- Notes: Default benchmark remains conservative for `npm test`; profile mode reports manager setup, detector construction, scan, and transform stage timings for bottleneck triage.

### 2026-05-03 - Redaction performance benchmark
- Goal: Replace the placeholder performance script with a real Detector + transform benchmark and include it in the default test runner.
- Files: `tests/performance/redaction-benchmark.mjs`, `scripts/run-tests.mjs`, `CONTRIBUTING.md`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/performance/redaction-benchmark.mjs` -> pass; `npm test` -> pass
- Notes: Benchmark includes correctness checks and conservative p95/ms-per-KiB guardrails to catch major slowdowns without turning normal machine variance into release blockers.

### 2026-05-03 - Sanitized file handoff docs
- Goal: Replace stale v1.4.0 file paste/drop wording about dumping file contents into composers with sanitized in-memory file handoff and fail-closed raw-upload blocking language.
- Files: `README.md`, `docs/CHROME_WEB_STORE_LISTING.md`, `docs/RELEASE_QA_CHECKLIST.md`, `docs/deep-research-report.md`, `docs/CODEX_CHANGELOG.md`
- Tests: `npm test` -> pass
- Notes: Docs now call out browser/site limitations for synthetic `DataTransfer`/file handoff and preserve local-only, no-backend, no-telemetry wording.

### 2026-05-03 - v1.4.0 release prep
- Goal: Bump release metadata and align public release docs for automatic local text-file paste/drop redaction in protected AI composers.
- Files: `package.json`, `manifests/base.json`, `README.md`, `docs/CHROME_WEB_STORE_LISTING.md`, `docs/RELEASE_QA_CHECKLIST.md`, `docs/deep-research-report.md`, `docs/CODEX_CHANGELOG.md`
- Tests: `node tests/file_paste_helpers.test.js` -> pass; `node tests/file_scanner.test.js` -> pass; `node tests/protected_sites.test.js` -> pass; `node tests/build_targets.test.js` -> pass; `node tests/security.test.js` -> pass; `node tests/typed_interception.test.js` -> pass; `node tests/composer_helpers.test.js` -> pass; `npm test` -> pass; `npm run build:chrome` -> pass; `npm run build:firefox` -> pass; `npm run build:chrome-enterprise` -> pass; `npm run build:firefox-enterprise` -> pass
- Notes: Release-prep wording keeps local-only deterministic redaction, fail-closed raw-upload blocking, supported UTF-8 text-file scope, file paste/drop helper tests, build target/content script alignment, and security checks for no raw file upload, logging, or persistence.

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
