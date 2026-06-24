# Live Typing Composer QA and Risk Map

This note covers normal typed text only. It excludes paste, drag/drop, file upload, and pending attach flows unless a previous file flow has already left state behind.

## Event path map

| Event/path | Normal typing role | Mutates composer before submit? | Notes |
| --- | --- | --- | --- |
| `beforeinput` / `maybeHandleBeforeInput` | Synchronously inspects the proposed insertion before the site commits it. | Default: no composer rewrite because `liveTypedRedaction` is false. If `liveTypedRedaction=true`, risky typed input or placeholder normalization may be rewritten. | Uses selection offsets to build the candidate text. Firefox early consumption is also gated by `liveTypedRedaction`. |
| `input` / `scheduleInputScan` | Delayed scan after the site has already updated the composer. | Default: warning/status only. If `liveTypedRedaction=true`, risky text can live-redact before submit. | Uses a 220 ms timer and generation counters to avoid stale scans. |
| `keydown` / `maybeHandleFallbackSendKey` | Enter-to-send fallback. | Submit-boundary path only. | Plain typing keydown is ignored unless it is Enter without modifiers in a composer without a form. |
| `paste` / `maybeHandlePaste` | Dedicated paste/file path. | Out of scope for normal typing. | Handled separately to block raw file/paste races. |
| `submit` / `maybeHandleSubmit` | Final submit boundary. | Yes, transactional sanitized rewrite before send. | Uses exact composer-state verification before submitting. |
| `click` / `maybeHandleSendButtonClick` | Send-button fallback. | Submit-boundary path only. | Delegates to submit interception if the composer text is risky. |
| Composition/IME input | Should not be modified mid-composition. | No intended mutation mid-composition. | `insertCompositionText` with `isComposing` is excluded from typed beforeinput interception. |
| MutationObserver rehydration | Response/reveal and pending file handoff surfaces. | Not part of ordinary typing mutation. | QA should still verify SPA re-renders do not duplicate composer text. |

## Current architecture finding

LeakGuard's default AI-chat typing phase is now observe-only: `liveTypedRedaction` defaults to `false` for consumer and enterprise policy. Harmless and risky typed text may still be scanned so LeakGuard can warn outside the composer, but the composer should not be rewritten until submit. If an environment explicitly sets `liveTypedRedaction=true`, typed interception and the delayed typed scan can live-redact high-confidence risky typed text before submit. That opt-in mode is the main live-editor risk surface for Gemini and React-style composers.

Recommended safety split for future work:

1. Typing phase: observe harmless text only; do not touch the composer.
2. Warning phase: show badges or panels outside the composer.
3. Risky live-redaction phase: keep previous live mutation behavior only when `liveTypedRedaction=true`.
4. Submit phase: transactional sanitized rewrite and exact-state verification regardless of `liveTypedRedaction`.
5. Post-submit phase: clear transient risk and pending handoff state.

## Manual QA checklist for normal typing

Run these checks on ChatGPT, Gemini, Claude, Grok, OpenAI, and X/generic protected-site flows. Prioritize Gemini and ChatGPT.

Use only synthetic text from this document. Do not use real credentials, private hostnames, customer data, or real files.

### Harmless typing stability

Synthetic prompt:

```text
Write a concise troubleshooting plan for a slow internal dashboard. Include hypotheses, logs to inspect, and a rollback plan.
```

Steps:

1. Type the prompt normally, one sentence at a time.
2. Pause for at least one second after each sentence.
3. Capture the composer with `docs/qa/live-prompt-capture-qa.md`.

Pass criteria:

- Visible composer text equals exactly what was typed.
- No `[PWM_N]`, `[NET_N]`, or typed placeholder appears.
- No LeakGuard/debug/status/metadata text appears in the composer.
- Cursor remains where the user left it.
- Undo/redo still works.
- No pending file/sanitized payload UI appears.

### Mid-paragraph insertion and caret stability

Synthetic prompt:

```text
Draft a runbook for restarting a service safely. Include validation and rollback steps.
```

Steps:

1. Type the full prompt.
2. Move the caret after `service`.
3. Type ` during a maintenance window`.
4. Wait one second and capture.

Pass criteria:

- Inserted words appear exactly at the caret position.
- Caret does not jump to the end because of LeakGuard.
- No duplicate DOM text or repeated sentence appears.

### Deletion and stale text

Steps:

1. Type `Explain the outage timeline and likely customer impact.`
2. Delete `customer` and replace it with `operator`.
3. Use undo and redo once.
4. Capture after each step.

Pass criteria:

- Deleted text does not reappear unless browser undo intentionally restores it.
- LeakGuard does not resurrect old sanitized text.
- Final visible composer text matches browser editing actions.

### Multi-line ordinary prompt

Synthetic prompt:

```text
Please review this incident summary:
- symptom: elevated latency
- impact: dashboard users saw delays
- request: propose next diagnostics
```

Pass criteria:

- Line breaks remain unchanged.
- No placeholder is injected.
- No synthetic submit/send path runs.

### IME/composition safety

Steps:

1. Use an IME or browser composition tool.
2. Compose harmless text in the middle of an existing sentence.
3. Capture after composition ends.

Pass criteria:

- LeakGuard does not modify text mid-composition.
- The committed composed text appears once.
- Caret remains usable after composition.

### Synthetic risky typed text

Synthetic input:

```text
API_KEY=sk-test-abcdefghijklmnopqrstuvwxyz123456
```

Expected default behavior:

- With `liveTypedRedaction=false`, LeakGuard should warn outside the composer but leave the typed composer text unchanged until submit.
- No `[PWM_N]` placeholder should appear during typing.
- On submit, LeakGuard must still redact to `API_KEY=[PWM_N]`, verify the exact sanitized composer state, and fail closed if rewrite/verification fails.

Opt-in behavior:

- With `liveTypedRedaction=true`, LeakGuard may live-redact this before submit. The final composer should be `API_KEY=[PWM_N]` once, with no raw synthetic value and no duplicate text.

## Gemini and ChatGPT risk checks

For Gemini and ChatGPT, repeat every harmless typing test after:

1. Starting a new chat.
2. Navigating to another chat and back.
3. Letting the SPA re-render after a route change.
4. Clearing the composer completely and typing a new harmless prompt.

Pass criteria:

- Old sanitized text does not reappear.
- Stale risk state does not trigger a rewrite of harmless text.
- Placeholder count remains zero for harmless text.
- Visible text and captured composer text match.

## Recommendation

Keep observe-only typing as the default. Use `liveTypedRedaction=true` only for environments that explicitly accept pre-submit DOM mutation. Preserve fail-closed submit redaction and enterprise enforcement regardless of the live-typing setting.
