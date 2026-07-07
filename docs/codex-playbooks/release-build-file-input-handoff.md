# Playbook: Release Build File Input Handoff

## Problem fingerprint
Use this when a scheduled or release browser gate fails on protected-site file input handoff after a release/consumer build.

Common signals:
- `npm run test:browser-gates` or Browser Nightly fails.
- Failure code mentions `FILE_INPUT_REDACTION_FAILED`.
- Stage is Chrome local protected QA page, file input, sanitized handoff.
- The failure report shows a raw file input event or upload state instead of a sanitized handoff.
- Unit tests may pass, but built `dist/chrome/content/content.js` has a release-only runtime error.

## Expected behavior
Protected-site file input events must be owned before page listeners can observe raw files. LeakGuard should suppress or consume raw file input events, create a sanitized file/blob, and hand off only the sanitized file. Unsupported or unsafe protected file paths must fail closed.

## Likely root cause
Check release-build stripping and runtime dependencies first. A release build can remove debug helper functions while leaving a shorthand dependency or call-site reference behind, causing a `ReferenceError` only in the built extension. That can abort local file insert before sanitization.

Also check duplicate `input`/`change` sequencing. Chrome may emit a raw `input` event before `change`; the raw `input` should stop propagation without starting async file processing, and `change` should perform the sanitized handoff.

## Safe implementation direction
- Fix the release stripper to remove both debug functions and dependency references.
- Add a build-target regression that scans release `content/content.js` for stripped debug references.
- Keep event propagation ownership close to `src/content/files/fileInputChangeOrchestration.js`.
- Do not weaken fail-closed file policy, protected-site matching, debug safety, or browser MV3 compatibility.

## Files likely involved
- `scripts/build-extension.mjs`
- `src/content/content.js`
- `src/content/files/fileInputChangeOrchestration.js`
- `tests/build_targets.test.js`
- `tests/content_file_drop_interception.test.js`
- `tests/file_input_change_orchestration.test.js`
- `tests/browser/extension_qa_harness.test.mjs`

## Verification
Run the original failing gate first, then the closest static guards:

```bash
npm run test:browser-gates
node tests/build_targets.test.js
node tests/content_file_drop_interception.test.js
node tests/file_input_change_orchestration.test.js
node tests/browser_qa_assertions.test.js
node tests/security.test.js
git diff --check
```

For broader release confidence:

```bash
npm run test:nightly
npm run qa:browser:full
```

## Regression tests
- Release artifacts must not retain stripped debug logger references.
- Raw Chrome `input` events for protected file inputs should stop propagation and avoid async reads.
- The following `change` event should perform exactly one sanitized read/redaction/handoff.

## Rollback
Revert the commit that changed release stripping or file-input event ownership, then rerun `npm run test:browser-gates`. Do not ship a rollback that restores raw fallback upload after LeakGuard has consumed a protected file.

## Notes
Safe failure output should include the failure code, browser, stage, and canary IDs only. Do not paste raw file contents, raw prompts, raw paths, or full browser reports into chat or docs.
