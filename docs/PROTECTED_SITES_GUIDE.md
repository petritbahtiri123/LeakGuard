# Protected Sites Guide

LeakGuard runs on built-in AI/chat sites and on user-managed exact origins that you explicitly add. It does not inject into every website by default.

## Built-In Protected Sites

The current built-in list is:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://grok.com/*`
- `https://x.com/*`

Built-in sites are packaged in the extension manifest and are enabled by default.

## User-Managed Sites

You can add another site from the popup with `Protect This Site` or from `Manage Protected Sites`.

LeakGuard stores user-managed rules as exact origins, for example:

```text
https://app.example.com/*
```

Accepted input:

- `example.com`
- `https://example.com`
- `http://localhost`
- `https://app.example.com/path`, which is normalized to `https://app.example.com/*`

Rejected input:

- wildcard rules such as `https://*.example.com`
- URLs with spaces
- URLs with embedded credentials
- non-HTTP schemes such as `file:`, `chrome:`, or `moz-extension:`

Paths, query strings, and fragments are not used for matching. Add one exact origin at a time.

## Permission Behavior

LeakGuard declares optional host permission coverage for HTTP and HTTPS so it can support user-managed protected sites. The browser grants access only after you approve a specific origin request.

For a user-managed site, LeakGuard requests the normalized exact origin match pattern rather than broad access to every site.

## What Protection Means

On a protected site, LeakGuard can inspect supported composer text and supported local file ingress paths before submission. Supported file paths include text/source files, text PDF extraction, DOCX text extraction, XLSX text extraction, and image metadata. If likely sensitive values are found, it can show a decision flow, redact values with placeholders, hand off sanitized files where safe, or block unsafe sends when rewrite verification or sanitized handoff fails.

Text PDF outputs on protected sites can be regenerated as `.redacted.pdf` from sanitized extracted text only when complete; truncated or unsafe PDF regeneration falls back to `.redacted.txt` or blocks raw upload. DOCX, XLSX, image metadata, and OCR text outputs on protected sites are `.redacted.txt`. LeakGuard does not rebuild DOCX or XLSX originals.

Protected-site image OCR is opt-in and default off. When enabled, it runs locally, supports English-only PNG/JPG/JPEG/WEBP image OCR, and uploads a flattened `.redacted.png` only when OCR boxes are eligible for visual redaction. If OCR fails, times out, or produces ineligible boxes for a raw image upload path, LeakGuard blocks raw upload rather than sending the original image.

LeakGuard does not provide scanned-PDF OCR, non-English OCR, remote OCR/backend processing, remote model calls, or image format preservation.

Protection is best-effort for supported editors and upload paths. Site DOM changes, hidden upload controls, unsupported file formats, browser limitations, or extension reloads can affect coverage.

## In-Page Status Menu

Protected pages show a compact top-center status menu. It is intentionally generic:

- confirms LeakGuard is active
- shows sensitive-item and placeholder counts
- links to extension controls
- does not render raw secret values into the host page

## Enterprise-Managed Sites

Enterprise builds can use `managedProtectedSites` to add protected origins by policy. Browser site access still has to be available for those origins, and browser-managed deployment is still required for force install or removal controls.

See [MANAGED_POLICY_SCHEMA.md](MANAGED_POLICY_SCHEMA.md) and [ENTERPRISE_DEPLOYMENT.md](ENTERPRISE_DEPLOYMENT.md).
