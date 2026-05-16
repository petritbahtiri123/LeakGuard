# LeakGuard File Handoff Architecture

LeakGuard protects supported local text-file uploads by blocking the raw ingress first, redacting locally, and handing only a sanitized in-memory `File` or `Blob` back to the site when a safe path exists.

## Direct Handoff

Direct handoff is the first choice for sites and browsers where assigning a sanitized `FileList` to a real `input[type="file"]` is already proven.

Flow:
1. Intercept paste, drop, or file-input selection before page handlers read the raw file.
2. Classify the file with local text-file rules.
3. Redact through the normal local redaction path.
4. Create a sanitized `File` or `Blob`.
5. Resolve a real site file input through the active site adapter.
6. Assign only the sanitized file and dispatch `input` and `change`.

LeakGuard never assigns the raw file and never calls `input.click()` or `input.showPicker()`.

## Pending Trusted Attach

Some sites or browsers hide the real file input until a trusted user upload action. For those paths, LeakGuard queues a pending sanitized file handoff.

Flow:
1. Direct safe handoff fails or the browser/site requires trusted activation.
2. LeakGuard stores the sanitized file in memory only.
3. A compact non-blocking pending attach prompt is shown.
4. The user clicks the site Upload/Attach flow or the LeakGuard "Attach sanitized file" action.
5. The adapter follows the safe upload flow without clicking unsafe controls.
6. When the real file input appears, LeakGuard assigns the sanitized file, dispatches `input` and `change`, and clears pending state.

The pending prompt is not a fullscreen overlay. Its container uses `pointer-events: none`; the card and buttons use `pointer-events: auto`.

## Streaming Files

Files above `LOCAL_TEXT_HARD_BLOCK_BYTES` use `streamRedactLocalTextFile` before handoff. If streaming succeeds, LeakGuard queues pending sanitized attach and does not read the sanitized file back into text unless the user explicitly chooses "Insert sanitized text instead".

Files above `LARGE_TEXT_STREAMING_MAX_BYTES` remain blocked.

## Duplicate Suppression

After assigning a sanitized file, LeakGuard marks:
- the file input in `sanitizedFileInputHandoffs`
- the sanitized file object in `sanitizedFileHandoffFiles`
- the sanitized metadata signature in `sanitizedFileHandoffSignatures`

The suppression TTL is 30 seconds. Matching redispatched `input` or `change` events are suppressed so sanitized files are not scanned or streamed again and duplicate file cards are not created.

## Site Adapters

`FILE_HANDOFF_ADAPTERS` defines supported site capabilities:
- `gemini`
- `grok`
- `chatgpt`
- `claude`
- `openai`
- `x`

Gemini and Grok enable pending trusted attach because those flows are covered by focused tests. ChatGPT, Claude, OpenAI Chat, and X have adapter definitions and diagnostics, while pending attach remains feature-gated until direct evidence shows a browser/site requires it.

## Compatibility Rules

Fallback order:
1. Proven direct file-input assignment.
2. Proven sanitized drop replay only where tested.
3. Pending trusted attach when enabled for the adapter.
4. Explicit sanitized text fallback.
5. Explicit sanitized download fallback.
6. Block raw upload if no safe path exists.

Unsupported binary, document, image, and archive behavior is unchanged. All processing stays local, and pending files are memory-only.
