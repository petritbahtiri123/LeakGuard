# Live Prompt Capture QA Runbook

Use this runbook when browser smoke tests are unavailable or when validating real SPA composer behavior on protected chat sites. It verifies the exact local prompt text that LeakGuard is about to submit without transmitting captured QA data anywhere.

## Safety and scope

- Use only the synthetic inputs in `tests/fixtures/manual/live-site-qa/prompt-comprehension-cases.md`.
- Do not paste real credentials, customer data, private hostnames, production paths, screenshots, or files.
- The capture procedure is manual/dev-only: it is a DevTools snippet run by the tester on a loaded local extension build. It is not included in manifests, not shipped as a runtime script, and not enabled in normal builds.
- Captured text must stay in the local browser DevTools session or a local QA notes file. Do not send it to a model, paste it into an issue, or upload it.
- The capture separates these fields in QA notes:
  - `userAuthoredPrompt`: the synthetic text typed/pasted by the tester before LeakGuard rewriting.
  - `preSubmitObservedPrompt`: the exact visible composer text before pressing Send.
  - `sanitizedPrompt`: the exact submitted or post-submit composer text after LeakGuard submit-time redaction.
  - `uiStatusText`: visible LeakGuard badges, overlays, modals, or pending attach prompts outside the composer.
  - `fileHandoffMetadata`: file count, safe file names, safe placeholder counts, and attach/fallback state only.
  - `adapterInternalState`: safe booleans/reason codes only, such as pending attach present/cleared.

## Local prompt-capture snippet

Run this snippet in the page DevTools console after loading the local extension build and before pressing Send. The snippet reads likely composer elements only; it does not hook network, does not submit, and does not store anything outside `window.__LEAKGUARD_PROMPT_CAPTURE_QA__` on the current page.

```js
(() => {
  const selectors = [
    '#prompt-textarea',
    '[data-testid="prompt-textarea"]',
    'textarea[placeholder*="Message" i]',
    '.ProseMirror[contenteditable]:not([contenteditable="false"])',
    '.ql-editor[contenteditable]:not([contenteditable="false"])',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable]:not([contenteditable="false"])[aria-label*="message" i]'
  ];
  const normalize = (value) => String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  const readText = (el) => normalize(el?.tagName === 'TEXTAREA' ? el.value : el?.innerText || el?.textContent || '');
  const composers = selectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .filter((el, index, all) => el && all.indexOf(el) === index)
    .map((el, index) => ({ index, tag: el.tagName, role: el.getAttribute('role') || '', text: readText(el) }))
    .filter((entry) => entry.text.trim());
  const uiStatusText = Array.from(document.querySelectorAll('.pwm-badge,.pwm-panel,.pwm-file-processing,.pwm-pending-attach-prompt,.pwm-modal-backdrop'))
    .map((el) => normalize(el.innerText || el.textContent || ''))
    .filter(Boolean);
  const snapshot = {
    capturedAt: new Date().toISOString(),
    locationHost: location.host,
    composerCount: composers.length,
    composers,
    uiStatusText,
    notes: 'Synthetic local QA only. Do not upload. Do not use with real secrets.'
  };
  window.__LEAKGUARD_PROMPT_CAPTURE_QA__ = snapshot;
  console.table(composers.map(({ index, tag, role, text }) => ({ index, tag, role, chars: text.length, placeholders: (text.match(/\[[A-Z][A-Z0-9_]*_\d+(?:_[A-Z0-9_]+)?\]/g) || []).length })));
  console.log(snapshot);
  return snapshot;
})();
```

## Two-phase pass criteria

Pre-submit observe-only capture:

- Choose the composer entry that would be submitted. With default `liveTypedRedaction=false`, typed risky synthetic values may remain visible before Send.
- For newly typed risky synthetic values, no placeholder should appear before submit unless `liveTypedRedaction=true` was explicitly enabled for that run.
- `text` contains none of: `LeakGuard`, `debug`, `metadata`, `placeholderCount`, `file-handoff`, `pending attach`, `diagnostic`, `status:` unless the user intentionally typed that word as part of the prompt.
- `uiStatusText` may contain LeakGuard status copy, but that copy must not appear inside the selected composer `text`.
- Capture must stay local in the browser DevTools session or local QA notes only.

Submit/post-submit capture:

- The submitted content must be sanitized and equal the expected sanitized prompt for the fixture case.
- All raw synthetic sensitive values must be absent from the submitted content.
- Visible placeholders are expected for redacted values.
- The exact-state verification and fail-closed behavior must be validated: if LeakGuard cannot verify the rewritten composer, nothing raw should submit.
- `text` contains none of: `LeakGuard`, `debug`, `metadata`, `placeholderCount`, `file-handoff`, `pending attach`, `diagnostic`, `status:` unless the user intentionally typed that word as part of the prompt.
- `uiStatusText` may contain LeakGuard status copy, but that copy must not appear inside the selected composer `text`.
- Re-running the snippet after an SPA re-render shows the same composer text and placeholder count.
- Re-running redaction or pressing Send twice after a blocked/failed attempt does not create additional placeholders.

## Cross-adapter checklist

Run the text-paste cases from `tests/fixtures/manual/live-site-qa/prompt-comprehension-cases.md` on each supported adapter:

| Adapter | URL | Required checks |
| --- | --- | --- |
| ChatGPT | `https://chatgpt.com/` | Paste, submit interception, re-render after draft edit, file upload if enabled. |
| OpenAI | `https://chat.openai.com/` | Same as ChatGPT; verify generic adapter selectors do not select hidden text. |
| Gemini | `https://gemini.google.com/app` | Highest priority: paste, rejected file fallback, pending attach clear, multi-file handoff, SPA rehydration. |
| Claude | `https://claude.ai/` | Paste and supported text-file upload; verify status cards stay outside composer. |
| Grok | `https://grok.com/` | Paste and direct drop replay path; verify no duplicate DOM text nodes. |
| X | `https://x.com/compose/post` | Verify generic protected-site flow does not submit file summaries as prompt text. |
| WhatsApp Web | `https://web.whatsapp.com/` | Verify drafts, clipboard image paste, single-file attach/drop, and 2-5 file sanitized attach/drop are protected without sending messages; 6+ files block before read. |
| Generic | Configured protected test site | Verify generic protected-site flow does not submit file summaries as prompt text. |

For each adapter and each case, record:

1. Browser, extension build, adapter, URL, and fixture case ID.
2. `userAuthoredPrompt` copied from the fixture.
3. Captured `preSubmitObservedPrompt` from the selected composer entry before pressing Send.
4. Captured `sanitizedPrompt` from the provider submission, submitted draft, or post-submit selected composer entry.
5. Placeholder count and visible placeholder families.
6. Whether UI/status/debug text appeared only outside the composer.
7. Whether repeated capture after re-render or repeated submit attempt changed the prompt.
8. Whether all raw synthetic sensitive values were absent.

## Gemini-focused procedure

Run Gemini first because it has the highest DOM rehydration and pending attach risk.

1. **Plain paste:** Paste each text fixture into Gemini. Wait for LeakGuard to settle. Capture. Expected: sanitized text appears exactly once; no duplicate placeholders or repeated spans/nodes are visible.
2. **SPA rehydration:** Type a harmless trailing sentence such as `Please keep the script idempotent.` and wait for Gemini to re-render. Capture again. Expected: same sanitized prompt plus the harmless sentence once.
3. **Rejected file fallback:** Upload a synthetic supported text file containing one fixture case. If Gemini rejects sanitized upload and LeakGuard offers text fallback, choose the fallback. Capture. Expected: composer contains only sanitized file text or user-authored prompt plus sanitized file text; no fallback explanation, badge text, or file metadata appears in the composer.
4. **Pending attach clear:** Queue a sanitized file attach, cancel it, then send a new text-only fixture. Capture. Expected: no stale sanitized payload from the canceled attach appears.
5. **Disable/re-enable protection:** Pause protection only if allowed by policy, type a harmless synthetic prompt, resume protection, then paste a new fixture. Capture. Expected: no old placeholders or pending payloads are reused.
6. **Multi-file:** Attach two synthetic files from the fixture set. Capture before submit and after any fallback. Expected: per-file status summaries remain in UI only; submitted composer text is user-authored plus intentionally inserted sanitized content only.
7. **File-only:** Attach a synthetic file without typing a prompt. Capture. Expected: empty composer or intentionally inserted sanitized file text only; no `Sanitized file attached`, `LeakGuard redacted`, or file-count status text in composer.

## Live DOM risk assessment template

Use this template in QA notes:

```text
Adapter:
Browser/build:
Fixture case:
User-authored prompt source: tests/fixtures/manual/live-site-qa/prompt-comprehension-cases.md
Selected composer index:
Pre-submit observed prompt length:
Sanitized prompt length:
Placeholder count/families:
UI status text present outside composer: yes/no
Debug/status/metadata text inside composer: no/yes (fail if yes)
Raw synthetic sensitive values before submit: yes/no (allowed only for observe-only default liveTypedRedaction=false)
Raw synthetic sensitive values submitted/post-submit: no/yes (fail if yes)
Exact-state verification/fail-closed behavior validated: yes/no
Repeated capture changed prompt: no/yes (fail if yes)
Repeated submit mutated prompt: no/yes (fail if yes)
Gemini pending attach stale payload reused: no/yes/not applicable
Pass/fail:
Notes:
```

## Typed-placeholder experiment note

Current generic placeholders such as `[PWM_N]` are safest because they reveal the least about the original value. They can, however, reduce model comprehension when the redacted value's category is useful to the task.

Typed placeholders such as `[REDACTED_PRIVATE_IP_1]`, `[REDACTED_UNC_PATH_1]`, `[REDACTED_EMAIL_1]`, and `[REDACTED_SERVER_NAME_1]` may improve model comprehension by preserving the role of an item in DevOps prompts. The risk is that type information can still reveal sensitive context, especially in enterprise environments where the presence of a tenant ID, privileged account, customer domain, or cloud provider identifier is itself sensitive.

Safe candidates for a future gated experiment:

- Private IP or private CIDR placeholders when policy already allows network-context pseudonymization.
- UNC path placeholders where the share/server names are fully removed.
- Email placeholders when only the fact that an email existed is revealed.
- Server-name placeholders for synthetic/manual QA or consumer opt-in contexts only.

Categories that should remain generic or strongly secret-classed by default:

- API keys, OAuth tokens, JWTs, session cookies, password values, private keys, Authorization headers, database credentials, URL passwords, and recovery codes.
- Enterprise tenant/customer identifiers unless a managed policy explicitly opts into typed categories.
- Any value that appears in an authentication, authorization, or secret-bearing context.

Recommendation: add typed placeholders only as a future Phase entry behind an explicit policy/test flag, never as a default replacement for current `[PWM_N]` behavior.
