# WhatsApp Web Multi-File QA

Use this checklist for WhatsApp Web attach-button and drag/drop batches. Use only synthetic files with fake secrets.

## Scope

- Supported: multi-file batches through attach button or drag/drop within the same protected-site small/large batch caps used by other adapters.
- Supported families: canonical `FileTypeRegistry` text files including `Dockerfile` and `Makefile`, PNG/JPG/JPEG/WEBP images, PDF, DOCX, and XLSX.
- Blocked: over-cap batches before read.
- Blocked: any unsupported file family, extraction failure, OCR/redaction failure, rebuild failure, or sanitized handoff verification failure.
- Out of scope: file paste, except clipboard image paste covered by [whatsapp-web-image-paste-qa.md](whatsapp-web-image-paste-qa.md).

## Supported 2-File Batch

1. Select or drop two supported files, such as `Dockerfile` and `Makefile`.
2. Confirm LeakGuard consumes or clears the raw input before WhatsApp previews either file.
3. Confirm both files are scanned, redacted, rebuilt if needed, and handed off as sanitized `File` objects.
4. Confirm output order matches input order.
5. Confirm no extracted text is inserted into the WhatsApp composer.
6. Confirm no raw preview, raw filename containing unsafe text, or raw file content appears.

## Supported 20-Small-File Batch

1. Select or drop twenty small supported files.
2. Prefer a mixed batch of supported text-like files, PDFs, DOCX files, XLSX files, and PNG/JPG/JPEG/WEBP images that stays within the small-file size cap.
3. Confirm all twenty files are processed locally and independently.
4. Confirm WhatsApp receives exactly twenty sanitized `File` objects in input order.
5. Confirm there is no raw fallback, no partial preview, and no extracted-text fallback into the composer.

## Over-Cap Files Block

1. Select or drop a batch that exceeds the protected-site batch caps, such as twenty-one small supported files or six large supported files.
2. Confirm LeakGuard blocks before reading any file.
3. Confirm WhatsApp shows no raw preview and receives no files.
4. Confirm the failure reason is metadata-only.

Repeat with a larger batch if release QA needs extra confidence. The expected result remains a before-read block.

## Unsupported Or Failing Mixed Batch

1. Select or drop a mixed batch with at least one supported file and one unsupported or failing file, such as `.gif`, `.bmp`, `.ico`, `.svg`, `.zip`, `.exe`, malformed PDF, malformed DOCX, malformed XLSX, or malformed image.
2. Confirm LeakGuard blocks the whole batch.
3. Confirm no supported file from the same batch is partially handed off.
4. Confirm WhatsApp receives no files and no composer text.
5. Confirm no raw filename/content, OCR text, stack trace, or unsafe debug detail appears.

## Attach And Drop Parity

Run each batch class through both entry paths:

- attach button
- drag/drop

Expected behavior must match: sanitized all-or-nothing handoff for supported in-cap batches, before-read block for over-cap batches, and all-or-nothing block for unsupported or failing batches.

## Regression Links

After multi-file QA, spot-check:

- [WhatsApp text QA](whatsapp-web-text-only-qa.md)
- [WhatsApp clipboard image paste QA](whatsapp-web-image-paste-qa.md)
- [WhatsApp drag/drop QA](whatsapp-web-drag-drop-qa.md)
