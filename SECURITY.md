# Security Policy

LeakGuard is a local-only browser extension for reducing accidental prompt leaks. If you believe you have found a security issue, please report it privately.

## Supported Versions

| Version | Supported |
| --- | --- |
| `v1.x` | Yes |
| `< v1.0.0` | No |

## Reporting a Vulnerability

- Do not open public GitHub issues for security vulnerabilities.
- Prefer GitHub's private vulnerability reporting for this repository.
- If private reporting is unavailable, use the maintainer contact channel listed in the current project or store documentation and clearly mark the report as a security issue.
- Include the affected version, browser version, impact, reproduction steps, and whether raw content can leave the browser unexpectedly.

## What To Report

Please report issues such as:

- secrets or raw prompt content being exposed outside the intended local/session boundary
- raw values being written back into page DOM instead of extension-owned UI
- broken rewrite verification that allows raw content to be submitted unexpectedly
- cross-site or cross-tab leakage of placeholder mappings or reveal state
- permission, storage, or messaging flaws that weaken the local-only security model

## Response Expectations

- Initial acknowledgement target: within 5 business days
- Triage and severity assessment after reproduction is confirmed
- Coordination on disclosure timing for valid reports before public discussion

## Scope Notes

This policy covers the extension code in this repository. It does not cover third-party sites, browser vendor bugs, local malware, or unrelated account compromise.

For technical design and current hardening notes, see [SECURITY_REVIEW.md](SECURITY_REVIEW.md).
