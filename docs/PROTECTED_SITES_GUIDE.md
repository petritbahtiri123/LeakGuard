# Protected Sites Guide

LeakGuard runs on built-in AI/chat sites and on user-managed exact origins that you explicitly add. It does not inject into every website by default.

## Built-In Protected Sites

The current built-in list is:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://grok.com/*`
- `https://x.com/*`

Built-in sites are packaged in the extension manifest and are enabled by default.

## User-Managed Sites

You can add another site from the popup with `Protect This Site` or from `Manage Protected Sites`.

LeakGuard stores user-managed rules as exact origins, for example:

```text
https://app.example.com/*
```

Accepted input:

- `example.com`
- `https://example.com`
- `http://localhost`
- `https://app.example.com/path`, which is normalized to `https://app.example.com/*`

Rejected input:

- wildcard rules such as `https://*.example.com`
- URLs with spaces
- URLs with embedded credentials
- non-HTTP schemes such as `file:`, `chrome:`, or `moz-extension:`

Paths, query strings, and fragments are not used for matching. Add one exact origin at a time.

## Permission Behavior

LeakGuard declares optional host permission coverage for HTTP and HTTPS so it can support user-managed protected sites. The browser grants access only after you approve a specific origin request.

For a user-managed site, LeakGuard requests the normalized exact origin match pattern rather than broad access to every site.

## What Protection Means

On a protected site, LeakGuard can inspect supported composer text and supported local text-file ingress paths before submission. If likely sensitive values are found, it can show a decision flow, redact values with placeholders, or block unsafe sends when rewrite verification fails.

Protection is best-effort for supported editors and upload paths. Site DOM changes, hidden upload controls, unsupported file formats, browser limitations, or extension reloads can affect coverage.

## In-Page Status Menu

Protected pages show a compact top-center status menu. It is intentionally generic:

- confirms LeakGuard is active
- shows sensitive-item and placeholder counts
- links to extension controls
- does not render raw secret values into the host page

## Enterprise-Managed Sites

Enterprise builds can use `managedProtectedSites` to add protected origins by policy. Browser site access still has to be available for those origins, and browser-managed deployment is still required for force install or removal controls.

See [MANAGED_POLICY_SCHEMA.md](MANAGED_POLICY_SCHEMA.md) and [ENTERPRISE_DEPLOYMENT.md](ENTERPRISE_DEPLOYMENT.md).
