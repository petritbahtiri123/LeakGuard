# File Attach Manual QA Checkpoint After PR 4I

Use this checkpoint before further file attach extraction or PR 5 work. PR 4A-4I extracted pure planning helpers, but `maybeHandleLocalFileInsert()` still intentionally owns side effects such as event consumption, local file reads, streaming redaction, pending attach queueing, fallback insertion, browser/file-input behavior, UI, badge, overlay updates, and fail-closed handling.

Use synthetic inputs only. Do not use real credentials, customer data, private files, real hostnames, or production secrets.

## Setup

- Build Chrome and Firefox targets from the current commit.
- Protect the tested site in LeakGuard before each run.
- Keep DevTools Network and Console open.
- Run `npm run smoke:chrome` and `npm run qa:browser` sequentially, not in parallel, because they can conflict on shared Chrome build/temp state.
- Record browser version, extension build, date, and tester.

## Synthetic Files

Supported text file content:

```text
API_KEY=LeakGuardPr4iFileApiKey1234567890abcdef
DB_PASSWORD=LeakGuardPr4iDbPassword123!
Authorization: Bearer LeakGuardPr4iBearerToken1234567890
resolver=8.8.8.8
private_ip=192.168.1.10
token_limit=4096
```

Suggested supported file names:

- `leakguard-pr4i-manual.env`
- `leakguard-pr4i-manual.txt`
- `leakguard-pr4i-manual.log`

Unsupported file set:

- PDF: `leakguard-pr4i.pdf`
- DOCX: `leakguard-pr4i.docx`
- Image: `leakguard-pr4i.png`
- Archive: `leakguard-pr4i.zip`
- Binary/executable: `leakguard-pr4i.exe`

Invalid UTF-8 file:

- Create a small `.txt` or `.bin` fixture with invalid UTF-8 bytes.

Oversized and streaming files:

- Oversized hard-block file: text file above the current hard limit.
- Large streaming file: text file in the supported streaming range, containing repeated safe filler plus the synthetic secrets above.

## Checklist

| Site/browser | Scenario | Synthetic input | Expected result | Pass/fail | Notes/evidence |
| --- | --- | --- | --- | --- | --- |
| ChatGPT / Chrome | Supported text-file upload button | `leakguard-pr4i-manual.env` | File is scanned locally; sanitized file or sanitized text reaches ChatGPT; raw `LeakGuardPr4i*` values do not appear in composer, preview, generated attachment text, or network payload visible to the page. |  |  |
| ChatGPT / Chrome | Supported text-file drag/drop | `leakguard-pr4i-manual.env` | Raw drop is consumed before host ingestion; sanitized handoff occurs; no duplicate content; composer remains editable. |  |  |
| ChatGPT / Firefox | Supported text-file upload button | `leakguard-pr4i-manual.env` | Raw selected file is replaced or blocked according to current safe path; raw file is not uploaded after scan/sanitization failure. |  |  |
| ChatGPT / Firefox | Supported text-file drag/drop | `leakguard-pr4i-manual.env` | Drop is intercepted; sanitized handoff or sanitized fallback occurs; Firefox-specific empty/unavailable file events do not leak raw content. |  |  |
| Gemini / Chrome | Supported text-file upload button | `leakguard-pr4i-manual.env` | Sanitized file handoff or sanitized text fallback occurs once; no raw content appears; manual typing still works after attach. |  |  |
| Gemini / Chrome | Supported text-file drag/drop | `leakguard-pr4i-manual.env` | Follows adapter-based file handoff rules; no raw drop replay; no duplicate prior editor content; editor does not freeze or move text to the wrong composer. |  |  |
| Gemini / Firefox, if available | Supported text-file upload/drop | `leakguard-pr4i-manual.env` | Firefox Gemini bridge or pending trusted attach path is used; raw upload picker behavior remains guarded; no raw content reaches Gemini. |  |  |
| Grok / Chrome | Supported text-file upload/drop | `leakguard-pr4i-manual.env` | Sanitized handoff or pending trusted attach path works; raw file content remains absent. |  |  |
| Grok / Firefox, if available | Supported text-file upload/drop | `leakguard-pr4i-manual.env` | Pending attach remains gated by trusted user action; no raw fallback upload occurs. |  |  |
| Claude / Chrome, if available | Supported text-file upload/drop | `leakguard-pr4i-manual.env` | Sanitized file handoff or sanitized text fallback occurs; raw values remain absent. |  |  |
| Claude / Firefox, if available | Supported text-file upload/drop | `leakguard-pr4i-manual.env` | Same result as Chrome unless site capability differs; record any browser divergence. |  |  |
| x.com / Chrome and Firefox, if currently built-in/protected | Supported text-file upload/drop or unsupported attach behavior | `leakguard-pr4i-manual.env` | Current protected-site behavior is explicit: sanitized attach/fallback if supported, otherwise raw upload is blocked or pass-through is clearly outside protected file support. Record exact UX. |  |  |
| All available sites/browsers | Unsupported PDF | `leakguard-pr4i.pdf` | Unsupported file is not silently treated as protected. UX matches current policy: clear unsupported notice/pass-through or strict block where applicable. |  |  |
| All available sites/browsers | Unsupported DOCX | `leakguard-pr4i.docx` | Same unsupported-file expectation. |  |  |
| All available sites/browsers | Unsupported image | `leakguard-pr4i.png` | Same unsupported-file expectation. |  |  |
| All available sites/browsers | Unsupported archive | `leakguard-pr4i.zip` | Same unsupported-file expectation. |  |  |
| All available sites/browsers | Unsupported binary/exe | `leakguard-pr4i.exe` | Same unsupported-file expectation; executable is never presented as sanitized/protected. |  |  |
| ChatGPT / Chrome and Firefox | Oversized text file | Hard-block oversized text fixture | Upload/drop is blocked before insertion/upload; message explains size/safety; raw content does not appear. |  |  |
| Gemini / Chrome and Firefox, if available | Oversized text file | Hard-block oversized text fixture | Site editor remains responsive; no partial unsafe insertion; raw file is not uploaded. |  |  |
| All available sites/browsers | Invalid UTF-8 | Invalid UTF-8 fixture | Scan/decode failure blocks raw upload where LeakGuard has attempted protected processing; no raw bytes/text reach composer. |  |  |
| ChatGPT / Chrome and Firefox | Large streaming text file | Streaming-range text fixture | Streaming redaction completes locally; full file is not inserted as composer text unless explicit sanitized fallback occurs; raw values absent. |  |  |
| Gemini / Chrome and Firefox, if available | Large streaming text file | Streaming-range text fixture | Pending attach path is used where expected; no full-file editor rewrite loop; no duplicate content. |  |  |
| Grok / Chrome and Firefox, if available | Large streaming text file | Streaming-range text fixture | Pending attach path is used where expected; pending prompt requires trusted action; no raw upload. |  |  |
| All available sites/browsers | Fail-closed after scan/sanitization failure | Temporarily simulate failure only in a local test build, or use invalid UTF-8/known failure fixture | Raw file must not upload after failed scan/sanitization; user sees raw upload blocked message. |  |  |
| Gemini / Chrome and Firefox, if available | Pending attach behavior | Streaming-range text fixture | Prompt/state stores sanitized file only; user action attaches sanitized file; cancel clears pending state; raw values absent from debug/UI. |  |  |
| Grok / Chrome and Firefox, if available | Pending attach behavior | Streaming-range text fixture | Same pending attach expectations as Gemini, with Grok-specific controls. |  |  |
| All available sites/browsers | Fallback text insertion behavior | Force sanitized file handoff rejection if possible, or use site path that naturally rejects file handoff | Sanitized text fallback inserts once, preserves readable safe context, and contains placeholders instead of raw secrets. |  |  |
| All available sites/browsers | Secure reveal after file attach | Attach supported text file, then reveal placeholders via extension UI | Reveal works only in extension-owned surface; raw values are not written into page DOM or composer. |  |  |
| All available sites/browsers | Final raw-secret sweep | Search visible composer, file preview, generated text, and downloadable sanitized copy for `LeakGuardPr4i*` raw values | No raw synthetic secret remains after redaction. File name should not contain raw secrets. Sanitized content contains placeholders only for secret values. |  |  |
| All available sites/browsers | DevTools Network check | All scenarios above | No LeakGuard backend, telemetry, remote model request, or cloud secret verification occurs. Extension-packaged asset loads are acceptable. |  |  |
| All available sites/browsers | Dev console debug check | Synthetic secrets only; enable dev debug only if needed | Debug payloads contain metadata, lengths, hashes, placeholders, adapter ids, and stage labels only; no raw file content, raw secret, full URL, or private path. |  |  |

## Stop Conditions

Stop the checkpoint and open a focused bug before continuing modularization if any of these occur:

- Raw secret reaches the composer after a failed rewrite.
- Raw file uploads after scan failure, sanitization failure, streaming failure, or sanitized handoff failure.
- Unsupported file is silently treated as protected or sanitized.
- Extension makes an unexpected backend, telemetry, remote model, or cloud secret verification request.
- Secure reveal exposes raw text to the page DOM or composer.
- Chrome and Firefox diverge on the same scenario without an understood site/browser capability reason.

## Result Template

```text
Date:
Tester:
Commit/build:
Chrome version:
Firefox version:
Sites tested:

Passed scenarios:
Failed scenarios:
Skipped/unavailable scenarios:
Network evidence:
Console/debug evidence:
Raw-secret sweep evidence:
Screenshots/log references:
Follow-up issues:
```
