# Phase 20B-5A Known-Secret Fast-Exit Review

## Decision

Defer optimization for Phase 20B-5A. The clearly safe fast exits are real but currently low value in the profiled benchmark. The larger `known_secret_collect_ms` costs occur in cases where known secret entries exist and candidate raw values are present, which is exactly where fast exits risk changing placeholder reuse, overlap behavior, or duplicate raw-secret redaction.

No production redaction behavior should change in this phase.

## Current Flow

`collectKnownSecretReplacements()` is called from two synchronous redaction paths:

- `src/shared/transformOutboundPrompt.js`: after secret findings have been converted to placeholders with `manager.getPlaceholder()`, before network replacements and final replacement sorting.
- `src/shared/redactor.js`: after placeholders are preallocated for ordered findings, before the legacy redactor combines direct findings with known-secret reuse replacements.

Inputs accepted by `collectKnownSecretReplacements(text, manager, occupiedRanges = [], options = {})`:

- `text`: scanned as the source text. Current callers pass string-normalized text.
- `manager`: expected to expose `getKnownSecretEntries()`.
- `occupiedRanges`: mutable array of `{ start, end }` ranges. The function appends ranges when it adds reuse replacements.
- `options.placeholderTokenRegex`: defaults to `root.PWM.PLACEHOLDER_TOKEN_REGEX`.
- `options.category`: defaults to `"secret"`.
- `options.includeIds`: when true, adds `reuse_<start>_<end>` ids.

Known secret placeholders are collected through `PlaceholderManager`:

- `manager.getPlaceholder(raw)` fingerprints the raw value and returns an existing placeholder for repeated raw values.
- New raw values are stored in `secretByFingerprint`, `placeholderByFingerprint`, and `fingerprintByPlaceholder`.
- `manager.getKnownSecretEntries()` maps stored raw secrets back to their PWM placeholders and filters out entries without raw values or valid PWM placeholders.

Placeholder regex handling:

- `collectKnownSecretReplacements()` creates a global regex from `options.placeholderTokenRegex || root.PWM.PLACEHOLDER_TOKEN_REGEX`.
- The regex is used to split the text into plain-text segments.
- Placeholder-token spans are skipped entirely, so known raw scanning runs only between placeholder tokens.

Occupied range handling:

- The incoming `occupiedRanges` array is copied into a sorted `occupiedRangeIndex`.
- A separate `replacementRangeIndex` tracks ranges added by this function call.
- A candidate known-secret replacement is added only when it overlaps neither index.
- When a candidate is added, the function mutates `occupiedRanges` by pushing `{ start, end }`, then inserts that range into both sorted indexes.

Trusted placeholder handling:

- Detector paths use the manager to suppress trusted visible placeholders before findings are emitted.
- `transformOutboundPrompt()` and `Redactor` also filter findings whose raw value is trusted by the manager.
- `collectKnownSecretReplacements()` itself does not ask whether a placeholder is trusted. It skips all placeholder-token spans by regex segmentation, which prevents raw scanning inside visible placeholder tokens.

Reuse range handling:

- For each plain-text segment, the function loops over known entries.
- Entries with `raw.length < 3` are skipped.
- Each occurrence is found with `segmentText.indexOf(knownRaw, searchIndex)`.
- `shouldReuseKnownSecretInPlainText()` applies the current short-identifier guard:
  - short non-secret-like identifiers are not reused unless they appear in the password hint style context,
  - short identifiers are not reused when adjacent to identifier characters.
- Added candidates use the stored known placeholder, `type: "SECRET"`, and the configured category.

Repeated raw secret behavior:

- Repeated direct detector findings reuse the same placeholder because `manager.getPlaceholder(raw)` returns the existing placeholder for the same raw fingerprint.
- Later raw occurrences that were not direct findings can be added by `collectKnownSecretReplacements()` using that same known placeholder.
- Overlap filtering in both callers removes duplicate reuse replacements where detector findings already cover the same or longer range.
- Longer known raw ranges can win over suffix-only findings, preserving the current "known raw secret wins" behavior.

## Profile Results

Command:

```bash
npm run bench:redaction:profile
```

Environment from the run:

- Node: `v24.16.0`
- Platform: `win32 x64`
- Profile mode: `yes`
- Iterations: `12` default profile iterations, with large structural samples capped by sample settings.

Captured `known_secret_collect_ms` averages:

| Sample | Category | known_secret_collect_ms |
| --- | --- | ---: |
| `small_safe_text` | no known secrets | 0.010 |
| `long_safe_logs_120kb` | large safe text, no known secrets | 0.047 |
| `small_secret_prompt` | known entries, no meaningful missed duplicate | 0.025 |
| `env_file_2kb` | repeated credential-like sample | 0.077 |
| `repeated_env_like_80kb` | known-secret reuse benchmark sample | 1.478 |
| `long_prompt_few_secrets_90kb` | known entries in long prompt | 0.105 |
| `large_log_blob_45kb` | repeated known secret and overlap coverage | 0.467 |
| `large_synthetic_file_500kb` | large synthetic with known entries | 0.283 |
| `large_synthetic_file_1mb` | large synthetic with known entries | 0.401 |

Observations:

- No-known-secret samples pay only the cost of setup plus placeholder-regex segmentation. The large safe sample measured 0.047 ms.
- The largest known-secret collection cost is `repeated_env_like_80kb` at 1.478 ms, but that sample has real known entries and many raw occurrences. This is not a safe no-entry fast-exit case.
- The known-secret collector is not the dominant cost on large safe text. Detector scanning and network handling are larger in this run.
- Timings are advisory profile evidence, not thresholds.

## Safe Fast-Exit Candidates

Clearly safe but low value:

- No manager or no `manager.getKnownSecretEntries()` function: return `[]` before building regexes or indexes. No replacements can be added and `occupiedRanges` should remain unchanged.
- `knownEntries.length === 0`: return `[]`. This preserves behavior and avoids scanning text for placeholder tokens when no raw secret can be reused.
- Empty string text: return `[]` after preserving currently supported behavior for string callers. This has negligible value because callers already pass strings and empty inputs are uncommon.
- No valid candidate raw values after filtering entries to `String(entry.raw || "").length >= 3` and valid placeholders: return `[]`. This matches the current per-entry skip behavior.

Not safe as a simple fast exit:

- "No placeholder pattern present": not safe. Known raw secrets can recur in plain text with no placeholder token present, and those repeats must still reuse the existing placeholder.
- "No candidate raw secret values present" via broad pre-scan: behavior-equivalent if implemented carefully, but value is uncertain because it adds another scan over text and entries. It only helps when entries exist but none appear.
- "occupiedRanges already cover all candidate ranges": only provable after finding candidate ranges, which is most of the current work. A full-text occupied range would be safe, but current callers pass `[]`.
- Exiting when detector findings exist: not safe. The collector may still need to catch missed duplicate raw occurrences and preserve known-secret-over-suffix behavior.

## Equivalence Requirements

Any future optimization must prove all of these remain identical:

- Identical `redactedText`.
- Identical placeholder numbering and reservation behavior.
- Identical known-secret reuse for repeated raw values.
- Identical trusted-placeholder pass-through.
- Identical `occupiedRanges` mutation when replacements are added.
- Identical replacement ordering and replacement metadata, including `category`, `type`, `placeholder`, and optional `id`.
- Identical overlap behavior between direct findings and known-secret reuse replacements.
- Identical longer-known-raw preference over suffix-only findings.
- Identical short-identifier heuristic behavior.
- Identical raw-free guarantees in outputs.

## Test Coverage Notes

Existing end-to-end coverage already guards:

- repeated raw secret placeholder reuse in detector tests,
- repeated multiline password placeholder reuse,
- trusted placeholder pass-through,
- placeholder suffix redaction after trusted placeholders,
- known raw range preference over suffix-only findings in `tests/ip_transform.test.js`,
- large safe text false-positive behavior in the performance benchmark and detector shape-gate tests.

Added Phase 20B-5A direct guards in `tests/placeholder_trust.test.js`:

- no known secrets returns no replacements and does not mutate `occupiedRanges`,
- repeated known raw secrets reuse one placeholder and append occupied ranges,
- visible placeholder-token spans are skipped,
- occupied ranges prevent duplicate replacement and stay unchanged,
- the short identifier heuristic remains scoped to hint context,
- empty string input returns no replacements and does not mutate `occupiedRanges`.

## Phase 20B-5B Scope If Revisited

Do not pursue the higher-risk repeated-entry cases without a stronger proof harness. If optimization is revisited, limit Phase 20B-5B to the smallest safe collector-local exits:

1. In `collectKnownSecretReplacements()`, return `[]` before regex construction when there is no usable manager or no known secret entries.
2. Filter usable known entries once to entries with raw length at least 3 and a placeholder, then return `[]` if that filtered list is empty.
3. Optionally return `[]` for empty string text after confirming direct tests preserve the supported behavior.

Do not change callers, detector rules, placeholder allocation, trusted placeholder filtering, overlap filtering, replacement sorting, or streaming behavior in Phase 20B-5B.

## Final Recommendation

Defer/no-op for Phase 20B-5A. The safe exits are too small to justify implementation on their own, and the measurable costs are in behavior-sensitive cases where a fast exit would require more proof than this phase has produced.
