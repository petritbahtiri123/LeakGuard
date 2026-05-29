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
- Known limitations or launch-scope notes where the store allows them

Chrome copy starts in [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md). Firefox-specific submission notes live in [FIREFOX_AMO_CHECKLIST.md](FIREFOX_AMO_CHECKLIST.md).

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

## Submission Blockers

Do not submit until:

- privacy/support contact placeholders are replaced
- final screenshots exist
- release QA is complete
- package version matches release notes
- local-only claims have been reviewed together across README, privacy policy, and store listings
- unsupported formats and known limitations are described honestly
- no generated package accidentally includes local secrets, debug captures, sourcemaps, or private transcripts
