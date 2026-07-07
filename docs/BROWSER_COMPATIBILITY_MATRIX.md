# Browser Compatibility Matrix

LeakGuard currently has first-class build targets for Chrome and Firefox. Edge can load the Chrome target because it is Chromium-based, and this repository has a basic Edge smoke gate that runs the Chrome build in Edge. It still does not maintain a separate Edge build or store target.

## Build Targets

| Browser family | Consumer target | Enterprise target | Notes |
| --- | --- | --- | --- |
| Chrome / Chromium | `dist/chrome` | `dist/chrome-enterprise` | Chrome manifest overlay requires Chrome 120 or later. |
| Firefox | `dist/firefox` | `dist/firefox-enterprise` | Firefox overlay uses a background script shape and Gecko metadata. |
| Edge | use `dist/chrome` | use `dist/chrome-enterprise` | Basic smoke coverage uses the Chrome target. Treat release claims as version-specific until release QA proves the exact Edge version. |
| Safari | none | none | Not supported by this repository today. |

## Shared Behavior

Chrome and Firefox share:

- deterministic detection, redaction, placeholder, and network classification logic
- popup, options, scanner, and content-script source
- restrictive extension-page CSP
- built-in protected-site list
- local-only processing claims
- no telemetry, backend secret processing, or remote model calls

## Known Differences

| Area | Chrome / Chromium | Firefox |
| --- | --- | --- |
| Background runtime | MV3 service worker | Firefox manifest overlay uses background scripts for compatibility |
| Managed policy schema | Chrome enterprise manifest declares `config/managed_policy_schema.json` | Firefox enterprise build includes Gecko metadata but does not declare Chrome managed schema |
| Temporary local install | `Load unpacked` folder | `Load Temporary Add-on` with `manifest.json` |
| Session state | prefers `storage.session`; ephemeral memory fallback if unavailable | same runtime preference through compatibility layer |
| Dynamic content scripts | required for user-managed protected sites | required; missing support raises an explicit runtime error |
| Store metadata | Chrome Web Store listing | Firefox AMO listing/checklist should be maintained separately |

## File Handling Notes

Supported UTF-8 text-file scanning and protected composer file handling should be checked on each browser before release. Known areas that need manual coverage include:

- drag/drop on Gemini and ChatGPT
- WhatsApp text, clipboard image paste, attach-button, and drag/drop support across canonical supported images, text-like files including `Dockerfile` and `Makefile`, PDF, DOCX, and XLSX; WhatsApp supports single-file plus in-cap multi-file sanitized attach/drop and blocks over-cap batches before read
- synthetic file handoff from real file inputs
- large text files above 4 MiB and up to 50 MB
- unsupported file warnings, safe pass-through boundaries, and fail-closed blocking when LeakGuard cannot safely continue
- popup secure reveal after extension reload or background restart

Firefox can have different behavior for hidden upload controls and trusted user activation. Keep Firefox release notes explicit about tested sites and any known limitations.

## Compatibility Review Checklist

Before claiming browser support for a release:

- build the relevant target
- load the extension manually
- run the protected-site smoke test
- test one user-managed exact-origin rule
- test secure reveal
- test one supported text-file scanner flow
- test one supported text-file composer flow
- test one unsupported file warning
- confirm no raw synthetic secrets appear in page DOM, console logs, or extension storage

See [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md) for the full manual checklist.
