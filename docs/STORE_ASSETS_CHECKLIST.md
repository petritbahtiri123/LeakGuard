# Store Assets Checklist

Use this checklist before Chrome Web Store or Firefox AMO submission.

Do not use real credentials, private prompts, private customer data, or private infrastructure details in screenshots or videos.

## Required Copy

- Product name: `LeakGuard`
- One-line summary
- Short description
- Detailed description
- Permission justifications
- Privacy policy URL or submitted policy text
- Support contact
- Privacy contact
- Known limitations or launch-scope notes where the store allows them

Chrome copy starts in [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md). Firefox-specific submission notes live in [FIREFOX_AMO_CHECKLIST.md](FIREFOX_AMO_CHECKLIST.md).

Current contact status:

- [ ] TODO before submission: fill in the project support contact.
- [ ] TODO before submission: fill in the project privacy contact.
- [ ] TODO before submission: confirm the private security reporting path.

No correct support or privacy contact was locally discoverable in the repository. Do not invent one in store copy.

## Screenshots

Capture fresh screenshots for the exact release build.

Recommended set:

- popup home view on a protected site
- protected-sites management view
- in-page status menu
- allow/redact decision flow using synthetic secrets
- popup secure reveal view using synthetic placeholder data
- File Scanner page with a supported synthetic text file

Optional:

- unsupported-file warning
- enterprise policy-restricted popup state
- browser-specific install/load screen if needed for review

## Screenshot Rules

- Use synthetic data only.
- Avoid showing real domains, emails, tokens, customer names, or internal paths.
- Do not show unsupported file formats as if they were scanned or protected.
- Do not show raw secrets in a website DOM.
- If reveal is shown, keep it inside extension-owned UI and use clearly synthetic values.
- Match current production copy and visual state.

## Image Handling

Before submission:

- crop only to remove irrelevant browser chrome where allowed
- keep text readable
- confirm no hidden tabs, bookmarks, notifications, account avatars, or profile names leak private data
- store source screenshots outside generated `dist/` output
- record which build/version the screenshots came from

## Review Alignment

Check store-facing copy and screenshots against:

- [README.md](../README.md)
- [PRIVACY_POLICY.md](PRIVACY_POLICY.md)
- [NON_GOALS.md](NON_GOALS.md)
- [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md)
- [FIREFOX_AMO_CHECKLIST.md](FIREFOX_AMO_CHECKLIST.md)
- [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md)

Current behavior boundaries that store assets must preserve:

- LeakGuard is local-only and uses no backend secret processing, telemetry, cloud scanning, remote model calls, or remote verification.
- LeakGuard is risk reduction, not full DLP, perfect protection, guaranteed detection, compliance certification, credential lifecycle management, or repository-history scanning.
- File support is scoped: supported UTF-8 text files, text PDFs, DOCX/XLSX text extraction, and PNG/JPG/JPEG/WEBP image metadata/OCR paths run locally. Archives, executables, legacy/macro Office files, screenshots outside selected files, unsupported images, and arbitrary binary files are not scanned or redacted in this release.
- Supported text-file upload paths must be described as browser/site dependent. Do not claim support for every editor, upload flow, browser, or synthetic file handoff path.
- Edge should be described as Chromium-compatible using the Chrome target unless a release-specific Edge QA record supports stronger wording.
- Enterprise policy should be described as in-extension policy support, not browser-level force install, removal prevention, SIEM integration, or compliance certification.

## Submission Blockers

Do not submit until:

- privacy/support contact TODOs are replaced with real project contacts
- privacy policy contact TODOs are completed
- final screenshots exist
- release QA is complete
- package version matches release notes
- local-only claims have been reviewed together across README, privacy policy, and store listings
- unsupported formats and known limitations are described honestly
- no generated package accidentally includes local secrets, debug captures, sourcemaps, or private transcripts
