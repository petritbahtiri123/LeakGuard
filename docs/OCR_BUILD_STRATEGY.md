# OCR Strategy

LeakGuard will keep a single extension architecture. Future OCR support belongs
inside the normal Chrome and Firefox packages rather than a separate OCR edition,
store listing, or alternate user-facing build.

## Current State

OCR is not implemented yet. Current builds must not include OCR runtime files,
OCR workers, OCR model files, traineddata, OCR dependencies, remote OCR calls,
CDN loading, runtime model downloads, new permissions, or CSP changes.

The supported build targets remain:

- `chrome`
- `chrome-enterprise`
- `firefox`
- `firefox-enterprise`

## Future Runtime Direction

When OCR is implemented, OCR code and assets must be packaged locally inside the
same extension. Runtime loading must be lazy and must use extension-owned URLs
only, such as `chrome.runtime.getURL(...)` or the Firefox-compatible equivalent.

OCR must not use:

- CDN script or asset loading
- remote model downloads
- remote OCR services
- telemetry or cloud verification
- `eval`, `Function`, or `unsafe-eval`
- extra extension permissions unless a later reviewed design proves they are
  necessary

## Rollout Order

Scanner page OCR comes first. Protected-site OCR, drag/drop OCR, composer OCR,
or automatic page-side OCR must wait until scanner OCR is stable, locally
contained, and covered by browser QA.

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

Before OCR runtime proof work begins, tests must continue to prove:

- default builds contain no OCR assets yet
- CSP remains unchanged
- no OCR dependency has entered `package.json`
- no remote OCR, CDN, traineddata, or model-download strings appear in runtime
  packages
- OCR assets, when added later, are loaded only from extension package URLs
- raw OCR result text is contained to scanner workflows until explicitly
  promoted
