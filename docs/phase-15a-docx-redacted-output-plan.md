# Phase 15A DOCX Rebuilt Redacted Output Plan

## Scope

Phase 15A is planning and proof only. Scanner and protected-site DOCX uploads continue to export `.redacted.txt`; `.redacted.docx` is not wired into either path yet. XLSX rebuilds, detector changes, upload lifecycle changes, permissions, remote calls, and heavy dependencies are out of scope.

## Security Principle

A redacted DOCX must not keep raw secret text in any OOXML part. A safe rebuild must rewrite or remove raw text nodes before output is produced. It is not sufficient to add visible marks while leaving original text in `document.xml`, headers, footers, footnotes, endnotes, relationships, properties, or other ZIP/XML bytes.

## Strategy Comparison

### A. Generate a New Simple DOCX From Sanitized Text

This creates a new minimal DOCX package from sanitized extracted text only. The original DOCX bytes are used only to validate that the input is a supported DOCX envelope; no original OOXML streams are copied into the output.

Pros:
- Strongest proof that raw source XML, relationships, metadata, headers, footers, footnotes, and endnotes are not preserved.
- Matches the completed PDF rebuilt-output principle: sanitized extracted text only, not layout-preserving.
- Can be dependency-free with a small ZIP writer and simple `word/document.xml`.
- Easy to fail closed for malformed, encrypted, macro-enabled, legacy, or unsupported-compression inputs.
- Keeps `.redacted.txt` fallback unchanged.

Cons:
- Not layout-preserving.
- Drops styling, tables, tracked changes, images, fields, comments, custom properties, headers, footers, footnotes, and endnotes as document structures.
- Requires clear UI copy before any feature wiring.

### B. Rewrite Original DOCX OOXML Text Nodes

This preserves supported package structure while replacing text nodes in `word/document.xml`, `word/header*.xml`, `word/footer*.xml`, `word/footnotes.xml`, and `word/endnotes.xml`.

Pros:
- Can preserve more layout than a simple regenerated document.
- Lets supported text parts keep surrounding structure.

Cons:
- Harder to prove globally safe because secrets can also appear in comments, custom XML, document properties, relationships, embedded objects, charts, drawing alt text, revisions, fields, hyperlinks, or unsupported parts.
- Requires a stricter unsupported-structure inventory and fail-closed policy.
- More ZIP/XML rewriting complexity and larger regression surface.

Safe v1 shape if chosen later:
- Rewrite only a clearly supported allowlist of OOXML text-bearing parts.
- Remove or fail closed on unsupported text-bearing parts.
- Reject macros, `.docm`, `.doc`, encrypted packages, malformed ZIPs, unsupported compression, embedded packages, and unsafe metadata.
- Verify the resulting ZIP/XML bytes contain no known raw secret test fixtures.

### C. Visual/Highlight/Comment Overlay

Rejected for redaction. Comments, highlights, drawing overlays, black boxes, or similar visible markers can leave raw text intact in OOXML text nodes or other package parts. They may change what the user sees but do not satisfy the requirement that raw secret text is removed from the DOCX bytes.

## Recommended v1

Use Strategy A for the first proof: generate a new simple `.redacted.docx` from sanitized/redacted extracted text after validating the original DOCX is a supported, non-encrypted `.docx`.

The proof module is intentionally limited:
- Dependency-free.
- No remote calls.
- No permissions.
- No macros, `.docm`, or legacy `.doc`.
- No embedded image OCR/redaction.
- No XLSX rebuilds.
- No unsupported compression.
- Fail closed for malformed, encrypted, macro-enabled, unsupported, or empty sanitized text inputs.
- Output source is sanitized text only.

## Proof Behavior

`src/shared/docxRedactor.js` exposes a small proof API:
- `redactedDocxFileName(fileName)` returns `name.redacted.docx`.
- `createRedactedDocxFromText({ originalName, originalBytes, text })` validates the source DOCX envelope and returns either a fresh sanitized DOCX or a closed failure status.

The generated DOCX contains:
- `[Content_Types].xml`
- `_rels/.rels`
- `word/document.xml`

The output does not copy original `document.xml`, header, footer, footnote, endnote, relationship, media, property, or custom XML parts.

## Required Verification

Focused tests cover:
- DOCX with a fake API key produces `.redacted.docx` with the placeholder and no raw fake key.
- Source header/footer/footnote/endnote secrets are absent from output ZIP/XML bytes and extracted output text.
- Malformed, encrypted, unsupported-compression, `.doc`, and `.docm` inputs do not produce `.redacted.docx`.
- Output is extractable by the existing DOCX extractor and contains sanitized text.
- Scanner and protected-site pipeline remain unwired for DOCX rebuilt output; `.redacted.txt` fallback remains.
- The proof module contains no storage, logging, audit, or visible-marker implementation paths.

Before scanner/protected-site feature wiring, add a second gate that decides whether Strategy A is acceptable UX or whether Strategy B is necessary with a full unsupported-part fail-closed inventory.
