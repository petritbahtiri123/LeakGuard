# Troubleshooting

Use synthetic data when debugging. Do not paste real live credentials into test prompts.

## Popup Does Not Open

Try:

- reload the extension from the browser extensions page
- refresh the protected site
- rebuild the target folder
- confirm you loaded the correct target under `dist/`

If the browser says the extension context was invalidated after a rebuild, reload the page. Content scripts from the old build cannot always keep talking to the new extension runtime.

## Site Is Not Protected

Check:

- the site is one of the built-in protected sites, or you added it as a user-managed protected site
- the popup requested and received exact-origin access
- the URL uses `http://` or `https://`
- the rule is enabled in `Manage Protected Sites`
- enterprise policy is not disabling user-added sites

User-managed rules are exact origins. Wildcards, paths, query strings, fragments, and credential-bearing URLs are not supported.

See [PROTECTED_SITES_GUIDE.md](PROTECTED_SITES_GUIDE.md).

## Redaction Popup Reopens After Allow Once

This usually means the same finding was not suppressed for the current send attempt or the page rewrote the composer after the decision.

For code fixes, route through [BUG_PLAYBOOK.md](BUG_PLAYBOOK.md). For the known allow-once loop pattern, use [codex-playbooks/allow-once-popup-loop.md](codex-playbooks/allow-once-popup-loop.md).

## Rewrite Verification Failed

LeakGuard blocks submission when it cannot verify that raw high-confidence secrets were removed and expected placeholders remain.

Try:

- refresh the site and retry with synthetic data
- use a simpler paste path instead of complex rich-text content
- check whether the site recently changed its composer DOM
- test a textarea and a contenteditable path if both exist

Do not work around rewrite verification by sending raw content.

## Placeholder Does Not Reveal

Check:

- the placeholder came from the current LeakGuard session
- secure reveal is allowed by policy
- the popup was opened by clicking a known placeholder
- the extension was not reloaded between redaction and reveal

Unknown placeholders report unavailable instead of injecting raw text into the page.

See [PLACEHOLDERS_AND_REVEAL.md](PLACEHOLDERS_AND_REVEAL.md).

## File Scanner Rejects A File

Common causes:

- unsupported extension or basename
- invalid UTF-8 text
- binary-looking content
- file above 50 MB
- selecting multiple files when the scanner expects one

The scanner supports text-like files only. It does not scan PDFs, DOCX files, images, archives, executables, OCR, or binary files in this release.

See [FILE_UPLOAD_SCANNING_GUIDE.md](FILE_UPLOAD_SCANNING_GUIDE.md).

## File Upload Was Not Sanitized

Supported text-file uploads depend on browser and site handoff behavior.

LeakGuard should either:

- hand off a sanitized in-memory file
- insert sanitized text
- offer a sanitized download
- block raw upload after sanitization was attempted and safe handoff failed
- warn honestly for unsupported files

If a supported text file appears to upload raw after LeakGuard attempted sanitization, treat it as a high-priority bug. Route through [BUG_PLAYBOOK.md](BUG_PLAYBOOK.md) and test the narrow file-flow cases first.

## Firefox Behaves Differently From Chrome

Firefox has different extension background behavior and can differ around hidden upload controls, temporary add-ons, and trusted user activation.

Check:

- you loaded `dist/firefox/manifest.json`
- temporary add-on was reloaded after rebuild
- the site was refreshed after reload
- the flow is covered in [BROWSER_COMPATIBILITY_MATRIX.md](BROWSER_COMPATIBILITY_MATRIX.md)

## Enterprise Policy Seems Ignored

Check:

- you loaded an enterprise build
- managed storage is available in the browser
- policy values match [MANAGED_POLICY_SCHEMA.md](MANAGED_POLICY_SCHEMA.md)
- destination patterns are valid match patterns
- `strictPolicyLoad` is behaving as expected

Run:

```bash
node tests/enterprise_policy.test.js
```

## Before Filing A Bug

Collect:

- browser and version
- LeakGuard version
- target build folder
- protected site URL origin
- whether the site is built-in, user-managed, or enterprise-managed
- synthetic reproduction text or file type
- expected behavior
- actual behavior
- focused test command if a local test fails

Do not include raw real secrets or private file contents in bug reports.
