# LeakGuard
[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/petritbahtiri)
LeakGuard is a local-only browser extension for reducing accidental prompt leaks on AI chat sites.

The public product name is LeakGuard.

It watches supported composers for typed or pasted content, detects likely secrets and sensitive public IPv4 data before submission, and lets you choose `Redact` or `Allow once`.

LeakGuard does not use a backend service or cloud processing. It is designed for practical risk reduction, not perfect privacy or full enterprise DLP.

> Local-only. No backend. No telemetry. Secure reveal stays inside extension-owned UI..

## ❤️ Support LeakGuard

LeakGuard is a privacy-first AI protection tool that helps prevent accidental data leaks when using ChatGPT, Gemini, and other AI platforms.

Everything runs locally:
- No cloud processing
- No tracking
- No data collection

If you want to support development and upcoming features like:
- File scanning (env, logs, configs)
- PDF & DOCX detection
- Image OCR redaction

👉 You can support here:
https://ko-fi.com/petritbahtiri

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

### Local AI Assist

LeakGuard can optionally run a tiny local ONNX classifier on medium-confidence deterministic findings. This AI layer is only an assist: it can upgrade uncertain findings or keep them as warnings, but it cannot downgrade high-confidence deterministic detections.

Training, export, browser smoke tests, and enterprise disable guidance live in [docs/AI_ASSIST.md](docs/AI_ASSIST.md).

## Security Model

- Raw secrets are not sent to external services by the extension.
- Raw secrets are not persisted in `chrome.storage.local`.
- Persistent local storage is limited to normalized protected-site rules.
- Raw values are kept only in session-scoped background storage so secure reveal can work during the active tab session.
- Secure reveal is restricted to extension-owned UI.
- Extension pages use a restrictive CSP: `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`.
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

- [SECURITY_REVIEW.md](SECURITY_REVIEW.md)
- [BROWSER_COMPAT.md](BROWSER_COMPAT.md)
- [docs/BUILD_TARGETS.md](docs/BUILD_TARGETS.md)
- [docs/ENTERPRISE_DEPLOYMENT.md](docs/ENTERPRISE_DEPLOYMENT.md)
- [docs/AI_ASSIST.md](docs/AI_ASSIST.md)
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
