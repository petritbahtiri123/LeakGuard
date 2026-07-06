# Playbook: WhatsApp Multiline Rewrite Mismatch

Use when WhatsApp Web visibly receives sanitized placeholders, but LeakGuard still blocks the action with a rewrite mismatch or rewrite verification failure.

## Problem fingerprint

- Multiline paste into WhatsApp Web redacts sensitive-looking values into placeholders such as `[PWM_N]`.
- The composer visibly contains sanitized placeholders and no raw secret.
- LeakGuard still shows `Rewrite mismatch blocked` or `Rewrite verification failed`.
- In a debug build, safe logs may show `whatsapp-sync:before-editor-action`, `whatsapp-sync:after-clear`, no `whatsapp-sync:after-insert-settle`, and then `rewrite:verification-failure`.

## Expected behavior

- Sanitized multiline content settles in the WhatsApp composer.
- Raw sensitive-looking values are not restored or submitted.
- LeakGuard does not show a false rewrite mismatch modal or badge for a verified safe placeholder rewrite.

## Likely root cause

- WhatsApp may consume the sanitized synthetic paste and call `preventDefault()` after accepting or processing the paste payload.
- If LeakGuard treats `defaultPrevented` as an insertion failure too early, it can fail before settled composer verification runs.
- WhatsApp paragraph and placeholder DOM layout can also differ from plain text expectations even when the visible placeholder sequence is safe.

## Safe implementation direction

1. Do not bypass rewrite verification or trust raw DOM contents blindly.
2. After the sanitized clipboard payload is attached, allow a paste dispatch that is either normally dispatched or `defaultPrevented` to proceed into settled-text verification.
3. Keep any safe-placeholder fallback scoped to WhatsApp, placeholder count/order/token matching, reasonable length checks, and no unsafe visible secret.
4. Suppress the failure modal only for verified safe WhatsApp placeholder rewrites.
5. Use the local debug build when release builds strip debug logs.

## Files likely involved

- `src/content/content.js`
- `tests/typed_interception.test.js`
- `tests/e2e/whatsapp_reproduction.spec.mjs`
- `scripts/build-extension.mjs`
- `tests/build_targets.test.js`
- `package.json`

## Verification

Use the normal Chrome build for product verification:

```bash
npm run build:chrome
```

Load this unpacked extension path:

```text
C:\Users\bajra\OneDrive\Documents\Development\LeakGuard\LeakGuard\dist\chrome
```

For debug-only investigation, build and load:

```bash
npm run build:chrome-debug
```

```text
C:\Users\bajra\OneDrive\Documents\Development\LeakGuard\LeakGuard\dist\chrome-debug
```

On WhatsApp Web, paste multiline synthetic secret fixtures and confirm:

- placeholders are present
- raw fixture values are absent
- no `Rewrite mismatch blocked` badge appears
- no `Rewrite verification failed` modal appears
- message sending remains fail-closed if the composer cannot be verified safely

## Regression tests

Run the focused tests first:

```bash
node tests/typed_interception.test.js
npx playwright test tests/e2e/whatsapp_reproduction.spec.mjs --workers=1
```

If the debug build or build targets changed, also run:

```bash
node tests/build_targets.test.js
```

Before completion:

```bash
node --check src/content/content.js
git diff --check
```

## Rollback

- Revert the WhatsApp paste-dispatch acceptance change.
- Revert any WhatsApp-only safe-placeholder fallback or modal-suppression changes.
- Rebuild `dist/chrome` and reload the unpacked extension.
- If debug packaging was part of the change, remove the debug build script and its target test updates together.

## Notes

- Use only fake fixtures while debugging.
- Keep debug output metadata-only: stages, reason codes, counts, booleans, and placeholder counts.
- Do not add telemetry, remote verification, cloud secret processing, or raw composer logging.
