# Enterprise Metadata Release-Candidate Evidence

Last local evidence refresh: June 16, 2026

## Scope

This release-candidate evidence covers the enterprise, cloud, and internal metadata detector work on the `codex/add-enterprise/cloud-identity-detectors` branch.

Covered areas:

- Enterprise, cloud, provider, and internal metadata detection.
- Typed placeholder families for enterprise/cloud/internal metadata findings.
- Provider coverage for Azure, AWS, GCP, OTC/OpenStack, and Kubernetes.
- Internal network, directory, file-share, host, identity, and email metadata.
- Pipeline coverage for typed text, pasted text, supported files, extracted document text, OCR text, streaming text, and placeholder re-run safety.
- Browser QA harness coverage for Chrome, Edge, Firefox, scanner runtime load order, dynamic content script injection order, and Firefox background manifest loading.

## Major Detector Families

Provider and cloud families covered by synthetic fixtures and contract tests:

- Azure resource groups, cloud resources, storage accounts, tenant IDs, and subscription IDs.
- AWS ARNs, account IDs, resources, and S3 identifiers.
- GCP project IDs, project numbers, service accounts, and GCS identifiers.
- OTC/OpenStack resources and IDs.
- Kubernetes namespaces, clusters, resources, kubeconfig metadata, and kubeconfig secrets.

Enterprise and internal metadata families covered by synthetic fixtures and contract tests:

- Private IP addresses and private CIDR ranges.
- UNC paths.
- SPNs.
- LDAP DNs.
- Contextual file shares.
- AD groups.
- Hostnames.
- Usernames.
- Emails.

## Safety Model

- Processing remains local-only inside the extension/runtime.
- Detection is deterministic and scored, with context checks for enterprise/cloud/internal metadata.
- The release-candidate evidence does not rely on external AI calls, external API calls, cloud verification, telemetry, or training.
- Tests and manual QA templates use synthetic fixtures only.
- Entropy thresholds were not globally lowered for this work.
- Raw synthetic values are expected to be absent from redacted previews, redacted downloads, JSON reports, browser composers, and sanitized handoff paths.
- Existing trusted placeholders remain pass-through safe and should not be re-redacted or corrupted on subsequent scans.

## False-Positive Controls

Negative and safety controls covered by tests or documented manual QA expectations:

- Documentation/example IP ranges remain visible.
- Existing public-network detection remains scoped to network placeholders such as `[PUB_HOST_N]` and `[NET_N]`; this enterprise metadata work did not broaden public IP detection.
- Random GUIDs remain visible without key or provider context.
- Random file-share-like IDs remain visible without surrounding file-share context.
- Ordinary slash paths remain visible.
- Normal comma prose remains visible.
- Filenames and package names remain visible.
- Safe scalar settings such as token limits remain visible.

## Pipeline Coverage

Automated pipeline contract coverage includes:

- Typed text.
- Paste.
- Drag/drop `.txt` flow.
- PDF extracted text.
- DOCX extracted text.
- XLSX extracted text.
- Image OCR extracted text.
- Large text streaming.
- Placeholder re-run safety for already-redacted output.

## Browser QA Harness Coverage

Local automated browser QA passed for:

- Chrome extension QA harness.
- Edge smoke coverage using the Chrome package.
- Firefox smoke coverage using the Firefox package.
- File Scanner supported text and document flows.
- Protected-site PDF, DOCX, XLSX, image OCR, and file drop handoff paths covered by the local harness.
- Scanner runtime load order for placeholder families and modular detector helpers.
- Dynamic content script injection order for placeholder families and modular detector helpers.
- Firefox background manifest loading aligned to the service worker runtime imports.

## Tests Passed

Latest local release-candidate evidence commands passed:

```powershell
npm run test:fast
npm run test:release-gates
npm run qa:browser
npm run test:browser-gates
node tests/browser/firefox_smoke.test.mjs
node tests/security.test.js
node tests/productization.test.js
node tests/build_targets.test.js
npm run docs:check-links
git diff --check
```

## Pending Manual QA

Live logged-in manual QA is still pending:

- Live logged-in ChatGPT manual QA pending.
- Live logged-in Gemini manual QA pending.
- Live Claude/Grok manual QA pending if accounts are available.

Automated local harnesses exercise protected-site behavior, scanner behavior, browser packages, and extension runtime loading, but they do not replace account-backed live provider QA.

## Manual QA Checklist Summary

Use synthetic data only. For detailed recording, use [Enterprise Metadata Live Manual QA Results](qa/ENTERPRISE_METADATA_LIVE_MANUAL_QA_RESULTS.md).

Use [Enterprise Metadata Live Site QA Runbook](qa/ENTERPRISE_METADATA_LIVE_SITE_QA_RUNBOOK.md) for the local build, browser loading, ChatGPT, Gemini, and failure-handling steps.

Manual QA should cover:

- Typed text.
- Paste.
- `.txt` upload/drop.
- PDF upload or handoff.
- DOCX upload or handoff.
- XLSX upload or handoff.
- Image OCR.
- Redacted image file-only handoff.
- Placeholder reveal.
- Re-running already-redacted output.
- No raw replay after sanitized handoff failure.

## Release Decision

Suggested release-candidate status:

Automated release-candidate checks are green locally. Release should wait for live logged-in manual QA on ChatGPT and Gemini at minimum.
