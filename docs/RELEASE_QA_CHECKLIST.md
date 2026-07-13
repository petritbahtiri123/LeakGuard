# LeakGuard Release QA Checklist

## Before Packaging

- Active 3.0 reliability scope is Google Chrome and Microsoft Edge only. Firefox builds, packages, smoke tests, manual QA, and store-submission checks are non-gating and must not be included in the active release evidence.
- Review [RELEASE_3_0_0_RELIABILITY.md](RELEASE_3_0_0_RELIABILITY.md) and complete its 3.0.0 reliability/manual-QA gates before changing release identity.
- Complete the [LeakGuard 3.0 Full-Feature Reliability Matrix](qa/3.0-full-feature-reliability-matrix.md); `npm run test:release-matrix` must pass before any release identity changes. The completion gate intentionally fails while required evidence remains `PENDING` or `FAIL`.
- Reload the unpacked extension after the latest branch changes.
- Confirm the popup opens and renders correctly on desktop width.
- Confirm the popup still renders correctly on a smaller laptop display.
- Confirm the complete release aggregate passes: `npm run test:release`. It owns documentation links, the complete nightly aggregate, and the full-feature matrix completion gate.
- For focused reruns, Tier A is `npm run test:fast`, Tier B is `npm run test:release-gates`, and deterministic Chromium E2E is `npm run build:chrome` followed by `npm run test:e2e`.
- Confirm the built manifest includes `content_security_policy.extension_pages` with LeakGuard's restrictive extension-page CSP.
- Confirm the built manifest does not add new host permissions for File Scanner.
- Confirm protected-site image OCR is settings-controlled, enabled by default for supported image uploads, and can be turned off.
- Confirm image redaction support is documented for PNG, JPG, JPEG, and WEBP inputs, with fail-closed behavior if OCR, canvas decode/draw, redaction, sanitized export, or provider handoff fails.

## CI And Nightly Validation

- PR-required validation is Tier A (`npm run test:ci`, which maps to `npm run test:fast`) plus the separate `deterministic-e2e` Playwright job (`npm run build:chrome` followed by `npm run test:e2e`).
- Release/manual validation runs through `npm run test:release`: documentation links, `npm run test:nightly`, then `npm run test:release-matrix`.
- Deterministic local-fixture E2E is account-free and required in PR CI through the separate Playwright job.
- Nightly/browser validation is Tier A plus Tier B plus deterministic E2E plus Tier C: `npm run test:nightly`; `.github/workflows/browser-nightly.yml` installs Playwright Chromium after `npm ci` and executes that named aggregate once.
- Tier C packaged browser validation is heavy and environment-sensitive, remains outside PR CI, and runs through `npm run test:browser-gates`, which owns `npm run preflight:browser` followed by `npm run qa:browser:full`.
- The release-artifacts workflow installs Playwright Chromium after `npm ci`, then runs Tier A, Tier B, deterministic E2E, and `npm run test:release-matrix` before generating checksums.
- Authenticated live-site E2E against ChatGPT, Gemini, WhatsApp, or other logged-in providers remains manual/headed only and is not required for PR CI.
- A browser startup failure before extension load, such as a Chrome/Edge GPU/CDP startup failure, is a local or CI environment failure until rerun evidence shows the extension loaded and failed product assertions.
- Product failures are failures after the extension loads and a LeakGuard behavior assertion fails, such as missing popup controls, missing protected-site panel, raw marker leakage, failed redaction, or missing scanner export behavior.

## Enterprise Metadata Release-Candidate Helper

- Review [Enterprise Metadata Release-Candidate Evidence](ENTERPRISE_METADATA_RELEASE_CANDIDATE_EVIDENCE.md) before making release claims for enterprise/cloud/internal metadata coverage.
- Record live logged-in provider results in [Enterprise Metadata Live Manual QA Results](qa/ENTERPRISE_METADATA_LIVE_MANUAL_QA_RESULTS.md).
- Follow [Enterprise Metadata Live Site QA Runbook](qa/ENTERPRISE_METADATA_LIVE_SITE_QA_RUNBOOK.md) for Chrome, ChatGPT, Gemini, and failure-handling steps. Firefox steps in older runbook material are outside the active 3.0 scope.
- Local evidence refresh commands:

```powershell
npm run docs:check-links
node tests/security.test.js
node tests/productization.test.js
node tests/build_targets.test.js
git diff --check
```

## Phase 19 Live Browser QA Status

- Chrome live QA completed: GO for release readiness after human store listing review.
- Edge basic Chromium compatibility completed: LIMITED GO.
- Edge live-provider retest remains a follow-up before strong Edge claims.
- Human store listing review remains required before Chrome publishing.
- Live provider file upload was not attempted without QA/test accounts; keep provider upload claims scoped to automated local protected-site coverage until manual account-backed QA is available.
- Screenshots were intentionally skipped to avoid capturing account or bot-check data.

## Built-in Site Coverage

- Open ChatGPT and confirm LeakGuard shows the current site as protected.
- Open at least one additional built-in site such as Claude, Gemini, Grok, OpenAI Chat, or X and confirm the same.
- Confirm the in-page top-center status menu appears on protected sites.

## User-managed Site Flow

- Open a normal site that is not in the built-in list.
- Click `Protect This Site` from the popup and grant access.
- Reopen the popup and confirm the site is shown as protected.
- Open `Manage Protected Sites` in the popup and confirm the site appears in the user-managed list.
- Disable the site and confirm protection is no longer active.
- Re-enable the site and confirm protection returns.
- Remove the site and confirm it disappears from the list.

## Secret Detection Flow

- Paste the manual smoke block from `tests/manual_detection_paste_block.txt`.
- Confirm likely secrets are replaced with `[PWM_n]` placeholders when you choose `Redact`.
- Confirm likely email addresses are redacted locally in prompts and supported text files.
- Confirm obvious docs placeholders such as `replace_me`, example literals, and development variable names stay visible when they are not sensitive values.
- Confirm `databaseUrl` and `MYSQL_URL` keep their URI shape while only the password segment is masked.
- Confirm JSON fields like `accessToken`, `dbPassword`, `clientSecret`, and `apiKey` are redacted.
- Confirm webhook URLs, bearer tokens, cookie/session values, Docker auth blobs, and connection strings are redacted.
- Confirm release copy states no cloud processing, no telemetry, and no remote model calls without promising perfect protection.

## Network Detection Flow

- Confirm public IPv4 hosts are replaced with network placeholders.
- Confirm public IPv4 CIDR ranges are replaced with network placeholders.
- Confirm related public hosts inside the same subnet keep readable hierarchical placeholders.
- Confirm private IPs and private CIDRs are replaced with internal metadata placeholders.
- Confirm loopback, link-local, default route, wildcard mask, documentation ranges, and invalid IP-like text stay visible.

## Submission Safety

- Confirm `Allow once` preserves raw content for that send only.
- Confirm `Redact` rewrites the composer before send.
- Confirm submission is blocked if rewrite verification fails.
- Confirm the original text is restored if verification fails.

## Secure Reveal Flow

- Click a known placeholder in assistant output or hydrated page text.
- Confirm LeakGuard opens its popup reveal view, not a separate window.
- Confirm the raw value is shown only inside the LeakGuard popup after `Show`.
- Confirm `Hide` clears the raw value from the popup view.
- Confirm an unknown placeholder reports unavailable instead of injecting raw text into the page.

## File Scanner Flow

- Open the popup and click `Open File Scanner`.
- Select a supported text file such as `.env`, `.json`, `.md`, `.log`, or `.csv`.
- Confirm the scanner shows file name, type, size, findings count, severity summary, findings list, and redacted preview.
- Confirm the redacted preview uses placeholders and does not show detected raw secrets.
- Download the redacted copy and confirm raw secrets are absent.
- Download the JSON report and confirm raw secrets are absent from the report.
- Select a supported text file between 2 MiB and 4 MiB and confirm it is accepted for local scanning.
- Select a supported text file above 50 MB and confirm it is rejected before scanning.
- Select a text PDF with a synthetic secret and confirm the scanner exports `.redacted.txt` plus a regenerated `.redacted.pdf` from sanitized text. Confirm the PDF is not layout-preserving and does not contain the raw secret.
- Select a scanned/image-only PDF and confirm it fails closed with no scanned-PDF OCR claim.
- Select a DOCX with a synthetic secret and confirm the scanner exports both `.redacted.txt` and regenerated `.redacted.docx` from sanitized text only.
- Select an XLSX with a synthetic secret and confirm the scanner exports `.redacted.txt` plus a simple regenerated `.redacted.xlsx`, does not execute formulas, and does not preserve original XLSX XML parts.
- Select PNG/JPG/JPEG/WEBP images and confirm metadata scanning is local and pixel OCR runs only when scanner OCR is explicitly started.
- Run scanner image OCR on an English PNG/JPG/JPEG/WEBP with a synthetic secret and confirm redacted text export plus eligible flattened `.redacted.png` visual export.
- Open the redacted image in a local viewer, visually inspect that the secret region is covered, and search the JSON report/redacted text export for the raw fake secret.
- Confirm scanner OCR copy says English-only, local-only, no remote OCR/backend, no scanned-PDF OCR, no non-English OCR, no image format preservation, no layout-preserving PDF/DOCX/XLSX redaction, and no original Office document reconstruction.
- Select unsupported files such as `.zip`, `.exe`, legacy `.doc`, legacy `.xls`, `.xlsm`, `.gif`, `.svg`, and arbitrary binary files and confirm an honest unsupported/fail-closed message appears without marking the file scanned, sanitized, or protected.

## Local Text-File Paste/Drop Composer Flow

- Build and load the Chrome extension, then open ChatGPT and confirm LeakGuard shows the site as protected.
- Create a supported `.env` UTF-8 text file with synthetic values such as `API_KEY=LeakGuardFileApiKey1234567890`, `DB_PASSWORD=LeakGuardDbPassword123!`, `token_limit=4096`, `PUBLIC_IP=8.8.8.8`, and `PRIVATE_IP=10.0.0.5`.
- Paste the supported `.env` text file into the ChatGPT composer and confirm the site receives a sanitized file attachment/upload where that handoff path is supported.
- Drop the supported `.env` text file into the ChatGPT composer and confirm the site receives a sanitized file attachment/upload where that handoff path is supported.
- Select the supported `.env` text file through a site file picker, when available, and confirm the selected file is replaced with a sanitized in-memory file where browser/site handoff works.
- Confirm the sanitized attached/uploaded file redacts `API_KEY` and `DB_PASSWORD` with `[PWM_N]` placeholders.
- Confirm the sanitized attached/uploaded file keeps `token_limit=4096` visible.
- Confirm the sanitized attached/uploaded file pseudonymizes the public IP with a `[PUB_HOST_N]` placeholder.
- Confirm the sanitized attached/uploaded file redacts the private IP with a `[PRIVATE_IP_N]` placeholder.
- Confirm PDF, DOCX, XLSX, and image metadata uploads on protected sites produce sanitized outputs where supported: complete text PDFs may hand off regenerated `.redacted.pdf`, complete DOCX files may hand off regenerated `.redacted.docx`, complete XLSX files may hand off regenerated `.redacted.xlsx`, and unsafe/truncated cases fall back to `.redacted.txt` or block raw upload.
- Confirm protected-site OCR is settings-controlled and enabled by default for supported image uploads.
- Upload an eligible PNG/JPG/JPEG/WEBP image with a synthetic secret and confirm the site receives `.redacted.png` only when OCR boxes are eligible.
- Gemini image upload check: upload or drag/drop a PNG/JPG/JPEG/WEBP image with a visible synthetic secret and confirm Gemini receives only the sanitized image file or a safe fallback/download path.
- Turn protected-site OCR off and confirm supported image uploads use metadata-only `.redacted.txt` where safe.
- Upload an image with fallback/ineligible boxes or forced OCR failure and confirm LeakGuard blocks raw upload.
- Confirm unsupported/binary/invalid UTF-8 files show clear warning or blocking behavior without claiming they were scanned, sanitized, or protected.
- Confirm unsupported files are not falsely marked as protected or sanitized.
- Confirm supported text files above 50 MB are blocked from local redaction with a clear too-large warning.
- Confirm supported text files are never uploaded raw if LeakGuard attempted sanitization and handoff failed.
- Confirm small supported text files fall back to sanitized composer text when the browser or site does not accept synthetic `DataTransfer`/file handoff, and confirm raw upload is blocked if that safe fallback cannot complete.
- Confirm the composer remains usable after unsupported-file or sanitized-handoff failure handling.
- Confirm no raw synthetic secret appears in the DOM or browser console.

## WhatsApp Web Current Support Flow

- Review [WHATSAPP_SUPPORT_MATRIX.md](WHATSAPP_SUPPORT_MATRIX.md) before release QA.
- In a controlled WhatsApp test chat, confirm typing, multiline text, text paste, and send replay redact before send and do not require a second click.
- Paste a PNG/JPG/JPEG/WEBP clipboard image and confirm WhatsApp receives only the sanitized image, or the paste blocks fail-closed with no raw preview.
- Use the attach button with exactly one supported file from each supported family: canonical text-like file from `FileTypeRegistry`, `Dockerfile` or `Makefile`, PNG/JPG/JPEG/WEBP image, text PDF, DOCX, and XLSX.
- Use the attach button with an in-cap supported multi-file batch and confirm all files are sanitized locally, handed off in input order, and blocked all-or-nothing if any file fails.
- Drag/drop exactly one supported file and then an in-cap supported multi-file batch; confirm behavior matches attach-button support.
- Select or drop an over-cap batch, such as twenty-one small files or six large files, and confirm LeakGuard blocks before reading any file.
- Try unsupported families such as GIF, BMP, ICO, SVG, archives, executables, arbitrary binaries, legacy Office, and macro Office files. Confirm WhatsApp receives no raw file and no unsafe preview.
- Confirm WhatsApp file paste remains out of scope except clipboard image paste, and no document/file paste is treated as supported.
- Confirm WhatsApp never receives extracted file text inserted into the message composer as fallback.
- Confirm unsafe filenames, raw content, OCR text, stack traces, and debug details do not appear in WhatsApp UI, logs, reports, or metadata.

## Chrome Protected-Site File/Drop Checks

- In Chrome on Gemini, drag and drop supported UTF-8 text/config/code files at small size, 5 MB, 25 MB, and exactly 50 MiB; confirm LeakGuard redacts locally and Gemini receives only sanitized content.
- In Chrome on Gemini, confirm dropping a file does not unexpectedly open the operating system file picker or duplicate upload dialogs.
- In Chrome on a controlled user-managed protected site, type a synthetic password and confirm redaction succeeds without `Rewrite verification failed` when the raw secret is removed and placeholders remain visible.
- If Claude manual access is unavailable, keep Claude covered through automated selector and smoke tests rather than blocking release QA on manual validation.

## Size-Aware Local Payload Flow

- Test a supported local text/config payload at or below 2 MiB and confirm it processes without the optimization status.
- Test supported local text/log payloads between 2 MiB and 4 MiB, such as 2.5 MiB and 3.9 MiB, and confirm LeakGuard shows `Optimizing redaction...` while processing locally.
- Confirm 2-4 MiB payloads still redact locally and hand off only sanitized content.
- Test supported local text files above 4 MiB and up to 50 MB, such as 5 MB, 10 MB, 25 MB, and 50 MB, and confirm LeakGuard shows `Streaming redaction...`.
- Confirm streaming payloads are sanitized locally and handed off only as sanitized files where the site/browser file handoff accepts the replacement.
- Confirm streaming redaction preserves repeated-placeholder consistency across chunks.
- Confirm secrets near chunk boundaries, database URLs, bearer-style tokens, and private-key blocks are redacted in the sanitized file.
- Test a supported local text payload above 50 MB and confirm LeakGuard blocks it with `File too large for local redaction`.
- Confirm blocked payloads are not inserted, attached, uploaded, handed off, or truncated.
- Confirm the block message says LeakGuard blocked the upload because it cannot safely sanitize the file yet.
- Confirm ChatGPT large paste that becomes a Plain Text attachment still produces only sanitized file/text content for allowed sizes.
- Confirm ChatGPT paste above 4 MiB uses streaming redaction where possible, or blocks fail-closed if sanitized handoff cannot complete.
- Confirm Gemini 9 KiB and 14.7 KiB text files use the direct editor path and avoid `execCommand`.
- Confirm Gemini payloads above 256 KiB still require confirmation before editor insertion.
- Confirm Gemini 10 MB text-file upload uses sanitized file handoff after streaming redaction and does not fall back to raw upload.
- Confirm Gemini blocks or asks instead of dumping very large sanitized text into the visible editor when sanitized file handoff is unavailable.

## Regression Checks

- Confirm there is no duplicate dynamic script ID error when adding or removing protected sites.
- Confirm there is no `removeContentScripts is not a function` error.
- Confirm placeholder clicks do not open the retired separate reveal window flow.
- Confirm the popup management and reveal views still work after browser reload.

## Store Submission Assets

- Capture final screenshots for popup home, popup management, in-page panel, decision modal, and popup reveal.
- Confirm [STORE_ASSETS_CHECKLIST.md](STORE_ASSETS_CHECKLIST.md) is complete for the target store.
- Confirm publication contacts are finalized in `docs/PRIVACY_POLICY.md`: support, privacy, and security all use `petritbahtiri24@gmail.com`.
- Review the Chrome Web Store copy in `docs/CHROME_WEB_STORE_LISTING.md`.
- Review [FILE_CAPABILITY_MATRIX.md](FILE_CAPABILITY_MATRIX.md) against release copy: scanner and protected-site text PDFs, DOCX, and XLSX can export regenerated files from sanitized text only, protected-site regenerated outputs fall back to `.redacted.txt` when regeneration would truncate, scanner visual image redaction exports PNG, protected-site OCR is settings-controlled/default-on for supported image uploads with opt-out, no scanned-PDF OCR, no non-English OCR, no remote OCR/backend, and no image format preservation.
- GO/NO-GO for image redaction: GO only after supported image fixtures produce sanitized outputs with no visible/searchable raw fake secret; NO-GO if image OCR, canvas processing, redaction, export, or provider handoff fails without blocking raw upload.
