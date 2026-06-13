# Phase 19 Manual Release QA Checklist

LeakGuard Phase 19 is the final human confidence pass after automated release, browser, fuzz, artifact, and CI gates have passed. Do not use this checklist as a full retest of automated coverage. Keep the session focused on installability, obvious user-facing behavior, real provider confidence, generated-file readability, and store/privacy accuracy.

## Setup

- Verify the exact package zip to test from `artifacts/release`; record filename, target browser, and checksum if available.
- Install or load the unpacked Chrome build from the matching release build output.
- Install or load the Firefox build if practical for the release target and tester environment.
- Confirm the extension version number matches `package.json` and the store submission target.
- Confirm the contact email in privacy docs is finalized and correct: `petritbahtiri24@gmail.com`.
- Use synthetic fake secrets only. Never test with live credentials.
- Stop immediately if the extension fails to load, the tested package is ambiguous, or the displayed version does not match the release target.

## Chrome Manual Smoke

- Open the Chrome extension details page and confirm LeakGuard is enabled with no install-time errors.
- Open the popup and confirm the main status, File Scanner entry point, and protected-site management entry point render.
- Open a built-in protected site and confirm the in-page LeakGuard status UI appears without blocking normal typing.
- Paste a short synthetic secret into a protected composer and confirm the redaction prompt or redacted placeholder flow is visible before send.
- Confirm no browser console output exposes the raw fake secret during the smoke path.

## Firefox Manual Smoke

- If practical, load the Firefox build and confirm LeakGuard is enabled with no install-time errors.
- Open the popup and confirm the main status, File Scanner entry point, and protected-site management entry point render.
- Open at least one built-in protected site and confirm the in-page LeakGuard status UI appears.
- Paste a short synthetic secret into a protected composer and confirm redaction behavior is observable.
- If Firefox login, provider access, or local tooling blocks the live smoke, record the limitation and rely on completed automated Firefox gates plus Chrome live QA for the manual confidence pass.

## Scanner Manual QA

- Supported image redaction formats: PNG, JPG, JPEG, and WEBP. Use one fixture from each format when time allows.
- Scan a text/source file with a fake secret and download `.redacted.txt`.
- Scan an image with a fake visible or metadata secret and download `.redacted.png` when visual redaction is eligible.
- Open the redacted image in a local viewer, search for the raw fake secret in generated metadata/report files, and visually inspect the covered region before treating image redaction as successful.
- Scan a text PDF with a fake secret and download `.redacted.pdf` and `.redacted.txt`.
- Scan a DOCX with a fake secret and download `.redacted.docx` and `.redacted.txt`.
- Scan an XLSX with a fake secret and download `.redacted.xlsx` and `.redacted.txt`.
- Download the JSON report and confirm it is sanitized.
- Open all generated files locally.
- Confirm the raw fake secret is not visible in generated text, image, PDF, DOCX, XLSX, or JSON report output.
- Stop immediately if any generated output exposes the raw fake secret or a generated PDF/DOCX/XLSX cannot open locally.

## Protected-site Manual QA

- On a protected site, use a file picker upload for image, PDF, DOCX, and XLSX test files.
- On a protected site, use drag/drop upload for image, PDF, DOCX, and XLSX test files.
- Gemini image upload check: with protected-site OCR explicitly enabled, upload or drag/drop a PNG/JPG/JPEG/WEBP fixture with a visible synthetic secret and confirm Gemini receives only the sanitized `.redacted.png` file or a safe fallback/download path.
- Where the provider UI exposes file details, verify the redacted extension, name, and MIME type are visible or consistent with the sanitized handoff.
- Verify no raw fake secret appears on the page, in the composer, or in visible attachment previews.
- Confirm unsupported `.doc`, `.docm`, `.xls`, and `.xlsm` files fail closed and are not represented as safely scanned or redacted.
- Confirm a raw file is not uploaded after a LeakGuard protection failure.
- For Gemini drag/drop, rely on human observation and the visible outcome; do not depend on brittle selectors.

## Real Provider Smoke

- ChatGPT: complete a basic paste smoke with a fake secret and one file upload smoke with a supported file.
- Gemini: complete a basic paste smoke with a fake secret and one file upload smoke with a supported file.
- Grok: complete a basic paste smoke with a fake secret and one file upload smoke with a supported file.
- Claude: complete the same paste and file upload smoke if account access is available; otherwise record as optional coverage skipped.
- For each provider, observe whether LeakGuard redacts before content reaches the page or upload preview.
- Do not depend on brittle selectors, internal DOM names, or exact provider layout. This is a human observation pass.
- At least one real provider paste path and one real provider upload path must work before GO.

## Generated File Open Checks

- Open every `.redacted.txt` in a local text editor and search for the raw fake secret.
- Open every `.redacted.png` in a local image viewer and visually inspect for the raw fake secret.
- Open every `.redacted.pdf` in a local PDF viewer and search or inspect for the raw fake secret.
- Open every `.redacted.docx` in a local document editor and search for the raw fake secret.
- Open every `.redacted.xlsx` in a local spreadsheet editor and search visible cells for the raw fake secret.
- Open the JSON report in a local text editor and search for the raw fake secret.
- Stop immediately if any generated file cannot open or contains the raw fake secret.

## Store Listing/privacy Review

- Confirm Chrome listing text matches current LeakGuard features and limitations.
- Confirm the Firefox AMO checklist matches current LeakGuard features and limitations.
- Confirm the privacy policy contact email is correct: `petritbahtiri24@gmail.com`.
- Confirm limitations are clear: local-only processing, no backend, no telemetry, no cloud verification, no remote OCR, scoped file support, and no perfect-protection claims.
- Confirm screenshots are not misleading and show features that exist in the tested package.
- Stop immediately if store or privacy text is wrong for the package being published.

## Go/no-go Decision

Use this as a literal go/no-go gate. Record the decision, date, tester, package filename, browser coverage, provider coverage, and any skipped optional checks.

### 30-minute minimum QA

- Setup: verify package zip, Chrome install/load, version number, and privacy contact email.
- Scanner: run one text/source file, one PDF, one DOCX, one XLSX, one image, and one JSON report check.
- Protected-site: run one file picker upload and one drag/drop upload on a protected site.
- Real provider: complete ChatGPT or Gemini paste plus upload smoke, then run Grok if access is already available.
- Generated files: open the files produced in this session and search for the raw fake secret.
- Store/privacy: check privacy contact, Chrome listing feature match, Firefox AMO checklist feature match, limitations, and screenshots.

### 90-minute full human QA

- Complete Setup, Chrome manual smoke, Firefox manual smoke if practical, Scanner manual QA, Protected-site manual QA, Real provider smoke, Generated file open checks, and Store Listing/privacy Review.
- Cover ChatGPT, Gemini, and Grok paste and upload paths.
- Add Claude only when account access is already available and does not consume the session.
- Use the same synthetic fake secret across scanner and provider checks so raw-output searches are straightforward.
- Preserve notes for any provider access limitation, but do not block solely on optional Claude coverage.

### Clear stop conditions

- Stop on any raw fake secret visible in generated output, protected-site page content, attachment previews, or JSON reports.
- Stop if a raw file uploads after LeakGuard reports or shows a protection failure.
- Stop if image OCR, visual redaction, sanitized export, or provider handoff fails and LeakGuard does not block the raw image upload.
- Stop if the extension fails to load in the required target browser.
- Stop if generated PDF, DOCX, or XLSX output cannot open locally.
- Stop if store listing, AMO checklist, privacy policy, contact email, or screenshots are wrong for the package being published.

### GO criteria

GO only if:

- The tested package installs or loads in the required browser target.
- Scanner basic outputs work for text/source, image, PDF, DOCX, XLSX, and JSON report checks.
- Image redaction QA passes for supported PNG/JPG/JPEG/WEBP input, including redacted image open/visual inspection and raw-secret search.
- At least one real provider paste path and at least one real provider upload path work.
- No raw fake secret is visible in generated files or sanitized reports.
- Privacy policy, contact email, Chrome store listing, Firefox AMO checklist, limitations, and screenshots are correct for the tested package.

### NO-GO criteria

NO-GO if:

- A raw fake secret appears in any generated output, protected-site page content, attachment preview, or JSON report.
- A raw file uploads after a LeakGuard protection failure.
- NO-GO if image OCR, visual redaction, sanitized export, or provider handoff fails and raw image upload is not blocked.
- The extension fails to load in the required target browser.
- A generated PDF, DOCX, or XLSX cannot open locally.
- Store privacy text, privacy policy contact email, Chrome listing text, Firefox AMO checklist, limitation wording, or screenshots are wrong for the release.
