# LeakGuard Phase 8 Stabilization And Cleanup Plan

Date: 2026-06-07

Phase 8 starts after the PR 1 through PR 7B modularization checkpoint in
`docs/leakguard-human-review-and-modularization-plan.md`. This phase is a
validation and cleanup-planning phase, not a blind extraction phase.

## Status Check

The current repo matches the planned completion checkpoint:

- Site adapter extraction exists under `src/content/adapters/`.
- File attach pipeline helpers exist under `src/content/files/`.
- Response rehydration helpers exist under `src/content/rehydration/`.
- Raw-safe diagnostic helpers exist under `src/content/diagnostics/`.
- Focused file/drop regression coverage remains concentrated in
  `tests/content_file_drop_interception.test.js`.

The risky integration points intentionally remain in `src/content/content.js`,
including Gemini editor insertion/fallback helpers, provider-specific pending
attach state, and `maybeHandleLocalFileInsert()` orchestration.

## Phase 8 Review Tracks

1. Source-extraction-heavy test cleanup opportunities
   - Inventory source-extraction assertions in `tests/content_file_drop_interception.test.js`.
   - Classify each assertion as behavior coverage, source-shape coverage, or deletion-safety evidence.
   - Prefer documenting replacement coverage before changing the harness.

2. Gemini editor-drop helper cluster review
   - Confirm the removed legacy editor-drop path remains unused in production drop listeners.
   - Keep the generic adapter-based file handoff path and Gemini pending trusted attach path intact.
   - Do not delete or move Gemini insertion helpers without browser evidence.

3. `insertGeminiLocalFileText()` cleanup review
   - Treat this as side-effectful Gemini fallback code.
   - Add or preserve focused tests for cancellation, editor resolution, raw-content rejection, and multiline fallback before any code motion.

4. Provider-specific pending attach consolidation review
   - Keep Gemini and Grok predicates, click safety, and discovery behavior distinct until table-driven lifecycle tests prove shared behavior.
   - Do not enable pending attach for ChatGPT, Claude, OpenAI Chat, X, or generic adapters.

5. Detector/classifier warning policy review
   - Catalog warning surfaces and raw-safe payload requirements before touching implementation.
   - Do not change detector overlap, suppression, scoring, or classifier fallback behavior in this phase.

## Recommended PR Order

1. PR 8A: Source-extraction test cleanup inventory.
   Documentation plus optional focused meta-tests only. No runtime changes.

2. PR 8B: Gemini editor/drop safety documentation and focused coverage gaps.
   Add tests only where current behavior lacks direct coverage.

3. PR 8C: `insertGeminiLocalFileText()` cleanup review.
   Routing proof and cleanup recommendation only; defer deletion.

4. PR 8D: Pending attach lifecycle consolidation review.
   Add table-driven tests for lifecycle equivalence before any shared helper changes.

5. PR 8E: Detector/classifier warning policy catalog.
   Document raw-safe warning requirements before implementation changes.

## Safest First PR

PR 8A is the safest first Phase 8 PR. It should not touch runtime behavior.
The goal is to make the source-extraction-heavy coverage easier to audit by
documenting what each extracted-source assertion protects and which assertions
could later be replaced by runtime harness tests.

Suggested PR 8A scope:

- Add an inventory note for `tests/content_file_drop_interception.test.js`.
- Identify high-value source-shape assertions that must stay for now.
- Identify candidates for future runtime harness replacement.
- Run the full validation commands before merging.

PR 8A inventory artifact:

- `docs/phase-8-source-extraction-test-inventory.md`

PR 8B review artifact:

- `docs/phase-8-gemini-editor-drop-safety-review.md`

PR 8C routing proof:

- `insertGeminiLocalFileText()` is currently test-only/source-shape guarded,
  not production-routed.
- The production Gemini fallback path uses `insertGeminiSanitizedText()` and
  `applyGeminiSanitizedTextFallback()`.
- Deletion remains deferred until the source-extraction harness dependency and
  ESLint harness allowlist entry are safely removed or replaced.

Out of scope for PR 8A:

- Runtime edits.
- Detector/classifier rule changes.
- Background placeholder, session, or reveal state changes.
- Gemini/Firefox upload bridge behavior changes.
- Deleting source-extraction assertions without replacement coverage.
