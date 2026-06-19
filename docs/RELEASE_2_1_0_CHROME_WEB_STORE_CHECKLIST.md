# LeakGuard 2.1.0 Chrome Web Store Release Checklist

## Release identity

- Version: `2.1.0`
- Target: Chrome Web Store package generated from `dist/chrome`
- Release command: `npm run release:artifacts`
- Chrome ZIP: `artifacts/release/leakguard-chrome-v2.1.0.zip`
- Firefox ZIP: `artifacts/release/leakguard-firefox-v2.1.0.zip`
- Enterprise ZIPs: `artifacts/release/leakguard-chrome-enterprise-v2.1.0.zip`, `artifacts/release/leakguard-firefox-enterprise-v2.1.0.zip`
- Checksums: `artifacts/release/SHA256SUMS`, `artifacts/release/release-checksums.json`

## Validation status

- [x] `package.json` version is `2.1.0`.
- [x] `package-lock.json` root version is `2.1.0`.
- [x] `manifests/base.json` version is `2.1.0`.
- [x] Chrome manifest version confirmed as `2.1.0` in `dist/chrome/manifest.json` and `artifacts/release/leakguard-chrome-v2.1.0.zip`.
- [x] Firefox manifest version confirmed as `2.1.0` in `dist/firefox/manifest.json` and `artifacts/release/leakguard-firefox-v2.1.0.zip`.
- [x] `npm test` passed.
- [x] `npm run docs:check-links` passed.
- [x] Focused release checks passed.
- [x] `npm run release:artifacts` completed and generated Chrome, Chrome Enterprise, Firefox, and Firefox Enterprise ZIPs.
- [x] `npm run test:release-artifacts` passed.
- [x] Package contents checked for source maps, dev-only files, tests, generated QA artifacts, local reports, screenshots, browser QA artifacts, and real-sanitized eval files.
- [x] Runtime Onix model artifacts are included only as required for packaged local AI assist.
- [x] Runtime OCR assets are included only as required for packaged local OCR/image redaction support.
- [x] Chrome Web Store release notes prepared below.
- [ ] `npm run smoke:chrome` could not complete in this container because Chrome/Chromium is not installed; rerun in a release browser environment before upload.
- [ ] `npm run smoke:firefox` could not complete in this container because Firefox is not installed; rerun in a release browser environment before upload.
- [ ] `npm run qa:browser` could not complete in this container because Chrome/Edge/Firefox binaries are not installed; rerun in a release browser environment before upload.
- [ ] `npm run qa:browser:full` could not complete in this container because Chrome/Edge/Firefox binaries are not installed; rerun in a release browser environment before upload.

## Package contents audit

- ZIPs contain 138 files each.
- No `.map` files, package metadata files, test directories, QA reports, local screenshots, browser QA artifacts, or real-sanitized eval files were found in the release ZIPs.
- The packaged `shared/ocr/fixtures/synthetic-test-ocr.png` fixture is expected by the existing OCR runtime proof coverage.
- The packaged `ai/models/*` files are expected runtime assets for local AI assist.
- The packaged `shared/ocr/*` files are expected runtime assets for local OCR/image redaction.
- A targeted raw-marker scan only matched detector pattern source text in `shared/patterns.js`; no packaged test secret pack or raw QA artifact was found.

## Chrome Web Store release notes

LeakGuard 2.1.0 improves local-only privacy protection with stronger cloud secret detection, safer entropy handling, expanded local AI gray-zone classification, hardened file handling, safer diagnostics, and broader browser QA coverage. This release also improves reliability and performance through internal modularization.

## Upload decision

Do not upload from this container alone. The source/build/package checks passed, but Chrome, Firefox, Edge, and full browser QA must be rerun on a machine with browser binaries installed before Chrome Web Store submission.
