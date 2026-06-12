# Phase 16A XLSX Redacted Output Plan

Phase 16A is planning and proof only. Scanner and protected-site XLSX uploads continue to export `.redacted.txt`; `.redacted.xlsx` is not wired into either path. This phase adds a tiny proof generator that can build a brand-new XLSX from already sanitized/redacted extracted text.

## Security Boundary

A redacted XLSX must not keep raw secret text in any OOXML spreadsheet part. It is not enough to mask, format, cover, collapse, or make content less visible. Raw secret text must not remain in `xl/sharedStrings.xml`, `xl/worksheets/sheet*.xml`, formulas, comments, relationships, metadata, custom XML, workbook properties, hidden sheets, calc chains, or media-related parts.

The proof path has no backend calls, telemetry, cloud verification, new permissions, detector changes, Gemini bridge changes, Firefox bridge changes, or pending attach lifecycle changes.

## Strategy Comparison

### A. Brand-New Simple XLSX From Sanitized Text

Generate a fresh OOXML workbook containing only sanitized/redacted extracted text. The output is a simple single-sheet workbook with generated safe XML parts and no copied source workbook parts.

Benefits:
- Avoids carrying raw values from unscanned or hard-to-audit OOXML parts.
- Avoids formulas, comments, hidden sheets, workbook metadata, custom XML, macros, charts, styles, and embedded media by construction.
- Keeps implementation small and dependency-free.
- Produces an extractable XLSX that existing LeakGuard extraction can validate.

Tradeoffs:
- Does not preserve layout.
- Does not preserve formulas, charts, styles, comments, hidden sheets, macros, metadata, custom XML, relationships, or embedded media.
- Represents extracted text as simple rows, not as the original workbook structure.

### B. Rewrite Supported Original OOXML Spreadsheet Parts

Rewrite selected original parts such as:
- `xl/sharedStrings.xml`
- `xl/worksheets/sheet*.xml`
- `xl/comments*.xml`
- `xl/workbook.xml`
- `xl/calcChain.xml`
- `docProps/*`
- `xl/_rels/*`
- custom XML when present

Benefits:
- Could preserve more spreadsheet structure in a later phase.

Risks:
- High risk of missing a part that still contains raw secret text.
- Requires careful coverage for relationships, hidden sheets, formula caches, comments, workbook names, metadata, custom properties, calc chains, and embedded package relationships.
- Requires a larger OOXML parser/rewrite surface and likely dependency review.
- Must prove every copied part is either sanitized or safe.

### C. Visual, Formatting, Comment, or Concealment Layer

Rejected. Hiding cells/sheets/rows/columns, applying styles, replacing visible text with overlays, adding comments, using masks, or otherwise changing visual presentation can leave raw values intact in workbook XML, formula caches, shared strings, comments, metadata, or hidden parts.

## Recommended V1

Use strategy A: generate a brand-new simple XLSX from sanitized/redacted extracted text.

Do not claim layout preservation. Do not preserve formulas, charts, styles, comments, hidden sheets, macros, metadata, custom XML, relationships beyond generated minimal workbook links, or embedded media. Do not copy original XLSX XML parts unless a future phase explicitly proves the generated/copied parts are safe.

## Proof Module

`src/shared/xlsxRedactor.js` provides proof-only helpers:
- Input: sanitized/redacted extracted text.
- Output: brand-new XLSX ZIP bytes.
- Filename: `original-name.redacted.xlsx`.
- Future MIME: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- Source marker: `sanitized_text`.

The proof output:
- Contains sanitized/redacted text.
- Is extractable by the existing XLSX extractor.
- Does not contain raw fake secret bytes/text when those raw values are not present in the sanitized input.
- Contains no macros.
- Does not support `.xls`, `.xlsm`, `.xlsb`, or `.xltm`.
- Does not preserve formulas.
- Does not preserve hidden sheets.
- Does not preserve comments, metadata, custom XML, media, charts, styles, or original relationships.
- Does not copy original XLSX XML parts.

## Tests

Focused proof tests cover:
- XLSX with a fake API key redacted to placeholder text produces a generated proof `.redacted.xlsx` with no raw fake key.
- Output XLSX extraction returns the placeholder/redacted text.
- Malformed, encrypted, and unsupported XLSX extraction states do not produce `.redacted.xlsx`.
- `.xls` and `.xlsm` states do not produce `.redacted.xlsx`.
- Formula/comment/hidden-sheet fake secrets do not survive because the proof workbook is generated from sanitized extracted text and original parts are not copied.
- Existing scanner/protected-site `.redacted.txt` fallback remains wired; `.redacted.xlsx` is not wired into UI or protected-site uploads.
- Proof source has no persistence, logging, debug/audit text sink, or visual-concealment approach.
- Package dependency and source-size gates remain lightweight.

## UI And Docs

Do not claim user-facing XLSX rebuild support yet. Do not claim layout-preserving XLSX redaction. Capability documentation may mention rebuilt XLSX only as proof/planned and must keep `.redacted.txt` as the current scanner/protected-site XLSX output.

## Future Scanner Readiness Checklist

Before wiring `.redacted.xlsx` into scanner or protected-site upload flows:
- Decide whether simple regenerated workbook output is acceptable UX.
- Confirm regenerated workbook truncation handling.
- Confirm no raw text reaches logs, reports, storage, audit metadata, DOM, or debug snapshots.
- Re-run full release, package, browser, and smoke gates.
- Update UI copy only after the feature is actually wired.
