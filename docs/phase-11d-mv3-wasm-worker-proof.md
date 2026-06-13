# Phase 11D MV3 WASM Worker Proof

Date: 2026-06-10

Scope: local packaged WASM loading mechanics only. This phase does not add an
OCR engine, OCR dependency, traineddata, model files, user-image processing, OCR
scanner UI, permissions, remote loading, or unsafe dynamic code.

## Result

Phase 11D proved local WASM asset resolution but Chrome, Edge, and Firefox
returned `wasm_blocked` with `TypeError` under the unchanged extension CSP.

Phase 11D-2 adds only `'wasm-unsafe-eval'` to `extension_pages` `script-src`.
With that CSP token and worker-local packaged asset resolution, Chrome smoke now
returns `wasm_ready` for the 8-byte proof module. OCR remains blocked.

The worker now accepts the proof-only message:

```js
{ type: "wasm_probe" }
```

On success it returns:

```js
{
  ok: true,
  status: "wasm_ready",
  wasmLoaded: true
}
```

On failure it returns:

```js
{
  ok: false,
  status: "wasm_blocked",
  reason: "..."
}
```

## Packaged Proof Asset

The proof asset is `shared/ocr/ocrWasmProbe.wasm`, an 8-byte empty WebAssembly
module. It is proof-only, contains no OCR code, contains no user data, and is
small enough for package-size tests to treat it as negligible.

## Future Loading Pattern

A later `tesseract.js-core` proof must use this same loading shape:

1. Keep all core and sidecar WASM files inside the extension package.
2. Resolve each asset with `chrome.runtime.getURL(...)` or
   `browser.runtime.getURL(...)` when available.
3. In a dedicated worker where extension runtime APIs may be unavailable, resolve
   worker-side WASM sidecars as packaged sibling URLs from `self.location.href`.
4. Load only extension-local URLs from the worker.
5. Compile or instantiate with the WebAssembly API without `eval`, `Function`,
   inline JavaScript, CDN URLs, runtime downloads, or extra CSP relaxations.
6. Keep the engine probe separate from user-image processing until the engine,
   model, size, license, and raw-text handling gates are independently approved.

## OCR Status

OCR remains blocked. The existing `{ type: "ocr_engine_probe" }` still returns
`engine_blocked`, and scanner image handling remains metadata-only.

## Follow-Up

Before any core OCR proof can proceed, the project still needs dependency,
license, model-size, raw-text handling, and cross-browser QA review. The safe
local WASM mechanics are now proven, but OCR implementation remains out of scope.
