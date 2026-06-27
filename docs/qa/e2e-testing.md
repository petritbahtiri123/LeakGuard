# LeakGuard E2E Testing

LeakGuard has a deterministic Playwright E2E layer for real Chromium extension behavior without using live chat accounts.

## Deterministic CI E2E

Use:

```powershell
npm run build:chrome
npm run test:e2e
```

The suite loads the unpacked Chrome build with Chromium's persistent-context extension pattern:

- `--disable-extensions-except=<temporary extension copy>`
- `--load-extension=<temporary extension copy>`
- MV3 service worker discovery to get the extension id
- local `http://127.0.0.1` fixture pages registered as a user-managed protected site

The helper copies `dist/chrome` to a temporary test directory and grants `http://127.0.0.1/*` only on that throwaway copy. Production manifests and permissions are not changed for the fixture.

The local fixture covers textarea and contenteditable composers, send button clicks, Enter-to-send, Shift+Enter multiline editing, sent-output capture, file input, and drop-zone file simulation. It uses synthetic markers only, such as `LGQA_E2E_CLICK_1` and fake password strings.

Failure artifacts are written under `artifacts/playwright-e2e-results` and the HTML report under `artifacts/playwright-e2e-report`.

## Local Debug Modes

Use headed mode when investigating browser UI behavior:

```powershell
npm run test:e2e:headed
```

Use Playwright debug mode for inspector-driven diagnosis:

```powershell
npm run test:e2e:debug
```

## Manual Live-Site E2E

Live ChatGPT, Gemini, WhatsApp, Claude, Grok, OpenAI Chat, or X checks remain manual smoke tests. They may require tester-owned accounts, bot checks, or provider-specific UI state, so they are not required for CI.

Manual live-site checks should use only synthetic fixtures from this repository, keep prompt capture local to DevTools or local QA notes, and avoid screenshots or logs containing account data.

## Why CI Does Not Require Real Accounts

Real-account CI would be flaky and unsafe: providers can change login flows, rate-limit, require MFA, display private account state, or block automation. The deterministic fixture proves the extension loads in real Chromium, injects on a protected page, intercepts browser events, rewrites the composer, blocks unsafe file paths, and opens extension UI without relying on external services.

Live-site QA is still valuable before releases, but it is evidence for provider DOM compatibility, not a replacement for deterministic CI coverage.
