# Phase 16E XLSX Rebuilt-Output Closeout

Phase 16D completed protected-site XLSX `.redacted.xlsx` handoff. This closeout supersedes the Phase 16C planning-only assertions for protected-site XLSX output support.

## Current XLSX Boundary

- scanner XLSX `.redacted.xlsx` export is supported for safe `.xlsx` files.
- protected-site XLSX `.redacted.xlsx` handoff is supported for safe, complete `.xlsx` files.
- `.redacted.txt fallback` remains available for sanitized text output where regeneration is unsafe or incomplete.
- Scanner and protected-site XLSX outputs are generated from sanitized/redacted extracted text only.
- Generated XLSX output is not layout-preserving.
- Original XLSX XML/OOXML parts are not copied.
- Formulas, charts, styles, comments, hidden sheets, metadata, custom XML, calc chains, and media are not preserved.
- XLSX formulas are scanned as text only and are not executed.
- .xls, .xlsm, .xlsb, .xltm, legacy spreadsheet formats, macro-enabled spreadsheets, and macros remain unsupported.
- Malformed, encrypted, no-text/image-only, unsupported-compression, legacy, macro, and truncated XLSX cases do not hand off unsafe `.redacted.xlsx` output or raw XLSX files.
- Truncated or bounded protected-site regenerated XLSX output falls back to sanitized `.redacted.txt` instead of handing off incomplete `.redacted.xlsx`.

## Release Audit Expectations

- No raw XLSX extracted text in logs, debug snapshots, audit records, storage, cache snapshots, reports, release metadata, or adapter diagnostics.
- JSON reports remain sanitized/redacted only and must not include raw extracted text.
- Release packages must not include raw XLSX fixture secrets, sourcemaps, debug leftovers, or original OOXML test markers in generated output.
- Generated XLSX bytes must not include original `xl/sharedStrings.xml`, `xl/worksheets/sheet*.xml`, `xl/comments`, `docProps/`, `customXml/`, `xl/media/`, `xl/calcChain.xml`, `xl/charts`, formulas, relationship targets, or original ZIP entries.
- Gemini/Grok pending attach gates, adapter contracts, Firefox bridge behavior, pending attach lifecycle, detector rules, extension permissions, and remote-call boundaries remain unchanged.
- Scanner and protected-site `.redacted.txt` fallback behavior remains supported.
