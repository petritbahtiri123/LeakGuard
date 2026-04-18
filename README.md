# Portable Work Memory

Portable Work Memory is a local-only Chrome extension MVP that reduces the chance of pasting or sending secrets into ChatGPT by mistake.

It detects likely secrets in the browser, offers redaction before send, replaces raw values with stable placeholders like `[PASSWORD_1]`, and keeps the raw-to-placeholder map in `chrome.storage.session` for the active browser session only.

This project is **risk reduction**, not a perfect privacy guarantee.

## MVP Scope

The current MVP focuses on:

- ChatGPT web UI only
- Manifest V3
- local-only detection and redaction
- background service worker state in `chrome.storage.session`
- deterministic placeholder mapping per tab/session
- browser-side interception for paste and submit
- local placeholder rehydration for assistant responses in the same session

The MVP intentionally does not add:

- cloud calls
- telemetry
- backend services
- build tooling
- framework-specific frontend infrastructure

## Architecture

The project is split into engine logic and browser delivery logic.

- `shared/detector.js`
  Detects likely secrets using deterministic patterns, assignment scanning, entropy fallback, overlap resolution, allowlists, and negative-context suppression.
- `shared/placeholders.js`
  Owns stable raw-to-placeholder and placeholder-to-raw mapping.
- `shared/redactor.js`
  Applies placeholders to findings and produces `redactedText`.
- `background/service_worker.js`
  Stores per-tab session state in `chrome.storage.session` so MV3 service worker restarts do not lose the placeholder map.
- `content/composer_helpers.js`
  Shared textarea/contenteditable read-write helpers used for deterministic browser insertion and the local harness.
- `content/content.js`
  ChatGPT integration layer for composer detection, paste interception, submit interception, rewrite verification, badge/modal UI, and placeholder rehydration.
- `sandbox/composer-harness.html`
  Local manual harness for isolating textarea/contenteditable insertion behavior outside ChatGPT.

## Security Guarantee (MVP)

- Secrets are redacted before leaving the browser
- No external API calls
- No cloud processing
- Local-only placeholder mapping

## Security Model

Current design assumptions:

- raw secrets should be detected and redacted before the user sends the prompt
- raw-to-placeholder mapping should remain local to the browser session
- browser submission should be blocked if the rewritten composer content cannot be verified exactly
- placeholder reveal is local-only and temporary

For this MVP, raw secret values are stored only in `chrome.storage.session`, not persistent extension storage.

## What This Does Not Protect Against

This extension does not provide complete privacy or guaranteed secrecy.

It does not protect against:

- secrets already present in browser history, screenshots, OS clipboard history, or other extensions
- browser compromise, malware, or local shoulder-surfing
- ChatGPT DOM changes that break heuristics or event interception
- secrets inside files, screenshots, drag/drop payloads, or other unsupported upload flows
- raw values revealed intentionally by the user via the local placeholder reveal UI
- copy/paste of raw secrets into sites outside the configured ChatGPT hosts

## Known Limitations

- ChatGPT DOM churn can still break composer detection or send-button heuristics.
- Contenteditable behavior varies by browser/editor implementation and still needs manual regression checks.
- Placeholder rehydration only works for placeholders created in the current tab/session map.
- The reveal interaction still puts the raw secret into the page DOM briefly while revealed.
- The extension is Chrome-first and MV3-first; other browsers are out of scope for this MVP.

## Local Setup

1. Clone the repo.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this repository folder.
6. Open `https://chatgpt.com/` or `https://chat.openai.com/`.

## Detector Tests

Run the unit test suite:

```bash
npm test
```

This currently covers:

- deterministic fixture detection
- enterprise-focused secret families across cloud, package, webhook, and session patterns
- per-pattern suppression and example/doc false-positive cases
- repeated same secret placeholder reuse
- repeated different secrets of the same type
- multiline placeholder correctness
- multiline mixed-secret regression coverage
- DB URIs with credentials
- Basic auth headers and URI credentials
- overlap behavior for bearer tokens and JWTs
- allowlists
- example/sample values that should not trigger
- placeholder-state rehydration for reveal lookup

## Local Harness

Open the harness directly in a browser:

- `sandbox/composer-harness.html`

The harness includes:

- one `<textarea>`
- one `contenteditable` composer
- the same shared composer helper layer used by the extension
- quick scenario buttons for multiline AWS credentials, JWT/Bearer, PEM/private key, webhook payloads, repeated same value, repeated different values, mixed multiline secrets, and normal safe text
- a small reveal lab for known placeholder, unknown placeholder, and route-change re-render sanity checks

Use it to confirm:

- line boundaries survive rewrites
- `getInputText()` matches the expected redacted text
- contenteditable fallback rewrite still preserves placeholder boundaries

## Manual Smoke Test Checklist

Run these in Chrome after loading the unpacked extension.

1. Paste a multiline secret block into the ChatGPT composer.
2. Choose `Redact`.
3. Confirm the visible composer keeps each original line intact.
4. Confirm multiline AWS credentials become distinct placeholders and line boundaries remain intact.
5. Confirm JWT/Bearer input produces one token finding after overlap resolution.
6. Confirm PEM/private key input redacts as a single block.
7. Confirm webhook input redacts the webhook URL rather than surrounding text.
8. Confirm different password values become different placeholders.
9. Confirm repeated identical values reuse the same placeholder.
10. Press Enter to send and confirm the extension does not submit if rewrite verification fails.
11. Click Send instead of pressing Enter and confirm the same behavior.
12. Start a new chat and confirm the tab/session mapping resets.
13. Let the assistant echo a known placeholder and confirm local reveal works only when the current session map knows that placeholder.
14. Let the assistant echo an unknown placeholder and confirm reveal fails gracefully without replacing it with raw text.
15. Trigger a route change or response re-render and confirm known placeholders remain revealable from current session state only.

Use these exact regression cases when testing multiline correctness:

```ini
db_password = "AlphaPass_111!!"
backup_password = "BetaPass_222!!"
```

Expected:

```ini
db_password = [PASSWORD_1]
backup_password = [PASSWORD_2]
```

And:

```ini
db_password = "RepeatPass_111!!"
backup_password = "RepeatPass_111!!"
```

Expected:

```ini
db_password = [PASSWORD_1]
backup_password = [PASSWORD_1]
```

## Manual Payload Verification

The privacy claim for this MVP is that, once redaction is accepted and rewrite verification passes, the outbound request payload should contain placeholders instead of raw secrets.

Verify that manually:

1. Open ChatGPT.
2. Open DevTools.
3. Go to the `Network` tab.
4. Clear previous traffic.
5. Paste a prompt containing a test secret and choose `Redact`.
6. Send the prompt.
7. Find the outbound ChatGPT request in `Network`.
8. Inspect the request payload/body.
9. Confirm the payload contains placeholders such as `[PASSWORD_1]` instead of the raw secret.

If the request payload contains the raw value, treat that as a blocker.

## Live Debug Flag

For browser-path debugging in the real ChatGPT page, enable console snapshots:

```js
localStorage.setItem("pwm:debug", "1")
```

Then reload the ChatGPT tab and retry the redaction flow. The extension will log, for each rewrite strategy:

- expected redacted text
- `getInputText(input)`
- `input.innerText`
- `input.textContent`
- `input.innerHTML`

It will also log reveal-side events:

- placeholder token seen during response rehydration
- whether response-side hydration ran
- whether local/background placeholder lookup succeeded
- whether reveal click fired
- whether ChatGPT re-rendered a hydrated node

Disable it with:

```js
localStorage.removeItem("pwm:debug")
```

## Browser Rewrite Guardrails

The browser layer now applies these guardrails:

- multiline composer rewrites are normalized and verified after insertion
- paste redaction computes the next full composer value instead of trusting raw DOM insertion
- submit is blocked if `getInputText(input) !== result.redactedText`
- a stronger fallback rewrite path runs before failure is declared
- if both rewrites fail verification, the original composer text is restored and submission stays blocked
- runtime placeholder consistency is checked before insertion

## Placeholder Reveal Rules

The MVP distinction is:

- the input/composer must contain literal placeholders only after redaction
- raw values must not remain in the composer after redaction is accepted
- assistant-response placeholders are revealable only when the current session map knows that placeholder
- placeholder reveal is local-only and temporary; it does not change the composer payload
- assistant-response hydration may re-run after ChatGPT DOM churn, but composer/input content is never hydrated into raw values

## Development Notes

Important project constraints:

- keep Manifest V3
- keep processing local-only
- keep `chrome.storage.session` for the MVP placeholder map
- keep engine/browser separation intact
- do not add cloud calls or telemetry
- do not move raw values into persistent storage

## Roadmap

Likely next steps after this issue:

- add browser automation around the local harness
- harden ChatGPT-specific composer heuristics against more DOM variants
- extend support for file uploads and drag/drop with explicit opt-in flows
- add more secret patterns and structured false-positive suppressors
- improve placeholder reveal UX without increasing raw-value exposure
