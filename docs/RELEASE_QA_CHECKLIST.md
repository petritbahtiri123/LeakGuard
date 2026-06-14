# LeakGuard Release QA Checklist

## Before Packaging

- Reload the unpacked extension after the latest branch changes.
- Confirm the popup opens and renders correctly on desktop width.
- Confirm the popup still renders correctly on a smaller laptop display.
- Confirm Tier A fast validation passes: `npm run test:fast`.
- Confirm Tier B release validation passes before publishing packages: `npm run test:release-gates`.
- Confirm the built manifest includes `content_security_policy.extension_pages` with LeakGuard's restrictive extension-page CSP.
- Confirm the built manifest does not add new host permissions for File Scanner.
- Confirm protected-site image OCR is settings-controlled, enabled by default for supported image uploads, and can be turned off.
- Confirm image redaction support is documented for PNG, JPG, JPEG, and WEBP inputs, with fail-closed behavior if OCR, canvas decode/draw, redaction, sanitized export, or provider handoff fails.

## CI And Nightly Validation

- PR-required validation is Tier A: `npm run test:ci`, which maps to `npm run test:fast`.
- Release/manual validation is Tier A plus Tier B: `npm run test:fast` and `npm run test:release-gates`.
- Nightly/browser validation is Tier A plus Tier B plus Tier C: `npm run test:nightly`.
- Tier C browser validation is heavy and environment-sensitive: `npm run preflight:browser` followed by `npm run test:browser-gates`.
- A browser startup failure before extension load, such as Chrome/Edge GPU/CDP startup failure or Firefox geckodriver status timeout, is a local or CI environment failure until rerun evidence shows the extension loaded and failed product assertions.
- Product failures are failures after the extension loads and a LeakGuard behavior assertion fails, such as missing popup controls, missing protected-site panel, raw marker leakage, failed redaction, or missing scanner export behavior.

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
- Confirm private IPs, private CIDRs, loopback, link-local, default route, wildcard mask, and invalid IP-like text stay visible.

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
- Select unsupported files such as `.zip`, `.exe`, legacy `.doc`, legacy `.xls`, `.xlsm`, `.gif`, `.svg`, and arbitrary binary files and confirm the text-only release message appears.

## Local Text-File Paste/Drop Composer Flow

- Build and load the Chrome extension, then open ChatGPT and confirm LeakGuard shows the site as protected.
- Create a supported `.env` UTF-8 text file with synthetic values such as `API_KEY=LeakGuardFileApiKey1234567890`, `DB_PASSWORD=LeakGuardDbPassword123!`, `token_limit=4096`, `PUBLIC_IP=8.8.8.8`, and `PRIVATE_IP=10.0.0.5`.
- Paste the supported `.env` text file into the ChatGPT composer and confirm the site receives a sanitized file attachment/upload where that handoff path is supported.
- Drop the supported `.env` text file into the ChatGPT composer and confirm the site receives a sanitized file attachment/upload where that handoff path is supported.
- Select the supported `.env` text file through a site file picker, when available, and confirm the selected file is replaced with a sanitized in-memory file where browser/site handoff works.
- Confirm the sanitized attached/uploaded file redacts `API_KEY` and `DB_PASSWORD` with `[PWM_N]` placeholders.
- Confirm the sanitized attached/uploaded file keeps `token_limit=4096` visible.
- Confirm the sanitized attached/uploaded file pseudonymizes the public IP with a `[PUB_HOST_N]` placeholder.
- Confirm the sanitized attached/uploaded file keeps the private IP visible.
- Confirm PDF, DOCX, XLSX, and image metadata uploads on protected sites produce sanitized outputs where supported: complete text PDFs may hand off regenerated `.redacted.pdf`, complete DOCX files may hand off regenerated `.redacted.docx`, complete XLSX files may hand off regenerated `.redacted.xlsx`, and unsafe/truncated cases fall back to `.redacted.txt` or block raw upload.
- Confirm protected-site OCR is off by default and image uploads use metadata-only `.redacted.txt` unless OCR has been explicitly enabled.
- Enable protected-site OCR, upload an eligible PNG/JPG/JPEG/WEBP image with a synthetic secret, and confirm the site receives `.redacted.png` only when OCR boxes are eligible.
- Gemini image upload check: with protected-site OCR enabled, upload or drag/drop a PNG/JPG/JPEG/WEBP image with a visible synthetic secret and confirm Gemini receives only the sanitized image file or a safe fallback/download path.
- Enable protected-site OCR, upload an image with fallback/ineligible boxes or forced OCR failure, and confirm LeakGuard blocks raw upload.
- Confirm unsupported/binary/invalid UTF-8 files show clear warning or blocking behavior without claiming they were scanned, sanitized, or protected.
- Confirm unsupported files are not falsely marked as protected or sanitized.
- Confirm supported text files above 50 MB are blocked from local redaction with a clear too-large warning.
- Confirm supported text files are never uploaded raw if LeakGuard attempted sanitization and handoff failed.
- Confirm small supported text files fall back to sanitized composer text when the browser or site does not accept synthetic `DataTransfer`/file handoff, and confirm raw upload is blocked if that safe fallback cannot complete.
- Confirm the composer remains usable after unsupported-file or sanitized-handoff failure handling.
- Confirm no raw synthetic secret appears in the DOM or browser console.

## Firefox Protected-Site File/Drop Checks

- Automated local Firefox smoke now covers popup loading, user-managed protected-site add/disable/re-enable/remove, secure reveal, refresh safety, File Scanner supported/unsupported files, and scanner exports. Keep live AI-site Firefox checks manual.
- In Firefox on ChatGPT, upload supported PDF/DOCX/XLSX/image metadata files and confirm text PDFs hand off `.redacted.pdf` only when complete, DOCX files hand off `.redacted.docx` only when complete, XLSX files hand off `.redacted.xlsx` only when complete, and sanitized `.redacted.txt` fallback remains available where required; image metadata remains `.redacted.txt`.
- In Firefox on ChatGPT, upload unsupported files such as archive, executable, legacy/macro Office, binary, and invalid UTF-8 text files; confirm LeakGuard does not claim they were scanned/redacted and normal site upload continues only where safe.
- In Firefox on ChatGPT, confirm unsupported and invalid UTF-8 uploads do not show `Local file not attached`, do not claim sanitization, and do not block native upload by default.
- If Firefox ChatGPT login is blocked by account Advanced Security, mark Firefox ChatGPT as limited manual coverage and rely on Chrome live QA plus automated ChatGPT DOM/state tests for release gating.
- In Firefox on Gemini, drag and drop a supported UTF-8 text file and confirm LeakGuard scans/redacts locally, then hands off a sanitized file or inserts sanitized text without leaking raw content.
- In Firefox on Gemini, paste a multiline supported `.env` block with synthetic secrets and confirm sanitized placeholders preserve line breaks instead of collapsing into one long line.
- In Firefox on ChatGPT, Grok, Gemini, Perplexity, and one user-managed protected site, drag and drop a supported UTF-8 text file and confirm either sanitized file handoff or sanitized text insertion succeeds without raw secrets.
- In Chrome on Gemini, drag and drop supported UTF-8 text/config/code files at small size, 5 MB, 25 MB, and exactly 50 MiB; confirm LeakGuard redacts locally and Gemini receives only sanitized content.
- In Firefox and Chrome on Gemini, confirm dropping a file does not unexpectedly open the operating system file picker or duplicate upload dialogs.
- In Firefox on Gemini, drag and drop unsupported or invalid UTF-8 files and confirm LeakGuard warns once, allows native upload where possible, and does not open duplicate picker/modal loops.
- In Firefox on Perplexity or another user-managed protected site, type a synthetic password and confirm redaction succeeds without `Rewrite verification failed` when the raw secret is removed and placeholders remain visible.
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
- Review the Firefox AMO submission notes in `docs/FIREFOX_AMO_CHECKLIST.md` if publishing a Firefox package.
- Review release-facing wording for Firefox Add-ons suitability: local-only processing, no telemetry, no cloud processing, no remote model calls, and no perfect-protection claims.
- Review [FILE_CAPABILITY_MATRIX.md](FILE_CAPABILITY_MATRIX.md) against release copy: scanner and protected-site text PDFs, DOCX, and XLSX can export regenerated files from sanitized text only, protected-site regenerated outputs fall back to `.redacted.txt` when regeneration would truncate, scanner visual image redaction exports PNG, protected-site OCR is settings-controlled/default-on for supported image uploads with opt-out, no scanned-PDF OCR, no non-English OCR, no remote OCR/backend, and no image format preservation.
- GO/NO-GO for image redaction: GO only after supported image fixtures produce sanitized outputs with no visible/searchable raw fake secret; NO-GO if image OCR, canvas processing, redaction, export, or provider handoff fails without blocking raw upload.
