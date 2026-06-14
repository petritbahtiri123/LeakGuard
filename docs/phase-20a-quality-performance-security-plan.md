# Phase 20A Quality Performance Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve LeakGuard performance only through small, behavior-equivalent patches that preserve Quality, Performance, Security, privacy, redaction correctness, protected-site fail-closed behavior, and browser compatibility.

**Architecture:** Phase 20A is planning-only. Phase 20B may implement low-risk allocation and repeated-work reductions behind focused behavior tests, raw-free output checks, and benchmark direction checks. Detector rule changes, adapter changes, permission changes, remote calls, telemetry, and layout-preserving redaction are out of scope.

**Tech Stack:** Chrome/Firefox MV3 extension JavaScript, local-only shared scanner/redactor modules, Node test scripts, release/browser gate scripts, and existing benchmark scripts.

---

## Performance Report Reviewed

Reviewed `docs/deep-research-report.md`, the LeakGuard minimal low-risk performance optimization report. The report recommends prioritizing allocation reductions in extraction and OCR paths over detector rewrites:

- `src/shared/fileExtractors.js`: shared UTF-8 decoder reuse, ZIP `slice()` to `subarray()` where safe, XLSX regex/cache cleanup.
- `src/shared/scannerOcr.js`: reuse the same image buffer for dimension probing and OCR bytes, hoist repeated `String(text || "")` conversion in OCR layout loops.
- `src/shared/transformOutboundPrompt.js` and `src/shared/streamingFileRedactor.js`: remove redundant replacement sorting only if behavior-equivalent.
- `src/shared/knownSecretReuse.js`: consider fast exits only if there is no behavior change.
- Defer PDF extraction rewrites, PDF byte-string decoder rewrites, OCR worker pool changes, detector rule rewrites, adapter changes, permission/CSP changes, and dependency additions.

## Current Code Inspected

- `src/shared/fileExtractors.js`
  - `decodeUtf8Bytes()` creates a new `TextDecoder("utf-8", { fatal: false })` per decode.
  - `parseZipEntries()` copies ZIP entry names and compressed payloads with `bytes.slice(...)`.
  - XLSX parsing builds `RegExp` objects inside `extractXmlTextValues()` and `getCellAttribute()`.
  - PDF extraction currently decodes stream entries, maps, filters, joins, and then checks the final text size.
- `src/shared/scannerOcr.js`
  - `readImageDimensions()` calls `file.arrayBuffer()`.
  - `recognizeScannerImageFile()` calls `file.arrayBuffer()` again before OCR runtime handoff.
  - `sanitizeOcrLayout()` calls `String(text || "")` inside word and line fallback loops.
- `src/shared/transformOutboundPrompt.js`
  - Replacement construction sorts before `applyReplacements()`.
  - `applyReplacements()` sorts again and has overlap-sensitive behavior.
- `src/shared/streamingFileRedactor.js`
  - Stable replacement splitting sorts, then segment replacement application sorts again.
  - Streaming correctness depends on stable-window boundaries and overlap handling.
- `src/shared/knownSecretReuse.js`
  - `collectKnownSecretReplacements()` builds placeholder regex state and sorted range indexes before scanning.
  - The function mutates `occupiedRanges` when it adds reuse ranges, so fast exits must preserve supported side effects.
- `src/shared/detector.js`
  - Detector rules and overlap resolution are dense safety-critical code.
  - Phase 20A explicitly forbids detector rule changes.
- `tests/performance/redaction-benchmark.mjs`
  - Provides stage profile fields such as `scan_ms`, `transform_ms`, `known_secret_collect_ms`, `replacement_sort_ms`, and detector method averages.
  - Enforces raw-free redacted output and placeholder reuse assertions.
  - Timing is profile-oriented and should not be converted into flaky CI thresholds.
- `tests/performance/file-extraction-pipeline-benchmark.mjs`
  - Measures wall time, p50/p95/p99, heap delta, cache status, extracted length, and findings count.
  - Enforces that benchmark metadata and table rows do not leak raw fixture secrets.

## Non-Negotiable Safety Rules

- Quality first, security always, performance only when behavior is proven unchanged.
- Preserve local-only privacy: no backend calls, telemetry, analytics, remote verification, remote model calls, or cloud secret processing.
- Preserve detector correctness, redaction behavior, placeholder stability/reuse/order, trusted-placeholder pass-through, and right-to-left replacement safety.
- Preserve protected-site fail-closed behavior and raw-upload blocking.
- Preserve Chrome/Firefox MV3 compatibility and current CSP posture.
- Do not change detector rules, adapters, permissions, manifests, dependencies, or redaction semantics in Phase 20B without a new approved plan.
- Do not add flaky timing thresholds to CI.
- Prefer isolated, reversible patches with one optimization family per PR.

## Recommended Optimization Order

| Order | Candidate | Expected performance impact | Security risk | Behavior-change risk | Test coverage available | Complexity | Rollback simplicity | Validation tier |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Shared UTF-8 `TextDecoder` reuse in file extraction | Medium for DOCX/XLSX decode-heavy files; neutral elsewhere | Low | Low if `fatal: false` remains unchanged | Strong: file extractor, DOCX, XLSX, release benchmark | Low | Very simple | PR-safe plus release-gate |
| 2 | Replace ZIP entry byte copies with `subarray()` views where safe | Medium for DOCX/XLSX, lower heap churn | Low | Low if views are never mutated | Strong: file extractor, DOCX, XLSX, release benchmark | Low | Simple | PR-safe plus release-gate |
| 3 | XLSX XML regex/cache cleanup | Medium for sheet-heavy XLSX | Low | Low if regex flags, namespace handling, entity decode, and ordering stay identical | Strong: XLSX, file extractor, release benchmark | Low | Simple | PR-safe plus release-gate |
| 4 | OCR single-buffer reuse for dimension probing | Medium for supported image OCR with `readDimensions: true` | Low | Low if error codes and runtime payload bytes stay identical | Moderate: scanner OCR and browser gates | Low-medium | Simple | PR-safe plus browser-gate |
| 5 | Hoist repeated `String(text || "")` in OCR layout loops | Low-medium for OCR layout with many words/lines | Low | Low if fallback indexes and layout boxes stay identical | Moderate: scanner OCR and browser gates | Low | Very simple | PR-safe plus browser-gate |
| 6 | Remove redundant replacement sorting only if behavior-equivalent | Low-medium on long prompt or streaming transforms | Low | Medium because overlap order and stable streaming windows are safety-critical | Strong for detector/redaction, moderate for streaming | Medium | Simple | PR-safe plus release-gate |
| 7 | Known-secret fast exits only if no behavior change | Low on common zero-known-secret paths | Low | Medium because supported side effects and placeholder regex assumptions must remain intact | Strong for detector/redaction reuse, benchmark profile | Low-medium | Simple | PR-safe plus release-gate |

## Candidate Details

### 1. Shared UTF-8 TextDecoder Reuse

**Files touched**
- `src/shared/fileExtractors.js`
- Optional focused tests in `tests/file_extractors.test.js` only if current assertions do not already compare exact output.

**Exact behavior that must remain unchanged**
- UTF-8 decode must continue using non-fatal replacement behavior equivalent to `new TextDecoder("utf-8", { fatal: false })`.
- Extracted text, warnings, metadata, `safeForScan`, and error reason strings must remain identical for current fixtures.
- No raw secret may appear in extracted output metadata, benchmark tables, reports, cache, storage, debug data, or audit metadata.

**Tests required before and after**
- `node tests/file_extractors.test.js`
- `node tests/docx_redactor.test.js`
- `node tests/xlsx_redactor.test.js`
- `node tests/pdf_redactor.test.js`
- `npm run test:ci`

**Benchmark command**
- `npm run bench:file-extraction`

**Expected metric**
- Neutral or lower `avg_wall_ms`, `p95_wall_ms`, and `avg_heap_delta_bytes` for DOCX/XLSX samples.

**Rollback condition**
- Revert if any extractor output, error reason, metadata field, raw-free assertion, or protected-site handoff behavior changes.
- Revert if the targeted benchmark is worse across repeated local profile runs and no clear noise explanation exists.

**Validation tier**
- PR-safe for focused behavior tests and `npm run test:ci`.
- Release-gate for `npm run bench:file-extraction` and `npm run test:release-gates`.

### 2. ZIP Entry `subarray()` Views Where Safe

**Files touched**
- `src/shared/fileExtractors.js`
- Optional tests in `tests/file_extractors.test.js` for exact DOCX/XLSX extraction output stability.

**Exact behavior that must remain unchanged**
- ZIP parsing order, encryption checks, malformed ZIP checks, compressed size checks, uncompressed size checks, part allowlists, and normalized entry names must remain unchanged.
- `compressedBytes` views must not be mutated by extraction or inflate code.
- DOCX and XLSX extracted text order must remain unchanged.

**Tests required before and after**
- `node tests/file_extractors.test.js`
- `node tests/docx_redactor.test.js`
- `node tests/xlsx_redactor.test.js`
- `npm run test:ci`

**Benchmark command**
- `npm run bench:file-extraction`

**Expected metric**
- Lower allocation pressure and neutral or better DOCX/XLSX `avg_heap_delta_bytes`, `avg_wall_ms`, and `p95_wall_ms`.

**Rollback condition**
- Revert if any fixture output changes, any encrypted/malformed file handling changes, or any inflate path shows view-mutation behavior.

**Validation tier**
- PR-safe plus release-gate.

### 3. XLSX XML Regex/Cache Cleanup

**Files touched**
- `src/shared/fileExtractors.js`
- Optional focused cases in `tests/xlsx_redactor.test.js` or `tests/file_extractors.test.js` if namespace/tag coverage is insufficient.

**Exact behavior that must remain unchanged**
- Namespace-qualified tags must still match.
- Entity decoding must remain unchanged.
- Shared strings, inline strings, formulas, comments, workbook sheet names, and cell values must preserve current ordering and inclusion.
- Regex `lastIndex` state must be reset or avoided so cached global regexes cannot skip matches.

**Tests required before and after**
- `node tests/file_extractors.test.js`
- `node tests/xlsx_redactor.test.js`
- `npm run test:ci`

**Benchmark command**
- `npm run bench:file-extraction`

**Expected metric**
- Neutral or lower `avg_wall_ms` and `p95_wall_ms` on XLSX benchmark samples.

**Rollback condition**
- Revert if any XLSX extraction text, metadata, warnings, or raw-free output changes.
- Revert if cached regex state causes nondeterministic results across repeated runs.

**Validation tier**
- PR-safe plus release-gate.

### 4. OCR Single-Buffer Reuse for Dimension Probing

**Files touched**
- `src/shared/scannerOcr.js`
- Optional focused test in `tests/scanner_ocr.test.js` with a stub file whose `arrayBuffer()` call count is observable.

**Exact behavior that must remain unchanged**
- Supported image type checks must remain unchanged.
- Size and dimension limits must return the same status and warning codes.
- Image decode failure must still produce `ocr_image_decode_failed`.
- Runtime unavailable, file read failure, timeout, terminate, and OCR failure paths must return the same sanitized failure shape.
- The `recognizeImageBytes` payload must contain the same bytes and normalized MIME type.
- Protected-site visual redaction must still require safe boxes and remain fail-closed.

**Tests required before and after**
- `node tests/scanner_ocr.test.js`
- `node tests/file_scanner.test.js`
- `npm run test:ci`
- `npm run test:browser-gates` before release or browser-facing merge.

**Benchmark command**
- Use targeted local scanner OCR profiling if available.
- Also run `npm run bench:file-extraction` to ensure file extraction path remains neutral.

**Expected metric**
- Fewer `arrayBuffer()` calls when `readDimensions: true`; neutral or better image OCR path wall time and lower memory churn.

**Rollback condition**
- Revert if any scanner OCR status, warning, layout, protected-site eligibility, timeout behavior, or runtime payload changes.

**Validation tier**
- PR-safe for scanner OCR tests.
- Browser-gate required before release because OCR participates in protected-site image flow.

### 5. Hoist OCR Layout Text Conversion

**Files touched**
- `src/shared/scannerOcr.js`
- Optional focused layout test in `tests/scanner_ocr.test.js`.

**Exact behavior that must remain unchanged**
- Word and line fallback indexes must be identical.
- Layout boxes, `fallbackUsed`, `visualRedactionSafe`, and `protectedSiteEligible` must remain identical.
- No scanner output behavior may change except faster execution.

**Tests required before and after**
- `node tests/scanner_ocr.test.js`
- `node tests/file_scanner.test.js`
- `npm run test:ci`
- `npm run test:browser-gates` before release or browser-facing merge.

**Benchmark command**
- Use targeted local OCR layout profiling if added outside CI.
- Do not add flaky timing thresholds.

**Expected metric**
- Lower repeated string coercion cost for OCR results with many words or lines.

**Rollback condition**
- Revert if any box start/end, visual redaction safety, protected-site eligibility, scanner warnings, or output metadata changes.

**Validation tier**
- PR-safe plus browser-gate.

### 6. Remove Redundant Replacement Sorting Only If Behavior-Equivalent

**Files touched**
- `src/shared/transformOutboundPrompt.js`
- `src/shared/streamingFileRedactor.js` only if streaming equivalence is separately proven.
- Focused tests in existing redaction/streaming tests if needed.

**Exact behavior that must remain unchanged**
- Right-to-left replacement safety for overlapping ranges must remain unchanged.
- Placeholder allocation order and placeholder reuse must remain unchanged.
- Trusted placeholders must pass through unchanged.
- Known raw secret reuse must still win over suffix-only or natural-language findings where current tests require it.
- Streaming stable-window behavior must not emit raw secrets across chunk boundaries.

**Tests required before and after**
- `node tests/detector.test.js`
- `node tests/adversarial_redaction.test.js`
- `node tests/placeholder_trust.test.js`
- `node tests/ip_transform.test.js`
- `node tests/streaming_file_redactor.test.js`
- `node tests/file_drop_streaming_guards.test.js`
- `npm run test:ci`

**Benchmark command**
- `npm run bench:redaction:profile`

**Expected metric**
- Neutral or lower `replacement_sort_ms` and `apply_replacements_ms` with identical redacted text and replacement counts.

**Rollback condition**
- Revert if redacted text, replacement order, placeholder numbering, finding count, overlap handling, streaming chunk output, or raw-free assertions change.
- Revert if the profile does not show a clear targeted-path improvement.

**Validation tier**
- PR-safe plus release-gate.

### 7. Known-Secret Fast Exits Only If No Behavior Change

**Files touched**
- `src/shared/knownSecretReuse.js`
- Optional focused tests in `tests/detector.test.js` or redaction reuse tests if current coverage is insufficient.

**Exact behavior that must remain unchanged**
- Repeated known raw secrets must reuse the same placeholder.
- Known raw secret reuse must still avoid trusted placeholder spans.
- Short identifier heuristics in `shouldReuseKnownSecretInPlainText()` must remain unchanged.
- `occupiedRanges` mutation must remain unchanged for all cases that currently add replacements.
- Missing or unsupported inputs must keep their current supported-call behavior.

**Tests required before and after**
- `node tests/detector.test.js`
- `node tests/adversarial_redaction.test.js`
- `node tests/placeholder_trust.test.js`
- `npm run test:ci`

**Benchmark command**
- `npm run bench:redaction:profile`

**Expected metric**
- Neutral or lower `known_secret_collect_ms` for samples with no known-secret entries or short no-op paths.

**Rollback condition**
- Revert if any placeholder reuse assertion changes, any raw prefix/suffix survives, `known_secret_collect_ms` is not improved on targeted samples, or side effects differ.

**Validation tier**
- PR-safe plus release-gate.

## Explicitly Deferred Risky or Medium-Risk Candidates

| Deferred candidate | Why deferred | Reconsider only when |
| --- | --- | --- |
| Detector rule rewrites | Highest correctness and false-negative risk; user explicitly forbids rule changes | A separate security/correctness plan exists with targeted failing tests |
| Layout-preserving document redaction | Can copy original document structure or metadata and risks raw leakage | A separate redaction-safety design proves raw-free rebuilt outputs |
| PDF extraction rewrites | Current extraction behavior is safety-sensitive and error-code sensitive | Profiles prove PDF extraction dominates and PDF fixtures cover exact equivalence |
| PDF byte-string decoder rewrites | Byte decoding can change extracted text and downstream scan ranges | Dedicated PDF byte fixtures prove exact output equivalence |
| OCR worker pool or scheduler changes | Changes lifecycle, memory, timeout, and browser behavior | Browser-gate evidence shows OCR concurrency is the bottleneck |
| Browser adapter changes | Protected-site attach flow is fail-closed and provider-specific | A separate adapter plan and browser automation coverage exist |
| Permission or CSP changes | Security-sensitive and explicitly out of scope | A release/privacy/security review approves the change |
| Dependency additions | Supply-chain and bundle-size risk | A separate dependency review justifies the need and rollback path |

## Strict Safety Gate

A Phase 20B performance patch may proceed only if all of the following are true:

- All behavior tests pass.
- Generated redacted outputs remain raw-free.
- No raw secret appears in reports, cache, storage, debug output, audit metadata, benchmark tables, or release artifacts.
- No protected-site raw upload behavior changes.
- No scanner output behavior changes except faster execution.
- Detector rules and detector output semantics remain unchanged.
- Redaction behavior, placeholder stability, reuse, ordering, trusted-placeholder pass-through, and right-to-left replacement safety remain unchanged.
- Benchmark direction is neutral or better on the targeted path.
- No new flaky timing assertion is added.
- No permissions, CSP, adapter, remote call, telemetry, or dependency change is included.

## Benchmark and Validation Plan

### Required Commands

Run the narrowest relevant command first during implementation, then run the broader gates as the patch approaches merge:

```bash
node tests/file_extractors.test.js
node tests/pdf_redactor.test.js
node tests/docx_redactor.test.js
node tests/xlsx_redactor.test.js
node tests/detector.test.js
node tests/productization.test.js
npm run bench:file-extraction
npm run bench:redaction:profile
npm run test:ci
npm run test:release-gates
npm run test:browser-gates
git diff --check
```

### PR-Safe Validation

- Focused unit tests for files touched.
- `node tests/productization.test.js`
- `npm run test:ci`
- `git diff --check`
- No benchmark timing thresholds added to CI.

### Release-Gate Validation

- `npm run test:release-gates`
- `npm run bench:file-extraction`
- `npm run bench:redaction:profile`
- Compare benchmark direction for targeted metrics only.

### Browser-Gate Validation

- Required for OCR, protected-site, scanner, adapter-adjacent, or browser-facing changes.
- `npm run test:browser-gates`
- Confirm protected-site raw upload behavior remains fail-closed.

## Rollback Criteria

Rollback immediately if any patch causes:

- Any behavior test failure.
- Any difference in extracted text, redacted text, replacement ordering, placeholder numbering, warnings, status, or metadata not explicitly approved.
- Any raw secret in generated outputs, reports, cache, storage, debug output, audit metadata, benchmark tables, or release artifacts.
- Any protected-site raw upload behavior change.
- Any scanner output behavior change other than faster execution.
- Any detector rule or detector output semantic change.
- Any benchmark regression on the targeted path after repeated local runs.
- Any new flaky timing assertion.
- Any permissions, CSP, adapter, dependency, remote call, or telemetry change.

## Phase 20B Task Sequence

### Task 1: Baseline Evidence

**Files:**
- Read only: current source and tests.
- Modify: none.

- [ ] Run `node tests/productization.test.js`.
- [ ] Run the focused tests for the first candidate.
- [ ] Run `npm run bench:file-extraction` or `npm run bench:redaction:profile`, depending on the candidate.
- [ ] Record targeted metrics in the PR notes without committing generated benchmark artifacts unless explicitly requested.

### Task 2: Implement One Low-Risk Candidate

**Files:**
- Modify only the candidate files listed above.
- Modify tests only when existing coverage does not prove exact equivalence.

- [ ] Write or identify the behavior-equivalence test first.
- [ ] Run it before the implementation when a new regression test is added.
- [ ] Make the smallest reversible code change.
- [ ] Run the focused tests.
- [ ] Run the candidate benchmark.
- [ ] Stop if the benchmark is not neutral or better on the targeted path.

### Task 3: Gate and Decide

**Files:**
- Modify: none unless fixing a test-discovered issue in the same candidate.

- [ ] Run `npm run test:ci`.
- [ ] Run `git diff --check`.
- [ ] Run `npm run test:release-gates` for extractor, transform, streaming, or known-secret changes.
- [ ] Run `npm run test:browser-gates` for OCR or browser-facing changes.
- [ ] Roll back the candidate if any safety gate fails.
- [ ] Commit only one optimization family per PR.

## Ready for Phase 20B Implementation

Ready for Phase 20B implementation of candidates 1 through 5, one candidate family at a time, after baseline metrics are captured.

Not ready for detector rewrites, PDF extraction rewrites, PDF byte-string decoder rewrites, OCR worker pool changes, browser adapter changes, permission/CSP changes, remote calls, telemetry, dependencies, or layout-preserving redaction.
