# Portable Work Memory

This repository keeps the internal codename and repo name `portable-work-memory`, but the public product name is LeakGuard.

LeakGuard is a local-only Chrome extension MVP that reduces the chance of pasting or sending secrets or sensitive public IPv4 network details into AI chat sites by mistake.

It detects likely secrets and public IPv4 hosts/CIDRs in the browser, offers the same `Allow once` / `Redact` decision flow before send, replaces raw values with stable placeholders like `[PWM_1]`, `[PUB_HOST_1]`, and `[NET_1]`, and keeps the private reveal map in `chrome.storage.session` for the active browser session only.

User-managed protected sites are stored separately in `chrome.storage.local` as normalized site rules only. Raw secrets and raw network values are never persisted there.

This project is **risk reduction**, not a perfect privacy guarantee.

## MVP Scope

The current MVP focuses on:

- built-in protection for ChatGPT, OpenAI Chat, Claude, Gemini, Grok, and X
- user-managed exact-site protection for additional `http://` or `https://` sites
- Manifest V3
- local-only detection and redaction
- background service worker state in `chrome.storage.session`
- deterministic placeholder mapping per tab/session
- browser-side interception for paste and submit
- browser-side `Allow once` / `Redact` decision flow for secrets and public IPv4/CIDR values
- popup and options UI for site protection management
- right-side in-page status panel on protected pages
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
  Owns neutral `[PWM_n]` placeholder assignment plus the split between minimized public state and private reveal state.
- `shared/redactor.js`
  Applies placeholders to findings and produces `redactedText`.
- `shared/ipClassification.js`, `shared/ipDetection.js`, `shared/networkHierarchy.js`, `shared/placeholderAllocator.js`, `shared/transformOutboundPrompt.js`
  Detect, classify, and pseudonymize public IPv4 hosts/CIDRs while preserving readable subnet relationships.
- `background/service_worker.js`
  Stores per-tab private session state in `chrome.storage.session`, stores normalized user site rules in `chrome.storage.local`, performs placeholder assignment, dynamically activates protected user sites, and serves secure reveal requests only to extension-owned UI.
- `content/composer_helpers.js`
  Shared textarea/contenteditable read-write helpers used for deterministic browser insertion and the local harness.
- `content/content.js`
  Protected-page integration layer for composer detection, paste interception, submit interception, rewrite verification, badge/modal UI, right-side status panel, and placeholder rehydration.
- `shared/protected_sites.js`
  Normalizes exact-site rules, defines built-in protected AI sites, and keeps matching deterministic and explainable.
- `popup/*`, `options/*`
  Plain HTML/CSS/JS extension UI for current-tab protection and user-managed site rules.
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
- placeholder mapping should remain local to the browser session
- browser submission should be blocked if the rewritten composer content cannot be verified exactly
- placeholder reveal should happen only inside extension-owned UI

For this MVP, raw secret values are stored only in background-owned `chrome.storage.session`, not persistent extension storage or page-visible state. The content script gets only minimal public state needed for runtime behavior, not the session placeholder registry.

Persistent extension storage is limited to normalized protected-site rules such as `https://app.example.com/*`. LeakGuard does not persist raw secrets, raw prompts, or raw network values.

## What This Does Not Protect Against

This extension does not provide complete privacy or guaranteed secrecy.

It does not protect against:

- secrets already present in browser history, screenshots, OS clipboard history, or other extensions
- browser compromise, malware, or local shoulder-surfing
- ChatGPT DOM changes that break heuristics or event interception
- secrets inside files, screenshots, drag/drop payloads, or other unsupported upload flows
- raw values revealed intentionally by the user via the secure extension reveal UI
- copy/paste of raw secrets into sites outside the built-in or user-managed protected site list

## Known Limitations

- ChatGPT DOM churn can still break composer detection or send-button heuristics.
- Contenteditable behavior varies by browser/editor implementation and still needs manual regression checks.
- Placeholder rehydration only works for placeholders created in the current tab/session map.
- Raw secrets are never written into the website DOM. Reveal happens only inside extension-origin UI.
- The extension is Chrome-first and MV3-first; other browsers are out of scope for this MVP.

## Local Setup

1. Clone the repo.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this repository folder.
6. Open one of:
   - `https://chatgpt.com/`
   - `https://chat.openai.com/`
   - `https://claude.ai/`
   - `https://grok.com/`
   - `https://x.com/`
   - `https://gemini.google.com/`
7. Click the LeakGuard toolbar icon to open the popup.
8. Use `Protect This Site` on eligible tabs or open `Manage Protected Sites` to add exact user-managed rules.

## Protected Site Management

LeakGuard ships with these built-in protected AI sites:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://grok.com/*`
- `https://x.com/*`

You can also add extra protected sites yourself.

- The popup shows whether the current tab is already protected.
- `Protect This Site` requests host access only for the current site rule, then activates the same content script stack used on the built-in AI hosts.
- The options page lets you add, enable, disable, and remove user-managed protected sites.
- User-managed rules are normalized to exact scheme + hostname patterns such as `https://app.example.com/*`.
- Paths, query strings, fragments, and ports are not stored as separate rules.
- Wildcards, malformed URLs, and credential-bearing URLs are rejected.

## Right-side Status Panel

Protected pages now include a compact right-side LeakGuard panel.

- It shows that protection is active on the current site.
- It shows a generic count of sensitive items currently detected in the composer.
- It shows the current session placeholder count.
- It can be collapsed.
- It links to the extension settings.
- It never renders raw secret values into the page DOM.

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
- public IPv4/CIDR classification, modal UI findings, deterministic mapping, and hierarchy-aware pseudonymization

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
- intentional blank lines survive contenteditable rewrites
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
10. Type or paste `Allow 8.8.8.8 and 1.1.1.1` and confirm the same `Allow once` / `Redact` modal appears for IPs.
11. Choose `Allow once` for that IP test and confirm the raw IPs remain visible in the composer for that action only.
12. Retry the same IP test and choose `Redact`, then confirm public IPs become placeholders while private/local IPs stay visible in default mode.
13. Press Enter to send and confirm the extension does not submit if rewrite verification fails.
14. Click Send instead of pressing Enter and confirm the same behavior.
15. Start a new chat and confirm the tab/session mapping resets.
16. Let the assistant echo a known placeholder and confirm the secure reveal window can show it only when the current tab session knows that placeholder.
17. Let the assistant echo an unknown placeholder and confirm the secure reveal window reports that it is unavailable without replacing page text.
18. Trigger a route change or response re-render and confirm known placeholders remain revealable only from current session state.
19. Paste a multiline block with empty lines between sections and confirm rewrite verification no longer collapses those blank lines in the ChatGPT composer.

Use these exact regression cases when testing multiline correctness:

```ini
db_password = "AlphaPass_111!!"
backup_password = "BetaPass_222!!"
```

Expected:

```ini
db_password = [PWM_1]
backup_password = [PWM_2]
```

And:

```ini
db_password = "RepeatPass_111!!"
backup_password = "RepeatPass_111!!"
```

Expected:

```ini
db_password = [PWM_1]
backup_password = [PWM_1]
```

## Manual Payload Verification

The privacy claim for this MVP is that, once redaction is accepted and rewrite verification passes, the outbound request payload should contain placeholders instead of raw secrets or raw public IPv4/CIDR values.

Verify that manually:

1. Open ChatGPT.
2. Open DevTools.
3. Go to the `Network` tab.
4. Clear previous traffic.
5. Paste a prompt containing a test secret or a public IPv4/CIDR value and choose `Redact`.
6. Send the prompt.
7. Find the outbound ChatGPT request in `Network`.
8. Inspect the request payload/body.
9. Confirm the payload contains placeholders such as `[PWM_1]`, `[PUB_HOST_1]`, or `[NET_1]` instead of the raw secret or raw public IP/CIDR.

If the request payload contains the raw value, treat that as a blocker.

## Live Debug Flag

For browser-path debugging in the real ChatGPT page, enable console snapshots:

```js
localStorage.setItem("pwm:debug", "1")
```

Then reload the ChatGPT tab and retry the redaction flow. The extension will log sanitized rewrite metadata for each strategy:

- expected length and placeholder counts
- observed `getInputText(input)` length and placeholder counts
- normalized composer shape checks

It will also log reveal-side events:

- whether response-side hydration ran
- whether the secure reveal window opened
- whether the secure reveal request was available in the current session
- whether ChatGPT re-rendered a hydrated node

Disable it with:

```js
localStorage.removeItem("pwm:debug")
```

## Browser Rewrite Guardrails

The browser layer now applies these guardrails:

- multiline composer rewrites are normalized and verified after insertion
- contenteditable reads use DOM-aware block serialization so blank paragraph lines are preserved during verification
- paste redaction computes the next full composer value instead of trusting raw DOM insertion
- submit is blocked if `getInputText(input) !== result.redactedText`
- a stronger fallback rewrite path runs before failure is declared
- if both rewrites fail verification, the original composer text is restored and submission stays blocked
- runtime placeholder consistency is checked before insertion

Current regression coverage includes:

- detector regressions in `tests/detector.test.js`
- composer multiline normalization regressions in `tests/composer_helpers.test.js`

## Placeholder Reveal Rules

The MVP distinction is:

- the input/composer must contain literal placeholders only after redaction
- raw values must not remain in the composer after redaction is accepted
- assistant-response placeholders are inspectable only when the current session map knows that placeholder
- placeholder reveal happens only inside extension-owned UI and never changes the page DOM or composer payload
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
