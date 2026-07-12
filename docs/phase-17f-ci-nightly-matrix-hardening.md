# Phase 17F CI Nightly Matrix Hardening

## Goal

Wire Phase 17B through Phase 17E validation into maintainable PR, release, and nightly tiers while keeping release blockers visible and separating browser environment failures from LeakGuard product failures.

## Tier A - fast PR checks

Tier A is the PR-safe default. It runs through `npm run test:ci`, which maps to `npm run test:fast`.

Commands:

```bash
npm run lint:unused
npm run deadcode
npm test
node tests/productization.test.js
node tests/security.test.js
node tests/build_targets.test.js
```

`npm test` already runs lint, deadcode, build preparation, and the repo test harness. The explicit productization, security, and build-target commands remain in `test:fast` so the Tier A contract is visible even if the test harness changes later.

## Tier B - release artifact checks

Tier B is for release branches, tags, manual release validation, and scheduled release artifact review. It runs through `npm run test:release-gates`.

Commands:

```bash
npm run build:all
npm run package:release
npm run test:release-artifacts
npm run bench:file-extraction
```

Tier B must run only after generated `dist/` targets and `artifacts/release/` packages exist. `npm run test:release-artifacts` reports package sizes, file counts, largest files, local OCR asset presence, manifest/security gates, raw marker sweeps, secret sweeps, and release blockers.

## Tier C - browser/nightly checks

Tier C is heavy, browser-dependent, and should start as nightly/manual rather than required on every PR. It runs through `npm run test:browser-gates`.

Commands:

```bash
npm run preflight:browser
npm run qa:browser:full
```

`test:browser-gates` owns both commands. `qa:browser:full` builds Chrome once, runs the full-matrix harness once, reuses that build for Chrome and Edge smoke, then builds Firefox once for Firefox smoke. Standalone smoke and focused E2E commands remain available for focused reruns but are not repeated inside this aggregate.

Required local/CI tools:

- Chrome executable, configured through `CHROME_BIN` or `GOOGLE_CHROME_BIN` when auto-discovery fails.
- Edge executable, configured through `EDGE_BIN` or `MSEDGE_BIN` when Edge smoke is enabled and auto-discovery fails.
- Firefox executable, configured through `FIREFOX_BIN` when auto-discovery fails.
- `geckodriver`, configured through `GECKODRIVER_BIN` when auto-discovery fails.
- A writable temp profile directory.
- A browser that can start headless.

`npm run test:browser-gates` runs `npm run preflight:browser` first to classify local setup problems before running the browser suite.

## Workflow Mapping

- PR and push to `main`: `.github/workflows/test.yml` runs Tier A through `npm run test:ci` plus a separate deterministic E2E job ordered as `npm ci`, Playwright Chromium install, Chrome build, then `npm run test:e2e`.
- Manual/tag/scheduled release artifact review: `.github/workflows/release-artifacts.yml` installs Playwright Chromium after `npm ci`, then runs Tier A, Tier B, deterministic E2E, and `npm run test:release-matrix` before checksums.
- Nightly/manual browser review: `.github/workflows/browser-nightly.yml` installs Playwright Chromium after `npm ci`, then runs `xvfb-run -a npm run test:nightly`, the named Tier A plus Tier B plus deterministic E2E plus Tier C aggregate.

Deterministic local-fixture E2E is PR-required. Tier C packaged browser jobs are not PR-required yet; they remain visible in nightly/manual runs until the CI browser environment is stable enough to promote.

## Script Map

- `test:fast`: Tier A fast PR checks.
- `test:ci`: PR-safe alias for Tier A.
- `test:release-gates`: Tier B release artifact checks.
- `test:browser-gates`: Tier C browser/nightly checks through preflight plus the single `qa:browser:full` owner.
- `test:nightly`: Tier A plus Tier B plus deterministic E2E plus Tier C, each invoked once.
- `test:release`: documentation links plus the complete nightly aggregate plus `test:release-matrix`.
- `test:release-matrix`: release completion gate; it intentionally fails while required evidence rows remain `PENDING` or `FAIL`.

## Privacy Contact Release Blocker

This is the privacy contact release blocker for Phase 17F.

Release blocker: publication contacts are not finalized. `docs/PRIVACY_POLICY.md` intentionally centralizes this instead of inventing a support, privacy, or private security reporting contact. A store release must not proceed until the project owner supplies real publication contacts and the privacy policy is updated.

The release artifact scanner reports this blocker deterministically. This is a release blocker, not a local setup issue.

## Browser Failure Classification

Environment failure:

- Chrome or Edge exits before the LeakGuard extension service worker appears.
- CDP disconnects before extension load.
- The browser crashes with GPU/CDP startup messages before extension load.
- Firefox or `geckodriver` does not expose the status endpoint.
- A browser executable or driver is missing.
- The temp profile directory is not writable.

Product failure:

- The extension loads and a LeakGuard behavior assertion fails.
- Popup controls are missing.
- A protected-site panel fails to appear after extension load.
- Raw synthetic markers leak into DOM, files, logs, reports, or exports.
- Redaction, secure reveal, scanner, OCR proof, or file handoff assertions fail.

Do not hide browser failures. Environment failures should fail Tier C with actionable diagnostics; product failures should remain hard failures.

## Chrome/Edge GPU/CDP Handling

Chromium smoke and QA use stable startup flags including:

- `--disable-gpu`
- `--disable-dev-shm-usage`
- `--headless=new` unless explicitly disabled with the relevant environment variable set to `0`
- `--no-sandbox` on Linux CI only
- port-based CDP for Chrome/Edge smoke paths

If CDP disconnects before extension load, the harness writes a stderr log and reports that the service worker never appeared because the browser crashed before extension load or CDP was unavailable.

Local remediation:

- Run `npm run preflight:browser`.
- Run `npm run smoke:chrome` or `npm run smoke:edge` alone.
- Close stale Chrome/Edge processes.
- Update Chrome or Edge.
- Keep headless enabled unless debugging interactively.

## Firefox/geckodriver Handling

Firefox smoke prints:

- Firefox version
- geckodriver version
- geckodriver command
- geckodriver status endpoint
- captured geckodriver output on startup failure

If the status endpoint times out, the failure remains red and is classified as an environment failure before extension load.

Local remediation:

- Update `geckodriver`.
- Ensure `FIREFOX_BIN` points to a current Firefox executable.
- Ensure `GECKODRIVER_BIN` points to a launchable geckodriver when auto-discovery fails.
- Free a blocked port if a stale process is stuck.
- Run `npm run smoke:firefox` alone.

## Publishing Gate

Before publishing Chrome or Firefox packages:

```bash
npm run test:release
git diff --check
```

`npm run test:release` intentionally remains red while the full-feature reliability matrix still has required `PENDING` or `FAIL` evidence. Tier C environment failures can also block final release confidence even when Tier A and Tier B pass. They should be resolved or explicitly documented with rerun evidence before final PR stabilization.
