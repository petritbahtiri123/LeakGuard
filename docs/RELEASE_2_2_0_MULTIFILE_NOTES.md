# LeakGuard 2.2.0 Multi-file Protected Upload Notes

LeakGuard 2.2.0 adds focused protected-site support for up to 5 files in one attach, drop, or select operation without changing detector thresholds or the single-file redaction path.

## Policy

- Maximum accepted files per protected upload operation: 5.
- Batches with more than 5 files are blocked before upload; LeakGuard does not process or silently ignore extras.
- For 2–5 files, each file is processed independently and sanitized outputs are handed off in deterministic input order where the browser/site accepts synthetic file handoff.
- Mixed batches may partially succeed: supported files can be sanitized and attached while unsupported, unsafe, oversized, unreadable, or failed files are blocked fail-closed.
- If sanitized batch handoff fails, the whole raw upload remains blocked. LeakGuard does not retry with raw files.

## Adapter behavior

- Built-in protected-site adapters declare sanitized multi-file handoff capability through their existing direct file-input handoff path.
- Gemini/Grok can queue one sanitized-only multi-file pending batch when direct sanitized handoff fails and every accepted file produced a safe sanitized output. The pending batch stores sanitized file references plus metadata-only summaries, expires on TTL cleanup, and is replaced by any newer pending batch.
- Single-file Gemini/Grok pending attach behavior remains unchanged.

## Debug and QA safety

- Multi-file debug metadata uses file index, safe `file-N` labels, extension, MIME category, byte size, status, and safe reason codes only.
- Raw filenames, paths, file contents, raw `File` objects, and token-shaped strings must not appear in debug/browser QA reports.
- Browser QA should cover 2-file, 5-file, >5-file, mixed supported/unsupported, duplicate-name, small/large mix, image/PDF/DOCX/XLSX/text batches, and Gemini/Grok sanitized-only multi-file pending attach before store release.

## Local manual validation

1. On a protected site, attach two small supported files such as `.env` and `.json`; confirm only sanitized files appear.
2. Attach five supported files such as `.env`, `.json`, `.log`, `.md`, and `.txt`; confirm all five sanitized files are handed off in order.
3. Attach six files; confirm the operation is blocked and no raw files upload.
4. Attach a mixed batch such as `.env`, `.svg`, and a text PDF; confirm supported sanitized outputs can attach and the unsupported file is blocked with metadata-only status.
5. Attach duplicate filenames with different contents; confirm they are processed as separate indexed files.
6. Attach one large file with small files; confirm the large file fails closed if it exceeds the safe multi-file path while small supported files remain sanitized-only.
