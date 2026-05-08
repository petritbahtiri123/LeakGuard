# Playbook: Firefox Add-ons submission

## Problem fingerprint
Firefox Add-ons submission rejects the extension package or source zip, complains about manifest fields, `browser_specific_settings.gecko`, `data_collection_permissions`, missing source files, or unclear build steps.

## Expected behavior
The Firefox package and source zip satisfy Mozilla submission requirements while preserving LeakGuard runtime behavior and local-only privacy claims. Chrome and Firefox manifests stay aligned where shared, but differ where browser stores require different metadata.

## Likely root cause
Firefox-specific manifest metadata is missing or copied from Chrome without required differences. Source zip contents may not match review needs, may omit build scripts/source, or may include unnecessary generated/vendor duplication. Packaged extension zip and source zip may be confused.

## Safe implementation direction
Validate the Firefox manifest before packaging. Check whether `browser_specific_settings.gecko` and `data_collection_permissions` are required for the current submission path. Keep Chrome and Firefox manifests aligned for shared permissions, content scripts, CSP, and extension behavior, but allow Firefox-specific keys where required.

Keep source zip handling explicit:

- distinguish packaged extension zip from source zip
- include source files, manifests, scripts, package metadata, and docs needed to reproduce the build
- avoid unnecessary generated or vendor duplication if store requirements allow
- document exact build commands and expected outputs
- do not include secrets, local `.env` files, run captures, or private transcripts

Do not weaken CSP, add inline JavaScript, or change runtime permissions only to appease a package error without understanding the review requirement.

## Files likely involved
- `manifests/firefox*.json`
- `manifests/chrome*.json` for alignment checks
- `scripts/build-extension.mjs`
- `scripts/build-all.mjs`
- `package.json`
- submission or release docs if present
- build target and security tests

## Verification
- Firefox manifest validates with the repo's build/test path.
- Source zip contains the files needed to reproduce the submitted package.
- Packaged extension zip excludes source-only material not needed at runtime.
- Chrome build still uses Chrome-appropriate manifest fields.
- Firefox and Chrome builds both preserve local-only behavior and MV3 CSP.

## Regression tests
Run focused build-target or manifest tests first, such as `node tests/build_targets.test.js` if present. Run security/CSP tests if manifest or HTML behavior changes. Run `npm test` only after focused validation passes or when final release confidence is required.

## Rollback
Revert Firefox manifest/package script changes and rebuild. If only docs changed, revert the submission notes. Do not delete generated packages unless the task explicitly asks.

## Notes
Mozilla requirements can change. Verify against current submission evidence before making claims. Avoid enterprise-grade or store-compliance claims unless QA has approved the exact wording.
