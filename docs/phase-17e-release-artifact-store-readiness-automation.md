# Phase 17E Release Artifact and Store-Readiness Automation

## Goal

Automate release artifact and store-readiness inspection for generated Chrome and Firefox packages without changing runtime product behavior.

## Scope

Phase 17E adds `tests/release_artifacts.test.js` and the focused npm entry point `npm run test:release-artifacts`.

The check is intended to run after:

```bash
npm run build:all
npm run package:release
```

It inspects:

- `dist/chrome`
- `dist/firefox`
- `dist/edge` when that optional build output exists
- `artifacts/release/leakguard-*-v<package version>.zip`

## Artifact And Package Hygiene

The automation verifies each inspected package contains `manifest.json` plus expected runtime extension files for background, content, popup, options, scanner, shared file redaction, local OCR, ONNX runtime, and the local classifier model.

It fails if generated packages include source-only or private material such as:

- sourcemaps or `sourceMappingURL`
- test directories or raw fixture directories
- `node_modules`
- package manager metadata
- docs intended only for source review
- `.env`
- private keys or certificate material
- screenshots, temp, or scratch files

## Manifest And Security Gates

The automation verifies:

- Manifest V3 remains in use.
- Runtime permissions remain limited to `activeTab`, `scripting`, and `storage`.
- Host access remains in optional/user-managed host permissions.
- Extension pages do not allow `unsafe-eval`.
- `wasm-unsafe-eval` remains present only as the documented allowance for local WASM OCR/ONNX assets.
- `web_accessible_resources` remain limited to expected local model, runtime, OCR worker, OCR proof assets, and the protected-site OCR broker page.
- No remote script/code URLs are packaged.
- No `externally_connectable` surface is declared.
- A service worker background remains present and no MV2 background page is introduced.

## Store And Privacy Consistency Gates

The automation verifies the release-facing docs consistently cover the current privacy and capability boundaries:

- local-only processing
- no backend
- no telemetry
- no remote OCR
- no cloud verification
- OCR is local English-only
- protected-site OCR/image redaction is opt-in/default-off where applicable
- scanner/protected-site rebuilt outputs exist for image, PDF, DOCX, and XLSX
- rebuilt document outputs are not layout-preserving
- unsupported limitations are explicit
- `.redacted.txt` fallback remains documented
- unresolved contact or TODO placeholders are release blockers

The checked docs are:

- `README.md`
- `docs/PRIVACY_POLICY.md`
- `docs/CHROME_WEB_STORE_LISTING.md`
- `docs/FIREFOX_AMO_CHECKLIST.md`
- `docs/RELEASE_QA_CHECKLIST.md`
- `docs/THREAT_MODEL.md`
- `docs/PROTECTED_SITES_GUIDE.md`
- `docs/OCR_BUILD_STRATEGY.md`
- `docs/FILE_CAPABILITY_MATRIX.md`

## Raw Marker And Secret Sweeps

The automation scans generated packages and release zips for synthetic raw markers used by browser-path, provider-parity, fuzz, scanner OCR, and synthetic test coverage. The scanner OCR proof fixture is the only intentional packaged reference allowed for the scanner OCR synthetic marker.

It also fails on common accidental secret markers:

- `OPENAI_API_KEY=`
- `ANTHROPIC_API_KEY=`
- `GITHUB_TOKEN=`
- `STRIPE_SECRET_KEY=`
- `DATABASE_URL=`
- `AWS_ACCESS_KEY_ID=`
- `AWS_SECRET_ACCESS_KEY=`
- private key headers

## Size And File Count Report

Each inspected package prints:

- total bytes
- file count
- top five largest packaged files

The hard gate is 100 MiB. The warning gate is 50 MiB. Local OCR assets are expected, including `shared/ocr/tessdata/eng.traineddata.gz`; non-local or non-English OCR assets remain out of scope unless a later phase explicitly changes the release strategy.

## Release Blockers

Phase 17E treats these as blockers:

- missing built dist target required for release
- missing release zip
- package hygiene failure
- manifest/security gate failure
- store/privacy doc inconsistency
- unresolved TODO/contact placeholders in checked release-facing docs
- packaged raw marker or secret pattern
- package size above the hard gate

## Phase 17F Handoff

Phase 17F can wire this focused check into a CI/nightly release matrix after build/package artifacts are produced. The check is intentionally not part of `npm test` because it requires generated `dist/` and `artifacts/release/` outputs.
