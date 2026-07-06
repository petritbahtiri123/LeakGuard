# WhatsApp Web Support Matrix

This is the current documentation source of truth for WhatsApp Web support. It covers `https://web.whatsapp.com/*` only and must stay aligned with the WhatsApp QA checklists under [qa/](qa/).

LeakGuard's WhatsApp paths are local-only. They do not use backend file processing, telemetry, cloud verification, remote OCR, or remote model calls.

## Current Support

| Entry path | WhatsApp support | Limits | Safety behavior |
| --- | --- | --- | --- |
| Typing | supported | text and multiline text | rewrite plus verification before send |
| Text paste | supported | text only | redacts before send |
| Clipboard image paste | supported | PNG, JPG, JPEG, WEBP | OCR/redacted image or fail closed |
| Attach button single | supported | supported file registry paths | sanitized handoff only |
| Attach button multi | supported | 2-5 files | all-or-nothing, ordered |
| Drag/drop single | supported | supported file registry paths | sanitized handoff only |
| Drag/drop multi | supported | 2-5 files | all-or-nothing, ordered |
| 6+ files | blocked | before read | fail closed |
| Unsupported file | blocked | all paths | no raw passthrough |
| File paste | out of scope | except clipboard image paste | blocked/fail closed |

## Supported WhatsApp File Types

WhatsApp attach-button and drag/drop paths support these file families when LeakGuard can complete a sanitized file handoff:

- canonical text files from `FileTypeRegistry`: `.txt`, `.md`, `.markdown`, `.env`, `.log`, `.json`, `.yaml`, `.yml`, `.pem`, `.key`, `.toml`, `.xml`, `.csv`, `.ini`, `.conf`, `.cfg`, `.ps1`, `.sh`, `.bash`, `.zsh`, `.bat`, `.cmd`, `.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.html`, `.css`, `.scss`, `.java`, `.c`, `.cpp`, `.h`, `.hpp`, `.cs`, `.go`, `.rs`, `.rb`, `.php`, and `.sql`
- extensionless `Dockerfile`
- extensionless `Makefile`
- PNG, JPG, JPEG, and WEBP images
- text PDFs
- DOCX documents
- XLSX spreadsheets

Text PDFs, DOCX files, and XLSX files are rebuilt from sanitized extracted text only when generation is complete. WhatsApp must not receive extracted text inserted into the message composer as fallback.

## Unsupported Or Out Of Scope

- 6 or more selected/dropped files are blocked before any file is read.
- Unsupported file families are blocked.
- File paste remains out of scope except clipboard image paste for PNG, JPG, JPEG, and WEBP.
- Scanned or image-only PDF OCR remains fail closed unless the current pipeline explicitly supports that path.
- GIF, BMP, ICO, and SVG are unsupported.
- Archives, executables, legacy or macro Office files, and arbitrary binaries are unsupported.

## Safety Model

WhatsApp support must preserve these invariants:

- raw input is consumed or cleared before processing
- only sanitized `File` objects are handed to WhatsApp
- exact object identity, count, and order are verified before handoff is accepted
- multi-file attach/drop is deterministic and ordered
- unsupported or failing batches block all-or-nothing
- there is no raw fallback after LeakGuard consumes or attempts to sanitize a file
- there is no partial handoff for failed batches
- there is no extracted-text fallback into the WhatsApp composer
- unsafe filenames, raw file content, OCR text, and debug details must not leak into the composer, preview, logs, reports, or metadata

## Browser Compatibility Notes

| Browser family | WhatsApp status | Release note |
| --- | --- | --- |
| Chrome / Chromium | Supported with the Chrome MV3 target after release QA | Primary manual WhatsApp live-site validation target. |
| Firefox | Supported with the Firefox MV3 target after release QA | Validate separately because hidden upload controls and user activation can differ. |
| Edge | Uses the Chrome target | Treat as Chromium-compatible only after Edge smoke or manual QA evidence for the target release. |

Live WhatsApp QA requires a tester-owned account and should remain manual/headed. CI should rely on local WhatsApp-like fixtures for deterministic safety behavior.

## QA Entry Points

- [WhatsApp text QA](qa/whatsapp-web-text-only-qa.md)
- [WhatsApp clipboard image paste QA](qa/whatsapp-web-image-paste-qa.md)
- [WhatsApp image attach QA](qa/whatsapp-web-image-attach-qa.md)
- [WhatsApp text document attach QA](qa/whatsapp-web-text-document-attach-qa.md)
- [WhatsApp PDF attach QA](qa/whatsapp-web-pdf-attach-qa.md)
- [WhatsApp DOCX attach QA](qa/whatsapp-web-docx-attach-qa.md)
- [WhatsApp XLSX attach QA](qa/whatsapp-web-xlsx-attach-qa.md)
- [WhatsApp drag/drop QA](qa/whatsapp-web-drag-drop-qa.md)
- [WhatsApp multi-file QA](qa/whatsapp-web-multi-file-qa.md)

