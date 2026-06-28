# LeakGuard

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/petritbahtiri)


LeakGuard is a local-first browser privacy guard that reduces accidental AI prompt leaks.

The public product name is LeakGuard.

It watches supported composers for typed or pasted content, detects likely secrets, email addresses, and sensitive public IPv4 data before submission, and lets you choose `Redact` or `Allow once`.

LeakGuard does not use a backend service, cloud processing, telemetry, or remote model calls. It is designed for practical risk reduction, not perfect privacy or full enterprise DLP.

> Local-only. No backend. No telemetry. Secure reveal stays inside extension-owned UI.

## What LeakGuard Is

- A local-first browser privacy guard for supported chat composers
- A deterministic-first redaction layer for likely secrets, email addresses, and sensitive public IPv4 data
- A session-scoped placeholder system for replacing raw values with tokens such as `[PWM_1]`, `[PUB_HOST_1]`, and `[NET_1]`
- A local text-file scanner for selected text files
- Local text-file paste/drop redaction for supported UTF-8 text files in protected chat composers
- Streaming local redaction for larger supported text-file uploads in protected chat composers
- An optional local AI assist layer over leftover suspicious candidate windows after deterministic detection

## What LeakGuard Is Not

- Full enterprise DLP or a guarantee that all sensitive-data leaks are prevented
- Remote secret verification, credential rotation, or a secrets manager
- Repository-history scanning, CI push protection, or a replacement for tools such as GitHub Secret Scanning, Gitleaks, detect-secrets, or TruffleHog
- Cloud AI scanning, remote model inference, telemetry, or backend secret processing
- Layout-preserving PDF/DOCX/XLSX redaction, legacy/macro Office redaction, scanned-PDF OCR, non-English OCR, remote OCR, screenshot monitoring, clipboard-history, malware, or endpoint protection

See [docs/NON_GOALS.md](docs/NON_GOALS.md) for the maintained non-goals list.

## Support LeakGuard

LeakGuard is a privacy-first AI protection tool that helps prevent accidental data leaks when using ChatGPT, Gemini, and other AI platforms.

Everything runs locally:
- No cloud processing
- No tracking
- No data collection

If you want to support development and future work such as:
- broader file-format detection research
- PDF and DOCX text extraction review
- image OCR redaction research
- deeper Chrome and Firefox QA

Support here:
https://ko-fi.com/petritbahtiri

## v2.2.1 Snapshot

- Built-in protection for `chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com`, `grok.com`, `x.com`, and `web.whatsapp.com`
- User-managed protection for additional exact `http://` or `https://` origins
- Local-only detection and redaction in the browser
- Supported local UTF-8 text files pasted, dropped, or selected in protected chat composers can be locally validated, redacted, and replaced with sanitized in-memory files where browser/site handoff works
- Large supported text-file uploads above 4 MiB and up to 50 MB use streaming/chunked local redaction before sanitized handoff
- Supported text files above 50 MB are blocked instead of being uploaded raw
- ChatGPT large paste flows that can become generated `Plain Text` attachments are intercepted and redacted before sanitized text/file handoff
- Gemini and Grok large-file handoff uses trusted pending attach prompts so only sanitized files are staged for upload
- LeakGuard shows local scan, sanitize, stream-redaction, and sanitized-upload preparation progress before switching to pending attach prompts
- Gemini file-to-text fallback uses size-aware insertion, preserves multiline sanitized text in Firefox, avoids slow `execCommand` paths for medium text, and asks before inserting very large sanitized text into the editor
- Composer rewrite verification is normalized across supported contenteditable editors while still failing closed if raw high-confidence secrets remain or placeholders are missing
- Optional local AI assist loads its ONNX Runtime sidecars from packaged extension URLs in Chrome and Firefox
- If sanitized file handoff fails or the file is unsupported/invalid, LeakGuard blocks raw upload and shows a local message
- Trust-aware placeholder preservation and reuse for session-known `[PWM_N]`, `[NET_N]`, and `[PUB_HOST_N]` tokens
- Full-value redaction for sensitive HTTP headers such as `Authorization`, `X-API-Key`, auth token headers, `Cookie`, and `Set-Cookie`
- Local-only email redaction for likely email addresses in protected prompts and supported text files
- False-positive suppression for common documentation placeholders, example values, and development variable names
- Local File Scanner for text-based files with redacted-copy and sanitized-report exports
- Local text extraction for text PDFs, DOCX documents, and XLSX spreadsheets with `.redacted.txt` fallbacks and regenerated PDF/DOCX/XLSX outputs from sanitized text where supported
- Local image metadata scanning for PNG, JPG, JPEG, and WEBP images
- Scanner image OCR for PNG, JPG, JPEG, and WEBP images, with English-only local OCR and flattened `.redacted.png` visual redaction exports when OCR boxes are eligible
- Protected-site image OCR is settings-controlled, enabled by default for supported image uploads, local-only, images-only, and uploads `.redacted.png` only when OCR boxes are eligible
- Popup-based site management for add, enable, disable, and remove flows
- In-page top-center status menu on protected pages
- Popup-only secure reveal for placeholders
- Session-scoped placeholder state in `chrome.storage.session`, or ephemeral extension memory when session storage is unavailable
- No cloud processing, telemetry, or backend service

## How LeakGuard Works

1. On a protected site, LeakGuard watches supported chat composers for paste, typing, send, and supported local text-file paste/drop/file-select events.
2. If it finds likely secrets or sensitive public IPv4 hosts/CIDRs, it shows an `Allow once` or `Redact` decision flow.
3. If you choose `Redact`, it rewrites the composer with stable placeholders such as `[PWM_1]`, `[PUB_HOST_1]`, and `[NET_1]`.
4. Private raw-to-placeholder mappings stay in the background service worker and `chrome.storage.session` for the active browser session only; on browsers without session storage, LeakGuard uses ephemeral extension memory instead of `storage.local`.
5. Clicking a revealable placeholder stages a secure reveal inside the LeakGuard popup. Raw values are not written back into the page DOM.

## Local File Scanner

LeakGuard includes an extension-owned File Scanner page for local files. It reads files only after you choose them, scans supported content in the browser with the same deterministic detector used for prompts, and can export a redacted text copy, a sanitized JSON findings report, or an eligible flattened redacted PNG for scanner image visual redaction.

Supported scanner files for this release: `.txt`, `.md`, `.markdown`, `.env`, `.log`, `.json`, `.yaml`, `.yml`, `.toml`, `.xml`, `.csv`, `.ini`, `.conf`, `.cfg`, `.pem`, `.key`, `.ps1`, `.sh`, `.bash`, `.zsh`, `.bat`, `.cmd`, `.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.html`, `.css`, `.scss`, `.java`, `.c`, `.cpp`, `.h`, `.hpp`, `.cs`, `.go`, `.rs`, `.rb`, `.php`, `.sql`, `Dockerfile`, `Makefile`, text PDFs, DOCX text, XLSX text, and PNG/JPG/JPEG/WEBP image metadata. Scanner image OCR is English-only, local-only, and limited to PNG/JPG/JPEG/WEBP images.

In v2.2.1, supported local UTF-8 text files, text PDFs, DOCX documents, XLSX spreadsheets, and image metadata pasted, dropped, or selected in protected AI composers can also be locally validated, redacted through the same background-owned placeholder flow, and replaced with sanitized in-memory `File`/`Blob` objects where browser and site upload flows accept synthetic file handoff. Protected composer attach/drop/select/paste-file operations can include up to 20 small files up to 4 MiB each, up to 5 large files above 4 MiB and up to 50 MB each, or mixed batches within both caps; LeakGuard processes each accepted file independently, preserves deterministic order for sanitized handoff, blocks unsupported or failed files without raw fallback, and blocks over-cap batches before reading or upload. Scanner text PDFs can export `.redacted.txt` plus a regenerated `.redacted.pdf` built from sanitized extracted text; scanner DOCX files can export `.redacted.txt` plus a regenerated `.redacted.docx` built from sanitized extracted text, without preserving original styles, images, comments, or metadata; scanner XLSX files can export `.redacted.txt` plus a simple regenerated `.redacted.xlsx` built from sanitized extracted text, without preserving formulas, charts, styles, comments, hidden sheets, metadata, custom XML, calc chains, or media. Protected-site text PDFs, DOCX files, and XLSX files can hand off regenerated `.redacted.pdf`, `.redacted.docx`, or `.redacted.xlsx` outputs only when sanitized generation is complete; truncated or unsafe regeneration falls back to `.redacted.txt` or blocks raw upload. Image metadata and protected-site OCR text outputs are exported as `.redacted.txt`. Protected-site image OCR is settings-controlled and enabled by default for supported image uploads; when enabled, eligible image visual redaction uploads a flattened `.redacted.png` only when OCR boxes are safe enough. Files above 4 MiB and up to 50 MB use streaming/chunked local redaction so LeakGuard does not need to read the full raw file into one string before sanitizing it. Gemini and Grok can stage sanitized large files in a trusted pending attach prompt when the site requires a user-triggered upload flow. This does not guarantee support for every editor or upload control. Unsupported files, invalid UTF-8 files, text files above 50 MB, unreadable documents, OCR failures, and failed sanitized file handoff are blocked from raw upload with a local message.

File scanner limits:

- 50 MB maximum supported text-file size for local scanner validation and protected composer upload paths
- streaming/chunked redaction is used for protected composer upload paths above 4 MiB and up to 50 MB
- protected composer upload and paste-file paths support up to 20 small files up to 4 MiB each, up to 5 large files above 4 MiB and up to 50 MB each, or mixed batches within both caps; over-cap batches are blocked before reading or upload
- deterministic detection only
- raw file contents are not stored in extension storage
- exported JSON reports do not include raw secrets by default
- Scanner and protected-site text PDFs, DOCX, and XLSX can export regenerated `.redacted.pdf`, `.redacted.docx`, and `.redacted.xlsx` from sanitized text only; protected-site outputs fall back to `.redacted.txt` when regeneration would truncate
- no scanned-PDF OCR, non-English OCR, remote OCR/backend, or image format preservation yet

## Detection Coverage

LeakGuard currently focuses on high-value prompt leak cases such as:

- API keys, access tokens, PATs, OAuth-style tokens, bearer tokens, and JWTs
- Passwords, client secrets, cookie/session-style values, and generic secret assignments
- Webhook URLs, Docker auth blobs, cloud connection strings, and auth headers
- Database URLs and connection strings while preserving URI shape and masking only the secret segment
- Sensitive HTTP headers while preserving header names, separators, auth schemes, and cookie attributes where possible
- Repeated raw secrets across headers, assignments, and labelled prose with stable placeholder reuse
- Likely email addresses, redacted locally without cloud processing or remote model calls
- Public IPv4 hosts and public IPv4 CIDR ranges

The detector is heuristic by design. It is tuned to catch realistic mistakes while suppressing obvious documentation placeholders, example literals, safe development variable names, and other low-risk text where possible.

### Local AI Assist

LeakGuard can optionally run a tiny local ONNX classifier over leftover suspicious candidate windows after deterministic detection. Deterministic detection remains authoritative: AI assist does not receive the full prompt, cannot downgrade deterministic findings, and is not a replacement for the deterministic redaction path.

Training, export, browser smoke tests, and enterprise disable guidance live in [docs/AI_ASSIST.md](docs/AI_ASSIST.md).

## Security Model

- Raw secrets are not sent to external services by the extension.
- Raw secrets are not persisted in `chrome.storage.local`.
- Selected file contents are scanned locally and are not stored in extension storage.
- Supported local text-file paste/drop/file-select content is intercepted locally before raw upload and is not stored in extension storage.
- Large supported text files are streamed/chunked locally for redaction before sanitized file handoff; raw large text is not uploaded by LeakGuard through protected text-file paths.
- Persistent local storage is limited to normalized protected-site rules.
- Raw values are kept only in session-scoped background storage so secure reveal can work during the active tab session.
- Secure reveal is restricted to extension-owned UI.
- Extension pages use a restrictive CSP with packaged scripts and local WASM support: `script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`.
- The extension blocks submission if it cannot verify the rewritten composer safely.

More detail lives in [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

## Supported Sites

### Built-in protected sites

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://grok.com/*`
- `https://x.com/*`
- `https://web.whatsapp.com/*`

### User-managed protected sites

- Added from the popup with `Protect This Site` or `Manage Protected Sites`
- Stored as normalized exact origins such as `https://app.example.com/*`
- Paths, query strings, fragments, wildcard rules, and credential-bearing URLs are rejected
- Host access is requested only when the user explicitly enables protection for that site

## Extension UI

### Popup

The popup is the primary control surface.

- Home view shows the current tab, protection status, and `Protect This Site`
- Protected-sites view lets you add, enable, disable, and remove extra sites without leaving the popup
- File Scanner opens an extension-owned page for local text-file scanning and redacted exports
- Secure reveal view shows the raw value for a known placeholder only inside the extension popup

### In-page UI

Protected sites also show a compact top-center status menu.

- Confirms protection is active
- Shows generic sensitive-item and placeholder counts
- Links into extension controls
- Never renders raw secret values into the host page

## Build And Load

1. Clone this repository.
2. Make sure Node.js/npm and Python 3 are available on your PATH.
3. Build every browser target:

```bash
npm run build
```

`npm run build` is an alias for `npm run build:all`. It installs missing npm packages, creates `ai/.venv`, installs Python training dependencies, generates the local AI dataset, trains/exports the local model when stale, and writes all unpacked extension builds under `dist/`.

To build one target only:

```bash
npm run build:chrome
npm run build:chrome-enterprise
npm run build:firefox
npm run build:firefox-enterprise
```

### Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select `dist/chrome/` for the consumer build or `dist/chrome-enterprise/` for the enterprise build.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on...`.
3. Select `dist/firefox/manifest.json` for the consumer build or `dist/firefox-enterprise/manifest.json` for the enterprise build.

Open a built-in protected site or any normal website you want to add from the popup, then click the LeakGuard toolbar icon to verify the popup renders and current-site state loads correctly.

Detailed install and first-smoke steps live in [docs/INSTALL_GUIDE.md](docs/INSTALL_GUIDE.md).

## Enterprise Deployment

LeakGuard's enterprise runtime can now:

- enforce destination actions in the real submit, paste, and typed-content paths with legacy `approvedDestinations` / `blockedDestinations` support and explicit `destinationPolicies` support for `allow`, `redact`, and `block`
- support `managedProtectedSites` so enterprise policy can mark extra origins for LeakGuard protection without user-created site rules
- disable `Allow once` with `allowUserOverride`
- gate user site removal with `allowSiteRemoval`
- store bounded metadata-only audit events when content is blocked or redacted

Browser-managed deployment is still required for force install, hard removal prevention, incognito or InPrivate handling, and developer-mode restrictions. See [docs/ENTERPRISE_DEPLOYMENT.md](docs/ENTERPRISE_DEPLOYMENT.md) for the exact Chrome and Edge policy guidance this repo now expects.

## Testing

### Automated

Run the full regression suite:

```bash
npm test
```

This covers detector hardening, network transformations, composer helpers, typed interception, protected-site management, productization checks, and security regressions.

The browser build outputs are created with:

```bash
npm run build
```

Individual browser targets are also available:

```bash
npm run build:chrome
npm run build:chrome-enterprise
npm run build:firefox
npm run build:firefox-enterprise
```

### Manual

Use these files for browser-side validation:

- [tests/manual_detection_paste_block.txt](tests/manual_detection_paste_block.txt)
- [docs/RELEASE_QA_CHECKLIST.md](docs/RELEASE_QA_CHECKLIST.md)
- [sandbox/composer-harness.html](sandbox/composer-harness.html)

The manual smoke block contains synthetic secrets, passwords, tokens, connection strings, public IPs, and safe literals so you can paste one block and verify detection end to end.

## Repository Layout

- `src/background/service_worker.js`
  Session state, protected-site orchestration, secure reveal routing, and dynamic content-script sync
- `src/content/content.js`
  Composer integration, decision flow, rewrite verification, placeholder click staging, and in-page status panel
- `src/content/composer_helpers.js`
  Shared textarea and contenteditable insertion helpers
- `src/shared/*`
  Detector, redaction, placeholders, public IPv4 classification, transform logic, and site normalization
- `src/popup/*`
  Popup home, protected-sites management, and secure reveal UI
- `src/options/*`
  Secondary extension-managed settings surface
- `src/compat/*`
  Thin browser compatibility helpers for `browser` / `chrome`, storage-session fallback, and platform capability checks
- `manifests/*`
  Base, browser, and enterprise manifest overlays used to generate browser builds
- `scripts/build-extension.mjs`
  Copies shared source into each target dist folder, generates build metadata, and writes the merged manifest
- `dist/chrome`, `dist/chrome-enterprise`, `dist/firefox`, `dist/firefox-enterprise`
  Generated unpacked extension builds for consumer and enterprise targets
- `tests/*`
  Node-based regression coverage

## Publish Readiness

- [docs/CHROME_WEB_STORE_LISTING.md](docs/CHROME_WEB_STORE_LISTING.md)
- [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md)
- [docs/RELEASE_QA_CHECKLIST.md](docs/RELEASE_QA_CHECKLIST.md)
- [tests/manual_detection_paste_block.txt](tests/manual_detection_paste_block.txt)

## Documentation

Start with [docs/README.md](docs/README.md) for the full documentation index. The current documentation inventory, cleanup status, and future roadmap live in [docs/DOCUMENTATION_ROADMAP.md](docs/DOCUMENTATION_ROADMAP.md).

Common entry points:

- [docs/INSTALL_GUIDE.md](docs/INSTALL_GUIDE.md)
- [docs/PROTECTED_SITES_GUIDE.md](docs/PROTECTED_SITES_GUIDE.md)
- [docs/PLACEHOLDERS_AND_REVEAL.md](docs/PLACEHOLDERS_AND_REVEAL.md)
- [docs/FILE_UPLOAD_SCANNING_GUIDE.md](docs/FILE_UPLOAD_SCANNING_GUIDE.md)
- [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md)
- [SECURITY_REVIEW.md](SECURITY_REVIEW.md)
- [docs/BROWSER_COMPATIBILITY_MATRIX.md](docs/BROWSER_COMPATIBILITY_MATRIX.md)
- [docs/ENTERPRISE_DEPLOYMENT.md](docs/ENTERPRISE_DEPLOYMENT.md)
- [docs/MANAGED_POLICY_SCHEMA.md](docs/MANAGED_POLICY_SCHEMA.md)
- [docs/AI_ASSIST.md](docs/AI_ASSIST.md)
- [docs/RELEASE_QA_CHECKLIST.md](docs/RELEASE_QA_CHECKLIST.md)
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## Non-Goals

LeakGuard's non-goals are maintained in [docs/NON_GOALS.md](docs/NON_GOALS.md).
