# LeakGuard Non-Goals

LeakGuard is a local-first browser privacy guard that reduces accidental AI prompt leaks. It is not a complete data-loss-prevention platform, a secrets manager, or a remote scanning service.

## Not Full Enterprise DLP

LeakGuard does not claim full enterprise DLP coverage. It does not provide organization-wide discovery, endpoint control, SIEM integration, managed incident response, or guaranteed prevention of all sensitive-data leaks.

Enterprise-oriented policy hooks can help managed deployments, but browser-managed deployment is still required for force install, hard removal prevention, incognito or InPrivate handling, and developer-mode restrictions.

## No Remote Secret Processing

LeakGuard does not use:

- backend secret processing
- telemetry or analytics
- cloud scanning
- remote model calls
- remote secret verification
- provider liveness checks

Raw values are processed locally in the browser and kept only in session-scoped state where needed for secure reveal.

## No Credential Lifecycle Management

LeakGuard does not rotate, revoke, validate, or inventory credentials. It can redact likely secrets before prompt submission or from selected local text files, but leaked or suspected-live credentials still need normal incident response and rotation outside LeakGuard.

## No Repository-History Scanning

LeakGuard is not a replacement for source-control secret scanning tools. It does not scan git history, block pushes, maintain reviewed baselines, or verify committed credentials.

Use repo-focused tools such as GitHub Secret Scanning, Gitleaks, detect-secrets, or TruffleHog for repository and CI coverage.

## Limited Surface Coverage

LeakGuard currently focuses on supported browser composers and selected local text files. It does not cover every website, every editor implementation, file upload flow, drag-and-drop payload, screenshot, clipboard history, malware, hostile extension, compromised browser, or operating-system exposure path.

The File Scanner is text-only in the current release. PDF, DOCX, image OCR, and visual redaction are not enabled.

## AI Assist Boundaries

Deterministic detection remains authoritative. Optional AI assist runs locally over leftover suspicious candidate windows after deterministic detection. It does not receive the full prompt, does not use cloud AI, and cannot downgrade deterministic findings.
