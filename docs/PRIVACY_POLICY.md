# LeakGuard Privacy Policy

Last updated: 2026-05-05

## Summary

LeakGuard processes protected prompt text and explicitly selected supported local files locally in your browser to help reduce accidental leaks of secrets, email addresses, and public IPv4 network details.

LeakGuard does not operate a backend service and does not send your prompt text, selected file contents, raw secrets, email addresses, or raw network values to our servers. LeakGuard does not use telemetry, cloud processing, or remote model calls.

## What LeakGuard Accesses

LeakGuard may access text you type, paste, or submit in protected site composers so it can:

- detect likely secrets
- detect likely email addresses
- detect public IPv4 hosts and CIDR ranges
- show an allow-or-redact decision before send
- replace sensitive values with placeholders
- reveal placeholders later only inside extension-owned UI

LeakGuard may also access a local file only after you choose it in the File Scanner page or paste, drop, or select it through a protected AI composer. This release supports text/source files, text PDF extraction, DOCX text extraction, XLSX text extraction, image metadata scanning, English-only scanner image OCR, and settings-controlled protected-site image OCR that is enabled by default for supported image uploads and can be turned off. The File Scanner can export a redacted text copy, a sanitized JSON findings report, or an eligible flattened `.redacted.png` scanner visual redaction output.

LeakGuard scans and redacts supported files locally. Scanner text PDFs can export `.redacted.txt` plus regenerated `.redacted.pdf` output built from sanitized extracted text only. Scanner DOCX files can export `.redacted.txt` plus regenerated `.redacted.docx` output built from sanitized extracted text only, without preserving original styles, images, comments, or metadata. Scanner XLSX files can export `.redacted.txt` plus a simple regenerated `.redacted.xlsx` output built from sanitized extracted text only, without preserving formulas, charts, styles, comments, hidden sheets, metadata, custom XML, calc chains, or media. Protected-site text PDFs, DOCX files, and XLSX files can hand off regenerated `.redacted.pdf`, `.redacted.docx`, or `.redacted.xlsx` output only when regenerated output is complete; otherwise LeakGuard falls back to `.redacted.txt` or blocks raw upload. Image metadata and OCR text export `.redacted.txt`. Protected-site image redaction uploads `.redacted.png` only when protected-site OCR is on and OCR boxes are eligible. LeakGuard does not provide scanned-PDF OCR, non-English OCR, remote OCR, backend file processing, layout-preserving PDF/DOCX/XLSX redaction, legacy/macro Office redaction, or image format preservation.

For protected AI composers, larger supported text files may be redacted with streaming/chunked local processing before LeakGuard hands off a sanitized in-memory file to the site. This avoids sending raw text-file content through protected upload paths while keeping processing local to your browser.

## What LeakGuard Stores

LeakGuard stores only the following extension data:

- normalized user-managed protected-site rules in extension `storage.local`
- session-scoped placeholder mappings and reveal state in `chrome.storage.session`, or ephemeral extension memory when session storage is unavailable

LeakGuard does not intentionally persist raw prompts, selected file contents, raw OCR text, raw image bytes, raw secrets, or raw public IPv4 values in long-term extension storage. File Scanner scan results stay in memory on the scanner page until you clear the scan or close the page. Protected composer file redaction uses in-memory text, chunks, OCR results, image bytes, and sanitized `File`/`Blob` objects only as needed for local redaction and handoff.

## Optional Feedback

LeakGuard may show an optional, user-initiated feedback entry point when feedback is enabled by policy. Enterprise or managed deployments can disable or hide this feedback entry point through managed policy. The feedback flow generates a metadata-only template locally and lets you review and edit it before copying it or opening a prefilled GitHub issue link. The user-written description is controlled by you; do not paste secrets, prompts, filenames, file contents, OCR text, screenshots, or other sensitive data into it.

LeakGuard does not automatically send feedback, logs, telemetry, diagnostics, screenshots, prompts, selected file contents, filenames, OCR text, raw DOM text, or raw URLs. GitHub issue opening occurs only after an explicit user action and only to the approved LeakGuard feedback destination.

## What LeakGuard Does Not Send

LeakGuard does not send the following to our servers because the extension does not use a backend service:

- prompt text
- selected file contents
- OCR text or image bytes
- raw secret values
- email addresses
- raw network values
- placeholder maps
- browsing telemetry
- streaming redaction chunks
- OCR requests or image redaction requests

LeakGuard also suppresses common documentation placeholders, example values, and development variable names where possible to reduce false positives during local scanning.

Sanitized File Scanner JSON reports do not include raw secret values by default. Redacted file copies and reports are created only after you click the export buttons.

## Site Permissions

LeakGuard includes built-in protection for supported AI/chat sites and can request optional site access when you explicitly add another protected site.

LeakGuard does not request optional access for every site unless you choose to protect that site.

Enterprise deployments may override those defaults through managed policy, including disabling user-added protected sites.

## Secure Reveal

When you reveal a placeholder, the raw value is shown only inside extension-owned UI. LeakGuard does not write the revealed raw value back into the website DOM for that reveal flow.

Enterprise deployments may disable secure reveal by policy.

## Extension Page Hardening

LeakGuard extension pages use a restrictive Content Security Policy for extension-owned UI contexts. That policy allows packaged scripts only and disables plugin objects, base URL overrides, and third-party framing of extension pages.

## Limitations

LeakGuard is a risk-reduction tool, not a guarantee of secrecy or privacy, and it may miss or misclassify some sensitive text. It does not protect against:

- browser compromise or malware
- OS-level clipboard/history capture
- screenshots or shoulder surfing
- unsupported binary document, archive, executable, or image redaction flows such as scanned PDFs, legacy/macro Office files, ZIP, EXE, screenshots, non-English OCR, or image format preservation
- websites or editors whose DOM changes break interception logic
- raw values that you intentionally reveal or manually send

PDF, DOCX, and XLSX redaction currently means local text extraction followed by sanitized export or handoff. Scanner and protected-site text PDFs, DOCX files, and XLSX files can export regenerated `.redacted.pdf`, `.redacted.docx`, or `.redacted.xlsx` from sanitized text only; protected-site outputs fall back to `.redacted.txt` when regeneration would truncate. LeakGuard does not preserve original PDF/DOCX/XLSX layout, formulas, styles, comments, metadata, custom XML, calc chains, or media. Scanner visual image redaction and eligible protected-site image redaction export flattened PNG only. Unsupported files are not marked as scanned, protected, or sanitized. Supported files above the current local limits, unreadable documents, OCR failures, and ineligible protected-site visual redaction failures are blocked rather than uploaded raw through protected file paths.

## Data Retention

Session-scoped placeholder mappings are kept in browser session storage when available and are cleared when the relevant session state is removed. On browsers without session storage, LeakGuard uses ephemeral extension memory for private placeholder and reveal state rather than persisting that state in `storage.local`. User-managed protected-site rules remain until you remove or disable them. Enterprise metadata-only audit events are bounded and purged according to the configured retention window.

## Contact

Support: petritbahtiri24@gmail.com

Privacy: petritbahtiri24@gmail.com

Security: petritbahtiri24@gmail.com
