# LeakGuard 2.2.0 Multi-file Protected Upload Notes

LeakGuard 2.2.0 adds focused protected-site support for size-classed multi-file attach, drop, select, or paste-file operations without changing detector thresholds or the single-file redaction path.

## Policy

- Small files are files up to 4 MiB. Protected upload operations may include up to 20 small files.
- Large files are files above 4 MiB and up to 50 MB. Protected upload operations may include up to 5 large files.
- Mixed small/large batches are allowed within both caps, such as 1 MB + 5 MB + 10 MB + 25 MB + 50 MB.
- The same caps apply to drag/drop, file input selection, paste file attachments where exposed by the browser/site, sanitized direct handoff, and Gemini/Grok sanitized pending attach.
- Files above 50 MB are blocked before reading or upload with `file_exceeds_supported_size`.
- Batches above the small-file or large-file cap are blocked before reading or upload; LeakGuard does not process or silently ignore extras.
- Each accepted file is processed independently and sanitized outputs are handed off in deterministic input order where the browser/site accepts synthetic file handoff.
- Mixed batches may partially succeed: supported files can be sanitized and attached while unsupported, unsafe, unreadable, or failed files are blocked fail-closed.
- If sanitized batch handoff fails, the whole raw upload remains blocked. LeakGuard does not retry with raw files.

## Adapter behavior

- Built-in protected-site adapters declare sanitized multi-file handoff capability through their existing direct file-input handoff path.
- Gemini/Grok can queue one sanitized-only multi-file pending batch when direct sanitized handoff fails and every accepted file produced a safe sanitized output. The pending batch stores sanitized file references plus metadata-only summaries, expires on TTL cleanup, and is replaced by any newer pending batch.
- Single-file Gemini/Grok pending attach behavior remains unchanged.

## Debug and QA safety

- Multi-file debug metadata uses file index, safe `file-N` labels, extension, MIME category, byte size, status, and safe reason codes only.
- Raw filenames, paths, file contents, raw `File` objects, and token-shaped strings must not appear in debug/browser QA reports.
- Browser QA should cover 2-file, 5-large-file, 20-small-file, over-cap small and large batches, mixed supported/unsupported, duplicate-name, small/large mix, image/PDF/DOCX/XLSX/text batches, and Gemini/Grok sanitized-only multi-file pending attach before store release.

## Local manual validation

1. On a protected site, attach two small supported files such as `.env` and `.json`; confirm only sanitized files appear.
2. Attach five supported large text files such as 1 MB, 5 MB, 10 MB, 25 MB, and 50 MB `.txt` files; confirm all five sanitized files are handed off in order.
3. Attach twenty supported small text files; confirm all twenty sanitized files are handed off in order.
4. Attach twenty-one small files or six large files; confirm the operation is blocked before reading and no raw files upload.
5. Attach a mixed batch such as `.env`, `.svg`, and a text PDF; confirm supported sanitized outputs can attach and the unsupported file is blocked with metadata-only status.
6. Attach duplicate filenames with different contents; confirm they are processed as separate indexed files.
7. Attach one file above 50 MB; confirm it is blocked with `file_exceeds_supported_size` and no raw upload.
