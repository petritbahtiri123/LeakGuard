# LeakGuard Release QA Checklist

## Before Packaging

- Reload the unpacked extension after the latest branch changes.
- Confirm the popup opens and renders correctly on desktop width.
- Confirm the popup still renders correctly on a smaller laptop display.
- Confirm `npm test` passes locally.
- Confirm the built manifest includes `content_security_policy.extension_pages` with LeakGuard's restrictive extension-page CSP.

## Built-in Site Coverage

- Open ChatGPT and confirm LeakGuard shows the current site as protected.
- Open at least one additional built-in site such as Claude, Gemini, Grok, OpenAI Chat, or X and confirm the same.
- Confirm the in-page right-side status panel appears on protected sites.

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
- Confirm obvious docs placeholders such as `replace_me` stay visible.
- Confirm `databaseUrl` and `MYSQL_URL` keep their URI shape while only the password segment is masked.
- Confirm JSON fields like `accessToken`, `dbPassword`, `clientSecret`, and `apiKey` are redacted.
- Confirm webhook URLs, bearer tokens, cookie/session values, Docker auth blobs, and connection strings are redacted.

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

## Regression Checks

- Confirm there is no duplicate dynamic script ID error when adding or removing protected sites.
- Confirm there is no `removeContentScripts is not a function` error.
- Confirm placeholder clicks do not open the retired separate reveal window flow.
- Confirm the popup management and reveal views still work after browser reload.

## Store Submission Assets

- Capture final screenshots for popup home, popup management, in-page panel, decision modal, and popup reveal.
- Replace any temporary support or privacy contact placeholders in the privacy policy.
- Review the Chrome Web Store copy in `docs/CHROME_WEB_STORE_LISTING.md`.
