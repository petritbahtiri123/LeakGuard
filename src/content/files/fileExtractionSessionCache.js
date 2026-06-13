(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const DEFAULT_TTL_MS = 10 * 60 * 1000;
  const MAX_ENTRIES = 24;
  const SAFE_STATUSES = new Set(["ready", "ok"]);
  const UNSAFE_TEXT_KEYS = new Set([
    "rawtext",
    "extractedtext",
    "originaltext",
    "sourcetext",
    "filetext"
  ]);
  const UNSAFE_METADATA_KEYS = new Set([
    ...UNSAFE_TEXT_KEYS,
    "originalname",
    "content",
    "bytes",
    "arraybuffer"
  ]);
  const cache = new Map();

  function nowMs() {
    return Date.now();
  }

  function normalizePart(value) {
    return String(value || "").trim().toLowerCase();
  }

  function hashString(input) {
    let hash = 0x811c9dc5;
    const text = String(input || "");
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function getFileSignature(file) {
    if (!file) return "";
    return hashString([
      normalizePart(file.name),
      Math.max(0, Number(file.size || 0)),
      Math.max(0, Number(file.lastModified || 0)),
      normalizePart(file.type)
    ].join("|"));
  }

  function getSizeBucket(size) {
    const bytes = Math.max(0, Number(size || 0));
    if (bytes === 0) return "0";
    if (bytes <= 1024) return "1kb";
    if (bytes <= 10 * 1024) return "10kb";
    if (bytes <= 100 * 1024) return "100kb";
    if (bytes <= 1024 * 1024) return "1mb";
    return "gt_1mb";
  }

  function cloneWarnings(warnings) {
    return Array.isArray(warnings) ? warnings.map((warning) => String(warning || "")).filter(Boolean) : [];
  }

  function cloneMetadata(metadata) {
    const cloned = JSON.parse(JSON.stringify(metadata || {}));
    if (cloned.original && Object.prototype.hasOwnProperty.call(cloned.original, "name")) {
      delete cloned.original.name;
    }
    if (cloned.extraction && Object.prototype.hasOwnProperty.call(cloned.extraction, "fileName")) {
      delete cloned.extraction.fileName;
    }
    if (cloned.file && Object.prototype.hasOwnProperty.call(cloned.file, "name")) {
      delete cloned.file.name;
    }
    return cloned;
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function hasUnsafeTopLevelTextField(result) {
    if (!result || typeof result !== "object") return false;
    return Array.from(UNSAFE_TEXT_KEYS).some((unsafeKey) =>
      Object.keys(result).some((key) => key.toLowerCase() === unsafeKey)
    );
  }

  function hasUnsafeMetadataKey(value) {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some((item) => hasUnsafeMetadataKey(item));
    return Object.keys(value).some((key) =>
      UNSAFE_METADATA_KEYS.has(key.toLowerCase()) || hasUnsafeMetadataKey(value[key])
    );
  }

  function cloneSafeValue(value) {
    if (!value) return null;
    return {
      status: value.status,
      outputName: value.outputName,
      outputKind: value.outputKind,
      extractedKind: value.extractedKind,
      sanitizedText: value.sanitizedText,
      metadata: cloneMetadata(value.metadata),
      warnings: cloneWarnings(value.warnings),
      safeForUpload: value.safeForUpload === true,
      fallbackReason: value.fallbackReason || ""
    };
  }

  function canStoreResult(result) {
    if (!result || typeof result !== "object") return false;
    if (!SAFE_STATUSES.has(String(result.status || ""))) return false;
    if (result.safeForUpload !== true) return false;
    if (hasUnsafeTopLevelTextField(result)) return false;
    if (hasUnsafeMetadataKey(result.metadata)) return false;
    if (hasOwn(result, "rawText") || hasOwn(result, "extractedText") || hasOwn(result, "originalText")) return false;

    const sanitizedText = String(result.sanitizedText || "");
    if (!sanitizedText.trim()) return false;

    const outputName = String(result.outputName || "");
    if (!outputName) return false;
    if (result.outputKind === "redacted_text_file") return outputName.toLowerCase().endsWith(".redacted.txt");
    if (result.outputKind === "redacted_pdf_file") {
      return result.extractedKind === "pdf" && outputName.toLowerCase().endsWith(".redacted.pdf");
    }
    if (result.outputKind === "sanitized_text_file") return result.extractedKind === "text";
    return false;
  }

  function pruneExpired(time = nowMs()) {
    for (const [key, entry] of cache.entries()) {
      if (!entry || entry.expiresAt <= time) cache.delete(key);
    }
  }

  function trimToMaxEntries() {
    while (cache.size > MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) break;
      cache.delete(oldestKey);
    }
  }

  function get(file) {
    const key = getFileSignature(file);
    if (!key) return null;
    const time = nowMs();
    pruneExpired(time);
    const entry = cache.get(key);
    if (!entry || entry.expiresAt <= time) {
      cache.delete(key);
      return null;
    }
    return cloneSafeValue(entry.value);
  }

  function set(file, result, options = {}) {
    if (!canStoreResult(result)) return false;
    const key = getFileSignature(file);
    if (!key) return false;
    pruneExpired();
    cache.set(key, {
      expiresAt: nowMs() + Math.max(1, Number(options.ttlMs || DEFAULT_TTL_MS)),
      value: cloneSafeValue(result),
      meta: {
        key,
        status: result.status,
        outputKind: result.outputKind,
        extractedKind: result.extractedKind,
        sizeBucket: getSizeBucket(file?.size)
      }
    });
    trimToMaxEntries();
    return true;
  }

  function clear() {
    cache.clear();
  }

  function debugSnapshot() {
    pruneExpired();
    return {
      ttlMs: DEFAULT_TTL_MS,
      entries: Array.from(cache.values()).map((entry) => ({ ...entry.meta }))
    };
  }

  root.PWM.FileExtractionSessionCache = {
    clear,
    debugSnapshot,
    get,
    getFileSignature,
    set
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileExtractionSessionCache;
  }
})();
