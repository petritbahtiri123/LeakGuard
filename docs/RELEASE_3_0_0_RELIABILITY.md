# LeakGuard 3.0.0 Reliability Pass

## Release status

This is an internal reliability record, not a release declaration. `package.json` and `manifests/base.json` remain at `2.2.1`; this pass does not itself declare 3.0.0 release-ready. Authenticated live-site QA is still outstanding.

Publishing this record does not change runtime code, release identity, manifests, permissions, CSP, telemetry, network behavior, policy, redaction, model behavior, public privacy claims, or older live-browser evidence.

## Failure-path inventory

| Area | Classification | Evidence and disposition |
|---|---|---|
| text submit | `recoverable product defect`<br>`security-required block` | Missing-button Enter replay is fixed for verified non-WhatsApp form sends. Final composer mismatch still blocks. |
| paste handling | `security-required block`<br>`adapter/platform fragility` | Risky paste is owned before asynchronous work. Layered ChatGPT/Gemini insertion is verified locally; exception and composer-remount behavior still need browser QA. |
| drag/drop | `security-required block` | Raw drop is synchronously owned; only sanitized processing continues and raw input is never replayed. |
| clipboard image | `security-required block` | Owned image paste routes through OCR/redaction; unsafe extraction or export blocks without raw-text fallback. |
| image attach | `security-required block` | Handoff requires eligible OCR boxes and a verified redacted PNG; output remains file-only. |
| PDF | `security-required block` | Malformed, encrypted, image-only, and oversized extraction blocks; safe output is a regenerated PDF or sanitized `.redacted.txt`. |
| DOCX | `security-required block` | Malformed, encrypted, no-text, and oversized input blocks; safe output is regenerated DOCX or sanitized text. |
| XLSX | `security-required block`<br>`unsupported-input block` | Malformed, encrypted, macro, no-text, and oversized input blocks; legacy/macro Office stays unsupported. |
| text-like files | `security-required block` | Unavailable, unreadable, invalid UTF-8, and over-50-MB inputs block; supported large text uses streaming. |
| multi-file handoff | `recoverable product defect`<br>`security-required block` | Same-tab placeholder mutation is now serialized. Caps, order, sanitized-only partial success, and WhatsApp all-or-nothing behavior remain enforced. |
| ChatGPT | `adapter/platform fragility` | Verified text and file handoff has structural coverage; current authenticated selector effectiveness is unproven. |
| OpenAI | `adapter/platform fragility` | Verified ChatGPT text sync is shared, but the distinct generic file adapter still needs authenticated readiness QA. |
| Gemini | `adapter/platform fragility`<br>`security-required block` | Layered insertion and bounded pending file discovery exist; failed verification has no raw fallback. |
| Claude | `adapter/platform fragility` | Generic verified text rewrite and file discovery have structural coverage, not current authenticated-DOM proof. |
| Grok | `adapter/platform fragility` | Generic verified text rewrite and specialized pending file handoff still require current live-DOM QA. |
| X | `unclear / needs investigation` | Contract fixtures prove shape, not current submit/click effectiveness. |
| WhatsApp | `adapter/platform fragility`<br>`unsupported-input block` | Specialized verified handoff covers supported paths; document/file paste and unsupported families remain blocked. Localization-dependent selectors need live QA. |
| generic adapter | `adapter/platform fragility` | Unsafe targets are rejected and discovery is bounded; effectiveness remains site-specific. |
| background/service-worker/state | `recoverable product defect`<br>`adapter/platform fragility` | Same-tab overwrite is fixed. Privacy-safe ephemeral state still resets on worker/runtime restart, and dynamic-registration sync remains a gap. |
| options/policy | `security-required block`<br>`recoverable product defect` | Managed-policy failures and blocked destinations stay fail-closed. Main options rendering remains coupled to the OCR-setting read. |

## Recovery paths implemented

These fixes were implemented, covered by focused regression tests, and independently reviewed before this record was written:

- `d949190` isolates extraction-cache authorization by `File` object identity. Same-object reuse, TTL, the 24-entry cap, and raw-free snapshots remain intact.
- `1355d1d` serializes redaction mutations per tab. Different tabs remain concurrent and a rejected operation does not poison later work.
- `c1e33df` routes a verified non-WhatsApp Enter replay with a missing button through the existing form-derived submit path exactly once. WhatsApp retains its block.

These are local implementation and review results; they are not authenticated provider evidence.

## Blocks intentionally retained

- Final composer rewrite/identity mismatch blocks submission; no raw text replay was added.
- Risky paste and drop remain consumed once LeakGuard owns them; an exception cannot fall through to raw browser handling.
- Malformed, encrypted, unreadable, oversized, image-only PDF, unsafe OCR-box, unsupported, and incompletely sanitized files block or use an explicitly sanitized fallback only.
- Failed file replacement, pending handoff expiry, and unverified upload completion do not replay the raw file.
- WhatsApp still blocks missing-button Enter replay, unsupported file families, unsafe multi-file batches, and document/file paste; it never inserts extracted file text as fallback.
- Managed-policy failures, blocked destinations, and final protected-site verification failures remain fail-closed.

## Known reliability gaps

### Static hypotheses

These come from source and fixture review and are not confirmed live defects:

- Destructive dynamic content-script registration synchronization may leave a protected-site status out of step with an injected working panel.
- Options rendering waits for the OCR setting before showing the main overview; decoupling is recommended but was not part of this pass.
- X submit/click behavior and generic-site selector effectiveness remain unclear beyond contract fixtures.
- Ephemeral fallback state intentionally avoids persistence but resets on service-worker/runtime restart; the user-visible recovery experience needs validation.

### Authenticated live QA gaps

- Current logged-in Chrome and Firefox behavior remains unverified for ChatGPT, OpenAI, Gemini, Claude, Grok, X, WhatsApp, and a generic managed site.
- Current composer remount frequency, localized control labels, file-input readiness, and site navigation behavior cannot be established from static fixtures.
- Gemini/Grok pending handoff, custom-site permission restart, service-worker restart, and the full supported/unsupported file matrix still require manual browser execution.

## Manual QA before 3.0.0

1. Process two supported text files together, each with a distinct synthetic secret. Confirm unique stable placeholders, correct reveal mapping, original handoff order, and one upload action.
2. Process two different files with identical name, size, MIME type, and last-modified metadata. Confirm each sanitized result contains only its own safe marker and neither raw secret.
3. In a supported form-based composer whose send button is late or absent, press Enter once after redaction. Confirm exactly one sanitized submission and no second click.
4. On WhatsApp, remove or delay the send button in the QA harness and confirm the send blocks with no replay.
5. Run attach, drop, and paste coverage for supported text, PDF, DOCX, XLSX, PNG/JPG/JPEG/WEBP, in-cap multi-file batches, and over-cap or unsupported inputs. Confirm there is no raw fallback.
6. Exercise Gemini/Grok pending attach through navigation, late input exposure, expiry, and cancellation. Confirm there is no duplicate upload.
7. Restart the service worker and verify placeholder/reveal state resets clearly without persistence to local storage.
8. Add a custom protected site, restart, revoke and regrant permission, and verify an `Active` status corresponds to an injected working content panel.
9. Run authenticated Chrome and Firefox QA for ChatGPT, OpenAI, Gemini, Claude, Grok, X, WhatsApp, and one generic managed site.

## Validation evidence

- The clean branch baseline `npm test` passed before the three fixes.
- Cache isolation passed the extraction-pipeline and security tests plus syntax validation; independent review approved it.
- Per-tab serialization passed security, audit, enterprise-policy, change-aware, full-suite, and syntax validation; independent review approved it.
- Enter replay passed fallback-key, typed-interception, submit, click-orchestration, and syntax validation; independent review approved it.
- The final branch `npm test` passed. Browser preflight also passed.
- The full local Playwright gate passed with 106 scenarios and one intentionally manual `@live` WhatsApp diagnostic skipped. This covered text, paste, files, images, multi-file ordering, adapter fixtures, and fail-closed paths.
- Chrome and Firefox builds and smoke suites passed. The isolated hot-path and file-extraction performance benchmarks stayed within budget.
- `npm run docs:check-links`, `git diff --check`, the staged-diff checks, and final clean-worktree verification passed.
- No authenticated live-site QA was performed or inferred by this pass.

## Rollback

Revert the documentation commit to remove this record and its release-QA link. The runtime fixes are independently revertible at `d949190`, `1355d1d`, and `c1e33df`; reverting one restores its prior reliability defect and must not be paired with raw replay or weaker fail-closed handling.
