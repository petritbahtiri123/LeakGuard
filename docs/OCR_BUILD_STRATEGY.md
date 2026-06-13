# OCR Strategy

LeakGuard will keep a single extension architecture. Future OCR support belongs
inside the normal Chrome and Firefox packages rather than a separate OCR edition,
store listing, or alternate user-facing build.

## Current State

LeakGuard now has local English-only image OCR for the extension-owned scanner
page and a settings-controlled protected-site image OCR path. Protected-site
visual image redaction uploads a flattened `.redacted.png` only when OCR boxes
are eligible. Scanner visual image redaction also exports PNG.

Scanner and protected-site text PDFs, DOCX files, and XLSX files can export
regenerated `.redacted.pdf`, `.redacted.docx`, and `.redacted.xlsx` outputs from
sanitized text only; protected-site regenerated outputs fall back to
`.redacted.txt` when regeneration would truncate. Image metadata and OCR text
outputs export `.redacted.txt`. LeakGuard does not provide layout-preserving
PDF/DOCX/XLSX redaction or original Office document reconstruction, does not
preserve original image format for visual redaction, and does not run
scanned-PDF OCR.

Current builds must stay local-only and must not include backend OCR/file
processing, telemetry, cloud verification, remote OCR calls, CDN loading,
runtime model downloads, new permissions, or CSP changes beyond the reviewed
local WASM support already used by extension pages.

The supported build targets remain:

- `chrome`
- `chrome-enterprise`
- `firefox`
- `firefox-enterprise`

## Runtime Direction

OCR code and assets must stay packaged locally inside the same extension.
Runtime loading must be lazy and must use extension-owned URLs only, such as
`chrome.runtime.getURL(...)` or the Firefox-compatible equivalent.
Phase 11D-2 proved this local WASM loading shape with only `'wasm-unsafe-eval'`
added to extension-page `script-src`; no remote script source or `'unsafe-eval'`
is allowed.

OCR must not use:

- CDN script or asset loading
- remote model downloads
- remote OCR services
- telemetry or cloud verification
- `eval`, `Function`, or `unsafe-eval`
- extra extension permissions unless a later reviewed design proves they are
  necessary

## Rollout Order

Scanner page OCR shipped first. Protected-site OCR is now settings-controlled
and enabled by default for supported image uploads after QA and product review
of the local-only fail-closed flow. Drag/drop OCR outside the protected-site settings path, composer OCR, or
automatic page-side OCR must wait until scanner/protected-site OCR remains
stable, locally contained, and covered by browser QA.

The first OCR language target is English only. Additional languages require a
separate size, accuracy, privacy, and packaging review.

## Size Budget

Current packages are measured in build tests. Future OCR work may make the
single extension larger, but it must pass these gates:

- Internal warning threshold: 50 MiB installed package
- Hard internal review threshold: 100 MiB installed package
- Firefox external upload limit: 200 MB package upload
- Chrome external package limit: 2 GB ZIP

Crossing the warning threshold requires an explicit size report. Crossing the
hard internal review threshold requires a product/security review before the OCR
assets can ship.

## Security Gates

Tests must continue to prove:

- CSP keeps `'wasm-unsafe-eval'` but never `'unsafe-eval'`
- protected-site OCR is settings-controlled, enabled by default for supported image uploads, and can be turned off
- no remote OCR, CDN, or model-download strings appear in runtime packages
- OCR assets, when added later, are loaded only from extension package URLs
- raw OCR result text, raw image bytes, and redaction boxes are not persisted,
  logged, sent remotely, or stored in audit metadata
- protected-site OCR failure blocks raw image upload
- scanner/protected-site visual redaction outputs PNG only when boxes are
  eligible
- unsupported scanned-PDF OCR, non-English OCR, image format preservation, or
  PDF/DOCX/XLSX rebuild claims do not appear in user-facing docs
