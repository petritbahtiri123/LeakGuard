# Debug Safety Playbook

Use when adding diagnostics, troubleshooting logs, browser QA reports, audit fields, debug snapshots, or failure metadata.

## Safe Output Contract
Never log or report:

- raw prompt text
- raw secrets
- raw file contents
- raw file names or paths
- full URLs when credentials or private path segments may exist
- full class names, DOM IDs, aria labels, or titles
- raw error messages or stacks that may contain text, paths, URLs, or secrets

Allowed fields:
- lengths
- counts
- booleans
- stage labels
- reason codes
- placeholder counts
- safe adapter IDs
- coarse file extension/MIME category
- byte sizes
- line counts
- sanitized error names and message lengths

## Module Owners
- `src/content/diagnostics/contentDebugFacade.js`: content debug API.
- `src/content/diagnostics/debugLogger.js`: generic debug sanitizer.
- `src/content/diagnostics/fileDebugMetadata.js`: file handoff metadata sanitizer.
- `src/content/diagnostics/safeSnapshots.js`: safe snapshot/download-name helpers; do not use raw values for debug output.
- `src/background/auditLog.js`: metadata-only background audit summaries.

## Workflow
1. Add or update focused tests before adding diagnostics.
2. Route through `ContentDebugFacade`, `DebugLogger`, `FileDebugMetadata`, or an equivalent sanitizer.
3. Use `pwm:debug=1` only with synthetic values.
4. Confirm logs contain metadata only.
5. Confirm release/security tests still block raw debug output.

## Validation

```bash
node tests/debug_logger.test.js
node tests/file_debug_metadata.test.js
node tests/security.test.js
node tests/build_targets.test.js
```

For content-file diagnostics also run:

```bash
node tests/content_file_drop_interception.test.js
```
