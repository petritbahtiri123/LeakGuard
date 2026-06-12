# Phase 15E DOCX Rebuilt-Output Closeout

Phase 15D completed protected-site DOCX `.redacted.docx` handoff. This closeout supersedes the Phase 15C planning-only assertions for DOCX output support.

Phase 16E supersedes this document's XLSX limitation note: regenerated XLSX output is now tracked separately in `docs/phase-16e-xlsx-rebuilt-output-closeout.md`.

## Current DOCX Boundary

- scanner DOCX `.redacted.docx` export is supported for safe `.docx` files.
- protected-site DOCX `.redacted.docx` handoff is supported for safe, complete `.docx` files.
- Scanner and protected-site DOCX outputs are generated from sanitized/redacted extracted text only.
- Generated DOCX output is not layout-preserving.
- Original DOCX XML parts are not copied.
- Original styles, images, comments, and metadata are not preserved.
- embedded images are not redacted.
- .doc, .docm, and macros remain unsupported.
- Malformed, encrypted, no-text/image-only, unsupported-compression, legacy, macro, and truncated DOCX cases do not hand off unsafe `.redacted.docx` output.
- `.redacted.txt fallback` remains available for sanitized text output where regeneration is unsafe or incomplete.
- XLSX rebuilt-output status is superseded by Phase 16E.

## Release Audit Expectations

- No raw DOCX extracted text in logs, debug snapshots, audit records, storage, cache snapshots, reports, or release metadata.
- JSON reports remain sanitized/redacted only.
- Release packages must not include raw DOCX fixture secrets, sourcemaps, debug leftovers, or original OOXML test markers in generated output.
- Gemini/Grok pending attach gates, adapter contracts, Firefox bridge behavior, pending attach lifecycle, detector rules, extension permissions, and remote-call boundaries remain unchanged.
