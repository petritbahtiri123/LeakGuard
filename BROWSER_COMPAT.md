# Browser Compatibility

LeakGuard now builds from one shared source tree into separate unpacked browser targets:

- `dist/chrome`
- `dist/firefox`

## Shared By Default

The following are shared across browsers:

- detector, patterns, placeholders, redaction, and transform logic in `src/shared`
- popup, options, reveal UI, and content-script behavior in `src/*`
- tests and synthetic regression fixtures

## Thin Compatibility Layer

LeakGuard uses a small compatibility layer in `src/compat`:

- `browser_api.js`
  Exposes `globalThis.PWM.ext` from `browser ?? chrome`
- `platform.js`
  Exposes:
  - `isFirefox`
  - `supportsDynamicContentScripts`
  - `supportsStorageSession`
  - `getSessionStorageArea()`

## Known Chrome vs Firefox Differences

- Firefox and Chrome both support Manifest V3 for this extension shape, but background lifecycle behavior can still differ in practice under reloads and idle shutdown.
- LeakGuard prefers dynamic MV3 content-script registration through `scripting.registerContentScripts()` and `scripting.unregisterContentScripts()`.
- LeakGuard prefers `storage.session` for reveal-state and placeholder mappings. If a browser does not expose `storage.session`, LeakGuard falls back to `storage.local` for that session-state path so the extension can still function for testing.

## Current Firefox Fallbacks

- Session-only state uses `storage.session` when available.
- If `storage.session` is unavailable, LeakGuard falls back to `storage.local` for the internal session-state path.
- If dynamic content scripts are unavailable, LeakGuard raises an explicit runtime error instead of silently dropping protected-site functionality.

## Areas Worth Hardening Later

- Verify popup-opening behavior across Firefox builds where `action.openPopup()` may behave differently.
- Exercise dynamic user-managed protected-site registration on real Firefox builds across reloads and browser restarts.
- Reconfirm optional-host-permission prompts and site-enable flows on Firefox ESR and current stable.
- If needed later, add targeted Firefox-specific messaging or storage handling in `platform.js` rather than branching throughout the codebase.
