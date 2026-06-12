# Firefox AMO Listing And Submission Checklist

Use this checklist for Firefox Add-ons submission work. It complements the internal remediation playbook at [codex-playbooks/firefox-addon-submission.md](codex-playbooks/firefox-addon-submission.md).

Mozilla requirements can change. Verify current AMO guidance before submission.

## Package Selection

- Build the Firefox target with `npm run build:firefox`.
- Submit the Firefox package generated from `dist/firefox`, not the Chrome build.
- Keep source packages separate from runtime extension packages.
- Do not include secrets, local `.env` files, private transcripts, or generated local run captures.

## Manifest Review

Confirm the Firefox manifest includes expected Firefox metadata:

- `browser_specific_settings.gecko.id`
- `browser_specific_settings.gecko.strict_min_version`
- `browser_specific_settings.gecko.data_collection_permissions.required`

Confirm the shared security posture remains intact:

- Manifest V3 shape is preserved for this repository.
- Extension-page CSP remains restrictive.
- No inline JavaScript is added.
- Built-in host permissions match supported built-in sites.
- Optional host permissions are still justified by user-managed protected sites.

## Data Collection Declaration

The Firefox listing should match LeakGuard's local-only model:

- no backend service
- no telemetry
- no cloud processing
- no remote model calls
- no sale or transfer of user data
- no collection of prompt text, file contents, raw secrets, email addresses, or raw network values by a remote service

If AMO asks about selected local files, describe local file processing in the browser and keep scope precise: text/source files, text PDF extraction, DOCX text extraction, XLSX text extraction, image metadata, English-only scanner image OCR, and protected-site image OCR only when the user opts in. Scanner and protected-site text PDFs can export regenerated `.redacted.pdf` from sanitized text only; protected-site PDFs fall back to `.redacted.txt` when regeneration would truncate. DOCX, XLSX, image metadata, and OCR text outputs export `.redacted.txt`; eligible visual image redaction exports flattened `.redacted.png`.

Do not publish the privacy/support contact fields until [PRIVACY_POLICY.md](PRIVACY_POLICY.md) and [STORE_ASSETS_CHECKLIST.md](STORE_ASSETS_CHECKLIST.md) have real project contacts. No correct support or privacy contact is currently discoverable in this repository.

## Source Package Notes

A reviewer-oriented source package should include enough to reproduce the submitted Firefox package:

- source files
- manifests
- scripts
- package metadata
- docs needed for build/review context
- AI training/export scripts if the packaged model/runtime assets need review context

Avoid unnecessary generated or vendored duplication if AMO requirements allow it, but do include clear reproduction commands.

## Suggested Reviewer Notes

- LeakGuard processes protected composer text locally in the browser.
- Supported local UTF-8 text/source files, text PDFs, DOCX text, XLSX text, image metadata, and English-only image OCR flows are scanned and redacted locally.
- Scanner and protected-site text PDFs can export regenerated `.redacted.pdf` from sanitized text only; protected-site PDFs fall back to `.redacted.txt` when regeneration would truncate. DOCX, XLSX, image metadata, and OCR text outputs export `.redacted.txt`, not rebuilt originals.
- Scanner visual image redaction exports flattened `.redacted.png`; protected-site image OCR is opt-in, default off, and uploads `.redacted.png` only when OCR boxes are eligible.
- Unsupported scanned PDFs, non-English OCR, remote OCR/backend flows, archives, executables, legacy/macro Office files, and binary files are not scanned or redacted in this release.
- Unsupported files are not represented as scanned, sanitized, or protected; behavior can be warning-only pass-through or blocking when the browser/site path cannot be safely continued.
- Secure reveal is restricted to extension-owned UI.
- Raw secrets are not intentionally persisted in long-term extension storage.
- Optional host access is requested only when a user adds a protected site.
- Enterprise policy is optional and does not add remote processing.

## Manual QA Before Submission

Run:

```bash
node tests/build_targets.test.js
node tests/security.test.js
npm run build:firefox
```

Then manually check:

- popup opens
- built-in protected site shows active status
- exact-origin user-managed protection can be added and removed
- `Redact` rewrites a synthetic secret
- `Allow once` works when policy allows it
- secure reveal stays in the popup
- File Scanner handles one supported text file
- File Scanner handles one text PDF, one DOCX, one XLSX, one image metadata scan, and one local English OCR image
- protected-site OCR remains off by default until explicitly enabled
- unsupported files show honest text-only messaging and are not marked scanned, sanitized, or protected

For full release coverage, complete [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md).

## Copy Review

Firefox listing copy should stay aligned with:

- [README.md](../README.md)
- [PRIVACY_POLICY.md](PRIVACY_POLICY.md)
- [NON_GOALS.md](NON_GOALS.md)
- [BROWSER_COMPATIBILITY_MATRIX.md](BROWSER_COMPATIBILITY_MATRIX.md)

Do not claim full DLP, perfect detection, compliance certification, layout-preserving PDF redaction, rebuilt DOCX/XLSX outputs, scanned-PDF OCR, non-English OCR, remote OCR/backend processing, image format preservation, remote verification, or support for every editor/upload path.
