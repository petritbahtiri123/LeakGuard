# Release Provenance Checklist

Use this checklist for release candidates and tagged release builds. Do not commit generated reports or package archives to routine source diffs.

## Build Identity

- [ ] Source commit recorded with `git rev-parse HEAD`.
- [ ] Source branch or release tag recorded.
- [ ] Build command recorded, including target browser and mode.
- [ ] Node.js and npm versions recorded.
- [ ] Release notes identify the exact source commit and build command used for each package.

## Artifacts

- [ ] Generated package artifact names recorded.
- [ ] SHA-256 package/artifact hash recorded for each generated package artifact.
- [ ] CycloneDX SBOM artifact attached from CI.
- [ ] npm license report artifact attached from CI.
- [ ] OSV dependency report artifact attached from CI.
- [ ] Repository secret scan report artifact attached from CI.
- [ ] Release notes identify the SBOM artifact and dependency scan result used for release review.

## Gates

- [ ] `npm audit --omit=dev --audit-level=high` result recorded.
- [ ] OSV dependency scan result recorded.
- [ ] `npm run docs:check-links` result recorded.
- [ ] `npm test` result recorded.
- [ ] `npm run test:e2e` result recorded after `npm run build:chrome`.
- [ ] `npm run smoke:chrome` result recorded.
- [ ] Manual release QA checklist result recorded.

## Signoff

- [ ] QA signoff owner and date recorded.
- [ ] Residual risks recorded.
- [ ] Release notes include QA signoff and residual risks for the actual release.
- [ ] Public wording reviewed for conservative claims.
- [ ] Generated reports and package archives confirmed absent from source diffs.
