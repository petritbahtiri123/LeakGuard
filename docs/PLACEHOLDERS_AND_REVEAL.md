# Placeholders And Secure Reveal

LeakGuard replaces detected values with neutral placeholders so prompts and supported text-file content can keep useful structure without exposing raw sensitive text.

Common placeholder shapes:

- `[PWM_N]` for likely secrets, credentials, emails, headers, cookies, and similar sensitive values
- `[PUB_HOST_N]` for sensitive public IPv4 hosts
- `[NET_N]` for sensitive public IPv4 network ranges

`N` is a session-local counter. Exact numbers can vary by session and by detection order.

## Placeholder Stability

Within an active session, LeakGuard tries to reuse placeholders for the same known raw value. Reuse matters because repeated secrets should not produce confusing output or leave raw prefixes and suffixes behind.

Examples:

```text
Authorization: Bearer [PWM_1]
X-API-Key: [PWM_1]
```

For URL credentials, LeakGuard preserves useful URI shape and redacts credential segments separately where possible:

```text
postgres://app:[PWM_1]@db.internal:5432/app
```

For sensitive HTTP headers, header names, separators, auth schemes, and cookie names remain visible when possible while values are redacted:

```text
Authorization: Bearer [PWM_1]
Cookie: sessionid=[PWM_2]
```

## Trusted Placeholder Pass-Through

Already-redacted placeholders that match LeakGuard's trusted placeholder shapes can pass through without being redacted again. Unknown placeholders in sensitive contexts may still be treated as candidates.

This protects normal workflows where a user edits or resubmits already-sanitized text.

## Session Scope

Prompt placeholder mappings are session-scoped. Private raw-to-placeholder mappings live in `chrome.storage.session` when available. If session storage is unavailable, LeakGuard uses ephemeral extension memory rather than persistent local storage for private placeholder and reveal state.

User-managed protected-site rules can persist in extension `storage.local`, but raw prompt text, selected file contents, raw secrets, and raw public IPv4 values are not intentionally persisted there.

## Secure Reveal

Secure reveal is popup-only.

1. The page sees an inert placeholder such as `[PWM_1]`.
2. Clicking a placeholder asks the background script to create an opaque reveal request.
3. The LeakGuard popup opens its secure reveal view.
4. Raw text is shown only inside extension-owned UI after user action.
5. Raw text is not written back into the website DOM.

Unknown placeholders report unavailable instead of causing raw text to be injected into the page.

## File Scanner Placeholders

The File Scanner uses a fresh in-memory placeholder manager for each scan. File scans do not populate the prompt-session reveal map and do not make file contents revealable through the popup.

Redacted text exports and sanitized JSON reports omit detected raw secret values by default.

## Enterprise Controls

Enterprise policy can disable reveal with `allowReveal: false` and can disable `Allow once` with `allowUserOverride: false`.

See [MANAGED_POLICY_SCHEMA.md](MANAGED_POLICY_SCHEMA.md) for policy fields.
