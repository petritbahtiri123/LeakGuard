# Detector Bug Playbook

Use when a secret, sensitive header value, URL credential, identity value, email, public network value, or structured cloud/provider identifier is missed.

## First Move
Add a failing focused test before changing behavior. Prefer the narrowest existing test:

- `node tests/detector.test.js`
- `node tests/natural_language_context.test.js`
- `node tests/adversarial_redaction.test.js`
- `node tests/break_pack.test.js`
- relevant `node tests/detection/*.test.js`

Use fake/synthetic values only. Do not print raw real secrets while debugging.

## Triage Order
Preserve the lifecycle:

```text
regex/provider deterministic rules
  -> entropy/context fallback
  -> Onix gray-zone classifier
  -> final redaction policy
```

1. Check regex/provider/context first.
   - `src/shared/patterns.js`
   - `src/shared/detection/*`
   - `src/shared/detector.js`
2. Check full intended value range.
   - Sensitive HTTP header names and separators remain visible, but values redact.
   - URL username/password ranges should stay structured when possible.
   - Known raw secret reuse should beat suffix-only findings.
3. Check entropy fallback second.
   - Entropy is fallback, not a global aggressive detector.
   - Do not lower global thresholds just to catch one example.
4. Check Onix only for gray-zone leftovers.
   - `src/shared/aiCandidateGate.js`
   - `src/shared/transformOutboundPromptWithAi.js`
   - `node tests/ai_candidate_gate.test.js`
   - `node tests/onix_dataset.test.js`

## Hard Rules
- Do not weaken false-positive controls.
- Do not re-redact trusted `[PWM_N]` placeholders.
- Emails globally redact.
- Preserve placeholder order, reuse, and right-to-left redaction safety.
- Keep debug and test output raw-free except for synthetic fixture strings intentionally asserted in tests.

## Validation
Run the focused failing test first, then add adjacent tests as risk grows:

```bash
node tests/detector.test.js
node tests/natural_language_context.test.js
node tests/adversarial_redaction.test.js
node tests/break_pack.test.js
node tests/ai_candidate_gate.test.js
node tests/onix_dataset.test.js
```

Run `npm test` for cross-module changes.
