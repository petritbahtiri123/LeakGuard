# Phase 14C Protected-Site PDF Redacted Output Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans before implementing this plan task-by-task. This document is a planning/spec phase only. Do not implement in this phase.

**Goal:** Plan protected-site PDF `.redacted.pdf` handoff after the scanner-only Phase 14B/14B-H work, without changing runtime behavior yet.

**Architecture:** Reuse the Phase 14B regenerated-PDF approach: extract text locally, redact with the existing file pipeline, then generate a brand-new simple PDF from sanitized text only. The implementation phase must not copy original PDF bytes, streams, metadata, forms, annotations, signatures, images, object streams, or page layout.

**Tech Stack:** Existing MV3 extension code, `src/shared/fileExtractors.js`, `src/shared/fileScanner.js`, `src/shared/pdfRedactor.js`, `src/content/files/contentFileExtractionPipeline.js`, current adapter handoff code, Node-based regression tests, browser QA.

---

## Status

- Current shipped behavior: scanner text PDFs can download `.redacted.txt` and regenerated `.redacted.pdf`.
- Current protected-site behavior: protected-site PDFs produce `.redacted.txt`.
- Phase 14C output: this plan/spec only.
- Do not implement in this phase.

## V1 Scope

In scope for a future implementation phase:

- protected-site PDF uploads only
- text PDFs only
- output `.redacted.pdf` when regenerated PDF is safe
- keep `.redacted.txt fallback`
- keep existing `.redacted.txt` fallback visible to recovery/download paths where the current policy already allows it
- encrypted, malformed, scanned/image-only, and empty PDFs fail closed or remain `.redacted.txt` according to current policy
- no layout preservation claim
- not layout-preserving
- original PDF streams are not copied

Out of scope:

- scanner behavior changes
- DOCX/XLSX rebuilds
- layout-preserving PDF redaction
- overlay-only redaction
- scanned PDF OCR
- remote calls, telemetry, cloud verification, or remote model calls
- new extension permissions
- detector rule changes
- Gemini/Firefox bridge behavior changes
- pending attach lifecycle changes

## Handoff Rules

Preferred future success path for protected-site text PDFs:

1. Intercept the raw PDF before the page consumes it.
2. Extract text locally using the existing PDF extractor.
3. Redact extracted text with the existing file scanner pipeline.
4. Generate a new `.redacted.pdf` from sanitized/redacted text only using `PdfRedactor`.
5. Hand generic adapters an in-memory `File` named `original.redacted.pdf` with MIME `application/pdf`.
6. Keep `.redacted.txt` fallback available where it is already sanitized and policy-safe.

Adapter boundaries:

- generic adapters receive application/pdf `.redacted.pdf` only after local extraction, redaction, and regenerated-PDF creation succeed
- Gemini/Grok pending attach gates unchanged
- Gemini/Grok should receive the same sanitized `File` object shape as other safe handoff paths, but only through the existing pending attach decision gates
- no new pending attach triggers, timers, UI overlays, trusted activation rules, or Firefox bridge branches
- adapter contract tests must continue to prove pending attach is enabled only where currently allowed

Failure rules:

- if regenerated PDF fails, do not upload raw PDF
- fallback to `.redacted.txt` only if it is already sanitized and policy-safe
- if both regenerated PDF and sanitized text fallback are unavailable, block raw upload with the existing fail-closed warning path
- no raw PDF upload after redaction attempt failure
- do not treat unsupported or unreadable PDFs as protected, sanitized, or safe

## Size And Truncation Decision

Phase 14B-H marks regenerated scanner PDFs as truncated when sanitized text exceeds the simple PDF generator bound.

Safest default for protected-site v1:

- prefer `.redacted.txt fallback` when regenerated PDF text would be truncated
- prefer .redacted.txt fallback as the implementation default for truncated regenerated PDF text
- do not hand off truncated `.redacted.pdf` to protected sites by default
- allow future opt-in only after separate review proves user-facing warning, report metadata, and browser/site handoff behavior are unambiguous

Reasoning:

- protected-site uploads are less inspectable than scanner downloads
- a truncated `.redacted.pdf` may omit sanitized context that the user expected to upload
- `.redacted.txt` is already the current sanitized protected-site output and preserves the full redacted extracted text
- preserving full sanitized content is safer than preserving the PDF extension for v1

Required warning if a future implementation falls back due to truncation:

- include a sanitized warning such as `pdf-redaction:pdf_redacted_text_truncated_fallback`
- do not include raw text, raw filename fragments that contained secrets, byte excerpts, or PDF stream content in warnings, reports, audit metadata, cache metadata, or debug snapshots

## Security Boundaries

The future implementation must preserve these boundaries:

- no original PDF streams are copied
- no original PDF object streams are copied
- no original PDF metadata is copied
- no overlay-only redaction
- no black rectangles over original PDF pages
- no raw secret text extractable from output PDF bytes
- no raw secret text recoverable by running the existing text extractor on output PDF bytes
- no raw extracted PDF text in `localStorage`, `sessionStorage`, `chrome.storage`, `browser.storage`, audit metadata, debug metadata, cache snapshots, reports, console logs, DOM status text, or adapter diagnostics
- JSON reports remain sanitized/redacted only
- protected-site `.redacted.pdf` generation must not add permissions or remote calls
- protected-site `.redacted.pdf` generation must not change detector rules, placeholder order, placeholder reuse, trusted-placeholder pass-through, or right-to-left replacement safety

## Implementation Plan For A Future Phase

### Task 1: Protected-Site PDF Result Contract

**Files:**
- Modify: `src/content/files/contentFileExtractionPipeline.js`
- Test: `tests/content_file_extraction_pipeline.test.js`

- [ ] Add a failing test where `contract.pdf` contains a fake API key and produces `contract.redacted.pdf` with `outputKind: "redacted_pdf_file"` and `sanitizedFile.type === "application/pdf"`.
- [ ] Keep the existing `.redacted.txt` fallback test and add a separate assertion that fallback text remains available in metadata or a recovery field without raw secrets.
- [ ] Implement only the result contract needed for text PDFs whose extraction and redaction succeeded and whose regenerated PDF is not truncated.
- [ ] Run `node tests/content_file_extraction_pipeline.test.js`.

### Task 2: Regenerated PDF Safety

**Files:**
- Modify: `src/content/files/contentFileExtractionPipeline.js`
- Test: `tests/content_file_extraction_pipeline.test.js`
- Test: `tests/pdf_redactor.test.js`

- [ ] Add a PDF fixture with a unique original stream marker and fake API key.
- [ ] Assert output PDF bytes do not include the raw key or original stream marker.
- [ ] Run `prepareFileExtractionAsync()` on the generated PDF and assert extracted text contains `[PWM_N]` and not the raw key.
- [ ] Assert output filename ends `.redacted.pdf` and MIME is `application/pdf`.
- [ ] Run `node tests/pdf_redactor.test.js` and `node tests/content_file_extraction_pipeline.test.js`.

### Task 3: Failure And Fallback Policy

**Files:**
- Modify: `src/content/files/contentFileExtractionPipeline.js`
- Test: `tests/content_file_extraction_pipeline.test.js`
- Test: `tests/browser/extension_qa_harness.test.mjs`

- [ ] Add encrypted, malformed, scanned/image-only, empty, and over-limit PDF cases.
- [ ] Assert these cases do not produce `.redacted.pdf`.
- [ ] Assert raw PDF upload is blocked after a redaction/regeneration attempt fails.
- [ ] Assert `.redacted.txt` fallback is used only when already sanitized and policy-safe.
- [ ] For sanitized text over the regenerated PDF bound, assert protected-site handoff prefers `.redacted.txt fallback` and records a sanitized truncation warning.

### Task 4: Adapter And Pending Attach Boundaries

**Files:**
- Test: `tests/adapter_contracts.test.js`
- Test: `tests/file_drop_streaming_guards.test.js`
- Test: `tests/typed_interception.test.js`
- Test: `tests/security.test.js`

- [ ] Assert Gemini/Grok pending attach gates unchanged.
- [ ] Assert generic adapters can receive an `application/pdf` sanitized `File` without new permissions or bridge behavior.
- [ ] Assert no new pending attach lifecycle states, timers, click interceptors, or Firefox bridge branches are introduced.
- [ ] Run `node tests/adapter_contracts.test.js`, `node tests/file_drop_streaming_guards.test.js`, and `node tests/typed_interception.test.js`.

### Task 5: Browser QA

**Files:**
- Modify: `tests/browser/extension_qa_harness.test.mjs`
- Modify only if necessary: `tests/browser/firefox_smoke.test.mjs`

- [ ] Upload a text PDF with a fake API key through a protected-site harness.
- [ ] Assert the attached/downloaded handoff file name ends `.redacted.pdf`.
- [ ] Assert MIME is `application/pdf`.
- [ ] Extract output PDF text and assert raw key is absent and placeholder text is present.
- [ ] Assert `.redacted.txt fallback` remains available in the safe fallback path.
- [ ] Repeat failure cases for scanned, encrypted, malformed, and empty PDFs and assert no raw upload occurs.

### Task 6: Release Safety And Docs

**Files:**
- Modify: `docs/FILE_CAPABILITY_MATRIX.md`
- Modify after implementation only: `README.md`, `docs/FILE_UPLOAD_SCANNING_GUIDE.md`, `docs/PRIVACY_POLICY.md`, `docs/CHROME_WEB_STORE_LISTING.md`, `docs/FIREFOX_AMO_CHECKLIST.md`, `docs/RELEASE_QA_CHECKLIST.md`
- Test: `tests/productization.test.js`
- Test: `tests/security.test.js`

- [ ] Before implementation, keep docs marked planned, not implemented.
- [ ] After implementation, update public docs only after browser QA passes.
- [ ] Assert public docs do not claim layout-preserving PDF redaction, scanned PDF OCR, DOCX/XLSX rebuilds, remote processing, or protected-site PDF rebuild support before the feature is actually shipped.
- [ ] Assert raw text never appears in reports, debug snapshots, audit metadata, logs, cache snapshots, or release copy.

## Required Test Plan

Future implementation must add or strengthen tests for:

- protected-site PDF with fake API key produces `.redacted.pdf`
- output MIME is `application/pdf`
- raw key not in generated PDF bytes
- raw key not recoverable through generated PDF text extraction
- generated PDF contains placeholder/redacted text
- original PDF stream marker absent
- `.redacted.txt fallback` remains available
- scanned PDFs do not upload raw
- encrypted PDFs do not upload raw
- malformed PDFs do not upload raw
- empty PDFs do not upload raw
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
- Phase 14B-H scanner hardening tests are passing
- protected-site pipeline owners agree on the fallback/truncation default
- browser QA can inspect the protected-site handoff file bytes and MIME
- release copy owners agree that public docs stay planned until implementation passes QA
