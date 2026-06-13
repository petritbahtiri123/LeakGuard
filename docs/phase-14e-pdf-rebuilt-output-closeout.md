# Phase 14E PDF Rebuilt-Output Closeout

## Scope

Phase 14E closes the PDF rebuilt-output work after scanner PDF export and protected-site PDF handoff were wired.

This closeout does not add new runtime behavior. It verifies and records the release boundary:

- Scanner text PDFs can export `.redacted.txt` and regenerated `.redacted.pdf`.
- Protected-site text PDFs can hand off regenerated `.redacted.pdf` only when the regenerated output is complete.
- Protected-site PDFs fall back to `.redacted.txt` when regenerated PDF output would truncate.
- Encrypted, malformed, scanned/image-only, empty, and unreadable PDFs do not upload raw through protected-site PDF paths.
- Regenerated PDFs are built from sanitized extracted text only.
- Original PDF bytes, streams, page contents, and layout are not copied into regenerated output.
- Layout-preserving PDF redaction is not supported.
- Scanned-PDF OCR is not supported.
- DOCX and XLSX rebuilds are not supported yet.

## Verified Boundaries

### Scanner PDFs

- Safe text PDFs produce regenerated `.redacted.pdf` from sanitized scanner text.
- `.redacted.txt` remains available.
- Large regenerated PDFs surface `pdf-redaction:pdf_redacted_text_truncated` while preserving `.redacted.txt` fallback.
- Encrypted, malformed, scanned/image-only, and empty PDFs do not produce `.redacted.pdf`.

### Protected-Site PDFs

- Safe text PDFs produce `application/pdf` handoff files named `original-name.redacted.pdf`.
- Truncated regenerated PDF output is not handed off; sanitized `.redacted.txt` fallback remains the safe output.
- Extraction or regeneration failures do not re-upload the raw PDF.
- Gemini/Grok pending attach gates and adapter contracts remain unchanged.

### Raw-Data Safety

- PDF output generation uses sanitized text only.
- Raw extracted PDF text is not persisted in local storage, debug logs, audit metadata, cache metadata, or sanitized reports.
- Release builds reject sourcemaps and `sourceMappingURL` leftovers.
- Release package size remains under the 50 MiB warning gate.

## Follow-Up Boundary

DOCX/XLSX rebuild planning can start separately only after this PDF boundary remains green in release validation.
