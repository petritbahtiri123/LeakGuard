# Phase 15C Protected-Site DOCX Redacted Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans before implementing this plan task-by-task. This document is a planning/spec phase only. Do not implement in this phase.

**Goal:** Plan protected-site DOCX `.redacted.docx` handoff after Phase 15B-H scanner-only hardening, without changing runtime behavior yet.

**Architecture:** Reuse the Phase 15B regenerated-DOCX approach: extract DOCX text locally, redact with the existing protected-site file pipeline, then generate a brand-new minimal DOCX from sanitized text only. The future implementation must not copy original DOCX XML parts, relationships, media, styles, comments, properties, metadata, macros, or layout.

**Tech Stack:** Existing MV3 extension code, `src/shared/fileExtractors.js`, `src/shared/fileScanner.js`, `src/shared/docxRedactor.js`, `src/content/files/contentFileExtractionPipeline.js`, current adapter handoff code, Node-based regression tests, browser QA.

---

## Status

- Current shipped scanner behavior: scanner DOCX files can download `.redacted.txt` and regenerated `.redacted.docx`.
- Current protected-site behavior: protected-site DOCX uploads produce `.redacted.txt`.
- Phase 15C output: this plan/spec only.
- Do not implement in this phase.

## V1 Scope

In scope for a future implementation phase:

- protected-site DOCX uploads only
- `.docx` only
- output `.redacted.docx` when extraction, redaction, source-envelope validation, and regeneration all succeed
- keep `.redacted.txt fallback`
- keep existing `.redacted.txt` fallback visible to recovery/download paths where the current policy already allows it
- malformed, encrypted, no-text/image-only, unsupported-compression, over-limit, and unsafe DOCX files fail closed or remain `.redacted.txt` according to current policy
- `.doc`, `.docm`, macros, and embedded images unsupported
- no layout preservation claim
- not layout-preserving
- no original DOCX XML parts copied
- no original styles, images, comments, metadata, custom XML, headers, footers, footnotes, endnotes, relationships, or media copied

Out of scope:

- scanner behavior changes
- XLSX rebuilds
- layout-preserving DOCX redaction
- original OOXML part rewriting
- overlay-only DOCX redaction
- embedded image OCR or visual DOCX redaction
- `.doc`, `.docm`, macro, or legacy Office support
- remote calls, telemetry, cloud verification, or remote model calls
- new extension permissions
- detector rule changes
- Gemini/Firefox bridge behavior changes
- pending attach lifecycle changes

## Handoff Rules

Preferred future success path for protected-site DOCX:

1. Intercept the raw DOCX before the page consumes it.
2. Extract text locally using the existing DOCX extractor.
3. Redact extracted text with the existing protected-site file scanner pipeline.
4. Generate a new `.redacted.docx` from sanitized/redacted text only using `DocxRedactor`.
5. Hand generic adapters an in-memory `File` named `original.redacted.docx` with MIME `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
6. Keep `.redacted.txt` fallback available where it is already sanitized and policy-safe.

Adapter boundaries:

- generic adapters receive a DOCX MIME `.redacted.docx` only after local extraction, redaction, source validation, and regenerated-DOCX creation succeed
- Gemini/Grok pending attach gates unchanged
- Gemini/Grok should receive the same sanitized `File` object shape as other safe handoff paths, but only through the existing pending attach decision gates
- no new pending attach triggers, timers, UI overlays, trusted activation rules, or Firefox bridge branches
- adapter contract tests must continue to prove pending attach is enabled only where currently allowed

Failure rules:

- if regenerated DOCX fails, do not upload raw DOCX
- fallback to `.redacted.txt` only if it is already sanitized and policy-safe
- if both regenerated DOCX and sanitized text fallback are unavailable, block raw upload with the existing fail-closed warning path
- no raw DOCX upload after redaction or regeneration failure
- do not treat unsupported or unreadable DOCX files as protected, sanitized, or safe

## Size And Truncation Decision

Phase 15B-H marks regenerated scanner DOCX output as truncated when sanitized text exceeds the simple DOCX generator bound.

Safest default for protected-site v1:

- prefer `.redacted.txt fallback` when regenerated DOCX text would be bounded or truncated
- do not hand off truncated `.redacted.docx` to protected sites by default
- do not silently upload incomplete `.redacted.docx`
- allow future opt-in only after separate review proves user-facing warning, report metadata, and browser/site handoff behavior are unambiguous

Reasoning:

- protected-site uploads are less inspectable than scanner downloads
- a truncated `.redacted.docx` may omit sanitized context that the user expected to upload
- `.redacted.txt` is already the current sanitized protected-site output and preserves the full redacted extracted text
- preserving full sanitized content is safer than preserving the DOCX extension for v1

Required warning if a future implementation falls back due to truncation:

- include a sanitized warning such as `docx-redaction:docx_redacted_text_truncated_fallback`
- do not include raw text, raw filename fragments that contained secrets, byte excerpts, XML snippets, relationship targets, metadata values, or DOCX part content in warnings, reports, audit metadata, cache metadata, or debug snapshots

## Security Boundaries

The future implementation must preserve these boundaries:

- no original `word/document.xml` is copied
- no original headers, footers, footnotes, endnotes, comments, styles, numbering, settings, relationship files, document properties, custom XML, media, embedded objects, charts, or metadata are copied
- no original ZIP entries are copied into the generated output
- no overlay-only redaction
- no comment, highlight, or visual marker redaction that leaves raw text in OOXML bytes
- no raw secret text extractable from output DOCX bytes
- no raw secret text recoverable by running the existing DOCX extractor on output DOCX bytes
- no raw extracted DOCX text in `localStorage`, `sessionStorage`, `chrome.storage`, `browser.storage`, audit metadata, debug metadata, cache snapshots, reports, console logs, DOM status text, or adapter diagnostics
- JSON reports remain sanitized/redacted only
- protected-site `.redacted.docx` generation must not add permissions or remote calls
- protected-site `.redacted.docx` generation must not change detector rules, placeholder order, placeholder reuse, trusted-placeholder pass-through, or right-to-left replacement safety

## Implementation Plan For A Future Phase

### Task 1: Protected-Site DOCX Result Contract

**Files:**
- Modify: `src/content/files/contentFileExtractionPipeline.js`
- Test: `tests/content_file_extraction_pipeline.test.js`

- [ ] Add a failing test where `brief.docx` contains a fake API key and produces `brief.redacted.docx` with `outputKind: "redacted_docx_file"` and `sanitizedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"`.
- [ ] Keep the existing protected-site DOCX `.redacted.txt` test and split it into the fallback path so the old behavior remains available when regeneration is unsafe.
- [ ] Implement only the result contract needed for DOCX files whose extraction, redaction, source validation, and regeneration succeeded and whose regenerated DOCX is not truncated.
- [ ] Run `node tests/content_file_extraction_pipeline.test.js`.

### Task 2: Regenerated DOCX Safety

**Files:**
- Modify: `src/content/files/contentFileExtractionPipeline.js`
- Test: `tests/content_file_extraction_pipeline.test.js`
- Test: `tests/docx_redactor.test.js`

- [ ] Add a DOCX fixture with a unique original XML marker, fake API key, header/footer/comment/style/property/custom XML/media markers, and sanitized output text.
- [ ] Assert output DOCX bytes do not include the raw key or original XML marker.
- [ ] Assert output DOCX bytes do not include original `word/header`, `word/footer`, `word/comments`, `word/styles`, `docProps`, `customXml`, or `word/media` part names.
- [ ] Run `prepareFileExtractionAsync()` on the generated DOCX and assert extracted text contains `[PWM_N]` and not the raw key.
- [ ] Assert output filename ends `.redacted.docx` and MIME is `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- [ ] Run `node tests/docx_redactor.test.js` and `node tests/content_file_extraction_pipeline.test.js`.

### Task 3: Failure And Fallback Policy

**Files:**
- Modify: `src/content/files/contentFileExtractionPipeline.js`
- Test: `tests/content_file_extraction_pipeline.test.js`
- Test: `tests/browser/extension_qa_harness.test.mjs`

- [ ] Add malformed, encrypted, no-text/image-only, unsupported-compression, `.doc`, and `.docm` cases.
- [ ] Assert these cases do not produce `.redacted.docx`.
- [ ] Assert raw DOCX upload is blocked after a redaction or regeneration attempt fails.
- [ ] Assert `.redacted.txt` fallback is used only when already sanitized and policy-safe.
- [ ] For sanitized text over the regenerated DOCX bound, assert protected-site handoff prefers `.redacted.txt fallback` and records `docx-redaction:docx_redacted_text_truncated_fallback`.

### Task 4: Adapter And Pending Attach Boundaries

**Files:**
- Test: `tests/adapter_contracts.test.js`
- Test: `tests/file_drop_streaming_guards.test.js`
- Test: `tests/typed_interception.test.js`
- Test: `tests/security.test.js`

- [ ] Assert Gemini/Grok pending attach gates unchanged.
- [ ] Assert generic adapters can receive a DOCX MIME sanitized `File` without new permissions or bridge behavior.
- [ ] Assert no new pending attach lifecycle states, timers, click interceptors, trusted activation rules, or Firefox bridge branches are introduced.
- [ ] Assert protected-site DOCX generation is only referenced from `src/content/files/contentFileExtractionPipeline.js` and not from adapter-specific bridge code.
- [ ] Run `node tests/adapter_contracts.test.js`, `node tests/file_drop_streaming_guards.test.js`, `node tests/typed_interception.test.js`, and `node tests/security.test.js`.

### Task 5: Browser QA

**Files:**
- Modify: `tests/browser/extension_qa_harness.test.mjs`
- Modify only if necessary: `tests/browser/chrome_smoke.test.mjs`
- Modify only if necessary: `tests/browser/firefox_smoke.test.mjs`

- [ ] Upload a DOCX with a fake API key through a protected-site harness.
- [ ] Assert the attached/downloaded handoff file name ends `.redacted.docx`.
- [ ] Assert MIME is `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- [ ] Extract output DOCX text and assert raw key is absent and placeholder text is present.
- [ ] Assert original XML marker and original source part names are absent from output bytes.
- [ ] Assert `.redacted.txt fallback` remains available in the safe fallback path.
- [ ] Repeat failure cases for malformed, no-text/image-only, `.doc`, and `.docm` files and assert no raw upload occurs.

### Task 6: Release Safety And Docs

**Files:**
- Modify: `docs/FILE_CAPABILITY_MATRIX.md`
- Modify after implementation only: `README.md`, `docs/FILE_UPLOAD_SCANNING_GUIDE.md`, `docs/PRIVACY_POLICY.md`, `docs/CHROME_WEB_STORE_LISTING.md`, `docs/FIREFOX_AMO_CHECKLIST.md`, `docs/RELEASE_QA_CHECKLIST.md`
- Test: `tests/productization.test.js`
- Test: `tests/security.test.js`

- [ ] Before implementation, keep public docs marked planned, not implemented.
- [ ] After implementation, update public docs only after focused tests and browser QA pass.
- [ ] Assert public docs do not claim layout-preserving DOCX redaction, protected-site DOCX rebuild support, XLSX rebuilds, remote processing, or macro support before the feature is actually shipped.
- [ ] Assert raw DOCX text never appears in reports, debug snapshots, audit metadata, logs, cache snapshots, warnings, or release copy.

## Required Test Plan

Future implementation must add or strengthen tests for:

- protected-site DOCX with fake API key produces `.redacted.docx`
- output MIME is `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- raw key not in generated DOCX bytes
- raw key not recoverable through generated DOCX text extraction
- generated DOCX contains placeholder/redacted text
- original DOCX XML marker absent
- original header/footer/comment/style/property/custom XML/media part names absent
- `.redacted.txt fallback` remains available
- `.doc` does not upload raw
- `.docm` does not upload raw
- malformed DOCX does not upload raw
- encrypted DOCX does not upload raw
- no-text/image-only DOCX does not upload raw
- large/truncated regenerated output uses the safest default: prefer `.redacted.txt fallback`
- Gemini/Grok pending attach unchanged
- adapter contract tests pass
- no raw text in logs/storage/debug/audit/cache/report metadata
- JSON reports sanitized/redacted only
- no new permissions
- no remote calls

## Readiness Gate

Do not start implementation until these are true:

- this plan is reviewed
- Phase 15B-H scanner DOCX hardening tests are passing
- protected-site pipeline owners agree on the fallback/truncation default
- browser QA can inspect the protected-site handoff file bytes and MIME
- release copy owners agree that public docs stay planned until implementation passes QA
