# Phase 9C-0 OCR Feasibility, Size Budget, and Architecture Plan

Date: 2026-06-09

> Historical feasibility note, 2026-06-18: local scanner/protected-site OCR has moved beyond this feasibility snapshot. Use `docs/FILE_CAPABILITY_MATRIX.md`, `docs/FILE_UPLOAD_SCANNING_GUIDE.md`, and `docs/RELEASE_QA_CHECKLIST.md` for current OCR support, default settings, and fail-closed behavior.

Scope: planning and validation only. This report does not implement OCR, add
dependencies, add permissions, or change scanner behavior.

## Current Measurement

Measured after running `npm run build:all` and packaging release zips with
`npm run package:release`.

| Artifact | Size bytes | Size MiB |
| --- | ---: | ---: |
| `dist/chrome` | 14,293,907 | 13.63 |
| `dist/chrome-enterprise` | 14,294,019 | 13.63 |
| `dist/firefox` | 14,294,632 | 13.63 |
| `dist/firefox-enterprise` | 14,294,677 | 13.63 |
| `artifacts/release/leakguard-chrome-v1.7.0.zip` | 3,692,725 | 3.52 |
| `artifacts/release/leakguard-chrome-enterprise-v1.7.0.zip` | 3,692,758 | 3.52 |
| `artifacts/release/leakguard-firefox-v1.7.0.zip` | 3,692,870 | 3.52 |
| `artifacts/release/leakguard-firefox-enterprise-v1.7.0.zip` | 3,692,879 | 3.52 |
| `src/shared/fileExtractors.js` | 26,309 | 0.025 |

The current installed target size has about 36.37 MiB of headroom under a
50 MiB target. The compressed release zip size is much smaller, but extension
budget decisions should use installed/unpacked target size because OCR engines,
WASM, and language data must be available locally at runtime.

## OCR Options Compared

| Option | Bundle impact | Runtime risk | Privacy/security fit | 50 MiB target |
| --- | --- | --- | --- | --- |
| No OCR / metadata only | No meaningful change. Current image support remains metadata-only. | Lowest. No CPU-heavy image processing. | Best. No raw image text extraction or new storage/logging surface. | Stays under target. |
| Tesseract.js English-only packaged locally | High. Registry metadata on 2026-06-09 reports `tesseract.js@7.0.0` at about 1.35 MiB unpacked, `tesseract.js-core@7.0.0` at about 43.17 MiB unpacked, and `@tesseract.js-data/eng@1.0.0` at about 13.23 MiB unpacked. Added to the current 13.63 MiB target, the naive installed size is about 71.38 MiB before integration overhead. | High. OCR can block or degrade scanner-page responsiveness without strict worker isolation, file-size limits, cancellation, and progress handling. Memory spikes are likely on large images. | Possible only if fully packaged locally with no CDN, no model download, no raw OCR persistence, and no eval/unsafe code. Requires dependency audit. | Does not fit a 50 MiB target in the straightforward package shape. |
| Tesseract.js multi-language packaged locally | Very high. English plus orientation/script data plus a small language set such as German and French would add roughly another 14.71 MiB beyond English-only assumptions, producing an installed target around 86 MiB or more. Larger language sets grow quickly. | Higher than English-only due to larger data loading and potentially more memory churn. | Same local-only requirements as English-only, with more model assets to audit and ship. | Does not fit a 50 MiB target. |
| Browser-native OCR if available later | Potentially minimal bundle impact if the browser exposes a stable local API. | Unknown. Depends on API threading, permissions, availability, and failure modes. | Potentially good only if processing is local, requires no extra permission, exposes no raw text to browser sync/cloud services, and works in Chrome and Firefox MV3 contexts. | Likely fits, but not actionable until a cross-browser local API exists. |
| Remote OCR | Low local bundle size but requires network transfer of image content. | Depends on service latency and availability. | Rejected. LeakGuard's privacy model is local-only and must not send raw images or extracted text to remote services. | Size may fit, but privacy model does not. |
| ML/AI vision models packaged locally | Usually very high. Vision OCR or document-understanding models often require large model files plus runtime support. | High CPU/GPU/WASM memory and startup risk. Larger attack surface and harder browser-extension QA. | Deferred. Local-only is possible in theory, but size, model provenance, unsafe-code review, and performance risks are not acceptable for OCR v1. | Not assumed to fit. |

## Estimated Bundle Impact

Current baseline:

- Installed extension target: 13.63 MiB per browser/mode target.
- Release zip: 3.52 MiB per target.
- File extractor source: 26,309 bytes.

Estimated local OCR additions:

- English-only Tesseract.js path: about 57.76 MiB unpacked before integration
  overhead, based on package metadata for `tesseract.js`, `tesseract.js-core`,
  and English language data.
- Naive English-only installed target: about 71.38 MiB.
- Small multi-language package example using English, OSD, German, and French:
  about 72.49 MiB added, for an installed target around 86.12 MiB.
- Runtime performance risk: high without a dedicated worker, strict image size
  caps, cancellation, and visible progress. OCR should never run in composer
  interception paths.
- Runtime memory risk: high for large images, multi-page sources, and repeated
  OCR jobs. OCR v1 would need serialized jobs and hard limits.

Conclusion: Tesseract.js packaged in the straightforward local form is not
ready for implementation under a 50 MiB installed target budget.

## OCR v1 Scope If Approved Later

If OCR is approved after a budget exception or a smaller audited local OCR path
is found, keep v1 deliberately narrow:

- Supported inputs: PNG, JPG, JPEG, and WEBP only.
- Language: English only.
- Execution: local packaged worker/model only.
- Network: no remote worker, no CDN, no runtime model download.
- PDF scope: no scanned-image PDF OCR unless explicitly enabled in a later
  phase.
- Output scope: no image redaction yet.
- UI surface: scanner page only first. Do not run OCR in protected-site
  composer interception, Gemini/Firefox bridge paths, or pending attach flows.
- Export: allow exporting redacted OCR text as `.redacted.txt`.
- Storage/logging: raw OCR text must stay transient, must not be logged, and
  must not be stored in local storage, reports, diagnostics, or audit records.
- Failure behavior: OCR failures should leave existing metadata-only image
  handling intact and should not pass raw OCR text anywhere.

## Hard Blockers

OCR implementation must not proceed if any of these are true:

- The installed extension target exceeds the agreed size budget.
- OCR requires a remote worker, CDN script, runtime model download, or backend
  service.
- Raw OCR text can appear in logs, local storage, reports, diagnostics, crash
  output, exports other than the user-requested redacted text export, or audit
  records.
- OCR can block the scanner-page UI without cancellation/progress controls.
- The OCR dependency requires `eval`, `unsafe-eval`, inline JavaScript, weakened
  MV3 CSP, or other unsafe code execution.
- The dependency cannot run in both Chrome and Firefox MV3 extension contexts
  without new permissions.
- OCR would touch protected-site runtime scanner behavior, detector rules,
  Gemini/Firefox bridge behavior, pending attach lifecycle, or background
  placeholder/session/reveal logic.

## Recommended Decision

Do not implement OCR in Phase 9C under the current 50 MiB target. Keep image
handling metadata-only for now, and treat OCR as blocked until one of these is
true:

1. The project explicitly accepts a larger installed-size budget.
2. A smaller audited local OCR engine/model path is identified and verified.
3. A browser-native local OCR API becomes available without new permissions,
   remote processing, raw text persistence, or Chrome/Firefox incompatibility.

The safest next step is a static dependency/security spike only: inspect any
candidate OCR package for unpacked size, CSP compatibility, worker loading,
remote fetch behavior, eval/unsafe-code usage, and MV3 Chrome/Firefox support
before writing runtime integration code.
