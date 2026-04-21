# LeakGuard

This repository keeps the internal codename `LeakGuard`, but the public product name is LeakGuard.

LeakGuard is a local-only Chrome extension that reduces accidental prompt leaks on protected sites. It inspects typed or pasted content in supported composers, detects likely secrets and sensitive public IPv4 data before send, and lets you choose `Allow once` or `Redact`.

LeakGuard is a risk-reduction tool, not a guarantee of perfect privacy or complete data-loss prevention.

## V1 Snapshot

- Built-in protection for `chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com`, `grok.com`, and `x.com`
- User-managed protection for additional exact `http://` or `https://` origins
- Local-only detection and redaction in the browser
- Popup-based site management for add, enable, disable, and remove flows
- In-page right-side status panel on protected pages
- Popup-only secure reveal for placeholders
- Session-scoped placeholder state in `chrome.storage.session`
- No cloud processing, telemetry, or backend service

## How LeakGuard Works

1. On a protected site, LeakGuard watches supported chat composers for paste, typing, and send events.
2. If it finds likely secrets or sensitive public IPv4 hosts/CIDRs, it shows an `Allow once` or `Redact` decision flow.
3. If you choose `Redact`, it rewrites the composer with stable placeholders such as `[PWM_1]`, `[PUB_HOST_1]`, and `[NET_1]`.
4. Private raw-to-placeholder mappings stay in the background service worker and `chrome.storage.session` for the active browser session only.
5. Clicking a revealable placeholder stages a secure reveal inside the LeakGuard popup. Raw values are not written back into the page DOM.

## Detection Coverage

LeakGuard currently focuses on high-value prompt leak cases such as:

- API keys, access tokens, PATs, OAuth-style tokens, bearer tokens, and JWTs
- Passwords, client secrets, cookie/session-style values, and generic secret assignments
- Webhook URLs, Docker auth blobs, cloud connection strings, and auth headers
- Database URLs and connection strings while preserving URI shape and masking only the secret segment
- Public IPv4 hosts and public IPv4 CIDR ranges

The detector is heuristic by design. It is tuned to catch realistic mistakes while suppressing obvious docs placeholders and safe literals where possible.

## Security Model

- Raw secrets are not sent to external services by the extension.
- Raw secrets are not persisted in `chrome.storage.local`.
- Persistent local storage is limited to normalized protected-site rules.
- Raw values are kept only in session-scoped background storage so secure reveal can work during the active tab session.
- Secure reveal is restricted to extension-owned UI.
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
- Secure reveal view shows the raw value for a known placeholder only inside the extension popup

### In-page UI

Protected sites also show a compact right-side status panel.

- Confirms protection is active
- Shows generic sensitive-item and placeholder counts
- Links into extension controls
- Never renders raw secret values into the host page

## Local Setup

1. Clone this repository.
2. Run `npm test`.
3. Open `chrome://extensions`.
4. Enable `Developer mode`.
5. Click `Load unpacked`.
6. Select this repository folder.
7. Open a built-in protected site or any normal website you want to add from the popup.
8. Click the LeakGuard toolbar icon to verify the popup renders and current-site state loads correctly.

## Testing

### Automated

Run the full regression suite:

```bash
npm test
```

This covers detector hardening, network transformations, composer helpers, typed interception, protected-site management, productization checks, and security regressions.

### Manual

Use these files for browser-side validation:

- [tests/manual_detection_paste_block.txt](tests/manual_detection_paste_block.txt)
- [docs/RELEASE_QA_CHECKLIST.md](docs/RELEASE_QA_CHECKLIST.md)
- [sandbox/composer-harness.html](sandbox/composer-harness.html)

The manual smoke block contains synthetic secrets, passwords, tokens, connection strings, public IPs, and safe literals so you can paste one block and verify detection end to end.

## Repository Layout

- `manifest.json`
  Manifest V3 extension definition, built-in protected hosts, and runtime permissions
- `background/service_worker.js`
  Session state, protected-site orchestration, secure reveal routing, and dynamic content-script sync
- `content/content.js`
  Composer integration, decision flow, rewrite verification, placeholder click staging, and in-page status panel
- `content/composer_helpers.js`
  Shared textarea and contenteditable insertion helpers
- `shared/*`
  Detector, redaction, placeholders, public IPv4 classification, transform logic, and site normalization
- `popup/*`
  Popup home, protected-sites management, and secure reveal UI
- `options/*`
  Secondary extension-managed settings surface
- `tests/*`
  Node-based regression coverage

## Publish Readiness

- [docs/CHROME_WEB_STORE_LISTING.md](docs/CHROME_WEB_STORE_LISTING.md)
- [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md)
- [docs/RELEASE_QA_CHECKLIST.md](docs/RELEASE_QA_CHECKLIST.md)
- [tests/manual_detection_paste_block.txt](tests/manual_detection_paste_block.txt)

## Documentation

- [SECURITY_REVIEW.md](SECURITY_REVIEW.md)
- [docs/CHROME_WEB_STORE_LISTING.md](docs/CHROME_WEB_STORE_LISTING.md)
- [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md)
- [docs/RELEASE_QA_CHECKLIST.md](docs/RELEASE_QA_CHECKLIST.md)
- [tests/manual_detection_paste_block.txt](tests/manual_detection_paste_block.txt)

## Non-Goals

LeakGuard does not currently try to cover:

- File uploads, screenshots, drag-and-drop payloads, or every editor implementation
- Every browser or every website
- Malware, hostile extensions, compromised browsers, or OS-level clipboard/history exposure
- Full enterprise DLP or guaranteed prevention of all sensitive-data leaks
