# Codex Cloud Release Validation Environment

## Purpose

LeakGuard release validation needs more than the default Node test environment. The release gates build local AI assets, package Chrome/Firefox extension targets, inspect release zips, and launch browser extension QA harnesses. This guide and the companion scripts make Codex Cloud environment setup explicit so image redaction hotfix validation can run without silently skipping failed prerequisites.

Use this environment flow before validating the 2.0.x protected-site image redaction hotfix.

## Prerequisites

- Node.js and npm compatible with this repository.
- Python 3 with pip.
- Network/proxy access that allows pip to install `ai/requirements.txt`.
- npm registry access for existing repo dependencies and optional Playwright browser installation.
- Google Chrome or a compatible Chrome/Chromium executable for extension runtime basics.
- Microsoft Edge only when Edge gates or Edge release claims are being validated.
- Firefox plus geckodriver or npm's geckodriver fallback when running the current `test:browser-gates` script.
- Writable temporary profile directories.

## Proxy notes

Codex Cloud often sets proxy variables. The setup and validation scripts print:

- `HTTP_PROXY`
- `HTTPS_PROXY`
- `NO_PROXY`
- lowercase proxy variants

If pip fails with `Tunnel connection failed: 403 Forbidden`, fix proxy routing before running release gates. Do not bypass `prepare:build`; it is part of the release validation path. Typical remediation is to set working `HTTP_PROXY`/`HTTPS_PROXY`, include local hosts in `NO_PROXY`, configure `PIP_CERT`/`REQUESTS_CA_BUNDLE` when a proxy CA is required, or preinstall `ai/requirements.txt` into the Python environment used by `prepare:build`.

## Python/pip dependency setup

`npm run prepare:build` uses `scripts/prepare-build.mjs`, which creates `ai/.venv` when needed and installs `ai/requirements.txt`. The dependency that triggered the observed failure is `joblib>=1.3`, from `ai/requirements.txt`; the full current set is:

- `joblib>=1.3`
- `numpy>=1.24`
- `scipy>=1.10`
- `scikit-learn>=1.3`
- `skl2onnx>=1.16`

The setup script performs a probe install into `.cache/codex-release-env/pip-probe-target` using a project-local pip cache. It does not vendor dependencies and it does not hide pip failures. If this probe fails, release validation cannot run until pip/proxy access is fixed or the required dependencies are preinstalled in the environment used by `prepare:build`.

## Browser binaries setup

The existing browser gates require browser binaries and run `scripts/check-browser-environment.mjs` and expect browser executables. It detects:

- Chrome via `CHROME_BIN`, `GOOGLE_CHROME_BIN`, `google-chrome`, `google-chrome-stable`, `chromium-browser`, `chromium`, or `chrome`.
- Edge via `EDGE_BIN`, `MSEDGE_BIN`, `microsoft-edge`, or Edge channel binaries.
- Firefox via `FIREFOX_BIN`, `firefox`, or `firefox-esr`.
- geckodriver via `GECKODRIVER_BIN`, `geckodriver`, or npm fallback.

If system package installation is unavailable, install browsers outside Codex Cloud and point the environment variables at the executables. The scripts fail non-zero with the missing executable and remediation text instead of pretending the environment is ready.

## Playwright/Chromium fallback

`npm run setup:codex-release-env` attempts:

1. `npx playwright install --with-deps chromium`
2. if system dependencies cannot be installed, `npx playwright install chromium`

This fallback can help validate extension runtime basics when a Chromium binary is available. It is not a substitute for Chrome Web Store release validation. Do not claim full Chrome or Edge release GO from Chromium-only validation.

## Chrome and Edge expectations

Use branded Google Chrome for Chrome Web Store release confidence. Chromium can be useful for smoke coverage, but the final Chrome hotfix decision still requires real Chrome headed/unpacked or packaged validation. Edge claims stay limited unless Edge itself is installed and manually retested.

## Exact commands

Environment setup and readiness:

```sh
npm run setup:codex-release-env
npm run validate:codex-release-env
```

Build and package:

```sh
npm run build:all
npm run package:release
npm run release:checksums
```

Release/browser gates:

```sh
npm run test:ci
npm run test:release-gates
npm run test:browser-gates
npm run test:release-artifacts
git diff --check
```

## Image hotfix validation command bundle

Run this sequence for the 2.0.x image redaction hotfix after environment validation passes:

```sh
npm run validate:codex-release-env
npm run build:all
npm run package:release
npm run test:release-artifacts
node tests/scanner_ocr.test.js
node tests/content_file_extraction_pipeline.test.js
node tests/release_artifacts.test.js
node tests/browser/extension_qa_harness.test.mjs
npm run test:release-gates
npm run test:browser-gates
git diff --check
```

## How to verify environment readiness

`npm run validate:codex-release-env` prints PASS/FAIL per requirement, the exact command it ran, and remediation text for each failed requirement. It checks Node/npm, npm dependency resolution, Python/pip, Python build imports, browser executable discovery, browser launch sanity where possible, temp profile writability, the existing browser preflight script, and build prerequisites before `prepare:build`.

The environment is ready only when this command exits zero. If it fails, fix the listed prerequisites before running release gates.

## Troubleshooting

| Symptom | Likely cause | Remediation |
| --- | --- | --- |
| `Tunnel connection failed: 403 Forbidden` during pip install | Proxy blocks PyPI access or proxy CA is not configured | Set working `HTTP_PROXY`/`HTTPS_PROXY`, update `NO_PROXY`, configure `PIP_CERT`/`REQUESTS_CA_BUNDLE`, or preinstall `ai/requirements.txt` dependencies in `ai/.venv`. |
| `joblib>=1.3` cannot be installed | First dependency in `ai/requirements.txt` cannot be fetched through pip | Fix pip/proxy access; do not skip `prepare:build`. |
| `Chrome executable` failure | Chrome/Chromium is not installed or not on PATH | Install Google Chrome for release validation or set `CHROME_BIN`/`GOOGLE_CHROME_BIN`. |
| `Edge executable` failure | Edge is not installed | Install Edge or set `EDGE_BIN`/`MSEDGE_BIN`; keep Edge claims limited until retested. |
| `Firefox executable` failure | Firefox is not installed but current browser gates include Firefox smoke tests | Install Firefox or set `FIREFOX_BIN`. |
| Playwright `--with-deps` fails | No sudo/root/system package install available | Retry browser-only install or install OS dependencies manually. |
| `dist/chrome` missing | `build:all` or `prepare:build` failed | Fix the earlier build prerequisite failure, then rerun `npm run build:all`. |
| Chromium-only validation passes | Useful runtime smoke coverage, but not branded Chrome validation | Do not mark Chrome Web Store release GO until real Chrome validation passes. |

## Safety policy

These scripts and docs are environment-only. They do not change product runtime behavior, detector rules, adapters, permissions, CSP, telemetry, or remote processing. They must not be used to bypass failed tests or weaken fail-closed image handling.
