# Playbook: Gemini drag/drop file ingestion

## Problem fingerprint
Drag/drop text-file ingestion on Gemini fails, drops text in the wrong place, duplicates content, reprocesses the same file repeatedly, or freezes the editor. The UI often uses contenteditable or Quill-like editor behavior, so normal textarea assumptions may be wrong.

## Expected behavior
Dropped supported text files are locally scanned/redacted, then inserted once into the active Gemini editor without leaking raw secrets, blocking the UI, or taking control away from the user.

## Likely root cause
Drop handling is doing too much synchronously, missing `preventDefault` on `dragover` or `drop`, reinjecting the entire editor contents, or dispatching editor events in an order Gemini ignores. Large files can also block parsing or trigger repeated mutation/input loops.

## Safe implementation direction
Separate synchronous event control from slower parsing:

- call `preventDefault` on `dragover` and `drop` where needed so the page does not ingest raw files first
- capture files and active editor context synchronously
- parse and redact asynchronously
- cap supported payload size and give the user control for oversized input
- chunk large text before insertion if the editor handles smaller deltas better
- avoid repeated full reinjection loops; insert only the processed dropped content
- dispatch the minimum input/composition events required by the editor
- preserve cursor/focus where practical
- benchmark large files with safe fake content

Do not add remote parsing, backend calls, telemetry, or cloud verification. Keep raw file contents out of logs, storage, and run metadata.

## Files likely involved
- `src/content/content.js`
- `src/content/file_paste_helpers.js`
- `src/content/composer_helpers.js`
- `src/shared/fileScanner.js`
- `src/shared/streamingFileRedactor.js`
- file scanner, streaming redactor, and composer tests

## Verification
- Drag/drop on Gemini inserts redacted file text once.
- Raw fake secrets never appear in the final editor content.
- Unsupported or oversized files do not freeze the page and do not inject partial unsafe text.
- Repeated drops do not duplicate prior full editor content.
- Manual typing after a drop still works.
- Large safe files complete within an acceptable benchmark budget.

## Regression tests
Use focused DOM/editor tests for contenteditable or Quill-like insertion if the repo has helpers for that. Add scanner tests for caps/chunking if parser behavior changes. Keep sample files small and synthetic.

## Rollback
Remove the Gemini-specific drop path or feature flag it off, then restore previous generic paste/drop handling. Revert tests added only for the new path.

## Notes
Gemini behavior can change. Verify current DOM evidence before adding selectors. Prefer capability checks and existing composer helpers over brittle page-specific rewrites.
