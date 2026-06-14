# Phase 20B-4A Replacement Sorting Equivalence Review

## Goal

Review whether redundant replacement sorting in `src/shared/transformOutboundPrompt.js` and `src/shared/streamingFileRedactor.js` can be removed without changing redaction behavior.

This phase is review-first. It does not implement the optimization.

## Scope

Reviewed files:

- `src/shared/transformOutboundPrompt.js`
- `src/shared/streamingFileRedactor.js`
- `src/shared/detector.js`
- `src/shared/knownSecretReuse.js`
- `tests/detector.test.js`
- `tests/adversarial_redaction.test.js`
- `tests/placeholder_trust.test.js`
- `tests/ip_transform.test.js`
- `tests/streaming_file_redactor.test.js`
- `tests/file_drop_streaming_guards.test.js`
- `tests/performance/redaction-benchmark.mjs`

No detector rules, redaction semantics, placeholder allocation rules, adapters, permissions, CSP, dependencies, telemetry, or remote calls were changed.

## Current Sorting Map

### `transformOutboundPrompt.js`

Replacement creation:

- Secret replacements are created from `options.findings` after filtering trusted visible placeholders. They are iterated as `secretFindings.sort((left, right) => left.start - right.start)`.
- Placeholder numbering for detected secrets is determined during this sorted secret iteration via `manager.getPlaceholder(finding.raw, ...)`.
- Known-secret reuse replacements are collected by `KnownSecretReuse.collectKnownSecretReplacements(normalizedText, manager, [])`.
- Network replacements are created by `buildNetworkReplacements(normalizedText, manager, mode)`, with network placeholder allocation handled by `NetworkPlaceholderAllocator`.

Overlap handling before final replacement application:

- `Detector.resolveOverlaps()` sorts candidate findings by descending score, then full-value preference, exact-key preference, descending range length, then ascending start. It accepts non-overlapping winners and returns the chosen findings sorted by ascending start.
- `KnownSecretReuse.makeSortedRanges()` sorts ranges by ascending start, then ascending end for binary-search overlap checks.
- Reused known secrets are dropped when they overlap a detector replacement at least as long.
- Detector replacements are dropped when they overlap a longer known-secret reuse range.

Final replacement sort and apply:

- The combined replacement list is built as `filteredSecretReplacements`, `filteredReusedSecretReplacements`, then `networkReplacements`, and sorted by ascending `start`.
- `applyReplacements(text, replacements)` sorts a copy ascending again.
- If there are no overlaps, it applies in ascending order with chunks.
- If overlaps remain, it applies a local sorted copy in descending `start` order to avoid index shifts.
- Returned `result.replacements` and `result.findings` are cloned from the combined sorted list, so their order is observable metadata.

Important distinction:

- The combined construction sort is not redundant metadata-wise. Removing it can preserve `redactedText` because `applyReplacements()` sorts internally, but it can change returned `replacements/findings` order for mixed replacement sources such as network, known-secret reuse, and detected secrets.
- The internal `applyReplacements()` ascending sort is potentially redundant only if the combined construction sort remains and no future local call passes unsorted replacements. Removing it safely would still need to preserve the current overlap path without mutating the returned sorted replacement list.

### `streamingFileRedactor.js`

Replacement creation:

- The streaming redactor does not create detector replacements directly.
- It calls injected `options.redactText(rawBuffer)` and reads `result.replacements || result.findings || []`.

Stable-window protection:

- For non-final flushes, `stableLength` starts at `rawBuffer.length - overlapSize`.
- If a private key block is open before the stable boundary, `stableLength` is moved back to the block start.
- `splitStableReplacements(replacements, stableLength)` scans all replacements. If any replacement crosses the stable boundary (`start < safeLength && end > safeLength`), it moves `safeLength` back to that replacement start.
- Only replacements with `end <= safeLength` are allowed into the stable segment.

Final replacement sort and apply:

- `splitStableReplacements()` returns stable replacements sorted by ascending `start`.
- `applyReplacements(segment, segmentReplacements)` sorts again by ascending `start`, clamps ranges to the segment, skips replacements whose start is already behind the cursor, and emits chunked output.
- On the final flush, the code bypasses `splitStableReplacements()` and passes the injected `replacements` directly to `applyReplacements()`.

Important distinction:

- The `splitStableReplacements()` sort is partly redundant for non-final segment application, because `applyReplacements()` sorts again.
- The streaming `applyReplacements()` sort is not safely redundant. It protects final flushes and any injected `redactText` implementation that returns unsorted replacements.

## Equivalence Requirements

Any Phase 20B-4B implementation must prove all of these remain identical:

- Redacted text.
- Placeholder values.
- Placeholder numbering.
- Placeholder order in visible output.
- Returned replacement ranges.
- Returned `replacements/findings` order.
- Overlap resolution.
- Trusted-placeholder pass-through.
- Known-secret reuse and longer-range preference.
- Network placeholder hierarchy and ordering.
- Streaming chunk output.
- Streaming stable-window boundaries.
- Raw-free guarantees when a chunk boundary splits a secret.
- Raw-free guarantees when a chunk boundary splits or abuts a trusted placeholder.
- Fail-closed behavior for invalid UTF-8, over-large files, and unbounded streaming segments.

## Coverage Review

Existing coverage before this phase already included:

- Detector overlap collapse for bearer/JWT-style findings and PEM blocks.
- Repeated known-secret reuse with stable placeholder reuse.
- Longer known-secret range preference over suffix-only findings.
- Trusted placeholder preservation and trusted-placeholder suffix redaction.
- Adjacent clean placeholder assignments.
- Network placeholder hierarchy and mixed secret/network redaction.
- Streaming split-through-secret, split-through-DB-URL, and private-key-spanning-chunks behavior.
- Raw-free streaming output and repeated secret reuse across chunks.
- Redaction benchmark samples marked for repeated-line equivalence, known-secret reuse, and overlap correctness.

Coverage gaps found:

- Mixed-source transform replacement metadata order was not directly asserted. This matters because removing the combined construction sort can change `result.replacements` order even when `redactedText` stays identical.
- Streaming behavior with an injected redactor returning unsorted replacements was not directly asserted. This matters because `redactTextFileStream()` accepts injected `redactText`, and the final flush bypasses `splitStableReplacements()`.

Tests added in this phase:

- `tests/ip_transform.test.js`: `testReplacementMetadataStaysInTextOrderAcrossSecretReuseAndNetwork()`
  - Locks replacement metadata order across network, known-secret reuse, and detected-secret replacement sources.
- `tests/streaming_file_redactor.test.js`: `testStreamingInjectedUnsortedReplacementsStayRawFree()`
  - Proves streaming output remains raw-free when injected final-flush replacements arrive unsorted.

Remaining caveat:

- Arbitrary overlapping replacements passed directly to `transformOutboundPrompt()` are not a safe optimization target. The detector and known-secret reuse filters are the semantic overlap resolvers; `applyReplacements()` is mainly an application helper and index-shift guard. Phase 20B-4B should not weaken upstream overlap resolution or rely on sorting removal to resolve overlaps differently.

## Baseline Results

Focused commands:

- `node tests/detector.test.js`: pass.
- `node tests/adversarial_redaction.test.js`: pass.
- `node tests/placeholder_trust.test.js`: pass.
- `node tests/ip_transform.test.js`: pass.
- `node tests/streaming_file_redactor.test.js`: pass.
- `node tests/file_drop_streaming_guards.test.js`: pass.

Profile command:

- `npm run bench:redaction:profile`: failed before the benchmark ran.
  - Failure: `TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received undefined`.
  - Cause observed in this environment: the package script uses `node -e` to dynamically import `tests/performance/redaction-benchmark.mjs`; the benchmark module's main-check reads `process.argv[1]`, which is undefined under this wrapper on Node `v24.16.0`.
- Direct equivalent profile invocation passed:
  - Command: set `LEAKGUARD_BENCH_PROFILE=1` and `LEAKGUARD_BENCH_ITERATIONS=12`, then run `node tests/performance/redaction-benchmark.mjs`.
  - `replacement_sort_ms` was small in this profile run, ranging from about `0.001 ms` to `0.062 ms` across benchmark samples.
  - The largest sort sample observed was `large_log_blob_45kb` at about `0.062 ms`, while `apply_replacements_ms`, `known_secret_collect_ms`, `network_ms`, and detector stages were larger.

Full validation:

- `npm run test:ci`: pass.
- `git diff --check`: pass.

## Decision

Defer broad replacement sorting optimization.

Do not remove:

- The combined construction sort in `transformOutboundPrompt.js`.
  - It preserves observable `result.replacements/result.findings` order across mixed replacement sources.
- The sort inside `streamingFileRedactor.js` `applyReplacements()`.
  - It protects the injected redactor contract, especially final flushes that do not pass through `splitStableReplacements()`.

The only potentially safe future Phase 20B-4B source change is transform-only and low value:

- Keep the combined construction sort.
- In `transformOutboundPrompt.js`, consider avoiding the second ascending sort inside the local `applyReplacements()` helper.
- Preserve current overlap behavior by using a non-mutating descending copy in the overlap branch.
- Do not change returned replacement order.
- Do not touch streaming replacement sorting.

Given the profile result, even this transform-only cleanup is not urgent. It should be skipped unless a future profile shows `replacement_sort_ms` or duplicate sorting as a meaningful contributor.

## Rollback Criteria For Any Phase 20B-4B Attempt

Rollback immediately if any of these change:

- Redacted text.
- Placeholder values or numbering.
- Returned replacement order.
- Replacement ranges.
- Known-secret reuse.
- Trusted-placeholder pass-through.
- Network hierarchy placeholders.
- Streaming output bytes.
- Raw-free guarantees across chunk boundaries.
- Fail-closed behavior.
- Browser or protected-site upload behavior.

## Phase 20B-4B Recommendation

Recommended Phase 20B-4B scope: no source optimization unless profiling changes.

If Phase 20B-4B proceeds anyway, limit it to the transform-only internal helper cleanup described above and run the same baseline plus browser gates. Do not include streaming sort removal in Phase 20B-4B.
