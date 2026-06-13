# Phase 11C OCR Engine Proof

Date: 2026-06-10

Scope: local OCR engine proof for the single LeakGuard extension. This phase
keeps OCR scanner-only, does not wire OCR into protected-site uploads, and does
not process user image data.

## Candidate Result

No OCR engine candidate was integrated.

The refreshed dependency spike found:

- `tesseract.js` 7.0.0: blocked by `Function` constructor matches and default
  remote/CDN worker/core/language loading strings.
- `tesseract.js-core` 6.1.2: blocked for this phase because it requires WASM
  assets and still has loader paths with `fetch`/`XMLHttpRequest` behavior that
  need a separate extension-context audit.
- `@tesseract.js-data/eng` 1.0.0: blocked for this phase because it is model
  data/traineddata and would add about 13.23 MiB installed before an engine is
  proven acceptable.
- `ocrad.js` 0.0.1: blocked by GPL-3.0 license risk and `eval`/`Function`
  findings.

## Worker Proof

The Phase 11B worker shell now supports an explicit internal engine probe
message:

```js
{ type: "ocr_engine_probe" }
```

Because no candidate passed the current gates, the worker returns:

```js
{
  ok: false,
  status: "engine_blocked",
  ocrImplemented: false,
  engine: null,
  reason: "no_candidate_passed_security_size_csp_gates"
}
```

This keeps the worker path testable without adding OCR dependencies, OCR
models, traineddata, WASM, remote loading, or scanner UI claims.

## Security And Size Status

Production impact remains limited to the tiny worker shell. No OCR engine,
model, traineddata, or WASM asset is packaged. CSP and permissions are
unchanged. Build tests continue to measure installed package size and release
zip size against the OCR planning thresholds.

## Follow-Up

Scanner OCR v1 is not ready. A later phase needs a candidate that can pass a
Chrome/Firefox MV3 extension-context proof with local packaged assets only, no
runtime downloads, no unsafe dynamic code, acceptable license terms, and an
approved size budget.
