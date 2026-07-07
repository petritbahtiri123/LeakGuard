# Content Script Modularization Plan

This plan was created for the next content-script modularization release. It is a documentation and planning artifact only; it does not authorize runtime behavior changes by itself.

Current extraction progress is tracked in [content-script-modularization-inventory.md](content-script-modularization-inventory.md). As of the M8 Gemini file-handoff discovery slice, file, WhatsApp, composer, UI, and adapter handoff modules cover the largest event flows; Phase M8 final `content.js` shrink is implemented. Policy, audit, reveal, and status wiring remains in `content.js` intentionally as coordinator and fail-closed UI surface until a separate core-controller design is justified.

## Problem

`src/content/content.js` still carries too much orchestration pressure. WhatsApp support added text typing, multiline text, text paste, clipboard image paste, attach-button single-file handoff, attach-button multi-file handoff, drag/drop single-file handoff, drag/drop multi-file handoff, and verification flows. Future adapters will be riskier if `content.js` keeps growing.

The modularization work should reduce `content.js` safely and quickly by extracting modules without changing behavior. Each extraction must be test-gated and small enough to review independently.

## Target Architecture

### `src/content/core/`

- `protectedSiteRouter.js`: routes protected-site events to the active adapter and shared flows.
- `adapterResolver.js`: resolves adapter contracts and capability objects for the current host.
- `eventOwnership.js`: centralizes event claiming, propagation control, and raw-ingress ownership decisions.
- `failClosedUi.js`: owns protected-site fail-closed user messages.
- `telemetryFreeDebugState.js`: owns metadata-only debug state if current debug ownership needs a content-core home.

### `src/content/composer/`

- `composerTextReader.js`: reads textarea/contenteditable text through existing helper behavior.
- `composerTextWriter.js`: writes sanitized text through existing helper behavior.
- `contentEditableRewrite.js`: isolates contenteditable-specific rewrite mechanics.
- `editorActionRewrite.js`: owns editor action replay and synthetic event sequencing.
- `multilineTextSync.js`: normalizes multiline sync behavior across supported editors.
- `replayVerification.js`: verifies rewritten composer state before replay or send.

### `src/content/files/`

- `fileTypeSupport.js`: answers protected-site and adapter-specific file support questions using `FileTypeRegistry`.
- `fileInputInterception.js`: owns file input selection interception.
- `fileDropInterception.js`: owns drag/drop interception.
- `clipboardFileInterception.js`: owns clipboard file/image interception boundaries.
- `sanitizedFileBatchProcessor.js`: coordinates single and multi-file local sanitization using existing scanner/redactor pipelines.
- `sanitizedFileHandoff.js`: performs sanitized `File`/`DataTransfer` handoff through existing site paths.
- `fileHandoffVerification.js`: verifies exact object identity, file count, order, and fail-closed outcomes.
- `failClosedFileReasons.js`: centralizes metadata-only fail-closed reason codes.

### `src/content/whatsapp/`

- `whatsappAdapter.js`: keep the existing adapter if safer, but split helpers out of `content.js`.
- `whatsappTextFlow.js`: owns WhatsApp typed, pasted, multiline, and send replay flow.
- `whatsappClipboardImagePaste.js`: owns clipboard image paste for PNG/JPG/JPEG/WEBP.
- `whatsappAttachHandoff.js`: owns WhatsApp attach-button single-file handoff.
- `whatsappDropHandoff.js`: owns WhatsApp drag/drop single-file handoff.
- `whatsappMultiFileHandoff.js`: owns WhatsApp in-cap file batch handoff and over-cap before-read blocks.
- `whatsappVerification.js`: owns WhatsApp-specific composer and handoff verification.
- `whatsappCapabilities.js`: declares WhatsApp capabilities and unsupported paths.
- `whatsappSelectors.js`: owns WhatsApp selectors and DOM probes.
- `whatsappQaDiagnostics.js`: emits metadata-only QA diagnostics for WhatsApp flows if needed.

### `src/content/adapters/`

- shared adapter capability contracts
- ChatGPT/Gemini/Grok/Claude/OpenAI/X adapter-specific selectors and handoff only
- adapter-specific modules should declare capabilities and selectors, not shared file or composer flow behavior

## Strict Modularization Rules

1. No behavior change per extraction step.
2. One module extraction per PR or task when possible.
3. Tests must be green after every extraction.
4. `content.js` should become orchestration-only.
5. Adapter-specific logic must not leak into shared flows.
6. Shared helpers must not become WhatsApp-only hacks.
7. No new permissions.
8. No telemetry or backend changes.
9. No manifest or CSP changes unless separately justified.
10. Fail-closed behavior must remain identical.

## Phases

### Phase M0 - Baseline Inventory

Measure the current `content.js` size and map major function clusters.

Map current event flows:

- text typing
- text paste
- clipboard image paste
- file input attach
- drag/drop
- multi-file
- replay/send
- failure UI

Produce a function-to-module mapping. Do not change code behavior.

Acceptance:

- baseline line/function inventory recorded
- current event-flow map recorded
- focused tests identified for each cluster
- no runtime behavior changes

Suggested Codex prompt:

```text
Create a baseline inventory for LeakGuard content-script modularization. Read docs/CODEX_FAST_CONTEXT.md, docs/REPO_MAP.md, src/content/content.js, and directly relevant tests only. Produce a function-to-module mapping for docs/roadmap/content-script-modularization-plan.md without changing runtime behavior.
```

### Phase M1 - Extract Pure File Classification And Capability Helpers

Move WhatsApp/file support decisions out of `content.js`. Reuse `FileTypeRegistry` and existing adapter capability shapes.

Acceptance:

- no behavior change
- file support decisions still match current tests
- full focused file tests green

Suggested Codex prompt:

```text
Extract pure file support and capability helpers for LeakGuard content scripts. Preserve current behavior exactly, reuse FileTypeRegistry, keep WhatsApp-specific limits separate from shared policy, and run focused file/QA matrix tests before broader validation.
```

### Phase M2 - Extract Sanitized File Processing Orchestration

Move single-file and multi-file sanitized processing orchestration into `src/content/files/sanitizedFileBatchProcessor.js`. Keep existing pipeline calls unchanged.

Acceptance:

- all file/image/PDF/DOCX/XLSX E2E paths remain green
- unsupported and failing batches still block all-or-nothing
- no extracted-text fallback into WhatsApp

Suggested Codex prompt:

```text
Extract sanitized file batch orchestration from content.js into src/content/files/sanitizedFileBatchProcessor.js with no behavior changes. Keep existing scanner/redactor calls and fail-closed ordering unchanged. Run file, image, PDF, DOCX, XLSX, and WhatsApp multi-file validation.
```

### Phase M3 - Extract Handoff Verification

Move exact object identity, count, order, and fail-closed verification into `src/content/files/fileHandoffVerification.js`.

Acceptance:

- attach/drop tests remain green
- exact sanitized object verification remains strict
- count and order checks remain deterministic

Suggested Codex prompt:

```text
Extract sanitized file handoff verification into src/content/files/fileHandoffVerification.js. Preserve exact object identity, count, order, and fail-closed semantics. Run attach/drop and browser QA matrix tests.
```

### Phase M4 - Extract Drag/Drop And Input Interception

Move file input and drag/drop ownership/interception into dedicated modules.

Acceptance:

- no raw preview before sanitization
- no raw fallback after LeakGuard consumes an event
- attach and drag/drop E2E remain green

Suggested Codex prompt:

```text
Extract file input and drag/drop interception from content.js into focused files modules. Preserve event ownership, raw-ingress blocking, sanitized handoff, and fail-closed behavior. Do not change manifests, CSP, or permissions.
```

### Phase M5 - Extract WhatsApp-Specific Flows

Move WhatsApp text, attach, drag/drop, paste, and verification to `src/content/whatsapp/`. `content.js` should call high-level WhatsApp functions only.

Acceptance:

- WhatsApp E2E remains green
- live QA checklist behavior is unchanged
- WhatsApp in-cap file batches succeed only as sanitized ordered handoff
- WhatsApp over-cap file batches block before read

Suggested Codex prompt:

```text
Extract WhatsApp-specific text, clipboard image paste, attach, drag/drop, multi-file, selector, capability, and verification helpers into src/content/whatsapp/. Keep content.js as orchestration only and preserve current WhatsApp support matrix exactly.
```

### Phase M6 - Extract Composer Rewrite/Replay Modules

Move contenteditable/editor-action rewrite and replay verification into composer modules.

Acceptance:

- text, multiline, Enter, and click tests pass across adapters
- no second-click success regression
- rewrite verification remains fail closed

Suggested Codex prompt:

```text
Extract composer read/write, contenteditable rewrite, editor-action replay, multiline sync, and replay verification helpers into src/content/composer/. Preserve current adapter behavior and fail-closed rewrite verification.
```

### Phase M7 - Contract Cleanup

Make adapter capability objects explicit and documented. Add tests that block accidental broad capability enabling.

Acceptance:

- adapter contract tests green
- WhatsApp capabilities are explicit and narrow
- shared helpers do not infer unsupported capabilities from generic adapter shape

Suggested Codex prompt:

```text
Make LeakGuard content adapter capability contracts explicit and test-gated. Add or update tests that prevent accidental broad file, paste, drag/drop, or pending-attach enabling, especially for WhatsApp.
```

### Phase M8 - Final `content.js` Shrink

Status: complete. Multi-file protected upload, single-file local insert routing, file input/drop routing, text/paste/send orchestration, Gemini upload-menu discovery, and Gemini file-handoff discovery now live in focused modules. Policy, audit, reveal, and status wiring remains in `content.js` by design as cross-cutting coordinator and fail-closed UI surface; moving it should be a separate core-controller design task, not part of this shrink pass.

`content.js` should only:

- initialize
- resolve adapter
- route events
- call modules
- display result or fail-closed UI

Acceptance:

- `content.js` no longer contains large adapter-specific branches
- current source order and runtime script order remain aligned
- focused content, adapter, file, browser QA, and security tests pass

Suggested Codex prompt:

```text
Finish shrinking src/content/content.js after prior modularization phases. Leave content.js as initialization, adapter resolution, event routing, module calls, and fail-closed UI only. Do not change runtime behavior.
```

## Release Acceptance Criteria

Before claiming the modularization is complete, run:

```powershell
npm run build:chrome
npm run test:e2e
npm run test:e2e:files
npm run test:e2e:images
npm run test:e2e:text
npm test
npm run docs:check-links
node tests/file_paste_helpers.test.js
node tests/content_file_drop_interception.test.js
node tests/typed_interception.test.js
node tests/browser_qa_matrix.test.js
node tests/security.test.js
node tests/adapter_contracts.test.js
node tests/content_file_extraction_pipeline.test.js
node tests/xlsx_redactor.test.js
git diff --check
```

Additional release gates:

- no new runtime behavior unless explicitly planned
- no raw fallback regressions
- no UI obstruction regressions
- no second-click success regressions
- no file preview-before-sanitization regressions
- WhatsApp live QA still passes
- no manifest, CSP, permission, telemetry, backend, or remote-processing changes unless separately reviewed
