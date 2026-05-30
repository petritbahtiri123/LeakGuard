# Release Provenance Checklist

Use this checklist for release candidates and tagged release builds. Do not commit generated reports or package archives to routine source diffs.

## Build Identity

- [ ] Source commit recorded with `git rev-parse HEAD`.
- [ ] Source branch or release tag recorded.
- [ ] Build command recorded, including target browser and mode.
- [ ] Node.js and npm versions recorded.

## Artifacts

- [ ] Generated package artifact names recorded.
- [ ] SHA-256 hash recorded for each generated package artifact.
- [ ] CycloneDX SBOM artifact attached from CI.
- [ ] npm license report artifact attached from CI.
- [ ] OSV dependency report artifact attached from CI.
- [ ] Repository secret scan report artifact attached from CI.

## Gates

- [ ] `npm audit --omit=dev --audit-level=high` result recorded.
- [ ] `npm run docs:check-links` result recorded.
- [ ] `npm test` result recorded.
- [ ] `npm run smoke:chrome` result recorded.
- [ ] Manual release QA checklist result recorded.

## Signoff

- [ ] QA signoff owner and date recorded.
- [ ] Residual risks recorded.
- [ ] Public wording reviewed for conservative claims.
- [ ] Generated reports and package archives confirmed absent from source diffs.
