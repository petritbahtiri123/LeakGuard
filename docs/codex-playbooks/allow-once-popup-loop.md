# Playbook: Allow Once popup loop

## Problem fingerprint
Clicking `Allow Once` closes a warning, but the same warning reopens for the same composer content or same detected value. The failure usually appears as a popup loop: dismiss, scan, detect, reopen. It is different from permanent whitelisting or policy-based allow rules.

## Expected behavior
`Allow Once` suppresses only the same detection fingerprint in the same prompt/session context. It must not permanently whitelist a secret, suppress unrelated findings, or allow changed values to pass silently.

## Likely root cause
The suppression key is too unstable, too broad, or checked at the wrong phase. Common causes are using raw object identity, using changing DOM/editor content as the whole key, recording suppression after the next scan has already started, or suppressing by detection type only.

## Safe implementation direction
Build a stable fingerprint from narrow evidence:

- detection type
- normalized detected value or trusted placeholder
- site and field/editor context
- prompt/session scope
- nearby content hash or small content window

Apply suppression during the warning decision path, not by deleting detections globally. Store allow-once entries in memory scoped to the active session/prompt context unless product requirements intentionally persist them. Do not write raw secrets into local storage, logs, exported diagnostics, or playbooks. If hashing is needed, hash normalized local values and keep enough context to avoid broad suppression.

Prefer exact suppression for the same fingerprint. If a placeholder is already trusted, pass it through according to existing placeholder trust rules instead of adding a new allow-once path.

## Files likely involved
- `src/content/content.js`
- `src/content/composer_helpers.js`
- popup or warning UI modules if present
- detector/redactor boundary tests when suppression changes affect transform behavior
- focused content or typed interception tests

## Verification
- Same finding is suppressed after `Allow Once`.
- A new fake secret in the same prompt still triggers.
- A changed secret value triggers.
- The same value in a different field or site context triggers unless intentionally scoped otherwise.
- Reload clears session-level allow-once suppression unless the product explicitly persists it.

## Regression tests
Add or update focused tests around the warning decision and composer flow. Use safe fake values only. Assert that the suppression key is reused for the exact same finding and not reused for changed value, changed context, or new detection type.

## Rollback
Remove the allow-once fingerprint check and any new in-memory store. Revert tests that assert suppression behavior. Do not migrate or clean persistent data unless a previous change wrote allow-once state to storage.

## Notes
Keep redaction right-to-left safe and preserve placeholder stability. Do not broaden suppression to all findings of one type, and do not treat `Allow Once` as a whitelist.
