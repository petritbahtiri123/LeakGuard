# False-Positive Playbook

Use when safe text, docs examples, config labels, ordinary IDs, usernames, service names, versions, regions, or placeholders are over-redacted.

## First Move
Add a safe-control regression test before changing behavior. Keep the positive controls nearby so a false-positive cleanup does not create a false negative.

Good test targets:
- `node tests/detector.test.js`
- `node tests/natural_language_context.test.js`
- `node tests/ai_candidate_gate.test.js`
- relevant `node tests/detection/*.test.js`
- `node tests/onix_dataset.test.js` for Onix dataset/feature changes

## Triage Order
1. Check allowlists, suppressions, and context.
   - `src/shared/patterns.js`
   - `src/shared/detector.js`
   - relevant `src/shared/detection/*`
2. Check whether the value is deterministic or gray-zone.
   - Deterministic rules should own provider/header/URL/structured cases.
   - Onix should handle gray-zone leftovers only.
3. Check candidate gating.
   - `src/shared/aiCandidateGate.js` should skip clean placeholders, safe values, and deterministic ranges.
4. Add safe examples without broad global safety changes.

## Policy Rules
- Do not lower safety globally to clean one false positive.
- Emails remain globally redacted.
- Usernames stay context-aware unless product policy changes.
- Keep 0 or near-0 false negatives more important than perfect false-positive cleanup.
- Preserve regex/provider -> entropy/context -> Onix -> redaction policy.
- Preserve trusted `[PWM_N]` pass-through.

## Validation
Run the safe-control test and the closest positive control:

```bash
node tests/detector.test.js
node tests/natural_language_context.test.js
node tests/ai_candidate_gate.test.js
node tests/onix_dataset.test.js
```

Run `npm test` if the change touches shared scoring, overlap, or broad suppression.
