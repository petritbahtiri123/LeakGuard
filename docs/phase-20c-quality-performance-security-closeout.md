# Phase 20C Quality Performance Security Closeout

## Purpose

Phase 20C closes the Phase 20 Quality, Performance, and Security chain. It documents the safe Phase 20B performance wins, records the measured impact, names the optimization candidates that remain deferred, and preserves the project rule that future performance work must be profile-led with exact behavior preservation.

This closeout adds no runtime optimization and requires no behavior change. Detector rules, redaction behavior, adapters, permissions, CSP, dependencies, telemetry posture, remote-call posture, and local-only/fail-closed guarantees remain unchanged.

## Implemented Performance Wins

### detector hot path

Phase 20B retained detector semantics while reducing repeated hot-path work in benchmarked detector flows.

Measured profile direction:

| Benchmark sample | Before | After | Direction |
| --- | ---: | ---: | --- |
| 1 MB synthetic sample | ~37.9 ms | ~33.7 ms | faster |
| repeated env-like text | ~17.4 ms | ~15.2 ms | faster |

The win was accepted because the detector output contract stayed stable: no detector rules changed, no redaction rule changed, no placeholder behavior changed, and no flaky timing threshold was added.

### file extraction allocation cleanup

Phase 20B reduced avoidable allocation in the file extraction path:

- Shared UTF-8 `TextDecoder` reuse for repeated extraction decodes.
- ZIP `subarray()` views for entry names and compressed payloads where the bytes are not mutated.
- DOCX and XLSX extraction paths saw small allocation and wall-time wins while preserving extracted text, warnings, metadata, malformed-file handling, and raw-free guarantees.

### XLSX regex/cache cleanup

Phase 20B moved repeated XLSX parsing work toward cached/reused helpers while preserving namespace handling, entity decode behavior, sheet and cell ordering, formulas-as-text handling, comments, shared strings, and raw-free regenerated output expectations.

Measured profile direction:

| Benchmark sample | Metric | Before | After | Direction |
| --- | --- | ---: | ---: | --- |
| `large_xlsx_phase17d` | average wall time | ~80.316 ms | ~77.114 ms | faster |
| `large_xlsx_phase17d` | p95 wall time | ~92.208 ms | ~83.405 ms | faster |

### OCR buffer and layout cleanup

Phase 20B reduced avoidable image OCR allocation and repeated text coercion:

- Image `arrayBuffer()` calls with dimension probing were reduced from 2 to 1.
- OCR layout handling hoisted `String(text || "")` out of repeated word and line fallback loops.

The OCR changes preserved OCR status codes, warnings, timeout behavior, runtime payload bytes, layout boxes, protected-site eligibility, visual redaction safety, and fail-closed behavior.

### benchmark wrapper

The redaction profile wrapper was productized so:

```bash
npm run bench:redaction:profile
```

works on Node `v24`, including environments where the earlier dynamic wrapper left `process.argv[1]` undefined.

## Measured Impact

The measured wins were intentionally modest and scoped:

- detector hot path: 1 MB synthetic sample improved from ~37.9 ms to ~33.7 ms.
- detector hot path: repeated env-like text improved from ~17.4 ms to ~15.2 ms.
- file extraction: shared decoder reuse and ZIP views reduced allocation churn, with small DOCX/XLSX wins.
- XLSX: `large_xlsx_phase17d` average improved from ~80.316 ms to ~77.114 ms.
- XLSX: `large_xlsx_phase17d` p95 improved from ~92.208 ms to ~83.405 ms.
- OCR: image dimension probing plus OCR read path now uses one `arrayBuffer()` call instead of two.
- OCR: layout string conversion is performed once for repeated fallback loops.
- benchmark profile: `npm run bench:redaction:profile` runs on Node `v24`.

These numbers remain profile evidence, not CI pass/fail thresholds.

## Deferred Optimizations

The following candidates remain deferred:

- Replacement sorting cleanup is deferred because `replacement_sort_ms` was tiny in profile output, while redaction order, replacement metadata order, overlap handling, streaming chunk safety, and right-to-left replacement safety carry high behavior risk.
- Known-secret fast exits are deferred because the clearly safe exits were tiny, and the measurable paths involved known entries and repeated raw values where placeholder reuse, overlap behavior, and duplicate raw-secret redaction are behavior-sensitive.
- PDF extraction rewrites are deferred because PDF extraction is range-sensitive and error-code-sensitive; no Phase 20C source work should change PDF extraction semantics.
- OCR worker pool or scheduler changes are deferred because they affect lifecycle, memory, timeout behavior, browser behavior, and local-only resource boundaries.
- Detector rule rewrites are deferred because they are correctness and false-negative sensitive.
- Adapter, CSP, permission, dependency, telemetry, backend, remote verification, and remote model or cloud secret processing changes are deferred and out of scope.

## Safety Validation

Phase 20B and Phase 20C validation used behavior and static gates rather than timing thresholds:

- Behavior tests passed for the touched paths.
- Redaction tests passed for detector, placeholder reuse, trusted-placeholder pass-through, overlap handling, and raw-free output behavior.
- File extractor tests passed for text, PDF, DOCX, XLSX, malformed inputs, and generated-output safety where relevant.
- OCR and browser gates passed where relevant to OCR/browser-facing changes.
- Release gates passed where relevant to file extraction and package-facing changes.
- `npm run bench:redaction:profile` works on Node `v24`.
- No strict or flaky timing thresholds were added.
- No local-only privacy guarantee was weakened.
- No fail-closed protected-site behavior was weakened.
- No permissions, CSP, adapters, detector rules, redaction behavior, telemetry, remote calls, or dependencies changed in Phase 20C.

## Future Performance Rules

Any future LeakGuard performance work must follow these rules:

- Start with profile evidence from the existing benchmark or a focused diagnostic profile.
- Keep one optimization family per PR.
- Preserve behavior exactly: extracted text, redacted text, placeholder stability/reuse/order, trusted-placeholder pass-through, right-to-left replacement safety, warnings, status codes, metadata, and raw-free guarantees must remain unchanged.
- Include explicit rollback criteria before implementation.
- Avoid strict timing thresholds in CI; use benchmarks as advisory profile evidence.
- Run `npm run test:ci` and the relevant release/browser gates before merge or release.
- Do not mix performance work with adapter, CSP, permission, dependency, telemetry, backend, remote verification, remote model, or cloud secret processing changes.

## Rollback Criteria

Rollback any future performance patch if it changes:

- detector findings, detector scoring, or detector rule behavior.
- extracted text, redacted text, replacement ranges, replacement ordering, or placeholder numbering.
- known-secret reuse, trusted-placeholder handling, right-to-left replacement safety, or streaming raw-free guarantees.
- OCR status, warnings, payload bytes, layout boxes, visual redaction safety, or protected-site eligibility.
- DOCX/XLSX/PDF output safety, fallback behavior, warnings, or metadata.
- local-only/privacy/fail-closed behavior.
- permissions, CSP, adapters, dependencies, telemetry, remote calls, or cloud processing posture.

Rollback also applies if targeted profile evidence regresses repeatedly without a clear non-product explanation.

## Manual Release Testing Readiness

Phase 20C is ready for manual release testing after the closeout guard, `npm run test:ci`, and whitespace diff checks pass. Manual release testing should still exercise protected-site upload flows, scanner exports, OCR image flow, DOCX/XLSX regenerated output, and release artifact review before publication.
