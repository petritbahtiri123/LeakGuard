# LeakGuard 3.0.0 Reliability Pass Design

## Objective

Reduce three reproduced or directly reachable avoidable failures without weakening LeakGuard's fail-closed boundary: concurrent placeholder-state loss, cross-file extraction-cache reuse, and verified Enter sends that stall when the send button is temporarily absent.

## Evidence and selected approach

The release inventory considered three approaches:

1. Add a shared retry framework across adapters. This was rejected because generic DOM retries can duplicate sends or uploads and would broaden a security-sensitive surface without live evidence.
2. Update site selectors and timeouts broadly. This was rejected because current-site selector effectiveness was not reproduced for every adapter and speculative selectors age badly.
3. Fix state ownership and an existing replay fallback at their current owners. This is selected because each defect has a narrow root cause, an existing safe pattern, and a focused regression boundary.

The selected fixes are:

- serialize background redaction mutations per tab so concurrent files cannot read the same placeholder state and overwrite one another;
- key the in-memory extraction cache by `File` object identity, while keeping only opaque identity tokens and sanitized results in the bounded cache;
- let verified non-WhatsApp Enter replay reach the existing form-derived submit path when no visible send button is available.

## Design

### Per-tab redaction mutation queue

`src/background/core.js` will own a `Map<tabId, Promise>` queue. `redactForTab()` will enqueue its existing redaction operation by tab. Operations for different tabs remain concurrent; operations for the same tab run in arrival order. A failed operation must not poison the queue, and the queue entry must be removed after its last operation settles.

No raw text, findings, or placeholder state is stored in the queue map. The queue contains only promises and numeric tab identifiers. Policy evaluation, deterministic background rescanning, audit behavior, and state persistence remain unchanged inside the serialized operation.

### File extraction cache identity

`src/content/files/fileExtractionSessionCache.js` will retain its bounded, TTL-based `Map`, but its keys will become opaque per-object tokens. A `WeakMap<File, token>` will supply a stable token for the same in-memory file object without retaining the raw `File`. Metadata signatures remain diagnostic-only and must not authorize a cache hit.

The same `File` object can still reuse a sanitized result. A different `File` object with identical name, size, modification time, and MIME type must miss and be extracted independently. Cache snapshots remain metadata-only and bounded to 24 entries.

### Verified Enter replay fallback

`src/content/composer/fallbackSendKeyOrchestration.js` will centralize the five identical replay callbacks. After rewrite verification, it will rediscover the send button. WhatsApp will retain its adapter-specific block when no button exists. Other adapters will call the existing `replayVerifiedSend(input, null, button)` even when `button` is null, allowing `src/content/content.js` to derive the composer form and use `requestSubmit()`.

The change does not create a second send attempt: the original Enter event remains consumed, the verified-send queue remains the only replay owner, and the helper is invoked exactly once.

## Failure behavior retained

Malformed, encrypted, unreadable, oversized, image-only PDF, unsafe OCR-box, unsupported file, failed sanitized handoff, and final rewrite-verification paths remain blocked. WhatsApp file-only/image-only flows keep adapter-specific verified handoff and never gain text fallback. Enterprise policy, consumer defaults, CSP, permissions, local-only processing, and audit payload shapes remain unchanged.

## Validation

Each fix starts with a focused failing regression:

- background queue ordering, cross-tab concurrency, and failure recovery in `tests/security.test.js`;
- identical-metadata distinct-file cache isolation in `tests/content_file_extraction_pipeline.test.js`;
- non-WhatsApp form replay and WhatsApp missing-button block in `tests/fallback_send_key_orchestration.test.js`.

After focused red-green cycles, run change-aware validation, the full suite, text/file/multi-file E2E groups, Chrome and Firefox builds/smokes, hot-path and file-extraction benchmarks, documentation links, syntax checks, and `git diff --check`. Live authenticated adapter QA remains a manual 3.0.0 gate and is not implied by local green tests.

## Documentation and rollback

Add one concise 3.0.0 reliability report containing the grouped failure inventory, classifications, fixed paths, intentionally retained blocks, known adapter gaps, and manual QA matrix. Do not relabel prior 2.x live-browser evidence.

Each runtime fix is independently revertible. Reverting the queue restores concurrent state mutation, reverting cache identity restores metadata-keyed reuse, and reverting replay fallback restores the no-button stall; none of those rollbacks may introduce raw replay or weaken fail-closed behavior.
