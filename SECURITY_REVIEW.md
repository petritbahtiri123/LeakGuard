# Security Review

## Scope

This pass hardened the MVP around one rule:

- raw secrets must never be written into website DOM

The audit covered:

- content script DOM sinks
- background/runtime messaging
- storage boundaries
- reveal UX paths
- debug logging
- harness/tests/docs that codified unsafe patterns

## Issues Found

1. `content/content.js` could request raw secrets from the background with `PWM_GET_RAW_BY_PLACEHOLDER` and write them back into page-owned spans on click.
2. Page DOM leaked secret metadata through classified placeholders such as `[PASSWORD_1]`, type-colored spans, badge text, and modal rows with secret types and masked raw fragments.
3. Public state crossing from background to content script included reversible raw mappings.
4. Rewrite failure UI and debug snapshots could expose raw or near-raw composer content in page DOM or console output.
5. The local harness demonstrated the same unsafe raw-to-page reveal pattern, which reinforced the wrong architecture.

## Issues Fixed

- Removed the content-script raw lookup path for page rendering.
- Removed page-DOM reveal, reveal timers, and any raw replacement of placeholder spans.
- Replaced classified placeholders with neutral `[PWM_n]` placeholders.
- Moved stable placeholder assignment into the background so the content script no longer owns session raw mappings.
- Split state into:
  - public state: `sessionId`, `counters`, `knownPlaceholders`
  - private state: `fingerprintToPlaceholder`, `placeholderToFingerprint`, `secretByFingerprint`
- Added a secure extension-owned reveal surface under `ui/reveal_panel.html` rendered inside a `chrome-extension://` iframe.
- Switched reveal launching to opaque request ids created by the background.
- Restricted raw reveal responses to extension UI senders only.
- Removed masked raw previews and secret-type labels from page badge/modal UI.
- Sanitized debug logging and rewrite-failure reporting so they no longer dump raw composer text.
- Removed unsafe raw reveal behavior from the local harness.
- Added regression tests for neutral placeholders, sanitized public state, and forbidden legacy reveal patterns.

## Exact Old Leak Paths Removed

- `content/content.js`
  - removed `lookupRawByPlaceholder(...)`
  - removed `PWM_GET_RAW_BY_PLACEHOLDER` usage
  - removed click handlers that changed page span text from placeholder to raw secret
  - removed timer-based reveal/reset behavior tied to page DOM
- `background/service_worker.js`
  - removed the legacy raw lookup handler used by content scripts for page rendering
- `content/content.js` UI
  - removed masked raw previews from the decision modal
  - removed type/classification text from badge and modal rows

## Safe Reveal Architecture

1. The content script leaves inert `[PWM_n]` placeholders in the page DOM.
2. Clicking a placeholder asks the background to create an opaque reveal request id.
3. The content script opens an extension-owned iframe using only that opaque request id.
4. The iframe page calls the background directly from `chrome-extension://` origin.
5. The background verifies the sender is extension UI before returning raw secret data.
6. Raw secret text renders only inside the iframe document, never in the website DOM.

## Private vs Public State

### Public state exposed to the content script

- `sessionId`
- `counters`
- `knownPlaceholders`

### Private state kept in the background

- `fingerprintToPlaceholder`
- `placeholderToFingerprint`
- `secretByFingerprint`

Notes:

- repeated same-secret mapping now uses a session-scoped fingerprint instead of raw string keys
- raw secrets still live only in background-owned session storage because reveal requires them

## Additional Audit Notes

Repository scan and low-risk remediation covered:

- DOM sinks: reviewed `textContent`, `innerText`, `innerHTML`, attributes, dataset usage
- messaging: reviewed runtime message types and removed raw-returning content-script path
- storage: verified raw secrets remain scoped to background `chrome.storage.session`
- logs: sanitized debug paths in the content script
- URL leakage: reveal iframe uses opaque request ids only; no raw values in URL parts
- CSS/UI leakage: removed classified placeholder styling and page-visible masked previews
- tests/utilities/docs: updated harness/tests/docs to match the secure model

## Residual Risks

- Raw secrets still pass through the content script transiently while reading the composer for detection/redaction. That is inherent to local browser-side interception.
- Raw secrets remain in background `chrome.storage.session` for the active tab session so secure reveal can work after service worker restarts.
- The session fingerprint is scoped and non-reversible in practice for this MVP design, but it is still an in-extension implementation detail rather than a hardened cryptographic vault.
- A hostile page can observe that a placeholder was clicked and that a generic extension iframe appeared, but it cannot read the iframe DOM or any revealed raw text.

## Verification

- `npm test`
- `node --check content/content.js`
- `node --check background/service_worker.js`
- `node --check ui/reveal_panel.js`
- `node --check sandbox/composer-harness.js`
