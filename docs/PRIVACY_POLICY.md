# LeakGuard Privacy Policy

Last updated: 2026-04-21

## Summary

LeakGuard processes protected prompt text locally in your browser to help reduce accidental leaks of secrets and public IPv4 network details.

LeakGuard does not operate a backend service and does not send your prompt text, raw secrets, or raw network values to our servers.

## What LeakGuard Accesses

LeakGuard may access text you type, paste, or submit in protected site composers so it can:

- detect likely secrets
- detect public IPv4 hosts and CIDR ranges
- show an allow-or-redact decision before send
- replace sensitive values with placeholders
- reveal placeholders later only inside extension-owned UI

## What LeakGuard Stores

LeakGuard stores only the following extension data:

- normalized user-managed protected-site rules in `chrome.storage.local`
- session-scoped placeholder mappings and reveal state in `chrome.storage.session`

LeakGuard does not intentionally persist raw prompts, raw secrets, or raw public IPv4 values in long-term extension storage.

## What LeakGuard Does Not Send

LeakGuard does not send the following to our servers because the extension does not use a backend service:

- prompt text
- raw secret values
- raw network values
- placeholder maps
- browsing telemetry

## Site Permissions

LeakGuard includes built-in protection for supported AI/chat sites and can request optional site access when you explicitly add another protected site.

LeakGuard does not request optional access for every site unless you choose to protect that site.

## Secure Reveal

When you reveal a placeholder, the raw value is shown only inside extension-owned UI. LeakGuard does not write the revealed raw value back into the website DOM for that reveal flow.

## Limitations

LeakGuard is a risk-reduction tool, not a guarantee of secrecy or privacy. It does not protect against:

- browser compromise or malware
- OS-level clipboard/history capture
- screenshots or shoulder surfing
- unsupported upload flows such as files, screenshots, or drag-and-drop payloads
- websites or editors whose DOM changes break interception logic
- raw values that you intentionally reveal or manually send

## Data Retention

Session-scoped placeholder mappings are kept in browser session storage and are cleared when the relevant session state is removed. User-managed protected-site rules remain until you remove or disable them.

## Contact

If you publish LeakGuard, replace this section with your actual support and privacy contact details before store submission.
