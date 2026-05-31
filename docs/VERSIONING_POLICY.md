# Versioning Policy

LeakGuard uses the version in `package.json` and `manifests/base.json` as the release version for browser builds.

This document defines the expected versioning discipline. It is a project policy, not a guarantee that every historical release followed it perfectly.

## Version Format

Use semantic versioning:

```text
MAJOR.MINOR.PATCH
```

Examples:

- `1.7.1` for a narrow bug fix
- `1.8.0` for a compatible feature release
- `2.0.0` for a breaking behavior or policy change

## Patch Releases

Use a patch release for:

- detector false-positive fixes
- detector false-negative fixes that do not broaden claims
- site-specific composer fixes
- browser compatibility fixes
- documentation corrections
- packaging fixes that do not change permissions or public behavior

## Minor Releases

Use a minor release for:

- new supported text-file path behavior
- new user-visible controls
- new supported protected-site behavior
- new enterprise policy fields
- material detection coverage additions
- new release/store documentation that changes user-facing scope

## Major Releases

Use a major release for:

- changed placeholder semantics that can affect user workflows
- changed storage model for private placeholder or reveal state
- removed supported browser target
- removed supported protected-site behavior
- permission model expansion that users or store reviewers must re-evaluate
- public API or policy changes that are not backward compatible

## Pre-Release Checklist

Before cutting a release:

- update `package.json`
- update `manifests/base.json`
- update README release snapshot if user-facing scope changed
- update [BROWSER_COMPATIBILITY_MATRIX.md](BROWSER_COMPATIBILITY_MATRIX.md) if browser support changed
- update [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md) and Firefox notes when store-facing scope changed
- run focused tests for changed areas
- run `npm test` for final validation
- run `npm run build`
- complete [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md)

Documentation-only changes do not need a version bump unless they are part of a release package or store submission.

## Release Notes

Release notes should separate:

- user-visible changes
- security/privacy notes
- browser compatibility notes
- enterprise/admin notes
- known limitations
- test and QA summary
- release provenance and residual risks

Keep claims conservative. Say LeakGuard reduces accidental leak risk; do not claim perfect protection, guaranteed detection, or compliance certification.

## Artifacts

Release artifacts should be tied back to:

- source commit
- version number
- build command
- browser target
- package or artifact hash
- SBOM artifact
- dependency scan result, including `npm audit --omit=dev --audit-level=high` and OSV status
- manual QA signoff
- residual risks

Avoid committing generated `dist/` output or new package archives unless the release process explicitly requires it.
