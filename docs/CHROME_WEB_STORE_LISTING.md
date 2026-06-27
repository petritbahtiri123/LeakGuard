# LeakGuard Chrome Web Store Listing

## Product Name

LeakGuard

## One-line Summary

Protect prompts and local text files by redacting likely secrets, email addresses, and public IPv4 details locally in Chrome.

## Short Description

LeakGuard helps reduce accidental AI chat leaks by redacting likely secrets, credentials, public IPv4 details, and supported local text files locally in your browser.

## Detailed Description

LeakGuard helps reduce accidental data leaks when working with AI chat tools.

It runs locally in your browser and detects likely sensitive values before they are submitted, pasted, dropped, or uploaded to protected chat websites.

LeakGuard can redact API keys, passwords, access tokens, client secrets, webhook secrets, database credentials, public IPv4 addresses, CIDR ranges, and supported local text files such as `.env`, `.json`, `.log`, `.md`, source files, and config files.

Sensitive values are replaced with stable placeholders such as `[PWM_1]`, `[NET_1]`, and `[PUB_HOST_1]`, while secure reveal stays inside extension-owned UI.

LeakGuard does not use a backend service, telemetry, analytics, cloud scanning, remote secret verification, or remote model calls.

LeakGuard is a risk-reduction tool, not a guarantee of complete secret protection. You should still review content before sending it to any AI chat service.

Before text is sent from a protected site, LeakGuard can:

- detect likely secrets such as API keys, tokens, passwords, client secrets, webhook URLs, connection strings, Docker auth blobs, and cookie-style session values
- detect likely email addresses
- detect public IPv4 hosts and public IPv4 CIDR ranges
- show an `Allow once` or `Redact` decision flow before submission
- replace raw values with stable placeholders such as `[PWM_1]`, `[PUB_HOST_1]`, and `[NET_1]`
- keep secure reveal local to the extension popup instead of exposing raw values in the page DOM

LeakGuard also includes a local File Scanner page for text/source files, text PDFs, DOCX text, XLSX spreadsheet text, image metadata, and English-only scanner image OCR for PNG/JPG/JPEG/WEBP images. It can export redacted text copies, sanitized JSON findings reports, and eligible flattened `.redacted.png` scanner visual redaction outputs without storing file contents or uploading them.

For protected chat composers, supported local UTF-8 text files, text PDFs, DOCX documents, XLSX spreadsheets, and image metadata pasted, dropped, or selected in the page can be locally validated, redacted, and replaced with sanitized in-memory `File`/`Blob` objects where the browser and site upload flow accept synthetic file handoff. Larger supported text files above 4 MiB and up to 50 MB are redacted locally with streaming/chunked processing before sanitized handoff. Supported text files above 50 MB are blocked from local redaction with a clear too-large warning. If LeakGuard attempts sanitization and sanitized file handoff fails, LeakGuard blocks raw upload and shows a local message.

Scanner and protected-site text PDFs can export regenerated `.redacted.pdf` from sanitized text only; protected-site PDFs fall back to `.redacted.txt` when regeneration would truncate. Scanner and protected-site DOCX results can export regenerated `.redacted.docx` from sanitized text only; original styles, images, comments, and metadata are not preserved, and protected-site DOCX falls back to `.redacted.txt` when regeneration would truncate. Scanner and protected-site XLSX results can export simple regenerated `.redacted.xlsx` from sanitized extracted text only; formulas, charts, styles, comments, hidden sheets, metadata, custom XML, calc chains, and media are not preserved, and protected-site XLSX falls back to `.redacted.txt` when regeneration would truncate. Image metadata and OCR text outputs export `.redacted.txt`. LeakGuard does not provide layout-preserving PDF/DOCX/XLSX redaction or original Office document reconstruction. Protected-site image OCR is settings-controlled and enabled by default for supported image uploads; users can turn it off. It runs locally, supports English only, and uploads a flattened `.redacted.png` only when OCR boxes are eligible. There is no scanned-PDF OCR, non-English OCR, remote OCR/backend processing, or image format preservation yet.

LeakGuard also protects ChatGPT large-paste flows that can become generated `Plain Text` attachments, and includes Gemini-specific mitigations for sanitized file handoff and large text fallback behavior.

LeakGuard is designed for risk reduction, not as a complete data-loss-prevention product.

### Current launch scope

- built-in protection for ChatGPT, OpenAI Chat, Claude, Gemini, Grok, X, and WhatsApp Web
- user-managed exact-site protection for additional sites
- local-only detection and redaction
- local-only email redaction for likely email addresses
- false-positive suppression for common documentation placeholders, example values, and development variable names
- local text-file scanning with redacted-copy and sanitized-report exports
- local text PDF, DOCX text, XLSX text, and image metadata scanning
- local English-only scanner image OCR and eligible flattened `.redacted.png` scanner visual redaction
- local text-file paste/drop/file-select redaction for supported UTF-8 text files in protected chat composers
- protected-site text PDF, DOCX, and XLSX extraction with complete regenerated file handoff and `.redacted.txt` fallback, plus image metadata extraction with `.redacted.txt` outputs
- protected-site image OCR that is enabled by default, can be turned off in settings, and outputs `.redacted.png` only when boxes are eligible
- streaming local redaction for supported text-file composer uploads above 4 MiB and up to 50 MB
- ChatGPT large paste / generated Plain Text attachment protection
- Gemini sanitized file handoff and large text fallback protection
- explicit warning for unsupported files without claiming they were scanned, protected, or sanitized; protected paths block raw upload when LeakGuard cannot safely pass through
- fail-closed blocking for supported text files above 50 MB or failed sanitized file handoff after LeakGuard attempts sanitization
- Manifest V3 service-worker architecture
- deterministic per-session placeholder mapping
- secure reveal only inside extension-owned UI

### What LeakGuard does not do

- no cloud processing
- no telemetry
- no remote model calls
- no backend service
- no promise of perfect privacy or complete secret protection
- no layout-preserving PDF/DOCX/XLSX redaction, original Office document reconstruction, or macro Office support in this release
- no scanned-PDF OCR, non-English OCR, remote OCR/backend, or image format preservation
- no archive, executable, or binary-file redaction in this release
- no support for every editor, upload flow, browser, or synthetic `DataTransfer` file handoff path

## Store Category Suggestion

Productivity

## Suggested Tags

- privacy
- security
- prompts
- ai
- secrets
- redaction

## Permission Justification

### `storage`

Used to store normalized protected-site rules and session-scoped prompt placeholder maps locally in the browser. Private placeholder maps use browser session storage when available and ephemeral extension memory otherwise. File Scanner and local file paste/drop contents are not stored in extension storage.

### `scripting`

Used to register and activate content scripts for built-in and user-managed protected sites in Manifest V3.

### `activeTab`

Used so the popup can inspect the current tab, show protection status, and activate protection for the current site.

### optional host permissions for `http://*/*` and `https://*/*`

Used only when the user explicitly enables protection for an additional site. LeakGuard does not request broad access up front for every website.

## Screenshot Plan

Track final capture requirements in [STORE_ASSETS_CHECKLIST.md](STORE_ASSETS_CHECKLIST.md).

Use real extension screenshots with production copy. Avoid showing raw real credentials.

1. Popup home view on a supported site showing `Protect This Site` or active protection state.
2. Popup protected-site management view with one user-managed site and built-in sites visible.
3. In-page top-center LeakGuard status menu on a protected site.
4. Allow once / Redact decision modal over a composer with realistic synthetic secrets.
5. Popup secure reveal view showing a placeholder and the revealed value inside extension UI only.
6. File Scanner page showing a local text file scan with redacted preview and export buttons.

## Reviewer Notes

- The extension processes text locally in the browser.
- The File Scanner processes explicitly selected text files locally and does not upload or store file contents.
- Supported local text files pasted, dropped, or selected in protected chat composers are processed locally, including streaming/chunked local redaction for supported text files above 4 MiB and up to 50 MB.
- Text PDFs, DOCX files, XLSX files, and image metadata are processed locally. Scanner and protected-site text PDFs can export regenerated `.redacted.pdf` from sanitized extracted text; protected-site PDFs fall back to `.redacted.txt` when regeneration would truncate. Scanner and protected-site DOCX can export regenerated `.redacted.docx` from sanitized text only; protected-site DOCX falls back to `.redacted.txt` when regeneration would truncate. Scanner and protected-site XLSX can export regenerated `.redacted.xlsx` from sanitized text only; protected-site XLSX falls back to `.redacted.txt` when regeneration would truncate. Image metadata exports `.redacted.txt`.
- Scanner image OCR and protected-site image OCR run locally, use English only, and do not use remote OCR or backend services. Protected-site OCR is settings-controlled, enabled by default for supported image uploads, and can be turned off.
- Unsupported formats such as scanned PDFs, non-English OCR, archives, executables, legacy/macro Office files, and binary files are not represented as scanned, redacted, or protected.
- Raw text-file uploads are blocked if sanitized file handoff cannot complete.
- Raw secrets are not sent to external services by the extension.
- Likely email addresses are redacted locally; LeakGuard does not upload email text for scanning.
- The detector suppresses common documentation placeholders, example values, and development variable names to reduce false positives.
- Sanitized File Scanner JSON reports do not include raw secrets by default.
- User-managed sites are exact origin rules, not wildcard rules.
- Secure reveal is confined to extension-owned UI.
