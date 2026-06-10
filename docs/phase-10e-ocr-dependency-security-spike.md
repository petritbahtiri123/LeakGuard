# Phase 10E OCR Dependency/Security Spike

Date: 2026-06-10

Scope: dependency and security spike only. This phase does not implement OCR,
wire OCR into the scanner UI, add OCR to the production build, change
permissions, weaken CSP, or add remote/CDN/model downloads.

## Method

Added `scripts/ocr-dependency-security-spike.mjs`, a standalone inspection
script that runs `npm pack` for candidate packages in an OS temp directory,
parses the package tarballs, scans package contents, prints metadata-only
results, and removes the temp directory. It does not run `npm install`, does not
modify `package-lock.json`, and does not copy OCR assets into `dist/`.

Command run:

```bash
npm run spike:ocr-deps
```

No package was installed into production dependencies or devDependencies for
this spike. Temporary tarballs were created under a temp directory and removed
by the script.

## Candidates Evaluated

| Candidate | Version | License | Unpacked size | Packed size | Runtime assets found | Unsafe-code findings | Remote/default-fetch findings | MV3/CSP risk |
| --- | ---: | --- | ---: | ---: | --- | --- | --- | --- |
| `tesseract.js` | 7.0.0 | Apache-2.0 | 1.35 MiB | 601.99 KiB | Browser worker files, `dist/worker.min.js`; no WASM/model by itself | `Function` constructor in bundled/minified files and worker bundle | `fetch`, `importScripts`, jsDelivr/default CDN strings | High unless fully repackaged to local worker/core/lang paths and audited for unsafe code |
| `tesseract.js-core` | 6.1.2 | Apache-2.0 | 29.19 MiB | 10.81 MiB | 4 WASM files plus JS/WASM loader variants | None detected by static string scan | `fetch`/`XMLHttpRequest` loader code and URL strings | Medium/high; local WASM is possible, but loader behavior needs extension-specific audit |
| `@tesseract.js-data/eng` | 1.0.0 | MIT | 13.23 MiB | 13.20 MiB | `eng.traineddata.gz` model files | None detected | URL strings in package metadata/docs only | Size risk is high; model must be packaged locally with no runtime download |
| `ocrad.js` | 0.0.1 | GPL-3.0 | 1.87 MiB | 589.64 KiB | Worker file; no WASM/model split | `eval` and `Function` in `ocrad.js` | `XMLHttpRequest`, `importScripts`, many URL strings | Blocked: unsafe code plus GPL-3.0 license mismatch risk |

The smaller browser-compatible package inspected was `ocrad.js`. It is smaller
than a complete Tesseract stack, but it is not acceptable for LeakGuard because
it uses unsafe dynamic code patterns and is GPL-3.0 licensed.

Remote OCR options were not pursued. Remote OCR remains rejected because
LeakGuard is local-only and must not send images, extracted text, or raw secrets
to a backend or third-party OCR service.

## Size Findings

A straightforward English-only local Tesseract stack requires at least:

- `tesseract.js`: 1.35 MiB unpacked, 601.99 KiB packed.
- `tesseract.js-core`: 29.19 MiB unpacked, 10.81 MiB packed.
- `@tesseract.js-data/eng`: 13.23 MiB unpacked, 13.20 MiB packed.

Combined package-only impact:

- Unpacked: about 43.77 MiB before integration overhead.
- Packed/zipped: about 24.61 MiB before integration overhead.

This does not include any wrapper code, QA fixtures, alternate language models,
or additional browser-extension packaging overhead. It also does not account for
runtime memory cost, worker startup cost, image decoding, cancellation, or UI
progress handling.

Multi-language OCR would add one or more language packages and is not viable
under the current size budget without a separate OCR build or explicit budget
exception.

## Security And Privacy Findings

- `tesseract.js` has bundled worker/default option paths that reference CDN
  defaults and worker/core/lang loading patterns. A safe integration would need
  every worker, core, and language path pinned to packaged extension URLs.
- `tesseract.js` static scan found `Function` constructor usage in bundled
  files. This is incompatible with LeakGuard's current MV3 CSP posture unless a
  deeper audit proves the code path is not used or a different bundle is used.
- `tesseract.js-core` contains local WASM assets, but loader code contains
  `fetch`/`XMLHttpRequest` paths. Packaged local loading might be possible, but
  must be audited in Chrome and Firefox MV3 extension contexts.
- `@tesseract.js-data/eng` is model data only. It is local-friendly if packaged,
  but large and must never be downloaded at runtime.
- `ocrad.js` is blocked by `eval`/`Function` findings and GPL-3.0 license risk.

Raw OCR text remains a new high-risk data surface. Any later OCR design must
prove that raw OCR text is transient only and cannot enter logs, diagnostics,
storage, reports, cache debug snapshots, or provider handoff metadata.

## CSP/MV3 Findings

Current LeakGuard extension-page CSP remains:

```json
{
  "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';"
}
```

The spike does not change CSP. Based on the static package scan:

- `tesseract.js` is not ready for the current CSP because bundled files contain
  `Function` constructor matches and default CDN/worker loading strings.
- `ocrad.js` is not compatible because it contains `eval` and `Function`.
- `tesseract.js-core` plus local language data is the only plausible path, but
  it still requires a dedicated extension-context proof for local WASM loading,
  worker packaging, Firefox support, and no remote fallback.

## Production Package Impact

Production impact in this phase:

- No OCR production dependency added.
- No OCR devDependency added.
- No OCR asset copied to `dist/`.
- No permission changed.
- No CSP changed.
- No scanner or protected-site runtime behavior changed.

Static guards now check that production dependencies, production source/build
surfaces, generated `dist` files, and CSP do not accidentally include OCR
packages, OCR model assets, CDN strings, or unsafe-eval requirements.

## Recommendation

Hard recommendation: keep OCR blocked for the default LeakGuard build.

Do not implement OCR in the default extension now. The straightforward
English-only Tesseract package shape is too large for the current budget and
still has unresolved MV3/CSP/default remote-loading questions. `ocrad.js` is not
acceptable due to unsafe code and license risk.

The only plausible future path is an optional/separate OCR build after a deeper
proof-of-concept demonstrates all of the following:

1. Local-only packaged worker/core/model loading with no CDN, no remote fallback,
   and no runtime model download.
2. No `eval`, `Function`, `unsafe-eval`, inline JavaScript, or CSP weakening.
3. Chrome and Firefox MV3 compatibility.
4. Scanner-page-only execution with strict size limits, cancellation, progress
   UI, and no protected-site attach path by default.
5. Raw OCR text never reaches logs, storage, reports, diagnostics, cache debug
   metadata, or provider handoff metadata.
6. A size budget exception or separate OCR build/channel is explicitly approved.

## Follow-Up Gates

OCR implementation remains blocked until:

- A local-only OCR proof-of-concept is measured against the Phase 10D file
  extraction performance baseline.
- Extension package size is re-measured for every build target.
- CSP and worker/WASM loading are tested in Chrome, Edge, and Firefox.
- Legal/license review approves the selected OCR package set.
- Product copy clearly states OCR is best-effort and does not imply full image
  redaction or full document redaction.
