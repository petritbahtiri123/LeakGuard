# File Upload And Scanning Guide

LeakGuard has two local text-file protection paths:

- an extension-owned File Scanner page
- protected composer paste, drop, and file-select handling for supported UTF-8 text files

Both paths run locally in the browser. LeakGuard does not upload file contents to a backend service.

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

## Unsupported File Types

This release does not scan or redact:

- PDF or DOCX files
- images or screenshots
- archives
- executables
- binary files
- OCR or visual redaction flows

Unsupported files are not marked as scanned, protected, or sanitized. In composer paths, LeakGuard shows a local warning before normal site upload continues where that pass-through is safe for the browser/site path. For some Firefox protected-site drop paths, unsupported files may be blocked when LeakGuard cannot safely pass them through.

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

- reads a selected local text file only after you choose it
- scans with the same deterministic detector used for prompts
- displays a redacted preview
- can export a redacted text copy
- can export a sanitized JSON findings report

Raw file contents stay in the scanner page's memory while the page is open. Exported JSON reports do not include raw detected secrets by default.

## Protected Composer File Handling

On protected sites, LeakGuard attempts to intercept supported local text files before the site reads or uploads raw content.

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

If safe sanitized file handoff is not available, LeakGuard may insert sanitized text, offer a sanitized download, or block raw upload depending on the site and browser path.

## Site-Specific Notes

- ChatGPT large paste flows that can become generated `Plain Text` attachments are intercepted and redacted before sanitized text or file handoff.
- Gemini and Grok can use a trusted pending attach prompt for sanitized file handoff when the site requires a user-triggered upload flow.
- ChatGPT, Claude, OpenAI Chat, and X have adapter definitions and diagnostics, but pending attach is enabled only where focused evidence and tests support it.

Unsupported files and failed sanitized handoffs should not be represented as protected.

## Privacy Notes

LeakGuard does not intentionally persist raw file contents in extension storage. Protected composer file handling uses memory-only text, chunks, and sanitized file objects as needed for local redaction and handoff.

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) and [file-handoff-architecture.md](file-handoff-architecture.md) for deeper implementation notes.
