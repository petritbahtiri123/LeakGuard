# LeakGuard Install Guide

This guide covers local development installs from this repository. Store installs should use the published store package once available.

LeakGuard currently builds Chrome and Firefox targets from one source tree:

- `dist/chrome`
- `dist/chrome-enterprise`
- `dist/firefox`
- `dist/firefox-enterprise`

## Prerequisites

- Node.js and npm on your `PATH`
- Python 3 on your `PATH`
- Chrome, Chromium, Edge, or Firefox for manual testing

The build prepares local AI assets, installs Python training dependencies when needed, and writes unpacked extension folders under `dist/`.

## Build

Build every target:

```bash
npm run build
```

Build one target:

```bash
npm run build:chrome
npm run build:chrome-enterprise
npm run build:firefox
npm run build:firefox-enterprise
```

## Load In Chrome Or Chromium

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select `dist/chrome` for the consumer build or `dist/chrome-enterprise` for the enterprise build.
5. Open a built-in protected site such as `https://chatgpt.com/`.
6. Click the LeakGuard toolbar icon and confirm the popup renders.

## Load In Microsoft Edge

Edge is Chromium-based, but this repository does not currently publish a separate Edge build target.

1. Open `edge://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select `dist/chrome` for the consumer build or `dist/chrome-enterprise` for the enterprise-style build.
5. Run the same smoke checks used for Chrome before claiming Edge support for a release.

For managed Edge deployment notes, see [ENTERPRISE_DEPLOYMENT.md](ENTERPRISE_DEPLOYMENT.md).

## Load In Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on...`.
3. Select `dist/firefox/manifest.json` for the consumer build or `dist/firefox-enterprise/manifest.json` for the enterprise build.
4. Open a built-in protected site and confirm the popup and in-page status menu render.

Temporary Firefox add-ons are removed when the browser closes. Rebuild and reload after source changes.

## First Smoke Test

Use synthetic values only.

1. Open a protected site.
2. Paste a small block such as:

```text
API_KEY=LeakGuardSyntheticKey1234567890
Authorization: Bearer LeakGuardBearerToken1234567890
PUBLIC_IP=8.8.8.8
PRIVATE_IP=10.0.0.5
```

3. Choose `Redact`.
4. Confirm likely secrets become `[PWM_N]` placeholders and the public IP becomes a network placeholder.
5. Confirm private IPs and obvious safe literals stay visible where expected.

## File Scanner Smoke Test

1. Open the popup.
2. Click `Open File Scanner`.
3. Select a supported UTF-8 text file such as `.env`, `.json`, `.md`, `.log`, or `.csv`.
4. Confirm the preview and downloads contain placeholders instead of detected raw secrets.

See [FILE_UPLOAD_SCANNING_GUIDE.md](FILE_UPLOAD_SCANNING_GUIDE.md) for file limits and upload behavior.

## Common Load Issues

- If Chrome reports a manifest error, rebuild with `npm run build:chrome` and load the target folder again.
- If Firefox keeps an old temporary add-on, remove it from `about:debugging` and reload `dist/firefox/manifest.json`.
- If the popup does not open after a rebuild, reload the extension page and refresh the protected site.
- If optional site protection fails, confirm you granted the exact origin requested by the popup.

For broader debugging, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
