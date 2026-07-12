# Chrome Enterprise Managed-Schema Load Fix

## Status

Focused addendum for matrix row `PKG-CHROME-ENTERPRISE`, discovered while executing Task 5 of the LeakGuard 3.0 full-feature reliability plan.

## Observed failure

- Browser: Chrome `150.0.7871.101`.
- Build: `npm run build:chrome-enterprise` passed.
- Reproduction: `node tests/browser/chrome_smoke.test.mjs --extension-target=chrome-enterprise`.
- Failure boundary: `Extensions.loadUnpacked` rejected the package before any LeakGuard service worker target existed.
- Chrome diagnostic: `Only integers can have minimum and maximum: {}`.
- Raw-data result: no synthetic raw secret appeared in diagnostics and no protected action occurred.

## Root cause

`manifests/chrome-enterprise.json` correctly declares `config/managed_policy_schema.json`. Chrome strictly validates that file before loading the extension. The bounded count policies `protectionPauseMaxMinutes` and `auditRetentionDays` are declared as `number` while also declaring `minimum` and `maximum`; Chrome rejects those bounded definitions because its managed-schema validator requires integer range fields.

Both policies are semantically whole-unit counts, all packaged defaults and documented examples are integers, and their existing bounds remain authoritative. The safe correction is to declare these two fields as `integer`. Removing bounds, bypassing the managed schema, or weakening enterprise policy loading is out of scope.

## TDD implementation

1. In `tests/enterprise_policy.test.js`, require both named fields to be `integer` and add a regression that every managed-schema property with `minimum` or `maximum` has type `integer`.
2. Run `node tests/enterprise_policy.test.js` and capture RED against the current `number` definitions.
3. Change only the two types in `config/managed_policy_schema.json` from `number` to `integer`.
4. Update the two field types in `docs/MANAGED_POLICY_SCHEMA.md`.
5. Run GREEN and package validation:

```powershell
node tests/enterprise_policy.test.js
npm run build:chrome-enterprise
node tests/browser/chrome_smoke.test.mjs --extension-target=chrome-enterprise
node tests/build_targets.test.js
npm run docs:check-links
git diff --check
```

6. Stage only this addendum, the schema, its focused test, and its schema documentation. Commit separately as `fix: load chrome enterprise managed schema`.
7. Re-run the paused Task 5 Chrome and Firefox enterprise smokes before committing the smoke-target work.

## Security and compatibility constraints

- Preserve the `0..60` pause and `1..365` retention bounds.
- Do not change runtime policy normalization, policy defaults, strict-load behavior, managed-schema manifest wiring, permissions, CSP, telemetry, network behavior, audit contents, detector thresholds, OCR/model behavior, or public privacy behavior.
- Do not edit generated `dist` output or package-lock.
- Keep Chrome/Firefox MV3 compatibility; Firefox enterprise runtime behavior is unchanged because this correction only makes the packaged Chrome managed schema valid.

## Rollback

Revert the focused fix commit. Rollback restores the previous schema but also restores the proven Chrome enterprise package load failure; no raw-upload or fail-open fallback exists.
