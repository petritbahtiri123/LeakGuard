# LeakGuard E2E Testing

LeakGuard has a deterministic Playwright E2E layer for real Chromium extension behavior without using live chat accounts. The suite is organized as an adapter contract so new protected-site adapters can reuse the same browser-level expectations instead of adding one-off tests.

## How To Run

```powershell
npm run build:chrome
npm run test:e2e
```

Useful slices:

```powershell
npm run test:e2e:text
npm run test:e2e:files
npm run test:e2e:images
npm run test:e2e:headed
npm run test:e2e:debug
```

Manual live-site smoke tests, when present, are headed-only:

```powershell
npm run test:e2e:live
```

## Deterministic CI E2E

The CI-safe suite loads the unpacked Chrome build with Chromium's persistent-context extension pattern:

- `--disable-extensions-except=<temporary extension copy>`
- `--load-extension=<temporary extension copy>`
- MV3 service worker discovery to get the extension id
- local `http://127.0.0.1` fixture pages registered as a user-managed protected site

The helper copies `dist/chrome` to a temporary test directory and grants `http://127.0.0.1/*` only on that throwaway copy. Production manifests and permissions are not changed for the fixture.

The local protected-chat fixture models:

- textarea composer
- contenteditable composer
- ChatGPT-like textarea composer
- Gemini-like contenteditable composer
- WhatsApp-like nested contenteditable spans/text nodes
- React-like internal state mirrors
- async rerenders after input
- send button, Enter-to-send, and Shift+Enter multiline behavior
- paste and copy/paste text events
- clipboard image paste
- file input upload
- drag/drop upload
- sent-output and file-output capture

All secrets are fake `LGQA` markers. The tests must never use real secrets, account data, telemetry, external network calls, or production permissions added only for tests.

## Adapter Contract

The shared contract lives in `tests/e2e/helpers/adapterContract.mjs`. It runs the core scenarios for each adapter profile:

- normal text sends unchanged
- fake password redacts on first click
- fake password redacts on Enter
- trusted placeholders such as `[PWM_1]` and `[PWM_2]` stay unchanged
- Shift+Enter creates a newline and does not send
- empty composer does not create scary false failures
- unsupported file input/drop paths fail closed
- programmatic replay does not recurse or double-send
- single-click success is required; second-click retry is not accepted

The browser helper API lives in `tests/e2e/helpers/extensionFixture.mjs`:

- `launchExtensionContext()`
- `getExtensionId()`
- `openFixturePage()`
- `typeIntoComposer(page, text)`
- `pasteIntoComposer(page, text)`
- `copyPasteIntoComposer(page, text)`
- `clickSend(page)`
- `pressEnterToSend(page)`
- `pressShiftEnter(page)`
- `uploadFile(page, fileOrFiles)`
- `dragDropFile(page, fileOrFiles)`
- `pasteImageFromClipboard(page, file)`
- `getComposerText(page)`
- `getSentMessages(page)`
- `expectSentMessage(page, expected)`
- `expectComposerTextExactly(page, expected)`
- `expectNoRawSecretVisible(page, secret)`
- `expectNoDoubleSend(page, marker)`
- `expectBlocked(page)`
- `expectNoUnsafeOriginalFilename(page, unsafeName)`

Generated fake file fixtures live in `tests/e2e/helpers/e2eFileFixtures.mjs`. They cover TXT, ENV, JSON, LOG, MD, PDF, DOCX, XLSX, PNG, JPG, WEBP, malformed PDF, malformed image, unsupported binary, small multi-file sets up to 21 files, and a 6-large-file blocked set.

## Coverage Groups

The E2E suite covers these deterministic paths:

- text entry: typed normal text, click send, Enter send, placeholders, Shift+Enter, empty input, replay recursion, and no second-click retry
- paste/copy-paste: textarea and contenteditable paste, multiline secrets, API key and DB URL blocks, placeholder pass-through
- files: text formats, PDF, DOCX, XLSX, malformed PDF, unsupported files, unsafe filename summaries
- images: PNG/JPG/WEBP OCR redaction when available, fail-closed raw blocking when OCR/redaction is unavailable, clipboard image paste, drag/drop image, unsafe dimensions, and file-only output
- multi-file: 2-file, 5-file, 20-small-file, order preservation, mixed failure behavior, WhatsApp over-cap before-read block, generic large-batch block, metadata-only status
- adapter regression: ChatGPT-like and Gemini-like local DOM contracts plus local file/image handoff checks
- WhatsApp regression: nested contenteditable/state-mirror text, paste, clipboard image, attach, drag/drop, multi-file, and verification cases for current supported behavior

## Adding A New Adapter

Add deterministic coverage before enabling a new supported site:

1. Model the adapter locally under `tests/e2e/fixtures` when the current fixture does not already simulate its browser mechanics.
2. Add an adapter profile in `tests/e2e/helpers/adapterContract.mjs` or a focused adapter regression spec.
3. Reuse the shared helper functions instead of hard-coding selectors in each test.
4. Cover click-send, Enter-send, Shift+Enter, paste, file/image paths, fail-closed behavior, placeholder stability, and double-send prevention.
5. Add an expected-failing reproduction first when a known adapter bug exists. Do not weaken the contract just to make it green.
6. Keep real ChatGPT, Gemini, WhatsApp, Claude, Grok, OpenAI Chat, or X tests out of CI.
7. Run the E2E slice for the changed surface, then the full release gate.

Required checklist before a new adapter can be enabled:

- local fixture profile exists for its composer shape
- shared adapter contract passes
- raw fake secrets never reach sent output
- placeholders are stable and not re-redetected
- rewrite verification does not accept duplicated text
- file/image unsupported paths fail closed
- no second-click retry is required for success
- no new production permissions, telemetry, or external calls were added for tests

## Manual Live-Site E2E

Live ChatGPT, Gemini, WhatsApp, Claude, Grok, OpenAI Chat, or X checks remain manual smoke tests. They may require tester-owned accounts, bot checks, MFA, rate limits, private account state, or provider-specific UI state, so they are not required for CI.

Manual live-site checks should use only synthetic fixtures from this repository, keep prompt capture local to DevTools or local QA notes, and avoid screenshots or logs containing account data.

Real-account tests are useful for provider DOM compatibility, but deterministic CI E2E is the release gate for product safety behavior.

## Release Gate

Before release validation or adapter enablement, run:

```powershell
npm test
npm run build:chrome
npm run test:e2e
npm run docs:check-links
node tests/adapter_contracts.test.js
node tests/typed_interception.test.js
node tests/content_file_drop_interception.test.js
node tests/browser_qa_matrix.test.js
node tests/security.test.js
git diff --check
```

Failure artifacts are written under `artifacts/playwright-e2e-results` and the HTML report under `artifacts/playwright-e2e-report`.
