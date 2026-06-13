# Phase 16C Protected-Site XLSX Redacted Output Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans before implementing this plan task-by-task. This document is a planning/spec phase only. Do not implement in this phase.

**Goal:** Plan protected-site XLSX `.redacted.xlsx` handoff after Phase 16B-H scanner-only hardening, without changing runtime behavior yet.

> **Implementation note:** Phase 16D completed protected-site XLSX `.redacted.xlsx` handoff. Phase 16E closeout is tracked in `docs/phase-16e-xlsx-rebuilt-output-closeout.md`, which supersedes this document's planning-only status and current-behavior notes.

**Architecture:** Reuse the Phase 16B-H regenerated-XLSX approach: extract XLSX text locally, redact with the existing protected-site file pipeline, then generate a brand-new minimal XLSX from sanitized text only. The future implementation must not copy original XLSX XML parts, relationships, media, styles, comments, properties, metadata, custom XML, calc chains, macros, formulas, charts, hidden sheets, or layout.

**Tech Stack:** Existing MV3 extension code, `src/shared/fileExtractors.js`, `src/shared/fileScanner.js`, `src/shared/xlsxRedactor.js`, `src/content/files/contentFileExtractionPipeline.js`, current adapter handoff code, Node-based regression tests, browser QA.

---

## Status

- Current scanner behavior: scanner XLSX files can download `.redacted.txt` and regenerated `.redacted.xlsx` when sanitized extraction and regeneration succeed.
- Current protected-site behavior: protected-site XLSX uploads produce `.redacted.txt`.
- Phase 16C output: this plan/spec only.
- Do not implement in this phase.

## V1 Scope

In scope for a future implementation phase:

- protected-site `.xlsx` uploads only
- output `.redacted.xlsx` when extraction, redaction, source validation, and regeneration all succeed
- keep `.redacted.txt` fallback
- generic adapter handoff of a sanitized in-memory `.redacted.xlsx` file after success
- fail closed or use already sanitized `.redacted.txt` fallback when regeneration is unsafe
- preserve current scanner `.redacted.xlsx` support
- keep current protected-site XLSX `.redacted.txt` behavior until implementation is explicitly started

Out of scope:

- `.xls`, `.xlsm`, `.xlsb`, `.xltm`, legacy spreadsheets, macro-enabled spreadsheets, and macros
- layout-preserving XLSX redaction
- original OOXML spreadsheet part rewriting
- copying original XLSX XML parts
- formula preservation or execution
- chart, style, comment, hidden-sheet, metadata, custom XML, calc-chain, relationship, media, or embedded object preservation
- scanner behavior changes
- detector rule changes
- Gemini bridge behavior changes
- Firefox bridge behavior changes
- pending attach lifecycle changes
- new extension permissions
- remote calls, telemetry, cloud verification, remote model calls, backend processing, or remote secret processing

## Handoff Rules

Preferred future success path for protected-site XLSX:

1. Intercept the raw XLSX before the page consumes it.
2. Extract workbook/shared-string/worksheet text locally with the existing XLSX extractor.
3. Redact extracted text with the existing protected-site file scanner pipeline.
4. Validate that the source result is eligible for regenerated XLSX output.
5. Generate a brand-new `.redacted.xlsx` from sanitized/redacted text only using `XlsxRedactor`.
6. Hand generic adapters an in-memory `File` named `original.redacted.xlsx` with MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
7. Keep `.redacted.txt` fallback available only where it is already sanitized and policy-safe.

Adapter boundaries:

- generic adapters receive an XLSX MIME `.redacted.xlsx` only after local extraction, redaction, source validation, and regenerated-XLSX creation succeed
- Gemini/Grok pending attach gates unchanged
- Gemini/Grok should receive the same sanitized `File` object shape as other safe handoff paths, but only through the existing pending attach decision gates
- no new pending attach triggers, timers, UI overlays, trusted activation rules, or Firefox bridge branches
- adapter contract tests must continue to prove pending attach is enabled only where currently allowed

Failure rules:

- if regenerated XLSX fails, do not upload raw XLSX
- fallback to `.redacted.txt` only if it is already sanitized and policy-safe
- if both regenerated XLSX and sanitized text fallback are unavailable, block raw upload with the existing fail-closed warning path
- no raw XLSX upload after redaction or regeneration failure
- do not treat unsupported, malformed, encrypted, no-text, legacy, or macro spreadsheets as protected, sanitized, or safe

## Size And Truncation Decision

Protected-site v1 should prefer `.redacted.txt` fallback when regenerated XLSX output would be bounded or truncated.

Rules:

- do not hand off truncated `.redacted.xlsx` to protected sites by default
- do not silently upload incomplete `.redacted.xlsx`
- do not use the `.xlsx` extension as a reason to discard sanitized text that can still be safely handed off as `.redacted.txt`
- if sanitized text fallback is unavailable or policy-unsafe, block raw upload rather than uploading raw XLSX
- allow future opt-in only after separate review proves user-facing warning, report metadata, and browser/site handoff behavior are unambiguous

Reasoning:

- protected-site uploads are less inspectable than scanner downloads
- a truncated `.redacted.xlsx` may omit sanitized context that the user expected to upload
- `.redacted.txt` is already the current sanitized protected-site XLSX output and can carry the full redacted extracted text
- preserving full sanitized content is safer than preserving the XLSX extension for v1

Required warning if a future implementation falls back due to truncation:

- include a sanitized warning such as `xlsx-redaction:xlsx_redacted_text_truncated_fallback`
- do not include raw text, raw filename fragments that contained secrets, cell excerpts, worksheet XML, shared-string XML, relationship targets, metadata values, custom XML values, media names, comments, calc-chain values, or workbook part content in warnings, reports, audit metadata, cache metadata, or debug snapshots

## Security Boundaries

The future implementation must preserve these boundaries:

- no original `xl/sharedStrings.xml` is copied
- no original `xl/worksheets/sheet*.xml` is copied
- no original workbook, comments, styles, theme, relationship files, document properties, custom XML, media, embedded objects, charts, drawings, printer settings, external links, calc chains, or metadata are copied
- no original ZIP entries are copied into the generated output
- no formula preservation, formula execution, cached formula value preservation, hidden-sheet preservation, or cell-format preservation
- no overlay-only, style-only, comment-only, hidden-cell, hidden-sheet, or visual-marker redaction that leaves raw text in OOXML bytes
- no raw secret text extractable from output XLSX bytes
- no raw secret text recoverable by running the existing XLSX extractor on output XLSX bytes
- no raw extracted XLSX text in `localStorage`, `sessionStorage`, `chrome.storage`, `browser.storage`, audit metadata, debug metadata, cache snapshots, reports, console logs, DOM status text, or adapter diagnostics
- JSON reports remain sanitized/redacted only
- protected-site `.redacted.xlsx` generation must not add permissions or remote calls
- protected-site `.redacted.xlsx` generation must not change detector rules, placeholder order, placeholder reuse, trusted-placeholder pass-through, or right-to-left replacement safety

## Implementation Plan For A Future Phase

### Task 1: Protected-Site XLSX Result Contract

**Files:**
- Modify: `src/content/files/contentFileExtractionPipeline.js`
- Test: `tests/content_file_extraction_pipeline.test.js`

- [ ] Add a failing test where `sheet.xlsx` contains a fake API key and produces `sheet.redacted.xlsx` with `outputKind: "redacted_xlsx_file"` and `sanitizedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"`.
- [ ] Keep the existing protected-site XLSX `.redacted.txt` test and split it into the fallback path so the old behavior remains available when regeneration is unsafe.
- [ ] Implement only the result contract needed for `.xlsx` files whose extraction, redaction, source validation, and regeneration succeeded and whose regenerated XLSX is not truncated.
- [ ] Run `node tests/content_file_extraction_pipeline.test.js`.

### Task 2: Regenerated XLSX Safety

**Files:**
- Modify: `src/content/files/contentFileExtractionPipeline.js`
- Test: `tests/content_file_extraction_pipeline.test.js`
- Test: `tests/xlsx_redactor.test.js`

- [ ] Add or reuse an XLSX fixture with a unique original XML marker, fake API key, shared-string marker, worksheet marker, comment marker, docProps marker, custom XML marker, media marker, and calc-chain marker.
- [ ] Assert output XLSX bytes do not include the raw key or original XML marker.
- [ ] Assert output XLSX bytes do not include original `xl/sharedStrings.xml`, `xl/worksheets/sheet`, `xl/comments`, `docProps`, `customXml`, `xl/media`, `xl/calcChain.xml`, `xl/charts`, or original relationship part markers.
- [ ] Run `prepareFileExtractionAsync()` on the generated XLSX and assert extracted text contains `[PWM_N]` and not the raw key.
- [ ] Assert output filename ends `.redacted.xlsx` and MIME is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- [ ] Run `node tests/xlsx_redactor.test.js` and `node tests/content_file_extraction_pipeline.test.js`.

### Task 3: Failure And Fallback Policy

**Files:**
- Modify: `src/content/files/contentFileExtractionPipeline.js`
- Test: `tests/content_file_extraction_pipeline.test.js`
- Test: `tests/browser/extension_qa_harness.test.mjs`

- [ ] Add malformed, encrypted, no-text/image-only, unsupported-compression, `.xls`, and `.xlsm` cases.
- [ ] Assert these cases do not produce `.redacted.xlsx`.
- [ ] Assert raw XLSX upload is blocked after a redaction or regeneration attempt fails.
- [ ] Assert `.redacted.txt` fallback is used only when already sanitized and policy-safe.
- [ ] For sanitized text over the regenerated XLSX bound, assert protected-site handoff prefers `.redacted.txt` fallback and records `xlsx-redaction:xlsx_redacted_text_truncated_fallback`.

### Task 4: Adapter And Pending Attach Boundaries

**Files:**
- Test: `tests/adapter_contracts.test.js`
- Test: `tests/file_drop_streaming_guards.test.js`
- Test: `tests/typed_interception.test.js`
- Test: `tests/security.test.js`

- [ ] Assert Gemini/Grok pending attach gates unchanged.
- [ ] Assert generic adapters can receive an XLSX MIME sanitized `File` without new permissions or bridge behavior.
- [ ] Assert no new pending attach lifecycle states, timers, click interceptors, trusted activation rules, or Firefox bridge branches are introduced.
- [ ] Assert protected-site XLSX generation is only referenced from `src/content/files/contentFileExtractionPipeline.js` and not from adapter-specific bridge code.
- [ ] Run `node tests/adapter_contracts.test.js`, `node tests/file_drop_streaming_guards.test.js`, `node tests/typed_interception.test.js`, and `node tests/security.test.js`.

### Task 5: Browser QA

**Files:**
- Modify: `tests/browser/extension_qa_harness.test.mjs`
- Modify only if necessary: `tests/browser/chrome_smoke.test.mjs`
- Modify only if necessary: `tests/browser/firefox_smoke.test.mjs`

- [ ] Upload an XLSX with a fake API key through a protected-site harness.
- [ ] Assert the attached/downloaded handoff file name ends `.redacted.xlsx`.
- [ ] Assert MIME is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- [ ] Extract output XLSX text and assert raw key is absent and placeholder text is present.
- [ ] Assert original XML marker and original source part names are absent from output bytes.
- [ ] Assert `.redacted.txt` fallback remains available in the safe fallback path.
- [ ] Repeat failure cases for malformed, no-text/image-only, `.xls`, and `.xlsm` files and assert no raw upload occurs.

### Task 6: Release Safety And Docs

**Files:**
- Modify before implementation: `docs/FILE_CAPABILITY_MATRIX.md`
- Modify after implementation only: `README.md`, `docs/FILE_UPLOAD_SCANNING_GUIDE.md`, `docs/PRIVACY_POLICY.md`, `docs/CHROME_WEB_STORE_LISTING.md`, `docs/FIREFOX_AMO_CHECKLIST.md`, `docs/RELEASE_QA_CHECKLIST.md`
- Test: `tests/productization.test.js`
- Test: `tests/security.test.js`

- [ ] Before implementation, keep public docs marked planned, not implemented.
- [ ] After implementation, update public docs only after focused tests and browser QA pass.
- [ ] Assert public docs do not claim layout-preserving XLSX redaction, protected-site XLSX rebuild support, remote processing, formula preservation, chart preservation, metadata preservation, macro support, or legacy spreadsheet support before the feature is actually shipped.
- [ ] Assert raw XLSX text never appears in reports, debug snapshots, audit metadata, logs, cache snapshots, warnings, or release copy.

## Required Test Plan

Future implementation must add or strengthen tests for:

- protected-site XLSX with fake API key produces `.redacted.xlsx`
- output MIME is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- raw key not in generated XLSX bytes/text
- generated XLSX extraction does not recover raw key
- generated XLSX contains placeholder/redacted text
- original XLSX sharedStrings, worksheet, comment, docProps, custom XML, media, and calc-chain markers absent
- `.redacted.txt` fallback remains available
- `.xls` does not upload raw
- `.xlsm` does not upload raw
- malformed XLSX does not upload raw
- encrypted XLSX does not upload raw
- no-text/image-only XLSX does not upload raw
- large/truncated regenerated output uses the safest default: prefer `.redacted.txt` fallback
- Gemini/Grok pending attach unchanged
- adapter contract tests pass
- no raw text in logs/storage/debug/audit/cache/report metadata
- JSON reports sanitized/redacted only
- no new permissions
- no remote calls

## Readiness Gate

Do not start implementation until these are true:

- this plan is reviewed
- Phase 16B-H scanner XLSX hardening tests are passing
- protected-site pipeline owners agree on the fallback/truncation default
- browser QA can inspect the protected-site handoff file bytes and MIME
- release copy owners agree that public docs stay planned until implementation passes QA
