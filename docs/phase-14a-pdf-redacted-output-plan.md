# Phase 14A PDF Redacted Output Plan

## Goal

Start PDF rebuilt-output work as a planning and proof phase only. Current scanner and protected-site PDF behavior remains `.redacted.txt`; rebuilt `.redacted.pdf` output is not wired into protected-site uploads yet.

## Strategy Comparison

| Strategy | Summary | Security result | Product fit |
| --- | --- | --- | --- |
| A. Generate a new simple PDF from sanitized extracted text | Extract text, redact with existing detector/placeholders, then write a brand-new PDF from the sanitized text only. | Safe for v1 because raw PDF streams are not copied and raw text is absent when redaction succeeded. | Recommended v1. No layout-preservation guarantee. Keeps `.redacted.txt` fallback. |
| B. True content-stream redaction/rewrite | Parse PDF operators, remove or rewrite sensitive text spans inside content streams, then rebuild affected streams. | Potentially strong, but only after a real PDF parser/re-writer handles encodings, fonts, compression, xrefs, object streams, and incremental updates. | Future research. Higher complexity and higher regression risk. |
| C. Visual overlay on the original PDF | Draw black rectangles over the original pages while keeping original content streams underneath. | Rejected. Raw text may remain selectable, searchable, extractable, or recoverable. | Not acceptable for LeakGuard redaction. |

## Recommended V1

- Generate a new simple `.redacted.pdf` from sanitized extracted text.
- Use dependency-free minimal PDF generation while practical.
- Do not preserve original PDF layout, fonts, images, annotations, forms, links, signatures, metadata, object streams, or page geometry.
- Use output filename `original-name.redacted.pdf`.
- Keep `.redacted.txt` as the scanner/protected-site fallback and current default behavior.
- Only produce `.redacted.pdf` when PDF extraction and redaction already succeeded.
- Encrypted, malformed, scanned/image-only, no-text, and over-limit PDFs fail closed and do not produce `.redacted.pdf`.
- Do not wire rebuilt PDF output into protected-site uploads during Phase 14A.

## Proof Scope

The Phase 14A proof module is `src/shared/pdfRedactor.js`.

It accepts sanitized/redacted text, not original PDF bytes. It creates a brand-new PDF with simple text pages and a standard font. The proof verifies:

- generated PDF bytes start as a PDF document
- filename ends `.redacted.pdf`
- output contains placeholders/redacted text
- output does not contain a raw fake secret that was absent from sanitized input
- existing text extraction can parse the generated PDF
- encrypted, malformed, and scanned/image-only PDFs do not produce `.redacted.pdf`
- protected-site `.redacted.txt` behavior remains unchanged
- the proof module does not use storage, audit metadata, logs, remote calls, or original PDF stream inputs

## Future Feature Gate

Before scanner `.redacted.pdf` output can become a user-facing feature:

- add scanner UI controls that keep `.redacted.txt` fallback visible
- add browser QA for scanner PDF download
- add release copy stating regenerated PDF from sanitized text, not layout-preserving redaction
- confirm package size remains below the 50 MiB warning gate
- repeat raw-data scans against `dist/` and release zips
- explicitly keep protected-site uploads on `.redacted.txt` until a separate reviewed phase wires PDF output
