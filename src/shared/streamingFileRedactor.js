(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const STREAMING_CHUNK_SIZE_BYTES = 512 * 1024;
  const STREAMING_OVERLAP_CHARS = 16 * 1024;
  const STREAMING_MAX_BUFFER_CHARS = 2 * 1024 * 1024;
  const LARGE_TEXT_STREAMING_MAX_BYTES = 50 * 1024 * 1024;
  const STREAMING_BLOCK_TITLE = "File too large for local redaction";
  const STREAMING_BLOCK_MESSAGE =
    "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.";
  const STREAMING_INVALID_UTF8_MESSAGE =
    "This file is not valid UTF-8 text. LeakGuard blocked the raw upload because it cannot safely sanitize this encoding yet.";

  function normalizeFileName(fileName) {
    return String(fileName || "").split(/[\\/]/).pop() || "leakguard-redacted.txt";
  }

  function getFileSize(file) {
    return Number(file?.size || file?.sizeBytes || 0);
  }

  function normalizeMimeType(mimeType) {
    return String(mimeType || "").split(";")[0].trim().toLowerCase() || "text/plain";
  }

  function applyReplacements(text, replacements) {
    const input = String(text || "");
    const sorted = [...(replacements || [])].sort((left, right) => left.start - right.start);
    const chunks = [];
    let cursor = 0;

    for (const replacement of sorted) {
      const start = Math.max(0, Math.min(input.length, Number(replacement.start) || 0));
      const end = Math.max(start, Math.min(input.length, Number(replacement.end) || start));
      if (start < cursor) continue;
      chunks.push(input.slice(cursor, start), String(replacement.placeholder || "[REDACTED]"));
      cursor = end;
    }

    chunks.push(input.slice(cursor));
    return chunks.join("");
  }

  function splitStableReplacements(replacements, stableLength) {
    let safeLength = stableLength;

    for (const replacement of replacements || []) {
      const start = Number(replacement.start) || 0;
      const end = Number(replacement.end) || start;
      if (start < safeLength && end > safeLength) {
        safeLength = Math.min(safeLength, start);
      }
    }

    return {
      safeLength,
      replacements: (replacements || [])
        .filter((replacement) => Number(replacement.end || 0) <= safeLength)
        .sort((left, right) => left.start - right.start)
    };
  }

  function hasOpenPrivateKeyBlock(text, safeLength) {
    const prefix = String(text || "").slice(0, Math.max(0, safeLength));
    const begin = prefix.lastIndexOf("-----BEGIN ");
    if (begin === -1) return null;

    const end = prefix.lastIndexOf("-----END ");
    if (end > begin) return null;

    if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(prefix.slice(begin))) {
      return begin;
    }

    return null;
  }

  async function* readFileByteChunks(file, chunkSize) {
    if (file && typeof file.stream === "function") {
      const reader = file.stream().getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) yield value;
        }
      } finally {
        reader.releaseLock?.();
      }
      return;
    }

    if (file && typeof file.slice === "function") {
      const size = getFileSize(file);
      for (let offset = 0; offset < size; offset += chunkSize) {
        const part = file.slice(offset, Math.min(size, offset + chunkSize));
        if (!part || typeof part.arrayBuffer !== "function") {
          throw new Error("LeakGuard cannot stream this local file in this browser.");
        }
        yield new Uint8Array(await part.arrayBuffer());
      }
      return;
    }

    throw new Error("LeakGuard cannot stream this local file in this browser.");
  }

  function createSanitizedFile(file, parts, createFile) {
    const name = normalizeFileName(file?.name);
    const type = normalizeMimeType(file?.type);

    if (typeof createFile === "function") {
      return createFile({ name, type, parts });
    }

    const options = {
      type,
      lastModified: Date.now()
    };

    if (typeof root.File === "function") {
      return new root.File(parts, name, options);
    }

    if (typeof root.Blob === "function") {
      const blob = new root.Blob(parts, { type });
      try {
        Object.defineProperty(blob, "name", {
          value: name,
          configurable: true
        });
        Object.defineProperty(blob, "lastModified", {
          value: options.lastModified,
          configurable: true
        });
      } catch {
        // The sanitized bytes are still available even if metadata is read-only.
      }
      return blob;
    }

    return null;
  }

  function isTextDecoderError(error) {
    return (
      error instanceof TypeError &&
      /TextDecoder|encoded data|decode/i.test(String(error?.message || ""))
    );
  }

  async function redactTextFileStream(file, options = {}) {
    const sizeBytes = getFileSize(file);
    const maxBytes = Number(options.maxBytes || LARGE_TEXT_STREAMING_MAX_BYTES);
    const chunkSize = Number(options.chunkSize || STREAMING_CHUNK_SIZE_BYTES);
    const overlapSize = Number(options.overlapSize || STREAMING_OVERLAP_CHARS);
    const redactText = options.redactText;
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};

    if (sizeBytes > maxBytes) {
      return {
        action: "blocked",
        error: STREAMING_BLOCK_MESSAGE,
        title: STREAMING_BLOCK_TITLE,
        bytesProcessed: 0,
        findingsCount: 0
      };
    }

    if (typeof redactText !== "function") {
      return {
        action: "failed",
        error: "LeakGuard streaming redaction is unavailable.",
        bytesProcessed: 0,
        findingsCount: 0
      };
    }

    const decoder = new TextDecoder("utf-8", { fatal: true });
    const parts = [];
    let rawBuffer = "";
    let bytesProcessed = 0;
    let findingsCount = 0;

    const flushStableBuffer = async (final = false) => {
      if (!rawBuffer) return;

      let stableLength = final ? rawBuffer.length : Math.max(0, rawBuffer.length - overlapSize);
      const privateKeyStart = hasOpenPrivateKeyBlock(rawBuffer, stableLength);
      if (privateKeyStart !== null) {
        stableLength = Math.min(stableLength, privateKeyStart);
      }
      if (!final && stableLength <= 0) {
        if (rawBuffer.length > STREAMING_MAX_BUFFER_CHARS) {
          throw new Error("LeakGuard blocked a long streaming segment that could not be safely bounded.");
        }
        return;
      }

      const result = await redactText(rawBuffer);
      const replacements = result?.replacements || result?.findings || [];
      const stable = splitStableReplacements(replacements, stableLength);

      if (!final && stable.safeLength <= 0) {
        if (rawBuffer.length > STREAMING_MAX_BUFFER_CHARS) {
          throw new Error("LeakGuard blocked a long streaming secret that crossed too much content.");
        }
        return;
      }

      const segment = rawBuffer.slice(0, final ? rawBuffer.length : stable.safeLength);
      const segmentReplacements = final ? replacements : stable.replacements;
      parts.push(applyReplacements(segment, segmentReplacements));
      findingsCount += segmentReplacements.length;
      rawBuffer = final ? "" : rawBuffer.slice(stable.safeLength);
    };

    try {
      for await (const bytes of readFileByteChunks(file, chunkSize)) {
        const byteLength = Number(bytes?.byteLength || bytes?.length || 0);
        bytesProcessed += byteLength;
        rawBuffer += decoder.decode(bytes, { stream: true });
        await flushStableBuffer(false);
        onProgress({ bytesProcessed, totalBytes: sizeBytes });
      }

      rawBuffer += decoder.decode();
      await flushStableBuffer(true);
    } catch (error) {
      return {
        action: "failed",
        error: isTextDecoderError(error)
          ? STREAMING_INVALID_UTF8_MESSAGE
          : error?.message || "LeakGuard could not stream-redact this file.",
        code: isTextDecoderError(error) ? "invalid_utf8" : "streaming_redaction_failed",
        bytesProcessed,
        findingsCount
      };
    }

    const sanitizedFile = createSanitizedFile(file, parts, options.createFile);
    if (!sanitizedFile) {
      return {
        action: "failed",
        error: "LeakGuard could not create a sanitized local file.",
        bytesProcessed,
        findingsCount
      };
    }

    return {
      action: "redacted",
      sanitizedFile,
      findingsCount,
      bytesProcessed
    };
  }

  root.PWM.StreamingFileRedactor = {
    STREAMING_CHUNK_SIZE_BYTES,
    STREAMING_OVERLAP_CHARS,
    LARGE_TEXT_STREAMING_MAX_BYTES,
    STREAMING_BLOCK_TITLE,
    STREAMING_BLOCK_MESSAGE,
    STREAMING_INVALID_UTF8_MESSAGE,
    redactTextFileStream
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.StreamingFileRedactor;
  }
})();
