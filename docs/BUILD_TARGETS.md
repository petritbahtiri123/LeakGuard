# LeakGuard Build Targets

LeakGuard uses one shared source tree and produces four unpacked extension targets:

- `npm run build:chrome`
- `npm run build:chrome-enterprise`
- `npm run build:firefox`
- `npm run build:firefox-enterprise`

## Output Folders

Builds are written to:

- `dist/chrome`
- `dist/chrome-enterprise`
- `dist/firefox`
- `dist/firefox-enterprise`

Each build includes:

- a merged `manifest.json`
- shared `src/` assets
- copied `icons/` and `config/`
- generated `shared/build_info.js`

## Build Model

LeakGuard does not fork the codebase for enterprise.

The build pipeline combines:

- `manifests/base.json`
- `manifests/chrome.json` or `manifests/firefox.json`
- `manifests/chrome-enterprise.json` or `manifests/firefox-enterprise.json` for enterprise mode

The builder lives at `scripts/build-extension.mjs` and accepts:

```bash
node scripts/build-extension.mjs --browser chrome --mode consumer
node scripts/build-extension.mjs --browser chrome --mode enterprise
node scripts/build-extension.mjs --browser firefox --mode consumer
node scripts/build-extension.mjs --browser firefox --mode enterprise
```

## Consumer vs Enterprise

Consumer builds keep the current LeakGuard behavior:

- secure reveal enabled
- user-added protected sites enabled
- HTTP remains supported
- no enterprise managed-policy dependency

Enterprise builds change defaults through policy, not through a separate source tree:

- secure reveal disabled by default
- user-added protected sites disabled by default
- HTTP secrets blocked by default
- managed policy overrides supported where `storage.managed` is available

Default enterprise policy lives in `config/policy.enterprise.json`.

## Managed Policy Overrides

The policy loader in `src/shared/policy.js`:

- loads consumer or enterprise defaults from `config/policy.consumer.json` or `config/policy.enterprise.json`
- attempts `chrome.storage.managed` / `browser.storage.managed`
- merges managed values over packaged defaults
- can fail closed in enterprise mode if `strictPolicyLoad` is enabled and managed policy is invalid or unavailable

Chrome enterprise builds declare `config/managed_policy_schema.json` in the manifest so managed storage policy can be validated by Chrome.

## Chrome and Firefox Notes

Chrome builds use the MV3 service worker path from `src/background/service_worker.js`.

Firefox builds keep the background-script overlay from `manifests/firefox.json` and load the same shared runtime modules in a Firefox-compatible manifest shape.

The extension-page CSP is shared across all targets:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';"
}
```
