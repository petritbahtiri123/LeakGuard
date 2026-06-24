---
name: lean-extension-engineer
description: Use when working on LeakGuard or browser-extension code where the goal is to make minimal, safe, non-bloated changes without weakening redaction, policy, adapter, or extension security behavior.
---

# Lean Extension Engineer

## Prime directive

The best code is code that does not need to exist.

Solve the requested task with the smallest safe patch. Do not redesign, rewrite, generalize, or future-proof unless explicitly asked.

## Six-rung decision ladder

Before writing code, climb this ladder:

1. YAGNI
   Does this feature, helper, abstraction, config flag, or behavior need to exist right now to satisfy the requested task?
   If no, do not implement it.

2. Platform native
   Can the browser, WebExtension API, DOM, HTML, CSS, File API, Clipboard API, or storage API already do this safely?

3. Standard library
   Can JavaScript built-ins or existing platform APIs solve this without a new helper or dependency?

4. Existing LeakGuard code
   Is there already a detector, sanitizer, adapter helper, policy helper, file helper, UI helper, or test helper that does this?

5. Concise existing-module patch
   Can the task be solved with a small readable edit in the module that already owns the behavior?

6. Minimum viable new code
   Only if the first five rungs are exhausted, write new code. Keep it as small, explicit, and boring as possible.

## Anti-bloat rules

- Do not add new dependencies unless explicitly approved.
- Do not add new abstraction layers unless they remove real duplication now.
- Do not add registries, factories, frameworks, plugin systems, event buses, or generic engines for hypothetical future use.
- Do not add configuration flags unless behavior truly must be user/admin configurable.
- Do not add logging wrappers, telemetry, analytics, or network calls unless explicitly requested and approved.
- Do not perform broad refactors mixed with feature work or bugfixes.
- Do not rename stable public functions, storage keys, policy fields, message shapes, adapter contracts, or filenames unless explicitly required.
- Do not do "while I am here" cleanup.
- Prefer deleting dead code over adding new code.
- Prefer boring explicit conditionals over clever generic abstractions.

## LeakGuard security rules

- Never weaken redaction.
- Never widen allowlists silently.
- Never send raw secrets to logs, telemetry, URLs, DOM attributes, debug output, filenames, generated reports, exception messages, or test snapshots.
- Preserve fail-closed behavior for malformed, unsupported, oversized, encrypted, unreadable, or partially processed files.
- Preserve enterprise-managed-policy behavior.
- Preserve consumer vs enterprise defaults.
- Preserve adapter contracts and payload shapes.
- Preserve raw-secret leak tests.
- Do not change manifest permissions, host permissions, content security policy, externally_connectable, remote-code behavior, telemetry, or network behavior unless explicitly required and approved.
- Treat ChatGPT, Gemini, Claude, Grok, X, and OpenAI adapters as separate browser surfaces unless tests prove shared behavior is safe.

## Debloat rules

When asked to reduce code size:
- Measure before deleting.
- Count git-tracked lines only.
- Separate runtime source, tests, fixtures, docs, scripts, generated artifacts, model/data files, and release artifacts.
- Remove accidental generated/release artifacts before touching runtime code.
- Remove dead code only when references and tests support removal.
- Consolidate duplication only when it reduces real current duplication.
- Do not remove tests only because they are large.
- Do not reduce security coverage just to reduce line count.

## Testing rules

- Add tests for behavior, not implementation details.
- Prefer updating existing focused tests over creating large new test suites.
- Run the smallest relevant test set first.
- Run broader validation only when touched areas require it.
- If tests are skipped, state exactly why.

## Final response checklist

Before final response, confirm:
- The patch solves only the requested task.
- No new dependency was added.
- No unrelated refactor was done.
- No manifest, permission, CSP, telemetry, or network behavior changed unless requested.
- Redaction, policy, adapter, and fail-closed behavior were preserved.
- Tests/validation run are listed.
- Remaining risks or unknowns are stated plainly.

Validation:
- Run docs/static checks only if available and appropriate.
- Do not run unrelated heavy tests unless the repo requires it.

Final response:
Report:
- Files created/updated
- Summary of skill/rules added
- Validation run
- Confirmation that no runtime behavior changed
