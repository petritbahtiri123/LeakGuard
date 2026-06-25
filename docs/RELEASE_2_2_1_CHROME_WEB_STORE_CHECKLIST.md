# LeakGuard 2.2.1 Chrome Web Store Release Checklist

## Release identity

- Version: `2.2.1`
- Target: Chrome Web Store package generated from `dist/chrome`
- Release command: `npm run release:artifacts`
- Chrome ZIP: `artifacts/release/leakguard-chrome-v2.2.1.zip`
- Firefox ZIP: `artifacts/release/leakguard-firefox-v2.2.1.zip`
- Enterprise ZIPs: `artifacts/release/leakguard-chrome-enterprise-v2.2.1.zip`, `artifacts/release/leakguard-firefox-enterprise-v2.2.1.zip`
- Checksums: `artifacts/release/SHA256SUMS`, `artifacts/release/release-checksums.json`

## Validation status

- [x] `package.json` version is `2.2.1`.
- [x] `package-lock.json` root version is `2.2.1`.
- [x] `manifests/base.json` version is `2.2.1`.
- [x] Chrome manifest version confirmed as `2.2.1` in `dist/chrome/manifest.json` and `artifacts/release/leakguard-chrome-v2.2.1.zip`.
- [x] Firefox manifest version confirmed as `2.2.1` in `dist/firefox/manifest.json` and `artifacts/release/leakguard-firefox-v2.2.1.zip`.
- [x] `npm test` passed after the version bump.
- [x] `npm run docs:check-links` passed after the version bump.
- [x] `npm run smoke:chrome` passed after the version bump.
- [x] `node tests/browser/extension_qa_harness.test.mjs --full-matrix` passed after the version bump.
- [x] `npm run release:artifacts` completed and generated Chrome, Chrome Enterprise, Firefox, and Firefox Enterprise ZIPs.
- [x] `npm run test:release-artifacts` passed.
- [x] Chrome Web Store release notes prepared below.

## Package contents audit

- ZIPs contain 139 files each.
- Chrome ZIP size: 8,093,884 bytes.
- Chrome ZIP SHA-256: `ba64804ff0e99663b6eed14141852deb965036c89e7c9b1f51b45873cfac7f73`.
- No source maps, package metadata files, tests, generated QA artifacts, local reports, screenshots, browser QA artifacts, or real-sanitized eval files were found in the release ZIPs.
- Runtime Onix model artifacts are included only as required for packaged local AI assist.
- Runtime OCR assets are included only as required for packaged local OCR/image redaction support.

## Chrome Web Store release notes

LeakGuard 2.2.1 is a release packaging refresh for the tested 2.2.x local-only privacy protection line. It preserves protected-site prompt redaction, file scanner exports, protected-site PDF/DOCX/XLSX/image handling, local OCR/image redaction behavior, streaming local text-file redaction, metadata-only diagnostics, and fail-closed raw upload blocking after LeakGuard consumes or sanitizes a file.

## Upload decision

Use `artifacts/release/leakguard-chrome-v2.2.1.zip` for Chrome Web Store upload after the validation items above are complete.
