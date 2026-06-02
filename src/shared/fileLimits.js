(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const LOCAL_TEXT_FAST_MAX_BYTES = 2 * 1024 * 1024;
  const LOCAL_TEXT_OPTIMIZED_MAX_BYTES = 4 * 1024 * 1024;
  const LOCAL_TEXT_HARD_BLOCK_BYTES = 4 * 1024 * 1024;
  const LARGE_TEXT_STREAMING_MAX_BYTES = 50 * 1024 * 1024;
  const MAX_TEXT_FILE_SIZE_BYTES = LARGE_TEXT_STREAMING_MAX_BYTES;
  const LOCAL_TEXT_HARD_BLOCK_TITLE = "Large payload blocked for browser stability";
  const LOCAL_TEXT_HARD_BLOCK_MESSAGE =
    "This content is over 4 MB. LeakGuard did not process or send it automatically to avoid browser instability. Split the file into smaller parts, or sanitize it separately before upload.";
  const LARGE_TEXT_STREAMING_BLOCK_TITLE = "File too large for local redaction";
  const LARGE_TEXT_STREAMING_BLOCK_MESSAGE =
    "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.";
  const LOCAL_FILE_STREAMING_REQUIRED_MESSAGE =
    "LeakGuard will stream-redact this large text file locally before upload.";
  const REDACTED_PREVIEW_LIMIT = 4000;
  const UNSUPPORTED_TEXT_RELEASE_MESSAGE =
    "This release scans text files only. Unsupported formats such as PDFs, DOCX files, images, archives, executables, and binary files are not scanned or redacted.";
  const UNSUPPORTED_COMPOSER_FILE_MESSAGE =
    "LeakGuard did not scan or redact this file. Unsupported file types such as PDF, DOCX, images, archives, executables, and binary files are not protected in this release. Normal upload may continue through the site.";
  const STREAMING_CHUNK_SIZE_BYTES = 512 * 1024;
  const STREAMING_OVERLAP_CHARS = 16 * 1024;
  const STREAMING_MAX_BUFFER_CHARS = 2 * 1024 * 1024;
  const STREAMING_INVALID_UTF8_MESSAGE =
    "This file is not valid UTF-8 text. LeakGuard blocked the raw upload because it cannot safely sanitize this encoding yet.";
  const LOCAL_FILE_MULTI_MESSAGE =
    "LeakGuard did not attach these files. Paste or drop one supported text file at a time.";
  const LOCAL_FILE_READ_MESSAGE =
    "LeakGuard could not read this local file, so nothing was attached.";
  const LOCAL_FILE_TEXT_INSERTION_FALLBACK_ENABLED = false;
  const DEFAULT_SANITIZED_TEXT_FILE_NAME = "leakguard-redacted.txt";

  root.PWM.FileLimits = {
    LOCAL_TEXT_FAST_MAX_BYTES,
    LOCAL_TEXT_OPTIMIZED_MAX_BYTES,
    LOCAL_TEXT_HARD_BLOCK_BYTES,
    LOCAL_TEXT_HARD_BLOCK_TITLE,
    LOCAL_TEXT_HARD_BLOCK_MESSAGE,
    LARGE_TEXT_STREAMING_MAX_BYTES,
    LARGE_TEXT_STREAMING_BLOCK_TITLE,
    LARGE_TEXT_STREAMING_BLOCK_MESSAGE,
    LOCAL_FILE_STREAMING_REQUIRED_MESSAGE,
    MAX_TEXT_FILE_SIZE_BYTES,
    REDACTED_PREVIEW_LIMIT,
    UNSUPPORTED_TEXT_RELEASE_MESSAGE,
    UNSUPPORTED_COMPOSER_FILE_MESSAGE,
    STREAMING_CHUNK_SIZE_BYTES,
    STREAMING_OVERLAP_CHARS,
    STREAMING_MAX_BUFFER_CHARS,
    STREAMING_INVALID_UTF8_MESSAGE,
    LOCAL_FILE_MULTI_MESSAGE,
    LOCAL_FILE_READ_MESSAGE,
    LOCAL_FILE_TEXT_INSERTION_FALLBACK_ENABLED,
    DEFAULT_SANITIZED_TEXT_FILE_NAME
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileLimits;
  }
})();
