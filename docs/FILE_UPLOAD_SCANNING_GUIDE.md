# File Upload And Scanning Guide

LeakGuard has two local file-protection paths:

- an extension-owned File Scanner page
- protected composer paste, drop, and file-select handling for supported file types

Both paths run locally in the browser. LeakGuard does not upload file contents to a backend service, remote OCR service, CDN, telemetry endpoint, or remote model.

## Supported File Types

Supported text file names and extensions include:

- `.txt`, `.md`, `.markdown`
- `.env`, `.log`, `.json`, `.yaml`, `.yml`, `.toml`, `.xml`, `.csv`, `.ini`, `.conf`, `.cfg`
- `.pem`, `.key`
- `.ps1`, `.sh`, `.bash`, `.zsh`, `.bat`, `.cmd`
- `.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.html`, `.css`, `.scss`
- `.java`, `.c`, `.cpp`, `.h`, `.hpp`, `.cs`, `.go`, `.rs`, `.rb`, `.php`, `.sql`
- `Dockerfile`, `Makefile`

Files must be valid UTF-8 text. Binary-looking text files are rejected.

Supported document and image paths:

| Type | Scanner | Protected-site uploads | Output |
| --- | --- | --- | --- |
| Text PDF | Local text extraction; scanner can also export regenerated `.redacted.pdf` from sanitized text | Local text extraction | Scanner: `.redacted.txt` or regenerated `.redacted.pdf`; protected sites: regenerated `.redacted.pdf` when complete or `.redacted.txt` fallback |
| DOCX | Local text extraction; scanner can also export regenerated `.redacted.docx` from sanitized text | Local text extraction | Scanner: `.redacted.txt` or regenerated `.redacted.docx`; protected sites: regenerated `.redacted.docx` when complete or `.redacted.txt` fallback |
| XLSX | Local text extraction; scanner can also export simple regenerated `.redacted.xlsx` from sanitized text; formulas are scanned as text and not executed | Local text extraction | Scanner: `.redacted.txt` or regenerated `.redacted.xlsx`; protected sites: regenerated `.redacted.xlsx` when complete or `.redacted.txt` fallback |
| PNG/JPG/JPEG/WEBP metadata | Local metadata scan | Local metadata scan when protected-site OCR is turned off | `.redacted.txt` |
| PNG/JPG/JPEG/WEBP OCR | English-only scanner OCR after user action | English-only protected-site OCR is enabled by default for supported image uploads and can be turned off in settings | `.redacted.txt`, or `.redacted.png` only when visual redaction boxes are eligible |

See [FILE_CAPABILITY_MATRIX.md](FILE_CAPABILITY_MATRIX.md) for the authoritative capability matrix.

## Unsupported Or Limited File Types

This release does not scan or redact:

- scanned/image-only PDFs
- non-English OCR
- remote OCR/backend processing
- layout-preserving PDF/DOCX/XLSX redaction or original Office document reconstruction
- image format preservation for visual redaction; visual image redaction exports PNG
- archives
- executables
- binary files
- legacy or macro Office formats such as `.doc`, `.docm`, `.xls`, `.xlsm`, `.xlsb`, and `.xltm`

Unsupported files are not marked as scanned, protected, or sanitized. In composer paths, LeakGuard may allow normal site upload only where that pass-through is explicitly outside a consumed/sanitized protection path and safe for the browser/site path. If LeakGuard consumes the file event, attempts sanitization, or cannot safely pass the file through, the protected flow fails closed and blocks raw upload.

## Size Limits

Current local text-file limits:

| Size | Behavior |
| --- | --- |
| Up to 2 MiB | standard local redaction path |
| Above 2 MiB and up to 4 MiB | optimized local redaction path |
| Above 4 MiB and up to 50 MB | streaming/chunked local redaction for protected composer upload paths |
| Above 50 MB | blocked instead of uploaded raw through supported text-file paths |

The extension-owned File Scanner validates supported text files up to the same 50 MB maximum, but large protected composer upload paths use streaming/chunked redaction so LeakGuard does not need to hold the full raw file in one string before sanitizing.

## File Scanner Page

The File Scanner page is opened from the popup. It:

- reads a selected local file only after you choose it
- scans with the same deterministic detector used for prompts
- displays a redacted preview
- can export a redacted text copy
- can export a sanitized JSON findings report
- can export a simple regenerated `.redacted.xlsx` from sanitized XLSX text
- can export a flattened `.redacted.png` for scanner image visual redaction when OCR boxes are eligible

Raw file contents stay in the scanner page's memory while the page is open. Exported JSON reports do not include raw detected secrets by default.

## Protected Composer File Handling

On protected sites, LeakGuard attempts to intercept supported local files before the site reads or uploads raw content.

Supported paths include:

- paste
- drag and drop
- file input selection where the browser and site allow safe replacement

The preferred flow is:

1. block raw ingress before page handlers consume it
2. validate file type, size, and UTF-8 text
3. redact locally
4. create a sanitized in-memory `File` or `Blob`
5. hand only the sanitized file to the site when a safe path exists

If safe sanitized file handoff is not available, LeakGuard may insert sanitized text, offer a sanitized download, or block raw upload depending on the site and browser path. For text PDFs, DOCX files, and XLSX files, protected-site output can be regenerated from sanitized extracted text when complete; truncated or unsafe regeneration falls back to `.redacted.txt` or blocks raw upload. Image metadata and OCR text protected-site output remains `.redacted.txt`. Protected-site visual image upload produces `.redacted.png` when protected-site OCR is on and eligible boxes are available; OCR failure or ineligible visual redaction blocks raw image upload.

## Site-Specific Notes

- ChatGPT large paste flows that can become generated `Plain Text` attachments are intercepted and redacted before sanitized text or file handoff.
- Built-in adapters can use a trusted pending attach prompt for sanitized file handoff when the site requires a user-triggered upload flow. Pending attach stores sanitized files in memory only and must not replay raw files.
- WhatsApp Web supports text typing, multiline text, text paste, clipboard image paste for PNG/JPG/JPEG/WEBP, attach-button single file, attach-button 2-5 file batches, drag/drop single file, and drag/drop 2-5 file batches. WhatsApp blocks 6+ files before read, blocks unsupported or failing batches all-or-nothing, never inserts extracted file text into the WhatsApp composer, and keeps file paste out of scope except clipboard image paste.

Unsupported files and failed sanitized handoffs should not be represented as protected.

## Privacy Notes

LeakGuard does not intentionally persist raw file contents in extension storage. Protected composer file handling uses memory-only text, chunks, and sanitized file objects as needed for local redaction and handoff.

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) and [file-handoff-architecture.md](file-handoff-architecture.md) for deeper implementation notes.
