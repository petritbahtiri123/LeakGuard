# LeakGuard Chrome Web Store Listing

## Product Name

LeakGuard

## One-line Summary

Protect prompts and local text files by redacting likely secrets and public IPv4 details locally in Chrome.

## Short Description

LeakGuard helps prevent accidental leaks by detecting likely secrets and public IPv4 data in supported chat composers and selected local text files.

## Detailed Description

LeakGuard is a local-only Chrome extension for people who work with prompts, credentials, infrastructure data, and AI chat tools.

Before text is sent from a protected site, LeakGuard can:

- detect likely secrets such as API keys, tokens, passwords, client secrets, webhook URLs, connection strings, Docker auth blobs, and cookie-style session values
- detect public IPv4 hosts and public IPv4 CIDR ranges
- show an `Allow once` or `Redact` decision flow before submission
- replace raw values with stable placeholders such as `[PWM_1]`, `[PUB_HOST_1]`, and `[NET_1]`
- keep secure reveal local to the extension popup instead of exposing raw values in the page DOM

LeakGuard also includes a local File Scanner page for text-based files such as `.env`, `.json`, `.log`, `.md`, source files, and config files. It can export redacted text copies and sanitized JSON findings reports without storing file contents or uploading them.

For protected AI composers, supported local UTF-8 text files pasted or dropped into the page can be locally validated, redacted, and inserted as redacted text. If the file is unsupported or invalid, or if safe insertion fails, LeakGuard blocks raw insertion/upload and shows a local message.

LeakGuard is designed for risk reduction, not as a complete data-loss-prevention product.

### Current launch scope

- built-in protection for ChatGPT, OpenAI Chat, Claude, Gemini, Grok, and X
- user-managed exact-site protection for additional sites
- local-only detection and redaction
- local text-file scanning with redacted-copy and sanitized-report exports
- local text-file paste/drop redaction for supported UTF-8 text files in protected AI composers
- safe blocking on unsupported files or failed insertion
- Manifest V3 service-worker architecture
- deterministic per-session placeholder mapping
- secure reveal only inside extension-owned UI

### What LeakGuard does not do

- no cloud processing
- no telemetry
- no backend service
- no promise of perfect privacy or complete secret protection
- no PDF, DOCX, image OCR, or visual image redaction in this release
- no support for every editor, upload flow, or browser

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

Used to store normalized protected-site rules and session-scoped prompt placeholder maps locally in the browser. File Scanner and local file paste/drop contents are not stored in extension storage.

### `scripting`

Used to register and activate content scripts for built-in and user-managed protected sites in Manifest V3.

### `activeTab`

Used so the popup can inspect the current tab, show protection status, and activate protection for the current site.

### optional host permissions for `http://*/*` and `https://*/*`

Used only when the user explicitly enables protection for an additional site. LeakGuard does not request broad access up front for every website.

## Screenshot Plan

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
- Supported local text files pasted or dropped into protected AI composers are processed locally, and raw contents are blocked if redacted insertion cannot complete.
- Raw secrets are not sent to external services by the extension.
- Sanitized File Scanner JSON reports do not include raw secrets by default.
- User-managed sites are exact origin rules, not wildcard rules.
- Secure reveal is confined to extension-owned UI.
